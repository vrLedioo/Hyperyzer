/**
 * Offline render of the Hyperyzer ad soundtrack → public/soundtrack.wav.
 *
 * The design handoff synthesizes its audio live with the Web Audio API (the
 * `AdAudio` class in animations.jsx). Remotion renders frames in a headless
 * browser and cannot capture live Web Audio, so we rebuild the exact same node
 * graph in an OfflineAudioContext (node-web-audio-api), schedule every event
 * deterministically across the 30s timeline, render faster-than-realtime, and
 * write a WAV that the composition mounts via <Audio>.
 *
 *   node scripts/render-audio.mjs
 *
 * The synthesis (oscillators, envelopes, filter sweeps, SFX) is ported verbatim
 * from the prototype; only the real-time scheduler/`update()` loop is replaced
 * with absolute-time scheduling (an offline context has no wall clock).
 */
import { OfflineAudioContext } from "node-web-audio-api";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const DUR = 30; // seconds — matches the composition
const BPM = 124;
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "soundtrack.wav",
);

const ctx = new OfflineAudioContext({
  numberOfChannels: 1,
  length: Math.ceil(DUR * SR),
  sampleRate: SR,
});

// ── master + soft limiter (verbatim from AdAudio) ───────────────────────────
const master = ctx.createGain();
// Prototype used 0.85; the fast-attack compressor lets percussive transients
// (kick/impact/boom) overshoot to full scale, so we trim a little for headroom
// — a clean master beats a faithful-but-clipped one. Mix balance is unchanged.
master.gain.value = 0.72;
master.connect(ctx.destination);

const comp = ctx.createDynamicsCompressor();
comp.threshold.value = -14;
comp.knee.value = 28;
comp.ratio.value = 6;
comp.attack.value = 0.004;
comp.release.value = 0.18;
comp.connect(master);
const bus = comp;

// ── pad / drone ─────────────────────────────────────────────────────────────
const padFilter = ctx.createBiquadFilter();
padFilter.type = "lowpass";
padFilter.frequency.value = 380;
padFilter.Q.value = 1.4;
const padGain = ctx.createGain();
padGain.gain.value = 0.0;
padFilter.connect(padGain);
padGain.connect(bus);

const chord = [55, 110, 164.81, 220, 329.63]; // A1 A2 E3 A3 E4
chord.forEach((f, i) => {
  const o = ctx.createOscillator();
  o.type = i < 3 ? "sawtooth" : "triangle";
  o.frequency.value = f;
  const det = ctx.createOscillator();
  det.type = "sawtooth";
  det.frequency.value = f * 1.005;
  const g = ctx.createGain();
  g.gain.value = i === 0 ? 0.22 : i < 3 ? 0.12 : 0.07;
  o.connect(g);
  det.connect(g);
  g.connect(padFilter);
  o.start(0);
  det.start(0);
  o.stop(DUR);
  det.stop(DUR);
});

// slow filter LFO for movement
const lfo = ctx.createOscillator();
lfo.frequency.value = 0.07;
const lfoG = ctx.createGain();
lfoG.gain.value = 160;
lfo.connect(lfoG);
lfoG.connect(padFilter.frequency);
lfo.start(0);
lfo.stop(DUR);

// ── arp + kick buses ────────────────────────────────────────────────────────
const arpGain = ctx.createGain();
arpGain.gain.value = 0.0;
arpGain.connect(bus);
const kickGain = ctx.createGain();
kickGain.gain.value = 0.0;
kickGain.connect(bus);

// ── noise buffer for SFX ────────────────────────────────────────────────────
const noiseBuf = ctx.createBuffer(1, Math.floor(SR * 1.2), SR);
const nd = noiseBuf.getChannelData(0);
for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

// ── section mix automation (from AdAudio.update, scheduled at boundaries) ─────
// NOTE: the prototype smooths section changes with setTargetAtTime, but
// node-web-audio-api@2's setTargetAtTime diverges for small time constants
// (it ran away to >1e9, railing the whole mix). Linear ramps over the same
// short windows are stable and inaudibly different for a mix automation.
const automate = (param, v0, steps) => {
  param.setValueAtTime(v0, 0);
  let prev = v0;
  let lastT = 0;
  for (const { at, to, dur } of steps) {
    if (at > lastT) param.setValueAtTime(prev, at); // hold prior value to the boundary
    param.linearRampToValueAtTime(to, at + dur);
    prev = to;
    lastT = at + dur;
  }
};

