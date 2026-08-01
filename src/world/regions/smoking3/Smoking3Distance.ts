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
import { LV_SEEDS, smoothstep01 } from "./Smoking3Shared";
import { CENTER_X, CENTER_Z, SMOKING3_SLOT } from "./Smoking3Terrain";

/**
 * The Lantern Vigil's painted distance — the spoke's TERMINUS: this
 * region owns the province's final horizon, and the horizon is the
 * story's last line. Three ranks of low night hills (rolling ridge
 * silhouettes, broken by the occasional far tower) ring the country;
 * beyond them stand the distant lanterns — narrow bellied spires, each
 * with one warm lit window baked into its card — the lights going on
 * past the world's edge; and over the outbound sector, where the road
 * ends at the Morning Vent, THE EMBER DAWN: a low warm band of light
 * rising behind the hills, the province's own morning breaking beyond
 * the rim. The hills kneel slightly in that sector so the dawn shows.
 *
 * The inks re-derive from `scene.fog` per frame (one hex compare), so
 * the far country never detaches from the mood hook's water. Red is
 * held above green in the ink: the distance reads violet-warm, never
 * murk. The rings hold ONE gap — over the inbound pass corridor
 * (MASTER R4) — because nothing lies beyond the terminus to part for.
 */

interface HillLayer {
  readonly radius: number;
  readonly hillBase: number;
  readonly hillVary: number;
  readonly fade: number;
}

const LAYERS: readonly HillLayer[] = [
  { radius: 246, hillBase: 7, hillVary: 3.2, fade: 0.52 },
  { radius: 264, hillBase: 10, hillVary: 4.2, fade: 0.68 },
  { radius: 286, hillBase: 14, hillVary: 5.2, fade: 0.8 },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the country can show. */
const FOOT = -28;

/** Iron-amber night ink: red above green, violet in the cut. */
const INK = new Color(0.7, 0.58, 0.7);

/** Half-angle of the gap the rings leave over the inbound corridor. */
const GAP_HALF = 0.42;

/** The Ember Dawn's sector, about the outbound azimuth. R2: the band
 *  stands BETWEEN the second and third rings (r1 put it beyond every
 *  curtain and the curtains occluded it whole), and its glow peaks
 *  above the kneeling hill line. */
const DAWN_HALF = 1.0;
const DAWN_RADIUS = 276;

export function buildSmoking3Distance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionSmoking3 ^ LV_SEEDS.distance);
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
      color: new Color(0x80645e).lerp(new Color(0x80645e).multiply(INK), 1 - layer.fade),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    const geometry = hillRing(layer, SEEDS.regionSmoking3 ^ (0xd500 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `vigil-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // The distant lanterns: instanced silhouette cards in two ink bands,
  // crossed blades so they read from every azimuth — each carrying one
  // warm lit window, the lights going on past the edge of the world.
  for (const [band, spec] of [
    { rFrom: 242, rTo: 256, count: 14, fade: 0.54, hMin: 18, hMax: 30 },
    { rFrom: 262, rTo: 282, count: 11, fade: 0.74, hMin: 24, hMax: 38 },
  ].entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x635052),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      // The lit window and the crown crust ride the card's vertex
      // colours — zero draws, and every horizon carries the region's
      // whole value story: dark glass, one warm light inside.
      vertexColors: true,
    });
    cardMaterials.push({ material, fade: spec.fade });
    const mesh = new InstancedMesh(lanternCardGeometry(), material, spec.count);
    mesh.name = `vigil-distance-lanterns-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    const gapAt = SMOKING3_SLOT.azimuth + Math.PI;
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = random.range(0, Math.PI * 2);
      // Wide margin off the gap: a lone card on a taper's shoulder
      // reads as a rooftop palm (the Smoulder's rounds 1–4 lesson).
      if (angleBetween(theta, gapAt) < GAP_HALF + 0.5) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      dummy.position.set(CENTER_X + Math.cos(theta) * r, FOOT + 2, CENTER_Z + Math.sin(theta) * r);
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.04));
      dummy.scale.set(
        random.range(1.4, 2.2),
        random.range(spec.hMin, spec.hMax) / CARD_HEIGHT,
        random.range(1.4, 2.2),
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

  // ─── THE EMBER DAWN ─────────────────────────────────────────────────────
  meshes.push(buildDawnBand());

  return { meshes };
}

/** The card's authored height; instances scale it to their drawn height. */
const CARD_HEIGHT = 20;

/**
 * One distant lantern: two crossed silhouette blades — a narrow tower
 * with a swollen belly and a small crown — with a lit window baked
 * into the belly's vertex colour.
 */
