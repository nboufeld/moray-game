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
import { B3_SEEDS, smoothstep01 } from "./Blue3Shared";
import { BLUE3_SLOT, CENTER_X, CENTER_Z } from "./Blue3Terrain";

/**
 * THE FIRST SEA's painted distance — the world's deepest horizon, and
 * its last: past the Hem there is no more country to promise, so the
 * painting says the one thing left to say. Three rings of open sea,
 * each a step paler and rosier, their long crests almost LEVEL (this
 * is water's own horizon, not ridge country), and over the outbound
 * bearing — beyond the Sea's Doorstep — the crowns warm toward the
 * dawn-rose: THE MORNING BANK, the light the whole journey was
 * descending toward, standing just past the end of the sea.
 *
 * The ink law holds to the last plane: near-neutral violets, red a
 * nose above green — never cobalt, never maroon; feet fall toward the
 * deep's violet; crowns dissolve milky (rose at the Bank). Each ring
 * self-dissolves across 140–157 m of camera distance, inside the
 * 160 m clip. One gap parts the rings over the inbound corridor
 * (MASTER R4) — the Deep Steps' own painted rim owns that view. There
 * is no outbound gap to reserve: nothing lies beyond this region but
 * its painting.
 */

interface SeaLayer {
  readonly radius: number;
  readonly ridgeBase: number;
  readonly ridgeVary: number;
  readonly fade: number;
  readonly ink: Color;
  /** Camera-distance self-dissolve window, metres. */
  readonly dissolve: readonly [number, number];
}

// Bases raised in round 2: the morning-horizon arithmetic (the stand
// rides the vault at y −6; every ring crown must clear the Hem's
// wobbled crest sightline with margin). Vary widened in round 3: the
// r2 crowns silhouetted as dead-straight rules. Round 4: the outer
// ring's dissolve pushed out to 147–159 — the r3 lesson was that the
// one ring whose bank crowns reach the eye line dissolved exactly
// where the composed pose stood.
const LAYERS: readonly SeaLayer[] = [
  {
    radius: 246,
    ridgeBase: 16,
    ridgeVary: 4.2,
    fade: 0.3,
    ink: new Color(0.74, 0.62, 0.8),
    dissolve: [140, 157],
  },
  {
    radius: 266,
    ridgeBase: 23,
    ridgeVary: 5.6,
    fade: 0.5,
    ink: new Color(0.86, 0.72, 0.86),
    dissolve: [143, 158],
  },
  {
    radius: 290,
    ridgeBase: 31,
    ridgeVary: 7.2,
    fade: 0.66,
    ink: new Color(0.96, 0.84, 0.92),
    dissolve: [147, 159],
  },
];

const SEGMENTS = 220;
/** The curtain's foot, below every floor the region can show. */
const FOOT = -66;

/** Half-angle of the gap over the inbound corridor. */
const GAP_IN_HALF = 0.4;

/** Foot/crown tints: feet fall violet, crowns go milky — and toward
 *  the Morning Bank's bearing the crown warms rose. */
const FOOT_TINT: readonly [number, number, number] = [0.54, 0.52, 0.68];
const MID_TINT: readonly [number, number, number] = [0.88, 0.83, 0.92];
// Round 3: the rose pushed hard — under the teal-violet fog multiply
// the r2/r3-first rose crushed to plain blue-grey.
const CROWN_TINT: readonly [number, number, number] = [1.14, 1.1, 1.06];
const CROWN_ROSE: readonly [number, number, number] = [1.52, 1.12, 0.88];

export function buildBlue3Distance(): { meshes: Mesh[] } {
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
      color: new Color(0x6f6a90).lerp(new Color(0x6f6a90).multiply(layer.ink), 1 - layer.fade),
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    // The self-dissolve: alpha to zero across the layer's own window
    // of camera distance, safely inside the 160 m clip.
    const [dissolveFrom, dissolveTo] = layer.dissolve;
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
          `#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(${dissolveFrom.toFixed(1)}, ${dissolveTo.toFixed(1)}, vRingDist);`,
        );
    };
    material.customProgramCacheKey = () => `blue3-distance-dissolve-${dissolveFrom}`;
    const geometry = seaRing(layer, SEEDS.regionBlue3 ^ (B3_SEEDS.distance + index * 131));
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `firstsea-distance-${index}`;
    mesh.renderOrder = -(index + 1) - 2;
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
    materials.push(material);
  }

  return { meshes };
}

