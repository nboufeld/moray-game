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
  // W6's four, in `MORAY_SPECIES` append order (the dressing stream draws in
  // this order). All at r = 41: inside the r ≤ 44 end-wall margin, on the
  // flat floor band the environment workers keep clear (|across| ≤ 0.025 of
  // the corridor's ±0.06), head heights against the bowl's ~1.3 / the
  // abyss's 1.5 — a low peek for the tiny one, a full arch for the robust.
  // Facing defaults to back up the wing toward the gate; the small offsets
  // only turn the head a few degrees off the corridor axis so the four dens
  // are not the same pose four times.
  { speciesId: "golden-dwarf-moray", wingId: "nursery-shallows", r: 41, across: -0.02, headAbove: 1.3, facingOffset: 0.06 },
  { speciesId: "frost-moray", wingId: "ice-grotto", r: 41, across: 0.025, headAbove: 1.5, facingOffset: -0.05 },
  { speciesId: "ember-moray", wingId: "vent-springs", r: 41, across: -0.025, headAbove: 1.4, facingOffset: 0.05 },
  { speciesId: "pearl-moray", wingId: "ghost-reef", r: 41, across: 0.02, headAbove: 1.35, facingOffset: -0.07 },
];
