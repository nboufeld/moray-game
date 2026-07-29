/**
 * A tiny seeded PRNG (mulberry32). The reef, its grass, the fish and the
 * caustics pattern are all scattered procedurally, so without a fixed seed the
 * scene is different on every load and no two screenshots can be compared.
 * Art-direction review needs the same reef every time.
 */
export class Random {
  private state: number;

  constructor(seed: number) {
    // A zero state would lock the generator on a constant.
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform in [-magnitude, +magnitude). */
  signed(magnitude: number): number {
    return this.range(-magnitude, magnitude);
  }
}

/**
 * Distinct constants per subsystem so that reseeding or re-tuning one of them
 * does not shuffle the others out from under a screenshot comparison.
 */
export const SEEDS = {
  reef: 0x5eed_1eaf,
  grass: 0x6a55_3f21,
  coral: 0xc042_11ee,
  fish: 0x0f15_4001,
  motes: 0x3a17_7e5c,
  bubbles: 0x3a17_7e5d,
  caustics: 0xca05_71c5,
  shafts: 0x5eab_ea11,
  fogDither: 0xd177_be71,
  sand: 0x5a4d_0001,
  rock: 0x5a4d_0002,
  coralSkin: 0x5a4d_0003,
  grassBlade: 0x5a4d_0004,
  pinnacle: 0x5a4d_0005,
  cave: 0x5a4d_0006,
  /** The paper the finished frame is printed on; see `ColorGradeShader`. */
  paperGrain: 0x5a4d_0007,
  // The sanctuary dresses its own set from the same generators as the reef, so
  // it takes its own streams: sharing the reef's would put the reef's meadow
  // and its bommies in the aquarium, and re-tuning one room would re-roll the
  // other out from under a screenshot comparison.
  sanctuaryRock: 0x5a4d_0101,
  sanctuaryCoral: 0x5a4d_0102,
  sanctuaryGrass: 0x5a4d_0103,
  sanctuaryMotes: 0x5a4d_0104,
  sanctuaryBubbles: 0x5a4d_0106,
  sanctuaryShafts: 0x5a4d_0105,
  // The soundscape synthesises its noise the same way the reef scatters its
  // rocks: from a fixed stream, so the ambience bed and the reverb tail are
  // the same waveform on every load and a re-tune is a change anyone can hear
  // against the version before it.
  audioBed: 0x5a4d_0201,
  /** When a bubble happens, kept apart from what it sounds like. */
  audioBubbles: 0x5a4d_0202,
  audioBubbleVoice: 0x5a4d_0203,
  audioReverb: 0x5a4d_0204,
  /** The grain inside a life event's noise — a crab's tick, a turtle's swell. */
  audioLife: 0x5a4d_0205,
  // The life systems. Each population takes its own stream for the same reason
  // the two rooms do: these are filled in one at a time over several packages,
  // and a shared stream would re-roll every animal already placed each time
  // another one is added — which no screenshot comparison could survive.
  crabs: 0x5a4d_0301,
  starfish: 0x5a4d_0302,
  urchins: 0x5a4d_0303,
  anemones: 0x5a4d_0304,
  /** Who visits, and when. The three visitors share it; the schedule owns it. */
  visitors: 0x5a4d_0305,
  sandPuffs: 0x5a4d_0306,
  // Round L's geometry. The reef's shapes and its big vegetation are re-rolled
  // far more often than the layout they stand in, so they take their own
  // streams: re-profiling a boulder must not move a blade of grass, and adding
  // a kelp clump must not move a rock.
  /** The hollows and swells laid over the seabed's sines; see `Seabed`. */
  seabedRelief: 0x5a4d_0401,
  /** The radial roughing on every lathed archetype; see `RockShapes`. */
  rockShapes: 0x5a4d_0402,
  /** Where the kelp forest stands and how each stalk grows. */
  kelp: 0x5a4d_0403,
  // Wave 3's populations. Same isolation argument as the life systems above:
  // each package fills its stream independently, and none may re-roll another.
  /** Species assignment, palettes, and paths for the diversified fish. */
  fishSpecies: 0x5a4d_0501,
  /** The clownfish pair living in the anemone garden; theirs, not the fish's. */
  clownfish: 0x5a4d_0502,
  /** Cleaner shrimp at the coral feeding sites. */
  shrimp: 0x5a4d_0503,
  /** How each den mouth is dressed and posed at its hiding spot. */
  denDressing: 0x5a4d_0504,
  /** The jelly bloom's drift; the schedule stays on `visitors`. */
  jellyBloom: 0x5a4d_0505,
  /** The turtle's and the ray's own path shapes, apart from when they come. */
  turtlePath: 0x5a4d_0506,
  rayPath: 0x5a4d_0507,
  // Wave 4. The bowl's new bones and its bigger flora, and the morays' moods,
  // each on their own stream for the same reroll-isolation reason as above.
  /** The rim ridge and shelves that turn the plate into an amphitheatre. */
  bowlRim: 0x5a4d_0601,
  /** The painted far-reef silhouette layers beyond the rim. */
  distantReef: 0x5a4d_0602,
  /** Seaweed bushes, drooping fronds, and other new flora accents. */
  seaweed: 0x5a4d_0603,
  /** Per-moray temperament and presence-cycle phase. */
  morayPresence: 0x5a4d_0604,
  // W-L8: the sanctuary's own life. Two streams, not one, for the standing
  // reason: the shoal and the bells are tuned separately, and a count change
  // in one must not re-roll the other out from under shots E and S.
  /** The sanctuary's slow fusilier shoal. */
  sanctuaryFish: 0x5a4d_0605,
  /** The bells drifting high across the sanctuary's water. */
  sanctuaryJellies: 0x5a4d_0606,
  // Wave 5. The world past the rim, the weather over it, and who the morays
  // are — the same stream-per-package isolation as every wave before.
  /** The canyon's carve: the gate azimuth, the shelf, the twilight floor. */
  abyss: 0x5a4d_0701,
  /** What grows down there, apart from where "down there" is. */
  abyssFlora: 0x5a4d_0702,
  /** The fifth den's dressing and pose. */
  abyssDen: 0x5a4d_0703,
  /** Species personality expression — flourishes, pacing, idiosyncrasy. */
  personality: 0x5a4d_0704,
  /** The sky's slow moods; which weather drifts in, and when. */
  weather: 0x5a4d_0705,
  // Wave 6, the critic's round. Painting what already exists, so new streams
  // only where new elements are placed; retunes stay on their owners' streams.
  /** The canyon's light story: shafts, motes, and wall strata accents. */
  canyonPaint: 0x5a4d_0801,
  /** The kelp forest's overhead canopy pads and extra strap fills. */
  kelpCanopy: 0x5a4d_0802,
  /** Low colour framing the spawn corridor's first metres. */
  corridorDressing: 0x5a4d_0803,
  // Wave 8: the great expansion. Every stream below is pre-registered by the
  // orchestrator before the worker wave launches — the standing convention
  // for parallel work, so no two packages ever contend for this file. One
  // stream per wing's flora, one per mythic creature, one per upgraded
  // population. Substreams via `SEEDS.foo ^ constant` as always.
  /** The sixteen wings' flora, one stream each, in registry order. */
  wingKelpCathedral: 0x5a4d_0901,
  wingNurseryShallows: 0x5a4d_0902,
  wingLumenGarden: 0x5a4d_0903,
  wingWreckMeadow: 0x5a4d_0904,
  wingVentSprings: 0x5a4d_0905,
  wingMoonlitLagoon: 0x5a4d_0906,
  wingGlassCove: 0x5a4d_0907,
  wingGhostReef: 0x5a4d_0908,
  wingCurrentRun: 0x5a4d_0909,
  wingRuinsTerrace: 0x5a4d_090a,
  wingMangroveRoots: 0x5a4d_090b,
  wingOpenBlue: 0x5a4d_090c,
  wingIceGrotto: 0x5a4d_090d,
  wingSargassumSky: 0x5a4d_090e,
  wingSandfallDunes: 0x5a4d_090f,
  /** The wing dens' dressing and pose, one stream in `WING_DENS` order. */
  wingDens: 0x5a4d_0910,
  /** Wing gate dressing shared machinery (jamb stones, thresholds). */
  wingGates: 0x5a4d_0911,
  /** The mythic creatures, one stream each. */
  mythSerpent: 0x5a4d_0a01,
  mythSovereign: 0x5a4d_0a02,
  mythKirin: 0x5a4d_0a03,
  mythUmibozu: 0x5a4d_0a04,
  mythKraken: 0x5a4d_0a05,
  mythMoonKoi: 0x5a4d_0a06,
  mythLeviathan: 0x5a4d_0a07,
  mythElder: 0x5a4d_0a08,
  /** Wave 8's four new moray species: patterns, presence phase, dressing. */
  morayWave8: 0x5a4d_0b01,
  /** The seagrass upgrade: taller meadows and standing bushes. */
  bushes: 0x5a4d_0b02,
  tallGrass: 0x5a4d_0b03,
  /** The anemone garden regrown grand, and its clownfish grown legible. */
  anemonesGrand: 0x5a4d_0b04,
  clownfishGrand: 0x5a4d_0b05,
  /** The fish community's re-sculpted bodies. */
  fishBodies: 0x5a4d_0b06,
  /** The crabs' sculpted upgrade. */
  crabsGrand: 0x5a4d_0b07,
  /** The sanctuary's widened lane fan. */
  sanctuaryLanes: 0x5a4d_0b08,
  /** The coral kinds that graduate from procedural to sculpted GLBs. */
  coralGrand: 0x5a4d_0b09,
  /** Starfish and urchin polish. */
  starfishGrand: 0x5a4d_0b0a,
  urchinsGrand: 0x5a4d_0b0b,
  // R0: the streamed provinces — one stream per region slot, pre-registered
  // before any region worker launches, in slot order (five spokes × three
  // depths). A region's whole interior draws from its one stream and its
  // `^` substreams; nothing about build timing can touch draw order because
  // no two regions share a stream.
  regionVerdant1: 0x5a4d_0c01,
  regionVerdant2: 0x5a4d_0c02,
  regionVerdant3: 0x5a4d_0c03,
  regionSmoking1: 0x5a4d_0c04,
  regionSmoking2: 0x5a4d_0c05,
  regionSmoking3: 0x5a4d_0c06,
  regionPale1: 0x5a4d_0c07,
  regionPale2: 0x5a4d_0c08,
  regionPale3: 0x5a4d_0c09,
  regionBlue1: 0x5a4d_0c0a,
  regionBlue2: 0x5a4d_0c0b,
  regionBlue3: 0x5a4d_0c0c,
  regionGolden1: 0x5a4d_0c0d,
  regionGolden2: 0x5a4d_0c0e,
  regionGolden3: 0x5a4d_0c0f,
  /** The texture atelier's repaint passes (R2+ quality uplift). */
  atelier: 0x5a4d_0c10,
} as const;
