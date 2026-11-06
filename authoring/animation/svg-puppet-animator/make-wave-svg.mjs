#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { JSDOM } from "jsdom";
import "./svg-path.js";
import "./envelope-core.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";
const GENERATED = "data-toonscape-wave-generated";

const defaults = {
  object: "pirate_flag",
  duration: 4,
  phases: 8,
  turns: 1.15,
  amplitude: 30,
  shortening: 11,
  poleEdge: "right",
  gradient: true,
  gradientStops: 41,
  ambientStrength: 0.06,
  shadowStrength: 0.28,
  highlightStrength: 0.18,
  guides: true
};

function usage() {
  return `make-wave-svg — create an Inkscape-editable traveling flag wave

Usage:
  ./make-wave-svg.mjs INPUT.svg OUTPUT.svg [options]

The input must contain a time=<seconds> layer with a labelled vector group.
All painted artwork inside that group must be paths. Existing
inkscape:original-d values are used when present; otherwise each path's d is
adopted as its stable source geometry.

Options:
  --object LABEL               Flag group label (default: pirate_flag)
  --duration SECONDS           One complete cycle (default: 4)
  --phases N                   Distinct phase poses; closing pose is added
                               automatically (default: 8)
  --turns N                    Waves across the flag (default: 1.15)
  --amplitude N                Vertical wave amplitude in SVG units
                               (default: 30)
  --shortening N               Horizontal fold shortening (default: 11)
  --pole-edge left|right       Fixed edge (default: right)
  --gradient-stops N           Stops in each lighting gradient (default: 41)
  --ambient-strength N         Uniform white lift beneath the gradients,
                               allowing troughs to darken black artwork
                               (default: 0.06)
  --shadow-strength N          Maximum black overlay opacity (default: 0.28)
  --highlight-strength N       Maximum white overlay opacity (default: 0.18)
  --no-gradient                Omit generated shadow/highlight overlays
  --no-guides                  Omit the hidden envelope-boundary guide layer
  -h, --help                   Show this help

The generated SVG contains one time= layer per phase plus an exact closing
keyframe. Lighting is stored as ordinary Inkscape-editable linear gradients.
`;
}

function numberOption(name, value, { integer = false, min = -Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || (integer && !Number.isInteger(number))) {
    throw new Error(`${name} requires ${integer ? "an integer" : "a number"}${Number.isFinite(min) ? ` >= ${min}` : ""}`);
  }
  return number;
}

function parseArguments(argv) {
  const positional = [];
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const take = name => {
      if (index + 1 >= argv.length) throw new Error(`${name} requires a value`);
      return argv[++index];
    };
    if (token === "-h" || token === "--help") options.help = true;
    else if (token === "--object") options.object = take(token);
    else if (token === "--duration") options.duration = numberOption(token, take(token), { min: 0.001 });
    else if (token === "--phases") options.phases = numberOption(token, take(token), { integer: true, min: 4 });
    else if (token === "--turns") options.turns = numberOption(token, take(token), { min: 0.05 });
    else if (token === "--amplitude") options.amplitude = numberOption(token, take(token), { min: 0 });
    else if (token === "--shortening") options.shortening = numberOption(token, take(token), { min: 0 });
    else if (token === "--pole-edge") options.poleEdge = take(token);
    else if (token === "--gradient-stops") options.gradientStops = numberOption(token, take(token), { integer: true, min: 9 });
    else if (token === "--ambient-strength") options.ambientStrength = numberOption(token, take(token), { min: 0 });
    else if (token === "--shadow-strength") options.shadowStrength = numberOption(token, take(token), { min: 0 });
    else if (token === "--highlight-strength") options.highlightStrength = numberOption(token, take(token), { min: 0 });
    else if (token === "--no-gradient") options.gradient = false;
    else if (token === "--no-guides") options.guides = false;
    else if (token.startsWith("-")) throw new Error(`Unknown option: ${token}`);
    else positional.push(token);
  }
  if (!options.help && positional.length !== 2) throw new Error("INPUT.svg and OUTPUT.svg are required");
  if (!new Set(["left", "right"]).has(options.poleEdge)) throw new Error("--pole-edge must be left or right");
  if (options.ambientStrength > 1 || options.shadowStrength > 1 || options.highlightStrength > 1) throw new Error("Lighting strengths must be between 0 and 1");
  return { input: positional[0], output: positional[1], options };
}

