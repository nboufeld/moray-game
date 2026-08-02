/**
 * The codex plate: the koi mid-circle under a moon-dim key, its ribbon
 * trailing. Returns null off-DOM (the unit tests), where the card keeps its
 * empty frame — complete without the image, as every card is.
 */
export function paintMoonKoiPortrait(): string | null {
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
  water.addColorStop(0, "#8ea4c8");
  water.addColorStop(0.5, "#5d739e");
  water.addColorStop(1, "#3c4c74");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, 256, 320);

  // The moon's own light, high in the plate.
  const moon = ctx.createRadialGradient(196, 52, 4, 196, 52, 46);
  moon.addColorStop(0, "rgba(244, 240, 224, 0.95)");
  moon.addColorStop(0.5, "rgba(244, 240, 224, 0.28)");
  moon.addColorStop(1, "rgba(244, 240, 224, 0)");
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(196, 52, 46, 0, Math.PI * 2);
  ctx.fill();

  // The trailing ribbon first, so the body overlaps it: three long veils
  // falling away from the tail's line.
  ctx.strokeStyle = "rgba(230, 217, 226, 0.85)";
  ctx.lineCap = "round";
  for (const [spread, width] of [
    [-14, 7],
    [0, 9],
    [14, 7],
  ] as const) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(150, 196);
    ctx.bezierCurveTo(180 + spread, 236, 150 + spread * 1.8, 268, 172 + spread * 2.1, 302);
    ctx.stroke();
  }

  // The body, silver-white with a blush of rose along the back, curved
  // along its circle.
  ctx.fillStyle = "#eef0f4";
  ctx.beginPath();
  ctx.ellipse(116, 168, 30, 88, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f0c9c9";
  ctx.beginPath();
  ctx.ellipse(104, 128, 16, 34, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#eef0f4";
  ctx.beginPath();
  ctx.ellipse(118, 182, 22, 52, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // The head and the deep-blue eye.
  ctx.fillStyle = "#eef0f4";
  ctx.beginPath();
  ctx.ellipse(88, 92, 20, 24, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#18245e";
  ctx.beginPath();
  ctx.arc(80, 86, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#cdd6ee";
  ctx.beginPath();
  ctx.arc(81.5, 84.5, 1.4, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL("image/png");
}