// padGain — dark drone swells in, then sits under the groove, lifts for the CTA
automate(padGain.gain, 0.0001, [
  { at: 0, to: 0.5, dur: 1.0 },
  { at: 6, to: 0.42, dur: 0.3 },
  { at: 8, to: 0.34, dur: 0.3 },
  { at: 26, to: 0.5, dur: 0.3 },
]);
// padFilter frequency — section 1 rises 360→540, then opens up per section
automate(padFilter.frequency, 360, [
  { at: 0, to: 540, dur: 6 },
  { at: 6, to: 1400, dur: 0.3 },
  { at: 8, to: 2200, dur: 0.3 },
  { at: 22, to: 2000, dur: 0.3 },
  { at: 26, to: 1100, dur: 0.3 },
]);
// arpGain — silent until the reveal at 6s
automate(arpGain.gain, 0.0001, [
  { at: 6, to: 0.18, dur: 0.2 },
  { at: 8, to: 0.4, dur: 0.2 },
  { at: 22, to: 0.36, dur: 0.2 },
  { at: 26, to: 0.14, dur: 0.2 },
]);
// kickGain — full groove, then drops out at 28.4 for the airy resolve
automate(kickGain.gain, 0.0001, [
  { at: 6, to: 0.8, dur: 0.15 },
  { at: 8, to: 0.95, dur: 0.15 },
  { at: 26, to: 0.35, dur: 0.15 },
  { at: 28.4, to: 0.0001, dur: 0.15 },
]);

// ── voices ──────────────────────────────────────────────────────────────────
function pluck(freq, t, dur, vel = 1) {
  const o = ctx.createOscillator();
  o.type = "triangle";
  o.frequency.value = freq;
  const o2 = ctx.createOscillator();
  o2.type = "square";
  o2.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 2600;
  f.Q.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const sub = ctx.createGain();
  sub.gain.value = 0.5;
  o.connect(g);
  o2.connect(sub);
  sub.connect(g);
  g.connect(f);
  f.connect(arpGain);
  o.start(t);
  o2.start(t);
  o.stop(t + dur + 0.02);
  o2.stop(t + dur + 0.02);
}

function kick(t, vel = 1) {
  const o = ctx.createOscillator();
  o.type = "sine";
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g);
  g.connect(kickGain);
  o.start(t);
  o.stop(t + 0.26);
}

// 16th-note groove, scheduled across the whole timeline.
const sixteenth = 60 / BPM / 4;
const arpScale = [220, 261.63, 329.63, 392, 523.25, 392, 329.63, 261.63];
const sectionOn = (t) => {
  if (t < 6) return { arpOn: false, kickOn: false };
  if (t < 26) return { arpOn: true, kickOn: true };
  return { arpOn: true, kickOn: t < 28.4 };
};
for (let step = 0; step * sixteenth < DUR; step++) {
  const t = step * sixteenth;
  const beat = step % 4;
  const bar16 = step % 16;
  const { arpOn, kickOn } = sectionOn(t);
  if (kickOn && beat === 0) kick(t, 1);
  if (kickOn && bar16 === 10) kick(t, 0.5);
  if (arpOn) {
    const f = arpScale[step % arpScale.length];
    pluck(f, t, sixteenth * 1.6, 1);
    if (bar16 % 4 === 0) pluck(f * 2, t, sixteenth * 1.2, 0.4);
  }
}

