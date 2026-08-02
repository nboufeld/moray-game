import { BoxGeometry, BufferAttribute, Color, Group, Mesh, type BufferGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { GroundFn, KitBuild, KitPalette } from "./KitTypes";
import {
  finishBuild,
  groundLie,
  mergeBakedPlacements,
  shadeRatio,
  type KitPlacement,
} from "./KitGroundShared";

/**
 * `screeApron` — KIT-SPEC §2.3, re-authored under MASTER R12. Flat slabs
 * seated against a wall foot, tree foot or shelf lip and fanned downslope
 * from each anchor — the "things grow FROM somewhere" fix for pale walls,
 * blue terrace lips and smoking column feet. Ankle scenery by
 * construction: the kit registers no colliders, ever (law 1).
 *
 * R12: the one shared box became THREE slab families baked into one
 * merged world-space draw (the driftDebris idiom — an InstancedMesh
 * carries one geometry, and silhouette variety was the whole complaint):
 * a worn strata slab with weathered corners, a split wedge whose broken
 * end pinches to a chipped edge, and a thin flake. The runout still
 * grades — big blocks roll to the toe, ankle chips pile at the foot.
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

/** The three strata value steps a slab may draw — wide enough to read as
 *  layered rock at ankle scale (a-r1's spread was too polite to see;
 *  q-r1 widened it again — under the water light 1.06/0.94/0.82 still
 *  rendered as one grey). */
const STRATA_TONES = [1.1, 0.92, 0.74] as const;

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
  // The slab family is seeded off the build's own seed, so two aprons
  // with different seeds wear differently-weathered stone.
  const variants = [
    wornSlab(options.seed, chipRatio),
    splitSlab(options.seed ^ 0x5c3e, chipRatio),
    flakeSlab(options.seed ^ 0xf1a4, chipRatio),
  ];
  const material = createToonMaterial({ vertexColors: true });

  const color = new Color();
  const base = new Color(options.palette.base);
  const parts: KitPlacement[] = [];
  const picks: number[] = [];
  for (const anchor of options.anchors) {
    for (let i = 0; i < options.slabsPerAnchor; i++) {
      // Runout biased toward the foot: u² piles slabs against the anchor
      // and thins the fan toward the toe (a-r1/r2 read as loose scatter).
      const roll = random.next();
      const along = anchor.spread * (0.12 + 0.88 * roll * roll);
      const fan = anchor.facing + random.signed(FAN_HALF);
      const x = anchor.pos[0] + Math.cos(fan) * along;
      const z = anchor.pos[1] + Math.sin(fan) * along;

      // Blocks grow toward the runout's toe — the big ones rolled farthest
      // — and the toe favours the blockier families while the foot piles
      // flakes: the size-graded scatter R12 asks for, at the fan's own
      // grain (a formed slab anchors any foreground the toe reaches).
      const toe = along / Math.max(0.001, anchor.spread);
      const grow = 0.8 + toe * 0.5;
      const length = random.range(0.34, 0.62) * grow;
      const widthScale = random.range(0.64, 0.95);
      const thickness = random.range(0.55, 1.1);
      const pickRoll = random.next();
      const pick = pickRoll < 0.25 + toe * 0.3 ? (pickRoll < 0.2 ? 1 : 0) : pickRoll > 0.8 - toe * 0.2 ? 2 : 0;

      // Long axis mostly ACROSS the fall line, a slid slab's rest pose.
      const yaw = fan + Math.PI / 2 + random.signed(0.5);
      const lie = groundLie(options.ground, x, z);
      const tone =
        STRATA_TONES[Math.floor(random.next() * STRATA_TONES.length)] ?? STRATA_TONES[0];
      // The PILE (q-r1: slabs strewn flat read as dropped paper): near
      // the foot slabs stack on each other — a seeded lift plus a harder
      // tumble tilt, both easing to zero at the toe where slabs slid out
      // flat and alone.
      const stack = (1 - toe) * random.range(0, 0.11);
      const tumble = (1 - toe) * 0.28;

      parts.push({
        x,
        y: options.ground(x, z) + 0.09 * thickness * length - 0.05 + stack,
        z,
        rotation: [
          lie.pitch + random.signed(0.12 + tumble),
          yaw,
          lie.roll + random.signed(0.12 + tumble),
        ],
        scale: [length, length * thickness, length * widthScale],
        color: color.copy(base).multiplyScalar(tone * random.range(0.97, 1.03)).clone(),
      });
      picks.push(pick);
    }
  }

  const merged = mergeBakedPlacements(variants, parts, picks);
  for (const variant of variants) {
    variant.dispose();
  }
  const mesh = new Mesh(merged, material);
  mesh.name = "kit-scree-apron";
  const group = new Group();
  group.name = "kit-scree-apron";
  group.add(mesh);
  return finishBuild(group, [merged, material]);
}

