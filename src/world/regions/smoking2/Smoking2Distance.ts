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
import { FC_SEEDS, smoothstep01 } from "./Smoking2Shared";
import { CENTER_X, CENTER_Z, SMOKING2_SLOT } from "./Smoking2Terrain";

/**
 * The Forge Combs' painted distance: the `DistantReef` idiom in this
 * region's own hand. Where the Smoulder's horizon was ridge lines and
 * smoker spires, this one is WALLS — long flat-topped comb silhouettes
 * with vertical notch cuts, rank behind rank, like the galleries of a
 * drowned forge going on forever — and the verticals are their own
 * instanced cards: lone standing fins, narrow and broken-crested.
 *
 * The inks re-derive from `scene.fog` per frame (one hex compare), so the
 * far country never detaches from the mood hook's water. Red is held
 * above green in the ink: the distance reads violet-warm, never murk.
 *
 * The rings hold TWO gaps (MASTER R4 — distance rings part over pass
 * corridors on both sides): a wide one over the inbound saddle (the
 * Smoulder side), and a narrower one at the far pole over the Night
 * Door's reserved depth-3 corridor, so the door frames real distance
 * instead of a painted curtain.
 */

interface WallLayer {
  readonly radius: number;
  readonly wallBase: number;
  readonly wallVary: number;
  readonly fade: number;
}

