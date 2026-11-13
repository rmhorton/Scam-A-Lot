# ToonScape changelog

## 0.6.1

- Added animated GIF output when `-o` ends in `.gif`.
- GIF rendering uses ffmpeg's two-pass palette generation and motion-aware
  dithering, with an infinite GIF playback loop.
- Documented GIF timing, color, and transparency limitations.

## 0.6.0

- Added deformation-aware linear and radial gradients for ordinary Inkscape
  artwork.
- A consistently labelled gradient-painted path is detected automatically;
  authors do not need to edit XML or declare a special actor type.
- Added support for Inkscape gradients that inherit their stops with `href`.
- Lighting gradients use the closest identity/plain pose as their canonical
  artwork and follow the same Envelope Deformation as their painted paths.
- Authored keyframes remain authoritative: both path geometry and gradients
  are restored exactly at every `time=` layer.
- Kept generated traveling-wave gradients on their existing coordinate/stop
  interpolation pipeline.
- Added the Red Menace inflation example and a six-gradient regression test.

## 0.5.1

- Unified puppets, inflatables, and articulated objects under the labelled
  actor model.
- Preserved Inkscape rotation pivots for paths, groups, clones, and images.
- Fixed repeated browser-preview playback retaining runtime transforms.
