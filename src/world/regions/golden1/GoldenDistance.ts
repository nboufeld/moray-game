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
import { regionSlot } from "../RegionSlots";
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
 * red above green throughout. The rings hold two open gaps. Over the
 * saddle's azimuth: the approach's own dune walls close that view. And
 * over the OUTBOUND (depth-2) corridor per MASTER R4 — journey-close
 * found the rings un-parted here, so the swim home from the Gilded
 * Shore handover faced all three arcs point-blank (u ≈ 691/709/731 on
 * the spoke, opaque inside the 140 m dissolve window) as a
 * screen-filling amber curtain.
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
  // low pale strips that vanished against the shelf. Variance up again
  // in round 4 — the gilded-shore frame still read one flat line.
  // Bases up a step in round 5: the alpha-dissolved crest reads lower
  // than the drawn line, and the shore frame thinned to one band.
  { radius: 246, ridgeBase: 9, ridgeVary: 4.6, fade: 0.34, ink: new Color(0.86, 0.7, 0.46) },
  { radius: 264, ridgeBase: 14, ridgeVary: 6.2, fade: 0.52, ink: new Color(0.74, 0.58, 0.58) },
  // …violet far.
  { radius: 286, ridgeBase: 22, ridgeVary: 7.8, fade: 0.66, ink: new Color(0.62, 0.48, 0.68) },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the shelf can show. */
const FOOT = -12;

/** Half-angle of the gap the rings leave over the saddle's approach. */
const GAP_HALF = 0.42;

/**
 * Half-angle of the second gap, over the OUTBOUND (depth-2) corridor —
 * the R4 pass pattern (verdant PASS_GAP_HALF / pale GAP_OUT_HALF /
 * smoking GAP_OUT_HALF): distance rings part over the pass corridor on
 * both sides. The pass tongue's half-width at the ring radii is ≤ 43 m
 * (halfWidthFrom 16 at u 630 → halfWidthTo 56 at u 780), an angle of
 * ≤ 0.149 rad from the disc's centre — 0.15 clears the swim-line.
 * The taper stays shorter than the saddle's 1.3 rad: the corridor is
 * seen head-on from the road, not near-tangent, and the RGBA crest fade
 * (round 5) keeps the cut ends from reading as cliff edges.
 */
const GAP_OUT_HALF = 0.15;

/**
 * Conviction fix (re-critique N2, `JOURNEY-great-blue-04`): the western
 * arcs of these rings stand INSIDE great-blue-1's disc (centres 457 m
 * apart; the far ring reaches within 171 m of the neighbour's centre),
 * and once both regions attach naturally the arc hung in the gnomon
 * frame as a hard-edged translucent slab — toggle-proven to
 * `hourglass-distance-*`. The journey-close R0.10 precedent (pale-1 and
 * blue-1 parting over the Calamity march) applied here in world space:
 * columns over the neighbour's country are cut, and the cut's ends
 * dissolve through the row alphas (the kit's endAlpha idiom) instead of
 * running on as an opaque ribbon. Golden-1's own west-rim stands keep
 * their horizon: the cut begins 16 m outside the neighbour's disc.
 */
const BLUE1 = regionSlot("great-blue-1");
const BLUE1_X = Math.cos(BLUE1.azimuth) * BLUE1.centerR;
const BLUE1_Z = Math.sin(BLUE1.azimuth) * BLUE1.centerR;
const BLUE1_CLEAR = BLUE1.radius + 16;

