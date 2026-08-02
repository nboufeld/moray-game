import { BoxGeometry, BufferAttribute, Group, Mesh, type BufferGeometry } from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, rockVariantIndex, slabGeometry, stackGeometry } from "../../RockShapes";
import { createSandMaterial } from "../../SandMaterial";
import { createSeabedGeometryAt, seabedHeight } from "../../Seabed";
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
import type { GroundFn, KitBuild, KitDemoRegistry } from "./KitTypes";

/**
 * Package A's demo registrations (spec §4): one entry per ground/flora
 * piece, keyed by the piece's canonical name. A piece with no demo
 * capture may not be consumed by Phase 3 (MASTER §3). Owned by the
 * Package A worker; Package B never edits this file.
 *
 * Each demo composes the piece's spec-mandated variants (e.g. three
 * carpet palettes side by side) into one aggregate build, so the harness
 * prints ONE honest declared-draw number for the whole staging.
 *
 * **The dressed stage (ledger flag KIT-A-F1).** The harness's own sand
 * patch and wall panel render BLACK: `createSandMaterial` and
 * `createRockMaterial` both declare `vertexColors: true` and the stage
 * geometries carry no colour attribute, so WebGL feeds the shader the
 * zero default. The harness is not this package's file to fix, so every
 * demo build includes its own dressed ground (and wall, where the piece
 * needs one) — the same materials over the same terrain sampler, with the
 * colour attribute filled. Demo builds are staging, not kit pieces: the
 * terrain import lives HERE, never in a builder.
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

/** Metres the dressed sand floats over the harness's black patch. */
const DRESS_LIFT = 0.06;

/** The ground every demo piece actually stands on: the visible sand. */
const demoGround: GroundFn = (x, z) => seabedHeight(x, z) + DRESS_LIFT;

/** A lit copy of the stage's sand patch (see the module header). */
function dressGround(centerZ = 0, size = 40): KitBuild {
  const geometry = createSeabedGeometryAt(0, centerZ, size, Math.round(size * 1.1), DRESS_LIFT);
  const position = geometry.attributes.position!;
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(position.count * 3).fill(1), 3),
  );
  const material = createSandMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.name = "kit-demo-dressed-sand";
  const group = new Group();
  group.name = "kit-demo-dressed-sand";
  group.add(mesh);
  return finishBuild(group, [geometry, material]);
}

/** A lit wall panel standing just proud of the stage's black one. */
function dressWall(): KitBuild {
  const geometry = new BoxGeometry(14, 6, 0.7, 8, 4, 1);
  geometry.translate(0, 3, -9.7); // front face at z = −9.35
  const position = geometry.attributes.position!;
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(position.count * 3).fill(1), 3),
  );
  const material = createRockMaterial(0x8b9184);
  const mesh = new Mesh(geometry, material);
  mesh.name = "kit-demo-dressed-wall";
  const group = new Group();
  group.name = "kit-demo-dressed-wall";
  group.add(mesh);
  return finishBuild(group, [geometry, material]);
}

const OPEN_GATE = (): number => 1;

/** The demo palettes — stand-ins for region tables, chosen to show value
 *  structure: tips lift, roots shade, violets in the shade. */
const SPRING = { base: 0x69c184, tip: 0xa8d98a, shade: 0x3c6b60 } as const;
const GOLDEN = { base: 0xc7a04f, tip: 0xe0cd8a, shade: 0x77583e } as const;
const OLIVE_GOLD = { base: 0x8cad57, tip: 0xc9b45e, shade: 0x567348 } as const;
const WINE = { base: 0x7a4f62, tip: 0xa06f7e, shade: 0x4c3a55 } as const;
const PALE_STONE = { base: 0xa9a091, shade: 0x746d80, accent: 0x8f8a7c } as const;
const OCHRE_SPONGE = { base: 0xc98d4e, accent: 0xd9a86a } as const;
const VIOLET_SPONGE = { base: 0x8d76b8, accent: 0xa48fc6 } as const;
const OLIVE_DRAPE = { base: 0x7d8a45, tip: 0xaabb66, shade: 0x5d6858, accent: 0xb0766a } as const;
const DRIFT_OLIVE = { base: 0x8a7a4f, shade: 0x5c5a72 } as const;
const RELIC_STONE = { base: 0xa79c88, shade: 0x6e6880 } as const;

