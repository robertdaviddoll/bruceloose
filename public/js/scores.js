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

  // little device icons (drawn in currentColor so they match the text)
  const DEVICE_ICONS = {
    phone:   { label: 'Played on a phone',    svg: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><line x1="11" y1="18.5" x2="13" y2="18.5"/>' },
    tablet:  { label: 'Played on a tablet',   svg: '<rect x="4" y="2" width="16" height="20" rx="2.5"/><line x1="11" y1="18.5" x2="13" y2="18.5"/>' },
    desktop: { label: 'Played on a computer', svg: '<rect x="2" y="4" width="20" height="13" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>' },
  };
  function deviceIcon(type) {
    const d = DEVICE_ICONS[type];
    const span = document.createElement('span');
    span.className = 'device' + (d ? '' : ' unknown');
    if (!d) return span;                                  // scores saved before devices were tracked
    span.title = d.label;
    span.setAttribute('role', 'img'); span.setAttribute('aria-label', d.label);
    span.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d.svg}</svg>`;
    return span;
  }
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

  function render(scores, target = list) {
    if (!scores.length) {
      const li = document.createElement('li');
      li.className = 'empty'; li.textContent = 'No scores yet. Be the first!';
      target.replaceChildren(li);
      return;
    }
    target.replaceChildren(...scores.map((s, i) => {
      const li = document.createElement('li');
      if (s.id === savedId) li.classList.add('me');
      const cell = (cls, text) => { const span = document.createElement('span'); span.className = cls; span.textContent = text; return span; };
      li.append(
        cell('rank', i + 1),
        (() => { const n = cell('name', ''); n.append(deviceIcon(s.device), cell('who', s.name)); return n; })(),
        cell('meta', `${CAT_NAMES[s.character] || s.character} · ${s.result === 'won' ? 'won' : 'died'} · ${fmtTime(s.timeMs)}`),
        (() => {
          const sc = cell('score', '');
          if (Number.isInteger(s.checkpoints)) {         // older scores don't have this
            const cp = document.createElement('span');
            cp.className = 'cp';
            const label = `Passed ${s.checkpoints} of ${s.totalCheckpoints} checkpoint${s.totalCheckpoints === 1 ? '' : 's'}`;
            cp.title = label; cp.setAttribute('role', 'img'); cp.setAttribute('aria-label', label);
            cp.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
              + '<line x1="5" y1="22" x2="5" y2="3"/><path d="M5 4h12l-3 4 3 4H5" fill="currentColor"/></svg>';
            const n = document.createElement('span'); n.textContent = s.checkpoints; n.setAttribute('aria-hidden', 'true');
            cp.append(n);
            sc.append(cp);
          }
          sc.append(cell('pts', s.score.toLocaleString()));
          return sc;
        })(),
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

  // Hall of Fame screen: fill a list with the top scores
  async function loadInto(target, statusEl, limit = 20) {
    statusEl.textContent = 'Loading…';
    target.replaceChildren();
    await ready;
    if (!available) {
      statusEl.textContent = 'The Hall of Fame needs the score server. Start the game with docker compose (or npm run dev in server/) to save and see scores.';
      return;
    }
    try {
      const { scores } = await api(`api/scores?limit=${limit}`);
      statusEl.textContent = scores.length ? `Top ${Math.min(limit, scores.length)} of all time` : '';
      render(scores, target);
    } catch (err) {
      statusEl.textContent = `Couldn't load scores: ${err.message}`;
    }
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

  return { show, hide, loadInto };
})();
