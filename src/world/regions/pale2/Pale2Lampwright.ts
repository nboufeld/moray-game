import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { SEEDS, Random } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { smoothstep01 } from "./Pale2Shared";

/**
 * THE LAMPWRIGHT — the findable resident: an ancient chalk-white
 * nautilus the size of a shield, its shell banded like paper held over
 * a flame, on a slow closed patrol that weaves through the Lamp's rib
 * cage — inside the chamber, out through a gap, around, and in again.
 * It tends the light; the codex says so.
 *
 * The shell is a true spiral tube (a logarithmic whorl, ~580 tris)
 * wearing flame bands that carry a faint shaped emissive — a lantern
 * being carried, far under bloom. The body is a violet-pale hood with
 * a tentacle skirt. Motion is a pure closed form of simulated time
 * (the weave crosses the cage radius exactly at the rib gaps, so the
 * patrol threads the cage by construction); the discovery target
 * waits at the mouth window, crossed once every revolution.
 */

const SEED = SEEDS.regionPale2;

export const LAMPWRIGHT_SPECIES_ID = "comb-lampwright";

const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

/** The patrol's rhythm. */
const LOOP_SEC = 150;
/** The cage radius the weave crosses (the ribs' bulge at patrol height). */
const CAGE_R = 7.3;
/** How far the weave swings inside/outside the cage. */
const WEAVE_A = 2.7;

export interface LampwrightBuild {
  readonly group: Group;
  readonly target: DiscoveryTarget;
  update(timeSec: number, reducedMotion: boolean): void;
}

