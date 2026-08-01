import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import type { ContactPatch } from "../../Seabed";
import { chalkTexture, mergedMesh, smoothstep01 } from "./Pale3Shared";
import { DAYSPRING, pale3TerrainTarget, worldOf } from "./Pale3Terrain";

/**
 * THE DAYSPRING itself — the region's landmark, the province's last
 * light peak, and the payoff of 1.6 km of pale water: the RISEN PEARL,
 * a half-sunk nacre sun cresting the top terrace at the spoke's own
 * bearing. At the bottom of a pale sea the sun does not come down
 * through the water — it rises out of the ground: a 12 m half-dome of
 * warm pearl light standing on the horizon line the Dawn Steps climb
 * to, the painted morning burning behind it. The Lamp was a kept
 * flame in a cage; this is the source it was kept for — nothing
 * tends it, it simply stands.
 *
 * Around its doorstep stands THE MORNING RING: seven low nacre
 * standing stones on the bare pearl pan, facing the light — the
 * SUN'S DOORSTEP rest's own composition (the licence: nothing else
 * stands between the diver and the light).
 *
 * The dome's glow is a vertex-shaped emissive (the glow-colony
 * discipline at landmark scale, the Lamp heart's precedent): base
 * value 0.58 rising to 1.0 at the crest, warm white-gold, intensity
 * well under the bloom pass's threshold.
 */

const SEED = SEEDS.regionPale3;

const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

export interface Pale3DayspringBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** The dome's crest, world space — the Chorister's sky. */
  readonly crest: { x: number; y: number; z: number };
  /** The dome's centre at ground level, world space. */
  readonly foot: { x: number; y: number; z: number };
}

/** How deep the pearl sits in the terrace — half-risen, not beached. */
const SINK = 3.5;

function domeGeometry(cx: number, cy: number, cz: number): BufferGeometry {
  const LEVELS = 12;
  const SIDES = 26;
  const R = DAYSPRING.radius;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  // The sphere's centre sits SINK below ground; the skin runs from the
  // ground-line circle up to the crest.
  const phiMax = Math.acos(-SINK / R);
  for (let j = 0; j <= LEVELS; j++) {
    const t = j / LEVELS;
    const phi = phiMax * (1 - t);
    const y = cy + R * Math.cos(phi);
    const radius = R * Math.sin(phi) + 0.02;
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      positions.push(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius);
      // The rising light: dim nacre at the ground line, full at the
      // crest, with a nacre band shimmer. Round 2: the swing doubled
      // (base 0.58 → 0.42) and the bands strengthened — the r1 dome
      // read as a flat matte egg; CONTRAST is the light.
      const lift = smoothstep01((t - 0.06) / 0.86);
      const band = 0.5 + 0.5 * Math.sin(t * 9 + a * 2);
      const value = 0.42 + 0.58 * lift + (band - 0.5) * 0.09;
      colors.push(value, value * 0.9, value * 0.72);
    }
  }
  for (let j = 0; j < LEVELS; j++) {
    for (let s = 0; s < SIDES; s++) {
      const a = j * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // The crest cap.
  const capCenter = positions.length / 3;
  positions.push(cx, cy + R, cz);
  colors.push(1, 0.9, 0.72);
  const lastRing = LEVELS * (SIDES + 1);
  for (let s = 0; s < SIDES; s++) {
    indices.push(capCenter, lastRing + s + 1, lastRing + s);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** One Morning Ring stone: a low leaning nacre menhir. */
function menhirGeometry(
  x: number,
  z: number,
  height: number,
  yaw: number,
  colliders: SphereCollider[],
  contacts: ContactPatch[],
): BufferGeometry {
  const ground = pale3TerrainTarget(x, z);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const SIDES = 6;
  const LEVELS = 4;
  for (let j = 0; j <= LEVELS; j++) {
    const h = j / LEVELS;
    const y = ground - 0.4 + (height + 0.4) * h;
    const radius = 0.5 * (1 - h * 0.55) + 0.06;
    // The stone leans a breath toward the light.
    const cx = x + Math.cos(yaw) * h * h * 0.4;
    const cz = z + Math.sin(yaw) * h * h * 0.4;
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      positions.push(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius);
      // Round 2: the whole stone lifted — r1's ring read as dark
      // violet slabs against the pan (the value key, violated).
      const root = 1 - smoothstep01((h - 0.04) / 0.3);
      const crest = smoothstep01((h - 0.6) / 0.35);
      // The face toward the light warms (yaw is the lean's bearing).
      const facing = Math.max(0, Math.cos(a - yaw));
      colors.push(
        1.02 - root * 0.12 + crest * 0.08 + facing * 0.14,
        1.0 - root * 0.16 + crest * 0.08 + facing * 0.05,
        1.04 - root * 0.08 + crest * 0.1 - facing * 0.1,
      );
      uvs.push((s / SIDES) * 0.8, h * (height / 6));
    }
  }
  for (let j = 0; j < LEVELS; j++) {
    for (let s = 0; s < SIDES; s++) {
      const a = j * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  colliders.push({ center: new Vector3(x, ground + height * 0.4, z), radius: 0.9 });
  contacts.push({ x, z, radius: 1.6, strength: 0.28 });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildPale3Dayspring(): Pale3DayspringBuild {
  const random = new Random(SEED ^ 0x0c01);
  const center = worldOf(DAYSPRING.u, DAYSPRING.v);
  const ground = pale3TerrainTarget(center.x, center.z);
  const cy = ground - SINK;

  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const meshes: Mesh[] = [];

  // ── The Risen Pearl ────────────────────────────────────────────────
  const pearlMaterial = createToonMaterial({ color: 0xf8e3bc, vertexColors: true });
  pearlMaterial.emissive = new Color(0xffd498);
  pearlMaterial.emissiveIntensity = 0.68;
  pearlMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const pearl = new Mesh(domeGeometry(center.x, cy, center.z), pearlMaterial);
  pearl.name = "pale3-dayspring-pearl";
  pearl.castShadow = false;
  pearl.receiveShadow = false;
  meshes.push(pearl);

  // Solid: one great sphere (a touch over the visual skin so the diver
  // never clips into the light).
  colliders.push({ center: new Vector3(center.x, cy, center.z), radius: DAYSPRING.radius + 0.3 });
  contacts.push({ x: center.x, z: center.z, radius: 15, strength: 0.38 });

  // ── The Morning Ring ───────────────────────────────────────────────
  // Seven low stones on the doorstep pan, arced to face the light —
  // the rest's own composition.
  const doorstep = worldOf(1614, 0);
  const towardPearl = Math.atan2(center.z - doorstep.z, center.x - doorstep.x);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const spread = (i / 6 - 0.5) * 2.2;
    const theta = towardPearl + Math.PI + spread;
    const r = 10 + random.range(-0.8, 0.8);
    const x = doorstep.x + Math.cos(theta) * r;
    const z = doorstep.z + Math.sin(theta) * r;
    const height = 1.1 + Math.abs(spread) * -0.2 + random.range(0.2, 0.9);
    const yaw = Math.atan2(center.z - z, center.x - x);
    parts.push(menhirGeometry(x, z, Math.max(0.9, height), yaw, colliders, contacts));
  }
  const stoneMaterial = createToonMaterial({
    map: chalkTexture(),
    color: 0xf6f1e6,
    vertexColors: true,
  });
  meshes.push(mergedMesh(parts, stoneMaterial, "pale3-morning-ring"));

  return {
    meshes,
    colliders,
    contacts,
    crest: { x: center.x, y: cy + DAYSPRING.radius, z: center.z },
    foot: { x: center.x, y: ground, z: center.z },
  };
}
