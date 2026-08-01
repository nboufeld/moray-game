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
  type Scene,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { smoothstep01 } from "./Pale3Shared";
import { CENTER_X, CENTER_Z, PALE3_SLOT } from "./Pale3Terrain";

/**
 * THE MORNING — the Dayspring's painted distance, and the Pale
 * Passage's closing horizon. This region is the spoke's terminus:
 * there is no forward promise, only the thing itself. The Combs
 * painted a warm rumour called the DAYSPRING on their far rings; here
 * the whole outbound half of the sky IS that painting, grown real:
 * the silhouette rings are vertex-painted by azimuth — pearl milk in
 * every other direction, warming through gold into dawn-rose across
 * the morning's sector — with THE MORNING VEIL standing behind the
 * risen pearl: a broad additive gradient of first light, the
 * brightest painted thing in the province.
 *
 * The rings part over the INBOUND corridor only (MASTER R4 — the way
 * back to the Combs stays open; nothing may curtain a pass). Below
 * the milk arcs stand font-splinter silhouette cards; across the
 * morning's flanks stand tall font-tower cards — the towers of a
 * farther country, black against nothing, milky against everything
 * (the value key: distance goes bright, never dark).
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
  { radius: 262, crestBase: 17, crestVary: 3.6, fade: 0.58 },
  { radius: 286, crestBase: 24, crestVary: 4.2, fade: 0.74 },
];

const SEGMENTS = 220;
const FOOT = -30;

/** Milk ink: a breath above the fog — the pearl horizon. */
const INK_MILK = new Color(1.03, 1.02, 1.04);
/** Morning ink: first-light gold held BRIGHT. Round 2: stronger — the
 *  r1 warm sector was invisible under the milk. */
const INK_MORNING = new Color(1.24, 1.04, 0.7);
/** Dawn-rose ink at the morning's very heart. */
const INK_ROSE = new Color(1.16, 0.94, 0.86);

/** Half-angle of the gap over the inbound pass (toward the origin). */
const GAP_IN_HALF = 0.42;

/** 0 in plain milk, 1 at the morning's heart. */
function morningAt(theta: number, outAt: number): number {
  return 1 - smoothstep01((angleBetween(theta, outAt) - 0.12) / 1.05);
}

