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
import { SEEDS } from "../../../util/Random";
import { smoothstep01 } from "./GoldenShared";
import { CENTER_X, CENTER_Z, GOLDEN_SLOT } from "./GoldenTerrain";

/**
 * The Hourglass Sea's painted distance: the `DistantReef` idiom
 * re-authored as stacked dune lines — gold near, violet far. Where the
 * pilots' silhouettes were forests and volcano fields, these are dune
 * seas: each ring's top edge is a slow swell of crescent-backed ridges,
 * and there are NO verticals at all — every vertical card the pilots or
 * the early rounds tried either read as a mountain or poked over the
 * Hourglass's rim like a chimney on a roof (rounds 1–2 here). The dune
 * lines are the horizon; the standing-stone motif lives only in the
 * near monoliths.
 *
 * The inks re-derive from `scene.fog` per frame (one hex compare), and
 * each layer carries its own ink so the stack runs gold → violet with
 * red above green throughout. The rings hold an open gap over the
 * saddle's azimuth: the approach's own dune walls close that view.
 */

interface DuneLayer {
  readonly radius: number;
  readonly ridgeBase: number;
  readonly ridgeVary: number;
  readonly fade: number;
  readonly ink: Color;
}

const LAYERS: readonly DuneLayer[] = [
  // Gold near… Grown and darkened in round 2: the round-1 lines were
  // low pale strips that vanished against the shelf.
  { radius: 246, ridgeBase: 8, ridgeVary: 3.4, fade: 0.34, ink: new Color(0.86, 0.7, 0.46) },
  { radius: 264, ridgeBase: 12, ridgeVary: 4.6, fade: 0.52, ink: new Color(0.74, 0.58, 0.58) },
  // …violet far.
  { radius: 286, ridgeBase: 17, ridgeVary: 5.8, fade: 0.66, ink: new Color(0.62, 0.48, 0.68) },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the shelf can show. */
const FOOT = -12;

/** Half-angle of the gap the rings leave over the saddle's approach. */
const GAP_HALF = 0.42;

export function buildGoldenDistance(): { meshes: Mesh[] } {
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
    for (const [index, layer] of LAYERS.entries()) {
      const ink = fog.color.clone().multiply(layer.ink);
      materials[index]?.color.copy(ink).lerp(fog.color, layer.fade);
    }
  };

  for (const [index, layer] of LAYERS.entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x9a8468).lerp(new Color(0x9a8468).multiply(layer.ink), 1 - layer.fade),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
    });
    const geometry = duneRing(layer, SEEDS.regionGolden1 ^ (0xd400 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `hourglass-distance-${index}`;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // No vertical cards. Round 1's far monoliths poked over the
  // Hourglass's rim like chimneys on a roof; round 2's shorter ones
  // still did. A chasm's up-shots see every horizon, so this region's
  // painted distance carries NO verticals at all — the dune lines are
  // the horizon, and the standing-stone motif lives only in the near
  // monoliths the diver can reach.

  return { meshes };
}

/**
 * One ring: a curtain whose top edge is a slow dune swell — crescent
 * backs drawn as a rolling line with softly peaked crests, no benches
 * and no verticals. The saddle's azimuth sector is skipped; the cut
 * ends taper long into the ground (short ramps read as buildings).
 */
function duneRing(layer: DuneLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapAt = GOLDEN_SLOT.azimuth + Math.PI;
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    if (off < GAP_HALF) {
      column = 0;
      continue;
    }
    // A long taper: shorter ramps stood at the gap's edge as flat-topped
    // blocks that read as buildings (round 1, oasis and flats horizons).
    const end = smoothstep01((off - GAP_HALF) / 0.85);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    const t = i / SEGMENTS;
    // A dune skyline: a rolling swell whose crests are gently sharpened
    // over a long drifting base. The roll's weight went up in round 3 —
    // flat stretches of ridge read as mesas against the backdrop.
    const roll = fbm(t * 6, layer.radius * 0.013, { seed: noiseSeed, period: 6, octaves: 3 }) - 0.5;
    const crest = Math.pow(
      Math.abs(Math.sin(t * Math.PI * 14 + roll * 6)),
      1.5,
    );
    const ridge = layer.ridgeBase + (roll * 1.9 + crest * 0.9) * layer.ridgeVary;

    positions.push(x, FOOT, z, x, FOOT + Math.max(1.4, ridge - FOOT) * end + 0.2, z);
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
