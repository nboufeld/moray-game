import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  type Scene,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { smoothstep01 } from "./Blue1Shared";
import { BLUE1_SLOT, CENTER_X, CENTER_Z } from "./Blue1Terrain";

/**
 * The Drop Plains' painted distance — the `DistantReef` idiom re-authored
 * twice, because this region has two horizons:
 *
 * - **The prairie horizon** (three rings + monolith cards): low rolling
 *   swell-lines in milky blue standing past the rim's rise, pierced by
 *   sparse standing-stone silhouettes — the steppe going on forever. The
 *   rings hold gaps over the approach (the slope's own shoulders close
 *   that view) and over the World's Edge sector, where the second horizon
 *   takes over.
 * - **The deep steps** (three low arcs): the Friedrich distance below and
 *   beyond the drop — layered violet-blue ridges whose tops all sit below
 *   the overlook's eye line, each further arc a step paler, so the void
 *   ends in painted depth and never in bare fog.
 *
 * Every ink is re-derived from `scene.fog` per frame (one hex compare),
 * red held above green in the violet steps per the value key.
 */

interface HorizonLayer {
  readonly radius: number;
  readonly base: number;
  readonly vary: number;
  readonly ink: Color;
}

// Raised in round 2: the round-1 tops (0.5–5) barely cleared the rim's own
// dune-level ground and the rings read as thin water-lines, not swells.
// Round 5 measured the bands +20 of blue over the water they stand in and
// dead flat; every layer now carries its own authored ink (nearest a step
// darker-warmer, furthest nearly the water) instead of one ink lerped
// toward a fog that is intrinsically bluer than the backdrop behind it.
const PRAIRIE_LAYERS: readonly HorizonLayer[] = [
  { radius: 240, base: 3.2, vary: 2.4, ink: new Color(0.94, 0.86, 0.82) },
  { radius: 262, base: 6.5, vary: 3.0, ink: new Color(0.96, 0.9, 0.86) },
  { radius: 288, base: 10.0, vary: 3.8, ink: new Color(0.98, 0.94, 0.9) },
];
// Round 5: −9 floated five metres ABOVE the steppe floor, and the rings'
// straight bottom edges hung in the fog as flat wedges wherever the rim's
// rise dipped. The feet now tuck below the ground everywhere visible.
const PRAIRIE_FOOT = -20;

interface DeepStep {
  readonly radius: number;
  readonly top: number;
  readonly vary: number;
  readonly ink: Color;
}

// Round 4 (the fill-plan audit's "canyon-curtain gradient" fix): a fourth,
// palest arc so the void ends in four planes; `vary` halved and the
// columns more than doubled so the tops stop reading as sawtooth teeth.
// Round 5 re-derived the inks against the measured frame: the arcs render
// as fog × ink, and even with red held high the old fade-lerp back toward
// the fog re-supplied the blue it had just cut (bands measured blue 190
// against water at 151). Authored per arc, no fade: the nearest arc is the
// darkest violet, each further arc a step paler and warmer until the last
// all but dissolves into the water — red above green in every ink.
const DEEP_STEPS: readonly DeepStep[] = [
  { radius: 174, top: -38, vary: 0.7, ink: new Color(0.92, 0.4, 0.44) },
  { radius: 190, top: -32.5, vary: 1.1, ink: new Color(0.94, 0.46, 0.5) },
  { radius: 208, top: -27.5, vary: 1.5, ink: new Color(0.96, 0.54, 0.58) },
  { radius: 224, top: -23.5, vary: 1.9, ink: new Color(1.0, 0.64, 0.68) },
];
const DEEP_FOOT = -50;

const SEGMENTS = 220;

/** The monolith cards' inks: a step deeper than the rings they pierce. */
const CARD_INKS: readonly Color[] = [new Color(0.9, 0.8, 0.78), new Color(0.94, 0.86, 0.84)];

