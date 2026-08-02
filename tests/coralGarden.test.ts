import { describe, expect, it } from "vitest";
import { InstancedMesh, Vector2 } from "three";
import {
  CREVICE_CLEARANCE,
  CoralField,
  coralFeedingSites,
  isClear,
  type ClusterSite,
} from "../src/world/CoralField";
import {
  CORAL_MODELS,
  CORAL_WASHES,
  coralGeometry,
  fanTexture,
  type CoralKind,
} from "../src/world/CoralShapes";
import { Reef } from "../src/world/Reef";
import { assetsPending, requestAlbedo, requestModel } from "../src/rendering/AssetLibrary";
import { SEEDS } from "../src/util/Random";

/**
 * The garden, built in plain Node.
 *
 * Everything here is construction-time: the shapes, the placement rules and
 * the buckets they are flattened into. That is deliberate and it is the same
 * rule the sanctuary is built under — a coral field that needed a WebGL
 * context to exist could not be checked at all, and the three things most
 * worth checking about this one (that it clears the crevices, that it is one
 * garden and not two, and that it fits in its draw-call budget) are all
 * decided before a frame is drawn.
 */

const KINDS: CoralKind[] = [
  "staghorn",
  "brain",
  "plateStack",
  "tube",
  "fan",
  "branch",
  "boulder",
  "polyp",
];

/** What the round's ledger allows the whole garden, glowing variants included. */
const DRAW_CALL_BUDGET = 14;

describe("coral shapes", () => {
  it("builds every silhouette with geometry in it", () => {
    for (const kind of KINDS) {
      const geometry = coralGeometry(kind);
      const position = geometry.attributes.position;
      expect(position, kind).toBeDefined();
      expect(position!.count, kind).toBeGreaterThan(0);
      for (let i = 0; i < position!.count; i++) {
        expect(Number.isFinite(position!.getY(i)), kind).toBe(true);
      }
    }
  });

  it("caches one geometry per silhouette", () => {
    expect(coralGeometry("brain")).toBe(coralGeometry("brain"));
  });

  /**
   * The contract the model swap rests on. A Blender piece lands on an
   * `InstancedMesh` whose matrices were written for the stand-in, so if the two
   * disagree about what one unit is, the garden jumps when the file arrives.
   *
   * W11 adds the fan and keeps the branch apart: four of the five modelled
   * kinds share the unit footprint, and the fifth never did.
   */
  it("authors the modelled and mid pieces in the unit footprint", () => {
    for (const kind of ["staghorn", "brain", "plateStack", "tube", "fan"] as CoralKind[]) {
      const geometry = coralGeometry(kind);
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      expect(box.min.y, kind).toBeCloseTo(0, 3);
      expect(box.max.y, kind).toBeCloseTo(1, 3);
      expect((box.min.x + box.max.x) / 2, kind).toBeCloseTo(0, 3);
    }
  });

  it("authors the branch in the capsule frame its builder was written against", () => {
    // `CoralField.addBranching` composes each finger around a centred capsule
    // 1.42 tall, and that builder is frozen — so the sculpted antler, GLB and
    // stand-in alike, lives in the capsule's frame rather than the unit one,
    // and this is the honest statement of what "footprint" means there.
    const geometry = coralGeometry("branch");
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.min.y).toBeCloseTo(-0.71, 3);
    expect(box.max.y).toBeCloseTo(0.71, 3);
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 3);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 3);
  });

  it("gives the modelled pieces a vertex-colour multiplier that only darkens", () => {
    // The branch joins the landmarks since W11: its antler stand-in now
    // carries paint, because the GLB's COLOR_0 only reaches the shader when
    // the stand-in asked for `vertexColors` at construction. The tube's
    // stand-in keeps its calmer ceiling (its exterior tops out under 0.8 by
    // design, the no-cream-rim rule), and the fan's sheet carries no paint —
    // its silhouette lives in alpha — so neither is in this list.
    for (const kind of ["staghorn", "brain", "branch"] as CoralKind[]) {
      const color = coralGeometry(kind).attributes.color;
      expect(color, kind).toBeDefined();
      let max = 0;
      for (let i = 0; i < color!.count; i++) {
        max = Math.max(max, color!.getX(i), color!.getY(i), color!.getZ(i));
      }
      // Over 1.0 is clipped in the models' normalised accessor, so a stand-in
      // that went brighter would change value the moment its GLB landed.
      expect(max, kind).toBeLessThanOrEqual(1.0001);
      expect(max, kind).toBeGreaterThan(0.8);
    }
  });

  it("gives the generated fan a silhouette in its alpha", () => {
    const data = fanTexture().image.data as Uint8Array;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if ((data[i] ?? 0) > 128) {
        opaque++;
      }
    }
    const share = opaque / (data.length / 4);
    // A fan is mostly water. Solid is a leaf and empty is nothing at all.
    expect(share).toBeGreaterThan(0.03);
    expect(share).toBeLessThan(0.5);
  });
});

