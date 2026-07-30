import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import { createFishGeometry } from "../../../creatures/fish/FishGeometry";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { KitBuild, KitPalette } from "./KitTypes";

/**
 * `percherColony` (KIT-SPEC §3.2) — small fauna seated on parent
 * transforms: perch fish on column break-faces, bark-percher fry,
 * brittle/cushion stars, whelk-class shrimps at stone feet, moth-fry
 * circling lanterns (hover), ledge crabs (dart). One body kind per
 * call, one draw per call.
 *
 * Bodies are the bowl's own idioms at percher scale: the five-lobed
 * cushion star (verdant's floor fauna), the sculpted community fish
 * loft for fry and blennies, a curled-tail shrimp — or caller geometry
 * for region exclusives (MASTER R8). Paint is value-first: the body's
 * baked gradient carries the drawing, the palette carries the hue, and
 * per-instance jitter moves value only.
 *
 * Motion is closed-form off simulated time (capture-safe):
 * - `seated` is still and exposes no `update`; the colony keeps frustum
 *   culling under an instance-aware sphere (law 4's default half);
 * - `hover` circles each anchor on its own beat (the moth-fry);
 * - `dart` rests, bursts along a seeded ledge line, rests, bursts home
 *   — a pure function of time, so any dt path agrees;
 *   movers opt out of culling per law 4 (every instance moves every
 *   frame), which the spec sanctions for percher movers explicitly.
 *
 * Budget note: 1 draw. Star 80 tris, fish bodies 104–112, shrimp 80 —
 * a 4-anchor × 5-body colony is ≈ 1.6–2.2k tris.
 */

export type PercherBody = "star" | "fry" | "shrimp" | "blenny";
export type PercherMotion = "seated" | "hover" | "dart";

export interface PercherAnchor {
  readonly pos: readonly [number, number, number];
  /** The perch's surface normal; up when absent. Seated bodies align. */
  readonly normal?: readonly [number, number, number];
}

export interface PercherColonyOptions {
  readonly seed: number;
  readonly palette: KitPalette;
  readonly anchors: readonly PercherAnchor[];
  readonly perAnchor: number;
  /** A named bowl body, or caller geometry for region exclusives. */
  readonly body?: PercherBody | BufferGeometry;
  readonly motion?: PercherMotion;
}

export interface PercherColonyBuild extends KitBuild {
  update?(timeSec: number): void;
}

/** How far seated/darting bodies scatter around their anchor, metres. */
const SEAT_SPREAD = 0.45;

/** Hover ring radius bounds, metres. */
const HOVER_RADIUS = [0.25, 0.65] as const;

/** A dart's reach along the ledge, metres, and its cycle bounds (s). */
const DART_REACH = [0.4, 0.9] as const;
const DART_PERIOD = [3.2, 6.5] as const;
/** The burst's share of a half-cycle — short on purpose: a crab flicks. */
const DART_BURST = 0.22;

const UP = new Vector3(0, 1, 0);

function smoothstep01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/** The five-lobed cushion star, domed, tips lifted — the bowl's idiom. */
function starGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(0.16, 1);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    const lobe = 0.62 + 0.38 * Math.pow(Math.abs(Math.cos(angle * 2.5)), 0.7);
    const r = Math.hypot(x, z);
    position.setX(i, x * lobe * (1 + r));
    position.setZ(i, z * lobe * (1 + r));
    position.setY(i, Math.max(0.004, position.getY(i) * 0.32 * (1 - r * 0.6)));
  }
  position.needsUpdate = true;
  smoothNormals(geometry);

  // Tip light: lobe ends catch the water light, the disc holds the tone.
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / 0.36;
    const value = 0.72 + smoothstep01((r - 0.35) / 0.55) * 0.4;
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value * 0.94;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** A curled-tail shrimp: a stretched dome with the abdomen tucked under. */
function shrimpGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(0.05, 1);
  geometry.scale(0.9, 0.7, 2.2);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i);
    if (z < -0.04) {
      // The tail curls down and inward past the body's rear third.
      const curl = Math.min(1, (-z - 0.04) / 0.07);
      position.setY(i, position.getY(i) - curl * 0.035);
      position.setZ(i, z + curl * 0.02);
    }
  }
  position.needsUpdate = true;
  smoothNormals(geometry);

  // Banded value along the body — a shrimp is striped, value-first.
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const z = position.getZ(i);
    const band = 0.82 + 0.18 * Math.sin(z * 90);
    const value = band * (0.85 + 0.3 * Math.min(1, Math.max(0, position.getY(i) / 0.035)));
    colors[i * 3] = Math.min(1, value);
    colors[i * 3 + 1] = Math.min(1, value * 0.97);
    colors[i * 3 + 2] = Math.min(1, value * 0.92);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

