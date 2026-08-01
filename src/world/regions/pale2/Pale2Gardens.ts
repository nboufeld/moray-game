import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Object3D,
  Vector3,
  type Mesh,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { DoubleSide } from "three";
import { smoothstep01 } from "./Pale2Shared";
import {
  LAMP_BASIN,
  POOLS,
  RESTS,
  lumen,
  pale2TerrainTarget,
  spokeOf,
  worldOf,
} from "./Pale2Terrain";
import type { FanAnchor } from "./Pale2Combs";

/**
 * The lit growth of the Lantern Combs — the region's translucent
 * exclusives, the things the kit cannot say:
 *
 * - **Paper-fan corals**: pleated half-discs seated on the comb
 *   flanks and the Lamp's ribs, painted warm at the rim over a violet
 *   hinge, with a soft warm emissive floor — sun THROUGH the tissue,
 *   the region's founding image. One instanced draw.
 * - **Lantern anemones**: short stalks holding glowing bulb heads,
 *   the basin's garden — the emissive is shaped by the vertex colours
 *   (the glow-colony discipline: a bulb over a dark stalk reads as a
 *   held light, capped far under bloom). One instanced draw.
 * - **Pearl clusters**: nacre bead triples at the moonmilk pools'
 *   lips. One instanced draw.
 */

const SEED = SEEDS.regionPale2;

const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

export interface Pale2GardensBuild {
  readonly meshes: (Mesh | InstancedMesh)[];
  /** Anemone bulb positions, for the moth-fry hover anchors. */
  readonly lanternSpots: readonly (readonly [number, number, number])[];
}

// ── The paper fan ────────────────────────────────────────────────────

