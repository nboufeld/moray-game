import {
  BufferAttribute,
  CapsuleGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { seabedHeight } from "../../Seabed";
import { BLOOM_FAMILIES, mergedMesh, smoothstep01 } from "./PaleShared";
import { worldOf } from "./PaleTerrain";

/**
 * THE GARDENER — the Bone Meadows' findable resident.
 *
 * An old hermit crab grown to boulder size, whose borrowed shell carries
 * a living coral garden — the only full colour that *moves* through the
 * white half's edge. It plods one slow circle at the First Blush's rim,
 * pausing as if to press a sprig into the sand; the nursery rows around
 * the Seed Grove are its work. The body is one merged geometry posed by
 * its group; the update spends no randomness, so a capture's settle is
 * deterministic.
 *
 * ## The paint
 *
 * The crab is chalk-violet — a creature of the white world, its plates
 * banded pale over violet joints (red above green, nothing near black) —
 * and the garden on its back is painted at full recovery: the animal is
 * the story carried on eight legs.
 *
 * The discovery target sits at the circuit's centre; the crab crosses
 * within a body-length of it twice a loop.
 */

const SEED = SEEDS.regionPale1;

export const GARDENER_SPECIES_ID = "pale-gardener";

/** The Gardener's Round: the circuit's centre, in spoke coordinates. */
export const GARDENER_ROUND = { u: 492, v: 26 } as const;
const CIRCUIT_RADIUS = 3.2;
/** Seconds per lap — an old animal with nowhere urgent to be. */
const LAP_SECONDS = 48;

const UP = new Vector3(0, 1, 0);

export interface GardenerBuild {
  readonly group: Group;
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildGardener(): GardenerBuild {
  const random = new Random(SEED ^ 0x0ee7);
  const group = new Group();
  group.name = "pale-gardener";

  const center = worldOf(GARDENER_ROUND.u, GARDENER_ROUND.v);

  // ─── The body ────────────────────────────────────────────────────────────
  const bodyParts: BufferGeometry[] = [];

  const paint = (
    geometry: BufferGeometry,
    sample: (y: number, x: number, z: number) => readonly [number, number, number],
  ): void => {
    const position = geometry.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const [r, g, b] = sample(position.getY(i), position.getX(i), position.getZ(i));
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
  };

  const chalk = new Color(0xe8e2d4);
  const joint = new Color(0x8a7099);
  const shade = new Color();

  // The shell's icosahedron is non-indexed and every other primitive is
  // indexed; `mergeGeometries` rejects the mix (the fish-tail trap), so
  // each part is unrolled before its paint is written.
  const unrolled = <T extends BufferGeometry>(geometry: T): BufferGeometry =>
    geometry.index ? geometry.toNonIndexed() : geometry;

  // The shell: a knocked-out-of-round dome, ridged in a loose spiral —
  // an old whelk the size of a rowboat, worn to chalk.
  const shell = new IcosahedronGeometry(1.5, 3);
  {
    const position = shell.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const length = Math.hypot(x, y, z) || 1;
      const angle = Math.atan2(z, x);
      const lift = Math.asin(Math.max(-1, Math.min(1, y / length)));
      const spiral = 0.5 + 0.5 * Math.sin(angle * 2 + lift * 5.5);
      const scale = 1 + spiral * 0.1 - Math.max(0, -y / length) * 0.28;
      position.setXYZ(i, x * scale, y * scale * 0.82 + 1.35, z * scale);
    }
    position.needsUpdate = true;
    shell.computeVertexNormals();
    paint(shell, (y, x, z) => {
      const spiralShade =
        0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 2 + Math.asin(Math.min(1, Math.max(-1, (y - 1.35) / 1.6))) * 5.5);
      const value = 0.78 + spiralShade * 0.26;
      shade.copy(chalk).multiplyScalar(value);
      shade.b = Math.min(1, shade.b * (1.02 + (1 - spiralShade) * 0.08));
      return [shade.r, shade.g, shade.b];
    });
    bodyParts.push(shell);
  }

  // The crab under it: a low carapace lip, eight plodding legs, two eye
  // stalks. Violet joints under chalk plates.
  const carapace = unrolled(new SphereGeometry(0.95, 9, 6));
  carapace.scale(1.25, 0.55, 1.05);
  carapace.translate(0.25, 0.62, 0);
  paint(carapace, (y) => {
    const t = smoothstep01((y - 0.3) / 0.6);
    shade.copy(joint).lerp(chalk, t);
    return [shade.r, shade.g, shade.b];
  });
  bodyParts.push(carapace);

  const leg = (side: number, seat: number): void => {
    const hipAngle = side * (0.55 + seat * 0.5) + (side < 0 ? Math.PI : 0);
    const hip = new Vector3(Math.sin(hipAngle) * 0.9, 0.55, Math.cos(hipAngle) * 0.9);
    const knee = new Vector3(
      hip.x * 1.9 + random.signed(0.12),
      0.95 + random.range(0, 0.25),
      hip.z * 1.9 + random.signed(0.12),
    );
    const foot = new Vector3(knee.x * 1.25, -0.02, knee.z * 1.25);
    for (const [from, to, radius] of [
      [hip, knee, 0.16],
      [knee, foot, 0.11],
    ] as const) {
      const direction = to.clone().sub(from);
      const length = direction.length();
      const segment = unrolled(new CapsuleGeometry(radius, length, 1, 5));
      segment.applyMatrix4(
        new Matrix4().compose(
          from.clone().add(to).multiplyScalar(0.5),
          new Quaternion().setFromUnitVectors(UP, direction.normalize()),
          new Vector3(1, 1, 1),
        ),
      );
      paint(segment, (y) => {
        const t = smoothstep01(y / 1.1);
        shade.copy(joint).lerp(chalk, 0.35 + t * 0.5);
        return [shade.r, shade.g, shade.b];
      });
      bodyParts.push(segment);
    }
  };
  for (const side of [-1, 1]) {
    for (let seat = 0; seat < 4; seat++) {
      leg(side, seat);
    }
  }

  // Eye stalks, forward along +x (the group's heading axis).
  for (const side of [-1, 1]) {
    const stalk = unrolled(new CapsuleGeometry(0.06, 0.5, 1, 5));
    stalk.applyMatrix4(
      new Matrix4().compose(
        new Vector3(1.35, 1.05, side * 0.28),
        new Quaternion().setFromUnitVectors(UP, new Vector3(0.7, 1, side * 0.15).normalize()),
        new Vector3(1, 1, 1),
      ),
    );
    paint(stalk, () => [joint.r * 1.1, joint.g * 1.1, joint.b * 1.15]);
    bodyParts.push(stalk);
    const eye = unrolled(new SphereGeometry(0.11, 6, 5));
    eye.translate(1.52, 1.3, side * 0.32);
    paint(eye, () => [0.24, 0.2, 0.3]);
    bodyParts.push(eye);
  }

  const body = mergedMesh(bodyParts, createToonMaterial({ vertexColors: true }), "pale-gardener-body");
  group.add(body);

  // ─── The garden on its back ──────────────────────────────────────────────
  // Sprigs at full colour: little antler prongs, two tube pipes and a
  // fan blade planted in the shell's ridges — the region's whole story,
  // carried.
  const gardenParts: BufferGeometry[] = [];
  const sprigShade = new Color();
  for (let i = 0; i < 9; i++) {
    const angle = random.range(0, Math.PI * 2);
    const r = random.range(0.2, 1.0);
    const base = new Vector3(Math.cos(angle) * r, 2.35 + (1 - r) * 0.5, Math.sin(angle) * r);
    const family = BLOOM_FAMILIES[i % BLOOM_FAMILIES.length]!;
    const prongs = 2 + Math.floor(random.next() * 2);
    for (let p = 0; p < prongs; p++) {
      const yaw = random.range(0, Math.PI * 2);
      const tilt = random.range(0.15, 0.55);
      const direction = new Vector3(Math.cos(yaw) * tilt, 1, Math.sin(yaw) * tilt).normalize();
      const length = random.range(0.35, 0.75);
      const tip = base.clone().addScaledVector(direction, length);
      const segment = new CapsuleGeometry(random.range(0.035, 0.06), length, 1, 5);
      segment.applyMatrix4(
        new Matrix4().compose(
          base.clone().add(tip).multiplyScalar(0.5),
          new Quaternion().setFromUnitVectors(UP, direction),
          new Vector3(1, 1, 1),
        ),
      );
      const baseY = base.y;
      paint(segment, (y) => {
        const t = smoothstep01((y - baseY) / Math.max(0.2, length));
        sprigShade.copy(family).multiplyScalar(0.72 + t * 0.42);
        return [sprigShade.r, sprigShade.g, sprigShade.b];
      });
      gardenParts.push(segment);
    }
  }
  const garden = mergedMesh(
    gardenParts,
    createToonMaterial({ vertexColors: true }),
    "pale-gardener-garden",
  );
  group.add(garden);

  // ─── The circuit ─────────────────────────────────────────────────────────
  const target: DiscoveryTarget = {
    speciesId: GARDENER_SPECIES_ID,
    position: new Vector3(center.x, seabedHeight(center.x, center.z) + 1.6, center.z),
  };

  const phase = random.range(0, Math.PI * 2);
  const pose = (time: number): void => {
    const lap = (time / LAP_SECONDS) * Math.PI * 2 + phase;
    // The plod: the circle's sweep gated by a pause harmonic — it stops,
    // presses, and moves on. Heading follows the sweep's own tangent.
    const press = 0.5 + 0.5 * Math.sin(lap * 4);
    const sweep = lap + Math.sin(lap * 4) * 0.06;
    const x = center.x + Math.cos(sweep) * CIRCUIT_RADIUS;
    const z = center.z + Math.sin(sweep) * CIRCUIT_RADIUS;
    group.position.set(x, seabedHeight(x, z) + 0.06 + press * 0.1, z);
    // Heading: the body's +x forward laid along the circle's own tangent
    // (rotation.y = θ maps local +x to (cos θ, 0, −sin θ); the tangent of
    // a counterclockwise sweep is (−sin s, 0, cos s), so θ = −s − π/2).
    group.rotation.set(
      Math.sin(lap * 4) * 0.02,
      -sweep - Math.PI / 2,
      Math.sin(lap * 2) * 0.03,
    );
  };
  pose(0);

  let slowTime = 0;
  let last = 0;
  return {
    group,
    target,
    update(time: number, reducedMotion: boolean): void {
      const dt = Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}
