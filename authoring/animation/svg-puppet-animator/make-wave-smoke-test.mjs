import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { JSDOM } from "jsdom";

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "toonscape-wave-test-"));
const output = path.join(temporary, "wave.svg");
try {
  const result = spawnSync(process.execPath, [
    new URL("./make-wave-svg.mjs", import.meta.url).pathname,
    new URL("./examples/traveling-wave-pirate-flag-example.svg", import.meta.url).pathname,
    output,
    "--duration", "4",
    "--phases", "8"
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const dom = new JSDOM(fs.readFileSync(output, "utf8"), { contentType: "image/svg+xml" });
  const document = dom.window.document;
  const inkscapeNamespace = "http://www.inkscape.org/namespaces/inkscape";
  const timedLayers = Array.from(document.documentElement.children).filter(element =>
    (element.getAttributeNS(inkscapeNamespace, "label") || "").startsWith("time=")
  );
  assert.equal(timedLayers.length, 9);
  assert.equal(document.querySelectorAll("linearGradient[id^='toonscape-wave-shadow-']").length, 9);
  assert.equal(document.querySelectorAll("linearGradient[id^='toonscape-wave-highlight-']").length, 9);
  assert.equal(document.querySelectorAll("path[data-toonscape-gradient-role='shadow']").length, 9);
  assert.equal(document.querySelectorAll("path[data-toonscape-gradient-role='highlight']").length, 9);
  assert.equal(document.querySelectorAll("path[data-toonscape-lighting-role='ambient']").length, 9);
  for (const gradient of document.querySelectorAll("linearGradient[id^='toonscape-wave-shadow-'],linearGradient[id^='toonscape-wave-highlight-']")) {
    assert.equal(gradient.querySelectorAll("stop").length, 41);
  }
  const stopStyles = id => Array.from(document.querySelectorAll(`#${id} stop`), stop => stop.getAttribute("style"));
  const opacity = style => Number(/stop-opacity:([0-9.eE+-]+)/.exec(style)?.[1] || 0);
  assert.deepEqual(stopStyles("toonscape-wave-shadow-0"), stopStyles("toonscape-wave-shadow-8"));
  assert.deepEqual(stopStyles("toonscape-wave-highlight-0"), stopStyles("toonscape-wave-highlight-8"));
  const phase0Shadow = stopStyles("toonscape-wave-shadow-0");
  const phase0Highlight = stopStyles("toonscape-wave-highlight-0");
  const oppositeShadow = stopStyles("toonscape-wave-shadow-4");
  const oppositeHighlight = stopStyles("toonscape-wave-highlight-4");
  assert(opacity(phase0Highlight[0]) > 0 && opacity(phase0Shadow[0]) === 0,
    "an outward free-edge fold should be highlighted, not shadowed");
  assert(opacity(oppositeShadow[0]) > 0 && opacity(oppositeHighlight[0]) === 0,
    "the same position should become a dark trough half a cycle later");
  assert.equal(opacity(phase0Shadow.at(-1)), 0, "the fixed pole edge should have no generated shadow");
  assert.equal(opacity(phase0Highlight.at(-1)), 0, "the fixed pole edge should have no generated highlight");
  const envelope = index => document.querySelector(`#toonscape-wave-envelope-${index}`);
  for (const boundary of ["bendpath1", "bendpath2", "bendpath3", "bendpath4"]) {
    assert.equal(envelope(0).getAttribute(boundary), envelope(8).getAttribute(boundary));
  }
  const firstShadow = Array.from(document.querySelectorAll("linearGradient[id^='toonscape-wave-shadow-'] stop"), stop => stop.getAttribute("style"));
  assert(firstShadow.some(style => !/stop-opacity:0(?:;|$)/.test(style)), "shadow gradient should contain visible stops");
  console.log("make-wave-svg smoke test passed");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
