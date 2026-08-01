import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Mesh,
  Vector3,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { SEEDS } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { seabedHeight } from "../../Seabed";
import { EMBER, applyLampGlow, smoothstep01 } from "./Smoking3Shared";
import { worldOf } from "./Smoking3Terrain";

/**
 * The Lampwright — the region's findable resident: a small night
 * octopus that tends the lanterns. It carries a living ember cupped in
 * the freckles of its mantle (the glow material reads them as light)
 * and rides one slow round of the Choir's three lanterns, arms
 * trailing like a banner — in the dusk water it reads as a coal
 * drifting from lamp to lamp, which is what makes it findable.
 *
 * The body is a fixed-topology mantle dome plus six trailing arm
 * strips (the Ember Skate's device, next of kin): a rows × columns
 * ring sheet whose *positions* are rewritten each frame along a closed
 * path around the court, the mantle pulsing in a slow jet-beat.
 * Everything is closed-form off FLIGHT time — which counts from the
 * moment a diver first reaches the court and wakes the roosting
 * keeper, never from page boot. Capture-safe by behaviour, not by
 * pinning (the Forge Combs' wake-latch precedent).
 */

const SEED = SEEDS.regionSmoking3;

export const WRIGHT_SPECIES_ID = "lampwright";

/** Mantle rings: rows crown → skirt, columns around the axis. */
const ROWS = 9;
const COLS = 10;
/** Trailing arms and their strip segments. */
const ARMS = 6;
const ARM_SEGMENTS = 5;

/** One round of the Choir, in seconds — a patient animal. */
const LOOP_SECONDS = 64;

/** Body measures, metres. */
const MANTLE_LENGTH = 1.1;
const MANTLE_RADIUS = 0.55;
const ARM_REACH = 1.5;

/** The Choir court's centre, spoke coordinates. */
const COURT = { u: 1430, v: 10 } as const;
/** Where the roosting wright sits, as a loop angle: theta 0 puts the
 *  roost at the round's east point (1443, 10) — beside the wick road,
 *  a coal resting on the warm ground until a diver comes. */
const ROOST_THETA = 0;
/** How far a diver must come before the keeper lifts off, metres. */
const WAKE_RADIUS = 90;
/** Seconds of the lift-off ease from the roost to flight height. */
const RISE_SECONDS = 3;

export interface WrightBuild {
  readonly meshes: Mesh[];
  readonly target: DiscoveryTarget;
  update(
    time: number,
    reducedMotion: boolean,
    diverPosition: { readonly x: number; readonly z: number },
  ): void;
}

/** The round: a soft oval through the Choir's court, clear of all three
 *  lanterns' colliders (the region test walks the whole path). */
function pathAt(t: number, rise: number, out: Vector3): Vector3 {
  const theta = t * Math.PI * 2 + ROOST_THETA;
  const u = COURT.u + 13 * Math.cos(theta);
  const v = COURT.v + 9 * Math.sin(theta);
  const { x, z } = worldOf(u, v);
  const floor = seabedHeight(x, z);
  out.set(x, floor + 0.5 + (1.9 + 0.6 * Math.sin(theta * 2)) * rise, z);
  return out;
}

