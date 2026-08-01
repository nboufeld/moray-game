import { smoothstep01 } from "./Golden2Shared";
import {
  CARILLON,
  CELL,
  PAVEMENT_RADIUS,
  gullyChannelCenter,
  spokeOf,
} from "./Golden2Terrain";

/**
 * The Carillon Waste's protected rests, journey beats and close-pose
 * lens registry — the shared gates every cover and life builder
 * multiplies into its kit callbacks. Built to the R12 standard from
 * draft one: density, quality, light and life ARE the build, and the
 * rests are registered before the first capture, not retrofitted.
 *
 * ## The registered rests (MASTER §1.2 — this region's contributions)
 *
 * - **THE PAVEMENT** — the swept stone circle at the Carillon towers'
 *   feet (r 14 at spoke (1030, −18)). The wind keeps it clean: ring
 *   paint only. Its ONLY light is the Noon Bell (one beam + its cool
 *   pool), and its only motion is the Bell Ringer's slow rise from the
 *   belfry and the swifts crossing above — the resident's own circle,
 *   the Drain's Eye precedent.
 * - **THE ANCHORITE'S CELL** — the carved side-chamber off the
 *   Ribbon's elbow (r 7 at spoke (962, −78)). Nothing moves in it and
 *   nothing grows in it; its one thin light-blade is licensed. Bare
 *   stone, composed.
 */

export const PAVEMENT_REST = { u: CARILLON.u, v: CARILLON.v, radius: PAVEMENT_RADIUS } as const;
/** The rest is the chamber's INTERIOR (r 5.5); the carve keeps r 7 so
 *  the mouth's two flank stones stand outside the licence. */
export const CELL_REST = { u: CELL.u, v: CELL.v, radius: 5.5 } as const;

/**
 * 1 everywhere a fill instance may stand, easing to exactly 0 inside
 * the two registered rests. Multiplied into every fill gate — cover
 * AND life.
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const pavement = smoothstep01(
    (Math.hypot(u - PAVEMENT_REST.u, v - PAVEMENT_REST.v) - PAVEMENT_REST.radius) / 5,
  );
  const cell = smoothstep01((Math.hypot(u - CELL_REST.u, v - CELL_REST.v) - CELL_REST.radius) / 4);
  return Math.min(pavement, cell);
}

/** Strictly-inside test for the region test's exclusion sweep. */
export function insideRest(u: number, v: number): boolean {
  return (
    Math.hypot(u - PAVEMENT_REST.u, v - PAVEMENT_REST.v) < PAVEMENT_REST.radius ||
    Math.hypot(u - CELL_REST.u, v - CELL_REST.v) < CELL_REST.radius
  );
}

// ─── The journey's authored beats ────────────────────────────────────────────

/**
 * The wind-shadow pockets: small authored discs in the lee of stone
 * where the T2 understory concentrates — the roads' reveals, spaced
 * 20–40 m. Road entries ride the gully channel's own wander; court
 * entries are absolute spoke coordinates chosen clear of every
 * landmark stand, both rests and every close lens.
 */
export interface WindPocket {
  readonly u: number;
  readonly v: number;
  readonly radius: number;
}

function gullyPocket(u: number, dv: number, radius: number): WindPocket {
  return { u, v: gullyChannelCenter(u) + dv, radius };
}

