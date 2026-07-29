import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  Mesh,
  MeshBasicMaterial,
  type Scene,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
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
 * The rings hold an open gap over the vale's azimuth: the vale's own walls
 * close that view, and a curtain crossing the approach would put a wall
 * where the diver swims in.
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
  { radius: 246, canopyBase: 8, canopyVary: 3.2, trunks: 26, trunkHeight: 13, fade: 0.4 },
  { radius: 264, canopyBase: 11, canopyVary: 4, trunks: 20, trunkHeight: 16, fade: 0.58 },
  { radius: 286, canopyBase: 14, canopyVary: 5, trunks: 14, trunkHeight: 19, fade: 0.74 },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the shelf can show. */
const FOOT = -12;

/** Green-violet ink: the fog colour taken down with red above green's cut. */
const INK = new Color(0.62, 0.72, 0.58);

/** Half-angle of the gap the rings leave over the vale's approach. */
const GAP_HALF = 0.42;

export function buildVerdantDistance(): { meshes: Mesh[] } {
  const random = new Random(SEEDS.regionVerdant1 ^ 0xd157);
  const meshes: Mesh[] = [];
  const materials: MeshBasicMaterial[] = [];
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
  };

  for (const [index, layer] of LAYERS.entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x53b2bb).lerp(new Color(0x53b2bb).multiply(INK), 1 - layer.fade),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    const geometry = forestRing(layer, random, SEEDS.regionVerdant1 ^ (0xd200 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `verdant-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }
  return { meshes };
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

  const positions: number[] = [];
  const indices: number[] = [];
  let column = 0;

  // The gap faces back down the spoke toward the origin, where the vale
  // comes in: from the disc's centre that is the slot azimuth plus π.
  const gapAt = VERDANT_SLOT.azimuth + Math.PI;
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    if (angleBetween(theta, gapAt) < GAP_HALF) {
      column = 0;
      continue;
    }
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

    positions.push(x, FOOT, z, x, Math.max(1.4, canopy + spike), z);
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