describe("coral garden", () => {
  it("fits the whole garden inside the draw-call budget", () => {
    const field = new CoralField(SEEDS.coral);
    expect(field.group.children.length).toBeLessThanOrEqual(DRAW_CALL_BUDGET);
    for (const child of field.group.children) {
      expect(child).toBeInstanceOf(InstancedMesh);
      expect((child as InstancedMesh).count).toBeGreaterThan(0);
    }
  });

  it("grows all five new species as well as the fill", () => {
    const field = new CoralField(SEEDS.coral);
    const grown = new Set(field.meshes.map((mesh) => mesh.name));
    for (const kind of KINDS) {
      expect(grown.has(kind), kind).toBe(true);
    }
  });

  it("is materially denser than the garden it replaces", () => {
    const field = new CoralField(SEEDS.coral);
    const instances = field.meshes.reduce((sum, mesh) => sum + mesh.count, 0);
    // The old field was five bommies of 57 heads, around 390 instances.
    expect(instances).toBeGreaterThan(500);
  });

  it("places the same garden twice from one seed", () => {
    const a = new CoralField(SEEDS.coral);
    const b = new CoralField(SEEDS.coral);
    expect(a.meshes.length).toBe(b.meshes.length);
    a.meshes.forEach((mesh, index) => {
      const other = b.meshes[index]!;
      expect(other.name).toBe(mesh.name);
      expect(other.count).toBe(mesh.count);
      expect(Array.from(other.instanceMatrix.array)).toEqual(Array.from(mesh.instanceMatrix.array));
    });
  });

  it("takes a room's own sites and tone without any of the reef's", () => {
    const sites: readonly ClusterSite[] = [{ x: 3, z: -4, heads: 5 }];
    const field = new CoralField(SEEDS.sanctuaryCoral, sites, { min: 0.88, max: 1.3 });
    expect(field.feedingSites).toHaveLength(1);
    expect(field.meshes.length).toBeGreaterThan(0);
    for (const contact of field.contacts) {
      expect(Math.hypot(contact.x - 3, contact.z + 4)).toBeLessThan(6);
    }
  });

  it("releases its materials and meshes on dispose, twice over", () => {
    const field = new CoralField(SEEDS.coral);
    field.dispose();
    field.dispose();
    expect(field.meshes).toHaveLength(0);
  });
});

