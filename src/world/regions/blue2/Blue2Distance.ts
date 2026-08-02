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
import {
  SoftRingBuilder,
  applyCurtainDissolve,
  endAlpha,
  softCurtainMaterial,
} from "../kit/HorizonCurtain";
import { B2_SEEDS, smoothstep01 } from "./Blue2Shared";
import { BLUE2_SLOT, CENTER_X, CENTER_Z } from "./Blue2Terrain";

/**
 * The Deep Steps' painted distance: the amphitheatre going on — ridge
 * upon violet ridge of further shelf-country, each a step paler (the
 * Drop Plains' round-9 ink law inherited whole: near-neutral violets,
 * red a nose above green, level with blue — NEVER cobalt, and never
 * maroon). The skyline is long and reposeful (the Carillon's repose
 * relaxation kept: no column step exceeds arc × 0.42), and each ring
 * dissolves itself across 140–157 m of camera distance, inside the
 * 160 m clip.
 *
 * The rings part over BOTH corridors (MASTER R4): a wide gap over the
 * inbound World's-Edge azimuth — the Drop Plains' own painted deep
 * owns that view — and a narrow gap with a SHORT taper (the Carillon's
 * joint-constraint arithmetic, inherited: 0.16, so the flanks stand
 * opaque inside the dissolve window) over the outbound azimuth where
 * great-blue-3's pass is RESERVED.
 */

interface StepLayer {
  readonly radius: number;
  readonly ridgeBase: number;
  readonly ridgeVary: number;
  readonly fade: number;
  readonly ink: Color;
}

