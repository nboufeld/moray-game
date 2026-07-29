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
  readonly fade: number;
}

const PRAIRIE_LAYERS: readonly HorizonLayer[] = [
  { radius: 240, base: 0.5, vary: 1.6, fade: 0.42 },
  { radius: 262, base: 2.6, vary: 2.0, fade: 0.6 },
  { radius: 288, base: 5.0, vary: 2.6, fade: 0.76 },
];
const PRAIRIE_FOOT = -9;

interface DeepStep {
  readonly radius: number;
  readonly top: number;
  readonly vary: number;
  readonly fade: number;
}

const DEEP_STEPS: readonly DeepStep[] = [
  { radius: 174, top: -38, vary: 1.4, fade: 0.28 },
  { radius: 190, top: -32.5, vary: 2.2, fade: 0.48 },
  { radius: 208, top: -27.5, vary: 3.0, fade: 0.66 },
];
const DEEP_FOOT = -50;

const SEGMENTS = 220;

/** Milky blue ink for the prairie horizon: barely a step off the fog. */
const PRAIRIE_INK = new Color(0.78, 0.84, 1.0);
/** Violet-blue ink for the deep steps: red above green, never black. */
const DEEP_INK = new Color(0.6, 0.52, 0.86);

/** Half-angle of the gap over the approach corridor. */
const GAP_APPROACH = 0.4;
/** Half-angle of the World's Edge sector, where the deep steps stand. */
const GAP_EDGE = 0.62;

export function buildBlue1Distance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionBlue1 ^ 0xd15b);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const entries: { material: MeshBasicMaterial; ink: Color; fade: number }[] = [];
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
    const mixed = new Color();
    for (const entry of entries) {
      mixed.copy(fog.color).multiply(entry.ink);
      entry.material.color.copy(mixed).lerp(fog.color, entry.fade);
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
    });
    entries.push({ material, ink: PRAIRIE_INK, fade: layer.fade });
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
    });
    entries.push({ material, ink: DEEP_INK, fade: step.fade });
    const geometry = deepArc(step, SEEDS.regionBlue1 ^ (0xd300 + index * 131), gapOutward);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `blue1-deep-step-${index}`;
    meshes.push(mesh);
  }

  // ── The distant monoliths: instanced silhouette cards in two bands. ──
  for (const [band, spec] of [
    { rFrom: 236, rTo: 252, count: 12, fade: 0.5, hMin: 11, hMax: 18 },
    { rFrom: 260, rTo: 282, count: 9, fade: 0.68, hMin: 15, hMax: 24 },
  ].entries()) {
    const material = new MeshBasicMaterial({
      color: 0x7d97b8,
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    entries.push({ material, ink: PRAIRIE_INK, fade: spec.fade });
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
      dummy.position.set(
        CENTER_X + Math.cos(theta) * r,
        PRAIRIE_FOOT + 3,
        CENTER_Z + Math.sin(theta) * r,
      );
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
    if (column > 0) {
      const a = positions.length / 3 - 4;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    column++;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/** One deep step: an arc across the World's Edge sector, top below the lip. */
function deepArc(step: DeepStep, noiseSeed: number, gapOutward: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const span = GAP_EDGE + 0.26;
  const count = 64;
  let column = 0;

  for (let i = 0; i <= count; i++) {
    const off = (i / count) * 2 - 1;
    const theta = gapOutward + off * span;
    // The arc's ends sink so its cut edges never stand as walls.
    const end = 1 - smoothstep01((Math.abs(off) - 0.72) / 0.24);
    const x = CENTER_X + Math.cos(theta) * step.radius;
    const z = CENTER_Z + Math.sin(theta) * step.radius;
    const ridge =
      step.top +
      (fbm(i * 0.11, step.radius * 0.017, { seed: noiseSeed, period: 7, octaves: 3 }) - 0.5) *
        2 *
        step.vary;
    positions.push(x, DEEP_FOOT, z, x, DEEP_FOOT + Math.max(1.5, ridge - DEEP_FOOT) * end, z);
    if (column > 0) {
      const a = positions.length / 3 - 4;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    column++;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
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
