import { Matrix4, TorusGeometry, Vector3, type BufferGeometry, type Mesh } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial, weatherRock } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { CLOSE_LENSES } from "./Blue3Beats";
import {
  B3_SEEDS,
  STONE_DUSK,
  STONE_DUSK_INTENSITY,
  STONE_PALE,
  STONE_SLATE,
  mergedMesh,
  palenStone,
} from "./Blue3Shared";
import {
  ANCHOR,
  CHAIN_LINKS,
  DAYMARK,
  DOORSTEP,
  FORD,
  PANS,
  WELLHEAD,
  worldOf,
} from "./Blue3Terrain";

/**
 * THE FIRST SEA's free stone — placed by the province's law, kept to
 * the last room: ONE GREAT SHAPE IS AN EVENT. No field scatter of
 * stone anywhere; every stone is authored and named:
 *
 * - **THE DAYMARK** (1252, 6): the lone pale waymark at the Longfall's
 *   crest — the first thing of ours the fog gives up, past the Deep
 *   Steps' parted distance rings (u ≤ 1228; the Emerald Gate law paid
 *   at authoring time).
 * - **The Buoy Stones**: five rounded stones pacing the Longfall on
 *   alternating flanks — the drowned buoys of the world's last road.
 * - **THE CHAIN**: five colossal stone links, each fallen flat or
 *   half-heaved, trailing from the Longfall's foot to the Anchor —
 *   the Mooring's other end, three hundred metres below its posts.
 * - **THE ANCHOR** (1392, 64): where the world was moored — a
 *   half-raised admiralty anchor of pale stone, shank rising thirteen
 *   metres out of the silt to its ring, one fluke breaking the Mere
 *   like a fin, the other still buried.
 * - **The Wellhead crags**: five slate teeth on the crater's rim.
 * - **The Ford stones**: three low steps where the road crosses the
 *   young river at the Shallows.
 * - **The Pan lips**: small slabs at the Starwater Pans' rims (the
 *   rest's licence names them).
 * - **THE SEA'S DOORSTEP**: the bench slab and its two Watchers on
 *   the last rise, facing the painted morning.
 * - **THE PEARL** is built in Blue3Light (it glows; its family is
 *   light, not stone).
 *
 * Everything merges per stone family (two draws), wears
 * `createRockMaterial` in the region's pale and violet-slate families
 * with the stone dusk-lift, and stands on `seabedHeight`.
 */

const SEED = SEEDS.regionBlue3;

export interface Blue3StonesBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

/** A weathered stone ring — the chain-link and anchor-eye family.
 *  `weatherRock` gives it the family's UVs, algae tint and welded
 *  normals so it merges cleanly with the lathe shapes. */
function ringGeometry(seed: number, radius: number, tube: number): BufferGeometry {
  // Kept INDEXED like the lathe family, so the stone merge stays one
  // homogeneous draw; weatherRock re-normals, re-UVs and tints it into
  // the family.
  const ring = new TorusGeometry(radius, tube, 10, 22);
  weatherRock(ring, seed, { amount: 0.07 });
  return ring;
}

