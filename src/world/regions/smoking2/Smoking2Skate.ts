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
import { Random, SEEDS } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { seabedHeight } from "../../Seabed";
import { EMBER, FC_SEEDS, applySeamGlow, smoothstep01 } from "./Smoking2Shared";
import { ANVIL, washCenter, worldOf } from "./Smoking2Terrain";

/**
 * The Ember Skate — the region's findable resident: a broad-winged skate
 * that glides one slow circuit of the Emberwash, belly to the seams,
 * warming its blood on the ground's own heat. Charcoal-violet above with
 * a milk-pale wing rim, ember-lit along its spine freckles — in the dusk
 * water it reads as a slow lantern travelling the road, which is what
 * makes it findable.
 *
 * The body is a fixed-topology wing sheet (the pilot weaver's trick,
 * spread flat): a rows × columns grid whose *positions* are rewritten
 * each frame along a closed path over the wash, wings flapping in a slow
 * deep beat, plus a trailing tail strip. Everything is closed-form off
 * simulated time — capture-safe, no wall clock.
 */

const SEED = SEEDS.regionSmoking2;

export const SKATE_SPECIES_ID = "ember-skate";

/** Body grid: rows nose → tail, columns wingtip → wingtip. */
const ROWS = 13;
const COLS = 9;
/** Tail strip segments behind the body. */
const TAIL_SEGMENTS = 6;

/** One circuit of the wash, in seconds — a calm animal. */
const LOOP_SECONDS = 76;

/** Body measures, metres. */
const BODY_LENGTH = 2.3;
const HALF_SPAN = 1.5;

