// The offline version of kplayer's concert hall (scripts/lib/hall.ts), as render-audio --hall uses it.
import { describe, expect, it } from 'vitest';
import { applyHall, convolve } from '../scripts/lib/hall';

describe('offline hall', () => {
  it('convolves by FFT as directly', () => {
    const x = Float32Array.from({ length: 3000 }, (_, i) => Math.sin(i * 0.37) + ((i * 7919) % 13) / 13 - 0.5);
    const h = Float32Array.from({ length: 700 }, (_, i) => Math.exp(-i / 100) * Math.cos(i * 0.9));
    const fast = convolve(x, h);
    expect(fast.length).toBe(x.length + h.length - 1);
    for (const n of [0, 1, 699, 1500, 2999, 3698]) {
      let direct = 0;
      for (let k = Math.max(0, n - x.length + 1); k <= Math.min(n, h.length - 1); k++) direct += h[k] * x[n - k];
      expect(fast[n]).toBeCloseTo(direct, 9);
    }
    expect(convolve(x, h, 100)).toHaveLength(100);
  });

  it('adds a tail to a click, and nothing to silence', () => {
    const rate = 44100;
    const n = rate * 3;
    const l = new Float32Array(n);
    const r = new Float32Array(n);
    applyHall(l, r, rate);
    expect(l.every((v) => v === 0)).toBe(true);
    l[0] = r[0] = 1;
    applyHall(l, r, rate);
    const energy = (from: number, to: number) => l.subarray(from * rate, to * rate).reduce((s, v) => s + v * v, 0);
    expect(energy(0.5, 1)).toBeGreaterThan(0);
    expect(energy(0.5, 1)).toBeGreaterThan(energy(1.5, 2) * 10);
  });
});
