import { Matrix4, Vector3, type BufferGeometry, type Mesh } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { CLOSE_LENSES, SKIFF_REST, WRACK_LINE, roadDistance } from "./Blue2Beats";
import {
  B2_SEEDS,
  STONE_DUSK,
  STONE_DUSK_INTENSITY,
  STONE_PALE,
  STONE_SLATE,
  mergedMesh,
  palenStone,
} from "./Blue2Shared";
import { BRINK_D, HINGE_U, HORNS, worldOf } from "./Blue2Terrain";

/**
 * The Deep Steps' free stone — placed by the province's own law: ONE
 * GREAT SHAPE IS AN EVENT. No field scatter of stone anywhere; every
 * stone here is authored, named in the ledger's landmark list, and
 * holds its own hundred metres:
 *
 * - **The Pharos** (692, 8): the lone pale waymark on the Othershore —
 *   the first thing of ours the fog gives up past the Drop Plains'
 *   outermost deep-step arc (u ≈ 669; the Emerald Gate lesson, paid at
 *   authoring time — NOTHING of ours composes before that line).
 * - **The Brink slabs**: a broken lip line pacing the second edge.
 * - **The Stairfall boulders**: fog-rhythm stones down the descent.
 * - **THE KINGS' WRACK**: the drift-line of fallen megalith fragments
 *   sweeping the Strand — the Drop Plains' own stone family, toppled
 *   over the World's Edge and come to rest on the first shelf.
 * - **THE SKIFF** (818, 96): the Ferryman's stone boat, half-buried —
 *   the secret; its berth is a registered rest.
 * - **The Chute stones**: two boulders flanking the road's notch.
 * - **The Watch Stones**: two lone stones on the Round's open flanks.
 * - **THE HORNS**: paired crest spires on the Worldwall framing the
 *   reserved depth-3 azimuth — the torch passed the way the World's
 *   Edge passed it here.
 *
 * Everything merges per stone family (two draws), wears
 * `createRockMaterial` in the region's pale and violet-slate families
 * with the stone dusk-lift (the Carillon's cure — a shade side under
 * the deep mood must stay a colour), and stands on `seabedHeight`.
 */

const SEED = SEEDS.regionBlue2;

export interface WrackFragment {
  readonly u: number;
  readonly v: number;
  /** Fallen length, metres — the fragments lie DOWN. */
  readonly length: number;
  /** The fall line's yaw in spoke space (they fell away from the Edge). */
  readonly yaw: number;
  readonly standing?: boolean;
}

/**
 * The wrack's major fragments, one per drift-line node plus two
 * standing stumps — drawn pure so cover gates and tests share them.
 */
export const WRACK_FRAGMENTS: readonly WrackFragment[] = WRACK_LINE.map(([u, v], i) => {
  // The fall line points away from the hinge — everything here fell
  // outward off the World's Edge. Round 2: grown ×1.35 — the r1
  // fragments sank into the swells and the landmark did not exist.
  const yaw = Math.atan2(v, u - HINGE_U);
  const lengths = [8.8, 11.5, 7.4, 12.2, 8.1, 10.1] as const;
  return {
    u: u + (i % 2 === 0 ? 2 : -2),
    v,
    length: lengths[i % lengths.length]!,
    yaw,
    standing: i === 1 || i === 4,
  };
});

export interface Blue2StonesBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

