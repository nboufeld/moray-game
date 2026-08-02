import { Matrix4, Vector3, type BufferGeometry, type Mesh } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { CLOSE_LENSES, insideRest, roadDistance } from "./Golden3Beats";
import {
  CARVED_PALE,
  DUSK_STONE,
  STONE_DUSK,
  STONE_DUSK_INTENSITY,
  mergedMesh,
  smoothstep01,
} from "./Golden3Shared";
import {
  COMB_A,
  COMB_B,
  DOOR,
  GARDEN,
  PANS,
  WELL,
  combWeight,
  combeChannelCenter,
  combeChannelHalf,
  doorRise,
  gardenWeight,
  panDish,
  spokeOf,
  wellCarve,
  worldOf,
} from "./Golden3Terrain";

/**
 * The Vesper Strand's free stone: the Last Shelf's waymark pairs (the
 * province's stack idiom carried to its end), the Strand Gate's leaning
 * slabs where the dunes pour over, the combe's shoulder boulders, THE
 * PROCESSION — the basin's ranked leaning stones, every one of them
 * leaning toward the Sun's Door, each throwing one long painted violet
 * shadow back up the road the diver came by — the pans' salt-lip
 * stones, the Night Well's kneeling rim ring, and the comb-crest
 * marker stones on both flanks.
 *
 * Everything merges per stone family (two draws carry the whole
 * procession), wears `createRockMaterial` in the region's two families —
 * warm carved pale and violet-warm dusk stone — and stands on
 * `seabedHeight`, so the composed ground is the ground it believes in.
 */

const SEED = SEEDS.regionGolden3;

export interface ProcessionStone {
  readonly u: number;
  readonly v: number;
  readonly height: number;
  /** Painted shadow length, along the region's one low sun. */
  readonly shadow: number;
  /** Foot radius, for gates and colliders. */
  readonly foot: number;
}

/**
 * The Procession, drawn once at module load from its own substream —
 * pure and deterministic, so the ground painter can bake each stone's
 * shadow and the tests can assert every stand. Placement rejects
 * against: the roads (> 8 m), every pan (> 5 m beyond the rim), the
 * garden, the well, the door rise, the comb hearts, both rests, and
 * every close lens.
 */
function drawProcession(): ProcessionStone[] {
  const random = new Random(SEED ^ 0x0aa1);
  const field: ProcessionStone[] = [];
  let guard = 0;
  while (field.length < 32 && guard++ < 6000) {
    const u = random.range(1326, 1608);
    const v = random.signed(150);
    if (roadDistance(u, v) < 8) {
      continue;
    }
    if (panDish(u, v) > 0.02 || PANS.some((pan) => Math.hypot(u - pan.u, v - pan.v) < pan.radius + 5)) {
      continue;
    }
    if (gardenWeight(u, v) > 0.05) {
      continue;
    }
    if (Math.hypot(u - WELL.u, v - WELL.v) < WELL.radius * 2.4) {
      continue;
    }
    if (doorRise(u, v) > 0.04) {
      continue;
    }
    if (combWeight(u, v) > 0.55) {
      continue;
    }
    if (insideRest(u, v)) {
      continue;
    }
    if (CLOSE_LENSES.some((lens) => Math.hypot(u - lens.u, v - lens.v) < 7)) {
      continue;
    }
    // Pilgrims walk ranked, not huddled.
    if (field.some((s) => Math.hypot(s.u - u, s.v - v) < 16)) {
      continue;
    }
    const height = random.range(3.4, 7.6);
    field.push({ u, v, height, shadow: height * 3.2, foot: random.range(0.9, 1.4) });
  }
  // Three authored sentinels: the Foremost pair kneeling where the
  // basin reveals, and the Tall Pilgrim pacing the road's middle
  // chapter (appended AFTER the seeded field, so nothing re-rolls).
  field.push(
    { u: 1342, v: -20, height: 9.5, shadow: 30, foot: 1.6 },
    { u: 1356, v: 22, height: 8, shadow: 26, foot: 1.5 },
    { u: 1466, v: -30, height: 10.5, shadow: 34, foot: 1.7 },
  );
  return field;
}

