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

const LAYERS: readonly ReefLayer[] = [
  { radius: 246, crestBase: 6, crestVary: 1.6, fade: 0.4 },
  { radius: 264, crestBase: 9, crestVary: 2.0, fade: 0.58 },
  { radius: 286, crestBase: 12, crestVary: 2.6, fade: 0.74 },
];

const SEGMENTS = 220;
const FOOT = -12;

/** Bone ink: barely below the fog — the white horizon nearly dissolves. */
const INK_BONE = new Color(0.94, 0.94, 0.97);
/** Bloom ink: rose-violet taken down from the fog, red held above green. */
const INK_BLOOM = new Color(0.78, 0.6, 0.68);

/** Half-angle of the gap the rings leave over the ravine's approach. */
const GAP_HALF = 0.42;

/** 0 on the white (gateway) side of the horizon, 1 on the far bloom side. */
function healingAt(theta: number, gapAt: number): number {
  return smoothstep01((angleBetween(theta, gapAt) - 0.9) / 1.6);
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
    const material = new MeshBasicMaterial({
      color: new Color(0x9fc4c4),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
    });
    const geometry = reefRing(layer, SEEDS.regionPale1 ^ (0xd210 + index * 131), gapAt);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `pale-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The card bands: bone snags on the white arc, blossom mounds on the
  // coloured one, two distances each.
  const bands = [
    { kind: "snag" as const, rFrom: 240, rTo: 254, count: 22, fade: 0.42, hMin: 9, hMax: 15 },
    { kind: "snag" as const, rFrom: 258, rTo: 276, count: 16, fade: 0.62, hMin: 11, hMax: 17 },
    { kind: "mound" as const, rFrom: 240, rTo: 256, count: 14, fade: 0.44, hMin: 6, hMax: 10 },
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
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const ink = new Color();
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    if (off < GAP_HALF) {
      column = 0;
      continue;
    }
    const end = smoothstep01((off - GAP_HALF) / 0.14);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    const crest =
      layer.crestBase +
      (fbm(t * 8, layer.radius * 0.01, { seed: noiseSeed, period: 8, octaves: 3 }) - 0.5) *
        2 *
        layer.crestVary;

    positions.push(x, FOOT, z, x, FOOT + Math.max(1.4, crest - FOOT) * end + 0.2, z);

    // The healing ink, per column: bone (barely under the fog) on the
    // white side, rose-violet on the bloom side, blended toward the fog
    // by the layer's own fade so far layers dissolve first.
    const healing = healingAt(theta, gapAt);
    ink.copy(INK_BONE).lerp(INK_BLOOM, healing);
    ink.lerp(new Color(1, 1, 1), layer.fade);
    colors.push(ink.r, ink.g, ink.b, ink.r, ink.g, ink.b);

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

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
