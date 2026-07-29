import {
  ConeGeometry,
  Group,
  Mesh,
  Sphere,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import { requestModel } from "../../../rendering/AssetLibrary";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { OPEN_BLUE } from "../../../world/wings/defs/OpenBlue";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import type { LifeContext } from "../../life/LifeSystem";
import {
  MythicBody,
  buildSkinnedBody,
  retireFallback,
  type JointSpec,
} from "../shared/MythicBody";

/** The brief's hard ceiling; asserted in tests and in the build script. */
export const SERPENT_TRI_BUDGET = 6000;
export const SERPENT_MODEL_PATH = "models/creature-serpent.glb";

/** Authored 1 m nose-to-tail; the being patrols at nine. */
export const SERPENT_SCALE = 9;

/**
 * The figure-eight, centred on the Open Blue's axis: a racetrack
 * lemniscate in the wing's polar frame — `u` across the wedge, `v` along
 * the radius. Two choices are deliberate. The lobes are gentle: a tight
 * Gerono eight (turn radius ≈ 1 m at the tips) would snap a nine-metre
 * body around hairpins, so the radial swing is flattened and the spine's
 * curvature feed fillets what turn is left. And the two arms of the
 * crossing are split in *height* (the bob runs at twice the eight's
 * frequency), so the serpent passes over its own trail and the figure
 * reads as an eight from inside the water. The whole path stays inside
 * r 41.4–44.6 — well within r 38–48 — and never nearer than ≈ 0.03 rad
 * to the wedge's walls, while the crossing itself sits on the wing's mid
 * corridor at (43, 5.5), where a hovering diver earns the 14 m discovery.
 */
export const SERPENT_CIRCUIT = {
  azimuth: OPEN_BLUE.azimuth,
  radius: 43,
  height: 5.5,
  across: 4.5,
  along: 3.2,
  bob: 1.5,
  /** Seconds per traversal of the eight — a slow circuit, on purpose. */
  period: 85,
} as const;

const BANK_SAMPLES = 128;
const BANK_GAIN = 5.0;
const BANK_MAX = 0.35;
/** The spine's curvature feed: how hard each vertebra helps the turn. */
const CURL_GAIN = 3.5;
const CURL_MAX = 0.28;

/** Lateral undulation: per-joint amplitude, frequency, and the tailward lag. */
const UND_AMP = 0.14;
const UND_HZ = 0.32;
const UND_LAG = 0.55;

/** A calm diver is regarded; a hurried one is simply passed. */
const GAZE_RANGE = 12;
const GAZE_MAX_SPEED = 1.2;
const GAZE_YAW_MAX = 0.5;

/**
 * The discovery point rides the circuit a fixed phase ahead of the body —
 * which is where the head is — so it inherits every path bound exactly,
 * whatever the undulation is doing.
 */
const HEAD_LEAD = 0.55;

/** One circuit's own variation, drawn from the serpent's stream. */
export interface SerpentCircuitParams {
  /** Where on the eight the dive begins. */
  readonly phase: number;
  /** +1 swims the eight one way, -1 the other. */
  readonly direction: 1 | -1;
  /** The bob's offset, so height and the eight are not in lockstep. */
  readonly bobPhase: number;
}

/** Draws the circuit's variation from the serpent's own stream. */
export function drawSerpentCircuit(random: Random): SerpentCircuitParams {
  return {
    phase: random.range(0, Math.PI * 2),
    direction: random.next() < 0.5 ? 1 : -1,
    bobPhase: random.range(0, Math.PI * 2),
  };
}

/**
 * The eight in world space at `phi` (radians of traversal, unbounded).
 * Pure and exported: the tests walk the whole circuit and check it never
 * leaves the wedge.
 */
export function serpentCircuitAt(
  params: SerpentCircuitParams,
  phi: number,
  out: Vector3,
): Vector3 {
  const t = phi * params.direction + params.phase;
  const u = SERPENT_CIRCUIT.across * Math.cos(t);
  const v = SERPENT_CIRCUIT.along * Math.sin(t) * Math.cos(t);
  const radius = SERPENT_CIRCUIT.radius + v;
  const azimuth = SERPENT_CIRCUIT.azimuth + Math.atan2(u, radius);
  return out.set(
    radius * Math.cos(azimuth),
    SERPENT_CIRCUIT.height + SERPENT_CIRCUIT.bob * Math.sin(2 * t + params.bobPhase),
    radius * Math.sin(azimuth),
  );
}

/** The skin's joint order, measured off the GLB with the inspector. */
const JOINTS: readonly JointSpec[] = [
  { name: "root", origin: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], parent: null },
  { name: "neck", origin: [0, 0, 0.36], x: [1, 0, 0], y: [0, 1, 0], parent: 0 },
  { name: "spine1", origin: [0, 0, 0.22], x: [1, 0, 0], y: [0, 1, 0], parent: 0 },
  { name: "spine2", origin: [0, 0, 0.08], x: [1, 0, 0], y: [0, 1, 0], parent: 2 },
  { name: "spine3", origin: [0, 0, -0.06], x: [1, 0, 0], y: [0, 1, 0], parent: 3 },
  { name: "spine4", origin: [0, -0.003, -0.18], x: [1, 0, 0], y: [0, 1, 0], parent: 4 },
  { name: "spine5", origin: [0, -0.008, -0.3], x: [1, 0, 0], y: [0, 1, 0], parent: 5 },
  { name: "tail", origin: [0, -0.011, -0.4], x: [1, 0, 0], y: [0, 1, 0], parent: 6 },
];

