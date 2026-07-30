import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import {
  FAN_ALPHA_TEST,
  coralGeometry,
  coralSkin,
  fanTexture,
  type CoralKind,
} from "../../CoralShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { WingDef, WingFlora } from "../WingTypes";
import { drawFloorSpot, drawGateSpot, smoothstep01, swayClock, wingFrame } from "./W3FloraKit";
import { mountGateVeil } from "./GateVeilMount";

/**
 * Wing 7 — the Ghost Reef (worker W3). Grief with a door out of it: a
 * bleached coral stand, bone-pale at the gate, with colour quietly
 * returning toward the far end where the pearl moray keeps its den. The
 * story is told spatially and only spatially — one garden, one palette
 * ramp, no narration:
 *
 * - **White at the gate.** Every stand inside r ≈ 41 wears bone — two
 *   near-whites, one warm, one cool, so the bleaching reads as a field of
 *   loss rather than as one unpainted asset.
 * - **Colour past r 42.** Each instance's tint lerps from its bone toward
 *   a soft pink, gold or green by `RECOVERY_FROM → RECOVERY_TO` — the same
 *   ramp the seabed's `paint` walks and the sway shader reads, so the sand,
 *   the colour and the first small motions of life return together.
 * - **Stillness, then movement.** The staghorns and fans are rigid where
 *   they are dead and sway gently where they are alive — the amplitude is
 *   computed in the vertex shader from the instance's own world radius, so
 *   it is one draw call either way and the ramp can never drift out of
 *   sync with the tints.
 *
 * The pearl moray's approach corridor (|across| < 0.06 rad, r 30–46) stays
 * open water: every stand is planted at ≥ 0.078 rad off the axis, and the
 * test says so in metres and radians both.
 *
 * Seeds: `SEEDS.wingGhostReef` and `^` substreams only, all draws at build.
 */

/** Where the recovery ramp begins and ends, in metres of radius. */
const RECOVERY_FROM = 41;
const RECOVERY_TO = 46.5;

/** The corridor fence: ≥ 0.06 rad of axis clearance with margin to spare. */
const AXIS_CLEAR_RAD = 0.078;

/** The bleached bones: one warm, one cool, both near-white. */
const BONE_WARM = new Color(0xefe9dc);
const BONE_COOL = new Color(0xe8e8e2);

/**
 * The returning colours: soft pinks, golds and greens, never saturated.
 * Atelier repaint: the green taken well toward the milk — under the wing's
 * aqua fog and the sand's pale lift the original 0xabd9a4 rendered as
 * saturated green beside the den, reading as "someone forgot to bleach
 * these" instead of "colour is returning". The pink and gold keep their
 * chroma: the far end must be unmistakably coloured or the bone→colour
 * story has no second act (the recovery test holds the ratio).
 */
const RECOVERY = [new Color(0xf4bfcc), new Color(0xefc890), new Color(0xb6d8ac)] as const;

/** How far toward full colour the far end gets — recovery, not a carnival. */
const RECOVERY_DEPTH = 0.85;

/** The kinds that stand here, and their share of a site's pieces. */
const KIND_WEIGHTS: readonly (readonly [CoralKind, number])[] = [
  ["branch", 0.32],
  ["tube", 0.18],
  ["plateStack", 0.15],
  ["staghorn", 0.09],
  ["brain", 0.08],
  ["fan", 0.18],
];

/** Scale ranges per kind, against the garden's one-metre unit footprint. */
const KIND_SCALE: Record<CoralKind, readonly [number, number]> = {
  staghorn: [0.9, 1.5],
  brain: [0.8, 1.3],
  plateStack: [0.5, 0.8],
  tube: [0.7, 1.2],
  fan: [0.9, 1.4],
  branch: [0.6, 1.1],
  boulder: [1, 1],
  polyp: [1, 1],
};

interface Stand {
  readonly kind: CoralKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly tiltX: number;
  readonly yaw: number;
  readonly tiltZ: number;
  readonly scale: number;
  readonly tint: Color;
}

function drawKind(random: Random, recoverySite: boolean): CoralKind {
  const pick = random.next();
  let cumulative = 0;
  for (const [kind, weight] of KIND_WEIGHTS) {
    if (kind === "fan" && !recoverySite) {
      continue;
    }
    cumulative += weight;
    if (pick < cumulative) {
      return kind;
    }
  }
  return "branch";
}

