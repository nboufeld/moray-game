/**
 * A codex plate painted on a 2D canvas — the mythics' answer to
 * `renderMorayPortrait`, for beings too large for the portrait rig's
 * head-framing. The painter gets a square canvas and fills it; the result
 * is a PNG data URL, or null where no DOM exists (the unit tests), which
 * the codex already knows how to live without.
 */

/** Edge of the square plate, matching the moray portraits. */
export const PLATE_SIZE = 256;

export function paintMythicPlate(paint: (ctx: CanvasRenderingContext2D, size: number) => void): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = PLATE_SIZE;
  canvas.height = PLATE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  paint(ctx, PLATE_SIZE);
  return canvas.toDataURL("image/png");
}

/** The water every mythic swims in, bottom-lit or canopy-lit by the caller. */
export function waterWash(
  ctx: CanvasRenderingContext2D,
  size: number,
  stops: readonly (readonly [number, string])[],
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  for (const [at, colour] of stops) {
    gradient.addColorStop(at, colour);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}
