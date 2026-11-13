#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const directory = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(directory, "examples", "red-menace-deformation-aware-gradients.svg");
const sourceBase64 = fs.readFileSync(svgPath).toString("base64");
const html = `<!doctype html>
  <div id="stage-host"></div>
  <button id="play"></button><button id="pause"></button><button id="restart"></button>
  <input id="scrubber"><output id="clock"></output><pre id="diagnostics"></pre>`;
const dom = new JSDOM(html, { runScripts: "outside-only", url: "file:///toonscape-test/index.html" });
const { window } = dom;

window.SVG_PUPPET_CONFIG = {
  sourceName: path.basename(svgPath),
  sourceBase64,
  options: {
    loopMode: "repeat", loops: 1, loopDelay: 0, startHold: 0,
    endHold: 0, fps: 30, easing: "ease-in-out-sine"
  }
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

const expected = [
  "face_gradient", "belly_gradient", "arm-gradient-right",
  "leg_gradient_right", "foot_gradient_right", "claw_gradient_left_pinky"
];
for (const role of expected) {
  if (!window.document.querySelector(`[data-toonscape-runtime-gradient="gradient_monster:${role}"]`)) {
    throw new Error(`Missing runtime gradient for ${role}`);
  }
}

function gradientTransform(role, seconds) {
  window.__svgPuppet.seekSeconds(seconds);
  const gradient = window.document.querySelector(`[data-toonscape-runtime-gradient="gradient_monster:${role}"]`);
  const value = gradient?.getAttribute("gradientTransform") || "";
  if (!value || /NaN|Infinity/.test(value)) throw new Error(`Invalid ${role} transform at ${seconds}: ${value}`);
  return value;
}

const opening = gradientTransform("face_gradient", 0);
const middle = gradientTransform("face_gradient", 2.5);
const closing = gradientTransform("face_gradient", 5);
if (middle === opening || middle === closing) {
  throw new Error(`Face gradient did not follow the envelope: ${opening} / ${middle} / ${closing}`);
}

const labelled = label => Array.from(window.document.querySelectorAll("#stage *"))
  .find(element => (element.getAttribute("inkscape:label") || "").split(";")[0] === label);
window.__svgPuppet.seekSeconds(0);
const openingOpacity = Number(Object.fromEntries((labelled("face_gradient").getAttribute("style") || "")
  .split(";").filter(Boolean).map(item => item.split(":"))).opacity ?? 1);
window.__svgPuppet.seekSeconds(5);
const closingOpacity = Number(Object.fromEntries((labelled("face_gradient").getAttribute("style") || "")
  .split(";").filter(Boolean).map(item => item.split(":"))).opacity ?? 1);
if (openingOpacity !== 0 || closingOpacity !== 1) {
  throw new Error(`Authored gradient opacity endpoints changed: ${openingOpacity} -> ${closingOpacity}`);
}

console.log(`deformation-aware gradient player smoke test passed (${expected.length} gradients)`);
