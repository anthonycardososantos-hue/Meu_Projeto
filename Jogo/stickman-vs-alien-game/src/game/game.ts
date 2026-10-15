import {
  ALIENS,
  ALIEN_BASE_H,
  AlienKind,
  AlienSpec,
  GRAVITY,
  GROUND_Y,
  MAX_FALL,
  PLATFORMS,
  PLAYER,
  WAVE_BREAK,
  WEAPONS,
  WEAPON_ORDER,
  WORLD,
  WeaponId,
  clamp,
  lerp,
  pick,
  rand,
  randInt,
} from './core';
import { audio } from './audio';
import { Camera, Particles, Ragdoll, TextFx } from './fx';
import { drawArena, drawStickman, drawVignette } from './draw';
import { drawHud } from './hud';

export type GameState = 'menu' | 'playing' | 'paused' | 'dying' | 'dead';

export interface RunStats {
  score: number;
  wave: number;
  kills: number;
  accuracy: number;
  time: number;
}

interface Bullet {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  life: number;
  foe: boolean;
  color: string;
  glow: string;
  r: number;
  len: number;
  pierce: number;
  knock: number;
  grav: number;
  hitIds: number[];
}

interface Alien {
  id: number;
  kind: AlienKind;
  spec: AlienSpec;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  h: number;
  hw: number;
  grounded: boolean;
  facing: number;
  phase: number;
  flash: number;
  spawnT: number;
  attackCd: number;
  touchCd: number;
  hopCd: number;
  stun: number;
  dashTag: number;
  alive: boolean;
  boss: boolean;
  summonCd: number;
}

interface Pickup {
  kind: 'weapon' | 'med';
  weapon?: WeaponId;
  x: number;
  y: number;
  vy: number;
  life: number;
  t: number;
}

interface Ghost {
  x: number;
  y: number;
  life: number;
  facing: number;
  phase: number;
  aim: number;
}

interface Spawner {
  x: number;
  t: number;
  kind: AlienKind;
}

