import { GROUND_Y, PLATFORMS, WORLD, clamp, rand } from './core';

/* ----------------------------------------------------------- particles */

export type PKind = 'spark' | 'blob' | 'smoke' | 'ring' | 'shard' | 'star' | 'beam';

export interface Particle {
  active: boolean;
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  drag: number;
  rot: number;
  spin: number;
  bounce: boolean;
  add: boolean;
  x2: number;
  y2: number;
}

const MAX_PARTICLES = 1100;

export class Particles {
  pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        active: false,
        kind: 'spark',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        max: 1,
        size: 2,
        color: '#fff',
        grav: 0,
        drag: 0.98,
        rot: 0,
        spin: 0,
        bounce: false,
        add: true,
        x2: 0,
        y2: 0,
      });
    }
  }

  private obtain(): Particle {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      if (!p.active) return p;
    }
    return this.pool[0];
  }

  spawn(o: Partial<Particle>): Particle {
    const p = this.obtain();
    p.active = true;
    p.kind = o.kind ?? 'spark';
    p.x = o.x ?? 0;
    p.y = o.y ?? 0;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.max = o.max ?? 0.5;
    p.life = p.max;
    p.size = o.size ?? 2;
    p.color = o.color ?? '#fff';
    p.grav = o.grav ?? 0;
    p.drag = o.drag ?? 0.98;
    p.rot = o.rot ?? 0;
    p.spin = o.spin ?? 0;
    p.bounce = o.bounce ?? false;
    p.add = o.add ?? true;
    p.x2 = o.x2 ?? p.x;
    p.y2 = o.y2 ?? p.y;
    return p;
  }

  burst(x: number, y: number, n: number, color: string, opts: Partial<Particle> & { spd?: number; cone?: number; dir?: number } = {}) {
    const spd = opts.spd ?? 240;
    const cone = opts.cone ?? Math.PI * 2;
    const dir = opts.dir ?? 0;
    for (let i = 0; i < n; i++) {
      const a = dir + rand(-cone / 2, cone / 2);
      const s = spd * rand(0.3, 1.2);
      this.spawn({
        ...opts,
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
      });
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.grav * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.bounce && p.y > GROUND_Y) {
        p.y = GROUND_Y;
        p.vy *= -0.38;
        p.vx *= 0.7;
        if (Math.abs(p.vy) < 24) p.vy = 0;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      const t = p.life / p.max;
      ctx.globalAlpha = clamp(t * 1.4, 0, 1);
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.kind) {
        case 'spark': {
          const len = clamp(Math.hypot(p.vx, p.vy) * 0.022, 2, 20);
          const a = Math.atan2(p.vy, p.vx);
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - Math.cos(a) * len, p.y - Math.sin(a) * len);
          ctx.stroke();
          break;
        }
        case 'blob': {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.8), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'smoke': {
          ctx.globalAlpha = t * 0.28;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.6 - t), 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'ring': {
          ctx.lineWidth = Math.max(1, p.size * t * 0.5);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - t) * 2.4 + 4, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'shard': {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-p.size, 0);
          ctx.lineTo(p.size, 0);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'star': {
          const s = p.size * (0.5 + t);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y);
          ctx.lineTo(p.x + s, p.y);
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x, p.y + s);
          ctx.stroke();
          break;
        }
        case 'beam': {
          ctx.lineWidth = p.size * t;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x2, p.y2);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.restore();
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }
}

/* -------------------------------------------------------- floating text */

