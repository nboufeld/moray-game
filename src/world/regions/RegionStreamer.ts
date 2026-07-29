import type { Scene, Vector3 } from "three";
import type { BoundsAnnex, CollisionField, SphereCollider } from "../CollisionField";
import type { LifeContext } from "../../creatures/life/LifeSystem";
import type { DiscoveryTarget } from "../../discovery/DiscoverySystem";
import { REGIONS } from "./RegionRegistry";
import { regionSlot, slotCenter } from "./RegionSlots";
import type { RegionBuild, RegionDef } from "./RegionTypes";

/**
 * R0 — the streamer: keeps exactly the regions near the diver built,
 * attached, collidable and alive, and everything else out of the frame.
 *
 * The fog is the whole argument: visibility ends at ~100 m, so a region
 * whose nearest edge is beyond {@link BUILD_MARGIN} cannot be seen and
 * need not exist. Hysteresis between the attach and detach radii keeps a
 * border swim from thrashing; built regions stay cached (geometry is a
 * few MB; the cost that matters is draw calls, and detached groups are
 * simply not in the scene graph).
 *
 * Determinism: a region's *content* is seeded and built the same whenever
 * it is built; nothing about build timing changes a draw order, because
 * every region draws only from its own pre-registered streams.
 */

/** Metres beyond a region's nearest edge at which it is built + attached. */
const BUILD_MARGIN = 130;
/**
 * Extra metres of hysteresis before an attached region detaches.
 *
 * 65 rather than the original 45 because of a measured capture-harness
 * race: the spawn at (0, 2, 14) sits 236.7 m from `great-blue-1`'s edge
 * (its spoke runs spawn-away, unlike the pilot's, whose edge is 216.6 m
 * out), so at 45 the region force-attached by the QA door detached again
 * on the first update tick — and a capture pose teleported into it was
 * collision-clamped back to the bowl before the streamer could re-attach,
 * leaving every fresh-page screenshot shot from the wrong water. The
 * wider band only makes detach *more* conservative; attach distances are
 * untouched, and builds were already cached across the boundary.
 */
const HYSTERESIS = 65;

interface Entry {
  readonly def: RegionDef;
  readonly centerX: number;
  readonly centerZ: number;
  readonly radius: number;
  /** Depth-1 margins reach back down the approach vale to the wing's end. */
  readonly buildMargin: number;
  build: RegionBuild | null;
  attached: boolean;
}

export class RegionStreamer {
  private readonly entries: Entry[];
  private readonly volumes = new Map<string, BoundsAnnex>();
  private readonly colliders = new Map<string, readonly SphereCollider[]>();
  /** Fires when a region first builds, with its discovery targets. */
  onTargets?: (targets: readonly DiscoveryTarget[]) => void;

  constructor(
    private readonly scene: Scene,
    private readonly collision: CollisionField,
  ) {
    this.entries = REGIONS.map((def) => {
      const slot = regionSlot(def.slotId);
      const { x, z } = slotCenter(slot);
      // A depth-1 region's domain includes its approach vale all the way
      // back to the gateway wing's end at r ≈ 48, so it must be built —
      // bounds, colliders, scenery — the moment the diver crosses the
      // wing, not when the disc itself comes into reach.
      const buildMargin =
        slot.depth === 1 ? Math.max(BUILD_MARGIN, slot.centerR - slot.radius - 40) : BUILD_MARGIN;
      return {
        def,
        centerX: x,
        centerZ: z,
        radius: slot.radius,
        buildMargin,
        build: null,
        attached: false,
      };
    });
  }

  /** Which regions are currently attached, for probes and captures. */
  get active(): readonly string[] {
    return this.entries.filter((entry) => entry.attached).map((entry) => entry.def.slotId);
  }

  update(diverPosition: Vector3, dt: number, ctx: LifeContext): void {
    for (const entry of this.entries) {
      const edge =
        Math.hypot(diverPosition.x - entry.centerX, diverPosition.z - entry.centerZ) - entry.radius;
      if (!entry.attached && edge <= entry.buildMargin) {
        this.attach(entry);
      } else if (entry.attached && edge > entry.buildMargin + HYSTERESIS) {
        this.detach(entry);
      }
      if (entry.attached && entry.build) {
        entry.build.update?.(dt, ctx);
      }
    }
  }

  /** QA door: builds and attaches a region immediately (capture harness). */
  force(slotId: string): void {
    const entry = this.entries.find((candidate) => candidate.def.slotId === slotId);
    if (entry && !entry.attached) {
      this.attach(entry);
    }
  }

  private attach(entry: Entry): void {
    if (!entry.build) {
      entry.build = entry.def.build(this.scene);
      if (entry.build.targets && entry.build.targets.length > 0) {
        this.onTargets?.(entry.build.targets);
      }
    }
    this.scene.add(entry.build.group);
    entry.attached = true;

    const def = entry.def;
    this.volumes.set(def.slotId, {
      contains: (x, z) => def.weight(x, z) > 0,
      // The region floor rides its own composed ground; the streamer keeps
      // no copy of `seabedHeight` (import cycle around the world's one
      // height function) so the def carries its own composed floor via
      // `terrainTarget` + clearance — regions author their floors to BE
      // the composed ground inside their hearts, and the weight feather
      // keeps the seam under the wings' own bounds at the handover.
      floor: (x, z) => def.terrainTarget(x, z) + def.floorClearance,
      ceiling: (x, z) => def.ceiling(x, z),
      maxRadius: Number.POSITIVE_INFINITY,
    });
    this.colliders.set(def.slotId, entry.build.colliders);
    this.push();
  }

  private detach(entry: Entry): void {
    if (entry.build) {
      this.scene.remove(entry.build.group);
    }
    entry.attached = false;
    this.volumes.delete(entry.def.slotId);
    this.colliders.delete(entry.def.slotId);
    this.push();
  }

  private push(): void {
    const volumes = [...this.volumes.values()];
    const colliders: SphereCollider[] = [];
    for (const list of this.colliders.values()) {
      colliders.push(...list);
    }
    this.collision.setDynamic(volumes, colliders);
  }
}
