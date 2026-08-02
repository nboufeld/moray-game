import {
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
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
 * `bushBank` — KIT-SPEC §2.5, enriched under MASTER R12. The bowl
 * `Seaweed` welded-lobe cushion rebuilt for regions: one seeded lobed
 * mass, instanced in banks, with the spring/olive/wine/pale/smoke/gold
 * families all arriving as palettes.
 *
 * The R12 additions (all opt-in, so every existing consumer builds
 * byte-identical placements at byte-identical cost):
 * - `fronds`: drooping strap overhangs arching out of the crown — the
 *   Seaweed rosette's hang grafted onto the cushion, the one line that
 *   most breaks the "smooth boulder" read at swimming distance;
 * - `accents`: berry/bud knots on the palette's `accent` ink, painted
 *   values only (never emissive);
 * - `looseShare`: the F-R2 scatter knob (default 0.22, the value every
 *   existing bank already got);
 * - the default lobes keep their exact topology (36 tris each) but weld
 *   with more silhouette variety — satellites elongate radially and sit
 *   at seeded heights — and the crown-to-crotch paint is deepened.
 *
 * Budget note (asserted by tests/kitGround.test.ts): **1 draw per palette
 * family** (one per call); per bush, `lobes × 36 + fronds × 12 +
 * accents × 8` triangles — the default 5 lobes stay 180 tris, a rich
 * 7-lobe / 5-frond / 6-accent bush is 360.
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
  /** Drooping strap overhangs per bush (12 tris each). Default 0. */
  readonly fronds?: number;
  /** Berry/bud knots per bush (8 tris each), on `palette.accent`. Default 0. */
  readonly accents?: number;
  /** F-R2: share of bushes scattered loose between the bank hearts.
   *  Default 0.22 — the value every existing consumer already got. */
  readonly looseShare?: number;
}

/**
 * The three bush ages, as (cumulative roll edge, min scale, max scale) —
 * the Seaweed LEAFY_BANDS shape: about half small, a third mid, a sixth
 * large, because a stand of one age is a plantation.
 */
const AGE_BANDS: readonly (readonly [number, number, number])[] = [
  [0.5, 0.5, 0.75],
  [0.84, 0.78, 1.0],
  [1.0, 1.1, 1.4],
];

/** The lobed geometry's crown height, by construction (the core lobe's
 *  radius-1 sphere lifted 0.35–0.6); the paint keys off it. 1.15 was an
 *  under-measure that saturated the whole upper bush to the tip hue
 *  (capture a-r2's flat boulders). */
const CROWN = 1.5;

/** Fallback crotch shade when the palette brings none: a warm violet dusk. */
const DEFAULT_SHADE = 0x584e60;