const labelOf = element => element.getAttributeNS(INKSCAPE_NS, "label") || "";
const setLabel = (element, value) => element.setAttributeNS(INKSCAPE_NS, "inkscape:label", value);
const originalPathOf = element => element.getAttributeNS(INKSCAPE_NS, "original-d") || element.getAttribute("d") || "";
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function matrixWithin(element, ancestor) {
  let matrix = [1, 0, 0, 1, 0, 0];
  let node = element;
  while (node && node !== ancestor) {
    matrix = SvgPath.matrixMultiply(SvgPath.transformMatrix(node.getAttribute("transform")), matrix);
    node = node.parentElement;
  }
  if (node !== ancestor) throw new Error("Path is not a descendant of the flag group");
  return matrix;
}

function format(number) {
  return Number(number.toFixed(6)).toString();
}

function cubicPath(point, derivative, segments = 8) {
  const chunks = [];
  const h = 1 / segments;
  for (let index = 0; index <= segments; index += 1) {
    const u = index / segments;
    const p = point(u);
    if (index === 0) chunks.push(`M ${format(p[0])},${format(p[1])}`);
    if (index === segments) break;
    const v = (index + 1) / segments;
    const q = point(v), dp = derivative(u), dq = derivative(v);
    chunks.push(`C ${format(p[0] + dp[0] * h / 3)},${format(p[1] + dp[1] * h / 3)} ${format(q[0] - dq[0] * h / 3)},${format(q[1] - dq[1] * h / 3)} ${format(q[0])},${format(q[1])}`);
  }
  return chunks.join(" ");
}

function waveModel(bbox, phase, options) {
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const k = 2 * Math.PI * options.turns;
  const poleOnRight = options.poleEdge === "right";
  const horizontalDirection = poleOnRight ? 1 : -1;

  function displacementAndDerivative(u) {
    const s = poleOnRight ? 1 - u : u;
    const ds = poleOnRight ? -1 : 1;
    const ramp = s * s * (3 - 2 * s);
    const dr = 6 * s * (1 - s) * ds;
    const theta = k * s - phase;
    const dtheta = k * ds;
    const q = 0.55 + 0.45 * Math.cos(theta);
    const dq = -0.45 * Math.sin(theta) * dtheta;
    // Geometry gradually gains freedom across the whole flag, but lighting
    // only needs to fade close to the pole. Otherwise every bright fold would
    // be strongest at the free edge and the animation would read as a static
    // left-to-right gradient instead of traveling bands.
    const lightDistance = clamp(s / 0.32, 0, 1);
    const lightRamp = lightDistance * lightDistance * (3 - 2 * lightDistance);
    return {
      distance: s,
      // This is the inferred out-of-screen component of the fold. It is in
      // quadrature with the visible vertical displacement, as it would be for
      // a traveling circular fabric wave. Positive values bulge toward the
      // viewer; negative values recede into a trough.
      depth: lightRamp * Math.cos(theta),
      point: [
        horizontalDirection * options.shortening * ramp * q,
        options.amplitude * ramp * Math.sin(theta)
      ],
      derivative: [
        horizontalDirection * options.shortening * (dr * q + ramp * dq),
        options.amplitude * (dr * Math.sin(theta) + ramp * Math.cos(theta) * dtheta)
      ]
    };
  }

  const boundary = baseY => ({
    point: u => {
      const state = displacementAndDerivative(u);
      return [bbox.minX + width * u + state.point[0], baseY + state.point[1]];
    },
    derivative: u => {
      const state = displacementAndDerivative(u);
      return [width + state.derivative[0], state.derivative[1]];
    }
  });

  const top = boundary(bbox.minY), bottom = boundary(bbox.maxY);
  const topLeft = top.point(0), bottomLeft = bottom.point(0);
  const topRight = top.point(1), bottomRight = bottom.point(1);
  const freeTop = poleOnRight ? topLeft : topRight;
  const freeBottom = poleOnRight ? bottomLeft : bottomRight;
  const flutter = 5 * Math.sin(phase + 0.7);
  const freeBoundary = `M ${format(freeTop[0])},${format(freeTop[1])} C ${format(freeTop[0] + flutter)},${format(freeTop[1] + height / 3)} ${format(freeBottom[0] - flutter)},${format(freeBottom[1] - height / 3)} ${format(freeBottom[0])},${format(freeBottom[1])}`;
  const fixedX = poleOnRight ? bbox.maxX : bbox.minX;
  const fixedBoundary = `M ${format(fixedX)},${format(bbox.minY)} C ${format(fixedX)},${format(bbox.minY + height / 3)} ${format(fixedX)},${format(bbox.maxY - height / 3)} ${format(fixedX)},${format(bbox.maxY)}`;

  return {
    envelope: {
      bendpath1: cubicPath(top.point, top.derivative),
      bendpath2: poleOnRight ? fixedBoundary : freeBoundary,
      bendpath3: cubicPath(bottom.point, bottom.derivative),
      bendpath4: poleOnRight ? freeBoundary : fixedBoundary,
      xx: true,
      yy: true
    },
    lighting(u) {
      const state = displacementAndDerivative(u);
      // Treat the inferred depth directly as the lighting cue: fabric bulging
      // toward the viewer catches light, while the intervening troughs darken.
      // Unlike the old slope calculation, this has no systematic free-edge
      // brightening; highlight and shadow polarity reverses as the wave passes.
      const outward = Math.max(0, state.depth);
      const inward = Math.max(0, -state.depth);
      return {
        shadow: Math.pow(inward, 1.15) * options.shadowStrength,
        highlight: Math.pow(outward, 1.45) * options.highlightStrength
      };
    }
  };
}

