# ToonScape SVG Animator

`svg-puppet` compiles an Inkscape SVG with `time=<seconds>` layers into a
p5.js-driven animation preview. It can also render MP4 or WebM when Playwright
and ffmpeg are installed.

Current version: **0.2.0**

## Install

The distributed folder includes p5.js 2.3.4 in `vendor/p5.min.js`, so HTML
previews need no network connection. Node.js 20 or newer is recommended.

```bash
chmod +x svg-puppet.mjs
./svg-puppet.mjs --help
```

For command-line MP4/WebM rendering:

```bash
npm install playwright
# Install ffmpeg separately, for example: brew install ffmpeg
```

If Playwright cannot find a browser, either install Google Chrome or run:

```bash
npx playwright install chromium
```

For another Chromium-family executable, set `TOONSCAPE_BROWSER` to its full
path before invoking the renderer.

HTML preview generation does not require Playwright or ffmpeg.

Run the bundled geometry smoke test with:

```bash
npm test
```

## Inkscape structure

```text
background
time=0.0
└── puppet=JD
    ├── head
    ├── hat
    ├── torso
    ├── left_upper_arm
    └── ...
time=0.461538
└── puppet=JD
    └── matching labelled parts
```

Rules:

- `time=<seconds>` layers are sorted numerically.
- Each `puppet=<name>` group is matched by name between keyframes.
- Every labelled direct child of a puppet group is treated as a part.
- Matching labels identify the same part across keyframes.
- Compound parts may be groups; their descendants are rendered together.
- All authored movement, scaling, rotation, path changes and opacity changes
  are treated as intentional.
- Inkscape layer visibility (`display:none`) is ignored for `time=` layers.
  Use opacity when visibility should animate.
- The canvas is exactly the SVG document/viewBox region. Off-page artwork is
  retained but clipped, so objects can enter and leave the scene.

## Envelope Deformation objects

ToonScape also detects labelled, top-level groups in each `time=` layer that
reference an Inkscape `effect="envelope"` path effect. The label itself is the
object identity; it does not need a `puppet=` prefix.

```text
time=0
└── pirate_flag                 inkscape:path-effect="#wave-0"
time=0.5
└── pirate_flag                 inkscape:path-effect="#wave-1"
...
time=4
└── pirate_flag                 exact closing pose
```

Every path in the object must retain the same `inkscape:original-d` geometry
and nested transforms in every keyframe. The four envelope boundaries must
have compatible path topology. ToonScape interpolates the boundary geometry
and reapplies the deformation to the stable original paths at every rendered
frame. It does not interpolate Inkscape's baked `d` outlines.

Envelope phase interpolation is always linear so traveling waves do not slow
down at every keyframe. `--easing` still controls transforms, opacity, styles,
and ordinary puppet parts.

An unchanged rectangular `perspective-envelope` helper may precede the legacy
Envelope Deformation effect in an Inkscape path-effect stack. Other visible or
non-identity effects in the same stack are rejected with a diagnostic rather
than silently rendered incorrectly.

## Usage

```bash
./svg-puppet.mjs INPUT.svg [options]
```

Common options:

```text
-o, --output PATH
--loop-mode repeat|pingpong
--loops N
--loop-delay SECONDS
--start-hold SECONDS
--end-hold SECONDS
--fps N
--easing linear|ease-in-out-sine
--keep-preview
--quiet
```

Run `./svg-puppet.mjs --help` for complete details.

### One iteration

`--loop-mode repeat --loops=1` plays the authored timeline once. With only one
iteration, there is no visible repetition; this is equivalent to a one-shot
mode.

`--loop-mode pingpong --loops=1` plays forward and then backward once.

### Examples

Five concertina cycles:

```bash
./svg-puppet.mjs JD.svg -o JD-preview --loop-mode pingpong --loops 5
```

One cannon firing:

```bash
./svg-puppet.mjs cannon.svg -o cannon-preview --loop-mode repeat --loops 1
```

Five cannon firings rendered to MP4:

```bash
./svg-puppet.mjs cannon.svg -o cannon.mp4 --loop-mode repeat --loops 5 --fps 30
```

A four-second waving flag rendered directly from its authored timeline:

```bash
./svg-puppet.mjs traveling-wave-pirate-flag-example.svg \
  -o waving-pirate-flag.mp4 \
  --loop-mode repeat --loops 1 --fps 30
```

In `repeat` mode, a projectile should begin and finish outside the document
region. It then resets invisibly rather than appearing to fly backward.

## Notes and current scope

- Preview packages are self-contained and may be opened directly from disk.
- The player interpolates SVG numeric attributes, transforms, compatible path
  geometry and opacity. Non-interpolatable values change at the segment
  midpoint and are reported in browser diagnostics when relevant.
- Part labels and element structure must remain consistent between keyframes.
- Diagnostics never modify or snap small movements.

## Version 0.2.0

- Adds production interpolation for Inkscape Envelope Deformation effects.
- Automatically discovers labelled top-level envelope groups alongside, or
  instead of, `puppet=` actors.
- Reconstructs every output frame from stable `inkscape:original-d` paths,
  preventing complex paths from changing point correspondence.
- Supports semicolon-separated Inkscape path-effect stacks containing an
  identity `perspective-envelope` helper followed by the legacy envelope.
- Preserves complete layer/object placement while envelope geometry animates.
- Uses linear phase interpolation for constant wave speed independently of
  ordinary actor easing.

## Version 0.1.1

- Normalizes raster images before interpolation, even when Inkscape expresses
  equivalent sizes using different combinations of pixel dimensions, SVG
  dimensions, and transform matrices.
- Reads Inkscape rotation-center offsets and rotates bitmap sprites around the
  saved local pivot. This fixes shoulder-jointed limbs flying away between
  poses.
- Treats `url(#resource)` paint references as indivisible IDs instead of
  interpolating the numbers in their names.

## Included proof render

`examples/JD-concertina-one-loop.mp4` is a 540×960, 30 fps proof render made
from the supplied two-pose JD puppet at its revised 0.461538-second half-cycle.
The adjoining contact sheet samples five points across the open–closed motion;
the MP4 contains the complete open–closed–open loop. The original SVG is not
redistributed in this package.

`examples/waving-pirate-flag.mp4` is a four-second, 30 fps repeat-mode proof of
the envelope engine. Its source SVG and an eight-pose contact sheet are
included so the same command can be rerun and inspected locally.
