import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { B2_SEEDS, smoothstep01 } from "./Blue2Shared";
import { MOON_WELL, worldOf } from "./Blue2Terrain";

/**
 * THE GENTLE DARK — the Deep Steps' findable resident, and the myth
 * the Open Blue's water always carried, given its one calm shape: a
 * vast winged shadow that keeps the lowest floor of the world,
 * circling the Round on a slow crossed loop and passing through the
 * Moon Well's beam once a round — the dark made visible by the one
 * light it owns. Eleven metres of wing, seen mostly from above: the
 * pale crescent on its crown is the marking the codex draws.
 *
 * ## The build
 *
 * A procedural winged shadow: a flattened lens body, two great swept
 * wing blades (doubled for thickness — no DoubleSide), a tail vane.
 * Painted in vertex colours: violet-slate back (never black; red held
 * above green), pale belly, the crown crescent, wing tips deepening
 * violet. No GLB: the geometry is authored here, its own fallback.
 *
 * ## The patrol
 *
 * One closed seeded loop around the Round at −37..−41, absolute — the
 * region's floor is its floor. The clock runs from the region's own
 * attach with an authored phase (the Ferryman discipline: no
 * wall-clock state; the canonical pose meets the animal at the Well
 * crossing deterministically). The discovery anchor hangs in the Moon
 * Well's beam; a diver who holds the light holds the animal.
 */

const SEED = SEEDS.regionBlue2;

export const GENTLE_DARK_SPECIES_ID = "the-gentle-dark";

/** The patrol's stations: (u, v, absolute y). The seventh station rides
 *  the Moon Well itself — the loop crosses its own light once a round. */
const PATROL: readonly [number, number, number][] = [
  [966, -12, -40],
  [996, 30, -38],
  [1034, 44, -37],
  [1068, 22, -38],
  [1080, -16, -39],
  [1058, -48, -40],
  [MOON_WELL.u, MOON_WELL.v, -38],
  [1002, -44, -40],
];

/** Authored attach phase: the circuit passes the Well anchor ≈ 186 s in
 *  (measured off the CatmullRom's own arc mapping); the capture
 *  harness's shutter lands ≈ 18 s after attach. Verified per round. */
const PATROL_PHASE = 168;

/** One circuit in four minutes — the dark is never in a hurry. */
const CIRCUIT_SECONDS = 240;

