import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "assets", "audio", "scrollback-pulse-bed.wav");

const sampleRate = 44100;
const seconds = 60;
const bpm = 92;
const beat = 60 / bpm;
const totalSamples = sampleRate * seconds;
const data = new Int16Array(totalSamples);

const bassNotes = [55, 55, 73.42, 65.41, 82.41, 73.42, 65.41, 49];
const glassNotes = [220, 246.94, 293.66, 329.63, 392, 440, 493.88, 587.33];

const env = (t, attack, decay) => {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / decay);
};

const softClip = (x) => Math.tanh(x * 1.4) / Math.tanh(1.4);

for (let i = 0; i < totalSamples; i += 1) {
  const t = i / sampleRate;
  const beatPos = t / beat;
  const step = Math.floor(beatPos * 2);
  const bar = Math.floor(beatPos / 4);
  const halfBeat = (beatPos * 2) % 1;
  const pulse = env(halfBeat * beat * 0.5, 0.012, 0.24);
  const phase = Math.PI * 2;

  const bass = bassNotes[bar % bassNotes.length];
  let sample = Math.sin(phase * bass * t) * 0.18;
  sample += Math.sin(phase * bass * 0.5 * t) * 0.12;
  sample *= 0.72 + pulse * 0.28;

  const kickT = (beatPos % 2) * beat;
  const kickEnv = env(kickT, 0.006, 0.18);
  sample += Math.sin(phase * (44 + 30 * Math.exp(-kickT * 14)) * t) * kickEnv * 0.22;

  if (step % 4 === 1 || step % 8 === 6) {
    const note = glassNotes[(step + bar) % glassNotes.length];
    const hitT = halfBeat * beat * 0.5;
    const hitEnv = env(hitT, 0.004, 0.9);
    sample += Math.sin(phase * note * t) * hitEnv * 0.09;
    sample += Math.sin(phase * note * 2.01 * t) * hitEnv * 0.035;
  }

  const shimmer = Math.sin(phase * 880 * t + Math.sin(phase * 0.08 * t) * 1.2);
  const lateLift = t > 43 ? Math.min(1, (t - 43) / 8) : 0;
  sample += shimmer * (0.012 + lateLift * 0.018);

  const resolve = t > 52 ? Math.max(0, 1 - (t - 52) / 8) : 1;
  const fadeIn = Math.min(1, t / 2.5);
  const fadeOut = Math.min(1, (seconds - t) / 4);
  sample *= fadeIn * fadeOut * (0.86 + lateLift * 0.1) * (0.82 + resolve * 0.18);
  data[i] = Math.round(softClip(sample) * 32767);
}

const buffer = Buffer.alloc(44 + data.length * 2);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + data.length * 2, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(data.length * 2, 40);

for (let i = 0; i < data.length; i += 1) {
  buffer.writeInt16LE(data[i], 44 + i * 2);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, buffer);
console.log(`Wrote ${output}`);
