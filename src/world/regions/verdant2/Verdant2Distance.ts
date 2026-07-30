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
import { smoothstep01 } from "./Verdant2Shared";
import { CENTER_X, CENTER_Z, VERDANT2_SLOT } from "./Verdant2Terrain";

/**
 * The Emerald Terraces' painted distance: stacked green *cliff-lines* —
 * the promise of depth 3. Where the kelp sea's horizon is a canopy line,
 * this one is terraced stone country going on forever: three rings whose
 * skylines are runs of level mesa broken by abrupt steps, each farther
 * ring sitting *lower* — the eye reads a country still descending. A
 * fringe of hanging-garden pillars (instanced silhouette cards: a lip, a
 * fall of ribbons) stands on the ring radii to say the gardens continue
 * too.
 *
 * The inks re-derive from `scene.fog` per frame (one hex compare), the
 * pilot's own device, because the fog here is the def's deep green and a
 * detached distance would break the moment the mood moved. Red is held
 * above green's cut so the far country reads violet-green, never
 * electric.
 *
 * The rings hold an open gap over the pass's azimuth: the stair's walls
 * close that view, and a curtain across the pass would wall the way in.
 */

interface CliffLayer {
  readonly radius: number;
  /** The mesa band's centre height (absolute y) and its step depth. */
  readonly meanTop: number;
  readonly stepDepth: number;
  readonly fade: number;
}

