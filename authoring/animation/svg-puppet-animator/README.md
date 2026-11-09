# ToonScape SVG Animator

`svg-puppet` compiles an Inkscape SVG with `time=<seconds>` layers into a
self-contained browser preview. It can also render MP4 or WebM when Playwright,
a Chromium-family browser, and ffmpeg are installed.

Current version: **0.5.1**

## Install

```bash
npm install
chmod +x svg-puppet.mjs make-wave-svg.mjs
./svg-puppet.mjs --help
```

The folder includes p5.js, so browser previews do not need a network
connection. Node.js 20 or newer is recommended.

For video rendering:

```bash
npm install playwright
# Install ffmpeg separately, for example: brew install ffmpeg
```

If Playwright cannot find a browser, install Chrome, run
`npx playwright install chromium`, or set `TOONSCAPE_BROWSER` to a Chromium
executable.

## Authoring model

Each Inkscape layer labelled `time=<seconds>` is a keyframe. Each labelled
direct child of that layer is an actor. The label itself is the actor identity;
there is no `puppet=` or `inflatable=` prefix.

```text
time=0
└── catbot
    ├── tower
    ├── rotor
    │   ├── claw_arm1
    │   ├── claw_arm2_clone
    │   └── claw_arm3_clone
    └── cat_face
time=3
└── catbot
    └── same SVG hierarchy in a new pose
```

Rules:

- `time=` layers are sorted numerically.
- Matching actor labels identify the same actor across keyframes.
- An actor must retain the same SVG element hierarchy in every keyframe.
- Nested transforms, compatible path geometry, styles, opacity, and gradients
  interpolate between the authored copies.
- Inkscape's moved rotation centres are encoded in its transform matrices.
  ToonScape recovers those fixed points and preserves them for groups, clones,
  vector paths, and raster images.
- `<use>` clones keep pointing at the corresponding element in the runtime
  actor even though Inkscape gives every keyframe copy different IDs.
- Layer `display:none` is treated as an editing convenience. Use opacity when
  visibility itself should animate.
- The output canvas is exactly the SVG document/viewBox. Off-page artwork is
  retained but clipped.

This single actor model covers puppets, inflation, arm deployment, rotor
motion, flags, sails, waves, and other combinations. “Inflation” is simply the
combination of authored scaling, path deformation, opacity, and other ordinary
SVG changes; it is not a separate kind of object.

## Envelope deformation and handoff

An actor may reference one compatible Inkscape Envelope Deformation path
effect in its early keyframes and then continue without it:

```text
time=0     catbot with envelope (flat)
time=3     catbot with envelope (partly inflated)
time=5     catbot without envelope (fully inflated)
time=5.5   ordinary nested transforms deploy the arms
time=6+    ordinary parent transforms spin the rotor
```

ToonScape reconstructs stable original geometry from the first plain pose (or
from `inkscape:original-d` when every pose is enveloped), interpolates the four
envelope boundaries, and synthesizes an identity envelope for the handoff.
At the plain keyframe it uses the authored geometry exactly. Later keyframes
use ordinary SVG interpolation, so a deformed actor can become articulated
without being duplicated or switching pipelines.

Envelope phase interpolation is linear so traveling waves do not slow at each
keyframe. `--easing` controls ordinary transforms and styles.

Generated flag files may mark painted paths with
`data-toonscape-gradient-role`. ToonScape creates stable runtime gradients and
interpolates their coordinates and stops alongside the envelope.

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

`--loop-mode repeat --loops=1` plays the authored timeline once.
`--loop-mode pingpong --loops=1` plays forward and backward once.

The browser preview is sampled on the same discrete frame grid used for video
rendering. A browser may schedule callbacks at 60 or 120 Hz, but the artwork
advances only on the requested `--fps` frame times.

Example:

```bash
./svg-puppet.mjs windmill-inflate_deploy_spin.svg \
  -o windmill-preview --loop-mode repeat --loops 1 --fps 30
```

For MP4:

```bash
./svg-puppet.mjs windmill-inflate_deploy_spin.svg \
  -o windmill.mp4 --loop-mode repeat --loops 1 --fps 30
```

## Traveling-wave flag generator

`make-wave-svg.mjs` converts one Inkscape flag illustration into timed envelope
poses with editable shadow and highlight gradients:

```bash
./make-wave-svg.mjs flat-flag.svg waving-flag.svg \
  --object pirate_flag --duration 4 --phases 8 --pole-edge right
```

Useful lighting options include `--gradient-stops`, `--ambient-strength`,
`--shadow-strength`, `--highlight-strength`, and `--no-gradient`.

## Tests

```bash
npm test
```

The tests cover envelope geometry, mixed envelope/ordinary actor handoff,
pivot-preserving clone deployment, rotor rotation, generated flag gradients,
preview compilation, and repeated end-to-start playback without retained
runtime transforms.