export interface FText {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

export class TextFx {
  items: FText[] = [];
  add(x: number, y: number, text: string, color = '#fff', size = 16, vy = -58) {
    if (this.items.length > 60) this.items.shift();
    this.items.push({ x, y, vy, life: 0.85, max: 0.85, text, color, size });
  }
  update(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.94;
      if (f.life <= 0) this.items.splice(i, 1);
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of this.items) {
      const t = f.life / f.max;
      ctx.globalAlpha = clamp(t * 1.6, 0, 1);
      const scale = 1 + (1 - t) * 0.25;
      ctx.font = `900 ${f.size * scale}px "Arial Black", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(2,6,23,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
  clear() {
    this.items.length = 0;
  }
}

/* --------------------------------------------------------------- camera */

export class Camera {
  trauma = 0;
  x = 0;
  y = 0;
  rot = 0;
  zoom = 1;
  scale = 1;
  private seed = Math.random() * 1000;

  shake(amount: number) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  update(dt: number, mult: number) {
    this.trauma = Math.max(0, this.trauma - dt * 1.55);
    const s = this.trauma * this.trauma * mult;
    this.seed += dt * 34;
    this.x = Math.sin(this.seed * 1.7) * 26 * s + Math.sin(this.seed * 4.3) * 10 * s;
    this.y = Math.cos(this.seed * 2.1) * 22 * s + Math.cos(this.seed * 5.1) * 8 * s;
    this.rot = Math.sin(this.seed * 1.3) * 0.022 * s;
    this.zoom = 1 + s * 0.035;
  }

  reset() {
    this.trauma = 0;
    this.x = this.y = this.rot = 0;
    this.zoom = 1;
  }
}

/* -------------------------------------------------------------- ragdoll */

interface Pt {
  x: number;
  y: number;
  px: number;
  py: number;
  pin?: boolean;
}
interface Stick {
  a: number;
  b: number;
  len: number;
  stiff: number;
}

const HEAD = 0;
const CHEST = 1;
const PELVIS = 2;

export class Ragdoll {
  pts: Pt[] = [];
  sticks: Stick[] = [];
  life = 4.5;
  color: string;
  glow: string;
  h: number;
  dead = false;

  constructor(x: number, y: number, h: number, vx: number, vy: number, color: string, glow: string, facing: number) {
    this.color = color;
    this.glow = glow;
    this.h = h;
    const u = h / 46;
    const mk = (dx: number, dy: number) => {
      const jitter = rand(-1, 1);
      this.pts.push({ x: x + dx, y: y + dy, px: x + dx - (vx + jitter * 30) * 0.016, py: y + dy - (vy + rand(-60, 20)) * 0.016 });
    };
    // 0 head, 1 chest, 2 pelvis, 3 elbowL, 4 handL, 5 elbowR, 6 handR, 7 kneeL, 8 footL, 9 kneeR, 10 footR
    mk(0, -42 * u);
    mk(0, -30 * u);
    mk(0, -14 * u);
    mk(-9 * u * facing, -24 * u);
    mk(-15 * u * facing, -16 * u);
    mk(9 * u * facing, -24 * u);
    mk(15 * u * facing, -16 * u);
    mk(-6 * u, -5 * u);
    mk(-8 * u, 2 * u);
    mk(6 * u, -5 * u);
    mk(8 * u, 2 * u);
    const link = (a: number, b: number, stiff = 1) => {
      const dx = this.pts[a].x - this.pts[b].x;
      const dy = this.pts[a].y - this.pts[b].y;
      this.sticks.push({ a, b, len: Math.hypot(dx, dy), stiff });
    };
    link(HEAD, CHEST);
    link(CHEST, PELVIS);
    link(CHEST, 3, 0.8);
    link(3, 4, 0.8);
    link(CHEST, 5, 0.8);
    link(5, 6, 0.8);
    link(PELVIS, 7, 0.9);
    link(7, 8, 0.9);
    link(PELVIS, 9, 0.9);
    link(9, 10, 0.9);
    link(HEAD, PELVIS, 0.35);
    link(3, 5, 0.2);
    link(7, 9, 0.2);
  }

  update(dt: number) {
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    const g = 1900;
    for (const p of this.pts) {
      if (p.pin) continue;
      const vx = (p.x - p.px) * 0.985;
      const vy = (p.y - p.py) * 0.985;
      p.px = p.x;
      p.py = p.y;
      p.x += clamp(vx, -40, 40);
      p.y += clamp(vy, -40, 40) + g * dt * dt;
    }
    for (let k = 0; k < 4; k++) {
      for (const s of this.sticks) {
        const a = this.pts[s.a];
        const b = this.pts[s.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const diff = ((d - s.len) / d) * 0.5 * s.stiff;
        const ox = dx * diff;
        const oy = dy * diff;
        a.x += ox;
        a.y += oy;
        b.x -= ox;
        b.y -= oy;
      }
      for (const p of this.pts) {
        if (p.x < 8) {
          p.x = 8;
          p.px = p.x + (p.px - p.x) * -0.4;
        }
        if (p.x > WORLD.w - 8) {
          p.x = WORLD.w - 8;
          p.px = p.x + (p.px - p.x) * -0.4;
        }
        const floors = [GROUND_Y];
        for (const pf of PLATFORMS) if (p.x > pf.x && p.x < pf.x + pf.w && p.py <= pf.y + 2) floors.push(pf.y);
        for (const fy of floors) {
          if (p.y > fy && p.py <= fy + 6) {
            p.y = fy;
            const vx = p.px - p.x;
            p.px = p.x + vx * 0.55;
            p.py = p.y + (p.py - p.y) * -0.3;
          }
        }
        if (p.y > GROUND_Y) {
          p.y = GROUND_Y;
          p.py = p.y + (p.py - p.y) * -0.3;
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const a = clamp(this.life / 1.6, 0, 1);
    const u = this.h / 46;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const chain: [number, number][] = [
      [HEAD, CHEST],
      [CHEST, PELVIS],
      [CHEST, 3],
      [3, 4],
      [CHEST, 5],
      [5, 6],
      [PELVIS, 7],
      [7, 8],
      [PELVIS, 9],
      [9, 10],
    ];
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? 'rgba(2,6,23,0.65)' : this.color;
      ctx.lineWidth = pass === 0 ? 8.5 * u : 4.6 * u;
      ctx.beginPath();
      for (const [i, j] of chain) {
        ctx.moveTo(this.pts[i].x, this.pts[i].y);
        ctx.lineTo(this.pts[j].x, this.pts[j].y);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this.pts[HEAD].x, this.pts[HEAD].y, (pass === 0 ? 8.6 : 7) * u, 0, Math.PI * 2);
      if (pass === 0) {
        ctx.fillStyle = 'rgba(2,6,23,0.65)';
        ctx.fill();
      } else {
        ctx.lineWidth = 4 * u;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
