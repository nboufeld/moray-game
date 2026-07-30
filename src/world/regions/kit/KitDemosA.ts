import { BoxGeometry, Group, Mesh } from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { buildBushBank } from "./BushBank";
import { buildCarpetField } from "./CarpetField";
import { buildDriftDebris } from "./DriftDebris";
import { buildFarGrassCards } from "./FarGrassCards";
import { buildGroundLitter } from "./GroundLitter";
import { finishBuild } from "./KitGroundShared";
import { applyWallStrata } from "./KitPaint";
import { buildMatRings } from "./MatRings";
import { buildScreeApron } from "./ScreeApron";
import { buildSpongeCluster } from "./SpongeCluster";
import { buildWallDrapeBank } from "./WallDrape";
import type { KitBuild, KitDemoRegistry, KitDemoStage } from "./KitTypes";

/**
 * Package A's demo registrations (spec §4): one entry per ground/flora
 * piece, keyed by the piece's canonical name. A piece with no demo
 * capture may not be consumed by Phase 3 (MASTER §3). Owned by the
 * Package A worker; Package B never edits this file.
 *
 * Each demo composes the piece's spec-mandated variants (e.g. three
 * carpet palettes side by side) into one aggregate build, so the harness
 * prints ONE honest declared-draw number for the whole staging.
 */

/** Aggregates several builds into one, summing the honest budget numbers. */
function compose(builds: readonly KitBuild[]): KitBuild {
  const group = new Group();
  group.name = "kit-demo-composite";
  let draws = 0;
  let triangles = 0;
  for (const build of builds) {
    group.add(build.group);
    draws += build.draws;
    triangles += build.triangles;
  }
  return {
    group,
    draws,
    triangles,
    dispose(): void {
      for (const build of builds) {
        build.dispose();
      }
      group.clear();
      group.removeFromParent();
    },
  };
}

const OPEN_GATE = (): number => 1;

/** The demo palettes — stand-ins for region tables, chosen to show value
 *  structure: tips lift, roots shade, violets in the shade. */
const SPRING = { base: 0x69c184, tip: 0xa8d98a, shade: 0x3c6b60 } as const;
const GOLDEN = { base: 0xc7a04f, tip: 0xe0cd8a, shade: 0x77583e } as const;
const CELADON = { base: 0x9db98a, tip: 0xc5d3ac, shade: 0x5f7a72 } as const;
const WINE = { base: 0x7a4f62, tip: 0xa06f7e, shade: 0x4c3a55 } as const;
const PALE_STONE = { base: 0xa9a091, shade: 0x746d80, accent: 0x8f8a7c } as const;
const OCHRE_SPONGE = { base: 0xc98d4e, accent: 0xd9a86a } as const;
const VIOLET_SPONGE = { base: 0x8d76b8, accent: 0xa48fc6 } as const;
const OLIVE_DRAPE = { base: 0x7d8a45, tip: 0xaabb66, shade: 0x4c5560, accent: 0x8a7f62 } as const;
const DRIFT_OLIVE = { base: 0x8a7a4f, shade: 0x5c5a72 } as const;
const RELIC_STONE = { base: 0xa79c88, shade: 0x6e6880 } as const;

