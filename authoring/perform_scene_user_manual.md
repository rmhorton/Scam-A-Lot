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

This belongs in the `perform_scene.py` user manual.



## Context-Aware Dialog with the `prev` Tag **NOT YET IMPLEMENTED**

### Overview

By default, `perform_scene.py` generates each spoken line independently. For most dialog this works well, but some lines depend heavily on what was said immediately beforehand.

Examples include:

```text
Really?
Yeah.
Okay.
Oh.
Thanks.
```

These short utterances can be interpreted in many different ways depending on the surrounding conversation.

The `prev` tag allows an author to specify that one or more preceding dialog lines should be supplied to the TTS model as context when generating the current line.

The previous lines are used only to guide the performance. They are not synthesized into the output audio.

---

### Syntax

The `prev` tag is specified inside the acting-direction block.

Example:

```text
DAVE [skeptical | prev=1]:
Really?
```

```text
FLOWER [gentle reassurance | prev=2]:
Yeah.
```

---

### Meaning

`prev=N` indicates that the TTS system should provide the previous `N` spoken dialog lines as context when generating the current line.

The current line remains the only text spoken in the generated audio.

Example:

```text
FLOWER:
You still haven't cut my signal.

DAVE [quietly defensive | prev=1]:
That doesn't mean anything.
```

When generating Dave's line, the TTS model receives Flower's previous statement as contextual information.

This often produces more natural emphasis and emotional delivery.

---

### When to Use

Use `prev` when a line's meaning depends strongly on prior dialog.

Good candidates include:

```text
Really?
Okay.
Yeah.
What?
Oh.
Thanks.
```

Use `prev` when the emotional intent would be difficult to infer from the current line alone.

---

### When Not to Use

Most dialog does not require the `prev` tag.

For example:

```text
DAVE [outraged]:
Security!
```

```text
FLOWER [cheerful pirate-radio greeting]:
Hey, Dave.
```

These lines already contain sufficient information in the text and acting directions.

Adding unnecessary context may increase generation time without improving quality.

---

### Choosing a Value

Most uses should specify:

```text
prev=1
```

Use larger values only when a line depends on a short exchange rather than a single statement.

Example:

```text
DAVE:
I don't know.

FLOWER:
You do know.

DAVE [slow realization | prev=2]:
...Oh.
```

---

### Interaction with Acting Directions

The `prev` tag supplements acting directions; it does not replace them.

Good:

```text
DAVE [embarrassed realization | prev=1]:
Oh.
```

Poor:

```text
DAVE [prev=1]:
Oh.
```

Always provide acting directions that describe the intended performance.

The `prev` tag provides conversational context; the acting directions provide emotional and dramatic intent.

---

This would fit naturally after the "Interaction with Acting Directions" section.



### Examples of Generated Prompts

The exact formatting of the prompt sent to the TTS model is implementation-dependent. The examples below illustrate the information that should be supplied when a `prev` tag is present.

#### Example 1: `prev=1`

Script:

```text
FLOWER:
You still haven't cut my signal.

DAVE [quietly defensive | prev=1]:
That doesn't mean anything.
```

Voice configuration:

```text
Energetic talk-radio host. Confident, performative, sarcastic, and entertaining.
```

Constructed prompt:

```text
Energetic talk-radio host. Confident, performative, sarcastic, and entertaining.

Previous dialog:

FLOWER:
You still haven't cut my signal.

Current line acting directions:

quietly defensive
```

Text sent for synthesis:

```text
That doesn't mean anything.
```

---

#### Example 2: `prev=2`

Script:

```text
DAVE:
I don't know.

FLOWER:
You do know.

DAVE [slow realization, embarrassed | prev=2]:
...Oh.
```

Constructed prompt:

```text
Energetic talk-radio host. Confident, performative, sarcastic, and entertaining.

Previous dialog:

DAVE:
I don't know.

FLOWER:
You do know.

Current line acting directions:

slow realization, embarrassed
```

Text sent for synthesis:

```text
...Oh.
```

---

#### Example 3: Radio Interruption

Script:

```text
[SFX: Static]

FLOWER [cheerful pirate-radio greeting]:
Hey, Dave.

DAVE [startled recognition | prev=1]:
Flower?
```

Constructed prompt:

```text
Energetic talk-radio host. Confident, performative, sarcastic, and entertaining.

Previous dialog:

FLOWER:
Hey, Dave.

Current line acting directions:

startled recognition
```

Text sent for synthesis:

```text
Flower?
```

---

#### Example 4: Previous Non-Dialog Content

Script:

```text
FLOWER:
The listeners deserve an answer.

[SFX_DAVE: clown_horn]

DAVE [annoyed, trying to sound confident | prev=1]:
That is an answer.
```

The sound effect is ignored when constructing context.

Constructed prompt:

```text
Energetic talk-radio host. Confident, performative, sarcastic, and entertaining.

Previous dialog:

FLOWER:
The listeners deserve an answer.

Current line acting directions:

annoyed, trying to sound confident
```

Text sent for synthesis:

```text
That is an answer.
```

---

### Design Principle

The `prev` tag provides conversational history, not dramatic interpretation.

The script author or LLM is responsible for describing the desired performance through acting directions. The TTS system simply provides the requested preceding dialog so that the model can interpret the current line in context.

For example:

```text
DAVE [embarrassed realization | prev=1]:
Oh.
```

is preferable to:

```text
DAVE [prev=1]:
Oh.
```

because the acting directions communicate the intended performance while the previous dialog supplies the conversational context.

One subtle point worth emphasizing is that the previous dialog should probably be included **verbatim**, rather than summarized. The whole point is to let the TTS model infer emotional context from the actual exchange.

### Best Practices

- Use `prev` sparingly.
- Prefer strong acting directions whenever possible.
- Use `prev` for genuinely context-dependent lines.
- Start with `prev=1`.
- Increase the value only when a larger portion of the preceding conversation is required.

In general, acting directions should describe *how* a line is delivered, while the `prev` tag provides information about *what immediately happened before the line was spoken*.


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
