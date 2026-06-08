# perform_scene.py

Generate character dialog audio from a plain-text script using locally hosted AI voices.

`perform_scene.py` reads a script file, sends each line of dialog to the Qwen3-TTS API, and generates a collection of WAV files suitable for assembly in GarageBand, Audacity, or other audio production tools.

The script is designed for use with radio dramas, audio plays, podcasts, and other dialog-driven productions.

---

# Requirements

Before running `perform_scene.py`:

1. Install and launch Qwen3-TTS MLX WebUI Enhanced.
2. Create and save any custom voices you intend to use.
3. Configure the corresponding voice prompt IDs in the `VOICES` dictionary within the script.
4. Ensure the Qwen API server is running.

The default API endpoint is:

```text
http://127.0.0.1:42008
```

---

# Basic Usage

Generate audio from a script:

```bash
python perform_scene.py intro.txt
```

This creates an output directory named:

```text
intro_audio/
```

containing one WAV file per speech.

Example:

```text
intro_audio/
    001_dave.wav
    002_flower.wav
    003_dave.wav
    004_flower.wav
```

---

# Script Format

Scripts are plain text files.

Speaker names must appear in uppercase.

Example:

```text
DAVE:
Good evening, citizens.

FLOWER:
That's not what happened, Dave.
```

The parser treats everything following a speaker header as dialog until another speaker header is encountered.

---

# Acting Directions

Optional acting directions may be supplied in square brackets after the speaker name.

Example:

```text
DAVE [confident]:
Good evening, citizens.

FLOWER [amused]:
That's not what happened, Dave.

DAVE [defensive]:
Security!
```

Acting directions are passed to the TTS model as additional instructions and may affect tone, emphasis, pacing, and emotional delivery.

Different generations of the same line may produce slightly different performances.

---

# Inline Dialog

Dialog may appear on the same line as the speaker header:

```text
FLOWER [teasing]: They already tried.
```

or on subsequent lines:

```text
FLOWER [teasing]:
They already tried.
```

Both forms are supported.

---

# Production Notes

Lines beginning with `[` are treated as production notes and ignored by the TTS generator.

Examples:

```text
[SFX: Duck quack]

[MUSIC: Theme music]

[PAUSE: 2s]

[FADE OUT]
```

These notes remain visible to human editors but do not generate audio.

Example:

```text
[MUSIC: Theme music]

DAVE:
Good evening, citizens.

[SFX: Patriotic fanfare]

FLOWER:
That's not what happened, Dave.
```

Only the spoken dialog will be rendered.

---

# Narration

Narrators are treated exactly like any other speaker.

Example:

```text
NARRATOR:
The station manager looks horrified.

DAVE:
Security!
```

To use a narrator voice, simply add a voice configuration for `NARRATOR`.

No special parser support is required.

---

# Voice Configuration

Character voices are defined in the script's `VOICES` dictionary.

Example:

```python
VOICES = {
    "DAVE": {
        "prompt_id": "...",
        "instruct": "Professional radio host. Confident and authoritative."
    },

    "FLOWER": {
        "prompt_id": "...",
        "instruct": "Warm, intelligent pirate radio host."
    }
}
```

The prompt IDs correspond to saved voice prompts stored by Qwen3-TTS.

---

# Regenerating Lines

AI-generated performances are not completely deterministic.

The same script may produce slightly different deliveries on different runs.

If a line contains a pronunciation error, omitted word, or unsatisfactory performance:

1. Modify the script if desired.
2. Re-run `perform_scene.py`.
3. Select the preferred take during editing.

This behavior is often useful because it provides multiple performance options without requiring changes to the underlying voice.

---

# Workflow

Typical workflow:

```text
Script
    ↓
perform_scene.py
    ↓
WAV files
    ↓
GarageBand / Audacity
    ↓
Sound effects
Music
Editing
Mixing
    ↓
Final production
```

The script is intended to generate performances, not complete productions. Music, sound effects, pacing, and final assembly remain under human control.

---

# Future Enhancements

Possible future improvements include:

- Processing multiple input files in a single run.
- Automatic dialog validation using Whisper transcription.
- External voice configuration files.
- Metadata export.
- Automated scene assembly tools.
- Integration with future ShowBuilder workflows.

The current implementation is intentionally simple and optimized for rapid content creation and experimentation.