export function buildSmoking3Wright(): WrightBuild {
  const geometry = buildWrightBody();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0xff8c3a,
    // The carried coal must read across the court in the night haze.
    emissiveIntensity: 0.6,
  });
  applyLampGlow(material, "vigil-lampwright");
  const mesh = new Mesh(geometry, material);
  mesh.name = "vigil-lampwright";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  // The discovery target rides the mantle crown (the morays' head
  // convention): the player focuses the animal, not a spot of water.
  const target: DiscoveryTarget = {
    speciesId: WRIGHT_SPECIES_ID,
    position: new Vector3(),
  };

  const position = geometry.attributes.position as BufferAttribute;
  const at = new Vector3();
  const ahead = new Vector3();
  const tangent = new Vector3();
  const side = new Vector3();
  const lift = new Vector3();
  const ring = new Vector3();
  const up = new Vector3(0, 1, 0);

  const pose = (flightTime: number): void => {
    const head = (flightTime / LOOP_SECONDS) % 1;
    const beat = flightTime * 1.1;
    const rise = smoothstep01(flightTime / RISE_SECONDS);
    pathAt(head, rise, at);
    pathAt((head + 0.005) % 1, rise, ahead);
    tangent.subVectors(ahead, at).normalize();
    side.crossVectors(tangent, up).normalize();
    lift.crossVectors(side, tangent).normalize();

    // The mantle: a pulsing dome swimming crown-first.
    const pulse = 1 + 0.1 * Math.sin(beat) * rise;
    const stretch = 1 - 0.06 * Math.sin(beat) * rise;
    for (let row = 0; row < ROWS; row++) {
      const rowT = row / (ROWS - 1);
      const along = MANTLE_LENGTH * (0.65 - rowT) * stretch;
      const radius = MANTLE_RADIUS * Math.sin(Math.min(1, rowT * 1.12) * Math.PI * 0.62) * pulse;
      for (let col = 0; col < COLS; col++) {
        const ang = (col / COLS) * Math.PI * 2;
        ring
          .copy(side)
          .multiplyScalar(Math.cos(ang) * radius)
          .addScaledVector(lift, Math.sin(ang) * radius * 0.92);
        const idx = row * COLS + col;
        position.setXYZ(
          idx,
          at.x + tangent.x * along + ring.x,
          at.y + tangent.y * along + ring.y,
          at.z + tangent.z * along + ring.z,
        );
      }
    }
    // The crown is the focusable point.
    target.position.set(
      at.x + tangent.x * MANTLE_LENGTH * 0.65,
      at.y + tangent.y * MANTLE_LENGTH * 0.65,
      at.z + tangent.z * MANTLE_LENGTH * 0.65,
    );

    // The arms: six strips trailing the skirt down the path behind.
    const armBase = ROWS * COLS;
    for (let arm = 0; arm < ARMS; arm++) {
      const armAng = (arm / ARMS) * Math.PI * 2 + 0.3;
      for (let seg = 0; seg < ARM_SEGMENTS; seg++) {
        const segT = (seg + 1) / ARM_SEGMENTS;
        const s = (((head - (MANTLE_LENGTH * 0.4 + segT * ARM_REACH) / 900) % 1) + 1) % 1;
        pathAt(s, rise, ring);
        const wave = Math.sin(beat * 1.4 - segT * 2.6 + arm) * 0.14 * segT * rise;
        const spread = MANTLE_RADIUS * (0.7 - segT * 0.35);
        const ox =
          side.x * (Math.cos(armAng) * spread + wave) + lift.x * Math.sin(armAng) * spread;
        const oy =
          side.y * (Math.cos(armAng) * spread + wave) +
          lift.y * Math.sin(armAng) * spread -
          segT * 0.12;
        const oz =
          side.z * (Math.cos(armAng) * spread + wave) + lift.z * Math.sin(armAng) * spread;
        const width = 0.05 * (1 - segT * 0.7);
        for (const [k, dir] of [-1, 1].entries()) {
          position.setXYZ(
            armBase + (arm * ARM_SEGMENTS + seg) * 2 + k,
            ring.x + ox + side.x * dir * width,
            ring.y + oy,
            ring.z + oz + side.z * dir * width,
          );
        }
      }
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  pose(0);
  geometry.computeBoundingSphere();
  // The round never leaves the court's reach; one honest sphere, forever.
  const mid = worldOf(COURT.u, COURT.v);
  geometry.boundingSphere!.center.set(mid.x, seabedHeight(mid.x, mid.z) + 2.5, mid.z);
  geometry.boundingSphere!.radius = 40;

  // The wake latch (the Forge Combs' R5): the keeper roosts, arms
  // curled, until a diver first reaches the court — then it lifts into
  // its round and stays on the wing. Flight time counts from THAT
  // moment, never from page boot, so a capture's settle always finds
  // it the same seconds into the same round; wall clock cannot reach it.
  const court = worldOf(COURT.u, COURT.v);
  let flying = false;
  let flightTime = 0;
  let last = 0;
  return {
    meshes: [mesh],
    target,
    update(
      time: number,
      reducedMotion: boolean,
      diverPosition: { readonly x: number; readonly z: number },
    ): void {
      const dt = Math.max(0, time - last);
      last = time;
      if (!flying) {
        const dx = diverPosition.x - court.x;
        const dz = diverPosition.z - court.z;
        flying = dx * dx + dz * dz < WAKE_RADIUS * WAKE_RADIUS;
      }
      if (!flying) {
        return;
      }
      flightTime += dt * (reducedMotion ? 0.5 : 1);
      pose(flightTime);
    },
  };
}

/** The wright's whole flight path, world space, for the pose-distance
 *  and collider-clearance tests. */
export function wrightPathPoints(samples = 64): Vector3[] {
  const points: Vector3[] = [];
  for (let i = 0; i < samples; i++) {
    const out = new Vector3();
    pathAt(i / samples, 1, out);
    points.push(out);
  }
  // The roost itself (rise 0) is part of the flight envelope.
  const roost = new Vector3();
  pathAt(0, 0, roost);
  points.push(roost);
  return points;
}

/** The body sheet's static half: colours and indices. */
function buildWrightBody(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertexCount = ROWS * COLS + ARMS * ARM_SEGMENTS * 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const back = new Color(0x4c3e56);
  const flank = new Color(0x685260);
  const rim = new Color(0xe2d4b8);
  const shade = new Color();

  for (let row = 0; row < ROWS; row++) {
    const rowT = row / (ROWS - 1);
    for (let col = 0; col < COLS; col++) {
      shade.copy(back).lerp(flank, smoothstep01((rowT - 0.35) / 0.4));
      // The skirt's milk-pale hem — the province's bright top, worn low.
      shade.lerp(rim, smoothstep01((rowT - 0.82) / 0.16) * 0.7);
      // The carried coal: ember freckles cupped on the crown; the glow
      // material reads these as light.
      const freckle = smoothstep01(
        (fbm(rowT * 5, col * 0.8, { seed: SEED ^ 0xf4ec, period: 5, octaves: 2 }) - 0.55) / 0.12,
      );
      shade.lerp(EMBER, freckle * 0.7 * (1 - smoothstep01((rowT - 0.42) / 0.3)));
      const idx = row * COLS + col;
      colors[idx * 3] = shade.r;
      colors[idx * 3 + 1] = shade.g;
      colors[idx * 3 + 2] = shade.b;
    }
  }
  // The arms wear the back's dark, rim-tipped.
  const armBase = ROWS * COLS;
  for (let arm = 0; arm < ARMS; arm++) {
    for (let seg = 0; seg < ARM_SEGMENTS; seg++) {
      const segT = (seg + 1) / ARM_SEGMENTS;
      for (const k of [0, 1]) {
        shade.copy(back).lerp(rim, segT * 0.45);
        const idx = armBase + (arm * ARM_SEGMENTS + seg) * 2 + k;
        colors[idx * 3] = shade.r;
        colors[idx * 3 + 1] = shade.g;
        colors[idx * 3 + 2] = shade.b;
      }
    }
  }

  // The mantle sheet, both windings so the underside draws too.
  for (let row = 0; row < ROWS - 1; row++) {
    for (let col = 0; col < COLS; col++) {
      const nextCol = (col + 1) % COLS;
      const a = row * COLS + col;
      const b = row * COLS + nextCol;
      const c = a + COLS;
      const d = b + COLS;
      indices.push(a, b, c, b, d, c);
      indices.push(c, b, a, c, d, b);
    }
  }
  // Each arm strip off the skirt row.
  for (let arm = 0; arm < ARMS; arm++) {
    const skirtCol = Math.round((arm / ARMS) * COLS) % COLS;
    let prevA = (ROWS - 1) * COLS + skirtCol;
    let prevB = (ROWS - 1) * COLS + ((skirtCol + 1) % COLS);
    for (let seg = 0; seg < ARM_SEGMENTS; seg++) {
      const a = armBase + (arm * ARM_SEGMENTS + seg) * 2;
      const b = a + 1;
      indices.push(prevA, prevB, a, prevB, b, a);
      indices.push(a, prevB, prevA, a, b, prevB);
      prevA = a;
      prevB = b;
    }
  }

  const positionAttribute = new BufferAttribute(positions, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}
