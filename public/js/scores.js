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
  // In-game leaderboards only show the current major.minor version (e.g. 0.1.x).
  // Scores from other versions (and untagged older ones) are "archived".
  const SERIES = GAME_CONFIG.version.split('.').slice(0, 2).join('.');

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

  // "how long ago" labels. The server stores UTC times like "2026-11-09 09:30:12".
  const parseUtc = (t) => (t ? new Date(`${t.replace(' ', 'T')}Z`) : null);
  function ago(date) {
    const s = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);   if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);   if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);   if (d < 7) return `${d}d ago`;
    if (d < 30) return `${Math.floor(d / 7)}w ago`;
    if (d < 365) return `${Math.max(1, Math.min(11, Math.floor(d / 30.44)))}mo ago`;
    return `${Math.floor(d / 365)}y ago`;
  }
  function agoSpan(createdAt) {
    const date = parseUtc(createdAt);
    const span = document.createElement('time');
    span.className = 'ago';
    if (!date || isNaN(date)) return span;
    span.dateTime = date.toISOString();
    span.title = date.toLocaleString();
    span.textContent = ` · ${ago(date)}`;
    return span;
  }
  // keep the labels fresh while a list is on screen
  setInterval(() => {
    document.querySelectorAll('.scores time.ago[datetime]').forEach((t) => {
      if (t.offsetParent !== null) t.textContent = ` · ${ago(new Date(t.dateTime))}`;
    });
  }, 15000);

  const fmtTime = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  function render(scores, target = list) {
    if (!scores.length) {
      const li = document.createElement('li');
      li.className = 'empty'; li.textContent = 'No scores yet. Be the first!';
      target.replaceChildren(li);
      return;
    }
    target.replaceChildren(...scores.map((s, i) => rowFor(s, i + 1)));
  }

  // one leaderboard row
  function rowFor(s, rank) {
      const li = document.createElement('li');
      if (s.id === savedId) li.classList.add('me');
      const cell = (cls, text) => { const span = document.createElement('span'); span.className = cls; span.textContent = text; return span; };
      li.append(
        cell('rank', rank),
        (() => { const n = cell('name', ''); n.append(deviceIcon(s.device), cell('who', s.name)); return n; })(),
        (() => {
          const m = cell('meta', `${CAT_NAMES[s.character] || s.character} · ${s.result === 'won' ? 'won' : 'died'} · ${fmtTime(s.timeMs)}${s.version ? ` · v${s.version}` : ''}`);
          m.append(agoSpan(s.createdAt));
          return m;
        })(),
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
  }

  async function refresh() {
    try { render((await api(`api/scores?limit=10&series=${SERIES}`)).scores); }
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
      const { scores } = await api(`api/scores?limit=${limit}&series=${SERIES}`);
      statusEl.textContent = scores.length ? `Top ${Math.min(limit, scores.length)} for v${SERIES}` : `No scores for v${SERIES} yet.`;
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
      const { id, rank, total, series } = await api('api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...pending }),
      });
      savedId = id; pending = null; form.hidden = true;
      status.textContent = total ? `Saved! You're #${rank} of ${total} on the ${series ? `v${series} ` : ''}leaderboard.` : `Saved! You're #${rank} on the leaderboard.`;
      refresh();
    } catch (err) {
      status.textContent = err.message;
      saveBtn.disabled = false;
    }
  });

  // ---------- "See more": every score, filter by device / player, loads more as you scroll ----------
  const all = {
    list: document.getElementById('allList'), status: document.getElementById('allStatus'),
    filters: document.getElementById('allFilters'), devices: document.getElementById('allDevice'), cats: document.getElementById('allCat'),
    era: document.getElementById('allEra'), title: document.getElementById('allTitle'),
    search: document.getElementById('allPlayer'), names: document.getElementById('allPlayers'),
  };
  const PAGE = 25;
  const query = { era: 'current', device: '', character: '', player: '' };
  let next = null, done = false, loading = false, shown = 0, generation = 0, totalText = '';
  const sentinel = document.createElement('li');                 // when this scrolls into view, load more
  sentinel.className = 'sentinel'; sentinel.setAttribute('aria-hidden', 'true');

  // device filter buttons: All + one per device, with the same icons as the rows
  const DEVICE_FILTERS = [['', 'All'], ['phone', 'Phone'], ['tablet', 'Tablet'], ['desktop', 'Computer']];
  for (const [v, label] of DEVICE_FILTERS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.v = v; b.setAttribute('aria-pressed', String(v === ''));
    if (v) { const icon = deviceIcon(v); icon.removeAttribute('role'); icon.removeAttribute('aria-label'); icon.removeAttribute('title'); b.append(icon); }
    const t = document.createElement('span'); t.className = 'lbl'; t.textContent = label; b.append(t);
    b.title = v ? `Only scores played on a ${label.toLowerCase()}` : 'Every device';
    all.devices.append(b);
  }
  all.devices.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    setDevice(b.dataset.v);
  });
  function setDevice(v) {
    query.device = v;
    all.devices.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === v)));
    loadPage(true);
  }
  // current version vs archived
  all.era.querySelector('[data-v="current"]').textContent = `v${SERIES}`;
  function syncEra() {
    all.era.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === query.era)));
    all.title.textContent = query.era === 'archived' ? 'Archived scores' : 'All scores';
  }
  function setEra(era) { query.era = era === 'archived' ? 'archived' : 'current'; syncEra(); }
  all.era.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    setEra(b.dataset.v); loadPage(true);
  });
  all.cats.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    query.character = b.dataset.v;
    all.cats.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    loadPage(true);
  });
  let searchTimer = 0;
  all.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { query.player = all.search.value.trim(); loadPage(true); }, 250);
  });

  const nearBottom = () => sentinel.isConnected &&
    sentinel.getBoundingClientRect().top < all.list.getBoundingClientRect().bottom + 200;
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) loadPage(false); },
                               { root: all.list, rootMargin: '0px 0px 200px 0px' })
    : null;
  all.list.addEventListener('scroll', () => { if (!observer && nearBottom()) loadPage(false); }, { passive: true });

  async function loadPage(reset) {
    if (reset) {
      generation++; next = null; done = false; loading = false; shown = 0;
      all.list.replaceChildren(); all.list.scrollTop = 0;
    }
    if (loading || done) return;
    const gen = generation;
    loading = true;
    all.status.textContent = shown ? 'Loading more…' : 'Loading…';
    const params = new URLSearchParams({ limit: String(PAGE), series: SERIES });
    if (query.era === 'archived') params.set('archived', '1');
    if (query.device) params.set('device', query.device);
    if (query.character) params.set('character', query.character);
    if (query.player) params.set('player', query.player);
    if (next) params.set('after', next);
    try {
      const data = await api(`api/scores?${params}`);
      if (gen !== generation) return;                              // filters changed while loading
      sentinel.remove();
      all.list.append(...data.scores.map((s) => rowFor(s, ++shown)));
      next = data.next; done = !next;
      if (!shown) {
        all.status.textContent = query.device || query.character || query.player ? 'No scores match those filters.'
          : query.era === 'archived' ? 'No archived scores from older versions.' : `No scores for v${SERIES} yet. Be the first!`;
      } else {
        if (data.total !== undefined) totalText = `${data.total} score${data.total === 1 ? '' : 's'}${query.device || query.character || query.player ? ' match' : ''}`;
        all.status.textContent = done ? `Showing all ${shown} score${shown === 1 ? '' : 's'}` : totalText;
      }
      if (!done) { all.list.append(sentinel); if (observer) observer.observe(sentinel); }
    } catch (err) {
      if (gen === generation) all.status.textContent = `Couldn't load scores: ${err.message}`;
    } finally {
      if (gen === generation) loading = false;
    }
    // short pages may not fill the box: keep loading until it can scroll
    if (gen === generation && !done && nearBottom()) loadPage(false);
  }

  async function openAll() {
    await ready;
    all.filters.hidden = !available;
    if (!available) {
      all.list.replaceChildren();
      all.status.textContent = 'Scores need the score server. Start the game with docker compose (or npm run dev in server/).';
      return;
    }
    syncEra();
    loadPage(true);
    try {   // player name suggestions for the search box
      const { players } = await api('api/players');
      all.names.replaceChildren(...players.map((n) => { const o = document.createElement('option'); o.value = n; return o; }));
    } catch { /* suggestions are optional */ }
  }
  const scrollAll = (dir) => { all.list.scrollBy({ top: dir * 160, behavior: 'smooth' }); return true; };
  const cycleDevice = (dir) => {
    const i = DEVICE_FILTERS.findIndex(([v]) => v === query.device);
    setDevice(DEVICE_FILTERS[(i + dir + DEVICE_FILTERS.length) % DEVICE_FILTERS.length][0]);
  };

  // the "See more" button inside the end-of-game panel (the panel swallows clicks, so wire it here)
  document.getElementById('endSeeMore').addEventListener('click', () => { setEra('current'); Menu.show('scores'); });

  return { show, hide, loadInto, openAll, scrollAll, cycleDevice, setEra };
})();
