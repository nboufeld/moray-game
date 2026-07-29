/**
 * R0 — the world map. FROZEN by the orchestrator: fifteen region slots in
 * five provinces, each province a spoke of three regions chained outward
 * from one gateway wing. Region workers author *inside* their slot's disc
 * (plus its approach tongue); moving a slot moves other workers' work.
 *
 * Geometry: gateway spokes sit on five wing azimuths chosen for even
 * spacing (minimum inter-spoke gap 1.08 rad); depth rings at r = 420, 940
 * and 1460 m keep neighbouring 440 m regions from overlapping at every
 * depth. Each region's disc is ~150,000 m² — several hundred times the
 * whole original playable world — and the mandate in docs/REGIONS.md is
 * that a region is *a game's worth of place*: sub-biomes, landmarks,
 * verticality, its own painted distance. The diver reaches depth 1
 * through the gateway wing's opened end wall and an approach vale the
 * region's own terrain patch authors from r ≈ 48 out to its rim; deeper
 * regions connect province-internally.
 *
 * The fog carries the whole streaming argument: visibility is ~50–100 m,
 * so however many kilometres this table spans, only the region under the
 * diver (and a neighbour at a border) is ever built, attached and drawn.
 */
export interface RegionSlot {
  readonly id: string;
  /** Which province spoke it belongs to, 1-based depth along the spoke. */
  readonly province: string;
  readonly depth: 1 | 2 | 3;
  /** The wing whose end wall opens into this province (depth 1 only). */
  readonly gatewayWingId: string;
  /** Spoke azimuth, in `atan2(z, x)` radians — the gateway wing's own. */
  readonly azimuth: number;
  /** Metres from the world origin to the region's centre. */
  readonly centerR: number;
  /** The authored disc the region owns, in metres. */
  readonly radius: number;
}

const SPOKES: readonly { province: string; wing: string; azimuth: number }[] = [
  { province: "verdant-line", wing: "kelp-cathedral", azimuth: 1.35 },
  { province: "smoking-marches", wing: "vent-springs", azimuth: 2.79 },
  { province: "pale-passage", wing: "ghost-reef", azimuth: 3.87 },
  { province: "great-blue", wing: "open-blue", azimuth: 5.31 },
  { province: "golden-waste", wing: "sandfall-dunes", azimuth: 6.39 },
];

// Ring 1 sits where the two closest spokes (1.08 rad apart) keep their
// 220 m discs a real gap apart: chord 2·445·sin(0.54) ≈ 458 > 440.
const DEPTH_R: readonly [number, number, number] = [445, 940, 1460];
const SLOT_RADIUS = 220;

/** slot id `<province>-<depth>`; regions may carry their own display ids. */
export const REGION_SLOTS: readonly RegionSlot[] = SPOKES.flatMap((spoke) =>
  ([1, 2, 3] as const).map((depth) => ({
    id: `${spoke.province}-${depth}`,
    province: spoke.province,
    depth,
    gatewayWingId: spoke.wing,
    azimuth: spoke.azimuth,
    centerR: DEPTH_R[depth - 1]!,
    radius: SLOT_RADIUS,
  })),
);

const BY_ID = new Map(REGION_SLOTS.map((slot) => [slot.id, slot]));

export function regionSlot(id: string): RegionSlot {
  const slot = BY_ID.get(id);
  if (!slot) {
    throw new Error(`Unknown region slot: ${id}`);
  }
  return slot;
}

/** The wings whose end walls open into a province. */
export const GATEWAY_WING_IDS: ReadonlySet<string> = new Set(SPOKES.map((s) => s.wing));

export function slotCenter(slot: RegionSlot): { x: number; z: number } {
  return {
    x: Math.cos(slot.azimuth) * slot.centerR,
    z: Math.sin(slot.azimuth) * slot.centerR,
  };
}
