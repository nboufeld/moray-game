import {
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Mesh,
  Object3D,
  type BufferGeometry,
  type Material,
  type Scene,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createFishGeometry } from "../creatures/fish/FishGeometry";
import { FISH_SPECIES } from "../creatures/fish/FishSpecies";
import {
  buildFallbackBell,
  buildTentacles,
  createJellyBellMaterial,
} from "../creatures/visitors/JellyBloom";
import { requestModel } from "../rendering/AssetLibrary";
import { createToonMaterial } from "../rendering/ToonShading";
import { Random, SEEDS } from "../util/Random";

/**
 * The fusilier is the sanctuary's fish too — same body, same colour, same
 * sway — because the room is the reef remembered, not a second ocean. The
 * species table is read, never written.
 */
const FUSILIER = FISH_SPECIES[0]!;

/**
 * A single slow shoal riding a wide ellipse around the residents' lanes.
 *
 * Fourteen fish, against the reef's ninety-one: this room is a lullaby, and
 * one legible ribbon of silver crossing behind (and, on the ring's near side,
 * in front of) the eels says "alive" without ever competing with them. The
 * ring's centre sits behind the lanes and its near edge stops six metres
 * short of the sweep's closest camera position, so nothing featureless ever
 * fills the lens.
 */
const FISH_COUNT = 14;
const RING_X = 0;
const RING_Z = -2.5;
const RING_RADIUS_X = 6.6;
const RING_RADIUS_Z = 4.6;
const RING_HEIGHT = 3.9;
/** Radians of ring per second — a full lap in about two minutes. */
const CIRCUIT_RATE = 0.05;

/**
 * The reef lengthens a fish's fog depth by 1.6 so distance closes over the
 * school. The sanctuary's fog is denser (0.042 against the reef's) and its
 * ring is nine to sixteen metres from the lens, so the full gain drowned the
 * far arc entirely; 1.35 keeps the far side ghosted and the near side read.
 */
const FOG_DISTANCE_GAIN = 1.35;

/** How many bells drift across the room, and how many wear the GLB shell. */
const JELLY_COUNT = 3;
const JELLY_LEADS = 2;

/**
 * The drift envelope: high over the lanes (the residents top out at 4.2 m),
 * behind the centre line, inside the frame at both ends of the sweep.
 */
const JELLY_CENTER_X = 0.4;
const JELLY_CENTER_Y = 5.1;
const JELLY_CENTER_Z = -3.2;
const JELLY_SPREAD_X = 2.6;
const JELLY_SPREAD_Y = 0.55;
const JELLY_SPREAD_Z = 1.6;

/**
 * Slower than the reef bloom's 0.28–0.42 Hz: the pulse is the room's
 * heartbeat, and a lullaby's is slow.
 */
const PULSE_HZ_MIN = 0.2;
const PULSE_HZ_MAX = 0.32;
const PULSE_SQUASH = 0.1;
const PULSE_STRETCH = 0.14;

/** The bloom's own glow, sized under the composer's 0.82 bloom threshold. */
const GLOW = 0x8d74c0;
const GLOW_INTENSITY = 0.16;

interface FishAgent {
  readonly angle0: number;
  /** Multiplier on both ring radii, so the ribbon has width. */
  readonly radial: number;
  readonly heightOffset: number;
  readonly weaveRate: number;
  readonly weavePhase: number;
  readonly weaveAmp: number;
  readonly bobRate: number;
  readonly bobPhase: number;
  readonly scale: number;
}

interface BellSlot {
  readonly holder: Group;
  readonly bell: Mesh;
  readonly tentacles: Mesh;
  readonly baseX: number;
  readonly baseY: number;
  readonly baseZ: number;
  readonly scale: number;
  readonly pulseHz: number;
  readonly phase: number;
  readonly wanderRate: number;
  readonly wanderPhase: number;
}

/**
 * The sanctuary's life (W-L8): a slow shoal of fusiliers circling wide and a
 * few jelly bells drifting high. Deliberately sparser and slower than any
 * reef population — the room is a showcase, and everything here is a frame
 * around the residents, never a subject.
 *
 * Everything is a closed form of accumulated simulated time, drawn once from
 * seeded streams at construction, so two rooms are the same room and
 * `capture()` holds a pose the way it holds everything else. Built entirely
 * from generators the reef already owns — the fish builder read-only, the
 * bloom's exported bell — and DOM-free at construction, like the rest of the
 * set (`tests/sanctuaryScene.test.ts` constructs the scene in plain Node).
 *
 * There is deliberately no floor accent: the clownfish belongs to the
 * anemone garden it hides in and the sanctuary has none, and the sweep's
 * bottom strip belongs to the species cards anyway, so anything shrimp-sized
 * on this sand would live behind UI at nine metres.
 */