export const KIT_DEMOS_A: KitDemoRegistry = {
  carpetField: {
    camera: { position: [0, 4.2, 8.6], lookAt: [0, 0.2, 0] },
    build(stage: KitDemoStage): KitBuild {
      const shared = { gate: OPEN_GATE, ground: stage.ground };
      return compose([
        buildCarpetField({
          seed: 0xa11c_0001,
          palette: SPRING,
          area: { center: [-4.6, 0.5], radius: 2.2 },
          count: 950,
          swayAmp: 0.06,
          ...shared,
        }),
        buildCarpetField({
          seed: 0xa11c_0002,
          palette: GOLDEN,
          area: { center: [0, 0.5], radius: 2.2 },
          count: 520,
          profile: "tuft",
          ...shared,
        }),
        buildCarpetField({
          seed: 0xa11c_0003,
          palette: CELADON,
          area: { center: [4.6, 0.5], radius: 2.2 },
          count: 950,
          rake: { yaw: Math.PI * 0.25, strength: 0.85 },
          ...shared,
        }),
      ]);
    },
  },

  groundLitter: {
    camera: { position: [0, 5.2, 8.4], lookAt: [0, 0, -0.5] },
    build(stage: KitDemoStage): KitBuild {
      const shared = { gate: OPEN_GATE, ground: stage.ground };
      return compose([
        // The unraked disc field, two-tone gravel.
        buildGroundLitter({
          seed: 0xa11c_0011,
          palette: PALE_STONE,
          area: { center: [0, -0.5], radius: 5.4 },
          count: 420,
          shapeSet: "gravel",
          twoTone: true,
          ...shared,
        }),
        // The raked shard run crossing it — blast-aligned away from a point.
        buildGroundLitter({
          seed: 0xa11c_0012,
          palette: { base: 0x9b8b78, shade: 0x6a6278, accent: 0x7c7268 },
          area: {
            polyline: [
              [-7.5, 3.5],
              [0, 0.5],
              [7.5, 2.5],
            ],
            width: 1.7,
          },
          count: 300,
          shapeSet: "shard",
          rake: { from: [0, 0.5], strength: 0.85, jitter: 0.12 },
          ...shared,
        }),
      ]);
    },
  },

  screeApron: {
    camera: { position: [0.5, 3.1, -3.2], lookAt: [0, 0.5, -9.6] },
    build(stage: KitDemoStage): KitBuild {
      return buildScreeApron({
        seed: 0xa11c_0021,
        palette: PALE_STONE,
        ground: stage.ground,
        anchors: [
          { pos: [-4.2, -9.2], facing: Math.PI / 2, spread: 2.6 },
          { pos: [0.4, -9.1], facing: Math.PI / 2, spread: 3.2 },
          { pos: [4.4, -9.3], facing: Math.PI / 2, spread: 2.2 },
        ],
        slabsPerAnchor: 10,
      });
    },
  },

  matRings: {
    camera: { position: [0, 4.6, 5.4], lookAt: [0, 0, -0.2] },
    build(stage: KitDemoStage): KitBuild {
      return compose([
        // The 3-tier ring (a thermal terrace shape; the amber/rust/sinter
        // REGION palette stays smoking-1's exclusive — R8).
        buildMatRings({
          seed: 0xa11c_0031,
          bands: [
            { color: 0xe3c47c, width: 1 },
            { color: 0xb0703f, width: 0.9 },
            { color: 0xd9d2c0, width: 0.7 },
          ],
          ground: stage.ground,
          anchors: [{ pos: [-2.4, -0.4], radius: 2.3 }],
          tiers: 3,
        }),
        // The felt mat.
        buildMatRings({
          seed: 0xa11c_0032,
          bands: [
            { color: 0xe8e4da, width: 1 },
            { color: 0xc4bfae, width: 0.55 },
            { color: 0x9c8d80, width: 0.55 },
          ],
          ground: stage.ground,
          anchors: [{ pos: [2.6, 0.4], radius: 1.7 }],
        }),
      ]);
    },
  },

  bushBank: {
    camera: { position: [0, 2.5, 6.8], lookAt: [0, 0.5, 0] },
    build(stage: KitDemoStage): KitBuild {
      const shared = { gate: OPEN_GATE, ground: stage.ground };
      return compose([
        buildBushBank({
          seed: 0xa11c_0041,
          palette: SPRING,
          area: { center: [-2.4, 0], radius: 2.8 },
          count: 12,
          ...shared,
        }),
        buildBushBank({
          seed: 0xa11c_0042,
          palette: WINE,
          area: { center: [3, 0.4], radius: 2.4 },
          count: 9,
          ...shared,
        }),
      ]);
    },
  },

  spongeCluster: {
    camera: { position: [0.2, 1.7, 4.6], lookAt: [0.2, 0.75, 0] },
    build(stage: KitDemoStage): KitBuild {
      return compose([
        buildSpongeCluster({
          seed: 0xa11c_0051,
          palette: OCHRE_SPONGE,
          ground: stage.ground,
          anchors: [{ pos: [-1.5, -0.2] }, { pos: [-0.6, 0.5] }],
          tubesPerAnchor: 4,
        }),
        buildSpongeCluster({
          seed: 0xa11c_0052,
          palette: VIOLET_SPONGE,
          ground: stage.ground,
          anchors: [{ pos: [1.3, 0.1] }, { pos: [2.2, -0.6] }],
          tubesPerAnchor: 4,
        }),
      ]);
    },
  },

  wallDrapeBank: {
    camera: { position: [0, 3.4, -4.0], lookAt: [0, 3.1, -9.6] },
    build(): KitBuild {
      // The demo wall panel wears the bank: front face of the stage wall
      // (a 14×6×1.2 box at (0, 3, −10) — its face is z = −9.4).
      const anchors = [
        { pos: [-5.2, 4.4, -9.38] as const, normal: [0, 0, 1] as const },
        { pos: [-3.4, 3.0, -9.38] as const, normal: [0, 0, 1] as const },
        { pos: [-1.8, 4.8, -9.38] as const, normal: [0, 0, 1] as const },
        { pos: [-0.2, 3.6, -9.38] as const, normal: [0, 0, 1] as const },
        { pos: [1.5, 4.5, -9.38] as const, normal: [0, 0, 1] as const },
        { pos: [3.1, 2.8, -9.38] as const, normal: [0, 0, 1] as const },
        { pos: [4.8, 4.2, -9.38] as const, normal: [0, 0, 1] as const },
        { pos: [5.6, 3.2, -9.38] as const, normal: [0, 0, 1] as const },
      ];
      return buildWallDrapeBank({
        seed: 0xa11c_0061,
        palette: OLIVE_DRAPE,
        anchors,
        strandsPerAnchor: 5,
        length: 1.7,
        swayAmp: 0.1,
      });
    },
  },

  driftDebris: {
    camera: { position: [0, 3.6, 6.6], lookAt: [0, 0, -0.6] },
    build(stage: KitDemoStage): KitBuild {
      const shared = { gate: OPEN_GATE, ground: stage.ground };
      return compose([
        // A drift-line of wrack along a strand.
        buildDriftDebris({
          seed: 0xa11c_0071,
          palette: DRIFT_OLIVE,
          area: {
            polyline: [
              [-6.5, 2],
              [0, -0.5],
              [6.5, 1.2],
            ],
            width: 2.2,
          },
          count: 64,
          shapeSet: "wrack",
          ...shared,
        }),
        // The relic scatter, mossed.
        buildDriftDebris({
          seed: 0xa11c_0072,
          palette: RELIC_STONE,
          area: { center: [0.8, -3.2], radius: 3.4 },
          count: 14,
          shapeSet: "relics",
          mossTint: 0x7d9053,
          ...shared,
        }),
      ]);
    },
  },

  farGrassCards: {
    // Photographed at grazing angle: near carpet band in frame, the far
    // cards receding into the fog.
    camera: { position: [0, 1.6, 11.5], lookAt: [0, 0.7, -30] },
    build(stage: KitDemoStage): KitBuild {
      const shared = { gate: OPEN_GATE, ground: stage.ground };
      return compose([
        buildCarpetField({
          seed: 0xa11c_0081,
          palette: SPRING,
          area: { center: [0, 6], radius: 4 },
          count: 900,
          ...shared,
        }),
        buildFarGrassCards({
          seed: 0xa11c_0082,
          palette: SPRING,
          area: { center: [0, -28], radius: 30 },
          count: 9000,
          ...shared,
        }),
      ]);
    },
  },

  wallStrataPaint: {
    camera: { position: [0, 3.0, 1.4], lookAt: [0, 2.6, -6] },
    build(): KitBuild {
      // wallStrataPaint is a bake, not a mesh — the demo builds its own
      // wall panel, paints it (three violet-leaning bands, red above
      // green), and gates the left quarter to zero so the identity seam
      // is IN the capture.
      const geometry = new BoxGeometry(12, 6, 1, 48, 24, 2);
      geometry.translate(0, 3, -6);
      applyWallStrata(geometry, {
        seed: 0xa11c_0091,
        bands: [
          { tint: [1, 1, 1], height: 4.3 },
          { tint: [0.88, 0.8, 1.0], height: 2.9 },
          { tint: [0.68, 0.6, 0.96], height: 1.5 },
          { tint: [0.54, 0.48, 0.88], height: -Infinity },
        ],
        gate: (x) => Math.min(1, Math.max(0, (x + 3.4) / 1.4)),
      });
      const material = createToonMaterial({ color: 0x9a9484, vertexColors: true });
      const mesh = new Mesh(geometry, material);
      mesh.name = "kit-strata-demo-wall";
      const group = new Group();
      group.name = "kit-strata-demo";
      group.add(mesh);
      return finishBuild(group, [geometry, material]);
    },
  },
};
