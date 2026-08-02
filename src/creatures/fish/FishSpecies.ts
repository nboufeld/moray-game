import { SEEDS } from "../../util/Random";
import type { FishBodyProfile } from "./FishGeometry";

/**
 * The reef's fish community, as data (W-L4).
 *
 * One species used to be every fish in the ocean, at different sizes. This
 * table is what replaced it: five animals told apart by silhouette, colour,
 * size, swim and behaviour, with the population *redistributed* rather than
 * grown — the totals here come to 152 instances against the monoculture's 120,
 * in five draw calls against its one.
 *
 * The depth bands are the design, not an accident of tuning: shoals mid-water,
 * a needle-thin species high against the painted surface, damsels and tangs
 * down at the coral, a wanderer on the floor — so every camera pitch finds
 * life. The palette rule is the fish legibility note from the pivot review:
 * differences are carried in *value* first (a small low-chroma dark shape on a
 * bright turquoise field reads as that field's complement, whatever its hue),
 * and every colour keeps red in it, because taking red out of anything in this
 * water turns it electric.
 */

/** Tail sway, folded into each species' vertex shader as literals. */
export interface SwayProfile {
  /** Beats per unit of simulated time; small fish flick, big fish scull. */
  readonly frequency: number;
  /** Lateral travel of the tail tip, in the body's own units. */
  readonly amplitude: number;
  /** How far forward of the tail tip the sway reaches, along -z. */
  readonly tailLength: number;
}

/** Travelling shoals: the open-water behaviour the fusilier always had. */
export interface ShoalBehaviour {
  readonly kind: "shoal";
  readonly shoalCount: number;
  /** Cruising depth band, in metres. */
  readonly band: readonly [number, number];
  readonly speed: readonly [number, number];
  /** Station half-extents: across, up and along the line of travel. */
  readonly stations: { readonly across: number; readonly up: number; readonly along: number };
  /** Multiplies every station: a tight ball at the low end, a loose drift high. */
  readonly spread: readonly [number, number];
  /** Scales the shoal's heading wander; 1 is the fusilier's, less runs straighter. */
  readonly wander: number;
  /** Scales each fish's weave inside the formation; less swims stiffer. */
  readonly weave: number;
}

/**
 * Anchored groups holding station over the coral gardens.
 *
 * Anchors come from `coralFeedingSites()`, which exists for exactly this
 * package: the reef's `CoralField` is built inside `Reef` and thrown away, so
 * the authored sites are the only way to the gardens without a line in `Reef`
 * and a line in `Game`. Site indices are into that authored list.
 */
export interface HoverBehaviour {
  readonly kind: "hover";
  readonly siteIndices: readonly number[];
  readonly perSite: number;
  /** Horizontal spread of stations around the anchor, in metres. */
  readonly radius: number;
  /** Range of heights above the anchor point (itself coral-head height). */
  readonly lift: readonly [number, number];
  /** How fast the whole group's stations circulate the anchor, rad/s. */
  readonly drift: number;
  /** Per-axis jitter: rate range and amplitude. High and small is a quiver. */
  readonly jitterRate: readonly [number, number];
  readonly jitterAmp: number;
}

/** A solitary animal on an authored low loop over the seabed. */
export interface PatrolRoute {
  readonly x: number;
  readonly z: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  /** Angular rate around the loop, rad/s; with the radii this is cruise speed. */
  readonly rate: number;
  readonly direction: 1 | -1;
}

export interface PatrolBehaviour {
  readonly kind: "patrol";
  readonly routes: readonly PatrolRoute[];
  /** Height held above `seabedHeight` along the loop. */
  readonly clearance: number;
}

export type FishBehaviour = ShoalBehaviour | HoverBehaviour | PatrolBehaviour;

