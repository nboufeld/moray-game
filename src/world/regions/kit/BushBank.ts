import {
  BufferAttribute,
  Color,
  Group,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { GateFn, GroundFn, KitArea, KitBuild, KitPalette } from "./KitTypes";
import {
  finishBuild,
  instantiatePlacements,
  mixRatio,
  scatterPoints,
  shadeRatio,
  type KitPlacement,
} from "./KitGroundShared";

/**
 * `bushBank` — KIT-SPEC §2.5. The bowl `Seaweed` welded-lobe cushion
 * rebuilt for regions: one seeded lobed mass, instanced in banks, with the
 * spring/olive/wine/pale/smoke/gold families all arriving as palettes.
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw per palette
 * family** (one per call); 36 triangles per lobe — the default 5 lobes are
 * 180 tris per bush, so a bank of 60 ≈ 10.8k tris.
 *
 * Paint (law 3): the instance colour owns the hue at the lobe TOPS
 * (`palette.tip`), and vertex colours only darken below it — down through
 * `base` to `shade` in the inner crotches, so a cushion carries its own
 * contact shadow. Per-instance jitter is VALUE-only and small: the
 * confetti lesson — variety by value, not hue noise.
 */

export interface BushBankOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly area: KitArea;
  readonly gate: GateFn;
  readonly ground: GroundFn;
  readonly count: number;
  /** Welded lobes per bush. Default 5 (≈180 tris). */
  readonly lobes?: number;
  /** Uniform scale on the whole bank's size bands. Default 1. */
  readonly scale?: number;
}

/**
 * The three bush ages, as (cumulative roll edge, min scale, max scale) —
 * the Seaweed LEAFY_BANDS shape: about half small, a third mid, a sixth
 * large, because a stand of one age is a plantation.
 */
const AGE_BANDS: readonly (readonly [number, number, number])[] = [
  [0.5, 0.55, 0.85],
  [0.84, 0.9, 1.2],
  [1.0, 1.3, 1.75],
];

/** The lobed geometry's crown height, by construction; the paint keys off it. */
const CROWN = 1.15;

/** Fallback crotch shade when the palette brings none: a warm violet dusk. */
const DEFAULT_SHADE = 0x584e60;

export function buildBushBank(options: BushBankOptions): KitBuild {
  const random = new Random(options.seed);
  const scale = options.scale ?? 1;

  const topHex = options.palette.tip ?? options.palette.base;
  const midRatio = shadeRatio(topHex, options.palette.base);
  const rootRatio = shadeRatio(topHex, options.palette.shade ?? DEFAULT_SHADE);

  // The bush's own sub-stream, so a count retune never re-welds the lobes.
  const geometry = lobedBushGeometry(
    new Random(options.seed ^ 0x9e37_79b9),
    Math.max(3, Math.round(options.lobes ?? 5)),
    midRatio,
    rootRatio,
  );
  const material = createToonMaterial({ vertexColors: true });

  const spots = scatterPoints({
    random,
    area: options.area,
    gate: options.gate,
    count: options.count,
    // Banks: tight hearts, few loose singles wandering off them.
    looseShare: 0.22,
    perClump: 7,
    clumpRadius: 2.6 * scale,
  });

  const color = new Color();
  const parts: KitPlacement[] = [];
  for (const spot of spots) {
    const roll = random.next();
    const band = AGE_BANDS.find(([edge]) => roll < edge) ?? AGE_BANDS[AGE_BANDS.length - 1]!;
    const size = random.range(band[1], band[2]) * scale;
    parts.push({
      x: spot.x,
      y: options.ground(spot.x, spot.z) - 0.06,
      z: spot.z,
      rotation: [random.signed(0.09), random.range(0, Math.PI * 2), random.signed(0.09)],
      scale: [
        size * random.range(0.9, 1.2),
        size * random.range(0.72, 0.95),
        size * random.range(0.9, 1.2),
      ],
      color: color.setHex(topHex).multiplyScalar(random.range(0.92, 1.08)).clone(),
    });
  }

  const mesh = instantiatePlacements(geometry, material, parts, "kit-bush-bank");
  const group = new Group();
  group.name = "kit-bush-bank";
  group.add(mesh);
  return finishBuild(group, [geometry, material]);
}

/**
 * Squashed lobes welded into one worn cushion — `seaweedBushGeometry`'s
 * construction with the kit's palette paint: crown → tip hue (ratio 1),
 * flank → base, inner crotch → shade.
 */
function lobedBushGeometry(
  random: Random,
  lobeCount: number,
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  const lobes: BufferGeometry[] = [];
  for (let i = 0; i < lobeCount; i++) {
    const lobe = new SphereGeometry(1, 6, 4);
    const angle = (i / lobeCount) * Math.PI * 2 + random.signed(0.4);
    const out = i === 0 ? 0 : random.range(0.45, 0.75);
    const size = i === 0 ? 1 : random.range(0.5, 0.75);
    lobe.scale(size, size * random.range(0.7, 0.9), size);
    lobe.translate(
      Math.cos(angle) * out,
      random.range(0.35, 0.6) * size,
      Math.sin(angle) * out,
    );
    lobes.push(lobe);
  }

  const merged = mergeGeometries(lobes, false);
  for (const lobe of lobes) {
    lobe.dispose();
  }
  if (!merged) {
    throw new Error("bushBank: lobes could not be merged");
  }
  smoothNormals(merged);

  const position = merged.attributes.position as BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) / CROWN));
    // How deep into the weld a vertex sits: crotches are low AND inward.
    const inward = 1 - Math.min(1, Math.hypot(position.getX(i), position.getZ(i)) / 1.25);
    const crotch = Math.min(1, (1 - t) * (0.55 + inward * 0.75));
    const ratio =
      t > 0.55
        ? mixRatio(midRatio, [1, 1, 1], (t - 0.55) / 0.45)
        : mixRatio(rootRatio, midRatio, t / 0.55);
    const deep = 1 - crotch * 0.22;
    colors[i * 3] = ratio[0] * deep;
    colors[i * 3 + 1] = ratio[1] * deep;
    colors[i * 3 + 2] = ratio[2] * deep;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  return merged;
}
