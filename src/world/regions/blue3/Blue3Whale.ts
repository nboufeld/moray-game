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
import { B3_SEEDS, applyVeinGlow, smoothstep01 } from "./Blue3Shared";
import { WELLHEAD, worldOf } from "./Blue3Terrain";

/**
 * THE MORNING WHALE — the First Sea's findable resident, and the
 * province's last myth given its shape: a pale whale, fourteen metres,
 * that keeps the floor of the whole ocean and carries the morning on
 * its back — its hide is speckled with the same star-bloom the Mere's
 * floor wears, so a diver watching from below sees a constellation
 * swim. Once a round it rises through the Daybreak's beam over the
 * Wellhead — the sea's breath and the sea's keeper crossing in the one
 * light at the bottom of the world. Where the Gentle Dark was the
 * night made kind, this is the morning made patient.
 *
 * ## The build
 *
 * A procedural whale: a long round-backed body, two pectoral blades, a
 * broad twin-lobed fluke. Painted in vertex colours with the
 * counter-shading INVERTED — pale star-strewn back over a deep violet
 * belly (it carries the light above the dark) — never black, red above
 * green. No GLB: the geometry is authored here, its own fallback.
 *
 * ## The patrol
 *
 * One closed seeded loop around the Wellhead at −44..−36, crossing the
 * Wide Morning (its licensed motion). The clock runs from the region's
 * own attach with an authored phase (the Ferryman discipline — no
 * wall-clock state); the bowl station is the loop's origin, and the
 * phase is set so the canonical pose meets the whale arriving in the
 * beam. The discovery anchor hangs in the Daybreak; a diver who holds
 * the light holds the animal.
 */

const SEED = SEEDS.regionBlue3;

export const MORNING_WHALE_SPECIES_ID = "the-morning-whale";

/** The patrol's stations: (u, v, absolute y). Station 0 is the
 *  Wellhead's bowl — the loop's origin is the beam itself. */
const PATROL: readonly [number, number, number][] = [
  [WELLHEAD.u, WELLHEAD.v, -42],
  [1478, -52, -41],
  [1448, -70, -42],
  [1412, -82, -43],
  [1372, -84, -44],
  [1340, -58, -44],
  [1348, -22, -43],
  [1382, 0, -42],
  [1428, 8, -41],
  [1472, 0, -39],
  [1506, -8, -38],
] as const;

/** One circuit in five minutes — the morning is never in a hurry. */
const CIRCUIT_SECONDS = 300;

/** The capture harness's shutter lands ≈ 18 s after attach; the loop's
 *  origin is the bowl, so this phase puts the whale arriving INTO the
 *  beam as the shutter fires. */
const PATROL_PHASE = CIRCUIT_SECONDS - 18;

