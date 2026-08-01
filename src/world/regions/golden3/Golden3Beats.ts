import { smoothstep01 } from "./Golden3Shared";
import { DOOR, STILL_MIRROR, combeChannelCenter, spokeOf } from "./Golden3Terrain";

/**
 * The Vesper Strand's protected rests, journey beats and close-pose
 * lens registry — the shared gates every cover and life builder
 * multiplies into its kit callbacks. Built to the R12 standard from
 * draft one: density, quality, light and life ARE the build, and the
 * rests are registered before the first capture, not retrofitted.
 *
 * ## The registered rests (MASTER §1.2 — this region's contributions)
 *
 * - **THE STILL MIRROR** — the largest mirror pan (r 12 at spoke
 *   (1408, −26)). The evening holds its breath here: pan paint and its
 *   salt rim only; its ONLY light is its own sky-pool (the reflection
 *   lying on the mineral floor), and NOTHING moves in it — no crabs, no
 *   bubbles, no motes born inside its bowl.
 * - **THE PILGRIM'S THRESHOLD** — the swept circle at the Sun's Door's
 *   foot (r 8 at spoke (1600, −4)). Ripple paint only; its only light
 *   is THE LAST LIGHT falling through the arch, and its only motion is
 *   the Pilgrim crossing above — the resident's own circle (the Drain's
 *   Eye and Pavement precedents, third use in the province).
 */

export const MIRROR_REST = { u: STILL_MIRROR.u, v: STILL_MIRROR.v, radius: 12 } as const;
export const THRESHOLD_REST = { u: DOOR.u, v: DOOR.v, radius: 8 } as const;

/**
 * 1 everywhere a fill instance may stand, easing to exactly 0 inside
 * the two registered rests. Multiplied into every fill gate — cover
 * AND life.
 */
export function restFree(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  const mirror = smoothstep01(
    (Math.hypot(u - MIRROR_REST.u, v - MIRROR_REST.v) - MIRROR_REST.radius) / 5,
  );
  const threshold = smoothstep01(
    (Math.hypot(u - THRESHOLD_REST.u, v - THRESHOLD_REST.v) - THRESHOLD_REST.radius) / 4,
  );
  return Math.min(mirror, threshold);
}

/** Strictly-inside test for the region test's exclusion sweep. */
export function insideRest(u: number, v: number): boolean {
  return (
    Math.hypot(u - MIRROR_REST.u, v - MIRROR_REST.v) < MIRROR_REST.radius ||
    Math.hypot(u - THRESHOLD_REST.u, v - THRESHOLD_REST.v) < THRESHOLD_REST.radius
  );
}

// ─── The journey's authored beats ────────────────────────────────────────────

/**
 * The evening pockets: small authored discs in the lee of stone and
 * dune where the T2 understory concentrates — the roads' reveals,
 * spaced 20–40 m. Combe entries ride the channel's own wander; basin
 * entries are absolute spoke coordinates chosen clear of every landmark
 * stand, both rests and every close lens. The flank and rim entries
 * answer MASTER F-R3 before the first sweep asks (rim poses face
 * outward; the three-layer answer lives in the first ~35 m).
 */
export interface EveningPocket {
  readonly u: number;
  readonly v: number;
  readonly radius: number;
}

function combePocket(u: number, dv: number, radius: number): EveningPocket {
  return { u, v: combeChannelCenter(u) + dv, radius };
}

export const EVENING_POCKETS: readonly EveningPocket[] = [
  // Down the Last Shelf and the combe: a beat every 22–36 m.
  { u: 1160, v: 7, radius: 4.5 },
  { u: 1188, v: -6, radius: 4.5 },
  { u: 1216, v: 6, radius: 5 },
  { u: 1242, v: -7, radius: 5 },
  combePocket(1268, 6, 4.5),
  combePocket(1294, -6, 4.5),
  combePocket(1318, 6, 5),
  // The basin rhythm: alternating flanks down the spine road, and
  // side-loop beats toward the pans, the well, the combs, the garden.
  { u: 1344, v: -12, radius: 6 },
  { u: 1368, v: 10, radius: 6 },
  { u: 1392, v: -14, radius: 6 },
  { u: 1424, v: 8, radius: 6.5 },
  { u: 1448, v: -14, radius: 6 },
  { u: 1470, v: 12, radius: 6 },
  { u: 1498, v: -6, radius: 6.5 },
  { u: 1526, v: -16, radius: 6 },
  { u: 1554, v: 8, radius: 6 },
  { u: 1576, v: -14, radius: 6 },
  // The open flanks and the rim-facing bands (F-R3, pre-paid).
  { u: 1352, v: 62, radius: 6.5 },
  { u: 1376, v: -70, radius: 6.5 },
  { u: 1452, v: -66, radius: 6.5 },
  { u: 1462, v: 86, radius: 7 },
  { u: 1508, v: 110, radius: 7 },
  { u: 1520, v: -110, radius: 7 },
  { u: 1560, v: -66, radius: 6.5 },
  { u: 1584, v: 52, radius: 7 },
  { u: 1620, v: 34, radius: 6.5 },
  { u: 1626, v: -40, radius: 6.5 },
  { u: 1330, v: -44, radius: 6 },
  { u: 1338, v: 38, radius: 6 },
] as const;

/**
 * The close poses' camera stations (2–4 m lenses). The cover gates
 * carve a small standing-free hole at each so no blade or frond ever
 * grows into a lens — asserted by the region test.
 */
export const CLOSE_LENSES: readonly { u: number; v: number }[] = [
  { u: 1452.5, v: 39.5 }, // close-pan-rim (the third pan's rim)
  { u: 1400.0, v: 96.0 }, // close-comb-tufts (a comb lee)
  { u: 1514.5, v: 36.5 }, // close-garden-bed (the garden's edge)
  { u: 1586.0, v: 4.0 }, // close-door-foot (the Sun's Door's foot)
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
 * combe's foot, across the Vesper Flats between the pans, past the
 * Procession and the garden's edge to the Sun's Door. The traveller
 * shoal swims it, the Lantern Caravan paces it, the evening pockets
 * flank it, and the stone stands clear of it (spoke coordinates).
 */
export const SPINE_ROAD: readonly (readonly [number, number])[] = [
  [1322, 0],
  [1352, 6],
  [1382, -4],
  // Bent AWAY from the Still Mirror (rest r 12 at (1408, −26)): the
  // caravan's return leg walks 4.5 m off this line and must clear it.
  [1414, -8],
  [1442, 6],
  [1474, 18],
  [1506, 8],
  [1538, -4],
  [1568, -8],
  [1590, -4],
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
 * The wrack drift-lines: shell and wrack runs angled across the roads
 * where the dying wind sets down what it carried — short polylines the
 * debris strands along, one per road chapter.
 */
export const DRIFT_LINES: readonly (readonly (readonly [number, number])[])[] = [
  // Across the Last Shelf at the u ~1196 beat.
  [
    [1190, -10],
    [1197, -2],
    [1204, 6],
  ],
  // The combe's foot, where the pours spill their freight.
  [
    [1326, -10],
    [1334, -2],
    [1342, 8],
  ],
  // A basin trough line riding the swells toward the garden.
  [
    [1488, -26],
    [1500, -20],
    [1512, -15],
  ],
] as const;
