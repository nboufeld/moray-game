import { describe, expect, it } from "vitest";
import {
  Color,
  Euler,
  Frustum,
  Matrix4,
  PerspectiveCamera,
  Scene,
  Vector3,
  type FogExp2,
  type Sphere,
} from "three";
import { createMoraySkin } from "../src/creatures/morays/MorayPattern";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";
import { Lighting } from "../src/rendering/Lighting";
import { UnderwaterFog } from "../src/rendering/UnderwaterFog";
import {
  ABYSS_DEN,
  GATE_AXIS,
  abyssMood,
  canyonBlend,
  insideCanyonAirspace,
} from "../src/world/Abyss";
import { AbyssFlora } from "../src/world/AbyssFlora";
import { CollisionField } from "../src/world/CollisionField";
import { Reef } from "../src/world/Reef";
import { seabedHeight } from "../src/world/Seabed";

/**
 * The second biome's contracts (W-M3), and above all the one the whole
 * package leans on: the twilight is a *positional* modulation that is exactly
 * zero everywhere the bowl is playable, so every shipped capture, every
 * canonical pose and every e2e frame renders through arithmetic the canyon
 * never touches. That invariant is asserted here against the mood function,
 * against the live fog hook, and against the live lighting hook — three
 * statements of the same promise, because they fail differently.
 */

const PLAYER_RADIUS = 0.6;

/** A camera-shaped argument for the scene hooks. */
function invokeSceneHook(scene: Scene, position: Vector3): void {
  const camera = new PerspectiveCamera();
  camera.position.copy(position);
  // Three's declared callback is Object3D's six-argument one; at runtime the
  // renderer calls a scene with (renderer, scene, camera, renderTarget) and
  // the hook reads only the camera.
  (scene.onBeforeRender as (...args: unknown[]) => void)(null, scene, camera, null);
}

describe("the mood is exactly zero everywhere the bowl is playable", () => {
  it("returns 0 over the whole bowl at every depth, and above the surface line anywhere", () => {
    // The bowl in plan, at every height a diver or a capture can occupy —
    // including below the collision floor, which only the canyon can reach.
    for (let x = -30; x <= 30; x += 3) {
      for (let z = -30; z <= 30; z += 3) {
        if (Math.hypot(x, z) > 30) {
          continue;
        }
        for (const y of [-10, 0.2, 0.5, 1.2, 3, 7, 11.4]) {
          expect(abyssMood(x, y, z), `at (${x}, ${y}, ${z})`).toBe(0);
        }
      }
    }

    // And above y = 0.45 — the bowl's collision floor keeps the camera above
    // 1.2 — the mood is zero at *any* radius and azimuth, canyon included.
    for (let x = -55; x <= 55; x += 5) {
      for (let z = -55; z <= 55; z += 5) {
        for (const y of [0.45, 0.6, 2, 11.4]) {
          expect(abyssMood(x, y, z), `at (${x}, ${y}, ${z})`).toBe(0);
        }
      }
    }
  });

  it("rises smoothly to full twilight on the canyon floor", () => {
    expect(abyssMood(ABYSS_DEN.x, -6.5, ABYSS_DEN.z)).toBeGreaterThan(0.9);

    // Eased everywhere: walking the descent in small steps never jumps.
    let last = 0;
    for (let t = 0; t <= 1; t += 0.02) {
      const r = 26 + t * 18;
      const y = 1.5 - t * 8.5;
      const mood = abyssMood(GATE_AXIS.x * r, y, GATE_AXIS.z * r);
      // A fiftieth of the descent may move the mood by at most an eighth: no
      // pops, only ramps. (The bound is on this test's own stride, which is
      // ~0.4 m of travel per step — far coarser than a real swim frame.)
      expect(Math.abs(mood - last), `step at r=${r.toFixed(1)}`).toBeLessThan(0.125);
      last = mood;
    }
    expect(last).toBeGreaterThan(0.9);
  });

  it("writes the base fog back verbatim at zero mood, and only shifts it in the canyon", () => {
    const scene = new Scene();
    const fogSetup = new UnderwaterFog();
    fogSetup.applyTo(scene);
    const fog = scene.fog as FogExp2;
    const baseColor = fog.color.getHex();
    const baseDensity = fog.density;

    // A frame rendered from the spawn pose: untouched, to the bit.
    invokeSceneHook(scene, new Vector3(0, 2, 22));
    expect(fog.color.getHex()).toBe(baseColor);
    expect(fog.density).toBe(baseDensity);
    expect(scene.backgroundIntensity).toBe(1);

    // A frame rendered from the canyon floor: denser, and colder in green.
    invokeSceneHook(scene, new Vector3(ABYSS_DEN.x, -6.5, ABYSS_DEN.z));
    expect(fog.density).toBeGreaterThan(baseDensity + 0.015);
    expect(fog.color.g).toBeLessThan(new Color(baseColor).g * 0.5);
    expect(scene.backgroundIntensity).toBeLessThan(0.7);

    // And back out: the next bowl frame restores the base exactly.
    invokeSceneHook(scene, new Vector3(10, 3, 12));
    expect(fog.color.getHex()).toBe(baseColor);
    expect(fog.density).toBe(baseDensity);
    expect(scene.backgroundIntensity).toBe(1);
  });

  it("leaves the light rig at its shipped levels at zero mood", () => {
    const scene = new Scene();
    const lighting = new Lighting();
    lighting.addTo(scene);
    const baseSun = lighting.sun.intensity;

    invokeSceneHook(scene, new Vector3(0, 2, 22));
    expect(lighting.sun.intensity).toBe(baseSun);

    invokeSceneHook(scene, new Vector3(ABYSS_DEN.x, -6.5, ABYSS_DEN.z));
    expect(lighting.sun.intensity).toBeLessThan(baseSun * 0.5);

    invokeSceneHook(scene, new Vector3(7.5, 1.3, 10.5));
    expect(lighting.sun.intensity).toBe(baseSun);
  });
});

