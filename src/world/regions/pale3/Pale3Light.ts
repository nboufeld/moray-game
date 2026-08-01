import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBeamAndPool, type BeamSpec, type PoolSpec } from "../kit/BeamAndPool";
import { DAYSPRING, roadCenter, worldOf } from "./Pale3Terrain";

/**
 * The light of the Dayspring — morning made into events. The kit
 * `beamAndPool` carries the whole four-part additive discipline
 * (fog:false, ground fade, edge-on fade, range fade by ~120 m).
 *
 * The region's one light grammar: EVERY blade leans the same way,
 * back DOWN the spoke — morning rays arriving from ahead, the way a
 * low sun throws its light long across a shore. (The Combs' blades
 * slanted every which way through fin slots; here the light has one
 * source and the whole country says so.)
 *
 * - slanted dawn blades pacing the font country and the descent;
 * - THE SUN ROAD: a lane of warm pools — no beams — running the road
 *   from the daybreak crossing to the Sun's Doorstep: the lane a low
 *   sun draws on water, lying on the floor;
 * - THE DAYSPRING's own shaft — the named light peak, the widest,
 *   warmest mark in the province, standing over the risen pearl;
 * - the Belfry's chimney beam, falling through its open crown.
 *
 * THE UNDAWN (u 1276–1302) stays beam-free — the hour before morning;
 * the mere and the doorstep keep their own licences (the doorstep's
 * only light is the Dayspring's).
 */

const SEED = SEEDS.regionPale3;

interface Slot {
  readonly u: number;
  readonly v: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
}

// The dawn blades: none inside the Undawn (1276–1302), none over the
// mere (1438,74) r 26, none on the doorstep (1614,0) r 13.
const SLOTS: readonly Slot[] = [
  // The Matins Gate's reveal beam, standing in the doorway.
  { u: 1258, v: 2, top: 11, width: 2.6, opacity: 0.12 },
  // The upper descent, before the Undawn.
  { u: 1270, v: -4, top: 9, width: 2.0, opacity: 0.09 },
  // The descent's foot, past the Undawn — daybreak.
  { u: 1310, v: 3, top: 6, width: 2.6, opacity: 0.11 },
  // The font country: rays between the towers.
  { u: 1346, v: -18, top: 2, width: 2.8, opacity: 0.09 },
  { u: 1392, v: 12, top: 1, width: 2.4, opacity: 0.08 },
  { u: 1430, v: -28, top: 1, width: 3.0, opacity: 0.09 },
  { u: 1474, v: 30, top: 2, width: 2.4, opacity: 0.08 },
  { u: 1516, v: -48, top: 2, width: 2.6, opacity: 0.09 },
  { u: 1552, v: 8, top: 3, width: 2.4, opacity: 0.09 },
  // The Dawn Steps' rising light.
  { u: 1592, v: 14, top: 4, width: 2.6, opacity: 0.1 },
];

/** Every blade leans back down the spoke: light from the morning. */
const DAWN_SLANT_U = -2.4;

export function buildPale3Light(belfryMouth: { x: number; y: number; z: number }): {
  groups: Group[];
} {
  const beams: BeamSpec[] = [];
  const pools: PoolSpec[] = [];

  for (const slot of SLOTS) {
    const { x, z } = worldOf(slot.u, slot.v);
    const slantTo = worldOf(slot.u + DAWN_SLANT_U, slot.v);
    beams.push({
      pos: [x, z],
      top: slot.top,
      width: slot.width,
      opacity: slot.opacity,
      slant: [(slantTo.x - x) / 10, (slantTo.z - z) / 10],
    });
    // A dapple under every blade: a beam that brightens nothing is a
    // decal (the kit's own default, kept when listing pools by hand).
    pools.push({ pos: [x, z], radius: slot.width * 1.1, opacity: 0.1 });
  }

  // THE SUN ROAD: warm pools pacing the road lane — light lying on the
  // floor, brightening toward the source. They stop at the doorstep's
  // edge: the last ten metres carry only the Dayspring's own light.
  for (let u = 1332; u <= 1596; u += 14) {
    const v = roadCenter(u);
    if (Math.hypot(u - 1614, v) < 16) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    const along = (u - 1332) / (1596 - 1332);
    pools.push({
      pos: [x, z],
      radius: 1.6 + along * 0.9,
      opacity: 0.08 + along * 0.06,
    });
  }

  // The Belfry's chimney beam, falling through the open crown into
  // the room — the secret's own light. Round 2: up a step, so the room
  // reads as LIT from the doorway, not merely occupied.
  beams.push({
    pos: [belfryMouth.x, belfryMouth.z],
    top: belfryMouth.y,
    width: 3.0,
    opacity: 0.16,
  });
  pools.push({ pos: [belfryMouth.x, belfryMouth.z], radius: 3.0, opacity: 0.16 });

  // THE DAYSPRING's shaft: the named light peak — the widest, warmest
  // mark in the province, standing over the risen pearl. Round 2: the
  // top raised so the shaft clears the dome's crest (r1's beam ended
  // inside the pearl and read as a haze on its skin).
  {
    const { x, z } = worldOf(DAYSPRING.u, DAYSPRING.v);
    beams.push({ pos: [x, z], top: 14, width: 8, opacity: 0.22 });
  }

  const build = buildBeamAndPool({
    seed: SEED ^ 0x11f9,
    tint: 0xfff0d2,
    ground: (x, z) => seabedHeight(x, z),
    beams,
    pools,
  });

  return { groups: [build.group] };
}