function bodyGeometry(body: PercherBody | BufferGeometry, seed: number): {
  geometry: BufferGeometry;
  owned: boolean;
} {
  if (body instanceof BufferGeometry) {
    return { geometry: body, owned: false };
  }
  switch (body) {
    case "star":
      return { geometry: starGeometry(), owned: true };
    case "shrimp":
      return { geometry: shrimpGeometry(), owned: true };
    case "fry":
      return {
        geometry: createFishGeometry({
          width: 0.42,
          height: 0.45,
          length: 0.42,
          tailTaper: 0.5,
          dorsal: 0.55,
          pectoral: 0.7,
          tail: { reach: 1.4, lobe: 0.6, notch: 1.0 },
          paintSeed: seed ^ 0x0f27,
        }),
        owned: true,
      };
    case "blenny":
      return {
        geometry: createFishGeometry({
          width: 0.5,
          height: 0.42,
          length: 0.62,
          tailTaper: 0.46,
          dorsal: 0.9,
          pectoral: 1.1,
          tail: { reach: 1.3, lobe: 0.55, notch: 0.95 },
          paintSeed: seed ^ 0x0f28,
        }),
        owned: true,
      };
    default: {
      const exhaustive: never = body;
      throw new Error(`unhandled percher body: ${String(exhaustive)}`);
    }
  }
}

interface Agent {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: number;
  /** hover: ring radius / dart: reach. */
  readonly reach: number;
  /** hover: rad/s equivalent; dart: cycle seconds. */
  readonly rate: number;
  readonly phase: number;
  readonly direction: number;
  /** Dart heading (unit XZ). */
  readonly dartX: number;
  readonly dartZ: number;
}