// Bases raised in round 2: the horns-promise arithmetic (a deep-stand
// camera 17 m below the crest needs ring tops clearing 0.28 rad).
const LAYERS: readonly StepLayer[] = [
  { radius: 246, ridgeBase: 14, ridgeVary: 4.2, fade: 0.3, ink: new Color(0.72, 0.6, 0.78) },
  { radius: 265, ridgeBase: 20, ridgeVary: 5.6, fade: 0.5, ink: new Color(0.82, 0.7, 0.86) },
  { radius: 288, ridgeBase: 28, ridgeVary: 7.2, fade: 0.66, ink: new Color(0.92, 0.82, 0.94) },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the amphitheatre can show. */
const FOOT = -56;

/** Half-angle of the gap over the inbound World's-Edge corridor. */
const GAP_IN_HALF = 0.4;
/** Half-angle of the gap reserving the outbound depth-3 corridor. */
const GAP_OUT_HALF = 0.17;

/** Foot/crown tints: a curtain is never one value (the canyon-curtain
 *  lesson) — feet fall toward the deep's violet, crowns go milky. */
const FOOT_TINT: readonly [number, number, number] = [0.52, 0.52, 0.68];
const MID_TINT: readonly [number, number, number] = [0.85, 0.82, 0.92];
const CROWN_TINT: readonly [number, number, number] = [1.14, 1.1, 1.06];

/**
 * THE HORNSGATE (conviction wave, critic #1 wall-crossing): the beat
 * was cured of its razor but the look back through the Worldwall's
 * notch read as empty teal — the door the whole province climbs
 * through had no door-ness. Two ranks of layered wall-fin masses now
 * rise from the Worldwall's crest flanking the crossing corridor:
 * titanic jambs nearest the notch stepping down through lesser fins,
 * the near rank a step darker, the far rank paler — the Horns' spires
 * keep the sky (fin crowns cap at +6.4, under the horn crowns and
 * under the surface glow), the fins give them shoulders. The corridor
 * itself stays open (MASTER R4): the ranks gap over it, the inner
 * edges dissolve through the row alphas, and a near guard melts any
 * fin the swim-line grazes.
 */
interface GateRank {
  readonly radius: number;
  /** Peak crest height of the inner jamb, absolute y. */
  readonly crest: number;
  readonly ink: Color;
  readonly fade: number;
  /** Fin masses: [centre s, weight, width] out from the jamb. Round 2:
   *  the ranks carry DIFFERENT fin stations — the r1 ranks shared one
   *  profile and read as two parallel glass slabs from the crossing. */
  readonly fins: readonly (readonly [number, number, number])[];
  /** Half-angle of this rank's opening over the reserved corridor.
   *  Round 3: PER RANK — with one shared gap the two jambs stood 13 m
   *  apart on the same bearing, and from inside the notch they
   *  projected as two parallel glass blades along the frame's top
   *  edge. The far rank now opens wider and stands deeper, so the two
   *  inner edges diverge on screen instead of doubling. */
  readonly gapHalf: number;
}

const GATE_RANKS: readonly GateRank[] = [
  {
    radius: 179,
    crest: 6.4,
    ink: new Color(0.52, 0.44, 0.66),
    fade: 0.1,
    gapHalf: 0.09,
    fins: [
      [0.07, 1.0, 0.075],
      [0.4, 0.66, 0.1],
      [0.74, 0.42, 0.12],
    ],
  },
  {
    radius: 206,
    crest: 4.6,
    ink: new Color(0.8, 0.68, 0.84),
    fade: 0.42,
    gapHalf: 0.17,
    fins: [
      [0.2, 1.0, 0.09],
      [0.55, 0.6, 0.12],
      [0.88, 0.36, 0.1],
    ],
  },
];
/** The gate arcs' outer reach off the outbound azimuth. */
const GATE_SPAN = 0.44;
/** The fins' feet, buried down the Worldwall's outer face. */
const GATE_FOOT = -34;
const GATE_FOOT_TINT: readonly [number, number, number] = [0.5, 0.49, 0.66];
const GATE_CREST_TINT: readonly [number, number, number] = [1.16, 1.1, 1.05];

export function buildBlue2Distance(): { meshes: Mesh[] } {
  const meshes: Mesh[] = [];
  const materials: MeshBasicMaterial[] = [];
  const inked: { material: MeshBasicMaterial; ink: Color; fade: number }[] = [];
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
    for (const entry of inked) {
      const ink = fog.color.clone().multiply(entry.ink);
      entry.material.color.copy(ink).lerp(fog.color, entry.fade);
    }
  };

  for (const [index, layer] of LAYERS.entries()) {
    const material = new MeshBasicMaterial({
      color: new Color(0x6f6a90).lerp(new Color(0x6f6a90).multiply(layer.ink), 1 - layer.fade),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    // The self-dissolve: alpha to zero across 140–157 m of camera
    // distance, safely inside the 160 m clip.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vRingDist;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvRingDist = -mvPosition.z;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vRingDist;")
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(140.0, 157.0, vRingDist);",
        );
    };
    material.customProgramCacheKey = () => "blue2-distance-dissolve";
    const geometry = stepRing(layer, SEEDS.regionBlue2 ^ (B2_SEEDS.distance + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `deepsteps-distance-${index}`;
    mesh.renderOrder = -(index + 1) - 2;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  // ── THE HORNSGATE's fin ranks. ──
  for (const [index, rank] of GATE_RANKS.entries()) {
    const material = softCurtainMaterial({ color: 0x5a5480 });
    applyCurtainDissolve(material, {
      nearFrom: 10,
      nearTo: 22,
      cacheKey: "deepsteps-hornsgate-dissolve",
    });
    inked.push({ material, ink: rank.ink, fade: rank.fade });
    const geometry = gateFins(rank, SEEDS.regionBlue2 ^ (0xd471 + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `deepsteps-hornsgate-${index}`;
    // After the step rings (the gate stands nearer than every ring).
    mesh.renderOrder = -1 - index;
    meshes.push(mesh);
  }

  return { meshes };
}

/**
 * One gate rank: fin masses flanking the outbound corridor on both
 * sides — a tall jamb at the notch, lesser fins stepping down and out,
 * the troughs between them dropping below the Worldwall's own crest so
 * the wall's terrain silhouette owns the gaps. Inner edges dissolve
 * fast (a gate wants vertical jambs, but a raw cut is the razor sin);
 * outer ends sink and fade long.
 */
function gateFins(rank: GateRank, noiseSeed: number): BufferGeometry {
  const builder = new SoftRingBuilder();
  const gapOut = BLUE2_SLOT.azimuth;
  const count = 140;
  const bell = (s: number, at: number, width: number): number => {
    const d = (s - at) / width;
    return Math.exp(-d * d);
  };

  for (let i = 0; i <= count; i++) {
    const off = -GATE_SPAN + (i / count) * GATE_SPAN * 2;
    if (Math.abs(off) < rank.gapHalf) {
      builder.gap();
      continue;
    }
    // s: 0 at the corridor's jamb, 1 at the rank's outer end.
    const s = (Math.abs(off) - rank.gapHalf) / (GATE_SPAN - rank.gapHalf);
    const theta = gapOut + off;
    const x = CENTER_X + Math.cos(theta) * rank.radius;
    const z = CENTER_Z + Math.sin(theta) * rank.radius;

    let fins = 0;
    for (const [at, weight, width] of rank.fins) {
      fins = Math.max(fins, bell(s, at, width) * weight);
    }
    const rough =
      (fbm(s * 2.7 + (off > 0 ? 4.1 : 0.3), 0.53, {
        seed: noiseSeed,
        period: 3,
        octaves: 2,
      }) -
        0.5) *
      0.1;
    // The troughs fall to −7: below the wall's own milky crest, so
    // between the fins the terrain silhouette shows, not a bench.
    const inner = smoothstep01(s / 0.045);
    const outer = 1 - smoothstep01((s - 0.82) / 0.16);
    const crest = -7 + (rank.crest + 7) * Math.min(1, fins + rough) * inner * outer;

    const runnel =
      fbm(s * 4.6 + (off > 0 ? 2.2 : 0), 0.29, {
        seed: noiseSeed ^ 0x6d13,
        period: 4,
        octaves: 2,
      }) - 0.5;
    const shoulder: [number, number, number] = [
      (GATE_FOOT_TINT[0] + GATE_CREST_TINT[0]) * 0.5 * (1 + runnel * 0.28),
      (GATE_FOOT_TINT[1] + GATE_CREST_TINT[1]) * 0.5 * (1 + runnel * 0.24),
      (GATE_FOOT_TINT[2] + GATE_CREST_TINT[2]) * 0.5 * (1 + runnel * 0.18),
    ];
    const end = inner * outer;
    // Round 3: the jamb hangs over the Worldwall's fall at the notch,
    // where its full-ink foot row terminated in a straight hard edge —
    // the foot fades to zero across the first reach off the corridor
    // and grounds again once the wall's own terrain covers it.
    const footAlpha = endAlpha(end) * smoothstep01((s - 0.05) / 0.16);
    builder.column(x, z, GATE_FOOT, GATE_FOOT + Math.max(2, crest - GATE_FOOT) * (0.35 + 0.65 * end), {
      alpha: endAlpha(end),
      footAlpha,
      tints: [GATE_FOOT_TINT, shoulder, GATE_CREST_TINT],
    });
  }

  return builder.build();
}

/**
 * One ring: a curtain whose top edge is a slow shelf-country swell —
 * long level runs falling away in soft shoulders, both pass sectors
 * skipped (long taper in, short taper out).
 */
function stepRing(layer: StepLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapIn = BLUE2_SLOT.azimuth + Math.PI;
  const gapOut = BLUE2_SLOT.azimuth;

  const ridges = new Float32Array(SEGMENTS + 1);
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const roll =
      fbm(t * 11, layer.radius * 0.013, { seed: noiseSeed, period: 11, octaves: 3 }) - 0.5;
    // Shelf country: clipped crests hold near-level runs before the
    // fall — steps, not peaks.
    const wave =
      Math.sin(t * Math.PI * 2 * 11 + roll * 3) * 0.6 +
      Math.sin(t * Math.PI * 2 * 4 + (noiseSeed % 7)) * 0.4;
    const table = Math.min(0.68, wave) / 0.68;
    const base = layer.ridgeBase * (0.86 + 0.28 * Math.sin(t * Math.PI * 2 * 3 + (noiseSeed % 5)));
    ridges[i] = base + (roll * 1.5 + table) * layer.ridgeVary;
  }

  // The repose relaxation: cap every column step at arc × 0.42.
  const arc = (Math.PI * 2 * layer.radius) / SEGMENTS;
  const maxStep = arc * 0.42;
  for (let i = 1; i <= SEGMENTS; i++) {
    ridges[i] = Math.min(ridges[i]!, ridges[i - 1]! + maxStep);
  }
  for (let i = SEGMENTS - 1; i >= 0; i--) {
    ridges[i] = Math.min(ridges[i]!, ridges[i + 1]! + maxStep);
  }
  ridges[0] = ridges[SEGMENTS] = Math.min(ridges[0]!, ridges[SEGMENTS]!);

  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    const offIn = angleBetween(theta, gapIn);
    const offOut = angleBetween(theta, gapOut);
    if (offIn < GAP_IN_HALF || offOut < GAP_OUT_HALF) {
      column = 0;
      continue;
    }
    const end =
      smoothstep01((offIn - GAP_IN_HALF) / 1.3) * smoothstep01((offOut - GAP_OUT_HALF) / 0.16);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    // Three rows: violet foot, lit shoulder, dissolved milky crest.
    const top = FOOT + Math.max(1.4, ridges[i]! - FOOT) * end + 0.2;
    const mid = FOOT + (top - FOOT) * 0.7;
    positions.push(x, FOOT, z, x, mid, z, x, top, z);
    colors.push(...FOOT_TINT, 0.95, ...MID_TINT, 0.85, ...CROWN_TINT, 0);
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