function createGradient(document, defs, id, bbox, model, role, stopCount) {
  const gradient = document.createElementNS(SVG_NS, "linearGradient");
  gradient.id = id;
  gradient.setAttribute(GENERATED, "true");
  gradient.setAttributeNS(INKSCAPE_NS, "inkscape:collect", "always");
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.setAttribute("x1", format(bbox.minX));
  gradient.setAttribute("y1", format((bbox.minY + bbox.maxY) / 2));
  gradient.setAttribute("x2", format(bbox.maxX));
  gradient.setAttribute("y2", format((bbox.minY + bbox.maxY) / 2));
  gradient.setAttribute("color-interpolation", "sRGB");
  setLabel(gradient, `wave ${role}`);
  for (let index = 0; index < stopCount; index += 1) {
    const u = index / (stopCount - 1);
    const stop = document.createElementNS(SVG_NS, "stop");
    const opacity = model.lighting(u)[role];
    stop.id = `${id}-stop-${index}`;
    stop.setAttribute("offset", format(u));
    stop.setAttribute("style", `stop-color:${role === "shadow" ? "#000000" : "#ffffff"};stop-opacity:${format(opacity)}`);
    gradient.appendChild(stop);
  }
  defs.appendChild(gradient);
  return gradient;
}

function remapCloneIds(layer, prefix) {
  const idMap = new Map();
  for (const element of [layer, ...layer.querySelectorAll("[id]")]) {
    const oldId = element.id;
    if (!oldId) continue;
    const newId = `${prefix}-${oldId}`;
    idMap.set(oldId, newId);
    element.id = newId;
  }
  for (const element of [layer, ...layer.querySelectorAll("*")]) {
    for (const attribute of Array.from(element.attributes)) {
      let value = attribute.value;
      for (const [oldId, newId] of idMap) {
        value = value.replaceAll(`url(#${oldId})`, `url(#${newId})`).replaceAll(`#${oldId}`, `#${newId}`);
      }
      if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
    }
  }
}

function setLayerVisible(layer, visible) {
  const declarations = new Map((layer.getAttribute("style") || "").split(";").map(item => item.trim()).filter(Boolean).map(item => {
    const split = item.indexOf(":");
    return split < 0 ? [item, ""] : [item.slice(0, split).trim(), item.slice(split + 1).trim()];
  }));
  declarations.set("display", visible ? "inline" : "none");
  layer.setAttribute("style", Array.from(declarations, ([name, value]) => `${name}:${value}`).join(";"));
}