export function buildBushBank(options: BushBankOptions): KitBuild {
  const random = new Random(options.seed);
  const scale = options.scale ?? 1;
  const fronds = Math.max(0, Math.round(options.fronds ?? 0));
  const accents = Math.max(0, Math.round(options.accents ?? 0));

  const topHex = options.palette.tip ?? options.palette.base;
  const midRatio = shadeRatio(topHex, options.palette.base);
  const rootRatio = shadeRatio(topHex, options.palette.shade ?? DEFAULT_SHADE);
  const accentRatio = shadeRatio(
    topHex,
    options.palette.accent ?? options.palette.shade ?? DEFAULT_SHADE,
  );

  // The bush's own sub-stream, so a count retune never re-welds the lobes.
  // Fronds and accents draw AFTER the lobes from the same sub-stream, so a
  // lobes-only bush (every existing consumer) welds exactly as it did.
  const geometry = lobedBushGeometry(
    new Random(options.seed ^ 0x9e37_79b9),
    Math.max(3, Math.round(options.lobes ?? 5)),
    fronds,
    accents,
    midRatio,
    rootRatio,
    accentRatio,
  );
  // Open strap fronds need both faces; closed lobes never show a backface,
  // so the flag is only paid for when the overhangs exist.
  const material = createToonMaterial(
    fronds > 0 ? { side: DoubleSide, vertexColors: true } : { vertexColors: true },
  );

  const spots = scatterPoints({
    random,
    area: options.area,
    gate: options.gate,
    count: options.count,
    // Banks: tight hearts, few loose singles wandering off them.
    looseShare: options.looseShare ?? 0.22,
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
 * flank → base, inner crotch → shade — plus the R12 overhang fronds and
 * berry knots when asked for.
 */
function lobedBushGeometry(
  random: Random,
  lobeCount: number,
  frondCount: number,
  accentCount: number,
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
  accentRatio: readonly [number, number, number],
): BufferGeometry {
  const lobes: BufferGeometry[] = [];
  for (let i = 0; i < lobeCount; i++) {
    const lobe = new SphereGeometry(1, 6, 4);
    const angle = (i / lobeCount) * Math.PI * 2 + random.signed(0.4);
    // Satellites smaller and further out than the bowl cushion's: welded
    // enough to stay one mass, distinct enough that the silhouette lobes
    // (the a-r1 boulder read came from too much overlap).
    const out = i === 0 ? 0 : random.range(0.55, 0.9);
    const size = i === 0 ? 1 : random.range(0.42, 0.66);
    // R12 silhouette variety, same topology: satellites elongate along
    // their own radial (a grown lobe reaches for light, a sphere does
    // not) and squash with a wider spread than the old 0.7–0.9.
    const reach = i === 0 ? 1 : random.range(1.0, 1.22);
    const squash = random.range(0.62, 0.92);
    lobe.scale(size * reach, size * squash, size);
    lobe.rotateY(-angle);
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

  // Knock the weld out of round: an fbm swell sampled by direction from
  // the bush's heart, so seam vertices agree — five perfect spheres read
  // as boulders however they are painted (captures a-r2/r3).
  const position = merged.attributes.position as BufferAttribute;
  const noiseSeed = Math.floor(random.next() * 0xffff_ffff);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i) - 0.5;
    const z = position.getZ(i);
    const length = Math.hypot(x, y, z) || 1;
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const v = Math.asin(Math.max(-1, Math.min(1, y / length))) / Math.PI + 0.5;
    const swell = 1 + (fbm(u, v, { seed: noiseSeed, period: 5, octaves: 3 }) - 0.5) * 0.36;
    position.setXYZ(i, x * swell, (y * swell) + 0.5, z * swell);
  }
  position.needsUpdate = true;
  merged.computeVertexNormals();
  smoothNormals(merged);

  // Per-lobe tone separation: each welded lobe holds its own value step,
  // the painterly cue that a cushion is MANY plants grown together.
  const vertsPerLobe = position.count / lobeCount;
  // Capped at 1 so the vertex-colour ceiling holds (law 3).
  const lobeTones: number[] = [];
  for (let i = 0; i < lobeCount; i++) {
    lobeTones.push(random.range(0.78, 1.0));
  }

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const lobeTone = lobeTones[Math.min(lobeCount - 1, Math.floor(i / vertsPerLobe))] ?? 1;
    const t = Math.min(1, Math.max(0, position.getY(i) / CROWN));
    // How deep into the weld a vertex sits: crotches are low AND inward.
    const inward = 1 - Math.min(1, Math.hypot(position.getX(i), position.getZ(i)) / 1.25);
    const crotch = Math.min(1, (1 - t) * (0.55 + inward * 0.9));
    // A hard-working ramp: the a-r1 capture read the cushions as smooth
    // boulders, and most of that was a gradient too polite to see. The tip
    // hue holds only the top quarter; the base carries the mass; the roots
    // and crotches drop well below it (as a colour — the ratios hold hue).
    const ratio =
      t > 0.72
        ? mixRatio(midRatio, [1, 1, 1], (t - 0.72) / 0.28)
        : mixRatio(rootRatio, midRatio, Math.pow(t / 0.72, 1.35));
    // R12: the crotch drop deepened (0.34 → 0.44) — at 2.5 m the inner
    // shadow is most of what says "many plants", and the old drop washed
    // out under the water light.
    const deep = (1 - crotch * 0.44) * lobeTone;
    colors[i * 3] = ratio[0] * deep;
    colors[i * 3 + 1] = ratio[1] * deep;
    colors[i * 3 + 2] = ratio[2] * deep;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));

  const extras: BufferGeometry[] = [merged];
  if (frondCount > 0) {
    extras.push(bushFronds(random, frondCount, midRatio, rootRatio));
  }
  if (accentCount > 0) {
    extras.push(berryKnots(random, accentCount, accentRatio));
  }
  if (extras.length === 1) {
    return merged;
  }
  // The lobes and straps arrive indexed, the octahedron buds do not —
  // mergeGeometries refuses the mix, so everything drops its index here.
  // Lobes-only bushes (every pre-R12 consumer) return above, untouched.
  const flattened = extras.map((part) => (part.index ? part.toNonIndexed() : part));
  const dressed = mergeGeometries(flattened, false);
  for (const part of extras) {
    part.dispose();
  }
  for (const part of flattened) {
    part.dispose();
  }
  if (!dressed) {
    throw new Error("bushBank: overhangs could not be merged");
  }
  return dressed;
}