// ── one-shot SFX (verbatim port; `t` is the absolute cue time) ───────────────
function noise(t, dur, type = "highpass", freq = 1000, peak = 0.5, sweep = null) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = 0.8;
  if (sweep) {
    f.frequency.setValueAtTime(sweep[0], t);
    f.frequency.exponentialRampToValueAtTime(sweep[1], t + dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(bus);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function sfx(type, t) {
  if (type === "impact") {
    const o = ctx.createOscillator();
    o.type = "sine";
    const g = ctx.createGain();
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.28);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.5);
    noise(t, 0.18, "bandpass", 1800, 0.5);
  } else if (type === "glitch") {
    noise(t, 0.08, "highpass", 2600, 0.35);
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 90;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.08);
  } else if (type === "riser") {
    noise(t, 1.0, "bandpass", 600, 0.42, [400, 6000]);
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.95);
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(440, t + 1.0);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 1.05);
  } else if (type === "whoosh") {
    noise(t, 0.55, "bandpass", 800, 0.5, [300, 4000]);
  } else if (type === "boom") {
    const o = ctx.createOscillator();
    o.type = "sine";
    const g = ctx.createGain();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.5);
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.95);
  } else if (type === "tick") {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.05);
  } else if (type === "pop") {
    const o = ctx.createOscillator();
    o.type = "sine";
    const g = ctx.createGain();
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.14);
  } else if (type === "ding") {
    [880, 1320, 1760].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      const peak = 0.22 / (i + 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + 0.65);
    });
  } else if (type === "powerup") {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(5000, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.5);
    o.connect(f);
    f.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + 0.65);
  } else if (type === "chime") {
    [523.25, 659.25, 783.99, 1046.5].forEach((fr, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = fr;
      const g = ctx.createGain();
      const st = t + i * 0.06;
      const peak = 0.18 / (i * 0.5 + 1);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(peak, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 1.1);
      o.connect(g);
      g.connect(bus);
      o.start(st);
      o.stop(st + 1.2);
    });
  }
}

// SFX cue sheet — [second, type] (verbatim from animations.jsx)
const AD_CUES = [
  [0.12, "impact"], [0.2, "glitch"],
  [1.7, "impact"],
  [3.5, "glitch"], [4.2, "glitch"], [4.9, "glitch"],
  [5.2, "riser"],
  [6.0, "boom"], [6.02, "whoosh"],
  [6.7, "chime"],
  [8.2, "pop"],
  [9.7, "ding"], [10.9, "ding"], [12.1, "ding"],
  [12.7, "pop"], [12.86, "pop"], [13.02, "pop"], [13.18, "pop"], [13.34, "pop"],
  [14.3, "whoosh"], [14.5, "ding"],
  [16.2, "whoosh"],
  [17.1, "tick"], [17.5, "tick"], [17.9, "tick"], [18.3, "tick"], [18.7, "tick"],
  [19.6, "powerup"],
  [22.1, "whoosh"], [22.4, "pop"], [22.9, "pop"], [23.4, "pop"],
  [26.0, "boom"], [26.02, "whoosh"],
  [26.8, "chime"],
  [28.3, "ding"],
];
for (const [ct, type] of AD_CUES) sfx(type, ct);

// ── render + write WAV (16-bit PCM mono) ─────────────────────────────────────
const buffer = await ctx.startRendering();
const data = buffer.getChannelData(0);
const n = data.length;

const bytesPerSample = 2;
const dataSize = n * bytesPerSample;
const out = Buffer.alloc(44 + dataSize);
out.write("RIFF", 0);
out.writeUInt32LE(36 + dataSize, 4);
out.write("WAVE", 8);
out.write("fmt ", 12);
out.writeUInt32LE(16, 16); // fmt chunk size
out.writeUInt16LE(1, 20); // PCM
out.writeUInt16LE(1, 22); // mono
out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * bytesPerSample, 28); // byte rate
out.writeUInt16LE(bytesPerSample, 32); // block align
out.writeUInt16LE(16, 34); // bits per sample
out.write("data", 36);
out.writeUInt32LE(dataSize, 40);

let rawPeak = 0;
let clipped = 0;
for (let i = 0; i < n; i++) {
  const raw = data[i];
  if (Math.abs(raw) > rawPeak) rawPeak = Math.abs(raw);
  if (Math.abs(raw) > 1) clipped++;
  const s = Math.max(-1, Math.min(1, raw));
  out.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, 44 + i * bytesPerSample);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out);
console.log(
  `Wrote ${OUT} — ${(dataSize / 1e6).toFixed(2)} MB, ${DUR}s @ ${SR}Hz · ` +
    `raw peak ${rawPeak.toFixed(3)}, clipped samples ${clipped}/${n}`,
);
