/**
 * The mythics' codex plates: small 2D paintings, storybook style.
 *
 * Each mythic's portrait is painted on a plain canvas at discovery time —
 * no renderer, no scene, just gouache strokes — which keeps it true in
 * every build (the GLB may not exist; the painting does not care). The
 * helpers here are the shared wash, the shared motes and the shared
 * vignette; the beings themselves are painted in their own modules.
 *
 * Inert without a document: the callers return null and the codex keeps
 * its empty frame, as every card is complete without the image.
 */

export const PLATE_W = 384;
export const PLATE_H = 512;

export interface Plate {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
}

/** A fresh plate, or null where there is no document (tests, SSR). */
export function createPlate(): Plate | null {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = PLATE_W;
  canvas.height = PLATE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  return { canvas, ctx };
}

/** The vertical water wash every plate starts from. */
export function wash(ctx: CanvasRenderingContext2D, top: string, bottom: string): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, PLATE_H);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PLATE_W, PLATE_H);
}

/** A handful of drifting motes — the water's own stars. */
export function motes(
  ctx: CanvasRenderingContext2D,
  count: number,
  color: string,
  seed: number,
): void {
  let state = seed >>> 0 || 1;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = next() * PLATE_W;
    const y = next() * PLATE_H;
    const r = 0.8 + next() * 2.2;
    ctx.globalAlpha = 0.12 + next() * 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Broad soft rays from the upper left, in the reef's own lighting. */
export function rays(ctx: CanvasRenderingContext2D, color: string, count = 3): void {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const offset = i * 90 - 40;
    ctx.beginPath();
    ctx.moveTo(offset, -20);
    ctx.lineTo(offset + 70, -20);
    ctx.lineTo(offset + 190, PLATE_H + 20);
    ctx.lineTo(offset + 90, PLATE_H + 20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The soft dark edge that makes a painting a plate. */
export function vignette(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createRadialGradient(
    PLATE_W / 2,
    PLATE_H / 2,
    PLATE_W * 0.42,
    PLATE_W / 2,
    PLATE_H / 2,
    PLATE_H * 0.72,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(6,10,18,0.42)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, PLATE_W, PLATE_H);
}

/** A soft warm halo, for anything that carries its own light. */
export function halo(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/** Finishes the plate: vignette, then the data URL the codex hangs. */
export function finishPlate(plate: Plate): string {
  vignette(plate.ctx);
  return plate.canvas.toDataURL("image/png");
}
