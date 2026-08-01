import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  Object3D,
  Vector3,
  type Mesh,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import type { ContactPatch } from "../../Seabed";
import { chalkTexture, mergedMesh, smoothstep01 } from "./Pale2Shared";
import {
  COMBS,
  FAR_GATE,
  RESTS,
  lumen,
  pale2TerrainTarget,
  roadCenter,
  spokeOf,
  worldOf,
  type CombSpec,
} from "./Pale2Terrain";

/**
 * The comb fins — the Lantern Combs' exclusive silhouette. Each fin is
 * a swept arc of standing chalk: a thin curved wall rising from a root
 * mound to an undulating crest that curls outward near the top like a
 * held wave. They stand in ranks, so every gallery view is slots of
 * white blade over violet shade — nothing in the province (or the
 * game) repeats the shape.
 *
 * Geometry: per fin, a station × ring grid along the arc — centre-line
 * point with an outward curl that grows quadratically with height,
 * skinned on both faces with real thickness (1.4 m at the root
 * tapering to a blade edge) plus a crest strip. ~750 triangles per
 * fin; all fins merge into TWO draws (warm and cool chalk families).
 *
 * Paint (value-first): violet root shade (a colour, never black),
 * paper mid, milky crest lift; faint strata banding by height; the
 * basin-facing fins take the lamp's warmth on their lit faces via
 * `lumen`. Fifteen authored fins + the White Chapel's seven-fin ring +
 * the Far Gate needle pair; plus one instanced draw of waymark
 * splinters pacing the road (the reveal-cadence carriers).
 */

const SEED = SEEDS.regionPale2;

const STATIONS = 26;
const RINGS = 8;

export interface FanAnchor {
  readonly pos: readonly [number, number, number];
  /** Outward normal of the flank the fan seats against. */
  readonly normal: readonly [number, number, number];
}

export interface Pale2CombsBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Flank seats for the paper-fan corals (world space). */
  readonly fanAnchors: readonly FanAnchor[];
  /** Fin-foot seats for percher stars and scree aprons (world space). */
  readonly footSpots: readonly { x: number; z: number; facing: number }[];
}

/** The chapel ring: seven inward-curved fins around the pearl pan. */
const CHAPEL_RING: readonly CombSpec[] = (() => {
  const ring: CombSpec[] = [];
  for (let i = 0; i < 7; i++) {
    const theta = (i / 7) * Math.PI * 2 + 0.35;
    // A gap in the ring faces the galleries (south-west), so the pan
    // has a doorway; fin 3 would stand in it and is simply shorter.
    ring.push({
      name: `chapel-${i}`,
      u: 905 + Math.cos(theta) * 26,
      v: 74 + Math.sin(theta) * 26,
      // Concave toward the pan: the arc centre sits beyond the fin
      // (yaw's outward radial points back at the pan), so the blade
      // curves around the chapel.
      yaw: theta + Math.PI,
      arcR: 14,
      span: 0.85,
      // Round 3: the ring raised a step so it reads as architecture
      // from inside its own doorway (the repositioned chapel pose).
      height: i === 3 ? 7 : 10.5 + (i % 3) * 2,
    });
  }
  return ring;
})();

