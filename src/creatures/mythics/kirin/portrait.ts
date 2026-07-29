import { createPlate, finishPlate, halo, motes, rays, wash, PLATE_W, PLATE_H } from "../shared/plate";

/**
 * The Kirin's plate: the ruins' gold-green gloom, two fallen columns, and
 * the spirit standing among them with its coral antlers lifted — the
 * terrace's oldest tenant, caught mid-graze, looking up.
 */
export function paintReefKirinPortrait(): string | null {
  const plate = createPlate();
  if (!plate) {
    return null;
  }
  const { ctx } = plate;
  wash(ctx, "#43502f", "#151f11");
  rays(ctx, "#d8e6a8", 2);

  // The fallen columns: dark rounded masses, tipped where they fell.
  ctx.fillStyle = "rgba(24,32,20,0.55)";
  ctx.save();
  ctx.translate(70, 400);
  ctx.rotate(-0.35);
  ctx.fillRect(-34, -110, 68, 220);
  ctx.restore();
  ctx.save();
  ctx.translate(320, 420);
  ctx.rotate(0.28);
  ctx.fillRect(-30, -90, 60, 180);
  ctx.restore();

  halo(ctx, PLATE_W * 0.52, PLATE_H * 0.42, 170, "rgba(220,210,150,0.5)");

  const cx = PLATE_W * 0.52;
  const cy = PLATE_H * 0.46;

  // The tail curl.
  ctx.strokeStyle = "#d9bd7f";
  ctx.lineCap = "round";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx - 40, cy + 160, 42, Math.PI * 0.9, Math.PI * 2.35);
  ctx.stroke();
  // The upright body: belly and chest in pale gold, cream front.
  ctx.fillStyle = "#d9bd7f";
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy + 96, 34, 62, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#efe3b4";
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy + 100, 20, 48, -0.12, 0, Math.PI * 2);
  ctx.fill();
  // The neck arcing up and forward.
  ctx.strokeStyle = "#d9bd7f";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(cx - 4, cy + 60);
  ctx.quadraticCurveTo(cx + 6, cy - 10, cx + 26, cy - 52);
  ctx.stroke();
  // The moss mane, dashed along the back of the neck.
  ctx.strokeStyle = "#75805a";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx - 16, cy + 66);
  ctx.quadraticCurveTo(cx - 8, cy - 4, cx + 12, cy - 50);
  ctx.stroke();
  // The head: skull, long muzzle, soft nose.
  ctx.fillStyle = "#d9bd7f";
  ctx.beginPath();
  ctx.ellipse(cx + 34, cy - 58, 20, 15, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 52, cy - 52, 13, 9, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a5c50";
  ctx.beginPath();
  ctx.arc(cx + 62, cy - 50, 4, 0, Math.PI * 2);
  ctx.fill();
  // The eye: dark, forward-set, with a warm pinpoint — the deer looking up.
  ctx.fillStyle = "#171208";
  ctx.beginPath();
  ctx.arc(cx + 40, cy - 62, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,240,200,0.9)";
  ctx.beginPath();
  ctx.arc(cx + 38.5, cy - 63.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // The antlers: branching coral strokes, tines forking upward.
  ctx.strokeStyle = "#e89d80";
  ctx.lineWidth = 6;
  for (const lean of [-1, 1]) {
    const baseX = cx + 26 + lean * 8;
    const baseY = cy - 70;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX + lean * 10, baseY - 34, baseX + lean * 20, baseY - 62);
    ctx.stroke();
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(baseX + lean * 6, baseY - 22);
    ctx.quadraticCurveTo(baseX + lean * 18, baseY - 30, baseX + lean * 24, baseY - 44);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(baseX + lean * 14, baseY - 48);
    ctx.quadraticCurveTo(baseX + lean * 24, baseY - 58, baseX + lean * 26, baseY - 74);
    ctx.stroke();
    ctx.lineWidth = 6;
  }
  // A doe's ear.
  ctx.fillStyle = "#75805a";
  ctx.beginPath();
  ctx.ellipse(cx + 20, cy - 64, 10, 4.5, 0.5, 0, Math.PI * 2);
  ctx.fill();

  motes(ctx, 40, "#c8d498", 0x5eed_0c04);
  return finishPlate(plate);
}
