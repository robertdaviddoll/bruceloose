// Playable cats. Looks come from source/bruce/ and source/gremlin/,
// personalities and special abilities from source/design.json.
//
// buildCat() draws a side-view cat facing +x with its feet at y = 0.
// animateCat() poses it every frame.

const CATS = {
  bruce: {
    name: 'Bruce',
    blurb: 'Tuxedo menace. Plays rough.',
    ability: 'POUNCE',
    abilityText: 'Dash forward claws-first. Knocks out roommates and smashes anything they throw.',
    cooldown: 1.2,
    runSpeed: 7.5,
    fur: 0x16161a, furFar: 0x0b0b0d, innerEar: 0xd99a9a, eye: 0xc8d84a, nose: 0x1e1e22, whisker: 0xdcdcdc,
    white: 0xf4f2ee, streak: 0x8c8c94, collar: 0x2c2c38, tag: 0xc4c6cc,
  },
  gremlin: {
    name: 'Gremlin',
    blurb: 'Fluffy, grumpy, soft paws.',
    ability: 'GROWL',
    abilityText: 'Growl to stun nearby roommates and swat away projectiles. Hold jump to float down on her fluff.',
    cooldown: 3,
    runSpeed: 6.8,
    fur: 0x1d1613, furFar: 0x100c0a, furHi: 0x3a2c25, innerEar: 0x5a3e3a, eye: 0xc2c23a, nose: 0x2a1d1a, whisker: 0x8f8f8f,
    fluffy: true, grumpy: true,
  },
};

function buildCat(type, root, { box, circle, tri, THREE }) {
  const c = CATS[type];
  const parts = {};
  const paw = c.white || c.fur;

  // legs pivot at the hip; far-side legs are darker and sit behind the body
  const HIP = 0.32;
  const leg = (x, z, color, sock) => {
    const g = new THREE.Group(); g.position.set(x, HIP, z); root.add(g);
    box(-0.065, -HIP, 0.13, HIP, color, 0, g);
    if (c.white && sock) box(-0.065, -HIP, 0.13, sock, c.white, 0.005, g);
    box(-0.085, -HIP, 0.17, 0.08, c.white ? paw : color, 0.01, g);
    if (c.fluffy) circle(0, -0.12, 0.085, color, 0.005, g, 10);   // fluffy "pants"
    return g;
  };
  parts.legs = {
    backFar:   leg(-0.34, -0.05, c.furFar, 0.1),
    frontFar:  leg(0.2,   -0.05, c.furFar, 0.14),
    backNear:  leg(-0.24,  0.05, c.fur, 0.1),
    frontNear: leg(0.31,   0.05, c.fur, 0.16),
  };

  // tail: three segments curling up from the rump (big and bushy on Gremlin)
  parts.tail = [];
  {
    let parent = root, pos = [-0.52, 0.5];
    const wdt = c.fluffy ? 0.2 : 0.11;
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group(); g.position.set(pos[0], pos[1], i === 0 ? -0.03 : 0); parent.add(g);
      box(-wdt / 2, 0, wdt, 0.23, c.fur, 0, g);
      circle(0, 0.23, c.fluffy ? 0.13 : 0.055, c.fur, 0, g, 12);
      if (c.fluffy) circle(0, 0.08, 0.12, c.fur, 0, g, 12);
      parts.tail.push(g); parent = g; pos = [0, 0.22];
    }
  }

  // torso
  box(-0.42, 0.28, 0.72, 0.36, c.fur, 0, root);
  circle(-0.4, 0.46, 0.19, c.fur, 0, root);
  circle(0.28, 0.47, 0.2, c.fur, 0, root);
  if (c.fluffy) {
    // long fur: tufts along the back and belly plus a big neck ruff
    for (const [x, y, r] of [[-0.3, 0.29, 0.11], [-0.08, 0.27, 0.11], [0.12, 0.28, 0.11], [-0.5, 0.4, 0.13]])
      circle(x, y, r, c.fur, 0, root, 12);
    for (const [x, y, r] of [[-0.3, 0.62, 0.12], [-0.1, 0.64, 0.12], [0.1, 0.63, 0.12]]) {
      circle(x, y + 0.015, r, c.furHi, -0.002, root, 12);           // sheen on top of the coat
      circle(x, y - 0.02, r, c.fur, 0, root, 12);
    }
    circle(0.3, 0.56, 0.24, c.fur, 0.01, root, 16);
  }
  if (c.white) {
    circle(0.37, 0.5, 0.14, c.white, 0.02, root);                 // chest bib
    circle(0.3, 0.36, 0.1, c.white, 0.02, root);
  }
  if (c.collar) {
    box(0.3, 0.5, 0.07, 0.2, c.collar, 0.03, root).rotation.z = -0.5;
    circle(0.39, 0.5, 0.04, c.tag, 0.04, root, 12);
  }

  // head
  const head = parts.head = new THREE.Group(); head.position.set(0.46, 0.78, 0.02); root.add(head);
  tri(-0.21, 0.1, 0.18, 0.24, c.furFar, -0.01, head);            // far ear
  tri(-0.03, 0.12, 0.18, 0.24, c.fur, 0.01, head);               // near ear
  tri(0.015, 0.15, 0.1, 0.14, c.innerEar, 0.02, head);           // inner ear
  circle(0, 0, 0.23, c.fur, 0, head);
  if (c.fluffy) { circle(-0.12, -0.1, 0.14, c.fur, 0.005, head, 12); circle(0.02, -0.17, 0.12, c.fur, 0.005, head, 12); } // cheek fluff
  if (c.streak) box(0.0, 0.07, 0.035, 0.12, c.streak, 0.02, head).rotation.z = -0.35;
  if (c.white) {
    circle(0.14, -0.08, 0.12, c.white, 0.02, head);              // muzzle
    circle(0.05, -0.14, 0.09, c.white, 0.02, head);              // chin
  } else {
    circle(0.14, -0.07, 0.1, c.fur, 0.02, head);                 // dark muzzle
  }
  circle(0.24, -0.03, 0.035, c.nose, 0.03, head, 10);            // nose
  circle(0.1, 0.05, 0.055, c.eye, 0.03, head, 14);               // eye
  box(0.1, 0.015, 0.025, 0.07, 0x111111, 0.04, head);            // pupil
  if (c.grumpy) box(0.03, 0.06, 0.15, 0.06, c.fur, 0.05, head).rotation.z = -0.25;   // heavy, unimpressed eyelid
  box(0.16, -0.08, 0.24, 0.012, c.whisker, 0.04, head).rotation.z = 0.12;
  box(0.16, -0.11, 0.24, 0.012, c.whisker, 0.04, head).rotation.z = -0.1;
  return parts;
}

