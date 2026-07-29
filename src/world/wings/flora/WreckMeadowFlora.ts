import { Group } from "three";
import type { WingDef, WingFlora } from "../WingTypes";

/**
 * STUB — owned by the Wreck Meadow's wave-8 worker. Build the story: hull
 * ribs (lathed rock idiom, rust-warm toon tints), a seagrass meadow riding
 * the wing floor, scattered timbers. Scenery only — nothing joins
 * colliders. Draw only from `SEEDS.wingWreckMeadow` (and `^` substreams).
 */
export function buildWreckMeadowFlora(_def: WingDef): WingFlora {
  return { group: new Group() };
}
