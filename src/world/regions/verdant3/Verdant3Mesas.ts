import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Matrix4,
  Mesh,
  Vector3,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { mergedMesh, smoothstep01 } from "./Verdant3Shared";
import {
  FALLEN,
  HOLLOW,
  MESAS,
  WELLSPRINGS,
  WORLDS_END,
  channelCenter,
  channelHalf,
  stepFootU,
  worldOf,
  type MesaSpec,
} from "./Verdant3Terrain";

/**
 * The Canopy Deep's stone: the MESA PILLARS — the promise verdant-2's
 * Far Balcony painted, kept at full size. Seven colossal flat-topped
 * columns (26–38 m) rising from root mounds to hanging-garden crowns,
 * one of them hollow (the secret: an open-topped chimney with a mouth
 * at its foot), one of them fallen (a causeway across the meadow, a
 * swim-under beneath its chin) — plus the pass's waymarks and gate
 * jambs, the wellspring lip stones, the Twin Court slabs, the
 * Province's End balcony, and the meadow's scattered field stones.
 *
 * Each pillar is a custom painted lathe (authored value-first vertex
 * paint: strata bands, moss streaks, violet under the crown flare, a
 * milky crest at the garden lip — the darkest mark is a colour), merged
 * into ONE mesh so seven mountains cost one draw. Everything solid
 * returns sphere colliders; everything standing returns a contact patch
 * so the ground bake seats it.
 */

const SEED = SEEDS.regionVerdant3;

export interface MesaCrown {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly topY: number;
  readonly topR: number;
}

export interface Verdant3MesasBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Crown plateaus, for the canopy's garden pads and drape anchors. */
  readonly crowns: MesaCrown[];
  /** The Hollow Mesa's mouth, where the Elderleaf keeps its rounds. */
  readonly mouth: { x: number; z: number; y: number; facing: number };
  /** The fallen pillar's head, for its sideways crown garden. */
  readonly fallenHead: { x: number; z: number; y: number };
}

// ─── The pillar lathe ───────────────────────────────────────────────────────

// Round 2: rings and segments raised — at close range the r1 lathe
// showed metre-wide flat facets, and a flat facet under toon light is a
// flat value (the "plastic column" read).
const RING_TS = [
  0, 0.03, 0.07, 0.12, 0.18, 0.25, 0.33, 0.42, 0.51, 0.6, 0.68, 0.75, 0.81, 0.86, 0.9, 0.935,
  0.965, 1,
] as const;
const SEGMENTS = 24;

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}

/** The column's silhouette: foot flare, waist, crown flare, plateau lip.
 *  The `log` profile (the Fallen Mesa) is a plain tapered bole — the r1
 *  fallen pillar wore the standing profile sideways and read as a
 *  crumpled sheet. */
function mesaRadius(spec: MesaSpec, t: number, log = false): number {
  const foot = spec.footR;
  if (log) {
    return t >= 1 ? foot * 0.42 : foot * (0.62 + 0.38 * Math.pow(1 - t, 1.2));
  }
  let r = foot * (0.5 + 0.5 * Math.pow(1 - t, 1.7));
  r += foot * 0.05 * Math.sin(t * Math.PI);
  // The crown flare: the garden lip the drapes hang from.
  r += foot * 0.32 * smoothstep01((t - 0.8) / 0.13) * (1 - smoothstep01((t - 0.955) / 0.045));
  if (t >= 1) {
    r = spec.hollow ? 2.4 : foot * 0.55;
  }
  return r;
}

/**
 * One mesa pillar: a painted lathe with fbm-roughed rings, a wobbling
 * axis, a capped garden plateau (or an open oculus for the hollow one),
 * and — for the hollow one — a mouth cut at its foot.
 */
