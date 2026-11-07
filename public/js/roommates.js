// Enemy roster: the roommates and friends (plus Steven P, who's a helper, not an enemy).
// Looks come from the reference photos in source/<name>/,
// behaviours come from the traits in source/design.json.
//
// Each roommate is a little chibi person drawn from flat shapes, origin at the feet.
// buildRoommate() draws one; updateRoommate() runs its behaviour every physics step.

const ROOMMATE_ORDER = ['robert', 'bill', 'steven', 'cynthea', 'bobby', 'val'];

const ROOMMATES = {
  // Computer nerd, neat freak, fixes his own '91 Accord -> tidy patrol, throws wrenches.
  robert: {
    skin: 0xf1c9a8, hair: 0x5a3a24, shirt: 0x26344f, print: 'text', bottoms: 0x3d4f73,
    longPants: true, shoes: 0x222226, speed: 1.6,
  },
  // Loves to cook, never does the dishes -> slow shuffle, flings dirty plates.
  bill: {
    skin: 0xeab99a, hair: 0xa9875a, goatee: 0x7a5434, shirt: 0x18181c, necklace: true,
    bottoms: 0x7b8089, plaid: 0x555962, shoes: 0x1b1b1b, speed: 0.9,
  },
  // Horror fan -> lurks crouched, then jump-scares Bruce.
  steven: {
    skin: 0xe3ae8c, cap: 0x141416, shades: true, beard: 0x8a5634, shirt: 0x141416, print: 'emblem',
    bottoms: 0x1d1d22, shoes: 0x111111, speed: 1.3,
  },
  // Loud social butterfly when partying, grumpy when hungover -> mood swings.
  cynthea: {
    skin: 0xf0c4aa, hair: 0x6a4630, bun: 0xff7eb6, shirt: 0x2f80d8, print: 'logo',
    bottoms: 0x86a7cf, socks: 0xf2f2f2, speed: 2.4,
  },
  // "Crazy Bobby": life of the party, quotes Macho Man Randy Savage -> flying elbow drop.
  bobby: {
    skin: 0xe8b48f, hair: 0x6b4423, longHair: true, beard: 0x6b4423, cowboy: true, shades: 0x4fc3f7,
    shirt: 0x7a2f45, plaid: 0x2a2f5a, print: 'open', tee: 0x2f6fd0, bottoms: 0x5a7fb0, longPants: true,
    shoes: 0x111111, speed: 1.2,
  },
  // Valerie: drives the homies around -> she's in her car. (Drawn by buildCar.)
  val: {
    skin: 0xf0c0a8, hair: 0xa8323a, hoodie: 0x141418, car: 0x2f6f73, speed: 2.5, boost: 7,
  },
  // Steven P: "the homie of homies", always shows up when a friend is stuck -> rescues Bruce from pits.
  stevenp: {
    skin: 0xe2b08c, hair: 0x2a1d16, shirt: 0x232a48, print: 'dots', bottoms: 0x2b2b30, longPants: true,
    shoes: 0x18181a, wide: true,
  },
};

