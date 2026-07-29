import { createPlate, finishPlate, halo, motes, wash, PLATE_W, PLATE_H } from "../shared/plate";

/**
 * The Sovereign's plate: a lamp in the deep garden — the indigo dome, the
 * gold coronet flaring against the dark, tendrils raining pale light.
 */
export function paintCrownSovereignPortrait(): string | null {
  const plate = createPlate();
  if (!plate) {
    return null;
  }
  const { ctx } = plate;
  wash(ctx, "#171233", "#05030f");
  motes(ctx, 70, "#8f7fd8", 0x5eed_0c02);

  const cx = PLATE_W / 2;
  const cy = PLATE_H * 0.4;
  halo(ctx, cx, cy + 10, 210, "rgba(255,180,110,0.55)");

  // Tendrils first, behind the bell: twelve pale strands raining down.
  ctx.lineCap = "round";
  for (let k = 0; k < 12; k++) {
    const t = (k + 0.5) / 12;
    const x0 = cx + (t - 0.5) * 200;
    const sway = Math.sin(k * 1.7) * 26;
    const gradient = ctx.createLinearGradient(x0, cy + 30, x0 + sway, cy + 300);
    gradient.addColorStop(0, "rgba(102,82,168,0.85)");
    gradient.addColorStop(1, "rgba(255,205,150,0.9)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 5.5 - t * 2;
    ctx.beginPath();
    ctx.moveTo(x0, cy + 28);
    ctx.bezierCurveTo(x0 + sway * 0.3, cy + 110, x0 + sway, cy + 210, x0 + sway * 1.2, cy + 300);
    ctx.stroke();
  }

  // The bell: a deep indigo dome, darker inside the rim.
  ctx.fillStyle = "#241e4e";
  ctx.beginPath();
  ctx.ellipse(cx, cy, 118, 96, 0, 0, Math.PI * 2);
  ctx.fill();
  const dome = ctx.createLinearGradient(cx, cy - 96, cx, cy + 60);
  dome.addColorStop(0, "#4b418b");
  dome.addColorStop(1, "#2c2558");
  ctx.fillStyle = dome;
  ctx.beginPath();
  ctx.moveTo(cx - 118, cy + 20);
  ctx.bezierCurveTo(cx - 118, cy - 78, cx - 60, cy - 104, cx, cy - 104);
  ctx.bezierCurveTo(cx + 60, cy - 104, cx + 118, cy - 78, cx + 118, cy + 20);
  ctx.bezierCurveTo(cx + 60, cy + 44, cx - 60, cy + 44, cx - 118, cy + 20);
  ctx.fill();

  // The coronet: a bright band and twelve standing points.
  ctx.strokeStyle = "#ffb86e";
  ctx.lineWidth = 13;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, 112, 40, 0, Math.PI * 0.06, Math.PI * 0.94, false);
  ctx.stroke();
  ctx.fillStyle = "#ffc98a";
  for (let k = 0; k < 12; k++) {
    const a = Math.PI * (0.08 + (0.84 * k) / 11);
    const x = cx + Math.cos(a) * 118;
    const y = cy + 8 - Math.sin(a) * 40;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 4);
    ctx.lineTo(x + 8, y + 4);
    ctx.lineTo(x + 3, y - 22);
    ctx.closePath();
    ctx.fill();
  }
  // The band's own glow, reflected a touch under the dome.
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "#ffd9a8";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 22, 104, 34, 0, Math.PI * 0.1, Math.PI * 0.9, false);
  ctx.stroke();
  ctx.globalAlpha = 1;

  motes(ctx, 30, "#ffd9a8", 0x5eed_0c03);
  return finishPlate(plate);
}