/**
 * Seven angles, one per spine joint head-to-tail. The spine bones chain
 * from `spine1`, so the wave accumulates down the body the way a spine's
 * does; the `neck` hangs off the root instead, so the gaze turns the head
 * without dragging nine metres of body after it.
 */
interface SerpentRig {
  pose(angles: readonly number[]): void;
}

/**
 * The Old Current, patrolling the Open Blue's middle water in a slow
 * banked figure-eight. The body is `creature-serpent.glb` at nine times
 * scale; until it lands — and forever, if it never does — a chained
 * primitive stand-in with the same pivots wears the same wave, so the
 * behaviour is identical in every build.
 */
export class OldCurrent extends MythicBody {
  readonly target: DiscoveryTarget;

  private readonly params: SerpentCircuitParams;
  private readonly bankTable: Float32Array;
  private readonly curlTable: Float32Array;
  private phi = 0;
  private gaze = 0;
  private readonly angles: [number, number, number, number, number, number, number] = [
    0, 0, 0, 0, 0, 0, 0,
  ];

  private rig: SerpentRig;
  private fallback: Group | null;
  private readonly bodyMaterial = this.own(
    createToonMaterial({ color: 0x3f6b58 }),
  );

  private readonly scratch = new Vector3();
  private readonly scratchB = new Vector3();

  constructor(seed: number = SEEDS.mythSerpent) {
    super("old-current");
    const random = new Random(seed);
    this.params = drawSerpentCircuit(random);
    this.phi = 0;
    const tables = buildMotionTables(this.params);
    this.bankTable = tables.bank;
    this.curlTable = tables.curl;
    this.body.scale.setScalar(SERPENT_SCALE);

    const built = buildFallbackSerpent(this.bodyMaterial, (r) => this.own(r));
    this.fallback = built.fallback;
    this.rig = built.rig;
    this.body.add(built.fallback);

    this.target = {
      speciesId: "myth-old-current",
      position: new Vector3(),
    };
    this.place(0, false);

    requestModel(SERPENT_MODEL_PATH, (geometry) => this.adoptModel(geometry));
  }

  update(dt: number, ctx: LifeContext): void {
    this.phi += ((Math.PI * 2) / SERPENT_CIRCUIT.period) * dt * (ctx.reducedMotion ? 0.55 : 1);
    this.place(ctx.time, ctx.reducedMotion);
    this.regard(dt, ctx);
  }

  /** Path, orientation, bank, undulation and the discovery point. */
  private place(time: number, reducedMotion: boolean): void {
    serpentCircuitAt(this.params, this.phi, this.body.position);
    serpentCircuitAt(this.params, this.phi + 0.01, this.scratch).sub(this.body.position);
    const horizontal = Math.hypot(this.scratch.x, this.scratch.z);
    this.body.rotation.set(
      -Math.atan2(this.scratch.y, horizontal),
      Math.atan2(this.scratch.x, this.scratch.z),
      this.sample(this.bankTable, this.phi) * (reducedMotion ? 0.5 : 1),
      "YXZ",
    );

    // The spine: the swim wave, plus the path's own curvature so the body
    // visibly fillets the lobe turns rather than snapping around them.
    const curl = this.sample(this.curlTable, this.phi) * (reducedMotion ? 0.6 : 1);
    const calm = reducedMotion ? 0.55 : 1;
    for (let i = 0; i < this.angles.length; i++) {
      this.angles[i] = UND_AMP * Math.sin(time * UND_HZ * Math.PI * 2 - i * UND_LAG) * calm + curl;
    }
    this.angles[0] += this.gaze;
    this.rig.pose(this.angles);

    serpentCircuitAt(this.params, this.phi + HEAD_LEAD, this.target.position);
  }

