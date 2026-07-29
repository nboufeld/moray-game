import { describe, expect, it } from "vitest";
import { Color, Raycaster, Vector3 } from "three";
import { MorayRegistry } from "../src/creatures/morays/MorayRegistry";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";
import { createMoraySkin } from "../src/creatures/morays/MorayPattern";
import { CollisionField } from "../src/world/CollisionField";
import { Reef } from "../src/world/Reef";
import { seabedHeight } from "../src/world/Seabed";
import { WING_DENS } from "../src/world/wings/WingDens";
import { wingById } from "../src/world/wings/WingRegistry";

/**
 * W6: the wave-8 morays — species, skin and den — proven the way the abyss
 * moray is proven in `tests/reefSightlines.test.ts`. A den whose head cannot
 * be seen cannot be discovered, so each wing den stands where a diver can
 * actually hold station (floor-relative eye height, down the wing's own
 * corridor) and raycasts against the same `obstructionMeshes` the game does.
 */

const PLAYER_RADIUS = 0.6;
/** Matches `DEFAULT_FOCUS_PARAMS`; focus is impossible outside this band. */
const MAX_DISTANCE = 14;

const reef = new Reef();
// Outside a renderer nothing walks the scene graph, and a mesh whose world
// matrix is still the identity raycasts as though it stood at the origin.
reef.group.updateMatrixWorld(true);
const collision = new CollisionField(reef.colliders, reef.bounds);
const raycaster = new Raycaster();

/** The same test `Game.isObstructed` runs, including its 0.6m head margin. */
function isObstructed(from: Vector3, target: Vector3): boolean {
  const direction = new Vector3().subVectors(target, from);
  const distance = direction.length();
  direction.multiplyScalar(1 / distance);
  raycaster.set(from, direction);
  raycaster.far = Math.max(0.05, distance - 0.6);
  return raycaster.intersectObjects(reef.obstructionMeshes, false).length > 0;
}

/** True where a diver could hold station: collision leaves the point alone. */
function reachable(point: Vector3): boolean {
  const resolved = collision.resolve(point.clone(), PLAYER_RADIUS);
  return resolved.distanceToSquared(point) < 1e-6;
}

describe("the wave-8 species configs", () => {
  const ids = ["golden-dwarf-moray", "frost-moray", "ember-moray", "pearl-moray"] as const;

  it("registers all four in the shared registry", () => {
    const registry = new MorayRegistry();
    for (const id of ids) {
      expect(registry.has(id), id).toBe(true);
    }
  });

  it("pins each species' body plan and procedural skin to the brief", () => {
    const byId = new Map(MORAY_SPECIES.map((s) => [s.id, s]));
    const expectConfig = (
      id: string,
      archetype: string,
      pattern: string,
      lengthScale: number,
      girthScale: number,
    ) => {
      const config = byId.get(id);
      expect(config, id).toBeDefined();
      expect(config!.archetype).toBe(archetype);
      expect(config!.pattern).toBe(pattern);
      expect(config!.lengthScale).toBe(lengthScale);
      expect(config!.girthScale).toBe(girthScale);
      // Like the abyss: the procedural skin is the shipping surface, no
      // painted albedo to wait for.
      expect(config!.albedoAsset, id).toBeUndefined();
    };
    expectConfig("golden-dwarf-moray", "compact", "plain", 0.75, 0.7);
    expectConfig("frost-moray", "robust", "bands", 1.1, 1.3);
    expectConfig("ember-moray", "standard", "speckle", 1.0, 0.95);
    expectConfig("pearl-moray", "standard", "plain", 1.0, 0.75);
  });

  it("keeps the two pale and dark bodies on the value key: red above green", () => {
    const byId = new Map(MORAY_SPECIES.map((s) => [s.id, s]));
    for (const id of ["ember-moray", "pearl-moray"]) {
      const body = new Color(byId.get(id)!.bodyColor);
      expect(body.r, `${id} red above green`).toBeGreaterThan(body.g);
    }
  });

  it("paints every species' procedural skin — markings, not a flat fill", () => {
    const byId = new Map(MORAY_SPECIES.map((s) => [s.id, s]));
    for (const id of ids) {
      const config = byId.get(id)!;
      const skin = createMoraySkin(config);
      const data = skin.map.image.data as Uint8Array;
      expect(skin.map.image.width).toBe(256);
      expect(data.length).toBe(256 * 256 * 4);

      // Counter-shading alone means no channel is constant...
      let min = 255;
      let max = 0;
      const body = new Color(config.bodyColor);
      const pattern = new Color(config.patternColor);
      let patternPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        min = Math.min(min, data[i]!, data[i + 1]!, data[i + 2]!);
        max = Math.max(max, data[i]!, data[i + 1]!, data[i + 2]!);
        const dr = data[i]! / 255;
        const dg = data[i + 1]! / 255;
        const db = data[i + 2]! / 255;
        const toPattern = Math.hypot(dr - pattern.r, dg - pattern.g, db - pattern.b);
        const toBody = Math.hypot(dr - body.r, dg - body.g, db - body.b);
        if (toPattern < toBody * 0.8) {
          patternPixels++;
        }
      }
      expect(max - min, `${id} value range`).toBeGreaterThan(24);
      // ...and the markings actually show. Bands and speckle pool their
      // colour into real markings that read against the body colour; the
      // plain species wear theirs as a faint mottle that never reaches its
      // own colour by design, so their bar is different — the pixel must
      // depart from the bare counter-shaded body (the shade ramp the skin
      // paints underneath every marking, which depends on `u` alone).
      const markingShare = patternPixels / (256 * 256);
      if (config.pattern === "plain") {
        let mottled = 0;
        for (let y = 0; y < 256; y++) {
          for (let x = 0; x < 256; x++) {
            const u = (x + 0.5) / 256;
            const dorsal = 0.5 - 0.5 * Math.cos(u * Math.PI * 2);
            const shade = 0.86 + (1 - dorsal) * 0.28;
            const i = (y * 256 + x) * 4;
            const residual = Math.hypot(
              data[i]! / 255 - body.r * shade,
              data[i + 1]! / 255 - body.g * shade,
              data[i + 2]! / 255 - body.b * shade,
            );
            if (residual > 0.03) {
              mottled++;
            }
          }
        }
        expect(mottled / (256 * 256), `${id} mottle present`).toBeGreaterThan(0.02);
      } else {
        expect(markingShare, `${id} markings present`).toBeGreaterThan(0.02);
      }
    }
  });
});

