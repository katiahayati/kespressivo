# kespressivo

Interpretation for [kplayer](https://github.com/katiahayati/kplayer), the score player for rehearsing with
expressive timing. kespressivo listens to recordings and writes how the performers shape the piece (their tempo,
breaths and dynamics) as kplayer performance files, and it voices piano parts so they sound played rather than
sequenced. kplayer plays the results; nothing here changes a score.

Most of the work is done with Claude Code and the three skills in `.claude/skills`:

| Skill | Does |
|---|---|
| `learn-performance` | Aligns a recording with the score and fits the performer's basic tempo, tempo sections and breaths |
| `learn-dynamics` | Fits a recording's dynamic shape beat by beat, the pianist's pulse, and the bass/treble balance |
| `expressive-piano` | Writes a voicing from the score and its printed edition: which strands lead, a pulse on the bar's real beats, the composer's dynamics and hairpins, and pedal |

The commands they use are below, for running by hand.

## Setup

kespressivo uses kplayer's engine (its timing, dynamics and Verovio score loading) to check what it writes, and
kplayer's synth and sound banks to render, so check kplayer out beside it:

```sh
git clone https://github.com/katiahayati/kplayer.git
git clone https://github.com/katiahayati/kespressivo.git
(cd kplayer && npx -y npm@11 install && npm run fetch-soundfont)   # the system npm 10.8.2 hangs on these packages
cd kespressivo && npx -y npm@11 install                              # links ../kplayer
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
```

Changes to kplayer's engine show up here straight away (`node_modules/kplayer` is a link to it).

## Learning a performance from a recording

kespressivo can listen to a recording of the piece and write a performance file with the performer's tempo
shaping: their basic tempo, **Speed up** / **Slow down** sections between their tempo turning points, and
**breaths** where the singer takes extra time at a phrase end. Import the result in kplayer with **Import…**.

```sh
npm run export-score -- song.mxl > /tmp/song-notes.json
.venv/bin/python tools/align_recording.py /tmp/song-notes.json recording.webm /tmp/alignment.json
npm run fit-performance -- song.mxl /tmp/alignment.json song.performer.kplayer.json --performer "Performer"
```

For a song, it can follow the singer more closely. Isolate the voice with [Demucs](https://github.com/facebookresearch/demucs),
align the score's vocal line to it, and pass the result to the fit:

```sh
.venv/bin/pip install torch==2.5.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cpu && .venv/bin/pip install demucs==4.0.1   # once
ffmpeg -ss START -i recording.webm -ac 2 -ar 44100 /tmp/music.wav     # START: where the music begins (printed by the aligner)
.venv/bin/python -m demucs.separate -n htdemucs --two-stems=vocals --segment 7 -o /tmp/sep /tmp/music.wav
.venv/bin/python tools/align_voice.py /tmp/song-notes.json /tmp/alignment.json /tmp/sep/htdemucs/music/vocals.wav START /tmp/voice.json
npm run fit-performance -- song.mxl /tmp/alignment.json song.performer.kplayer.json --performer "Performer" --voice /tmp/voice.json
npm run check-voice -- song.mxl song.performer.kplayer.json /tmp/voice.json   # how closely a file follows the singer
```

Demucs needs about 4.5 GB of memory for a 7-minute song.

A faithful fit keeps every local tempo wobble, which can sound erratic on piano. For a calmer version that keeps the
big gestures and the breaths, add `--smooth 16 --turn 8 --tolerance 40 --sync 0.3`: four-bar smoothing, turning
points only for changes of 8% or more, no extra detail, and shape preferred over exact timing. The fit reports how
jumpy the sections are (the largest one-beat change, and how many beats change by more than 15%).

The aligner ([synctoolbox](https://github.com/meinardmueller/synctoolbox)) lines the recording up with the score
note by note: any key or tuning difference, and silence at either end, are handled. The fitting step then checks
the result with kplayer's own timing engine and prints how closely it follows the recording. The score must match
the recording's music: the same cuts, repeats and notes, though a piano reduction of an orchestral piece works fine.

## Dynamics from a recording

The same alignment gives the conductor's dynamic shape: how loud the music is from moment to moment. Measure the
accompaniment (for a song, Demucs's `no_vocals.wav`) beat by beat, then fit: the piano is rendered offline through
kplayer's synth, its loudness compared with the recording's (each relative to its median), and a level adjusted
every half bar until they match, keeping your voicing's balance on top.

```sh
.venv/bin/python tools/dynamics_arc.py /tmp/alignment.json /tmp/sep/htdemucs/music/no_vocals.wav START /tmp/arc.json
npm run fit-dynamics -- song.mxl song.performer.kplayer.json /tmp/arc.json voicing.json song.performer-dynamics.kplayer.json --part 1
npm run voice-balance -- song.mxl song.performer-dynamics.kplayer.json   # is the melody on top, bar by bar?
npm run melody-presence -- song.mxl song.performer-dynamics.kplayer.json   # is it heard through the bar, or only at its attacks?
npm run render-audio -- song.mxl song.performer-dynamics.kplayer.json out.wav --hall   # listen outside the browser
```

The fitted shape is centred on the written dynamics' typical loudness. A reduction marked mostly pp leaves a voiced
accompaniment at velocities the piano barely sounds; `--lift 4` centres it 4 dB higher. A recording with a wider range
than the piano's velocities (Lott's 30 dB) pins its climaxes at the top; `--range 0.85` scales its shape to fit.

`render-audio` plays a performance as kplayer does: the same synth and piano, and with `--hall` the same concert
hall. Leave the hall out when measuring loudness.

## Example

[`examples/apollo`](examples/apollo) has a full song to try: Strauss's *Gesang der Apollopriesterin* as a piano
reduction, with tempo shaping learned from two recordings (Thielemann/Fleming and Felicity Lott), a voicing taken
from the full score, and each conductor's dynamic shape.

## Tests

```sh
npm test          # the examples still fit the score, the loudness meter, the offline hall
npm run typecheck
```

`NOTES.md` has what was learned about aligning recordings and fitting them.

## License

MIT (see `LICENSE`).