function buildRoommate(type, root, helpers) {
  if (type === 'val') return buildCar(root, helpers);
  const { box, circle, tri, THREE } = helpers;
  const c = ROOMMATES[type];
  const W = c.wide ? 1.15 : 1;          // stockier build
  const parts = {};
  const group = (x, y, z, parent = root) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // legs (pivot at hip)
  const LEG = 0.38;
  const leg = (x) => {
    const g = group(x, LEG, -0.02);
    box(-0.08, -LEG, 0.16, LEG, c.longPants ? c.bottoms : c.skin, 0, g);
    if (c.socks) box(-0.085, -LEG, 0.17, 0.1, c.socks, 0.01, g);
    else box(-0.1, -LEG, 0.2, 0.08, c.shoes, 0.01, g);
    return g;
  };
  parts.legL = leg(-0.12); parts.legR = leg(0.12);

  // shorts / waist
  box(-0.27 * W, 0.26, 0.54 * W, 0.26, c.bottoms, 0, root);
  if (c.plaid) {
    for (const x of [-0.15, 0.0, 0.15]) box(x - 0.012, 0.26, 0.024, 0.26, c.plaid, 0.01, root);
    box(-0.27, 0.37, 0.54, 0.024, c.plaid, 0.01, root);
  }

  // arms (pivot at shoulder), drawn behind the sleeves
  const arm = (x) => {
    const g = group(x, 0.9, -0.01);
    box(-0.055, -0.36, 0.11, 0.34, c.skin, 0, g);
    circle(0, -0.38, 0.065, c.skin, 0, g, 10);
    return g;
  };
  parts.armL = arm(-0.35 * W); parts.armR = arm(0.35 * W);

  // torso + sleeves
  box(-0.3 * W, 0.5, 0.6 * W, 0.46, c.shirt, 0, root);
  box(-0.3 * W - 0.12, 0.77, 0.16, 0.19, c.shirt, 0.005, root);
  box(0.3 * W - 0.04, 0.77, 0.16, 0.19, c.shirt, 0.005, root);
  if (c.print === 'text') {            // "IN MY DEFENSE / I WAS LEFT / UNSUPERVISED"
    box(-0.18, 0.82, 0.36, 0.04, 0xe8e8e8, 0.01, root);
    box(-0.11, 0.74, 0.22, 0.04, 0xe8e8e8, 0.01, root);
    box(-0.2, 0.66, 0.4, 0.05, 0xe8e8e8, 0.01, root);
  } else if (c.print === 'emblem') {   // big white tee graphic
    box(-0.19, 0.84, 0.38, 0.05, 0xf2f2f2, 0.01, root);
    circle(0, 0.7, 0.09, 0xf2f2f2, 0.01, root, 16);
    circle(0, 0.7, 0.05, c.shirt, 0.02, root, 12);
  } else if (c.print === 'logo') {     // small chest logo
    box(-0.13, 0.82, 0.22, 0.04, 0xffffff, 0.01, root);
    circle(0.14, 0.84, 0.03, 0xffd84a, 0.01, root, 8);
  } else if (c.print === 'open') {     // open plaid button-up over a blue tee
    for (const x of [-0.24, -0.16, 0.16, 0.24]) box(x - 0.012, 0.5, 0.024, 0.46, c.plaid, 0.006, root);
    for (const y of [0.62, 0.8]) box(-0.3, y, 0.6, 0.024, c.plaid, 0.006, root);
    box(-0.11, 0.5, 0.22, 0.46, c.tee, 0.01, root);
    box(-0.07, 0.72, 0.14, 0.05, 0xf2f2f2, 0.015, root);
  } else if (c.print === 'dots') {     // patterned button-up
    for (let y = 0.56; y < 0.94; y += 0.09)
      for (let x = -0.27; x < 0.3; x += 0.11) circle(x + (y * 10 % 2 > 1 ? 0.05 : 0), y, 0.016, 0x9fb0d8, 0.006, root, 6);
    box(-0.008, 0.5, 0.016, 0.46, 0x151a30, 0.01, root);
  }
  if (c.necklace) {
    box(-0.1, 0.8, 0.012, 0.16, 0xb8bcc4, 0.01, root).rotation.z = 0.5;
    box(0.09, 0.8, 0.012, 0.16, 0xb8bcc4, 0.01, root).rotation.z = -0.5;
    circle(0, 0.78, 0.025, 0xb8bcc4, 0.02, root, 8);
  }
  box(-0.07, 0.94, 0.14, 0.08, c.skin, -0.005, root);  // neck

  // head
  const head = parts.head = group(0, 1.17, 0.01);
  circle(-0.25, -0.02, 0.06, c.skin, -0.01, head, 10);   // ears
  circle(0.25, -0.02, 0.06, c.skin, -0.01, head, 10);
  if (c.hair) circle(0, 0.06, 0.255, c.hair, -0.005, head);
  if (c.longHair) {                       // long hair down past the shoulders
    box(-0.3, -0.42, 0.13, 0.5, c.hair, -0.006, head);
    box(0.17, -0.42, 0.13, 0.5, c.hair, -0.006, head);
  }
  if (c.hair && c.bun) {
    box(-0.27, -0.12, 0.08, 0.2, c.hair, -0.004, head);  // side hair
    box(0.19, -0.12, 0.08, 0.2, c.hair, -0.004, head);
    circle(0.08, 0.3, 0.1, c.hair, -0.006, head, 14);    // top bun
    box(0.0, 0.2, 0.16, 0.05, c.bun, -0.003, head).rotation.z = 0.25; // scrunchie
  }
  circle(0, 0, 0.24, c.skin, 0, head);

  if (c.cap) {                            // backwards black cap
    circle(0, 0.15, 0.25, c.cap, -0.004, head);                 // crown (behind the face)
    box(-0.25, 0.1, 0.5, 0.07, c.cap, 0.02, head);              // strap band across the forehead
    box(-0.06, 0.17, 0.12, 0.06, 0xa29482, 0.03, head);         // strap patch
  }
  if (c.cowboy) {                         // stars-and-stripes cowboy hat
    box(-0.42, 0.13, 0.84, 0.07, 0xc8323c, 0.03, head);
    box(-0.42, 0.155, 0.84, 0.022, 0xf4f4f4, 0.035, head);
    box(-0.2, 0.18, 0.4, 0.2, 0x1f2a5a, 0.03, head);
    box(-0.24, 0.18, 0.48, 0.06, 0x1f2a5a, 0.03, head);
    for (const [x, y] of [[-0.11, 0.3], [0.0, 0.25], [0.11, 0.31], [-0.04, 0.34]]) circle(x, y, 0.02, 0xffffff, 0.04, head, 5);
  }
  if (c.shades) {
    const lens = typeof c.shades === 'number' ? c.shades : 0x0e0e10;
    box(-0.2, -0.04, 0.17, 0.08, lens, 0.03, head);
    box(0.03, -0.04, 0.17, 0.08, lens, 0.03, head);
    box(-0.03, -0.01, 0.06, 0.02, 0x0e0e10, 0.03, head);
    box(-0.03, -0.1, 0.06, 0.06, 0xd89c7c, 0.035, head);       // nose
  } else {
    circle(-0.08, 0.01, 0.032, 0x2a2420, 0.03, head, 8);
    circle(0.08, 0.01, 0.032, 0x2a2420, 0.03, head, 8);
  }
  if (c.beard) {                          // big full beard
    circle(0, -0.2, 0.2, c.beard, 0.02, head);
    box(-0.21, -0.2, 0.42, 0.1, c.beard, 0.02, head);
    box(-0.11, -0.12, 0.22, 0.045, c.beard, 0.03, head);       // mustache
  } else if (c.goatee) {
    box(-0.09, -0.11, 0.18, 0.035, c.goatee, 0.03, head);
    box(-0.07, -0.33, 0.14, 0.2, c.goatee, 0.02, head);
  } else {
    box(-0.05, -0.12, 0.1, 0.025, c.bun ? 0xd0607a : 0x9a6a5a, 0.03, head); // mouth
  }

  // mood bubble (Cynthea): party confetti or hangover cloud
  if (type === 'cynthea') {
    const party = parts.party = group(0, 1.62, 0.05);
    [[-0.18, 0.02, 0xff5d8f], [0, 0.1, 0xffd84a], [0.17, 0.0, 0x4ad4ff], [0.09, -0.06, 0x7cf27c]]
      .forEach(([x, y, col]) => box(x - 0.035, y - 0.035, 0.07, 0.07, col, 0, party).rotation.z = 0.6);
    const cloud = parts.cloud = group(0, 1.66, 0.05);
    circle(-0.12, 0, 0.1, 0x9aa0a8, 0, cloud, 12);
    circle(0.02, 0.05, 0.13, 0x9aa0a8, 0, cloud, 12);
    circle(0.15, 0, 0.09, 0x9aa0a8, 0, cloud, 12);
    cloud.visible = false;
  }
  return parts;
}

