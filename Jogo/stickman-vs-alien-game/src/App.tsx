import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type GameState, type RunStats } from './game/game';
import { audio } from './game/audio';
import { isHighScore, loadScores, loadSettings, saveScore, saveSettings, type ScoreEntry } from './game/storage';
import { GameOverScreen, PauseScreen, StartScreen } from './ui/Overlays';
import MusicPanel from './ui/MusicPanel';
import JavaPanel from './ui/JavaPanel';
import TouchControls from './ui/TouchControls';

const EMPTY: RunStats = { score: 0, wave: 0, kills: 0, accuracy: 0, time: 0 };

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [state, setState] = useState<GameState>('menu');
  const [stats, setStats] = useState<RunStats>(EMPTY);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [panel, setPanel] = useState<'none' | 'music' | 'java'>('none');
  const [needsName, setNeedsName] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());
  const [touchMode, setTouchMode] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window),
  );
  const [trackTick, setTrackTick] = useState(0);
  const [portrait, setPortrait] = useState(
    () => typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.08,
  );
  const [ignoreRotate, setIgnoreRotate] = useState(false);
  const pausedByRotate = useRef(false);

  /* --------------------------------------------------------- boot game */
  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current);
    gameRef.current = g;
    (window as unknown as { __game: Game }).__game = g;
    g.shakeMult = settings.shake;
    g.onState = (s, st) => {
      setState(s);
      setStats(st);
      if (s === 'dead') {
        const hs = isHighScore(st.score);
        setNeedsName(hs);
        if (!hs) setScores(loadScores());
      }
    };
    g.run();
    audio.setMusicVolume(settings.music);
    audio.setSfxVolume(settings.sfx);
    const unsub = audio.subscribe(() => setTrackTick((t) => t + 1));
    const onTouch = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setTouchMode(true);
    };
    window.addEventListener('pointerdown', onTouch);
    const onVis = () => {
      if (document.hidden) g.pause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      unsub();
      window.removeEventListener('pointerdown', onTouch);
      document.removeEventListener('visibilitychange', onVis);
      g.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveSettings(settings);
    audio.setMusicVolume(settings.music);
    audio.setSfxVolume(settings.sfx);
    if (gameRef.current) gameRef.current.shakeMult = settings.shake;
  }, [settings]);

  /* ------------------------------------------------------- orientation */
  useEffect(() => {
    const on = () => setPortrait(window.innerHeight > window.innerWidth * 1.08);
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);

  const showRotate = touchMode && portrait && !ignoreRotate && (state === 'playing' || state === 'paused');

  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    if (showRotate && g.state === 'playing') {
      pausedByRotate.current = true;
      g.pause();
    } else if (!showRotate && pausedByRotate.current && g.state === 'paused') {
      pausedByRotate.current = false;
      g.resume();
    }
  }, [showRotate]);

  /* --------------------------------------------------------- shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'm') {
        audio.init();
        audio.toggle();
      }
      if (k === 'escape' && panel !== 'none') setPanel('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

  /* ------------------------------------------------------------ actions */
  const start = useCallback(() => {
    audio.init();
    if (!audio.playing) audio.play();
    setPanel('none');
    setNeedsName(false);
    gameRef.current?.start();
  }, []);

  const openPanel = (p: 'music' | 'java') => {
    if (gameRef.current?.state === 'playing') gameRef.current.pause();
    setPanel(p);
  };

  const submitName = (name: string) => {
    setScores(saveScore({ name, score: stats.score, wave: stats.wave, kills: stats.kills, date: Date.now() }));
    setNeedsName(false);
  };

  const playing = state === 'playing' || state === 'dying';
  const track = audio.current;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#05040c]">
      {/* ---------------------------------------------------------- chrome */}
      <header className="z-30 flex h-10 shrink-0 items-center justify-between gap-2 border-b border-cyan-300/10 bg-black/60 px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="whitespace-nowrap font-display text-[11px] tracking-[0.18em] text-cyan-300 neon-text">
            STICK ARENA
          </span>
          <span className="hidden whitespace-nowrap font-mono text-[10px] tracking-[0.3em] text-fuchsia-400/80 sm:inline">
            // XENO PURGE
          </span>
        </div>
        <div className="flex items-center gap-1.5" key={trackTick}>
          <button
            onClick={() => {
              audio.init();
              audio.toggle();
            }}
            title="Toggle music (M)"
            className="flex h-7 max-w-[108px] items-center gap-1.5 rounded-md border border-slate-700/80 bg-slate-900/70 px-2 font-mono text-[10px] text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200 sm:max-w-[200px]"
          >
            <span className={audio.playing ? 'text-cyan-300' : 'text-slate-600'}>{audio.playing ? '♫' : '♪'}</span>
            <span className="truncate">{track.name}</span>
          </button>
          <button
            onClick={() => openPanel('music')}
            className="h-7 whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-900/70 px-2 font-display text-[10px] tracking-wider text-slate-300 hover:border-cyan-400/60 hover:text-cyan-200"
          >
            <span className="sm:hidden">+♫</span>
            <span className="hidden sm:inline">+ MUSIC</span>
          </button>
          {playing && (
            <button
              onClick={() => gameRef.current?.pause()}
              className="h-7 whitespace-nowrap rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2.5 font-display text-[10px] tracking-wider text-cyan-200 hover:bg-cyan-400/20"
            >
              ❚❚
            </button>
          )}
        </div>
      </header>

      {/* ------------------------------------------------------- game area */}
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <TouchControls game={gameRef.current} visible={touchMode && state === 'playing' && panel === 'none'} />

        {/* overlays */}
        {panel === 'none' && state === 'menu' && (
          <div className="absolute inset-0 z-20 bg-gradient-to-b from-black/60 via-black/45 to-black/75">
            <StartScreen
              onStart={start}
              scores={scores}
              onMusic={() => openPanel('music')}
              onJava={() => openPanel('java')}
              isTouch={touchMode}
            />
          </div>
        )}

        {panel === 'none' && state === 'paused' && (
          <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-[2px]">
            <PauseScreen
              stats={stats}
              onResume={() => gameRef.current?.resume()}
              onRestart={start}
              onMusic={() => openPanel('music')}
              onQuit={() => gameRef.current?.toMenu()}
            />
          </div>
        )}

        {panel === 'none' && state === 'dead' && (
          <div className="absolute inset-0 z-20 bg-gradient-to-b from-rose-950/40 via-black/75 to-black/85">
            <GameOverScreen
              stats={stats}
              scores={scores}
              needsName={needsName}
              onSubmit={submitName}
              onRestart={start}
              onMenu={() => gameRef.current?.toMenu()}
            />
          </div>
        )}

        {showRotate && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-black/90 p-6 text-center">
            <div className="h-20 w-12 animate-[floaty_2.6s_ease-in-out_infinite] rounded-xl border-2 border-cyan-300/70 shadow-[0_0_30px_rgba(34,211,238,0.4)]">
              <div className="mx-auto mt-1.5 h-1 w-5 rounded bg-cyan-300/60" />
            </div>
            <div>
              <div className="font-display text-xl text-cyan-200 neon-text">ROTATE YOUR DEVICE</div>
              <p className="mt-1 text-[11px] text-slate-400">Landscape gives the arena room to breathe.</p>
            </div>
            <button className="btn btn-ghost rounded-xl px-5 py-2.5 text-xs" onClick={() => setIgnoreRotate(true)}>
              PLAY IN PORTRAIT ANYWAY
            </button>
          </div>
        )}

        {panel !== 'none' && (
          <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
            {panel === 'music' ? (
              <MusicPanel
                onClose={() => setPanel('none')}
                musicVol={settings.music}
                sfxVol={settings.sfx}
                setMusicVol={(v) => setSettings((s) => ({ ...s, music: v }))}
                setSfxVol={(v) => setSettings((s) => ({ ...s, sfx: v }))}
              />
            ) : (
              <JavaPanel onClose={() => setPanel('none')} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
