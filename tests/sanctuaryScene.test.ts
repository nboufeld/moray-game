import { describe, expect, it } from "vitest";
import {
  InstancedMesh,
  Mesh,
  Scene,
  SkinnedMesh,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Skeleton,
} from "three";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";
import { SanctuaryLife } from "../src/sanctuary/SanctuaryLife";
import { SANCTUARY_LANES, SanctuaryScene } from "../src/sanctuary/SanctuaryScene";

function collectResources(roots: readonly Object3D[]): {
  geometries: Set<BufferGeometry>;
  materials: Set<Material>;
  skeletons: Set<Skeleton>;
} {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const skeletons = new Set<Skeleton>();
  for (const root of roots) {
    root.traverse((object) => {
      if (!(object instanceof Mesh)) {
        return;
      }
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
      }
      if (object instanceof SkinnedMesh) {
        skeletons.add(object.skeleton);
      }
    });
  }
  return { geometries, materials, skeletons };
}

describe("SanctuaryScene", () => {
  it("replaces residents instead of stacking them up", () => {
    const sanctuary = new SanctuaryScene();
    const fixtures = sanctuary.scene.children.length;

    sanctuary.setSpecies(MORAY_SPECIES);
    const populated = sanctuary.scene.children.length;
    expect(sanctuary.residentCount).toBe(MORAY_SPECIES.length);
    expect(populated).toBe(fixtures + MORAY_SPECIES.length);

    sanctuary.setSpecies(MORAY_SPECIES);
    expect(sanctuary.scene.children.length).toBe(populated);
    expect(sanctuary.residentCount).toBe(MORAY_SPECIES.length);
  });

  it("releases the GPU resources of residents it removes", () => {
    const sanctuary = new SanctuaryScene();
    const fixtures = new Set(sanctuary.scene.children);

    sanctuary.setSpecies(MORAY_SPECIES);
    const residentRoots = sanctuary.scene.children.filter((child) => !fixtures.has(child));
    const { geometries, materials, skeletons } = collectResources(residentRoots);
    expect(geometries.size).toBeGreaterThan(0);
    expect(materials.size).toBeGreaterThan(0);
    // A skinned body brings a skeleton, and a skeleton owns a texture of bone
    // matrices that nothing else releases.
    expect(skeletons.size).toBe(MORAY_SPECIES.length);

    const disposed = new Set<BufferGeometry | Material>();
    for (const resource of [...geometries, ...materials]) {
      resource.addEventListener("dispose", () => disposed.add(resource));
    }
    // A skeleton has no dispose event to listen for, and in Node it has no
    // bone texture to check for either, so the call itself is what is observed.
    const disposedSkeletons = new Set<Skeleton>();
    for (const skeleton of skeletons) {
      const release = skeleton.dispose.bind(skeleton);
      skeleton.dispose = () => {
        disposedSkeletons.add(skeleton);
        release();
      };
    }

    sanctuary.setSpecies([]);

    expect(sanctuary.residentCount).toBe(0);
    expect(disposed.size).toBe(geometries.size + materials.size);
    expect(disposedSkeletons.size).toBe(skeletons.size);
    // The permanent scene fixtures (floor, lights) must survive the rebuild.
    for (const fixture of fixtures) {
      expect(sanctuary.scene.children).toContain(fixture);
    }
  });

  it("authors nine properly staggered lanes — height, phase, heading and pitch", () => {
    // W-N3: E and S read as "five nearly parallel horizontal sticks" while
    // the lanes shared their pitch and clustered their turns. These are the
    // stagger rules the table's comment states, read back so a retune cannot
    // quietly fold two residents onto the same line again.
    //
    // Wave 8 (W6) grew the room to nine residents, and the all-pairs rules
    // top out arithmetically at seven (nine phases cannot sit 0.8 rad apart
    // on a 2π circle). Since a chimera needs similar height *and* screen-x
    // *and* a shared beat at once (W-O2), the thresholds are unchanged but
    // scoped: height and turn hold within a lateral half, phase within a
    // direction of travel. `scripts/probe-sanctuary-lanes.mjs` is the
    // screen-space gate above these rules.
    expect(SANCTUARY_LANES).toHaveLength(MORAY_SPECIES.length);

    /** The half a lane swims: west of the room's middle seam, or east. */
    const half = (lane: (typeof SANCTUARY_LANES)[number]): "west" | "east" =>
      lane.x <= 0.6 ? "west" : "east";

    for (let a = 0; a < SANCTUARY_LANES.length; a++) {
      for (let b = a + 1; b < SANCTUARY_LANES.length; b++) {
        const laneA = SANCTUARY_LANES[a]!;
        const laneB = SANCTUARY_LANES[b]!;
        if (half(laneA) === half(laneB)) {
          // No two lanes in the same half share a band of water...
          expect(Math.abs(laneA.y - laneB.y), `lanes ${a}/${b} height`).toBeGreaterThanOrEqual(0.45);
          // ...or a heading cluster.
          expect(Math.abs(laneA.turn - laneB.turn), `lanes ${a}/${b} turn`).toBeGreaterThanOrEqual(
            0.1,
          );
        }
        if (Math.sign(laneA.speed) === Math.sign(laneB.speed)) {
          // ...or, running the same way round, a lobe of the shared beat.
          const phaseGap = Math.abs(laneA.phase - laneB.phase) % (Math.PI * 2);
          const circular = Math.min(phaseGap, Math.PI * 2 - phaseGap);
          expect(circular, `lanes ${a}/${b} phase`).toBeGreaterThanOrEqual(0.8);
        }
      }
    }

    const rises = SANCTUARY_LANES.map((lane) => lane.rise);
    // Pitch variety: a near-level glide and a real climb both present.
    expect(Math.min(...rises)).toBeLessThanOrEqual(0.35);
    expect(Math.max(...rises)).toBeGreaterThanOrEqual(0.55);

    for (const lane of SANCTUARY_LANES) {
      // Inside the end-on trap's band: a lemniscate parks at turn ± 45°, and
      // the sweep covers ±30° of azimuth, so |turn| must stay modest.
      expect(Math.abs(lane.turn)).toBeLessThanOrEqual(0.35);
      // Under the jellies' 4.55 m drift floor at the top of every lobe.
      expect(lane.y + lane.rise).toBeLessThanOrEqual(4.55);
      // And off the sand at the bottom of every lobe.
      expect(lane.y - lane.rise).toBeGreaterThanOrEqual(0.4);
    }
    // Both directions of travel, so the room never becomes a carousel.
    expect(SANCTUARY_LANES.some((lane) => lane.speed < 0)).toBe(true);
    expect(SANCTUARY_LANES.some((lane) => lane.speed > 0)).toBe(true);
  });

  it("staggers the low lanes laterally, so no chimera can form (W-O2)", () => {
    // Height stagger is necessary and was not sufficient: the zebra and
    // dragon lanes were near-concentric in plan view at a relative angular
    // rate of 0.03 rad/s, so the dragon's head sat screen-adjacent to the
    // zebra's flank for ~30 s at a stretch and the round critic read one
    // impossible animal at both canonical settles. Depth along the camera
    // axis cannot separate two bodies on screen — lateral distance can.
    // The species take lanes in codex order: zebra 2, dragon 3, abyss 4.
    const zebra = SANCTUARY_LANES[2]!;
    const dragon = SANCTUARY_LANES[3]!;
    const abyss = SANCTUARY_LANES[4]!;
    // The zebra runs the west half and the dragon the east: centres at
    // least four metres apart, so their eights only graze at the lobes.
    expect(dragon.x - zebra.x).toBeGreaterThanOrEqual(4);
    // And they travel in opposite directions, so a residual adjacency is
    // two animals passing nose-to-tail, never one continuing into the other.
    expect(Math.sign(zebra.speed)).not.toBe(Math.sign(dragon.speed));
    // The hermit keeps the middle water between the two low neighbours.
    expect(Math.abs(abyss.x - zebra.x)).toBeGreaterThanOrEqual(2);
    expect(Math.abs(abyss.x - dragon.x)).toBeGreaterThanOrEqual(1.5);
  });

  it("carries its life as a fixture that survives resident rebuilds", () => {
    const sanctuary = new SanctuaryScene();
    const life = sanctuary.scene.children.find((child) => child.name === "sanctuary-life");
    expect(life).toBeDefined();

    const fish = life!.children.find((child) => child.name === "sanctuary-fish");
    expect(fish).toBeInstanceOf(InstancedMesh);
    expect((fish as InstancedMesh).count).toBeGreaterThan(0);

    const jellies = life!.children.filter((child) => child.name === "sanctuary-jelly");
    expect(jellies.length).toBeGreaterThanOrEqual(2);

    // The life is set dressing: `setSpecies` must never rebuild or detach it.
    sanctuary.setSpecies(MORAY_SPECIES);
    sanctuary.setSpecies([]);
    expect(sanctuary.scene.children).toContain(life);
    expect(life!.children).toContain(fish);
  });
});

