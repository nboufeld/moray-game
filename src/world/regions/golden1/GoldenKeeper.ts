import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LatheGeometry,
  Mesh,
  PlaneGeometry,
  Quaternion,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { seabedHeight } from "../../Seabed";
import { applyVeinGlow, smoothstep01 } from "./GoldenShared";
import { HOURGLASS, worldOf } from "./GoldenTerrain";

/**
 * The Hourglass Keeper — the region's findable resident.
 *
 * An ancient sea-turtle spirit that circles the chasm below the lip,
 * around and around, the way sand circles a drain. Its shell is cut like
 * the hourglass itself: a spiral runnel of bright gold sand runs from
 * the shell's crown to its rim, and the vein-glow material reads that
 * paint as a soft light — in the chasm's violet deep the Keeper is a
 * slow golden ring, which is what makes it findable from the lip.
 *
 * The body is one merged mesh (shell, head, four flippers, tail) posed
 * whole along its patrol each frame: a turtle glides, so the animation
 * is the *path* — a slow descent-and-rise breathing loop around the
 * terraces — plus a gentle inward bank. The update spends no randomness.
 */

const SEED = SEEDS.regionGolden1;

export const KEEPER_SPECIES_ID = "hourglass-keeper";

/** One circuit of the chasm, in seconds — an old, unhurried animal. */
const LOOP_SECONDS = 72;
/** The patrol's radius inside the chasm's 46 m bowl. */
const PATROL_R = 23;