describe("coral clearances", () => {
  /**
   * The one rule this package is not allowed to get wrong.
   *
   * Coral is not in `Reef.obstructionMeshes`, so a thicket in a crevice mouth
   * would never fail a sightline test — the raycast would go straight through
   * it and the discovery would still fire. What it would cost is the player's
   * ability to *see* the animal, which no automated check downstream of this
   * one can notice. So the geometry of the rule is asserted here, and against
   * the real crevice positions rather than this file's copy of them.
   */
  it("keeps six metres of water around every crevice and mound", () => {
    const reef = new Reef();
    const field = new CoralField(SEEDS.coral);
    // At least five: the four bowl crevices and the abyss den (W-M3), plus
    // however many wing dens the wave-8 moray package has landed by the time
    // this runs — the count is theirs mid-wave, so what is pinned here is the
    // floor, and the loop below covers every den present either way. The
    // garden — all of it in-bowl — stands clear of the canyon and wing spots
    // for free.
    expect(reef.hidingSpots.length).toBeGreaterThanOrEqual(5);

    for (const spot of reef.hidingSpots) {
      const head = new Vector2(spot.position.x, spot.position.z);
      // The mound sits 3.9 m behind the head, on the crevice's own axis.
      const mound = new Vector2(
        spot.position.x - Math.sin(spot.facing) * 3.9,
        spot.position.z - Math.cos(spot.facing) * 3.9,
      );
      for (const contact of field.contacts) {
        const at = new Vector2(contact.x, contact.z);
        expect(at.distanceTo(head), `${spot.speciesId} head`).toBeGreaterThanOrEqual(
          CREVICE_CLEARANCE,
        );
        expect(at.distanceTo(mound), `${spot.speciesId} mound`).toBeGreaterThanOrEqual(
          CREVICE_CLEARANCE,
        );
      }
    }
  });

  it("leaves the approach corridors and the anemone garden's disc empty", () => {
    const field = new CoralField(SEEDS.coral);
    for (const contact of field.contacts) {
      expect(isClear(contact.x, contact.z), `${contact.x},${contact.z}`).toBe(true);
    }
    // Down the spawn line, across the ribbon/zebra band, south to the dragon,
    // and where W-L5's anemones are going.
    expect(isClear(0, 12)).toBe(false);
    expect(isClear(9, 6)).toBe(false);
    expect(isClear(-6, -3)).toBe(false);
    expect(isClear(7.5, 8.5)).toBe(false);
    expect(isClear(-13.5, -3)).toBe(true);
  });
});

describe("feeding sites", () => {
  it("reports one per cluster, above the sand, deterministically", () => {
    const sites = coralFeedingSites();
    expect(sites.length).toBeGreaterThanOrEqual(5);
    for (const site of sites) {
      expect(Number.isFinite(site.x)).toBe(true);
      expect(site.y).toBeGreaterThan(0);
    }
    const again = coralFeedingSites();
    expect(again.map((v) => v.toArray())).toEqual(sites.map((v) => v.toArray()));
  });

  it("agrees with the garden the field actually built", () => {
    const field = new CoralField(SEEDS.coral);
    expect(field.feedingSites.map((v) => v.toArray())).toEqual(
      coralFeedingSites().map((v) => v.toArray()),
    );
  });
});

describe("model requests", () => {
  /**
   * The library is inert without a `window`, which is what lets every test
   * above build the garden at all. A model request has to keep that promise:
   * no callback, no throw, nothing left in flight for `whenAssetsSettled` to
   * wait on forever.
   */
  it("is inert in Node and leaves nothing pending", () => {
    let delivered = false;
    expect(() => requestModel(CORAL_MODELS.brain!, () => (delivered = true))).not.toThrow();
    expect(delivered).toBe(false);
    expect(assetsPending()).toBe(false);
  });

  it("names a file for each modelled species and nothing else", () => {
    // Five since W11: the two landmarks plus the tube, the fan and the
    // branch, the three kinds the owner called lazy.
    expect(Object.keys(CORAL_MODELS).sort()).toEqual(["brain", "branch", "fan", "staghorn", "tube"]);
    for (const path of Object.values(CORAL_MODELS)) {
      expect(path).toMatch(/^models\/.+\.glb$/);
    }
  });
});

describe("wash requests", () => {
  /**
   * W-O3's painted skins ride the same contract as the models above: inert in
   * Node, so every garden in this file builds with its procedural skins — and
   * the `SHOT_NO_ASSETS` build ships exactly those, which is why the fallback
   * maps stay authored rather than becoming placeholders.
   */
  it("is inert in Node and leaves nothing pending", () => {
    let delivered = false;
    expect(() => requestAlbedo(CORAL_WASHES.brain!, () => (delivered = true))).not.toThrow();
    expect(delivered).toBe(false);
    expect(assetsPending()).toBe(false);
  });

  it("names a wash for the two species the critic called flat, and nothing else", () => {
    expect(Object.keys(CORAL_WASHES).sort()).toEqual(["brain", "plateStack"]);
    for (const path of Object.values(CORAL_WASHES)) {
      expect(path).toMatch(/^world\/coral-.+-wash\.png$/);
    }
  });
});
