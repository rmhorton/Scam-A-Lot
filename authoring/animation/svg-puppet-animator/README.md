# SVG Puppet Animator

`svg-puppet` compiles an Inkscape SVG with `time=<seconds>` layers into a
p5.js-driven animation preview. It can also render MP4 or WebM when Playwright
and ffmpeg are installed.

Current version: **0.1.1**

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

HTML preview generation does not require Playwright or ffmpeg.

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

In `repeat` mode, a projectile should begin and finish outside the document
region. It then resets invisibly rather than appearing to fly backward.

## Notes and current scope

- Preview packages are self-contained and may be opened directly from disk.
- The player interpolates SVG numeric attributes, transforms, compatible path
  geometry and opacity. Non-interpolatable values change at the segment
  midpoint and are reported in browser diagnostics when relevant.
- Part labels and element structure must remain consistent between keyframes.
- Diagnostics never modify or snap small movements.

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