export const PROCESSION: readonly ProcessionStone[] = drawProcession();

export interface Golden3RocksBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

/** Yaw that turns a geometry's local +x toward the Sun's Door. */
function yawTowardDoor(u: number, v: number): number {
  const dir = worldOf(DOOR.u - u, DOOR.v - v);
  return Math.atan2(-dir.z, dir.x);
}

export function buildGolden3Rocks(): Golden3RocksBuild {
  const random = new Random(SEED ^ 0x51cb);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  const paleParts: BufferGeometry[] = [];
  const duskParts: BufferGeometry[] = [];

  /** Seats a geometry on the composed ground and records its footprint. */
  const stand = (
    geometry: BufferGeometry,
    parts: BufferGeometry[],
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
  ): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    parts.push(geometry);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
  };

  // ─── The Last Shelf waymarks ─────────────────────────────────────────────
  // Leaning stone pairs pacing the road every ~26 m out of the Carillon
  // Waste — its Sunset Spires' idiom carried forward, so the road into
  // the evening reads as one country's road.
  const wayRandom = new Random(SEED ^ 0x0ab1);
  for (const [i, u] of [1152, 1178, 1204, 1230].entries()) {
    const side = i % 2 === 0 ? 1 : -1;
    const v = side * wayRandom.range(9, 12);
    const h = wayRandom.range(4.4, 5.8);
    stand(
      stackGeometry(
        [
          { radius: 1.1, rise: 0.5, stretch: 1.6, lean: side * 0.4 },
          { radius: 0.75, rise: h * 0.62, stretch: (h * 0.42) / 0.75, lean: side * 0.9 },
        ],
        { seed: SEED ^ (0x0ab2 + i) },
      ),
      paleParts,
      u,
      v,
      wayRandom.range(0, Math.PI * 2),
      1.2,
      h,
    );
    stand(
      boulderGeometry({ seed: SEED ^ (0x0ab6 + i), radius: wayRandom.range(0.8, 1.2), height: 1.4 }),
      duskParts,
      u + wayRandom.signed(2),
      v + side * wayRandom.range(2.5, 3.5),
      wayRandom.range(0, Math.PI * 2),
      1.0,
      1.4,
    );
  }

  // ─── THE STRAND GATE ─────────────────────────────────────────────────────
  // Two great leaning slabs where the shelf becomes the combe — the
  // hourglass's last grains, tipped against the water on both banks of
  // the first pour (inside the channel's shoulders: jambs against the
  // water read; jambs against the banks camouflage).
  const gateV = combeChannelCenter(1250);
  const gateHalf = combeChannelHalf(1250);
  {
    const slabA = slabGeometry({ seed: SEED ^ 0x0ac1, radius: 2.6, height: 6.8 });
    slabA.applyMatrix4(new Matrix4().makeScale(1, 1, 0.42));
    slabA.applyMatrix4(new Matrix4().makeRotationZ(0.2));
    stand(slabA, paleParts, 1249, gateV + gateHalf + 2.5, yawTowardDoor(1249, gateV + gateHalf + 2.5), 1.9, 7.4);
    const slabB = slabGeometry({ seed: SEED ^ 0x0ac2, radius: 2.3, height: 5.8 });
    slabB.applyMatrix4(new Matrix4().makeScale(1, 1, 0.42));
    slabB.applyMatrix4(new Matrix4().makeRotationZ(-0.16));
    stand(slabB, paleParts, 1251, gateV - gateHalf - 2.5, yawTowardDoor(1251, gateV - gateHalf - 2.5) + 0.3, 1.7, 6.3);
  }

  // ─── The combe's shoulder boulders ───────────────────────────────────────
  // Fog-rhythm stones down the descent, alternating flanks.
  const combeRandom = new Random(SEED ^ 0x0ad1);
  for (const [i, u] of [1264, 1280, 1296, 1312].entries()) {
    const side = i % 2 === 0 ? -1 : 1;
    const v = combeChannelCenter(u) + side * (combeChannelHalf(u) + combeRandom.range(2, 5));
    const radius = combeRandom.range(1.3, 2.2);
    stand(
      boulderGeometry({ seed: SEED ^ (0x0ad2 + i), radius, height: radius * 1.3 }),
      i % 2 === 0 ? paleParts : duskParts,
      u,
      v,
      combeRandom.range(0, Math.PI * 2),
      radius,
      radius * 1.3,
    );
  }

  // ─── THE PROCESSION ──────────────────────────────────────────────────────
  // Every stone leans toward the Sun's Door: a narrow-waisted pale
  // stack, tipped 0.3–0.6 along its own pilgrim bearing, with a small
  // kneeling dusk stone at one foot in three.
  for (const [i, stone] of PROCESSION.entries()) {
    const yaw = yawTowardDoor(stone.u, stone.v) + random.signed(0.18);
    const lean = random.range(0.55, 1.05);
    stand(
      stackGeometry(
        [
          { radius: stone.foot * 1.15, rise: 0.4, stretch: (stone.height * 0.48) / (stone.foot * 1.15), lean: lean * 0.5 },
          { radius: stone.foot * 0.78, rise: stone.height * 0.52, stretch: (stone.height * 0.44) / (stone.foot * 0.78), lean },
        ],
        { seed: SEED ^ (0x0b10 + i) },
      ),
      paleParts,
      stone.u,
      stone.v,
      yaw,
      stone.foot * 1.15,
      stone.height,
    );
    if (i % 3 === 0) {
      stand(
        boulderGeometry({ seed: SEED ^ (0x0c10 + i), radius: random.range(0.7, 1.1), height: 1.2 }),
        duskParts,
        stone.u + random.signed(2.5),
        stone.v + random.range(2, 3.4),
        random.range(0, Math.PI * 2),
        0.9,
        1.2,
      );
    }
  }

  // ─── The pans' salt-lip stones ───────────────────────────────────────────
  // Low leaned slabs pacing each pan's rim — the dish advertised across
  // the flats, leaned up off the "manhole cover" read.
  const lipRandom = new Random(SEED ^ 0x0ae1);
  for (const [p, pan] of PANS.entries()) {
    const count = pan.rest ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + p * 1.1 + lipRandom.range(0, 0.5);
      const su = pan.u + Math.cos(angle) * (pan.radius + 2.2);
      const sv = pan.v + Math.sin(angle) * (pan.radius + 2.2);
      if (CLOSE_LENSES.some((lens) => Math.hypot(su - lens.u, sv - lens.v) < 2.5)) {
        continue;
      }
      const radius = lipRandom.range(0.9, 1.5);
      const slab = slabGeometry({ seed: SEED ^ (0x0d10 + p * 8 + i), radius, height: radius * 0.55 });
      slab.rotateZ(lipRandom.range(0.14, 0.26));
      stand(slab, paleParts, su, sv, Math.atan2(sv - pan.v, su - pan.u) + lipRandom.signed(0.3), radius, radius * 0.55);
    }
  }

  // ─── The Night Well's kneeling ring ──────────────────────────────────────
  // Five dusk stones bowed around the rim — the desert's dark kept by
  // its own small congregation.
  const wellRandom = new Random(SEED ^ 0x0af1);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.4;
    const su = WELL.u + Math.cos(angle) * (WELL.radius + 3.5);
    const sv = WELL.v + Math.sin(angle) * (WELL.radius + 3.5);
    if (wellCarve(su, sv).carve < -2) {
      continue;
    }
    const radius = wellRandom.range(0.9, 1.4);
    stand(
      boulderGeometry({ seed: SEED ^ (0x0e10 + i), radius, height: radius * 1.5 }),
      duskParts,
      su,
      sv,
      wellRandom.range(0, Math.PI * 2),
      radius,
      radius * 1.5,
    );
  }

  // ─── The comb-crest markers ──────────────────────────────────────────────
  // A leaning stone on a crest of each comb field, so the flanks carry
  // silhouettes above their ridges.
  const combRandom = new Random(SEED ^ 0x0af8);
  for (const [i, at] of [
    { u: COMB_A.u - 46, v: COMB_A.v - 14 },
    { u: COMB_A.u + 34, v: COMB_A.v + 6 },
    { u: COMB_B.u - 40, v: COMB_B.v + 10 },
    { u: COMB_B.u + 38, v: COMB_B.v - 6 },
  ].entries()) {
    const h = combRandom.range(4.2, 6.2);
    stand(
      stackGeometry(
        [
          { radius: 1.0, rise: 0.4, stretch: (h * 0.5) / 1.0, lean: 0.4 },
          { radius: 0.7, rise: h * 0.55, stretch: (h * 0.42) / 0.7, lean: 0.85 },
        ],
        { seed: SEED ^ (0x0e20 + i) },
      ),
      paleParts,
      at.u,
      at.v,
      yawTowardDoor(at.u, at.v) + combRandom.signed(0.2),
      1.0,
      h,
    );
  }

  // ─── The garden's outriders ──────────────────────────────────────────────
  // Two dusk boulders at the garden's road edge, anchoring its reveal.
  stand(
    boulderGeometry({ seed: SEED ^ 0x0e30, radius: 1.6, height: 2.1 }),
    duskParts,
    GARDEN.u - 34,
    GARDEN.v - 26,
    random.range(0, Math.PI * 2),
    1.6,
    2.1,
  );
  stand(
    boulderGeometry({ seed: SEED ^ 0x0e31, radius: 1.2, height: 1.6 }),
    duskParts,
    GARDEN.u - 28,
    GARDEN.v - 32,
    random.range(0, Math.PI * 2),
    1.2,
    1.6,
  );

  // Two merged draws for every stone above — with the stone dusk-lift
  // (the province's pre-paid lesson: shade sides stay a warm colour
  // under the quarter-sun).
  const pale = createRockMaterial(CARVED_PALE);
  pale.emissive.setHex(STONE_DUSK);
  pale.emissiveIntensity = STONE_DUSK_INTENSITY;
  const dusk = createRockMaterial(DUSK_STONE);
  dusk.emissive.setHex(0x4a3a34);
  dusk.emissiveIntensity = STONE_DUSK_INTENSITY;
  meshes.push(mergedMesh(paleParts, pale, "vesper-stone-pale"));
  meshes.push(mergedMesh(duskParts, dusk, "vesper-stone-dusk"));

  return { meshes, colliders, contacts };
}

