/**
 * STICK ARENA :: XENO PURGE — core constants, math and data tables.
 *
 * This module is a 1:1 port of the Java engine found in /java
 * (com.stickarena.core.Constants / Weapons / AlienTable).
 */

export const WORLD = { w: 960, h: 540 };
export const GROUND_Y = 446;

export const GRAVITY = 1850;
export const MAX_FALL = 1150;

export interface Platform {
  x: number;
  y: number;
  w: number;
}

export const PLATFORMS: Platform[] = [
  { x: 40, y: 338, w: 212 },
  { x: 708, y: 338, w: 212 },
  { x: 366, y: 232, w: 228 },
  { x: 214, y: 150, w: 118 },
  { x: 628, y: 150, w: 118 },
];

/* ------------------------------------------------------------------ math */

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
export const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);

/* --------------------------------------------------------------- weapons */

export type WeaponId = 'blaster' | 'pulse' | 'scatter' | 'rail';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  tag: string;
  dmg: number;
  rof: number;
  speed: number;
  spread: number;
  pellets: number;
  maxAmmo: number; // -1 = infinite
  knock: number;
  recoil: number;
  shake: number;
  pierce: number;
  radius: number;
  len: number;
  color: string;
  glow: string;
  auto: boolean;
  hitscan?: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  blaster: {
    id: 'blaster',
    name: 'ION BLASTER',
    tag: 'STD',
    dmg: 26,
    rof: 0.155,
    speed: 980,
    spread: 0.022,
    pellets: 1,
    maxAmmo: -1,
    knock: 150,
    recoil: 34,
    shake: 0.1,
    pierce: 0,
    radius: 4,
    len: 17,
    color: '#8ffcff',
    glow: '#22d3ee',
    auto: true,
  },
  pulse: {
    id: 'pulse',
    name: 'PULSE RIPPER',
    tag: 'SMG',
    dmg: 13,
    rof: 0.062,
    speed: 1180,
    spread: 0.075,
    pellets: 1,
    maxAmmo: 170,
    knock: 70,
    recoil: 18,
    shake: 0.07,
    pierce: 0,
    radius: 3.4,
    len: 15,
    color: '#fde68a',
    glow: '#f59e0b',
    auto: true,
  },
  scatter: {
    id: 'scatter',
    name: 'SCATTER CANNON',
    tag: 'SHOT',
    dmg: 17,
    rof: 0.58,
    speed: 880,
    spread: 0.3,
    pellets: 8,
    maxAmmo: 28,
    knock: 320,
    recoil: 210,
    shake: 0.46,
    pierce: 0,
    radius: 4.2,
    len: 13,
    color: '#ffb4f0',
    glow: '#ec4899',
    auto: false,
  },
  rail: {
    id: 'rail',
    name: 'XENO RAIL',
    tag: 'RAIL',
    dmg: 120,
    rof: 0.92,
    speed: 2600,
    spread: 0,
    pellets: 1,
    maxAmmo: 14,
    knock: 420,
    recoil: 150,
    shake: 0.7,
    pierce: 99,
    radius: 5,
    len: 54,
    color: '#ffffff',
    glow: '#a855f7',
    auto: false,
    hitscan: true,
  },
};

export const WEAPON_ORDER: WeaponId[] = ['blaster', 'pulse', 'scatter', 'rail'];

/* --------------------------------------------------------------- aliens */

export type AlienKind = 'grunt' | 'hopper' | 'spitter' | 'brute' | 'overmind';

export interface AlienSpec {
  kind: AlienKind;
  name: string;
  hp: number;
  speed: number;
  scale: number;
  score: number;
  touchDmg: number;
  color: string;
  glow: string;
  jumpy: number; // chance per second to hop
  ranged: boolean;
  fireRate: number;
}

export const ALIENS: Record<AlienKind, AlienSpec> = {
  grunt: {
    kind: 'grunt',
    name: 'XENO GRUNT',
    hp: 44,
    speed: 112,
    scale: 1,
    score: 100,
    touchDmg: 11,
    color: '#7dff9b',
    glow: '#22c55e',
    jumpy: 0.25,
    ranged: false,
    fireRate: 0,
  },
  hopper: {
    kind: 'hopper',
    name: 'SKITTER',
    hp: 30,
    speed: 205,
    scale: 0.82,
    score: 150,
    touchDmg: 9,
    color: '#ffd166',
    glow: '#f97316',
    jumpy: 1.5,
    ranged: false,
    fireRate: 0,
  },
  spitter: {
    kind: 'spitter',
    name: 'ACID SPITTER',
    hp: 38,
    speed: 86,
    scale: 0.95,
    score: 180,
    touchDmg: 8,
    color: '#c4b5fd',
    glow: '#8b5cf6',
    jumpy: 0.15,
    ranged: true,
    fireRate: 1.9,
  },
  brute: {
    kind: 'brute',
    name: 'HULK-FORM',
    hp: 230,
    speed: 92,
    scale: 1.55,
    score: 520,
    touchDmg: 20,
    color: '#ff8585',
    glow: '#ef4444',
    jumpy: 0.1,
    ranged: false,
    fireRate: 0,
  },
  overmind: {
    kind: 'overmind',
    name: 'THE OVERMIND',
    hp: 1100,
    speed: 128,
    scale: 2.5,
    score: 4000,
    touchDmg: 26,
    color: '#ff5ec4',
    glow: '#db2777',
    jumpy: 0.5,
    ranged: true,
    fireRate: 1.25,
  },
};

/* --------------------------------------------------------------- tuning */

export const PLAYER = {
  hp: 100,
  speed: 285,
  accelGround: 2600,
  accelAir: 1500,
  frictionGround: 2400,
  jump: 672,
  coyote: 0.1,
  jumpBuffer: 0.12,
  maxJumps: 2,
  dashSpeed: 900,
  dashTime: 0.17,
  dashIFrames: 0.3,
  dashCooldown: 0.62,
  dashDamage: 55,
  hurtInvuln: 0.85,
  height: 60,
};

/** base alien stickman height in px (multiplied by each species' scale) */
export const ALIEN_BASE_H = 60;

export const WAVE_BREAK = 2.6;