// pose the cat; p is the player state, moving = running on the ground
function animateCat(parts, p, t, moving) {
  const { legs, tail, head } = parts;
  const swing = moving ? Math.sin(p.anim) * 0.6 : 0;
  if (p.dash > 0) {                          // pounce: fully stretched out
    legs.frontNear.rotation.z = legs.frontFar.rotation.z = 1.1;
    legs.backNear.rotation.z = legs.backFar.rotation.z = -1.0;
  } else if (p.onGround) {                   // trot: diagonal pairs swing together
    legs.frontNear.rotation.z = swing;  legs.backFar.rotation.z = swing;
    legs.frontFar.rotation.z = -swing;  legs.backNear.rotation.z = -swing;
  } else {
    legs.frontNear.rotation.z = legs.frontFar.rotation.z = 0.7;
    legs.backNear.rotation.z = legs.backFar.rotation.z = -0.6;
  }
  head.position.y = 0.78 + (moving ? Math.sin(p.anim * 2) * 0.02 : 0);
  head.rotation.z = p.growl > 0 ? 0.25 + Math.sin(t * 60) * 0.05 : 0;   // growl: head up, rumbling
  const puff = p.growl > 0 ? 0.5 : 0;                                    // tail puffs straight up
  tail[0].rotation.z = 0.7 - puff + Math.sin(t * 3) * 0.15 + (moving ? 0.25 : 0);
  tail[1].rotation.z = -0.3 + puff * 0.6 + Math.sin(t * 3 - 0.8) * 0.25;
  tail[2].rotation.z = -0.5 + puff * 0.8 + Math.sin(t * 3 - 1.6) * 0.3;
}