describe("the diver is bounded", () => {
  const reef = new Reef();
  const collision = new CollisionField(reef.colliders, reef.bounds);

  /** True where collision leaves the point alone. */
  function free(point: Vector3): boolean {
    const resolved = collision.resolve(point.clone(), PLAYER_RADIUS);
    return resolved.distanceToSquared(point) < 1e-6;
  }

  it("can swim from the bowl through the gate down to the den's approach", () => {
    for (const r of [24, 26, 29, 31.5, 33.5, 35.5, 37.5, 39.5, 41.5, 43]) {
      const x = GATE_AXIS.x * r;
      const z = GATE_AXIS.z * r;
      const y = Math.max(1.9, seabedHeight(x, z) + 1.9);
      expect(free(new Vector3(x, y, z)), `blocked at r=${r} (y=${y.toFixed(1)})`).toBe(true);
    }
  });

  it("holds everywhere else past the rim: a free point is in the bowl's box or the canyon", () => {
    for (let r = 31; r <= 55; r += 2) {
      for (let step = -12; step <= 12; step++) {
        const theta = Math.atan2(GATE_AXIS.z, GATE_AXIS.x) + step * 0.1;
        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;
        for (const y of [1.5, 4.5, 8]) {
          if (!free(new Vector3(x, y, z))) {
            continue;
          }
          const inBox =
            Math.abs(x) <= 30 - PLAYER_RADIUS &&
            Math.abs(z) <= 30 - PLAYER_RADIUS &&
            y >= 0.6 + PLAYER_RADIUS &&
            y <= 12 - PLAYER_RADIUS;
          expect(
            inBox || insideCanyonAirspace(x, z),
            `free outside both bounds at (${x.toFixed(1)}, ${y}, ${z.toFixed(1)})`,
          ).toBe(true);
        }
      }
    }
  });

  it("never lets the body into the carved ground", () => {
    // Inside the canyon the box's flat floor is meaningless; the annex floor
    // rides the carve. Resolve a column of too-deep points and check they
    // come back above the ground.
    for (const r of [33, 37, 41, 45]) {
      const x = GATE_AXIS.x * r;
      const z = GATE_AXIS.z * r;
      const resolved = collision.resolve(new Vector3(x, -20, z), PLAYER_RADIUS);
      expect(resolved.y, `at r=${r}`).toBeGreaterThan(seabedHeight(resolved.x, resolved.z));
    }
  });

  it("stands the shelf-lip stones off the corridor, as scenery only (W-O1)", () => {
    let stones:
      | {
          count: number;
          getMatrixAt: (i: number, m: Matrix4) => void;
          position: Vector3;
          computeBoundingSphere: () => void;
          boundingSphere: { center: Vector3; radius: number } | null;
        }
      | undefined;
    reef.group.traverse((object) => {
      if (object.name === "abyss-shelf-stones") {
        stones = object as unknown as typeof stones;
      }
    });
    expect(stones).toBeDefined();
    expect(stones!.count).toBe(9);

    // Scenery by construction: the look-back's silhouettes may never join
    // the sightline or collision contracts.
    for (const mesh of reef.obstructionMeshes) {
      expect(mesh.name).not.toBe("abyss-shelf-stones");
    }

    // Every stone keeps ≥ 1.7 m of lateral clearance off the canyon axis,
    // which the descent corridor's ±0.3 m sightline sweep runs down.
    const matrix = new Matrix4();
    for (let i = 0; i < stones!.count; i++) {
      stones!.getMatrixAt(i, matrix);
      const x = matrix.elements[12]! + stones!.position.x;
      const z = matrix.elements[14]! + stones!.position.z;
      const lateral = Math.abs(-GATE_AXIS.z * x + GATE_AXIS.x * z);
      expect(lateral, `stone ${i}`).toBeGreaterThan(1.7);
    }

    // An honest instance-aware sphere, wholly past the bowl. It is local to
    // the mesh, which is parented at the shelf's centre — add the node's own
    // position to read it in world terms (the node carries no rotation).
    stones!.computeBoundingSphere();
    const sphere = stones!.boundingSphere;
    expect(sphere).not.toBeNull();
    const reach =
      Math.hypot(
        sphere!.center.x + stones!.position.x,
        sphere!.center.z + stones!.position.z,
      ) - sphere!.radius;
    expect(reach).toBeGreaterThan(27);
  });

  it("keeps the fifth hiding spot on the canyon floor, facing the gate", () => {
    const spot = reef.hidingSpots.find((s) => s.speciesId === "abyss");
    expect(spot).toBeDefined();
    expect(reef.hidingSpots).toHaveLength(5);
    expect(Math.hypot(spot!.position.x, spot!.position.z)).toBeCloseTo(44, 0);
    // The head sits in the twilight, metres below dune level…
    expect(spot!.position.y).toBeLessThan(-5);
    // …and the mood there is full.
    expect(abyssMood(spot!.position.x, spot!.position.y, spot!.position.z)).toBeGreaterThan(0.85);
    // Facing back up the shelf: its forward vector points toward the origin.
    const forward = new Vector3(Math.sin(spot!.facing), 0, Math.cos(spot!.facing));
    expect(forward.dot(new Vector3(GATE_AXIS.x, 0, GATE_AXIS.z))).toBeLessThan(-0.99);
  });
});

