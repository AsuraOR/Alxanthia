/**
 * Synthesised stop-motion paper sound design: stamp thumps, a tap for each
 * cut-paper piece placed, tag flicks, sheets sliding, and a soft chime as the
 * logo appears.
 * Deterministic (seeded noise), timed from timeline.js, silent at both ends
 * so the loop is seamless. Writes a 48 kHz stereo 16-bit WAV.
 */
const fs = require('fs');
const TL = require('./timeline.js');

const SR = 48000;

function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// RBJ biquad.
function biquad(type, f0, q) {
  const w = (2 * Math.PI * f0) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; } // band-pass (0 dB peak)
  a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function synth() {
  const N = Math.round(TL.duration * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const rand = rng(20260925);
  const add = (i, v, pan) => { if (i >= 0 && i < N) { L[i] += v * (1 - pan) * 1.4; R[i] += v * (1 + pan) * 1.4; } };

  // Short noise burst through a band-pass: the building block for paper sounds.
  const burst = (t0, dur, f0, q, gain, pan, lowThump) => {
    const bp = biquad('bp', f0, q), lp = biquad('lp', 180, 0.7);
    const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
    for (let k = 0; k < n; k++) {
      const env = Math.min(1, k / (0.002 * SR)) * Math.exp(-k / (n * 0.3));
      const noise = rand() * 2 - 1;
      add(i0 + k, (bp(noise) + (lowThump ? lp(noise) * 3 : 0)) * env * gain, pan);
    }
  };
  const step = 1 / TL.stepFps;
  // Paper taps: one per stop-motion step while pieces are being placed.
  const tapWindow = (a, b, density, gain) => {
    for (let t = a; t < b; t += step) {
      if (rand() > density) continue;
      burst(t + rand() * 0.01, 0.035 + rand() * 0.03, 1400 + rand() * 1800, 1.1, gain * (0.6 + rand() * 0.4), (rand() - 0.5) * 0.6, true);
    }
  };
  // Sheet slide: a longer rustle with crackle.
  const slide = (t0, dur, gain) => {
    const n = Math.round(dur * SR), i0 = Math.round(t0 * SR);
    const lp = biquad('lp', 3200, 0.7), hp = biquad('hp', 350, 0.7), lp2 = biquad('lp', 5000, 0.7);
    let crackle = 0;
    for (let k = 0; k < n; k++) {
      const u = k / n;
      const env = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 1.6);
      if (rand() < 0.004) crackle = 1;
      crackle *= 0.992;
      add(i0 + k, (hp(lp(rand() * 2 - 1)) * 0.2 + lp2((rand() * 2 - 1) * crackle) * 0.28) * env * gain, (u - 0.5) * 0.8);
    }
  };

  const P = TL.plate;
  TL.plateStarts.forEach((s0) => {
    burst(s0 + P.stamp, 0.09, 700, 0.8, 0.5, 0, true);                   // stamp thump
    tapWindow(s0 + P.assemble[0], s0 + P.assemble[1], 0.75, 0.22);       // pieces placed
    burst(s0 + P.tag, 0.06, 3200, 1.4, 0.25, 0.2, false);                // tag flick
    burst(s0 + P.tag + 0.2, 0.05, 2600, 1.4, 0.2, 0.2, true);            // tag lands
    slide(s0 + P.exit[0], P.exit[1] - P.exit[0] + 0.15, 1);              // sheet slides off
  });
  const sun = TL.sun, s0 = TL.sun.start;
  burst(s0 + P.stamp, 0.09, 700, 0.8, 0.5, 0, true);
  tapWindow(s0 + sun.assemble[0], s0 + sun.assemble[1], 0.75, 0.22);
  burst(s0 + sun.tag, 0.06, 3200, 1.4, 0.25, 0.2, false);
  slide(s0 + sun.unlabel[0], 0.45, 0.45);                                // sticker + tag lifted away
  for (let t = s0 + sun.flip[0]; t < s0 + sun.flip[1]; t += step) {       // pieces flipping over
    burst(t, 0.03, 4200 + rand() * 1500, 1.6, 0.12, (rand() - 0.5) * 0.8, false);
  }
  const lk = TL.lockup;
  for (let i = 0; i < 9; i++) burst(lk.letters[0] + i * 0.09 + 0.3, 0.04, 1800 + rand() * 600, 1.2, 0.2, (i - 4) / 8, true);
  for (const t of [lk.tagline, lk.comingSoon, lk.handle]) burst(t + 0.3, 0.07, 1500, 1, 0.3, 0, true);
  slide(TL.cover[0], TL.cover[1] - TL.cover[0], 1);                      // blank sheet slides back in

  // Chime: soft bell partials, then a Schroeder reverb on the chime bus.
  const bus = new Float32Array(N);
  const bell = (t0, f, gain) => {
    const partials = [[1, 1, 0.9], [2.0, 0.45, 0.55], [2.76, 0.28, 0.4], [5.4, 0.1, 0.22]];
    const i0 = Math.round(t0 * SR), n = Math.round(3.6 * SR);
    for (let k = 0; k < n && i0 + k < N; k++) {
      const tt = k / SR, att = Math.min(1, tt / 0.004);
      let v = 0;
      for (const [r, a, tau] of partials) v += a * Math.sin(2 * Math.PI * f * r * tt) * Math.exp(-tt / tau);
      bus[i0 + k] += v * att * gain;
    }
  };
  bell(TL.sparkles[0], 1046.5, 0.09);                     // C6 — logo lands
  bell(TL.sparkles[0] + 0.32, 1568.0, 0.055);             // G6 — sparkles
  bell(TL.lockup.comingSoon + 0.3, 1318.5, 0.045);        // E6 — "Coming soon"
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d), i: 0, g: 0.8 }));
  const aps = [225, 556].map((d) => ({ buf: new Float32Array(d), i: 0 }));
  for (let k = 0; k < N; k++) {
    const x = bus[k];
    let wet = 0;
    for (const c of combs) { const y = c.buf[c.i]; c.buf[c.i] = x + y * c.g; c.i = (c.i + 1) % c.buf.length; wet += y; }
    wet *= 0.25;
    for (const a of aps) { const y = a.buf[a.i]; const v = -0.5 * wet + y; a.buf[a.i] = wet + 0.5 * y; a.i = (a.i + 1) % a.buf.length; wet = v; }
    L[k] += x + wet * 0.35; R[k] += x + wet * 0.35 * 0.9;
  }

  // Guarantee silence at the loop point.
  const fadeFrom = Math.round((TL.duration - 0.4) * SR);
  for (let k = fadeFrom; k < N; k++) { const g = 1 - (k - fadeFrom) / (N - fadeFrom); L[k] *= g; R[k] *= g; }
  return [L, R];
}

function writeWav(file) {
  const [L, R] = synth();
  let peak = 0;
  for (let k = 0; k < L.length; k++) peak = Math.max(peak, Math.abs(L[k]), Math.abs(R[k]));
  const norm = peak > 0 ? 0.6 / peak : 1; // peak ≈ −4.4 dBFS: quiet enough to sit under IG music
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let k = 0; k < n; k++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[k] * norm)) * 32767), 44 + k * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[k] * norm)) * 32767), 46 + k * 4);
  }
  fs.writeFileSync(file, buf);
}

module.exports = { writeWav };
if (require.main === module) writeWav(process.argv[2] || 'sfx.wav');