/**
 * The comb direction blades face in the raked demo: mostly toward the
 * camera, a touch toward the sun's azimuth — a uniformly combed carpet
 * turned away from both stood with every face in the shade band and read
 * near-black (measured, captures a-r1/r2).
 */
const RAKE_DEMO_YAW = 0.15;

export const KIT_DEMOS_A: KitDemoRegistry = {
  /**
   * The R12 quality-pass demos (q-*): the same pieces at SWIMMING DISTANCE
   * — camera 2–4 m off the subject, eye height ~1.2 m, the range the
   * owner's "half-cut grass" verdict was judged at. The originals above
   * stay untouched; these are additional registrations.
   */
  carpetFieldBladeClose: {
    camera: { position: [0, 1.05, 2.6], lookAt: [0, 0.3, -0.6] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
        buildCarpetField({
          seed: 0xa11c_0101,
          palette: SPRING,
          area: { center: [0, -0.6], radius: 2.6 },
          count: 240,
          profile: "blade",
          swayAmp: 0.05,
          sunGlow: true,
          ...shared,
        }),
        // A far card band behind, so the tier handoff is in the frame.
        buildCarpetField({
          seed: 0xa11c_0102,
          palette: SPRING,
          area: { center: [0, -9], radius: 5 },
          count: 700,
          ...shared,
        }),
      ]);
    },
  },

  carpetFieldFrondClose: {
    camera: { position: [0, 1.05, 2.6], lookAt: [0, 0.25, -0.6] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
        buildCarpetField({
          seed: 0xa11c_0103,
          palette: OLIVE_GOLD,
          area: { center: [0, -0.6], radius: 2.6 },
          count: 180,
          profile: "frond",
          swayAmp: 0.04,
          sunGlow: true,
          ...shared,
        }),
      ]);
    },
  },

  bushBankClose: {
    camera: { position: [0, 1.3, 3.4], lookAt: [0.2, 0.5, -0.8] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
        // The R12 rich bush: overhang fronds + berry knots + the deepened
        // crotch, at arm's length. Two palettes so the accent ink reads.
        buildBushBank({
          seed: 0xa11c_0111,
          palette: { ...SPRING, accent: 0x7a4f62 },
          area: { center: [-0.9, -0.9], radius: 2.4 },
          count: 7,
          scale: 0.7,
          lobes: 7,
          fronds: 14,
          accents: 7,
          ...shared,
        }),
        buildBushBank({
          seed: 0xa11c_0112,
          palette: { ...WINE, accent: 0xc9b45e },
          area: { center: [2.6, 0.2], radius: 1.8 },
          count: 4,
          scale: 0.7,
          lobes: 6,
          fronds: 12,
          accents: 5,
          ...shared,
        }),
      ]);
    },
  },

  groundLitterClose: {
    camera: { position: [0, 1.1, 2.4], lookAt: [0.2, 0, -1.6] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
        // Graded two-tone gravel: hearts anchor the big stones (R12).
        buildGroundLitter({
          seed: 0xa11c_0121,
          palette: PALE_STONE,
          area: { center: [0, -1.2], radius: 3.2 },
          count: 260,
          shapeSet: "gravel",
          size: [0.07, 0.2],
          twoTone: true,
          grade: 0.85,
          ...shared,
        }),
        // The split stones threading through it.
        buildGroundLitter({
          seed: 0xa11c_0122,
          palette: { base: 0x9b8b78, shade: 0x6a6278, accent: 0x7c7268 },
          area: { center: [0.4, -1], radius: 2.8 },
          count: 60,
          shapeSet: "split",
          size: [0.12, 0.3],
          grade: 0.6,
          ...shared,
        }),
        // Chipped shards, raked, in the near field.
        buildGroundLitter({
          seed: 0xa11c_0123,
          palette: { base: 0x8f8274, shade: 0x655e74 },
          area: { center: [-0.8, 0.2], radius: 1.6 },
          count: 50,
          shapeSet: "shard",
          size: [0.1, 0.22],
          rake: { from: [-0.8, 3], strength: 0.8, jitter: 0.15 },
          ...shared,
        }),
      ]);
    },
  },

  screeApronClose: {
    camera: { position: [0.2, 1.6, -6.0], lookAt: [-0.5, 0.0, -9.6] },
    build(): KitBuild {
      return compose([
        dressGround(),
        dressWall(),
        buildScreeApron({
          seed: 0xa11c_0131,
          palette: PALE_STONE,
          ground: demoGround,
          anchors: [
            { pos: [-2.4, -9.35], facing: Math.PI / 2, spread: 2.2 },
            { pos: [0.6, -9.35], facing: Math.PI / 2, spread: 2.8 },
            { pos: [3.2, -9.35], facing: Math.PI / 2, spread: 1.9 },
          ],
          slabsPerAnchor: 24,
        }),
      ]);
    },
  },

  farGrassCardsNear: {
    // The near-boundary proof: the camera stands INSIDE the card field.
    // With nearFade, the 8 m around the lens carry no cards — the blade
    // profile owns the foreground and the cards take over where their
    // 4-tri nature can no longer be seen.
    camera: { position: [0, 1.4, 6], lookAt: [0, 0.7, 30] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(15, 80),
        buildCarpetField({
          seed: 0xa11c_0141,
          palette: SPRING,
          area: { center: [0, 4], radius: 6 },
          count: 260,
          profile: "blade",
          sunGlow: true,
          ...shared,
        }),
        buildFarGrassCards({
          seed: 0xa11c_0142,
          palette: SPRING,
          area: { center: [0, 14], radius: 26 },
          count: 9000,
          nearFade: 8,
          ...shared,
        }),
      ]);
    },
  },

  carpetField: {
    camera: { position: [0, 4.2, 8.6], lookAt: [0, 0.2, 0] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
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
          palette: OLIVE_GOLD,
          area: { center: [4.6, 0.5], radius: 2.2 },
          count: 950,
          rake: { yaw: RAKE_DEMO_YAW, strength: 0.6 },
          ...shared,
        }),
      ]);
    },
  },

  groundLitter: {
    camera: { position: [0, 3.4, 6.2], lookAt: [0, 0, -0.8] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
        // The unraked disc field, two-tone gravel.
        buildGroundLitter({
          seed: 0xa11c_0011,
          palette: PALE_STONE,
          area: { center: [0, -0.5], radius: 5 },
          count: 420,
          shapeSet: "gravel",
          size: [0.07, 0.2],
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
          size: [0.09, 0.24],
          rake: { from: [0, 0.5], strength: 0.85, jitter: 0.12 },
          ...shared,
        }),
      ]);
    },
  },

  screeApron: {
    camera: { position: [0.5, 1.9, -4.4], lookAt: [-0.4, 0.2, -9.8] },
    build(): KitBuild {
      return compose([
        dressGround(),
        dressWall(),
        buildScreeApron({
          seed: 0xa11c_0021,
          palette: PALE_STONE,
          ground: demoGround,
          anchors: [
            { pos: [-4.2, -9.35], facing: Math.PI / 2, spread: 2.6 },
            { pos: [0.4, -9.35], facing: Math.PI / 2, spread: 3.2 },
            { pos: [4.4, -9.35], facing: Math.PI / 2, spread: 2.2 },
          ],
          slabsPerAnchor: 14,
        }),
      ]);
    },
  },

  matRings: {
    camera: { position: [0, 4.6, 5.4], lookAt: [0, 0, -0.2] },
    build(): KitBuild {
      return compose([
        dressGround(),
        // The 3-tier ring (a thermal terrace shape; the amber/rust/sinter
        // REGION palette stays smoking-1's exclusive — R8).
        buildMatRings({
          seed: 0xa11c_0031,
          bands: [
            { color: 0xe3c47c, width: 1 },
            { color: 0xb0703f, width: 1.1 },
            { color: 0xd9d2c0, width: 0.5 },
          ],
          ground: demoGround,
          anchors: [{ pos: [-2.4, -0.4], radius: 2.3 }],
          tiers: 3,
        }),
        // The felt mat.
        buildMatRings({
          seed: 0xa11c_0032,
          bands: [
            { color: 0xe8e4da, width: 1 },
            { color: 0xb98a6a, width: 0.55 },
            { color: 0x9c8d80, width: 0.55 },
          ],
          ground: demoGround,
          anchors: [{ pos: [2.6, 0.4], radius: 1.7 }],
        }),
      ]);
    },
  },

  bushBank: {
    camera: { position: [0, 1.5, 6.2], lookAt: [0, 0.4, 0] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
        buildBushBank({
          seed: 0xa11c_0041,
          palette: SPRING,
          area: { center: [-2.4, 0], radius: 2.8 },
          count: 12,
          scale: 0.7,
          ...shared,
        }),
        buildBushBank({
          seed: 0xa11c_0042,
          palette: WINE,
          area: { center: [3, 0.4], radius: 2.4 },
          count: 9,
          scale: 0.7,
          ...shared,
        }),
      ]);
    },
  },

  spongeClusterClose: {
    camera: { position: [-0.4, 1.3, 2.3], lookAt: [-1.1, 0.7, -0.4] },
    build(): KitBuild {
      return compose([
        dressGround(),
        buildSpongeCluster({
          seed: 0xa11c_0151,
          palette: OCHRE_SPONGE,
          ground: demoGround,
          anchors: [{ pos: [-1.5, -0.2] }, { pos: [-0.4, 0.6] }],
          tubesPerAnchor: 4,
        }),
      ]);
    },
  },

  spongeCluster: {
    camera: { position: [0.2, 1.7, 4.6], lookAt: [0.2, 0.75, 0] },
    build(): KitBuild {
      return compose([
        dressGround(),
        buildSpongeCluster({
          seed: 0xa11c_0051,
          palette: OCHRE_SPONGE,
          ground: demoGround,
          anchors: [{ pos: [-1.5, -0.2] }, { pos: [-0.6, 0.5] }],
          tubesPerAnchor: 4,
        }),
        buildSpongeCluster({
          seed: 0xa11c_0052,
          palette: VIOLET_SPONGE,
          ground: demoGround,
          anchors: [{ pos: [1.3, 0.1] }, { pos: [2.2, -0.6] }],
          tubesPerAnchor: 4,
        }),
      ]);
    },
  },

  wallDrapeBank: {
    camera: { position: [-0.4, 3.5, -6.1], lookAt: [-0.6, 3.3, -9.6] },
    build(): KitBuild {
      // The dressed wall panel wears the bank (front face z = −9.35).
      const anchors = [
        { pos: [-5.2, 4.4, -9.33] as const, normal: [0, 0, 1] as const },
        { pos: [-3.4, 3.0, -9.33] as const, normal: [0, 0, 1] as const },
        { pos: [-1.8, 4.8, -9.33] as const, normal: [0, 0, 1] as const },
        { pos: [-0.2, 3.6, -9.33] as const, normal: [0, 0, 1] as const },
        { pos: [1.5, 4.5, -9.33] as const, normal: [0, 0, 1] as const },
        { pos: [3.1, 2.8, -9.33] as const, normal: [0, 0, 1] as const },
        { pos: [4.8, 4.2, -9.33] as const, normal: [0, 0, 1] as const },
        { pos: [5.6, 3.2, -9.33] as const, normal: [0, 0, 1] as const },
      ];
      return compose([
        dressGround(),
        dressWall(),
        buildWallDrapeBank({
          seed: 0xa11c_0061,
          palette: OLIVE_DRAPE,
          anchors,
          strandsPerAnchor: 7,
          length: 1.7,
          swayAmp: 0.1,
        }),
      ]);
    },
  },

  driftDebris: {
    camera: { position: [0, 2.8, 5.6], lookAt: [0, -0.2, -1.2] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
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
    // Photographed at grazing angle looking AWAY from the stage wall (its
    // unlit panel would otherwise block the vista): near carpet band in
    // frame, the far cards receding into the fog over the long sheet.
    camera: { position: [0, 1.7, -8], lookAt: [0, 0.9, 30] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(15, 80),
        buildCarpetField({
          seed: 0xa11c_0081,
          palette: SPRING,
          area: { center: [0, -2.5], radius: 4 },
          count: 900,
          ...shared,
        }),
        buildFarGrassCards({
          seed: 0xa11c_0082,
          palette: SPRING,
          area: { center: [0, 20], radius: 26 },
          count: 9000,
          ...shared,
        }),
      ]);
    },
  },

  wallStrataPaint: {
    camera: { position: [0, 3.2, 2.6], lookAt: [0, 2.4, -6] },
    build(): KitBuild {
      // wallStrataPaint is a bake, not a mesh — the demo builds its own
      // wall panel, paints it (three violet-leaning bands, red above
      // green), and gates the left quarter to zero so the identity seam
      // is IN the capture.
      const geometry = new BoxGeometry(12, 6, 1, 48, 24, 2);
      geometry.translate(0, 3, -6);
      const position = geometry.attributes.position!;
      geometry.setAttribute(
        "color",
        new BufferAttribute(new Float32Array(position.count * 3).fill(1), 3),
      );
      applyWallStrata(geometry, {
        seed: 0xa11c_0091,
        bands: [
          { tint: [1.04, 1.0, 0.94], height: 4.5 },
          { tint: [0.86, 0.78, 1.0], height: 3.1 },
          { tint: [0.66, 0.58, 0.96], height: 1.7 },
          { tint: [0.5, 0.43, 0.82], height: -Infinity },
        ],
        blend: 0.9,
        wander: 2.0,
        gate: (x) => Math.min(1, Math.max(0, (x + 3.4) / 1.4)),
      });
      const material = createToonMaterial({ color: 0xa8a29b, vertexColors: true });
      const mesh = new Mesh(geometry, material);
      mesh.name = "kit-strata-demo-wall";
      const group = new Group();
      group.name = "kit-strata-demo";
      group.add(mesh);
      return compose([dressGround(), finishBuild(group, [geometry, material])]);
    },
  },

  /**
   * The kit-variants wave (critic punch #9 / C2): the new silhouettes,
   * photographed before any plain wears them.
   */
  rockSilhouettes: {
    // The line-up: each family's original beside its two siblings — the
    // boulder row near, the slab row mid, the double-lobe sentinel
    // stacks (the critic's actual gatepost idiom) standing behind. One
    // seed per stone chosen so every profile is IN the frame.
    camera: { position: [0, 2.2, 10.8], lookAt: [0, 1.5, -3] },
    build(): KitBuild {
      const group = new Group();
      group.name = "kit-rock-silhouettes";
      const owned: Parameters<typeof finishBuild>[1][number][] = [];
      const seedFor = (kind: "boulder" | "slab" | "stack", variant: number): number => {
        // Walk a fresh salt until the hash lands on the wanted sibling —
        // demo staging only; the world lets the hash fall where it may.
        let seed = 0xa11c_0f00 + variant * 131;
        while (rockVariantIndex(seed, kind) !== variant) {
          seed++;
        }
        return seed;
      };
      const stand = (geometry: BufferGeometry, x: number, z: number, tint: number, name: string): void => {
        const material = createRockMaterial(tint);
        const mesh = new Mesh(geometry, material);
        mesh.position.set(x, demoGround(x, z), z);
        mesh.name = name;
        group.add(mesh);
        owned.push(geometry, material);
      };
      for (let variant = 0; variant < 3; variant++) {
        stand(
          boulderGeometry({ seed: seedFor("boulder", variant), radius: 1.05, height: 1.6 }),
          (variant - 1) * 4.2 - 1.3,
          1.6,
          0x93a089,
          `kit-rock-boulder-${variant}`,
        );
        stand(
          slabGeometry({ seed: seedFor("slab", variant), radius: 1.3, height: 0.7 }),
          (variant - 1) * 4.2 + 1.3,
          -1.2,
          0x9a938a,
          `kit-rock-slab-${variant}`,
        );
        // The sentinels flank the frame clear of the wall panel, so all
        // three carvings stand against open water.
        stand(
          stackGeometry(
            [
              { radius: 1.1, rise: 0.5, stretch: 1.8, lean: 0.3 },
              { radius: 0.75, rise: 3.1, stretch: 1.6, lean: 0.8 },
            ],
            { seed: seedFor("stack", variant) },
          ),
          (variant - 1) * 8.2,
          variant === 1 ? -6.4 : -4.6,
          0xa39a8e,
          `kit-rock-stack-${variant}`,
        );
      }
      return compose([dressGround(), finishBuild(group, owned)]);
    },
  },

  carpetFieldTuftForms: {
    // The dark-shard tuft slot at swimming distance: one seeded field,
    // per-instance forms mixed by the deployment hash itself — the
    // crossed star, the low fan and the broken-tip cluster in ONE draw.
    camera: { position: [0, 1.15, 3.0], lookAt: [0, 0.25, -0.8] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
        // The smoking plains' bone-sulfur dark tuft read.
        buildCarpetField({
          seed: 0xa11c_0f31,
          palette: { base: 0x6b6552, tip: 0x9c9067, shade: 0x453f47 },
          area: { center: [-0.4, -0.9], radius: 2.6 },
          count: 130,
          profile: "tuft",
          ...shared,
        }),
        // The pale terraces' rose tuft, same forms, second palette.
        buildCarpetField({
          seed: 0xa11c_0f32,
          palette: { base: 0xa98b95, tip: 0xd0b3ae, shade: 0x6d5a72 },
          area: { center: [2.9, -2.4], radius: 1.9 },
          count: 80,
          profile: "tuft",
          ...shared,
        }),
        // The charcoal card stubble in front — smoking's "dark shard"
        // spike, now card / low hook / kinked shard per instance.
        buildCarpetField({
          seed: 0xa11c_0f33,
          palette: { base: 0x7b6c78, tip: 0x94818a, shade: 0x554a64 },
          area: { center: [-2.6, 0.6], radius: 1.7 },
          count: 90,
          size: [0.4, 0.75],
          ...shared,
        }),
      ]);
    },
  },

  carpetFieldBladeForms: {
    // The blade-tuft slot: crossed clumps, arcing sheaves and low splays
    // sharing one instanced draw, at the R12 judging distance.
    camera: { position: [0, 1.1, 2.9], lookAt: [0, 0.3, -0.7] },
    build(): KitBuild {
      const shared = { gate: OPEN_GATE, ground: demoGround };
      return compose([
        dressGround(),
        buildCarpetField({
          seed: 0xa11c_0f41,
          palette: SPRING,
          area: { center: [0, -0.7], radius: 2.8 },
          count: 230,
          profile: "blade",
          swayAmp: 0.05,
          sunGlow: true,
          ...shared,
        }),
      ]);
    },
  },
};
