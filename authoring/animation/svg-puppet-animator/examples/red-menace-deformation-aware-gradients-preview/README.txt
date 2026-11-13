ToonScape SVG Animator preview

Source: red-menace-deformation-aware-gradients.svg
Keyframe times: 0, 5 seconds
Envelope Deformation definitions: 14
Loop mode: repeat
Loops: 1
Approximate duration: 5.000000 seconds
Video frame rate: 30 fps

Open index.html in a modern browser. The preview includes play, pause, restart,
and timeline controls.

Loop semantics
--------------
--loops=1 plays one iteration. In repeat mode, it plays the authored timeline
once and does not visibly repeat; this is equivalent to a one-shot mode.
In pingpong mode, one iteration plays forward and then backward.

Video frame timing
------------------
The renderer emits the frame budget implied by duration and --fps: one second
at 30 fps is exactly 30 frames. The final keyframe is a time boundary. Give its
pose duration with a later keyframe or --end-hold 0.033333 to show it for one
30 fps frame. HTML playback is quantized to the same frame grid, regardless of
whether the browser display refreshes at 60 or 120 Hz.

Canvas and off-page artwork
---------------------------
The visible canvas is exactly the SVG document/viewBox region. Artwork outside
the page remains part of the animation and can enter or leave the scene, but it
does not enlarge the rendered canvas.

Authoring conventions
---------------------
* Top-level keyframe layers: time=<seconds>
* Each labelled direct child of a time layer is an actor. The label itself is
  its identity; prefixes such as puppet= or inflatable= are unnecessary.
* Actor copies must retain the same SVG element hierarchy in each keyframe.
  Nested transforms, path geometry, styles, opacity, and gradients interpolate.
* Inkscape rotation centres are already encoded in the authored transform
  matrices. ToonScape recovers and preserves those pivots for every nested
  element, including groups and clones.
* Positions, transforms, opacity, paths, and small changes are treated as
  intentional. Diagnostics report suspicious differences but do not alter them.
* A labelled actor that references one compatible Inkscape Envelope
  Deformation effect is detected automatically. It may hand off to ordinary
  transform animation at a later keyframe by removing the path effect there.
* Envelope boundaries interpolate linearly to preserve constant wave speed;
  --easing continues to control ordinary transforms, styles, and puppet parts.
* Inkscape display:none on time layers is ignored, because layer visibility is
  an editing convenience. Opacity remains animatable.
