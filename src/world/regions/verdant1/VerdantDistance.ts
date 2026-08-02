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
import { smoothstep01 } from "./VerdantShared";
import { CENTER_X, CENTER_Z, VERDANT_SLOT } from "./VerdantTerrain";

/**
 * The Great Kelp Sea's painted distance: the `DistantReef` idiom
 * re-authored in greens, standing in rings just past the Falling Edge.
 *
 * Where the bowl's silhouettes are reef skylines, these are *forest*
 * skylines: an undulating canopy line pierced by tall, narrow trunk spikes
 * with swollen crown heads, so every vista off the disc's rim ends in more
 * kelp sea — the deeper province this region promises — rather than bare
 * fog. Three rings, dark near, milky far.
 *
 * The inks are re-derived from `scene.fog` per frame (one hex compare),
 * because in this region the fog itself is the def's deep living green —
 * the mood hook writes it — and a distance mixed from anything else would
 * detach from the water the moment the weather or the mood moved. Red is
 * held above green's cut in the ink so the far forest reads violet-green,
 * never electric.
 *
 * The rings hold two open gaps. Over the vale's azimuth: the vale's own
 * walls close that view, and a curtain crossing the approach would put a
 * wall where the diver swims in. And over the far pole (MASTER R4, this
 * package's first item): the outermost rings cross the depth-2 pass at
 * u ≈ 691–733 as an opaque curtain — verdant-2's ledger flag, proven by
 * probe — so the rings part over the pass corridor and the trunk cards
 * stay out of that sector. The only two-region journey ends milky-bright
 * and OPEN, the way the Falling Edge promises.
 */

interface ForestLayer {
  readonly radius: number;
  readonly canopyBase: number;
  readonly canopyVary: number;
  readonly trunks: number;
  readonly trunkHeight: number;
  readonly fade: number;
}