/**
 * The overhang fronds: broad cupped LEAVES growing out of the whole
 * crown, arching over the lobes — the bowl's W11 leafy-bush shell at
 * overhang density, not a spray of straps from the heart (the q-r1
 * capture: straps at 0.15 width scaled by a bush instance rasterise as
 * wire hairs, and the boulder read survives them untouched). 12
 * triangles each; tips take the instance hue, roots sink to the crotch
 * shade so each leaf grows OUT of the cushion instead of lying on it.
 */
function bushFronds(
  random: Random,
  count: number,
  midRatio: readonly [number, number, number],
  rootRatio: readonly [number, number, number],
): BufferGeometry {
  const leaves: BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const length = random.range(0.9, 1.45);
    const width = random.range(0.3, 0.44);
    const bow = random.range(0.9, 1.4);
    const segments = 3;
    const leaf = new PlaneGeometry(width, length, 2, segments);
    const position = leaf.attributes.position as BufferAttribute;

    const rows = segments + 1;
    const arcY = new Float32Array(rows);
    const arcZ = new Float32Array(rows);
    const bendAt = new Float32Array(rows);
    const step = length / segments;
    let y = 0;
    let z = 0;
    for (let row = 0; row < rows; row++) {
      arcY[row] = y;
      arcZ[row] = z;
      bendAt[row] = bow * Math.pow(row / segments, 1.4);
      const angle = bow * Math.pow((row + 0.5) / segments, 1.4);
      y += Math.cos(angle) * step;
      z += Math.sin(angle) * step;
    }

    const colors = new Float32Array(position.count * 3);
    const half = width / 2;
    const twistBy = random.range(0.35, 0.65);
    for (let v = 0; v < position.count; v++) {
      const t = (position.getY(v) + length / 2) / length;
      const row = Math.round(t * segments);
      const column = position.getX(v) / half;
      const theta = bendAt[row] ?? 0;
      const twist = twistBy * t;
      const taper = Math.max(0.12, Math.sin(Math.PI * Math.pow(0.2 + t * 0.8, 0.75)));
      const across = column * half * taper;
      const cup = (1 - Math.abs(column)) * half * taper * 0.55;
      const offNormal = across * Math.sin(twist) + cup;
      position.setXYZ(
        v,
        across * Math.cos(twist),
        (arcY[row] ?? 0) + offNormal * -Math.sin(theta),
        (arcZ[row] ?? 0) + offNormal * Math.cos(theta),
      );
      const ratio =
        t < 0.55
          ? mixRatio(rootRatio, midRatio, t / 0.55)
          : mixRatio(midRatio, [1, 1, 1], (t - 0.55) / 0.45);
      colors[v * 3] = ratio[0];
      colors[v * 3 + 1] = ratio[1];
      colors[v * 3 + 2] = ratio[2];
    }
    position.needsUpdate = true;
    leaf.computeVertexNormals();
    leaf.setAttribute("color", new BufferAttribute(colors, 3));

    // The W11 three-ring recipe: a skirt leaning well out low on the
    // crown (half the leaves), a mid ring, a near-upright heart — so the
    // upper mass reads leafy from every angle and the lobes only show
    // underneath, as the shadow mass they are. Roots sink into the weld;
    // a leaf that starts mid-air is a spike (the q-r3 read).
    const ring = i % 2 === 0 ? 0 : i % 4 === 1 ? 1 : 2;
    const yaw = (i / count) * Math.PI * 2 + random.signed(0.7);
    const lean =
      ring === 0 ? random.range(0.45, 0.75) : ring === 1 ? random.range(0.28, 0.5) : random.range(0.08, 0.3);
    leaf.applyMatrix4(
      new Matrix4().makeRotationY(-yaw + Math.PI / 2).multiply(new Matrix4().makeRotationX(lean)),
    );
    const out =
      ring === 0 ? random.range(0.5, 0.85) : ring === 1 ? random.range(0.25, 0.5) : random.range(0, 0.2);
    leaf.translate(
      Math.cos(yaw) * out,
      ring === 0 ? random.range(0.3, 0.55) : ring === 1 ? random.range(0.55, 0.8) : random.range(0.75, 1.0),
      Math.sin(yaw) * out,
    );
    leaves.push(leaf);
  }
  const merged = mergeGeometries(leaves, false);
  for (const leaf of leaves) {
    leaf.dispose();
  }
  if (!merged) {
    throw new Error("bushBank: fronds could not be merged");
  }
  return merged;
}

