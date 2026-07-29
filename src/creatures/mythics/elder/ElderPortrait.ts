import { paintMythicPlate, waterWash } from "../leviathan/MythicPlate";

/**
 * The Island That Swims' codex plate: a turtle elder in three-quarter view
 * under the golden canopy, moss and coral on its shell. Painted in the GLB's
 * own palette — olive and amber, moss green, coral rose — so the card and
 * the animal agree.
 */
export function paintElderPortrait(): string | null {
  return paintMythicPlate((ctx, size) => {
    const u = size / 256;

    waterWash(ctx, size, [
      [0, "#8a7434"],
      [0.35, "#5d5c33"],
      [1, "#27404a"],
    ]);

    ctx.save();
    ctx.translate(128 * u, 148 * u);

    // The shell: a broad amber-olive dome with a worn rim.
    ctx.fillStyle = "#77692f";
    ctx.beginPath();
    ctx.ellipse(0, 6 * u, 92 * u, 40 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8f7a38";
    ctx.beginPath();
    ctx.ellipse(0, -2 * u, 76 * u, 32 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // Scute seams across the dome.
    ctx.strokeStyle = "rgba(72, 66, 30, 0.6)";
    ctx.lineWidth = 2 * u;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 28 * u, -28 * u);
      ctx.quadraticCurveTo(k * 32 * u, 0, k * 30 * u, 26 * u);
      ctx.stroke();
    }

    // The garden: moss mats and coral knobs on the dome.
    const mats: readonly (readonly [number, number, number])[] = [
      [-30, -18, 15],
      [12, -26, 13],
      [38, -8, 11],
      [-8, -8, 9],
    ];
    for (const [x, y, r] of mats) {
      ctx.fillStyle = "#5d7a35";
      ctx.beginPath();
      ctx.ellipse(x * u, y * u, r * u, r * 0.55 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7d9a48";
      ctx.beginPath();
      ctx.ellipse(x * u, (y - 2) * u, r * 0.55 * u, r * 0.3 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const knobs: readonly (readonly [number, number])[] = [
      [-52, -4],
      [-12, -30],
      [26, -22],
      [54, 2],
      [6, 2],
    ];
    for (const [x, y] of knobs) {
      ctx.fillStyle = "#d98a72";
      ctx.beginPath();
      ctx.arc(x * u, y * u, 3.2 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f0c0a8";
      ctx.beginPath();
      ctx.arc(x * u, (y - 1.2) * u, 1.3 * u, 0, Math.PI * 2);
      ctx.fill();
    }

    // Head and neck reaching right, the elder's calm eye.
    ctx.fillStyle = "#8b945e";
    ctx.beginPath();
    ctx.ellipse(96 * u, -2 * u, 24 * u, 13 * u, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(118 * u, -8 * u, 15 * u, 11 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#141b18";
    ctx.beginPath();
    ctx.arc(122 * u, -10 * u, 2.4 * u, 0, Math.PI * 2);
    ctx.fill();

    // Front flipper sweeping down-left.
    ctx.fillStyle = "#7d884f";
    ctx.beginPath();
    ctx.ellipse(-60 * u, 30 * u, 34 * u, 10 * u, 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Canopy light: a few warm rays from the top, soft.
    ctx.fillStyle = "rgba(255, 226, 140, 0.10)";
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo((40 + k * 80) * u, 0);
      ctx.lineTo((68 + k * 80) * u, 0);
      ctx.lineTo((108 + k * 80) * u, size);
      ctx.lineTo((56 + k * 80) * u, size);
      ctx.closePath();
      ctx.fill();
    }
  });
}