/**
 * The shared slab paint: top edge full value, underside a step down, the
 * broken ±x ends chipping toward the shade colour by `endChip`.
 */
function paintSlab(
  geometry: BufferGeometry,
  chipRatio: readonly [number, number, number],
  endChip: number,
  height: number,
): void {
  const position = geometry.attributes.position as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const down = 0.5 - position.getY(i) / height; // 0 at top, 1 at bottom
    const value = 1 - down * 0.18;
    const end = Math.min(1, Math.max(0, (Math.abs(position.getX(i)) - 0.38) / 0.12));
    const chip = end * endChip;
    colors[i * 3] = value * (1 + (chipRatio[0] - 1) * chip);
    colors[i * 3 + 1] = value * (1 + (chipRatio[1] - 1) * chip);
    colors[i * 3 + 2] = value * (1 + (chipRatio[2] - 1) * chip);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/**
 * Weathers a box's corners: every vertex slides by a small fbm offset
 * keyed on its own position, so duplicated corner vertices move together
 * and the faces stay welded — worn facets, not cracks.
 */
function weather(geometry: BufferGeometry, seed: number, amount: number): void {
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const wobble = (axis: number): number =>
      (fbm(x * 0.9 + z * 0.7 + axis * 3.1, y * 1.3 + axis, { seed, period: 3, octaves: 2 }) - 0.5) *
      2 *
      amount;
    position.setXYZ(i, x + wobble(0) * 0.7, y + wobble(1) * 0.4, z + wobble(2) * 0.7);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

/** The worn strata slab: a low box with weathered corners. 12 tris. */
function wornSlab(seed: number, chipRatio: readonly [number, number, number]): BufferGeometry {
  const geometry = new BoxGeometry(1, 0.2, 0.68);
  weather(geometry, seed, 0.07);
  paintSlab(geometry, chipRatio, 0.75, 0.2);
  return geometry;
}

/** The split wedge: one end pinched to a broken edge. 12 tris. */
function splitSlab(seed: number, chipRatio: readonly [number, number, number]): BufferGeometry {
  const geometry = new BoxGeometry(1, 0.22, 0.6);
  const position = geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    if (x > 0.2) {
      const past = (x - 0.2) / 0.3;
      position.setY(i, position.getY(i) * (1 - past * 0.65));
      position.setZ(i, position.getZ(i) * (1 - past * 0.3));
    }
  }
  position.needsUpdate = true;
  weather(geometry, seed, 0.05);
  paintSlab(geometry, chipRatio, 0.95, 0.22);
  return geometry;
}

/** The thin flake: wide, low, the ankle chip of the pile. 12 tris. */
function flakeSlab(seed: number, chipRatio: readonly [number, number, number]): BufferGeometry {
  const geometry = new BoxGeometry(1, 0.13, 0.85);
  weather(geometry, seed, 0.07);
  paintSlab(geometry, chipRatio, 0.6, 0.13);
  return geometry;
}