// The vertical grade every distance plane carries (the canyon-curtain
// lesson): a curtain seen from below fills the upper frame, and one flat
// value reads as paper. Feet sink toward the shadow violet, crowns pale
// toward the light. Baked as vertex colours; the materials multiply.
const DEEP_FOOT_TINT: readonly [number, number, number] = [0.58, 0.56, 0.66];
const DEEP_CROWN_TINT: readonly [number, number, number] = [1.1, 1.05, 1.0];
const PRAIRIE_FOOT_TINT: readonly [number, number, number] = [0.72, 0.72, 0.78];
const PRAIRIE_CROWN_TINT: readonly [number, number, number] = [1.06, 1.04, 1.0];

/** Half-angle of the gap over the approach corridor. */
const GAP_APPROACH = 0.4;
/** Half-angle of the World's Edge sector, where the deep steps stand. */
const GAP_EDGE = 0.62;

export function buildBlue1Distance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionBlue1 ^ 0xd15b);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const entries: { material: MeshBasicMaterial; ink: Color }[] = [];
  let lastFog = -1;

  const followFog = (scene: Scene): void => {
    const fog = scene.fog;
    if (!(fog instanceof FogExp2)) {
      return;
    }
    const hex = fog.color.getHex();
    if (hex === lastFog) {
      return;
    }
    lastFog = hex;
    for (const entry of entries) {
      entry.material.color.copy(fog.color).multiply(entry.ink);
    }
  };

  const gapToOrigin = BLUE1_SLOT.azimuth + Math.PI;
  const gapOutward = BLUE1_SLOT.azimuth;

  // ── The prairie horizon rings. ──
  for (const [index, layer] of PRAIRIE_LAYERS.entries()) {
    const material = new MeshBasicMaterial({
      color: 0x9fc4d8,
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
    });
    entries.push({ material, ink: layer.ink });
    const geometry = horizonRing(
      layer,
      SEEDS.regionBlue1 ^ (0xd200 + index * 131),
      (theta) =>
        angleBetween(theta, gapToOrigin) < GAP_APPROACH ||
        angleBetween(theta, gapOutward) < GAP_EDGE,
    );
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `blue1-horizon-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
  }

  // ── The deep steps over the World's Edge. ──
  for (const [index, step] of DEEP_STEPS.entries()) {
    const material = new MeshBasicMaterial({
      color: 0x33406e,
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
    });
    entries.push({ material, ink: step.ink });
    const geometry = deepArc(step, SEEDS.regionBlue1 ^ (0xd300 + index * 131), gapOutward);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `blue1-deep-step-${index}`;
    meshes.push(mesh);
  }

  // ── The distant monoliths: instanced silhouette cards in two bands. ──
  for (const [band, spec] of [
    { rFrom: 236, rTo: 252, count: 12, hMin: 11, hMax: 18 },
    { rFrom: 260, rTo: 282, count: 9, hMin: 15, hMax: 24 },
  ].entries()) {
    const material = new MeshBasicMaterial({
      color: 0x7d97b8,
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
    });
    entries.push({ material, ink: CARD_INKS[band]! });
    const mesh = new InstancedMesh(monolithCardGeometry(), material, spec.count);
    mesh.name = `blue1-distance-monoliths-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = random.range(0, Math.PI * 2);
      if (
        angleBetween(theta, gapToOrigin) < GAP_APPROACH + 0.12 ||
        angleBetween(theta, gapOutward) < GAP_EDGE + 0.08
      ) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      // The cards keep their own base (−6): they stand on the rim's rise,
      // not on the rings' dropped foot line.
      dummy.position.set(CENTER_X + Math.cos(theta) * r, -6, CENTER_Z + Math.sin(theta) * r);
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.05));
      dummy.scale.set(
        random.range(1.0, 1.6),
        random.range(spec.hMin, spec.hMax) / CARD_HEIGHT,
        random.range(1.0, 1.6),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }

  return { meshes };
}

/** The card's authored height; instances scale it to their drawn height. */
const CARD_HEIGHT = 16;

/**
 * One distant standing stone: two crossed tapering blades with a slight
 * lean and a blunt crown — drawn to the megaliths' own proportions so
 * the horizon promises more of exactly what the field delivers.
 */
