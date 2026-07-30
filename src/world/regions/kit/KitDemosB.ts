import { BufferAttribute, BufferGeometry, Group, Mesh, type Material, type Object3D } from "three";
import type { KitBuild, KitDemoRegistry, KitDemoStage } from "./KitTypes";
import { buildBeamAndPool } from "./BeamAndPool";
import { buildParticulateField } from "./ParticulateField";

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

/** Several kit builds staged as one, for side-by-side demos. */
function composite(builds: readonly KitBuild[]): KitBuild {
  const group = new Group();
  group.add(stageRepair());
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

export const KIT_DEMOS_B: KitDemoRegistry = {
  beamAndPool: {
    camera: { position: [0.5, 2.6, 8.5], lookAt: [0, 2.4, -3] },
    build: (stage) =>
      composite([
        buildBeamAndPool({
          seed: 0xb0_0010,
          tint: 0xffe2ae,
          ground: stage.ground,
          beams: [
            // A vertical beam and a slanted blade, pools defaulted under
            // both (spec §3.5's demo brief).
            { pos: [-2.6, -2.6], top: 11, width: 4.6, opacity: 0.1 },
            { pos: [3.6, -0.6], top: 10, width: 3.4, opacity: 0.09, slant: [0.34, -0.1] },
          ],
        }),
      ]),
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