// Valerie's car, with her at the wheel. Faces +x, wheels on the ground.
function buildCar(root, { box, circle, THREE }) {
  const c = ROOMMATES.val;
  const parts = { wheels: [] };
  box(-0.95, 0.18, 1.9, 0.45, c.car, 0, root);                    // body
  box(-0.95, 0.18, 1.9, 0.08, 0x1d4a4d, 0.01, root);               // rocker
  box(-0.55, 0.6, 1.05, 0.42, c.car, 0, root);                     // cabin
  box(-0.47, 0.64, 0.42, 0.32, 0xa8d8ea, 0.01, root);              // rear window
  box(0.0, 0.64, 0.42, 0.32, 0xa8d8ea, 0.01, root);                // front window
  // Valerie in the driver's seat: red hair pulled back, black hoodie
  const v = parts.driver = new THREE.Group(); v.position.set(0.2, 0.62, 0.012); root.add(v);
  box(-0.14, 0, 0.28, 0.14, c.hoodie, 0, v);
  circle(-0.02, 0.24, 0.12, c.hair, -0.001, v, 14);
  circle(-0.12, 0.25, 0.06, c.hair, -0.001, v, 10);                // bun
  circle(0.02, 0.22, 0.11, c.skin, 0, v, 14);
  circle(0.08, 0.23, 0.018, 0x2a2420, 0.001, v, 6);                 // eye
  circle(0.035, 0.18, 0.012, 0xc0c4cc, 0.001, v, 5);                // piercing
  box(0.42, 0.66, 0.04, 0.3, c.car, 0.02, root);                   // A-pillar
  box(0.8, 0.4, 0.15, 0.1, 0xfff3a0, 0.02, root);                  // headlight
  box(-0.95, 0.4, 0.08, 0.1, 0xe0403a, 0.02, root);                // tail light
  box(-0.05, 0.45, 0.14, 0.03, 0x1d4a4d, 0.02, root);              // door handle
  for (const x of [-0.58, 0.58]) {
    const w = new THREE.Group(); w.position.set(x, 0.2, 0.03); root.add(w);
    circle(0, 0, 0.2, 0x1a1a1a, 0, w, 16);
    circle(0, 0, 0.09, 0xb8bcc4, 0.01, w, 10);
    box(-0.015, -0.09, 0.03, 0.18, 0x7a7f88, 0.02, w);              // spoke so the spin shows
    parts.wheels.push(w);
  }
  return parts;
}