/**
 * The painted low sun's direction on the flats, in spoke coordinates.
 * The sun stands at the Sun's Door (the +u pole), so shadows stream
 * BACK up the road — with a strong lateral drift so the touring poses,
 * which look along +u, read the shadows as long diagonals instead of
 * dead-on stripes (the province's round-2 lesson, pre-paid).
 */
export const SHADOW_DIR_U = -0.66;
export const SHADOW_DIR_V = 0.75;

/** How much painted procession shadow falls on a spoke point, in [0, 1]. */
export function processionShadow(u: number, v: number): number {
  let shadow = 0;
  for (const stone of PROCESSION) {
    const du = u - stone.u;
    const dv = v - stone.v;
    const along = du * SHADOW_DIR_U + dv * SHADOW_DIR_V;
    if (along < -1.5 || along > stone.shadow * 1.3) {
      continue;
    }
    const perp = Math.abs(du * SHADOW_DIR_V - dv * SHADOW_DIR_U);
    const width = 1.6 + (along / stone.shadow) * 4;
    const across = 1 - smoothstep01((perp - width * 0.4) / (width * 0.6));
    const fade = 1 - smoothstep01((along / (stone.shadow * 1.3) - 0.5) / 0.5);
    shadow = Math.max(shadow, across * fade);
  }
  return shadow;
}