export class SanctuaryLife {
  readonly group = new Group();

  private readonly fishMesh: InstancedMesh;
  private readonly agents: FishAgent[] = [];
  private readonly slots: BellSlot[] = [];
  private readonly dummy = new Object3D();
  private readonly ownedGeometries: BufferGeometry[] = [];
  private readonly ownedMaterials: Material[] = [];
  private readonly swim = { value: 0 };
  private time = 0;

  constructor() {
    this.group.name = "sanctuary-life";
    this.fishMesh = this.buildShoal();
    this.buildJellies();
    this.pose();
  }

  private ownGeometry(geometry: BufferGeometry): BufferGeometry {
    this.ownedGeometries.push(geometry);
    return geometry;
  }

  private ownMaterial<T extends Material>(material: T): T {
    this.ownedMaterials.push(material);
    return material;
  }

  private buildShoal(): InstancedMesh {
    const random = new Random(SEEDS.sanctuaryFish);
    const geometry = this.ownGeometry(createFishGeometry(FUSILIER.body));
    const material = this.ownMaterial(
      createToonMaterial({ color: FUSILIER.color, vertexColors: true }),
    );
    material.onBeforeCompile = patchSanctuaryFishShader(this.swim);
    // The patch factory's `toString()` is what three hashes, and it matches
    // the reef's five fish closures character for character as far as the
    // cache is concerned — so this material must carry its own cache key or
    // it silently wears whichever fish program compiled first.
    material.customProgramCacheKey = () => "fish-sway:sanctuary-fusilier";

    const mesh = new InstancedMesh(geometry, material, FISH_COUNT);
    mesh.name = "sanctuary-fish";
    mesh.castShadow = false;
    // Every instance moves every frame; the bubbles' argument.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);

    for (let i = 0; i < FISH_COUNT; i++) {
      this.agents.push({
        // Dealt round the ring rather than drawn freely, so the shoal is a
        // ribbon and never a clot.
        angle0: (i / FISH_COUNT) * Math.PI * 2 + random.signed(0.18),
        radial: random.range(0.88, 1.12),
        heightOffset: random.signed(0.5),
        weaveRate: random.range(0.35, 0.8),
        weavePhase: random.range(0, Math.PI * 2),
        weaveAmp: random.range(0.2, 0.45),
        bobRate: random.range(0.2, 0.4),
        bobPhase: random.range(0, Math.PI * 2),
        scale: random.range(0.42, 0.62),
      });
    }

    this.group.add(mesh);
    return mesh;
  }

