import { smoothstep01 } from "./Blue2Shared";
import { MOON_WELL, spokeOf } from "./Blue2Terrain";

/**
 * The Deep Steps' protected rests, journey beats and close-pose lens
 * registry — the shared gates every cover and life builder multiplies
 * into its kit callbacks. Built to the R12 standard from draft one, in
 * the Great Blue's own register: COMPOSED EMPTINESS IS THE VOICE, so
 * this region's rests are larger and more numerous than any sibling's,
 * and its beats are sparser — one great shape is an event.
 *
 * ## The registered rests (MASTER §1.2 — this region's contributions)
 *
 * - **THE ROUND OF THE GENTLE DARK** — the lowest shelf's heart (r 78
 *   at spoke (1030, −10)). Ripple paint only; its ONLY light is the
 *   Moon Well (one great beam + its pale circle); its only motion is
 *   the Gentle Dark's slow circuit and the road's own last, bare
 *   chapter crossing to the Well. No scatter, no shoal, no glow.
 * - **THE OTHERSHORE HUSH** — the saddle's heart (u 700–740,
 *   |v| ≤ 26): the bare milky lip of the World's Edge, sun again after
 *   the violet. The Pharos stands at its edge (u 692, outside); its
 *   thin blade is the band's one licensed mark. No fauna, no scatter.
 * - **THE SKIFF'S BERTH** — r 7 at spoke (818, 96): the Ferryman's
 *   stone skiff and the lantern-beam that finds it. Nothing else.
 *
 * (The Far Wall band u < 668 lies under the Drop Plains' own
 * Under-Blue rest — "nothing clutters below the lip" — and this region
 * builds NOTHING there; that inheritance is honoured by construction,
 * not registered twice.)
 */

export const ROUND_REST = { u: 1030, v: -10, radius: 78 } as const;
export const HUSH_REST = { fromU: 700, toU: 740, halfV: 26 } as const;
export const SKIFF_REST = { u: 818, v: 96, radius: 7 } as const;

/** The Moon Well's own circle (inside the Round; named for licences). */
export const WELL_REST = { u: MOON_WELL.u, v: MOON_WELL.v, radius: MOON_WELL.radius } as const;

/**
 * 1 everywhere a fill instance may stand, easing to exactly 0 inside
 * the registered rests. Multiplied into every fill gate — cover AND
 * life.
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const round = smoothstep01(
    (Math.hypot(u - ROUND_REST.u, v - ROUND_REST.v) - ROUND_REST.radius) / 8,
  );
  const skiff = smoothstep01(
    (Math.hypot(u - SKIFF_REST.u, v - SKIFF_REST.v) - SKIFF_REST.radius) / 4,
  );
  let hush = 1;
  if (u > HUSH_REST.fromU - 7 && u < HUSH_REST.toU + 7 && Math.abs(v) < HUSH_REST.halfV + 4) {
    // The suppression reaches FULL strictly before the strict rest
    // boundary (`insideRest`), so a gate roll can never seat an
    // instance just inside the licence line.
    const inU =
      smoothstep01((u - (HUSH_REST.fromU - 6)) / 6) *
      (1 - smoothstep01((u - HUSH_REST.toU) / 6));
    const inV = 1 - smoothstep01((Math.abs(v) - HUSH_REST.halfV) / 3);
    hush = 1 - inU * inV;
  }
  return Math.min(round, skiff, hush);
}

/** Strictly-inside test for the region test's exclusion sweep. */
export function insideRest(u: number, v: number): boolean {
  return (
    Math.hypot(u - ROUND_REST.u, v - ROUND_REST.v) < ROUND_REST.radius ||
    Math.hypot(u - SKIFF_REST.u, v - SKIFF_REST.v) < SKIFF_REST.radius ||
    (u > HUSH_REST.fromU && u < HUSH_REST.toU && Math.abs(v) < HUSH_REST.halfV)
  );
}

// ─── The journey's authored beats ────────────────────────────────────────────

/**
 * The spine road: the region's one journey — over the Far Wall's crest,
 * across the Othershore hush, off the Brink and down the Stairfall,
 * across the Strand through the Kings' Wrack, under the Weir at the
 * Ford, along the Spill's rim to the Chute, and out across the bare
 * Round to the Moon Well and the Horns. Spoke coordinates; the pilgrim
 * fry swim it, the drift beats flank it, the stone stands clear of it.
 */
export const SPINE_ROAD: readonly (readonly [number, number])[] = [
  [664, 2],
  [692, 6],
  [714, -2],
  [738, 2],
  [760, 4],
  [782, -2],
  [806, -8],
  [834, 6],
  [862, 0],
  [884, -10],
  [899, -16],
  [922, -24],
  [944, -30],
  [958, -38],
  [980, -26],
  [1005, -18],
  [1032, -8],
  [1062, -2],
  [1092, 2],
] as const;