export interface KeeperBuild {
  readonly meshes: Mesh[];
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildKeeper(): KeeperBuild {
  const random = new Random(SEED ^ 0x0ee9);
  const phase = random.range(0, Math.PI * 2);

  const centre = worldOf(HOURGLASS.u, HOURGLASS.v);
  const floorY = seabedHeight(centre.x, centre.z);

  const geometry = buildKeeperBody();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0xf0c060,
    emissiveIntensity: 1.1,
  });
  applyVeinGlow(material, "hourglass-keeper");
  // The lantern is fog-free (the falls' round-5 lesson): with fog on,
  // the bowl's deep mood washed the glow to nothing past ~35 m and the
  // "slow golden ring in the violet deep" was invisible from every
  // pose that framed the whole patrol.
  material.fog = false;
  const mesh = new Mesh(geometry, material);
  mesh.name = "hourglass-keeper";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // The patrol never leaves the chasm; one honest sphere, forever.
  mesh.frustumCulled = false;

  // The drain's eye: the still point the Keeper circles. The discovery
  // target sits mid-water at the chasm's centre so the lip and the deep
  // can both focus it.
  const target: DiscoveryTarget = {
    speciesId: KEEPER_SPECIES_ID,
    position: new Vector3(centre.x, floorY + 12, centre.z),
  };

  // The patrol: a ring at PATROL_R that breathes down toward the floor
  // and back up toward the lip once a lap, with a slow radial sway.
  const pathAt = (t: number, out: Vector3): Vector3 => {
    const theta = t * Math.PI * 2 + phase;
    const r = PATROL_R + 3.5 * Math.sin(theta * 2 + phase);
    const depth = floorY + 13 + 6.5 * Math.sin(theta - phase * 0.6);
    out.set(centre.x + Math.cos(theta) * r, depth, centre.z + Math.sin(theta) * r);
    return out;
  };

  const at = new Vector3();
  const ahead = new Vector3();
  const forward = new Vector3();
  const bank = new Quaternion();
  const face = new Quaternion();
  const zAxis = new Vector3(0, 0, 1);
  const roll = new Vector3(0, 0, 1);

  const pose = (time: number): void => {
    const t = (time / LOOP_SECONDS) % 1;
    pathAt(t, at);
    pathAt((t + 0.004) % 1, ahead);
    forward.subVectors(ahead, at).normalize();
    mesh.position.copy(at);
    mesh.position.y += Math.sin(time * 0.5) * 0.3;
    face.setFromUnitVectors(zAxis, forward);
    // A gentle inward bank — the old glide of a circling animal.
    bank.setFromAxisAngle(roll, 0.22 + Math.sin(time * 0.3) * 0.06);
    mesh.quaternion.copy(face).multiply(bank);
  };

  pose(0);

  let slowTime = 0;
  let last = 0;
  return {
    meshes: [mesh],
    target,
    update(time: number, reducedMotion: boolean): void {
      const dt = Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}

// ─── The Keeper's body ───────────────────────────────────────────────────────

const SHELL_DEEP = new Color(0x5e4c66);
const SHELL_MID = new Color(0x8a7468);
const RUNNEL_GOLD = new Color(0xf2cf7e);
const BELLY_CREAM = new Color(0xe4d2ac);
/** The shell's underside — a dusk violet, not cream. Round 7: the
 * vein-glow multiplies the fog-free emissive by the vertex colour, so a
 * cream belly seen from below (the hourglass-deep stand looks UP at the
 * patrol) rendered the whole spirit as one flat neon-orange blob. Dusk
 * below, gold spiral above: a lantern reads from the lip and a violet
 * silhouette with warm edges reads from the floor. */
const BELLY_DUSK = new Color(0x84688a);
const FIN_VIOLET = new Color(0x6e5a72);

function buildKeeperBody(): BufferGeometry {
  const parts: BufferGeometry[] = [];

  // The shell: a lathed dome, flattened, with the spiral runnel painted.
  const profile: Vector2[] = [
    new Vector2(0, 0.62),
    new Vector2(0.5, 0.56),
    new Vector2(0.9, 0.38),
    new Vector2(1.12, 0.12),
    new Vector2(1.16, -0.04),
    new Vector2(0.9, -0.16),
    new Vector2(0.45, -0.22),
    new Vector2(0, -0.24),
  ];
  const shell = new LatheGeometry(profile, 18);
  shell.scale(1, 0.82, 1.22);
  smoothNormals(shell);
  {
    const position = shell.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const shade = new Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const r = Math.hypot(x, z);
      const theta = Math.atan2(z, x);
      const t = smoothstep01((y + 0.24) / 0.75);
      shade.copy(SHELL_DEEP).lerp(SHELL_MID, t);
      // The spiral runnel: gold sand running crown to rim, two turns.
      const spiral = theta + r * 5.2;
      const runnel = Math.max(0, Math.sin(spiral)) ** 8;
      shade.lerp(RUNNEL_GOLD, runnel * (0.35 + t * 0.5));
      // Scute mottle so the shell is a drawing, not a gradient.
      const scute =
        (fbm(theta * 1.2, r * 2.2, { seed: SEED ^ 0x5cae, period: 5, octaves: 2 }) - 0.5) * 0.24;
      shade.multiplyScalar(1 + scute);
      // The underside goes dusk-violet (see BELLY_DUSK).
      if (y < -0.12) {
        shade.lerp(BELLY_DUSK, smoothstep01((-y - 0.12) / 0.1) * 0.8);
      }
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    shell.setAttribute("color", new BufferAttribute(colors, 3));
  }
  parts.push(shell.toNonIndexed());
  shell.dispose();

  // The head: a small blunt lathe reaching forward (+z).
  const headProfile: Vector2[] = [
    new Vector2(0, 0.34),
    new Vector2(0.16, 0.3),
    new Vector2(0.22, 0.16),
    new Vector2(0.2, -0.02),
    new Vector2(0.12, -0.14),
    new Vector2(0, -0.18),
  ];
  const head = new LatheGeometry(headProfile, 10);
  smoothNormals(head);
  head.rotateX(Math.PI / 2);
  head.scale(1, 0.9, 1.3);
  head.translate(0, -0.02, 1.35);
  {
    const position = head.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const shade = new Color();
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      shade.copy(FIN_VIOLET).lerp(BELLY_CREAM, smoothstep01((-y + 0.05) / 0.2) * 0.6);
      // A gold crown-stripe over the eyes.
      if (y > 0.1) {
        shade.lerp(RUNNEL_GOLD, 0.45);
      }
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    head.setAttribute("color", new BufferAttribute(colors, 3));
  }
  parts.push(head.toNonIndexed());
  head.dispose();

  // The flippers: four blades, fore pair long and swept, hind pair short.
  const flipper = (
    length: number,
    width: number,
    x: number,
    z: number,
    yaw: number,
  ): void => {
    const blade = new PlaneGeometry(length, width, 4, 1);
    const position = blade.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const shade = new Color();
    for (let i = 0; i < position.count; i++) {
      const t = position.getX(i) / length + 0.5;
      // The blade sweeps back and droops as it reaches.
      position.setY(i, -t * t * 0.16);
      position.setZ(i, position.getZ(i) * (1 - t * 0.55) - t * t * length * 0.3);
      shade.copy(FIN_VIOLET).lerp(RUNNEL_GOLD, smoothstep01((t - 0.55) / 0.45) * 0.5);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    position.needsUpdate = true;
    blade.setAttribute("color", new BufferAttribute(colors, 3));
    blade.rotateY(yaw);
    blade.translate(x, -0.1, z);
    parts.push(blade.toNonIndexed());
    blade.dispose();
  };
  flipper(1.5, 0.5, 1.0, 0.6, -0.5);
  flipper(-1.5, 0.5, -1.0, 0.6, 0.5);
  flipper(0.8, 0.36, 0.8, -0.85, -0.25);
  flipper(-0.8, 0.36, -0.8, -0.85, 0.25);

  // The tail: a short trailing nub.
  const tail = new PlaneGeometry(0.16, 0.5, 1, 2);
  tail.rotateX(Math.PI / 2);
  tail.translate(0, -0.08, -1.35);
  {
    const position = tail.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      colors[i * 3] = FIN_VIOLET.r;
      colors[i * 3 + 1] = FIN_VIOLET.g;
      colors[i * 3 + 2] = FIN_VIOLET.b;
    }
    tail.setAttribute("color", new BufferAttribute(colors, 3));
  }
  parts.push(tail.toNonIndexed());
  tail.dispose();

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("hourglass keeper parts could not be merged");
  }
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  // Grown to a spirit: a discovery should not need a magnifying glass
  // (2.4 after round 1 still vanished at the ring's far arc through
  // the round-4 fog; 3.0 reads as a lantern at 55 m).
  merged.scale(3.0, 3.0, 3.0);
  merged.computeBoundingSphere();
  return merged;
}
