/**
 * Where the wave-8 morays live — owned by the new-morays worker (W6), the
 * way `ABYSS_DEN` is owned by `Abyss.ts`. Positions are wing-relative so
 * they ride the FROZEN wing geometry: `r` metres out along the wing's axis,
 * `across` radians off it, head `headAbove` metres over the carved ground.
 * The reef resolves them against `seabedHeight` at construction and dresses
 * them from `SEEDS.wingDens` in array order — append-only, never reorder.
 *
 * Keep every den inside its wing's floor band (|across| < 0.06 keeps the
 * approach corridor on the flat) and short of the end wall (r ≤ 44). Every
 * den added here MUST ship with: a `MORAY_SPECIES` config (same package), a
 * personality, and a sightline test mirroring `reefSightlines.test.ts`'s
 * abyss-den pattern.
 */
export interface WingDenSpec {
  readonly speciesId: string;
  /** Which wing's floor it sits on; must match a `WINGS` id. */
  readonly wingId: string;
  /** Metres from the world origin along the wing's axis. */
  readonly r: number;
  /** Radians off the wing's axis. */
  readonly across: number;
  /** Metres the head peeks above the local carved floor. */
  readonly headAbove: number;
  /** Radians added to "facing back up the wing toward the gate". */
  readonly facingOffset: number;
}

export const WING_DENS: readonly WingDenSpec[] = [
  // W6 fills this in. Empty at scaffold time: zero dens, zero draws.
];
