import { paintMythicPlate, waterWash } from "./MythicPlate";

/**
 * The Lantern Leviathan's codex plate: a whale-spirit in profile crossing
 * deep blue water, its lantern rows lit. Painted in the GLB's own palette —
 * deep slate, pale pleats, warm gold — so the card and the animal agree.
 */
export function paintLanternLeviathanPortrait(): string | null {
  return paintMythicPlate((ctx, size) => {
    const u = size / 256;

    waterWash(ctx, size, [
      [0, "#16344e"],
      [0.55, "#0f2a42"],
      [1, "#0a1f33"],
    ]);

    // The body: one long slate arc with a pale throat, drawn as two soft
    // ellipses so the silhouette reads before any detail does.
    ctx.save();
    ctx.translate(128 * u, 150 * u);
    ctx.rotate(-0.06);

    ctx.fillStyle = "#44607e";
    ctx.beginPath();
    ctx.ellipse(0, 0, 104 * u, 30 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head mass and rostrum.
    ctx.beginPath();
    ctx.ellipse(72 * u, 4 * u, 40 * u, 26 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pale ventral pleats: soft lines under the front half.
    ctx.strokeStyle = "rgba(206, 220, 214, 0.55)";
    ctx.lineWidth = 2.4 * u;
    for (let k = 0; k < 6; k++) {
      const x = (96 - k * 13) * u;
      ctx.beginPath();
      ctx.moveTo(x, 16 * u);
      ctx.quadraticCurveTo(x - 6 * u, 24 * u, x - 16 * u, 26 * u);
      ctx.stroke();
    }

    // Fluke.
    ctx.fillStyle = "#3a5570";
    ctx.beginPath();
    ctx.ellipse(-108 * u, -4 * u, 26 * u, 9 * u, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-108 * u, 8 * u, 26 * u, 9 * u, 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Pectoral.
    ctx.fillStyle = "#38536d";
    ctx.beginPath();
    ctx.ellipse(48 * u, 26 * u, 26 * u, 7 * u, 0.55, 0, Math.PI * 2);
    ctx.fill();

    // The lanterns: two rows of warm gold dots with hot hearts, the whole
    // reason this card exists.
    for (let k = 0; k < 9; k++) {
      const x = (88 - k * 21) * u;
      const y = (-14 - 6 * Math.sin(k * 0.9)) * u;
      ctx.fillStyle = "#f2c258";
      ctx.beginPath();
      ctx.arc(x, y, 3.4 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe9ad";
      ctx.beginPath();
      ctx.arc(x, y, 1.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let k = 0; k < 7; k++) {
      const x = (72 - k * 24) * u;
      const y = 6 * u;
      ctx.fillStyle = "#eeb84e";
      ctx.beginPath();
      ctx.arc(x, y, 2.6 * u, 0, Math.PI * 2);
      ctx.fill();
    }

    // The eye: low on the head, calm.
    ctx.fillStyle = "#141b24";
    ctx.beginPath();
    ctx.arc(88 * u, 8 * u, 2.6 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}
