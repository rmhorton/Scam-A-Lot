import "./svg-path.js";
import "./envelope-core.js";

const box = { minX: 10, minY: 20, maxX: 110, maxY: 70 };
const identity = {
  bendpath1: "M10 20 L110 20", bendpath2: "M110 20 L110 70",
  bendpath3: "M10 70 L110 70", bendpath4: "M10 20 L10 70", xx: true, yy: true
};
const wave = {
  bendpath1: "M10 20 C40 0 75 40 110 20", bendpath2: "M110 20 L110 70",
  bendpath3: "M10 70 C40 50 75 90 110 70", bendpath4: "M10 20 L10 70", xx: true, yy: true
};

const identityMapper = EnvelopeMorph.createMapper(identity, identity, 0.5, box, { inkscapeOriginHack: false });
for (const point of [[10,20],[60,45],[110,70],[25,64]]) {
  const mapped = identityMapper(point);
  if (Math.hypot(mapped[0] - point[0], mapped[1] - point[1]) > 0.03) throw new Error(`Identity envelope moved ${point} to ${mapped}`);
}

for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
  const mapper = EnvelopeMorph.createMapper(identity, wave, fraction, box, { inkscapeOriginHack: false });
  const data = EnvelopeMorph.deformPath("M20 30 C40 10 80 60 100 40 L90 60 Z", mapper, [1,0,0,1,0,0], [1,0,0,1,0,0]);
  if (!data.startsWith("M ") || /NaN|Infinity/.test(data)) throw new Error(`Invalid deformation at ${fraction}`);
}
console.log("PASS identity envelope");
console.log("PASS interpolated envelope and adaptive path sampling");