// Tops stand well above the rim rampart (the disc's own fade back to
// dune level, which climbs to y ≈ 0 by rc ≈ 210): from the sunken
// country every outward view is rampart first, and the cliff-lines must
// clear it to exist. Farther rings stand taller — a country of terraces
// climbing away into the green.
// Round 2: fades cut hard (the round-1 rings inked at fog×0.77 read as a
// wall of fog) and the tops raised so the skyline clears the rampart's
// sightline from the sunken country.
const LAYERS: readonly CliffLayer[] = [
  { radius: 246, meanTop: 10, stepDepth: 5, fade: 0.22 },
  { radius: 266, meanTop: 17, stepDepth: 4.5, fade: 0.42 },
  { radius: 288, meanTop: 24, stepDepth: 4, fade: 0.6 },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the basin can show. */
const FOOT = -50;

/** Green-violet ink: the fog colour taken down, red above green's cut. */
const INK = new Color(0.44, 0.54, 0.43);

/** Half-angle of the gap the rings leave over the pass's approach. */
const GAP_HALF = 0.42;

export function buildVerdant2Distance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionVerdant2 ^ 0xd158);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const materials: MeshBasicMaterial[] = [];
  const pillarMaterials: { material: MeshBasicMaterial; fade: number }[] = [];
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
    for (const { material, fade } of pillarMaterials) {
      material.color.copy(ink).lerp(fog.color, fade);
    }
  };

  for (const [index, layer] of LAYERS.entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x4f9a86),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    const geometry = cliffRing(layer, SEEDS.regionVerdant2 ^ (0xd300 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `verdant2-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The hanging-garden pillars: instanced silhouettes — a stone lip with
  // a fall of ribbon straps below it — standing on the ring radii in two
  // bands. They carry the verticals the rings' skylines cannot.
  // The third band is the Far Balcony's own promise (round 4): a near
  // cluster in the basin sector beyond the balcony, tall enough that its
  // heads break the rampart sightline from the balcony's −24 m — the
  // ring bands' pillars all hide below that line from inside the bowl.
  interface PillarBand {
    readonly rFrom: number;
    readonly rTo: number;
    readonly count: number;
    readonly fade: number;
    readonly hMin: number;
    readonly hMax: number;
    /** Restrict placement to this angular sector, instead of avoiding the gap. */
    readonly sector?: { readonly at: number; readonly half: number };
  }
  const bands: readonly PillarBand[] = [
    { rFrom: 242, rTo: 258, count: 22, fade: 0.26, hMin: 26, hMax: 38 },
    { rFrom: 262, rTo: 284, count: 16, fade: 0.45, hMin: 28, hMax: 42 },
    // Sector narrowed in round 5: at ±0.5 the cluster's heads floated
    // into mistfall-above's sky as dark chimneys.
    {
      rFrom: 132,
      rTo: 172,
      count: 9,
      fade: 0.34,
      hMin: 30,
      hMax: 44,
      sector: { at: VERDANT2_SLOT.azimuth + 0.34, half: 0.38 },
    },
  ];
  for (const [band, spec] of bands.entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x3f8f7a),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    pillarMaterials.push({ material, fade: spec.fade });
    const mesh = new InstancedMesh(pillarCardGeometry(), material, spec.count);
    mesh.name = `verdant2-distance-pillars-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    const gapAt = VERDANT2_SLOT.azimuth + Math.PI;
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = spec.sector
        ? spec.sector.at + random.signed(spec.sector.half)
        : random.range(0, Math.PI * 2);
      if (angleBetween(theta, gapAt) < GAP_HALF + 0.1) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      dummy.position.set(
        CENTER_X + Math.cos(theta) * r,
        FOOT + 2,
        CENTER_Z + Math.sin(theta) * r,
      );
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.04));
      dummy.scale.set(
        random.range(1.0, 1.5),
        random.range(spec.hMin, spec.hMax) / PILLAR_CARD_HEIGHT,
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
const PILLAR_CARD_HEIGHT = 36;

/**
 * One distant garden pillar: two crossed silhouette blades — a squared
 * terrace head on a narrower stem, with three ribbon straps falling from
 * the lip. The drawing is the whole mark.
 */
let pillarCard: BufferGeometry | undefined;
function pillarCardGeometry(): BufferGeometry {
  if (pillarCard) {
    return pillarCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = PILLAR_CARD_HEIGHT;
    const positions = new Float32Array([
      // The stem: a leaning column.
      -1.6, 0, 0, 1.6, 0, 0, 2.0, h * 0.62, 0,
      -1.6, 0, 0, 2.0, h * 0.62, 0, -1.1, h * 0.63, 0,
      // The terrace head: a wide flat cap.
      -3.6, h * 0.6, 0, 4.0, h * 0.62, 0, 3.6, h * 0.78, 0,
      -3.6, h * 0.6, 0, 3.6, h * 0.78, 0, -3.2, h * 0.76, 0,
      // A second, smaller cap on top — stacked country.
      -2.0, h * 0.76, 0, 2.4, h * 0.77, 0, 2.0, h * 0.9, 0,
      -2.0, h * 0.76, 0, 2.0, h * 0.9, 0, -1.7, h * 0.89, 0,
      // Three ribbon straps falling from the head's lip.
      -3.2, h * 0.62, 0, -2.4, h * 0.62, 0, -3.0, h * 0.3, 0,
      0.4, h * 0.6, 0, 1.2, h * 0.6, 0, 0.9, h * 0.26, 0,
      2.8, h * 0.63, 0, 3.6, h * 0.63, 0, 3.4, h * 0.36, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("verdant2 distance pillar blades could not be merged");
  }
  merged.computeBoundingSphere();
  pillarCard = merged;
  return pillarCard;
}

/**
 * One ring: a curtain whose top edge is a *terraced* skyline — level
 * mesa runs broken by abrupt steps, made by quantising a slow noise into
 * treads and easing only the shortest ramp between them. The pass's
 * azimuth sector is skipped; the arc ends sink into the fog's floor.
 */
function cliffRing(layer: CliffLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapAt = VERDANT2_SLOT.azimuth + Math.PI;
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
    // Quantise into treads: the fractional part is pushed to the nearest
    // tread with a narrow ramp, so the skyline holds level then steps.
    const raw = slow * 3.2;
    const tread = Math.floor(raw);
    const ramp = smoothstep01((raw - tread - 0.42) / 0.16);
    const stepped = (tread + ramp - 1.6) * layer.stepDepth;
    const wobble =
      (fbm(t * 40, layer.radius, { seed: noiseSeed ^ 0x99, period: 40, octaves: 1 }) - 0.5) * 0.8;
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
