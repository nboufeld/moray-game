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
import {
  SoftRingBuilder,
  applyCurtainDissolve,
  endAlpha,
  softCurtainMaterial,
} from "../kit/HorizonCurtain";
import { smoothstep01 } from "./CalamityShared";
import { CALAMITY_SLOT, CENTER_X, CENTER_Z } from "./CalamityTerrain";

/**
 * The Sunken Calamity's painted distance: the `DistantReef` idiom
 * re-authored as a *broken* skyline, standing in rings past the Quiet Rim.
 *
 * Where the pilot's silhouettes were a forest's canopy line, these are a
 * dead country's horizon: low jagged ruin ridges snapped and heaved, with
 * the rings carrying only the horizontals (the pilot's hard-won rule: an
 * in-ring vertical narrower than a ring segment simply vanishes, and a
 * wide one scales into a mountain) and the *cards* carrying every
 * vertical — leaning broken monoliths and dead giant stipes, instanced
 * crossed silhouettes in two distance bands.
 *
 * The inks re-derive from `scene.fog` per frame (one hex compare), mixed
 * from the region's own ash-water, red held above green's cut so the far
 * ruin reads grey-violet, never electric, never black. The rings hold an
 * open gap over the march's azimuth: the march's own banks close that
 * view, and a curtain crossing the approach would put a wall where the
 * diver swims in.
 */

interface RuinLayer {
  readonly radius: number;
  readonly ridgeBase: number;
  readonly ridgeVary: number;
  readonly fade: number;
}

const LAYERS: readonly RuinLayer[] = [
  { radius: 246, ridgeBase: 6, ridgeVary: 2.4, fade: 0.4 },
  { radius: 264, ridgeBase: 9, ridgeVary: 3.0, fade: 0.58 },
  { radius: 286, ridgeBase: 12, ridgeVary: 3.6, fade: 0.74 },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the shelf can show. */
const FOOT = -12;

/** Grey-violet ink: the fog colour taken down with red above green's cut. */
const INK = new Color(0.6, 0.56, 0.72);

/** Half-angle of the gap the rings leave over the march's approach. */
const GAP_HALF = 0.42;

export function buildCalamityDistance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionCalamity ^ 0xd157);
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
    // Critic F3 (the class fix): the two-row opaque strip drew this
    // skyline's fault steps as hard paper rectangles in the reveal and
    // last-grove frames. The ridge arithmetic below is untouched; the
    // strip is now the kit's soft three-row grammar — dissolved crest,
    // graded values, gap ends fading out instead of running as slivers.
    const material = softCurtainMaterial({
      color: new Color(0x6b7c84).lerp(new Color(0x6b7c84).multiply(INK), 1 - layer.fade),
    });
    applyCurtainDissolve(material, { cacheKey: "calamity-distance-dissolve" });
    const geometry = ruinRing(layer, SEEDS.regionCalamity ^ (0xd200 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `calamity-distance-${index}`;
    mesh.renderOrder = -(index + 3);
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The standing ruins: broken monoliths and dead giants as instanced
  // crossed silhouette cards, leaning every which way the blast left them,
  // in two distance bands that share the rings' ink.
  for (const [band, spec] of [
    { rFrom: 242, rTo: 256, count: 26, fade: 0.44, hMin: 16, hMax: 26 },
    { rFrom: 262, rTo: 282, count: 20, fade: 0.66, hMin: 20, hMax: 32 },
  ].entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x5c6874),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    cardMaterials.push({ material, fade: spec.fade });
    const mesh = new InstancedMesh(ruinCardGeometry(), material, spec.count);
    mesh.name = `calamity-distance-ruins-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    const gapAt = CALAMITY_SLOT.azimuth + Math.PI;
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = random.range(0, Math.PI * 2);
      if (angleBetween(theta, gapAt) < GAP_HALF + 0.1) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      dummy.position.set(CENTER_X + Math.cos(theta) * r, FOOT + 2, CENTER_Z + Math.sin(theta) * r);
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.22));
      dummy.scale.set(
        random.range(1.0, 1.6),
        random.range(spec.hMin, spec.hMax) / RUIN_CARD_HEIGHT,
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
const RUIN_CARD_HEIGHT = 20;

/**
 * One far ruin: two crossed silhouette blades — a leaning broken column
 * with a snapped top, a slab heaved on edge beside it. Never lit, never
 * fogged; the ink is the whole drawing.
 */
let ruinCard: BufferGeometry | undefined;
function ruinCardGeometry(): BufferGeometry {
  if (ruinCard) {
    return ruinCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = RUIN_CARD_HEIGHT;
    const positions = new Float32Array([
      // The broken column: a leaning shaft, snapped to a point.
      -1.1, 0, 0, 1.1, 0, 0, 1.7, h * 0.5, 0,
      -1.1, 0, 0, 1.7, h * 0.5, 0, -0.3, h * 0.52, 0,
      -0.3, h * 0.52, 0, 1.7, h * 0.5, 0, 0.6, h * 0.92, 0,
      // The heaved slab beside it, on edge.
      2.2, 0, 0, 4.6, 0.4, 0, 3.8, h * 0.62, 0,
      2.2, 0, 0, 3.8, h * 0.62, 0, 2.8, h * 0.66, 0,
      // A dead stipe's thin ghost on the other side.
      -3.4, 0, 0, -2.6, 0.2, 0, -3.2, h * 0.74, 0,
      -3.4, 0, 0, -3.2, h * 0.74, 0, -3.6, h * 0.72, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("calamity distance ruin blades could not be merged");
  }
  merged.computeBoundingSphere();
  ruinCard = merged;
  return ruinCard;
}

/**
 * One ring: a curtain whose top edge is a ruin skyline — a low ridge
 * line snapped and heaved into fault steps. The march's azimuth sector
 * is skipped: the ring is an open arc.
 */
function ruinRing(layer: RuinLayer, noiseSeed: number): BufferGeometry {
  const builder = new SoftRingBuilder();

  // The gap faces back down the spoke toward the origin, where the march
  // comes in: from the disc's centre that is the slot azimuth plus π.
  const gapAt = CALAMITY_SLOT.azimuth + Math.PI;
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    if (off < GAP_HALF) {
      builder.gap();
      continue;
    }
    // The arc's ends sink into the ground over a short run.
    const end = smoothstep01((off - GAP_HALF) / 0.14);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    // A skyline of two noises: the ridge's slow roll, and a ridged noise
    // (sharp side up) that breaks the roll into fault steps and snaps.
    const roll = fbm(t * 8, layer.radius * 0.01, { seed: noiseSeed, period: 8, octaves: 3 });
    const fault = 1 - Math.abs(
      fbm(t * 16, layer.radius * 0.02, { seed: noiseSeed ^ 0xfa17, period: 6, octaves: 2 }) - 0.5,
    ) * 2;
    const ridge =
      layer.ridgeBase +
      (roll - 0.5) * 2 * layer.ridgeVary +
      Math.pow(fault, 2.2) * layer.ridgeVary * 1.6;

    builder.column(x, z, FOOT, FOOT + Math.max(1.2, ridge - FOOT) * end + 0.2, {
      alpha: endAlpha(end),
    });
  }

  return builder.build();
}

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
