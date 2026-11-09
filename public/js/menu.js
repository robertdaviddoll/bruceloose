// Menu screens: main menu, cat picker, options, characters, hall of fame, pause and end screens.
// Works with touch / mouse (real buttons), keyboard (arrows, Enter, Esc) and controllers (d-pad, A, B).
// game.js decides what Start / Resume / Main menu actually do.

const Menu = (() => {
  const overlay = document.getElementById('overlay');
  const screens = {};
  document.querySelectorAll('.screen').forEach((s) => { screens[s.dataset.screen] = s; });

  let current = 'main';
  const stack = [];          // screens to go back to: { name, focus }
  const onEnterHooks = {};   // name -> fn when the screen opens
  const onSideHooks = {};    // name -> fn(dir) for left/right; return true if handled
  const onRootBack = {};     // name -> fn when Back is pressed with nowhere to go back to
  const onVertHooks = {};    // name -> fn(dir) for up/down; return true if handled

  const visible = () => !overlay.classList.contains('hidden');
  const focusables = () => [...screens[current].querySelectorAll('button, input')]
    .filter((el) => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);

  function focusDefault() {
    const el = screens[current].querySelector('[data-autofocus]') || focusables()[0];
    if (el) el.focus({ preventScroll: true });
  }

  function show(name, { remember = true, focus = null } = {}) {
    if (!screens[name]) return;
    if (remember && visible() && current !== name) stack.push({ name: current, focus: document.activeElement });
    for (const [n, el] of Object.entries(screens)) el.classList.toggle('active', n === name);
    current = name;
    overlay.classList.remove('hidden');
    overlay.scrollTop = 0;
    if (onEnterHooks[name]) onEnterHooks[name]();
    if (focus && screens[name].contains(focus) && focus.offsetParent !== null) focus.focus({ preventScroll: true });
    else focusDefault();
  }
  // jump straight to a screen, forgetting the back history (e.g. pause, game over)
  function reset(name) { stack.length = 0; show(name, { remember: false }); }
  function back() {
    if (stack.length) { const prev = stack.pop(); show(prev.name, { remember: false, focus: prev.focus }); }
    else if (onRootBack[current]) onRootBack[current]();
  }
  function hide() {
    stack.length = 0;
    overlay.classList.add('hidden');
    if (document.activeElement && overlay.contains(document.activeElement)) document.activeElement.blur();
  }

  function moveFocus(dir) {
    const els = focusables();
    if (!els.length) return;
    let i = els.indexOf(document.activeElement);
    i = i < 0 ? 0 : (i + dir + els.length) % els.length;
    els[i].focus({ preventScroll: false });
  }

  // action: up | down | left | right | confirm | back
  function nav(action) {
    if (!visible()) return;
    const el = document.activeElement;
    const focusedHere = el && screens[current].contains(el);
    if (action === 'back') { back(); return; }
    if (action === 'confirm') {
      if (!focusedHere) { focusDefault(); return; }
      el.click();
      if (el.classList.contains('pick')) { const start = document.getElementById('startBtn'); if (start) start.click(); }   // confirm on a cat = pick it and go
      return;
    }
    if (action === 'left' || action === 'right') {
      const d = action === 'left' ? -1 : 1;
      if (focusedHere && el.type === 'range') {
        el.value = Number(el.value) + d * Number(el.step || 1);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (onSideHooks[current] && onSideHooks[current](d)) return;
    }
    if ((action === 'up' || action === 'down') && onVertHooks[current] && onVertHooks[current](action === 'up' ? -1 : 1)) return;
    moveFocus(action === 'up' || action === 'left' ? -1 : 1);
  }

  // buttons with data-go="screen" open that screen; data-back goes back
  overlay.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { sfx('menu'); show(go.dataset.go); return; }
    if (e.target.closest('[data-back]')) { sfx('menu'); back(); }
  });

  // ---------- Options ----------
  const soundBtn = document.getElementById('optSound');
  const volume = document.getElementById('optVolume');
  const vibrateBtn = document.getElementById('optVibrate');
  const touchSeg = document.getElementById('optTouch');
  function syncOptions() {
    const on = Settings.get('sound');
    soundBtn.textContent = on ? 'On' : 'Off'; soundBtn.setAttribute('aria-pressed', String(on));
    volume.value = Settings.get('volume'); volume.disabled = !on;
    document.getElementById('optVolumeVal').textContent = `${Settings.get('volume')}%`;
    const vib = Settings.get('vibration');
    vibrateBtn.textContent = vib ? 'On' : 'Off'; vibrateBtn.setAttribute('aria-pressed', String(vib));
    touchSeg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === Settings.get('touch'))));
  }
  soundBtn.addEventListener('click', () => { Settings.set('sound', !Settings.get('sound')); syncOptions(); sfx('menu'); });
  let previewTimer = 0;
  volume.addEventListener('input', () => {
    Settings.set('volume', Number(volume.value)); syncOptions();
    clearTimeout(previewTimer); previewTimer = setTimeout(() => sfx('coin'), 120);
  });
  vibrateBtn.addEventListener('click', () => {
    Settings.set('vibration', !Settings.get('vibration')); syncOptions();
    Haptics.buzz('stomp');
  });
  touchSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    Settings.set('touch', b.dataset.v); syncOptions(); sfx('menu');
  });
  onEnterHooks.options = syncOptions;

  // ---------- Characters ----------
  let infoIndex = 0;
  const infoDots = document.getElementById('infoDots');
  CHARACTER_INFO.forEach((c, i) => {
    const d = document.createElement('button');
    d.className = 'dot'; d.tabIndex = -1; d.setAttribute('aria-label', c.name);
    d.addEventListener('click', () => { infoIndex = i; renderInfo(); sfx('menu'); });
    infoDots.append(d);
  });
  function renderInfo() {
    const c = CHARACTER_INFO[infoIndex];
    document.getElementById('infoName').textContent = c.name;
    document.getElementById('infoRole').textContent = c.role;
    document.getElementById('infoRole').dataset.role = c.role.split(' ').pop().toLowerCase();
    document.getElementById('infoBio').textContent = c.bio;
    document.getElementById('infoGame').textContent = c.game;
    document.getElementById('infoTip').textContent = `Tip: ${c.tip}`;
    document.getElementById('infoCount').textContent = `${infoIndex + 1} / ${CHARACTER_INFO.length}`;
    [...infoDots.children].forEach((d, i) => d.classList.toggle('on', i === infoIndex));
    if (api.drawPortrait) api.drawPortrait(document.getElementById('infoPortrait'), c);
  }
  function stepInfo(d) { infoIndex = (infoIndex + d + CHARACTER_INFO.length) % CHARACTER_INFO.length; renderInfo(); sfx('menu'); return true; }
  document.getElementById('infoPrev').addEventListener('click', () => stepInfo(-1));
  document.getElementById('infoNext').addEventListener('click', () => stepInfo(1));
  onEnterHooks.info = renderInfo;
  onSideHooks.info = stepInfo;

  // ---------- All scores ("See more") ----------
  // up/down scroll the list, left/right switch the device filter (unless typing in the search box)
  onEnterHooks.scores = () => Scoreboard.openAll();
  onVertHooks.scores = (d) => Scoreboard.scrollAll(d);
  onSideHooks.scores = (d) => { if (document.activeElement && document.activeElement.id === 'allPlayer') return false; Scoreboard.cycleDevice(d); return true; };

  // ---------- Hall of Fame ----------
  onEnterHooks.fame = () => Scoreboard.loadInto(document.getElementById('fameList'), document.getElementById('fameStatus'), 20);

  const api = {
    show, reset, back, hide, nav,
    get current() { return current; },
    get visible() { return visible(); },
    onEnter(name, fn) { const prev = onEnterHooks[name]; onEnterHooks[name] = prev ? () => { prev(); fn(); } : fn; },
    onSide(name, fn) { onSideHooks[name] = fn; },
    onRootBack(name, fn) { onRootBack[name] = fn; },
    onVertical(name, fn) { onVertHooks[name] = fn; },
    drawPortrait: null,   // set by game.js: (canvas, characterInfo) => void
  };
  return api;
})();
