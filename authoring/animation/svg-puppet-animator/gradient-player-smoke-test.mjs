#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const directory = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(directory, "examples", "traveling-wave-pirate-flag-with-lighting.svg");
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

function peakStopAt(seconds) {
  window.__svgPuppet.seekSeconds(seconds);
  const gradient = window.document.querySelector('[data-toonscape-runtime-gradient="pirate_flag:highlight"]');
  if (!gradient) throw new Error("Runtime highlight gradient was not created");
  const values = Array.from(gradient.children).map(stop => {
    const style = Object.fromEntries((stop.getAttribute("style") || "").split(";").filter(Boolean).map(item => item.split(":")));
    return Number(style["stop-opacity"] || 0);
  });
  return values.indexOf(Math.max(...values));
}

const positions = [0, 0.5, 1.5, 2.5, 3.5, 4].map(peakStopAt);
if (new Set(positions.slice(0, -1)).size < 4) throw new Error(`Highlight did not travel across the flag: ${positions.join(", ")}`);
if (positions.at(-1) !== positions[0]) throw new Error(`Closing highlight does not match opening highlight: ${positions.join(", ")}`);
console.log(`gradient player smoke test passed (peak stops ${positions.join(" → ")})`);
