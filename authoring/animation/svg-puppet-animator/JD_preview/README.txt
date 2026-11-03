SVG Puppet Animator preview

Source: JD_concertina01.svg
Keyframe times: 0, 0.461538 seconds
Puppets: JD
Loop mode: pingpong
Loops: 10
Approximate duration: 9.230760 seconds
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
* Inkscape display:none on time layers is ignored, because layer visibility is
  an editing convenience. Opacity remains animatable.
