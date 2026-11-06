(function installEnvelopeMorph(global) {
  "use strict";

  const EPS = 1e-9;
  const lerp = (a, b, t) => a + (b - a) * t;

  function boundarySampler(subpaths, stepsPerCurve = 64) {
    if (!subpaths.length || !subpaths[0].curves.length) throw new Error("Envelope boundary is empty");
    const subpath = subpaths[0];
    const samples = [{ point: subpath.move.slice(), length: 0, tangent: [1, 0] }];
    let start = subpath.move.slice(), total = 0, previous = start.slice();
    for (const curve of subpath.curves) {
      for (let i = 1; i <= stepsPerCurve; i += 1) {
        const t = i / stepsPerCurve;
        const point = SvgPath.cubicPoint(start, curve, t);
        total += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
        let tangent = SvgPath.cubicDerivative(start, curve, t);
        const length = Math.hypot(tangent[0], tangent[1]);
        tangent = length > EPS ? [tangent[0] / length, tangent[1] / length] : samples.at(-1).tangent;
        samples.push({ point, length: total, tangent });
        previous = point;
      }
      start = [curve[4], curve[5]];
    }
    function atDistance(distance) {
      const target = Math.max(0, Math.min(total, distance));
      let low = 0, high = samples.length - 1;
      while (low + 1 < high) {
        const middle = (low + high) >> 1;
        if (samples[middle].length <= target) low = middle; else high = middle;
      }
      const a = samples[low], b = samples[high];
      const span = b.length - a.length;
      const f = span > EPS ? (target - a.length) / span : 0;
      let tangent = [lerp(a.tangent[0], b.tangent[0], f), lerp(a.tangent[1], b.tangent[1], f)];
      const tangentLength = Math.hypot(tangent[0], tangent[1]);
      tangent = tangentLength > EPS ? [tangent[0] / tangentLength, tangent[1] / tangentLength] : [1, 0];
      return { point: [lerp(a.point[0], b.point[0], f), lerp(a.point[1], b.point[1], f)], normal: [-tangent[1], tangent[0]] };
    }
    return { length: total, atDistance };
  }

  function interpolatedBoundary(firstData, secondData, fraction) {
    return boundarySampler(SvgPath.interpolateCubics(firstData, secondData, fraction));
  }

  function createMapper(first, second, fraction, bbox, options = {}) {
    const boundaries = [1, 2, 3, 4].map(number => interpolatedBoundary(first[`bendpath${number}`], second[`bendpath${number}`], fraction));
    const [top, right, bottom, left] = boundaries;
    const width = bbox.maxX - bbox.minX, height = bbox.maxY - bbox.minY;
    if (width <= EPS || height <= EPS) throw new Error("Envelope source bounding box is empty");
    const useHack = options.inkscapeOriginHack !== false;
    const xx = first.xx !== false && second.xx !== false;
    const yy = first.yy !== false && second.yy !== false;
    const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
    const scale = (p, amount) => [p[0] * amount, p[1] * amount];
    const bend = (sampler, distance, offset) => {
      const sample = sampler.atDistance(distance);
      return add(sample.point, scale(sample.normal, offset));
    };
    return point => {
      // Inkscape 1.4 applies this 0.1% origin offset internally to avoid a
      // historical zero-coordinate bug. Retaining it improves endpoint parity.
      const x = point[0] - bbox.minX * (useHack ? 1.001 : 1);
      const y = point[1] - bbox.minY * (useHack ? 1.001 : 1);
      const xBack = width - x, yBack = height - y;
      const topPoint = bend(top, x * top.length / width, y);
      const bottomPoint = bend(bottom, x * bottom.length / width, y - height);
      const outputY = scale(add(scale(topPoint, yBack), scale(bottomPoint, y)), 1 / height);
      const rightPoint = bend(right, y * right.length / height, -(x - width));
      const leftPoint = bend(left, y * left.length / height, -x);
      const outputX = scale(add(scale(rightPoint, x), scale(leftPoint, xBack)), 1 / width);
      if (!xx && yy) return outputY;
      if (xx && !yy) return outputX;
      if (!xx && !yy) return point.slice();
      const xsqr = x * xBack, ysqr = y * yBack;
      const xComplement = width * width / 4 - xsqr;
      const yComplement = height * height / 4 - ysqr;
      const output1 = scale(add(scale(outputY, yComplement), scale(outputX, ysqr)), 4 / (height * height));
      const output2 = scale(add(scale(outputX, xComplement), scale(outputY, xsqr)), 4 / (width * width));
      return scale(add(output1, output2), 0.5);
    };
  }

  function distanceToLine(point, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length2 = dx * dx + dy * dy;
    if (length2 < EPS) return Math.hypot(point[0] - a[0], point[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length2));
    return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
  }

  function deformPath(originalData, mapper, localToObject, objectToLocal, options = {}) {
    const tolerance = Number(options.tolerance) || 0.12;
    const maxDepth = Number(options.maxDepth) || 10;
    const chunks = [];
    const sourceToOutput = point => SvgPath.transformPoint(objectToLocal, mapper(SvgPath.transformPoint(localToObject, point)));
    for (const subpath of SvgPath.toCubics(originalData)) {
      const first = sourceToOutput(subpath.move);
      chunks.push(`M ${format(first[0])} ${format(first[1])}`);
      let start = subpath.move.slice();
      for (const curve of subpath.curves) {
        const p0 = sourceToOutput(start), p1 = sourceToOutput([curve[4], curve[5]]);
        const points = [];
        function subdivide(t0, a, t1, b, depth) {
          const tm = (t0 + t1) / 2;
          const middle = sourceToOutput(SvgPath.cubicPoint(start, curve, tm));
          const q1 = sourceToOutput(SvgPath.cubicPoint(start, curve, (3 * t0 + t1) / 4));
          const q3 = sourceToOutput(SvgPath.cubicPoint(start, curve, (t0 + 3 * t1) / 4));
          const error = Math.max(distanceToLine(middle, a, b), distanceToLine(q1, a, b), distanceToLine(q3, a, b));
          if (depth >= maxDepth || error <= tolerance) points.push(b);
          else { subdivide(t0, a, tm, middle, depth + 1); subdivide(tm, middle, t1, b, depth + 1); }
        }
        subdivide(0, p0, 1, p1, 0);
        for (const point of points) chunks.push(`L ${format(point[0])} ${format(point[1])}`);
        start = [curve[4], curve[5]];
      }
      if (subpath.closed) chunks.push("Z");
    }
    return chunks.join(" ");
  }

  function format(value) {
    if (Math.abs(value) < 1e-7) return "0";
    return Number(value.toFixed(6)).toString();
  }

  function bboxFromPaths(paths) {
    const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const item of paths) {
      for (const subpath of SvgPath.toCubics(item.data)) {
        let start = subpath.move;
        for (const point of [start, ...subpath.curves.flatMap(curve => [[curve[0], curve[1]], [curve[2], curve[3]], [curve[4], curve[5]]])]) {
          const transformed = SvgPath.transformPoint(item.matrix, point);
          bbox.minX = Math.min(bbox.minX, transformed[0]); bbox.maxX = Math.max(bbox.maxX, transformed[0]);
          bbox.minY = Math.min(bbox.minY, transformed[1]); bbox.maxY = Math.max(bbox.maxY, transformed[1]);
        }
        start = subpath.curves.length ? [subpath.curves.at(-1)[4], subpath.curves.at(-1)[5]] : start;
      }
    }
    if (!Number.isFinite(bbox.minX)) throw new Error("No original path geometry was found");
    return bbox;
  }

  global.EnvelopeMorph = { boundarySampler, createMapper, deformPath, bboxFromPaths };
})(globalThis);
