// Score saving + leaderboard, talking to server/server.js through /api.
// If there's no backend (e.g. index.html opened straight from disk) it stays hidden.

const Scoreboard = (() => {
  const box = document.getElementById('scorebox');
  const form = document.getElementById('scoreForm');
  const nameInput = document.getElementById('playerName');
  const saveBtn = document.getElementById('saveScore');
  const status = document.getElementById('scoreStatus');
  const list = document.getElementById('leaderboard');
  const CAT_NAMES = { bruce: 'Bruce', gremlin: 'Gremlin' };
  const NAME_KEY = 'bruceLoosePlayer';

  let available = false;   // backend answered /api/health
  let pending = null;      // the run waiting to be saved
  let savedId = null;      // highlight this row after saving
  let showToken = 0;

  try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch { /* storage blocked */ }

  // Keep clicks and typing inside the panel away from the game's controls
  // (the overlay starts the game on click, and Space/A/D are game keys).
  for (const type of ['click', 'pointerdown', 'keydown', 'keyup']) box.addEventListener(type, (e) => e.stopPropagation());

  async function api(path, options) {
    const res = await fetch(path, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `The score server answered ${res.status}.`);
    return data;
  }

  const onHttp = /^https?:$/.test(globalThis.location?.protocol || '');
  const ready = onHttp
    ? api('api/health').then(() => { available = true; }).catch(() => {})
    : Promise.resolve();

  const fmtTime = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function render(scores) {
    if (!scores.length) {
      const li = document.createElement('li');
      li.className = 'empty'; li.textContent = 'No scores yet. Be the first!';
      list.replaceChildren(li);
      return;
    }
    list.replaceChildren(...scores.map((s, i) => {
      const li = document.createElement('li');
      if (s.id === savedId) li.classList.add('me');
      const cell = (cls, text) => { const span = document.createElement('span'); span.className = cls; span.textContent = text; return span; };
      li.append(
        cell('rank', i + 1),
        cell('name', s.name),
        cell('meta', `${CAT_NAMES[s.character] || s.character} · ${s.result === 'won' ? 'won' : 'died'} · ${fmtTime(s.timeMs)}`),
        cell('score', s.score.toLocaleString()),
      );
      return li;
    }));
  }

  async function refresh() {
    try { render((await api('api/scores?limit=10')).scores); }
    catch { list.replaceChildren(); }
  }

  // run: { score, coins, totalCoins, character, result: 'won'|'died', timeMs }
  async function show(run) {
    const token = ++showToken;
    await ready;
    if (!available || token !== showToken) return;
    pending = run; savedId = null;
    box.hidden = false; form.hidden = false; saveBtn.disabled = false;
    status.textContent = '';
    refresh();
  }

  function hide() {
    showToken++;
    pending = null;
    box.hidden = true;
    nameInput.blur();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pending) return;
    const name = nameInput.value.trim();
    if (!name) { status.textContent = 'Type a name first.'; nameInput.focus(); return; }
    try { localStorage.setItem(NAME_KEY, name); } catch { /* storage blocked */ }
    saveBtn.disabled = true; status.textContent = 'Saving…';
    try {
      const { id, rank } = await api('api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...pending }),
      });
      savedId = id; pending = null; form.hidden = true;
      status.textContent = `Saved! You're #${rank} on the leaderboard.`;
      refresh();
    } catch (err) {
      status.textContent = err.message;
      saveBtn.disabled = false;
    }
  });

  return { show, hide };
})();
