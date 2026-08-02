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
import { regionSlot } from "../RegionSlots";
import { smoothstep01 } from "./PaleShared";
import { CENTER_X, CENTER_Z, PALE_SLOT } from "./PaleTerrain";

/**
 * The Bone Meadows' painted distance — and the region's one big colour
 * trick: the horizon itself heals. The silhouette rings are vertex-
 * painted by azimuth, bone-white where they stand behind the white half
 * (toward the gateway) and warming through blush to rose-gold behind the
 * Seed Grove, so every vista ends in the same story the ground tells.
 * The material colour still follows the live fog per frame (the pilot's
 * followFog idiom); the vertex tint is the ratio on top of it.
 *
 * Below the rings stand two instanced silhouette families on the same
 * ink: bone snags — bare antler cards — on the white arc, and blossom
 * mounds — lumpy low domes with a lifted crown — on the coloured arc.
 * The pilot's rounds 5–7 paid for the rule: a ring feature narrower than
 * a segment vanishes, so every vertical is a card, and the rings carry
 * only the horizontals.
 */

interface ReefLayer {
  readonly radius: number;
  readonly crestBase: number;
  readonly crestVary: number;
  readonly fade: number;
}

// The first ring stands INSIDE the ground sheets' rc-240 trim, so its
// curtain hides the trim's sawtooth edge (round 4's "stair-step" lines
// at every horizon) from every low camera in the region.
const LAYERS: readonly ReefLayer[] = [
  { radius: 236, crestBase: 5, crestVary: 2.4, fade: 0.4 },
  { radius: 262, crestBase: 8, crestVary: 2.8, fade: 0.58 },
  { radius: 286, crestBase: 11, crestVary: 3.2, fade: 0.74 },
];

const SEGMENTS = 220;
const FOOT = -12;

/** Bone ink: a breath *above* the fog — the white horizon reads as milk. */
const INK_BONE = new Color(1.03, 1.02, 1.04);
/** Bloom ink: rose-violet taken down from the fog, red held above green. */
const INK_BLOOM = new Color(0.84, 0.6, 0.7);

/** Half-angle of the gap the rings leave over the ravine's approach. */
const GAP_HALF = 0.42;

/**
 * Half-angle of the second gap, over the OUTBOUND (depth-2) corridor —
 * R0.4 integration of the Lantern Combs' flagged gate: the rings are
 * opaque `fog:false` curtains, so the corridor view toward the Combs
 * (u ≈ 681–731 where the three radii cross the spoke) needs the sector
 * parted. Sized to the pass tongue's width there (half-width ≈ 18–22 m
 * → atan ≈ 0.085 rad) plus the edge-fade margin.
 */
const GAP_OUT_HALF = 0.12;

/** 0 on the white (gateway) side of the horizon, 1 on the far bloom side. */
function healingAt(theta: number, gapAt: number): number {
  return smoothstep01((angleBetween(theta, gapAt) - 0.9) / 1.6);
}

/**
 * R0.10 (journey-close): the Sunken Calamity's march runs down azimuth
 * 4.59, and the perpendicular distance from our centre to that line is
 * ≈ 293 m — 7 m outside the outermost radius. The rings ran tangent
 * ALONG the march corridor, so once this region attaches naturally
 * beside the spur (the region's own QA always forced a lone region and
 * never saw it) the arcs stood in the swim-line as opaque `fog:false`
 * sheets. Part the curtain over the corridor: the R4 cut, taken in
 * world space against the spur's line rather than by our own azimuth.
 */
const SPUR = regionSlot("sunken-calamity-1");
const SPUR_COS = Math.cos(SPUR.azimuth);
const SPUR_SIN = Math.sin(SPUR.azimuth);
/** Lateral clearance the painted distance keeps off the spur's swim-line. */
const SPUR_CLEAR = 40;
const SPUR_TAPER = 30;

/** 0 on the spur's swim-line, easing to 1 past SPUR_CLEAR + SPUR_TAPER. */
function spurEase(x: number, z: number): number {
  const along = x * SPUR_COS + z * SPUR_SIN;
  if (along < 100) {
    return 1;
  }
  const lateral = Math.abs(z * SPUR_COS - x * SPUR_SIN);
  return smoothstep01((lateral - SPUR_CLEAR) / SPUR_TAPER);
}

