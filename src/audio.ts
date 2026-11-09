/**
 * Every sound is made here with WebAudio: no files. Soft and round, for a calm game: chimes on a
 * pentatonic scale (any two sound fine together), thuds and pops, and an engine hum that rises with
 * speed. Browsers start audio only after a key or button, so `unlock` waits for one.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function unlock(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  startEngine();
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.05);
  return muted;
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (step: number, base = 523.25) => base * Math.pow(2, PENTA[Math.max(0, Math.min(PENTA.length - 1, step))] / 12);

function tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, glide = 0): void {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function noise(at: number, dur: number, vol: number, freq: number, q = 0.8): void {
  if (!ctx || !master) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(master);
  src.start(at);
}

const now = () => ctx?.currentTime ?? 0;

/** One bright note; `step` climbs the scale as a task fills in. */
export function chime(step = 0): void {
  const t = now();
  tone(note(step), t, 0.6, "sine", 0.22);
  tone(note(step) * 2, t, 0.35, "triangle", 0.06);
}

/** A section done: three notes up. */
export function sectionDone(step = 0): void {
  const t = now();
  [0, 2, 4].forEach((k, i) => {
    tone(note(step + k), t + i * 0.11, 0.7, "sine", 0.22);
    tone(note(step + k) * 2, t + i * 0.11, 0.4, "triangle", 0.05);
  });
  pop();
}

export function pop(): void {
  const t = now();
  tone(320, t, 0.12, "sine", 0.3, 2.4);
}

export function thud(): void {
  const t = now();
  tone(110, t, 0.25, "sine", 0.4, 0.5);
  noise(t, 0.2, 0.25, 400);
}

export function scoop(): void {
  noise(now(), 0.35, 0.18, 900, 0.6);
}

export function dump(): void {
  const t = now();
  noise(t, 0.5, 0.22, 500, 0.5);
  tone(90, t, 0.3, "sine", 0.2, 0.7);
}

export function clank(): void {
  const t = now();
  tone(660, t, 0.18, "square", 0.05, 0.98);
  tone(990, t, 0.12, "triangle", 0.06);
}

export function hop(): void {
  const t = now();
  tone(420, t, 0.18, "sine", 0.18, 1.8);
}

export function splash(): void {
  noise(now(), 0.12, 0.08, 1400, 1.2);
}

export function fanfare(): void {
  const t = now();
  const seq = [0, 2, 3, 4, 5, 7];
  seq.forEach((s, i) => {
    tone(note(s), t + i * 0.13, 0.9, "sine", 0.22);
    tone(note(s) / 2, t + i * 0.13, 0.9, "triangle", 0.08);
  });
  [5, 7, 9].forEach((s) => tone(note(s), t + 0.9, 1.6, "sine", 0.14));
}

// ---- engine hum: two detuned saws through a low-pass, pitch and loudness follow `setEngine`.
let engOsc: OscillatorNode[] = [];
let engGain: GainNode | null = null;
let engFilter: BiquadFilterNode | null = null;

function startEngine(): void {
  if (!ctx || !master) return;
  engGain = ctx.createGain();
  engGain.gain.value = 0;
  engFilter = ctx.createBiquadFilter();
  engFilter.type = "lowpass";
  engFilter.frequency.value = 300;
  engFilter.connect(engGain).connect(master);
  engOsc = [0, 7].map((det) => {
    const o = ctx!.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = 48;
    o.detune.value = det;
    o.connect(engFilter!);
    o.start();
    return o;
  });
}

/** `load` 0..1: idle to flat out. */
export function setEngine(load: number, running: boolean): void {
  if (!ctx || !engGain || !engFilter) return;
  const t = ctx.currentTime;
  const f = 42 + load * 30;
  for (const o of engOsc) o.frequency.setTargetAtTime(f, t, 0.15);
  engFilter.frequency.setTargetAtTime(220 + load * 380, t, 0.15);
  engGain.gain.setTargetAtTime(running ? 0.05 + load * 0.06 : 0, t, 0.2);
}
