// Game feel tunables. Shared with the other scripts as globals.
const GRAVITY = -38, MAX_FALL = -22;
const MOVE_SPEED = 7.5, ACCEL = 60, AIR_ACCEL = 35, FRICTION = 50, AIR_FRICTION = 8;
const JUMP_V = 15.5, COYOTE = 0.1, BUFFER = 0.12;
const STEP = 1 / 120;

// special abilities (cooldowns and run speeds per cat are in cats.js)
const POUNCE_TIME = 0.28, POUNCE_SPEED = 15;               // Bruce
const GROWL_TIME = 0.45, GROWL_RADIUS = 4.5, STUN_TIME = 3; // Gremlin
const GLIDE_FALL = -3.2;                                    // Gremlin's fluffy max fall speed while holding jump