/**
 * THE LAST PILGRIMS (conviction wave, re-critique #14): the
 * evening-horizon terminus still closed on ~60 % featureless dune
 * face — the recomposed pose gave the frame to the sunset, but the
 * mid-ground between the Sun's Door and the rampart sill was bare.
 * The Procession's story walks one chapter further: a diminishing
 * file of dusk-stone pilgrims past the Door, stepping up the
 * rampart's toe INTO the sunset, so the province's last frame reads
 * "they went on toward the light" instead of "the sand ends here".
 * Every station stands clear of the Pilgrim's Threshold rest (r 8 at
 * the Door), the resident's circuit legs (u ≤ 1622), every close
 * lens and wide stand. Fresh stream `SEED ^ 0x1af1`, one merged dusk
 * draw, appended after every existing module — the fence holds by
 * construction.
 */
const LAST_PILGRIMS: readonly { u: number; v: number; h: number; foot: number }[] = [
  { u: 1626, v: -16, h: 3.2, foot: 0.85 },
  { u: 1634, v: 2, h: 2.5, foot: 0.7 },
  { u: 1641, v: -28, h: 4.8, foot: 1.1 },
  { u: 1648, v: 12, h: 3.4, foot: 0.9 },
  { u: 1652, v: -8, h: 2.2, foot: 0.65 },
  { u: 1660, v: -34, h: 6.2, foot: 1.35 },
  { u: 1666, v: 18, h: 4.2, foot: 1.0 },
  { u: 1671, v: -16, h: 2.8, foot: 0.75 },
  { u: 1676, v: 0, h: 5.0, foot: 1.15 },
] as const;

