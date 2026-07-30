import { BoxGeometry, BufferAttribute, Color, Group, type BufferGeometry } from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { GroundFn, KitBuild, KitPalette } from "./KitTypes";
import {
  finishBuild,
  groundLie,
  instantiatePlacements,
  shadeRatio,
  type KitPlacement,
} from "./KitGroundShared";

/**
 * `screeApron` — KIT-SPEC §2.3. Flat slabs seated against a wall foot,
 * tree foot or shelf lip and fanned downslope from each anchor — the
 * "things grow FROM somewhere" fix for pale walls, blue terrace lips and
 * smoking column feet. Ankle scenery by construction: the kit registers no
 * colliders, ever (law 1).
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw**; 12
 * triangles per slab — 6 anchors × 9 slabs ≈ 650 tris. Cheap on purpose:
 * an apron is punctuation, not a landmark.
 *
 * Paint (law 3): strata-banded value — each slab draws one of three value
 * steps so the pile reads as layered rock, the slab's own vertex paint
 * darkens its underside edge, and the broken end faces chip toward the
 * palette's `shade`: darker as a COLOUR, never black.
 */

export interface ScreeAnchor {
  /** Where the apron seats — a wall foot, a shelf lip, a column base. */
  readonly pos: readonly [number, number];
  /** Downslope direction the fan spills toward, radians (atan2 frame). */
  readonly facing: number;
  /** Metres of runout from the anchor to the fan's farthest slab. */
  readonly spread: number;
}

export interface ScreeApronOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly ground: GroundFn;
  readonly anchors: readonly ScreeAnchor[];
  readonly slabsPerAnchor: number;
}

/** The three strata value steps a slab may draw. */
const STRATA_TONES = [1.04, 0.95, 0.86] as const;

/** Fallback chip shade when the palette brings none: cool violet-grey. */
const DEFAULT_CHIP = 0x6f6880;

/** The fan's half-angle either side of `facing`, radians. */
const FAN_HALF = 0.55;

export function buildScreeApron(options: ScreeApronOptions): KitBuild {
  const random = new Random(options.seed);

  const chipRatio = shadeRatio(
    options.palette.base,
    options.palette.shade ?? DEFAULT_CHIP,
  );
  const geometry = slabGeometry(chipRatio);
  const material = createToonMaterial({ vertexColors: true });

  const color = new Color();
  const base = new Color(options.palette.base);
  const parts: KitPlacement[] = [];
  for (const anchor of options.anchors) {
    for (let i = 0; i < options.slabsPerAnchor; i++) {
      // Runout biased toward the foot: sqrt piles slabs where they fell.
      const along = anchor.spread * (0.12 + 0.88 * Math.sqrt(random.next()));
      const fan = anchor.facing + random.signed(FAN_HALF);
      const x = anchor.pos[0] + Math.cos(fan) * along;
      const z = anchor.pos[1] + Math.sin(fan) * along;

      // Blocks grow toward the runout's toe — the big ones rolled farthest.
      const grow = 0.8 + (along / Math.max(0.001, anchor.spread)) * 0.5;
      const length = random.range(0.34, 0.62) * grow;
      const widthScale = random.range(0.55, 0.95);
      const thickness = random.range(0.55, 1.1);

      // Long axis mostly ACROSS the fall line, a slid slab's rest pose.
      const yaw = fan + Math.PI / 2 + random.signed(0.5);
      const lie = groundLie(options.ground, x, z);
      const tone =
        STRATA_TONES[Math.floor(random.next() * STRATA_TONES.length)] ?? STRATA_TONES[0];

      parts.push({
        x,
        y: options.ground(x, z) + 0.09 * thickness * length - 0.03,
        z,
        rotation: [lie.pitch + random.signed(0.12), yaw, lie.roll + random.signed(0.12)],
        scale: [length, length * thickness, length * widthScale],
        color: color.copy(base).multiplyScalar(tone * random.range(0.97, 1.03)).clone(),
      });
    }
  }

  const mesh = instantiatePlacements(geometry, material, parts, "kit-scree-apron");
  const group = new Group();
  group.name = "kit-scree-apron";
  group.add(mesh);
  return finishBuild(group, [geometry, material]);
}

/**
 * One slab at unit length: a low box (12 triangles) whose vertex paint does
 * the weathering — the underside settles into shadow value, and the broken
 * end faces (local ±x) chip toward the shade colour.
 */
function slabGeometry(chipRatio: readonly [number, number, number]): BufferGeometry {
  const geometry = new BoxGeometry(1, 0.2, 0.68);
  const position = geometry.attributes.position as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    // Top edge full value, underside a step down — contact shadow authored.
    const down = 0.5 - position.getY(i) / 0.2; // 0 at top, 1 at bottom
    const value = 1 - down * 0.18;
    // The broken ends: chip tint strongest at the ±x faces.
    const chip = Math.min(1, Math.abs(position.getX(i)) * 2) * 0.55;
    colors[i * 3] = value * (1 + (chipRatio[0] - 1) * chip);
    colors[i * 3 + 1] = value * (1 + (chipRatio[1] - 1) * chip);
    colors[i * 3 + 2] = value * (1 + (chipRatio[2] - 1) * chip);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}