export function buildPaleDistance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionPale1 ^ 0xd159);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const materials: MeshBasicMaterial[] = [];
  const cardMaterials: { material: MeshBasicMaterial; fade: number; ink: Color }[] = [];
  let lastFog = -1;

  const gapAt = PALE_SLOT.azimuth + Math.PI;

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
    for (const material of materials) {
      // The vertex colours carry the bone→bloom ratio and each layer's
      // fade toward the water; the material colour is the live fog itself,
      // so the horizon rides the weather.
      material.color.copy(fog.color);
    }
    for (const { material, fade, ink } of cardMaterials) {
      material.color.copy(fog.color.clone().multiply(ink)).lerp(fog.color, fade);
    }
  };

  for (const [index, layer] of LAYERS.entries()) {
    // Critic F3 (the class fix): soft three-row curtain + the far-clip
    // self-dissolve; the F2 wall-card slab the off-road lost-bearing
    // frame caught was this family's razor grammar.
    const material = softCurtainMaterial({ color: new Color(0x9fc4c4) });
    applyCurtainDissolve(material, { cacheKey: "pale-distance-dissolve" });
    const geometry = reefRing(layer, SEEDS.regionPale1 ^ (0xd210 + index * 131), gapAt);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `pale-distance-${index}`;
    mesh.renderOrder = -(index + 3);
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The card bands: bone snags on the white arc, blossom mounds on the
  // coloured one, two distances each.
  const bands = [
    { kind: "snag" as const, rFrom: 238, rTo: 252, count: 22, fade: 0.42, hMin: 9, hMax: 15 },
    { kind: "snag" as const, rFrom: 258, rTo: 276, count: 16, fade: 0.62, hMin: 11, hMax: 17 },
    { kind: "mound" as const, rFrom: 238, rTo: 254, count: 14, fade: 0.44, hMin: 6, hMax: 10 },
    { kind: "mound" as const, rFrom: 260, rTo: 280, count: 10, fade: 0.64, hMin: 7, hMax: 12 },
  ];
  for (const [bandIndex, band] of bands.entries()) {
    const ink = band.kind === "snag" ? INK_BONE : INK_BLOOM;
    const material = new MeshBasicMaterial({
      color: new Color(band.kind === "snag" ? 0xbcd2d2 : 0x9f7f8e),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    cardMaterials.push({ material, fade: band.fade, ink });
    const geometry = band.kind === "snag" ? snagCardGeometry() : moundCardGeometry();
    const mesh = new InstancedMesh(geometry, material, band.count);
    mesh.name = `pale-distance-${band.kind}-${bandIndex}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    let placed = 0;
    let guard = 0;
    while (placed < band.count && guard++ < 400) {
      const theta = random.range(0, Math.PI * 2);
      if (angleBetween(theta, gapAt) < GAP_HALF + 0.1) {
        continue;
      }
      const healing = healingAt(theta, gapAt);
      // Snags live where the world is still white; mounds where it blooms.
      if (band.kind === "snag" ? healing > 0.55 : healing < 0.45) {
        continue;
      }
      const r = random.range(band.rFrom, band.rTo);
      dummy.position.set(
        CENTER_X + Math.cos(theta) * r,
        FOOT + 2,
        CENTER_Z + Math.sin(theta) * r,
      );
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.05));
      dummy.scale.set(
        random.range(1.0, 1.6),
        random.range(band.hMin, band.hMax) / CARD_HEIGHT,
        random.range(1.0, 1.6),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    // R0.4: the depth-2 corridor crosses these bands (u ≈ 683–725); cards
    // inside the outbound gap sector are parked below the world rather
    // than re-rolled — the post-filter idiom blue-1 uses at its World's
    // Edge gap, so the random stream (and every other card) is untouched.
    const parked = new Matrix4();
    const gapOutAt = PALE_SLOT.azimuth;
    for (let i = 0; i < placed; i++) {
      mesh.getMatrixAt(i, parked);
      const px = parked.elements[12]!;
      const pz = parked.elements[14]!;
      const cardTheta = Math.atan2(pz - CENTER_Z, px - CENTER_X);
      // R0.10: cards over the Calamity spur's corridor park with them —
      // the outer bands reach within 11 m of the march's swim-line.
      if (angleBetween(cardTheta, gapOutAt) < GAP_OUT_HALF + 0.1 || spurEase(px, pz) < 1) {
        parked.elements[13] = -500;
        mesh.setMatrixAt(i, parked);
      }
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }

  return { meshes };
}

/** The cards' authored height; instances scale to their drawn height. */
const CARD_HEIGHT = 10;

/**
 * A bone snag: two crossed blades of a bare dead colossus — a leaning
 * trunk forking into three empty tines. No crown, no mass: what makes a
 * skeleton read at 250 m is the sky through it.
 */
let snagCard: BufferGeometry | undefined;
function snagCardGeometry(): BufferGeometry {
  if (snagCard) {
    return snagCard;
  }
  const h = CARD_HEIGHT;
  const blade = (spin: number): BufferGeometry => {
    const positions = new Float32Array([
      // The leaning trunk, two segments.
      -0.5, 0, 0, 0.5, 0, 0, 0.9, h * 0.42, 0,
      -0.5, 0, 0, 0.9, h * 0.42, 0, 0.1, h * 0.44, 0,
      0.1, h * 0.44, 0, 0.9, h * 0.42, 0, 0.7, h * 0.62, 0,
      0.1, h * 0.44, 0, 0.7, h * 0.62, 0, 0.15, h * 0.6, 0,
      // Three tines, thinning to points.
      0.15, h * 0.58, 0, 0.62, h * 0.6, 0, -1.3, h * 0.94, 0,
      0.4, h * 0.6, 0, 0.75, h * 0.62, 0, 1.5, h * 1.0, 0,
      0.3, h * 0.5, 0, 0.7, h * 0.52, 0, 2.1, h * 0.72, 0,
      // One low broken stub.
      -0.35, h * 0.24, 0, 0.0, h * 0.28, 0, -1.5, h * 0.42, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("pale distance snag blades could not be merged");
  }
  merged.computeBoundingSphere();
  snagCard = merged;
  return snagCard;
}

/**
 * A blossom mound: a low lumpy dome-cluster with one lifted crown — a
 * young coral garden's far silhouette, round where the snags are spiked.
 */
let moundCard: BufferGeometry | undefined;
function moundCardGeometry(): BufferGeometry {
  if (moundCard) {
    return moundCard;
  }
  const h = CARD_HEIGHT;
  const blade = (spin: number): BufferGeometry => {
    const positions = new Float32Array([
      // Three overlapping dome lumps.
      -3.2, 0, 0, -0.2, 0, 0, -1.7, h * 0.5, 0,
      -1.4, 0, 0, 1.8, 0, 0, 0.2, h * 0.62, 0,
      0.8, 0, 0, 3.4, 0, 0, 2.1, h * 0.44, 0,
      // The lifted crown knuckle.
      -0.5, h * 0.5, 0, 0.9, h * 0.52, 0, 0.2, h * 0.95, 0,
      -0.2, h * 0.72, 0, 0.6, h * 0.74, 0, 0.25, h * 1.0, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("pale distance mound blades could not be merged");
  }
  merged.computeBoundingSphere();
  moundCard = merged;
  return moundCard;
}

/**
 * One ring: a curtain whose top edge is an undulating reef crest, gapped
 * over the ravine and vertex-painted bone→bloom by azimuth.
 */
function reefRing(layer: ReefLayer, noiseSeed: number, gapAt: number): BufferGeometry {
  const builder = new SoftRingBuilder();

  const ink = new Color();
  const gapOutAt = PALE_SLOT.azimuth;
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    const offOut = angleBetween(theta, gapOutAt);
    if (off < GAP_HALF || offOut < GAP_OUT_HALF) {
      builder.gap();
      continue;
    }
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;
    const overSpur = spurEase(x, z);
    if (overSpur === 0) {
      builder.gap();
      continue;
    }
    // A long ease: round 1's 0.14 rad cut rendered the arc ends as
    // rectangular stair-steps standing in open water.
    const end = Math.min(
      smoothstep01((off - GAP_HALF) / 0.4),
      smoothstep01((offOut - GAP_OUT_HALF) / 0.25),
      overSpur,
    );

    const t = i / SEGMENTS;
    const crest =
      layer.crestBase +
      (fbm(t * 8, layer.radius * 0.01, { seed: noiseSeed, period: 8, octaves: 3 }) - 0.5) *
        2 *
        layer.crestVary;

    // The healing ink, per column: bone (barely under the fog) on the
    // white side, rose-violet on the bloom side, blended toward the fog
    // by the layer's own fade so far layers dissolve first.
    const healing = healingAt(theta, gapAt);
    ink.copy(INK_BONE).lerp(INK_BLOOM, healing);
    ink.lerp(new Color(1, 1, 1), layer.fade);

    // Critic F3 (the class fix): soft three-row grammar — dissolved
    // crest, gap ends fading out instead of running as slab ribbons.
    builder.column(x, z, FOOT, FOOT + Math.max(1.4, crest - FOOT) * end + 0.2, {
      alpha: endAlpha(end),
      tints: [
        [ink.r * 0.92, ink.g * 0.92, ink.b * 0.92],
        [ink.r, ink.g, ink.b],
        [ink.r * 1.06, ink.g * 1.06, ink.b * 1.06],
      ],
    });
  }

  return builder.build();
}

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
