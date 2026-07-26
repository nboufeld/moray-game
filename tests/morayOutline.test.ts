import { describe, expect, it } from "vitest";
import { BackSide, Box3, Color, Mesh, MeshBasicMaterial, SkinnedMesh } from "three";
import { Moray } from "../src/creatures/morays/Moray";
import {
  OUTLINE_HALO,
  OUTLINE_INK,
  OUTLINE_NAME,
  OUTLINE_THICKNESS,
} from "../src/creatures/morays/MorayOutline";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";

function hullsOf(moray: Moray): Mesh[] {
  const found: Mesh[] = [];
  moray.asset.root.traverse((object) => {
    if (object instanceof Mesh && object.name === OUTLINE_NAME) {
      found.push(object);
    }
  });
  return found;
}

function luminance(color: Color): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

/** The animal's own meshes: everything that is not one of its hulls. */
function skinOf(moray: Moray): Mesh[] {
  const found: Mesh[] = [];
  moray.asset.root.traverse((object) => {
    if (object instanceof Mesh && object.name !== OUTLINE_NAME) {
      found.push(object);
    }
  });
  return found;
}

describe("Moray contour", () => {
  it("draws one hull per silhouette part, on one shared material", () => {
    for (const config of MORAY_SPECIES) {
      const hulls = hullsOf(new Moray(config));
      // The tube, the dorsal fin, and the five head primitives.
      expect(hulls).toHaveLength(7);

      const materials = new Set(hulls.map((hull) => hull.material));
      expect(materials.size).toBe(1);
      const [material] = [...materials] as MeshBasicMaterial[];
      // Back faces only — a hull, not an overlay — and inside the grade, so
      // the line is a value in the picture rather than a sticker over it.
      expect(material!.side).toBe(BackSide);
      expect(material!.toneMapped).toBe(true);
      expect(material!.fog).toBe(true);
    }
  });

  it("mixes the line from the species' own colour toward one of the two inks", () => {
    for (const config of MORAY_SPECIES) {
      const [hull] = hullsOf(new Moray(config));
      const line = (hull!.material as MeshBasicMaterial).color;
      const body = new Color(config.bodyColor);

      // A mix of the body with one ink or the other, and never an overshoot of
      // either end, on every channel.
      const mixes = [OUTLINE_INK, OUTLINE_HALO].some((hex) => {
        const ink = new Color(hex);
        return (["r", "g", "b"] as const).every(
          (channel) =>
            line[channel] >= Math.min(body[channel], ink[channel]) - 1e-6 &&
            line[channel] <= Math.max(body[channel], ink[channel]) + 1e-6,
        );
      });
      expect(mixes, `${config.id} line is not a mix of its body and either ink`).toBe(true);

      // Never black and never white, however dark or pale the animal: the
      // darkest thing in this world is a colour and so is the lightest.
      expect(Math.max(line.r, line.g, line.b)).toBeGreaterThan(0.01);
      expect(Math.min(line.r, line.g, line.b)).toBeLessThan(0.99);
    }
  });

  it("gives every species a line that can be seen against its own body", () => {
    // The reason there are two inks at all. One dark ink separated the
    // snowflake's line from its body by 0.43 of perceived value and the
    // zebra's by 0.045 — a contour that exists in the buffer and not in the
    // frame, on the one animal that is a dark shape in a dark hole.
    for (const config of MORAY_SPECIES) {
      const [hull] = hullsOf(new Moray(config));
      const line = (hull!.material as MeshBasicMaterial).color.clone().convertLinearToSRGB();
      const body = new Color(config.bodyColor).convertLinearToSRGB();
      const separation = Math.abs(luminance(line) - luminance(body));
      expect(separation, `${config.id} line separates by only ${separation.toFixed(3)}`).
        toBeGreaterThan(0.2);
    }
  });

  it("takes a pale animal's line well down in value, mixing in sRGB", () => {
    const snowflake = MORAY_SPECIES[0]!;
    const [hull] = hullsOf(new Moray(snowflake));
    const line = (hull!.material as MeshBasicMaterial).color;
    // Mixed in three's linear working space instead, a 0.6 blend leaves a cream
    // animal wearing a line at four tenths of its own value — a smudge. In the
    // space the palette was picked in it lands under a quarter of it.
    expect(luminance(line)).toBeLessThan(luminance(new Color(snowflake.bodyColor)) * 0.5);
  });

  it("binds the skinned hulls to the animal's own skeleton and pose", () => {
    for (const config of MORAY_SPECIES) {
      const moray = new Moray(config);
      const skinned = hullsOf(moray).filter(
        (hull): hull is SkinnedMesh => hull instanceof SkinnedMesh,
      );
      expect(skinned).toHaveLength(2);

      // One skeleton for the whole animal: the hull is not a copy of the pose,
      // it *is* the pose, which is what makes the line follow the animation.
      const skeletons = new Set(skinned.map((hull) => hull.skeleton));
      const surfaces = skinOf(moray).filter(
        (mesh): mesh is SkinnedMesh => mesh instanceof SkinnedMesh,
      );
      for (const surface of surfaces) {
        skeletons.add(surface.skeleton);
      }
      expect(skeletons.size).toBe(1);

      // Same geometry, same bind pose: two draw calls, one copy of everything.
      for (const hull of skinned) {
        const twin = surfaces.find((surface) => surface.geometry === hull.geometry);
        expect(twin).toBeDefined();
        expect(hull.bindMatrix.equals(twin!.bindMatrix)).toBe(true);
      }
    }
  });

  it("bakes a squashed head part's scale into its hull instead of carrying it", () => {
    const moray = new Moray(MORAY_SPECIES[2]!);
    for (const hull of hullsOf(moray)) {
      if (hull instanceof SkinnedMesh) {
        continue;
      }
      // Unit scale is the whole point: a constant push along an object-space
      // normal under a non-uniform scale is a line of two different widths.
      expect(hull.scale.x).toBe(1);
      expect(hull.scale.y).toBe(1);
      expect(hull.scale.z).toBe(1);
    }

    // And the copy still occupies exactly the space the part does, so nothing
    // the portrait or the focus cone measures off the head has moved.
    moray.asset.root.updateMatrixWorld(true);
    const parts = skinOf(moray).filter((mesh) => !(mesh instanceof SkinnedMesh));
    for (const hull of hullsOf(moray).filter((mesh) => !(mesh instanceof SkinnedMesh))) {
      const hullBox = new Box3().setFromObject(hull);
      const twin = parts.find((part) => {
        const partBox = new Box3().setFromObject(part);
        return (
          hullBox.min.distanceTo(partBox.min) < 1e-5 && hullBox.max.distanceTo(partBox.max) < 1e-5
        );
      });
      expect(twin).toBeDefined();
    }
  });

  it("leaves the eyes, the catchlights and the nasal tubes unlined", () => {
    const moray = new Moray(MORAY_SPECIES[3]!);
    for (const eye of [moray.asset.leftEye, moray.asset.rightEye]) {
      eye.traverse((object) => {
        expect(object.name).not.toBe(OUTLINE_NAME);
      });
    }
    // The dragon carries nasal appendages, and they hang off the upper jaw
    // beside the one hull that jaw is allowed.
    const jawHulls = moray.asset.upperJaw.children.filter((child) => child.name === OUTLINE_NAME);
    expect(jawHulls).toHaveLength(1);
  });

  it("keeps the line out of the shadow pass", () => {
    for (const hull of hullsOf(new Moray(MORAY_SPECIES[0]!))) {
      expect(hull.castShadow).toBe(false);
    }
  });

  it("pushes the shell out along the normal in the vertex shader", () => {
    const [hull] = hullsOf(new Moray(MORAY_SPECIES[0]!));
    const material = hull!.material as MeshBasicMaterial;
    const shader = {
      vertexShader: "void main() {\n  #include <begin_vertex>\n}",
      fragmentShader: "",
      uniforms: {},
    };
    // Nothing compiles in Node, so the injection is exercised directly: this is
    // the whole of the hull, and a chunk name three renames out from under it
    // would otherwise fail silently as an animal with no line at all.
    material.onBeforeCompile(
      shader as unknown as Parameters<MeshBasicMaterial["onBeforeCompile"]>[0],
      null as unknown as Parameters<MeshBasicMaterial["onBeforeCompile"]>[1],
    );
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
    expect(shader.vertexShader).toContain(`normalize( normal ) * ${OUTLINE_THICKNESS}`);
  });
});