export interface MorningWhaleBuild {
  readonly mesh: Mesh;
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildMorningWhale(): MorningWhaleBuild {
  const random = new Random(SEED ^ B3_SEEDS.morningWhale);
  const points: Vector3[] = [];
  for (const [u, v, y] of PATROL) {
    const { x, z } = worldOf(u, v);
    points.push(new Vector3(x, y + random.signed(0.3), z));
  }
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const geometry = whaleGeometry();
  const material = createToonMaterial({
    vertexColors: true,
    // The dusk floor keeps the belly a colour in the deep; the vein
    // glow rides the paint, so the star-strewn back carries a faint
    // light of its own — the morning, carried.
    emissive: 0x4a4260,
    emissiveIntensity: 0.32,
  });
  applyVeinGlow(material, "blue3-morning-whale");
  const mesh = new Mesh(geometry, material);
  mesh.name = "firstsea-morning-whale";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const wellAt = worldOf(WELLHEAD.u, WELLHEAD.v);
  const target: DiscoveryTarget = {
    speciesId: MORNING_WHALE_SPECIES_ID,
    position: new Vector3(wellAt.x, -40, wellAt.z),
  };

  const at = new Vector3();
  const ahead = new Vector3();
  const phase = random.range(0, Math.PI * 2);

  const pose = (time: number): void => {
    const s = (time / CIRCUIT_SECONDS) % 1;
    path.getPointAt(s, at);
    path.getPointAt((s + 0.004) % 1, ahead);
    // Rising through the beam: the loop's origin dips the body upward
    // through the bowl's column once a round.
    const rise = 1 - smoothstep01(Math.min(s, 1 - s) / 0.05);
    at.y += rise * 4.5 + Math.sin(time * 0.07 + phase) * 0.6;
    mesh.position.copy(at);
    const heading = Math.atan2(ahead.x - at.x, ahead.z - at.z);
    mesh.rotation.set(
      Math.sin(time * 0.09 + phase) * 0.05 + Math.atan2(ahead.y - at.y, 10) * 0.5 - rise * 0.3,
      heading,
      Math.sin(time * 0.19 + phase) * 0.08,
    );
  };

  pose(PATROL_PHASE);

  let slowTime = PATROL_PHASE;
  let last: number | null = null;
  return {
    mesh,
    target,
    update(time: number, reducedMotion: boolean): void {
      // Lazy first sample (the Ferryman's lesson): `last = 0` would
      // hand the patrol's phase to the page's load history.
      const dt = last === null ? 0 : Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}

/** The whale: long round-backed body, pectorals, twin-lobed fluke. */
function whaleGeometry(): BufferGeometry {
  const body = new IcosahedronGeometry(3.6, 2);
  body.deleteAttribute("normal");
  body.deleteAttribute("uv");
  const position = body.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    let x = position.getX(i) * 0.48;
    const rawY = position.getY(i);
    // Round 2: longer and flatter — the r1 proportions read as a
    // violet balloon at twenty-five metres.
    let y = rawY * (rawY > 0 ? 0.56 : 0.44);
    let z = position.getZ(i) * 1.95; // +z is the head
    // The head blunts into the boxy brow; the rear draws long into
    // the tailstock.
    if (z > 4.7) {
      z = 4.7 + (z - 4.7) * 0.35;
      y *= 0.92;
    }
    if (z < -3.6) {
      const over = -z - 3.6;
      z = -3.6 - over * 1.15;
      x *= Math.max(0.24, 1 - over * 0.26);
      y *= Math.max(0.2, 1 - over * 0.24);
    }
    position.setXYZ(i, x, y, z);
  }
  position.needsUpdate = true;

  const pectoral = (side: number): BufferGeometry => {
    const s = side;
    const positions = new Float32Array([
      s * 1.5, -0.7, 2.4, s * 4.4, -1.5, 0.4, s * 1.6, -0.8, 1.0,
      s * 1.6, -0.8, 1.0, s * 4.4, -1.5, 0.4, s * 2.4, -1.0, -0.2,
    ]);
    const fin = new BufferGeometry();
    fin.setAttribute("position", new BufferAttribute(positions, 3));
    const back = fin.clone();
    back.applyMatrix4(new Matrix4().makeScale(1, 1, 1));
    back.translate(0, -0.14, 0);
    fin.translate(0, 0.0, 0);
    const merged = mergeGeometries([fin, back], false);
    fin.dispose();
    back.dispose();
    if (!merged) {
      throw new Error("blue3 whale pectoral could not be merged");
    }
    return merged;
  };

  const fluke = (): BufferGeometry => {
    // A broad twin-lobed fluke, swept back, held near-horizontal.
    // Round 2: grown — the tail must break the lens silhouette.
    const positions = new Float32Array([
      // Right lobe.
      0.3, 0.1, -7.3, 4.4, 0.3, -9.7, 0.2, 0.15, -8.6,
      // Left lobe.
      -0.3, 0.1, -7.3, -0.2, 0.15, -8.6, -4.4, 0.3, -9.7,
      // The notch between them.
      0.2, 0.15, -8.6, 0.0, 0.12, -8.1, -0.2, 0.15, -8.6,
    ]);
    const vane = new BufferGeometry();
    vane.setAttribute("position", new BufferAttribute(positions, 3));
    const under = vane.clone();
    under.translate(0, -0.16, 0);
    const merged = mergeGeometries([vane, under], false);
    vane.dispose();
    under.dispose();
    if (!merged) {
      throw new Error("blue3 whale fluke could not be merged");
    }
    return merged;
  };

  const merged = mergeGeometries([body, pectoral(1), pectoral(-1), fluke()], false);
  body.dispose();
  if (!merged) {
    throw new Error("blue3 whale parts could not be merged");
  }
  // Position-only parts merged: face normals FIRST, then the weld (the
  // Drop Plains' flat-violet corruption, pre-paid).
  merged.computeVertexNormals();
  smoothNormals(merged);

  // The paint: the counter-shading inverted — a pale star-strewn back
  // over a deep violet belly. The darkest band is a colour, never
  // black; the specks are the floor's own star-bloom, worn.
  const pos = merged.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const back = new Color(0xd8d0da);
  const belly = new Color(0x685c8a);
  const speck = new Color(0xf4eee4);
  const finTone = new Color(0x8a7ea6);
  const shade = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const top = smoothstep01((y + 0.4) / 1.6);
    shade.copy(belly).lerp(back, top);
    // The fins and fluke wear the mid violet-slate on both faces.
    const finness = Math.max(
      smoothstep01((Math.abs(x) - 1.7) / 1.2),
      smoothstep01((-z - 6.8) / 1.2),
    );
    shade.lerp(finTone, finness * 0.8);
    // The star-bloom, worn: seeded specks across the back, and a
    // sparse scatter below the waterline — the morning shows from
    // beneath too (round 2: the diver mostly meets the belly).
    const stars = fbm(x * 0.9 + 3, z * 0.55, { seed: SEED ^ 0xf1ab, period: 9, octaves: 2 });
    if (top > 0.4 && stars > 0.62 && finness < 0.4) {
      shade.lerp(speck, smoothstep01((stars - 0.62) / 0.1) * 0.95);
    } else if (top <= 0.4 && stars > 0.74 && finness < 0.4) {
      shade.lerp(speck, smoothstep01((stars - 0.74) / 0.1) * 0.55);
    }
    // A pale brow blaze — the marking the codex draws.
    const blaze = Math.abs(Math.hypot(x * 1.1, (z - 5.4) * 0.7) - 0.9);
    if (y > 0 && blaze < 0.45) {
      shade.lerp(speck, (1 - blaze / 0.45) * 0.6);
    }
    // Drifting mottle so no facet holds one value.
    const mottle = fbm(x * 0.4 + 7, z * 0.3, { seed: SEED ^ 0xf1ac, period: 4, octaves: 2 });
    shade.lerp(new Color(0x9a90b4), smoothstep01((mottle - 0.54) / 0.2) * 0.4 * (1 - top * 0.5));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}
