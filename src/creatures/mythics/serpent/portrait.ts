import { createPlate, finishPlate, halo, motes, rays, wash, PLATE_W, PLATE_H } from "../shared/plate";

/**
 * The Old Current's plate: the great green curve of it mid-eight, violet
 * crest lifted, painted as a ribbon of water that decided to be kind.
 */
export function paintOldCurrentPortrait(): string | null {
  const plate = createPlate();
  if (!plate) {
    return null;
  }
  const { ctx } = plate;
  wash(ctx, "#1d3f5f", "#0a1c2e");
  rays(ctx, "#bcd8ee", 3);
  halo(ctx, PLATE_W * 0.62, PLATE_H * 0.36, 190, "rgba(120,190,200,0.5)");

  // The body: one long S of a stroke, tapered by overdrawing.
  const spine: [number, number][] = [
    [66, 402],
    [130, 348],
    [238, 356],
    [306, 300],
    [288, 216],
    [196, 176],
    [118, 210],
    [128, 292],
    [208, 300],
    [268, 262],
    [282, 200],
    [250, 148],
    [272, 108],
  ];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // Cream belly first, slightly low — the light plane under the animal.
  ctx.strokeStyle = "rgba(227,220,174,0.55)";
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(spine[0]![0], spine[0]![1] + 8);
  for (const [x, y] of spine.slice(1)) {
    ctx.lineTo(x, y + 8);
  }
  ctx.stroke();
  // Sea-green body.
  ctx.strokeStyle = "#3f6b58";
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(spine[0]![0], spine[0]![1]);
  for (const [x, y] of spine.slice(1)) {
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  // Spine shade along the top.
  ctx.strokeStyle = "rgba(38,72,64,0.7)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(spine[0]![0], spine[0]![1] - 12);
  for (const [x, y] of spine.slice(1)) {
    ctx.lineTo(x, y - 12);
  }
  ctx.stroke();

  // The violet crest: small lifted triangles along the back half.
  ctx.fillStyle = "#58427e";
  for (let i = 3; i < spine.length - 1; i++) {
    const [x, y] = spine[i]!;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 14);
    ctx.lineTo(x + 13, y - 14);
    ctx.lineTo(x + 4, y - 34 - (i % 3) * 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // The head: a blunt kind wedge, one dark eye with a warm pinpoint.
  ctx.fillStyle = "#3f6b58";
  ctx.beginPath();
  ctx.ellipse(282, 100, 30, 22, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e3dcae";
  ctx.beginPath();
  ctx.ellipse(290, 108, 18, 10, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#14110d";
  ctx.beginPath();
  ctx.arc(276, 92, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,240,200,0.9)";
  ctx.beginPath();
  ctx.arc(274, 90, 1.8, 0, Math.PI * 2);
  ctx.fill();

  motes(ctx, 46, "#9fc4d8", 0x5eed_0c01);
  return finishPlate(plate);
}