export interface FishSpeciesConfig {
  readonly name: string;
  /** Belly colour; the counter-shading is a 0..1 multiplier under it. */
  readonly color: number;
  /** Instances. For hover this must equal sites × perSite; for patrol, routes. */
  readonly count: number;
  readonly body: FishBodyProfile;
  readonly sway: SwayProfile;
  readonly scale: readonly [number, number];
  /**
   * How large this species may render inside the near field (6m), as a scale
   * ceiling. Insurance against a featureless body filling the lens — the
   * fusilier's measured 0.69 for the shoalers, unlimited for the damsel (whose
   * whole scale range is below any cap) and generous for the wrasse, which is
   * the one fish designed to be looked at from nearby.
   */
  readonly nearScaleCap: number;
  readonly behaviour: FishBehaviour;
  /**
   * PRNG stream. The fusilier keeps `SEEDS.fish` so its thirteen shoals hold
   * the exact tracks every archived capture was composed against; everything
   * new draws a sub-seed from `SEEDS.fishSpecies` in table order.
   */
  readonly seed?: number;
}

/**
 * The community. Order matters twice: the first entry is the `mesh` the
 * probes reach for, and sub-seeds are dealt down the table — appending a
 * species is free, reordering one re-rolls everything below it.
 */
export const FISH_SPECIES: readonly FishSpeciesConfig[] = [
  {
    /**
     * The mid-water shoaler, and largely the animal the whole old file was:
     * same colour, same thirteen shoals from the same seed, same envelope the
     * swim shader is tuned against — the body is the wave-8 re-sculpt at the
     * old proportions (a real snout, a modest sail, the deep fork it always
     * wore), because every archived capture was composed against this animal.
     */
    name: "fusilier",
    color: 0xdfeef2,
    count: 91,
    body: {
      width: 0.5,
      height: 0.75,
      length: 1.9,
      tailTaper: 0.42,
      dorsal: 1.0,
      pectoral: 0.5,
      tail: { reach: 1.55, lobe: 0.95, notch: 1.0 },
      paintSeed: SEEDS.fishBodies ^ 0x0001,
    },
    sway: { frequency: 7.0, amplitude: 0.06, tailLength: 0.42 },
    scale: [0.45, 0.8],
    nearScaleCap: 0.69,
    behaviour: {
      kind: "shoal",
      shoalCount: 13,
      band: [4, 7.2],
      speed: [0.55, 1.05],
      stations: { across: 1.6, up: 0.65, along: 2.0 },
      spread: [0.6, 1.1],
      wander: 1,
      weave: 1,
    },
    seed: SEEDS.fish,
  },
  {
    /**
     * Needle-thin and high against the painted surface, where nothing else in
     * the reef lives. Three small lances of them, strung out along their line
     * of travel, running fast and nearly straight — a needlefish weaving like
     * a fusilier is just a thin fusilier. Value sits near the water's own, so
     * they ghost rather than pop; the silhouette does the reading.
     */
    name: "needlefish",
    color: 0xe2efdc,
    count: 12,
    body: {
      // Longer and leaner than its first cut: the sculpt's whole read is the
      // silhouette, so the lance gets another half body-length and a lower
      // sail — a needle, not a ribbon.
      width: 0.3,
      height: 0.35,
      length: 3.6,
      tailTaper: 0.45,
      dorsal: 0.3,
      pectoral: 0.3,
      tail: { reach: 1.3, lobe: 0.95, notch: 0.95 },
      paintSeed: SEEDS.fishBodies ^ 0x0002,
    },
    sway: { frequency: 8.5, amplitude: 0.035, tailLength: 0.6 },
    scale: [0.55, 0.75],
    nearScaleCap: 0.69,
    behaviour: {
      // Four lances of three rather than three of four, and cruising rather
      // than sprinting: measured with `probe-fish-diversity.mjs`, the first
      // cut ([8.2, 9.6] at 1.15–1.55 m/s) spent most of its time out along
      // the containment rim, beyond the fog range of every canonical camera —
      // 0% presence in shots A and G, which is a species that does not exist.
      // Slower and a half-metre lower, the lances cross the bowl the cameras
      // actually look through.
      kind: "shoal",
      shoalCount: 4,
      band: [7.5, 8.8],
      speed: [0.75, 1.05],
      stations: { across: 0.7, up: 0.22, along: 2.8 },
      spread: [0.8, 1.1],
      wander: 0.5,
      weave: 0.45,
    },
  },
  {
    /**
     * The deep-bodied, laterally flat accent — a tang's silhouette, in the
     * warm apricot-ochre the gouache palette carries and the water cannot: on
     * teal it reads as a warm silhouette at any distance where it reads at
     * all. Small loose groups circulating slowly over four coral gardens,
     * chosen so shots A, B and G each hold one.
     */
    name: "tang",
    color: 0xe8b273,
    count: 16,
    body: {
      // The disc: flattened further and pulled taller, with the sail at half
      // again the authored height — broadside on, the fin *is* the silhouette.
      width: 0.16,
      height: 1.65,
      length: 1.15,
      tailTaper: 0.5,
      dorsal: 1.5,
      pectoral: 0.6,
      tail: { reach: 1.67, lobe: 0.75, notch: 1.05 },
      paintSeed: SEEDS.fishBodies ^ 0x0003,
    },
    sway: { frequency: 3.6, amplitude: 0.045, tailLength: 0.3 },
    scale: [0.5, 0.72],
    nearScaleCap: 0.62,
    behaviour: {
      kind: "hover",
      siteIndices: [0, 1, 3, 5],
      perSite: 4,
      radius: 2.0,
      lift: [-0.2, 1.2],
      drift: 0.07,
      jitterRate: [0.35, 0.8],
      jitterAmp: 0.35,
    },
  },
  {
    /**
     * The tiny damsel, hovering in quivering clouds close over five coral
     * heads. The quiver is the species: high-rate, small-amplitude jitter
     * around a station that barely moves, which no shoaler here does. Its
     * lavender-violet is the water's shadow colour a value down — present in
     * the reef's own palette, and with red above green so it stays a violet
     * rather than sliding electric. (No clownfish here on purpose: those
     * belong to the anemone garden's package.)
     */
    name: "damsel",
    color: 0x8d84c6,
    count: 30,
    body: {
      width: 0.45,
      height: 0.9,
      length: 1.25,
      tailTaper: 0.45,
      dorsal: 0.9,
      pectoral: 0.5,
      tail: { reach: 1.63, lobe: 0.85, notch: 1.0 },
      paintSeed: SEEDS.fishBodies ^ 0x0004,
    },
    sway: { frequency: 11, amplitude: 0.035, tailLength: 0.32 },
    scale: [0.22, 0.34],
    nearScaleCap: 1,
    behaviour: {
      kind: "hover",
      siteIndices: [0, 1, 2, 5, 6],
      perSite: 6,
      radius: 0.85,
      lift: [0.1, 1.0],
      drift: 0.04,
      jitterRate: [2.2, 4.6],
      jitterAmp: 0.13,
    },
  },
  {
    /**
     * The solitary wanderer — a small wrasse silhouette, heavy through the
     * shoulder, patrolling low over the sand in muted terracotta (the coral
     * rust family, so it belongs to the floor it swims over). Three authored
     * loops, one animal each, held clear of the crevice mouths and the
     * approach corridors: a fish cannot fail a sightline test, so the
     * clearance is designed in rather than checked downstream.
     */
    name: "wrasse",
    color: 0xc08a72,
    count: 3,
    body: {
      // Fuller through the shoulder and the rear (the one fish designed to be
      // looked at from nearby): wider, taper eased, a low long sail and a
      // paddle-shallow fork.
      width: 0.62,
      height: 0.75,
      length: 2.5,
      tailTaper: 0.32,
      dorsal: 0.7,
      pectoral: 0.7,
      tail: { reach: 1.6, lobe: 1.1, notch: 1.25 },
      paintSeed: SEEDS.fishBodies ^ 0x0005,
    },
    sway: { frequency: 2.6, amplitude: 0.07, tailLength: 0.55 },
    scale: [1.25, 1.5],
    nearScaleCap: 1.15,
    behaviour: {
      kind: "patrol",
      routes: [
        { x: 9, z: -8, radiusX: 5, radiusZ: 4, rate: 0.14, direction: 1 },
        { x: -15, z: -3, radiusX: 3, radiusZ: 3.5, rate: 0.16, direction: -1 },
        { x: 7, z: 14, radiusX: 3, radiusZ: 3.5, rate: 0.15, direction: 1 },
      ],
      clearance: 0.9,
    },
  },
];
