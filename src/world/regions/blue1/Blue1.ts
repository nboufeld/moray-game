import { Group, Vector3 } from "three";
import type { SphereCollider } from "../../CollisionField";
import type { RegionBuild, RegionCapturePose, RegionDef } from "../RegionTypes";
import { buildBlue1Distance } from "./Blue1Distance";
import { FERRYMAN_SPECIES_ID, buildFerryman } from "./Blue1Ferryman";
import { buildBlue1Fill } from "./Blue1Fill";
import { buildBlue1Ground } from "./Blue1Ground";
import { buildBlue1Life } from "./Blue1Life";
import { buildBlue1Light } from "./Blue1Light";
import { buildBlue1Steppe } from "./Blue1Steppe";
import { buildBlue1Stones } from "./Blue1Stones";
import {
  BLUE1_SLOT,
  CENTER_X,
  CENTER_Z,
  SEAL_RC,
  SLOPE_TO,
  blue1Ceiling,
  blue1TerrainTarget,
  blue1Weight,
  slopeFloor,
  spokeOf,
  tongueHalfWidth,
  worldOf,
} from "./Blue1Terrain";

/**
 * THE DROP PLAINS — region `great-blue-1`, province The Great Blue.
 *
 * The Open Blue wing was the lip of vertigo; this is the country past it:
 * the great blue steppe before the true abyss. Its subject is space
 * itself — vastness composed, not emptiness neglected. The Long Slope
 * glides down out of the wing while the last reef colour falls away
 * behind; the Seagrass Steppe rolls its blue-green swells layer after
 * layer into the fog; the Standing Stones each hold their own hundred
 * metres of prairie, one of them keeping a secret at its foot; the
 * Migration Line crosses the whole region mid-water, a permanent river
 * of silver; the Terraces step the floor down a value at a time; and at
 * the World's Edge the floor simply ends — the drop past −46, the high
 * ceiling, the Ferryman working the void, the painted deep beyond.
 *
 * Pure half in `Blue1Terrain`; built half in the sibling modules. Every
 * stream is `SEEDS.regionBlue1` or a `^` substream.
 */

// ─── The domain seals ────────────────────────────────────────────────────────
//
// The collision handover loses the diver the moment they reach weight = 0,
// so every open edge is walled inside the weight-1 core, where the annex
// floor (`terrainTarget + clearance`) and the composed ground are the
// same function — the honesty that matters most here, forty-six metres
// down. The ring at rc = 164 seals the disc (the ceiling has closed to
// floor + 3 there); the slope's flanks take stacked rows because the
// glide's water column is up to twenty-five metres tall; the doorway and
// the ring's corridor gap take dense gate stacks.

function buildSeals(): SphereCollider[] {
  const seals: SphereCollider[] = [];

  // The rim ring, gapped over the corridor's spine.
  const count = 92;
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const x = CENTER_X + Math.cos(theta) * SEAL_RC;
    const z = CENTER_Z + Math.sin(theta) * SEAL_RC;
    const { v } = spokeOf(x, z);
    if (Math.abs(v) < 20 && Math.cos(theta - (BLUE1_SLOT.azimuth + Math.PI)) > 0) {
      continue;
    }
    seals.push({
      center: new Vector3(x, blue1TerrainTarget(x, z) + 1.5, z),
      radius: 9,
    });
  }

  // The doorway stacks at the wing seam: a tight door is what a doorway
  // is, and the wing's own walls carry everything below r ≈ 50.
  for (const u of [50, 56, 62]) {
    const lateral = tongueHalfWidth(u) - 0.5;
    const floor = slopeFloor(u);
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * lateral);
      for (const level of [2, 8.5, 15, 21]) {
        seals.push({ center: new Vector3(x, floor + level, z), radius: 4.5 });
      }
    }
  }

  // The slope's flank rows: three levels per station because the glide's
  // ceiling starts high at the seam; levels above the local ceiling are
  // skipped as the glide takes the column down.
  for (let u = 62; u <= 296; u += 13) {
    const lateral = tongueHalfWidth(u) - 4;
    for (const side of [-1, 1]) {
      const { x, z } = worldOf(u, side * lateral);
      const floor = blue1TerrainTarget(x, z);
      const ceiling = blue1Ceiling(x, z);
      for (const level of [4, 11.5, 19]) {
        if (floor + level - 6 > ceiling) {
          continue;
        }
        seals.push({ center: new Vector3(x, floor + level, z), radius: 6.2 });
      }
    }
  }

  // The gate posts where the ring's gap meets the corridor: the ceiling
  // is only half-closed across the gap's shoulders, so the posts carry
  // the upper half of those columns.
  for (const u of [276, 286, 296]) {
    for (const side of [-1, 1]) {
      for (const lateral of [21, 27.5]) {
        const { x, z } = worldOf(u, side * lateral);
        const floor = blue1TerrainTarget(x, z);
        for (const level of [4, 10]) {
          seals.push({ center: new Vector3(x, floor + level, z), radius: 5 });
        }
      }
    }
  }

  return seals;
}

