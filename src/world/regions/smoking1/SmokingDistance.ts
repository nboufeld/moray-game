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
import { smoothstep01 } from "./SmokingShared";
import { CENTER_X, CENTER_Z, SMOKING_SLOT } from "./SmokingTerrain";

/**
 * The Smoulder Fields' painted distance: the `DistantReef` idiom
 * re-authored in charcoal-and-amber layers. Where the pilot's silhouettes
 * are forest skylines, these are *volcanic* ones: low broken ridge lines
 * (rings carry only horizontals — the pilot measured every in-ring
 * vertical rendering as a mountain), and the verticals are their own
 * instanced silhouette cards: distant smoker columns, each a thin
 * tapering stack with a smudged plume leaning off its crown.
 *
 * The inks re-derive from `scene.fog` per frame (one hex compare): this
 * region's fog is the def's own warm charcoal-amber and the mood hook
 * writes it, so a distance mixed from anything else would detach from
 * the water the moment the mood moved. Red is held above green in the
 * ink, so the far country reads violet-warm, never murk.
 *
 * The rings hold an open gap over the gorge's azimuth: the gorge's own
 * walls close that view.
 */

interface RidgeLayer {
  readonly radius: number;
  readonly ridgeBase: number;
  readonly ridgeVary: number;
  readonly fade: number;
}