export function buildPercherColony(options: PercherColonyOptions): PercherColonyBuild {
  const random = new Random(options.seed);
  const motion = options.motion ?? "seated";
  const body = options.body ?? "star";
  const { geometry, owned } = bodyGeometry(body, options.seed);
  const count = options.anchors.length * options.perAnchor;

  const material = createToonMaterial({ vertexColors: geometry.hasAttribute("color") });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = `kit-percher-${typeof body === "string" ? body : "custom"}`;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  if (motion !== "seated") {
    // Movers opt out (law 4, sanctioned): every instance moves every frame.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  }

  const agents: Agent[] = [];
  const dummy = new Object3D();
  const tint = new Color();
  const base = new Color(options.palette.base);
  const tip = new Color(options.palette.tip ?? options.palette.base);
  const alignment = new Quaternion();
  const normal = new Vector3();

  let index = 0;
  for (const anchor of options.anchors) {
    const [ax, ay, az] = anchor.pos;
    normal.set(...(anchor.normal ?? [0, 1, 0])).normalize();
    for (let i = 0; i < options.perAnchor; i++) {
      const angle = random.range(0, Math.PI * 2);
      const spread = motion === "hover" ? 0 : SEAT_SPREAD * Math.sqrt(random.next());
      const agent: Agent = {
        x: ax + Math.cos(angle) * spread,
        y: ay,
        z: az + Math.sin(angle) * spread,
        yaw: random.range(0, Math.PI * 2),
        scale: random.range(0.75, 1.35),
        reach:
          motion === "hover"
            ? random.range(HOVER_RADIUS[0], HOVER_RADIUS[1])
            : random.range(DART_REACH[0], DART_REACH[1]),
        rate:
          motion === "dart"
            ? random.range(DART_PERIOD[0], DART_PERIOD[1])
            : random.range(0.25, 0.6),
        phase: random.next(),
        direction: random.next() < 0.5 ? 1 : -1,
        dartX: Math.cos(angle),
        dartZ: Math.sin(angle),
      };
      agents.push(agent);

      // Seated pose now; movers are re-posed by update(0) below.
      dummy.position.set(agent.x, agent.y, agent.z);
      dummy.quaternion.copy(alignment.setFromUnitVectors(UP, normal));
      dummy.rotateY(agent.yaw);
      dummy.scale.setScalar(agent.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      // One value above the perch, jittered by value alone; tips of the
      // palette lean in on the brighter individuals.
      const value = random.range(0.85, 1.2);
      tint.copy(base).lerp(tip, Math.max(0, value - 1) * 1.6).multiplyScalar(Math.min(value, 1.05));
      mesh.setColorAt(index, tint);
      index += 1;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  let update: ((timeSec: number) => void) | undefined;
  if (motion === "hover") {
    update = (timeSec: number): void => {
      for (const [i, agent] of agents.entries()) {
        const a = agent.phase * Math.PI * 2 + timeSec * agent.rate * Math.PI * 2 * agent.direction * 0.4;
        const x = agent.x + Math.cos(a) * agent.reach;
        const z = agent.z + Math.sin(a) * agent.reach;
        const y =
          agent.y + Math.sin(timeSec * (0.8 + agent.rate) + agent.phase * 7) * 0.08;
        dummy.position.set(x, y, z);
        // The nose follows the ring's own tangent.
        dummy.rotation.set(0, Math.atan2(-Math.sin(a) * agent.direction, Math.cos(a) * agent.direction) + Math.PI / 2, 0);
        dummy.scale.setScalar(agent.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
  } else if (motion === "dart") {
    update = (timeSec: number): void => {
      for (const [i, agent] of agents.entries()) {
        const u = (((timeSec / agent.rate + agent.phase) % 1) + 1) % 1;
        // Out-burst, rest away, home-burst, rest home — all closed-form.
        let along: number;
        let facing = 1;
        if (u < DART_BURST) {
          along = smoothstep01(u / DART_BURST);
        } else if (u < 0.5) {
          along = 1;
        } else if (u < 0.5 + DART_BURST) {
          along = 1 - smoothstep01((u - 0.5) / DART_BURST);
          facing = -1;
        } else {
          along = 0;
          facing = -1;
        }
        const x = agent.x + agent.dartX * agent.reach * along;
        const z = agent.z + agent.dartZ * agent.reach * along;
        dummy.position.set(x, agent.y, z);
        dummy.rotation.set(0, Math.atan2(agent.dartX * facing, agent.dartZ * facing), 0);
        dummy.scale.setScalar(agent.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
  }
  update?.(0);
  // Instance-aware bounds off real matrices (the sill-stones trap); the
  // sphere is metadata for seated colonies' culling and stays honest for
  // movers too (they never leave anchor + reach).
  mesh.computeBoundingSphere();

  const group = new Group();
  group.name = "kit-percher-colony";
  group.add(mesh);

  const triangles = ((geometry.index?.count ?? geometry.attributes.position!.count) / 3) * count;

  return {
    group,
    draws: 1,
    triangles,
    ...(update ? { update } : {}),
    dispose(): void {
      if (owned) {
        geometry.dispose();
      }
      material.dispose();
      mesh.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}