export interface GentleDarkBuild {
  readonly mesh: Mesh;
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildGentleDark(): GentleDarkBuild {
  const random = new Random(SEED ^ B2_SEEDS.gentleDark);
  const points: Vector3[] = [];
  for (const [u, v, y] of PATROL) {
    const { x, z } = worldOf(u, v);
    points.push(new Vector3(x, y + random.signed(0.3), z));
  }
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const geometry = darkGeometry();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x2e2a48,
    // Round 2: 0.5 rendered the wings lilac-pink under the Well's
    // light — the dark must be dark; the floor only keeps it a colour.
    emissiveIntensity: 0.35,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "deepsteps-gentle-dark";
  // Round 2: grown — the event register wants the wing to read colossal.
  mesh.scale.setScalar(1.12);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const wellAt = worldOf(MOON_WELL.u, MOON_WELL.v);
  const target: DiscoveryTarget = {
    speciesId: GENTLE_DARK_SPECIES_ID,
    position: new Vector3(wellAt.x, -38, wellAt.z),
  };

  const at = new Vector3();
  const ahead = new Vector3();
  const phase = random.range(0, Math.PI * 2);

  const pose = (time: number): void => {
    const s = (time / CIRCUIT_SECONDS) % 1;
    path.getPointAt(s, at);
    path.getPointAt((s + 0.004) % 1, ahead);
    at.y += Math.sin(time * 0.09 + phase) * 0.6;
    mesh.position.copy(at);
    const heading = Math.atan2(ahead.x - at.x, ahead.z - at.z);
    // The slow wing-beat is the whole body's: a long roll, a soft
    // pitch, the way a ray flies.
    mesh.rotation.set(
      Math.sin(time * 0.11 + phase) * 0.06 + Math.atan2(ahead.y - at.y, 8) * 0.5,
      heading,
      Math.sin(time * 0.23 + phase) * 0.12,
    );
  };

  pose(PATROL_PHASE);

  let slowTime = PATROL_PHASE;
  let last: number | null = null;
  return {
    mesh,
    target,
    update(time: number, reducedMotion: boolean): void {
      // Lazy first sample (the Ferryman's lesson): `last = 0` would hand
      // the patrol's phase to the page's load history.
      const dt = last === null ? 0 : Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}

/** The shadow: flattened lens body, two swept wings, a tail vane. */
function darkGeometry(): BufferGeometry {
  const body = new IcosahedronGeometry(3.2, 2);
  body.deleteAttribute("normal");
  body.deleteAttribute("uv");
  const position = body.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    let x = position.getX(i) * 0.62;
    // Round 3: the r2 lens profile read torpedo-like from the side —
    // the back deepens into a dorsal hump while the belly stays shallow.
    const rawY = position.getY(i);
    let y = rawY * (rawY > 0 ? 0.38 : 0.22);
    let z = position.getZ(i) * 1.2; // +z is the head
    // The head blunts; the rear tapers toward the tail root.
    if (z > 2.6) {
      z = 2.6 + (z - 2.6) * 0.5;
    }
    if (z < -1.8) {
      const over = -z - 1.8;
      z = -1.8 - over * 0.6;
      x *= 1 - over * 0.18;
      y *= 1 - over * 0.12;
    }
    position.setXYZ(i, x, y, z);
  }
  position.needsUpdate = true;

  const wing = (side: number): BufferGeometry => {
    // A great swept delta blade, root chord along the body's middle.
    const s = side;
    const positions = new Float32Array([
      // Leading edge out to the tip.
      s * 1.4, 0.1, 2.0, s * 6.4, -0.1, -0.6, s * 1.5, 0.05, 0.2,
      // Tip back to the trailing root.
      s * 1.5, 0.05, 0.2, s * 6.4, -0.1, -0.6, s * 3.4, -0.05, -1.7,
      s * 1.5, 0.05, 0.2, s * 3.4, -0.05, -1.7, s * 1.3, 0, -1.9,
    ]);
    const blade = new BufferGeometry();
    blade.setAttribute("position", new BufferAttribute(positions, 3));
    const back = blade.clone();
    back.applyMatrix4(new Matrix4().makeScale(1, -1, 1));
    back.translate(0, -0.12, 0);
    blade.translate(0, 0.12, 0);
    const merged = mergeGeometries([blade, back], false);
    blade.dispose();
    back.dispose();
    if (!merged) {
      throw new Error("blue2 gentle dark wing could not be merged");
    }
    // Round 3: dihedral droop — the tips fall away from the body so the
    // blades read as WINGS from the side, not as a lens's thin edge.
    const droopPos = merged.attributes.position!;
    for (let i = 0; i < droopPos.count; i++) {
      const wx = droopPos.getX(i);
      const droop = Math.max(0, Math.abs(wx) - 1.5) * 0.14;
      droopPos.setY(i, droopPos.getY(i) - droop);
    }
    droopPos.needsUpdate = true;
    return merged;
  };

  const tail = (): BufferGeometry => {
    // Round 3: the vane grows — the side silhouette needs the tail's
    // rise to break the torpedo line.
    const positions = new Float32Array([
      0.34, 0.05, -2.6, -0.34, 0.05, -2.6, 0.06, 0.62, -6.3,
      -0.34, 0.05, -2.6, -0.06, 0.62, -6.3, 0.06, 0.62, -6.3,
    ]);
    const vane = new BufferGeometry();
    vane.setAttribute("position", new BufferAttribute(positions, 3));
    const under = vane.clone();
    under.applyMatrix4(new Matrix4().makeScale(1, -1, 1));
    under.translate(0, 0.1, 0);
    vane.translate(0, -0.02, 0);
    const merged = mergeGeometries([vane, under], false);
    vane.dispose();
    under.dispose();
    if (!merged) {
      throw new Error("blue2 gentle dark tail could not be merged");
    }
    return merged;
  };

  const merged = mergeGeometries([body, wing(1), wing(-1), tail()], false);
  body.dispose();
  if (!merged) {
    throw new Error("blue2 gentle dark parts could not be merged");
  }
  // Position-only parts merged: face normals FIRST, then the weld (the
  // Drop Plains' flat-violet corruption, pre-paid — a lit draw with no
  // normal attribute corrupts whole frames on the capture driver).
  merged.computeVertexNormals();
  smoothNormals(merged);

  // The paint: violet-slate back, pale belly, the crown crescent, wing
  // tips deepening violet — the darkest band is a colour, never black.
  const pos = merged.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const back = new Color(0x46406a);
  const belly = new Color(0xaab2cc);
  const crescent = new Color(0xd9dce8);
  const tipTone = new Color(0x38325a);
  const shade = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const top = smoothstep01((y + 0.05) / 0.3);
    shade.copy(belly).lerp(back, top);
    // Round 2: the wings wear the BACK's dark across both faces — the
    // r1 belly mix rendered them lilac-pink in the beam.
    const wingness = smoothstep01((Math.abs(x) - 1.6) / 1.2);
    shade.lerp(back, wingness * 0.75);
    // The crown crescent: the pale arc the codex draws, on the back
    // just behind the head.
    const arc = Math.abs(Math.hypot(x * 0.9, z - 1.1) - 1.35);
    if (y > 0 && arc < 0.5) {
      shade.lerp(crescent, (1 - arc / 0.5) * 0.75);
    }
    // Wing tips deepen.
    const tip = smoothstep01((Math.abs(x) - 3.4) / 3);
    shade.lerp(tipTone, tip * 0.7);
    // Drifted mottle so no facet holds one value.
    const mottle = fbm(x * 0.4 + 7, z * 0.4, { seed: SEED ^ 0xf0ab, period: 4, octaves: 2 });
    shade.lerp(new Color(0x5a5480), smoothstep01((mottle - 0.52) / 0.18) * 0.55 * top);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}
