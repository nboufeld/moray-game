import { Matrix4, Vector3, type BufferGeometry, type Mesh } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { CLOSE_LENSES, insideRest, roadDistance } from "./Golden2Beats";
import { CAPROCK_STONE, CARVED_PALE, mergedMesh, smoothstep01 } from "./Golden2Shared";
import {
  ARCH_AT,
  CARILLON,
  RIBBON_SPINE,
  gullyChannelCenter,
  gullyChannelHalf,
  ribbonDistance,
  seepsWeight,
  spokeOf,
  windowsRidge,
  worldOf,
} from "./Golden2Terrain";

/**
 * The Carillon Waste's free stone: the Shore Road's waymark pairs (the
 * Gilded Shore stacks' idiom, paced down the road), the Chime Gate's
 * fluted jambs, the gully's shoulder boulders, THE HOODOO FIELD — the
 * court's ranked capped spires, each throwing one long painted violet
 * shadow — the Ribbon's rim lip stones, and the Sunset Spires framing
 * the reserved depth-3 pass.
 *
 * Everything merges per stone family (two draws carry the whole hoodoo
 * field), wears `createRockMaterial` in the region's two families —
 * warm carved pale and violet-warm caprock — and stands on
 * `seabedHeight`, so the composed ground is the ground it believes in.
 */

const SEED = SEEDS.regionGolden2;

export interface Hoodoo {
  readonly u: number;
  readonly v: number;
  readonly height: number;
  /** Painted shadow length, along the region's one low sun. */
  readonly shadow: number;
  /** Cap radius — the balanced hat the wind left behind. */
  readonly cap: number;
}

/**
 * The hoodoo field, drawn once at module load from its own substream —
 * pure and deterministic, so the ground painter can bake each stone's
 * shadow and the tests can assert every stand. Placement rejects
 * against: the roads (> 7 m), the Ribbon (> 16 m), the Windows ridge,
 * the seep apron, the Carillon's plinth (the towers own it), both
 * rests, and every close lens.
 */
function drawHoodooField(): Hoodoo[] {
  const random = new Random(SEED ^ 0x0a31);
  const field: Hoodoo[] = [];
  let guard = 0;
  while (field.length < 30 && guard++ < 4000) {
    const u = random.range(820, 1085);
    const v = random.signed(122);
    if (roadDistance(u, v) < 8) {
      continue;
    }
    if (ribbonDistance(u, v).d < 16) {
      continue;
    }
    if (windowsRidge(u, v).w > 0.04) {
      continue;
    }
    if (seepsWeight(u, v) > 0.05) {
      continue;
    }
    if (Math.hypot(u - CARILLON.u, v - CARILLON.v) < CARILLON.radius + 4) {
      continue;
    }
    if (insideRest(u, v)) {
      continue;
    }
    if (CLOSE_LENSES.some((lens) => Math.hypot(u - lens.u, v - lens.v) < 7)) {
      continue;
    }
    // Breathing room: hoodoos rank, they do not huddle.
    if (field.some((h) => Math.hypot(h.u - u, h.v - v) < 16)) {
      continue;
    }
    const height = random.range(4.2, 9.4);
    field.push({
      u,
      v,
      height,
      shadow: height * 3.1,
      cap: random.range(1.35, 1.95),
    });
  }
  // Three tall sentinels, authored: the gully-foot herald the reveal
  // frames, and two court giants pacing the road's middle chapters.
  field.push(
    { u: 836, v: 20, height: 11.5, shadow: 36, cap: 2.1 },
    { u: 924, v: -26, height: 12.5, shadow: 39, cap: 2.2 },
    { u: 996, v: 26, height: 11, shadow: 34, cap: 2.0 },
  );
  return field;
}

export const HOODOOS: readonly Hoodoo[] = drawHoodooField();

export interface Golden2RocksBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