// ---- projectiles ----
function buildProjectile(kind, root, { box, circle }) {
  if (kind === 'wrench') {
    box(-0.04, -0.2, 0.08, 0.34, 0x9aa0a8, 0, root);
    circle(0, 0.18, 0.1, 0x9aa0a8, 0, root, 12);
    box(-0.03, 0.2, 0.06, 0.1, 0x8fd3ff, 0.01, root);        // open jaw
    return { w: 0.4, h: 0.4, gravity: -22, spin: -12 };
  }
  if (kind === 'plate') {
    circle(0, 0, 0.22, 0xf7f5ef, 0, root, 18);
    circle(0, 0, 0.15, 0xe6e2d8, 0.01, root, 16);
    circle(0.05, 0.03, 0.06, 0xb5763a, 0.02, root, 10);      // leftover sauce
    circle(-0.06, -0.04, 0.035, 0x8a5a2a, 0.02, root, 8);
    return { w: 0.44, h: 0.3, gravity: 0, spin: 8 };
  }
  if (kind === 'shock') {           // ground shockwave from Bobby's elbow drop
    for (const [x, h] of [[-0.24, 0.22], [-0.08, 0.38], [0.08, 0.3], [0.22, 0.18]])
      box(x - 0.07, -0.2, 0.14, h, 0xd9b77a, 0, root);
    return { w: 0.55, h: 0.4, gravity: 0, spin: 0 };
  }
  // 'shout': loud sound waves
  box(-0.16, -0.12, 0.05, 0.24, 0xfff3a0, 0, root);
  box(-0.04, -0.22, 0.05, 0.44, 0xfff3a0, 0, root);
  box(0.08, -0.32, 0.05, 0.64, 0xfff3a0, 0, root);
  return { w: 0.4, h: 0.8, gravity: 0, spin: 0, passThrough: true, grow: 0.5 };
}

