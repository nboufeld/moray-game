import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { Random } from "../../util/Random";
import type { MoraySpeciesConfig } from "./MoraySpeciesConfig";

const SIZE = 128;

/**
 * Paints a species' markings into a tiling texture for the body tube.
 *
 * Markings used to be geometry — spheres studded onto each segment and
 * alternating segment colours for bands — which read as golf balls glued to a
 * pipe. Painting them keeps the silhouette clean and lets the pattern flow
 * along the body the way a real moray's does.
 *
 * Returns null where there is no DOM (the unit tests build every species in a
 * plain Node environment), in which case the body falls back to a flat colour.
 */
export function createPatternTexture(config: MoraySpeciesConfig): CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const body = hex(config.bodyColor);
  const pattern = hex(config.patternColor);

  ctx.fillStyle = body;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const random = new Random(hashId(config.id));
  switch (config.pattern) {
    case "spots":
      paintRosettes(ctx, pattern, random);
      break;
    case "bands":
      paintBands(ctx, pattern, random);
      break;
    case "plain":
      paintSheen(ctx, pattern);
      break;
    default: {
      const exhaustive: never = config.pattern;
      throw new Error(`Unhandled moray pattern: ${String(exhaustive)}`);
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}

/** Clustered flecks, the snowflake and dragon morays' reticulated dusting. */
function paintRosettes(ctx: CanvasRenderingContext2D, color: string, random: Random): void {
  ctx.fillStyle = color;
  const wrap = [-SIZE, 0, SIZE];

  for (let i = 0; i < 26; i++) {
    const centreX = random.range(0, SIZE);
    const centreY = random.range(0, SIZE);
    const flecks = Math.round(random.range(4, 9));
    const spread = random.range(5, 13);

    for (let f = 0; f < flecks; f++) {
      const angle = random.range(0, Math.PI * 2);
      const distance = random.range(0, spread);
      const radius = random.range(1.4, 3.6);
      // Stamped at wrapped offsets so the tile has no visible seam.
      for (const offsetX of wrap) {
        for (const offsetY of wrap) {
          ctx.beginPath();
          ctx.arc(
            centreX + Math.cos(angle) * distance + offsetX,
            centreY + Math.sin(angle) * distance + offsetY,
            radius,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
    }
  }
}

/**
 * Bars wrapping the body. The texture's vertical axis runs along the tube, so
 * a horizontal stripe here becomes a ring around the animal.
 */
function paintBands(ctx: CanvasRenderingContext2D, color: string, random: Random): void {
  ctx.fillStyle = color;
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const height = (SIZE / bands) * random.range(0.34, 0.52);
    const y = (i / bands) * SIZE + random.range(0, 4);
    ctx.fillRect(0, y, SIZE, height);
    // Repeat across the seam so a band is never clipped mid-ring.
    ctx.fillRect(0, y - SIZE, SIZE, height);
  }
}

/** A soft lengthwise sheen for the unmarked species. */
function paintSheen(ctx: CanvasRenderingContext2D, color: string): void {
  const gradient = ctx.createLinearGradient(0, 0, SIZE, 0);
  gradient.addColorStop(0, "rgba(0,0,0,0.22)");
  gradient.addColorStop(0.5, color);
  gradient.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalAlpha = 1;
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Stable per-species seed so a given moray always wears the same markings. */
function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}
