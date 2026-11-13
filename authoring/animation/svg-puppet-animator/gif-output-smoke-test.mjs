#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { mediaCodecArgs } from "./media-codecs.mjs";

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "toonscape-gif-test-"));
const output = path.join(temporary, "test.gif");
try {
  const args = [
    "-y", "-f", "lavfi", "-i", "testsrc2=size=96x64:rate=10:duration=0.5",
    ...mediaCodecArgs(output), output
  ];
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const bytes = fs.readFileSync(output);
  assert(bytes.length > 100, "GIF output is unexpectedly small");
  assert(["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii")), "Output is not a GIF file");
  assert(mediaCodecArgs("example.mp4").includes("libx264"));
  assert(mediaCodecArgs("example.webm").includes("libvpx-vp9"));
  console.log("GIF output smoke test passed");
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