// ---- behaviours ----
// ctx: { player, shoot(kind, x, y, vx, vy, life), sfx }
const ENEMY_GRAVITY = -30;

function updateRoommate(e, dt, ctx) {
  const p = ctx.player;
  const cfg = ROOMMATES[e.type];
  const dx = (p.x + p.w / 2) - (e.x + e.w / 2);
  const dy = p.y - e.y;
  const toward = Math.sign(dx) || 1;
  const near = (range, vRange) => Math.abs(dx) < range && Math.abs(dy) < vRange;
  e.timer -= dt;
  e.anim = (e.anim || 0) - dt;

  const patrol = (speed) => {
    e.vx = e.dir * speed;
    e.x += e.vx * dt;
    if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
    if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.dir = -1; }
  };

  switch (e.type) {
    case 'robert':
      patrol(cfg.speed);
      if (near(8, 5) && e.timer <= 0) {
        e.face = toward;
        ctx.shoot('wrench', e.x + e.w / 2 + toward * 0.3, e.y + 1.0, toward * 4.5, 8, 3);
        e.timer = 2.4; e.anim = 0.3; ctx.sfx('throw');
      }
      break;

    case 'bill':
      patrol(cfg.speed);
      if (near(9, 2.5) && e.timer <= 0) {
        e.face = toward;
        ctx.shoot('plate', e.x + e.w / 2 + toward * 0.3, e.y + 0.6, toward * 5.5, 0, 2.5);
        e.timer = 2.8; e.anim = 0.3; ctx.sfx('throw');
      }
      break;

    case 'steven':
      if (e.state === 'lurk') {
        e.vx = 0; e.crouch = 1;
        if (near(4, 3)) {
          e.state = 'leap'; e.vy = 11; e.dir = toward; e.crouch = 0; ctx.sfx('scare');
        }
      } else if (e.state === 'leap') {
        e.vx = e.dir * 4.5;
        e.x = Math.max(e.minX, Math.min(e.maxX - e.w, e.x + e.vx * dt));
        if (e.onGround && e.vy <= 0) { e.state = 'recover'; e.timer = 1.2; }
      } else if (e.state === 'recover') {
        e.vx = 0;
        if (e.timer <= 0) e.state = 'return';
      } else {             // walk back to his hiding spot
        e.dir = Math.sign(e.x0 - e.x) || 1;
        e.vx = e.dir * cfg.speed;
        e.x += e.vx * dt;
        if (Math.abs(e.x - e.x0) < 0.1) { e.x = e.x0; e.state = 'lurk'; }
      }
      break;

    case 'cynthea':
      e.mood -= dt;
      if (e.mood <= 0) {
        e.state = e.state === 'party' ? 'hungover' : 'party';
        e.mood = e.state === 'party' ? 5 : 3.5;
      }
      if (e.state === 'party') {
        patrol(cfg.speed);
        if (e.onGround) e.vy = 5.5;                    // can't stop bouncing
        if (near(8, 3) && e.timer <= 0) {
          e.face = toward;
          ctx.shoot('shout', e.x + e.w / 2 + toward * 0.4, e.y + 1.1, toward * 4, 0, 1.5);
          e.timer = 1.4; ctx.sfx('shout');
        }
      } else {
        patrol(0.35);                                  // barely moving
      }
      break;

    case 'bobby':
      // Macho Man flying elbow drop: wind up, leap at Bruce, slam, shockwaves both ways
      if (e.state === 'walk') {
        patrol(cfg.speed);
        if (near(8, 4) && e.timer <= 0) { e.state = 'windup'; e.timer = 0.4; e.vx = 0; e.face = toward; e.crouch = 1; }
      } else if (e.state === 'windup') {
        e.vx = 0;
        if (e.timer <= 0) {
          const air = 2 * 13 / -ENEMY_GRAVITY;
          e.state = 'fly'; e.crouch = 0; e.vy = 13; e.onGround = false;
          e.vx = Math.max(-7, Math.min(7, dx / air)); e.dir = Math.sign(e.vx) || toward;
          ctx.sfx('scare');
        }
      } else if (e.state === 'fly') {
        e.x = Math.max(e.minX, Math.min(e.maxX - e.w, e.x + e.vx * dt));
        if (e.onGround && e.vy <= 0) {
          ctx.shoot('shock', e.x + e.w / 2 - 0.5, e.y + 0.22, -6, 0, 0.9);
          ctx.shoot('shock', e.x + e.w / 2 + 0.5, e.y + 0.22, 6, 0, 0.9);
          ctx.sfx('slam'); e.state = 'recover'; e.timer = 0.6; e.vx = 0;
        }
      } else {             // recover
        e.vx = 0;
        if (e.timer <= 0) { e.state = 'walk'; e.timer = 2.2; }
      }
      break;

    case 'val':
      // cruises back and forth; floors it when Bruce is in front of the car
      patrol(e.dir === toward && near(7, 2) ? cfg.boost : cfg.speed);
      break;
  }

  // gravity + land on the segment the roommate lives on
  e.vy += ENEMY_GRAVITY * dt;
  e.y += e.vy * dt;
  e.onGround = false;
  if (e.y <= e.ground) { e.y = e.ground; e.vy = 0; e.onGround = true; }

  // Steven/Bobby are shorter while crouched; Valerie's car is low and long
  e.h = e.type === 'val' ? 1.05 : e.crouch ? 0.95 : 1.4;
}