export function buildLastPilgrims(): Golden3RocksBuild {
  const random = new Random(SEED ^ 0x1af1);
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const parts: BufferGeometry[] = [];

  for (const [i, stone] of LAST_PILGRIMS.entries()) {
    // Walking INTO the sunset: the lean points AWAY from the Door,
    // out along the pilgrim bearing (the Procession's lean, reversed).
    const yaw = yawTowardDoor(stone.u, stone.v) + Math.PI + random.signed(0.16);
    const lean = random.range(0.5, 0.95);
    const geometry = stackGeometry(
      [
        {
          radius: stone.foot * 1.15,
          rise: 0.35,
          stretch: (stone.h * 0.48) / (stone.foot * 1.15),
          lean: lean * 0.5,
        },
        {
          radius: stone.foot * 0.78,
          rise: stone.h * 0.52,
          stretch: (stone.h * 0.44) / (stone.foot * 0.78),
          lean,
        },
      ],
      { seed: SEED ^ (0x1b10 + i) },
    );
    const { x, z } = worldOf(stone.u, stone.v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    parts.push(geometry);
    contacts.push({ x, z, radius: stone.foot * 1.5, strength: 0.4 });
    colliders.push({
      center: new Vector3(x, y + stone.h * 0.35, z),
      radius: stone.foot * 0.98,
    });
    if (stone.h > stone.foot * 1.9) {
      colliders.push({
        center: new Vector3(x, y + stone.h * 0.75, z),
        radius: stone.foot * 0.7,
      });
    }
  }

  const dusk = createRockMaterial(DUSK_STONE);
  dusk.emissive.setHex(0x4a3a34);
  dusk.emissiveIntensity = STONE_DUSK_INTENSITY;
  return {
    meshes: [mergedMesh(parts, dusk, "vesper-last-pilgrims")],
    colliders,
    contacts,
  };
}

/** Spoke-space test the cover gates share: standing stone footprints. */
export function processionFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  let free = 1;
  for (const stone of PROCESSION) {
    free = Math.min(
      free,
      smoothstep01((Math.hypot(u - stone.u, v - stone.v) - stone.foot * 1.4) / 1.2),
    );
  }
  return free;
}
