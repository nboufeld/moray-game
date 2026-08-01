import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Object3D,
  type Mesh,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { smoothstep01 } from "./Pale3Shared";
import {
  MERE,
  RESTS,
  blushWeight,
  pale3TerrainTarget,
  spokeOf,
  terraceLevel,
  worldOf,
} from "./Pale3Terrain";
import type { CrownSpot } from "./Pale3Fonts";

/**
 * The lit growth of the Dayspring — the region's glowing exclusives:
 *
 * - **Dawnbuds**: slim stalks holding teardrop buds of first light —
 *   the candles of the morning. They crowd the lit font crowns (the
 *   crown gardens the towers hold up to the light), pace the Dawn
 *   Steps' terrace lips, and stand rose-tipped in the Blushfields.
 *   The emissive is shaped by the vertex colours (the glow-colony
 *   discipline: a bud over a dim stalk reads as a held light, capped
 *   far under bloom). One instanced draw.
 * - **Terrace pearls**: nacre bead triples seeded along the terrace
 *   lips — the steps of the morning wear its dew. One instanced draw.
 */

const SEED = SEEDS.regionPale3;

const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

export interface Pale3GardensBuild {
  readonly meshes: (Mesh | InstancedMesh)[];
  /** Bud-top positions, for the moth-fry hover anchors. */
  readonly budSpots: readonly (readonly [number, number, number])[];
}

