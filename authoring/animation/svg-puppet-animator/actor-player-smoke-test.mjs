#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const directory = path.dirname(fileURLToPath(import.meta.url));
const source = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:xlink="http://www.w3.org/1999/xlink" width="100" height="100" viewBox="0 0 100 100">
  <defs>
    <inkscape:path-effect effect="envelope" id="flat" bendpath1="M 10,45 L 90,45" bendpath2="M 90,45 L 90,55" bendpath3="M 10,55 L 90,55" bendpath4="M 10,45 L 10,55" xx="true" yy="true"/>
  </defs>
  <g inkscape:label="time=0">
    <g inkscape:label="bot" inkscape:path-effect="#flat">
      <path inkscape:label="body" d="M 10,45 L 90,45 L 90,55 L 10,55 Z" inkscape:original-d="M 10,10 L 90,10 L 90,90 L 10,90 Z"/>
      <g inkscape:label="rotor" id="rotor-0" transform="translate(0,0)">
        <g inkscape:label="arm1" id="arm-0"><path d="M 50,50 L 80,48 L 80,52 Z"/></g>
        <use inkscape:label="arm2" id="arm2-0" xlink:href="#arm-0"/>
      </g>
    </g>
  </g>
  <g inkscape:label="time=1">
    <g inkscape:label="bot">
      <path inkscape:label="body" d="M 10,10 L 90,10 L 90,90 L 10,90 Z"/>
      <g inkscape:label="rotor" id="rotor-1" transform="translate(0,0)">
        <g inkscape:label="arm1" id="arm-1"><path d="M 50,50 L 80,48 L 80,52 Z"/></g>
        <use inkscape:label="arm2" id="arm2-1" xlink:href="#arm-1"/>
      </g>
    </g>
  </g>
  <g inkscape:label="time=2">
    <g inkscape:label="bot">
      <path inkscape:label="body" d="M 10,10 L 90,10 L 90,90 L 10,90 Z"/>
      <g inkscape:label="rotor" id="rotor-2" transform="rotate(90,50,50)">
        <g inkscape:label="arm1" id="arm-2"><path d="M 50,50 L 80,48 L 80,52 Z"/></g>
        <use inkscape:label="arm2" id="arm2-2" xlink:href="#arm-2" transform="rotate(120,50,50)"/>
      </g>
    </g>
  </g>
</svg>`;

const html = `<!doctype html><div id="stage-host"></div><button id="play"></button><button id="pause"></button><button id="restart"></button><input id="scrubber"><output id="clock"></output><pre id="diagnostics"></pre>`;
const dom = new JSDOM(html, { runScripts: "outside-only", url: "file:///toonscape-test/index.html" });
const { window } = dom;
window.SVG_PUPPET_CONFIG = {
  sourceName: "actor-smoke-test.svg",
  sourceBase64: Buffer.from(source).toString("base64"),
  options: { loopMode: "repeat", loops: 1, loopDelay: 0, startHold: 0, endHold: 0, fps: 30, easing: "linear" }
};
window.p5 = class {
  constructor(callback) {
    const p = { noCanvas() {}, frameRate() {}, deltaTime: 0 };
    callback(p);
    p.setup();
  }
};

for (const file of ["svg-path.js", "envelope-core.js", "player.js"]) {
  window.eval(fs.readFileSync(path.join(directory, file), "utf8"));
}
window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
if (!window.__svgPuppet?.ready) throw new Error(window.__svgPuppet?.error || "Player did not initialize");

const label = name => Array.from(window.document.querySelectorAll("#stage *"))
  .find(element => element.getAttributeNS("http://www.inkscape.org/namespaces/inkscape", "label") === name);
const matrix = text => (text.match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || []).map(Number);
const apply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];

window.__svgPuppet.seekSeconds(0.5);
if (label("body").getAttribute("d") === "M 10,10 L 90,10 L 90,90 L 10,90 Z") {
  throw new Error("Envelope deformation was not active before the plain-pose handoff");
}

window.__svgPuppet.seekSeconds(1);
if (label("body").getAttribute("d") !== "M 10,10 L 90,10 L 90,90 L 10,90 Z") {
  throw new Error("Envelope handoff did not land exactly on the authored plain geometry");
}

window.__svgPuppet.seekSeconds(1.5);
const pivot = [50, 50];
for (const name of ["arm2", "rotor"]) {
  const transform = matrix(label(name).getAttribute("transform"));
  const moved = apply(transform, pivot);
  if (Math.hypot(moved[0] - pivot[0], moved[1] - pivot[1]) > 1e-5) {
    throw new Error(`${name} did not preserve its Inkscape rotation pivot: ${moved}`);
  }
}
if (label("arm2").getAttribute("xlink:href") !== "#arm-0") {
  throw new Error("Runtime <use> adopted a keyframe-copy href instead of retaining its internal actor reference");
}

// Complete a pass, seek to the beginning, and run the articulated section a
// second time.  Runtime-only transforms from the first pass must not leak into
// the reset pose.
window.__svgPuppet.seekSeconds(2);
window.__svgPuppet.seekSeconds(0);
if (label("arm2").hasAttribute("transform")) {
  throw new Error(`Deployed arm transform survived a restart: ${label("arm2").getAttribute("transform")}`);
}
window.__svgPuppet.seekSeconds(1.5);
for (const name of ["arm2", "rotor"]) {
  const transform = matrix(label(name).getAttribute("transform"));
  const moved = apply(transform, pivot);
  if (Math.hypot(moved[0] - pivot[0], moved[1] - pivot[1]) > 1e-5) {
    throw new Error(`${name} lost its pivot on the second pass: ${moved}`);
  }
}

console.log("actor player smoke test passed");
