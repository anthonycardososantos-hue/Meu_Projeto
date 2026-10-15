import { useEffect, useRef, useState } from 'react';
import type { RunStats } from '../game/game';
import type { ScoreEntry } from '../game/storage';

/* ------------------------------------------------------------- helpers */

export function ScoreTable({ scores, highlight }: { scores: ScoreEntry[]; highlight?: number }) {
  if (scores.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-[11px] text-slate-500">
        No runs logged yet. Be the first legend.
      </div>
    );
  return (
    <div className="space-y-1">
      {scores.map((s, i) => {
        const hot = highlight !== undefined && s.score === highlight;
        return (
          <div
            key={`${s.date}-${i}`}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 font-mono text-[11px] ${
              hot ? 'border border-cyan-300/60 bg-cyan-400/15 text-cyan-100' : 'bg-slate-900/50 text-slate-300'
            }`}
          >
            <span className={`w-5 font-display ${i === 0 ? 'text-amber-300' : 'text-slate-500'}`}>{i + 1}</span>
            <span className="w-10 font-display tracking-widest text-slate-200">{s.name}</span>
            <span className="flex-1 text-right font-display text-sm text-white">{s.score.toLocaleString()}</span>
            <span className="w-14 text-right text-[10px] text-slate-500">W{s.wave}</span>
            <span className="w-12 text-right text-[10px] text-slate-500">{s.kills}k</span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2">
      <div className="text-[9px] tracking-[0.2em] text-slate-500">{label}</div>
      <div className={`font-display text-lg ${accent ?? 'text-slate-100'}`}>{value}</div>
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-slate-600 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
      {children}
    </kbd>
  );
}

/* --------------------------------------------------------- start screen */

interface StartProps {
  onStart: () => void;
  scores: ScoreEntry[];
  onMusic: () => void;
  onJava: () => void;
  isTouch: boolean;
}

export function StartScreen({ onStart, scores, onMusic, onJava, isTouch }: StartProps) {
  return (
    <div className="thin-scroll pointer-events-auto flex h-full w-full justify-center overflow-y-auto p-3 sm:p-4">
      <div className="my-auto flex w-full max-w-4xl flex-col gap-3 py-2 sm:gap-4 md:flex-row md:items-stretch">
        <div className="panel scanlines pop-in relative flex-1 overflow-hidden rounded-2xl p-5 sm:p-6">
          <div className="mb-1 font-mono text-[10px] tracking-[0.42em] text-fuchsia-300/90">SECTOR 7 · LAST STICK STANDING</div>
          <h1 className="font-display text-[2.6rem] leading-[0.92] text-white neon-text flicker sm:text-6xl">
            STICK
            <br />
            ARENA
          </h1>
          <div className="mt-1 font-display text-xl text-fuchsia-400 pink-text">XENO PURGE</div>
          <p className="mt-3 max-w-sm text-[12px] leading-relaxed text-slate-400">
            They came from a dying star and they are drawn exactly like you. Hold the arena, stack combos, phase through
            plasma with your dash, and keep the ink flowing.
          </p>

          <button
            onClick={onStart}
            className="btn btn-primary mt-5 w-full rounded-xl py-4 text-lg floaty"
          >
            ▶ START PURGE
          </button>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
            {isTouch ? (
              <>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <span className="text-cyan-300">LEFT PAD</span> · move
                </div>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <span className="text-cyan-300">FIRE</span> · auto-aim
                </div>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <span className="text-emerald-300">JUMP</span> · tap twice
                </div>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <span className="text-fuchsia-300">DASH</span> · i-frames
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <Key>A</Key> <Key>D</Key> move
                </div>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <Key>SPACE</Key> double jump
                </div>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <Key>SHIFT</Key> dash · i-frames
                </div>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <Key>MOUSE</Key> aim &amp; fire
                </div>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <Key>1</Key>-<Key>4</Key> / <Key>Q</Key><Key>E</Key> weapons
                </div>
                <div className="rounded-lg bg-slate-900/50 px-3 py-2">
                  <Key>P</Key> pause · <Key>R</Key> restart
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={onMusic} className="btn btn-ghost flex-1 rounded-lg py-2.5 text-xs">
              ♫ ADD MUSIC
            </button>
            <button onClick={onJava} className="btn btn-ghost flex-1 rounded-lg py-2.5 text-xs">
              ☕ JAVA ENGINE
            </button>
          </div>
        </div>

        <div className="panel pop-in w-full rounded-2xl p-5 md:w-72">
          <h2 className="mb-1 font-display text-sm tracking-[0.25em] text-amber-300">HALL OF INK</h2>
          <p className="mb-3 text-[10px] text-slate-500">Local high scores</p>
          <ScoreTable scores={scores} />
          <div className="mt-4 space-y-2 border-t border-slate-700/60 pt-3 text-[10px] leading-relaxed text-slate-500">
            <p>
              <span className="text-cyan-300">TIP:</span> Dash straight through a grunt — the phase-strike deals 55 damage
              while you are untouchable.
            </p>
            <p>
              <span className="text-fuchsia-300">TIP:</span> Kills chain a combo multiplier up to x9.9. Don't get hit; it
              resets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- pause */

export function PauseScreen({
  onResume,
  onRestart,
  onQuit,
  onMusic,
  stats,
}: {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onMusic: () => void;
  stats: RunStats;
}) {
  return (
    <div className="pointer-events-auto flex h-full w-full items-center justify-center p-4">
      <div className="panel scanlines pop-in w-full max-w-sm rounded-2xl p-6 text-center">
        <h2 className="font-display text-3xl text-cyan-200 neon-text">PAUSED</h2>
        <p className="mt-1 text-[11px] text-slate-500">The aliens are waiting. Politely.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="SCORE" value={stats.score.toLocaleString()} accent="text-white" />
          <Stat label="WAVE" value={`${stats.wave}`} accent="text-cyan-300" />
          <Stat label="KILLS" value={`${stats.kills}`} accent="text-fuchsia-300" />
        </div>
        <div className="mt-5 space-y-2">
          <button onClick={onResume} className="btn btn-primary w-full rounded-xl py-3">
            RESUME
          </button>
          <div className="flex gap-2">
            <button onClick={onRestart} className="btn btn-ghost flex-1 rounded-xl py-2.5 text-xs">
              RESTART
            </button>
            <button onClick={onMusic} className="btn btn-ghost flex-1 rounded-xl py-2.5 text-xs">
              ♫ MUSIC
            </button>
            <button onClick={onQuit} className="btn btn-ghost flex-1 rounded-xl py-2.5 text-xs">
              QUIT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- game over */

export function GameOverScreen({
  stats,
  scores,
  needsName,
  onSubmit,
  onRestart,
  onMenu,
}: {
  stats: RunStats;
  scores: ScoreEntry[];
  needsName: boolean;
  onSubmit: (name: string) => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const [name, setName] = useState(() => localStorage.getItem('stickarena.name') ?? 'STK');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (needsName) inputRef.current?.focus();
  }, [needsName]);

  return (
    <div className="thin-scroll pointer-events-auto flex h-full w-full justify-center overflow-y-auto p-3 sm:p-4">
      <div className="my-auto flex w-full max-w-3xl flex-col gap-3 py-2 sm:gap-4 md:flex-row">
        <div className="panel scanlines pop-in flex-1 rounded-2xl p-6 text-center">
          <div className="font-mono text-[10px] tracking-[0.4em] text-rose-400/80">SIGNAL LOST</div>
          <h2 className="font-display text-5xl text-rose-400 pink-text">TERMINATED</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left">
            <Stat label="FINAL SCORE" value={stats.score.toLocaleString()} accent="text-amber-300" />
            <Stat label="WAVE REACHED" value={`${stats.wave}`} accent="text-cyan-300" />
            <Stat label="ALIENS PURGED" value={`${stats.kills}`} accent="text-fuchsia-300" />
            <Stat label="ACCURACY" value={`${stats.accuracy}%`} accent="text-emerald-300" />
          </div>

          {needsName && (
            <div className="mt-4 rounded-xl border border-amber-300/40 bg-amber-400/10 p-3">
              <div className="font-display text-xs tracking-widest text-amber-200">NEW HIGH SCORE — SIGN IT</div>
              <form
                className="mt-2 flex items-center justify-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = (name || 'STK').toUpperCase().slice(0, 3);
                  localStorage.setItem('stickarena.name', n);
                  onSubmit(n);
                }}
              >
                <input
                  ref={inputRef}
                  value={name}
                  maxLength={3}
                  onChange={(e) => setName(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="w-24 rounded-lg border border-amber-300/50 bg-black/50 px-3 py-2 text-center font-display text-2xl tracking-[0.3em] text-amber-100 outline-none focus:border-amber-200"
                />
                <button type="submit" className="btn btn-primary rounded-lg px-4 py-2.5 text-xs">
                  SAVE
                </button>
              </form>
            </div>
          )}

          <div className="mt-5 space-y-2">
            <button onClick={onRestart} className="btn btn-primary w-full rounded-xl py-3.5 text-base">
              ⟲ FIGHT AGAIN
            </button>
            <button onClick={onMenu} className="btn btn-ghost w-full rounded-xl py-2.5 text-xs">
              MAIN MENU
            </button>
            <p className="pt-1 text-[10px] text-slate-500">
              press <Key>R</Key> for instant restart
            </p>
          </div>
        </div>

        <div className="panel pop-in w-full rounded-2xl p-5 md:w-72">
          <h2 className="mb-3 font-display text-sm tracking-[0.25em] text-amber-300">HALL OF INK</h2>
          <ScoreTable scores={scores} highlight={stats.score} />
        </div>
      </div>
    </div>
  );
}
