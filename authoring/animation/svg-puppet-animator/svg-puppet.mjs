#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const VENDOR_P5 = path.join(SCRIPT_DIR, "vendor", "p5.min.js");
const PLAYER_JS = path.join(SCRIPT_DIR, "player.js");
const SVG_PATH_JS = path.join(SCRIPT_DIR, "svg-path.js");
const ENVELOPE_CORE_JS = path.join(SCRIPT_DIR, "envelope-core.js");

function usage(exitCode = 0) {
  const text = `
ToonScape SVG Animator

Compile an Inkscape SVG containing time=<seconds> layers into a p5.js-driven
animation preview, or render it to MP4/WebM when Playwright and ffmpeg are
available. Labelled actors may combine ordinary SVG transforms, articulated
parts, and compatible Inkscape Envelope Deformation effects on one timeline.

Usage:
  svg-puppet INPUT.svg [options]

Options:
  -o, --output PATH          Preview directory, .mp4 file, or .webm file
                             (default: INPUT-animation)
      --loop-mode MODE       repeat or pingpong (default: repeat)
      --loops N              Number of complete iterations (default: 1)
      --loop-delay SECONDS   Hold between iterations, not after the last
                             (default: 0)
      --start-hold SECONDS   Hold the first pose before playback (default: 0)
      --end-hold SECONDS     Hold the ending pose after playback (default: 0)
      --fps N                Video-rendering frame rate (default: 30)
      --easing NAME          linear or ease-in-out-sine
                             (default: ease-in-out-sine)
      --keep-preview         Keep the generated preview beside a video
      --quiet                Suppress informational diagnostics
  -h, --help                 Show this help

Loop semantics:
  --loop-mode repeat --loops=1 plays the authored SVG timeline once. With one
  iteration there is no visible repetition; it is equivalent to a one-shot
  mode. --loop-mode pingpong --loops=1 plays forward and then backward once.

Timing and canvas:
  Timing comes from the time=<seconds> layer labels in the SVG. The visible
  canvas is exactly the SVG document/viewBox region. Artwork outside the page
  remains available for animation but is clipped from the rendered video.

Examples:
  svg-puppet JD.svg -o JD-preview --loop-mode pingpong --loops 5
  svg-puppet JD.svg -o JD.mp4 --loop-mode pingpong --loops 5 --fps 30
  svg-puppet cannon.svg -o cannon.mp4 --loop-mode repeat --loops 5
`;
  console.log(text.trim());
  process.exit(exitCode);
}

function parseNumber(value, name, { integer = false, min = 0, positive = false } = {}) {
  const number = Number(value);
  const valid = Number.isFinite(number) && (!integer || Number.isInteger(number)) &&
    (positive ? number > 0 : number >= min);
  if (!valid) throw new Error(`Invalid ${name}: ${value}`);
  return number;
}