/**
 * One ring: a curtain whose top edge is the open sea's own long
 * gentle swell. The inbound sector is skipped with a long taper;
 * toward the outbound bearing the crown colours warm rose and the
 * swells gather into soft BANK HEADS (the Morning Bank).
 *
 * Round 3, the crown-alpha lesson: the r2 curtain's crest row carried
 * alpha 0 — the dissolve reached nothing exactly at the crown, so the
 * OPAQUE MID ROW silhouetted instead (a dead straight rule) and the
 * rose never rendered. Four rows now: violet foot, lit shoulder, a
 * SOLID crown that carries the rose, and a sky row above it where the
 * dissolve actually happens — the visible crest line is the wobbled
 * ridge itself.
 */
function seaRing(layer: SeaLayer, noiseSeed: number): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let column = 0;

  const gapIn = BLUE3_SLOT.azimuth + Math.PI;
  const morning = BLUE3_SLOT.azimuth;

  const ridges = new Float32Array(SEGMENTS + 1);
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const theta = t * Math.PI * 2;
    const roll =
      fbm(t * 9, layer.radius * 0.013, { seed: noiseSeed, period: 9, octaves: 3 }) - 0.5;
    // Open water: long swells — but true swells, not rules.
    const wave =
      Math.sin(t * Math.PI * 2 * 5 + roll * 2) * 0.5 +
      Math.sin(t * Math.PI * 2 * 2 + (noiseSeed % 7)) * 0.5;
    const table = Math.min(0.62, wave) / 0.62;
    const base = layer.ridgeBase * (0.92 + 0.12 * Math.sin(t * Math.PI * 2 * 3 + (noiseSeed % 5)));
    // The Morning Bank's heads: over the outbound bearing the swells
    // gather into soft cumulus rises — the shape of the light past
    // the end of the sea. Round 4's arithmetic: the r3 rises grew
    // WITH the base (22/30/40 on bases 16/23/31), which drove the
    // farthest ring's whole bank INTO the 58 cap — a dead-straight
    // rule, the very thing the bank was built to break. The rises now
    // run AGAINST the base (the near ring carries the tall heads, the
    // far rosiest ring keeps just its crowns cresting the cap-line's
    // eye level), so every ring's bank stays under the cap except the
    // far ring's few peaks — a massed, staggered bank instead of a
    // rule.
    const offMorning = angleBetween(theta, morning);
    const bankK = 1 - smoothstep01((offMorning - 0.45) / 0.85);
    const lobes = 0.55 + 0.45 * Math.sin(offMorning * 4.6 + (noiseSeed % 11));
    const bankRise = 34 - layer.fade * 15;
    const heads = bankK * Math.sqrt(bankK) * lobes * bankRise;
    ridges[i] = Math.min(
      58,
      base + (roll * 1.1 + table) * layer.ridgeVary + heads,
    );
  }

  // The repose relaxation: cap every column step (water's horizon is
  // the most reposeful skyline there is).
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
    if (offIn < GAP_IN_HALF) {
      column = 0;
      continue;
    }
    const end = smoothstep01((offIn - GAP_IN_HALF) / 1.3);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;

    // The Morning Bank: crowns warm toward the dawn over the outbound
    // bearing — strongest on the farthest, palest ring — and the rose
    // reaches down into the shoulder so the warmth reads as a BANK,
    // not a rim.
    const rose =
      (1 - smoothstep01((angleBetween(theta, morning) - 0.55) / 0.9)) *
      (0.4 + 0.6 * layer.fade);
    const crown: [number, number, number] = [
      CROWN_TINT[0] + (CROWN_ROSE[0] - CROWN_TINT[0]) * rose,
      CROWN_TINT[1] + (CROWN_ROSE[1] - CROWN_TINT[1]) * rose,
      CROWN_TINT[2] + (CROWN_ROSE[2] - CROWN_TINT[2]) * rose,
    ];
    const mid: [number, number, number] = [
      MID_TINT[0] + rose * 0.16,
      MID_TINT[1] + rose * 0.04,
      MID_TINT[2] - rose * 0.04,
    ];

    // Four rows: violet foot, lit shoulder, SOLID rose crown, sky.
    const top = FOOT + Math.max(1.4, ridges[i]! - FOOT) * end + 0.2;
    const midY = FOOT + (top - FOOT) * 0.62;
    const sky = top + 3.5 + layer.ridgeVary * 0.5;
    positions.push(x, FOOT, z, x, midY, z, x, top, z, x, sky, z);
    colors.push(...FOOT_TINT, 0.95, ...mid, 0.85, ...crown, 0.62 + rose * 0.16, ...crown, 0);
    if (column > 0) {
      const a = positions.length / 3 - 8;
      for (let row = 0; row < 3; row++) {
        const b = a + row;
        indices.push(b, b + 1, b + 4, b + 1, b + 5, b + 4);
      }
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