function mesaGeometry(spec: MesaSpec, mouthAngle: number, log = false): BufferGeometry {
  const noiseSeed = SEED ^ (0x0a01 + MESAS.indexOf(spec) * 97);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const rings = RING_TS.length;
  const wobble = (t: number, salt: number): number =>
    (fbm(t * 5 + salt, salt * 0.7, { seed: noiseSeed ^ salt, period: 4, octaves: 2 }) - 0.5) *
    spec.footR *
    0.4 *
    smoothstep01(t / 0.25);

  for (let ringIndex = 0; ringIndex < rings; ringIndex++) {
    const t = RING_TS[ringIndex]!;
    const y = t * spec.height;
    const cx = wobble(t, 3);
    const cz = wobble(t, 11);
    const base = mesaRadius(spec, t, log);

    for (let s = 0; s <= SEGMENTS; s++) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      const rough =
        1 +
        (fbm(nx * 1.3 + 5, nz * 1.3 + t * 7, { seed: noiseSeed, period: 5, octaves: 2 }) - 0.5) *
          0.32;
      const r = base * rough;
      positions.push(cx + nx * r, y, cz + nz * r);

      // ── The paint ──
      // Stone base: cool grey-green, never one value up the column.
      // Round 2: strata amplitude and moss coverage both raised, and a
      // fine grain jitter added — the r1 columns read as one flat wash.
      const strata = Math.max(0, Math.sin(y * 0.5 + noiseSeed % 7)) ** 2;
      const grain =
        (fbm(nx * 3.4 + 9, nz * 3.4 + t * 11, { seed: noiseSeed ^ 0x71, period: 9, octaves: 2 }) -
          0.5) *
        0.18;
      const streak = smoothstep01(
        (fbm(nx * 2.1, nz * 2.1 + t * 1.6, { seed: noiseSeed ^ 0x33, period: 6, octaves: 2 }) -
          0.4) /
          0.24,
      );
      // Round 3: violet runnels — vertical shadow runs between the moss
      // streaks, so a close flank carries a drawing, not a wash.
      const runnel = smoothstep01(
        (fbm(nx * 2.7 + 4, nz * 2.7 - t * 0.9, { seed: noiseSeed ^ 0x55, period: 7, octaves: 2 }) -
          0.56) /
          0.18,
      );
      let cr = 0.58 - strata * 0.12 + grain;
      let cg = 0.62 - strata * 0.09 + grain;
      let cb = 0.56 - strata * 0.05 + grain * 0.8;
      // Round 4: the runnel violet damped on the log — sideways, the
      // violet runs read as pink blotches on the pale bole (the r3
      // fallen-causeway fail).
      cr += (0.46 - cr) * runnel * (log ? 0.3 : 0.8);
      cg += (0.44 - cg) * runnel * (log ? 0.3 : 0.8);
      cb += (0.56 - cb) * runnel * (log ? 0.3 : 0.8);
      // Moss streaks climb the shaded runnels; the foot is thick with it.
      // Round 3: the moss key brightened (log included) — the r2 fallen
      // pillar read as a pale tarp; a mossy bole is DRAWN by its moss.
      // Round 4: the log's moss coverage doubled down — band amplitude
      // 0.55 → 0.9, a 0.18 floor, and the streaks at 1.2; twice now the
      // bole read pale, so the moss stops being a suggestion.
      const bands = log ? Math.max(0, Math.sin(t * 34 + noiseSeed % 9)) ** 2 * 0.9 : 0;
      // Round 5: the moss saddle — the log lies on its side, so its READ
      // is the lit top plane (local -nz after the fall's X-rotation), and
      // twice the length-wise bands alone left that plane pale under the
      // full toon band. The saddle rides the up-facing half directly.
      const saddle = log ? Math.max(0, -nz) ** 1.4 * 0.85 : 0;
      const moss = Math.min(
        1,
        streak * (log ? 1.2 : 0.95) +
          (1 - smoothstep01(t / 0.16)) * 0.7 +
          bands +
          saddle +
          (log ? 0.18 : 0),
      );
      cr += (0.4 - cr) * moss;
      cg += (0.74 - cg) * moss;
      cb += (0.44 - cb) * moss;
      // Violet under the crown flare — the overhang's shadow is a colour.
      const under = log
        ? 0
        : smoothstep01((t - 0.74) / 0.1) * (1 - smoothstep01((t - 0.9) / 0.06));
      cr += (0.44 - cr) * under * 0.7;
      cg += (0.38 - cg) * under * 0.7;
      cb += (0.52 - cb) * under * 0.7;
      // The milky crest at the garden lip: the distance rule, painted on.
      const crest = log ? 0 : smoothstep01((t - 0.92) / 0.08);
      cr += (0.8 - cr) * crest;
      cg += (0.9 - cg) * crest;
      cb += (0.74 - cb) * crest;
      colors.push(cr, cg, cb);
    }
  }

  const stride = SEGMENTS + 1;
  const mouthTopY = 5.8;
  for (let ringIndex = 0; ringIndex < rings - 1; ringIndex++) {
    const t = RING_TS[ringIndex]!;
    const y = t * spec.height;
    for (let s = 0; s < SEGMENTS; s++) {
      if (spec.hollow && y < mouthTopY) {
        const mid = ((s + 0.5) / SEGMENTS) * Math.PI * 2;
        if (angleBetween(mid, mouthAngle) < 0.62) {
          continue;
        }
      }
      const a = ringIndex * stride + s;
      const b = a + stride;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  // The plateau cap (solid pillars only): a garden-green fan with gold
  // flecks — the crown the drapes and pads dress.
  if (!spec.hollow) {
    const topRing = (rings - 1) * stride;
    const centerIndex = positions.length / 3;
    positions.push(wobble(1, 3), spec.height + 0.9, wobble(1, 11));
    colors.push(0.5, 0.78, 0.46);
    for (let s = 0; s < SEGMENTS; s++) {
      indices.push(topRing + s, centerIndex, topRing + s + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// ─── The build ──────────────────────────────────────────────────────────────

export function buildVerdant3Mesas(): Verdant3MesasBuild {
  const random = new Random(SEED ^ 0x50cb);
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const crowns: MesaCrown[] = [];

  const moss: BufferGeometry[] = [];
  const pale: BufferGeometry[] = [];
  const mesaParts: BufferGeometry[] = [];

  /** Seats a rock-family stone on the composed ground; books physics. */
  const stand = (
    bucket: BufferGeometry[],
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    lift = 0,
  ): { x: number; z: number; y: number } => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z) + lift;
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    bucket.push(geometry);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
    return { x, z, y };
  };

  /** Scenery: contact shade only, no collider. */
  const scenery = (
    bucket: BufferGeometry[],
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
  ): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    bucket.push(geometry);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.35 });
  };

  // ─── The Mesa Pillars ──────────────────────────────────────────────────────
  let mouth = { x: 0, z: 0, y: 0, facing: 0 };
  for (const spec of MESAS) {
    const { x, z } = worldOf(spec.u, spec.v);
    const footY = seabedHeight(x, z) - 0.6;

    // The hollow one's mouth faces the northwest meadow — drape-hidden.
    let mouthAngle = 0;
    let yaw = random.range(0, Math.PI * 2);
    if (spec.hollow) {
      const target = worldOf(spec.u - 20, spec.v + 24);
      const dx = target.x - x;
      const dz = target.z - z;
      const len = Math.hypot(dx, dz) || 1;
      yaw = Math.atan2(-(dz / len), dx / len);
      mouthAngle = 0;
      const my = seabedHeight(x + (dx / len) * spec.footR, z + (dz / len) * spec.footR);
      mouth = {
        x: x + (dx / len) * (spec.footR + 2),
        z: z + (dz / len) * (spec.footR + 2),
        y: my + 1.4,
        facing: Math.atan2(dz, dx),
      };
    }

    const geometry = mesaGeometry(spec, mouthAngle);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, footY, z);
    mesaParts.push(geometry);

    contacts.push({ x, z, radius: spec.footR * 1.7, strength: 0.45 });
    crowns.push({
      name: spec.name,
      x,
      z,
      topY: footY + spec.height,
      topR: spec.hollow ? spec.footR * 0.62 : spec.footR * 0.55,
    });

    if (spec.hollow) {
      // Wall-ring colliders: the chamber stays swimmable, the wall does
      // not pass, and the mouth sector stays open below its lintel.
      const wallR = mesaRadius(spec, 0.2);
      for (let level = 0; level < 9; level++) {
        const y = footY + 1.6 + level * 3.4;
        for (let s = 0; s < 8; s++) {
          const a = (s / 8) * Math.PI * 2;
          if (y < footY + mouthTopOf(spec) && angleBetween(a, yawedMouth(yaw)) < 0.7) {
            continue;
          }
          colliders.push({
            center: new Vector3(x + Math.cos(a) * wallR, y, z + Math.sin(a) * wallR),
            radius: 1.8,
          });
        }
      }
    } else {
      // Axis spheres up the column; the crown flare gets its own pair.
      for (let y = 1.5; y < spec.height - 3; y += 4) {
        const t = y / spec.height;
        colliders.push({
          center: new Vector3(x, footY + y, z),
          radius: mesaRadius(spec, t) * 1.05 + 0.5,
        });
      }
      colliders.push({
        center: new Vector3(x, footY + spec.height - 1.5, z),
        radius: spec.footR * 0.85 + 0.6,
      });
    }
  }

  // ─── The Hollow Mesa's mouth dressing ──────────────────────────────────────
  // Round 3: the raw lathe cut read as razor diagonals — the doorway
  // takes two flank boulders and a leaning lintel slab, so the secret's
  // mouth is a grown thing, not a boolean.
  {
    const across = mouth.facing + Math.PI / 2;
    for (const [i, side] of [-1, 1].entries()) {
      const bx = mouth.x + Math.cos(across) * side * 3.4 - Math.cos(mouth.facing) * 0.8;
      const bz = mouth.z + Math.sin(across) * side * 3.4 - Math.sin(mouth.facing) * 0.8;
      const boulder = boulderGeometry({
        seed: SEED ^ (0x0ab8 + i),
        radius: 1.6 - i * 0.25,
        height: 2.6 - i * 0.4,
      });
      const by = seabedHeight(bx, bz);
      boulder.applyMatrix4(new Matrix4().makeRotationY(random.range(0, Math.PI * 2)));
      boulder.translate(bx, by, bz);
      moss.push(boulder);
      contacts.push({ x: bx, z: bz, radius: 2.0, strength: 0.4 });
      colliders.push({ center: new Vector3(bx, by + 1.0, bz), radius: 1.3 });
    }
    const lintel = slabGeometry({ seed: SEED ^ 0x0aba, radius: 2.8, height: 1.2 });
    lintel.applyMatrix4(new Matrix4().makeRotationZ(0.12));
    lintel.applyMatrix4(new Matrix4().makeRotationY(mouth.facing));
    const lx = mouth.x - Math.cos(mouth.facing) * 1.6;
    const lz = mouth.z - Math.sin(mouth.facing) * 1.6;
    lintel.translate(lx, mouth.y + 4.6, lz);
    moss.push(lintel);
    colliders.push({ center: new Vector3(lx, mouth.y + 5.4, lz), radius: 1.9 });
  }

  // ─── The Fallen Mesa ───────────────────────────────────────────────────────
  // A toppled pillar lying tail-sunk across the meadow, its head propped
  // on a boulder — a causeway to follow and a swim-under at the chin.
  const tail = worldOf(FALLEN.tailU, FALLEN.tailV);
  const head = worldOf(FALLEN.headU, FALLEN.headV);
  const tailY = seabedHeight(tail.x, tail.z) + 0.6;
  const headY = seabedHeight(head.x, head.z) + 4.8;
  const length = Math.hypot(head.x - tail.x, head.z - tail.z);

  const prop = boulderGeometry({ seed: SEED ^ 0x0ab1, radius: 2.4, height: 3.4 });
  prop.translate(head.x, seabedHeight(head.x, head.z), head.z);
  moss.push(prop);
  contacts.push({ x: head.x, z: head.z, radius: 3.1, strength: 0.45 });
  colliders.push({
    center: new Vector3(head.x, seabedHeight(head.x, head.z) + 1.4, head.z),
    radius: 2.1,
  });

  const fallenSpec: MesaSpec = { name: "fallen", u: 0, v: 0, height: length, footR: 3.2 };
  const fallen = mesaGeometry(fallenSpec, 0, true);
  const fallenYaw = Math.atan2(head.x - tail.x, head.z - tail.z);
  const incline = Math.atan2(headY - tailY, length);
  fallen.applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2 - incline));
  fallen.applyMatrix4(new Matrix4().makeRotationY(fallenYaw));
  fallen.translate(tail.x, tailY, tail.z);
  mesaParts.push(fallen);
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    const bx = tail.x + (head.x - tail.x) * t;
    const bz = tail.z + (head.z - tail.z) * t;
    const by = tailY + (headY - tailY) * t;
    colliders.push({
      center: new Vector3(bx, by, bz),
      radius: 2.9 - Math.abs(t - 0.5) * 0.8,
    });
    if (i % 2 === 0) {
      contacts.push({ x: bx, z: bz, radius: 3.4, strength: 0.35 });
    }
  }
  const fallenHead = { x: head.x, z: head.z, y: headY };

  // ─── The pass waymarks ─────────────────────────────────────────────────────
  // The Deep Sentinel: the first thing of ours the fog gives up.
  // Round 2: grown — at r1 it read as a pebble on the horizon from the
  // threshold pose (the verdant-2 Cistern lesson at road scale).
  stand(
    pale,
    stackGeometry(
      [
        { radius: 1.7, rise: 0.7, stretch: 2.0, lean: 0.3 },
        { radius: 1.1, rise: 4.6, stretch: 1.8, lean: 0.8 },
      ],
      { seed: SEED ^ 0x0a41 },
    ),
    1168,
    channelCenter(1168) - 6.2,
    0.7,
    1.7,
    6.2,
  );
  // A second worn stack past the midway boulders.
  stand(
    pale,
    stackGeometry(
      [
        { radius: 1.2, rise: 0.6, stretch: 1.8, lean: -0.35 },
        { radius: 0.8, rise: 2.9, stretch: 1.6, lean: -0.9 },
      ],
      { seed: SEED ^ 0x0a42 },
    ),
    1224,
    channelCenter(1224) + 6.8,
    3.6,
    1.2,
    4.0,
  );
  // Waymark boulder pairs pacing the road every ~25 m.
  for (const [i, u] of [1150, 1182, 1212, 1240].entries()) {
    for (const side of [-1, 1]) {
      const radius = random.range(0.8, 1.3);
      scenery(
        moss,
        boulderGeometry({
          seed: SEED ^ (0x0a50 + i * 2 + (side + 1) / 2),
          radius,
          height: radius * random.range(0.8, 1.2),
        }),
        u + random.signed(2),
        channelCenter(u) + side * random.range(4.5, 6.5),
        random.range(0, Math.PI * 2),
        radius,
      );
    }
  }

  // ─── The Eaves Gate's jambs ────────────────────────────────────────────────
  // Two great moss-hung stacks framing the first riser, inside the
  // channel so they read against the banks (the verdant-2 lesson), and
  // past u 1240 so no distance curtain can swallow them.
  for (const [i, side] of [-1, 1].entries()) {
    const u = 1251 + i * 2;
    stand(
      moss,
      stackGeometry(
        [
          { radius: 2.1 - i * 0.2, rise: 0.9, stretch: 2.2, lean: side * 0.4 },
          { radius: 1.4 - i * 0.2, rise: 6.6 - i * 0.7, stretch: 2.0, lean: side * 1.2 },
        ],
        { seed: SEED ^ (0x0a60 + i) },
      ),
      u,
      channelCenter(u) + side * (channelHalf(u) - 3),
      side * 0.9,
      2.1,
      9.6 - i * 0.8,
    );
  }

  // ─── The step ledges down the Boughfall ───────────────────────────────────
  for (let i = 0; i < 6; i++) {
    const u = stepFootU(i) + 0.8;
    for (const side of [-1, 1]) {
      const v = channelCenter(u) + side * random.range(4, 7);
      const radius = random.range(1.6, 2.6);
      stand(
        moss,
        slabGeometry({
          seed: SEED ^ (0x0a70 + i * 2 + (side + 1) / 2),
          radius,
          height: radius * 0.42,
        }),
        u + random.signed(1.2),
        v,
        random.range(0, Math.PI * 2),
        radius,
        radius * 0.42,
      );
    }
  }

  // ─── The descent-foot overlook boulder ────────────────────────────────────
  stand(
    moss,
    boulderGeometry({ seed: SEED ^ 0x0a80, radius: 2.7, height: 3.5 }),
    1318,
    channelCenter(1312) - 11,
    random.range(0, Math.PI * 2),
    2.7,
    3.5,
  );

  // ─── The wellspring lip stones ─────────────────────────────────────────────
  for (const [springIndex, spring] of WELLSPRINGS.entries()) {
    for (let i = 0; i < 5; i++) {
      const theta = (i / 5) * Math.PI * 2 + springIndex * 0.9;
      const u = spring.u + Math.cos(theta) * spring.radius * 1.25;
      const v = spring.v + Math.sin(theta) * spring.radius * 1.25;
      const radius = random.range(1.0, 1.7);
      scenery(
        pale,
        boulderGeometry({
          seed: SEED ^ (0x0a90 + springIndex * 8 + i),
          radius,
          height: radius * random.range(0.7, 1.0),
        }),
        u,
        v,
        random.range(0, Math.PI * 2),
        radius,
      );
    }
  }

  // ─── The Twin Court slabs ──────────────────────────────────────────────────
  for (const [i, [u, v]] of ([
    [1458, -18],
    [1466, -2],
    [1452, 0],
  ] as const).entries()) {
    const radius = random.range(1.4, 2.0);
    stand(
      pale,
      slabGeometry({ seed: SEED ^ (0x0aa0 + i), radius, height: radius * 0.5 }),
      u,
      v,
      random.range(0, Math.PI * 2),
      radius,
      radius * 0.5,
    );
  }

  // ─── The Province's End balcony ────────────────────────────────────────────
  // Five low slabs in an arc along the rise's outward edge, two tall
  // framing stacks — the last stand before the painted country.
  for (let i = 0; i < 5; i++) {
    const theta = -0.7 + i * 0.35;
    const u = WORLDS_END.u + Math.cos(theta) * 11;
    const v = WORLDS_END.v + Math.sin(theta) * 11;
    const radius = random.range(1.2, 1.7);
    stand(
      pale,
      slabGeometry({ seed: SEED ^ (0x0ac0 + i), radius, height: radius * 0.6 }),
      u,
      v,
      theta,
      radius,
      radius * 0.6,
    );
  }
  for (const [i, side] of [-1, 1].entries()) {
    stand(
      pale,
      stackGeometry(
        [
          { radius: 1.4, rise: 0.7, stretch: 2.1, lean: side * 0.5 },
          { radius: 0.95, rise: 4.9, stretch: 1.9, lean: side * 1.2 },
        ],
        { seed: SEED ^ (0x0ad0 + i) },
      ),
      WORLDS_END.u + 7,
      WORLDS_END.v + side * 9,
      side * 1.1,
      1.4,
      6.7,
    );
  }

  // ─── The meadow field stones ───────────────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const u = 1330 + random.range(0, 250);
    const v = -120 + random.range(0, 240);
    if (tooCloseToFeatures(u, v)) {
      continue;
    }
    const radius = random.range(1.0, 2.2);
    scenery(
      moss,
      boulderGeometry({
        seed: SEED ^ (0x0ae0 + i),
        radius,
        height: radius * random.range(0.8, 1.2),
      }),
      u,
      v,
      random.range(0, Math.PI * 2),
      radius,
    );
  }

  const mesaMaterial = createToonMaterial({ vertexColors: true });
  mesaMaterial.side = DoubleSide;
  const meshes = [
    mergedMesh(mesaParts, mesaMaterial, "verdant3-mesa-pillars"),
    mergedMesh(moss, createRockMaterial(0x647a5e), "verdant3-stone-moss"),
    mergedMesh(pale, createRockMaterial(0x93a28b), "verdant3-stone-pale"),
  ];

  return { meshes, colliders, contacts, crowns, mouth, fallenHead };
}