/** A slim stalk holding a glowing teardrop bud; origin at the foot. */
function dawnbudGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  // The stalk: violet-pale, dim but never dark.
  const SIDES = 5;
  const stalkH = 0.34;
  for (let j = 0; j <= 2; j++) {
    const h = j / 2;
    const radius = 0.055 * (1 - h * 0.35);
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, stalkH * h, Math.sin(a) * radius);
      colors.push(0.48, 0.42, 0.56);
    }
  }
  for (let j = 0; j < 2; j++) {
    for (let s = 0; s < SIDES; s++) {
      const a = j * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // The bud: a teardrop of light — round at the base, gathered to a
  // soft point, brightest at the tip (a flame shape, not a mushroom).
  const base = positions.length / 3;
  const LEVELS = 6;
  const BS = 7;
  const R = 0.1;
  const H = 0.26;
  for (let j = 0; j <= LEVELS; j++) {
    const h = j / LEVELS;
    const y = stalkH + 0.03 + H * h;
    const radius = R * Math.sin(Math.PI * (0.12 + 0.88 * h * 0.72)) * (1 - h * 0.55) + 0.012;
    for (let s = 0; s <= BS; s++) {
      const a = (s / BS) * Math.PI * 2;
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      const t = smoothstep01((h - 0.05) / 0.8);
      const value = 0.4 + 0.6 * t;
      colors.push(value, value * 0.88, value * 0.66);
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

/** Three nacre beads on one seat. */
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
        colors.push(0.52 + 0.48 * t, 0.53 + 0.44 * t, 0.5 + 0.46 * t);
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

export function buildPale3Gardens(crownSpots: readonly CrownSpot[]): Pale3GardensBuild {
  const meshes: (Mesh | InstancedMesh)[] = [];
  const budSpots: (readonly [number, number, number])[] = [];
  const random = new Random(SEED ^ 0x2a01);
  const dummy = new Object3D();

  // ── Dawnbud seats ──────────────────────────────────────────────────
  interface Seat {
    x: number;
    y: number;
    z: number;
    s: number;
    rose: boolean;
  }
  const seats: Seat[] = [];

  // Crown gardens: candles ringing every lit crown's mouth.
  for (const spot of crownSpots) {
    const [mx, my, mz] = spot.mouth;
    const per = 6 + Math.floor(random.next() * 4);
    for (let i = 0; i < per; i++) {
      const a = random.range(0, Math.PI * 2);
      const r = random.range(0.9, 2.1);
      seats.push({
        x: mx + Math.cos(a) * r,
        y: my - 0.55 - r * 0.22,
        z: mz + Math.sin(a) * r,
        s: random.range(0.85, 1.3),
        rose: false,
      });
    }
  }

  // Terrace-lip candles: clumps pacing the three risers of the Dawn
  // Steps (the doorstep pan and the mere keep their silence).
  for (const at of [1584, 1602, 1620] as const) {
    for (let clump = 0; clump < 6; clump++) {
      const hv = random.range(-48, 62);
      if (blocked(at + 1.5, hv)) {
        continue;
      }
      const per = 4 + Math.floor(random.next() * 4);
      for (let i = 0; i < per; i++) {
        const su = at + 1.2 + random.range(0, 1.8);
        const sv = hv + random.signed(1.6);
        if (blocked(su, sv)) {
          continue;
        }
        const { x, z } = worldOf(su, sv);
        seats.push({
          x,
          y: pale3TerrainTarget(x, z),
          z,
          s: random.range(0.7, 1.1),
          rose: false,
        });
      }
    }
  }

  // Blushfield candles: rose-tipped, fuller where the dawn is.
  for (let clump = 0; clump < 22; clump++) {
    const hu = random.range(1364, 1556);
    const hv = random.range(-118, -38);
    const keep = blushWeight(hu, hv);
    if (keep < 0.12) {
      continue;
    }
    const per = 5 + Math.floor(random.next() * 5);
    for (let i = 0; i < per; i++) {
      const su = hu + random.signed(1.9);
      const sv = hv + random.signed(1.9);
      if (blocked(su, sv) || random.next() > 0.35 + keep * 0.65) {
        continue;
      }
      const { x, z } = worldOf(su, sv);
      seats.push({
        x,
        y: pale3TerrainTarget(x, z),
        z,
        s: random.range(0.65, 1.05),
        rose: true,
      });
    }
  }

  const budMaterial = createToonMaterial({ color: 0xf0e2ca, vertexColors: true });
  budMaterial.emissive = new Color(0xffd9a0);
  budMaterial.emissiveIntensity = 0.5;
  budMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const buds = new InstancedMesh(dawnbudGeometry(), budMaterial, seats.length);
  buds.name = "pale3-dawnbuds";
  buds.castShadow = false;
  buds.receiveShadow = false;
  const rose = new Color(1.0, 0.82, 0.86);
  const gold = new Color(1, 1, 1);
  for (const [index, seat] of seats.entries()) {
    dummy.position.set(seat.x, seat.y - 0.02, seat.z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.set(seat.s, seat.s * random.range(0.9, 1.3), seat.s);
    dummy.updateMatrix();
    buds.setMatrixAt(index, dummy.matrix);
    buds.setColorAt(index, seat.rose ? rose : gold);
    if (index % 22 === 0) {
      budSpots.push([seat.x, seat.y + 0.66 * seat.s, seat.z]);
    }
  }
  buds.instanceMatrix.needsUpdate = true;
  if (buds.instanceColor) {
    buds.instanceColor.needsUpdate = true;
  }
  buds.computeBoundingSphere();
  meshes.push(buds);

  // ── Terrace pearls along the risers ────────────────────────────────
  const pearlRandom = new Random(SEED ^ 0x2c01);
  const pearlSeats: { x: number; y: number; z: number; s: number }[] = [];
  for (const at of [1584, 1602, 1620] as const) {
    for (let i = 0; i < 16; i++) {
      const sv = pearlRandom.range(-52, 66);
      const su = at + pearlRandom.range(0.6, 2.4);
      if (blocked(su, sv)) {
        continue;
      }
      const { x, z } = worldOf(su, sv);
      pearlSeats.push({ x, y: pale3TerrainTarget(x, z), z, s: pearlRandom.range(0.8, 1.8) });
    }
  }
  // Round 2: bead clusters at the Mere's lip — the mirror wears its dew
  // too, strictly OUTSIDE the rest radius (the stillness is framed).
  for (let i = 0; i < 14; i++) {
    const a = pearlRandom.range(0, Math.PI * 2);
    const r = MERE.radius + pearlRandom.range(2.2, 6.5);
    const su = MERE.u + Math.cos(a) * r;
    const sv = MERE.v + Math.sin(a) * r;
    if (blocked(su, sv)) {
      continue;
    }
    const { x, z } = worldOf(su, sv);
    pearlSeats.push({ x, y: pale3TerrainTarget(x, z), z, s: pearlRandom.range(1.0, 2.0) });
  }
  const pearlMaterial = createToonMaterial({ color: 0xecf2ea, vertexColors: true });
  pearlMaterial.emissive = new Color(0xdaeddf);
  pearlMaterial.emissiveIntensity = 0.16;
  pearlMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const pearls = new InstancedMesh(pearlGeometry(), pearlMaterial, pearlSeats.length);
  pearls.name = "pale3-terrace-pearls";
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

  return { meshes, budSpots };
}

/** True where no garden seat may stand: the rests. */
function blocked(u: number, v: number): boolean {
  if (
    Math.hypot(u - RESTS.stillMorning.u, v - RESTS.stillMorning.v) < RESTS.stillMorning.radius + 1
  ) {
    return true;
  }
  if (Math.hypot(u - RESTS.doorstep.u, v - RESTS.doorstep.v) < RESTS.doorstep.radius + 1) {
    return true;
  }
  if (u > RESTS.undawn.fromU - 2 && u < RESTS.undawn.toU + 2) {
    return true;
  }
  return false;
}

/** Shared with the tests: no seat may stand inside a registered rest. */
export function seatViolatesRests(x: number, z: number): boolean {
  const { u, v } = spokeOf(x, z);
  return blocked(u, v);
}

// Re-exported for the terrace tests.
export { terraceLevel };
