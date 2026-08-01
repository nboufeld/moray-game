import { Group } from "three";
import { SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildBeamAndPool } from "../kit/BeamAndPool";
import { buildDappleSheet } from "../kit/DappleSheet";
import { buildParticulateField } from "../kit/ParticulateField";
import type { KitArea } from "../kit/KitTypes";
import { COURT_ROAD } from "./Golden2Beats";
import { G2_SEEDS } from "./Golden2Shared";
import {
  ARCH_AT,
  CARILLON,
  RIBBON_SPINE,
  gullyChannelCenter,
  worldOf,
} from "./Golden2Terrain";

/**
 * The light of the Carillon Waste — sunlit dream-water, spent where the
 * composition needs it (doctrine rule 4):
 *
 * - **The gold dapple** (the province's signature light, continued from
 *   the Hourglass Sea): honey caustic sheets over the court road and
 *   the seep gardens, at the whisper opacities the golden fill earned
 *   over three rounds — a dapple is a surface, never a pattern.
 * - **THE NOON BELL** — the region's named light peak, and the
 *   Pavement rest's one licensed mark: a great slanted beam striking
 *   the swept circle at the towers' feet, with its cool pool. The
 *   Carillon advertises itself as a column of lit water long before
 *   the towers resolve.
 * - **THE LIGHT WELL** — the Ribbon's drama: three slanted amber
 *   blades falling into the slot at its elbow, pools on the deep
 *   floor. (The Anchorite's Cell keeps one THIN blade — its licensed
 *   light, half the well's opacity.)
 * - **Road beams** — one over the shore-road drift-line, one at the
 *   gully's foot where the court reveals, one through the Great Arch's
 *   window so the swim-through is a doorway of light.
 * - **Seep glints** — a breathing sparkle swarm over the travertine
 *   pools.
 *
 * All additive marks ride the kit's four-part discipline (fog:false,
 * ground fade, edge-on fade, camera-distance fade); updates are
 * closed-form off simulated time.
 */

const SEED = SEEDS.regionGolden2;

export interface Golden2LightBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildGolden2Light(): Golden2LightBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ── The gold dapple ──────────────────────────────────────────────────────
  const roadDapple: KitArea = (() => {
    const polyline: [number, number][] = [];
    for (const [u, v] of COURT_ROAD) {
      const { x, z } = worldOf(u, v);
      polyline.push([x, z]);
    }
    return { polyline, width: 18 };
  })();
  const seepAt = worldOf(972, 72);
  for (const [seed, area, opacity] of [
    [G2_SEEDS.dappleCourt, roadDapple, 0.07],
    [G2_SEEDS.dappleSeep, { center: [seepAt.x, seepAt.z], radius: 34 }, 0.09],
  ] as const) {
    const dapple = buildDappleSheet({
      seed: SEED ^ seed,
      tint: 0xffca6e,
      ground: seabedHeight,
      area: area as KitArea,
      opacity,
      tileMetres: 12,
    });
    groups.push(dapple.group);
    updaters.push((timeSec) => dapple.update(timeSec));
  }

  // ── THE NOON BELL ────────────────────────────────────────────────────────
  const pavement = worldOf(CARILLON.u, CARILLON.v);
  const pavementY = seabedHeight(pavement.x, pavement.z);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ G2_SEEDS.noonBell,
      tint: 0xffe2a0,
      ground: seabedHeight,
      beams: [
        {
          pos: [pavement.x, pavement.z],
          top: pavementY + 26,
          width: 6.5,
          opacity: 0.16,
          slant: [0.05, 0.04],
        },
      ],
      pools: [
        {
          pos: [pavement.x, pavement.z],
          radius: 7.5,
          opacity: 0.2,
        },
      ],
    }).group,
  );

  // ── THE LIGHT WELL ───────────────────────────────────────────────────────
  // Three slanted blades into the Ribbon's elbow, plus the Cell's one
  // thin licensed blade.
  const elbow = RIBBON_SPINE[3]!;
  const wellBeams = [-6, 0, 7].map((du, i) => {
    const { x, z } = worldOf(elbow[0] + du, elbow[1] + du * 0.6);
    return {
      pos: [x, z] as const,
      top: seabedHeight(x, z) + 24 + i * 2,
      width: 2.4 + i * 0.5,
      opacity: 0.13,
      slant: [0.1, 0.06] as const,
    };
  });
  const cellAt = worldOf(962, -78);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ G2_SEEDS.lightWell,
      tint: 0xffd98c,
      ground: seabedHeight,
      beams: [
        ...wellBeams,
        // The Anchorite's Cell: one thin blade, half the well's voice.
        {
          pos: [cellAt.x, cellAt.z],
          top: seabedHeight(cellAt.x, cellAt.z) + 22,
          width: 1.4,
          opacity: 0.07,
        },
      ],
    }).group,
  );

  // ── The road beams ───────────────────────────────────────────────────────
  const driftAt = worldOf(677, gullyChannelCenter(677) - 1);
  const revealAt = worldOf(820, gullyChannelCenter(818) + 2);
  const archAt = worldOf(ARCH_AT.u, ARCH_AT.v);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ G2_SEEDS.roadBeams,
      tint: 0xffd98c,
      ground: seabedHeight,
      beams: [
        {
          pos: [driftAt.x, driftAt.z],
          top: seabedHeight(driftAt.x, driftAt.z) + 9,
          width: 2.6,
          opacity: 0.12,
          slant: [0.08, 0.05],
        },
        {
          pos: [revealAt.x, revealAt.z],
          top: seabedHeight(revealAt.x, revealAt.z) + 11,
          width: 3.0,
          opacity: 0.11,
          slant: [0.06, -0.06],
        },
      ],
    }).group,
  );
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ G2_SEEDS.archBeam,
      tint: 0xffe0a4,
      ground: seabedHeight,
      beams: [
        // Softened in round 2: the r1 quad read as a glowing tree trunk
        // through the arch — lower, narrower, more slanted.
        {
          pos: [archAt.x, archAt.z],
          top: seabedHeight(archAt.x, archAt.z) + 8,
          width: 2.2,
          opacity: 0.09,
          slant: [-0.09, 0.11],
        },
      ],
    }).group,
  );

  // ── The seep glints ──────────────────────────────────────────────────────
  const glints = buildParticulateField({
    seed: SEED ^ G2_SEEDS.seepGlints,
    tint: 0xeafff0,
    count: 90,
    mode: "swarm",
    volume: {
      center: [seepAt.x, seabedHeight(seepAt.x, seepAt.z) + 2.2, seepAt.z],
      size: [64, 6, 64],
    },
    size: 0.15,
    opacity: 0.5,
  });
  groups.push(glints.group);
  updaters.push((timeSec) => glints.update(timeSec));

  return {
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