describe("the twilight flora", () => {
  it("is deterministic from its seed", () => {
    const first = new AbyssFlora();
    const second = new AbyssFlora();
    const motesOf = (flora: AbyssFlora): Float32Array => {
      let found: Float32Array | undefined;
      flora.group.traverse((object) => {
        if (object.name === "abyss-motes") {
          const attribute = (object as unknown as { geometry: { attributes: { position: { array: Float32Array } } } })
            .geometry.attributes.position;
          found = attribute.array;
        }
      });
      expect(found).toBeDefined();
      return found!;
    };
    expect([...motesOf(first)]).toEqual([...motesOf(second)]);
    first.dispose();
    second.dispose();
  });

  it("keeps the ghost fronds out of the den's approach corridor", () => {
    const flora = new AbyssFlora();
    let checked = 0;
    flora.group.traverse((object) => {
      if (object.name !== "abyss-fronds") {
        return;
      }
      const position = (object as unknown as { geometry: { attributes: { position: { array: Float32Array } } } })
        .geometry.attributes.position.array;
      for (let i = 0; i < position.length; i += 3) {
        const x = position[i]!;
        const z = position[i + 2]!;
        // Lateral distance from the canyon's axis, which the corridor runs down.
        const lateral = Math.abs(-GATE_AXIS.z * x + GATE_AXIS.x * z);
        expect(lateral, `frond vertex at (${x.toFixed(1)}, ${z.toFixed(1)})`).toBeGreaterThan(2.6);
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(100);
    flora.dispose();
  });

  it("is culled from every canonical in-bowl frustum, by its own bounding volumes", () => {
    // The layer's in-bowl cost rests on ordinary frustum culling. This is the
    // claim itself rather than a proxy for it: rebuild each canonical camera
    // (default 70° fov at the shot set's 16:9) and assert no flora bounding
    // sphere intersects any of their frusta.
    const poses: readonly { p: [number, number, number]; yaw: number; pitch: number }[] = [
      { p: [0, 2, 22], yaw: 0, pitch: 0 },
      { p: [10, 3, 12], yaw: 0.72, pitch: -0.1 },
      { p: [0, 2, 8], yaw: 0, pitch: -0.09 },
      { p: [0, 2, 18], yaw: 0, pitch: -0.05 },
      { p: [7.5, 1.3, 10.5], yaw: 0.5, pitch: -0.25 },
    ];
    const frusta = poses.map((pose) => {
      const camera = new PerspectiveCamera(70, 16 / 9, 0.1, 160);
      camera.position.set(...pose.p);
      camera.quaternion.setFromEuler(new Euler(pose.pitch, pose.yaw, 0, "YXZ"));
      camera.updateMatrixWorld(true);
      const view = new Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse,
      );
      return new Frustum().setFromProjectionMatrix(view);
    });

    const flora = new AbyssFlora();
    flora.group.updateMatrixWorld(true);
    let meshes = 0;
    flora.group.traverse((object) => {
      const renderable = object as {
        geometry?: { boundingSphere: Sphere | null };
        isInstancedMesh?: boolean;
        computeBoundingSphere?: () => void;
        boundingSphere?: Sphere | null;
      };
      if (!renderable.geometry) {
        return;
      }
      meshes++;
      // An InstancedMesh culls on its own instance-aware sphere; everything
      // else culls on the geometry's. The flora is built in world space, so
      // the spheres are already in the frusta's coordinates.
      let sphere: Sphere | null;
      if (renderable.isInstancedMesh) {
        renderable.computeBoundingSphere!();
        sphere = renderable.boundingSphere ?? null;
      } else {
        sphere = renderable.geometry.boundingSphere;
      }
      expect(sphere, `${object.name} bounding sphere`).not.toBeNull();
      for (const [index, frustum] of frusta.entries()) {
        expect(
          frustum.intersectsSphere(sphere!),
          `${object.name} enters canonical frustum ${index}`,
        ).toBe(false);
      }
    });
    expect(meshes).toBeGreaterThanOrEqual(5);
    flora.dispose();
  });
});

describe("the abyssal moray", () => {
  it("ships procedural-only, dark-bodied, pale-speckled", () => {
    const abyss = MORAY_SPECIES.find((s) => s.id === "abyss");
    expect(abyss).toBeDefined();
    // No painted albedo, deliberately: the procedural skin is the documented
    // fallback path and this species makes it a first-class look.
    expect(abyss!.albedoAsset).toBeUndefined();
    expect(abyss!.pattern).toBe("speckle");

    // The speckle branch builds, and the pattern is genuinely sparse pale
    // points: much less marking coverage than the snowflake's rosettes.
    const skin = createMoraySkin(abyss!);
    expect(skin.map.image.width).toBeGreaterThan(0);
    const body = new Color(abyss!.bodyColor);
    const pattern = new Color(abyss!.patternColor);
    // Dark violet-charcoal under moonlit speckle: the body far below the
    // marking in value, red held above green (violet, not navy).
    expect(pattern.getHSL({ h: 0, s: 0, l: 0 }).l - body.getHSL({ h: 0, s: 0, l: 0 }).l)
      .toBeGreaterThan(0.4);
    expect(body.r).toBeGreaterThan(body.g);
  });

  it("carves nothing where the bowl's own guard tables look", () => {
    // Belt over the seabedRelief suite's braces: the carve is zero at every
    // frozen literal's position and along the spawn corridor.
    for (const [x, z] of [
      [0, 1.5],
      [-13, 6],
      [13, 6],
      [-6, -9],
      [0, 22],
      [5, 9],
    ] as const) {
      expect(canyonBlend(x, z)).toBe(0);
    }
  });
});