export function buildBlue2Stones(): Blue2StonesBuild {
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  const paleParts: BufferGeometry[] = [];
  const slateParts: BufferGeometry[] = [];

  /** Seats a geometry on the composed ground and records its footprint. */
  const stand = (
    geometry: BufferGeometry,
    parts: BufferGeometry[],
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    sink = 0,
  ): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z) - sink;
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    parts.push(geometry);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
  };

  // ─── The Pharos ──────────────────────────────────────────────────────────
  const pharosRandom = new Random(SEED ^ B2_SEEDS.pharos);
  stand(
    stackGeometry(
      [
        { radius: 1.35, rise: 0.6, stretch: 1.9, lean: 0.4 },
        { radius: 0.85, rise: 4.6, stretch: 3.2, lean: 1.0 },
      ],
      { seed: SEED ^ B2_SEEDS.pharos, rings: 26 },
    ),
    paleParts,
    692,
    8,
    pharosRandom.range(0, Math.PI * 2),
    1.4,
    7.6,
  );

  // ─── The Brink slabs ─────────────────────────────────────────────────────
  const brinkRandom = new Random(SEED ^ B2_SEEDS.brinkSlabs);
  for (const [i, v] of [-40, -18, 14, 38].entries()) {
    const u = HINGE_U + Math.sqrt((BRINK_D - 2) ** 2 - v * v);
    const radius = brinkRandom.range(1.6, 2.5);
    const slab = slabGeometry({
      seed: SEED ^ (B2_SEEDS.brinkSlabs + i * 7),
      radius,
      height: radius * 0.5,
    });
    // Leaned up toward the void (the manhole-cover lesson pre-paid).
    slab.rotateZ((i % 2 === 0 ? 1 : -1) * brinkRandom.range(0.16, 0.26));
    stand(slab, paleParts, u, v, Math.atan2(v, u - HINGE_U) + brinkRandom.signed(0.3), radius, radius * 0.5);
  }

  // ─── The Stairfall boulders ──────────────────────────────────────────────
  const stairRandom = new Random(SEED ^ B2_SEEDS.stairBoulders);
  for (const [i, spot] of ([
    [764, 16],
    [778, -16],
    [792, 12],
  ] as const).entries()) {
    const radius = stairRandom.range(1.4, 2.1);
    stand(
      boulderGeometry({ seed: SEED ^ (B2_SEEDS.stairBoulders + i * 5), radius, height: radius * 1.3 }),
      i % 2 === 0 ? paleParts : slateParts,
      spot[0],
      spot[1],
      stairRandom.range(0, Math.PI * 2),
      radius,
      radius * 1.3,
    );
  }

  // ─── THE KINGS' WRACK ────────────────────────────────────────────────────
  const wrackRandom = new Random(SEED ^ B2_SEEDS.wrack);
  for (const [i, fragment] of WRACK_FRAGMENTS.entries()) {
    if (roadDistance(fragment.u, fragment.v) < 7) {
      continue; // the road's gap through the line stays a gap
    }
    if (fragment.standing) {
      // A stump: the broken root of a stone that lost its crown.
      const h = fragment.length * 0.55;
      stand(
        stackGeometry(
          [
            { radius: 1.5, rise: 0.4, stretch: 1.4, lean: wrackRandom.signed(0.5) },
            { radius: 1.0, rise: h * 0.5, stretch: (h * 0.45) / 1.0, lean: wrackRandom.signed(0.9) },
          ],
          { seed: SEED ^ (B2_SEEDS.wrack + i * 11), rings: 24 },
        ),
        i % 2 === 0 ? paleParts : slateParts,
        fragment.u,
        fragment.v,
        wrackRandom.range(0, Math.PI * 2),
        1.6,
        h,
      );
      continue;
    }
    // A fallen blade: a megalith-family stack lathed upright, then laid
    // on its side along the fall line, riding proud of the silt (round
    // 2: the r1 third-sunk bodies vanished into the swells).
    const h = fragment.length;
    const body = stackGeometry(
      [
        { radius: 1.9, rise: 0.3, stretch: 1.4, lean: 0 },
        { radius: 1.4, rise: h * 0.55, stretch: (h * 0.4) / 1.4, lean: wrackRandom.signed(0.4) },
      ],
      { seed: SEED ^ (B2_SEEDS.wrack + i * 11), rings: 24 },
    );
    body.rotateZ(Math.PI / 2 - wrackRandom.signed(0.08));
    body.rotateY(-fragment.yaw + wrackRandom.signed(0.2));
    const { x, z } = worldOf(fragment.u, fragment.v);
    const y = seabedHeight(x, z) + 1.45;
    body.translate(x, y, z);
    (i % 2 === 0 ? paleParts : slateParts).push(body);
    contacts.push({ x, z, radius: h * 0.6, strength: 0.42 });
    // Colliders along the lying body.
    const ax = Math.cos(fragment.yaw);
    const az = Math.sin(fragment.yaw);
    for (const t of [-0.3, 0.05, 0.4]) {
      const su = fragment.u + ax * h * t;
      const sv = fragment.v + az * h * t;
      const at = worldOf(su, sv);
      colliders.push({
        center: new Vector3(at.x, seabedHeight(at.x, at.z) + 1.2, at.z),
        radius: 2.0,
      });
    }
  }

  // ─── THE SKIFF ───────────────────────────────────────────────────────────
  // The Ferryman's stone boat: a low hull-shaped mound and its prow
  // stump, half-buried at its berth. The berth's bareness is licensed.
  // Round 2: boat-long and pale — the r1 hull read as an ochre pancake.
  const skiffRandom = new Random(SEED ^ B2_SEEDS.skiff);
  const hull = boulderGeometry({ seed: SEED ^ B2_SEEDS.skiff, radius: 2.1, height: 1.9 });
  hull.applyMatrix4(new Matrix4().makeScale(2.3, 0.8, 0.78));
  stand(hull, paleParts, SKIFF_REST.u, SKIFF_REST.v, 0.9, 2.8, 1.5, 0.2);
  stand(
    stackGeometry(
      [{ radius: 0.6, rise: 0.2, stretch: 3.4, lean: 0.35 }],
      { seed: SEED ^ (B2_SEEDS.skiff + 3) },
    ),
    paleParts,
    SKIFF_REST.u + 3.8,
    SKIFF_REST.v + 1.5,
    skiffRandom.range(0, Math.PI * 2),
    0.75,
    2.2,
  );

  // ─── The Chute stones ────────────────────────────────────────────────────
  const chuteRandom = new Random(SEED ^ B2_SEEDS.chuteStones);
  for (const [i, spot] of ([
    [948, -20],
    [960, -46],
  ] as const).entries()) {
    const radius = chuteRandom.range(1.7, 2.3);
    stand(
      boulderGeometry({ seed: SEED ^ (B2_SEEDS.chuteStones + i * 3), radius, height: radius * 1.25 }),
      i === 0 ? paleParts : slateParts,
      spot[0],
      spot[1],
      chuteRandom.range(0, Math.PI * 2),
      radius,
      radius * 1.25,
    );
  }

  // ─── The Strand Watchers (round 3) ───────────────────────────────────────
  // Two lone stones on the Strand's open flanks: the r2 sweep found
  // the flank band bare of any mid-scale silhouette (the band-gap
  // between the shelf bands) — the flank meadows carry the ground and
  // these carry the skyline, in the province's own register: one
  // stone, then a long nothing, then one stone.
  const watcherRandom = new Random(SEED ^ B2_SEEDS.watchers);
  for (const [i, spot] of ([
    [854, 124, 4.6],
    [822, -122, 3.8],
  ] as const).entries()) {
    stand(
      stackGeometry(
        [
          { radius: 1.4, rise: 0.5, stretch: 1.5, lean: watcherRandom.signed(0.4) },
          {
            radius: 0.9,
            rise: spot[2] * 0.55,
            stretch: (spot[2] * 0.42) / 0.9,
            lean: watcherRandom.signed(0.7),
          },
        ],
        { seed: SEED ^ (B2_SEEDS.watchers + i * 13), rings: 24 },
      ),
      i === 0 ? slateParts : paleParts,
      spot[0],
      spot[1],
      watcherRandom.range(0, Math.PI * 2),
      1.5,
      spot[2],
    );
  }

  // ─── The Watch Stones ────────────────────────────────────────────────────
  const sleeperRandom = new Random(SEED ^ B2_SEEDS.sleeper);
  for (const [i, spot] of ([
    [1000, 118, 6.4],
    [1008, -112, 5.2],
  ] as const).entries()) {
    stand(
      stackGeometry(
        [
          { radius: 1.3, rise: 0.5, stretch: 1.6, lean: sleeperRandom.signed(0.4) },
          {
            radius: 0.85,
            rise: spot[2] * 0.55,
            stretch: (spot[2] * 0.4) / 0.85,
            lean: sleeperRandom.signed(0.8),
          },
        ],
        { seed: SEED ^ (B2_SEEDS.sleeper + i * 9), rings: 24 },
      ),
      i === 0 ? paleParts : slateParts,
      spot[0],
      spot[1],
      sleeperRandom.range(0, Math.PI * 2),
      1.4,
      spot[2],
    );
  }

  // ─── THE HORNS ───────────────────────────────────────────────────────────
  const hornRandom = new Random(SEED ^ B2_SEEDS.horns);
  for (const [i, horn] of HORNS.entries()) {
    const h = i === 0 ? 16 : 13;
    stand(
      stackGeometry(
        [
          { radius: 1.9, rise: 0.8, stretch: 2.2, lean: i === 0 ? 0.8 : -0.6 },
          { radius: 1.1, rise: h * 0.5, stretch: (h * 0.42) / 1.1, lean: i === 0 ? 1.6 : -1.3 },
        ],
        { seed: SEED ^ (B2_SEEDS.horns + i * 5), rings: 28 },
      ),
      // Round 4: the Horns join the SLATE family — pale spires against
      // the milky rim were fog-matched and the r2/r3 promise frames
      // read them as ghost smudges; the violet-slate silhouettes stand.
      slateParts,
      horn.u,
      horn.v,
      hornRandom.range(0, Math.PI * 2),
      2.0,
      h,
    );
  }

  // Guards: no stone stands inside a rest (the skiff's own berth stones
  // excepted by authorship) or on a close lens — asserted here so a
  // retune fails loudly at build, not softly in a capture.
  for (const contact of contacts) {
    for (const lens of CLOSE_LENSES) {
      const at = worldOf(lens.u, lens.v);
      if (Math.hypot(contact.x - at.x, contact.z - at.z) < 1.2) {
        throw new Error("deep-steps stone stands on a close lens");
      }
    }
  }
  // The palen pass (round 2): the rock pipeline's baked facing tint
  // read as rust under the deep mood — every part re-keys toward the
  // sky before merging, the pale family harder than the slate.
  for (const part of paleParts) {
    palenStone(part, 0.42);
  }
  for (const part of slateParts) {
    palenStone(part, 0.24);
  }

  // Two merged draws with the stone dusk-lift.
  const pale = createRockMaterial(STONE_PALE);
  pale.emissive.setHex(STONE_DUSK);
  pale.emissiveIntensity = STONE_DUSK_INTENSITY;
  const slate = createRockMaterial(STONE_SLATE);
  slate.emissive.setHex(STONE_DUSK);
  slate.emissiveIntensity = STONE_DUSK_INTENSITY;
  meshes.push(mergedMesh(paleParts, pale, "deepsteps-stone-pale"));
  meshes.push(mergedMesh(slateParts, slate, "deepsteps-stone-slate"));

  return { meshes, colliders, contacts };
}
