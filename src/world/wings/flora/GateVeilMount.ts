import { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildGateVeil, type GateVeilBuild } from "../../regions/kit/GateVeil";
import type { WingDef } from "../WingTypes";

/**
 * Connective-1 (MASTER Batch 1): the gate-veil mount — one shared way for
 * every gateway wing to dress its opened end wall with the kit's
 * `gateVeil` piece, so the doorway frames a PROMISE of the province
 * beyond instead of a flat cut-out onto the backdrop.
 *
 * The contract, per MASTER R2/R3 and the connective plan §3:
 * - the veil stands in the WING (always loaded, wing budget) at the end
 *   wall, r ≈ 48–50 on the wing's own azimuth, facing back down the axis;
 * - its inks are sourced from the region behind the door (the same
 *   palette family as that region's distance rings), so when the region
 *   streams in the veil agrees with it by construction;
 * - its seed is the wing's own stream `^ VEIL_SALT` fed to the kit's
 *   PRIVATE `Random` — the veil consumes nothing from any live stream,
 *   so mounting it can never re-roll existing wing flora
 *   (`tests/wingsConnective1.test.ts` pins that);
 * - everything lives under one named `Group`, so the wing tests that pin
 *   wave-8 content by top-level children keep reading exactly the
 *   children they always read.
 *
 * Budget note per doorway: ≤ 5 draws (≤ 3 planes + 1 column + 1 Points),
 * ~2k triangles — far inside R2's ≤ +10 draws / ≤ 35k tris Tier A
 * ceiling; the measured numbers live in the connective-1 ledger.
 */

export const VEIL_GROUP_NAME = "wing-gate-veil";

/** Fresh substream constant — used by no other wing layer (grep-proved). */
const VEIL_SALT = 0x9a7e;

/** Reduced motion slows the drift to a late-evening breath, kelp's ratio. */
const REDUCED_RATE = 0.3;

export interface GateVeilMountSpec {
  /** Radial station of the doorway sill; default just past the fade. */
  readonly doorR?: number;
  /** Doorway width in metres — the veil planes stack over 1.15–1.85×. */
  readonly width: number;
  /** Doorway height in metres — the skyline band rides 0.7–1.9×. */
  readonly height: number;
  /** Metres added over the carved sill (lets a veil sit up a shelf lip). */
  readonly sillLift?: number;
  /** 2–3 inks of the region behind the door, near → far. */
  readonly palette: readonly number[];
  readonly column?: { readonly tint: number; readonly opacity: number };
  readonly particulate?: { readonly tint: number; readonly count: number };
}

export interface GateVeilMount {
  /** One group named {@link VEIL_GROUP_NAME}; add it after existing draws. */
  readonly group: Group;
  readonly build: GateVeilBuild;
  /** Forward from `WingFlora.update`; accumulates its own simulated time. */
  update(dt: number, reducedMotion: boolean): void;
}

export function mountGateVeil(def: WingDef, spec: GateVeilMountSpec): GateVeilMount {
  const doorR = spec.doorR ?? 48.6;
  const doorX = Math.cos(def.azimuth) * doorR;
  const doorZ = Math.sin(def.azimuth) * doorR;
  const doorY = seabedHeight(doorX, doorZ) + (spec.sillLift ?? 0);

  // The doorway's outward normal points back toward the wing (the bowl):
  // sin(facing) = -cos(azimuth), cos(facing) = -sin(azimuth), so the veil
  // planes recede along +azimuth — into the province behind the door.
  const facing = Math.atan2(-Math.cos(def.azimuth), -Math.sin(def.azimuth));

  const build = buildGateVeil({
    seed: (SEEDS[def.seedKey] ^ VEIL_SALT) >>> 0,
    doorway: {
      pos: [doorX, doorY, doorZ],
      facing,
      width: spec.width,
      height: spec.height,
    },
    palette: spec.palette,
    column: spec.column,
    particulate: spec.particulate,
  });

  const group = new Group();
  group.name = VEIL_GROUP_NAME;
  group.add(build.group);

  let time = 0;
  return {
    group,
    build,
    update(dt: number, reducedMotion: boolean): void {
      time += dt * (reducedMotion ? REDUCED_RATE : 1);
      build.update(time);
    },
  };
}