/** The tint a piece wears at radius `r`: bone at the gate, colour returning past it. */
function ghostTint(random: Random, r: number): Color {
  const warmth = random.next();
  const family = random.next();
  const value = random.range(0.88, 1.06);
  const bone = BONE_WARM.clone().lerp(BONE_COOL, warmth);
  const pastel = RECOVERY[Math.floor(family * RECOVERY.length)] ?? RECOVERY[0];
  const recovery = smoothstep01((r - RECOVERY_FROM) / (RECOVERY_TO - RECOVERY_FROM));
  return bone.lerp(pastel, recovery * RECOVERY_DEPTH).multiplyScalar(value);
}

export function buildGhostReefFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "w3-ghost-reef";
  const frame = wingFrame(def);
  const contacts: ContactPatch[] = [];
  const clock = swayClock();

  const stands: Stand[] = [];

  const plantSite = (
    random: Random,
    r: number,
    pieces: number,
    recoverySite: boolean,
    gate: boolean,
    forceFirstKind?: CoralKind,
  ): void => {
    let plantedFan = false;
    for (let p = 0; p < pieces; p++) {
      let kind = p === 0 && forceFirstKind ? forceFirstKind : drawKind(random, recoverySite);
      // Every recovery stand shows at least one fan: lace is the read of
      // life coming back, and a site that drew none would hide the story.
      if (recoverySite && p === pieces - 1 && !plantedFan) {
        kind = "fan";
      }
      if (kind === "fan") {
        plantedFan = true;
      }
      // A stand strings along the wing's narrow live band: each piece draws
      // its own radius near the site's and its own lateral inside the
      // window there, so corridor fence and blend both hold piece by piece.
      const pieceR = r + random.signed(0.5);
      const fence = AXIS_CLEAR_RAD * pieceR;
      const spot = gate
        ? drawGateSpot(random, def, frame, pieceR, pieceR, fence)
        : drawFloorSpot(random, def, frame, pieceR, pieceR, fence);
      const { x, z } = spot;
      const [scaleMin, scaleMax] = KIND_SCALE[kind];
      const scale = random.range(scaleMin, scaleMax);
      const yaw = random.range(0, Math.PI * 2);
      const tiltX = random.signed(kind === "branch" ? 0.3 : 0.06);
      const tiltZ = random.signed(kind === "branch" ? 0.3 : 0.06);
      const foot = seabedHeight(x, z);
      // The unit-footprint kinds root on the sand; the branch capsule is
      // centred, so it is nestled up to its lower third.
      const y = kind === "branch" ? foot + 0.55 * scale : foot - 0.02;
      stands.push({ kind, x, y, z, tiltX, yaw, tiltZ, scale, tint: ghostTint(random, pieceR) });
      if (kind === "staghorn" || kind === "brain") {
        contacts.push({ x, z, radius: 0.8 * scale, strength: 0.4 });
      } else if (kind === "plateStack") {
        contacts.push({ x, z, radius: 0.5 * scale, strength: 0.3 });
      }
    }
  };

  // The gate pair: two bone stands on the sill's shoulders, scenery-only,
  // framing the doorway the descent swims through.
  const gate = new Random(SEEDS[def.seedKey] ^ 0x0a7e);
  plantSite(gate, gate.range(31.6, 32.4), 3, false, true);
  plantSite(gate, gate.range(32.6, 33.4), 2, false, true);

  // The bleached garden: eight stands down the wing's middle reach. Two
  // are anchored by a staghorn whatever the dice say — the branching crown
  // is the bleached reef's defining silhouette, and a draw that omitted it
  // would leave the story without its narrator.
  const main = new Random(SEEDS[def.seedKey] ^ 0x0bed);
  for (let site = 0; site < 8; site++) {
    const r = main.range(35, 40.6);
    const pieces = 3 + Math.floor(main.next() * 2);
    plantSite(main, r, pieces, false, false, site === 1 || site === 5 ? "staghorn" : undefined);
  }

  // The recovery: seven stands at the far end, denser and fan-bearing,
  // gathered where the ramp runs out — the den's neighbourhood heals first.
  const far = new Random(SEEDS[def.seedKey] ^ 0x0ec0);
  for (let site = 0; site < 7; site++) {
    const r = far.range(43, 45.8);
    const pieces = 3 + Math.floor(far.next() * 2);
    plantSite(far, r, pieces, true, false);
  }

  /* ------------------------------------------------------------------ *
   *  One instanced mesh per kind — the coral idiom, bone palette.
   * ------------------------------------------------------------------ */

  const byKind = new Map<CoralKind, Stand[]>();
  for (const stand of stands) {
    const list = byKind.get(stand.kind);
    if (list) {
      list.push(stand);
    } else {
      byKind.set(stand.kind, [stand]);
    }
  }

  const addSway = (material: MeshToonMaterial, height: number, amount: number): void => {
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSway = clock.time;
      shader.uniforms.uWind = clock.strength;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uSway;
           uniform float uWind;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           // Dead where it stands: the recovery ramp, read from the
           // instance's own world radius, so stillness and colour agree.
           float ghostR = length(instanceMatrix[3].xz);
           float alive = smoothstep(${RECOVERY_FROM.toFixed(1)}, ${RECOVERY_TO.toFixed(1)}, ghostR);
           float phase = instanceMatrix[3][0] * 0.6 + instanceMatrix[3][2] * 0.43;
           float tip = clamp(transformed.y / ${height.toFixed(2)}, 0.0, 1.0);
           float bend = (sin(uSway * 1.1 + phase) * 0.5 + sin(uSway * 0.43 + phase * 1.7) * 0.5)
                      * alive * uWind;
           transformed.x += bend * ${amount.toFixed(3)} * tip * tip;
           transformed.z += bend * ${(amount * 0.55).toFixed(3)} * tip * tip;`,
        );
    };
  };

  const dummy = new Object3D();
  for (const [kind, parts] of byKind) {
    const geometry = coralGeometry(kind);
    let material: MeshToonMaterial;
    if (kind === "fan") {
      material = createToonMaterial({
        color: 0xffffff,
        map: fanTexture(),
        side: DoubleSide,
      });
      // The lace's own cut-out; `createToonMaterial` keeps no opinion on it.
      material.alphaTest = FAN_ALPHA_TEST;
      addSway(material, 1, 0.055);
    } else {
      const skin = coralSkin(kind);
      material = createToonMaterial({
        color: 0xffffff,
        map: skin.map,
        normalMap: skin.normal,
        // The painted pieces keep their baked occlusion under the tint.
        vertexColors: geometry.hasAttribute("color"),
      });
      if (kind === "staghorn") {
        addSway(material, 1, 0.024);
      }
    }

    const mesh = new InstancedMesh(geometry, material, parts.length);
    mesh.name = `w3-ghost-${kind}`;
    mesh.userData.floorBound = kind === "branch" ? "rest" : "foot";
    mesh.receiveShadow = true;
    // No cast shadow: the stands are smallwork, and the milk takes the sun's edge off anyway.
    mesh.castShadow = false;
    parts.forEach((part, index) => {
      dummy.position.set(part.x, part.y, part.z);
      dummy.rotation.set(part.tiltX, part.yaw, part.tiltZ);
      dummy.scale.setScalar(part.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, part.tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    group.add(mesh);
  }

  // ── The gate veil (connective-1). ──
  // The end wall dressed with the Pale Passage's promise: bone-milk inks
  // that LIGHTEN toward the door (the one province whose distance is
  // whiter than its water), the far ink leaning rose-violet — the Bone
  // Meadows' blush read from the wing side — under a pearl column and a
  // drift of pearl motes. Round 3 lifted every ink a value step: at the
  // first register the 0.2-cap planes could not raise the doorway above
  // the backdrop, and a milk that fails to be brighter than the water is
  // just haze. Appended after every existing draw, on its own `^`
  // substream: the recovery ramp above re-rolls nothing.
  const veil = mountGateVeil(def, {
    width: 7,
    height: 5.5,
    palette: [0x8fa39f, 0xbcc9c4, 0xd8c9d1],
    column: { tint: 0xeef4ee, opacity: 0.09 },
    particulate: { tint: 0xf2f4ee, count: 80 },
  });
  group.add(veil.group);

  const update = (dt: number, reducedMotion: boolean): void => {
    // Even at the living end the sway is a breath, not a dance.
    clock.advance(dt, reducedMotion, 0.3);
    veil.update(dt, reducedMotion);
  };

  return { group, contacts, update };
}
