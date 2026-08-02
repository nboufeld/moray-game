import { Group, type BufferGeometry, type Material, type Scene } from "three";
import type { LifeContext, LifeSystem } from "../life/LifeSystem";
import {
  registerActor,
  unregisterActor,
  type VisitorActor,
  type VisitorKind,
} from "./VisitorDirector";

/**
 * What the three visitors share: a life-system shell that is empty when the
 * animal is not on stage.
 *
 * `group` stays in the scene for the whole dive and `root` — the animal — is
 * attached only between `beginPass` and the end of the crossing, so an absent
 * visitor costs one empty scene-graph node and one branch per frame, which is
 * the transient-cost promise this package is built around. It is also what
 * keeps `tests/lifeSystems.test.ts` true: a freshly constructed visitor has an
 * empty group, and a minute of updates with no schedule leaves it that way.
 *
 * Meshes are built once, at construction, exactly as the reef's are — a pass
 * beginning is a re-parent, never a rebuild. What a visitor *owns* it records
 * with {@link own}, because `disposeSubtree` would take the `AssetLibrary`'s
 * shared GLB geometry down with the instance.
 */
export abstract class VisitorBase implements LifeSystem, VisitorActor {
  readonly group = new Group();
  protected readonly root = new Group();
  /** Seconds since this pass began; only meaningful while passing. */
  protected passTime = 0;
  private passing = false;
  private disposed = false;
  private readonly owned = new Set<BufferGeometry | Material>();

  constructor(
    name: string,
    readonly seed: number,
    readonly kind: VisitorKind,
  ) {
    this.group.name = name;
    this.root.name = `${name}-body`;
    registerActor(this);
  }

  get isPassing(): boolean {
    return this.passing;
  }

  addTo(scene: Scene): void {
    scene.add(this.group);
  }

  beginPass(secondsIn = 0): void {
    if (this.disposed) {
      return;
    }
    this.passTime = Math.max(0, secondsIn);
    if (!this.passing) {
      this.passing = true;
      this.group.add(this.root);
    }
    this.onPassStarted();
  }

  update(dt: number, ctx: LifeContext): void {
    if (!this.passing) {
      return;
    }
    this.passTime += dt;
    this.advancePass(dt, ctx);
  }

  dispose(): void {
    this.disposed = true;
    unregisterActor(this);
    this.endPass();
    this.group.removeFromParent();
    this.group.clear();
    for (const resource of this.owned) {
      resource.dispose();
    }
    this.owned.clear();
  }

  /** The crossing is over; the animal leaves the scene graph. */
  protected endPass(): void {
    if (!this.passing) {
      return;
    }
    this.passing = false;
    this.group.remove(this.root);
  }

  /** Records a geometry or material as this instance's to dispose. */
  protected own<T extends BufferGeometry | Material>(resource: T): T {
    this.owned.add(resource);
    return resource;
  }

  /** Disposes a previously owned resource now (a fallback being replaced). */
  protected disposeOwned(resource: BufferGeometry | Material): void {
    if (this.owned.delete(resource)) {
      resource.dispose();
    }
  }

  /** A pass just began (or was force-started part-way through). */
  protected onPassStarted(): void {}

  /** One frame of an active crossing; `passTime` has already advanced. */
  protected abstract advancePass(dt: number, ctx: LifeContext): void;
}
