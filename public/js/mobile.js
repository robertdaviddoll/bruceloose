// Phone + controller extras: game controllers, vibration, fullscreen, keeping the screen awake.
// Every feature here is optional: if the browser doesn't support it, it quietly does nothing.

// ---------- Vibration (phone) + rumble (controller) ----------
const Haptics = (() => {
  // phone patterns in ms (vibrate, pause, vibrate, ...)
  const PATTERNS = { hurt: [80, 40, 80], stomp: 25, ability: 35, win: [60, 50, 60, 50, 140] };
  const RUMBLE = { hurt: [0.9, 0.6, 220], stomp: [0.3, 0.5, 60], ability: [0.4, 0.4, 90], win: [0.6, 0.6, 400] };
  let pad = null;
  return {
    setPad(p) { pad = p; },
    buzz(kind) {
      try { if (PATTERNS[kind] && navigator.vibrate) navigator.vibrate(PATTERNS[kind]); } catch { /* not allowed */ }
      try {
        const r = RUMBLE[kind], act = pad && pad.vibrationActuator;
        if (r && act && act.playEffect) act.playEffect('dual-rumble', { duration: r[2], strongMagnitude: r[0], weakMagnitude: r[1] });
      } catch { /* controller can't rumble */ }
    },
  };
})();

// ---------- Game controllers (Backbone, Kishi, Xbox, PlayStation, Switch Pro...) ----------
// Uses the browser's "standard" button layout:
//   d-pad / left stick = move, A (Cross) = jump, B / X / RB / RT = ability, Start / Menu = pause
const Gamepads = (() => {
  const DEADZONE = 0.35;
  let held = new Set();
  let wasConnected = false;

  function read() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const acts = new Set();
    for (const gp of pads) {
      const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const x = gp.axes[0] || 0;
      if (b(14) || x < -DEADZONE) acts.add('left');
      if (b(15) || x > DEADZONE) acts.add('right');
      if (b(0) || b(12)) acts.add('jump');
      if (b(1) || b(2) || b(5) || b(7)) acts.add('special');
      if (b(9)) acts.add('start');
    }
    if (pads.length) Haptics.setPad(pads[0]);
    const pressed = new Set([...acts].filter((a) => !held.has(a)));
    const changed = pressed.size > 0 || acts.size !== held.size;
    const connectedNow = pads.length > 0 && !wasConnected;
    wasConnected = pads.length > 0;
    held = acts;
    return { acts, pressed, changed, connected: pads.length > 0, connectedNow };
  }
  return { read, get held() { return held; } };
})();

// ---------- Fullscreen (+ lock to landscape where the phone allows it) ----------
const Fullscreen = (() => {
  const root = document.documentElement;
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  const supported = !!request;
  const isOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  async function toggle() {
    try {
      if (isOn()) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      await request.call(root, { navigationUI: 'hide' });
      try { await screen.orientation.lock('landscape'); } catch { /* most desktops + iPhone can't lock */ }
    } catch { /* blocked */ }
  }
  return { supported, toggle, isOn };
})();

// ---------- Keep the screen from dimming while playing ----------
const ScreenAwake = (() => {
  let lock = null;
  return {
    async on() {
      try {
        if (lock || !navigator.wakeLock) return;
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } catch { lock = null; }
    },
    off() { try { if (lock) lock.release(); } catch { /* already released */ } lock = null; },
  };
})();