  /**
   * The regard: a diver drifting calmly within range earns a slight turn
   * of the head — the turtle's nod idiom, grown to a gaze. Banking the
   * whole body toward them would be menace; a third of a radian at the
   * neck is company.
   */
  private regard(dt: number, ctx: LifeContext): void {
    let want = 0;
    const distance = this.scratchB.subVectors(ctx.diverPosition, this.body.position).length();
    if (distance < GAZE_RANGE && ctx.diverSpeed < GAZE_MAX_SPEED) {
      this.scratch.copy(ctx.diverPosition).sub(this.body.position);
      const inverse = this.body.quaternion.clone().invert();
      this.scratch.applyQuaternion(inverse);
      want = Math.max(-GAZE_YAW_MAX, Math.min(GAZE_YAW_MAX, Math.atan2(this.scratch.x, this.scratch.z)));
    }
    const rate = want === 0 ? 0.8 : 1.6;
    this.gaze += Math.max(-rate * dt, Math.min(rate * dt, want - this.gaze));
  }

  /** Table lookup with wrap and lerp — bank and curl share the sampler. */
  private sample(table: Float32Array, phi: number): number {
    const wrapped = ((phi % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const at = (wrapped / (Math.PI * 2)) * BANK_SAMPLES;
    const i = Math.floor(at) % BANK_SAMPLES;
    const f = at - Math.floor(at);
    const a = table[i]!;
    const b = table[(i + 1) % BANK_SAMPLES]!;
    return a + (b - a) * f;
  }

  /** The GLB landed: rebuild the skeleton and retire the stand-in. */
  private adoptModel(geometry: BufferGeometry): void {
    if (this.isDisposed) {
      return;
    }
    this.bodyMaterial.color.set(0xffffff);
    this.bodyMaterial.vertexColors = true;
    this.bodyMaterial.needsUpdate = true;

    const { mesh, bones, skeleton } = buildSkinnedBody(
      geometry,
      JOINTS,
      this.bodyMaterial,
      new Sphere(new Vector3(0, 0, 0), 0.75),
    );
    this.ownSkeleton(skeleton);
    this.body.add(mesh);

    if (this.fallback) {
      this.body.remove(this.fallback);
      retireFallback(this.fallback, new Set([this.bodyMaterial]), (r) => this.disposeOwned(r));
      this.fallback = null;
    }

    const spine = [bones[1]!, bones[2]!, bones[3]!, bones[4]!, bones[5]!, bones[6]!, bones[7]!];
    this.rig = {
      pose: (angles) => {
        for (let i = 0; i < spine.length; i++) {
          spine[i]!.rotation.y = angles[i]!;
        }
      },
    };
  }
}

/**
 * Signed turn rate around the circuit, baked at construction into two
 * tables off the same samples: `bank` rolls the whole body into the turn
 * (the visitor idiom), `curl` feeds the spine's fillet of the same turn.
 */
function buildMotionTables(params: SerpentCircuitParams): {
  bank: Float32Array;
  curl: Float32Array;
} {
  const bank = new Float32Array(BANK_SAMPLES);
  const curl = new Float32Array(BANK_SAMPLES);
  const behind = new Vector3();
  const here = new Vector3();
  const ahead = new Vector3();
  for (let i = 0; i < BANK_SAMPLES; i++) {
    const phi = (i / BANK_SAMPLES) * Math.PI * 2;
    serpentCircuitAt(params, phi - 0.02, behind);
    serpentCircuitAt(params, phi, here);
    serpentCircuitAt(params, phi + 0.02, ahead);
    const headingIn = Math.atan2(here.x - behind.x, here.z - behind.z);
    let dh = Math.atan2(ahead.x - here.x, ahead.z - here.z) - headingIn;
    if (dh > Math.PI) {
      dh -= Math.PI * 2;
    } else if (dh < -Math.PI) {
      dh += Math.PI * 2;
    }
    bank[i] = Math.max(-BANK_MAX, Math.min(BANK_MAX, dh * BANK_GAIN));
    curl[i] = Math.max(-CURL_MAX, Math.min(CURL_MAX, dh * CURL_GAIN));
  }
  return { bank, curl };
}

/**
 * The no-assets Old Current: eight chained pivot groups at the measured
 * joint positions, each carrying a squashed-sphere segment, the violet
 * crest as flattened cones, a cream underside, and a blunt kind head.
 * The pivots are exactly the GLB's joints, so one wave drives both bodies.
 */
function buildFallbackSerpent(
  bodyMaterial: Material,
  own: <T extends BufferGeometry | Material>(r: T) => T,
): { fallback: Group; rig: SerpentRig } {
  const fallback = new Group();
  fallback.name = "serpent-fallback";

  const violet = own(createToonMaterial({ color: 0x58427e }));
  const cream = own(createToonMaterial({ color: 0xe3dcae }));
  const dark = own(createToonMaterial({ color: 0x1d1a16 }));

  // (z, radius): segment centres and girths, mirroring the GLB's profile.
  const SEGMENTS = [
    { z: 0.44, r: 0.046 },
    { z: 0.29, r: 0.037 },
    { z: 0.15, r: 0.042 },
    { z: 0.01, r: 0.042 },
    { z: -0.12, r: 0.037 },
    { z: -0.24, r: 0.03 },
    { z: -0.35, r: 0.022 },
    { z: -0.455, r: 0.012 },
  ];
  const JOINT_Z: [number, number, number, number, number, number, number] = [
    0.36, 0.22, 0.08, -0.06, -0.18, -0.3, -0.4,
  ];

  const segmentGeometry = own(new SphereGeometry(1, 12, 9));
  const finGeometry = own(new ConeGeometry(0.030, 0.075, 5));

  const pivots: Group[] = [];
  // The neck pivot carries the head; the spine chain carries the rest.
  const neck = new Group();
  neck.position.set(0, 0, JOINT_Z[0]);
  fallback.add(neck);
  pivots.push(neck);

  const skull = new Mesh(segmentGeometry, bodyMaterial);
  skull.scale.set(0.048, 0.05, 0.1);
  skull.position.set(0, 0, SEGMENTS[0]!.z - JOINT_Z[0]!);
  neck.add(skull);
  const snout = new Mesh(segmentGeometry, bodyMaterial);
  snout.scale.set(0.028, 0.03, 0.05);
  snout.position.set(0, -0.004, 0.15);
  neck.add(snout);
  for (const side of [1, -1]) {
    const eye = new Mesh(segmentGeometry, dark);
    eye.scale.setScalar(0.012);
    eye.position.set(side * 0.034, 0.012, 0.1);
    neck.add(eye);
  }

  let parent = fallback;
  let parentZ = 0;
  for (let i = 1; i < JOINT_Z.length; i++) {
    const pivot = new Group();
    pivot.position.set(0, 0, JOINT_Z[i]! - parentZ);
    parent.add(pivot);
    parent = pivot;
    parentZ = JOINT_Z[i]!;
    pivots.push(pivot);
  }

  for (let i = 1; i < SEGMENTS.length; i++) {
    const segment = SEGMENTS[i]!;
    // One more segment than pivots: the tail tip rides the last vertebra.
    const joint = Math.min(i, pivots.length - 1);
    const pivot = pivots[joint]!;
    const body = new Mesh(segmentGeometry, bodyMaterial);
    body.scale.set(segment.r * 0.92, segment.r * 1.04, 0.085);
    body.position.set(0, 0, segment.z - JOINT_Z[joint]!);
    pivot.add(body);
    if (i < 4) {
      const belly = new Mesh(segmentGeometry, cream);
      belly.scale.set(segment.r * 0.62, segment.r * 0.42, 0.075);
      belly.position.set(0, -segment.r * 0.62, segment.z - JOINT_Z[joint]!);
      pivot.add(belly);
    }
    if (i >= 1 && i <= 6) {
      const fin = new Mesh(finGeometry, violet);
      fin.scale.set(0.35, 1, 0.8);
      fin.position.set(0, segment.r * 1.04 + 0.03, segment.z - JOINT_Z[joint]!);
      pivot.add(fin);
    }
  }

  for (const side of [1, -1]) {
    const pectoral = new Mesh(segmentGeometry, violet);
    pectoral.scale.set(0.05, 0.012, 0.028);
    pectoral.position.set(side * 0.055, -0.02, 0.315 - JOINT_Z[1]!);
    pivots[1]!.add(pectoral);
  }

  const rig: SerpentRig = {
    pose: (angles) => {
      for (let i = 0; i < pivots.length; i++) {
        pivots[i]!.rotation.y = angles[i]!;
      }
    },
  };
  return { fallback, rig };
}
