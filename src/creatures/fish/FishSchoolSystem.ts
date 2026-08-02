import {
  InstancedMesh,
  Matrix4,
  Object3D,
  type MeshToonMaterial,
  type Scene,
  type Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import { coralFeedingSites } from "../../world/CoralField";
import { seabedHeight } from "../../world/Seabed";
import { createFishGeometry } from "./FishGeometry";
import {
  FISH_SPECIES,
  type FishSpeciesConfig,
  type HoverBehaviour,
  type PatrolBehaviour,
  type ShoalBehaviour,
  type SwayProfile,
} from "./FishSpecies";

/**
 * How much further away a fish is, as far as the fog is concerned, than it
 * actually is.
 *
 * The school did already receive the scene's fog — every lit material three
 * ships respects it and always has. It simply was not enough, because fog can
 * only interpolate toward the water and a lit fish started an order of
 * magnitude above it. Exponential-squared fog is the right shape for the fix:
 * lengthen the depth it is handed and the extra density lands almost entirely
 * on the far end — near fish stay readable, far ones sink into the water
 * instead of sitting on it. One multiply in the vertex shader, shared by all
 * five species: distance closes the same water over every animal in it.
 */
const FOG_DISTANCE_GAIN = 1.6;

/**
 * Where a shoal is turned back toward the reef, and how hard.
 *
 * Soft, because a hard wrap is a whole school vanishing from one edge of the
 * frame and reappearing at the other. Wide, because the region is centred on
 * the reef and the cameras are not: held to a tighter disc the school kept
 * leaving the frame entirely at the mid-depth traverse, whose whole view cone
 * fell in the part of the water the containment was busy emptying.
 */
const ROAM_SOFT = 20;
const ROAM_HARD = 29;
const CONTAIN_GAIN = 0.5;
/** Ceiling on the containment turn, so the far edge curves rather than snaps. */
const CONTAIN_MAX_RATE = 0.3;

/**
 * How close a shoal will come to the diver before it starts bending away, and
 * how hard it bends.
 *
 * Not a nicety: a shoal is a formation metres across, so a course through the
 * diver puts a fish inside a metre of the lens, where no background animal
 * survives inspection. The distance is a balance, not a floor — the standoff
 * and the fish fog together decide how wide a band the school can be *seen*
 * in, so raising it empties the frame.
 */
const VIEWER_STANDOFF = 8.5;
const VIEWER_GAIN = 0.9;
const VIEWER_MAX_RATE = 0.45;

/**
 * Where the near-field scale blend runs: a fish nearer than the start renders
 * at its species' cap, and grows back to its own size across the window. The
 * standoff is a steering force, so a fish already inside the bubble when a
 * capture teleports the camera stays there for the settle — the render itself
 * is the insurance.
 */
const NEAR_FIELD_START = 6;
const NEAR_FIELD_SPAN = 6;

/**
 * The per-species tail sway and the shared fog gain, injected into the toon
 * vertex shader.
 *
 * Per-species constants are folded in as literals, which is the pattern the
 * single-species file used — but with five materials it needs the second half
 * the old comment warned about: three keys its program cache on
 * `onBeforeCompile.toString()`, which returns this factory's *source*, not
 * the interpolated result, so all five closures hash identically and every
 * species would silently get the first one's program. `customProgramCacheKey`
 * exists for exactly this (it is pushed into the cache key beside the
 * defines), so each material carries its species name there and five programs
 * compile. Five near-identical toon programs are cheap; a uniform per sway
 * constant, wired through three's per-material uniform bookkeeping, is not
 * simpler.
 */
function patchFishShader(sway: SwayProfile, swim: { value: number }) {
  return (shader: WebGLProgramParametersWithUniforms): void => {
    shader.uniforms.uSwim = swim;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uSwim;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float swimPhase = instanceMatrix[3][0] * 0.9 + instanceMatrix[3][2] * 0.7;
         // Weighted toward the tail (-z), so the nose stays steady.
         float tailward = clamp(-transformed.z / ${sway.tailLength.toFixed(3)}, 0.0, 1.0);
         transformed.x += sin(uSwim * ${sway.frequency.toFixed(2)} + swimPhase) * ${sway.amplitude.toFixed(3)} * tailward * tailward;`,
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

function createFishMaterial(species: FishSpeciesConfig, swim: { value: number }): MeshToonMaterial {
  const material = createToonMaterial({ color: species.color, vertexColors: true });
  material.onBeforeCompile = patchFishShader(species.sway, swim);
  material.customProgramCacheKey = () => `fish-sway:${species.name}`;
  return material;
}

function createSpeciesMesh(species: FishSpeciesConfig, swim: { value: number }): InstancedMesh {
  const mesh = new InstancedMesh(createFishGeometry(species.body), createFishMaterial(species, swim), species.count);
  mesh.name = `fish-${species.name}`;
  // Small, distant and always moving: their shadows are never legible, and a
  // school's worth of extra casters in the shadow pass are not.
  mesh.castShadow = false;
  // Every instance moves every frame, so a bounding sphere computed from the
  // matrices is stale before it is read — the same reasoning `Bubbles` wrote
  // down. The old single mesh got away with a sphere computed from its first
  // frame; five meshes, two of them anchored in small patches, would not.
  mesh.frustumCulled = false;
  return mesh;
}

/** The same angle expressed in [-π, π], so a turn takes the short way round. */
function wrapAngle(radians: number): number {
  const wrapped = (radians + Math.PI) % (Math.PI * 2);
  return (wrapped < 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI;
}

/** One species' population: its mesh, and how it moves. */
interface Flock {
  readonly mesh: InstancedMesh;
  update(time: number, step: number, viewer: Vector3): void;
}

/**
 * Shared instance write: pose, plus the near-field scale cap. A background
 * animal only fails when it is large in frame, so the render shrinks close
 * fish toward the species' cap, blended over the near-field window so nothing
 * pumps.
 */
class InstanceWriter {
  private readonly dummy = new Object3D();
  private readonly matrix = new Matrix4();

  constructor(
    private readonly mesh: InstancedMesh,
    private readonly nearScaleCap: number,
  ) {}

  place(
    index: number,
    x: number,
    y: number,
    z: number,
    pitch: number,
    yaw: number,
    bank: number,
    scale: number,
    viewer: Vector3,
  ): void {
    const dx = x - viewer.x;
    const dy = y - viewer.y;
    const dz = z - viewer.z;
    const range = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const far = Math.min(1, Math.max(0, (range - NEAR_FIELD_START) / NEAR_FIELD_SPAN));
    const nearScale = Math.min(scale, this.nearScaleCap);
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(pitch, yaw, bank, "YXZ");
    this.dummy.scale.setScalar(nearScale + (scale - nearScale) * far);
    this.dummy.updateMatrix();
    this.matrix.copy(this.dummy.matrix);
    this.mesh.setMatrixAt(index, this.matrix);
  }
}

/**
 * A shoal travelling somewhere, rather than a point things orbit.
 *
 * Its heading is wandered by two sines of incommensurate period rather than by
 * a noise lattice: at one value per shoal per frame a lattice buys nothing,
 * and a closed-form function of time cannot drift out of step between a
 * screenshot run and the run it is compared against.
 */
interface Shoal {
  x: number;
  z: number;
  /** Cruising depth, from the species' band. */
  y: number;
  heading: number;
  speed: number;
  wanderRateA: number;
  wanderAmpA: number;
  wanderPhaseA: number;
  wanderRateB: number;
  wanderAmpB: number;
  wanderPhaseB: number;
  /** A slow shared rise and fall — the whole school riding one swell. */
  bobRate: number;
  bobPhase: number;
  bobAmp: number;
  /** Scales every station in the formation: a tight ball, or a loose drift. */
  spread: number;
}

/** A fish's station within its shoal, in the shoal's own frame. */
interface ShoalAgent {
  shoal: number;
  right: number;
  up: number;
  forward: number;
  weaveRate: number;
  weavePhase: number;
  weaveAmp: number;
  riseAmp: number;
  surgeRate: number;
  surgeAmp: number;
  /** How much the weave turns the nose, so no two fish sit exactly parallel. */
  yawAmp: number;
  /** How far it drops the inside shoulder as the weave turns it. */
  bankAmp: number;
  scale: number;
}

/**
 * Travelling shoals: shoals crossing the reef, each carrying its fish in a
 * loose formation that weaves around its station. This is the single-species
 * system's whole behaviour, parameterised — with the fusilier's own numbers
 * it draws the same thirteen shoals from the same stream, and the multipliers
 * that stiffen the needlefish are applied *after* each draw so the stream
 * never shifts.
 */
class TravellingShoals implements Flock {
  readonly mesh: InstancedMesh;
  private readonly shoals: Shoal[] = [];
  private readonly agents: ShoalAgent[] = [];
  private readonly writer: InstanceWriter;

  constructor(species: FishSpeciesConfig, behaviour: ShoalBehaviour, random: Random, swim: { value: number }) {
    this.mesh = createSpeciesMesh(species, swim);
    this.writer = new InstanceWriter(this.mesh, species.nearScaleCap);

    // Shoals set off from scattered stations on scattered bearings. The
    // bearings are dealt round the compass rather than drawn freely, so a
    // school cannot roll every heading into one quadrant and leave three
    // quarters of the reef empty of fish.
    for (let s = 0; s < behaviour.shoalCount; s++) {
      this.shoals.push({
        x: random.signed(15),
        z: random.signed(15),
        y: random.range(behaviour.band[0], behaviour.band[1]),
        heading: (s / behaviour.shoalCount) * Math.PI * 2 + random.signed(0.4),
        speed: random.range(behaviour.speed[0], behaviour.speed[1]),
        wanderRateA: random.range(0.07, 0.14),
        wanderAmpA: random.range(0.05, 0.11) * behaviour.wander,
        wanderPhaseA: random.range(0, Math.PI * 2),
        wanderRateB: random.range(0.21, 0.36),
        wanderAmpB: random.range(0.02, 0.05) * behaviour.wander,
        wanderPhaseB: random.range(0, Math.PI * 2),
        bobRate: random.range(0.11, 0.2),
        bobPhase: random.range(0, Math.PI * 2),
        bobAmp: random.range(0.3, 0.7),
        // Some shoals ball up and some string out. Without this every group
        // is the same size and density — a repeated decal at the scale of the
        // shoal rather than of the fish.
        spread: random.range(behaviour.spread[0], behaviour.spread[1]),
      });
    }

    for (let i = 0; i < species.count; i++) {
      this.agents.push({
        shoal: i % behaviour.shoalCount,
        // Wider than tall and longer than wide, which is the shape a school
        // travelling in one direction actually holds.
        right: random.signed(behaviour.stations.across),
        up: random.signed(behaviour.stations.up),
        forward: random.signed(behaviour.stations.along),
        weaveRate: random.range(0.5, 1.1),
        weavePhase: random.range(0, Math.PI * 2),
        weaveAmp: random.range(0.25, 0.7) * behaviour.weave,
        riseAmp: random.range(0.1, 0.35) * behaviour.weave,
        surgeRate: random.range(0.24, 0.52),
        surgeAmp: random.range(0.3, 0.9) * behaviour.weave,
        yawAmp: random.range(0.12, 0.3) * behaviour.weave,
        bankAmp: random.range(0.22, 0.55) * behaviour.weave,
        // A shoal of identically sized fish reads as a repeated decal.
        scale: random.range(species.scale[0], species.scale[1]),
      });
    }
  }

  update(time: number, step: number, viewer: Vector3): void {
    this.advanceShoals(time, step, viewer);

    for (let i = 0; i < this.agents.length; i++) {
      const fish = this.agents[i];
      const shoal = fish ? this.shoals[fish.shoal] : undefined;
      if (!fish || !shoal) {
        continue;
      }

      // The shoal's frame: it travels along (sin, cos), so the axis across it
      // is (cos, -sin) — the same pair, a quarter turn over.
      const forwardX = Math.sin(shoal.heading);
      const forwardZ = Math.cos(shoal.heading);
      const weave = time * fish.weaveRate + fish.weavePhase;
      const lateral = fish.right * shoal.spread + Math.sin(weave) * fish.weaveAmp;
      const along =
        fish.forward * shoal.spread + Math.sin(time * fish.surgeRate + fish.weavePhase) * fish.surgeAmp;

      const x = shoal.x + forwardZ * lateral + forwardX * along;
      const z = shoal.z - forwardX * lateral + forwardZ * along;
      const y =
        shoal.y +
        fish.up * shoal.spread +
        Math.sin(time * shoal.bobRate + shoal.bobPhase) * shoal.bobAmp +
        Math.sin(weave * 0.7) * fish.riseAmp;

      // A fish weaving across the formation is, at that moment, pointing
      // slightly across it, banking into the turn, and nosed wherever it is
      // climbing to. Without these the whole shoal is rigidly parallel, and a
      // rigidly parallel shoal caught broadside is two dozen identical
      // silhouettes.
      const yaw = shoal.heading + Math.cos(weave) * fish.yawAmp;
      const bank = -Math.sin(weave) * fish.bankAmp;
      const pitch = -Math.cos(weave * 0.7) * fish.riseAmp * 0.5;

      this.writer.place(i, x, y, z, pitch, yaw, bank, fish.scale, viewer);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Carries each shoal a step along its heading, and bends the heading.
   *
   * Position is integrated rather than solved for, so it depends on the size
   * of the steps taken — which is fine and is the existing bargain:
   * `Game.capture` always replays the same whole fixed steps from load, so a
   * screenshot is still reproducible frame for frame. Heading is a closed
   * form of time plus the turns below, neither of which depends on the frame
   * rate.
   */
  private advanceShoals(time: number, step: number, viewer: Vector3): void {
    for (const shoal of this.shoals) {
      const wander =
        Math.sin(time * shoal.wanderRateA + shoal.wanderPhaseA) * shoal.wanderAmpA +
        Math.sin(time * shoal.wanderRateB + shoal.wanderPhaseB) * shoal.wanderAmpB;

      let steer = 0;
      const radius = Math.hypot(shoal.x, shoal.z);
      if (radius > ROAM_SOFT) {
        const ramp = Math.min(1, (radius - ROAM_SOFT) / (ROAM_HARD - ROAM_SOFT));
        const inward = Math.atan2(-shoal.x, -shoal.z);
        const turn = wrapAngle(inward - shoal.heading) * CONTAIN_GAIN * ramp * ramp;
        steer = Math.max(-CONTAIN_MAX_RATE, Math.min(CONTAIN_MAX_RATE, turn));
      }

      // Horizontal only: a shoal that meets a diver goes around, it does not
      // dive, and there is no vertical turn that helps when the diver is
      // directly below anyway. That case is the cruising band's job.
      const awayX = shoal.x - viewer.x;
      const awayZ = shoal.z - viewer.z;
      const range = Math.hypot(awayX, awayZ);
      if (range < VIEWER_STANDOFF) {
        const ramp = 1 - range / VIEWER_STANDOFF;
        const away = Math.atan2(awayX, awayZ);
        const turn = wrapAngle(away - shoal.heading) * VIEWER_GAIN * ramp * ramp;
        steer += Math.max(-VIEWER_MAX_RATE, Math.min(VIEWER_MAX_RATE, turn));
      }

      shoal.heading += (wander + steer) * step;
      shoal.x += Math.sin(shoal.heading) * shoal.speed * step;
      shoal.z += Math.cos(shoal.heading) * shoal.speed * step;
    }
  }
}

/** One anchored fish: a polar station around its site, plus per-axis jitter. */
interface HoverAgent {
  anchorX: number;
  anchorY: number;
  anchorZ: number;
  angle: number;
  radius: number;
  lift: number;
  driftDirection: number;
  jitterRateX: number;
  jitterRateY: number;
  jitterRateZ: number;
  jitterPhaseX: number;
  jitterPhaseY: number;
  jitterPhaseZ: number;
  yawSwayRate: number;
  yawSwayPhase: number;
  scale: number;
}

/**
 * Anchored groups over the coral gardens: tangs circulating loosely, damsels
 * quivering in tight clouds. Everything is a closed form of time — station
 * angle, drift and jitter — so a hover flock cannot drift out of step between
 * two runs the way nothing integrated ever can.
 */
class HoverFlock implements Flock {
  readonly mesh: InstancedMesh;
  private readonly agents: HoverAgent[] = [];
  private readonly writer: InstanceWriter;
  private readonly behaviour: HoverBehaviour;

  constructor(species: FishSpeciesConfig, behaviour: HoverBehaviour, random: Random, swim: { value: number }) {
    this.behaviour = behaviour;
    this.mesh = createSpeciesMesh(species, swim);
    this.writer = new InstanceWriter(this.mesh, species.nearScaleCap);

    const sites = coralFeedingSites();
    for (const siteIndex of behaviour.siteIndices) {
      const site = sites[siteIndex];
      if (!site) {
        continue;
      }
      for (let f = 0; f < behaviour.perSite; f++) {
        this.agents.push({
          anchorX: site.x,
          anchorY: site.y,
          anchorZ: site.z,
          angle: random.range(0, Math.PI * 2),
          // Biased outward: a station at the exact anchor is a fish inside
          // the coral head the anchor names.
          radius: random.range(0.35, 1) * behaviour.radius,
          lift: random.range(behaviour.lift[0], behaviour.lift[1]),
          driftDirection: random.next() < 0.5 ? 1 : -1,
          jitterRateX: random.range(behaviour.jitterRate[0], behaviour.jitterRate[1]),
          jitterRateY: random.range(behaviour.jitterRate[0], behaviour.jitterRate[1]),
          jitterRateZ: random.range(behaviour.jitterRate[0], behaviour.jitterRate[1]),
          jitterPhaseX: random.range(0, Math.PI * 2),
          jitterPhaseY: random.range(0, Math.PI * 2),
          jitterPhaseZ: random.range(0, Math.PI * 2),
          yawSwayRate: random.range(0.3, 0.7),
          yawSwayPhase: random.range(0, Math.PI * 2),
          scale: random.range(species.scale[0], species.scale[1]),
        });
      }
    }
  }

  update(time: number, _step: number, viewer: Vector3): void {
    const behaviour = this.behaviour;
    for (let i = 0; i < this.agents.length; i++) {
      const fish = this.agents[i];
      if (!fish) {
        continue;
      }

      const angle = fish.angle + behaviour.drift * time * fish.driftDirection;
      const x =
        fish.anchorX + Math.cos(angle) * fish.radius +
        Math.sin(time * fish.jitterRateX + fish.jitterPhaseX) * behaviour.jitterAmp;
      const y =
        fish.anchorY + fish.lift +
        Math.sin(time * fish.jitterRateY + fish.jitterPhaseY) * behaviour.jitterAmp * 0.7;
      const z =
        fish.anchorZ + Math.sin(angle) * fish.radius +
        Math.sin(time * fish.jitterRateZ + fish.jitterPhaseZ) * behaviour.jitterAmp;

      // The nose follows the station's own motion: the tangent of the drift
      // circle, swayed a little so no two fish in a cloud sit parallel. The
      // pitch leads the vertical jitter by a quarter phase, which is what a
      // body that rises because it nosed up looks like.
      const yawSway = Math.sin(time * fish.yawSwayRate + fish.yawSwayPhase);
      const yaw =
        Math.atan2(-Math.sin(angle) * fish.driftDirection, Math.cos(angle) * fish.driftDirection) +
        yawSway * 0.45;
      const bank = yawSway * -0.15;
      const pitch = Math.cos(time * fish.jitterRateY + fish.jitterPhaseY) * 0.12;

      this.writer.place(i, x, y, z, pitch, yaw, bank, fish.scale, viewer);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** One patrolling fish and the loop it swims. */
interface PatrolAgent {
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  rate: number;
  direction: number;
  phase: number;
  bobRate: number;
  bobPhase: number;
  weaveRate: number;
  weavePhase: number;
  scale: number;
}

/**
 * Solitary wanderers on authored low loops. The loop is an ellipse because an
 * ellipse has a tangent in closed form, so the body points where it is going
 * without integrating anything; the height is read off `seabedHeight` every
 * frame, which is what "patrols low over the seabed" means when the seabed
 * has dunes in it.
 */
class PatrolFlock implements Flock {
  readonly mesh: InstancedMesh;
  private readonly agents: PatrolAgent[] = [];
  private readonly writer: InstanceWriter;
  private readonly clearance: number;

  constructor(species: FishSpeciesConfig, behaviour: PatrolBehaviour, random: Random, swim: { value: number }) {
    this.clearance = behaviour.clearance;
    this.mesh = createSpeciesMesh(species, swim);
    this.writer = new InstanceWriter(this.mesh, species.nearScaleCap);

    for (const route of behaviour.routes) {
      this.agents.push({
        centerX: route.x,
        centerZ: route.z,
        radiusX: route.radiusX,
        radiusZ: route.radiusZ,
        rate: route.rate * random.range(0.92, 1.08),
        direction: route.direction,
        phase: random.range(0, Math.PI * 2),
        bobRate: random.range(0.2, 0.35),
        bobPhase: random.range(0, Math.PI * 2),
        weaveRate: random.range(0.4, 0.7),
        weavePhase: random.range(0, Math.PI * 2),
        scale: random.range(species.scale[0], species.scale[1]),
      });
    }
  }

  update(time: number, _step: number, viewer: Vector3): void {
    for (let i = 0; i < this.agents.length; i++) {
      const fish = this.agents[i];
      if (!fish) {
        continue;
      }

      const theta = fish.phase + fish.rate * time * fish.direction;
      const x = fish.centerX + fish.radiusX * Math.sin(theta);
      const z = fish.centerZ + fish.radiusZ * Math.cos(theta);
      const y =
        seabedHeight(x, z) + this.clearance +
        Math.sin(time * fish.bobRate + fish.bobPhase) * 0.15;

      // The velocity of the ellipse, differentiated: that is the heading, and
      // it is why the loop is an ellipse and not a wander.
      const vx = fish.radiusX * Math.cos(theta) * fish.direction;
      const vz = -fish.radiusZ * Math.sin(theta) * fish.direction;
      const yaw = Math.atan2(vx, vz);

      const weave = Math.sin(time * fish.weaveRate + fish.weavePhase);
      const bank = weave * -0.12;
      const pitch = Math.cos(time * fish.bobRate + fish.bobPhase) * 0.06;

      this.writer.place(i, x, y, z, pitch, yaw + weave * 0.08, bank, fish.scale, viewer);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function createFlock(species: FishSpeciesConfig, random: Random, swim: { value: number }): Flock {
  const behaviour = species.behaviour;
  switch (behaviour.kind) {
    case "shoal":
      return new TravellingShoals(species, behaviour, random, swim);
    case "hover":
      return new HoverFlock(species, behaviour, random, swim);
    case "patrol":
      return new PatrolFlock(species, behaviour, random, swim);
    default: {
      const exhaustive: never = behaviour;
      throw new Error(`unhandled fish behaviour: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * The reef's fish community (W-L4): five species behind the same three
 * methods the one-species school had, so `Game` did not change a line.
 *
 * The species live in `FishSpecies.ts` and the shapes in `FishGeometry.ts`;
 * this file owns the motion. One `InstancedMesh` per species, one shared swim
 * clock, and one seeded stream per species — the fusilier keeps `SEEDS.fish`
 * so its thirteen shoals hold the tracks every archived capture was composed
 * against, and each new species draws its own sub-seed from
 * `SEEDS.fishSpecies` in table order, so tuning one species' internal draws
 * never re-rolls a sibling.
 */
export class FishSchoolSystem {
  /**
   * The fusilier school — the largest population and the one `probe-fish.mjs`
   * masks and measures. Kept under this name so the probe's contract holds.
   */
  readonly mesh: InstancedMesh;
  /** Every species' mesh, in `FISH_SPECIES` order. */
  readonly meshes: readonly InstancedMesh[];
  private readonly flocks: readonly Flock[];
  private readonly swim = { value: 0 };
  private time = 0;

  constructor() {
    const subSeeds = new Random(SEEDS.fishSpecies);
    const flocks: Flock[] = [];
    for (const species of FISH_SPECIES) {
      // Dealt for every species whether used or not, so a species switching
      // to an explicit seed cannot re-roll the ones below it in the table.
      const dealt = Math.floor(subSeeds.next() * 0xffffffff) >>> 0;
      const random = new Random(species.seed ?? dealt);
      flocks.push(createFlock(species, random, this.swim));
    }
    this.flocks = flocks;
    this.meshes = flocks.map((flock) => flock.mesh);
    const first = this.meshes[0];
    if (!first) {
      throw new Error("FISH_SPECIES is empty");
    }
    this.mesh = first;
  }

  addTo(scene: Scene): void {
    for (const mesh of this.meshes) {
      scene.add(mesh);
    }
  }

  update(dt: number, reducedMotion: boolean, viewer: Vector3): void {
    const step = dt * (reducedMotion ? 0.4 : 1);
    this.time += step;
    this.swim.value = this.time;
    for (const flock of this.flocks) {
      flock.update(this.time, step, viewer);
    }
  }
}
