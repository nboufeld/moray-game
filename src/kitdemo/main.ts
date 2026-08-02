import {
  BoxGeometry,
  BufferAttribute,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { KIT_DEMOS_A } from "../world/regions/kit/KitDemosA";
import { KIT_DEMOS_B } from "../world/regions/kit/KitDemosB";
import type { KitDemoStage } from "../world/regions/kit/KitTypes";
import { Lighting } from "../rendering/Lighting";
import { UnderwaterFog } from "../rendering/UnderwaterFog";
import { createSandMaterial } from "../world/SandMaterial";
import { createRockMaterial } from "../world/RockMaterial";
import { boulderGeometry } from "../world/RockShapes";
import { createSeabedGeometryAt, seabedHeight } from "../world/Seabed";
import { onSceneRender } from "../world/Abyss";

/**
 * The kit demo stage (KIT-SPEC §4): a standard scene every kit piece is
 * photographed on before any region may consume it — a 40 m sand patch,
 * a wall panel, a boulder, the standing toon rig and water, an optional
 * dark mood for glow pieces. `scripts/kit-demo.mjs` drives this page and
 * compares each build's declared draws/tris against the renderer's own
 * counters, so a dishonest budget note is caught at capture time.
 *
 * Served as /kit-demo.html?piece=<name>. The stage stands at the world
 * origin on the bowl's own dunes — flat-ish ground, mood exactly zero.
 */

const params = new URLSearchParams(window.location.search);
const pieceName = params.get("piece") ?? "";

const demo = KIT_DEMOS_A[pieceName] ?? KIT_DEMOS_B[pieceName];
const doorway = window as unknown as {
  __kitDemoDone?: boolean;
  __kitDemoStats?: {
    piece: string;
    declaredDraws: number;
    declaredTriangles: number;
    renderedCalls: number;
    renderedTriangles: number;
  };
  __kitDemoError?: string;
};

if (!demo) {
  doorway.__kitDemoError = `No registered kit demo named "${pieceName}"`;
  doorway.__kitDemoDone = true;
  throw new Error(doorway.__kitDemoError);
}

const canvas = document.getElementById("kit-canvas") as HTMLCanvasElement;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setSize(1600, 900, false);
renderer.setPixelRatio(1);

const scene = new Scene();
const fog = new UnderwaterFog();
fog.applyTo(scene);
const lighting = new Lighting();
lighting.addTo(scene);
if (demo.dark) {
  // The dark stage mood for glow pieces (Package B's flag: the rig's own
  // per-frame hooks rewrite intensities, so a one-shot assignment is a
  // no-op — this hook chains AFTER them and wins every frame).
  onSceneRender(scene, () => {
    lighting.sun.intensity = 0.24;
    scene.backgroundIntensity = 0.25;
  });
}

// The standard stage: sand patch, wall panel, boulder. The stage bakes a
// neutral vertex-colour attribute onto anything missing one — the sand and
// rock materials multiply vertex colours, and a geometry without them
// renders black (Package A's flag KIT-A-F1).
function ensureVertexColors(mesh: Mesh): Mesh {
  const geometry = mesh.geometry;
  if (!geometry.getAttribute("color")) {
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3).fill(1);
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
  }
  return mesh;
}

const ground = ensureVertexColors(
  new Mesh(createSeabedGeometryAt(0, 0, 40, 44), createSandMaterial()),
);
scene.add(ground);

const wall = ensureVertexColors(
  new Mesh(new BoxGeometry(14, 6, 1.2, 8, 4, 2), createRockMaterial(0x8b9184)),
);
wall.position.set(0, 3, -10);
scene.add(wall);

const boulder = ensureVertexColors(
  new Mesh(
    boulderGeometry({ seed: 0x1234, radius: 1.6, height: 2.1, amount: 0.15 }),
    createRockMaterial(0x93a089),
  ),
);
boulder.position.set(-6, 0, -4);
scene.add(boulder);

const stage: KitDemoStage = {
  // The truth, not a promise (Package B's flag): the stage sand IS the
  // bowl's dunes, so the contract sampler reports them.
  ground: (x, z) => seabedHeight(x, z),
};

const build = demo.build(stage);
scene.add(build.group);

const camera = new PerspectiveCamera(70, 1600 / 900, 0.1, 160);
camera.position.set(...demo.camera.position);
camera.lookAt(new Vector3(...demo.camera.lookAt));

renderer.render(scene, camera);
doorway.__kitDemoStats = {
  piece: pieceName,
  declaredDraws: build.draws,
  declaredTriangles: build.triangles,
  renderedCalls: renderer.info.render.calls,
  renderedTriangles: renderer.info.render.triangles,
};
doorway.__kitDemoDone = true;

// Hold the frame for the screenshot (drawing buffers are not preserved).
function hold(): void {
  renderer.render(scene, camera);
  requestAnimationFrame(hold);
}
requestAnimationFrame(hold);