export function buildGolden2Rocks(): Golden2RocksBuild {
  const random = new Random(SEED ^ 0x50cb);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  const paleParts: BufferGeometry[] = [];
  const capParts: BufferGeometry[] = [];

  /** Seats a geometry on the composed ground and records its footprint. */
  const stand = (
    geometry: BufferGeometry,
    parts: BufferGeometry[],
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    lift = 0,
  ): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z) + lift;
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    parts.push(geometry);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
  };

  // ─── The Shore Road waymarks ─────────────────────────────────────────────
  // Leaning stone pairs pacing the road every ~26 m — the Gilded Shore
  // stacks' idiom carried forward, so the road out of the Hourglass Sea
  // reads as one country's road. Staggered off the spine, never on it.
  const wayRandom = new Random(SEED ^ 0x0a41);
  for (const [i, u] of [652, 678, 704, 730].entries()) {
    const side = i % 2 === 0 ? 1 : -1;
    const v = side * wayRandom.range(9, 12);
    const h = wayRandom.range(3.4, 4.6);
    stand(
      stackGeometry(
        [
          { radius: 1.1, rise: 0.5, stretch: 1.6, lean: side * 0.4 },
          { radius: 0.75, rise: h * 0.62, stretch: (h * 0.42) / 0.75, lean: side * 0.9 },
        ],
        { seed: SEED ^ (0x0a42 + i) },
      ),
      paleParts,
      u,
      v,
      wayRandom.range(0, Math.PI * 2),
      1.2,
      h,
    );
    // The little kneeling second stone of each pair.
    stand(
      boulderGeometry({ seed: SEED ^ (0x0a46 + i), radius: wayRandom.range(0.8, 1.2), height: 1.4 }),
      capParts,
      u + wayRandom.signed(2),
      v + side * wayRandom.range(2.5, 3.5),
      wayRandom.range(0, Math.PI * 2),
      1.0,
      1.4,
    );
  }

  // ─── The Chime Gate ──────────────────────────────────────────────────────
  // Two tall fluted jambs where the shore road becomes the gully — the
  // door into the carved country. They stand INSIDE the channel's
  // shoulders (the Emerald Gate's r3 lesson: jambs against the banks
  // camouflage; jambs against the water read).
  const gateV = gullyChannelCenter(748);
  const gateHalf = gullyChannelHalf(748);
  stand(
    stackGeometry(
      [
        { radius: 1.5, rise: 0.7, stretch: 2.2, lean: 0.5 },
        { radius: 1.0, rise: 5.4, stretch: 2.4, lean: 1.1 },
      ],
      { seed: SEED ^ 0x0a51 },
    ),
    paleParts,
    747,
    gateV + gateHalf + 2.5,
    0.6,
    1.6,
    8.2,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.35, rise: 0.6, stretch: 2.0, lean: -0.4 },
        { radius: 0.9, rise: 4.6, stretch: 2.2, lean: -1.0 },
      ],
      { seed: SEED ^ 0x0a52 },
    ),
    paleParts,
    749,
    gateV - gateHalf - 2.5,
    -0.8,
    1.5,
    7.2,
  );

  // ─── The gully's shoulder boulders ───────────────────────────────────────
  // Fog-rhythm stones down the descent, alternating flanks.
  const gullyRandom = new Random(SEED ^ 0x0a61);
  for (const [i, u] of [760, 776, 792, 806].entries()) {
    const side = i % 2 === 0 ? -1 : 1;
    const v = gullyChannelCenter(u) + side * (gullyChannelHalf(u) + gullyRandom.range(2, 5));
    const radius = gullyRandom.range(1.3, 2.2);
    stand(
      boulderGeometry({ seed: SEED ^ (0x0a62 + i), radius, height: radius * 1.3 }),
      i % 2 === 0 ? paleParts : capParts,
      u,
      v,
      gullyRandom.range(0, Math.PI * 2),
      radius,
      radius * 1.3,
    );
  }

  // ─── THE HOODOO FIELD ────────────────────────────────────────────────────
  // Every hoodoo is two stones: a fluted pale column with a narrow
  // waist, and the darker balanced caprock the wind could not eat.
  // Bodies merge into one draw, caps into another.
  for (const [i, hoodoo] of HOODOOS.entries()) {
    const yaw = random.range(0, Math.PI * 2);
    const bodyR = hoodoo.cap * random.range(0.62, 0.72);
    stand(
      stackGeometry(
        [
          { radius: bodyR * 1.25, rise: 0.4, stretch: (hoodoo.height * 0.5) / (bodyR * 1.25), lean: random.signed(0.4) },
          { radius: bodyR * 0.85, rise: hoodoo.height * 0.55, stretch: (hoodoo.height * 0.42) / (bodyR * 0.85), lean: random.signed(0.7) },
        ],
        { seed: SEED ^ (0x0b00 + i) },
      ),
      paleParts,
      hoodoo.u,
      hoodoo.v,
      yaw,
      bodyR * 1.25,
      hoodoo.height,
    );
    // The cap: a low slab balanced on the crown, leaning with the body.
    const cap = slabGeometry({
      seed: SEED ^ (0x0c00 + i),
      radius: hoodoo.cap,
      height: hoodoo.cap * random.range(0.5, 0.66),
    });
    cap.rotateY(random.range(0, Math.PI * 2));
    cap.rotateZ(random.signed(0.09));
    const { x, z } = worldOf(hoodoo.u, hoodoo.v);
    const y = seabedHeight(x, z) + hoodoo.height * 0.94;
    cap.translate(x, y, z);
    capParts.push(cap);
    colliders.push({ center: new Vector3(x, y + hoodoo.cap * 0.3, z), radius: hoodoo.cap });
  }

  // ─── The Ribbon's lip stones ─────────────────────────────────────────────
  // Broken slabs pacing the slot's rim — the crack advertised across
  // the court, and a handhold line for the eye at the mouth pose.
  const lipRandom = new Random(SEED ^ 0x0a71);
  for (let i = 0; i < RIBBON_SPINE.length - 1; i++) {
    const [au, av] = RIBBON_SPINE[i]!;
    const [bu, bv] = RIBBON_SPINE[i + 1]!;
    const mu = (au + bu) / 2;
    const mv = (av + bv) / 2;
    // Normal to the spine, one slab per side, staggered.
    const nu = -(bv - av);
    const nv = bu - au;
    const nl = Math.hypot(nu, nv);
    const side = i % 2 === 0 ? 1 : -1;
    const offset = lipRandom.range(10, 13);
    const su = mu + (nu / nl) * offset * side;
    const sv = mv + (nv / nl) * offset * side;
    if (seepsWeight(su, sv) > 0.1 || insideRest(su, sv)) {
      continue;
    }
    const radius = lipRandom.range(1.4, 2.3);
    stand(
      slabGeometry({ seed: SEED ^ (0x0d00 + i), radius, height: radius * 0.5 }),
      capParts,
      su,
      sv,
      Math.atan2(nv, nu) + lipRandom.signed(0.3),
      radius,
      radius * 0.5,
    );
  }

  // ─── The Sunset Spires ───────────────────────────────────────────────────
  // Two leaning stacks framing the reserved depth-3 pass azimuth (the
  // spoke itself, v ≈ 0 past u 1100) — this region passing the torch
  // exactly the way the Gilded Shore stacks passed it here.
  stand(
    stackGeometry(
      [
        { radius: 1.7, rise: 0.8, stretch: 2.1, lean: 0.7 },
        { radius: 1.05, rise: 4.6, stretch: 1.9, lean: 1.5 },
      ],
      { seed: SEED ^ 0x0a81 },
    ),
    capParts,
    1102,
    16,
    1.3,
    1.7,
    6.6,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.45, rise: 0.7, stretch: 1.9, lean: -0.5 },
        { radius: 0.95, rise: 3.8, stretch: 1.7, lean: -1.2 },
      ],
      { seed: SEED ^ 0x0a82 },
    ),
    capParts,
    1098,
    -12,
    -0.6,
    1.5,
    5.6,
  );

  // Two merged draws for every stone above.
  meshes.push(mergedMesh(paleParts, createRockMaterial(CARVED_PALE), "carillon-stone-pale"));
  meshes.push(mergedMesh(capParts, createRockMaterial(CAPROCK_STONE), "carillon-stone-cap"));

  return { meshes, colliders, contacts };
}

