import { smoothstep01 } from "./Blue3Shared";
import { DOORSTEP, PANS, PEARL, spokeOf } from "./Blue3Terrain";

/**
 * THE FIRST SEA's protected rests, journey beats and close-pose lens
 * registry — the shared gates every cover and life builder multiplies
 * into its kit callbacks. The Great Blue's voice, kept to the end:
 * COMPOSED EMPTINESS. This is the last region of the world, and its
 * rests are the program's most numerous — the deepest arrival earns
 * the deepest stillness.
 *
 * ## The registered rests (MASTER §1.2 — this region's contributions)
 *
 * - **THE WIDE MORNING** — the Mere's heart (r 55 at spoke
 *   (1374, −58)): the star-bloom paint at its brightest and the marine
 *   snow are its only content; its only motion is the Morning Whale's
 *   circuit crossing it. No scatter, no shoal, no glow, no beams.
 * - **THE STARWATER PANS** — r 18 at (1424, −114): the pans' pale
 *   floors and their faint shimmer; nothing else stands or swims.
 * - **THE MORNING SHELF HUSH** — u 1186–1236, |v| ≤ 24: the bare milky
 *   threshold between the Worldwall and the Daymark; the Daymark's
 *   blade at its far edge is the band's one licensed mark.
 * - **THE PEARL'S FOLD** — r 6 at (1548, 96): the Pearl, its hollow,
 *   and the thin finder blade. Nothing else.
 * - **THE SEA'S DOORSTEP** — r 14 at (1602, −4): the bench slab, the
 *   two Watchers, the dawn rays and the horizon. No fauna, no scatter.
 *
 * (The Worldwall band u < 1178 lies over the Deep Steps' own rim
 * country — "nothing clutters below the lip" holds by construction:
 * this region builds NOTHING there but the pass sheet and its seals.)
 */

export const MORNING_REST = { u: 1374, v: -58, radius: 55 } as const;
export const PANS_REST = { u: 1424, v: -114, radius: 18 } as const;
export const HUSH_REST = { fromU: 1186, toU: 1236, halfV: 24 } as const;
export const PEARL_REST = { u: PEARL.u, v: PEARL.v, radius: 6 } as const;
export const DOORSTEP_REST = { u: DOORSTEP.u, v: DOORSTEP.v, radius: DOORSTEP.radius } as const;

/**
 * 1 everywhere a fill instance may stand, easing to exactly 0 inside
 * the registered rests. Multiplied into every fill gate — cover AND
 * life.
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  let free = 1;
  for (const rest of [MORNING_REST, PANS_REST, PEARL_REST, DOORSTEP_REST]) {
    free = Math.min(
      free,
      smoothstep01((Math.hypot(u - rest.u, v - rest.v) - rest.radius) / 8),
    );
  }
  if (u > HUSH_REST.fromU - 7 && u < HUSH_REST.toU + 7 && Math.abs(v) < HUSH_REST.halfV + 4) {
    // Full suppression strictly before the strict boundary, so a gate
    // roll can never seat an instance just inside the licence line.
    const inU =
      smoothstep01((u - (HUSH_REST.fromU - 6)) / 6) * (1 - smoothstep01((u - HUSH_REST.toU) / 6));
    const inV = 1 - smoothstep01((Math.abs(v) - HUSH_REST.halfV) / 3);
    free = Math.min(free, 1 - inU * inV);
  }
  return free;
}

/** Strictly-inside test for the region test's exclusion sweep. */
export function insideRest(u: number, v: number): boolean {
  for (const rest of [MORNING_REST, PANS_REST, PEARL_REST, DOORSTEP_REST]) {
    if (Math.hypot(u - rest.u, v - rest.v) < rest.radius) {
      return true;
    }
  }
  return u > HUSH_REST.fromU && u < HUSH_REST.toU && Math.abs(v) < HUSH_REST.halfV;
}

// ─── The journey's authored beats ────────────────────────────────────────────

/**
 * The spine road: the world's last journey — over the Worldwall
 * between the Horns, across the Morning Shelf hush to the Daymark,
 * down the Longfall, along the Chain to the Anchor, across the
 * Shallows where the young river runs, up over the Wellhead's north
 * rim beside the Daybreak, and out across the open Mere toward the
 * Sea's Doorstep (the road's own last chapter goes bare — the bench is
 * reached, not dressed). The dawn shoal rides it; the drift beats
 * flank it; every stone stands clear of its line.
 */
