import {
  BufferAttribute,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  Mesh,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { applyVeinGlow, smoothstep01 } from "./Golden3Shared";
import type { DoorBuild } from "./Golden3Door";
import { DOOR, DOOR_BALCONY, worldOf } from "./Golden3Terrain";

/**
 * THE EVENING PILGRIM — the region's findable resident.
 *
 * An ancient copper sea-turtle that has swum toward the sunset for
 * longer than the desert has had a name, and never once arrived: every
 * evening it circles the Sun's Door — out over the balcony, through
 * the arch's window into the last light, around the flank stack and
 * home. The seams of its shell are painted in vein-glow gold, so as it
 * crosses the window it reads as a slow ember passing through the
 * door — findable from the whole rise; the DiscoveryTarget hangs in
 * the window itself, where the Pilgrim crosses once every round.
 *
 * One merged mesh (shell, head, four fins) posed whole along its
 * closed-form round; the update spends no randomness — captures settle
 * deterministically.
 */

const SEED = SEEDS.regionGolden3;

export const PILGRIM_SPECIES_ID = "vesper-pilgrim";

/** One full round of the door, in seconds. */
const ROUND_SECONDS = 72;

export interface PilgrimBuild {
  readonly meshes: Mesh[];
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildPilgrim(door: DoorBuild): PilgrimBuild {
  const random = new Random(SEED ^ 0x0ef1);
  const phase = random.range(0, 1);
  const window = door.window;

  const geometry = buildPilgrimBody();
  // Round 2: emissive halved — at 0.9 the whole turtle burned orange
  // and the shell's drawing (dark plates, gold seams) was ironed flat.
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0xf0b860,
    emissiveIntensity: 0.45,
  });
  applyVeinGlow(material, "golden3-pilgrim");
  // The ember is fog-free (the Keeper's lesson): a resident that
  // cannot be seen from the balcony is not findable.
  material.fog = false;
  const mesh = new Mesh(geometry, material);
  mesh.name = "vesper-pilgrim";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // The round never leaves the door's own court; one honest sphere is
  // cheaper than per-frame culling of a mover.
  mesh.frustumCulled = false;

  // The round: out over the balcony, THROUGH the window, a swing
  // behind the door, back around the north flank stack, home.
  const points: Vector3[] = [];
  const seat = (u: number, v: number, y: number): void => {
    const { x, z } = worldOf(u, v);
    points.push(new Vector3(x, y, z));
  };
  const wy = window.y;
  seat(1576, -6, DOOR_BALCONY + 6.5);
  seat(1588, -3, wy + 0.4);
  points.push(new Vector3(window.x, wy, window.z)); // the crossing
  seat(1612, -4, wy - 0.6);
  seat(1622, 6, DOOR_BALCONY + 7.5);
  seat(1614, 20, DOOR_BALCONY + 8.5);
  seat(1596, 24, DOOR_BALCONY + 9);
  seat(1578, 14, DOOR_BALCONY + 8);
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const target: DiscoveryTarget = {
    speciesId: PILGRIM_SPECIES_ID,
    position: window.clone(),
  };

  const at = new Vector3();
  const ahead = new Vector3();
  const pose = (time: number): void => {
    const s = ((time / ROUND_SECONDS + phase) % 1 + 1) % 1;
    path.getPointAt(s, at);
    path.getPointAt((s + 0.006) % 1, ahead);
    mesh.position.copy(at);
    mesh.position.y += Math.sin(time * 0.5 + phase * 7) * 0.25;
    const yaw = Math.atan2(ahead.x - at.x, ahead.z - at.z);
    const pitch = Math.atan2(ahead.y - at.y, Math.hypot(ahead.x - at.x, ahead.z - at.z));
    mesh.rotation.set(0, yaw, 0);
    mesh.rotateX(-pitch * 0.8);
    mesh.rotateZ(Math.sin(time * 0.4 + phase * 3) * 0.1);
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

// ─── The Pilgrim's body ──────────────────────────────────────────────────────

// Round 2: plates darker, seams brighter and thinner — the ember reads
// as a DRAWN shell passing the window, not an orange mass.
const SHELL_COPPER = new Color(0x8a5a38);
const SHELL_RIM = new Color(0xd0ac74);
const SEAM_GOLD = new Color(0xffe098);
const SKIN_DUSK = new Color(0x8a6a72);
const SKIN_PALE = new Color(0xc8a882);

function buildPilgrimBody(): BufferGeometry {
  const parts: BufferGeometry[] = [];

  // The shell: a squashed dome wearing painted plate seams — the
  // hex-plate read at toon values without modelling the plates.
  const shell = new SphereGeometry(1.0, 18, 12);
  shell.scale(1.15, 0.52, 1.35);
  smoothNormals(shell);
  {
    const position = shell.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    const shade = new Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const theta = Math.atan2(x, z);
      const up = smoothstep01((y + 0.3) / 0.8);
      shade.copy(SHELL_COPPER).lerp(SHELL_RIM, 1 - up);
      // The seams: gold rings and meridians — the sunset written in
      // the shell, one voyage per line.
      const ring = Math.max(0, Math.sin(Math.hypot(x, z) * 6.2)) ** 14;
      const meridian = Math.max(0, Math.sin(theta * 6 + 0.4)) ** 16 * up;
      shade.lerp(SEAM_GOLD, Math.min(1, ring * 0.85 + meridian * 0.9));
      const mottle =
        (fbm(theta * 1.2, y * 2.2, { seed: SEED ^ 0x0ef2, period: 5, octaves: 2 }) - 0.5) * 0.2;
      shade.multiplyScalar(1 + mottle);
      colors[i * 3] = shade.r;
      colors[i * 3 + 1] = shade.g;
      colors[i * 3 + 2] = shade.b;
    }
    shell.setAttribute("color", new BufferAttribute(colors, 3));
  }
  parts.push(shell.toNonIndexed());
  shell.dispose();

  // The plastron shadow: a flat dusk pad under the shell.
  const belly = new SphereGeometry(0.92, 12, 6);
  belly.scale(1.05, 0.24, 1.25);
  belly.translate(0, -0.18, 0);
  paintFlat(belly, SKIN_DUSK, 0.1);
  parts.push(belly.toNonIndexed());
  belly.dispose();

  // The head: forward, slightly raised — a pilgrim looks at the road.
  const head = new SphereGeometry(0.34, 12, 8);
  head.scale(0.9, 0.8, 1.15);
  head.translate(0, 0.05, 1.55);
  paintFlat(head, SKIN_PALE, 0.12);
  parts.push(head.toNonIndexed());
  head.dispose();

  // The fins: two long foreflippers, two short rear.
  for (const [sx, sz, len, yaw] of [
    [1, 0.62, 1.15, 0.85],
    [-1, 0.62, 1.15, -0.85],
    [1, -0.85, 0.62, 2.5],
    [-1, -0.85, 0.62, -2.5],
  ] as const) {
    const fin = new ConeGeometry(0.22, len, 8);
    fin.scale(1, 1, 0.34);
    fin.rotateZ(sx * (Math.PI / 2 + 0.25));
    fin.rotateY(yaw);
    fin.translate(sx * 1.05, -0.1, sz);
    paintFlat(fin, SKIN_DUSK, 0.14);
    parts.push(fin.toNonIndexed());
    fin.dispose();
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("vesper pilgrim parts could not be merged");
  }
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  // A spirit, not a specimen: readable as an ember from the balcony —
  // round 2 took it down from 2.0 (a 5+ m turtle at the pilgrim pose's
  // 10 m read as a saucer, not a pilgrim).
  merged.scale(1.4, 1.4, 1.4);
  merged.computeBoundingSphere();
  return merged;
}

/** Uniform paint with a small value mottle, for the one-tone parts. */
function paintFlat(geometry: BufferGeometry, color: Color, mottle: number): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const wave =
      (fbm(position.getX(i) * 2, position.getY(i) * 2, { seed: SEED ^ 0x0ef3, period: 4, octaves: 2 }) -
        0.5) *
      mottle *
      2;
    shade.copy(color).multiplyScalar(1 + wave);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** The window the Pilgrim's round crosses, for tests. */
export const PILGRIM_HOME = DOOR;
