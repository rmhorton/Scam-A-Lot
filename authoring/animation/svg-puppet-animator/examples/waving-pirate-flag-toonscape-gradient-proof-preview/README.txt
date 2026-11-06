ToonScape SVG Animator preview

Source: traveling-wave-pirate-flag-with-lighting.svg
Keyframe times: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4 seconds
Puppets: none
Envelope Deformation definitions: 9
Loop mode: repeat
Loops: 1
Approximate duration: 4.000000 seconds
Video frame rate: 30 fps

Open index.html in a modern browser. The preview includes play, pause, restart,
and timeline controls.

Loop semantics
--------------
--loops=1 plays one iteration. In repeat mode, it plays the authored timeline
once and does not visibly repeat; this is equivalent to a one-shot mode.
In pingpong mode, one iteration plays forward and then backward.

Canvas and off-page artwork
---------------------------
The visible canvas is exactly the SVG document/viewBox region. Artwork outside
the page remains part of the animation and can enter or leave the scene, but it
does not enlarge the rendered canvas.

Authoring conventions
---------------------
* Top-level keyframe layers: time=<seconds>
* Puppet group inside each keyframe: puppet=<name>
* Every labelled direct child of a puppet group is an animated part.
* Matching puppet and part labels identify the same object across keyframes.
* Positions, transforms, opacity, paths, and small changes are treated as
  intentional. Diagnostics report suspicious differences but do not alter them.
* A labelled top-level group that references one compatible Inkscape Envelope
  Deformation effect is detected automatically and matched by label.
* Envelope boundaries interpolate linearly to preserve constant wave speed;
  --easing continues to control ordinary transforms, styles, and puppet parts.
* Inkscape display:none on time layers is ignored, because layer visibility is
  an editing convenience. Opacity remains animatable.
