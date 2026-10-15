/**
 * AudioEngine — procedural SFX (zero assets) + music manager.
 * Music: a built-in WebAudio synthwave sequencer, plus any number of
 * custom tracks the player drops in from their own device.
 */

export interface Track {
  id: string;
  name: string;
  builtin: boolean;
  url?: string;
}

type Listener = () => void;

const BUILTIN: Track = { id: 'builtin', name: 'NEON PURGE (built-in synth)', builtin: true };

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxGain: GainNode | null = null;
  synthGain: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;

  tracks: Track[] = [BUILTIN];
  index = 0;
  playing = false;
  musicVol = 0.6;
  sfxVol = 0.75;

  private el: HTMLAudioElement | null = null;
  private seqTimer: number | null = null;
  private step = 0;
  private nextNoteTime = 0;
  private listeners = new Set<Listener>();
  private intensity = 0; // 0..1, raises synth energy during fights

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    this.listeners.forEach((l) => l());
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;
    const ctx: AudioContext = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);

    this.synthGain = ctx.createGain();
    this.synthGain.gain.value = 0;
    this.synthGain.connect(this.master);

    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  setMusicVolume(v: number) {
    this.musicVol = v;
    if (this.el) this.el.volume = v;
    if (this.synthGain && this.ctx) {
      const target = this.playing && this.current.builtin ? v * 0.55 : 0;
      this.synthGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
  }
  setSfxVolume(v: number) {
    this.sfxVol = v;
    if (this.sfxGain && this.ctx) this.sfxGain.gain.value = v;
  }
  setIntensity(v: number) {
    this.intensity = v;
  }

  get current(): Track {
    return this.tracks[this.index] ?? BUILTIN;
  }

  addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('audio') || /\.(mp3|ogg|wav|m4a|flac|aac|opus)$/i.test(f.name));
    for (const f of arr) {
      this.tracks.push({
        id: `${f.name}-${f.size}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name.replace(/\.[^.]+$/, ''),
        builtin: false,
        url: URL.createObjectURL(f),
      });
    }
    if (arr.length) {
      this.index = this.tracks.length - arr.length;
      if (this.playing) this.play();
      this.emit();
    }
    return arr.length;
  }

  removeTrack(id: string) {
    const i = this.tracks.findIndex((t) => t.id === id);
    if (i < 0 || this.tracks[i].builtin) return;
    const was = this.index === i;
    const t = this.tracks[i];
    if (t.url) URL.revokeObjectURL(t.url);
    this.tracks.splice(i, 1);
    if (this.index >= this.tracks.length) this.index = 0;
    else if (i < this.index) this.index--;
    if (was && this.playing) this.play();
    this.emit();
  }

  select(id: string) {
    const i = this.tracks.findIndex((t) => t.id === id);
    if (i < 0) return;
    this.index = i;
    this.play();
  }

  next(dir = 1) {
    if (this.tracks.length === 0) return;
    this.index = (this.index + dir + this.tracks.length) % this.tracks.length;
    if (this.playing) this.play();
    this.emit();
  }

  toggle() {
    if (this.playing) this.stop();
    else this.play();
  }

  play() {
    this.init();
    this.stopElement();
    this.stopSequencer();
    this.playing = true;
    const t = this.current;
    if (t.builtin) this.startSequencer();
    else if (t.url) {
      const el = new Audio(t.url);
      el.loop = true;
      el.volume = this.musicVol;
      el.crossOrigin = 'anonymous';
      void el.play().catch(() => undefined);
      this.el = el;
    }
    this.emit();
  }

  stop() {
    this.playing = false;
    this.stopElement();
    this.stopSequencer();
    this.emit();
  }

  pauseForGame() {
    if (this.el) this.el.volume = this.musicVol * 0.35;
    if (this.synthGain && this.ctx) this.synthGain.gain.setTargetAtTime(this.musicVol * 0.2, this.ctx.currentTime, 0.1);
  }
  resumeForGame() {
    if (this.el) this.el.volume = this.musicVol;
    if (this.synthGain && this.ctx && this.playing && this.current.builtin)
      this.synthGain.gain.setTargetAtTime(this.musicVol * 0.55, this.ctx.currentTime, 0.1);
  }

  private stopElement() {
    if (this.el) {
      this.el.pause();
      this.el.src = '';
      this.el = null;
    }
  }

  /* ----------------------------------------------------- synth sequencer */

  private startSequencer() {
    const ctx = this.ctx;
    if (!ctx || !this.synthGain) return;
    this.synthGain.gain.setTargetAtTime(this.musicVol * 0.55, ctx.currentTime, 0.2);
    this.step = 0;
    this.nextNoteTime = ctx.currentTime + 0.08;
    const tick = () => {
      const c = this.ctx;
      if (!c) return;
      const spb = 60 / 138 / 4; // 16th notes @138bpm
      while (this.nextNoteTime < c.currentTime + 0.14) {
        this.scheduleStep(this.step, this.nextNoteTime);
        this.nextNoteTime += spb;
        this.step = (this.step + 1) % 64;
      }
      this.seqTimer = window.setTimeout(tick, 40);
    };
    tick();
  }

  private stopSequencer() {
    if (this.seqTimer !== null) {
      clearTimeout(this.seqTimer);
      this.seqTimer = null;
    }
    if (this.synthGain && this.ctx) this.synthGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
  }

  private scheduleStep(step: number, time: number) {
    const ctx = this.ctx;
    const out = this.synthGain;
    if (!ctx || !out) return;
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const roots = [55, 55, 73.42, 65.41]; // A1 A1 D2 C2
    const root = roots[bar];

    // kick
    if (s % 4 === 0) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, time);
      o.frequency.exponentialRampToValueAtTime(42, time + 0.11);
      g.gain.setValueAtTime(0.9, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.19);
      o.connect(g).connect(out);
      o.start(time);
      o.stop(time + 0.2);
    }
    // hat
    if (s % 2 === 1 && this.noiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 7200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.1 + this.intensity * 0.08, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
      src.connect(hp).connect(g).connect(out);
      src.start(time);
      src.stop(time + 0.06);
    }
    // snare
    if (s === 4 || s === 12) {
      if (this.noiseBuf) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.35, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        src.connect(bp).connect(g).connect(out);
        src.start(time);
        src.stop(time + 0.16);
      }
    }
    // bass
    if (s % 2 === 0) {
      const o = ctx.createOscillator();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = root * (s === 10 ? 1.5 : 1);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(420 + this.intensity * 900, time);
      f.Q.value = 7;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.26, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      o.connect(f).connect(g).connect(out);
      o.start(time);
      o.stop(time + 0.17);
    }
    // arp lead
    const pattern = [0, 7, 12, 7, 15, 12, 19, 12];
    if (s % 2 === 0) {
      const semi = pattern[(step / 2) % 8 | 0];
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const d = ctx.createDelay();
      const fb = ctx.createGain();
      o.type = 'square';
      o.frequency.value = root * 4 * Math.pow(2, semi / 12);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.055 + this.intensity * 0.05, time + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0008, time + 0.22);
      d.delayTime.value = 0.26;
      fb.gain.value = 0.3;
      o.connect(g).connect(out);
      g.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(out);
      o.start(time);
      o.stop(time + 0.24);
    }
  }

  /* ------------------------------------------------------------- effects */

  private env(node: AudioNode, t: number, peak: number, dur: number, type: 'exp' | 'lin' = 'exp') {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.005);
    if (type === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else g.gain.linearRampToValueAtTime(0, t + dur);
    node.connect(g);
    g.connect(this.sfxGain!);
    return g;
  }

  private noise(t: number, dur: number, peak: number, filter: BiquadFilterType, freq: number, sweep?: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 1;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t + dur);
    src.connect(f);
    this.env(f, t, peak, dur);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private tone(t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'square') {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(o, t, peak, dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  sfx(name: string, pitch = 1) {
    const ctx = this.ctx;
    if (!ctx || this.sfxVol <= 0) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    switch (name) {
      case 'blaster':
        this.tone(t, 900 * pitch, 180 * pitch, 0.09, 0.2, 'square');
        this.noise(t, 0.06, 0.1, 'highpass', 2400);
        break;
      case 'pulse':
        this.tone(t, 1500 * pitch, 520 * pitch, 0.05, 0.1, 'sawtooth');
        break;
      case 'scatter':
        this.noise(t, 0.26, 0.42, 'lowpass', 2600, 300);
        this.tone(t, 260, 60, 0.2, 0.25, 'square');
        break;
      case 'rail':
        this.tone(t, 2200, 160, 0.42, 0.3, 'sawtooth');
        this.noise(t, 0.35, 0.22, 'bandpass', 3200, 500);
        break;
      case 'hit':
        this.noise(t, 0.07, 0.24, 'bandpass', 1400 * pitch);
        break;
      case 'kill':
        this.noise(t, 0.3, 0.4, 'lowpass', 1800, 160);
        this.tone(t, 380 * pitch, 70, 0.26, 0.2, 'triangle');
        break;
      case 'bigkill':
        this.noise(t, 0.7, 0.55, 'lowpass', 1200, 90);
        this.tone(t, 220, 40, 0.6, 0.3, 'sawtooth');
        break;
      case 'dash':
        this.noise(t, 0.22, 0.26, 'bandpass', 900, 3400);
        break;
      case 'jump':
        this.tone(t, 320, 760, 0.1, 0.12, 'triangle');
        break;
      case 'hurt':
        this.tone(t, 300, 70, 0.3, 0.3, 'sawtooth');
        this.noise(t, 0.2, 0.2, 'lowpass', 900, 200);
        break;
      case 'pickup':
        this.tone(t, 620, 620, 0.07, 0.16, 'square');
        this.tone(t + 0.07, 930, 930, 0.08, 0.16, 'square');
        this.tone(t + 0.15, 1240, 1240, 0.12, 0.14, 'square');
        break;
      case 'wave':
        this.tone(t, 180, 180, 0.3, 0.16, 'sawtooth');
        this.tone(t + 0.12, 270, 270, 0.3, 0.14, 'sawtooth');
        this.tone(t + 0.24, 360, 360, 0.5, 0.14, 'sawtooth');
        break;
      case 'spawn':
        this.tone(t, 90, 1200, 0.5, 0.1, 'sine');
        break;
      case 'over':
        this.tone(t, 420, 60, 1.1, 0.3, 'sawtooth');
        this.tone(t + 0.1, 300, 44, 1.2, 0.22, 'square');
        break;
      case 'ui':
        this.tone(t, 760, 1120, 0.05, 0.1, 'square');
        break;
      case 'spit':
        this.tone(t, 520, 160, 0.16, 0.1, 'sine');
        break;
      case 'empty':
        this.noise(t, 0.05, 0.14, 'highpass', 3000);
        break;
    }
  }
}

export const audio = new AudioEngine();