export const WIND_POCKETS: readonly WindPocket[] = [
  // Down the shore road and the gully: a beat every 22–36 m.
  { u: 664, v: 8, radius: 4.5 },
  { u: 692, v: -7, radius: 4.5 },
  { u: 718, v: 6, radius: 5 },
  gullyPocket(756, 5, 4.5),
  gullyPocket(782, -5.5, 4.5),
  gullyPocket(808, 5, 5 ),
  // The Hoodoo Court rhythm: alternating flanks down the spine road
  // (u 820 → 1010), and side-loop beats toward the Windows, the
  // Ribbon's mouth and the seep apron.
  { u: 832, v: -14, radius: 6 },
  { u: 858, v: 10, radius: 6 },
  { u: 884, v: -22, radius: 6.5 },
  { u: 902, v: 16, radius: 6 },
  { u: 928, v: -8, radius: 6.5 },
  { u: 956, v: 18, radius: 6 },
  { u: 984, v: -4, radius: 6 },
  { u: 1008, v: 20, radius: 6.5 },
  // The far side: the Carillon's approach and the shelf's last garden.
  { u: 1052, v: 14, radius: 6 },
  { u: 1076, v: -32, radius: 6.5 },
  { u: 1098, v: 10, radius: 6 },
  // Round 2 (the sweep's verdict): the open flanks and the pass
  // shoulders — beats for the frames nobody composes for.
  { u: 770, v: 44, radius: 5.5 },
  { u: 782, v: -46, radius: 5.5 },
  { u: 868, v: 124, radius: 7 },
  // Round 3: the windows-wall pose's own near field — its camera
  // stands 23 m off the ridge's A end on open court the pockets and
  // the hoodoo lees never reached.
  { u: 849, v: 18, radius: 6 },
  { u: 836, v: 4, radius: 5.5 },
  { u: 930, v: -126, radius: 7 },
  { u: 1002, v: -136, radius: 7 },
  { u: 1066, v: 96, radius: 7 },
] as const;

/**
 * The close poses' camera stations (2–4 m lenses). The cover gates
 * carve a small standing-free hole at each so no blade or frond ever
 * grows into a lens — asserted by the region test.
 */
export const CLOSE_LENSES: readonly { u: number; v: number }[] = [
  { u: 858.5, v: 9.2 }, // close-court-garden (in a wind pocket)
  // Round 3: backed off the pool's rim — the r2 lens stood ON the rim
  // and framed sward with the pool cut out of its own shot.
  { u: 963.5, v: 82.5 }, // close-seep-rim
  // Round 2: backed off the tower — the r1 lens stood 2.4 m from a
  // 14.5 m shaft and framed a featureless wall.
  { u: 1040.0, v: -27.0 }, // close-flute-foot (a tower's foot)
  { u: 871.5, v: 52.5 }, // close-arch-shards (below the Windows wall)
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
 * The spine road: the one journey every system agrees on — off the
 * gully's foot, down the Hoodoo Court between the ranks, past the
 * Ribbon's mouth and the seep apron's foot to the Carillon, then out
 * across the Sunset Shelf to the depth-3 promise. The traveller shoal
 * swims it, the wind pockets flank it, and the stone stands clear of
 * it (spoke coordinates).
 */
export const COURT_ROAD: readonly (readonly [number, number])[] = [
  [818, 0],
  [850, -6],
  [890, -2],
  [930, 4],
  [970, 2],
  [1000, -8],
  [1030, -40],
  [1064, -26],
  [1090, 0],
  [1112, 6],
] as const;

/** Distance from the court road's spine, for stands and gates. */
export function roadDistance(u: number, v: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < COURT_ROAD.length - 1; i++) {
    const [au, av] = COURT_ROAD[i]!;
    const [bu, bv] = COURT_ROAD[i + 1]!;
    const du = bu - au;
    const dv = bv - av;
    const len2 = du * du + dv * dv;
    const t = Math.max(0, Math.min(1, ((u - au) * du + (v - av) * dv) / len2));
    best = Math.min(best, Math.hypot(u - (au + du * t), v - (av + dv * t)));
  }
  return best;
}

/**
 * The wrack drift-lines: shell and wrack runs angled across the roads
 * where the wind drops what it carries — short polylines the debris
 * strands along, one per road chapter.
 */
export const DRIFT_LINES: readonly (readonly (readonly [number, number])[])[] = [
  // Across the shore road at the u ~676 beat.
  [
    [670, -10],
    [677, -2],
    [684, 6],
  ],
  // The gully's foot, where the descent spills its freight.
  [
    [812, -10],
    [820, -2],
    [828, 8],
  ],
  // A court trough line riding the swales toward the Ribbon's mouth.
  [
    [880, -34],
    [893, -28],
    [906, -24],
  ],
] as const;
