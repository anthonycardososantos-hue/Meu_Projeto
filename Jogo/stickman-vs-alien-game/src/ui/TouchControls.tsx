import { useEffect, useRef } from 'react';
import type { Game } from '../game/game';

interface Props {
  game: Game | null;
  visible: boolean;
}

const RADIUS = 52;

export default function TouchControls({ game, visible }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const stick = useRef({ id: -1, ox: 0, oy: 0 });

  useEffect(() => {
    if (!visible && game) {
      game.setStick(0, 0, false);
      game.setFire(false);
    }
  }, [visible, game]);

  if (!visible) return null;

  const showStick = (x: number, y: number) => {
    const b = baseRef.current;
    if (!b) return;
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
    b.style.opacity = '1';
    if (knobRef.current) knobRef.current.style.transform = 'translate(-50%,-50%)';
  };

  const onPadDown = (e: React.PointerEvent) => {
    if (stick.current.id !== -1) return;
    stick.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    showStick(e.clientX, e.clientY);
  };

  const onPadMove = (e: React.PointerEvent) => {
    if (e.pointerId !== stick.current.id || !game) return;
    let dx = e.clientX - stick.current.ox;
    let dy = e.clientY - stick.current.oy;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    if (knobRef.current) knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const nx = dx / RADIUS;
    const ny = dy / RADIUS;
    game.setStick(Math.abs(nx) < 0.18 ? 0 : nx, ny, true);
  };

  const onPadUp = (e: React.PointerEvent) => {
    if (e.pointerId !== stick.current.id) return;
    stick.current.id = -1;
    if (baseRef.current) baseRef.current.style.opacity = '0';
    game?.setStick(0, 0, false);
  };

  const hold = (down: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    if (down) (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    game?.setFire(down);
  };

  const tap = (fn: () => void, buzz = 0) => (e: React.PointerEvent) => {
    e.preventDefault();
    fn();
    if (buzz) navigator.vibrate?.(buzz);
  };

  const btn =
    'select-none rounded-full flex items-center justify-center font-display text-[11px] tracking-wider ' +
    'border backdrop-blur-sm active:scale-95 transition-transform duration-75';

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* movement pad (left half) */}
      <div
        className="pointer-events-auto absolute bottom-0 left-0 h-[72%] w-[46%]"
        onPointerDown={onPadDown}
        onPointerMove={onPadMove}
        onPointerUp={onPadUp}
        onPointerCancel={onPadUp}
      />
      <div
        ref={baseRef}
        className="pointer-events-none absolute h-[116px] w-[116px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/35 bg-cyan-400/5 opacity-0 transition-opacity duration-150"
        style={{ left: -999, top: -999 }}
      >
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/70 bg-cyan-300/25 shadow-[0_0_24px_rgba(34,211,238,0.5)]"
        />
      </div>

      {/* action cluster (right) */}
      <div className="pointer-events-none absolute bottom-4 right-3 select-none">
        <button
          className={`${btn} pointer-events-auto absolute bottom-[112px] right-[108px] h-[62px] w-[62px] border-fuchsia-300/50 bg-fuchsia-500/14 text-fuchsia-100`}
          onPointerDown={tap(() => game?.touchDash(), 12)}
        >
          DASH
        </button>
        <button
          className={`${btn} pointer-events-auto absolute bottom-[118px] right-[18px] h-[70px] w-[70px] border-emerald-300/50 bg-emerald-500/14 text-emerald-100`}
          onPointerDown={tap(() => game?.touchJump())}
        >
          JUMP
        </button>
        <button
          className={`${btn} pointer-events-auto relative h-[104px] w-[104px] border-cyan-200/60 bg-cyan-400/16 text-[13px] text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,0.35)]`}
          onPointerDown={hold(true)}
          onPointerUp={hold(false)}
          onPointerCancel={hold(false)}
          onPointerLeave={hold(false)}
        >
          FIRE
        </button>
        <button
          className={`${btn} pointer-events-auto absolute bottom-[60px] right-[122px] h-[46px] w-[46px] border-amber-300/50 bg-amber-400/15 text-[9px] text-amber-100`}
          onPointerDown={tap(() => game?.cycleWeapon(1))}
        >
          SWAP
        </button>
      </div>
    </div>
  );
}
