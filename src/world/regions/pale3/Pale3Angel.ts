import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { smoothstep01 } from "./Pale3Shared";
import { pale3TerrainTarget, worldOf } from "./Pale3Terrain";

/**
 * THE CHORISTER — the findable resident: a great white sea-angel
 * (a swimming sea-butterfly the length of an arm), translucent wings
 * rose-tipped, a dawn-rose heart glowing in its chest. It rises and
 * falls on one slow vertical ring before the Dayspring — a bird
 * greeting the sun, forever — cresting above the risen pearl once
 * every round. The codex says it sings; the water says nothing, which
 * in the pale province is the same thing.
 *
 * The body is a soft lathe trunk with two horn tentacles; the WINGS
 * are separate meshes so the flap is a real articulation (closed-form
 * of simulated time); the heart is a small emissive teardrop shaped
 * by its vertex colours (the glow-colony discipline). The lesser
 * choir (Pale3Life's moving centrepiece) reuses the merged whole-body
 * geometry as one instanced draw.
 */

export const CHORISTER_SPECIES_ID = "dayspring-chorister";

const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

/** The ring's rhythm: one greeting per revolution. */
const LOOP_SEC = 95;

// ── Geometry ─────────────────────────────────────────────────────────

/** The trunk: a soft tapering body along +x, chest swollen. ~130 tris. */
function trunkGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const SIDES = 8;
  const LEVELS = 8;
  for (let j = 0; j <= LEVELS; j++) {
    const t = j / LEVELS;
    const x = -0.55 + 1.1 * t; // tail → head
    // Chest swell at t ≈ 0.62, tucking to a blunt head.
    const radius =
      0.05 + 0.16 * Math.exp(-(((t - 0.62) / 0.3) ** 2)) + 0.05 * smoothstep01((t - 0.85) / 0.15);
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      positions.push(x, Math.cos(a) * radius, Math.sin(a) * radius * 0.9);
      // Translucent white-violet, the chest a breath brighter where
      // the heart shows through the tissue.
      const chest = Math.exp(-(((t - 0.62) / 0.22) ** 2));
      colors.push(0.84 + chest * 0.12, 0.8 + chest * 0.06, 0.9 + chest * 0.04);
    }
  }
  for (let j = 0; j < LEVELS; j++) {
    for (let s = 0; s < SIDES; s++) {
      const a = j * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // The two horn tentacles, up off the head.
  for (const side of [-1, 1]) {
    const base = positions.length / 3;
    positions.push(
      0.48, 0.08, side * 0.05,
      0.54, 0.08, side * 0.09,
      0.62, 0.3, side * 0.16,
    );
    colors.push(0.86, 0.8, 0.9, 0.86, 0.8, 0.9, 0.96, 0.84, 0.88);
    indices.push(base, base + 1, base + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  return geometry;
}

/** One wing: a rounded fan, hinge along the body's axis. 8 tris. */
function wingGeometry(): BufferGeometry {
  // Hinge runs along x near the chest; the wing reaches +z (mirrored
  // by the mesh's scale for the far side).
  const positions = new Float32Array([
    // Fan of four blades from the hinge line.
    0.28, 0, 0.02, 0.06, 0, 0.02, 0.2, 0.06, 0.3,
    0.06, 0, 0.02, -0.06, 0.02, 0.28, 0.2, 0.06, 0.3,
    0.06, 0, 0.02, -0.14, 0, 0.02, -0.06, 0.02, 0.28,
    -0.14, 0, 0.02, -0.26, -0.02, 0.2, -0.06, 0.02, 0.28,
    // The outer reach.
    0.2, 0.06, 0.3, -0.06, 0.02, 0.28, 0.08, 0.1, 0.52,
    -0.06, 0.02, 0.28, -0.16, 0.04, 0.44, 0.08, 0.1, 0.52,
  ]);
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < positions.length / 3; i++) {
    const reach = positions[i * 3 + 2]! / 0.52;
    // Violet-white tissue, rose at the tips (the dawn on the wing).
    colors[i * 3] = 0.82 + reach * 0.16;
    colors[i * 3 + 1] = 0.78 + reach * 0.02;
    colors[i * 3 + 2] = 0.88 - reach * 0.06;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** The heart: a small teardrop of dawn-rose light in the chest. */
function heartGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const SIDES = 6;
  const LEVELS = 4;
  for (let j = 0; j <= LEVELS; j++) {
    const h = j / LEVELS;
    const y = -0.06 + 0.16 * h;
    const radius = 0.07 * Math.sin(Math.PI * (0.15 + 0.85 * h * 0.75)) * (1 - h * 0.4) + 0.01;
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      positions.push(0.12 + Math.cos(a) * radius, y, Math.sin(a) * radius);
      const t = smoothstep01((h - 0.1) / 0.8);
      const value = 0.5 + 0.5 * t;
      colors.push(value, value * 0.62, value * 0.68);
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
  return geometry;
}

/**
 * The whole angel as ONE merged geometry (wings held mid-beat), for
 * the choir's single instanced draw. The heart's warmth is baked into
 * the chest colours; the instanced material's shaped emissive carries
 * the glow.
 */
export function angelBodyGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const trunk = trunkGeometry();
  parts.push(trunk.toNonIndexed());
  trunk.dispose();
  for (const side of [-1, 1]) {
    const wing = wingGeometry();
    // The merge demands attribute parity: normals recompute at the end.
    wing.deleteAttribute("normal");
    wing.scale(1, 1, side);
    wing.rotateX(side * -0.35);
    parts.push(wing);
  }
  const heart = heartGeometry();
  parts.push(heart.toNonIndexed());
  heart.dispose();
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("pale3 angel parts could not be merged");
  }
  merged.computeVertexNormals();
  smoothNormals(merged);
  merged.computeBoundingSphere();
  return merged;
}

// ── The Chorister ────────────────────────────────────────────────────

export interface ChoristerBuild {
  readonly group: Group;
  readonly target: DiscoveryTarget;
  update(timeSec: number, reducedMotion: boolean): void;
}

/** The ring's centre in spoke coordinates: just before the pearl. */
const RING_U = 1611;
/** Lateral half-width and vertical half-height of the greeting ring. */
const RING_V = 7.5;
const RING_Y = 4.6;

export function buildChorister(pearlCrestY: number): ChoristerBuild {
  const group = new Group();
  group.name = "pale3-chorister";

  const tissue = createToonMaterial({ color: 0xf2ecf2, vertexColors: true });
  tissue.transparent = true;
  tissue.opacity = 0.92;
  tissue.side = DoubleSide;
  tissue.emissive = new Color(0xd8c8dc);
  tissue.emissiveIntensity = 0.28;
  tissue.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };

  const trunkGeo = trunkGeometry();
  trunkGeo.computeVertexNormals();
  smoothNormals(trunkGeo);
  trunkGeo.computeBoundingSphere();
  const trunk = new Mesh(trunkGeo, tissue);
  trunk.name = "pale3-chorister-trunk";
  trunk.castShadow = false;
  trunk.receiveShadow = false;
  group.add(trunk);

  const wings: Mesh[] = [];
  for (const side of [-1, 1]) {
    const geometry = wingGeometry();
    geometry.scale(1, 1, side);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const wing = new Mesh(geometry, tissue);
    wing.name = `pale3-chorister-wing-${side < 0 ? "port" : "starboard"}`;
    wing.position.set(0.12, 0.02, 0);
    wing.castShadow = false;
    wing.receiveShadow = false;
    group.add(wing);
    wings.push(wing);
  }

  const heartMaterial = createToonMaterial({ color: 0xf6ccd2, vertexColors: true });
  heartMaterial.emissive = new Color(0xf0a8b8);
  heartMaterial.emissiveIntensity = 0.5;
  heartMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const heartGeo = heartGeometry();
  heartGeo.computeVertexNormals();
  heartGeo.computeBoundingSphere();
  const heart = new Mesh(heartGeo, heartMaterial);
  heart.name = "pale3-chorister-heart";
  heart.castShadow = false;
  heart.receiveShadow = false;
  group.add(heart);

  // The whole body reads at ~1.7 m — a presence, not a spectacle.
  group.scale.setScalar(1.7);

  // The greeting ring: a vertical ellipse in the v–y plane before the
  // pearl. Rising on the south side, cresting over the pearl's own
  // crest line, falling on the north — one slow bow per revolution.
  const base = worldOf(RING_U, 0);
  const floorY = pale3TerrainTarget(base.x, base.z);
  const midY = Math.max(floorY + 3.4, pearlCrestY - RING_Y + 0.8);

  const at = (timeSec: number): Vector3 => {
    const phi = (timeSec / LOOP_SEC) * Math.PI * 2;
    const v = RING_V * Math.sin(phi);
    const u = RING_U + 1.2 * Math.sin(phi * 2);
    const { x, z } = worldOf(u, v);
    return new Vector3(x, midY - RING_Y * Math.cos(phi), z);
  };

  const start = at(0);
  group.position.copy(start);

  const target: DiscoveryTarget = {
    speciesId: CHORISTER_SPECIES_ID,
    // The crest of the greeting: crossed once every revolution.
    position: at(LOOP_SEC / 2),
  };

  const ahead = new Vector3();
  return {
    group,
    target,
    update(timeSec: number, reducedMotion: boolean): void {
      const t = timeSec * (reducedMotion ? 0.45 : 1);
      const now = at(t);
      ahead.copy(at(t + 0.6));
      group.position.copy(now);
      const yaw = Math.atan2(ahead.x - now.x, ahead.z - now.z);
      const horizontal = Math.hypot(ahead.x - now.x, ahead.z - now.z);
      const pitch = Math.atan2(ahead.y - now.y, Math.max(horizontal, 0.001));
      // The model's +x is forward; yaw 0 in three.js faces +z after a
      // −π/2 correction. The climb pitches the body, the beat rolls it.
      group.rotation.set(0, yaw - Math.PI / 2, 0);
      group.rotateZ(pitch * 0.7);
      group.rotateX(Math.sin(t * 0.5) * 0.06);
      // The wing beat: a slow deep stroke — a bird in worship, not a
      // fish in a hurry.
      const beat = Math.sin(t * 2.1);
      for (const [index, wing] of wings.entries()) {
        const side = index === 0 ? -1 : 1;
        wing.rotation.x = side * (-0.35 + beat * 0.55);
      }
    },
  };
}
