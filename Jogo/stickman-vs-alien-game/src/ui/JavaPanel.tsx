import { useState } from 'react';
import stickArena from '../../java/src/main/java/com/stickarena/core/StickArena.java?raw';
import playerSrc from '../../java/src/main/java/com/stickarena/core/Player.java?raw';
import weaponSrc from '../../java/src/main/java/com/stickarena/core/Weapon.java?raw';

const FILES = [
  { name: 'StickArena.java', src: stickArena },
  { name: 'Player.java', src: playerSrc },
  { name: 'Weapon.java', src: weaponSrc },
];

export default function JavaPanel({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  return (
    <div className="pop-in panel scanlines relative flex max-h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-amber-200">JAVA ENGINE SOURCE</h2>
          <p className="max-w-md text-[11px] leading-relaxed text-slate-400">
            The simulation is authored in Java (<code className="text-amber-300">com.stickarena.core</code>) and
            cross-compiled to the browser with TeaVM via <code className="text-amber-300">mvn -P teavm package</code>. The
            bundled runtime is the line-for-line port that ships when no JDK is available at build time.
          </p>
        </div>
        <button className="btn btn-ghost shrink-0 rounded-lg px-3 py-1.5 text-xs" onClick={onClose}>
          CLOSE
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {FILES.map((f, idx) => (
          <button
            key={f.name}
            onClick={() => setI(idx)}
            className={`rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors ${
              i === idx
                ? 'border-amber-300/70 bg-amber-400/15 text-amber-100'
                : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:text-slate-200'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>
      <pre className="thin-scroll flex-1 overflow-auto rounded-xl border border-slate-700/60 bg-black/60 p-3 text-[10.5px] leading-[1.5] text-emerald-200/90">
        {FILES[i].src}
      </pre>
    </div>
  );
}