function main() {
  const { input, output, options } = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const source = fs.readFileSync(input, "utf8");
  const dom = new JSDOM(source, { contentType: "image/svg+xml" });
  const document = dom.window.document;
  const root = document.documentElement;
  const defs = root.querySelector("defs");
  if (!defs) throw new Error("SVG has no defs element");

  for (const element of Array.from(root.querySelectorAll(`[${GENERATED}='true'], [id^='toonscape-wave-']`))) element.remove();

  const timedLayers = Array.from(root.children).filter(element => /^time=/.test(labelOf(element)));
  if (!timedLayers.length) throw new Error("No top-level time=<seconds> layer found");
  timedLayers.sort((a, b) => Number(labelOf(a).slice(5)) - Number(labelOf(b).slice(5)));
  const templateLayer = timedLayers[0];
  const templateObject = Array.from(templateLayer.querySelectorAll("g")).find(element => labelOf(element) === options.object);
  if (!templateObject) throw new Error(`No group labelled ${JSON.stringify(options.object)} was found in ${labelOf(templateLayer)}`);

  const unsupported = Array.from(templateObject.querySelectorAll("rect,circle,ellipse,line,polyline,polygon,text,image,use"));
  if (unsupported.length) {
    const names = [...new Set(unsupported.map(element => element.localName))].join(", ");
    throw new Error(`The flag contains non-path artwork (${names}). In Inkscape, convert painted flag artwork to paths before generating the wave.`);
  }
  const templatePaths = Array.from(templateObject.querySelectorAll("path"));
  if (!templatePaths.length) throw new Error("The flag group contains no paths");
  const pathInfo = templatePaths.map(path => {
    const original = originalPathOf(path);
    if (!original) throw new Error(`Path ${path.id || "(without id)"} has no d geometry`);
    const localToObject = matrixWithin(path, templateObject);
    return { original, localToObject, objectToLocal: SvgPath.matrixInverse(localToObject) };
  });
  const bbox = EnvelopeMorph.bboxFromPaths(pathInfo.map(item => ({ data: item.original, matrix: item.localToObject })));

  for (const layer of timedLayers) layer.remove();
  for (const effect of Array.from(defs.children).filter(element => element.localName === "path-effect")) effect.remove();

  const phaseModels = Array.from({ length: options.phases }, (_, index) =>
    waveModel(bbox, index * 2 * Math.PI / options.phases, options)
  );
  // Reuse the first model object for the closing keyframe so all serialized
  // envelope coordinates and gradient opacities are byte-for-byte identical.
  const models = [...phaseModels, phaseModels[0]];
  const insertBefore = Array.from(root.children).find(element => element.localName === "metadata") || null;
  const sourceRectangle = `M ${format(bbox.minX)},${format(bbox.minY)} H ${format(bbox.maxX)} V ${format(bbox.maxY)} H ${format(bbox.minX)} Z`;

  models.forEach((model, index) => {
    const envelope = model.envelope;
    const effect = document.createElementNS(INKSCAPE_NS, "inkscape:path-effect");
    effect.setAttribute("effect", "envelope");
    effect.id = `toonscape-wave-envelope-${index}`;
    effect.setAttribute(GENERATED, "true");
    effect.setAttribute("is_visible", "true");
    effect.setAttribute("lpeversion", "1");
    for (const key of ["bendpath1", "bendpath2", "bendpath3", "bendpath4"]) effect.setAttribute(key, envelope[key]);
    effect.setAttribute("xx", "true");
    effect.setAttribute("yy", "true");
    defs.appendChild(effect);

    if (options.gradient) {
      createGradient(document, defs, `toonscape-wave-shadow-${index}`, bbox, model, "shadow", options.gradientStops);
      createGradient(document, defs, `toonscape-wave-highlight-${index}`, bbox, model, "highlight", options.gradientStops);
    }

    const layer = templateLayer.cloneNode(true);
    remapCloneIds(layer, `wave-${index}`);
    layer.id = `toonscape-wave-time-${index}`;
    layer.setAttribute(GENERATED, "true");
    setLabel(layer, `time=${format(index * options.duration / options.phases)}`);
    layer.removeAttribute("transform");
    setLayerVisible(layer, index === 0);

    const object = Array.from(layer.querySelectorAll("g")).find(element => labelOf(element) === options.object);
    object.id = `toonscape-wave-object-${index}`;
    object.setAttributeNS(INKSCAPE_NS, "inkscape:path-effect", `#toonscape-wave-envelope-${index}`);
    object.setAttribute("data-toonscape-wave-phase", String(index));
    const paths = Array.from(object.querySelectorAll("path"));
    const mapper = EnvelopeMorph.createMapper(envelope, envelope, 0, bbox);
    paths.forEach((path, pathIndex) => {
      const item = pathInfo[pathIndex];
      path.id = `toonscape-wave-${index}-path-${pathIndex}`;
      path.setAttributeNS(INKSCAPE_NS, "inkscape:original-d", item.original);
      path.setAttribute("d", EnvelopeMorph.deformPath(item.original, mapper, item.localToObject, item.objectToLocal, { tolerance: 0.08 }));
    });

    if (options.gradient) {
      for (const role of ["ambient", "shadow", "highlight"]) {
        const overlay = document.createElementNS(SVG_NS, "path");
        overlay.id = `toonscape-wave-${role}-overlay-${index}`;
        overlay.setAttribute(GENERATED, "true");
        setLabel(overlay, `wave_${role}`);
        overlay.setAttributeNS(INKSCAPE_NS, "inkscape:original-d", sourceRectangle);
        overlay.setAttribute("d", EnvelopeMorph.deformPath(sourceRectangle, mapper, [1, 0, 0, 1, 0, 0], [1, 0, 0, 1, 0, 0], { tolerance: 0.08 }));
        if (role === "ambient") {
          overlay.setAttribute("style", `fill:#ffffff;fill-opacity:${format(options.ambientStrength)};stroke:none`);
        } else {
          overlay.setAttribute("style", `fill:url(#toonscape-wave-${role}-${index});fill-opacity:1;stroke:none`);
          overlay.setAttribute("data-toonscape-gradient-role", role);
        }
        overlay.setAttribute("data-toonscape-lighting-role", role);
        object.appendChild(overlay);
      }
    }
    root.insertBefore(layer, insertBefore);
  });

  if (options.guides) {
    const guideLayer = document.createElementNS(SVG_NS, "g");
    guideLayer.id = "toonscape-wave-guides";
    guideLayer.setAttribute(GENERATED, "true");
    guideLayer.setAttribute("style", "display:none");
    guideLayer.setAttributeNS(INKSCAPE_NS, "inkscape:groupmode", "layer");
    setLabel(guideLayer, "GUIDES – generated envelope boundaries (hide for rendering)");
    const colors = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00a7ff", "#007aff", "#5856d6", "#af52de"];
    models.forEach((model, index) => {
      const group = document.createElementNS(SVG_NS, "g");
      group.setAttribute("transform", templateObject.getAttribute("transform") || "");
      setLabel(group, `phase ${index}`);
      for (const key of ["bendpath1", "bendpath2", "bendpath3", "bendpath4"]) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", model.envelope[key]);
        path.setAttribute("style", `fill:none;stroke:${colors[index % colors.length]};stroke-width:3;stroke-linecap:round;stroke-linejoin:round`);
        group.appendChild(path);
      }
      guideLayer.appendChild(group);
    });
    root.insertBefore(guideLayer, insertBefore);
  }

  let title = root.querySelector(":scope > title");
  if (!title) { title = document.createElementNS(SVG_NS, "title"); root.insertBefore(title, root.firstChild); }
  title.textContent = "ToonScape traveling-wave flag";
  let description = root.querySelector(":scope > desc");
  if (!description) { description = document.createElementNS(SVG_NS, "desc"); root.insertBefore(description, title.nextSibling); }
  description.textContent = `${options.phases} compatible Inkscape Envelope Deformation phase poses plus a closing keyframe. The ${options.poleEdge} pole edge is fixed. ${options.gradient ? "Generated highlights mark folds bulging toward the viewer; shadows mark the intervening troughs." : "No lighting gradients were generated."}`;

  fs.writeFileSync(output, dom.serialize());
  process.stdout.write(`Wrote ${output}\n`);
  process.stdout.write(`Flag source box ${format(bbox.minX)},${format(bbox.minY)} to ${format(bbox.maxX)},${format(bbox.maxY)}\n`);
  process.stdout.write(`${options.phases} phase poses + closing keyframe over ${format(options.duration)} seconds${options.gradient ? `; ${options.gradientStops}-stop shadow/highlight gradients` : ""}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`ERROR: ${error.message}\n`);
  process.exitCode = 1;
}
