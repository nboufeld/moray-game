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
import { smoothstep01 } from "./GoldenShared";
import { CENTER_X, CENTER_Z, GOLDEN_SLOT } from "./GoldenTerrain";

/**
 * The Hourglass Sea's painted distance: the `DistantReef` idiom
 * re-authored as stacked dune lines — gold near, violet far. Where the
 * pilots' silhouettes were forests and volcano fields, these are dune
 * seas: each ring's top edge is a slow swell of crescent-backed ridges
 * (only horizontals — every in-ring vertical the pilots tried rendered
 * as a mountain), and the verticals are their own sparse instanced
 * cards: far greater monoliths of the deeper waste, bare tapering
 * standing stones — the one silhouette that is honest for a monolith.
 *
 * The inks re-derive from `scene.fog` per frame (one hex compare), and
 * each layer carries its own ink so the stack runs gold → violet with
 * red above green throughout. The rings hold an open gap over the
 * saddle's azimuth: the approach's own dune walls close that view.
 */

interface DuneLayer {
  readonly radius: number;
  readonly ridgeBase: number;
  readonly ridgeVary: number;
  readonly fade: number;
  readonly ink: Color;
}

const LAYERS: readonly DuneLayer[] = [
  // Gold near…
  { radius: 246, ridgeBase: 5, ridgeVary: 2.6, fade: 0.42, ink: new Color(0.88, 0.74, 0.5) },
  { radius: 264, ridgeBase: 8, ridgeVary: 3.4, fade: 0.6, ink: new Color(0.76, 0.62, 0.6) },
  // …violet far.
  { radius: 286, ridgeBase: 12, ridgeVary: 4.4, fade: 0.74, ink: new Color(0.66, 0.52, 0.68) },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the shelf can show. */
const FOOT = -12;

/** Half-angle of the gap the rings leave over the saddle's approach. */
const GAP_HALF = 0.42;

export function buildGoldenDistance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionGolden1 ^ 0xd15b);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const materials: MeshBasicMaterial[] = [];
  const cardMaterials: { material: MeshBasicMaterial; fade: number; ink: Color }[] = [];
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
    for (const [index, layer] of LAYERS.entries()) {
      const ink = fog.color.clone().multiply(layer.ink);
      materials[index]?.color.copy(ink).lerp(fog.color, layer.fade);
    }
    for (const { material, fade, ink } of cardMaterials) {
      material.color.copy(fog.color.clone().multiply(ink)).lerp(fog.color, fade);
    }
  };

  for (const [index, layer] of LAYERS.entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x9a8468).lerp(new Color(0x9a8468).multiply(layer.ink), 1 - layer.fade),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    const geometry = duneRing(layer, SEEDS.regionGolden1 ^ (0xd400 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `hourglass-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The far monoliths: sparse instanced silhouette cards in two ink
  // bands, crossed blades so they read from every azimuth. Standing
  // stones are the one shape whose honest silhouette IS a bare vertical
  // taper — the pilots' card lessons applied from the start.
  for (const [band, spec] of [
    { rFrom: 242, rTo: 256, count: 9, fade: 0.5, hMin: 14, hMax: 24, ink: new Color(0.7, 0.56, 0.64) },
    { rFrom: 262, rTo: 282, count: 7, fade: 0.68, hMin: 18, hMax: 30, ink: new Color(0.64, 0.5, 0.68) },
  ].entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x74605c),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    cardMaterials.push({ material, fade: spec.fade, ink: spec.ink });
    const mesh = new InstancedMesh(monolithCardGeometry(), material, spec.count);
    mesh.name = `hourglass-distance-monoliths-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    const gapAt = GOLDEN_SLOT.azimuth + Math.PI;
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = random.range(0, Math.PI * 2);
      // A wide margin off the gap: a lone card on the taper's shoulder
      // reads as a rooftop ornament (the pilots' lesson).
      if (angleBetween(theta, gapAt) < GAP_HALF + 0.5) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      dummy.position.set(CENTER_X + Math.cos(theta) * r, FOOT + 2, CENTER_Z + Math.sin(theta) * r);
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.05));
      dummy.scale.set(
        random.range(1.2, 1.9),
        random.range(spec.hMin, spec.hMax) / CARD_HEIGHT,
        random.range(1.2, 1.9),
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
const CARD_HEIGHT = 20;

/**
 * One far monolith: two crossed silhouette blades — a broad foot, one
 * leaning waist, a narrow crown. Measured off the near monoliths'
 * proportions (foot ~2.7:1 height, slight lean) then simplified.
 */
let monolithCard: BufferGeometry | undefined;
function monolithCardGeometry(): BufferGeometry {
  if (monolithCard) {
    return monolithCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = CARD_HEIGHT;
    const positions = new Float32Array([
      -2.6, 0, 0, 2.6, 0, 0, 1.9, h * 0.3, 0,
      -2.6, 0, 0, 1.9, h * 0.3, 0, -1.7, h * 0.32, 0,
      -1.7, h * 0.32, 0, 1.9, h * 0.3, 0, 1.35, h * 0.7, 0,
      -1.7, h * 0.32, 0, 1.35, h * 0.7, 0, -1.05, h * 0.72, 0,
      -1.05, h * 0.72, 0, 1.35, h * 0.7, 0, 0.8, h * 1.0, 0,
      -1.05, h * 0.72, 0, 0.8, h * 1.0, 0, 0.05, h * 0.97, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("hourglass distance card blades could not be merged");
  }
  merged.computeBoundingSphere();
  monolithCard = merged;
  return monolithCard;
}

/**
 * One ring: a curtain whose top edge is a slow dune swell — crescent
 * backs drawn as a rolling line with softly peaked crests, no benches
 * and no verticals. The saddle's azimuth sector is skipped; the cut
 * ends taper long into the ground (short ramps read as buildings).
 */
function duneRing(layer: DuneLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapAt = GOLDEN_SLOT.azimuth + Math.PI;
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    if (off < GAP_HALF) {
      column = 0;
      continue;
    }
    const end = smoothstep01((off - GAP_HALF) / 0.55);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    // A dune skyline: a slow rolling swell whose crests are gently
    // sharpened (1 − |…|^1.5 turns a sine's round top into a dune back)
    // over a long drifting base.
    const roll = fbm(t * 6, layer.radius * 0.013, { seed: noiseSeed, period: 6, octaves: 2 }) - 0.5;
    const crest = Math.pow(
      Math.abs(Math.sin(t * Math.PI * 14 + roll * 6)),
      1.5,
    );
    const ridge = layer.ridgeBase + (roll * 1.1 + crest * 0.9) * layer.ridgeVary;

    positions.push(x, FOOT, z, x, FOOT + Math.max(1.4, ridge - FOOT) * end + 0.2, z);
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

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