describe("the wave-8 dens sit where their specs say", () => {
  it("resolves every spec against its wing's carved floor", () => {
    for (const spec of WING_DENS) {
      const spot = reef.hidingSpots.find((s) => s.speciesId === spec.speciesId);
      expect(spot, spec.speciesId).toBeDefined();
      const wing = wingById(spec.wingId);
      const { x, y, z } = spot!.position;
      // The radius the spec asks for, the azimuth its `across` allows, and a
      // head riding `seabedHeight` exactly — the same contract the abyss den
      // keeps with the canyon floor. The ice grotto's azimuth (5.67 rad)
      // sits against the ±π boundary of `atan2`, so the difference is taken
      // on the circle, the way `Abyss.angleBetween` takes it.
      expect(Math.hypot(x, z), spec.speciesId).toBeCloseTo(spec.r, 6);
      const raw = Math.abs(Math.atan2(z, x) - wing.azimuth) % (Math.PI * 2);
      const away = raw > Math.PI ? Math.PI * 2 - raw : raw;
      expect(away, spec.speciesId).toBeLessThanOrEqual(0.03);
      expect(y - seabedHeight(x, z), spec.speciesId).toBeCloseTo(spec.headAbove, 6);
    }
  });
});

describe("every wave-8 moray can be seen from its wing's corridor", () => {
  for (const spec of WING_DENS) {
    it(`${spec.speciesId} is visible down the ${spec.wingId} approach`, () => {
      const spot = reef.hidingSpots.find((s) => s.speciesId === spec.speciesId)!;
      const head = spot.position;
      const forward = new Vector3(Math.sin(spot.facing), 0, Math.cos(spot.facing));
      const right = new Vector3(forward.z, 0, -forward.x);

      let reachableCount = 0;
      let clear = 0;
      // The abyss-den sampling, narrowed a touch for the wings' slimmer
      // floor band: eyes a metre and change over the carved floor, on the
      // corridor a diver actually swims in from the gate.
      for (const distance of [3, 4.5, 6, 7.5, 9, 11]) {
        for (const offset of [-0.3, -0.15, 0, 0.15, 0.3]) {
          for (const above of [1.1, 1.6, 2.3]) {
            const from = head
              .clone()
              .addScaledVector(forward, distance)
              .addScaledVector(right, distance * offset);
            from.setY(seabedHeight(from.x, from.z) + above);
            if (from.distanceTo(head) > MAX_DISTANCE || !reachable(from)) {
              continue;
            }
            reachableCount++;
            if (!isObstructed(from, head)) {
              clear++;
            }
          }
        }
      }

      expect(reachableCount).toBeGreaterThan(20);
      expect(clear / reachableCount).toBeGreaterThan(0.75);
    });

    it(`${spec.speciesId}'s own floor never rises into its sightline`, () => {
      // The terrain is not an obstruction mesh, so the raycast above cannot
      // see it — but a swell between the corridor and the den would hide the
      // head as surely as a boulder. Walk the approach at eye height and
      // check the ground under the line of sight stays below it.
      const spot = reef.hidingSpots.find((s) => s.speciesId === spec.speciesId)!;
      const head = spot.position;
      const forward = new Vector3(Math.sin(spot.facing), 0, Math.cos(spot.facing));

      for (const distance of [4, 6, 8, 10]) {
        const from = head.clone().addScaledVector(forward, distance);
        from.setY(seabedHeight(from.x, from.z) + 1.5);
        const steps = 20;
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const x = from.x + (head.x - from.x) * t;
          const z = from.z + (head.z - from.z) * t;
          const lineY = from.y + (head.y - from.y) * t;
          expect(
            lineY - seabedHeight(x, z),
            `ground clears the sightline at t=${t} from ${distance}m`,
          ).toBeGreaterThan(0.15);
        }
      }
    });
  }
});