/**
 * Berry/bud knots: 8-tri octahedra pressed into the upper flanks, painted
 * toward the palette's accent ink — values only (law 2: nothing glows).
 * They cluster in twos and threes around seeded knot centres, the way
 * fruit sets, instead of sprinkling evenly (the confetti lesson again).
 */
function berryKnots(
  random: Random,
  count: number,
  accentRatio: readonly [number, number, number],
): BufferGeometry {
  const buds: BufferGeometry[] = [];
  const knotCount = Math.max(1, Math.round(count / 3));
  const knots: { yaw: number; rise: number }[] = [];
  for (let i = 0; i < knotCount; i++) {
    knots.push({ yaw: random.range(0, Math.PI * 2), rise: random.range(0.55, 0.95) });
  }
  for (let i = 0; i < count; i++) {
    const knot = knots[i % knotCount]!;
    const yaw = knot.yaw + random.signed(0.35);
    const rise = knot.rise + random.signed(0.12);
    const out = random.range(0.8, 1.02);
    const size = random.range(0.07, 0.11);
    const bud = new OctahedronGeometry(size, 0);
    bud.scale(1, random.range(0.85, 1.1), 1);
    bud.translate(Math.cos(yaw) * out, rise, Math.sin(yaw) * out);

    const position = bud.attributes.position as BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    for (let v = 0; v < position.count; v++) {
      // The knot's top catches light, its underside settles — a berry is
      // a tiny sphere and reads by its own value turn.
      const tone = 0.78 + Math.min(1, Math.max(0, (position.getY(v) - rise + size) / (size * 2))) * 0.22;
      colors[v * 3] = accentRatio[0] * tone;
      colors[v * 3 + 1] = accentRatio[1] * tone;
      colors[v * 3 + 2] = accentRatio[2] * tone;
    }
    bud.setAttribute("color", new BufferAttribute(colors, 3));
    buds.push(bud);
  }
  const merged = mergeGeometries(buds, false);
  for (const bud of buds) {
    bud.dispose();
  }
  if (!merged) {
    throw new Error("bushBank: berry knots could not be merged");
  }
  return merged;
}
