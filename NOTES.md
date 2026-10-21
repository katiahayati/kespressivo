# Notes

Findings from building kespressivo's tools: what worked, what didn't, and why. kplayer's NOTES.md has the engine,
Verovio, SpessaSynth and piano findings.

## Aligning recordings (tools/align_recording.py)

- synctoolbox's multiscale DTW (chroma + DLNCO onset features) aligns an orchestral recording to the piano-reduction
  score well. Peak memory for a 7-minute song is about 0.7 GB.
- **Trim silence and noise first.** A recording that starts with 13 s of digital silence, then 8 s of hiss, otherwise
  stretches the first bars over them (bars 1–2 came out at half tempo). The aligner measures the noise floor after the
  silence and starts where the level rises 10 dB above it for a second, backtracked to where the rise began.
- **Align twice.** Through long held chords there are no onsets to anchor to, and the DTW path falls back to the
  score's layout tempo, then jumps to catch up: bars come out at exactly the written tempo, followed by a spike.
  Laying the score out along a smoothed first-pass alignment for a second pass fixes this.
- **Fitting sections**: copying levels off a smoothed curve drifts (a 13 s drift over 7 minutes), because smootherstep
  between turning points spends time differently from the real curve. Solving the levels so each section's duration
  matches the recording (damped Gauss-Newton, levels kept within 15% of the measured shape) fixes it. Breaths are
  measured against the tempo just around them, not the smoothed curve, which averages them away.
- **Fit cumulative time**, not each section's duration on its own: then time one section can't produce is made up by
  the next instead of shifting the rest of the piece.
- **Following the singer** (tools/align_voice.py): Demucs (htdemucs, CPU, ~4.6 GB peak for 7 minutes) isolates the
  voice; synctoolbox aligns the score's vocal line to it, laid out along the full-score alignment so rests line up.
  Chroma can't see the boundary between two notes of the same pitch (singers hold into written rests), so entries and
  repeated pitches snap to the vocal attack that rises most from the moment before it. Judge her timing by her own
  neighbouring notes, not by the full-score alignment, which is what goes wrong where she rests.
- **Breaths** only where the singer has to steal time: punctuation with the next sung note straight after. Time taken
  in a rest is the conductor's tempo, carried by sections.
- Real performances exceed the old per-section limits (Thielemann goes from 40 to 83 BPM within three bars), so
  sections now arrive anywhere from 20% to 4× the basic tempo. Each stores that target relative to the basic tempo,
  not as a change from the section before, so editing or deleting one section leaves the others where they were.

- **Offline rendering** (`spessasynth_core`: `SpessaSynthProcessor` + `SpessaSynthSequencer`, as in its README)
  renders a 7-minute piano part in about 17 s at 32 kHz. Two traps: `audioToWav` **normalises to the peak by
  default** (pass `{ normalizeAudio: false }` to compare renders), and the core sequencer **skips to the first
  note while loading the song** unless `skipToFirstNoteOn = false` is set before `loadNewSongList`.

## Tooling

- The system npm 10.8.2 hangs or crashes (`edgesOut`) installing vite 8 / vitest 4. Use `npx -y npm@11 install`.
- kplayer comes in as a link (`"kplayer": "file:../kplayer"`): tsx and vitest load its TypeScript sources through
  it, and its own packages (Verovio, SpessaSynth) resolve from kplayer's node_modules. Its Verovio type declarations
  (`src/verovio.d.ts`) are listed in tsconfig's `include`.
