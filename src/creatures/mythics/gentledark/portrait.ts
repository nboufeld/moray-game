/**
 * The codex plate: a small canvas painting of the regard, in the creature's
 * own palette. Returns null off-DOM (the unit tests), where the card keeps
 * its empty frame — complete without the image, as every card is.
 */
export function paintGentleDarkPortrait(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const water = ctx.createLinearGradient(0, 0, 0, 320);
  water.addColorStop(0, "#3d5a86");
  water.addColorStop(0.55, "#233a63");
  water.addColorStop(1, "#141b3a");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, 256, 320);

  // The silhouette: head-and-shoulders rising out of the frame's own dark,
  // a step deeper than the water and never black.
  const shape = ctx.createLinearGradient(0, 40, 0, 320);
  shape.addColorStop(0, "#2b2560");
  shape.addColorStop(1, "#17123c");
  ctx.fillStyle = shape;
  ctx.beginPath();
  ctx.moveTo(18, 320);
  ctx.bezierCurveTo(20, 240, 46, 218, 62, 176);
  ctx.bezierCurveTo(74, 150, 66, 128, 74, 100);
  ctx.bezierCurveTo(84, 62, 104, 42, 128, 42);
  ctx.bezierCurveTo(152, 42, 172, 62, 182, 100);
  ctx.bezierCurveTo(190, 128, 182, 150, 194, 176);
  ctx.bezierCurveTo(210, 218, 236, 240, 238, 320);
  ctx.closePath();
  ctx.fill();

  // The two soft eyes and their bloom: the only warm thing in the plate.
  for (const x of [100, 156]) {
    const bloom = ctx.createRadialGradient(x, 128, 2, x, 128, 22);
    bloom.addColorStop(0, "rgba(245, 223, 168, 0.9)");
    bloom.addColorStop(0.45, "rgba(245, 223, 168, 0.35)");
    bloom.addColorStop(1, "rgba(245, 223, 168, 0)");
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(x, 128, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f5dfa8";
    ctx.beginPath();
    ctx.arc(x, 128, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL("image/png");
}
