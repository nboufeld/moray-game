import {
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { requestModel } from "../../rendering/AssetLibrary";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import { isClear } from "../../world/CoralField";
import { seabedHeight } from "../../world/Seabed";
import type { LifeContext } from "../life/LifeSystem";
import { playReefEvent } from "./FaunaAudio";
import { FaunaSystem, paintVertices } from "./FaunaSystem";

/**
 * The GLB is authored at the exact world size of the procedural body it
 * replaces — carapace 0.143 m across, feet at y = 0 — so the swap is geometry
 * alone and every instance matrix stays bit-identical. The constant exists for
 * the same reason `SHRIMP_SCALE` does: it is the one place the size contract
 * between the atelier and the reef is written down. (The shrimp's GLB is true
 * 50 mm and needs 2.75; the crab's is already a hand-sized storybook animal
 * and needs 1.)
 */
const CRAB_SCALE = 1.0;

/**
 * Where each crab lives. Authored rather than scattered, for the same reason
 * the coral sites are: a crab is only ever seen near a canonical camera, so the
 * handful there are stand where the shots look — two around the tidepool
 * garden, two by the eastern bommie, one at each stack's garden and one on the
 * rose garden's skirt. Every home passes `CoralField.isClear`, which is the
 * whole clearance contract (crevice rings, mounds, corridors, the anemone
 * disc) read from the file that owns it; `tests/fauna.test.ts` re-checks.
 */
const HOMES: readonly (readonly [number, number])[] = [
  [5.3, 10.6],
  [10.2, 11.6],
  [6.5, -4.9],
  [4.0, -7.5],
  [13.9, -2.0],
  [-12.9, -1.7],
  [-4.2, 13.4],
];

/** How far from home a scuttle may end. Small: a crab has a doorstep. */
const WANDER_RADIUS = 1.1;
/** Metres per second across the sand. Slower when the motion is reduced. */
const SCUTTLE_SPEED = 0.55;
/** Diver range inside which a burst is audible, and worth a click. */
const CLICK_RANGE = 6.5;
/** A dash costs the crab a longer sit afterwards. */
const PAUSE_RANGE: readonly [number, number] = [2.4, 6.5];
/** Startle: a diver arriving this close, this fast, interrupts the pause. */
const STARTLE_RANGE = 2.4;
const STARTLE_SPEED = 1.0;
/** Minimum simulated seconds between clicks, across the whole population. */
const CLICK_GAP = 0.4;

interface CrabState {
  readonly rng: Random;
  readonly home: readonly [number, number];
  x: number;
  z: number;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  yaw: number;
  scale: number;
  moving: boolean;
  /** Seconds left in the current phase. */
  timer: number;
  duration: number;
}

/**
 * The sand crabs: a handful of storybook crabs that scuttle in short sideways
 * bursts between pauses, click when they move near the diver, and dash when a
 * body arrives too fast. One instanced mesh wearing the sculpted GLB when it
 * lands and the procedural stand-in until then (and forever, in the no-assets
 * build), one draw call, no shadows — the shrimp's asset contract, one shelf
 * down. Behaviour, placement, audio and the instance stream are unchanged;
 * this was a re-sculpt, not a redesign.
 */
export class Crabs extends FaunaSystem {
  private mesh: InstancedMesh | null = null;
  private readonly crabs: CrabState[] = [];
  private readonly dummy = new Object3D();
  private lastClickAt = -Infinity;
  private time = 0;

  constructor(seed: number = SEEDS.crabs) {
    super("crabs", seed);
  }

  protected build(): void {
    const random = new Random(this.seed);
    const material = this.own(createToonMaterial({ vertexColors: true }));
    const mesh = this.ownInstanced(
      new InstancedMesh(this.own(createCrabGeometry()), material, HOMES.length),
    );
    // Hand-sized fauna: a shadow pass for these costs more than the smudge it
    // would add, the same trade the grass and the fish make.
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // The instances wander, and an `InstancedMesh` bounds itself from the
    // matrices it first sees — the same staleness `Bubbles` opts out of.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh = mesh;
    this.group.add(mesh);

    // The sculpted animal, when it arrives. The stand-in geometry stays owned
    // by this system and is disposed on teardown; the GLB is the library's,
    // shared with any future caller, and must never be disposed here — the
    // shrimp's one-door asset contract, verbatim.
    requestModel("models/creature-crab.glb", (geometry) => {
      mesh.geometry = geometry;
    });

    const color = new Color();
    // The shell hue now lives in the geometry (the GLB's authored terracotta,
    // and the fallback is repainted to match), so the per-instance tint
    // becomes a near-neutral warm multiplier — a GLB bringing its own
    // terracotta must not have terracotta multiplied over it. The two draws
    // per crab keep their order and ranges: the stream is bit-identical.
    for (let i = 0; i < HOMES.length; i++) {
      const home = HOMES[i]!;
      const rng = new Random((this.seed ^ (i * 0x9e37_79b9)) >>> 0);
      const crab: CrabState = {
        rng,
        home,
        x: home[0],
        z: home[1],
        fromX: home[0],
        fromZ: home[1],
        toX: home[0],
        toZ: home[1],
        yaw: rng.range(0, Math.PI * 2),
        scale: rng.range(0.8, 1.3),
        moving: false,
        timer: rng.range(0.5, 4),
        duration: 1,
      };
      this.crabs.push(crab);

      const warm = random.next();
      color.setRGB(1, 0.94 + 0.05 * warm, 0.88 + 0.08 * warm);
      color.multiplyScalar(random.range(0.85, 1.1));
      mesh.setColorAt(i, color);
      this.pose(i, crab, 0);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  update(dt: number, ctx: LifeContext): void {
    const mesh = this.mesh;
    if (!mesh || dt <= 0) {
      return;
    }
    this.time = ctx.time;

    for (let i = 0; i < this.crabs.length; i++) {
      const crab = this.crabs[i]!;
      const diverDistance = Math.hypot(ctx.diverPosition.x - crab.x, ctx.diverPosition.z - crab.z);

      crab.timer -= dt * (crab.moving && ctx.reducedMotion ? 0.7 : 1);
      if (crab.timer <= 0) {
        if (crab.moving) {
          this.beginPause(crab);
        } else {
          this.beginScuttle(crab, diverDistance, null);
        }
      } else if (
        !crab.moving &&
        diverDistance < STARTLE_RANGE &&
        ctx.diverSpeed > STARTLE_SPEED
      ) {
        // A body arriving fast cuts the sit short; the crab dashes away from it.
        this.beginScuttle(crab, diverDistance, ctx.diverPosition);
      }

      let bob = 0;
      if (crab.moving) {
        const t = 1 - crab.timer / crab.duration;
        const ease = t * t * (3 - 2 * t);
        crab.x = crab.fromX + (crab.toX - crab.fromX) * ease;
        crab.z = crab.fromZ + (crab.toZ - crab.fromZ) * ease;
        if (!ctx.reducedMotion) {
          bob = Math.abs(Math.sin(t * Math.PI * 7)) * 0.006;
        }
      }
      this.pose(i, crab, bob);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  private beginPause(crab: CrabState): void {
    crab.moving = false;
    crab.x = crab.toX;
    crab.z = crab.toZ;
    crab.duration = crab.rng.range(PAUSE_RANGE[0], PAUSE_RANGE[1]);
    crab.timer = crab.duration;
  }

  /**
   * Starts a burst — toward a spot near home, or directly away from a diver
   * who startled the crab. A candidate has to clear `isClear` along the whole
   * run, not only at its end: two clear endpoints near a boundary can span a
   * chord that dips inside it, and a crab mid-dash is still a placed crab.
   * Candidates that fail retreat toward home.
   */
  private beginScuttle(
    crab: CrabState,
    diverDistance: number,
    away: { x: number; z: number } | null,
  ): void {
    let toX = crab.home[0];
    let toZ = crab.home[1];
    if (away) {
      const dx = crab.x - away.x;
      const dz = crab.z - away.z;
      const length = Math.hypot(dx, dz) || 1;
      const dash = crab.rng.range(0.5, 0.85);
      const candidateX = crab.x + (dx / length) * dash + crab.rng.signed(0.15);
      const candidateZ = crab.z + (dz / length) * dash + crab.rng.signed(0.15);
      if (pathClear(crab.x, crab.z, candidateX, candidateZ)) {
        toX = candidateX;
        toZ = candidateZ;
      }
    } else {
      for (let attempt = 0; attempt < 2; attempt++) {
        const angle = crab.rng.range(0, Math.PI * 2);
        const reach = WANDER_RADIUS * Math.sqrt(crab.rng.next());
        const candidateX = crab.home[0] + Math.cos(angle) * reach;
        const candidateZ = crab.home[1] + Math.sin(angle) * reach;
        if (pathClear(crab.x, crab.z, candidateX, candidateZ)) {
          toX = candidateX;
          toZ = candidateZ;
          break;
        }
      }
    }

    const distance = Math.hypot(toX - crab.x, toZ - crab.z);
    if (distance < 0.05) {
      // Nowhere to go: sit a little longer instead of twitching in place.
      this.beginPause(crab);
      return;
    }

    crab.moving = true;
    crab.fromX = crab.x;
    crab.fromZ = crab.z;
    crab.toX = toX;
    crab.toZ = toZ;
    crab.duration = Math.min(1.2, Math.max(0.4, distance / SCUTTLE_SPEED));
    crab.timer = crab.duration;
    // Sideways gait: the body faces perpendicular to the direction of travel.
    crab.yaw = Math.atan2(toX - crab.x, toZ - crab.z) - Math.PI / 2;

    if (diverDistance < CLICK_RANGE && this.time - this.lastClickAt >= CLICK_GAP) {
      this.lastClickAt = this.time;
      playReefEvent("crab-click", 0.9 * (1 - diverDistance / CLICK_RANGE));
    }
  }

  private pose(index: number, crab: CrabState, bob: number): void {
    this.dummy.position.set(crab.x, seabedHeight(crab.x, crab.z) + 0.008 + bob, crab.z);
    this.dummy.rotation.set(0, crab.yaw, 0);
    this.dummy.scale.setScalar(crab.scale * CRAB_SCALE);
    this.dummy.updateMatrix();
    this.mesh?.setMatrixAt(index, this.dummy.matrix);
  }
}

/** The endpoint and four points along the way, all through `isClear`. */
function pathClear(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
  for (let step = 1; step <= 5; step++) {
    const t = step / 5;
    if (!isClear(fromX + (toX - fromX) * t, fromZ + (toZ - fromZ) * t)) {
      return false;
    }
  }
  return true;
}

/**
 * The stand-in crab, facing +Z: a rounded carapace, two bead eyes, two folded
 * claws, and three flattened legs a side. About 230 triangles — every part is
 * an indexed grid, so the merge cannot silently reject one the way the fish's
 * tail was once lost.
 *
 * It is painted in the GLB's own palette — the linear equivalent of the old
 * per-instance shell hexes moved into the vertex colours — because the
 * instance tint is a near-neutral multiplier now (see `build`). Under that
 * tint the stand-in reads the same dusty terracotta it always did, and the
 * GLB reads its authored colour: same matrices, same palette story, either
 * door. The markings (dark eyes, pale claws, shaded legs) keep their old
 * relative values against the shell.
 */
function createCrabGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const shell = new Color(0xb06e4e);

  const carapace = new SphereGeometry(0.055, 8, 5);
  carapace.scale(1.3, 0.6, 1.0);
  carapace.translate(0, 0.052, 0);
  parts.push(paintVertices(carapace, shell.r, shell.g, shell.b));

  for (const side of [-1, 1]) {
    const eye = new SphereGeometry(0.011, 4, 3);
    eye.translate(side * 0.02, 0.082, 0.05);
    parts.push(paintVertices(eye, 0.08, 0.07, 0.1));

    const claw = new SphereGeometry(0.016, 5, 4);
    claw.scale(1.1, 0.8, 1.25);
    claw.translate(side * 0.042, 0.028, 0.056);
    parts.push(paintVertices(claw, shell.r, shell.g * 0.93, shell.b * 0.86));

    for (let leg = 0; leg < 3; leg++) {
      const limb = new CylinderGeometry(0.0045, 0.008, 0.078, 4, 1, true);
      // Lean each leg outward and down so the tips plant wider than the shell.
      limb.rotateZ(side * (Math.PI / 2 - 0.55));
      limb.rotateY(side * (leg - 1) * 0.45);
      limb.translate(side * 0.062, 0.028, (leg - 1) * 0.036);
      parts.push(paintVertices(limb, shell.r * 0.78, shell.g * 0.75, shell.b * 0.78));
    }
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    // Cannot happen while every part above is an indexed grid; the fallback
    // keeps the reef alive rather than correct if a refactor breaks that.
    return paintVertices(new SphereGeometry(0.055, 8, 5), shell.r, shell.g, shell.b);
  }
  merged.computeBoundingSphere();
  return merged;
}