// ─── The capture poses ───────────────────────────────────────────────────────

/** Camera yaw that looks from one point toward another (yaw 0 faces −z). */
function yawToward(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

interface PoseSpec {
  readonly name: string;
  readonly u: number;
  readonly v: number;
  /** Metres above the composed ground at the pose's own feet. */
  readonly lift: number;
  readonly atU: number;
  readonly atV: number;
  readonly pitch: number;
  readonly settle?: number;
  /** Absolute y instead of ground-relative, for the deep-water poses. */
  readonly absoluteY?: number;
}

const POSE_SPECS: readonly PoseSpec[] = [
  // The glide: shoulders, waymarks, the blue opening ahead.
  { name: "slope-glide", u: 108, v: 2, lift: 2.6, atU: 168, atV: 6, pitch: -0.02 },
  // The reveal: the steppe opening, stones ghosting, the band glinting.
  { name: "slope-reveal", u: 288, v: 0, lift: 3.2, atU: 352, atV: 30, pitch: -0.04, settle: 4 },
  // The prairie: grass foreground, swell layers, a stone in the fog.
  { name: "steppe-sea", u: 352, v: -34, lift: 2.4, atU: 415, atV: 58, pitch: 0.03 },
  // The Gnomon, close and low: the tallest stone in the province.
  { name: "gnomon", u: 407, v: 50, lift: 2.2, atU: 416, atV: 58, pitch: 0.32 },
  // The Fallen King's secret: the ring, the beam, the toppled crown.
  { name: "fallen-king", u: 377, v: -104, lift: 2.0, atU: 383.5, atV: -100, pitch: -0.06, settle: 5 },
  // The Sisters framing the run toward the Edge. Round 4: the old stand
  // (461,-44 aiming 520,-8) put both stones outside the right frame edge;
  // this one shoots *through* the near-arch toward the Prow.
  { name: "sisters-frame", u: 451, v: -70, lift: 2.6, atU: 545, atV: 4, pitch: 0.02 },
  // Under the Migration Line, looking along the silver. Fill round 2:
  // lifted two metres closer to the band — at lift 4.5 the fish fogged
  // to faint petals thirty metres up.
  { name: "migration-river", u: 442, v: 46, lift: 6.5, atU: 481, atV: 76, pitch: 0.12, settle: 6 },
  // The Terrace Stairs: three shelves stepping down into deeper value.
  { name: "terrace-stairs", u: 462, v: 18, lift: 3.4, atU: 540, atV: 0, pitch: -0.08 },
  // The Prow: the Friedrich overlook — the drop, the deep steps beyond.
  // Round 4: stepped left and up (the audit's re-stage) so the slab juts
  // across the lower-right third instead of filling the frame's centre.
  { name: "the-prow", u: 540, v: 7, lift: 3.4, atU: 600, atV: -2, pitch: -0.16, settle: 5 },
  // Down inside the void, against the cliff, the painted deep ahead.
  { name: "under-blue", u: 556, v: -20, lift: 0, absoluteY: -38, atU: 606, atV: -8, pitch: 0.06 },
  // The Ferryman working the edge; the aim rides beside the anchor so the
  // settle frames the patrol without completing the discovery plate.
  // Round 4: the stand moved in — at thirty metres in the deep mood the
  // animal fogged into an illegible blue mass behind the arcs.
  { name: "ferryman", u: 566, v: 20, lift: 0, absoluteY: -25, atU: 577, atV: 2, pitch: -0.04, settle: 8 },
  // From the lip, back across everything: terraces, stones, steppe.
  { name: "edge-lookback", u: 548, v: -8, lift: 2.4, atU: 445, atV: -14, pitch: 0.06 },
  // ── The fill's poses (appended after every existing pose). ──
  // Down the three Wayline stones toward the World's Edge — the region's
  // one drawn road, walked. Round 2: stepped back behind the first stone
  // so all three read in file (from u 470 only one stood in frame).
  { name: "wayline-walk", u: 450, v: 14, lift: 2.6, atU: 492, atV: 6, pitch: -0.02, settle: 3 },
  // The scheduled spectacle: the Ferryman arriving at the Prow crossing
  // while the migration dips over the edge beside it. Round 2: swung
  // right — the first stand caught a floating monolith card (fixed in
  // Blue1Distance) and too little of the dip.
  { name: "ferryman-crossing", u: 549, v: 20, lift: 0, absoluteY: -19, atU: 575, atV: -6, pitch: -0.05, settle: 8 },
  // The four close poses (camera 2–4 m — the owner's judged distance):
  // the sward with its three grass tiers…
  { name: "close-steppe-sward", u: 356, v: 10, lift: 1.5, atU: 359, atV: 12, pitch: -0.15, settle: 3 },
  // …a wind-combed crest bed…
  { name: "close-crest-bed", u: 330, v: -24, lift: 1.5, atU: 336, atV: -22, pitch: -0.12, settle: 3 },
  // …the Gnomon's collar (apron, calves, whelks, the stone rising out of
  // frame)…
  { name: "close-collar", u: 411.5, v: 54.5, lift: 1.6, atU: 414.3, atV: 57.4, pitch: -0.2, settle: 3 },
  // …and a waymark cluster on the slope's shoulder gravel.
  { name: "close-slope-road", u: 157, v: -10, lift: 1.6, atU: 160.1, atV: -13.6, pitch: -0.18, settle: 3 },
];

function buildPoses(): RegionCapturePose[] {
  return POSE_SPECS.map((spec) => {
    const { x, z } = worldOf(spec.u, spec.v);
    const y = spec.absoluteY ?? blue1TerrainTarget(x, z) + spec.lift;
    const at = worldOf(spec.atU, spec.atV);
    return {
      name: spec.name,
      position: [x, y, z] as const,
      yaw: yawToward(x, z, at.x, at.z),
      pitch: spec.pitch,
      settle: spec.settle ?? 2.5,
    };
  });
}

// ─── The def ─────────────────────────────────────────────────────────────────

export const BLUE_1: RegionDef = {
  slotId: BLUE1_SLOT.id,
  title: "The Drop Plains",
  emotion: "vast blue calm — wander the prairie until the world ends",

  weight: blue1Weight,
  terrainTarget: blue1TerrainTarget,
  ceiling: blue1Ceiling,
  floorClearance: 0.7,

  mood: {
    // The whole blue register, keyed to its deep end: at full mood the
    // water goes violet-blue (red held above green) and *clears* — the
    // vastness argument wants long sightlines, not soup — while the
    // light steps down. The descent below makes depth itself the dimmer:
    // the steppe swims at roughly half of this, bright; the Under-Blue
    // takes all of it.
    // Round 2: the fog scale pushed further into the blue register (round
    // 1 read as the bowl's own cyan at steppe depth) and the light takes
    // eased so the prairie keeps its high sun — the descent still doubles
    // everything by the time the Under-Blue has it.
    // Round 6, measured: blue 1.08 held the fog 21 parts of blue above the
    // backdrop it dissolves into, and every fogged horizon rendered as the
    // audit's "hard flat cobalt band" — the fog itself was the poster
    // paper. 0.95 lands the fogged horizon a gentle 9 parts over the
    // painting; blue stays the fog's top channel by half again over green,
    // so the register keeps its blue without the stripe.
    // (Round 7 tried 0.95: the band moved five parts and stayed a band.
    // 0.86 lands the fogged horizon on the painting to within the capture
    // noise — measured (49,159,168) fog against (43,158,167) backdrop.)
    fog: { colorScale: [0.6, 0.55, 0.86], densityGain: -0.0045, backdropFade: 0.5 },
    light: { sun: 0.3, hemisphere: 0.22, ambient: 0.05 },
  },
  moodSurface: 6,
  moodDescent: 36,

  build(): RegionBuild {
    const group = new Group();
    group.name = "region-great-blue-1";

    const stones = buildBlue1Stones();
    const steppe = buildBlue1Steppe();
    const life = buildBlue1Life();
    const ferryman = buildFerryman();
    const light = buildBlue1Light();
    const distance = buildBlue1Distance();
    const ground = buildBlue1Ground(stones.contacts);
    // The fill builds LAST (Phase 3): every stream it opens is a fresh
    // `^ FILL_SEEDS.*` constant appended after all existing draws, so the
    // reroll fence holds by construction.
    const fill = buildBlue1Fill(stones.sites);

    for (const mesh of [
      ...ground,
      ...stones.meshes,
      ...steppe.meshes,
      ...life.meshes,
      ferryman.mesh,
      ferryman.jacks,
      ...light.meshes,
      ...distance.meshes,
      ...fill.nodes,
    ]) {
      group.add(mesh);
    }

    const colliders = [...stones.colliders, ...buildSeals()];

    return {
      group,
      colliders,
      targets: [ferryman.target],
      update(dt, ctx): void {
        const calm = ctx.reducedMotion ? 0.45 : 1;
        steppe.update(dt, ctx.reducedMotion);
        life.update(dt, ctx.time, ctx.reducedMotion);
        ferryman.update(ctx.time, ctx.reducedMotion);
        light.update(ctx.time, ctx.reducedMotion);
        fill.update(ctx.time * calm);
      },
    };
  },

  codexEntries: [
    {
      id: FERRYMAN_SPECIES_ID,
      commonName: "The Ferryman",
      scientificName: "Mola traiectus",
      fact:
        "An ancient giant sunfish that patrols the World's Edge, crossing " +
        "and recrossing the lip of the drop like a boatman working a bank. " +
        "The pale ring on its flank is older than any diver's charts.",
      codexLine: "It keeps the border between the country of grass and the country of nothing.",
    },
  ],

  capturePoses: buildPoses(),
};

// Re-exported for the region's own tests: the seals are part of the
// region's collision contract and the tests read them back.
export { buildSeals };

// Referenced by the tests to hold the slope's handoff constants honest.
export { SLOPE_TO };