/** 0 inside the neighbour's country, easing to 1 over 30 m outside. */
function blueEase(x: number, z: number): number {
  return smoothstep01((Math.hypot(x - BLUE1_X, z - BLUE1_Z) - BLUE1_CLEAR) / 30);
}

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
      // Round 5: the skyline dissolves upward through an RGBA vertex
      // fade — an opaque ring's hard top edge against the backdrop is
      // what kept reading as masonry however the crests were shaped.
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    // Round 7, toggle-proven and then traced to the camera: the "blocks"
    // that survived every skyline retune were the FAR-PLANE CLIP. The
    // game's camera ends at 160 m and these rings stand 246–286 m from
    // the disc's centre, so from any stand only the near arc renders
    // and the clip slices it off in two hard vertical edges — round 1's
    // "flat-topped blocks", seen truly for the first time. The region
    // may not touch the camera, so the rings dissolve THEMSELVES: alpha
    // runs to zero across 140–157 m of camera distance, safely inside
    // the clip, and the arc now fades into the water the way a painted
    // distance should. Every canonical ring view (gilded-shore's three
    // lines at 103/121/143 m) stays inside the window — the first cut
    // (132–154) took half of the shore's far violet line.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vRingDist;",
        )
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvRingDist = -mvPosition.z;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying float vRingDist;",
        )
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(140.0, 157.0, vRingDist);",
        );
    };
    material.customProgramCacheKey = () => "hourglass-distance-dissolve";
    const geometry = duneRing(layer, SEEDS.regionGolden1 ^ (0xd400 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `hourglass-distance-${index}`;
    // Painter's order, far ring first, all before the falls' veils.
    mesh.renderOrder = -(index + 1) - 2;
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
 * and no verticals. The saddle's azimuth sector is skipped, and so is
 * the outbound pass corridor's (R4); the cut ends taper into the ground
 * (short ramps read as buildings).
 */
function duneRing(layer: DuneLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapAt = GOLDEN_SLOT.azimuth + Math.PI;
  const gapOutAt = GOLDEN_SLOT.azimuth;

  // First pass: the drawn skyline, one ridge height per column.
  const ridges = new Float32Array(SEGMENTS + 1);
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    // A dune skyline: rounded crescent swells over a slow drifting
    // base. Round 4 sharpened the crests (`pow(|sin|, 1.5)`) for
    // variance and got a fortress — spikes over a flat base read as a
    // crenellated wall with turrets from across the disc (proven by
    // mesh toggle in round 4's critique). Two integer-period sines
    // seam nowhere.
    const roll =
      fbm(t * 11, layer.radius * 0.013, { seed: noiseSeed, period: 11, octaves: 3 }) - 0.5;
    const swell =
      Math.sin(t * Math.PI * 2 * 15 + roll * 5) * 0.55 +
      Math.sin(t * Math.PI * 2 * 4 + (noiseSeed % 7)) * 0.35;
    // The base itself undulates over long arcs: seen near-tangent a
    // ring's crests compress into their own max, and a constant base
    // rules a flat line across the frame (round 5's ray-crossing).
    const base = layer.ridgeBase * (0.82 + 0.36 * Math.sin(t * Math.PI * 2 * 3 + (noiseSeed % 5)));
    ridges[i] = base + (roll * 1.7 + swell) * layer.ridgeVary;
  }

  // Round 7: hold the skyline to a dune's repose BY CONSTRUCTION. The
  // `roll * 5` phase term folds the 15-cycle swell into local sawtooth
  // cliffs (measured: 9.2 m steps over an 8.2 m column on the far
  // ring), and a >45° run at three hundred metres reads as the vertical
  // edge of a building — round 6's ray-crossing blocks, toggle-proven
  // to be these rings. A two-direction relaxation plane the cliffs off
  // and leaves every crest that already respected the slope.
  const arc = (Math.PI * 2 * layer.radius) / SEGMENTS;
  const maxStep = arc * 0.42;
  for (let i = 1; i <= SEGMENTS; i++) {
    ridges[i] = Math.min(ridges[i]!, ridges[i - 1]! + maxStep);
  }
  for (let i = SEGMENTS - 1; i >= 0; i--) {
    ridges[i] = Math.min(ridges[i]!, ridges[i + 1]! + maxStep);
  }
  // The ring seams at t = 0 ≡ 1 (the noise is periodic), so relax the
  // join the same way the interior columns were.
  ridges[0] = ridges[SEGMENTS] = Math.min(ridges[0]!, ridges[SEGMENTS]!);

  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const off = angleBetween(theta, gapAt);
    const offOut = angleBetween(theta, gapOutAt);
    const bx = CENTER_X + Math.cos(theta) * layer.radius;
    const bz = CENTER_Z + Math.sin(theta) * layer.radius;
    const overBlue = blueEase(bx, bz);
    if (off < GAP_HALF || offOut < GAP_OUT_HALF || overBlue <= 0) {
      column = 0;
      continue;
    }
    // A long taper: shorter ramps stood at the gap's edge as flat-topped
    // blocks that read as buildings (round 1, oasis and flats horizons).
    // Lengthened again in round 5 — seen near-tangent, a 0.85 rad ramp
    // compresses into a vertical cliff edge. The outbound cut's taper is
    // shorter (0.5): it is seen head-on down the road, and the canonical
    // gilded-shore three-line view lives just off its shoulder — a long
    // ramp would thin those lines to nothing.
    const end = Math.min(
      smoothstep01((off - GAP_HALF) / 1.3),
      smoothstep01((offOut - GAP_OUT_HALF) / 0.5),
      overBlue,
    );
    const x = bx;
    const z = bz;

    // Three rows: opaque foot, near-opaque shoulder, transparent crest
    // — the drawn skyline survives (the perceived edge rides the fade)
    // but no hard line ever meets the water. The neighbour cut's ends
    // ALSO dissolve through the alphas (a height taper alone leaves an
    // opaque ribbon running into the cut — the pale-10 class).
    const top = FOOT + Math.max(1.4, ridges[i]! - FOOT) * end + 0.2;
    const mid = FOOT + (top - FOOT) * 0.72;
    positions.push(x, FOOT, z, x, mid, z, x, top, z);
    colors.push(1, 1, 1, 0.95 * overBlue, 1, 1, 1, 0.85 * overBlue, 1, 1, 1, 0);
    if (column > 0) {
      const a = positions.length / 3 - 6;
      indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      indices.push(a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
    column++;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