/**
 * The painted low sun's direction on the court, in spoke coordinates —
 * lateral to the touring poses' sightlines (the pilot's round-2 lesson:
 * shadows thrown away from the camera read as disconnected stains).
 * Shared with the ground painter.
 */
export const SHADOW_DIR_U = -0.55;
export const SHADOW_DIR_V = 0.835;

/** How much painted hoodoo shadow falls on a spoke point, in [0, 1]. */
export function hoodooShadow(u: number, v: number): number {
  let shadow = 0;
  for (const hoodoo of HOODOOS) {
    const du = u - hoodoo.u;
    const dv = v - hoodoo.v;
    const along = du * SHADOW_DIR_U + dv * SHADOW_DIR_V;
    if (along < -1.5 || along > hoodoo.shadow * 1.3) {
      continue;
    }
    const perp = Math.abs(du * SHADOW_DIR_V - dv * SHADOW_DIR_U);
    const width = 1.8 + (along / hoodoo.shadow) * 4.2;
    const across = 1 - smoothstep01((perp - width * 0.4) / (width * 0.6));
    const fade = 1 - smoothstep01((along / (hoodoo.shadow * 1.3) - 0.5) / 0.5);
    shadow = Math.max(shadow, across * fade);
  }
  return shadow;
}

/** Keeps builders honest about what the arch doorway needs left clear. */
export function nearArch(u: number, v: number, margin: number): boolean {
  return Math.hypot(u - ARCH_AT.u, v - ARCH_AT.v) < margin;
}

/** Spoke-space test the cover gates share: standing stone footprints. */
export function hoodooFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  let free = 1;
  for (const hoodoo of HOODOOS) {
    free = Math.min(
      free,
      smoothstep01((Math.hypot(u - hoodoo.u, v - hoodoo.v) - hoodoo.cap * 1.3) / 1.2),
    );
  }
  return free;
}
