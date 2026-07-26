import { Group, type Scene, type Vector3 } from "three";
import { disposeSubtree } from "../../util/disposeSubtree";

/**
 * What every living thing in the reef is told each frame.
 *
 * It is deliberately small and deliberately not the `Game`: a life system
 * should be drivable from a unit test with four numbers, and anything that
 * needs the camera, the renderer or the save is not a life system.
 */
export interface LifeContext {
  /** Where the diver is, in world space. Copied per frame, not aliased. */
  diverPosition: Vector3;
  /** Metres per second, so a system can startle at speed rather than at range. */
  diverSpeed: number;
  reducedMotion: boolean;
  /** Simulated seconds since the dive began, for anything on a clock. */
  time: number;
}

/**
 * The one door the reef's inhabitants come in through.
 *
 * Round L adds several populations across several packages, and each of them
 * is a group of meshes that has to be added to the scene, stepped with the
 * frame and released on teardown. Sharing that shape is what keeps
 * {@link LifeRegistry} — and therefore `Game` — from growing a line per animal.
 */
export interface LifeSystem {
  addTo(scene: Scene): void;
  update(dt: number, ctx: LifeContext): void;
  dispose(): void;
}

/**
 * Holds the reef's life systems and fans the frame out over them.
 *
 * `Game` owns one of these and nothing else: a package that adds a population
 * constructs it here and touches no other shared file, which is the whole
 * reason this exists before any of the animals do.
 */
export class LifeRegistry implements LifeSystem {
  private readonly systems: LifeSystem[] = [];

  constructor(systems: readonly LifeSystem[] = []) {
    this.systems.push(...systems);
  }

  /** Returns the system, so a caller that needs a handle can keep one. */
  add<T extends LifeSystem>(system: T): T {
    this.systems.push(system);
    return system;
  }

  get size(): number {
    return this.systems.length;
  }

  addTo(scene: Scene): void {
    for (const system of this.systems) {
      system.addTo(scene);
    }
  }

  update(dt: number, ctx: LifeContext): void {
    for (const system of this.systems) {
      system.update(dt, ctx);
    }
  }

  /** Releases every system and empties the registry, so a second call is a no-op. */
  dispose(): void {
    for (const system of this.systems) {
      system.dispose();
    }
    this.systems.length = 0;
  }
}

/**
 * A life system that is not built yet.
 *
 * Round L lands every module's interface in one package so that the waves
 * after it never edit `Game.ts`, `Random.ts` or each other's files. Until the
 * package named in a subclass's header fills it in, this is what that module
 * is: a named, seeded, empty `Group` that costs one scene-graph node and
 * nothing else. A subclass that grows real contents should stop extending
 * this and implement {@link LifeSystem} itself.
 */
export abstract class LifeScaffold implements LifeSystem {
  readonly group = new Group();

  /**
   * `seed` is taken at construction rather than at first use so that a
   * population is reproducible from the moment it exists — the rule the whole
   * reef is scattered under.
   */
  constructor(
    name: string,
    readonly seed: number,
  ) {
    this.group.name = name;
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  update(_dt: number, _ctx: LifeContext): void {
    // Nothing lives here yet.
  }

  dispose(): void {
    disposeSubtree(this.group);
    this.group.removeFromParent();
    this.group.clear();
  }
}
