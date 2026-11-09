/**
 * Every sound is made here with WebAudio: no files. Soft and round, for a calm game: chimes on a
 * pentatonic scale (any two sound fine together), thuds and pops, and an engine hum that rises with
 * speed. Browsers start audio only after a key or button, so `unlock` waits for one.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/**
 * How loud, picked with the sound button: loud, medium, quiet, off, round again. Kept on this
 * device so a grown-up's choice sticks.
 */
const LEVELS = [0.55, 0.3, 0.13, 0];
const VOL_KEY = "dig-site/volume/v1";
let level = (() => {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isInteger(v) && v >= 0 && v < LEVELS.length ? v : 0;
  } catch {
    return 0;
  }
})();

export function unlock(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = LEVELS[level];
  master.connect(ctx.destination);
  startEngine();
  startMusic();
}

/** Hushes everything while the game's in the background (another app, a locked screen). */
export function pause(on: boolean): void {
  if (!ctx) return;
  if (on && ctx.state === "running") void ctx.suspend();
  else if (!on && ctx.state === "suspended") void ctx.resume();
}

/** The volume step now: 0 loud .. 3 off. */
export function volume(): number {
  return level;
}

/** On to the next volume step (loud, medium, quiet, off, loud...); returns it. */
export function nextVolume(): number {
  level = (level + 1) % LEVELS.length;
  if (master && ctx) master.gain.setTargetAtTime(LEVELS[level], ctx.currentTime, 0.05);
  try {
    localStorage.setItem(VOL_KEY, String(level));
  } catch {
    // Not kept: fine.
  }
  // A little blip at the new loudness, so you can hear what you picked.
  if (level < LEVELS.length - 1) pop();
  return level;
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
  duck(1.2);
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

/** The roller pressing a slab of path down: a soft low crunch. */
export function crunch(): void {
  const t = now();
  noise(t, 0.16, 0.12, 260, 0.9);
  tone(70, t, 0.14, "sine", 0.12, 0.8);
}

/** A happy two-note "hello" from a townsperson. */
export function hello(step = 0): void {
  const t = now();
  tone(note(5 + (step % 4)), t, 0.22, "sine", 0.1);
  tone(note(7 + (step % 4)), t + 0.12, 0.3, "sine", 0.1);
}

/** Opening a building site: a rising sweep. */
export function whoosh(): void {
  const t = now();
  noise(t, 0.45, 0.1, 700, 0.5);
  tone(260, t, 0.4, "sine", 0.1, 2);
}

export function fanfare(): void {
  const t = now();
  duck(3);
  const seq = [0, 2, 3, 4, 5, 7];
  seq.forEach((s, i) => {
    tone(note(s), t + i * 0.13, 0.9, "sine", 0.22);
    tone(note(s) / 2, t + i * 0.13, 0.9, "triangle", 0.08);
  });
  [5, 7, 9].forEach((s) => tone(note(s), t + 0.9, 1.6, "sine", 0.14));
}

// ---- engine hum: two detuned soft waves through a low-pass, pitch and loudness follow `setEngine`.
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
    o.type = "triangle";
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
  engFilter.frequency.setTargetAtTime(180 + load * 280, t, 0.15);
  engGain.gain.setTargetAtTime(running ? 0.04 + load * 0.05 : 0, t, 0.2);
}

// ---- music: a gentle loop made on the fly. Soft marimba over a warm pad and a round bass, in a
// major pentatonic (so any note sits nicely with any other), at an easy walking pace. The tune
// wanders a little differently every eight bars, so it never gets samey. Quiet under everything else.

const MUSIC_VOL = 0.14;
const BEAT = 60 / 88;
// C, A minor, F, G: the four chords it goes round, as semitones above middle C.
const CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
const MELODY = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; // C major pentatonic, two octaves up from C5
let musicGain: GainNode | null = null;
let nextBeat = 0;
let beat = 0;
let lastNote = 4;

const pitch = (semi: number, base = 261.63) => base * Math.pow(2, semi / 12);

function startMusic(): void {
  if (!ctx || !master) return;
  musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.gain.setTargetAtTime(MUSIC_VOL, ctx.currentTime + 0.5, 2); // fades in
  musicGain.connect(master);
  nextBeat = ctx.currentTime + 0.6;
}

function voice(freq: number, at: number, dur: number, vol: number, type: OscillatorType, attack = 0.01): void {
  if (!ctx || !musicGain) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(musicGain);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** A soft marimba note: a round tone that dies away, and a faint ping above it. */
function marimba(freq: number, at: number, vol: number): void {
  voice(freq, at, 0.6, vol, "sine");
  voice(freq * 4, at, 0.12, vol * 0.18, "sine");
}

/** A little seeded dice, so each eight-bar phrase plays its own tune (but the same one if repeated). */
function dice(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function playBeat(b: number, t: number): void {
  const bar = Math.floor(b / 4);
  const inBar = b % 4;
  const chord = CHORDS[bar % 4];
  const phrase = Math.floor(bar / 8);
  if (inBar === 0) {
    // The pad: the chord, swelling in slowly and held for the bar.
    for (const s of chord) voice(pitch(s), t, BEAT * 4.2, 0.022, "sine", 0.6);
  }
  if (inBar === 0 || inBar === 2) voice(pitch(chord[0] - 12), t, BEAT * 1.8, 0.075, "triangle", 0.03); // bass
  // The tune: eighth notes, about half of them sounded, stepping round the scale, landing on chord
  // notes on the strong beats.
  for (const half of [0, 1]) {
    const r = dice(phrase * 13 + (bar % 8), inBar * 2 + half);
    if (r > (half === 0 ? 0.75 : 0.45)) continue;
    let k = lastNote + Math.round((dice(bar + 7, b * 3 + half) - 0.5) * 4);
    k = Math.max(0, Math.min(MELODY.length - 1, k));
    if (half === 0 && inBar % 2 === 0) {
      // Pull to the nearest note of the chord.
      let best = k, bd = 99;
      for (let j = 0; j < MELODY.length; j++) {
        const n = ((MELODY[j] % 12) + 12) % 12;
        if (!chord.some((c) => ((c % 12) + 12) % 12 === n)) continue;
        if (Math.abs(j - k) < bd) [best, bd] = [j, Math.abs(j - k)];
      }
      k = best;
    }
    lastNote = k;
    marimba(pitch(MELODY[k] + 12), t + half * BEAT * 0.5, half ? 0.045 : 0.06);
  }
}

/** Called every frame: keeps the next quarter second of music lined up. */
export function music(): void {
  if (!ctx || !musicGain || ctx.state !== "running") return;
  if (nextBeat < ctx.currentTime - 0.3) nextBeat = ctx.currentTime + 0.05; // back from a pause
  while (nextBeat < ctx.currentTime + 0.25) {
    playBeat(beat, nextBeat);
    beat++;
    nextBeat += BEAT;
  }
}

/** Turns the music right down for a moment, so a fanfare rings out. */
function duck(seconds: number): void {
  if (!ctx || !musicGain) return;
  const t = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setTargetAtTime(MUSIC_VOL * 0.25, t, 0.08);
  musicGain.gain.setTargetAtTime(MUSIC_VOL, t + seconds, 0.8);
}
