// Main game: level, player, input, physics and rendering.
// Loaded as a plain script so index.html works when opened straight from disk;
// three.js itself is pulled in with a dynamic import.
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(async () => {
  const THREE = await import(THREE_URL);

  // ---------- Renderer / camera ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    console.warn('WebGL unavailable, using 2D canvas fallback:', err.message);
    renderer = new Canvas2DRenderer();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd3ff);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.z = 50;
  let viewH = 12, viewW = 12;

  function resize() {
    const w = innerWidth || 1, h = innerHeight || 1, aspect = w / h;
    viewH = Math.max(12, 9 / aspect);       // keep at least ~9 tiles visible across in portrait
    viewW = viewH * aspect;
    camera.left = -viewW / 2; camera.right = viewW / 2;
    camera.top = viewH / 2;  camera.bottom = -viewH / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  addEventListener('resize', resize);
  resize();

  // ---------- Helpers ----------
  const PLANE = new THREE.PlaneGeometry(1, 1);
  const matCache = new Map();
  const mat = (c) => {
    if (!matCache.has(c)) matCache.set(c, new THREE.MeshBasicMaterial({ color: c }));
    return matCache.get(c);
  };
  // rectangle with bottom-left at (x, y)
  function box(x, y, w, h, color, z = 0, parent = world) {
    const m = new THREE.Mesh(PLANE, mat(color));
    m.scale.set(w, h, 1);
    m.position.set(x + w / 2, y + h / 2, z);
    parent.add(m);
    return m;
  }
  function tri(x, y, w, h, color, z, parent) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x, y, 0, x + w, y, 0, x + w / 2, y + h, 0], 3));
    const m = new THREE.Mesh(g, mat(color));
    m.position.z = z; parent.add(m); return m;
  }
  function circle(cx, cy, r, color, z, parent, seg = 24) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, seg), mat(color));
    m.position.set(cx, cy, z); parent.add(m); return m;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const EPS = 1e-4;   // tolerance so touching edges (after float rounding) never count as overlap
  const overlap = (a, b) => a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;
  function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }

  // ---------- Level ----------
  const world = new THREE.Group(); scene.add(world);
  const solids = [], coins = [], enemies = [], checkpoints = [];
  let goalX = 0, levelEnd = 0;
  const LEFT_EDGE = -4;

  function addGround(x, w, top, r) {
    solids.push({ x, y: -30, w, h: top + 30 });
    box(x, -30, w, top + 30, 0x9a6233, 0);
    box(x, top - 0.4, w, 0.4, 0x56c24f, 0.1);
    box(x, top - 0.55, w, 0.15, 0x3f9a3a, 0.1);
    for (let i = 0; i < w * 1.2; i++) {           // dirt specks
      box(x + 0.2 + r() * (w - 0.6), top - 1 - r() * 6, 0.25, 0.25, 0x7d4c25, 0.05);
    }
  }
  function addPlatform(x, y, w) {
    solids.push({ x, y, w, h: 0.5 });
    box(x, y, w, 0.5, 0xc0703a, 0);
    box(x, y + 0.38, w, 0.12, 0xf0b070, 0.1);
    for (let i = 1; i < w; i++) box(x + i - 0.03, y, 0.06, 0.38, 0x8e4f25, 0.1);
  }
  function addCoin(x, y) {
    const g = new THREE.Group(); g.position.set(x, y, 1); world.add(g);
    circle(0, 0, 0.32, 0xe0a800, 0, g);
    circle(0, 0, 0.22, 0xffd84a, 0.01, g);
    box(-0.04, -0.13, 0.08, 0.26, 0xfff2a8, 0.02, g);
    coins.push({ x: x - 0.3, y: y - 0.3, w: 0.6, h: 0.6, mesh: g, taken: false });
  }
  // Enemies are the roommates (see js/roommates.js), placed in rotation.
  let enemyCount = 0;
  function addEnemy(minX, maxX, top, r) {
    const type = ROOMMATE_ORDER[enemyCount++ % ROOMMATE_ORDER.length];
    const g = new THREE.Group(); world.add(g);
    const body = new THREE.Group(); g.add(body);
    const parts = buildRoommate(type, body, { box, circle, tri, THREE });
    const x0 = minX + r() * (maxX - minX - 1);
    const dizzy = new THREE.Group(); dizzy.position.set(0, 1.62, 0.1); dizzy.visible = false; g.add(dizzy);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; circle(Math.cos(a) * 0.24, Math.sin(a) * 0.1, 0.06, 0xffd84a, 0, dizzy, 8); }
    const e = { type, x0, ground: top, w: type === 'val' ? 1.9 : 0.8, minX, maxX, mesh: g, body, parts, dizzy };
    resetRoommate(e);
    enemies.push(e);
  }

  // things the roommates throw / shout
  const projectiles = [];
  function shoot(kind, x, y, vx, vy, life) {
    const g = new THREE.Group(); g.position.set(x, y, 2.5); world.add(g);
    const info = buildProjectile(kind, g, { box, circle });
    projectiles.push({ kind, x: x - info.w / 2, y: y - info.h / 2, vx, vy, life, mesh: g, ...info });
  }
  function clearProjectiles() {
    for (const pr of projectiles) world.remove(pr.mesh);
    projectiles.length = 0;
  }
  function addFlag(x, y, color, big) {
    const g = new THREE.Group(); g.position.set(x, y, 0.5); world.add(g);
    const h = big ? 5 : 2.6;
    box(-0.08, 0, 0.16, h, 0xeeeeee, 0, g);
    circle(0, h, 0.18, 0xffd84a, 0.01, g, 12);
    const flag = box(0.08, h - (big ? 1.4 : 0.9), big ? 1.6 : 0.9, big ? 1.1 : 0.65, color, 0, g);
    return flag;
  }

  function buildLevel() {
    const r = rng(1337);
    let top = 2;
    addGround(LEFT_EDGE, 18, top, r);
    checkpoints.push({ x: 1.6, y: top, flag: null, reached: true });
    let x = 14, lastCp = 0;
    while (x < 190) {
      const gap = 2 + Math.floor(r() * 3);
      let d = Math.floor(r() * 5) - 2;
      if (gap >= 4 && d > 1) d = 1;
      // arc of coins over the gap
      for (let i = 0; i < 3; i++) addCoin(x + (gap / 4) * (i + 1), top + 1.6 + (i === 1 ? 0.6 : 0));
      x += gap;
      top = clamp(top + d, 1, 5);
      const len = 6 + Math.floor(r() * 9);
      addGround(x, len, top, r);

      if (r() < 0.5) {
        const pw = 3 + Math.floor(r() * 3);
        const px = Math.round(x + 1 + r() * Math.max(0, len - pw - 2));
        addPlatform(px, top + 2.2, pw);
        for (let i = 0; i < pw; i++) addCoin(px + i + 0.5, top + 3.4);
      } else if (r() < 0.6) {
        for (let i = 0; i < 3; i++) addCoin(x + 2 + i, top + 0.7);
      }
      if (len >= 8 && x > 25 && r() < 0.75) addEnemy(x + 0.5, x + len - 0.5, top, r);

      if (x - lastCp > 55) {
        const cx = x + 1.5;
        checkpoints.push({ x: cx, y: top, flag: addFlag(cx, top, 0x9aa0a6, false), reached: false });
        lastCp = x;
      }
      x += len;
    }
    x += 3; top = 2;
    addGround(x, 24, top, r);
    goalX = x + 12;
    addFlag(goalX, top, 0xff4d4d, true);
    // little castle
    box(goalX + 3, top, 4, 3, 0xb0b8c0, -0.2);
    for (let i = 0; i < 4; i += 1.33) box(goalX + 3 + i, top + 3, 0.7, 0.6, 0xb0b8c0, -0.2);
    box(goalX + 4.5, top, 1, 1.6, 0x3b2a1a, -0.1);
    levelEnd = x + 24;
  }
  buildLevel();

  // ---------- Parallax background ----------
  const layers = [];
  function makeLayer(factor, z) { const g = new THREE.Group(); g.position.z = z; scene.add(g); layers.push({ g, factor }); return g; }
  const sun = makeLayer(1, -9);
  circle(0, 0, 1.4, 0xfff3b0, 0, sun); circle(0, 0, 1.1, 0xffe66d, 0.01, sun);
  sun.userData.offset = new THREE.Vector2(1, 1);

  const far = makeLayer(0.85, -8);
  const mid = makeLayer(0.6, -7);
  const clouds = makeLayer(0.9, -6);
  {
    const r = rng(42);
    for (let x = -20; x < levelEnd; x += 4 + r() * 5) tri(x, -4, 9 + r() * 6, 6 + r() * 5, 0xa9b8e8, 0, far);
    for (let x = -20; x < levelEnd; x += 3 + r() * 4) circle(x, -2.5, 3 + r() * 2.5, 0x7fd07a, 0, mid, 32);
    for (let x = -20; x < levelEnd; x += 8 + r() * 10) {
      const y = 3 + r() * 3;
      circle(x, y, 0.9, 0xffffff, 0, clouds); circle(x + 0.9, y + 0.3, 1.1, 0xffffff, 0, clouds); circle(x + 1.9, y, 0.85, 0xffffff, 0, clouds);
    }
  }

  // ---------- Player ----------
  // The playable cat (Bruce or Gremlin) is picked on the title screen; models live in js/cats.js.
  const player = { x: 1.6, y: 2, w: 0.9, h: 0.95, vx: 0, vy: 0, onGround: false, coyote: 0, buffer: 0, face: 1, inv: 0, anim: 0,
                   dash: 0, growl: 0, cool: 0 };
  const pMesh = new THREE.Group(); pMesh.position.z = 2; world.add(pMesh);
  let pBody = null, catParts = null, character = 'bruce';
  try { character = localStorage.getItem('bruceLooseCat') || localStorage.getItem('skyRunnerCat') || 'bruce'; } catch { /* storage blocked */ }
  if (!CATS[character]) character = 'bruce';

  function setCharacter(type) {
    character = type;
    if (pBody) pMesh.remove(pBody);
    pBody = new THREE.Group(); pMesh.add(pBody);
    catParts = buildCat(type, pBody, { box, circle, tri, THREE });
    try { localStorage.setItem('bruceLooseCat', type); } catch { /* storage blocked */ }
    document.querySelectorAll('.pick').forEach(b => b.classList.toggle('chosen', b.dataset.cat === type));
    const sp = document.getElementById('tSpecial'); if (sp) sp.textContent = CATS[type].ability;
  }
  setCharacter(character);

  // Gremlin's growl shockwave
  const growlRing = new THREE.Group(); growlRing.visible = false; world.add(growlRing);
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; circle(Math.cos(a), Math.sin(a), 0.07, 0xffe08a, 0, growlRing, 8); }

  // Steven P: not an enemy. He shows up to pull Bruce out of a pit (once per checkpoint).
  const helper = new THREE.Group(); helper.visible = false; world.add(helper);
  const helperParts = buildRoommate('stevenp', helper, { box, circle, tri, THREE });
  helperParts.armL.rotation.z = -2.7; helperParts.armR.rotation.z = 2.7;      // arms up, ready to catch
  const rescue = { available: true, t: 0, helperT: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, lastSafe: null };
  const toastEl = document.getElementById('toast');
  let toastTimer = 0;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  // Portraits: draw a cat or a person into a small canvas (cat picker + Characters screen).
  // Uses the 2D canvas renderer so it works with or without WebGL.
  function drawPortrait(cv, kind, type, cssW, cssH) {
    const r = new Canvas2DRenderer();
    r.domElement = cv; r.ctx = cv.getContext('2d');
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setSize(cssW, cssH);
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x8fd3ff);
    const aspect = cssW / cssH;
    // world-space window to frame each kind of character
    const frame = kind === 'cat' ? { cx: 0.05, bottom: -0.08, h: 1.4 }
                : type === 'val' ? { cx: 0, bottom: -0.1, h: 1.55 }
                : { cx: 0, bottom: -0.08, h: 1.95 };
    const w = frame.h * aspect;
    const cam = new THREE.OrthographicCamera(frame.cx - w / 2, frame.cx + w / 2, frame.bottom + frame.h, frame.bottom, 0.1, 100);
    cam.position.z = 50;
    box(-5, -1, 10, 1, 0x56c24f, -1, sc);
    const g = new THREE.Group(); sc.add(g);
    if (kind === 'cat') {
      animateCat(buildCat(type, g, { box, circle, tri, THREE }), { anim: 0, onGround: true, dash: 0, growl: 0 }, 0.4, false);
    } else {
      buildRoommate(type, g, { box, circle, tri, THREE });
    }
    r.render(sc, cam);
    cv.style.width = cv.style.height = '';   // let the stylesheet size it
  }
  document.querySelectorAll('.pick canvas').forEach((cv) => drawPortrait(cv, 'cat', cv.closest('.pick').dataset.cat, 132, 92));
  Menu.drawPortrait = (cv, info) => drawPortrait(cv, info.kind, info.id, 240, 180);

  // ---------- Game state ----------
  const ui = {
    coins: document.getElementById('hudCoins'), score: document.getElementById('hudScore'), lives: document.getElementById('hudLives'),
    ability: document.getElementById('hudAbility'), special: document.getElementById('tSpecial'),
  };
  let state = 'menu';   // menu | play | paused | over | won
  let score = 0, lives = 3, coinCount = 0, checkpoint = checkpoints[0];
  let camX = 0, camY = 4;

  function updateHud() {
    ui.coins.textContent = `● ${coinCount}/${coins.length}`;
    ui.score.textContent = score;
    ui.lives.textContent = '♥'.repeat(Math.max(0, lives));
  }
  function spawn(cp) {
    Object.assign(player, { x: cp.x, y: cp.y + 0.01, vx: 0, vy: 0, onGround: false, coyote: 0, buffer: 0, face: 1, dash: 0, growl: 0, cool: 0 });
    camX = player.x; camY = player.y + viewH * 0.15;
    rescue.t = 0; rescue.helperT = 0; rescue.lastSafe = null; helper.visible = false;
  }
  let runTime = 0;   // seconds played this run (saved with the score)
  const runResult = (result) => ({ score, coins: coinCount, totalCoins: coins.length, character, result, timeMs: Math.round(runTime * 1000) });

  function resetGame() {
    score = 0; lives = 3; coinCount = 0; runTime = 0;
    coins.forEach(c => { c.taken = false; c.mesh.visible = true; });
    enemies.forEach(e => { resetRoommate(e); e.mesh.visible = true; e.body.scale.set(1, 1, 1); });
    clearProjectiles();
    checkpoints.forEach((c, i) => { c.reached = i === 0; if (c.flag) c.flag.material = mat(0x9aa0a6); });
    checkpoint = checkpoints[0];
    rescue.available = true;
    spawn(checkpoint);
    player.inv = 0;
    updateHud();
  }
  // ---------- Screens (see js/menu.js) ----------
  function startGame() {
    initAudio();
    resetGame();
    state = 'play'; Menu.hide();
    Scoreboard.hide();
    ScreenAwake.on();
  }
  function resume() {
    if (state !== 'paused') return;
    initAudio();
    state = 'play'; Menu.hide();
    ScreenAwake.on();
  }
  function pause() {
    if (state !== 'play') return;
    state = 'paused'; Menu.reset('pause');
    ScreenAwake.off();
  }
  function toMainMenu() {
    state = 'menu'; resetGame();
    Scoreboard.hide(); ScreenAwake.off();
    Menu.reset('main');
  }
  function endGame(result) {
    state = result === 'won' ? 'won' : 'over';
    ScreenAwake.off();
    document.getElementById('endTitle').textContent = result === 'won' ? 'You made it!' : 'Game Over';
    document.getElementById('endText').textContent =
      `${CATS[character].name} · Score ${score} · Coins ${coinCount}/${coins.length}` + (result === 'won' && coinCount === coins.length ? ' · Perfect!' : '');
    Menu.reset('end');
    Scoreboard.show(runResult(result));
  }

  document.querySelectorAll('.pick').forEach(b => {
    b.addEventListener('click', () => { setCharacter(b.dataset.cat); sfx('cp'); });              // tap/click: just pick
    b.addEventListener('keydown', (e) => {                                                        // Enter/Space: pick and start
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault(); e.stopPropagation(); setCharacter(b.dataset.cat); startGame();
    });
  });
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('againBtn').addEventListener('click', startGame);
  document.getElementById('resumeBtn').addEventListener('click', resume);
  document.getElementById('pauseQuit').addEventListener('click', toMainMenu);
  document.getElementById('endQuit').addEventListener('click', toMainMenu);
  Menu.onRootBack('pause', resume);                       // Back / Esc on the pause screen resumes
  Menu.onSide('select', (d) => {                          // left/right on the cat picker switches cats
    setCharacter(d < 0 ? 'bruce' : 'gremlin'); sfx('cp');
    document.querySelector(`.pick[data-cat="${character}"]`).focus();
    return true;
  });
  Menu.onEnter('select', () => setCharacter(character));
  function hurt() {
    if (player.inv > 0) return;
    lives--; sfx('hurt'); Haptics.buzz('hurt'); updateHud();
    if (lives <= 0) { endGame('died'); return; }
    spawn(checkpoint); player.inv = 1.5;
    clearProjectiles();
  }

  // ---------- Input ----------
  const input = { left: false, right: false, jump: false, jumpPressed: false, special: false, specialPressed: false };
  const keys = new Set();
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump',
                   KeyX: 'special', KeyK: 'special', ShiftLeft: 'special', ShiftRight: 'special' };
  const touchActs = new Map();   // pointerId -> act
  function recomputeInput() {
    const acts = new Set(touchActs.values());
    const held = (a) => acts.has(a) || Gamepads.held.has(a) || [...keys].some(k => KEYMAP[k] === a);
    const wasJump = input.jump, wasSpecial = input.special;
    input.left = held('left'); input.right = held('right');
    input.jump = held('jump'); input.special = held('special');
    if (input.jump && !wasJump) input.jumpPressed = true;
    if (input.special && !wasSpecial) input.specialPressed = true;
    document.querySelectorAll('.tbtn').forEach(b => b.classList.toggle('on', acts.has(b.dataset.act)));
  }
  const MENU_KEYS = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
                      ArrowRight: 'right', KeyD: 'right', Escape: 'back', Backspace: 'back' };
  addEventListener('keydown', (e) => {
    if (state !== 'play') {
      // menus: arrows move between buttons, Enter/Space press the focused button (browser default), Esc goes back
      if (e.code === 'KeyP' && state === 'paused') { resume(); return; }
      const action = MENU_KEYS[e.code];
      if (e.target.type === 'range' && (action === 'left' || action === 'right')) return;   // let the slider move itself
      if (action) { e.preventDefault(); Menu.nav(action); return; }
      if ((e.code === 'Enter' || e.code === 'Space') && !Menu.visible) return;
      if ((e.code === 'Enter' || e.code === 'Space') && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); Menu.nav('confirm'); }
      return;
    }
    if (KEYMAP[e.code]) e.preventDefault();
    if (e.code === 'KeyP' || e.code === 'Escape') { pause(); return; }
    if (KEYMAP[e.code]) { keys.add(e.code); recomputeInput(); }
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); recomputeInput(); });
  addEventListener('blur', () => { keys.clear(); touchActs.clear(); recomputeInput(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // Touch buttons: thumbs can slide between ◀ and ▶ without lifting.
  document.querySelectorAll('.tbtn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); touchActs.set(e.pointerId, btn.dataset.act); recomputeInput(); });
  });
  addEventListener('pointermove', (e) => {
    const cur = touchActs.get(e.pointerId);
    if (cur !== 'left' && cur !== 'right') return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const act = el && el.dataset && el.dataset.act;
    if ((act === 'left' || act === 'right') && act !== cur) { touchActs.set(e.pointerId, act); recomputeInput(); }
  });
  const endPointer = (e) => { if (touchActs.delete(e.pointerId)) recomputeInput(); };
  addEventListener('pointerup', endPointer);
  addEventListener('pointercancel', endPointer);

  // On-screen touch buttons. Options > Touch buttons: Auto (touch devices, hidden while using
  // a keyboard or controller), Always, or Off.
  let lastInput = (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) ? 'touch' : 'keys';
  function applyTouchMode() {
    const mode = Settings.get('touch');
    document.body.classList.toggle('touch', mode === 'on' || (mode === 'auto' && lastInput === 'touch'));
  }
  const usedInput = (kind) => { if (lastInput !== kind) { lastInput = kind; applyTouchMode(); } };
  addEventListener('touchstart', () => usedInput('touch'), { passive: true });
  addEventListener('keydown', (e) => { if (!(e.target instanceof HTMLInputElement)) usedInput('keys'); });
  Settings.onChange((k) => { if (k === 'touch') applyTouchMode(); });
  applyTouchMode();

  // fullscreen button (phones/tablets that support it)
  const fsBtn = document.getElementById('fsBtn');
  if (fsBtn && Fullscreen.supported) {
    document.body.classList.add('fs-ok');
    fsBtn.addEventListener('click', (e) => { e.stopPropagation(); Fullscreen.toggle(); });
  }

  // game controller: poll once per frame
  function pollGamepad() {
    const pad = Gamepads.read();
    if (pad.connectedNow) { usedInput('pad'); toast('Controller connected'); }
    if (!pad.changed) return;
    if (pad.pressed.size) usedInput('pad');
    const inMenu = state !== 'play';
    if (inMenu) {
      if (pad.pressed.has('start') && state === 'paused') resume();
      else {
        for (const a of ['up', 'down', 'left', 'right', 'confirm', 'back']) if (pad.pressed.has(a)) Menu.nav(a);
        if (pad.pressed.has('start')) Menu.nav('confirm');
      }
    } else if (pad.pressed.has('start')) pause();
    recomputeInput();
    if (inMenu) { input.jumpPressed = false; input.specialPressed = false; }   // the button that started the game shouldn't also jump
  }
  document.getElementById('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); state === 'play' ? pause() : resume(); });
  document.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- Abilities ----------
  function knockOut(e) {
    e.alive = false; e.squash = 0.35; e.stun = 0; e.dizzy.visible = false;
    e.body.scale.set(1.25, 0.3, 1); e.body.rotation.z = 0;
    score += 100; sfx('stomp'); Haptics.buzz('stomp'); updateHud();
  }
  function useAbility(p, cat) {
    p.cool = cat.cooldown;
    Haptics.buzz('ability');
    if (character === 'bruce') {
      // POUNCE: a short claws-out dash with a little hop
      p.dash = POUNCE_TIME;
      p.vy = Math.max(p.vy, 4);
      sfx('pounce');
    } else {
      // GROWL: stun nearby roommates and swat away anything they've thrown
      p.growl = GROWL_TIME;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      const near = (o) => Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy) < GROWL_RADIUS + 0.5;
      for (const e of enemies) if (e.alive && near(e)) {
        e.stun = STUN_TIME; e.vy = 0;
        if (e.type === 'steven' && e.state !== 'lurk') e.state = 'return';
      }
      for (let i = projectiles.length - 1; i >= 0; i--) if (near(projectiles[i])) {
        world.remove(projectiles[i].mesh); projectiles.splice(i, 1);
      }
      sfx('growl');
    }
  }

  // ---------- Simulation ----------
  // Steven P's pit rescue: rise from the gap, catch Bruce, toss him back to solid ground.
  const RESCUE_TIME = 1.0, HELPER_TIME = 1.5;
  function startRescue(p) {
    const s = rescue.lastSafe.s;
    rescue.available = false;
    rescue.t = RESCUE_TIME; rescue.helperT = HELPER_TIME;
    rescue.fromX = p.x; rescue.fromY = p.y;
    rescue.toX = clamp(rescue.lastSafe.x, s.x + 0.3, s.x + s.w - p.w - 0.3);
    rescue.toY = s.y + s.h;
    p.vx = 0; p.vy = 0; p.dash = 0;
    helper.visible = true;
    toast('Steven P to the rescue!');
    sfx('cp');
  }
  function stepRescue(p, dt) {
    rescue.t -= dt;
    const k = 1 - rescue.t / RESCUE_TIME;              // 0 -> 1
    const catchY = -0.6;
    if (k < 0.45) {                                     // he rises up out of the gap with Bruce
      const a = k / 0.45;
      p.x = rescue.fromX; p.y = rescue.fromY + (catchY + 1.45 - rescue.fromY) * Math.min(1, a * 1.6);
    } else {                                            // ...and tosses him back up onto the ledge
      const a = (k - 0.45) / 0.55, y0 = catchY + 1.45;
      p.x = rescue.fromX + (rescue.toX - rescue.fromX) * a;
      p.y = y0 + (rescue.toY - y0) * a + Math.sin(a * Math.PI) * 2.5;
      p.face = Math.sign(rescue.toX - rescue.fromX) || p.face;
    }
    if (rescue.t <= 0) {
      p.x = rescue.toX; p.y = rescue.toY; p.vx = 0; p.vy = 0; p.onGround = true; p.inv = 1.2;
    }
  }

  function step(dt) {
    const p = player;
    runTime += dt;
    const cat = CATS[character];
    if (rescue.helperT > 0) {
      rescue.helperT -= dt;
      if (rescue.helperT <= 0) helper.visible = false;
    }
    if (rescue.t > 0) { stepRescue(p, dt); return; }
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // special ability
    p.cool -= dt;
    if (p.cool < 1e-6) p.cool = 0;     // snap float leftovers so "ready" is exact
    if (p.growl > 0) p.growl -= dt;
    if (input.specialPressed) {
      input.specialPressed = false;
      if (p.cool === 0) useAbility(p, cat);
    }

    if (p.dash > 0) {                       // Bruce's pounce overrides normal running
      p.dash -= dt;
      p.vx = p.face * POUNCE_SPEED;
    } else if (dir) {
      const max = cat.runSpeed;
      p.vx = clamp(p.vx + dir * (p.onGround ? ACCEL : AIR_ACCEL) * dt, -Math.max(max, Math.abs(p.vx) - 40 * dt), Math.max(max, Math.abs(p.vx) - 40 * dt));
      p.face = dir;
    } else {
      const f = (p.onGround ? FRICTION : AIR_FRICTION) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }

    if (input.jumpPressed) { p.buffer = BUFFER; input.jumpPressed = false; }
    p.coyote = p.onGround ? COYOTE : p.coyote - dt;
    p.buffer -= dt;
    if (p.buffer > 0 && p.coyote > 0) { p.vy = JUMP_V; p.buffer = 0; p.coyote = 0; p.onGround = false; sfx('jump'); }

    // variable jump height: releasing early pulls you down faster
    const g = p.dash > 0 ? GRAVITY * 0.3 : (!input.jump && p.vy > 0) ? GRAVITY * 2.6 : GRAVITY;
    p.vy = Math.max(p.vy + g * dt, MAX_FALL);
    if (cat.fluffy && input.jump && p.vy < GLIDE_FALL) p.vy = GLIDE_FALL;   // Gremlin floats on her fluff

    // move X, resolve
    p.x += p.vx * dt;
    for (const s of solids) if (overlap(p, s)) { if (p.vx > 0) p.x = s.x - p.w; else if (p.vx < 0) p.x = s.x + s.w; p.vx = 0; }
    if (p.x < LEFT_EDGE) { p.x = LEFT_EDGE; p.vx = 0; }

    // move Y, resolve
    const prevBottom = p.y;
    p.y += p.vy * dt;
    p.onGround = false;
    for (const s of solids) if (overlap(p, s)) {
      if (p.vy < 0) { p.y = s.y + s.h; p.onGround = true; rescue.lastSafe = { x: p.x, s }; } else { p.y = s.y - p.h; }
      p.vy = 0;
    }

    // fell into a gap: Steven P shows up if he hasn't already helped since the last checkpoint
    if (p.y < -1.2 && rescue.available && rescue.lastSafe) { startRescue(p); return; }

    if (p.inv > 0) p.inv -= dt;
    if (p.y < -6) { p.inv = 0; hurt(); return; }

    // enemies (only simulate roommates near the camera)
    const ctx = { player: p, shoot, sfx };
    for (const e of enemies) {
      if (!e.alive) { if (e.squash > 0) { e.squash -= dt; if (e.squash <= 0) e.mesh.visible = false; } continue; }
      if (Math.abs(e.x - p.x) > viewW / 2 + 6) continue;
      if (e.stun > 0) { e.stun -= dt; e.vx = 0; }      // stunned roommates can't act
      else updateRoommate(e, dt, ctx);
      if (overlap(p, e)) {
        const stomp = p.vy < 0 && prevBottom >= e.y + e.h * 0.45;
        if (p.dash > 0 || stomp) {
          knockOut(e);
          if (stomp && p.dash <= 0) p.vy = input.jump ? JUMP_V * 0.95 : JUMP_V * 0.65;
        } else if (e.stun <= 0) { hurt(); return; }   // stunned roommates are harmless to touch
      }
    }

    // projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.life -= dt;
      pr.vy += pr.gravity * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      const hitWall = !pr.passThrough && solids.some(s => overlap(pr, s));
      if (pr.life <= 0 || hitWall || pr.y < -8) { world.remove(pr.mesh); projectiles.splice(i, 1); continue; }
      if (overlap(p, pr)) {
        if (p.dash > 0) { world.remove(pr.mesh); projectiles.splice(i, 1); score += 10; updateHud(); continue; }  // swatted
        if (p.inv <= 0) { hurt(); return; }
      }
    }

    // coins
    for (const c of coins) if (!c.taken && overlap(p, c)) {
      c.taken = true; c.mesh.visible = false; coinCount++; score += 10; sfx('coin'); updateHud();
    }

    // checkpoints
    for (const c of checkpoints) if (!c.reached && p.x > c.x) {
      c.reached = true; checkpoint = c; c.flag.material = mat(0x3ccf5a); sfx('cp');
      if (!rescue.available) toast('Steven P is back on call');
      rescue.available = true;
    }

    // goal
    if (p.x + p.w > goalX) {
      score += lives * 500 + (coinCount === coins.length ? 2000 : 0);
      updateHud(); sfx('win'); Haptics.buzz('win');
      endGame('won');
    }

    p.anim += dt * (p.onGround ? Math.abs(p.vx) * 2.2 : 0);
  }

  // ---------- Render sync ----------
  let time = 0;
  function syncVisuals(dt) {
    time += dt;
    const p = player;
    pMesh.position.set(p.x + p.w / 2, p.y, 2);
    pMesh.scale.x = p.face;
    const moving = p.onGround && Math.abs(p.vx) > 0.3;
    const bob = moving ? Math.abs(Math.sin(p.anim)) * 0.08 : 0;
    pBody.position.y = bob;
    animateCat(catParts, p, time, moving);
    const stretch = p.dash > 0 ? 0.85 : p.onGround ? 1 : clamp(1 + p.vy * 0.01, 0.88, 1.12);
    pBody.scale.set(1 / stretch, stretch, 1);
    pMesh.visible = p.inv <= 0 || Math.floor(time * 16) % 2 === 0;

    // growl shockwave grows out from Gremlin
    growlRing.visible = p.growl > 0;
    if (p.growl > 0) {
      const s = 0.6 + (GROWL_TIME - p.growl) / GROWL_TIME * GROWL_RADIUS;
      growlRing.position.set(p.x + p.w / 2, p.y + p.h / 2, 3);
      growlRing.scale.set(s, s, 1);
    }

    // Steven P rising out of the gap, then sinking back down
    if (helper.visible) {
      const t = HELPER_TIME - rescue.helperT;
      const up = t < 0.35 ? t / 0.35 : t > 1.1 ? Math.max(0, 1 - (t - 1.1) / 0.4) : 1;
      helper.position.set(rescue.fromX + p.w / 2, -2.6 + up * 2.0, 2.2);
    }

    // ability readiness in the HUD and on the touch button
    const ready = p.cool === 0;
    const label = ready ? `${CATS[character].ability} ✓` : `${CATS[character].ability} ${p.cool.toFixed(1)}`;
    if (ui.ability.textContent !== label) ui.ability.textContent = label;
    ui.ability.classList.toggle('cooling', !ready);
    if (ui.special) ui.special.classList.toggle('cooling', !ready);

    for (const c of coins) if (!c.taken) { c.mesh.scale.x = Math.cos(time * 4 + c.x) * 0.9; c.mesh.position.y = c.y + 0.3 + Math.sin(time * 3 + c.x) * 0.06; }
    for (const e of enemies) if (e.mesh.visible) {
      e.mesh.position.set(e.x + e.w / 2, e.y, 1.5);
      if (e.alive) {
        e.mesh.scale.x = e.anim > 0 ? e.face : (e.vx ? Math.sign(e.vx) : e.dir);
        e.body.scale.y = e.crouch ? 0.68 : 1;
        animateRoommate(e, time);
        // stunned by a growl: wobble with stars circling overhead
        e.dizzy.visible = e.stun > 0;
        e.body.rotation.z = e.stun > 0 ? Math.sin(time * 18) * 0.08 : 0;
        if (e.stun > 0) e.dizzy.rotation.z = time * 5;
      }
    }
    for (const pr of projectiles) {
      pr.mesh.position.set(pr.x + pr.w / 2, pr.y + pr.h / 2, 2.5);
      pr.mesh.rotation.z += pr.spin * dt;
      if (pr.grow) { const s = 1 + (1.5 - pr.life) * pr.grow; pr.mesh.scale.set(Math.sign(pr.vx) * s, s, 1); }
    }

    // camera follow with look-ahead
    const tx = clamp(p.x + p.w / 2 + p.face * 1.5, LEFT_EDGE + viewW / 2, Math.max(LEFT_EDGE + viewW / 2, levelEnd - viewW / 2));
    const ty = Math.max(p.y + viewH * 0.15, -3 + viewH / 2);
    const k = 1 - Math.exp(-dt * 6);
    camX += (tx - camX) * k; camY += (ty - camY) * k;
    camera.position.x = camX; camera.position.y = camY;

    for (const L of layers) {
      L.g.position.x = camX * L.factor;
      L.g.position.y = camY * L.factor;
    }
    sun.position.x = camX + viewW / 2 - 2.5; sun.position.y = camY + viewH / 2 - 2.2;
  }

  // ---------- Loop ----------
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    pollGamepad();
    if (state === 'play') {
      acc += dt;
      while (acc >= STEP && state === 'play') { step(STEP); acc -= STEP; }
    } else acc = 0;
    syncVisuals(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  resetGame();
  Menu.reset('main');   // open the main menu with Play focused
  requestAnimationFrame(frame);

  // expose for debugging in the console
  window.game = { player, input, get state() { return state; } };
  window.__gameReady = true;
})();
