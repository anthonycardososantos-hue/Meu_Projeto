import { GROUND_Y, PLATFORMS, WORLD, WeaponId, clamp } from './core';

/* ------------------------------------------------------------- stickman */

export interface StickPose {
  x: number;
  y: number; // feet
  h: number;
  facing: number;
  phase: number;
  run: number; // 0..1 how much walk cycle
  grounded: boolean;
  vy: number;
  aim: number;
  armed: boolean;
  weapon?: WeaponId | null;
  color: string;
  glow: string;
  flash: number;
  squash: number;
  alpha: number;
  antenna: boolean;
  eye: string;
  scarf?: { x: number; y: number }[];
  charge?: number;
  bigEye?: boolean;
}

function ik(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  l1: number,
  l2: number,
  bend: number,
): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  let d = Math.hypot(dx, dy);
  d = clamp(d, 0.01, l1 + l2 - 0.001);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = ax + (dx * a) / d;
  const my = ay + (dy * a) / d;
  return [mx + ((dy * h) / d) * bend, my - ((dx * h) / d) * bend];
}

export function drawStickman(ctx: CanvasRenderingContext2D, p: StickPose) {
  const u = p.h / 46;
  const sq = p.squash;
  const sy = (v: number) => p.y - (p.y - v) * sq;

  const hipY = sy(p.y - 20 * u);
  const chestY = sy(p.y - 33 * u);
  const headY = sy(p.y - 41.5 * u);
  const hipX = p.x + p.facing * 0.6 * u;
  const headR = 6.6 * u;

  const legU = 11 * u;
  const armU = 9.2 * u;

  // --- foot targets (walk cycle / air pose)
  const ph = p.phase;
  const amp = p.run;
  let f1x: number, f1y: number, f2x: number, f2y: number;
  if (p.grounded) {
    const stride = 13 * u * amp;
    const lift = 9 * u * amp;
    f1x = p.x + Math.cos(ph) * stride;
    f1y = p.y - Math.max(0, Math.sin(ph)) * lift;
    f2x = p.x + Math.cos(ph + Math.PI) * stride;
    f2y = p.y - Math.max(0, Math.sin(ph + Math.PI)) * lift;
  } else {
    const tuck = clamp(p.vy / 700, -1, 1);
    f1x = p.x + p.facing * 9 * u - tuck * 3 * u;
    f1y = p.y - (9 + tuck * 7) * u;
    f2x = p.x - p.facing * 7 * u;
    f2y = p.y - (3 - tuck * 4) * u;
  }

  const [k1x, k1y] = ik(hipX, hipY, f1x, f1y, legU, legU, p.facing);
  const [k2x, k2y] = ik(hipX, hipY, f2x, f2y, legU, legU, p.facing);

  // --- arms
  const shX = hipX;
  const shY = chestY + 1.5 * u;
  let h1x: number, h1y: number, h2x: number, h2y: number;
  if (p.armed) {
    const reach = armU * 1.85;
    h1x = shX + Math.cos(p.aim) * reach;
    h1y = shY + Math.sin(p.aim) * reach;
    h2x = shX + Math.cos(p.aim) * reach * 0.6 - p.facing * 2 * u;
    h2y = shY + Math.sin(p.aim) * reach * 0.6 + 3 * u;
  } else {
    const swing = 1.0 * amp;
    const base = p.grounded ? 0 : -0.9;
    const a1 = Math.PI / 2 - Math.cos(ph) * swing + base + p.facing * 0.35;
    const a2 = Math.PI / 2 + Math.cos(ph) * swing + base + p.facing * 0.35;
    h1x = shX + Math.cos(a1) * armU * 1.8 * p.facing;
    h1y = shY + Math.sin(a1) * armU * 1.5;
    h2x = shX + Math.cos(a2) * armU * 1.8 * p.facing;
    h2y = shY + Math.sin(a2) * armU * 1.5;
  }
  const [e1x, e1y] = ik(shX, shY, h1x, h1y, armU, armU, -p.facing);
  const [e2x, e2y] = ik(shX, shY, h2x, h2y, armU, armU, -p.facing);

  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // scarf (player flair)
  if (p.scarf && p.scarf.length > 1) {
    ctx.strokeStyle = p.glow;
    ctx.globalAlpha = p.alpha * 0.9;
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.moveTo(shX, chestY - 2 * u);
    for (const s of p.scarf) ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.globalAlpha = p.alpha;
  }

  const body = (pass: number) => {
    ctx.beginPath();
    // legs
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(k1x, k1y);
    ctx.lineTo(f1x, f1y);
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(k2x, k2y);
    ctx.lineTo(f2x, f2y);
    // spine
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shX, chestY);
    ctx.lineTo(hipX + (shX - hipX) * 1.25, headY + headR * 0.85);
    // arms
    ctx.moveTo(shX, shY);
    ctx.lineTo(e2x, e2y);
    ctx.lineTo(h2x, h2y);
    ctx.moveTo(shX, shY);
    ctx.lineTo(e1x, e1y);
    ctx.lineTo(h1x, h1y);
    ctx.stroke();
    if (pass === 0) return;
  };

  // ink outline pass
  ctx.strokeStyle = 'rgba(3,7,18,0.85)';
  ctx.lineWidth = 8.4 * u;
  body(0);
  ctx.beginPath();
  ctx.arc(hipX + (shX - hipX) * 1.3, headY, headR + 1.9 * u, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(3,7,18,0.85)';
  ctx.fill();

  // colour pass
  ctx.strokeStyle = p.flash > 0 ? '#ffffff' : p.color;
  ctx.lineWidth = 4.5 * u;
  body(1);

  const hx = hipX + (shX - hipX) * 1.3;
  ctx.beginPath();
  ctx.arc(hx, headY, headR, 0, Math.PI * 2);
  ctx.lineWidth = 4 * u;
  ctx.stroke();
  ctx.fillStyle = p.flash > 0 ? 'rgba(255,255,255,0.9)' : 'rgba(3,7,18,0.6)';
  ctx.fill();

  // antennae
  if (p.antenna) {
    const wob = Math.sin(p.phase * 1.4) * 0.3;
    ctx.strokeStyle = p.flash > 0 ? '#fff' : p.color;
    ctx.lineWidth = 2.2 * u;
    for (const s of [-1, 1]) {
      const ax = hx + s * headR * 0.55;
      const ay = headY - headR * 0.75;
      const tx = ax + s * 5 * u + wob * 3 * u;
      const ty = ay - 9 * u;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax + s * 5 * u, ay - 5 * u, tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, 2.1 * u, 0, Math.PI * 2);
      ctx.fillStyle = p.glow;
      ctx.fill();
    }
  }

  // eyes
  ctx.fillStyle = p.flash > 0 ? '#0b1120' : p.eye;
  if (p.bigEye) {
    ctx.beginPath();
    ctx.ellipse(hx + p.facing * headR * 0.15, headY, headR * 0.62, headR * 0.4, p.facing * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(hx + p.facing * headR * 0.28 + s * headR * 0.3, headY - headR * 0.08, headR * 0.2, headR * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // weapon
  if (p.armed && p.weapon) drawWeapon(ctx, h1x, h1y, p.aim, u, p.weapon, p.charge ?? 0);

  ctx.restore();
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  aim: number,
  u: number,
  w: WeaponId,
  charge: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(aim);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(3,7,18,0.9)';
  ctx.fillStyle = '#e2e8f0';
  const draw = (pts: number[][], fill: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * u, pts[0][1] * u);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * u, pts[i][1] * u);
    ctx.closePath();
    ctx.lineWidth = 2.4 * u;
    ctx.stroke();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  switch (w) {
    case 'blaster':
      draw(
        [
          [-3, -3],
          [13, -3],
          [13, 1],
          [-3, 2],
        ],
        '#cbd5e1',
      );
      break;
    case 'pulse':
      draw(
        [
          [-4, -4],
          [18, -3],
          [18, 1],
          [4, 2],
          [-4, 3],
        ],
        '#fbbf24',
      );
      break;
    case 'scatter':
      draw(
        [
          [-5, -4],
          [20, -4],
          [20, 2],
          [-5, 4],
        ],
        '#f472b6',
      );
      break;
    case 'rail': {
      draw(
        [
          [-6, -5],
          [26, -4],
          [26, 2],
          [-6, 4],
        ],
        '#a78bfa',
      );
      if (charge > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(216,180,254,${charge})`;
        ctx.beginPath();
        ctx.arc(26 * u, -1 * u, 4 * u * charge, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

/* -------------------------------------------------------------- arena */

let bg: HTMLCanvasElement | null = null;

function buildBackdrop(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = WORLD.w;
  c.height = WORLD.h;
  const x = c.getContext('2d')!;

  const sky = x.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#07060f');
  sky.addColorStop(0.4, '#1b0b35');
  sky.addColorStop(0.72, '#5b1152');
  sky.addColorStop(0.92, '#c23a5e');
  sky.addColorStop(1, '#ff8a3d');
  x.fillStyle = sky;
  x.fillRect(0, 0, WORLD.w, GROUND_Y);

  // stars
  for (let i = 0; i < 160; i++) {
    const sx = Math.random() * WORLD.w;
    const sy = Math.random() * GROUND_Y * 0.75;
    const a = Math.random() * 0.8 + 0.1;
    x.fillStyle = `rgba(255,255,255,${a * (1 - sy / (GROUND_Y * 0.9))})`;
    x.fillRect(sx, sy, Math.random() < 0.15 ? 2 : 1, Math.random() < 0.15 ? 2 : 1);
  }

  // big alien planet
  const px = 742;
  const py = 158;
  const pr = 96;
  const pg = x.createRadialGradient(px - 32, py - 38, 8, px, py, pr);
  pg.addColorStop(0, '#ffd9a0');
  pg.addColorStop(0.35, '#ff9d5c');
  pg.addColorStop(1, '#8a2846');
  x.globalAlpha = 0.85;
  x.fillStyle = pg;
  x.beginPath();
  x.arc(px, py, pr, 0, Math.PI * 2);
  x.fill();
  x.globalAlpha = 1;
  x.save();
  x.translate(px, py);
  x.rotate(-0.38);
  x.scale(1, 0.22);
  x.strokeStyle = 'rgba(255,214,170,0.55)';
  x.lineWidth = 9;
  x.beginPath();
  x.arc(0, 0, pr * 1.5, 0, Math.PI * 2);
  x.stroke();
  x.strokeStyle = 'rgba(255,170,120,0.3)';
  x.lineWidth = 4;
  x.beginPath();
  x.arc(0, 0, pr * 1.78, 0, Math.PI * 2);
  x.stroke();
  x.restore();

  // small moon
  x.fillStyle = 'rgba(214,236,255,0.5)';
  x.beginPath();
  x.arc(168, 96, 26, 0, Math.PI * 2);
  x.fill();

  // distant spires
  const spires = (base: number, h: number, col: string, seed: number) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, base);
    let cx = 0;
    let i = 0;
    while (cx < WORLD.w) {
      const w = 60 + ((Math.sin(seed + i * 2.3) + 1) / 2) * 110;
      const peak = base - h * (0.45 + ((Math.sin(seed + i * 1.7) + 1) / 2) * 0.75);
      x.lineTo(cx + w * 0.5, peak);
      x.lineTo(cx + w, base);
      cx += w;
      i++;
    }
    x.lineTo(WORLD.w, base);
    x.closePath();
    x.fill();
  };
  spires(GROUND_Y, 230, 'rgba(32,10,48,0.75)', 2.1);
  spires(GROUND_Y, 150, 'rgba(14,5,28,0.9)', 7.7);

  // perspective ground grid
  x.fillStyle = '#0a0713';
  x.fillRect(0, GROUND_Y, WORLD.w, WORLD.h - GROUND_Y);
  x.strokeStyle = 'rgba(94,234,212,0.22)';
  x.lineWidth = 1;
  for (let i = -12; i <= 12; i++) {
    x.beginPath();
    x.moveTo(WORLD.w / 2 + i * 26, GROUND_Y);
    x.lineTo(WORLD.w / 2 + i * 240, WORLD.h);
    x.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    const yy = GROUND_Y + Math.pow(t, 1.9) * (WORLD.h - GROUND_Y);
    x.globalAlpha = 0.1 + t * 0.35;
    x.beginPath();
    x.moveTo(0, yy);
    x.lineTo(WORLD.w, yy);
    x.stroke();
  }
  x.globalAlpha = 1;

  // horizon glow line
  const hg = x.createLinearGradient(0, GROUND_Y - 26, 0, GROUND_Y + 4);
  hg.addColorStop(0, 'rgba(255,138,61,0)');
  hg.addColorStop(1, 'rgba(255,190,120,0.55)');
  x.fillStyle = hg;
  x.fillRect(0, GROUND_Y - 26, WORLD.w, 30);
  x.fillStyle = 'rgba(255,220,180,0.9)';
  x.fillRect(0, GROUND_Y - 2, WORLD.w, 2);

  return c;
}

export function drawArena(ctx: CanvasRenderingContext2D, time: number) {
  if (!bg) bg = buildBackdrop();
  ctx.drawImage(bg, 0, 0);

  // drifting nebula haze
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const t = time * 0.06 + i * 2.1;
    const cx = ((t * 40) % (WORLD.w + 420)) - 210;
    const g = ctx.createRadialGradient(cx, 150 + i * 60, 10, cx, 150 + i * 60, 220);
    g.addColorStop(0, `rgba(${i === 1 ? '120,80,255' : '255,90,180'},0.07)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 220, 0, 440, GROUND_Y);
  }
  ctx.restore();

  // platforms
  for (const p of PLATFORMS) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,20,0.94)';
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, 15, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(2,4,12,0.4)';
    ctx.beginPath();
    ctx.roundRect(p.x + 5, p.y + 13, p.w - 10, 7, 4);
    ctx.fill();
    const pulse = 0.55 + Math.sin(time * 2 + p.x * 0.02) * 0.18;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(p.x, p.y - 10, p.x, p.y + 3);
    g.addColorStop(0, 'rgba(45,212,191,0)');
    g.addColorStop(1, `rgba(94,234,212,${0.3 * pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(p.x, p.y - 10, p.w, 13);
    ctx.strokeStyle = `rgba(167,255,235,${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + 3, p.y + 1);
    ctx.lineTo(p.x + p.w - 3, p.y + 1);
    ctx.stroke();
    ctx.restore();
  }

  // ground edge neon
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,214,170,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(WORLD.w, GROUND_Y);
  ctx.stroke();
  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D, dangerPulse: number) {
  const g = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.35, WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.86);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  if (dangerPulse > 0.01) {
    const r = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.25, WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.8);
    r.addColorStop(0, 'rgba(255,0,60,0)');
    r.addColorStop(1, `rgba(255,20,60,${0.45 * dangerPulse})`);
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  }
  // scanlines
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = '#000';
  for (let y = 0; y < WORLD.h; y += 3) ctx.fillRect(0, y, WORLD.w, 1);
  ctx.globalAlpha = 1;
}
