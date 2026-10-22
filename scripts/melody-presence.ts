// How continuous a voiced piano part sounds, bar by bar: whether the leading
// voices (the tune) are heard through each bar or only at their attacks, and
// whether the bar is carried by its downbeat with little in between. Renders the
// part and its leading voices alone through kplayer's synth and piano, and
// measures the loudness of every half beat (eighth note).
//
// Usage: npx tsx scripts/melody-presence.ts score.mxl performance.kplayer.json [--voicing file.json] [--part 1]
//          [--lead melody,clarinet16] [--bars 1-20] [--quiet]
//
// For each bar:
//   tune      how far the leading voices sit below the whole part, median over the bar's eighths (0 dB: the tune
//             is all you hear; −10 dB: it has faded into the accompaniment or isn't playing)
//   heard     how many of the bar's eighths have the tune within 6 dB of the whole part
//   downbeat  how much louder the first eighth is than the rest of the bar (a bar carried by its downbeat)
//   gaps      eighths more than 12 dB below the bar's loudest: near silence between the attacks
// --voicing takes its voices (and lead) in place of the performance's, keeping the performance's dynamic shape.

import fs from 'node:fs';
import { breathWindow, resolveAnchor } from 'kplayer/src/perf/anchors';
import { compileGestures } from 'kplayer/src/perf/compile';
import { shapeDynamics } from 'kplayer/src/perf/dynamics';
import { renderPerformanceMidi } from 'kplayer/src/perf/render';
import { buildTimeMap } from 'kplayer/src/perf/timeline';
import type { DynamicsDoc } from 'kplayer/src/perf/types';
import { parseDoc } from 'kplayer/src/storage/persist';
import { loadScoreFile } from './lib/load-score';
import { lufs, weightedPowerSum } from './lib/loudness';
import { createRenderer } from './lib/render';

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? undefined : args.splice(i, 2)[1];
};
const quiet = args.includes('--quiet') ? (args.splice(args.indexOf('--quiet'), 1), true) : false;
const voicingFile = opt('voicing');
const partIndex = Number(opt('part') ?? 1);
const leadOpt = opt('lead');
const [firstBar, lastBar] = (opt('bars') ?? '1-9999').split('-').map(Number);
const [scoreFile, docFile] = args;
if (!docFile) throw new Error('Usage: melody-presence.ts score.mxl performance.kplayer.json [--voicing file.json] [--part 1] [--lead ids] [--bars 1-20] [--quiet]');

const score = await loadScoreFile(scoreFile);
const doc = parseDoc(fs.readFileSync(docFile, 'utf8'));
let dynamics: DynamicsDoc | undefined = doc.dynamics;
if (voicingFile) {
  const raw = JSON.parse(fs.readFileSync(voicingFile, 'utf8'));
  const v: DynamicsDoc = raw.dynamics ?? raw;
  dynamics = { ...(dynamics ?? {}), voices: v.voices, pulse: v.pulse, pedal: v.pedal ?? dynamics?.pedal, leadMs: v.leadMs ?? dynamics?.leadMs };
}
if (!dynamics?.voices.length) throw new Error('No voices');
const leads = new Set(leadOpt ? leadOpt.split(',') : dynamics.voices.filter((v) => v.lead).map((v) => v.id));

const resolve = (a: Parameters<typeof resolveAnchor>[1]) => resolveAnchor(score.index, a);
const map = buildTimeMap({
  tempos: score.events.tempos,
  endQ: score.index.endQ,
  tempoFactor: doc.tempoFactor,
  gestures: compileGestures(doc.gestures, resolve, (q, staff) => breathWindow(score.staffSpans, q, staff)),
});
const shaped = shapeDynamics({ events: score.events, marks: score.dynamics, hairpins: score.hairpins, doc: dynamics, resolve, barStarts: score.index.played.map((m) => m.q0) });
const part = shaped.parts.find((p) => p.index === partIndex)!;
const renderer = createRenderer(32000, { pianoOnly: part.program < 8 });
const render = async (notes: typeof part.notes) => {
  const midi = renderPerformanceMidi({ ...shaped, parts: [{ ...part, notes }] }, map, { parts: doc.parts });
  const { left, right } = await renderer.render(midi, map.duration + 2);
  return weightedPowerSum(left, right, renderer.rate);
};
const all = await render(part.notes);
const tune = await render(part.notes.filter((n) => leads.has(n.voice ?? '')));
const slot = (cum: Float64Array, q0: number, q1: number) => {
  const a = Math.round(map.T(q0) * renderer.rate);
  const b = Math.max(a + 1, Math.round(map.T(q1) * renderer.rate));
  return lufs((cum[Math.min(b, cum.length - 1)] - cum[Math.min(a, cum.length - 1)]) / (b - a));
};

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
const energyMean = (xs: number[]) => 10 * Math.log10(xs.reduce((s, x) => s + 10 ** (x / 10), 0) / xs.length);
const rows: { label: string; tune: number; heard: number; slots: number; downbeat: number; gaps: number; level: number }[] = [];
for (const m of score.index.played) {
  const label = score.index.measures[m.measureIndex].label;
  if (Number(label) < firstBar || Number(label) > lastBar) continue;
  const qs: number[] = [];
  for (let q = m.q0; q < m.q1 - 1e-6; q += 0.5) qs.push(q);
  const mix = qs.map((q) => slot(all, q, Math.min(q + 0.5, m.q1)));
  const mel = qs.map((q) => slot(tune, q, Math.min(q + 0.5, m.q1)));
  const loudest = Math.max(...mix);
  if (loudest < -70) continue;
  const presence = mel.map((l, i) => l - mix[i]);
  rows.push({
    label,
    tune: median(presence),
    heard: presence.filter((p) => p >= -6).length,
    slots: qs.length,
    downbeat: qs.length > 1 ? mix[0] - energyMean(mix.slice(1)) : 0,
    gaps: mix.filter((l) => l < loudest - 12).length,
    level: energyMean(mix),
  });
}
const fmt = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
if (!quiet) {
  console.log(`bar   tune dB  heard   downbeat dB  gaps   loudness (LUFS)   leading voices: ${[...leads].join(', ')}`);
  for (const r of rows) console.log(`${r.label.padStart(3)}   ${fmt(r.tune).padStart(6)}   ${`${r.heard}/${r.slots}`.padStart(5)}   ${fmt(r.downbeat).padStart(8)}     ${String(r.gaps).padStart(2)}    ${r.level.toFixed(1)}`);
}
const heard = rows.reduce((s, r) => s + r.heard, 0) / rows.reduce((s, r) => s + r.slots, 0);
console.log(
  `${rows.length} bars: tune heard in ${Math.round(heard * 100)}% of eighths, median ${fmt(median(rows.map((r) => r.tune)))} dB under the whole part; ` +
    `downbeat ${fmt(median(rows.map((r) => r.downbeat)))} dB over the rest of the bar; ` +
    `${(rows.reduce((s, r) => s + r.gaps, 0) / rows.length).toFixed(1)} gaps a bar; loudness median ${median(rows.map((r) => r.level)).toFixed(1)} LUFS`,
);
