import { useEffect, useRef, useState } from 'react';
import { audio } from '../game/audio';

interface Props {
  onClose: () => void;
  musicVol: number;
  sfxVol: number;
  setMusicVol: (v: number) => void;
  setSfxVol: (v: number) => void;
}

export default function MusicPanel({ onClose, musicVol, sfxVol, setMusicVol, setSfxVol }: Props) {
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => audio.subscribe(() => force((n) => n + 1)) as unknown as () => void, []);

  const add = (files: FileList | File[] | null) => {
    if (!files) return;
    audio.init();
    const n = audio.addFiles(files);
    if (n > 0) audio.play();
    force((x) => x + 1);
  };

  return (
    <div className="pop-in panel scanlines relative w-full max-w-lg overflow-hidden rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-cyan-200 neon-text">SOUND DECK</h2>
          <p className="text-[11px] text-slate-400">Drop in your own tracks — they stay on your device.</p>
        </div>
        <button className="btn btn-ghost rounded-lg px-3 py-1.5 text-xs" onClick={onClose}>
          CLOSE
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        className={`mb-4 cursor-pointer rounded-xl border border-dashed px-4 py-5 text-center transition-colors ${
          drag ? 'border-cyan-300 bg-cyan-400/10' : 'border-slate-600/70 bg-slate-900/40 hover:border-cyan-400/60'
        }`}
        onClick={() => fileRef.current?.click()}
      >
        <div className="font-display text-sm text-cyan-200">+ ADD CUSTOM MUSIC</div>
        <div className="mt-1 text-[11px] text-slate-400">tap to browse · or drag &amp; drop mp3 / ogg / wav / m4a</div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
      </div>

      <div className="thin-scroll mb-4 max-h-48 space-y-1.5 overflow-y-auto pr-1">
        {audio.tracks.map((t, i) => {
          const active = i === audio.index;
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                active ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-100' : 'border-slate-700/60 bg-slate-900/40 text-slate-300'
              }`}
            >
              <button
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-400/10 text-cyan-200"
                onClick={() => {
                  audio.init();
                  if (active && audio.playing) audio.stop();
                  else audio.select(t.id);
                  force((x) => x + 1);
                }}
              >
                {active && audio.playing ? '❚❚' : '▶'}
              </button>
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              {t.builtin ? (
                <span className="shrink-0 rounded bg-slate-700/60 px-1.5 py-0.5 text-[9px] tracking-wider text-slate-300">SYNTH</span>
              ) : (
                <button
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-rose-300"
                  onClick={() => audio.removeTrack(t.id)}
                >
                  REMOVE
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-3 flex items-center justify-center gap-3">
        <button className="btn btn-ghost rounded-lg px-3 py-2 text-xs" onClick={() => audio.next(-1)}>
          ◀◀
        </button>
        <button
          className="btn btn-primary rounded-lg px-5 py-2 text-xs"
          onClick={() => {
            audio.init();
            audio.toggle();
            force((x) => x + 1);
          }}
        >
          {audio.playing ? 'PAUSE' : 'PLAY'}
        </button>
        <button className="btn btn-ghost rounded-lg px-3 py-2 text-xs" onClick={() => audio.next(1)}>
          ▶▶
        </button>
      </div>

      <div className="space-y-3">
        <Slider label="MUSIC" value={musicVol} onChange={setMusicVol} />
        <Slider label="SFX" value={sfxVol} onChange={setSfxVol} />
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-[11px] tracking-wider text-slate-400">
      <span className="w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1 flex-1"
      />
      <span className="w-8 shrink-0 text-right text-cyan-300">{Math.round(value * 100)}</span>
    </label>
  );
}