export function buildPale3Distance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionPale3 ^ 0xd159);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const materials: MeshBasicMaterial[] = [];
  const cardMaterials: { material: MeshBasicMaterial; fade: number; ink: Color }[] = [];
  let lastFog = -1;

  // The inbound gap faces the origin; the morning faces out along the
  // spoke — the bearing the whole province has been swimming.
  const inAt = PALE3_SLOT.azimuth + Math.PI;
  const outAt = PALE3_SLOT.azimuth;

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
    const material = new MeshBasicMaterial({
      color: new Color(0x9fc4c4),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
    });
    const geometry = reefRing(layer, SEEDS.regionPale3 ^ (0xd210 + index * 131), inAt, outAt);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `pale3-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The card bands: font splinters on the milk arcs; font towers on
  // the morning's flanks — silhouettes of a farther, brighter country.
  const bands = [
    { kind: "splinter" as const, rFrom: 238, rTo: 254, count: 20, fade: 0.44, hMin: 12, hMax: 20 },
    { kind: "splinter" as const, rFrom: 258, rTo: 278, count: 14, fade: 0.62, hMin: 16, hMax: 24 },
    { kind: "font" as const, rFrom: 240, rTo: 262, count: 12, fade: 0.46, hMin: 24, hMax: 38 },
  ];
  for (const [bandIndex, band] of bands.entries()) {
    const ink = band.kind === "splinter" ? INK_MILK : INK_MORNING;
    const material = new MeshBasicMaterial({
      color: new Color(band.kind === "splinter" ? 0xbcccd2 : 0xcdb891),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    cardMaterials.push({ material, fade: band.fade, ink });
    const geometry = band.kind === "splinter" ? splinterCardGeometry() : fontCardGeometry();
    const mesh = new InstancedMesh(geometry, material, band.count);
    mesh.name = `pale3-distance-${band.kind}-${bandIndex}`;
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
        // Splinters keep off the morning's own stage.
        if (angleBetween(theta, outAt) < 0.5) {
          continue;
        }
      } else {
        // The far towers flank the morning without standing in front
        // of the risen pearl's own line (the Combs' round-4 lesson:
        // cards must live inside the frame that wants them).
        const off = angleBetween(theta, outAt);
        if (off < 0.1 || off > 0.55) {
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

  // THE MORNING VEIL: the first light itself — a broad additive
  // gold-rose gradient standing across the morning's whole sector,
  // behind the risen pearl. Additive over black-edged vertex colours:
  // the plane dissolves at its own rim; fog:false like every curtain.
  meshes.push(buildMorningVeil(outAt));

  return { meshes };
}

/** The veil: a vertex-faded dawn glow standing across the morning. */
function buildMorningVeil(outAt: number): Mesh {
  const COLS = 12;
  const ROWS = 6;
  const HALF_W = 88;
  const HEIGHT = 46;
  const R = 296;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const cx = CENTER_X + Math.cos(outAt) * R;
  const cz = CENTER_Z + Math.sin(outAt) * R;
  // The plane faces back down the spoke: its width runs tangent.
  const tx = -Math.sin(outAt);
  const tz = Math.cos(outAt);
  for (let j = 0; j <= ROWS; j++) {
    const h = j / ROWS;
    for (let i = 0; i <= COLS; i++) {
      const t = i / COLS - 0.5;
      positions.push(cx + tx * t * HALF_W * 2, FOOT + 4 + HEIGHT * h, cz + tz * t * HALF_W * 2);
      // A gaussian heart just clearing the horizon line, black at
      // every rim (additive: black = gone). The heart leans gold; the
      // skirt leans rose — a dawn sky's order. Round 2: the heart
      // raised (h 0.3 → 0.48) so it stands ABOVE the lowered ring
      // crests, and both terms strengthened — r1's veil was hidden
      // behind the region's own rings.
      const heart = Math.exp(-((t * 2.4) ** 2)) * Math.exp(-(((h - 0.48) / 0.34) ** 2));
      const skirt = Math.exp(-((t * 1.5) ** 2)) * Math.exp(-(((h - 0.66) / 0.5) ** 2)) * 0.42;
      colors.push(
        0.66 * heart + 0.34 * skirt,
        0.46 * heart + 0.19 * skirt,
        0.2 * heart + 0.15 * skirt,
      );
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
  mesh.name = "pale3-morning-veil";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** The cards' authored height; instances scale to their drawn height. */
const CARD_HEIGHT = 10;

/** A font splinter: a curved shard blade with a small crown swell. */
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
    throw new Error("pale3 distance splinter blades could not be merged");
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
    throw new Error("pale3 distance font blades could not be merged");
  }
  merged.computeBoundingSphere();
  fontCard = merged;
  return fontCard;
}

/**
 * One ring: a curtain whose top edge is an undulating crest, gapped
 * over the inbound corridor and vertex-painted milk → morning by
 * azimuth. The morning's arc also stands a little TALLER — the far
 * country climbs into the light.
 */
function reefRing(
  layer: ReefLayer,
  noiseSeed: number,
  inAt: number,
  outAt: number,
): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const ink = new Color();
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const inOff = angleBetween(theta, inAt);
    if (inOff < GAP_IN_HALF) {
      column = 0;
      continue;
    }
    // A long ease at the gap's arc ends (the stair-step lesson).
    const end = smoothstep01((inOff - GAP_IN_HALF) / 0.4);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    const morning = morningAt(theta, outAt);
    // Round 2: the morning's arc drops LOW instead of climbing — dawn
    // is a low horizon the light floods over, and r1's raised crests
    // stood in front of the veil and curtained the region's own dawn
    // (the Emerald Gate lesson, self-inflicted and cured).
    const crest =
      layer.crestBase * (1 - 0.42 * morning) +
      (fbm(t * 8, layer.radius * 0.01, { seed: noiseSeed, period: 8, octaves: 3 }) - 0.5) *
        2 *
        layer.crestVary *
        (1 - 0.5 * morning);

    positions.push(x, FOOT, z, x, FOOT + Math.max(1.4, crest - FOOT) * end + 0.2, z);

    // Milk warming through gold into rose at the morning's heart,
    // blended toward the fog by the layer's fade.
    ink.copy(INK_MILK).lerp(INK_MORNING, morning);
    ink.lerp(INK_ROSE, Math.max(0, morning - 0.72) / 0.28);
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