const LAYERS: readonly RidgeLayer[] = [
  { radius: 246, ridgeBase: 6, ridgeVary: 2.4, fade: 0.42 },
  { radius: 264, ridgeBase: 9, ridgeVary: 3.2, fade: 0.6 },
  { radius: 286, ridgeBase: 13, ridgeVary: 4.2, fade: 0.76 },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the shelf can show. */
const FOOT = -12;

/** Charcoal-amber ink: red above green, violet in the cut. */
const INK = new Color(0.66, 0.55, 0.62);

/** Half-angle of the gap the rings leave over the gorge's approach. */
const GAP_HALF = 0.42;

export function buildSmokingDistance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionSmoking1 ^ 0xd159);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const materials: MeshBasicMaterial[] = [];
  const cardMaterials: { material: MeshBasicMaterial; fade: number }[] = [];
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
    const ink = fog.color.clone().multiply(INK);
    for (const [index, layer] of LAYERS.entries()) {
      materials[index]?.color.copy(ink).lerp(fog.color, layer.fade);
    }
    for (const { material, fade } of cardMaterials) {
      material.color.copy(ink).lerp(fog.color, fade);
    }
  };

  for (const [index, layer] of LAYERS.entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x8a6a58).lerp(new Color(0x8a6a58).multiply(INK), 1 - layer.fade),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    const geometry = ridgeRing(layer, SEEDS.regionSmoking1 ^ (0xd300 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `smoulder-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The standing smokers of the far country: instanced silhouette cards
  // in two ink bands, crossed blades so they read from every azimuth.
  // Taller than round 4's: a 20 m card at 250 m read as a shrub — the
  // far country's smokers are giants or they are nothing.
  for (const [band, spec] of [
    { rFrom: 242, rTo: 256, count: 22, fade: 0.46, hMin: 26, hMax: 42 },
    { rFrom: 262, rTo: 282, count: 16, fade: 0.68, hMin: 32, hMax: 50 },
  ].entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x6a5450),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    cardMaterials.push({ material, fade: spec.fade });
    const mesh = new InstancedMesh(chimneyCardGeometry(), material, spec.count);
    mesh.name = `smoulder-distance-smokers-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    const gapAt = SMOKING_SLOT.azimuth + Math.PI;
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = random.range(0, Math.PI * 2);
      // A wide margin off the gap: a lone card on the taper's shoulder
      // read as a palm tree on a rooftop in rounds 1–4.
      if (angleBetween(theta, gapAt) < GAP_HALF + 0.5) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      dummy.position.set(CENTER_X + Math.cos(theta) * r, FOOT + 2, CENTER_Z + Math.sin(theta) * r);
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.04));
      dummy.scale.set(
        random.range(1.3, 2.0),
        random.range(spec.hMin, spec.hMax) / CARD_HEIGHT,
        random.range(1.3, 2.0),
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
 * One distant smoker: two crossed silhouette blades — a thin tapering
 * stack with a slight shoulder, and a plume smudge leaning off the crown
 * in two soft lumps. Drawn to the proportions the near smokers actually
 * have, per the pilot's round-7 lesson: measure the real thing, then
 * silhouette it.
 */
let chimneyCard: BufferGeometry | undefined;
function chimneyCardGeometry(): BufferGeometry {
  if (chimneyCard) {
    return chimneyCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = CARD_HEIGHT;
    // Redrawn in round 6: the round-5 cut put a symmetric lump either
    // side of the crown and every card on the horizon read as a
    // telephone-pole cross. The stack is wider, and the plume is one
    // drifting smudge leaning off to +x — smoke has a wind side.
    const positions = new Float32Array([
      // The stack: a broad foot flare and two leaning segments.
      -3.4, 0, 0, 3.4, 0, 0, 1.8, h * 0.18, 0,
      -3.4, 0, 0, 1.8, h * 0.18, 0, -1.8, h * 0.2, 0,
      -1.8, h * 0.2, 0, 1.8, h * 0.18, 0, 1.3, h * 0.6, 0,
      -1.8, h * 0.2, 0, 1.3, h * 0.6, 0, -1.2, h * 0.62, 0,
      -1.2, h * 0.62, 0, 1.3, h * 0.6, 0, 0.95, h * 0.92, 0,
      -1.2, h * 0.62, 0, 0.95, h * 0.92, 0, -0.8, h * 0.93, 0,
      // The crown lip.
      -1.2, h * 0.9, 0, 1.3, h * 0.89, 0, 0.1, h * 1.0, 0,
      // The plume: one smudge drifting off to the same side, twice.
      -0.5, h * 0.97, 0, 1.5, h * 0.98, 0, 1.0, h * 1.1, 0,
      -0.5, h * 0.97, 0, 1.0, h * 1.1, 0, -0.1, h * 1.06, 0,
      0.4, h * 1.05, 0, 2.9, h * 1.12, 0, 2.0, h * 1.2, 0,
      0.4, h * 1.05, 0, 2.0, h * 1.2, 0, 0.6, h * 1.13, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("smoulder distance card blades could not be merged");
  }
  merged.computeBoundingSphere();
  chimneyCard = merged;
  return chimneyCard;
}

/**
 * One ring: a curtain whose top edge is a broken ridge line. The gorge's
 * azimuth sector is skipped — the ring is an open arc whose cut ends
 * sink into the ground.
 */
function ridgeRing(layer: RidgeLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapAt = SMOKING_SLOT.azimuth + Math.PI;
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    if (off < GAP_HALF) {
      column = 0;
      continue;
    }
    // A long taper: rounds 2–4's shorter ramps stood at the gap's edge
    // as flat-topped blocks that read as buildings.
    const end = smoothstep01((off - GAP_HALF) / 0.55);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    // A volcanic ridge line: broken benches rather than rolling canopy.
    // Round 2: the hard Math.round quantisation drew literal boxes on
    // the horizon — the bench is now a soft tread (smoothstepped riser)
    // over a rolling base, so the skyline carries flats without corners.
    const raw =
      fbm(t * 8, layer.radius * 0.01, { seed: noiseSeed, period: 8, octaves: 3 }) - 0.5;
    const bench = raw * 3 - Math.floor(raw * 3);
    const stepped = (Math.floor(raw * 3) + smoothstep01((bench - 0.5) / 0.5)) / 3;
    const ridge = layer.ridgeBase + (stepped * 0.55 + raw * 0.45) * 2 * layer.ridgeVary;

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
