import type { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBeamAndPool } from "../kit/BeamAndPool";
import { SKIFF_REST } from "./Blue2Beats";
import { B2_SEEDS } from "./Blue2Shared";
import { MOON_WELL, worldOf } from "./Blue2Terrain";

/**
 * The light of the Deep Steps — spent the way this province spends
 * everything: rarely, and all at once. The saddle's high milk needs no
 * marks (the mood carries it); below the Brink the water darkens shelf
 * by shelf, and the region's few lights EARN the dark around them
 * (doctrine rule 4, the dark-register clause):
 *
 * - **THE MOON WELL** — the named light peak, and the Round rest's one
 *   licensed light: a single colossal moonlight beam falling the whole
 *   54 m of the deep water column onto its painted pale circle — a
 *   spotlight on an empty stage, the Gentle Dark crossing it once a
 *   round. Cool, not cold: this is the Great Blue's own silver (the
 *   MASTER register rule — nothing here may burn Calamity-cold).
 * - **The Brink beam** — one shaft at the Stairfall's foot, marking
 *   the descent's landing the way a door marks a house.
 * - **The Pharos' blade** — thin light on the lone waymark, the
 *   Othershore hush's one licensed mark.
 * - **The Skiff's lantern** — the secret's own thin finder.
 *
 * All marks ride the kit's four-part additive discipline (fog:false,
 * ground fade, edge-on fade, camera-distance fade dead by ~120 m).
 */

const SEED = SEEDS.regionBlue2;

export interface Blue2LightBuild {
  readonly groups: Group[];
}

export function buildBlue2Light(): Blue2LightBuild {
  const groups: Group[] = [];

  // ── THE MOON WELL ────────────────────────────────────────────────────────
  const well = worldOf(MOON_WELL.u, MOON_WELL.v);
  const wellY = seabedHeight(well.x, well.z);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ B2_SEEDS.moonWell,
      tint: 0xdce8f2,
      ground: seabedHeight,
      beams: [
        {
          pos: [well.x, well.z],
          top: wellY + 52,
          width: 7,
          opacity: 0.17,
          slant: [0.03, 0.05],
        },
      ],
      pools: [
        {
          pos: [well.x, well.z],
          radius: MOON_WELL.radius,
          opacity: 0.2,
        },
      ],
    }).group,
  );

  // ── The Brink beam ───────────────────────────────────────────────────────
  const brink = worldOf(797, 2);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ B2_SEEDS.brinkBeam,
      tint: 0xd8e6e6,
      ground: seabedHeight,
      beams: [
        {
          pos: [brink.x, brink.z],
          top: seabedHeight(brink.x, brink.z) + 16,
          width: 3,
          opacity: 0.11,
          slant: [0.07, 0.05],
        },
      ],
    }).group,
  );

  // ── The Pharos' blade + the Skiff's lantern ──────────────────────────────
  const pharos = worldOf(693.5, 9.5);
  const skiff = worldOf(SKIFF_REST.u, SKIFF_REST.v);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ B2_SEEDS.pharosBlade,
      tint: 0xe2ecee,
      ground: seabedHeight,
      beams: [
        {
          pos: [pharos.x, pharos.z],
          top: seabedHeight(pharos.x, pharos.z) + 12,
          width: 1.6,
          opacity: 0.08,
        },
        {
          pos: [skiff.x, skiff.z],
          top: seabedHeight(skiff.x, skiff.z) + 11,
          width: 1.5,
          opacity: 0.08,
          slant: [0.05, -0.04],
        },
      ],
    }).group,
  );

  return { groups };
}
