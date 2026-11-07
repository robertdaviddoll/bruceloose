// Player options (sound, vibration, touch buttons), remembered in this browser.
const Settings = (() => {
  const KEY = 'bruceLooseSettings';
  const DEFAULTS = { sound: true, volume: 80, vibration: true, touch: 'auto' };   // touch: auto | on | off
  const data = { ...DEFAULTS };
  try { Object.assign(data, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage blocked or bad JSON */ }
  const listeners = [];
  return {
    get: (k) => data[k],
    set(k, v) {
      data[k] = v;
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage blocked */ }
      listeners.forEach((fn) => fn(k, v));
    },
    onChange(fn) { listeners.push(fn); },
  };
})();
