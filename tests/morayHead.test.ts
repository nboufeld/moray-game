import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Mesh, SkinnedMesh, Vector3, type BufferGeometry } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Moray } from "../src/creatures/morays/Moray";
import {
  GLB_JAW_HINGE_Z,
  GLB_LENGTH_TRIM,
  GLB_NECK_HALF_HEIGHT,
  GLB_SOCKET,
  buildGlbHeadSkeleton,
  glbHeadScale,
  prepareGlbHeadGeometry,
} from "../src/creatures/morays/MorayGlbHead";
import { OUTLINE_NAME } from "../src/creatures/morays/MorayOutline";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";

/**
 * These tests graft the real exported file, not a stand-in: the whole point
 * of `CREATURES.md` is that its numbers were measured off the export, and a
 * contract test against a synthetic copy of those numbers would only ever
 * test the copy. `AssetLibrary` is inert in Node, so the file comes in
 * through `GLTFLoader.parse` and `Moray.adoptSculptedHead` — the same seam
 * the library delivers through in the browser.
 */

let headSource: BufferGeometry;

beforeAll(async () => {
  const bytes = readFileSync("public/assets/models/creature-moray-head.glb");
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  let found: BufferGeometry | undefined;
  gltf.scene.traverse((node) => {
    if (!found && node instanceof Mesh) {
      found = node.geometry as BufferGeometry;
    }
  });
  if (!found) {
    throw new Error("creature-moray-head.glb contains no mesh");
  }
  headSource = found;
});

function adopted(config = MORAY_SPECIES[0]!): Moray {
  const moray = new Moray(config);
  moray.adoptSculptedHead(headSource);
  return moray;
}

/** The sculpted head mesh: the one skinned mesh living under the head group. */
function sculptedHead(moray: Moray): SkinnedMesh {
  let found: SkinnedMesh | undefined;
  moray.asset.head.traverse((node) => {
    if (!found && node instanceof SkinnedMesh && node.name !== OUTLINE_NAME) {
      found = node;
    }
  });
  expect(found).toBeDefined();
  return found!;
}

/** The body tube: the skinned mesh with head-to-tail UVs under the body root. */
function bodyTube(moray: Moray): SkinnedMesh {
  let found: SkinnedMesh | undefined;
  moray.asset.root.traverse((node) => {
    if (
      !found &&
      node instanceof SkinnedMesh &&
      node.name !== OUTLINE_NAME &&
      node.parent !== moray.asset.head &&
      node.geometry.hasAttribute("uv")
    ) {
      found = node;
    }
  });
  return found!;
}