function parseArgs(argv) {
  const options = {
    input: null,
    output: null,
    loopMode: "repeat",
    loops: 1,
    loopDelay: 0,
    startHold: 0,
    endHold: 0,
    fps: 30,
    easing: "ease-in-out-sine",
    keepPreview: false,
    quiet: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const [rawName, inlineValue] = arg.startsWith("--") && arg.includes("=")
      ? arg.split(/=(.*)/s, 2)
      : [arg, undefined];
    const takeValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${rawName}`);
      i += 1;
      return argv[i];
    };

    switch (rawName) {
      case "-h":
      case "--help": usage(0); break;
      case "-o":
      case "--output": options.output = takeValue(); break;
      case "--loop-mode": options.loopMode = takeValue(); break;
      case "--loops": options.loops = parseNumber(takeValue(), "--loops", { integer: true, positive: true }); break;
      case "--loop-delay": options.loopDelay = parseNumber(takeValue(), "--loop-delay"); break;
      case "--start-hold": options.startHold = parseNumber(takeValue(), "--start-hold"); break;
      case "--end-hold": options.endHold = parseNumber(takeValue(), "--end-hold"); break;
      case "--fps": options.fps = parseNumber(takeValue(), "--fps", { integer: true, positive: true }); break;
      case "--easing": options.easing = takeValue(); break;
      case "--keep-preview": options.keepPreview = true; break;
      case "--quiet": options.quiet = true; break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        if (options.input) throw new Error(`Unexpected second input file: ${arg}`);
        options.input = arg;
    }
  }

  if (!options.input) usage(1);
  if (!["repeat", "pingpong"].includes(options.loopMode)) {
    throw new Error("--loop-mode must be repeat or pingpong");
  }
  if (!["linear", "ease-in-out-sine"].includes(options.easing)) {
    throw new Error("--easing must be linear or ease-in-out-sine");
  }
  return options;
}

function xmlDecode(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function inspectSvg(svgText) {
  const svgOpen = svgText.match(/<svg\b[\s\S]*?>/i)?.[0];
  if (!svgOpen) throw new Error("Input is not an SVG document");
  const width = xmlDecode(svgOpen.match(/\bwidth\s*=\s*"([^"]+)"/i)?.[1] ?? "");
  const height = xmlDecode(svgOpen.match(/\bheight\s*=\s*"([^"]+)"/i)?.[1] ?? "");
  const viewBox = xmlDecode(svgOpen.match(/\bviewBox\s*=\s*"([^"]+)"/i)?.[1] ?? "");
  if (!viewBox) throw new Error("SVG must have a viewBox so the document region is unambiguous");

  const labels = [...svgText.matchAll(/\binkscape:label\s*=\s*"([^"]+)"/g)].map(match => xmlDecode(match[1]));
  const times = labels
    .map(label => label.match(/^time=(-?(?:\d+(?:\.\d*)?|\.\d+))$/)?.[1])
    .filter(value => value !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  const envelopeEffects = [...svgText.matchAll(/\beffect\s*=\s*"envelope"/g)].length;

  if (times.length < 2) throw new Error("SVG must contain at least two layers labelled time=<seconds>");
  if (new Set(times).size !== times.length) throw new Error("Duplicate time=<seconds> layer values are not allowed");
  return { width, height, viewBox, times, envelopeEffects };
}

function buildReadme(inputName, config, inspection) {
  const span = inspection.times.at(-1) - inspection.times[0];
  const cycle = config.loopMode === "pingpong" ? span * 2 : span;
  const duration = config.startHold + config.endHold + cycle * config.loops + config.loopDelay * Math.max(0, config.loops - 1);
  return `ToonScape SVG Animator preview

Source: ${inputName}
Keyframe times: ${inspection.times.join(", ")} seconds
Envelope Deformation definitions: ${inspection.envelopeEffects}
Loop mode: ${config.loopMode}
Loops: ${config.loops}
Approximate duration: ${duration.toFixed(6)} seconds
Video frame rate: ${config.fps} fps

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
`;
}

function buildHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ToonScape SVG Animation</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    html, body { margin: 0; min-height: 100%; background: #242424; }
    body { display: flex; flex-direction: column; align-items: center; }
    #stage-host { line-height: 0; max-width: 100vw; }
    #stage { display: block; max-width: 100vw; max-height: calc(100vh - 8rem); width: auto; height: auto; overflow: hidden; }
    #controls { width: min(60rem, calc(100vw - 2rem)); padding: 1rem; line-height: 1.4; }
    #transport { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
    button { padding: .45rem .8rem; }
    input[type="range"] { flex: 1; min-width: 14rem; }
    #diagnostics { white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: .82rem; color: #d7d7d7; }
    body.capture { background: transparent; display: block; }
    body.capture #controls { display: none; }
    body.capture #stage { max-width: none; max-height: none; }
  </style>
</head>
<body>
  <div id="stage-host"></div>
  <section id="controls">
    <div id="transport">
      <button id="play">Play</button>
      <button id="pause">Pause</button>
      <button id="restart">Restart</button>
      <input id="scrubber" type="range" min="0" max="1" value="0" step="0.0001" aria-label="Animation time">
      <output id="clock">0.000 s</output>
    </div>
    <details><summary>Diagnostics</summary><pre id="diagnostics"></pre></details>
  </section>
  <script src="animation-data.js"></script>
  <script src="p5.min.js"></script>
  <script src="svg-path.js"></script>
  <script src="envelope-core.js"></script>
  <script src="player.js"></script>
</body>
</html>
`;
}

function writePreview(svgPath, outDir, options, inspection) {
  const svgBytes = fs.readFileSync(svgPath);
  fs.mkdirSync(outDir, { recursive: true });
  const payload = {
    sourceName: path.basename(svgPath),
    sourceBase64: svgBytes.toString("base64"),
    options: {
      loopMode: options.loopMode,
      loops: options.loops,
      loopDelay: options.loopDelay,
      startHold: options.startHold,
      endHold: options.endHold,
      fps: options.fps,
      easing: options.easing
    }
  };
  fs.writeFileSync(path.join(outDir, "animation-data.js"), `window.SVG_PUPPET_CONFIG = ${JSON.stringify(payload)};\n`);
  fs.writeFileSync(path.join(outDir, "index.html"), buildHtml());
  fs.copyFileSync(VENDOR_P5, path.join(outDir, "p5.min.js"));
  fs.copyFileSync(SVG_PATH_JS, path.join(outDir, "svg-path.js"));
  fs.copyFileSync(ENVELOPE_CORE_JS, path.join(outDir, "envelope-core.js"));
  fs.copyFileSync(PLAYER_JS, path.join(outDir, "player.js"));
  fs.writeFileSync(path.join(outDir, "README.txt"), buildReadme(path.basename(svgPath), options, inspection));
}

async function renderVideo(previewDir, outputPath, options, quiet) {
  const require = createRequire(import.meta.url);
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    throw new Error("Video rendering requires Playwright. Install it with: npm install playwright");
  }
  const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (ffmpegCheck.status !== 0) throw new Error("Video rendering requires ffmpeg");

  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), "svg-puppet-frames-"));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (bundledBrowserError) {
    try {
      browser = await chromium.launch({ headless: true, channel: "chrome" });
    } catch {
      const candidates = [
        process.env.TOONSCAPE_BROWSER,
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium"
      ].filter(Boolean).filter(candidate => fs.existsSync(candidate));
      for (const executablePath of candidates) {
        try {
          browser = await chromium.launch({ headless: true, executablePath });
          break;
        } catch { /* Try the next installed browser. */ }
      }
      if (!browser) throw new Error(`Playwright could not launch its bundled browser, installed Google Chrome, or an installed Chromium executable. Run "npx playwright install chromium", install Chrome, or set TOONSCAPE_BROWSER. Original error: ${bundledBrowserError.message}`);
    }
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 2000 }, deviceScaleFactor: 1 });
    page.on("console", message => {
      if (!quiet && ["warning", "error"].includes(message.type())) console.error(`[browser ${message.type()}] ${message.text()}`);
    });
    const url = `${pathToFileURL(path.join(previewDir, "index.html")).href}?capture=1`;
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => window.__svgPuppet?.ready === true, null, { timeout: 30000 });
    const metadata = await page.evaluate(() => ({
      duration: window.__svgPuppet.duration,
      width: window.__svgPuppet.width,
      height: window.__svgPuppet.height,
      diagnostics: window.__svgPuppet.diagnostics
    }));
    if (!quiet) {
      console.log(`Canvas: ${metadata.width}x${metadata.height}`);
      console.log(`Duration: ${metadata.duration.toFixed(6)} seconds`);
      for (const item of metadata.diagnostics) console.log(item);
    }
    // A video frame occupies an interval; a zero-duration endpoint is not an
    // additional frame.  Appending the closing endpoint here would make, for
    // example, a one-second 30 fps render contain 31 encoded frames.  Authors
    // who want the final pose visible should give it time with a later
    // keyframe or --end-hold.
    const frameCount = Math.max(1, Math.ceil(metadata.duration * options.fps - 1e-9));
    const digits = String(Math.max(0, frameCount - 1)).length;
    const stage = page.locator("#stage");
    for (let index = 0; index < frameCount; index += 1) {
      const seconds = index / options.fps;
      await page.evaluate(time => window.__svgPuppet.seekSeconds(time), seconds);
      const name = `frame-${String(index).padStart(Math.max(6, digits), "0")}.png`;
      await stage.screenshot({ path: path.join(framesDir, name), type: "png", animations: "disabled" });
      if (!quiet && (index + 1) % Math.max(1, Math.floor(options.fps)) === 0) {
        console.log(`Rendered ${index + 1}/${frameCount} frames`);
      }
    }

    const isWebm = outputPath.toLowerCase().endsWith(".webm");
    const codecArgs = isWebm
      ? ["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p"]
      : ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    const ffmpeg = spawnSync("ffmpeg", [
      "-y", "-framerate", String(options.fps),
      "-i", path.join(framesDir, "frame-%06d.png"),
      ...codecArgs,
      outputPath
    ], { stdio: quiet ? "ignore" : "inherit" });
    if (ffmpeg.status !== 0) throw new Error(`ffmpeg failed with exit code ${ffmpeg.status}`);
  } finally {
    await browser.close();
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const svgPath = path.resolve(options.input);
  if (!fs.existsSync(svgPath)) throw new Error(`Input file not found: ${svgPath}`);
  if (!fs.existsSync(VENDOR_P5)) throw new Error(`Missing bundled p5.js: ${VENDOR_P5}`);
  if (!fs.existsSync(SVG_PATH_JS) || !fs.existsSync(ENVELOPE_CORE_JS)) throw new Error("Missing bundled envelope geometry modules");
  const svgText = fs.readFileSync(svgPath, "utf8");
  const inspection = inspectSvg(svgText);
  const defaultOutput = path.join(path.dirname(svgPath), `${path.basename(svgPath, path.extname(svgPath))}-animation`);
  const outputPath = path.resolve(options.output ?? defaultOutput);
  const video = /\.(mp4|webm)$/i.test(outputPath);
  const previewDir = video
    ? (options.keepPreview ? outputPath.replace(/\.(mp4|webm)$/i, "-preview") : fs.mkdtempSync(path.join(os.tmpdir(), "svg-puppet-preview-")))
    : outputPath;

  if (!options.quiet) {
    console.log(`Input: ${svgPath}`);
    console.log(`Keyframes: ${inspection.times.join(", ")} seconds`);
    console.log(`Envelope Deformation definitions: ${inspection.envelopeEffects}`);
  }
  writePreview(svgPath, previewDir, options, inspection);
  if (video) {
    try {
      await renderVideo(previewDir, outputPath, options, options.quiet);
      if (!options.quiet) console.log(`Video: ${outputPath}`);
    } finally {
      if (!options.keepPreview) fs.rmSync(previewDir, { recursive: true, force: true });
    }
  } else if (!options.quiet) {
    console.log(`Preview: ${path.join(previewDir, "index.html")}`);
  }
}

main().catch(error => {
  console.error(`svg-puppet: ${error.message}`);
  process.exit(1);
});
