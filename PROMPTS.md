# Asking for a voicing

The voicings here were made by asking Claude Code, in this repo, for what the piano part should sound like; the
skills in `.claude/skills` do the rest. These are the requests that made them, lightly edited, with what came of
each. None of them names a dB value or a selector. They say what's wrong in musical terms, and what to keep.

## Start from the piece and what's wrong with it

For Strauss's *Gesang der Apollopriesterin* ([`examples/apollo`](examples/apollo)), a piano reduction of an
orchestral song:

> How would you make the playback of this score's piano part expressive? For example, the left-hand tremolos are
> there to imitate the cellos' pianissimo blanket, but they play as loud as the right-hand notes that carry the
> brass melody. Stuff like that. Don't think about a general solution yet: how would you do it for this piece? Let's
> just talk for now, no code.

Claude asked which instrument each strand of the reduction stands for:

> I don't know, but you could get the orchestral score from IMSLP and work it out.

> Go ahead and give it your best shot. You don't need my approval along the way; tell me if you need help.

What came of it: `apollo-learning.voicing.json`, with each strand named after what the orchestra plays. The muted
cellos' sextuplets and the timpani rolls become a soft blanket, the strings' repeated chords stay back, the top line
of the right hand (the brass fanfares, the solo violin, the clarinet) comes forward and sounds slightly ahead, and the
pedal changes with the harmony. The same session fitted each recording's dynamic shape on top: the `-dynamics` files.

## Name the beat the music moves in

For Sibelius's *Var det en dröm?*, with a reference recording or two:

> Can you take var-det-en-drom-learning.mxl and make the piano more expressive? I think a large part of it is
> pulsing the big beats of the 6/4. You can download recordings from YouTube for reference.

What came of it: the score's dynamics and hairpins, which the reduction hadn't transcribed, taken from the printed
edition, and a pulse measured from two pianists. The bass leans on each dotted quarter and more on beats 1 and 4, and
the right hand lifts a little at beat 4. The downbeat isn't heavier: neither pianist played it so. The running
sixteenths sit under the held inner line, and the pedal changes with the harmony by the dotted half.

## Say what you hear, and what to keep

A first voicing is rarely right. Listen in kplayer, then say what's wrong in the same terms:

> I'm not happy with either dynamic voicing for apollo-learning. I like that the cello blanket and the like are
> brought down, but there isn't enough melody: I mostly hear the big beats, and it's very sparse. There aren't many
> recordings with piano to go by, so I'm not sure what guidance to give you, but can you try something? Basically I
> want the melody less dynamically sparse.

What came of it: the tune 8 dB above the marks, its long held notes included, and the accompaniment taken down. The
reduction is marked mostly pp, so the fit was centred higher (`fit-dynamics --lift`) and the pedal changed every half
note instead of every beat. A new measure, `melody-presence`, counts how much of each bar the tune is heard in,
not only at its attacks.

> I hear the melody now, especially in the Lott, so that's good, but I still hear little of the rest.

What came of it: the held chords, the strings' pulse and the bass brought back up, with the cellos' figure still
the softest strand. `melody-presence` now measures the tune against the rest of the texture as well, both at full
range and through a phone's small speaker.

## Tips

- **Name strands, bars and what they should do:** the left-hand tremolo, the big beats of the 6/4, the melody in
  bars 40–60. "More expressive" is a fine start, but the follow-ups are where it improves.
- **Say what to keep.** "I like that the cello blanket is brought down" stopped the next version from undoing it.
- **Point to sources:** the full score on IMSLP, the printed edition, a recording on YouTube. Claude reads scores
  and measures recordings, but can't decide what a reduction's lines stand for without them. IMSLP's downloads need
  a person to pass a captcha, so save the PDF in the project yourself.
- **Your ears decide.** Claude renders the result and measures it (`voice-balance`, `melody-presence`), but it
  can't hear it. Each strand has a **Level** slider in kplayer's Dynamics tab: try settings there and report the
  ones you like, and say whether you were listening on a phone's speaker or on headphones.
