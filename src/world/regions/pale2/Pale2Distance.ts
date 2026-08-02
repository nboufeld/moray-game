import {
  AdditiveBlending,
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
  Vector3,
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
import { smoothstep01 } from "./Pale2Shared";
import { CENTER_X, CENTER_Z, PALE2_SLOT } from "./Pale2Terrain";

/**
 * The Lantern Combs' painted distance — and the region's horizon
 * trick: the DAYSPRING. The silhouette rings are vertex-painted by
 * azimuth: pearl-white milk almost everywhere, warming to a lamp-gold
 * glow around the reserved depth-3 corridor — the promise that the
 * light has a source, and it lies further out along the spoke. The
 * material colour follows the live fog (the pilot's followFog idiom);
 * the vertex tint is the ratio on top of it.
 *
 * The rings PART over BOTH pass corridors (MASTER R4, both sides,
 * authored from draft one): the inbound gap toward the Bone Meadows
 * (half-angle 0.42) and the reserved outbound gap on the spoke
 * (half-angle 0.30) so pale-passage-3's country can one day appear
 * through it without an orchestrator cut on our side.
 *
 * Below the rings stand two instanced silhouette families: comb
 * splinters — curved fin cards — on the milk arcs, and font towers —
 * tall lantern-spire cards — flanking the Dayspring gap (offset to
 * |v| ≳ 26 so their feet stay clear of the future pass tongue).
 */

interface ReefLayer {
  readonly radius: number;
  readonly crestBase: number;
  readonly crestVary: number;
  readonly fade: number;
}

// The first ring stands inside the ground sheets' rc-240 trim, hiding
// the trim's sawtooth from every low camera (the pale-1 lesson).
const LAYERS: readonly ReefLayer[] = [
  { radius: 236, crestBase: 10, crestVary: 3.0, fade: 0.42 },
  { radius: 262, crestBase: 16, crestVary: 3.6, fade: 0.58 },
  { radius: 286, crestBase: 22, crestVary: 4.2, fade: 0.74 },
];

const SEGMENTS = 220;
const FOOT = -30;

/** Milk ink: a breath above the fog — the pearl horizon. */
const INK_MILK = new Color(1.03, 1.02, 1.04);
/** Dayspring ink: lamp gold held BRIGHT — the light behind the paper. */
const INK_DAYSPRING = new Color(1.16, 1.0, 0.72);

/** Half-angle of the gap over the inbound pass (toward the origin). */
const GAP_IN_HALF = 0.42;
/** Half-angle of the reserved outbound gap (the depth-3 corridor). */
const GAP_OUT_HALF = 0.3;

/** 0 in plain milk, 1 at the Dayspring's edges. */
function dayspringAt(theta: number, outAt: number): number {
  return 1 - smoothstep01((angleBetween(theta, outAt) - GAP_OUT_HALF) / 0.85);
}

export function buildPale2Distance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionPale2 ^ 0xd159);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const materials: MeshBasicMaterial[] = [];
  const cardMaterials: { material: MeshBasicMaterial; fade: number; ink: Color }[] = [];
  let lastFog = -1;

  // The inbound gap faces the origin; the outbound gap faces out along
  // the spoke — the reserved corridor.
  const inAt = PALE2_SLOT.azimuth + Math.PI;
  const outAt = PALE2_SLOT.azimuth;

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
      material.color.copy(fog.color);
    }
    for (const { material, fade, ink } of cardMaterials) {
      material.color.copy(fog.color.clone().multiply(ink)).lerp(fog.color, fade);
    }
  };

  for (const [index, layer] of LAYERS.entries()) {
    // Critic F3 (the class fix): the two-row strip's razor top and its
    // min-height end ribbons — the pale-10 "floating slabs" — are the
    // shared grammar defect; the ring is now the kit's soft three-row
    // curtain (dissolved crest, ends fading to nothing). The Dayspring
    // ink walk below is byte-untouched.
    const material = softCurtainMaterial({ color: new Color(0x9fc4c4) });
    applyCurtainDissolve(material, { cacheKey: "pale2-distance-dissolve" });
    const geometry = reefRing(layer, SEEDS.regionPale2 ^ (0xd210 + index * 131), inAt, outAt);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `pale2-distance-${index}`;
    mesh.renderOrder = -(index + 3);
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The card bands: comb splinters on the milk arcs; font towers
  // flanking the Dayspring gap only.
  // Round 3: the font towers pulled INTO the corridor's frame — at
  // angular offsets up to 0.62 they stood outside the pearl-steps
  // pose's frustum and the Dayspring read as empty horizon.
  const bands = [
    { kind: "splinter" as const, rFrom: 238, rTo: 254, count: 20, fade: 0.44, hMin: 12, hMax: 20 },
    { kind: "splinter" as const, rFrom: 258, rTo: 278, count: 14, fade: 0.62, hMin: 16, hMax: 24 },
    { kind: "font" as const, rFrom: 238, rTo: 258, count: 10, fade: 0.46, hMin: 22, hMax: 32 },
  ];
  for (const [bandIndex, band] of bands.entries()) {
    const ink = band.kind === "splinter" ? INK_MILK : INK_DAYSPRING;
    const material = new MeshBasicMaterial({
      color: new Color(band.kind === "splinter" ? 0xbcccd2 : 0xc9b48e),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    cardMaterials.push({ material, fade: band.fade, ink });
    const geometry = band.kind === "splinter" ? splinterCardGeometry() : fontCardGeometry();
    const mesh = new InstancedMesh(geometry, material, band.count);
    mesh.name = `pale2-distance-${band.kind}-${bandIndex}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    let placed = 0;
    let guard = 0;
    while (placed < band.count && guard++ < 500) {
      const theta = random.range(0, Math.PI * 2);
      if (angleBetween(theta, inAt) < GAP_IN_HALF + 0.1) {
        continue;
      }
      if (band.kind === "splinter") {
        // Splinters keep out of the whole Dayspring sector.
        if (angleBetween(theta, outAt) < GAP_OUT_HALF + 0.12) {
          continue;
        }
      } else {
        // Fonts flank the gap FROM INSIDE it (round 4: at offsets past
        // the gap's edge they stood outside the pearl-steps frame) —
        // their feet stay |v| ≥ 27 at these radii, clear of the future
        // tongue's spine by construction.
        const off = angleBetween(theta, outAt);
        if (off < 0.13 || off > 0.34) {
          continue;
        }
      }
      const r = random.range(band.rFrom, band.rTo);
      dummy.position.set(
        CENTER_X + Math.cos(theta) * r,
        FOOT + 2,
        CENTER_Z + Math.sin(theta) * r,
      );
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.04));
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

  // THE DAYSPRING VEIL (round 3): a soft additive gold gradient deep
  // in the outbound gap — the warmth the gap itself was missing (the
  // ring edges' ink alone read as plain horizon fade). Additive over
  // black-edged vertex colours: the plane dissolves at its own rim,
  // one draw, fog:false like every curtain.
  meshes.push(buildDayspringVeil(outAt));

  return { meshes };
}

/** The veil: a vertex-faded gold glow standing across the corridor. */
function buildDayspringVeil(outAt: number): Mesh {
  const COLS = 10;
  const ROWS = 5;
  const HALF_W = 62;
  const HEIGHT = 38;
  // Round 4: closer and brighter — at r 306 / 0.34 peak the veil was
  // a whisper against the mint backdrop.
  const R = 296;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const cx = CENTER_X + Math.cos(outAt) * R;
  const cz = CENTER_Z + Math.sin(outAt) * R;
  // The plane faces back down the corridor: its width runs tangent.
  const tx = -Math.sin(outAt);
  const tz = Math.cos(outAt);
  for (let j = 0; j <= ROWS; j++) {
    const h = j / ROWS;
    for (let i = 0; i <= COLS; i++) {
      const t = i / COLS - 0.5;
      positions.push(cx + tx * t * HALF_W * 2, FOOT + 4 + HEIGHT * h, cz + tz * t * HALF_W * 2);
      // A gaussian heart, black at every rim (additive: black = gone).
      // Journey-close: the gaussians alone left 15–37 % of peak at the
      // rims — from the mid-pass stand at ~90 m (outside the R0.7
      // near-fade) the pane drew its own rectangle against the water.
      // An edge window drives every rim to a true zero; the heart
      // (|t| < 0.32, 0.22 < h < 0.78) is untouched.
      const window =
        smoothstep01((0.5 - Math.abs(t)) / 0.18) * smoothstep01(Math.min(h, 1 - h) / 0.22);
      const falloff =
        Math.exp(-((t * 2.6) ** 2)) * Math.exp(-(((h - 0.42) / 0.42) ** 2)) * window;
      colors.push(0.55 * falloff, 0.39 * falloff, 0.17 * falloff);
    }
  }
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = j * (COLS + 1) + i;
      const b = a + COLS + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const material = new MeshBasicMaterial({
    color: new Color(1, 1, 1),
    vertexColors: true,
    fog: false,
    side: DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: true,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "pale2-dayspring-veil";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // R0.7 (the Dayspring's flag): the veil stands at u ≈ 1236 — inside the
  // depth-3 threshold country — so a diver actually walking the corridor
  // meets it near-on as a hard-edged additive pane. It fades with camera
  // distance, dissolving over the last 80 m of approach; every authored
  // pose on both sides views it from ~99 m or further and keeps its
  // shipped read.
  const veilCenter = new Vector3(cx, FOOT + 4 + HEIGHT * 0.42, cz);
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    material.opacity = smoothstep01((camera.position.distanceTo(veilCenter) - 45) / 35);
  };
  return mesh;
}

/** The cards' authored height; instances scale to their drawn height. */
const CARD_HEIGHT = 10;

/** A comb splinter: a curved fin blade with a curled crest. */
let splinterCard: BufferGeometry | undefined;
function splinterCardGeometry(): BufferGeometry {
  if (splinterCard) {
    return splinterCard;
  }
  const h = CARD_HEIGHT;
  const blade = (spin: number): BufferGeometry => {
    const positions = new Float32Array([
      // The standing blade, bowed: wide foot, waist, curled crest.
      -2.4, 0, 0, 2.4, 0, 0, 1.6, h * 0.5, 0,
      -2.4, 0, 0, 1.6, h * 0.5, 0, -1.9, h * 0.46, 0,
      -1.9, h * 0.46, 0, 1.6, h * 0.5, 0, 0.9, h * 0.86, 0,
      -1.9, h * 0.46, 0, 0.9, h * 0.86, 0, -1.1, h * 0.8, 0,
      // The crest curl, leaning off-axis.
      -1.1, h * 0.8, 0, 0.9, h * 0.86, 0, -0.4, h * 1.0, 0.4,
      // A shoulder shard beside the foot.
      2.6, 0, 0.2, 3.6, 0, 0.3, 3.0, h * 0.3, 0.24,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("pale2 distance splinter blades could not be merged");
  }
  merged.computeBoundingSphere();
  splinterCard = merged;
  return splinterCard;
}

/** A font tower: a tall lantern-spire silhouette with a swollen crown. */
let fontCard: BufferGeometry | undefined;
function fontCardGeometry(): BufferGeometry {
  if (fontCard) {
    return fontCard;
  }
  const h = CARD_HEIGHT;
  const blade = (spin: number): BufferGeometry => {
    const positions = new Float32Array([
      // The shaft.
      -0.9, 0, 0, 0.9, 0, 0, 0.5, h * 0.62, 0,
      -0.9, 0, 0, 0.5, h * 0.62, 0, -0.5, h * 0.62, 0,
      // The swollen lantern crown.
      -0.5, h * 0.6, 0, 0.5, h * 0.6, 0, 1.1, h * 0.78, 0,
      -0.5, h * 0.6, 0, 1.1, h * 0.78, 0, -1.1, h * 0.78, 0,
      -1.1, h * 0.78, 0, 1.1, h * 0.78, 0, 0.4, h * 0.94, 0,
      -1.1, h * 0.78, 0, 0.4, h * 0.94, 0, -0.4, h * 0.94, 0,
      // The finial.
      -0.16, h * 0.93, 0, 0.16, h * 0.93, 0, 0, h * 1.0, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("pale2 distance font blades could not be merged");
  }
  merged.computeBoundingSphere();
  fontCard = merged;
  return fontCard;
}

/**
 * One ring: a curtain whose top edge is an undulating comb crest,
 * gapped over BOTH pass corridors and vertex-painted milk→dayspring
 * by azimuth.
 */
function reefRing(
  layer: ReefLayer,
  noiseSeed: number,
  inAt: number,
  outAt: number,
): BufferGeometry {
  const builder = new SoftRingBuilder();

  const ink = new Color();
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const inOff = angleBetween(theta, inAt);
    const outOff = angleBetween(theta, outAt);
    if (inOff < GAP_IN_HALF || outOff < GAP_OUT_HALF) {
      builder.gap();
      continue;
    }
    // Long eases at both arc ends (the stair-step lesson).
    const end =
      smoothstep01((inOff - GAP_IN_HALF) / 0.4) * smoothstep01((outOff - GAP_OUT_HALF) / 0.35);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    const crest =
      layer.crestBase +
      (fbm(t * 8, layer.radius * 0.01, { seed: noiseSeed, period: 8, octaves: 3 }) - 0.5) *
        2 *
        layer.crestVary;

    // The Dayspring ink: milk almost everywhere, warming toward the
    // reserved corridor, blended toward the fog by the layer's fade.
    const dayspring = dayspringAt(theta, outAt);
    ink.copy(INK_MILK).lerp(INK_DAYSPRING, dayspring);
    ink.lerp(new Color(1, 1, 1), layer.fade);

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