/** The hollow mouth's lintel height, in metres above the foot. */
function mouthTopOf(spec: MesaSpec): number {
  return spec.hollow ? 5.8 : 0;
}

/** The mouth's world angle after the pillar's yaw (mouth is local +x). */
function yawedMouth(yaw: number): number {
  // makeRotationY(yaw) maps local +x to world (cos yaw, −sin yaw).
  return Math.atan2(-Math.sin(yaw), Math.cos(yaw));
}

function tooCloseToFeatures(u: number, v: number): boolean {
  for (const mesa of MESAS) {
    if (Math.hypot(u - mesa.u, v - mesa.v) < mesa.footR + 8) {
      return true;
    }
  }
  for (const spring of WELLSPRINGS) {
    if (Math.hypot(u - spring.u, v - spring.v) < spring.radius * 2.2) {
      return true;
    }
  }
  if (Math.hypot(u - HOLLOW.u, v - HOLLOW.v) < 16) {
    return true;
  }
  if (Math.hypot(u - WORLDS_END.u, v - WORLDS_END.v) < WORLDS_END.radius + 6) {
    return true;
  }
  // The fallen pillar's lane.
  if (u > FALLEN.tailU - 8 && u < FALLEN.headU + 8 && v > FALLEN.tailV - 8 && v < FALLEN.headV + 8) {
    return true;
  }
  return false;
}
