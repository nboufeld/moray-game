/**
 * The codex plate: the hatchling peeking out of its glass-pebble drift.
 * Returns null off-DOM (the unit tests), where the card keeps its empty
 * frame — complete without the image, as every card is.
 */
export function paintKrakenPortrait(): string | null {
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
  water.addColorStop(0, "#7fb8c9");
  water.addColorStop(0.6, "#4f89a4");
  water.addColorStop(1, "#33627f");
  ctx.fillStyle = water;
  ctx.fillRect(0, 0, 256, 320);

  // The pebble drift it dens in: a bank of soft glass pastels.
  const pebbles: readonly [number, number, number, string][] = [
    [46, 268, 30, "#9fd8d2"],
    [92, 282, 34, "#e8b7c3"],
    [142, 274, 30, "#b9d9e8"],
    [190, 284, 32, "#d9e6c9"],
    [228, 268, 26, "#9fd8d2"],
    [16, 292, 30, "#e8b7c3"],
  ];
  for (const [x, y, r, colour] of pebbles) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The arms: five soft curls spilling over the pebbles.
  ctx.strokeStyle = "#c98f92";
  ctx.lineCap = "round";
  for (const [x0, bend, reach] of [
    [86, -26, 64],
    [108, -8, 76],
    [128, 8, 80],
    [150, 22, 70],
    [170, 36, 58],
  ] as const) {
    ctx.lineWidth = 11 - Math.abs(bend) * 0.08;
    ctx.beginPath();
    ctx.moveTo(x0, 210);
    ctx.quadraticCurveTo(x0 + bend, 244, x0 + bend * 0.4, 210 + reach);
    ctx.stroke();
  }

  // The mantle, dusty rose over the drift, and one wide dark eye.
  ctx.fillStyle = "#c98f92";
  ctx.beginPath();
  ctx.ellipse(128, 168, 42, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b77d81";
  ctx.beginPath();
  ctx.ellipse(128, 190, 44, 28, 0, 0, Math.PI);
  ctx.fill();
  for (const x of [112, 146]) {
    ctx.fillStyle = "#241418";
    ctx.beginPath();
    ctx.ellipse(x, 166, 6.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f5e9e4";
    ctx.beginPath();
    ctx.arc(x + 1.6, 163, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.toDataURL("image/png");
}