describe("Sculpted moray head", () => {
  it("meets the body tube at the neck with no girth step", () => {
    // Ambiguity #2 resolved: the scale is chosen so the head's neck ellipse
    // lands on the tube's ring at the body root. Measured off both meshes —
    // the head's ring is at z = 0 exactly, the tube's nearest ring within a
    // few centimetres of it — the vertical half-heights have to agree.
    for (const config of MORAY_SPECIES) {
      const moray = adopted(config);
      const head = sculptedHead(moray).geometry.getAttribute("position");
      const tube = bodyTube(moray).geometry.getAttribute("position");

      let headHalfHeight = 0;
      for (let i = 0; i < head.count; i++) {
        if (Math.abs(head.getZ(i)) < 1e-4) {
          headHalfHeight = Math.max(headHalfHeight, Math.abs(head.getY(i)));
        }
      }
      let tubeHalfHeight = 0;
      for (let i = 0; i < tube.count; i++) {
        if (Math.abs(tube.getZ(i)) < 0.05) {
          tubeHalfHeight = Math.max(tubeHalfHeight, Math.abs(tube.getY(i)));
        }
      }

      expect(headHalfHeight, config.id).toBeGreaterThan(0);
      expect(Math.abs(headHalfHeight - tubeHalfHeight) / tubeHalfHeight, config.id).toBeLessThan(
        0.02,
      );
    }
  });

  it("rescales the file's v band onto the archetype's own neck value", () => {
    // Ambiguity #1 resolved: the file bakes v in [0, 0.12] and the tube's v
    // at the root is per-archetype, so the head's band is rescaled to end
    // exactly where the tube's begins — the two agree where they meet.
    for (const config of MORAY_SPECIES) {
      const moray = adopted(config);
      const tube = bodyTube(moray);
      const tubePositions = tube.geometry.getAttribute("position");
      const tubeUv = tube.geometry.getAttribute("uv");

      // The tube's v at the ring nearest the root, read off the mesh itself.
      let bestZ = Infinity;
      let neckV = 0;
      for (let i = 0; i < tubePositions.count; i++) {
        const z = Math.abs(tubePositions.getZ(i));
        if (z < bestZ) {
          bestZ = z;
          neckV = tubeUv.getY(i);
        }
      }

      const headUv = sculptedHead(moray).geometry.getAttribute("uv");
      let maxV = 0;
      for (let i = 0; i < headUv.count; i++) {
        maxV = Math.max(maxV, headUv.getY(i));
      }
      // The head's band ends at the ring the tube's own nearest ring sits a
      // half-station past, so the comparison carries that discretisation.
      expect(maxV, config.id).toBeGreaterThan(neckV * 0.85);
      expect(maxV, config.id).toBeLessThan(neckV * 1.15);
      expect(maxV, config.id).toBeLessThan(0.12);
    }
  });

  it("strips the deletable neck cap", () => {
    const moray = adopted();
    const geometry = sculptedHead(moray).geometry;
    const position = geometry.getAttribute("position");
    const index = geometry.getIndex()!;
    const scale = glbHeadScale(0.21 * MORAY_SPECIES[0]!.girthScale);

    // The fan's centre vertex sits at (0, 0, 0.008) in the file; no surviving
    // triangle may touch it once the head is grafted onto a tube.
    for (let i = 0; i < index.count; i++) {
      const vertex = index.getX(i);
      const distance = Math.hypot(
        position.getX(vertex),
        position.getY(vertex),
        position.getZ(vertex) - 0.008 * scale * GLB_LENGTH_TRIM,
      );
      expect(distance).toBeGreaterThan(1e-3 * scale);
    }
    // And the source is untouched: the library's cached geometry is shared.
    expect(headSource.getIndex()!.count).toBeGreaterThan(index.count);
  });

  it("keeps the mouth lining dark and flattens the skin gradient to white", () => {
    const geometry = prepareGlbHeadGeometry(headSource, { scale: 1, neckV: 0.06 });
    const colour = geometry.getAttribute("color");

    let brightest = 0;
    let darkest = 1;
    for (let i = 0; i < colour.count; i++) {
      const luminance =
        0.2126 * colour.getX(i) + 0.7152 * colour.getY(i) + 0.0722 * colour.getZ(i);
      brightest = Math.max(brightest, luminance);
      darkest = Math.min(darkest, luminance);
    }
    // Pale skin becomes a white multiplier — the painted albedo carries the
    // species' counter-shading, and multiplying two of them is the
    // double-modelling this project keeps having to remove — while the mouth
    // lining stays a dark warm recess the maps have no pixels for.
    expect(brightest).toBeGreaterThan(0.999);
    expect(darkest).toBeLessThan(0.25);
    geometry.dispose();
  });

  it("hinges the jaw where the file's bone sits", () => {
    const { root, jaw } = buildGlbHeadSkeleton(2);
    expect(jaw.parent).toBe(root);
    expect(jaw.position.z).toBeCloseTo(GLB_JAW_HINGE_Z * 2 * GLB_LENGTH_TRIM, 6);
  });

  it("breathes at rest and gapes wider while attending to the player", () => {
    const moray = adopted();
    const head = sculptedHead(moray);
    const jaw = head.skeleton.bones[1]!;

    // At rest, far from the player: a slow, subtle swing that never shuts
    // the mouth (−11° about the hinge is fully closed) and never yawns.
    const far = new Vector3(0, 2, 40);
    let least = Infinity;
    let most = -Infinity;
    for (let step = 0; step < 300; step++) {
      moray.update(1 / 60, far, false);
      least = Math.min(least, jaw.rotation.x);
      most = Math.max(most, jaw.rotation.x);
    }
    expect(least).toBeGreaterThan(-0.1);
    expect(most).toBeGreaterThan(least);
    expect(most).toBeLessThan(0.15);

    // Attending: the same rhythm rides a wider gape.
    for (let step = 0; step < 300; step++) {
      moray.update(1 / 60, new Vector3(0, 1.5, 3), true);
    }
    expect(jaw.rotation.x).toBeGreaterThan(most);
  });

  it("rests the zebra's jaw nearer closed than the snowflake's, and never shut", () => {
    // W-N3: the zebra's resting gape floor. At K4's range on a 1.5× animal
    // the near-full 11° rest gape read as mid-yawn; the patroller's
    // `gapeBias` leans it further toward closed. Two things are contracts:
    // the zebra's whole resting swing sits below the snowflake's, and the
    // jaw never reaches −11° about the hinge — the mouth never shuts.
    const swing = (config: (typeof MORAY_SPECIES)[number]): { least: number; most: number } => {
      const moray = adopted(config);
      const jaw = sculptedHead(moray).skeleton.bones[1]!;
      const far = new Vector3(0, 2, 40);
      let least = Infinity;
      let most = -Infinity;
      for (let step = 0; step < 300; step++) {
        moray.update(1 / 60, far, false);
        least = Math.min(least, jaw.rotation.x);
        most = Math.max(most, jaw.rotation.x);
      }
      return { least, most };
    };

    const zebra = swing(MORAY_SPECIES[2]!);
    const snowflake = swing(MORAY_SPECIES[0]!);
    // The zebra's widest resting gape sits clearly under the snowflake's.
    expect(zebra.most).toBeLessThan(snowflake.most - 0.04);
    // And the floor keeps daylight above fully closed: −11° shuts the mouth,
    // and the zebra never comes within 0.025 rad (~1.4°) of it.
    expect(zebra.least).toBeGreaterThan(-(11 * Math.PI) / 180 + 0.025);
    // It still breathes — the swing is leaned, not pinned.
    expect(zebra.most - zebra.least).toBeGreaterThan(0.04);
  });

  it("keeps the head's world position where the discovery system expects it", () => {
    const moray = adopted(MORAY_SPECIES[3]!);
    moray.asset.root.position.set(-6, 1.6, -9);
    moray.asset.root.updateMatrixWorld(true);
    for (let step = 0; step < 120; step++) {
      moray.update(1 / 60, new Vector3(0, 2, 8), true);
    }
    moray.asset.root.updateMatrixWorld(true);
    const head = moray.getHeadWorldPosition(new Vector3());
    expect(head.x).toBe(-6);
    expect(head.y).toBe(1.6);
    expect(head.z).toBe(-9);
  });

  it("wraps the sculpted head in the animal's own contour", () => {
    for (const config of MORAY_SPECIES) {
      const moray = adopted(config);
      const head = sculptedHead(moray);

      const hulls: SkinnedMesh[] = [];
      moray.asset.root.traverse((node) => {
        if (node instanceof SkinnedMesh && node.name === OUTLINE_NAME) {
          hulls.push(node);
        }
      });
      // Body, fin, sculpted head — and the primitive parts' rigid hulls are
      // gone with the primitives.
      expect(hulls, config.id).toHaveLength(3);

      const headHull = hulls.find((hull) => hull.geometry === head.geometry);
      expect(headHull, config.id).toBeDefined();
      expect(headHull!.skeleton, config.id).toBe(head.skeleton);
      expect(headHull!.bindMatrix.equals(head.bindMatrix), config.id).toBe(true);
      expect(headHull!.castShadow, config.id).toBe(false);
      expect(headHull!.material, config.id).toBe(
        (moray.asset.root.getObjectByName(OUTLINE_NAME) as Mesh).material,
      );
    }
  });

  it("retires the primitive head and shrinks the eyes into the sockets", () => {
    const moray = adopted();
    const scale = glbHeadScale(0.21 * MORAY_SPECIES[0]!.girthScale);

    // What remains under the head group: the sculpted head, its hull, and the
    // two eyes with their catchlights. No skull, snout, brow or jaw tubes.
    const meshes: Mesh[] = [];
    moray.asset.head.traverse((node) => {
      if (node instanceof Mesh) {
        meshes.push(node);
      }
    });
    expect(meshes).toHaveLength(6);

    for (const [eye, side] of [
      [moray.asset.leftEye, -1],
      [moray.asset.rightEye, 1],
    ] as const) {
      expect(eye.scale.x).toBeLessThan(1);
      expect(eye.position.x).toBeCloseTo(side * GLB_SOCKET.x * scale, 5);
      expect(eye.position.z).toBeCloseTo(GLB_SOCKET.z * scale * GLB_LENGTH_TRIM, 5);
    }
  });

  it("adopts once, however many times the library delivers", () => {
    const moray = adopted();
    const before = moray.asset.head.children.length;
    moray.adoptSculptedHead(headSource);
    expect(moray.asset.head.children.length).toBe(before);
  });

  it("derives the scale from the neck girth alone", () => {
    expect(glbHeadScale(GLB_NECK_HALF_HEIGHT)).toBeCloseTo(1, 6);
    expect(glbHeadScale(0.2)).toBeCloseTo(2.5, 6);
  });
});
