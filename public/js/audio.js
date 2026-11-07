// Tiny synth sound effects (no audio files needed).
let actx = null;
function initAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch { actx = null; } }
function sfx(kind) {
  if (!actx || !Settings.get('sound')) return;
  const vol = Settings.get('volume') / 100;
  if (vol <= 0) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.connect(g); g.connect(actx.destination);
  const s = { jump: ['square', 380, 720, 0.12, 0.06], coin: ['triangle', 990, 1480, 0.12, 0.08],
              stomp: ['square', 220, 90, 0.15, 0.08], hurt: ['sawtooth', 300, 60, 0.35, 0.08],
              cp: ['triangle', 520, 1040, 0.25, 0.08], throw: ['triangle', 600, 300, 0.12, 0.05],
              scare: ['sawtooth', 120, 600, 0.25, 0.07], pounce: ['square', 260, 900, 0.15, 0.06],
              growl: ['sawtooth', 90, 55, 0.45, 0.12], menu: ['triangle', 660, 880, 0.06, 0.04], slam: ['square', 140, 40, 0.3, 0.1], shout: ['square', 330, 280, 0.2, 0.04], win: ['triangle', 520, 1560, 0.6, 0.09] }[kind];
  o.type = s[0]; o.frequency.setValueAtTime(s[1], t); o.frequency.exponentialRampToValueAtTime(s[2], t + s[3]);
  g.gain.setValueAtTime(s[4] * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + s[3]);
  o.start(t); o.stop(t + s[3] + 0.02);
}
