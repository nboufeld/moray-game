import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  type Light,
  type Material,
  type Object3D,
  type Scene,
} from "three";
import { seabedHeight } from "../../Seabed";
import type { KitBuild, KitDemoRegistry, KitDemoStage } from "./KitTypes";
import { buildBeamAndPool } from "./BeamAndPool";
import { buildGateVeil } from "./GateVeil";
import { buildGlowColony } from "./GlowColony";
import { buildParticulateField } from "./ParticulateField";
import { buildShoalRunner } from "./ShoalRunner";

/**
 * Package B's demo registrations (spec §4): one entry per life/light/
 * particulate piece, keyed by the piece's canonical name. A piece with
 * no demo capture may not be consumed by Phase 3 (MASTER §3). Owned by
 * the Package B worker; Package A never edits this file.
 *
 * The harness renders one still frame; moving pieces advance their own
 * closed-form clock here via `update(timeSec)` inside `build`, and each
 * registers a `<piece>T1` twin one simulated second later so the pair of
 * captures proves the motion (the spec's two-captures requirement).
 */

/**
 * FLAGGED STAGE REPAIR (see the Package B ledger): the harness page's
 * ground and wall wear `createSandMaterial` / `createRockMaterial`, both
 * `vertexColors: true`, but their geometries carry no `color` attribute —
 * an unbound attribute samples (0,0,0) and the whole stage rasterises
 * black. The page may not be edited by Package B, so every demo below
 * carries this one-shot shim: an empty mesh whose `onBeforeRender` walks
 * the scene once and gives any colour-less lit mesh the white attribute
 * the bowl's occlusion bake would have provided. Deterministic (all 1s),
 * demo-only, and never part of a kit piece.
 */
function stageRepair(): Mesh {
  const probe = new Mesh(new BufferGeometry());
  probe.frustumCulled = false;
  let repaired = false;
  probe.onBeforeRender = (_renderer, scene) => {
    if (repaired) {
      return;
    }
    repaired = true;
    (scene as Object3D).traverse((node) => {
      if (!(node instanceof Mesh)) {
        return;
      }
      const material = node.material as Material & { vertexColors?: boolean };
      const geometry = node.geometry as BufferGeometry;
      if (material.vertexColors === true && !geometry.getAttribute("color")) {
        const count = geometry.getAttribute("position")?.count ?? 0;
        geometry.setAttribute(
          "color",
          new BufferAttribute(new Float32Array(count * 3).fill(1), 3),
        );
      }
    });
  };
  return probe;
}

/**
 * FLAGGED STAGE REPAIR №2 (ledger): the page's dark mood writes
 * `lighting.sun.intensity *= 0.15` once — but `Lighting.addTo` chains a
 * per-frame `scene.onBeforeRender` hook that rewrites the sun from its
 * base levels, so the dark mood is overwritten before the first frame's
 * lights are set up and the "dark" capture ships byte-identical to the
 * bright one. Dark demos carry this shim: on first render it chains ONE
 * more hook after the lighting's (same channel, later in the chain), so
 * the dimming is re-applied each frame after the rig writes base — and
 * it darkens the background colour once, which is what the page's
 * `backgroundIntensity` intended (ignored for `Color` backgrounds).
 */
function darkStageRepair(): Mesh {
  const probe = new Mesh(new BufferGeometry());
  probe.frustumCulled = false;
  let chained = false;
  probe.onBeforeRender = (_renderer, sceneLike) => {
    if (chained) {
      return;
    }
    chained = true;
    const scene = sceneLike as Scene;
    const dimmed: { light: Light; intensity: number }[] = [];
    scene.traverse((node) => {
      if (node instanceof DirectionalLight) {
        dimmed.push({ light: node, intensity: node.intensity * 0.15 });
      } else if (node instanceof HemisphereLight) {
        dimmed.push({ light: node, intensity: node.intensity * 0.35 });
      } else if (node instanceof AmbientLight) {
        // The violet ambient keeps most of its floor — a dark register
        // darkens into colour, never into black (the abyss discipline).
        dimmed.push({ light: node, intensity: node.intensity * 0.55 });
      }
    });
    const dimmedFog = scene.fog ? scene.fog.color.clone().multiplyScalar(0.25) : null;
    const dimmedBackground =
      scene.background instanceof Color ? scene.background.clone().multiplyScalar(0.25) : null;
    const previous = scene.onBeforeRender.bind(scene);
    scene.onBeforeRender = (...args: Parameters<Scene["onBeforeRender"]>) => {
      previous(...args);
      for (const entry of dimmed) {
        entry.light.intensity = entry.intensity;
      }
      // UnderwaterFog's own chained hook rewrites backgroundIntensity per
      // frame, so the dark mood has to be re-asserted after it — SET, not
      // multiplied, so nothing compounds.
      scene.backgroundIntensity = 0.25;
      if (scene.fog && dimmedFog) {
        scene.fog.color.copy(dimmedFog);
      }
      if (scene.background instanceof Color && dimmedBackground) {
        scene.background.copy(dimmedBackground);
      }
    };
  };
  return probe;
}

/**
 * The stage's REAL floor: the harness page's sand mesh is the bowl's own
 * dunes (`createSeabedGeometryAt(0, 0, …)`), but `stage.ground` returns a
 * flat 0 — a piece grounded through it sinks into the near dune. Demos
 * sample the dunes directly so feet, pools and anchors sit on the sand
 * the capture actually shows.
 */
const duneGround = (x: number, z: number): number => seabedHeight(x, z);