export const SPINE_ROAD: readonly (readonly [number, number])[] = [
  [1150, 0],
  [1178, 2],
  [1206, -2],
  [1234, 2],
  [1252, -2],
  [1274, 0],
  [1298, -4],
  [1322, 2],
  // The chain reach: the road runs a few metres SEAWARD of the links
  // (the links and the Anchor's foot are colliders; the road is the
  // clear line beside the drawn one).
  [1340, 14],
  [1356, 26],
  [1372, 40],
  [1386, 50],
  [1398, 60],
  [1416, 58],
  [1432, 52],
  [1444, 46],
  [1462, 26],
  [1480, 4],
  [1498, -6],
  [1520, -16],
  [1548, -14],
  [1578, -8],
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
 * — the road's reveals, spaced 20–40 m (the registered rests are the
 * only licensed gaps, MASTER R10), plus the rim-facing flank bands
 * (MASTER F-R3: the three-layer answer must live in the first ~35 m
 * everywhere). Sparse by the province's voice: silt banks and tuft
 * stands, never gardens.
 */
export interface DriftBeat {
  readonly u: number;
  readonly v: number;
  readonly radius: number;
}

export const DRIFT_BEATS: readonly DriftBeat[] = [
  // The shelf road's shoulders (outside the hush).
  { u: 1244, v: -14, radius: 5 },
  // The Longfall: a beat on alternating flanks per reach.
  { u: 1268, v: 14, radius: 5.5 },
  { u: 1290, v: -16, radius: 5.5 },
  { u: 1312, v: 12, radius: 6 },
  { u: 1330, v: -10, radius: 6 },
  // The Chain's side of the road.
  { u: 1352, v: 34, radius: 6 },
  { u: 1374, v: 48, radius: 6 },
  { u: 1404, v: 78, radius: 6.5 },
  // The Shallows and the Wellhead's approach.
  { u: 1428, v: 40, radius: 6 },
  { u: 1456, v: 34, radius: 6 },
  { u: 1472, v: 12, radius: 6 },
  { u: 1532, v: -44, radius: 6 },
  // Sweep-cone anchors (the pinned probe's findings: mid-frame
  // silhouettes for the open-floor cones at sweeps 03, 05 and 08).
  { u: 1458, v: 104, radius: 6.5 },
  { u: 1428, v: -8, radius: 6 },
  { u: 1622, v: -16, radius: 6 },
  // The east Mere: the Doorstep's approach out of the open floor.
  { u: 1548, v: -34, radius: 6.5 },
  { u: 1572, v: 12, radius: 6 },
  // The open flanks (F-R3 rim-facing bands).
  { u: 1300, v: 74, radius: 7 },
  { u: 1312, v: -74, radius: 7 },
  { u: 1348, v: 108, radius: 7 },
  { u: 1338, v: -120, radius: 7 },
  { u: 1408, v: 130, radius: 7 },
  { u: 1452, v: 132, radius: 7 },
  { u: 1462, v: -136, radius: 7 },
  { u: 1512, v: 108, radius: 7 },
  { u: 1524, v: -102, radius: 7 },
  { u: 1584, v: 62, radius: 7 },
  { u: 1592, v: -58, radius: 7 },
  { u: 1626, v: 20, radius: 7 },
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
  { u: 1398.0, v: 10.0 }, // close-mere-grain (the star-bloom floor)
  { u: 1449.0, v: 33.0 }, // close-bank-blades (the Cradle's levee)
  { u: 1358.0, v: 39.0 }, // close-chain-link (the third link, 3/4)
  { u: 1521.0, v: -43.0 }, // close-well-rim (a rim crag on the crater's ring)
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

/** Distance from the Chain's drift-line (links + anchor bearing). */
export function chainDistance(u: number, v: number): number {
  const line: readonly (readonly [number, number])[] = [
    [1330, 12],
    [1336, 18],
    [1350, 30],
    [1364, 42],
    [1377, 52],
    [1387, 59],
    [1394, 65],
  ];
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < line.length - 1; i++) {
    const [au, av] = line[i]!;
    const [bu, bv] = line[i + 1]!;
    const du = bu - au;
    const dv = bv - av;
    const len2 = du * du + dv * dv;
    const t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / len2));
    best = Math.min(best, Math.hypot(u - (au + du * t), v - (av + dv * t)));
  }
  return best;
}

// Re-exported for gates that need the raw pan discs (paint, shimmer).
export { PANS };
