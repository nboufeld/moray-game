import { Group } from "three";
import type { WingDef, WingFlora } from "../WingTypes";

/**
 * STUB — owned by the Lumen Garden's wave-8 worker. Build the glow: bio-
 * luminescent polyp beds, lantern kelp, mote constellations (emissive
 * materials; the wing's light tables already take the sun away). Draw only
 * from `SEEDS.wingLumenGarden` (and `^` substreams).
 */
export function buildLumenGardenFlora(_def: WingDef): WingFlora {
  return { group: new Group() };
}