function shellGeometry(): BufferGeometry {
  const SECTIONS = 36;
  const SIDES = 8;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const THETA_MAX = Math.PI * 3.1;
  const growth = 0.226;

  for (let i = 0; i <= SECTIONS; i++) {
    const t = i / SECTIONS;
    const theta = t * THETA_MAX;
    const whorlR = 0.115 * Math.exp(growth * theta);
    const tubeR = 0.048 * Math.exp(growth * theta);
    // The spiral lives in a vertical plane (x = forward, y = up).
    const cx = Math.cos(theta) * whorlR;
    const cy = Math.sin(theta) * whorlR;
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      const nx = Math.cos(theta) * Math.cos(a);
      const ny = Math.sin(theta) * Math.cos(a);
      const nz = Math.sin(a);
      positions.push(cx + nx * tubeR, cy + ny * tubeR, nz * tubeR * 0.86);
      // Flame bands along the whorl: chalk-white between warm paper-
      // over-lamp stripes; the outer whorl carries the light.
      const band = 0.5 + 0.5 * Math.sin(theta * 4.2 + a * 0.3);
      const outer = smoothstep01((t - 0.45) / 0.5);
      const warm = smoothstep01((band - 0.55) / 0.3) * (0.35 + outer * 0.65);
      colors.push(
        0.62 + 0.38 * Math.max(outer, 0.3) + warm * 0.06,
        0.6 + 0.36 * Math.max(outer, 0.3) - warm * 0.05,
        0.66 + 0.34 * Math.max(outer, 0.3) - warm * 0.22,
      );
    }
  }
  for (let i = 0; i < SECTIONS; i++) {
    for (let s = 0; s < SIDES; s++) {
      const a = i * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  return geometry;
}

function bodyGeometry(): BufferGeometry {
  const random = new Random(SEED ^ 0x0ee5);
  const parts: BufferGeometry[] = [];

  // The hood: a squashed cone reaching forward out of the shell mouth.
  {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const SIDES = 8;
    const LEVELS = 3;
    for (let j = 0; j <= LEVELS; j++) {
      const h = j / LEVELS;
      const x = 0.5 + 0.55 * h;
      const radius = 0.34 * (1 - h * 0.55);
      for (let s = 0; s <= SIDES; s++) {
        const a = (s / SIDES) * Math.PI * 2;
        positions.push(x, Math.cos(a) * radius * 0.8 - 0.1, Math.sin(a) * radius);
        colors.push(0.74 - h * 0.1, 0.66 - h * 0.1, 0.8 - h * 0.06);
      }
    }
    for (let j = 0; j < LEVELS; j++) {
      for (let s = 0; s < SIDES; s++) {
        const a = j * (SIDES + 1) + s;
        const b = a + SIDES + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    geometry.setIndex(indices);
    parts.push(geometry);
  }

  // The tentacle skirt: nine short tapering strands.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI - Math.PI / 2;
    const positions: number[] = [];
    const colors: number[] = [];
    const droop = random.range(0.1, 0.3);
    const len = random.range(0.5, 0.85);
    const y0 = -0.16 + Math.cos(a) * 0.1;
    const z0 = Math.sin(a) * 0.24;
    positions.push(
      0.95, y0 + 0.05, z0 - 0.035,
      0.95, y0 + 0.05, z0 + 0.035,
      0.95 + len, y0 - droop, z0,
    );
    colors.push(0.82, 0.72, 0.84, 0.82, 0.72, 0.84, 0.96, 0.8, 0.78);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    parts.push(geometry);
  }

  // The eye: one dark bead each side (a colour, never black).
  for (const side of [-1, 1]) {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const SIDES = 6;
    for (let j = 0; j <= 2; j++) {
      const h = j / 2;
      const radius = 0.07 * Math.sin(Math.PI * (0.15 + 0.7 * h)) + 0.01;
      for (let s = 0; s <= SIDES; s++) {
        const aa = (s / SIDES) * Math.PI * 2;
        positions.push(
          0.62 + Math.cos(aa) * radius,
          0.08 + (h - 0.5) * 0.12,
          side * 0.3 + Math.sin(aa) * radius * 0.5,
        );
        colors.push(0.26, 0.18, 0.34);
      }
    }
    for (let j = 0; j < 2; j++) {
      for (let s = 0; s < SIDES; s++) {
        const a2 = j * (SIDES + 1) + s;
        const b2 = a2 + SIDES + 1;
        indices.push(a2, b2, a2 + 1, b2, b2 + 1, a2 + 1);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    geometry.setIndex(indices);
    parts.push(geometry);
  }

  const merged = mergeGeometries(
    parts.map((part) => (part.getIndex() ? part.toNonIndexed() : part)),
    false,
  );
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("lampwright body parts could not be merged");
  }
  return merged;
}

export function buildLampwright(
  lampHeart: { x: number; y: number; z: number },
  mouthFacing: number,
): LampwrightBuild {
  const group = new Group();
  group.name = "pale2-lampwright";

  const shellMaterial = createToonMaterial({ color: 0xf6efe2, vertexColors: true });
  shellMaterial.emissive = new Color(0xf0c890);
  shellMaterial.emissiveIntensity = 0.22;
  shellMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const shellGeo = shellGeometry();
  // The R5 guard (round 1's blackout): normals must exist before the
  // smoothing pass, which no-ops without them.
  shellGeo.computeVertexNormals();
  smoothNormals(shellGeo);
  shellGeo.computeBoundingSphere();
  const shell = new Mesh(shellGeo, shellMaterial);
  shell.name = "pale2-lampwright-shell";
  shell.castShadow = false;
  shell.receiveShadow = false;
  // The shell rides on the body's back, mouth forward.
  shell.rotation.set(0, 0, -0.35);
  shell.position.set(-0.1, 0.28, 0);
  shell.scale.setScalar(1.35);
  group.add(shell);

  const bodyGeo = bodyGeometry();
  bodyGeo.computeVertexNormals();
  smoothNormals(bodyGeo);
  bodyGeo.computeBoundingSphere();
  const body = new Mesh(bodyGeo, createToonMaterial({ vertexColors: true }));
  body.name = "pale2-lampwright-body";
  body.castShadow = false;
  body.receiveShadow = false;
  body.scale.setScalar(1.35);
  group.add(body);

  // The patrol: an orbit whose radius weaves across the cage exactly
  // at the rib GAPS (sin(4.5·Δφ) is zero on gap centres — see the
  // Lamp's rib layout), so the tour threads the cage forever without
  // ever meeting a rib. The mouth gap is Δφ = 0.
  const gapPhase = mouthFacing;
  const at = (timeSec: number): { pos: Vector3; yaw: number } => {
    const phi = gapPhase + (timeSec / LOOP_SEC) * Math.PI * 2;
    const r = CAGE_R + WEAVE_A * Math.sin(4.5 * (phi - gapPhase));
    const y = lampHeart.y + 1.4 * Math.sin(timeSec * 0.13) - 1.2;
    const pos = new Vector3(
      lampHeart.x + Math.cos(phi) * r,
      y,
      lampHeart.z + Math.sin(phi) * r,
    );
    // Face along the direction of travel (numeric tangent).
    const dPhi = 0.02;
    const phi2 = phi + dPhi;
    const r2 = CAGE_R + WEAVE_A * Math.sin(4.5 * (phi2 - gapPhase));
    const ahead = new Vector3(
      lampHeart.x + Math.cos(phi2) * r2,
      y,
      lampHeart.z + Math.sin(phi2) * r2,
    );
    return { pos, yaw: Math.atan2(ahead.x - pos.x, ahead.z - pos.z) };
  };

  const start = at(0);
  group.position.copy(start.pos);

  const target: DiscoveryTarget = {
    speciesId: LAMPWRIGHT_SPECIES_ID,
    // The mouth window: the patrol crosses it once every revolution.
    position: new Vector3(
      lampHeart.x + Math.cos(gapPhase) * CAGE_R,
      lampHeart.y - 1.2,
      lampHeart.z + Math.sin(gapPhase) * CAGE_R,
    ),
  };

  return {
    group,
    target,
    update(timeSec: number, reducedMotion: boolean): void {
      const t = timeSec * (reducedMotion ? 0.45 : 1);
      const now = at(t);
      group.position.copy(now.pos);
      // The model's +x is forward; yaw 0 in three.js faces +z after a
      // −π/2 correction, plus a gentle swimming roll.
      group.rotation.set(
        Math.sin(t * 0.4) * 0.06,
        now.yaw - Math.PI / 2,
        Math.sin(t * 0.27) * 0.05,
      );
    },
  };
}
