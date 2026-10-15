import { PLAYER, WEAPONS, WEAPON_ORDER, WORLD, clamp } from './core';
import type { Game } from './game';

const F = (w: number, s: number) => `${w} ${s}px "Arial Black", "Segoe UI", system-ui, sans-serif`;

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = 0.46) {
  ctx.fillStyle = `rgba(4,6,18,${a})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(125,211,252,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function drawHud(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.p;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  /* ---- health (top-left) */
  const hx = 16;
  const hy = 16;
  const hw = 236;
  panel(ctx, hx - 6, hy - 6, hw + 12, 46);
  ctx.font = F(900, 10);
  ctx.fillStyle = '#7dd3fc';
  ctx.textAlign = 'left';
  ctx.fillText('UNIT STK-01', hx, hy + 8);
  ctx.textAlign = 'right';
  ctx.fillStyle = p.hp < 30 ? '#fb7185' : '#e2e8f0';
  ctx.font = F(900, 11);
  ctx.fillText(`${Math.max(0, Math.ceil(p.hp))}/${PLAYER.hp}`, hx + hw, hy + 8);
  ctx.textAlign = 'left';
  const pct = clamp(p.hp / PLAYER.hp, 0, 1);
  ctx.fillStyle = 'rgba(148,163,184,0.2)';
  ctx.fillRect(hx, hy + 14, hw, 13);
  const grad = ctx.createLinearGradient(hx, 0, hx + hw, 0);
  const low = pct < 0.3;
  grad.addColorStop(0, low ? '#ff2d55' : '#22d3ee');
  grad.addColorStop(1, low ? '#ff8f6b' : '#a7f3d0');
  ctx.fillStyle = grad;
  ctx.fillRect(hx, hy + 14, hw * pct, 13);
  if (low) {
    ctx.globalAlpha = 0.35 + Math.sin(g.time * 10) * 0.25;
    ctx.fillStyle = '#ff2d55';
    ctx.fillRect(hx, hy + 14, hw * pct, 13);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = 'rgba(226,232,240,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(hx + 0.5, hy + 14.5, hw - 1, 12);
  for (let i = 1; i < 5; i++) {
    ctx.fillStyle = 'rgba(2,6,23,0.6)';
    ctx.fillRect(hx + (hw / 5) * i, hy + 14, 2, 13);
  }
  /* ---- dash meter */
  const dashReady = p.dashCd <= 0;
  const dx = hx;
  const dy = hy + 46;
  panel(ctx, dx - 6, dy - 4, 182, 22, 0.4);
  ctx.textAlign = 'left';
  ctx.font = F(900, 10);
  ctx.fillStyle = dashReady ? '#67e8f9' : 'rgba(148,163,184,0.7)';
  ctx.fillText('DASH', dx, dy + 11);
  const dw = 96;
  const dbx = dx + 36;
  ctx.fillStyle = 'rgba(148,163,184,0.2)';
  ctx.fillRect(dbx, dy + 3, dw, 8);
  ctx.fillStyle = dashReady ? '#67e8f9' : '#0ea5e9';
  ctx.fillRect(dbx, dy + 3, dw * (dashReady ? 1 : 1 - p.dashCd / 0.62), 8);
  ctx.font = F(900, 9);
  if (p.iFrames > 0) {
    ctx.fillStyle = '#fde68a';
    ctx.fillText('I-FRAMES', dbx + dw + 6, dy + 11);
  } else if (dashReady) {
    ctx.fillStyle = 'rgba(103,232,249,0.8)';
    ctx.fillText('READY', dbx + dw + 6, dy + 11);
  }

  /* ---- score (top-right) */
  ctx.textAlign = 'right';
  const sx = WORLD.w - 16;
  panel(ctx, sx - 192, hy - 6, 198, 46);
  ctx.font = F(900, 10);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('SCORE', sx - 6, hy + 8);
  ctx.font = F(900, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(Math.floor(g.displayScore).toLocaleString(), sx - 6, hy + 32);

  if (g.combo > 1) {
    const t = clamp(g.comboTimer / 2.8, 0, 1);
    const mult = g.multiplier();
    const cx = sx - 6;
    const cy = hy + 58;
    ctx.save();
    ctx.translate(cx, cy);
    const pop = 1 + (1 - t) * 0.08 + Math.sin(g.time * 14) * 0.02;
    ctx.scale(pop, pop);
    ctx.font = F(900, 22);
    ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'right';
    ctx.fillText(`x${mult.toFixed(1)}`, 0, 0);
    ctx.font = F(900, 9);
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'left';
    ctx.fillText(`${g.combo} COMBO`, -170, -2);
    ctx.restore();
    ctx.fillStyle = 'rgba(251,191,36,0.25)';
    ctx.fillRect(sx - 170, hy + 62, 100, 3);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(sx - 170, hy + 62, 100 * t, 3);
  }

  /* ---- wave (top-center) */
  const total = g.queue.length + g.aliens.length;
  ctx.textAlign = 'center';
  panel(ctx, WORLD.w / 2 - 86, hy - 6, 172, 34);
  ctx.font = F(900, 15);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(`WAVE ${g.wave}`, WORLD.w / 2, hy + 12);
  ctx.font = F(900, 9);
  ctx.fillStyle = total > 0 ? '#86efac' : '#fbbf24';
  ctx.fillText(total > 0 ? `${total} HOSTILES` : 'AREA CLEAR', WORLD.w / 2, hy + 24);

  /* ---- boss bar */
  if (g.boss) {
    const bw = 420;
    const bx = WORLD.w / 2 - bw / 2;
    const by = hy + 38;
    ctx.fillStyle = 'rgba(2,6,23,0.7)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    ctx.fillStyle = '#db2777';
    ctx.fillRect(bx, by, bw * clamp(g.boss.hp / g.boss.maxHp, 0, 1), 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 9);
    ctx.font = F(900, 9);
    ctx.fillStyle = '#fbcfe8';
    ctx.fillText('THE OVERMIND', WORLD.w / 2, by + 24);
  }

  /* ---- weapons (bottom-left) */
  let wx = 16;
  const wy = WORLD.h - 44;
  for (const id of WEAPON_ORDER) {
    const spec = WEAPONS[id];
    const owned = p.ammo[id] !== 0;
    const active = p.weapon === id;
    const w = 96;
    ctx.globalAlpha = owned ? 1 : 0.28;
    ctx.fillStyle = active ? 'rgba(14,165,233,0.32)' : 'rgba(4,6,18,0.5)';
    ctx.beginPath();
    ctx.roundRect(wx, wy, w, 30, 6);
    ctx.fill();
    ctx.strokeStyle = active ? spec.glow : 'rgba(148,163,184,0.25)';
    ctx.lineWidth = active ? 2 : 1;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = F(900, 9);
    ctx.fillStyle = active ? '#ffffff' : '#cbd5e1';
    ctx.fillText(spec.name, wx + 7, wy + 13);
    ctx.font = F(900, 11);
    ctx.fillStyle = spec.glow;
    ctx.fillText(p.ammo[id] < 0 ? '∞' : `${p.ammo[id]}`, wx + 7, wy + 25);
    ctx.textAlign = 'right';
    ctx.font = F(900, 9);
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.fillText(`${WEAPON_ORDER.indexOf(id) + 1}`, wx + w - 7, wy + 25);
    ctx.globalAlpha = 1;
    wx += w + 6;
  }

  /* ---- toast */
  if (g.toastT > 0) {
    const a = clamp(g.toastT, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = F(900, 14);
    ctx.fillStyle = '#fef3c7';
    ctx.fillText(g.toast, WORLD.w / 2, WORLD.h - 64);
    ctx.globalAlpha = 1;
  }

  /* ---- banner */
  if (g.bannerT > 0) {
    const t = g.bannerT;
    const a = clamp(t > 1.8 ? (2.2 - t) / 0.4 : t / 0.8, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.translate(WORLD.w / 2, WORLD.h * 0.3);
    const s = 1 + (1 - clamp(t / 2.2, 0, 1)) * 0.06;
    ctx.scale(s, s);
    ctx.font = F(900, 46);
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(2,6,23,0.8)';
    ctx.strokeText(g.banner, 0, 0);
    const grad2 = ctx.createLinearGradient(-200, -30, 200, 20);
    grad2.addColorStop(0, '#67e8f9');
    grad2.addColorStop(0.5, '#ffffff');
    grad2.addColorStop(1, '#f472b6');
    ctx.fillStyle = grad2;
    ctx.fillText(g.banner, 0, 0);
    ctx.restore();
  }

  /* ---- first-run control hint */
  if (g.wave === 1 && g.runTime < 7 && g.kills === 0) {
    ctx.globalAlpha = clamp(7 - g.runTime, 0, 1) * 0.85;
    ctx.textAlign = 'center';
    ctx.font = F(900, 12);
    ctx.fillStyle = '#e0f2fe';
    const hint = g.isTouch
      ? 'LEFT STICK: MOVE   ·   FIRE / JUMP / DASH BUTTONS'
      : 'A D / ← → MOVE  ·  SPACE JUMP (x2)  ·  SHIFT DASH (I-FRAMES)  ·  MOUSE AIM + FIRE';
    ctx.fillText(hint, WORLD.w / 2, WORLD.h - 80);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