let monolithCard: BufferGeometry | undefined;
function monolithCardGeometry(): BufferGeometry {
  if (monolithCard) {
    return monolithCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = CARD_HEIGHT;
    const positions = new Float32Array([
      // The shaft, leaning gently as it rises.
      -1.5, 0, 0, 1.5, 0, 0, 1.7, h * 0.55, 0,
      -1.5, 0, 0, 1.7, h * 0.55, 0, -0.9, h * 0.57, 0,
      // The upper stone, narrowing to a blunt crown.
      -0.9, h * 0.57, 0, 1.7, h * 0.55, 0, 1.2, h * 0.92, 0,
      -0.9, h * 0.57, 0, 1.2, h * 0.92, 0, -0.3, h * 0.93, 0,
      -0.3, h * 0.93, 0, 1.2, h * 0.92, 0, 0.5, h, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("blue1 monolith card blades could not be merged");
  }
  // The same vertical grade the rings carry, so a card is never one value.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = smoothstep01(position.getY(i) / CARD_HEIGHT);
    colors[i * 3] = 0.78 + t * 0.28;
    colors[i * 3 + 1] = 0.78 + t * 0.26;
    colors[i * 3 + 2] = 0.82 + t * 0.18;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  monolithCard = merged;
  return monolithCard;
}

/** One prairie ring: a curtain whose top edge is a rolling swell-line. */
function horizonRing(
  layer: HorizonLayer,
  noiseSeed: number,
  inGap: (theta: number) => boolean,
): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let column = 0;

  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    if (inGap(theta)) {
      column = 0;
      continue;
    }
    const end = endEase(theta, inGap);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;
    const t = i / SEGMENTS;
    const crest =
      layer.base +
      (fbm(t * 6, layer.radius * 0.013, { seed: noiseSeed, period: 6, octaves: 3 }) - 0.5) *
        2 *
        layer.vary;
    positions.push(
      x,
      PRAIRIE_FOOT,
      z,
      x,
      PRAIRIE_FOOT + Math.max(1.2, crest - PRAIRIE_FOOT) * end + 0.2,
      z,
    );
    colors.push(...PRAIRIE_FOOT_TINT, ...PRAIRIE_CROWN_TINT);
    if (column > 0) {
      const a = positions.length / 3 - 4;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    column++;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** One deep step: an arc across the World's Edge sector, top below the lip. */
function deepArc(step: DeepStep, noiseSeed: number, gapOutward: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const span = GAP_EDGE + 0.26;
  // Round 4: 64 columns put ~6 m of arc in each quad and the per-column
  // noise rendered as regular sawtooth teeth; at 160 the ridge is a line.
  const count = 160;
  let column = 0;

  for (let i = 0; i <= count; i++) {
    const off = (i / count) * 2 - 1;
    const theta = gapOutward + off * span;
    // The arc's ends sink so its cut edges never stand as walls.
    const end = 1 - smoothstep01((Math.abs(off) - 0.72) / 0.24);
    const x = CENTER_X + Math.cos(theta) * step.radius;
    const z = CENTER_Z + Math.sin(theta) * step.radius;
    // A broad drooping swell carries the skyline; the fine ripple only
    // roughens it — a ridge runs a long way before it turns.
    const broad =
      fbm((i / count) * 2.3 + 0.4, step.radius * 0.011, {
        seed: noiseSeed,
        period: 3,
        octaves: 2,
      }) - 0.5;
    const fine =
      fbm(i * 0.11, step.radius * 0.017, { seed: noiseSeed ^ 0x5a5a, period: 7, octaves: 3 }) -
      0.5;
    const ridge = step.top + broad * 2 * step.vary + fine * 0.5 * step.vary;
    positions.push(x, DEEP_FOOT, z, x, DEEP_FOOT + Math.max(1.5, ridge - DEEP_FOOT) * end, z);
    colors.push(...DEEP_FOOT_TINT, ...DEEP_CROWN_TINT);
    if (column > 0) {
      const a = positions.length / 3 - 4;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    column++;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Eases an arc's height near a gap edge so ends never cut vertically. */
function endEase(theta: number, inGap: (theta: number) => boolean): number {
  for (const probe of [0.05, 0.1, 0.15]) {
    if (inGap(theta - probe) || inGap(theta + probe)) {
      return smoothstep01(probe / 0.15);
    }
  }
  return 1;
}

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
