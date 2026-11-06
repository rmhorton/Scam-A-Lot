(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";
  const NUMBER_RE = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
  const config = window.SVG_PUPPET_CONFIG;
  const diagnostics = [];

  if (!config) throw new Error("animation-data.js did not define SVG_PUPPET_CONFIG");

  function note(level, message) {
    const line = `${level}: ${message}`;
    diagnostics.push(line);
    if (level === "WARNING") console.warn(line);
    else console.info(line);
  }

  function decodeUtf8Base64(base64) {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function labelOf(element) {
    return element.getAttributeNS(INKSCAPE_NS, "label") || element.getAttribute("inkscape:label") || "";
  }

  function originalPathOf(element) {
    return element.getAttributeNS(INKSCAPE_NS, "original-d") || element.getAttribute("inkscape:original-d") || "";
  }

  function pathEffectOf(element) {
    return element.getAttributeNS(INKSCAPE_NS, "path-effect") || element.getAttribute("inkscape:path-effect") || "";
  }

  function effectReferenceIds(value) {
    return String(value || "").split(";").map(reference => {
      const trimmed = reference.trim();
      const url = trimmed.match(/^url\(\s*#([^\s)]+)\s*\)$/);
      if (url) return url[1];
      return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
    }).filter(Boolean);
  }

  function referencesEnvelope(document, element) {
    return effectReferenceIds(pathEffectOf(element)).some(id => document.getElementById(id)?.getAttribute("effect") === "envelope");
  }

  function effectDefinition(document, object) {
    const effects = effectReferenceIds(pathEffectOf(object)).map(id => {
      const element = document.getElementById(id);
      if (!element) throw new Error(`${labelOf(object) || object.id} references missing path effect #${id}`);
      return { id, element, type: element.getAttribute("effect") || "unknown" };
    });
    const envelopeIndexes = effects.map((item, index) => item.type === "envelope" ? index : -1).filter(index => index >= 0);
    if (envelopeIndexes.length !== 1) {
      const summary = effects.length ? effects.map(item => `${item.id} (${item.type})`).join(", ") : "no path effects";
      throw new Error(`${labelOf(object) || object.id} must reference exactly one Inkscape Envelope Deformation effect; found ${summary}`);
    }
    const envelopeIndex = envelopeIndexes[0];
    const { id, element: effect } = effects[envelopeIndex];
    const following = effects.slice(envelopeIndex + 1).filter(item => item.element.getAttribute("is_visible") !== "false");
    if (following.length) throw new Error(`${labelOf(object) || object.id} has unsupported visible path effects after its envelope: ${following.map(item => `${item.id} (${item.type})`).join(", ")}`);
    const result = { id };
    for (let number = 1; number <= 4; number += 1) {
      result[`bendpath${number}`] = effect.getAttribute(`bendpath${number}`) || "";
      if (!result[`bendpath${number}`]) throw new Error(`Envelope ${id} is missing bendpath${number}`);
    }
    result.xx = effect.getAttribute("xx") !== "false";
    result.yy = effect.getAttribute("yy") !== "false";
    result.prefixEffects = effects.slice(0, envelopeIndex).filter(item => item.element.getAttribute("is_visible") !== "false").map(item => ({
      id: item.id,
      type: item.type,
      deformType: item.element.getAttribute("deform_type") || "",
      horizontalMirror: item.element.getAttribute("horizontal_mirror") === "true",
      verticalMirror: item.element.getAttribute("vertical_mirror") === "true",
      upLeft: item.element.getAttribute("up_left_point") || "",
      upRight: item.element.getAttribute("up_right_point") || "",
      downLeft: item.element.getAttribute("down_left_point") || "",
      downRight: item.element.getAttribute("down_right_point") || ""
    }));
    return result;
  }

  function removeDisplay(styleText) {
    const map = parseStyle(styleText || "");
    delete map.display;
    return serializeStyle(map);
  }

  function parseStyle(styleText) {
    const map = {};
    for (const declaration of styleText.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const key = declaration.slice(0, colon).trim();
      const value = declaration.slice(colon + 1).trim();
      if (key) map[key] = value;
    }
    return map;
  }

  function serializeStyle(map) {
    return Object.entries(map).map(([key, value]) => `${key}:${value}`).join(";");
  }

  function matrixMultiply(left, right) {
    const [a1, b1, c1, d1, e1, f1] = left;
    const [a2, b2, c2, d2, e2, f2] = right;
    return [
      a1 * a2 + c1 * b2,
      b1 * a2 + d1 * b2,
      a1 * c2 + c1 * d2,
      b1 * c2 + d1 * d2,
      a1 * e2 + c1 * f2 + e1,
      b1 * e2 + d1 * f2 + f1
    ];
  }

  function matrixTranslate(x, y) { return [1, 0, 0, 1, x, y]; }
  function matrixScale(x, y) { return [x, 0, 0, y, 0, 0]; }
  function matrixApply(matrix, point) {
    return [
      matrix[0] * point[0] + matrix[2] * point[1] + matrix[4],
      matrix[1] * point[0] + matrix[3] * point[1] + matrix[5]
    ];
  }

  function matrixInverse(matrix) {
    const [a, b, c, d, e, f] = matrix;
    const determinant = a * d - b * c;
    if (Math.abs(determinant) < 1e-12) throw new Error("Cannot interpolate an image with a singular transform");
    return [
      d / determinant,
      -b / determinant,
      -c / determinant,
      a / determinant,
      (c * f - d * e) / determinant,
      (b * e - a * f) / determinant
    ];
  }
  function matrixRotate(degrees) {
    const radians = degrees * Math.PI / 180;
    return [Math.cos(radians), Math.sin(radians), -Math.sin(radians), Math.cos(radians), 0, 0];
  }

  function parseTransform(text) {
    let result = [1, 0, 0, 1, 0, 0];
    if (!text?.trim()) return result;
    const matcher = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
    let match;
    while ((match = matcher.exec(text))) {
      const name = match[1].toLowerCase();
      const values = (match[2].match(NUMBER_RE) || []).map(Number);
      let next = [1, 0, 0, 1, 0, 0];
      if (name === "matrix" && values.length >= 6) next = values.slice(0, 6);
      else if (name === "translate") next = matrixTranslate(values[0] || 0, values[1] || 0);
      else if (name === "scale") next = matrixScale(values[0] ?? 1, values[1] ?? values[0] ?? 1);
      else if (name === "rotate") {
        const rotation = matrixRotate(values[0] || 0);
        if (values.length >= 3) {
          next = matrixMultiply(matrixMultiply(matrixTranslate(values[1], values[2]), rotation), matrixTranslate(-values[1], -values[2]));
        } else next = rotation;
      } else if (name === "skewx") {
        next = [1, 0, Math.tan((values[0] || 0) * Math.PI / 180), 1, 0, 0];
      } else if (name === "skewy") {
        next = [1, Math.tan((values[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
      }
      result = matrixMultiply(result, next);
    }
    return result;
  }

  function matrixWithin(element, ancestor) {
    let matrix = [1, 0, 0, 1, 0, 0];
    let node = element;
    while (node && node !== ancestor) {
      matrix = matrixMultiply(parseTransform(node.getAttribute("transform") || ""), matrix);
      node = node.parentElement;
    }
    if (node !== ancestor) throw new Error("Element is not a descendant of the expected envelope object");
    return matrix;
  }

  function matrixToAncestor(element, ancestor) {
    let matrix = [1, 0, 0, 1, 0, 0];
    let node = element;
    while (node && node !== ancestor) {
      matrix = matrixMultiply(parseTransform(node.getAttribute("transform") || ""), matrix);
      node = node.parentElement;
    }
    if (node !== ancestor) throw new Error("Animated object is not a descendant of its SVG root");
    return matrix;
  }

  function matrixString(matrix) {
    return `matrix(${matrix.map(value => Number(value.toFixed(10))).join(" ")})`;
  }

  function pointPair(value) {
    const numbers = String(value || "").match(NUMBER_RE) || [];
    return numbers.length === 2 ? numbers.map(Number) : null;
  }

  function validatePrefixEffects(objects, bbox) {
    const expected = {
      upLeft: [bbox.minX, bbox.minY], upRight: [bbox.maxX, bbox.minY],
      downLeft: [bbox.minX, bbox.maxY], downRight: [bbox.maxX, bbox.maxY]
    };
    const tolerance = Math.max(1, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 1e-5;
    const ignored = new Set();
    for (const object of objects) {
      for (const effect of object.envelope.prefixEffects) {
        const cornersMatch = Object.entries(expected).every(([name, target]) => {
          const point = pointPair(effect[name]);
          return point && Math.hypot(point[0] - target[0], point[1] - target[1]) <= tolerance;
        });
        const identityPerspective = effect.type === "perspective-envelope" && effect.deformType === "perspective" &&
          !effect.horizontalMirror && !effect.verticalMirror && cornersMatch;
        if (!identityPerspective) throw new Error(`${object.label} has unsupported non-identity path effect #${effect.id} (${effect.type}) before its envelope`);
        ignored.add(effect.type);
      }
    }
    if (ignored.size) note("INFO", `Ignored identity prefix effect${ignored.size === 1 ? "" : "s"}: ${Array.from(ignored).join(", ")}`);
  }

  function decomposeMatrix(matrix) {
    let [a, b, c, d, e, f] = matrix;
    let scaleX = Math.hypot(a, b);
    if (scaleX < 1e-12) return { x: e, y: f, rotation: 0, scaleX: 0, scaleY: Math.hypot(c, d), skew: 0 };
    a /= scaleX;
    b /= scaleX;
    let skew = a * c + b * d;
    c -= a * skew;
    d -= b * skew;
    let scaleY = Math.hypot(c, d);
    if (scaleY > 1e-12) {
      c /= scaleY;
      d /= scaleY;
      skew /= scaleY;
    }
    if (matrix[0] * matrix[3] - matrix[1] * matrix[2] < 0) scaleY = -scaleY;
    return { x: e, y: f, rotation: Math.atan2(b, a), scaleX, scaleY, skew };
  }

  function composeMatrix(value) {
    const cos = Math.cos(value.rotation);
    const sin = Math.sin(value.rotation);
    const rotation = [cos, sin, -sin, cos, 0, 0];
    const skew = [1, 0, value.skew, 1, 0, 0];
    return matrixMultiply(matrixTranslate(value.x, value.y), matrixMultiply(rotation, matrixMultiply(skew, matrixScale(value.scaleX, value.scaleY))));
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function interpolateAngle(a, b, t) {
    let difference = b - a;
    while (difference > Math.PI) difference -= Math.PI * 2;
    while (difference < -Math.PI) difference += Math.PI * 2;
    return a + difference * t;
  }

  function interpolateTransform(a, b, t) {
    const first = decomposeMatrix(parseTransform(a));
    const second = decomposeMatrix(parseTransform(b));
    const matrix = composeMatrix({
      x: lerp(first.x, second.x, t),
      y: lerp(first.y, second.y, t),
      rotation: interpolateAngle(first.rotation, second.rotation, t),
      scaleX: lerp(first.scaleX, second.scaleX, t),
      scaleY: lerp(first.scaleY, second.scaleY, t),
      skew: lerp(first.skew, second.skew, t)
    });
    return `matrix(${matrix.map(number => Number(number.toFixed(10))).join(" ")})`;
  }

  function numericTemplate(value) {
    const numbers = [];
    const strings = [];
    let last = 0;
    for (const match of value.matchAll(NUMBER_RE)) {
      strings.push(value.slice(last, match.index));
      numbers.push(Number(match[0]));
      last = match.index + match[0].length;
    }
    strings.push(value.slice(last));
    const skeleton = strings.join("#").replace(/[\s,]+/g, " ").trim();
    return { numbers, strings, skeleton };
  }

  function interpolateString(a, b, t) {
    if (a === b) return a;
    // Paint servers, masks, clips, and filters are references, not numbers.
    // Interpolating the numeric suffix of an ID creates nonexistent resources.
    if (a.includes("url(") || b.includes("url(")) return t < 0.5 ? a : b;
    const first = numericTemplate(a);
    const second = numericTemplate(b);
    if (first.numbers.length && first.numbers.length === second.numbers.length && first.skeleton === second.skeleton) {
      let result = "";
      for (let index = 0; index < first.numbers.length; index += 1) {
        result += first.strings[index] + Number(lerp(first.numbers[index], second.numbers[index], t).toFixed(10));
      }
      return result + first.strings.at(-1);
    }
    return t < 0.5 ? a : b;
  }

  function interpolateStyle(a, b, t, ignoreDisplay = false) {
    const first = parseStyle(a || "");
    const second = parseStyle(b || "");
    const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
    const result = {};
    for (const key of keys) {
      if (ignoreDisplay && key === "display") continue;
      const defaultValue = ["opacity", "fill-opacity", "stroke-opacity"].includes(key) ? "1" : "";
      result[key] = interpolateString(first[key] ?? defaultValue, second[key] ?? defaultValue, t);
    }
    return serializeStyle(result);
  }

  const NEVER_TWEEN = new Set(["id", "inkscape:label", "inkscape:path-effect"]);

  function attributeMap(element) {
    return new Map(Array.from(element.attributes).map(attribute => [attribute.name, attribute.value]));
  }

  function applyAttributes(target, firstElement, secondElement, t, { ignoreDisplay = false } = {}) {
    const first = attributeMap(firstElement);
    const second = attributeMap(secondElement);
    const names = new Set([...first.keys(), ...second.keys()]);
    for (const name of names) {
      if (NEVER_TWEEN.has(name) || name.startsWith("xmlns")) continue;
      let value;
      if (name === "transform") value = interpolateTransform(first.get(name) || "", second.get(name) || "", t);
      else if (name === "href" || name === "xlink:href") value = t < 0.5 ? first.get(name) : second.get(name);
      else if (name === "style") value = interpolateStyle(first.get(name), second.get(name), t, ignoreDisplay);
      else if (name === "opacity") value = interpolateString(first.get(name) || "1", second.get(name) || "1", t);
      else if (!first.has(name) || !second.has(name)) value = t < 0.5 ? first.get(name) : second.get(name);
      else value = interpolateString(first.get(name), second.get(name), t);
      if (value === undefined || value === null || value === "") target.removeAttribute(name);
      else target.setAttribute(name, value);
    }
    if (ignoreDisplay) target.setAttribute("style", removeDisplay(target.getAttribute("style") || ""));
  }

  function inkscapeCenterOffset(element, axis) {
    const localName = `transform-center-${axis}`;
    return Number(element.getAttributeNS(INKSCAPE_NS, localName) || element.getAttribute(`inkscape:${localName}`) || 0);
  }

  // Normalize every raster image to a unit square plus one affine matrix.
  // Inkscape may represent equivalent poses very differently: one keyframe
  // can use pixel dimensions plus a 0.264583 scale, while another bakes that
  // scale into width/height and stores only a rotation. Interpolating the raw
  // fields separately makes the sprite fly away. The canonical matrix avoids
  // that and exposes a stable local pivot coordinate.
  function canonicalImageFrame(element) {
    const x = Number(element.getAttribute("x") || 0);
    const y = Number(element.getAttribute("y") || 0);
    const width = Number(element.getAttribute("width") || 0);
    const height = Number(element.getAttribute("height") || 0);
    if (!(width > 0 && height > 0)) throw new Error(`Image ${labelOf(element) || element.id || "(unlabelled)"} has invalid dimensions`);

    const geometry = [width, 0, 0, height, x, y];
    const matrix = matrixMultiply(parseTransform(element.getAttribute("transform") || ""), geometry);
    const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(point => matrixApply(matrix, point));
    const xs = corners.map(point => point[0]);
    const ys = corners.map(point => point[1]);
    const midpoint = [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2
    ];

    // Inkscape stores X in the SVG direction, but its persisted Y center
    // offset has the opposite sign in an ordinary y-down SVG document.
    const pivot = [
      midpoint[0] + inkscapeCenterOffset(element, "x"),
      midpoint[1] - inkscapeCenterOffset(element, "y")
    ];
    const localPivot = matrixApply(matrixInverse(matrix), pivot);
    const linear = decomposeMatrix([matrix[0], matrix[1], matrix[2], matrix[3], 0, 0]);
    return { pivot, localPivot, linear };
  }

  function applyImageElement(target, first, second, t) {
    applyAttributes(target, first, second, t);
    const a = canonicalImageFrame(first);
    const b = canonicalImageFrame(second);
    const pivot = [lerp(a.pivot[0], b.pivot[0], t), lerp(a.pivot[1], b.pivot[1], t)];
    const localPivot = [
      lerp(a.localPivot[0], b.localPivot[0], t),
      lerp(a.localPivot[1], b.localPivot[1], t)
    ];
    const linear = composeMatrix({
      x: 0,
      y: 0,
      rotation: interpolateAngle(a.linear.rotation, b.linear.rotation, t),
      scaleX: lerp(a.linear.scaleX, b.linear.scaleX, t),
      scaleY: lerp(a.linear.scaleY, b.linear.scaleY, t),
      skew: lerp(a.linear.skew, b.linear.skew, t)
    });
    const matrix = matrixMultiply(
      matrixTranslate(pivot[0], pivot[1]),
      matrixMultiply(linear, matrixTranslate(-localPivot[0], -localPivot[1]))
    );

    target.setAttribute("x", "0");
    target.setAttribute("y", "0");
    target.setAttribute("width", "1");
    target.setAttribute("height", "1");
    target.setAttribute("preserveAspectRatio", "none");
    target.setAttribute("transform", `matrix(${matrix.map(number => Number(number.toFixed(10))).join(" ")})`);
  }

  function applyElementTree(target, first, second, t, options = {}) {
    if (target.localName === "image" && first.localName === "image" && second.localName === "image") {
      applyImageElement(target, first, second, t);
      return;
    }
    applyAttributes(target, first, second, t, options);
    const targetChildren = Array.from(target.children);
    const firstChildren = Array.from(first.children);
    const secondChildren = Array.from(second.children);
    const count = Math.min(targetChildren.length, firstChildren.length, secondChildren.length);
    for (let index = 0; index < count; index += 1) {
      if (firstChildren[index].tagName === secondChildren[index].tagName) {
        applyElementTree(targetChildren[index], firstChildren[index], secondChildren[index], t);
      }
    }
  }

  function parseDocument() {
    const text = decodeUtf8Base64(config.sourceBase64);
    const document = new DOMParser().parseFromString(text, "image/svg+xml");
    const parserError = document.querySelector("parsererror");
    if (parserError) throw new Error(`SVG parse error: ${parserError.textContent}`);
    return document;
  }

  function directPuppets(layer) {
    return Array.from(layer.querySelectorAll("g")).filter(element => labelOf(element).startsWith("puppet="));
  }

  function directEnvelopeObjects(document, layer) {
    return Array.from(layer.children).filter(element => element.localName === "g" && referencesEnvelope(document, element));
  }

  function directParts(puppet) {
    return new Map(Array.from(puppet.children)
      .map(element => [labelOf(element), element])
      .filter(([label]) => label));
  }

  function shallowClone(element) {
    const clone = element.cloneNode(false);
    while (clone.firstChild) clone.removeChild(clone.firstChild);
    return clone;
  }

  function numberFromLength(value, fallback) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function opacityOf(element) {
    return Number(parseStyle(element.getAttribute("style") || "").opacity ?? element.getAttribute("opacity") ?? 1);
  }

  function describeTinyChanges(frames, pixelScaleX, pixelScaleY) {
    for (let frameIndex = 0; frameIndex < frames.length - 1; frameIndex += 1) {
      const firstFrame = frames[frameIndex];
      const secondFrame = frames[frameIndex + 1];
      for (const [puppetName, firstPuppet] of firstFrame.puppets) {
        const secondPuppet = secondFrame.puppets.get(puppetName);
        if (!secondPuppet) continue;
        const firstRoot = decomposeMatrix(matrixMultiply(parseTransform(firstFrame.layer.getAttribute("transform")), parseTransform(firstPuppet.element.getAttribute("transform"))));
        const secondRoot = decomposeMatrix(matrixMultiply(parseTransform(secondFrame.layer.getAttribute("transform")), parseTransform(secondPuppet.element.getAttribute("transform"))));
        const rootPixels = Math.hypot((secondRoot.x - firstRoot.x) * pixelScaleX, (secondRoot.y - firstRoot.y) * pixelScaleY);
        const rootDegrees = Math.abs((secondRoot.rotation - firstRoot.rotation) * 180 / Math.PI);
        const rootScalePercent = 100 * Math.max(Math.abs(secondRoot.scaleX - firstRoot.scaleX), Math.abs(secondRoot.scaleY - firstRoot.scaleY));
        if (rootPixels > 0.001 && rootPixels <= 6 && rootDegrees <= 0.2 && rootScalePercent <= 0.25) {
          note("INFO", `possible tiny edit preserved: puppet=${puppetName} root moves ${rootPixels.toFixed(2)} px between ${firstFrame.time.toFixed(6)} and ${secondFrame.time.toFixed(6)}`);
        }

        for (const [partName, firstPart] of firstPuppet.parts) {
          const secondPart = secondPuppet.parts.get(partName);
          if (!secondPart || firstPart.localName !== secondPart.localName) continue;
          if ((firstPart.getAttribute("d") || "") !== (secondPart.getAttribute("d") || "")) continue;
          const x1 = Number(firstPart.getAttribute("x") || 0);
          const y1 = Number(firstPart.getAttribute("y") || 0);
          const x2 = Number(secondPart.getAttribute("x") || 0);
          const y2 = Number(secondPart.getAttribute("y") || 0);
          const pixels = Math.hypot((x2 - x1) * pixelScaleX, (y2 - y1) * pixelScaleY);
          const firstTransform = decomposeMatrix(parseTransform(firstPart.getAttribute("transform")));
          const secondTransform = decomposeMatrix(parseTransform(secondPart.getAttribute("transform")));
          const degrees = Math.abs((secondTransform.rotation - firstTransform.rotation) * 180 / Math.PI);
          const scalePercent = 100 * Math.max(Math.abs(secondTransform.scaleX - firstTransform.scaleX), Math.abs(secondTransform.scaleY - firstTransform.scaleY));
          const widthPixels = Math.abs(Number(secondPart.getAttribute("width") || 0) - Number(firstPart.getAttribute("width") || 0)) * pixelScaleX;
          const heightPixels = Math.abs(Number(secondPart.getAttribute("height") || 0) - Number(firstPart.getAttribute("height") || 0)) * pixelScaleY;
          const changed = pixels > 0.001 || degrees > 0.001 || scalePercent > 0.001 || widthPixels > 0.001 || heightPixels > 0.001 || Math.abs(opacityOf(firstPart) - opacityOf(secondPart)) > 0.0001;
          const tiny = pixels <= 3 && degrees <= 0.2 && scalePercent <= 0.25 && widthPixels <= 3 && heightPixels <= 3;
          if (changed && tiny) {
            note("INFO", `possible tiny edit preserved: ${puppetName}/${partName} changes by ${pixels.toFixed(2)} px, ${degrees.toFixed(3)} degrees`);
          }
        }
      }
    }
  }

  function buildAnimation() {
    const sourceDocument = parseDocument();
    const sourceRoot = sourceDocument.documentElement;
    const viewBox = (sourceRoot.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    if (viewBox.length !== 4 || viewBox.some(number => !Number.isFinite(number))) throw new Error("SVG viewBox is missing or invalid");
    const pixelWidth = numberFromLength(sourceRoot.getAttribute("width"), viewBox[2]);
    const pixelHeight = numberFromLength(sourceRoot.getAttribute("height"), viewBox[3]);
    const timeLayers = Array.from(sourceRoot.children)
      .map(element => ({ element, match: labelOf(element).match(/^time=(-?(?:\d+(?:\.\d*)?|\.\d+))$/) }))
      .filter(item => item.match)
      .map(item => ({ element: item.element, time: Number(item.match[1]) }))
      .sort((a, b) => a.time - b.time);
    if (timeLayers.length < 2) throw new Error("At least two time=<seconds> layers are required");
    const minimumTime = timeLayers[0].time;
    for (const keyframe of timeLayers) keyframe.time -= minimumTime;
    const span = timeLayers.at(-1).time;
    if (!(span > 0)) throw new Error("The keyframe timeline must have positive duration");

    const stage = document.createElementNS(SVG_NS, "svg");
    for (const attribute of Array.from(sourceRoot.attributes)) {
      if (!attribute.name.startsWith("inkscape:") && !attribute.name.startsWith("sodipodi:")) stage.setAttribute(attribute.name, attribute.value);
    }
    stage.setAttribute("id", "stage");
    stage.setAttribute("width", String(pixelWidth));
    stage.setAttribute("height", String(pixelHeight));
    stage.setAttribute("viewBox", viewBox.join(" "));
    stage.setAttribute("overflow", "hidden");

    let animatedLayer = null;
    const targetPuppets = new Map();
    const targetEnvelopeObjects = new Map();
    const firstTimeElement = timeLayers[0].element;
    for (const child of Array.from(sourceRoot.children)) {
      const timeMatch = labelOf(child).match(/^time=/);
      if (timeMatch) {
        if (child !== firstTimeElement) continue;
        animatedLayer = shallowClone(child);
        animatedLayer.setAttribute("style", removeDisplay(animatedLayer.getAttribute("style") || ""));
        for (const puppet of directPuppets(child)) {
          const name = labelOf(puppet).slice(7);
          const clone = puppet.cloneNode(true);
          animatedLayer.appendChild(clone);
          targetPuppets.set(name, { element: clone, parts: directParts(clone) });
        }
        for (const object of directEnvelopeObjects(sourceDocument, child)) {
          const name = labelOf(object);
          if (!name) throw new Error("A top-level Envelope Deformation group has no inkscape:label");
          if (targetEnvelopeObjects.has(name)) throw new Error(`Duplicate Envelope Deformation object label ${name} in the first keyframe`);
          const clone = object.cloneNode(true);
          animatedLayer.appendChild(clone);
          targetEnvelopeObjects.set(name, { element: clone });
        }
        stage.appendChild(animatedLayer);
      } else if (child.localName !== "namedview") {
        stage.appendChild(child.cloneNode(true));
      }
    }
    if (!animatedLayer) throw new Error("Could not create the animated layer");
    if (targetPuppets.size === 0 && targetEnvelopeObjects.size === 0) throw new Error("The first keyframe contains no puppet=<name> group or top-level Envelope Deformation object");

    const frames = timeLayers.map(({ element, time }) => {
      const puppets = new Map();
      for (const puppet of directPuppets(element)) {
        const name = labelOf(puppet).slice(7);
        puppets.set(name, { element: puppet, parts: directParts(puppet) });
      }
      const envelopeObjects = new Map();
      for (const object of directEnvelopeObjects(sourceDocument, element)) {
        const name = labelOf(object);
        if (!name) throw new Error(`Keyframe ${time} contains an unlabelled Envelope Deformation object`);
        if (envelopeObjects.has(name)) throw new Error(`Keyframe ${time} contains duplicate Envelope Deformation object ${name}`);
        envelopeObjects.set(name, {
          label: name,
          element: object,
          envelope: effectDefinition(sourceDocument, object),
          paths: Array.from(object.querySelectorAll("path")),
          worldTransform: matrixString(matrixToAncestor(object, sourceRoot))
        });
      }
      return { time, layer: element, puppets, envelopeObjects };
    });

    for (const [name, target] of targetPuppets) {
      for (const frame of frames) {
        const sourcePuppet = frame.puppets.get(name);
        if (!sourcePuppet) throw new Error(`Keyframe ${frame.time} is missing puppet=${name}`);
        for (const partName of target.parts.keys()) {
          if (!sourcePuppet.parts.has(partName)) throw new Error(`Keyframe ${frame.time} puppet=${name} is missing part ${partName}`);
        }
      }
    }

    for (const name of targetEnvelopeObjects.keys()) {
      for (const frame of frames) {
        if (!frame.envelopeObjects.has(name)) throw new Error(`Keyframe ${frame.time} is missing Envelope Deformation object ${name}`);
      }
    }

    const envelopeAnimations = new Map();
    for (const [name, target] of targetEnvelopeObjects) {
      const objects = frames.map(frame => frame.envelopeObjects.get(name));
      const firstObject = objects[0];
      const targetPaths = Array.from(target.element.querySelectorAll("path"));
      if (firstObject.paths.length !== targetPaths.length) throw new Error(`Target clone path count changed for Envelope Deformation object ${name}`);
      const paths = firstObject.paths.map((firstPath, index) => {
        const original = originalPathOf(firstPath);
        if (!original) throw new Error(`Path ${firstPath.id || index + 1} in ${name} has no inkscape:original-d`);
        const localToObject = matrixWithin(firstPath, firstObject.element);
        for (const object of objects.slice(1)) {
          if (object.paths.length !== firstObject.paths.length) throw new Error(`Path count changed for ${name}`);
          const candidate = object.paths[index];
          if (originalPathOf(candidate) !== original) throw new Error(`Original path changed for ${firstPath.id || index + 1} in ${name}`);
          const candidateMatrix = matrixWithin(candidate, object.element);
          if (candidateMatrix.some((value, matrixIndex) => Math.abs(value - localToObject[matrixIndex]) > 1e-8)) {
            throw new Error(`Nested transform changed for ${firstPath.id || index + 1} in ${name}`);
          }
        }
        return {
          original,
          target: targetPaths[index],
          localToObject,
          objectToLocal: matrixInverse(localToObject)
        };
      });
      const bbox = EnvelopeMorph.bboxFromPaths(paths.map(item => ({ data: item.original, matrix: item.localToObject })));
      validatePrefixEffects(objects, bbox);
      envelopeAnimations.set(name, { name, target: target.element, objects, paths, bbox });
      note("INFO", `Envelope object ${name}: ${paths.length} paths, effects ${objects.map(object => object.envelope.id).join(" → ")}`);
    }

    const firstFrame = frames[0];
    for (const [name, puppet] of firstFrame.puppets) {
      const opacity = opacityOf(puppet.element);
      if (opacity !== 1) note("NOTICE", `puppet=${name} begins with opacity ${opacity}`);
    }
    for (const frame of frames) {
      const styleOpacity = Number(parseStyle(frame.layer.getAttribute("style") || "").opacity ?? frame.layer.getAttribute("opacity") ?? 1);
      if (styleOpacity !== 1) note("NOTICE", `time=${(frame.time + minimumTime).toFixed(6)} layer opacity is ${styleOpacity}; it will be animated`);
    }
    note("INFO", `Document canvas ${pixelWidth}x${pixelHeight}; viewBox ${viewBox.join(" ")}`);
    note("INFO", `Keyframes ${frames.map(frame => (frame.time + minimumTime).toFixed(6)).join(", ")} seconds`);
    note("INFO", `Puppets ${targetPuppets.size ? Array.from(targetPuppets.keys()).join(", ") : "none"}`);
    note("INFO", `Envelope objects ${targetEnvelopeObjects.size ? Array.from(targetEnvelopeObjects.keys()).join(", ") : "none"}`);
    if (targetEnvelopeObjects.size) note("INFO", "Envelope phase interpolation is linear; ordinary actor easing remains unchanged");
    describeTinyChanges(frames, pixelWidth / viewBox[2], pixelHeight / viewBox[3]);

    document.getElementById("stage-host").appendChild(stage);
    return { stage, animatedLayer, frames, targetPuppets, targetEnvelopeObjects, envelopeAnimations, width: pixelWidth, height: pixelHeight, span };
  }

  function easing(value) {
    if (config.options.easing === "linear") return value;
    return -(Math.cos(Math.PI * value) - 1) / 2;
  }

  function createPlayer(animation) {
    const { frames, targetPuppets, envelopeAnimations, span, animatedLayer } = animation;
    const options = config.options;
    const cycleDuration = options.loopMode === "pingpong" ? span * 2 : span;
    const duration = options.startHold + options.endHold + cycleDuration * options.loops + options.loopDelay * Math.max(0, options.loops - 1);
    let playing = true;
    let elapsed = 0;

    function timelineTimeAt(seconds) {
      if (seconds <= options.startHold) return 0;
      let remaining = seconds - options.startHold;
      for (let loop = 0; loop < options.loops; loop += 1) {
        if (remaining <= cycleDuration) {
          if (options.loopMode === "pingpong" && remaining > span) return span - (remaining - span);
          return Math.min(span, remaining);
        }
        remaining -= cycleDuration;
        if (loop < options.loops - 1) {
          if (remaining <= options.loopDelay) return options.loopMode === "pingpong" ? 0 : span;
          remaining -= options.loopDelay;
        }
      }
      return options.loopMode === "pingpong" ? 0 : span;
    }

    function applyTimelineTime(time) {
      let first = frames[0];
      let second = frames.at(-1);
      for (let index = 0; index < frames.length - 1; index += 1) {
        if (time >= frames[index].time && time <= frames[index + 1].time) {
          first = frames[index];
          second = frames[index + 1];
          break;
        }
      }
      const denominator = second.time - first.time;
      const raw = denominator > 0 ? Math.max(0, Math.min(1, (time - first.time) / denominator)) : 0;
      const fraction = easing(raw);
      applyAttributes(animatedLayer, first.layer, second.layer, fraction, { ignoreDisplay: true });

      for (const [name, target] of targetPuppets) {
        const firstPuppet = first.puppets.get(name);
        const secondPuppet = second.puppets.get(name);
        applyAttributes(target.element, firstPuppet.element, secondPuppet.element, fraction);
        for (const [partName, targetPart] of target.parts) {
          const firstPart = firstPuppet.parts.get(partName);
          const secondPart = secondPuppet.parts.get(partName);
          applyElementTree(targetPart, firstPart, secondPart, fraction);
        }
      }

      const layerMatrix = parseTransform(animatedLayer.getAttribute("transform") || "");
      const inverseLayerMatrix = matrixInverse(layerMatrix);
      for (const [name, animationObject] of envelopeAnimations) {
        const firstObject = first.envelopeObjects.get(name);
        const secondObject = second.envelopeObjects.get(name);
        applyAttributes(animationObject.target, firstObject.element, secondObject.element, fraction);
        const mapper = EnvelopeMorph.createMapper(firstObject.envelope, secondObject.envelope, raw, animationObject.bbox);
        for (const path of animationObject.paths) {
          path.target.setAttribute("d", EnvelopeMorph.deformPath(path.original, mapper, path.localToObject, path.objectToLocal));
        }
        const worldTransform = parseTransform(interpolateTransform(firstObject.worldTransform, secondObject.worldTransform, fraction));
        animationObject.target.setAttribute("transform", matrixString(matrixMultiply(inverseLayerMatrix, worldTransform)));
      }
    }

    function seekSeconds(seconds) {
      elapsed = Math.max(0, Math.min(duration, Number(seconds) || 0));
      applyTimelineTime(timelineTimeAt(elapsed));
      updateControls();
    }

    function updateControls() {
      const scrubber = document.getElementById("scrubber");
      const clock = document.getElementById("clock");
      if (scrubber) scrubber.value = duration ? String(elapsed / duration) : "0";
      if (clock) clock.value = `${elapsed.toFixed(3)} / ${duration.toFixed(3)} s`;
    }

    document.getElementById("play")?.addEventListener("click", () => { if (elapsed >= duration) elapsed = 0; playing = true; });
    document.getElementById("pause")?.addEventListener("click", () => { playing = false; });
    document.getElementById("restart")?.addEventListener("click", () => { elapsed = 0; playing = true; seekSeconds(0); });
    document.getElementById("scrubber")?.addEventListener("input", event => { playing = false; seekSeconds(Number(event.target.value) * duration); });

    new p5(p => {
      p.setup = () => {
        p.noCanvas();
        p.frameRate(60);
        seekSeconds(0);
      };
      p.draw = () => {
        if (!playing) return;
        elapsed += Math.min(0.1, p.deltaTime / 1000);
        if (elapsed >= duration) {
          elapsed = duration;
          playing = false;
        }
        seekSeconds(elapsed);
      };
    });

    return {
      ready: true,
      duration,
      width: animation.width,
      height: animation.height,
      diagnostics,
      seekSeconds,
      play: () => { playing = true; },
      pause: () => { playing = false; }
    };
  }

  function start() {
    if (new URLSearchParams(location.search).has("capture")) document.body.classList.add("capture");
    try {
      const animation = buildAnimation();
      const api = createPlayer(animation);
      document.getElementById("diagnostics").textContent = diagnostics.join("\n");
      window.__svgPuppet = api;
    } catch (error) {
      console.error(error);
      document.getElementById("diagnostics").textContent = `ERROR: ${error.stack || error.message}`;
      window.__svgPuppet = { ready: false, error: error.message, diagnostics };
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
