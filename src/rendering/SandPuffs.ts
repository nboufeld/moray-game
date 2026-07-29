import {
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Object3D,
  SphereGeometry,
  Vector3,
  type Scene,
} from "three";
import type { LifeContext, LifeSystem } from "../creatures/life/LifeSystem";
import { Random, SEEDS } from "../util/Random";
import { createToonMaterial } from "./ToonShading";

/**
 * The little clouds the sand throws up when something disturbs it (W-L7).
 *
 * It lives with the rendering layer rather than with the animals because what
 * it draws is a puff of silt, but it is driven like everything else that moves
 * — through {@link LifeSystem} — so whichever creature kicks it can hand it a
 * position and forget about it. The hand-off is {@link requestSandPuff}, a
 * module-scope registry in the visitors' pattern: the system registers itself
 * at construction, and a moray bolting into its den needs no reference to
 * anything `Game` owns.
 *
 * The drawing is one `InstancedMesh` of small toon-shaded silt motes — one
 * draw call, no shadows either way, `frustumCulled` false for the bubbles'
 * reason (every live instance moves every frame). A mote fades by *scale*
 * rather than opacity, exactly the trade `Bubbles` documents: every instance
 * shares one opaque material, so the cloud costs no sorting and no blending,
 * and an idle system draws zero instances (`count` tracks the live motes).
 * The motes are lit surfaces, not emissive marks, so they wear the shared
 * ramp like everything else on the seabed.
 *
 * This module is also the one channel the morays have back to the diver's
 * *motion*: `LifeContext` carries `diverSpeed` and `reducedMotion`, and
 * `Moray.update` is handed neither. Each update publishes them into module
 * scope for {@link diverMotion} to read — a stated wart in the `FaunaAudio`
 * family, and the thing to delete if the moray update signature ever grows.
 * Using the dive controller's own speed (rather than differencing positions)
 * is what makes the capture harness safe: `Game.capture` teleports the diver
 * and zeroes the velocity, so a screenshot pose can never read as a charge.
 */

/** Ceiling on live motes; a burst arriving over it retires the oldest. */
const MAX_MOTES = 72;
/** Motes per burst, before strength and reduced motion scale it. */
const BURST_BASE = 10;
const BURST_PER_STRENGTH = 6;
/** How far away a puff is still worth a sound, in metres. */
const AUDIO_RANGE = 9;
/** Minimum simulated seconds between puff sounds, across every burst. */
const AUDIO_GAP = 0.3;
/** Horizontal launch speed range, in m/s. Silt billows; it does not spray. */
const LAUNCH_SPEED: readonly [number, number] = [0.18, 0.55];
const LAUNCH_RISE: readonly [number, number] = [0.14, 0.38];
/** Water drag per second, and the slow settling pull once the billow spends. */
const DRAG = 2.2;
const SETTLE = 0.085;
/** Mote lifetime and peak radius ranges. The radii were sized off a render,
 * not a guess: the first cut ran 3.5–7.5 cm and a whole burst at the four
 * metres the probe poses stand from a den measured as nothing — a puff the
 * player cannot see is a puff that does not exist. */
const LIFE: readonly [number, number] = [1.1, 2.1];
const PEAK_RADIUS: readonly [number, number] = [0.06, 0.13];
/** Fraction of a mote's life spent swelling to its peak. */
const RISE_TIME = 0.18;

/** Dusty sand tones, straight from the seabed's own pastel family. */
const SILT_TONES = [0xd9c9a3, 0xd2c19c, 0xe0d2af] as const;

interface Mote {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  peak: number;
  /** The mote's own tint, re-written on compaction so a death cannot recolour
   * a survivor: instance slots shift when the list packs down. */
  r: number;
  g: number;
  b: number;
}

/** The one live system, in the visitor-director pattern. */
let active: SandPuffs | null = null;

function registerActive(system: SandPuffs): void {
  active = system;
}

/** Latest diver motion published off the frame's `LifeContext`; see header. */
const published = { speed: 0, reducedMotion: false, valid: false };

/**
 * Kicks a silt cloud at a world position. Safe with no system in the scene
 * (a plain no-op), which is what keeps every caller testable in plain Node.
 */
export function requestSandPuff(position: Vector3, strength = 1): void {
  active?.puffAt(position, strength);
}

/**
 * The diver's motion as of the last frame the life registry ran, or null
 * before it has run at all (unit tests, a scene with no registry).
 */
export function diverMotion(): Readonly<{ speed: number; reducedMotion: boolean }> | null {
  return published.valid ? published : null;
}

interface ReefEventPlayer {
  playEvent(name: "sand-puff", gain?: number): void;
}

/** Guarded like `FaunaAudio`: a no-op without a window. */
function playSandPuffAudio(gain: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const audio = (window as unknown as { __reefAudio?: ReefEventPlayer }).__reefAudio;
  audio?.playEvent("sand-puff", gain);
}

export class SandPuffs implements LifeSystem {
  readonly group = new Group();

  private readonly random: Random;
  private readonly motes: Mote[] = [];
  private readonly dummy = new Object3D();
  private readonly tint = new Color();
  private readonly diverPosition = new Vector3(0, 2, 22);
  private mesh: InstancedMesh | null = null;
  private time = 0;
  private lastAudioAt = -Infinity;

  constructor(readonly seed: number = SEEDS.sandPuffs) {
    this.group.name = "sand-puffs";
    this.random = new Random(seed);
    registerActive(this);
    // QA door, the visitors' `__reefVisitors.summon` one system over: a puff
    // is a two-second transient no capture settle can catch on its own, so
    // the probes kick one and then advance a fraction of a second into it.
    if (typeof window !== "undefined") {
      (window as unknown as { __sandPuffs?: object }).__sandPuffs = {
        puff: (x: number, y: number, z: number, strength = 1) =>
          this.puffAt(new Vector3(x, y, z), strength),
      };
    }
  }