export function buildBlue3Stones(): Blue3StonesBuild {
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

  // ─── THE DAYMARK ─────────────────────────────────────────────────────────
  const daymarkRandom = new Random(SEED ^ B3_SEEDS.daymark);
  stand(
    stackGeometry(
      [
        { radius: 1.4, rise: 0.6, stretch: 1.9, lean: 0.35 },
        { radius: 0.9, rise: 5.2, stretch: 3.4, lean: 0.9 },
      ],
      { seed: SEED ^ B3_SEEDS.daymark, rings: 26 },
    ),
    paleParts,
    DAYMARK.u,
    DAYMARK.v,
    daymarkRandom.range(0, Math.PI * 2),
    1.4,
    8.4,
  );

  // ─── The Buoy Stones ─────────────────────────────────────────────────────
  const buoyRandom = new Random(SEED ^ B3_SEEDS.buoys);
  for (const [i, spot] of ([
    [1270, 16],
    [1292, -18],
    [1314, 14],
    [1332, -12],
    [1344, 6],
  ] as const).entries()) {
    const radius = buoyRandom.range(1.4, 2.1);
    stand(
      boulderGeometry({ seed: SEED ^ (B3_SEEDS.buoys + i * 5), radius, height: radius * 1.35 }),
      i % 2 === 0 ? paleParts : slateParts,
      spot[0],
      spot[1],
      buoyRandom.range(0, Math.PI * 2),
      radius,
      radius * 1.35,
    );
  }
  // The Gatebuoys (round 2): a slab-and-stone pair flanking the road
  // at the Longfall's new brink, so the crest frame has its jambs.
  // Appended after all existing draws — the standing reroll fence.
  for (const [i, spot] of ([
    [1256, -10],
    [1259, 8],
  ] as const).entries()) {
    const radius = buoyRandom.range(1.2, 1.7);
    stand(
      i === 0
        ? slabGeometry({ seed: SEED ^ (B3_SEEDS.buoys + 90 + i), radius: radius * 1.3, height: radius * 0.7 })
        : boulderGeometry({ seed: SEED ^ (B3_SEEDS.buoys + 90 + i), radius, height: radius * 1.3 }),
      i === 0 ? paleParts : slateParts,
      spot[0],
      spot[1],
      buoyRandom.range(0, Math.PI * 2),
      radius * 1.2,
      radius,
    );
  }

  // ─── THE CHAIN ───────────────────────────────────────────────────────────
  // Five great stone links. Most lie flat, half-drowned in the silt;
  // the two nearest the Anchor heave up as the chain "rises" toward
  // the ring — the line drawn in stone.
  const chainRandom = new Random(SEED ^ B3_SEEDS.chain);
  for (const [i, link] of CHAIN_LINKS.entries()) {
    const radius = 2.1 + chainRandom.range(-0.2, 0.3);
    const ring = ringGeometry(SEED ^ (B3_SEEDS.chain + i * 7), radius, 0.55);
    const heave = i >= 3 ? 0.55 + (i - 3) * 0.35 : 0.12 + chainRandom.range(0, 0.1);
    // Flat rings pitch just off the floor; heaved ones tilt up along
    // the chain's bearing toward the Anchor.
    const bearing = Math.atan2(ANCHOR.v - link.v, ANCHOR.u - link.u);
    ring.rotateX(Math.PI / 2 - heave);
    ring.rotateY(-bearing + chainRandom.signed(0.15));
    const { x, z } = worldOf(link.u, link.v);
    const y = seabedHeight(x, z) + 0.25 + heave * radius * 0.9;
    ring.translate(x, y, z);
    (i % 2 === 0 ? paleParts : slateParts).push(ring);
    contacts.push({ x, z, radius: radius * 1.4, strength: 0.38 });
    colliders.push({ center: new Vector3(x, y, z), radius: radius * 0.9 });
  }

  // ─── THE ANCHOR ──────────────────────────────────────────────────────────
  // Assembled lying along its yaw in a local frame (+x = the shank's
  // rise direction), then rotated and seated. The shank leans out of
  // the silt at ~33°; the ring and stock crown it; one arm and its
  // fluke break the floor beside the buried foot.
  {
    const anchorSeed = SEED ^ B3_SEEDS.anchor;
    const parts: BufferGeometry[] = [];

    // The shank: a long pale stack, lathed upright then pitched over.
    const shank = stackGeometry(
      [
        { radius: 1.7, rise: 0.4, stretch: 1.5, lean: 0.1 },
        { radius: 1.15, rise: 11.5, stretch: 8.6, lean: 0.25 },
      ],
      { seed: anchorSeed, rings: 30 },
    );
    // Pitch: crown toward +x, elevation ~33°.
    shank.rotateZ(-1.0);
    shank.translate(-2.5, -1.6, 0);
    parts.push(shank);

    // The ring (the eye), seated ON the crown.
    const eye = ringGeometry(anchorSeed ^ 0x11, 1.8, 0.5);
    eye.rotateY(Math.PI / 2);
    eye.translate(14.9, 11.0, 0);
    parts.push(eye);

    // The stock: a crossbar THROUGH the shank under the eye (round 2:
    // the r1 offset left it floating beside the crown).
    const stock = stackGeometry(
      [{ radius: 0.72, rise: 0.2, stretch: 6.4, lean: 0 }],
      { seed: anchorSeed ^ 0x23, rings: 18 },
    );
    stock.rotateX(Math.PI / 2);
    stock.translate(13.0, 9.4, -3.2);
    parts.push(stock);

    // The raised arm and its fluke, breaking the silt like a fin.
    const arm = stackGeometry(
      [{ radius: 1.0, rise: 0.2, stretch: 4.4, lean: 0.9 }],
      { seed: anchorSeed ^ 0x37, rings: 20 },
    );
    arm.rotateZ(0.5);
    arm.translate(-4.8, -1.4, 1.4);
    parts.push(arm);
    const fluke = slabGeometry({ seed: anchorSeed ^ 0x41, radius: 2.6, height: 1.2 });
    fluke.applyMatrix4(new Matrix4().makeScale(1.35, 2.6, 0.42));
    fluke.rotateZ(-0.35);
    fluke.translate(-6.6, 0.6, 2.6);
    parts.push(fluke);
    // The buried fluke's tip, just proud on the far side.
    const tip = slabGeometry({ seed: anchorSeed ^ 0x53, radius: 1.6, height: 0.9 });
    tip.applyMatrix4(new Matrix4().makeScale(1.0, 1.6, 0.4));
    tip.rotateZ(0.4);
    tip.translate(-3.4, -0.7, -3.2);
    parts.push(tip);

    const { x, z } = worldOf(ANCHOR.u, ANCHOR.v);
    const y = seabedHeight(x, z);
    const yawMatrix = new Matrix4().makeRotationY(ANCHOR.yaw);
    for (const part of parts) {
      part.applyMatrix4(yawMatrix);
      part.translate(x, y, z);
      paleParts.push(part);
    }
    contacts.push({ x, z, radius: 9, strength: 0.42 });

    // Colliders along the shank's lie, the crown and the fluke.
    const place = (lx: number, ly: number, lz: number, radius: number): void => {
      const px = lx * Math.cos(ANCHOR.yaw) + lz * Math.sin(ANCHOR.yaw);
      const pz = -lx * Math.sin(ANCHOR.yaw) + lz * Math.cos(ANCHOR.yaw);
      colliders.push({ center: new Vector3(x + px, y + ly, z + pz), radius });
    };
    place(-1, 0.6, 0, 2.4);
    place(3.4, 3.4, 0, 2.1);
    place(7.8, 6.4, 0, 1.9);
    place(11.6, 9.4, 0, 1.8);
    place(15.1, 12.1, 0, 2.3);
    place(-6.4, 1.4, 2.4, 2.2);
  }

  // ─── The Wellhead crags ──────────────────────────────────────────────────
  // Five slate teeth on the crater's rim, clear of the Overbrim's
  // bearing (≈ 2.15 rad) and the road's rim crossing (≈ 1.75 rad).
  // Round 2: taller and near-upright — the r1 hard leans read as
  // floating pods when a crag's crown showed over a rim shoulder.
  const cragRandom = new Random(SEED ^ B3_SEEDS.wellCrags);
  for (const [i, bearing] of [0.35, 2.95, 3.85, 4.75, 5.65].entries()) {
    const h = cragRandom.range(5.0, 8.0);
    const cu = WELLHEAD.u + Math.cos(bearing) * (WELLHEAD.rimR + 1);
    const cv = WELLHEAD.v + Math.sin(bearing) * (WELLHEAD.rimR + 1);
    stand(
      stackGeometry(
        [
          { radius: 1.3, rise: 0.4, stretch: 1.5, lean: cragRandom.signed(0.3) },
          { radius: 0.85, rise: h * 0.52, stretch: (h * 0.42) / 0.85, lean: cragRandom.signed(0.45) },
        ],
        { seed: SEED ^ (B3_SEEDS.wellCrags + i * 9), rings: 24 },
      ),
      slateParts,
      cu,
      cv,
      cragRandom.range(0, Math.PI * 2),
      1.4,
      h,
    );
  }

  // ─── The Ford stones ─────────────────────────────────────────────────────
  const fordRandom = new Random(SEED ^ B3_SEEDS.fordStones);
  for (const [i, offset] of ([
    [-3.2, 2.4],
    [0.2, -0.6],
    [3.4, -3.2],
  ] as const).entries()) {
    const radius = fordRandom.range(0.9, 1.3);
    stand(
      boulderGeometry({ seed: SEED ^ (B3_SEEDS.fordStones + i * 3), radius, height: radius * 0.9 }),
      paleParts,
      FORD.u + offset[0],
      FORD.v + offset[1],
      fordRandom.range(0, Math.PI * 2),
      radius,
      radius * 0.9,
      0.2,
    );
  }

  // ─── The Pan lips ────────────────────────────────────────────────────────
  // Licensed by the Starwater Pans' own registry entry.
  const panRandom = new Random(SEED ^ B3_SEEDS.panLips);
  for (const [i, pan] of PANS.entries()) {
    for (let s = 0; s < 2; s++) {
      const bearing = panRandom.range(0, Math.PI * 2);
      const radius = panRandom.range(0.7, 1.15);
      stand(
        slabGeometry({ seed: SEED ^ (B3_SEEDS.panLips + i * 11 + s), radius, height: radius * 0.5 }),
        s === 0 ? paleParts : slateParts,
        pan.u + Math.cos(bearing) * (pan.radius + 0.8),
        pan.v + Math.sin(bearing) * (pan.radius + 0.8),
        panRandom.range(0, Math.PI * 2),
        radius,
        radius * 0.5,
        0.05,
      );
    }
  }

  // ─── THE SEA'S DOORSTEP ──────────────────────────────────────────────────
  const doorRandom = new Random(SEED ^ B3_SEEDS.doorstep);
  const bench = slabGeometry({ seed: SEED ^ B3_SEEDS.doorstep, radius: 3.2, height: 1.15 });
  stand(bench, paleParts, DOORSTEP.u, DOORSTEP.v - 1, doorRandom.range(0, Math.PI * 2), 3.2, 1.15, 0.1);

  const watcherRandom = new Random(SEED ^ B3_SEEDS.watchers);
  for (const [i, spot] of ([
    [1595, 5, 5.6],
    [1608, -14, 4.4],
  ] as const).entries()) {
    stand(
      stackGeometry(
        [
          { radius: 1.3, rise: 0.5, stretch: 1.6, lean: watcherRandom.signed(0.4) },
          {
            radius: 0.85,
            rise: spot[2] * 0.55,
            stretch: (spot[2] * 0.42) / 0.85,
            lean: watcherRandom.signed(0.8),
          },
        ],
        { seed: SEED ^ (B3_SEEDS.watchers + i * 13), rings: 24 },
      ),
      i === 0 ? slateParts : paleParts,
      spot[0],
      spot[1],
      watcherRandom.range(0, Math.PI * 2),
      1.4,
      spot[2],
    );
  }

  // Guards: no stone stands on a close lens — asserted at build, so a
  // retune fails loudly here rather than softly in a capture.
  for (const contact of contacts) {
    for (const lens of CLOSE_LENSES) {
      const at = worldOf(lens.u, lens.v);
      if (Math.hypot(contact.x - at.x, contact.z - at.z) < 1.2) {
        throw new Error("first-sea stone stands on a close lens");
      }
    }
  }

  // The palen pass (blue-2's proven cure, taken from draft one and
  // DEEPENED in round 2: our mood is brighter than the Deep Steps',
  // and the r1 stones rendered bruised orange-purple at close range).
  for (const part of paleParts) {
    palenStone(part, 0.55);
  }
  for (const part of slateParts) {
    palenStone(part, 0.34);
  }

  const pale = createRockMaterial(STONE_PALE);
  pale.emissive.setHex(STONE_DUSK);
  pale.emissiveIntensity = STONE_DUSK_INTENSITY;
  const slate = createRockMaterial(STONE_SLATE);
  slate.emissive.setHex(STONE_DUSK);
  slate.emissiveIntensity = STONE_DUSK_INTENSITY;
  meshes.push(mergedMesh(paleParts, pale, "firstsea-stone-pale"));
  meshes.push(mergedMesh(slateParts, slate, "firstsea-stone-slate"));

  return { meshes, colliders, contacts };
}
