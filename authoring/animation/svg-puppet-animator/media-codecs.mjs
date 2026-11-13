export function mediaCodecArgs(outputPath) {
  const lowerOutput = String(outputPath || "").toLowerCase();
  if (lowerOutput.endsWith(".gif")) {
    return [
      "-filter_complex",
      "[0:v]split[gif_source][palette_source];" +
        "[palette_source]palettegen=max_colors=256:reserve_transparent=1:stats_mode=diff[palette];" +
        "[gif_source][palette]paletteuse=dither=sierra2_4a:diff_mode=rectangle:alpha_threshold=128",
      "-loop", "0"
    ];
  }
  if (lowerOutput.endsWith(".webm")) {
    return ["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p"];
  }
  return ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
}