  /**
   * Contents are built on `addTo`, not at construction — the fauna's test
   * contract (`tests/lifeSystems.test.ts` asserts the group is empty before
   * it joins a scene), inherited with the interface.
   */
  addTo(scene: Scene): void {
    if (!this.mesh) {
      const geometry = new SphereGeometry(1, 6, 5);
      const material = createToonMaterial({ color: 0xffffff });
      const mesh = new InstancedMesh(geometry, material, MAX_MOTES);
      // Hand-sized transients: a shadow pass would cost more than the smudge.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // Every live instance moves every frame — the bubbles' argument.
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.count = 0;
      this.mesh = mesh;
      this.group.add(mesh);
    }
    scene.add(this.group);
  }

  update(dt: number, ctx: LifeContext): void {
    // Published even on a paused frame: the morays read the *setting* off
    // this channel as much as the speed, and the comfort panel is exactly
    // where reduced motion gets toggled.
    published.speed = ctx.diverSpeed;
    published.reducedMotion = ctx.reducedMotion;
    published.valid = true;
    this.diverPosition.copy(ctx.diverPosition);
    this.time = ctx.time;

    const mesh = this.mesh;
    if (!mesh || dt <= 0) {
      return;
    }

    let alive = 0;
    for (const mote of this.motes) {
      mote.age += dt;
      if (mote.age >= mote.life) {
        continue;
      }
      this.motes[alive++] = mote;

      const drag = Math.max(0, 1 - DRAG * dt);
      mote.vx *= drag;
      mote.vy *= drag;
      mote.vz *= drag;
      // Past the billow, silt hangs and then settles rather than stopping.
      if (mote.age > mote.life * 0.4) {
        mote.vy -= SETTLE * dt;
      }
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;
      mote.z += mote.vz * dt;
    }
    this.motes.length = alive;

    for (let i = 0; i < alive; i++) {
      const mote = this.motes[i]!;
      this.poseMote(i, mote);
      mesh.setColorAt(i, this.tint.setRGB(mote.r, mote.g, mote.b));
    }
    mesh.count = alive;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * A burst of silt at `position`: motes launched outward and up, billowing
   * to a peak and shrinking away as they settle. `strength` scales count,
   * size and sound — a startled dash kicks harder than a nosing-out.
   */
  puffAt(position: Vector3, strength = 1): void {
    const mesh = this.mesh;
    if (!mesh) {
      return;
    }
    const kick = Math.min(1.5, Math.max(0, strength));
    const reduced = published.reducedMotion;
    const count = Math.round(
      (BURST_BASE + BURST_PER_STRENGTH * kick) * (reduced ? 0.6 : 1),
    );

    for (let n = 0; n < count; n++) {
      // Over the ceiling, the oldest mote gives way: a stale wisp is the
      // cheapest thing in the cloud to lose.
      if (this.motes.length >= MAX_MOTES) {
        this.motes.shift();
      }
      const azimuth = this.random.range(0, Math.PI * 2);
      const speed =
        this.random.range(LAUNCH_SPEED[0], LAUNCH_SPEED[1]) * (0.7 + 0.5 * kick);
      this.tint.setHex(
        SILT_TONES[Math.floor(this.random.next() * SILT_TONES.length)] ?? SILT_TONES[0],
      );
      this.tint.multiplyScalar(this.random.range(0.92, 1.06));
      const mote: Mote = {
        x: position.x + this.random.signed(0.16),
        y: position.y + this.random.signed(0.08),
        z: position.z + this.random.signed(0.16),
        vx: Math.cos(azimuth) * speed,
        vy: this.random.range(LAUNCH_RISE[0], LAUNCH_RISE[1]) * (0.7 + 0.5 * kick),
        vz: Math.sin(azimuth) * speed,
        age: 0,
        life: this.random.range(LIFE[0], LIFE[1]),
        peak:
          this.random.range(PEAK_RADIUS[0], PEAK_RADIUS[1]) *
          (0.7 + 0.5 * kick) *
          (reduced ? 0.7 : 1),
        r: this.tint.r,
        g: this.tint.g,
        b: this.tint.b,
      };
      this.motes.push(mote);
    }

    for (let i = 0; i < this.motes.length; i++) {
      const mote = this.motes[i]!;
      this.poseMote(i, mote);
      mesh.setColorAt(i, this.tint.setRGB(mote.r, mote.g, mote.b));
    }
    mesh.count = this.motes.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    const distance = this.diverPosition.distanceTo(position);
    if (distance < AUDIO_RANGE && this.time - this.lastAudioAt >= AUDIO_GAP) {
      this.lastAudioAt = this.time;
      playSandPuffAudio(0.85 * (1 - distance / AUDIO_RANGE) * Math.min(1, 0.4 + 0.6 * kick));
    }
  }

  /** How many motes are currently drawing — for the tests and the probes. */
  get liveMotes(): number {
    return this.motes.length;
  }

  private poseMote(index: number, mote: Mote): void {
    const t = mote.age / mote.life;
    const rise = Math.min(1, mote.age / RISE_TIME);
    const fall = Math.max(0, 1 - t);
    const scale = Math.max(1e-4, mote.peak * rise * Math.pow(fall, 1.4));
    this.dummy.position.set(mote.x, mote.y, mote.z);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    this.mesh?.setMatrixAt(index, this.dummy.matrix);
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as { dispose(): void }).dispose();
      this.mesh.dispose();
      this.mesh = null;
    }
    this.motes.length = 0;
    this.group.removeFromParent();
    this.group.clear();
    if (active === this) {
      active = null;
    }
  }
}
