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
import { smoothstep01 } from "./Verdant3Shared";
import { CENTER_X, CENTER_Z, VERDANT3_SLOT, worldOf } from "./Verdant3Terrain";

/**
 * THE PROVINCE'S END — the Canopy Deep's painted distance, and the
 * Verdant Line's closing horizon. There is no forward promise here:
 * this is what 1.5 km of swimming was for. Three rings of level
 * mesa-country skyline (the terraces' promise grammar, grown colossal),
 * two bands of hanging-garden mesa cards — and THE MOTHER MESA, one
 * great crowned silhouette standing at the spoke's own bearing beyond
 * the far rim: the first garden, the one the whole province grew from.
 *
 * The inks re-derive from `scene.fog` per frame (one hex compare, the
 * province's standing device), so any mood reaches the painting. Red is
 * held above green's cut; the far country reads violet-green going
 * milky, never dark. The rings hold an open gap over the pass's
 * azimuth: the Boughfall's walls close that view, and a curtain across
 * the pass would wall the way in.
 */

interface CliffLayer {
  readonly radius: number;
  readonly meanTop: number;
  readonly stepDepth: number;
  readonly fade: number;
}

// Tops clear the rampart sightline from the sunken country (the
// verdant-2 lesson: rings inked too faint and too low read as a wall of
// fog). Farther rings stand taller — the canopy country climbs away.
// Round 2: tops raised 12/19/26 → 20/30/40 — from the Province's End
// rise (y ≈ −26, ~60 m inside the rampart crest) the r1 skyline sat
// entirely BELOW the rampart's 0.41 rad sightline and the horizon
// rendered empty.
const LAYERS: readonly CliffLayer[] = [
  { radius: 246, meanTop: 20, stepDepth: 5.5, fade: 0.22 },
  { radius: 266, meanTop: 30, stepDepth: 5, fade: 0.42 },
  { radius: 288, meanTop: 40, stepDepth: 4.5, fade: 0.6 },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the country can show. */
const FOOT = -52;

/** Green-violet ink: the fog colour taken down, red above green's cut. */
const INK = new Color(0.44, 0.53, 0.45);

/** Half-angle of the gap the rings leave over the pass's approach. */
const GAP_HALF = 0.42;

export function buildVerdant3Distance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionVerdant3 ^ 0xd159);
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
      color: new Color(0x4a9482),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    const geometry = cliffRing(layer, SEEDS.regionVerdant3 ^ (0xd400 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `verdant3-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // ─── The mesa-garden cards ─────────────────────────────────────────────────
  interface CardBand {
    readonly rFrom: number;
    readonly rTo: number;
    readonly count: number;
    readonly fade: number;
    readonly hMin: number;
    readonly hMax: number;
    /** Restrict placement to this bearing sector instead of the ring. */
    readonly sector?: { readonly at: number; readonly half: number };
  }
  const bands: readonly CardBand[] = [
    // Round 2: heights raised so the crowns break the rampart line, and
    // a NEAR sector cluster added on the spoke's own bearing (the
    // verdant-2 Far Balcony device: the ring bands alone all hide below
    // the sightline from inside the bowl).
    // Round 3: the near cluster taller and MILKIER — at fade 0.3 the r2
    // heads read as black teeth floating on the crest line; distance
    // goes milky-bright, never dark (the value key, held).
    // Round 4: EVERY band moved behind ring 1 (radius 246) and grown so
    // the crowns break its crest — the r3 provinces-end pose caught the
    // in-bowl sector cluster's waists crossing the fog gap between the
    // rampart and the rings as hanging teeth, and the two ring bands'
    // tops (−8…+14 against ring crests of 13–27) never showed at all.
    // Feet at FOOT stay under every ring's own foot: no bottom edge can
    // ever hang.
    { rFrom: 252, rTo: 268, count: 18, fade: 0.4, hMin: 68, hMax: 86 },
    { rFrom: 272, rTo: 292, count: 14, fade: 0.55, hMin: 78, hMax: 100 },
    {
      rFrom: 250,
      rTo: 272,
      count: 8,
      fade: 0.48,
      hMin: 72,
      hMax: 92,
      sector: { at: VERDANT3_SLOT.azimuth, half: 0.55 },
    },
  ];
  // The Province's End balcony keeps its clear stage: no near card may
  // crowd the last stand itself.
  const balcony = worldOf(1608, -8);
  const gapAt = VERDANT3_SLOT.azimuth + Math.PI;
  for (const [band, spec] of bands.entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x3f8a76),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    cardMaterials.push({ material, fade: spec.fade });
    const mesh = new InstancedMesh(mesaCardGeometry(), material, spec.count);
    mesh.name = `verdant3-distance-mesas-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    const ink = new Color();
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = spec.sector
        ? spec.sector.at + random.signed(spec.sector.half)
        : random.range(0, Math.PI * 2);
      const inkJitter = random.range(0.86, 1.14);
      if (angleBetween(theta, gapAt) < GAP_HALF + 0.1) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      const px = CENTER_X + Math.cos(theta) * r;
      const pz = CENTER_Z + Math.sin(theta) * r;
      if (spec.sector && Math.hypot(px - balcony.x, pz - balcony.z) < 45) {
        continue;
      }
      dummy.position.set(px, FOOT + 2, pz);
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.03));
      dummy.scale.set(
        random.range(1.0, 1.6),
        random.range(spec.hMin, spec.hMax) / CARD_HEIGHT,
        random.range(1.0, 1.6),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      ink.setRGB(inkJitter, inkJitter, inkJitter);
      mesh.setColorAt(placed, ink);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }

  // ─── THE MOTHER MESA ───────────────────────────────────────────────────────
  // One colossal crowned silhouette on the spoke's own bearing: the
  // horizon the province was always swimming toward. Nearest ink of the
  // painting, tallest thing on the skyline.
  {
    const material = new MeshBasicMaterial({
      color: new Color(0x39816e),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    cardMaterials.push({ material, fade: 0.44 });
    const geometry = motherMesaGeometry();
    const mesh = new Mesh(geometry, material);
    mesh.name = "verdant3-distance-mother";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const theta = VERDANT3_SLOT.azimuth;
    // Round 2: the Mother's foot lifted from the curtain floor — at
    // FOOT+2 her whole 57 m stood below the rampart sightline. Round 3:
    // −18 → −10 so her plateau and grove ride WELL above the crest.
    mesh.position.set(
      CENTER_X + Math.cos(theta) * 252,
      -10,
      CENTER_Z + Math.sin(theta) * 252,
    );
    mesh.rotation.y = -theta + Math.PI / 2;
    geometry.computeBoundingSphere();
    meshes.push(mesh);
  }

  return { meshes };
}

/** The card's authored height; instances scale it to their drawn height. */
const CARD_HEIGHT = 38;

/**
 * One distant garden mesa, crossed silhouette blades: a grounded foot
 * skirt, a waisted column, a broad flat crown with a stepped shoulder,
 * a crown-garden tuft line above the plateau, and four hanging-garden
 * straps falling off the lip.
 */
let mesaCard: BufferGeometry | undefined;
function mesaCardGeometry(): BufferGeometry {
  if (mesaCard) {
    return mesaCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = CARD_HEIGHT;
    const positions = new Float32Array([
      // The foot skirt: the card visibly STANDS.
      -5.2, 0, 0, 5.4, 0, 0, 2.6, h * 0.16, 0,
      -5.2, 0, 0, 2.6, h * 0.16, 0, -2.4, h * 0.15, 0,
      // The waisted column.
      -2.4, h * 0.12, 0, 2.6, h * 0.13, 0, 2.2, h * 0.68, 0,
      -2.4, h * 0.12, 0, 2.2, h * 0.68, 0, -1.8, h * 0.69, 0,
      // The crown flare and plateau: the mesa's flat head.
      -4.6, h * 0.66, 0, 4.8, h * 0.67, 0, 4.0, h * 0.84, 0,
      -4.6, h * 0.66, 0, 4.0, h * 0.84, 0, -3.9, h * 0.83, 0,
      // The plateau's level top with a stepped shoulder.
      -3.9, h * 0.83, 0, 4.0, h * 0.84, 0, 2.8, h * 0.9, 0,
      -3.9, h * 0.83, 0, 2.8, h * 0.9, 0, -3.0, h * 0.89, 0,
      // The crown-garden tuft line above the plateau.
      -2.2, h * 0.88, 0, -0.8, h * 0.89, 0, -1.6, h * 0.99, 0,
      0.2, h * 0.89, 0, 1.6, h * 0.89, 0, 0.8, h * 1.0, 0,
      1.9, h * 0.88, 0, 2.8, h * 0.89, 0, 2.5, h * 0.96, 0,
      // Four hanging-garden straps off the crown lip.
      -4.4, h * 0.68, 0, -3.6, h * 0.68, 0, -4.1, h * 0.4, 0,
      -1.4, h * 0.66, 0, -0.6, h * 0.66, 0, -1.1, h * 0.34, 0,
      1.2, h * 0.66, 0, 2.0, h * 0.66, 0, 1.7, h * 0.38, 0,
      3.7, h * 0.68, 0, 4.5, h * 0.68, 0, 4.2, h * 0.44, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("verdant3 distance mesa blades could not be merged");
  }
  merged.computeBoundingSphere();
  mesaCard = merged;
  return mesaCard;
}

/** The Mother Mesa: one wide crowned silhouette, drawn once. */
function motherMesaGeometry(): BufferGeometry {
  const h = 52;
  const blade = (spin: number): BufferGeometry => {
    const positions = new Float32Array([
      // The grounded skirt, wide as a hill.
      -20, 0, 0, 21, 0, 0, 11, h * 0.2, 0,
      -20, 0, 0, 11, h * 0.2, 0, -10, h * 0.19, 0,
      // The great column.
      -10, h * 0.16, 0, 11, h * 0.17, 0, 8.6, h * 0.66, 0,
      -10, h * 0.16, 0, 8.6, h * 0.66, 0, -8.2, h * 0.67, 0,
      // The crown flare.
      -15, h * 0.64, 0, 15.6, h * 0.65, 0, 13.2, h * 0.82, 0,
      -15, h * 0.64, 0, 13.2, h * 0.82, 0, -13.4, h * 0.81, 0,
      // The level plateau with two stepped shoulders.
      -13.4, h * 0.81, 0, 13.2, h * 0.82, 0, 8.8, h * 0.9, 0,
      -13.4, h * 0.81, 0, 8.8, h * 0.9, 0, -9.4, h * 0.89, 0,
      -9.4, h * 0.89, 0, 8.8, h * 0.9, 0, 4.4, h * 0.95, 0,
      -9.4, h * 0.89, 0, 4.4, h * 0.95, 0, -4.8, h * 0.94, 0,
      // The crown grove: three tuft peaks on the summit garden.
      -6.8, h * 0.93, 0, -3.2, h * 0.94, 0, -5.2, h * 1.06, 0,
      -1.2, h * 0.94, 0, 2.4, h * 0.94, 0, 0.6, h * 1.1, 0,
      3.6, h * 0.93, 0, 6.4, h * 0.93, 0, 5.2, h * 1.02, 0,
      // Six long garden falls off the crown.
      -14.2, h * 0.66, 0, -12.2, h * 0.66, 0, -13.4, h * 0.3, 0,
      -8.0, h * 0.64, 0, -6.2, h * 0.64, 0, -7.3, h * 0.24, 0,
      -2.2, h * 0.63, 0, -0.4, h * 0.63, 0, -1.4, h * 0.32, 0,
      3.0, h * 0.63, 0, 4.8, h * 0.63, 0, 3.8, h * 0.26, 0,
      8.4, h * 0.64, 0, 10.2, h * 0.64, 0, 9.4, h * 0.34, 0,
      12.8, h * 0.66, 0, 14.6, h * 0.66, 0, 13.8, h * 0.42, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2.6)], false);
  if (!merged) {
    throw new Error("verdant3 mother mesa blades could not be merged");
  }
  return merged;
}

/**
 * One ring: a curtain whose top edge is level mesa runs broken by
 * abrupt-but-sloped steps (the terraces' quantised-tread grammar with
 * the widened ramp its fill probe proved out — no razor rectangles).
 */
function cliffRing(layer: CliffLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapAt = VERDANT3_SLOT.azimuth + Math.PI;
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
    const slow = fbm(t * 6, layer.radius * 0.013, { seed: noiseSeed, period: 6, octaves: 2 });
    const raw = slow * 3.2;
    const tread = Math.floor(raw);
    const ramp = smoothstep01((raw - tread - 0.35) / 0.3);
    const stepped = (tread + ramp - 1.6) * layer.stepDepth;
    const wobble =
      (fbm(t * 40, layer.radius, { seed: noiseSeed ^ 0x99, period: 40, octaves: 1 }) - 0.5) * 1.6;
    const top = layer.meanTop + stepped + wobble;

    positions.push(x, FOOT, z, x, FOOT + Math.max(1.4, top - FOOT) * end + 0.2, z);
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