let lanternCard: BufferGeometry | undefined;
function lanternCardGeometry(): BufferGeometry {
  if (lanternCard) {
    return lanternCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = CARD_HEIGHT;
    // Foot, belly, throat, crown — the near lanterns' silhouette at
    // horizon scale, fan-triangulated per band.
    const positions = new Float32Array([
      // The foot.
      -2.2, 0, 0, 2.2, 0, 0, 1.6, h * 0.18, 0,
      -2.2, 0, 0, 1.6, h * 0.18, 0, -1.6, h * 0.18, 0,
      // The belly, widest mid-height.
      -1.6, h * 0.18, 0, 1.6, h * 0.18, 0, 2.6, h * 0.45, 0,
      -1.6, h * 0.18, 0, 2.6, h * 0.45, 0, -2.6, h * 0.45, 0,
      -2.6, h * 0.45, 0, 2.6, h * 0.45, 0, 1.2, h * 0.7, 0,
      -2.6, h * 0.45, 0, 1.2, h * 0.7, 0, -1.2, h * 0.7, 0,
      // The throat.
      -1.2, h * 0.7, 0, 1.2, h * 0.7, 0, 0.8, h * 0.86, 0,
      -1.2, h * 0.7, 0, 0.8, h * 0.86, 0, -0.8, h * 0.86, 0,
      // The crown.
      -0.8, h * 0.86, 0, 0.8, h * 0.86, 0, 1.1, h * 0.93, 0,
      -0.8, h * 0.86, 0, 1.1, h * 0.93, 0, -1.1, h * 0.93, 0,
      -1.1, h * 0.93, 0, 1.1, h * 0.93, 0, 0, h * 1.0, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("vigil distance card blades could not be merged");
  }
  // The window: mid-belly leans warm-bright; the crown lifts faintly
  // pale; the foot sinks — the region's story on every horizon.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i) / CARD_HEIGHT;
    const window = Math.max(0, 1 - Math.abs(y - 0.45) / 0.2);
    const crest = Math.min(1, Math.max(0, (y - 0.86) / 0.14));
    const foot = Math.min(1, Math.max(0, (0.12 - y) / 0.12));
    colors[i * 3] = 1 + window * 0.62 + crest * 0.12 + foot * 0.08;
    colors[i * 3 + 1] = 1 + window * 0.38 + crest * 0.09 - foot * 0.02;
    colors[i * 3 + 2] = 1 - window * 0.08 + crest * 0.04 - foot * 0.08;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  lanternCard = merged;
  return lanternCard;
}

/**
 * One ring: a curtain whose top edge is rolling night hills broken by
 * the occasional far tower. The inbound pass sector is skipped — the
 * ring is an open arc whose cut ends sink into the ground — and the
 * hills kneel across the dawn sector so the light shows behind them.
 */
function hillRing(layer: HillLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapAt = SMOKING3_SLOT.azimuth + Math.PI;
  const dawnAt = SMOKING3_SLOT.azimuth;
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    if (off < GAP_HALF) {
      column = 0;
      continue;
    }
    // A long taper into the gap, so the cut ends never read as towers.
    const end = smoothstep01((off - GAP_HALF) / 0.55);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    // Rolling hills at two scales, one occasional tower.
    const raw = fbm(t * 7, layer.radius * 0.01, { seed: noiseSeed, period: 7, octaves: 3 }) - 0.5;
    const roll = fbm(t * 21, 0.4, { seed: noiseSeed ^ 0x33, period: 13, octaves: 2 }) - 0.5;
    const tower = smoothstep01(
      (fbm(t * 41, 0.7, { seed: noiseSeed ^ 0x77, period: 19, octaves: 2 }) - 0.78) / 0.05,
    );
    // The hills kneel across the dawn sector.
    const dawnOff = angleBetween(theta, dawnAt);
    const kneel = 1 - 0.45 * (1 - smoothstep01((dawnOff - DAWN_HALF * 0.7) / 0.5));
    const hill =
      (layer.hillBase + (raw * 1.4 + roll * 0.6) * layer.hillVary + tower * layer.hillBase * 0.7) *
      kneel;

    positions.push(x, FOOT, z, x, FOOT + Math.max(1.4, hill - FOOT) * end + 0.2, z);
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

/**
 * The Ember Dawn: an additive band of warm light standing beyond the
 * hills across the outbound sector — brightest low and centred, alpha
 * dying at its top and ends, `fog: false` with a baked gradient (an
 * additive mark never inherits the mood, so its values are authored
 * dim). It rises exactly behind the Morning Vent: the column below,
 * the dawn beyond — one light, told twice.
 */
function buildDawnBand(): Mesh {
  const dawnAt = SMOKING3_SLOT.azimuth;
  const columns = 48;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const top = 24;
  const rows = 8;
  for (let i = 0; i <= columns; i++) {
    const t = i / columns;
    const theta = dawnAt + (t * 2 - 1) * DAWN_HALF;
    const x = CENTER_X + Math.cos(theta) * DAWN_RADIUS;
    const z = CENTER_Z + Math.sin(theta) * DAWN_RADIUS;
    const endFade = smoothstep01(Math.min(t, 1 - t) / 0.24);
    for (let j = 0; j <= rows; j++) {
      const yT = j / rows;
      const y = FOOT + (top - FOOT) * yT;
      positions.push(x, y, z);
      // Brightest just over the kneeling hill line (~+3 m), dying at
      // both ends so the band has no edge.
      const band = Math.pow(Math.max(0, 1 - Math.abs(yT - 0.6) / 0.45), 2.0);
      const glow = band * endFade;
      colors.push(glow * 0.7, glow * 0.45, glow * 0.2);
    }
  }
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const b = a + rows + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "vigil-ember-dawn";
  mesh.renderOrder = 1;
  return mesh;
}

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