/** Several kit builds staged as one, for side-by-side demos. */
function composite(builds: readonly KitBuild[], dark = false): KitBuild {
  const group = new Group();
  group.add(stageRepair());
  if (dark) {
    group.add(darkStageRepair());
  }
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

/** Column dust + falling snow side by side (spec §3.4's demo), at `timeSec`. */
function particulateDemo(_stage: KitDemoStage, timeSec: number): KitBuild {
  const column = buildParticulateField({
    seed: 0xb0_0001,
    tint: 0xeec27a,
    count: 170,
    mode: "column",
    volume: { center: [-3.2, 2.4, -2], size: [2.6, 4.6, 2.6] },
    size: 0.13,
    opacity: 0.55,
  });
  const fall = buildParticulateField({
    seed: 0xb0_0002,
    tint: 0xd8e8ee,
    count: 260,
    mode: "fall",
    volume: { center: [3.4, 2.6, -2], size: [4.4, 5.2, 4.4] },
    opacity: 0.5,
  });
  column.update(timeSec);
  fall.update(timeSec);
  return composite([column, fall]);
}

/** A 40-fish loop crossing the demo patch with glint (spec §3.1's demo). */
function shoalDemo(_stage: KitDemoStage, timeSec: number): KitBuild {
  const shoal = buildShoalRunner({
    seed: 0xb0_0020,
    route: {
      stations: [
        [-16, 2.6, 2],
        [-5, 2.2, 5],
        [5, 2.8, 4],
        [15, 3.6, -2],
        [6, 3.2, -13],
        [-7, 2.8, -12],
      ],
      closed: true,
    },
    count: 40,
    fish: { scale: 1.45, color: 0xcdeedd, emissive: 0x3a5f52 },
    phaseSpeed: 1 / 64,
    braid: { lateral: 0.32, vertical: 0.24 },
    glint: { count: 26, size: 0.14 },
  });
  shoal.update(timeSec);
  return composite([shoal]);
}

/**
 * A veil standing in a demo doorway right of the wall panel, seen from
 * the wing side (spec §3.7's demo brief: two moods — the registry pairs
 * this build with a bright and a dark stage entry).
 */
function gateVeilDemo(_stage: KitDemoStage, timeSec: number, dark: boolean): KitBuild {
  const veil = buildGateVeil({
    seed: 0xb0_0030,
    doorway: { pos: [11, 0, -3], facing: 0, width: 6, height: 5.2 },
    // A verdant-register promise: deep spring-green inks, near → far —
    // dark enough that the 0.2-cap planes stack into a real silhouette.
    palette: [0x123526, 0x22553c, 0x3e7a58],
    particulate: { tint: 0xdce8a8, count: 90 },
    column: { tint: 0xe4f0c0, opacity: 0.1 },
  });
  veil.update(timeSec);
  return composite([veil], dark);
}

export const KIT_DEMOS_B: KitDemoRegistry = {
  gateVeil: {
    camera: { position: [6.2, 2.3, 5.6], lookAt: [11, 3.2, -10] },
    timeSec: 5,
    build: (stage) => gateVeilDemo(stage, 5, false),
  },
  gateVeilDark: {
    camera: { position: [6.2, 2.3, 5.6], lookAt: [11, 3.2, -10] },
    dark: true,
    timeSec: 5,
    build: (stage) => gateVeilDemo(stage, 5, true),
  },
  beamAndPool: {
    camera: { position: [0.5, 2.6, 8.5], lookAt: [0, 2.4, -3] },
    build: () =>
      composite([
        buildBeamAndPool({
          seed: 0xb0_0010,
          tint: 0xffe2ae,
          ground: duneGround,
          beams: [
            // A vertical beam and a slanted blade, pools defaulted under
            // both (spec §3.5's demo brief).
            { pos: [-2.6, -2.6], top: 11, width: 4.6, opacity: 0.1 },
            { pos: [3.6, -0.6], top: 10, width: 3.4, opacity: 0.09, slant: [0.34, -0.1] },
          ],
        }),
      ]),
  },
  glowColony: {
    camera: { position: [0.9, 0.8, 2.0], lookAt: [1.8, 0.35, -1.6] },
    dark: true,
    build: () =>
      composite(
        [
          buildGlowColony({
            seed: 0xb0_0040,
            tint: 0x9fe8e0,
            anchors: (
              [
                [0.6, -0.6],
                [1.8, -1.2],
                [2.6, -2.4],
                [1.1, -2.2],
                [3.2, -1],
                [0.2, -1.8],
              ] as const
            ).map(([x, z]) => [x, duneGround(x, z), z] as const),
            budsPerAnchor: 7,
            glow: 0.36,
          }),
        ],
        true,
      ),
  },
  shoalRunner: {
    camera: { position: [0, 3.4, 11], lookAt: [0, 2.5, 2] },
    timeSec: 21,
    build: (stage) => shoalDemo(stage, 21),
  },
  shoalRunnerT1: {
    camera: { position: [0, 3.4, 11], lookAt: [0, 2.5, 2] },
    timeSec: 22,
    build: (stage) => shoalDemo(stage, 22),
  },
  particulateField: {
    camera: { position: [0, 3.1, 6.8], lookAt: [0, 2.3, -2] },
    timeSec: 6,
    build: (stage) => particulateDemo(stage, 6),
  },
  particulateFieldT1: {
    camera: { position: [0, 3.1, 6.8], lookAt: [0, 2.3, -2] },
    timeSec: 7,
    build: (stage) => particulateDemo(stage, 7),
  },
};