export interface SkateBuild {
  readonly meshes: Mesh[];
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

/** The circuit: an elongated loop riding the Emberwash from the Long
 *  Gallery to the Glass Shore's edge and home along the far bank. */
function pathAt(t: number, phase: number, out: Vector3): Vector3 {
  const theta = t * Math.PI * 2 + phase;
  const u = 925 + 132 * Math.cos(theta);
  const v = washCenter(u) + 4.2 * Math.sin(theta) + 1.4 * Math.sin(theta * 3);
  const { x, z } = worldOf(u, v);
  const floor = seabedHeight(x, z);
  out.set(x, floor + 2.1 + 0.5 * Math.sin(theta * 2), z);
  return out;
}

/** Wing half-width at a row, 0 at nose, peaking at the shoulders. */
function halfWidthAt(rowT: number): number {
  return HALF_SPAN * Math.sin(Math.PI * Math.min(1, rowT * 1.15)) ** 1.2;
}

export function buildSmoking2Skate(): SkateBuild {
  const random = new Random(SEED ^ FC_SEEDS.skate);
  const phase = random.range(0, Math.PI * 2);

  const geometry = buildSkateBody();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0xff8c3a,
    emissiveIntensity: 0.5,
  });
  applySeamGlow(material, "forge-ember-skate");
  const mesh = new Mesh(geometry, material);
  mesh.name = "forge-ember-skate";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  // The discovery target sits at the Anvil's court, where the circuit
  // passes closest to the region's heart.
  const anvilAt = worldOf(ANVIL.u - 6, ANVIL.v - 8);
  const target: DiscoveryTarget = {
    speciesId: SKATE_SPECIES_ID,
    position: new Vector3(anvilAt.x, seabedHeight(anvilAt.x, anvilAt.z) + 2.2, anvilAt.z),
  };

  const position = geometry.attributes.position as BufferAttribute;
  const at = new Vector3();
  const ahead = new Vector3();
  const tangent = new Vector3();
  const side = new Vector3();
  const lift = new Vector3();
  const up = new Vector3(0, 1, 0);

  const pose = (time: number): void => {
    const head = (time / LOOP_SECONDS) % 1;
    const beat = time * 0.9;
    for (let row = 0; row < ROWS; row++) {
      const rowT = row / (ROWS - 1);
      const s = (((head - (rowT * BODY_LENGTH) / 420) % 1) + 1) % 1;
      pathAt(s, phase, at);
      pathAt((s + 0.004) % 1, phase, ahead);
      tangent.subVectors(ahead, at).normalize();
      side.crossVectors(tangent, up).normalize();
      lift.crossVectors(side, tangent).normalize();

      const half = halfWidthAt(rowT);
      for (let col = 0; col < COLS; col++) {
        const colT = (col / (COLS - 1)) * 2 - 1; // −1 … +1 across the span
        const reach = colT * half;
        // The flap: a deep slow beat, strongest at the tips, travelling
        // slightly aft so the wing rolls instead of hinging.
        const flap =
          Math.sin(beat - Math.abs(colT) * 0.9 - rowT * 0.6) *
          0.34 *
          Math.abs(colT) ** 1.4;
        // A slight dome over the body's midline.
        const dome = (1 - colT * colT) * 0.1 * Math.sin(Math.PI * rowT);
        const idx = row * COLS + col;
        position.setXYZ(
          idx,
          at.x + side.x * reach + lift.x * (flap + dome),
          at.y + side.y * reach + lift.y * (flap + dome),
          at.z + side.z * reach + lift.z * (flap + dome),
        );
      }
    }
    // The tail strip: trailing the body's last ring down the path.
    const tailBase = ROWS * COLS;
    for (let seg = 0; seg < TAIL_SEGMENTS; seg++) {
      const segT = (seg + 1) / TAIL_SEGMENTS;
      const s = (((head - (BODY_LENGTH + segT * 1.5) / 420) % 1) + 1) % 1;
      pathAt(s, phase, at);
      pathAt((s + 0.004) % 1, phase, ahead);
      tangent.subVectors(ahead, at).normalize();
      side.crossVectors(tangent, up).normalize();
      const wag = Math.sin(beat * 1.3 - segT * 2.4) * 0.12 * segT;
      const width = 0.09 * (1 - segT * 0.75);
      for (const [k, dir] of [-1, 1].entries()) {
        position.setXYZ(
          tailBase + seg * 2 + k,
          at.x + side.x * (dir * width + wag),
          at.y,
          at.z + side.z * (dir * width + wag),
        );
      }
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  pose(0);
  geometry.computeBoundingSphere();
  // The circuit never leaves the wash's reach; one honest sphere, forever.
  const mid = worldOf(925, washCenter(925));
  geometry.boundingSphere!.center.set(mid.x, seabedHeight(mid.x, mid.z) + 2, mid.z);
  geometry.boundingSphere!.radius = 160;

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

/** The wing sheet's static half: colours and indices. */
function buildSkateBody(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertexCount = ROWS * COLS + TAIL_SEGMENTS * 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const back = new Color(0x4a3f54);
  const flank = new Color(0x66525e);
  const rim = new Color(0xe2d4b8);
  const shade = new Color();

  for (let row = 0; row < ROWS; row++) {
    const rowT = row / (ROWS - 1);
    for (let col = 0; col < COLS; col++) {
      const colT = (col / (COLS - 1)) * 2 - 1;
      const edge = Math.abs(colT);
      shade.copy(back).lerp(flank, smoothstep01((edge - 0.3) / 0.5));
      // The milk-pale wing rim — the province's bright top, worn as a hem.
      shade.lerp(rim, smoothstep01((edge - 0.82) / 0.16) * 0.75);
      // Ember freckles down the spine — the seams' own sparks; the glow
      // material reads these as light.
      const freckle = smoothstep01(
        (fbm(rowT * 7, colT * 3, { seed: SEED ^ 0xf3ec, period: 5, octaves: 2 }) - 0.6) / 0.1,
      );
      shade.lerp(EMBER, freckle * 0.65 * (1 - smoothstep01((edge - 0.5) / 0.3)));
      const idx = row * COLS + col;
      colors[idx * 3] = shade.r;
      colors[idx * 3 + 1] = shade.g;
      colors[idx * 3 + 2] = shade.b;
    }
  }
  // The tail wears the back's dark, rim-tipped.
  const tailBase = ROWS * COLS;
  for (let seg = 0; seg < TAIL_SEGMENTS; seg++) {
    const segT = (seg + 1) / TAIL_SEGMENTS;
    for (const k of [0, 1]) {
      shade.copy(back).lerp(rim, segT * 0.4);
      colors[(tailBase + seg * 2 + k) * 3] = shade.r;
      colors[(tailBase + seg * 2 + k) * 3 + 1] = shade.g;
      colors[(tailBase + seg * 2 + k) * 3 + 2] = shade.b;
    }
  }

  // The wing sheet, both windings so the underside draws too.
  for (let row = 0; row < ROWS - 1; row++) {
    for (let col = 0; col < COLS - 1; col++) {
      const a = row * COLS + col;
      const b = a + 1;
      const c = a + COLS;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
      indices.push(c, b, a, c, d, b);
    }
  }
  // The tail strip off the last row's centre columns.
  const centerA = (ROWS - 1) * COLS + Math.floor(COLS / 2) - 1;
  const centerB = centerA + 1;
  let prevA = centerA;
  let prevB = centerB;
  for (let seg = 0; seg < TAIL_SEGMENTS; seg++) {
    const a = tailBase + seg * 2;
    const b = a + 1;
    indices.push(prevA, prevB, a, prevB, b, a);
    indices.push(a, prevB, prevA, a, b, prevB);
    prevA = a;
    prevB = b;
  }

  const positionAttribute = new BufferAttribute(positions, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}