/** A pleated half-disc, hinge at the origin, opening toward +y/+z. */
function fanGeometry(): BufferGeometry {
  const PLEATS = 9;
  const positions: number[] = [];
  const colors: number[] = [];
  const R = 0.55;
  for (let p = 0; p < PLEATS; p++) {
    const a0 = -Math.PI / 2 + (p / PLEATS) * Math.PI;
    const a1 = -Math.PI / 2 + ((p + 1) / PLEATS) * Math.PI;
    const mid = (a0 + a1) / 2;
    const fold = p % 2 === 0 ? 0.1 : 0.02;
    // Two triangles per pleat: hinge → rim(a0) → rim(mid), hinge → rim(mid) → rim(a1).
    const rim = (a: number, depth: number): [number, number, number] => [
      Math.sin(a) * R,
      Math.cos(a) * R * 0.92 + 0.06,
      depth,
    ];
    const hinge: [number, number, number] = [0, 0, 0.05];
    for (const tri of [
      [hinge, rim(a0, 0.04), rim(mid, fold)],
      [hinge, rim(mid, fold), rim(a1, 0.04)],
    ]) {
      for (const [x, y, z] of tri) {
        positions.push(x, y, z);
        // Violet hinge → warm lit rim; alternate pleats a half value
        // apart so the folds draw themselves.
        const spread = Math.hypot(x, y) / R;
        const lit = smoothstep01((spread - 0.15) / 0.75);
        const pleatTone = p % 2 === 0 ? 1 : 0.86;
        colors.push(
          (0.62 + 0.44 * lit) * pleatTone,
          (0.5 + 0.42 * lit) * pleatTone,
          (0.62 + 0.24 * lit) * pleatTone,
        );
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// ── The lantern anemone ──────────────────────────────────────────────

/** A short stalk holding a glowing bulb head; origin at the foot. */
function anemoneGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  // The stalk: a 5-sided tapered column, violet-pale (dim, not dark —
  // round 1's stalks dragged the whole plant to mud).
  const SIDES = 5;
  const stalkH = 0.3;
  for (let j = 0; j <= 2; j++) {
    const h = j / 2;
    const radius = 0.06 * (1 - h * 0.35);
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, stalkH * h, Math.sin(a) * radius);
      colors.push(0.46, 0.4, 0.54);
    }
  }
  for (let j = 0; j < 2; j++) {
    for (let s = 0; s < SIDES; s++) {
      const a = j * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // The bulb: a round glowing pinhead — round 1's broad flat cap read
  // as a mushroom; the lantern is a small full sphere of light.
  const base = positions.length / 3;
  const LEVELS = 5;
  const BS = 7;
  const R = 0.105;
  for (let j = 0; j <= LEVELS; j++) {
    const h = j / LEVELS;
    const y = stalkH + 0.05 + R - R * Math.cos(Math.PI * h);
    const radius = R * Math.sin(Math.PI * h) + 0.012;
    for (let s = 0; s <= BS; s++) {
      const a = (s / BS) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      const t = smoothstep01((h - 0.1) / 0.8);
      const value = 0.42 + 0.58 * t;
      colors.push(value, value * 0.87, value * 0.64);
    }
  }
  for (let j = 0; j < LEVELS; j++) {
    for (let s = 0; s < BS; s++) {
      const a = base + j * (BS + 1) + s;
      const b = a + BS + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// ── The pearl cluster ────────────────────────────────────────────────

function pearlGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const seats: readonly [number, number, number][] = [
    [0, 0.09, 0],
    [0.16, 0.06, 0.05],
    [-0.1, 0.05, 0.13],
  ];
  const SIDES = 6;
  const LEVELS = 3;
  for (const [cx, cy, cz] of seats) {
    const base = positions.length / 3;
    const R = cy;
    for (let j = 0; j <= LEVELS; j++) {
      const h = j / LEVELS;
      const y = cy + R * Math.cos(Math.PI * (1 - h));
      const radius = R * Math.sin(Math.PI * (1 - h)) + 0.01;
      for (let s = 0; s <= SIDES; s++) {
        const a = (s / SIDES) * Math.PI * 2;
        positions.push(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius);
        const t = smoothstep01((h - 0.2) / 0.7);
        colors.push(0.5 + 0.5 * t, 0.52 + 0.46 * t, 0.5 + 0.48 * t);
      }
    }
    for (let j = 0; j < LEVELS; j++) {
      for (let s = 0; s < SIDES; s++) {
        const a = base + j * (SIDES + 1) + s;
        const b = a + SIDES + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildPale2Gardens(
  combFanAnchors: readonly FanAnchor[],
  lampFanAnchors: readonly FanAnchor[],
): Pale2GardensBuild {
  const meshes: (Mesh | InstancedMesh)[] = [];
  const lanternSpots: (readonly [number, number, number])[] = [];

  // ── Paper fans on every anchor ─────────────────────────────────────
  const fanRandom = new Random(SEED ^ 0x2a01);
  const anchors = [...combFanAnchors, ...lampFanAnchors];
  const fanMaterial = createToonMaterial({ color: 0xf4d9b0, vertexColors: true });
  fanMaterial.side = DoubleSide;
  // Sun-through-paper: a soft warm floor shaped by the same vertex
  // colours that paint the tissue — rims glow, hinges stay violet.
  fanMaterial.emissive = new Color(0xe8b57e);
  fanMaterial.emissiveIntensity = 0.3;
  fanMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const fans = new InstancedMesh(fanGeometry(), fanMaterial, anchors.length);
  fans.name = "pale2-paper-fans";
  fans.castShadow = false;
  fans.receiveShadow = false;
  const dummy = new Object3D();
  const out = new Vector3();
  for (const [index, anchor] of anchors.entries()) {
    const [x, y, z] = anchor.pos;
    out.set(anchor.normal[0], anchor.normal[1], anchor.normal[2]).normalize();
    dummy.position.set(x + out.x * 0.06, y, z + out.z * 0.06);
    // The fan opens off the wall: its +z faces along the flank normal,
    // tilted up so the pleats catch the paper light.
    dummy.rotation.set(0, Math.atan2(out.x, out.z), 0);
    dummy.rotateX(-fanRandom.range(0.15, 0.5));
    dummy.rotateZ(fanRandom.signed(0.4));
    const s = fanRandom.range(0.7, 1.7);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    fans.setMatrixAt(index, dummy.matrix);
  }
  fans.instanceMatrix.needsUpdate = true;
  fans.computeBoundingSphere();
  meshes.push(fans);

  // ── Lantern anemones: the basin gardens + the lit pool rims ───────
  // Round 2: CLUSTERED, not lawned — the r1 uniform scatter read as a
  // field of mushrooms. The gardens grow in lantern-clumps of 6–10
  // around seeded hearts, the way candles gather on a shrine.
  const anemoneRandom = new Random(SEED ^ 0x2b01);
  const seats: { x: number; y: number; z: number; s: number }[] = [];
  for (let heart = 0; heart < 24; heart++) {
    const a = anemoneRandom.range(0, Math.PI * 2);
    const r = 13 + 34 * Math.sqrt(anemoneRandom.next());
    const hu = LAMP_BASIN.u + Math.cos(a) * r;
    const hv = LAMP_BASIN.v + Math.sin(a) * r;
    const per = 6 + Math.floor(anemoneRandom.next() * 5);
    // Fuller clumps where the lamp light feels near (the story number).
    const keep = 0.4 + lumen(hu, hv) * 0.6;
    for (let i = 0; i < per; i++) {
      const spreadA = anemoneRandom.range(0, Math.PI * 2);
      const spreadR = anemoneRandom.range(0.2, 1.9);
      if (anemoneRandom.next() > keep) {
        continue;
      }
      const { x, z } = worldOf(hu + Math.cos(spreadA) * spreadR, hv + Math.sin(spreadA) * spreadR);
      seats.push({ x, y: pale2TerrainTarget(x, z), z, s: anemoneRandom.range(0.75, 1.2) });
    }
  }
  // The lit pools' rims take two clumps each (never the Still Pool —
  // the rest keeps its own rim bare).
  for (const pool of POOLS) {
    if (pool.rest) {
      continue;
    }
    for (let clump = 0; clump < 2; clump++) {
      const a = anemoneRandom.range(0, Math.PI * 2);
      const hu = pool.u + Math.cos(a) * pool.radius * 1.2;
      const hv = pool.v + Math.sin(a) * pool.radius * 1.2;
      const per = 5 + Math.floor(anemoneRandom.next() * 4);
      for (let i = 0; i < per; i++) {
        const spreadA = anemoneRandom.range(0, Math.PI * 2);
        const spreadR = anemoneRandom.range(0.2, 1.4);
        const { x, z } = worldOf(hu + Math.cos(spreadA) * spreadR, hv + Math.sin(spreadA) * spreadR);
        seats.push({ x, y: pale2TerrainTarget(x, z), z, s: anemoneRandom.range(0.65, 1.05) });
      }
    }
  }
  const anemoneMaterial = createToonMaterial({ color: 0xf0e0c8, vertexColors: true });
  anemoneMaterial.emissive = new Color(0xffd9a0);
  anemoneMaterial.emissiveIntensity = 0.5;
  anemoneMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const lanterns = new InstancedMesh(anemoneGeometry(), anemoneMaterial, seats.length);
  lanterns.name = "pale2-lantern-anemones";
  lanterns.castShadow = false;
  lanterns.receiveShadow = false;
  for (const [index, seat] of seats.entries()) {
    dummy.position.set(seat.x, seat.y - 0.02, seat.z);
    dummy.rotation.set(0, anemoneRandom.range(0, Math.PI * 2), 0);
    dummy.scale.set(seat.s, seat.s * anemoneRandom.range(0.9, 1.3), seat.s);
    dummy.updateMatrix();
    lanterns.setMatrixAt(index, dummy.matrix);
    if (index % 24 === 0) {
      lanternSpots.push([seat.x, seat.y + 0.6 * seat.s, seat.z]);
    }
  }
  lanterns.instanceMatrix.needsUpdate = true;
  lanterns.computeBoundingSphere();
  meshes.push(lanterns);

  // ── Pearl clusters at the lit pools' lips ─────────────────────────
  const pearlRandom = new Random(SEED ^ 0x2c01);
  const pearlSeats: { x: number; y: number; z: number; s: number }[] = [];
  for (const pool of POOLS) {
    if (pool.rest) {
      continue;
    }
    const per = Math.round(pool.radius * 2.2);
    for (let i = 0; i < per; i++) {
      const a = pearlRandom.range(0, Math.PI * 2);
      const r = pool.radius * pearlRandom.range(0.92, 1.2);
      const { x, z } = worldOf(pool.u + Math.cos(a) * r, pool.v + Math.sin(a) * r);
      pearlSeats.push({ x, y: pale2TerrainTarget(x, z), z, s: pearlRandom.range(0.8, 1.8) });
    }
  }
  const pearlMaterial = createToonMaterial({ color: 0xecf2ea, vertexColors: true });
  pearlMaterial.emissive = new Color(0xd8ecdc);
  pearlMaterial.emissiveIntensity = 0.16;
  pearlMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const pearls = new InstancedMesh(pearlGeometry(), pearlMaterial, pearlSeats.length);
  pearls.name = "pale2-pool-pearls";
  pearls.castShadow = false;
  pearls.receiveShadow = false;
  for (const [index, seat] of pearlSeats.entries()) {
    dummy.position.set(seat.x, seat.y - 0.02, seat.z);
    dummy.rotation.set(0, pearlRandom.range(0, Math.PI * 2), 0);
    dummy.scale.set(seat.s, seat.s, seat.s);
    dummy.updateMatrix();
    pearls.setMatrixAt(index, dummy.matrix);
  }
  pearls.instanceMatrix.needsUpdate = true;
  pearls.computeBoundingSphere();
  meshes.push(pearls);

  return { meshes, lanternSpots };
}

/** Shared with the tests: no seat may stand inside a registered rest. */
export function seatViolatesRests(x: number, z: number): boolean {
  const { u, v } = spokeOf(x, z);
  if (Math.hypot(u - RESTS.chapel.u, v - RESTS.chapel.v) < RESTS.chapel.radius) {
    return true;
  }
  if (Math.hypot(u - RESTS.stillPool.u, v - RESTS.stillPool.v) < RESTS.stillPool.radius) {
    return true;
  }
  return false;
}