function resetRoommate(e) {
  Object.assign(e, {
    alive: true, x: e.x0, y: e.ground, vx: 0, vy: 0, dir: -1, face: -1, timer: 1, anim: 0,
    squash: 0, onGround: true, crouch: 0, stun: 0,
    state: e.type === 'steven' ? 'lurk' : e.type === 'cynthea' ? 'party' : 'walk',
    mood: 5, h: e.type === 'val' ? 1.05 : 1.4,
  });
}

// visual animation for one roommate (called every frame)
function animateRoommate(e, t) {
  const pr = e.parts;
  if (e.type === 'val') {                 // spin wheels, bounce a little on the suspension
    for (const w of pr.wheels) w.rotation.z -= e.vx * 0.03;
    pr.driver.position.y = 0.62 + Math.abs(Math.sin(t * 9 + e.x)) * 0.015 * Math.abs(e.vx);
    return;
  }
  const walking = Math.abs(e.vx) > 0.05 && e.onGround;
  const phase = t * (4 + Math.abs(e.vx) * 2.5) + e.x0;
  const s = walking ? Math.sin(phase) * 0.45 : 0;
  pr.legL.rotation.z = s; pr.legR.rotation.z = -s;
  pr.armL.rotation.z = -s * 0.8; pr.armR.rotation.z = s * 0.8;
  if (e.anim > 0) pr.armR.rotation.z = 2.4;                        // throwing pose
  if (!e.onGround) { pr.armL.rotation.z = -2.6; pr.armR.rotation.z = 2.6; pr.legL.rotation.z = 0.4; pr.legR.rotation.z = -0.4; }
  pr.head.rotation.z = walking ? Math.sin(phase * 0.5) * 0.06 : 0;
  if (e.type === 'bobby' && e.state === 'fly') {           // elbow out, coming down hard
    pr.armR.rotation.z = 1.7; pr.armL.rotation.z = -0.5;
    pr.legL.rotation.z = 0.6; pr.legR.rotation.z = 0.2;
    if (e.vy < 0) pr.head.rotation.z = -0.3;
  }
  if (e.type === 'cynthea') {
    pr.party.visible = e.state === 'party';
    pr.cloud.visible = e.state === 'hungover';
    pr.head.rotation.z = e.state === 'hungover' ? -0.25 : pr.head.rotation.z;
    pr.party.rotation.z = t * 2;
    pr.cloud.position.x = Math.sin(t * 1.5) * 0.08;
  }
}
