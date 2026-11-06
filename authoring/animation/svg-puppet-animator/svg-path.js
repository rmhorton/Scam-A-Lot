(function installSvgPath(global) {
  "use strict";

  const PARAMS = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
  const TOKENS = /[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
  const EPS = 1e-9;

  function parse(data) {
    const tokens = String(data || "").match(TOKENS) || [];
    const result = [];
    let i = 0;
    let active = null;
    let firstMove = false;
    while (i < tokens.length) {
      if (/^[A-Za-z]$/.test(tokens[i])) {
        active = tokens[i++];
        firstMove = active.toUpperCase() === "M";
        if (active.toUpperCase() === "Z") {
          result.push({ command: active, values: [] });
          active = null;
          continue;
        }
      }
      if (!active) throw new Error(`Path data has numbers without a command near token ${i}`);
      const upper = active.toUpperCase();
      const count = PARAMS[upper];
      if (count === undefined || i + count > tokens.length || /^[A-Za-z]$/.test(tokens[i])) {
        throw new Error(`Invalid ${active} command in path data`);
      }
      const values = tokens.slice(i, i + count).map(Number);
      i += count;
      let command = active;
      if (upper === "M" && !firstMove) command = active === "M" ? "L" : "l";
      result.push({ command, values });
      if (upper === "M") firstMove = false;
    }
    return result;
  }

  function line(from, to) {
    return [from[0], from[1], to[0], to[1], to[0], to[1]];
  }

  function vectorAngle(ux, uy, vx, vy) {
    const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    if (length < EPS) return 0;
    const value = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / length));
    const angle = Math.acos(value);
    return ux * vy - uy * vx < 0 ? -angle : angle;
  }

  function arcCubics(from, values, relative) {
    let [rx, ry, rotation, largeArc, sweep, x2, y2] = values;
    const [x1, y1] = from;
    if (relative) { x2 += x1; y2 += y1; }
    rx = Math.abs(rx); ry = Math.abs(ry);
    if (rx < EPS || ry < EPS || Math.hypot(x2 - x1, y2 - y1) < EPS) {
      return Math.hypot(x2 - x1, y2 - y1) < EPS ? [] : [line(from, [x2, y2])];
    }
    const phi = rotation * Math.PI / 180;
    const cos = Math.cos(phi), sin = Math.sin(phi);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
    let scale = xp * xp / (rx * rx) + yp * yp / (ry * ry);
    if (scale > 1) { scale = Math.sqrt(scale); rx *= scale; ry *= scale; }
    const numerator = Math.max(0, rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp);
    const denominator = rx * rx * yp * yp + ry * ry * xp * xp;
    const factor = (Boolean(largeArc) === Boolean(sweep) ? -1 : 1) * Math.sqrt(numerator / Math.max(EPS, denominator));
    const cxp = factor * rx * yp / ry, cyp = factor * -ry * xp / rx;
    const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
    const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
    const ux = (xp - cxp) / rx, uy = (yp - cyp) / ry;
    const vx = (-xp - cxp) / rx, vy = (-yp - cyp) / ry;
    let theta = vectorAngle(1, 0, ux, uy);
    let delta = vectorAngle(ux, uy, vx, vy);
    if (!sweep && delta > 0) delta -= 2 * Math.PI;
    if (sweep && delta < 0) delta += 2 * Math.PI;
    const count = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
    const step = delta / count;
    const point = angle => [
      cx + rx * cos * Math.cos(angle) - ry * sin * Math.sin(angle),
      cy + rx * sin * Math.cos(angle) + ry * cos * Math.sin(angle)
    ];
    const derivative = angle => [
      -rx * cos * Math.sin(angle) - ry * sin * Math.cos(angle),
      -rx * sin * Math.sin(angle) + ry * cos * Math.cos(angle)
    ];
    const curves = [];
    for (let n = 0; n < count; n += 1) {
      const a = theta + n * step, b = a + step;
      const p0 = point(a), p3 = point(b), d0 = derivative(a), d1 = derivative(b);
      const alpha = 4 / 3 * Math.tan(step / 4);
      curves.push([p0[0] + alpha * d0[0], p0[1] + alpha * d0[1], p3[0] - alpha * d1[0], p3[1] - alpha * d1[1], p3[0], p3[1]]);
    }
    curves.at(-1)[4] = x2; curves.at(-1)[5] = y2;
    return curves;
  }

  function toCubics(data) {
    const commands = parse(data);
    const subpaths = [];
    let current = [0, 0], start = [0, 0], subpath = null;
    let previous = "", cubicControl = null, quadraticControl = null;
    const absolute = (x, y, relative) => relative ? [current[0] + x, current[1] + y] : [x, y];
    const append = curve => { subpath.curves.push(curve); current = [curve[4], curve[5]]; };
    for (const item of commands) {
      const command = item.command, upper = command.toUpperCase(), relative = command !== upper, v = item.values;
      if (upper === "M") {
        current = absolute(v[0], v[1], relative); start = current.slice();
        subpath = { move: current.slice(), curves: [], closed: false }; subpaths.push(subpath);
      } else if (!subpath) {
        throw new Error(`Path command ${command} occurs before moveto`);
      } else if (upper === "L") append(line(current, absolute(v[0], v[1], relative)));
      else if (upper === "H") append(line(current, [relative ? current[0] + v[0] : v[0], current[1]]));
      else if (upper === "V") append(line(current, [current[0], relative ? current[1] + v[0] : v[0]]));
      else if (upper === "C") {
        const c1 = absolute(v[0], v[1], relative), c2 = absolute(v[2], v[3], relative), end = absolute(v[4], v[5], relative);
        append([...c1, ...c2, ...end]); cubicControl = c2;
      } else if (upper === "S") {
        const c1 = ["C", "S"].includes(previous) ? [2 * current[0] - cubicControl[0], 2 * current[1] - cubicControl[1]] : current.slice();
        const c2 = absolute(v[0], v[1], relative), end = absolute(v[2], v[3], relative);
        append([...c1, ...c2, ...end]); cubicControl = c2;
      } else if (upper === "Q" || upper === "T") {
        const control = upper === "Q" ? absolute(v[0], v[1], relative) : (["Q", "T"].includes(previous) ? [2 * current[0] - quadraticControl[0], 2 * current[1] - quadraticControl[1]] : current.slice());
        const end = upper === "Q" ? absolute(v[2], v[3], relative) : absolute(v[0], v[1], relative);
        append([current[0] + 2 / 3 * (control[0] - current[0]), current[1] + 2 / 3 * (control[1] - current[1]), end[0] + 2 / 3 * (control[0] - end[0]), end[1] + 2 / 3 * (control[1] - end[1]), end[0], end[1]]);
        quadraticControl = control;
      } else if (upper === "A") for (const curve of arcCubics(current, v, relative)) append(curve);
      else if (upper === "Z") {
        if (Math.hypot(current[0] - start[0], current[1] - start[1]) > EPS) append(line(current, start));
        subpath.closed = true; current = start.slice();
      }
      if (!["C", "S"].includes(upper)) cubicControl = null;
      if (!["Q", "T"].includes(upper)) quadraticControl = null;
      previous = upper;
    }
    return subpaths;
  }

  function cubicPoint(start, curve, t) {
    const u = 1 - t, u2 = u * u, t2 = t * t;
    return [
      u2 * u * start[0] + 3 * u2 * t * curve[0] + 3 * u * t2 * curve[2] + t2 * t * curve[4],
      u2 * u * start[1] + 3 * u2 * t * curve[1] + 3 * u * t2 * curve[3] + t2 * t * curve[5]
    ];
  }

  function cubicDerivative(start, curve, t) {
    const u = 1 - t;
    return [
      3 * u * u * (curve[0] - start[0]) + 6 * u * t * (curve[2] - curve[0]) + 3 * t * t * (curve[4] - curve[2]),
      3 * u * u * (curve[1] - start[1]) + 6 * u * t * (curve[3] - curve[1]) + 3 * t * t * (curve[5] - curve[3])
    ];
  }

  function interpolateCubics(aData, bData, fraction) {
    const a = toCubics(aData), b = toCubics(bData), f = Math.max(0, Math.min(1, fraction));
    if (a.length !== b.length) throw new Error("Envelope boundary subpath count changed between keyframes");
    return a.map((subpath, s) => {
      if (subpath.curves.length !== b[s].curves.length || subpath.closed !== b[s].closed) throw new Error("Envelope boundary topology changed between keyframes");
      const mix = (x, y) => x + (y - x) * f;
      return {
        move: [mix(subpath.move[0], b[s].move[0]), mix(subpath.move[1], b[s].move[1])],
        curves: subpath.curves.map((curve, i) => curve.map((value, j) => mix(value, b[s].curves[i][j]))),
        closed: subpath.closed
      };
    });
  }

  function matrixMultiply(a, b) {
    return [
      a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  }

  function transformMatrix(text) {
    let result = [1, 0, 0, 1, 0, 0];
    const re = /([A-Za-z]+)\s*\(([^)]*)\)/g;
    for (const match of String(text || "").matchAll(re)) {
      const name = match[1].toLowerCase();
      const n = (match[2].match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || []).map(Number);
      let m = [1, 0, 0, 1, 0, 0];
      if (name === "matrix" && n.length >= 6) m = n.slice(0, 6);
      else if (name === "translate") m = [1, 0, 0, 1, n[0] || 0, n.length > 1 ? n[1] : 0];
      else if (name === "scale") m = [n[0], 0, 0, n.length > 1 ? n[1] : n[0], 0, 0];
      else if (name === "rotate") {
        const angle = (n[0] || 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
        const rotation = [c, s, -s, c, 0, 0];
        m = n.length > 2 ? matrixMultiply(matrixMultiply([1, 0, 0, 1, n[1], n[2]], rotation), [1, 0, 0, 1, -n[1], -n[2]]) : rotation;
      } else if (name === "skewx") m = [1, 0, Math.tan((n[0] || 0) * Math.PI / 180), 1, 0, 0];
      else if (name === "skewy") m = [1, Math.tan((n[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
      result = matrixMultiply(result, m);
    }
    return result;
  }

  function matrixInverse(m) {
    const determinant = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(determinant) < EPS) throw new Error("Non-invertible SVG transform");
    return [m[3] / determinant, -m[1] / determinant, -m[2] / determinant, m[0] / determinant,
      (m[2] * m[5] - m[3] * m[4]) / determinant, (m[1] * m[4] - m[0] * m[5]) / determinant];
  }

  function transformPoint(m, p) {
    return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
  }

  global.SvgPath = { parse, toCubics, cubicPoint, cubicDerivative, interpolateCubics, transformMatrix, matrixMultiply, matrixInverse, transformPoint };
})(globalThis);
