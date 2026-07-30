import {
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  PlaneGeometry,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { GateFn, GroundFn, KitArea, KitBuild, KitPalette } from "./KitTypes";
import {
  finishBuild,
  instantiatePlacements,
  scatterPoints,
  type KitPlacement,
} from "./KitGroundShared";

/**
 * `farGrassCards` — KIT-SPEC §2.9. The 4-triangle crossed-card distance
 * tuft: the cheap far grass any meadow region needs, and blue-1's whole
 * grass-budget tuning lever.
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw**; 4 triangles
 * per card — **10,000 cards = 40k triangles**, state it wherever consumed.
 * The 8k–12k regime is the intended count.
 *
 * No sway on purpose: motion at distance is noise. Paint follows the value
 * key's inversion — the instance hue is the near palette pulled one step
 * toward milk (brighter and less saturated, never darker), with a shallow
 * root shade so a distant drift still has grain without contrast that would
 * read as noise through fog.
 */

export interface FarGrassCardsOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly area: KitArea;
  readonly gate: GateFn;
  readonly ground: GroundFn;
  /** The 8k–12k regime; the caller owns the budget statement. */
  readonly count: number;
  /** Card height envelope in metres, [min, max). */
  readonly size?: readonly [number, number];
}

const DEFAULT_SIZE: readonly [number, number] = [0.24, 0.58];

/** The milk the distance palette leans toward — a pale warm haze, not white. */
const MILK = 0xd8e2d6;
/** How far toward milk the near palette is pulled: the "one value step".
 *  0.32 read bleached-white beside the near band (capture a-r1). */
const MILK_STEP = 0.22;

export function buildFarGrassCards(options: FarGrassCardsOptions): KitBuild {
  const random = new Random(options.seed);
  const size = options.size ?? DEFAULT_SIZE;

  const geometry = crossedCardGeometry();
  const material = createToonMaterial({ side: DoubleSide, vertexColors: true });

  const spots = scatterPoints({
    random,
    area: options.area,
    gate: options.gate,
    count: options.count,
    // Distance drifts: broad soft clumps, most of the field loose.
    looseShare: 0.45,
    perClump: 60,
  });

  const milky = new Color(options.palette.base).lerp(new Color(MILK), MILK_STEP);
  const color = new Color();
  const parts: KitPlacement[] = [];
  for (const spot of spots) {
    const yaw = random.range(0, Math.PI * 2);
    const height = random.range(size[0], size[1]);
    const width = height * random.range(0.85, 1.2);
    const jitter = random.range(0.95, 1.05); // shallow: distance stays calm
    parts.push({
      x: spot.x,
      y: options.ground(spot.x, spot.z) - 0.02,
      z: spot.z,
      rotation: [random.signed(0.06), yaw, random.signed(0.06)],
      scale: [width, height, width],
      color: color.copy(milky).multiplyScalar(jitter).clone(),
    });
  }

  const mesh = instantiatePlacements(geometry, material, parts, "kit-far-grass-cards");
  const group = new Group();
  group.name = "kit-far-grass-cards";
  group.add(mesh);
  return finishBuild(group, [geometry, material]);
}

/**
 * Two tapered quads crossed at right angles — 4 triangles. The taper and a
 * small lean keep the silhouette a tuft rather than an X of cards; the root
 * shade is shallow (0.82) because at distance contrast is noise.
 */
function crossedCardGeometry(): BufferGeometry {
  const cards: BufferGeometry[] = [];
  for (let i = 0; i < 2; i++) {
    const card = new PlaneGeometry(0.5, 1, 1, 1);
    const position = card.attributes.position as BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    for (let v = 0; v < position.count; v++) {
      const t = position.getY(v) + 0.5;
      // Taper toward a soft point, lean the tip so the pair never reads flat.
      position.setX(v, position.getX(v) * (1 - t * 0.72));
      position.setY(v, t);
      position.setZ(v, position.getZ(v) + t * t * 0.16);
      const shade = 0.82 + t * 0.18;
      colors[v * 3] = shade;
      colors[v * 3 + 1] = shade;
      colors[v * 3 + 2] = shade;
    }
    position.needsUpdate = true;
    card.computeVertexNormals();
    card.setAttribute("color", new BufferAttribute(colors, 3));
    card.rotateY((Math.PI / 2) * i + 0.2 * i);
    cards.push(card);
  }
  const merged = mergeGeometries(cards, false);
  for (const card of cards) {
    card.dispose();
  }
  if (!merged) {
    throw new Error("farGrassCards: cards could not be merged");
  }
  return merged;
}