const BULLET_CAP = 420;

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GameState = 'menu';
  onState: (s: GameState, stats: RunStats) => void = () => undefined;

  // view
  view = { scale: 1, ox: 0, oy: 0, w: WORLD.w, h: WORLD.h };
  dpr = 1;

  // time
  private raf = 0;
  private last = 0;
  private acc = 0;
  time = 0;
  timeScale = 1;
  targetScale = 1;
  hitStop = 0;

  // fx
  cam = new Camera();
  parts = new Particles();
  texts = new TextFx();
  ragdolls: Ragdoll[] = [];
  ghosts: Ghost[] = [];
  flash = 0;
  flashColor = '255,255,255';
  shakeMult = 1;

  // run data
  score = 0;
  displayScore = 0;
  wave = 0;
  kills = 0;
  shots = 0;
  hits = 0;
  runTime = 0;
  combo = 0;
  comboTimer = 0;
  bestCombo = 0;
  toast = '';
  toastT = 0;
  banner = '';
  bannerT = 0;
  waveBreak = 0;
  danger = 0;

  // entities
  p = {
    x: WORLD.w / 2,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    hw: 13,
    hp: PLAYER.hp,
    facing: 1,
    grounded: false,
    phase: 0,
    jumps: 0,
    coyote: 0,
    jumpBuf: 0,
    dash: 0,
    dashCd: 0,
    dashDir: 1,
    dashTag: 0,
    iFrames: 0,
    hurtFlash: 0,
    fireCd: 0,
    weapon: 'blaster' as WeaponId,
    ammo: { blaster: -1, pulse: 0, scatter: 0, rail: 0 } as Record<WeaponId, number>,
    aim: 0,
    squash: 1,
    dropT: 0,
    scarf: [] as { x: number; y: number; vx: number; vy: number }[],
    recoil: 0,
  };

  bullets: Bullet[] = [];
  aliens: Alien[] = [];
  pickups: Pickup[] = [];
  spawners: Spawner[] = [];
  queue: AlienKind[] = [];
  spawnCd = 0;
  nextId = 1;
  boss: Alien | null = null;

  // input
  keys = new Set<string>();
  mouse = { x: WORLD.w / 2, y: 200, down: false, active: false };
  touch = { mx: 0, my: 0, active: false, fire: false, aimX: 0, aimY: 0, aiming: false };
  isTouch = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    for (let i = 0; i < BULLET_CAP; i++)
      this.bullets.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        dmg: 0,
        life: 0,
        foe: false,
        color: '#fff',
        glow: '#fff',
        r: 3,
        len: 10,
        pierce: 0,
        knock: 0,
        grav: 0,
        hitIds: [],
      });
    for (let i = 0; i < 9; i++) this.p.scarf.push({ x: this.p.x, y: this.p.y - 44, vx: 0, vy: 0 });
    this.bindEvents();
    this.resize();
  }

  /* --------------------------------------------------------------- setup */

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.resize);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.canvas.parentElement);
    }
  }

  private ro: ResizeObserver | null = null;

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
  }

  private onBlur = () => {
    if (this.state === 'playing') this.pause();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
    if (this.keys.has(k)) return;
    this.keys.add(k);
    if (k === 'p' || k === 'escape') {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }
    if (k === 'r' && (this.state === 'dead' || this.state === 'paused' || this.state === 'dying')) this.start();
    if (this.state !== 'playing') return;
    if (k === 'w' || k === 'arrowup' || k === ' ') this.p.jumpBuf = PLAYER.jumpBuffer;
    if (k === 'shift' || k === 'k' || k === 'l') this.tryDash();
    if (k === 'q') this.cycleWeapon(-1);
    if (k === 'e') this.cycleWeapon(1);
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 4) this.selectWeapon(WEAPON_ORDER[n - 1]);
  };

  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  private onPointerDown = (e: PointerEvent) => {
    audio.init();
    if (e.pointerType === 'touch') {
      this.isTouch = true;
      return;
    }
    this.mouse.active = true;
    this.mouse.down = true;
    this.updateMouse(e);
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.mouse.down = false;
  };
  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.mouse.active = true;
    this.updateMouse(e);
  };
  private updateMouse(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - r.left - this.view.ox) / this.view.scale;
    this.mouse.y = (e.clientY - r.top - this.view.oy) / this.view.scale;
  }

  resize = () => {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(cw / WORLD.w, ch / WORLD.h);
    this.view.scale = scale;
    this.view.ox = (cw - WORLD.w * scale) / 2;
    // in tall/portrait viewports, sit the arena high so touch controls get room
    const tall = ch / Math.max(1, cw) > 1.1;
    this.view.oy = (ch - WORLD.h * scale) * (tall ? 0.3 : 0.5);
    this.canvas.width = Math.floor(cw * this.dpr);
    this.canvas.height = Math.floor(ch * this.dpr);
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.view.w = cw;
    this.view.h = ch;
  };

  /* -------------------------------------------------------------- states */

  start() {
    audio.init();
    this.state = 'playing';
    this.score = 0;
    this.displayScore = 0;
    this.wave = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.runTime = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.timeScale = 1;
    this.targetScale = 1;
    this.hitStop = 0;
    this.flash = 0;
    this.danger = 0;
    this.aliens.length = 0;
    this.pickups.length = 0;
    this.spawners.length = 0;
    this.ragdolls.length = 0;
    this.ghosts.length = 0;
    this.queue.length = 0;
    this.boss = null;
    this.parts.clear();
    this.texts.clear();
    this.cam.reset();
    for (const b of this.bullets) b.active = false;
    const p = this.p;
    p.x = WORLD.w / 2;
    p.y = GROUND_Y;
    p.vx = p.vy = 0;
    p.hp = PLAYER.hp;
    p.facing = 1;
    p.dash = 0;
    p.dashCd = 0;
    p.iFrames = 0;
    p.hurtFlash = 0;
    p.fireCd = 0;
    p.weapon = 'blaster';
    p.ammo = { blaster: -1, pulse: 0, scatter: 0, rail: 0 };
    p.jumps = PLAYER.maxJumps;
    p.squash = 1;
    for (const s of p.scarf) {
      s.x = p.x;
      s.y = p.y - 44;
      s.vx = s.vy = 0;
    }
    this.nextWave();
    this.emit();
    audio.resumeForGame();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    audio.pauseForGame();
    this.emit();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.last = performance.now();
    audio.resumeForGame();
    this.emit();
  }
  toMenu() {
    this.state = 'menu';
    this.emit();
  }

  stats(): RunStats {
    return {
      score: Math.floor(this.score),
      wave: this.wave,
      kills: this.kills,
      accuracy: this.shots ? Math.min(100, Math.round((this.hits / this.shots) * 100)) : 0,
      time: this.runTime,
    };
  }
  private emit() {
    this.onState(this.state, this.stats());
  }

  /* ---------------------------------------------------------------- loop */

  run() {
    this.last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      if (this.state === 'playing' || this.state === 'dying') {
        this.timeScale = lerp(this.timeScale, this.targetScale, 1 - Math.pow(0.001, dt));
        let step = dt * this.timeScale;
        if (this.hitStop > 0) {
          this.hitStop -= dt;
          step *= 0.06;
        }
        this.acc += step;
        const fixed = 1 / 120;
        let guard = 0;
        while (this.acc >= fixed && guard++ < 16) {
          this.update(fixed);
          this.acc -= fixed;
        }
      } else {
        this.parts.update(dt * 0.4);
        this.cam.update(dt, this.shakeMult);
        this.time += dt * 0.3;
      }
      this.render();
    };
    this.raf = requestAnimationFrame(frame);
  }

  /* -------------------------------------------------------------- update */

  private update(dt: number) {
    this.time += dt;
    this.runTime += dt;
    this.cam.update(dt, this.shakeMult);
    this.parts.update(dt);
    this.texts.update(dt);
    this.flash = Math.max(0, this.flash - dt * 3.4);
    this.danger = Math.max(0, this.danger - dt * 1.6);
    this.displayScore += (this.score - this.displayScore) * clamp(dt * 9, 0, 1);
    if (this.toastT > 0) this.toastT -= dt;
    if (this.bannerT > 0) this.bannerT -= dt;

    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      this.ragdolls[i].update(dt);
      if (this.ragdolls[i].dead) this.ragdolls.splice(i, 1);
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      this.ghosts[i].life -= dt * 3.4;
      if (this.ghosts[i].life <= 0) this.ghosts.splice(i, 1);
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && this.combo > 0) this.combo = 0;
    }

    if (this.state === 'dying') {
      this.updateBullets(dt);
      this.updateAliens(dt);
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.state = 'dead';
        this.targetScale = 1;
        this.timeScale = 1;
        this.emit();
      }
      return;
    }

    this.updatePlayer(dt);
    this.updateAliens(dt);
    this.updateBullets(dt);
    this.updatePickups(dt);
    this.updateWaves(dt);

    audio.setIntensity(clamp(this.aliens.length / 8, 0, 1));
  }

  deathTimer = 0;

  /* ------------------------------------------------------------- physics */

  private moveBody(
    o: { x: number; y: number; vx: number; vy: number; grounded: boolean; hw: number },
    dt: number,
    dropThrough = false,
  ) {
    o.vy = clamp(o.vy + GRAVITY * dt, -2000, MAX_FALL);
    const prevY = o.y;
    o.x += o.vx * dt;
    o.y += o.vy * dt;
    o.grounded = false;
    if (o.x < o.hw) {
      o.x = o.hw;
      o.vx = 0;
    }
    if (o.x > WORLD.w - o.hw) {
      o.x = WORLD.w - o.hw;
      o.vx = 0;
    }
    if (o.y >= GROUND_Y) {
      o.y = GROUND_Y;
      o.vy = 0;
      o.grounded = true;
      return;
    }
    if (o.vy > 0 && !dropThrough) {
      for (const pf of PLATFORMS) {
        if (o.x > pf.x - 4 && o.x < pf.x + pf.w + 4 && prevY <= pf.y + 1 && o.y >= pf.y) {
          o.y = pf.y;
          o.vy = 0;
          o.grounded = true;
          return;
        }
      }
    }
  }

  /* -------------------------------------------------------------- player */

  private updatePlayer(dt: number) {
    const p = this.p;
    const k = this.keys;
    let ax = 0;
    if (k.has('a') || k.has('arrowleft')) ax -= 1;
    if (k.has('d') || k.has('arrowright')) ax += 1;
    if (this.touch.active) ax += this.touch.mx;
    ax = clamp(ax, -1, 1);
    const down = k.has('s') || k.has('arrowdown') || this.touch.my > 0.55;

    // aim
    if (this.touch.aiming) {
      p.aim = Math.atan2(this.touch.aimY, this.touch.aimX);
    } else if (this.isTouch || !this.mouse.active) {
      const t = this.nearestAlien(p.x, p.y - 36, 900);
      if (t) {
        const want = Math.atan2(t.y - t.h * 0.55 - (p.y - 36), t.x - p.x);
        let d = want - p.aim;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        p.aim += clamp(d, -12 * dt, 12 * dt);
        if (Math.abs(p.vx) < 30 && p.dash <= 0) p.facing = Math.cos(p.aim) >= 0 ? 1 : -1;
      } else p.aim = lerp(p.aim, p.facing > 0 ? 0 : Math.PI, clamp(dt * 8, 0, 1));
    } else {
      p.aim = Math.atan2(this.mouse.y - (p.y - 36), this.mouse.x - p.x);
    }

    // movement
    if (p.dash > 0) {
      p.dash -= dt;
      p.vx = p.dashDir * PLAYER.dashSpeed;
      p.vy = 0;
      this.ghostCd -= dt;
      if (this.ghostCd <= 0) {
        this.ghostCd = 0.035;
        this.ghosts.push({ x: p.x, y: p.y, life: 1, facing: p.facing, phase: p.phase, aim: p.aim });
      }
      this.parts.spawn({
        kind: 'spark',
        x: p.x - p.dashDir * 8,
        y: p.y - rand(6, 40),
        vx: -p.dashDir * rand(60, 240),
        vy: rand(-40, 40),
        max: rand(0.12, 0.3),
        size: rand(1, 2.6),
        color: '#7dd3fc',
      });
      this.dashHits();
    } else {
      const accel = p.grounded ? PLAYER.accelGround : PLAYER.accelAir;
      if (ax !== 0) {
        p.vx += ax * accel * dt;
        p.vx = clamp(p.vx, -PLAYER.speed * 1.45, PLAYER.speed * 1.45);
        if (Math.abs(p.vx) > PLAYER.speed) p.vx = lerp(p.vx, Math.sign(p.vx) * PLAYER.speed, clamp(dt * 4, 0, 1));
        p.facing = ax > 0 ? 1 : -1;
      } else if (p.grounded) {
        p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), PLAYER.frictionGround * dt);
      } else {
        p.vx *= Math.pow(0.985, dt * 60);
      }
      if (this.mouse.active && !this.isTouch) p.facing = Math.cos(p.aim) >= 0 ? 1 : -1;
    }

    p.iFrames = Math.max(0, p.iFrames - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.hurtFlash = Math.max(0, p.hurtFlash - dt * 4);
    p.recoil = Math.max(0, p.recoil - dt * 6);
    p.dropT = Math.max(0, p.dropT - dt);
    p.coyote -= dt;
    p.jumpBuf -= dt;

    const wasGrounded = p.grounded;
    if (down && p.grounded && p.jumpBuf > 0 && p.y < GROUND_Y - 1) {
      p.dropT = 0.22;
      p.jumpBuf = 0;
      p.y += 2;
    }
    this.moveBody(p as never, dt, p.dropT > 0);

    if (p.grounded) {
      p.coyote = PLAYER.coyote;
      p.jumps = PLAYER.maxJumps;
      if (!wasGrounded) {
        p.squash = 0.76;
        const power = clamp(Math.abs(p.vy) / 700, 0, 1);
        this.puff(p.x, p.y, 6 + power * 10, '#b3c7ff');
        if (power > 0.4) this.cam.shake(0.06 * power);
      }
    }
    p.squash = lerp(p.squash, 1, clamp(dt * 11, 0, 1));

    if (p.jumpBuf > 0 && (p.coyote > 0 || p.jumps > 0)) {
      p.jumpBuf = 0;
      p.vy = -PLAYER.jump;
      p.squash = 1.22;
      if (p.coyote > 0) {
        p.jumps = PLAYER.maxJumps - 1;
      }
      if (p.coyote <= 0) {
        p.jumps--;
        this.parts.burst(p.x, p.y - 6, 10, '#93c5fd', { kind: 'spark', spd: 190, max: 0.26, size: 2, drag: 0.9 });
        this.parts.spawn({ kind: 'ring', x: p.x, y: p.y - 8, max: 0.3, size: 16, color: '#7dd3fc' });
      } else {
        this.puff(p.x, p.y, 6, '#94a3b8');
      }
      p.coyote = 0;
      audio.sfx('jump', p.jumps === PLAYER.maxJumps - 1 ? 1 : 1.25);
    }

    // walk animation
    const sp = Math.abs(p.vx) / PLAYER.speed;
    p.phase += dt * (p.grounded ? 9 * Math.max(sp, 0.001) + 1.2 : 4);

    // fire
    p.fireCd -= dt;
    const firing = this.mouse.down || this.touch.fire || k.has('j') || k.has('f') || k.has('control');
    const spec = WEAPONS[p.weapon];
    if (firing && p.fireCd <= 0) {
      if (spec.auto || !this.firedOnce) this.fire();
      this.firedOnce = true;
    }
    if (!firing) this.firedOnce = false;

    // scarf: distance-constrained chain so it always trails tightly
    let px = p.x - p.facing * 3;
    let py = p.y - 44 * p.squash;
    const SEG = 5.4;
    const damp = Math.pow(0.9, dt * 60);
    for (const s of p.scarf) {
      s.vy += 520 * dt;
      s.vx -= p.vx * 1.1 * dt;
      s.vx += Math.sin(this.time * 7 + s.y * 0.2) * 40 * dt;
      s.vx *= damp;
      s.vy *= damp;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const dx = s.x - px;
      const dy = s.y - py;
      const d = Math.hypot(dx, dy) || 0.0001;
      if (d > SEG) {
        const k = (d - SEG) / d;
        s.x -= dx * k;
        s.y -= dy * k;
        s.vx -= dx * k * 18;
        s.vy -= dy * k * 18;
      }
      px = s.x;
      py = s.y;
    }

    if (p.hp <= 0) this.killPlayer();
  }

  private firedOnce = false;
  private ghostCd = 0;

  /* ------------------------------------------------- public touch bridge */

  setStick(x: number, y: number, active: boolean) {
    this.isTouch = true;
    this.touch.mx = active ? x : 0;
    this.touch.my = active ? y : 0;
    this.touch.active = active;
  }
  setFire(v: boolean) {
    this.isTouch = true;
    this.touch.fire = v;
  }
  touchJump() {
    this.isTouch = true;
    if (this.state === 'playing') this.p.jumpBuf = PLAYER.jumpBuffer;
  }
  touchDash() {
    this.isTouch = true;
    this.tryDash();
  }

  tryDash() {
    const p = this.p;
    if (p.dash > 0 || p.dashCd > 0 || this.state !== 'playing') return;
    let dir = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dir -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dir += 1;
    if (this.touch.active && Math.abs(this.touch.mx) > 0.25) dir = Math.sign(this.touch.mx);
    if (dir === 0) dir = p.facing;
    p.dashDir = dir;
    p.facing = dir;
    p.dash = PLAYER.dashTime;
    p.dashCd = PLAYER.dashCooldown;
    p.iFrames = Math.max(p.iFrames, PLAYER.dashIFrames);
    p.dashTag++;
    p.vy = 0;
    this.cam.shake(0.12);
    this.parts.spawn({ kind: 'ring', x: p.x, y: p.y - 22, max: 0.35, size: 34, color: '#67e8f9' });
    this.parts.burst(p.x, p.y - 22, 14, '#a5f3fc', { kind: 'spark', spd: 320, max: 0.3, size: 2.4, dir: dir > 0 ? Math.PI : 0, cone: 1.6 });
    this.texts.add(p.x, p.y - 58, 'DASH', '#67e8f9', 13, -40);
    audio.sfx('dash');
  }

  private dashHits() {
    const p = this.p;
    for (const a of this.aliens) {
      if (!a.alive || a.spawnT > 0) continue;
      if (a.dashTag === p.dashTag) continue;
      if (Math.abs(a.x - p.x) < a.hw + 18 && Math.abs(a.y - a.h * 0.5 - (p.y - 30)) < a.h * 0.5 + 32) {
        a.dashTag = p.dashTag;
        this.damageAlien(a, PLAYER.dashDamage, p.dashDir, -120, true);
        this.hitStop = Math.max(this.hitStop, 0.05);
        this.cam.shake(0.22);
        this.flash = Math.max(this.flash, 0.3);
        this.flashColor = '103,232,249';
        this.parts.burst(a.x, a.y - a.h * 0.5, 16, '#67e8f9', { kind: 'spark', spd: 420, max: 0.3, size: 2.6 });
      }
    }
  }

  private selectWeapon(w: WeaponId) {
    if (!w) return;
    const p = this.p;
    if (p.ammo[w] === 0) {
      audio.sfx('empty');
      return;
    }
    if (p.weapon === w) return;
    p.weapon = w;
    p.fireCd = Math.max(p.fireCd, 0.1);
    audio.sfx('ui');
    this.showToast(WEAPONS[w].name);
  }
  cycleWeapon(dir: number) {
    const owned = WEAPON_ORDER.filter((w) => this.p.ammo[w] !== 0);
    if (owned.length < 2) return;
    const i = owned.indexOf(this.p.weapon);
    this.selectWeapon(owned[(i + dir + owned.length) % owned.length]);
  }

  private fire() {
    const p = this.p;
    const spec = WEAPONS[p.weapon];
    if (p.ammo[p.weapon] === 0) {
      this.selectWeapon('blaster');
      return;
    }
    p.fireCd = spec.rof;
    if (p.ammo[p.weapon] > 0) {
      p.ammo[p.weapon]--;
      if (p.ammo[p.weapon] === 0) {
        this.showToast(`${spec.name} EMPTY`);
        window.setTimeout(() => this.selectWeapon('blaster'), 120);
      }
    }
    this.shots += spec.pellets;
    const mx = p.x + Math.cos(p.aim) * 34;
    const my = p.y - 36 + Math.sin(p.aim) * 34;
    p.recoil = 1;

    // muzzle flash
    this.parts.spawn({ kind: 'ring', x: mx, y: my, max: 0.14, size: 14, color: spec.glow });
    this.parts.burst(mx, my, spec.pellets > 1 ? 14 : 7, spec.color, {
      kind: 'spark',
      spd: 380,
      max: 0.16,
      size: 2.2,
      dir: p.aim,
      cone: 0.9,
      drag: 0.85,
    });
    this.parts.spawn({
      kind: 'shard',
      x: mx,
      y: my,
      vx: -Math.cos(p.aim) * 90 + rand(-30, 30),
      vy: -160,
      grav: 900,
      max: 0.9,
      size: 3,
      color: '#fcd34d',
      spin: rand(-14, 14),
      bounce: true,
      add: false,
      drag: 0.99,
    });

    if (spec.hitscan) {
      this.railShot(mx, my, p.aim, spec.dmg);
    } else {
      for (let i = 0; i < spec.pellets; i++) {
        const a = p.aim + rand(-spec.spread, spec.spread);
        const sp = spec.speed * rand(0.92, 1.08);
        this.spawnBullet(mx, my, Math.cos(a) * sp, Math.sin(a) * sp, spec.dmg, false, spec.color, spec.glow, spec.radius, spec.len, spec.pierce, spec.knock);
      }
    }
    p.vx -= Math.cos(p.aim) * spec.recoil;
    if (!p.grounded) p.vy -= Math.sin(p.aim) * spec.recoil * 0.5;
    this.cam.shake(spec.shake);
    audio.sfx(spec.id, rand(0.95, 1.06));
  }

  private railShot(x: number, y: number, aim: number, dmg: number) {
    const ex = x + Math.cos(aim) * 1400;
    const ey = y + Math.sin(aim) * 1400;
    this.parts.spawn({ kind: 'beam', x, y, x2: ex, y2: ey, max: 0.3, size: 16, color: '#f5d0fe' });
    this.parts.spawn({ kind: 'beam', x, y, x2: ex, y2: ey, max: 0.45, size: 6, color: '#ffffff' });
    for (let i = 0; i < 26; i++) {
      const t = Math.random();
      this.parts.spawn({
        kind: 'spark',
        x: lerp(x, ex, t),
        y: lerp(y, ey, t),
        vx: rand(-120, 120),
        vy: rand(-160, 160),
        max: rand(0.2, 0.6),
        size: 2,
        color: '#e9d5ff',
        drag: 0.9,
      });
    }
    for (const a of this.aliens) {
      if (!a.alive || a.spawnT > 0) continue;
      const cy = a.y - a.h * 0.5;
      const d = pointSegDist(a.x, cy, x, y, ex, ey);
      if (d < a.hw + 10) {
        this.hits++;
        this.damageAlien(a, dmg, Math.cos(aim), Math.sin(aim) * 200, true);
      }
    }
    this.flash = Math.max(this.flash, 0.5);
    this.flashColor = '233,213,255';
  }

  private spawnBullet(
    x: number,
    y: number,
    vx: number,
    vy: number,
    dmg: number,
    foe: boolean,
    color: string,
    glow: string,
    r: number,
    len: number,
    pierce: number,
    knock: number,
    grav = 0,
  ) {
    for (const b of this.bullets) {
      if (b.active) continue;
      b.active = true;
      b.x = x;
      b.y = y;
      b.vx = vx;
      b.vy = vy;
      b.dmg = dmg;
      b.foe = foe;
      b.color = color;
      b.glow = glow;
      b.r = r;
      b.len = len;
      b.pierce = pierce;
      b.knock = knock;
      b.grav = grav;
      b.life = 2.2;
      b.hitIds.length = 0;
      return;
    }
  }

  private updateBullets(dt: number) {
    const p = this.p;
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.vy += b.grav * dt;
      const steps = Math.hypot(b.vx, b.vy) * dt > 24 ? 3 : 1;
      let dead = b.life <= 0;
      for (let s = 0; s < steps && !dead; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (b.x < -40 || b.x > WORLD.w + 40 || b.y > WORLD.h + 40 || b.y < -200) dead = true;
        if (!b.foe) {
          for (const a of this.aliens) {
            if (!a.alive || a.spawnT > 0 || b.hitIds.includes(a.id)) continue;
            if (Math.abs(b.x - a.x) < a.hw + b.r && b.y > a.y - a.h - b.r && b.y < a.y + b.r) {
              this.hits++;
              b.hitIds.push(a.id);
              this.damageAlien(a, b.dmg, Math.sign(b.vx) || 1, b.vy * 0.15, false, b.knock);
              this.parts.burst(b.x, b.y, 7, b.color, { kind: 'spark', spd: 260, max: 0.22, size: 2, dir: Math.atan2(-b.vy, -b.vx), cone: 1.9 });
              if (b.pierce > 0) b.pierce--;
              else dead = true;
              break;
            }
          }
        } else if (p.iFrames <= 0 && this.state === 'playing') {
          if (Math.abs(b.x - p.x) < 14 + b.r && b.y > p.y - 58 - b.r && b.y < p.y + b.r) {
            this.hurtPlayer(b.dmg, Math.sign(b.vx) || 1);
            dead = true;
          }
        }
      }
      if (dead) {
        b.active = false;
        this.parts.burst(b.x, b.y, 4, b.glow, { kind: 'spark', spd: 110, max: 0.2, size: 1.8 });
      }
    }
  }

  /* -------------------------------------------------------------- aliens */

  private nearestAlien(x: number, y: number, maxD: number): Alien | null {
    let best: Alien | null = null;
    let bd = maxD * maxD;
    for (const a of this.aliens) {
      if (!a.alive || a.spawnT > 0.15) continue;
      const d = (a.x - x) * (a.x - x) + (a.y - a.h * 0.5 - y) * (a.y - a.h * 0.5 - y) * 0.75;
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    return best;
  }

  private spawnAlien(kind: AlienKind, x: number) {
    const spec = ALIENS[kind];
    const scaleHp = 1 + (this.wave - 1) * 0.1;
    const h = ALIEN_BASE_H * spec.scale;
    const a: Alien = {
      id: this.nextId++,
      kind,
      spec,
      x,
      y: -20,
      vx: 0,
      vy: 0,
      hp: spec.hp * scaleHp,
      maxHp: spec.hp * scaleHp,
      h,
      hw: 12.5 * spec.scale,
      grounded: false,
      facing: x > WORLD.w / 2 ? -1 : 1,
      phase: rand(0, 7),
      flash: 0,
      spawnT: 0.55,
      attackCd: rand(0.4, 1.4),
      touchCd: 0,
      hopCd: rand(0.4, 2),
      stun: 0,
      dashTag: -1,
      alive: true,
      boss: kind === 'overmind',
      summonCd: 6,
    };
    this.aliens.push(a);
    if (a.boss) this.boss = a;
    audio.sfx('spawn', rand(0.8, 1.2));
    this.parts.spawn({ kind: 'ring', x, y: 30, max: 0.5, size: 40, color: spec.glow });
  }

  private updateAliens(dt: number) {
    const p = this.p;
    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      if (!a.alive) {
        this.aliens.splice(i, 1);
        if (this.boss === a) this.boss = null;
        continue;
      }
      a.flash = Math.max(0, a.flash - dt * 9);
      a.touchCd = Math.max(0, a.touchCd - dt);
      a.stun = Math.max(0, a.stun - dt);

      if (a.spawnT > 0) {
        a.spawnT -= dt;
        // beam-in telegraph
        this.parts.spawn({
          kind: 'spark',
          x: a.x + rand(-14, 14),
          y: rand(0, GROUND_Y),
          vx: 0,
          vy: 620,
          max: 0.25,
          size: 2,
          color: a.spec.glow,
        });
        if (a.spawnT <= 0) {
          a.y = 0;
          a.vy = 220;
          this.parts.spawn({ kind: 'beam', x: a.x, y: 0, x2: a.x, y2: GROUND_Y, max: 0.4, size: 26, color: a.spec.glow });
        }
        continue;
      }

      const dx = p.x - a.x;
      const dy = p.y - a.y;
      const adist = Math.abs(dx);
      if (a.stun <= 0 && this.state === 'playing') {
        a.facing = dx > 0 ? 1 : -1;
        const spd = a.spec.speed * (1 + (this.wave - 1) * 0.02);
        if (a.spec.ranged) {
          const want = a.boss ? 230 : 280;
          const dir = adist > want + 50 ? Math.sign(dx) : adist < want - 50 ? -Math.sign(dx) : 0;
          a.vx = lerp(a.vx, dir * spd, clamp(dt * 6, 0, 1));
          a.attackCd -= dt;
          if (a.attackCd <= 0 && adist < 640) {
            a.attackCd = a.spec.fireRate * rand(0.8, 1.2);
            this.alienShoot(a);
          }
        } else {
          a.vx = lerp(a.vx, Math.sign(dx) * spd, clamp(dt * 5, 0, 1));
        }
        // jumping
        a.hopCd -= dt;
        if (a.grounded && a.hopCd <= 0) {
          a.hopCd = rand(0.5, 2.2) / Math.max(0.2, a.spec.jumpy);
          const wantUp = dy < -40 || (Math.random() < 0.3 && adist < 240);
          if (wantUp || a.spec.jumpy > 1) {
            a.vy = -rand(460, 620);
            a.grounded = false;
          }
        }
        if (a.boss) {
          a.summonCd -= dt;
          if (a.summonCd <= 0) {
            a.summonCd = rand(6, 9);
            for (let s = 0; s < 2; s++) this.spawnAlien('grunt', clamp(a.x + rand(-160, 160), 40, WORLD.w - 40));
            this.showToast('OVERMIND SUMMONS');
          }
        }
      } else {
        a.vx *= Math.pow(0.9, dt * 60);
      }

      this.moveBody(a, dt, p.y > a.y + 10);
      a.phase += dt * (a.grounded ? 7 * clamp(Math.abs(a.vx) / 100, 0.2, 2) : 3);

      // touch damage
      if (
        this.state === 'playing' &&
        a.touchCd <= 0 &&
        Math.abs(a.x - p.x) < a.hw + 14 &&
        Math.abs(a.y - a.h * 0.5 - (p.y - 30)) < a.h * 0.5 + 30
      ) {
        a.touchCd = 0.75;
        this.hurtPlayer(a.spec.touchDmg, Math.sign(p.x - a.x) || 1);
        a.vx = -Math.sign(p.x - a.x) * 180;
      }
    }
  }

  private alienShoot(a: Alien) {
    const p = this.p;
    const sx = a.x + a.facing * 16;
    const sy = a.y - a.h * 0.62;
    const tx = p.x;
    const ty = p.y - 32;
    const n = a.boss ? 3 : 1;
    const base = Math.atan2(ty - sy, tx - sx);
    for (let i = 0; i < n; i++) {
      const ang = base + (i - (n - 1) / 2) * 0.22 + rand(-0.04, 0.04);
      const sp = a.boss ? 520 : 440;
      this.spawnBullet(sx, sy, Math.cos(ang) * sp, Math.sin(ang) * sp - 40, a.boss ? 13 : 9, true, a.spec.color, a.spec.glow, 5, 12, 0, 0, 240);
    }
    this.parts.burst(sx, sy, 6, a.spec.glow, { kind: 'spark', spd: 180, max: 0.2, size: 2, dir: base, cone: 1 });
    audio.sfx('spit', a.boss ? 0.7 : 1.1);
  }

  private damageAlien(a: Alien, dmg: number, dirX: number, dirY: number, big: boolean, knock = 120) {
    if (!a.alive) return;
    a.hp -= dmg;
    a.flash = 1;
    a.stun = Math.max(a.stun, big ? 0.16 : 0.04);
    const massFactor = a.boss ? 0.12 : a.spec.scale > 1.2 ? 0.4 : 1;
    a.vx += dirX * knock * massFactor;
    if (dirY !== 0) a.vy += dirY * 0.3 * massFactor;
    const cy = a.y - a.h * 0.62;
    this.parts.burst(a.x, cy, big ? 10 : 5, a.spec.color, { kind: 'blob', spd: 180, max: 0.4, size: 3, grav: 700, drag: 0.92, add: false });
    this.texts.add(a.x + rand(-6, 6), cy - 8, `${Math.round(dmg)}`, big ? '#fff' : a.spec.color, big ? 19 : 14);
    audio.sfx('hit', rand(0.9, 1.3));
    this.cam.shake(big ? 0.1 : 0.035);
    if (a.hp <= 0) this.killAlien(a);
  }

  private killAlien(a: Alien) {
    a.alive = false;
    this.kills++;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTimer = 2.8;
    const mult = this.multiplier();
    const gain = Math.round(a.spec.score * mult);
    this.score += gain;
    const cy = a.y - a.h * 0.55;
    this.texts.add(a.x, cy - 14, `+${gain}`, '#fde68a', a.boss ? 30 : 18, -70);
    if (this.combo > 1) this.texts.add(a.x, cy - 36, `x${mult.toFixed(1)}`, '#67e8f9', 14, -46);

    this.ragdolls.push(
      new Ragdoll(a.x, a.y, a.h, a.vx * 0.6 + rand(-120, 120), -rand(140, 320), a.spec.color, a.spec.glow, a.facing),
    );
    if (this.ragdolls.length > 10) this.ragdolls.shift();

    this.parts.burst(a.x, cy, a.boss ? 90 : 22, a.spec.color, { kind: 'blob', spd: a.boss ? 520 : 300, max: 0.8, size: 4, grav: 900, drag: 0.93, add: false, bounce: true });
    this.parts.burst(a.x, cy, a.boss ? 50 : 16, '#ffffff', { kind: 'spark', spd: a.boss ? 620 : 380, max: 0.4, size: 2.4 });
    this.parts.spawn({ kind: 'ring', x: a.x, y: cy, max: 0.45, size: a.boss ? 110 : 44, color: a.spec.glow });
    this.parts.burst(a.x, cy, 8, '#64748b', { kind: 'smoke', spd: 70, max: 1.2, size: 14, add: false, grav: -40 });

    if (this.combo > 0 && this.combo % 5 === 0) {
      const words = ['NICE', 'RAMPAGE', 'SLAUGHTER', 'INK STORM', 'UNSTOPPABLE', 'GODLIKE'];
      const w = words[Math.min(words.length - 1, Math.floor(this.combo / 5) - 1)];
      this.banner = `${w}  x${mult.toFixed(1)}`;
      this.bannerT = 1.3;
      this.flash = Math.max(this.flash, 0.18);
      this.flashColor = '253,224,71';
      this.parts.burst(a.x, cy, 24, '#fde68a', { kind: 'star', spd: 320, max: 0.7, size: 4, grav: 300, drag: 0.93 });
    }

    this.cam.shake(a.boss ? 1 : a.spec.scale > 1.2 ? 0.4 : 0.2);
    this.hitStop = Math.max(this.hitStop, a.boss ? 0.3 : 0.045);
    audio.sfx(a.boss || a.spec.scale > 1.2 ? 'bigkill' : 'kill', rand(0.9, 1.1));
    if (a.boss) {
      this.flash = 1;
      this.flashColor = '255,94,196';
      this.slowmo(0.3, 1.3);
      this.banner = 'OVERMIND PURGED';
      this.bannerT = 2.4;
    }

    // drops
    const r = Math.random();
    if (this.p.hp < 65 && r < 0.26) this.dropPickup(a.x, cy, 'med');
    else if (r < 0.2 || a.boss || a.spec.scale > 1.2)
      this.dropPickup(a.x, cy, 'weapon', pick(['pulse', 'scatter', 'rail'] as WeaponId[]));
  }

  multiplier() {
    return Math.min(1 + this.combo * 0.12, 9.9);
  }

  private dropPickup(x: number, y: number, kind: 'weapon' | 'med', weapon?: WeaponId) {
    this.pickups.push({ kind, weapon, x, y, vy: -180, life: 16, t: 0 });
  }

  private updatePickups(dt: number) {
    const p = this.p;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      u.t += dt;
      u.life -= dt;
      u.vy += GRAVITY * 0.45 * dt;
      u.y += u.vy * dt;
      let floor = GROUND_Y - 14;
      for (const pf of PLATFORMS) if (u.x > pf.x && u.x < pf.x + pf.w && u.y <= pf.y - 10 && u.y + u.vy * dt >= pf.y - 14) floor = pf.y - 14;
      if (u.y > floor) {
        u.y = floor;
        u.vy = -Math.abs(u.vy) * 0.34;
        if (Math.abs(u.vy) < 30) u.vy = 0;
      }
      if (u.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (Math.abs(u.x - p.x) < 30 && Math.abs(u.y - (p.y - 30)) < 42) {
        this.pickups.splice(i, 1);
        this.collect(u);
      }
    }
  }

  private collect(u: Pickup) {
    const p = this.p;
    audio.sfx('pickup');
    this.parts.burst(u.x, u.y, 18, u.kind === 'med' ? '#86efac' : '#fde68a', { kind: 'spark', spd: 240, max: 0.4, size: 2.2 });
    this.parts.spawn({ kind: 'ring', x: u.x, y: u.y, max: 0.4, size: 30, color: '#fff' });
    if (u.kind === 'med') {
      p.hp = Math.min(PLAYER.hp, p.hp + 30);
      this.texts.add(u.x, u.y - 10, '+30 HP', '#86efac', 17, -60);
      this.showToast('BIO-PATCH');
    } else if (u.weapon) {
      const spec = WEAPONS[u.weapon];
      p.ammo[u.weapon] = spec.maxAmmo;
      p.weapon = u.weapon;
      this.texts.add(u.x, u.y - 10, spec.name, '#fde68a', 16, -60);
      this.showToast(`${spec.name}  ${spec.maxAmmo} RNDS`);
    }
  }

  /* --------------------------------------------------------------- waves */

  private nextWave() {
    this.wave++;
    this.waveBreak = 0;
    const w = this.wave;
    const q: AlienKind[] = [];
    const count = Math.min(5 + Math.floor(w * 1.7), 26);
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      if (w >= 5 && r < 0.12) q.push('brute');
      else if (w >= 3 && r < 0.36) q.push('spitter');
      else if (w >= 2 && r < 0.62) q.push('hopper');
      else q.push('grunt');
    }
    if (w % 5 === 0) q.unshift('overmind');
    this.queue = q;
    this.spawnCd = 0.35;
    this.banner = w % 5 === 0 ? `WAVE ${w} — OVERMIND` : `WAVE ${w}`;
    this.bannerT = 2.2;
    audio.sfx('wave');
    this.flash = Math.max(this.flash, 0.25);
    this.flashColor = '148,233,255';
  }

  private updateWaves(dt: number) {
    const cap = Math.min(5 + Math.floor(this.wave * 0.8), 13);
    if (this.queue.length > 0) {
      this.spawnCd -= dt;
      if (this.spawnCd <= 0 && this.aliens.length < cap) {
        const kind = this.queue.shift()!;
        const x = rand(70, WORLD.w - 70);
        this.spawnAlien(kind, x);
        this.spawnCd = rand(0.42, 0.95) / (1 + this.wave * 0.035);
      }
    } else if (this.aliens.length === 0) {
      if (this.waveBreak === 0) {
        const bonus = this.wave * 250;
        this.score += bonus;
        this.banner = `WAVE ${this.wave} CLEAR  +${bonus}`;
        this.bannerT = 2.2;
        this.texts.add(this.p.x, this.p.y - 70, `WAVE BONUS +${bonus}`, '#fde68a', 22, -60);
        this.parts.burst(this.p.x, this.p.y - 24, 40, '#fde68a', { kind: 'star', spd: 300, max: 0.9, size: 4, grav: 400, drag: 0.94 });
        audio.sfx('wave');
        if (this.p.hp < PLAYER.hp) {
          this.p.hp = Math.min(PLAYER.hp, this.p.hp + 15);
          this.texts.add(this.p.x, this.p.y - 100, '+15 HP', '#86efac', 16, -50);
        }
      }
      this.waveBreak += dt;
      if (this.waveBreak >= WAVE_BREAK) this.nextWave();
    }
  }

  /* --------------------------------------------------------------- hurt */

  private hurtPlayer(dmg: number, dirX: number) {
    const p = this.p;
    if (p.iFrames > 0 || this.state !== 'playing') return;
    p.hp -= dmg;
    p.iFrames = PLAYER.hurtInvuln;
    p.hurtFlash = 1;
    p.vx += dirX * 240;
    p.vy = Math.min(p.vy, -200);
    this.combo = 0;
    this.comboTimer = 0;
    this.danger = 1;
    this.flash = Math.max(this.flash, 0.45);
    this.flashColor = '255,60,80';
    this.cam.shake(0.45);
    this.hitStop = Math.max(this.hitStop, 0.07);
    this.parts.burst(p.x, p.y - 36, 20, '#ff5470', { kind: 'blob', spd: 280, max: 0.6, size: 4, grav: 800, add: false, bounce: true });
    this.texts.add(p.x, p.y - 56, `-${dmg}`, '#ff6b81', 18, -60);
    audio.sfx('hurt');
    if (p.hp <= 0) this.killPlayer();
  }

  private killPlayer() {
    if (this.state !== 'playing') return;
    const p = this.p;
    p.hp = 0;
    this.state = 'dying';
    this.deathTimer = 1.1;
    this.slowmo(0.3, 1.0);
    this.cam.shake(1);
    this.flash = 1;
    this.flashColor = '255,40,60';
    this.ragdolls.push(new Ragdoll(p.x, p.y, PLAYER.height, p.vx * 0.5, -360, '#e2f6ff', '#38bdf8', p.facing));
    this.parts.burst(p.x, p.y - 36, 46, '#ff4d6d', { kind: 'blob', spd: 420, max: 1, size: 5, grav: 900, add: false, bounce: true });
    this.parts.spawn({ kind: 'ring', x: p.x, y: p.y - 36, max: 0.7, size: 120, color: '#ff4d6d' });
    audio.sfx('over');
  }

  slowmo(scale: number, dur: number) {
    this.targetScale = scale;
    this.timeScale = scale;
    window.setTimeout(() => {
      this.targetScale = 1;
    }, dur * 1000);
  }

  showToast(msg: string) {
    this.toast = msg;
    this.toastT = 1.9;
  }

  private puff(x: number, y: number, n: number, color: string) {
    this.parts.burst(x, y - 2, n, color, { kind: 'smoke', spd: 120, max: 0.5, size: 7, add: false, cone: Math.PI, dir: -Math.PI / 2, drag: 0.86 });
  }

  /* -------------------------------------------------------------- render */

  private render() {
    const ctx = this.ctx;
    const v = this.view;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#05040c';
    ctx.fillRect(0, 0, v.w, v.h);

    ctx.save();
    ctx.translate(v.ox, v.oy);
    ctx.scale(v.scale, v.scale);
    ctx.beginPath();
    ctx.rect(0, 0, WORLD.w, WORLD.h);
    ctx.clip();

    ctx.save();
    ctx.translate(WORLD.w / 2 + this.cam.x, WORLD.h / 2 + this.cam.y);
    ctx.rotate(this.cam.rot);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-WORLD.w / 2, -WORLD.h / 2);

    drawArena(ctx, this.time);

    // spawn beams
    for (const a of this.aliens) {
      if (a.spawnT > 0) {
        const t = 1 - a.spawnT / 0.55;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(a.x, 0, a.x, GROUND_Y);
        g.addColorStop(0, `rgba(255,255,255,${0.22 * t})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        const w = 26 * a.spec.scale * (0.5 + t);
        ctx.fillRect(a.x - w / 2, 0, w, GROUND_Y);
        ctx.strokeStyle = a.spec.glow;
        ctx.globalAlpha = 0.6 + Math.sin(this.time * 40) * 0.3;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(a.x, GROUND_Y - 2, w * 0.7, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const r of this.ragdolls) r.draw(ctx);
    this.drawPickups(ctx);

    // aliens
    for (const a of this.aliens) {
      if (a.spawnT > 0) continue;
      drawStickman(ctx, {
        x: a.x,
        y: a.y,
        h: a.h,
        facing: a.facing,
        phase: a.phase,
        run: clamp(Math.abs(a.vx) / 90, 0.15, 1.2),
        grounded: a.grounded,
        vy: a.vy,
        aim: 0,
        armed: false,
        color: a.spec.color,
        glow: a.spec.glow,
        flash: a.flash > 0.35 ? 1 : 0,
        squash: 1,
        alpha: 1,
        antenna: true,
        eye: a.spec.glow,
        bigEye: a.boss || a.kind === 'brute',
      });
      if (a.boss || a.hp < a.maxHp) this.drawHpBar(ctx, a);
    }

    // dash ghosts
    for (const g of this.ghosts) {
      ctx.globalAlpha = g.life * 0.32;
      drawStickman(ctx, {
        x: g.x,
        y: g.y,
        h: PLAYER.height,
        facing: g.facing,
        phase: g.phase,
        run: 1,
        grounded: false,
        vy: 0,
        aim: g.aim,
        armed: true,
        weapon: this.p.weapon,
        color: '#67e8f9',
        glow: '#22d3ee',
        flash: 0,
        squash: 1,
        alpha: g.life * 0.4,
        antenna: false,
        eye: '#22d3ee',
      });
      ctx.globalAlpha = 1;
    }

    // player
    if (this.state !== 'dying' && this.state !== 'dead') this.drawPlayer(ctx);

    this.drawBullets(ctx);
    this.parts.draw(ctx);
    this.texts.draw(ctx);

    drawVignette(ctx, Math.max(this.danger, this.p.hp < 30 && this.state === 'playing' ? 0.3 + Math.sin(this.time * 6) * 0.12 : 0));

    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.55})`;
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    }
    ctx.restore();

    if (this.state !== 'menu') drawHud(ctx, this);
    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.p;
    const blink = p.iFrames > 0 && Math.floor(this.time * 30) % 2 === 0;
    const dashing = p.dash > 0;
    if (dashing) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y - 30, 2, p.x, p.y - 30, 60);
      g.addColorStop(0, 'rgba(103,232,249,0.4)');
      g.addColorStop(1, 'rgba(103,232,249,0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.x - 60, p.y - 84, 120, 120);
      ctx.restore();
    }
    const recoilOffset = p.recoil * 3;
    drawStickman(ctx, {
      x: p.x - Math.cos(p.aim) * recoilOffset,
      y: p.y,
      h: PLAYER.height,
      facing: p.facing,
      phase: p.phase,
      run: clamp(Math.abs(p.vx) / PLAYER.speed, 0.08, 1.1),
      grounded: p.grounded,
      vy: p.vy,
      aim: p.aim,
      armed: true,
      weapon: p.weapon,
      color: dashing ? '#a5f3fc' : p.hurtFlash > 0.3 ? '#ffffff' : '#e8f7ff',
      glow: dashing ? '#22d3ee' : '#38bdf8',
      flash: p.hurtFlash > 0.4 ? 1 : 0,
      squash: p.squash,
      alpha: blink ? 0.45 : 1,
      antenna: false,
      eye: '#38bdf8',
      scarf: p.scarf,
      charge: p.weapon === 'rail' ? clamp(1 - p.fireCd / WEAPONS.rail.rof, 0, 1) : 0,
    });
  }

  private drawHpBar(ctx: CanvasRenderingContext2D, a: Alien) {
    const w = a.boss ? 120 : 26 * a.spec.scale;
    const x = a.x - w / 2;
    const y = a.y - a.h - 13;
    ctx.save();
    ctx.globalAlpha = a.boss ? 1 : 0.8;
    ctx.fillStyle = 'rgba(2,6,23,0.7)';
    ctx.fillRect(x - 1, y - 1, w + 2, 4);
    ctx.fillStyle = a.spec.glow;
    ctx.fillRect(x, y, w * clamp(a.hp / a.maxHp, 0, 1), 2);
    ctx.restore();
  }

  private drawBullets(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of this.bullets) {
      if (!b.active) continue;
      const a = Math.atan2(b.vy, b.vx);
      const ex = b.x - Math.cos(a) * b.len;
      const ey = b.y - Math.sin(a) * b.len;
      ctx.strokeStyle = b.glow;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = b.r * 2.8;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.r;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPickups(ctx: CanvasRenderingContext2D) {
    for (const u of this.pickups) {
      const bob = Math.sin(u.t * 4) * 3;
      const fade = u.life < 4 && Math.floor(u.life * 8) % 2 === 0 ? 0.35 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(u.x, u.y + bob);
      ctx.globalCompositeOperation = 'lighter';
      const col = u.kind === 'med' ? '#4ade80' : WEAPONS[u.weapon ?? 'pulse'].glow;
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 26);
      g.addColorStop(0, col + 'cc');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-26, -26, 52, 52);
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(Math.sin(u.t * 2) * 0.16);
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 3;
      ctx.fillStyle = col;
      if (u.kind === 'med') {
        ctx.beginPath();
        ctx.roundRect(-9, -9, 18, 18, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#022c22';
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillRect(-2, -6, 4, 12);
      } else {
        ctx.beginPath();
        ctx.roundRect(-17, -8, 34, 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#020617';
        ctx.font = '900 9px "Arial Black", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(WEAPONS[u.weapon ?? 'pulse'].tag, 0, 3);
      }
      ctx.restore();
    }
  }
}

function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export { randInt };