const LAYERS: readonly ForestLayer[] = [
  // A near-flat canopy line, and nothing else: every in-ring "trunk" ever
  // tried rendered as a mountain (a ring feature is metres wide before it
  // can exist at all), so the rings carry the horizontals and the
  // instanced silhouette cards below carry every vertical.
  { radius: 246, canopyBase: 7, canopyVary: 1.8, trunks: 0, trunkHeight: 0, fade: 0.4 },
  { radius: 264, canopyBase: 10, canopyVary: 2.2, trunks: 0, trunkHeight: 0, fade: 0.58 },
  { radius: 286, canopyBase: 13, canopyVary: 2.8, trunks: 0, trunkHeight: 0, fade: 0.74 },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the shelf can show. */
const FOOT = -12;

/** Green-violet ink: the fog colour taken down with red above green's cut. */
const INK = new Color(0.62, 0.72, 0.58);

/** Half-angle of the gap the rings leave over the vale's approach. */
const GAP_HALF = 0.42;

/**
 * Half-angle of the far-pole gap over the depth-2 pass (MASTER R4). The
 * rim ring's collider gate is |v| < 14 at rc 206; 0.2 rad at the ring
 * radii is ±49–57 m — the corridor's spine cleared with real margin, and
 * narrow enough that the painted forest still wraps the rest of the rim.
 */
export const PASS_GAP_HALF = 0.2;

export function buildVerdantDistance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionVerdant1 ^ 0xd157);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const materials: MeshBasicMaterial[] = [];
  const trunkMaterials: { material: MeshBasicMaterial; fade: number }[] = [];
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
    for (const { material, fade } of trunkMaterials) {
      material.color.copy(ink).lerp(fog.color, fade);
    }
  };

  for (const [index, layer] of LAYERS.entries()) {
    // Critic F3 (the class fix): soft three-row curtain, dissolved
    // crest, gap ends fading out, far-clip self-dissolve.
    const material = softCurtainMaterial({
      color: new Color(0x53b2bb).lerp(new Color(0x53b2bb).multiply(INK), 1 - layer.fade),
    });
    applyCurtainDissolve(material, { cacheKey: "verdant-distance-dissolve" });
    const geometry = forestRing(layer, random, SEEDS.regionVerdant1 ^ (0xd200 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `verdant-distance-${index}`;
    mesh.renderOrder = -(index + 3);
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The standing trunks. A 3–5 m kelp trunk at 250 m is narrower than a
  // ring segment and simply vanishes between vertices (measured twice), so
  // the distant giants are their own instanced silhouettes: crossed
  // tapered cards with crown blobs, standing on the rings' own radii in
  // two distance bands that share the rings' ink.
  for (const [band, spec] of [
    { rFrom: 242, rTo: 256, count: 30, fade: 0.44, hMin: 24, hMax: 34 },
    { rFrom: 262, rTo: 282, count: 22, fade: 0.66, hMin: 28, hMax: 40 },
  ].entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x3f8f7a),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    trunkMaterials.push({ material, fade: spec.fade });
    const mesh = new InstancedMesh(trunkCardGeometry(), material, spec.count);
    mesh.name = `verdant-distance-trunks-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    const gapAt = VERDANT_SLOT.azimuth + Math.PI;
    const passAt = VERDANT_SLOT.azimuth;
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = random.range(0, Math.PI * 2);
      if (angleBetween(theta, gapAt) < GAP_HALF + 0.1) {
        continue;
      }
      // MASTER R4: no card may curtain the depth-2 pass corridor either.
      if (angleBetween(theta, passAt) < PASS_GAP_HALF + 0.1) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      dummy.position.set(CENTER_X + Math.cos(theta) * r, FOOT + 2, CENTER_Z + Math.sin(theta) * r);
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.06));
      dummy.scale.set(
        random.range(1.0, 1.5),
        random.range(spec.hMin, spec.hMax) / TRUNK_CARD_HEIGHT,
        random.range(1.0, 1.5),
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
const TRUNK_CARD_HEIGHT = 20;

/**
 * One distant giant: two crossed silhouette blades — a tapering stem with
 * a small lean, a crown blob and two drooping crown straps. Never lit,
 * never fogged; the ink is the whole drawing.
 */
let trunkCard: BufferGeometry | undefined;
function trunkCardGeometry(): BufferGeometry {
  if (trunkCard) {
    return trunkCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = TRUNK_CARD_HEIGHT;
    // Proportions read off the real young kelp that ghosted so well at
    // sixty metres in round 1: a thin drifting stem for four fifths of the
    // height, then a small *lumpy* head — two offset diamonds and two
    // drooping straps. The first cut's single wide diamond scaled up into
    // a pyramid and the horizon read as mountains again.
    const positions = new Float32Array([
      // The stem, in two leaning segments.
      -0.9, 0, 0, 0.9, 0, 0, 1.4, h * 0.45, 0,
      -0.9, 0, 0, 1.4, h * 0.45, 0, -0.2, h * 0.47, 0,
      -0.2, h * 0.47, 0, 1.4, h * 0.45, 0, 0.9, h * 0.84, 0,
      -0.2, h * 0.47, 0, 0.9, h * 0.84, 0, -0.1, h * 0.85, 0,
      // The head: two small diamonds, offset so the crown lumps.
      -1.8, h * 0.84, 0, 2.6, h * 0.86, 0, 0.5, h * 0.95, 0,
      -1.8, h * 0.84, 0, 0.6, h * 0.78, 0, 2.6, h * 0.86, 0,
      -1.4, h * 0.92, 0, 2.0, h * 0.94, 0, 0.2, h * 1.02, 0,
      -1.4, h * 0.92, 0, 0.3, h * 0.87, 0, 2.0, h * 0.94, 0,
      // Two drooping crown straps.
      -1.6, h * 0.88, 0, -0.6, h * 0.86, 0, -3.2, h * 0.7, 0,
      1.9, h * 0.9, 0, 0.8, h * 0.88, 0, 3.4, h * 0.72, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("verdant distance trunk blades could not be merged");
  }
  merged.computeBoundingSphere();
  trunkCard = merged;
  return trunkCard;
}

/**
 * One ring: a curtain whose top edge is a canopy line with trunk spikes.
 * The vale's azimuth sector is skipped — the ring is an open arc.
 */
function forestRing(layer: ForestLayer, random: Random, noiseSeed: number): BufferGeometry {
  // Round 2: a spike narrower than one ring segment (2π/220 ≈ 0.029 rad)
  // simply vanishes between vertices, which is why round 1's "forest
  // skyline" read as bare mountains. Every trunk now spans at least two
  // segments, and the crown bulge rides proportionally wider.
  const trunks: { at: number; height: number; halfWidth: number; crown: number }[] = [];
  for (let i = 0; i < layer.trunks; i++) {
    trunks.push({
      at: random.range(0, Math.PI * 2),
      height: layer.trunkHeight * random.range(0.65, 1),
      halfWidth: random.range(0.02, 0.045),
      crown: random.range(1.4, 2.4),
    });
  }

  const builder = new SoftRingBuilder();

  // The near gap faces back down the spoke toward the origin, where the
  // vale comes in: from the disc's centre that is the slot azimuth plus π.
  // The far gap (MASTER R4) faces straight down the spoke, where the
  // depth-2 pass leaves the disc.
  const gapAt = VERDANT_SLOT.azimuth + Math.PI;
  const passAt = VERDANT_SLOT.azimuth;
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    const offPass = angleBetween(theta, passAt);
    if (off < GAP_HALF || offPass < PASS_GAP_HALF) {
      builder.gap();
      continue;
    }
    // The arc's ends sink into the ground over a short run, so the gaps'
    // cut edges never stand as vertical green cliffs in a side view.
    const end = Math.min(
      smoothstep01((off - GAP_HALF) / 0.14),
      smoothstep01((offPass - PASS_GAP_HALF) / 0.14),
    );
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    const canopy =
      layer.canopyBase +
      (fbm(t * 8, layer.radius * 0.01, { seed: noiseSeed, period: 8, octaves: 3 }) - 0.5) *
        2 *
        layer.canopyVary;

    let spike = 0;
    for (const trunk of trunks) {
      const delta = angleBetween(theta, trunk.at);
      if (delta < trunk.halfWidth * Math.PI) {
        const k = 1 - delta / (trunk.halfWidth * Math.PI);
        // A trunk spike with a swollen crown: tall thin stem, bulged head.
        spike = Math.max(spike, trunk.height * (k * 0.7 + Math.pow(k, 6) * trunk.crown * 0.3));
      }
    }

    builder.column(x, z, FOOT, FOOT + Math.max(1.4, canopy + spike - FOOT) * end + 0.2, {
      alpha: endAlpha(end),
    });
  }

  return builder.build();
}

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