  private buildJellies(): void {
    const random = new Random(SEEDS.sanctuaryJellies);
    // The bloom's own bell skin (W-N3): one recipe, so the room's jellies and
    // the reef's are the same creature — and both wear the fresnel rim that
    // keeps a bell from reading as a flat button. This edit is the one line
    // this file lends to W-N3; the material is owned here like every other.
    const bellMaterial = this.ownMaterial(createJellyBellMaterial());
    const tentacleMaterial = this.ownMaterial(
      createToonMaterial({
        vertexColors: true,
        emissive: GLOW,
        emissiveIntensity: GLOW_INTENSITY * 0.5,
      }),
    );
    const bellGeometry = this.ownGeometry(buildFallbackBell());
    const tentacleGeometry = this.ownGeometry(buildTentacles());

    for (let i = 0; i < JELLY_COUNT; i++) {
      const holder = new Group();
      holder.name = "sanctuary-jelly";
      const bell = new Mesh(bellGeometry, bellMaterial);
      const tentacles = new Mesh(tentacleGeometry, tentacleMaterial);
      tentacles.rotation.y = random.range(0, Math.PI);
      holder.add(bell, tentacles);
      this.group.add(holder);
      this.slots.push({
        holder,
        bell,
        tentacles,
        baseX: JELLY_CENTER_X + random.signed(JELLY_SPREAD_X),
        baseY: JELLY_CENTER_Y + random.signed(JELLY_SPREAD_Y),
        baseZ: JELLY_CENTER_Z + random.signed(JELLY_SPREAD_Z),
        scale: random.range(0.9, 1.25),
        pulseHz: random.range(PULSE_HZ_MIN, PULSE_HZ_MAX),
        phase: random.range(0, Math.PI * 2),
        wanderRate: random.range(0.05, 0.09),
        wanderPhase: random.range(0, Math.PI * 2),
      });
    }

    // Leads only, like the bloom: the chorus keeps the lathe, which therefore
    // stays owned and alive, and is the whole set in the no-assets build. The
    // GLB geometry is the library's and is never in the owned list.
    requestModel("models/creature-jelly-bell.glb", (geometry) => {
      for (const slot of this.slots.slice(0, JELLY_LEADS)) {
        slot.bell.geometry = geometry;
      }
    });
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  /** `dt` arrives already scaled by the room's reduced-motion factor. */
  update(dt: number): void {
    this.time += dt;
    this.swim.value = this.time;
    this.pose();
  }

  private pose(): void {
    const time = this.time;

    for (let i = 0; i < this.agents.length; i++) {
      const fish = this.agents[i];
      if (!fish) {
        continue;
      }
      const angle = fish.angle0 + CIRCUIT_RATE * time;
      const weave = Math.sin(time * fish.weaveRate + fish.weavePhase) * fish.weaveAmp;
      const radiusX = RING_RADIUS_X * fish.radial + weave;
      const radiusZ = RING_RADIUS_Z * fish.radial + weave;
      const x = RING_X + Math.cos(angle) * radiusX;
      const z = RING_Z + Math.sin(angle) * radiusZ;
      const y =
        RING_HEIGHT + fish.heightOffset + Math.sin(time * fish.bobRate + fish.bobPhase) * 0.3;

      // The ellipse's tangent, so the body points where it is going, plus a
      // touch of the weave in the nose so no two fish sit exactly parallel.
      const yaw = Math.atan2(-Math.sin(angle) * radiusX, Math.cos(angle) * radiusZ);
      const bank = Math.cos(time * fish.weaveRate + fish.weavePhase) * 0.18;
      const pitch = Math.cos(time * fish.bobRate + fish.bobPhase) * 0.08;

      this.dummy.position.set(x, y, z);
      this.dummy.rotation.set(pitch, yaw + weave * 0.25, bank, "YXZ");
      this.dummy.scale.setScalar(fish.scale);
      this.dummy.updateMatrix();
      this.fishMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.fishMesh.instanceMatrix.needsUpdate = true;

    for (const slot of this.slots) {
      const beat = time * slot.pulseHz * Math.PI * 2 + slot.phase;
      const pulse = Math.sin(beat);
      slot.bell.scale.set(
        1 - PULSE_SQUASH * pulse,
        1 + PULSE_STRETCH * pulse,
        1 - PULSE_SQUASH * pulse,
      );
      slot.tentacles.scale.y = 1 - pulse * 0.1;
      slot.tentacles.rotation.x = Math.sin(beat * 0.31 + slot.wanderPhase) * 0.1;
      slot.tentacles.rotation.z = Math.cos(beat * 0.27 + slot.wanderPhase) * 0.1;

      const wander = time * slot.wanderRate + slot.wanderPhase;
      slot.holder.position.set(
        slot.baseX + Math.sin(wander) * 0.5,
        slot.baseY + Math.sin(beat - Math.PI / 3) * 0.12 + Math.cos(wander * 0.7) * 0.25,
        slot.baseZ + Math.cos(wander * 0.9) * 0.5,
      );
      slot.holder.scale.setScalar(slot.scale);
    }
  }

  /**
   * Releases what this system created — and only that. The lead bells may be
   * wearing the `AssetLibrary`'s GLB geometry by now, which is shared with
   * the reef's bloom and must never be disposed here; the owned lists were
   * filled at construction, before any swap, so they cannot contain it.
   */
  dispose(): void {
    this.group.removeFromParent();
    for (const geometry of this.ownedGeometries) {
      geometry.dispose();
    }
    for (const material of this.ownedMaterials) {
      material.dispose();
    }
  }
}

/**
 * The fusilier's own sway literals over the sanctuary's fog gain — the
 * reef's `patchFishShader` pattern, one room over: constants folded in as
 * literals, the swim clock as the one uniform, and the program disambiguated
 * from the reef's five by `customProgramCacheKey` above.
 */
function patchSanctuaryFishShader(swim: { value: number }) {
  return (shader: WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.uSwim = swim;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uSwim;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float swimPhase = instanceMatrix[3][0] * 0.9 + instanceMatrix[3][2] * 0.7;
         float tailward = clamp(-transformed.z / ${FUSILIER.sway.tailLength.toFixed(3)}, 0.0, 1.0);
         transformed.x += sin(uSwim * ${FUSILIER.sway.frequency.toFixed(2)} + swimPhase) * ${FUSILIER.sway.amplitude.toFixed(3)} * tailward * tailward;`,
      )
      .replace(
        "#include <fog_vertex>",
        `#include <fog_vertex>
         #ifdef USE_FOG
           vFogDepth *= ${FOG_DISTANCE_GAIN.toFixed(2)};
         #endif`,
      );
  };
}