/** One fin's skin: returns the geometry plus its dressing anchors. */
function finGeometry(
  comb: CombSpec,
  seed: number,
  cool: boolean,
  fanAnchors: FanAnchor[],
  colliders: SphereCollider[],
  contacts: ContactPatch[],
  footSpots: { x: number; z: number; facing: number }[],
): BufferGeometry {
  const random = new Random(seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Chalk repeats every ~6 m — round 2's finding: without a uv
  // attribute the map sampled ONE texel and the strata never drew.
  const uvArc = (comb.arcR * comb.span) / 6;
  const uvRise = comb.height / 6;

  // The arc's centre in spoke coordinates.
  const cu = comb.u - Math.cos(comb.yaw) * comb.arcR;
  const cv = comb.v - Math.sin(comb.yaw) * comb.arcR;
  const theta0 = comb.yaw - comb.span / 2;

  const wobbleSeed = seed ^ 0x0aef;
  const curl = random.range(1.6, 3.0) * (random.next() < 0.5 ? 1 : -1);

  // Station data first — the two faces and the crest strip share it.
  const stations: {
    x: number;
    z: number;
    ground: number;
    crest: number;
    nx: number;
    nz: number;
  }[] = [];
  for (let i = 0; i <= STATIONS; i++) {
    const t = i / STATIONS;
    const theta = theta0 + comb.span * t;
    const su = cu + Math.cos(theta) * comb.arcR;
    const sv = cv + Math.sin(theta) * comb.arcR;
    const { x, z } = worldOf(su, sv);
    const ground = pale2TerrainTarget(x, z);
    const envelope = 0.28 + 0.72 * Math.pow(Math.sin(Math.PI * t), 0.8);
    const undulate = (fbm(t * 6, seed % 97, { seed: wobbleSeed, period: 7, octaves: 2 }) - 0.5) * 2.4;
    const crest = ground + Math.max(2.2, comb.height * envelope + undulate);
    // Outward normal (radial from the arc centre), in world space.
    const outSpoke = { u: Math.cos(theta), v: Math.sin(theta) };
    const a = worldOf(su + outSpoke.u, sv + outSpoke.v);
    const nx = a.x - x;
    const nz = a.z - z;
    stations.push({ x, z, ground, crest, nx, nz });
  }

  // The two skinned faces.
  const ringOf = (i: number, j: number, side: number): [number, number, number] => {
    const st = stations[i]!;
    const h = j / RINGS;
    const y = st.ground - 0.8 + (st.crest - st.ground + 0.8) * h;
    const lean = curl * h * h;
    const thickness = 1.4 * (1 - 0.85 * h);
    const off = lean + side * (thickness / 2);
    return [st.x + st.nx * off, y, st.z + st.nz * off];
  };

  const paint = (i: number, j: number): [number, number, number] => {
    const st = stations[i]!;
    const h = j / RINGS;
    const { u, v } = spokeOf(st.x, st.z);
    // Root violet → paper mid → milky crest, with faint strata bands.
    const root = 1 - smoothstep01((h - 0.02) / 0.26);
    const crest = smoothstep01((h - 0.68) / 0.28);
    const band = 0.5 + 0.5 * Math.sin(h * (st.crest - st.ground) * 0.9 + i * 0.3);
    // Round 3: a vertical streak voice by station on top of the
    // horizontal strata — chalk drawn, not washed (with the uv map
    // finally sampling, both now read at portrait range).
    const streak = 0.5 + 0.5 * Math.sin(i * 1.9 + h * 2.2);
    let r = 0.99 - root * 0.16 + crest * 0.13 + (band - 0.5) * 0.12 + (streak - 0.5) * 0.06;
    let g = 0.98 - root * 0.22 + crest * 0.12 + (band - 0.5) * 0.12 + (streak - 0.5) * 0.06;
    let b = 1.0 - root * 0.1 + crest * 0.16 + (band - 0.5) * 0.07 + (streak - 0.5) * 0.04;
    // The lamp's warmth on the basin-facing ranks, mid heights only.
    const warm = lumen(u, v) * (1 - root) * (1 - crest) * (cool ? 0.2 : 0.4);
    r += warm * 0.08;
    g += warm * 0.02;
    b -= warm * 0.1;
    return [Math.min(1.12, r), Math.min(1.1, g), Math.min(1.14, b)];
  };

  for (const side of [1, -1]) {
    const base = positions.length / 3;
    for (let i = 0; i <= STATIONS; i++) {
      for (let j = 0; j <= RINGS; j++) {
        const [x, y, z] = ringOf(i, j, side);
        positions.push(x, y, z);
        const [r, g, b] = paint(i, j);
        colors.push(r, g, b);
        uvs.push((i / STATIONS) * uvArc, (j / RINGS) * uvRise);
      }
    }
    for (let i = 0; i < STATIONS; i++) {
      for (let j = 0; j < RINGS; j++) {
        const a = base + i * (RINGS + 1) + j;
        const b = a + RINGS + 1;
        if (side === 1) {
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        } else {
          indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
      }
    }
  }

  // The crest strip, closing the blade's top edge.
  const crestBase = positions.length / 3;
  for (let i = 0; i <= STATIONS; i++) {
    for (const side of [1, -1]) {
      const [x, y, z] = ringOf(i, RINGS, side);
      positions.push(x, y + 0.05, z);
      const [r, g, b] = paint(i, RINGS);
      colors.push(r, g, b);
      uvs.push((i / STATIONS) * uvArc, uvRise + (side === 1 ? 0 : 0.04));
    }
  }
  for (let i = 0; i < STATIONS; i++) {
    const a = crestBase + i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  // Colliders: two heights along the arc, every third station; the
  // sphere sits inside the wall so the blade is solid without bulging.
  for (let i = 2; i <= STATIONS - 2; i += 3) {
    const st = stations[i]!;
    const wallTop = st.crest - st.ground;
    for (const lift of [1.8, Math.min(wallTop - 1.2, 6.5)]) {
      if (lift < 1.2) {
        continue;
      }
      colliders.push({
        center: new Vector3(st.x, st.ground + lift, st.z),
        radius: 2.6,
      });
    }
    if (wallTop > 11) {
      colliders.push({
        center: new Vector3(st.x + st.nx * curl * 0.5, st.ground + wallTop * 0.72, st.z + st.nz * curl * 0.5),
        radius: 2.2,
      });
    }
  }

  // Contact shade + foot spots + fan seats.
  const midStation = stations[Math.floor(STATIONS / 2)]!;
  contacts.push({
    x: midStation.x,
    z: midStation.z,
    radius: comb.arcR * comb.span * 0.55,
    strength: 0.3,
  });
  for (const i of [3, Math.floor(STATIONS / 2), STATIONS - 3]) {
    const st = stations[i]!;
    footSpots.push({ x: st.x, z: st.z, facing: Math.atan2(st.nz, st.nx) });
  }
  const fanCount = Math.round(comb.height * 0.45);
  for (let f = 0; f < fanCount; f++) {
    const i = 2 + Math.floor(random.next() * (STATIONS - 4));
    const st = stations[i]!;
    const h = random.range(0.15, 0.66);
    const side = random.next() < 0.5 ? 1 : -1;
    const y = st.ground + (st.crest - st.ground) * h;
    const off = curl * h * h + side * (1.4 * (1 - 0.85 * h)) * 0.5;
    fanAnchors.push({
      pos: [st.x + st.nx * (off + side * 0.12), y, st.z + st.nz * (off + side * 0.12)],
      normal: [st.nx * side, 0, st.nz * side],
    });
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A Far Gate needle: a leaning tapered spire framing the reservation. */
function needleGeometry(
  u: number,
  v: number,
  height: number,
  leanV: number,
  colliders: SphereCollider[],
  contacts: ContactPatch[],
): BufferGeometry {
  const { x, z } = worldOf(u, v);
  const ground = pale2TerrainTarget(x, z);
  const lean = worldOf(u, v + leanV);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const SIDES = 8;
  const LEVELS = 6;
  for (let j = 0; j <= LEVELS; j++) {
    const h = j / LEVELS;
    const y = ground - 0.6 + (height + 0.6) * h;
    const radius = 2.2 * (1 - h * 0.92) + 0.12;
    const cx = x + (lean.x - x) * h * h;
    const cz = z + (lean.z - z) * h * h;
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      positions.push(cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius);
      const root = 1 - smoothstep01((h - 0.02) / 0.3);
      const crest = smoothstep01((h - 0.6) / 0.35);
      colors.push(0.98 - root * 0.22 + crest * 0.08, 0.97 - root * 0.28 + crest * 0.08, 1.0 - root * 0.14 + crest * 0.1);
      uvs.push((s / SIDES) * 2.3, h * (height / 6));
    }
  }
  for (let j = 0; j < LEVELS; j++) {
    for (let s = 0; s < SIDES; s++) {
      const a = j * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  for (const h of [0.15, 0.45, 0.75]) {
    colliders.push({
      center: new Vector3(
        x + (lean.x - x) * h * h,
        ground + height * h,
        z + (lean.z - z) * h * h,
      ),
      radius: Math.max(1.4, 2.4 * (1 - h * 0.8)),
    });
  }
  contacts.push({ x, z, radius: 5, strength: 0.32 });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A waymark splinter: a knee-to-chest comb shard, the road's pacing. */
function splinterGeometry(): BufferGeometry {
  const positions = new Float32Array([
    // A narrow doubled blade, leaning, ~1 m authored height.
    -0.3, 0, 0, 0.3, 0, 0, 0.18, 1.0, 0.08,
    -0.3, 0, 0, 0.18, 1.0, 0.08, -0.22, 0.86, 0.06,
    0, 0, -0.26, 0, 0, 0.26, 0.14, 0.92, 0.1,
    0, 0, -0.26, 0.14, 0.92, 0.1, -0.1, 0.6, -0.05,
    // A broken stub beside it.
    0.34, 0, 0.14, 0.62, 0, 0.2, 0.5, 0.34, 0.16,
  ]);
  const colors = new Float32Array(positions.length);
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let i = 0; i < positions.length / 3; i++) {
    const h = positions[i * 3 + 1]!;
    const root = 1 - smoothstep01((h - 0.05) / 0.3);
    colors[i * 3] = 0.99 - root * 0.2;
    colors[i * 3 + 1] = 0.98 - root * 0.26;
    colors[i * 3 + 2] = 1.0 - root * 0.12;
    uvs[i * 2] = (positions[i * 3]! + 0.3) * 0.5;
    uvs[i * 2 + 1] = h * 0.4;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildPale2Combs(): Pale2CombsBuild {
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const fanAnchors: FanAnchor[] = [];
  const footSpots: { x: number; z: number; facing: number }[] = [];

  const warmChalk = createToonMaterial({
    map: chalkTexture(),
    color: 0xf6efdd,
    vertexColors: true,
  });
  const coolChalk = createToonMaterial({
    map: chalkTexture(),
    // Round 4: a step up from 0xe3e5ee — the cool family's away-faces
    // leant saturated lavender in close quarters.
    color: 0xeaecf4,
    vertexColors: true,
  });

  const warmParts: BufferGeometry[] = [];
  const coolParts: BufferGeometry[] = [];
  const all = [...COMBS, ...CHAPEL_RING];
  for (const [index, comb] of all.entries()) {
    const cool = comb.name.startsWith("chapel") || index % 3 === 1;
    const geometry = finGeometry(
      comb,
      SEED ^ (0x0a01 + index * 131),
      cool,
      // The chapel ring seats no fans: the hush keeps bare blades.
      comb.name.startsWith("chapel") ? [] : fanAnchors,
      colliders,
      contacts,
      comb.name.startsWith("chapel") ? [] : footSpots,
    );
    (cool ? coolParts : warmParts).push(geometry);
  }

  // The Far Gate needles, framing the reserved depth-3 corridor.
  warmParts.push(needleGeometry(FAR_GATE.u, FAR_GATE.v, 14, 3.5, colliders, contacts));
  coolParts.push(needleGeometry(FAR_GATE.u, -FAR_GATE.v, 12, -3, colliders, contacts));

  meshes.push(mergedMesh(warmParts, warmChalk, "pale2-combs-warm"));
  meshes.push(mergedMesh(coolParts, coolChalk, "pale2-combs-cool"));

  // The waymark splinters pacing the road: the reveal-cadence carriers
  // from the threshold (visible BEFORE pale-1's ring curtains) to the
  // Pearl Steps. Rests and pool bowls are respected by construction.
  const random = new Random(SEED ^ 0x0b01);
  const splinters = new InstancedMesh(
    splinterGeometry(),
    createToonMaterial({ map: chalkTexture(), color: 0xf3ecdc, vertexColors: true }),
    52,
  );
  splinters.name = "pale2-waymarks";
  splinters.castShadow = false;
  splinters.receiveShadow = false;
  const dummy = new Object3D();
  let placed = 0;
  const placeSplinter = (u: number, v: number): void => {
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, pale2TerrainTarget(x, z) - 0.05, z);
    dummy.rotation.set(random.signed(0.08), random.range(0, Math.PI * 2), random.signed(0.08));
    const s = random.range(1.2, 2.4);
    dummy.scale.set(s, s * random.range(1.0, 1.5), s);
    dummy.updateMatrix();
    splinters.setMatrixAt(placed, dummy.matrix);
    placed++;
  };
  // Round 3: an authored pair on the threshold (u 660–700) — the
  // pass-threshold frame carried pale-1's fills but no mark of OURS
  // before the ring curtains.
  placeSplinter(664, roadCenter(664) - 6);
  placeSplinter(689, roadCenter(689) + 6.5);
  for (let u = 645; u <= 1120 && placed < 52; u += random.range(20, 30)) {
    const side = placed % 2 === 0 ? 1 : -1;
    const v = roadCenter(u) + side * random.range(4.5, 8);
    if (stationBlocked(u, v)) {
      continue;
    }
    placeSplinter(u, v);
  }
  splinters.count = placed;
  splinters.instanceMatrix.needsUpdate = true;
  splinters.computeBoundingSphere();
  meshes.push(splinters);

  return { meshes, colliders, contacts, fanAnchors, footSpots };
}

/** True where a waymark may not stand: rests and the pool bowls. */
function stationBlocked(u: number, v: number): boolean {
  if (Math.hypot(u - RESTS.chapel.u, v - RESTS.chapel.v) < RESTS.chapel.radius + 3) {
    return true;
  }
  if (Math.hypot(u - RESTS.stillPool.u, v - RESTS.stillPool.v) < RESTS.stillPool.radius + 3) {
    return true;
  }
  if (u > RESTS.winnowShadow.fromU - 2 && u < RESTS.winnowShadow.toU + 2) {
    return true;
  }
  return false;
}