describe("SanctuaryLife", () => {
  it("poses deterministically from its own seeds", () => {
    const a = new SanctuaryLife();
    const b = new SanctuaryLife();
    for (const life of [a, b]) {
      life.update(1 / 60);
      life.update(1 / 60);
    }

    const matrices = (life: SanctuaryLife): Float32Array => {
      const fish = life.group.children.find(
        (child): child is InstancedMesh => child.name === "sanctuary-fish",
      );
      expect(fish).toBeDefined();
      return fish!.instanceMatrix.array as Float32Array;
    };
    expect(Array.from(matrices(a))).toEqual(Array.from(matrices(b)));

    const jellyPositions = (life: SanctuaryLife): number[] =>
      life.group.children
        .filter((child) => child.name === "sanctuary-jelly")
        .flatMap((jelly) => jelly.position.toArray());
    expect(jellyPositions(a)).toEqual(jellyPositions(b));

    a.dispose();
    b.dispose();
  });

  it("dresses its bells in the bloom's shared rim-lit skin", () => {
    // W-N3: "flat purple buttons with zero translucency". The bell material
    // is the one exported from `JellyBloom` — one recipe for the reef's bloom
    // and the room — and it injects the fresnel rim that stands in for
    // translucency. Exercised directly, the way the outline hull's chunk is,
    // because nothing compiles in Node.
    const life = new SanctuaryLife();
    const jelly = life.group.children.find((child) => child.name === "sanctuary-jelly");
    expect(jelly).toBeDefined();
    const bell = jelly!.children[0] as Mesh;
    const material = bell.material as Material & {
      onBeforeCompile: (shader: unknown, renderer: unknown) => void;
    };
    expect(material.name).toBe("jelly-bell");

    const shader = {
      vertexShader: "",
      fragmentShader: "void main() {\n  #include <normal_fragment_maps>\n}",
      uniforms: {},
    };
    material.onBeforeCompile(shader, null);
    expect(shader.fragmentShader).toContain("bellRim");
    expect(shader.fragmentShader).toContain("totalEmissiveRadiance");
    expect(shader.fragmentShader).toContain("#include <normal_fragment_maps>");
    life.dispose();
  });

  it("releases everything it built, and detaches, on dispose", () => {
    const scene = new Scene();
    const life = new SanctuaryLife();
    life.addTo(scene);
    life.update(1 / 60);

    const { geometries, materials } = collectResources([life.group]);
    // Fish geometry, bell lathe, tentacle ribbons; fish, bell and tentacle
    // materials. The GLB never arrives in Node, so everything traversed here
    // was built by the system and must be released by it.
    expect(geometries.size).toBeGreaterThanOrEqual(3);
    expect(materials.size).toBeGreaterThanOrEqual(3);

    const disposed = new Set<BufferGeometry | Material>();
    for (const resource of [...geometries, ...materials]) {
      resource.addEventListener("dispose", () => disposed.add(resource));
    }

    life.dispose();

    expect(disposed.size).toBe(geometries.size + materials.size);
    expect(scene.children).not.toContain(life.group);
  });
});