// R2: fades up — r1's nearest rank read as a maroon paper band against
// the backdrop; the walls must sit IN the fog's own rose, a value apart.
const LAYERS: readonly WallLayer[] = [
  { radius: 246, wallBase: 8, wallVary: 2.6, fade: 0.52 },
  { radius: 264, wallBase: 11, wallVary: 3.4, fade: 0.68 },
  { radius: 286, wallBase: 15, wallVary: 4.4, fade: 0.8 },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the country can show. */
const FOOT = -26;

/** Iron-amber ink: red above green, violet in the cut. */
const INK = new Color(0.72, 0.6, 0.68);

/** Half-angle of the gap the rings leave over the saddle's approach. */
const GAP_HALF = 0.42;
/**
 * Half-angle of the far-pole gap, over the Night Door's reserved
 * depth-3 corridor — sized to a future pass tongue's width at these
 * radii (half-width ~16–24 m → atan ≈ 0.07–0.1 rad) plus edge-fade
 * margin, the Emerald Gate lesson pre-paid.
 */
const GAP_OUT_HALF = 0.14;

export function buildSmoking2Distance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionSmoking2 ^ FC_SEEDS.distance);
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
      color: new Color(0x86685a).lerp(new Color(0x86685a).multiply(INK), 1 - layer.fade),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    const geometry = wallRing(layer, SEEDS.regionSmoking2 ^ (0xd400 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `forge-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The lone standing fins of the far country: instanced silhouette
  // cards in two ink bands, crossed blades so they read from every
  // azimuth — giants, or they are nothing.
  for (const [band, spec] of [
    { rFrom: 242, rTo: 256, count: 18, fade: 0.54, hMin: 24, hMax: 38 },
    { rFrom: 262, rTo: 282, count: 13, fade: 0.74, hMin: 30, hMax: 46 },
  ].entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x685250),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      // The crown crust rides the card's vertex colours — zero draws,
      // and every horizon carries one pale-top note over one ember seam.
      vertexColors: true,
    });
    cardMaterials.push({ material, fade: spec.fade });
    const mesh = new InstancedMesh(finCardGeometry(), material, spec.count);
    mesh.name = `forge-distance-fins-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    const gapAt = SMOKING2_SLOT.azimuth + Math.PI;
    const gapOutAt = SMOKING2_SLOT.azimuth;
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = random.range(0, Math.PI * 2);
      // Wide margins off both gaps: a lone card on a taper's shoulder
      // reads as a rooftop palm (the Smoulder's rounds 1–4 lesson).
      if (angleBetween(theta, gapAt) < GAP_HALF + 0.5) {
        continue;
      }
      if (angleBetween(theta, gapOutAt) < GAP_OUT_HALF + 0.4) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      dummy.position.set(CENTER_X + Math.cos(theta) * r, FOOT + 2, CENTER_Z + Math.sin(theta) * r);
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.05));
      dummy.scale.set(
        random.range(1.6, 2.6),
        random.range(spec.hMin, spec.hMax) / CARD_HEIGHT,
        random.range(1.6, 2.6),
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
 * One distant fin: two crossed silhouette blades — a long low wall
 * profile with a broken crest, rising to one shoulder — drawn to the
 * proportions the near combs actually have.
 */
let finCard: BufferGeometry | undefined;
function finCardGeometry(): BufferGeometry {
  if (finCard) {
    return finCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = CARD_HEIGHT;
    // A wall, not a spire: a broad foot, a long flat run stepping up to
    // a broken shoulder, and a notch cut into the crest line.
    const positions = new Float32Array([
      -6.5, 0, 0, 6.5, 0, 0, 6.0, h * 0.42, 0,
      -6.5, 0, 0, 6.0, h * 0.42, 0, -6.0, h * 0.5, 0,
      -6.0, h * 0.5, 0, 6.0, h * 0.42, 0, 2.4, h * 0.52, 0,
      -6.0, h * 0.5, 0, 2.4, h * 0.52, 0, -2.2, h * 0.62, 0,
      // The shoulder rise, west of the notch.
      -6.0, h * 0.5, 0, -2.2, h * 0.62, 0, -3.0, h * 0.86, 0,
      -6.0, h * 0.5, 0, -3.0, h * 0.86, 0, -5.2, h * 0.74, 0,
      // The east crest, lower, past the notch.
      2.4, h * 0.52, 0, 6.0, h * 0.42, 0, 5.0, h * 0.68, 0,
      2.4, h * 0.52, 0, 5.0, h * 0.68, 0, 3.2, h * 0.66, 0,
      // The shoulder's own tip, the tallest point.
      -3.0, h * 0.86, 0, -2.2, h * 0.62, 0, -1.8, h * 1.0, 0,
      -3.0, h * 0.86, 0, -1.8, h * 1.0, 0, -2.6, h * 0.96, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("forge distance card blades could not be merged");
  }
  // The crown crust: the top of the crest leans faintly pale-warm in
  // vertex colour, and the foot carries one ember seam note — the
  // region's whole value story on every horizon.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) / CARD_HEIGHT;
    const crest = Math.min(1, Math.max(0, (y - 0.62) / 0.3));
    const foot = Math.min(1, Math.max(0, (0.12 - y) / 0.12));
    colors[i * 3] = 1 + crest * 0.14 + foot * 0.1;
    colors[i * 3 + 1] = 1 + crest * 0.1 - foot * 0.02;
    colors[i * 3 + 2] = 1 + crest * 0.04 - foot * 0.08;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  finCard = merged;
  return finCard;
}

/**
 * One ring: a curtain whose top edge is a rank of flat wall runs broken
 * by notch cuts. Both pass sectors are skipped — the ring is an open arc
 * whose cut ends sink into the ground.
 */
function wallRing(layer: WallLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapAt = SMOKING2_SLOT.azimuth + Math.PI;
  const gapOutAt = SMOKING2_SLOT.azimuth;
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    const offOut = angleBetween(theta, gapOutAt);
    if (off < GAP_HALF || offOut < GAP_OUT_HALF) {
      column = 0;
      continue;
    }
    // Long tapers into both gaps, so the cut ends never read as towers.
    const end = Math.min(
      smoothstep01((off - GAP_HALF) / 0.55),
      smoothstep01((offOut - GAP_OUT_HALF) / 0.3),
    );
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    // The wall rank: long flat runs (quantised, soft-risered) with deep
    // notch cuts — a skyline of galleries, not hills.
    const raw = fbm(t * 9, layer.radius * 0.01, { seed: noiseSeed, period: 9, octaves: 3 }) - 0.5;
    const bench = raw * 2.4 - Math.floor(raw * 2.4);
    const stepped = (Math.floor(raw * 2.4) + smoothstep01((bench - 0.6) / 0.4)) / 2.4;
    // The notches: narrow cuts eating down into the runs.
    const notch = smoothstep01(
      (fbm(t * 34, 0.5, { seed: noiseSeed ^ 0x77, period: 17, octaves: 2 }) - 0.66) / 0.08,
    );
    const wall =
      layer.wallBase + (stepped * 0.7 + raw * 0.3) * 2 * layer.wallVary - notch * layer.wallBase * 0.55;

    positions.push(x, FOOT, z, x, FOOT + Math.max(1.4, wall - FOOT) * end + 0.2, z);
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