/** Distance from the spine road, for stands and gates. */
export function roadDistance(u: number, v: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < SPINE_ROAD.length - 1; i++) {
    const [au, av] = SPINE_ROAD[i]!;
    const [bu, bv] = SPINE_ROAD[i + 1]!;
    const du = bu - au;
    const dv = bv - av;
    const len2 = du * du + dv * dv;
    const t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / len2));
    best = Math.min(best, Math.hypot(u - (au + du * t), v - (av + dv * t)));
  }
  return best;
}

/**
 * The drift beats: authored discs where the T2 understory concentrates
 * — the roads' reveals, spaced 20–40 m (the registered rests are the
 * only licensed gaps, MASTER R10). Sparse by the province's voice:
 * these are silt banks and tuft stands, not gardens.
 */
export interface DriftBeat {
  readonly u: number;
  readonly v: number;
  readonly radius: number;
}

export const DRIFT_BEATS: readonly DriftBeat[] = [
  // The Stairfall's shoulders: a beat on alternating flanks per tread.
  { u: 762, v: 14, radius: 5 },
  { u: 780, v: -14, radius: 5 },
  { u: 796, v: 10, radius: 5.5 },
  // The Strand: the road threading the Kings' Wrack.
  { u: 818, v: -16, radius: 6 },
  { u: 840, v: 14, radius: 6 },
  { u: 858, v: -12, radius: 6 },
  // The Current's Step: banks, the Ford's approach, the Spill's rim.
  { u: 880, v: 6, radius: 6 },
  { u: 894, v: -32, radius: 6 },
  { u: 916, v: -12, radius: 6 },
  { u: 936, v: -44, radius: 6.5 },
  { u: 952, v: -22, radius: 6 },
  // The far side of the Round: the Horns' approach out of the rest.
  { u: 1096, v: 18, radius: 6.5 },
  { u: 1110, v: -14, radius: 6 },
  // The open flanks (MASTER F-R3: rim poses face outward — the
  // three-layer answer must live in the first ~35 m everywhere).
  { u: 802, v: 96, radius: 7 },
  { u: 812, v: -104, radius: 7 },
  { u: 856, v: 128, radius: 7 },
  { u: 868, v: -132, radius: 7 },
  { u: 918, v: 132, radius: 7 },
  { u: 926, v: 92, radius: 6.5 },
  { u: 942, v: -152, radius: 7 },
  { u: 984, v: 128, radius: 7 },
  { u: 996, v: -122, radius: 7 },
  { u: 1044, v: 108, radius: 7 },
  { u: 1052, v: -106, radius: 7 },
] as const;

/** How deep inside the nearest drift beat a spoke point sits. */
export function beatDepth(u: number, v: number): number {
  let best = 0;
  for (const beat of DRIFT_BEATS) {
    const d = Math.hypot(u - beat.u, v - beat.v);
    best = Math.max(best, 1 - smoothstep01((d - beat.radius * 0.55) / (beat.radius * 0.55)));
  }
  return best;
}

/**
 * The close poses' camera stations (2–4 m lenses). The cover gates
 * carve a small standing-free hole at each so no blade or frond ever
 * grows into a lens — asserted by the region test.
 */
export const CLOSE_LENSES: readonly { u: number; v: number }[] = [
  { u: 816.0, v: -18.5 }, // close-strand-ripple
  { u: 887.0, v: 3.0 }, // close-bank-blades (the Current's levee)
  // Round 2: onto a real fragment (the r1 lens's stone was out of its
  // own frame) and off the post's shaft (the r1 lens stood inside its
  // subject — the golden2 close-flute-foot lesson).
  { u: 830.5, v: -29.5 }, // close-wrack-crown (the great fallen blade)
  { u: 870.5, v: -32.5 }, // close-post-foot (the first Mooring post)
] as const;

/** 1 clear of every close lens, 0 within a metre of one. */
export function lensFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  let free = 1;
  for (const lens of CLOSE_LENSES) {
    free = Math.min(free, smoothstep01((Math.hypot(u - lens.u, v - lens.v) - 1.05) / 0.6));
  }
  return free;
}

/**
 * The Kings' Wrack: the drift-line where everything the world above
 * sheds over the World's Edge came to rest — a single composed arc of
 * fallen megalith fragments sweeping the Strand (one line, not a
 * junkyard; the fragments are the Drop Plains' own stone family,
 * toppled). The road passes through the gap between its middle stones.
 */
export const WRACK_LINE: readonly (readonly [number, number])[] = [
  [808, 110],
  [820, 60],
  [830, 22],
  [828, -34],
  [816, -76],
  [806, -108],
] as const;

/** Distance from the wrack drift-line. */
export function wrackDistance(u: number, v: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < WRACK_LINE.length - 1; i++) {
    const [au, av] = WRACK_LINE[i]!;
    const [bu, bv] = WRACK_LINE[i + 1]!;
    const du = bu - au;
    const dv = bv - av;
    const len2 = du * du + dv * dv;
    const t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / len2));
    best = Math.min(best, Math.hypot(u - (au + du * t), v - (av + dv * t)));
  }
  return best;
}