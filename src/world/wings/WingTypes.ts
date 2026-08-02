import type { Group, Object3D } from "three";
import type { ContactPatch } from "../Seabed";
import type { SEEDS } from "../../util/Random";

/**
 * Wave 8: the wings. The twilight canyon (W-M3) proved a pattern — a seeded
 * azimuth through the rim, a carved wedge beyond it, a positional mood over
 * it, an airspace annex inside it — and the wings are that pattern stated as
 * data, sixteen times over, so fifteen new places can be authored in
 * parallel without fifteen hands in `Seabed`, `UnderwaterFog`, `Lighting`
 * and `Reef` at once.
 *
 * A wing's *geometry* (azimuth, wedge, radial envelope, depths) is FROZEN by
 * the orchestrator: dens, creatures and flora in other packages compute
 * positions from these numbers, so moving one moves work that is not yours.
 * A wing's *mood tables* and *palette* belong to the wing's owner and may be
 * tuned freely — they modulate per-frame state, never draw order.
 */

/** The radial envelope and depths of one wing's carve. */
export interface WingCarve {
  /** Radius where the carve begins easing in (the rim's inner shoulder). */
  readonly carveFrom: number;
  /** Radius where the carve reaches full weight. */
  readonly carveFull: number;
  /** Radius where the carve begins easing back out. */
  readonly fadeFrom: number;
  /** Radius where the carve is exactly zero again. */
  readonly carveEnd: number;
  /** Depth (metres, signed) at the sill — the saddle through the rim. */
  readonly sillDepth: number;
  /** Depth (metres, signed) of the wing's floor. Positive floors rise. */
  readonly floorDepth: number;
  /** Radial band over which the sill descends (or climbs) to the floor. */
  readonly shelfFrom: number;
  readonly shelfTo: number;
  /** Hand-depth seeded detail amplitude on the wing floor, in metres. */
  readonly detailAmplitude: number;
}

/** The wedge, in radians either side of the wing's axis. */
export interface WingWedge {
  /** Flat floor band half-angle at the gate. */
  readonly floorHalf: number;
  /** Wall half-angle at the gate (rim radius). */
  readonly gateHalf: number;
  /** Wall half-angle at the carve's end — wings widen past the doorway. */
  readonly endHalf: number;
}

/**
 * What the wing's mood does to the water when it is not zero — the same
 * shape as `ABYSS_FOG` / `ABYSS_LIGHT`, so the composition rule ("weather
 * scales the base, place modulates the scaled base") carries over verbatim.
 * Scales above 1 and negative shares are allowed: a shallows wing may
 * *brighten* and *clear* the water rather than darken it.
 */
export interface WingMoodTables {
  readonly fog: {
    /** Per-channel scale on the live base fog colour at full mood. */
    readonly colorScale: readonly [number, number, number];
    /** Added to the base density at full mood; negative clears the water. */
    readonly densityGain: number;
    /** Fraction of the backdrop's level given up at full mood. */
    readonly backdropFade: number;
  };
  readonly light: {
    /** Share of each light taken at full mood; negative brightens. */
    readonly sun: number;
    readonly hemisphere: number;
    readonly ambient: number;
  };
}

export interface WingDef {
  /** Stable id; also the key into the flora registry and the design doc. */
  readonly id: string;
  /** The name the design doc and the ledger call it. */
  readonly title: string;
  /** One line of intent — the emotion the place is built to carry. */
  readonly emotion: string;
  /** The wing's axis azimuth, in `atan2(z, x)` radians. FROZEN. */
  readonly azimuth: number;
  readonly carve: WingCarve;
  readonly wedge: WingWedge;
  readonly mood: WingMoodTables;
  /**
   * The y below which the mood begins, and the metres of descent over which
   * it eases in — shallow bright wings use a high surface so the mood is on
   * at swim height; deep wings ease in like the canyon does.
   */
  readonly moodSurface: number;
  readonly moodDescent: number;
  /** Ceiling at the gate and at the wing's heart (eased between). */
  readonly ceilingAtGate: number;
  readonly ceilingInside: number;
  /** Metres of collision clearance kept over the wing's ground. */
  readonly floorClearance: number;
  /** The wing's own flora seed, pre-registered in `SEEDS`. */
  readonly seedKey: keyof typeof SEEDS;
  /**
   * Optional wall paint, the `canyonStrata` pattern generalised: per-channel
   * multipliers on the seabed's baked vertex colours, or null wherever the
   * wing owns nothing. `blend` is the wing's carve weight at the point, so
   * identity at the wedge edge is the caller's contract to keep.
   */
  readonly paint?: (
    x: number,
    z: number,
    y: number,
    blend: number,
  ) => readonly [number, number, number] | null;
}

/** What a wing's flora module hands back to the reef. */
export interface WingFlora {
  readonly group: Group | Object3D;
  /** Contact patches to join the seabed's occlusion bake. */
  readonly contacts?: readonly ContactPatch[];
  /** Per-frame sway; `Reef.update` forwards its own two numbers. */
  update?(dt: number, reducedMotion: boolean): void;
}

export type WingFloraBuilder = (def: WingDef) => WingFlora;
