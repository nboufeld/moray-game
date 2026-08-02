import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Mesh,
  Vector3,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { smoothstep01 } from "./VerdantShared";

/**
 * The Kelp Weaver — the Great Kelp Sea's findable resident.
 *
 * An eel-like spirit that braids an endless figure through the holdfasts
 * under the grotto's slab: the maze's melancholy given one calm, living
 * line. The body is a fixed-topology tube (36 rings, 6 sides, one dorsal
 * ribbon) whose *positions* are rewritten each frame along a closed braid
 * path — the same trick as the moray's skinned tube without the skeleton,
 * cheap enough to run forever.
 *
 * ## The paint
 *
 * Jade body banded with deep moss (the bands are value structure, and
 * their dark is violet-leaned — red above green), a pale celadon belly, a
 * gold dorsal ribbon that catches whatever light reaches the maze. Nothing
 * on the animal approaches black: it is the brightest thing in the deep
 * quarter on purpose, a lantern to find.
 *
 * The discovery target sits at the braid's anchor; the head passes within
 * arm's reach of it twice a loop, so a diver who holds the grotto's mouth
 * in view is holding the animal.
 */

const SEED = SEEDS.regionVerdant1;

const RINGS = 36;
const SIDES = 6;
/** The braid's loop, roughly, in seconds — a calm animal. */
const LOOP_SECONDS = 26;
/** How much of the loop the body occupies, nose to tail. */
const BODY_SPAN = 0.42;

export const WEAVER_SPECIES_ID = "kelp-weaver";

export interface WeaverBuild {
  readonly mesh: Mesh;
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildWeaver(anchor: { x: number; y: number; z: number }): WeaverBuild {
  const random = new Random(SEED ^ 0x0ee1);
  const phase = random.range(0, Math.PI * 2);

  // The braid: a rose curve around the anchor, lifted on a second harmonic
  // — three petals through the root columns, rising and falling.
  const pathAt = (t: number, out: Vector3): Vector3 => {
    const theta = t * Math.PI * 2;
    const r = 1.9 + 0.6 * Math.sin(theta * 3 + phase);
    out.set(
      anchor.x + Math.cos(theta) * r,
      anchor.y + 0.7 + 0.55 * Math.sin(theta * 2 + phase * 0.7),
      anchor.z + Math.sin(theta) * r,
    );
    return out;
  };

  const geometry = buildBody();
  const material = createToonMaterial({ vertexColors: true });
  const mesh = new Mesh(geometry, material);
  mesh.name = "verdant-kelp-weaver";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const target: DiscoveryTarget = {
    speciesId: WEAVER_SPECIES_ID,
    position: new Vector3(anchor.x, anchor.y + 0.9, anchor.z),
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
    for (let ring = 0; ring < RINGS; ring++) {
      const along = ring / (RINGS - 1);
      const s = (((head - along * BODY_SPAN) % 1) + 1) % 1;
      pathAt(s, at);
      pathAt((s + 0.01) % 1, ahead);
      tangent.subVectors(ahead, at).normalize();
      side.crossVectors(tangent, up).normalize();
      lift.crossVectors(side, tangent).normalize();

      const radius = bodyRadius(along);
      for (let i = 0; i < SIDES; i++) {
        const a = (i / SIDES) * Math.PI * 2;
        const idx = ring * SIDES + i;
        position.setXYZ(
          idx,
          at.x + (side.x * Math.cos(a) + lift.x * Math.sin(a)) * radius,
          at.y + (side.y * Math.cos(a) + lift.y * Math.sin(a)) * radius * 1.25,
          at.z + (side.z * Math.cos(a) + lift.z * Math.sin(a)) * radius,
        );
      }
      // The dorsal ribbon: two verts per ring riding above the spine.
      const finBase = RINGS * SIDES + ring * 2;
      const fin = finHeight(along);
      position.setXYZ(
        finBase,
        at.x + lift.x * radius * 1.1,
        at.y + lift.y * radius * 1.1,
        at.z + lift.z * radius * 1.1,
      );
      position.setXYZ(
        finBase + 1,
        at.x + lift.x * (radius * 1.1 + fin),
        at.y + lift.y * (radius * 1.1 + fin),
        at.z + lift.z * (radius * 1.1 + fin),
      );
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  pose(0);
  geometry.computeBoundingSphere();
  // The braid never leaves the anchor's reach; one honest sphere, forever.
  geometry.boundingSphere!.center.set(anchor.x, anchor.y + 0.9, anchor.z);
  geometry.boundingSphere!.radius = 4.5;

  let slowTime = 0;
  let last = 0;
  return {
    mesh,
    target,
    update(time: number, reducedMotion: boolean): void {
      // Reduced motion halves the weave's rate without ever pausing it.
      const dt = Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}

/** Snout, shoulder swell, long taper to a ribbon tail. */
function bodyRadius(along: number): number {
  const snout = smoothstep01(along / 0.06);
  const taper = 1 - smoothstep01((along - 0.35) / 0.65) * 0.92;
  return 0.2 * snout * taper + 0.012;
}

function finHeight(along: number): number {
  return 0.12 * Math.sin(Math.PI * Math.min(1, along * 1.15)) ** 0.7;
}

function buildBody(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertexCount = RINGS * SIDES + RINGS * 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const jade = new Color(0x63a274);
  const belly = new Color(0xa9c9a0);
  const band = new Color(0x3f5a52);
  const gold = new Color(0xd2b356);
  const headMask = new Color(0x2f4a44);
  const shade = new Color();

  for (let ring = 0; ring < RINGS; ring++) {
    const along = ring / (RINGS - 1);
    // Deep moss bands every eighth of the body, softened toward the tail;
    // the band's dark leans violet so the animal's darkest mark is a colour.
    const bandMix = Math.max(0, Math.sin(along * Math.PI * 9)) ** 6 * (1 - along * 0.4);
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      const bellyMix = smoothstep01((Math.sin(a) * -1 + 0.4) / 1.2);
      shade.copy(jade).lerp(belly, bellyMix);
      shade.lerp(band, bandMix * (1 - bellyMix * 0.7));
      if (along < 0.08) {
        shade.lerp(headMask, 1 - along / 0.08);
      }
      // Red held above green in the dark bands: violet, not murk.
      if (bandMix > 0.4) {
        shade.r = Math.min(1, shade.r * 1.16);
        shade.b = Math.min(1, shade.b * 1.22);
      }
      const idx = ring * SIDES + i;
      colors[idx * 3] = shade.r;
      colors[idx * 3 + 1] = shade.g;
      colors[idx * 3 + 2] = shade.b;
    }
    const finBase = RINGS * SIDES + ring * 2;
    for (const [k, mix] of [0.4, 1].entries()) {
      shade.copy(jade).lerp(gold, mix);
      colors[(finBase + k) * 3] = shade.r;
      colors[(finBase + k) * 3 + 1] = shade.g;
      colors[(finBase + k) * 3 + 2] = shade.b;
    }
  }

  // Tube strips.
  for (let ring = 0; ring < RINGS - 1; ring++) {
    const a = ring * SIDES;
    const b = a + SIDES;
    for (let i = 0; i < SIDES; i++) {
      const next = (i + 1) % SIDES;
      indices.push(a + i, a + next, b + i);
      indices.push(a + next, b + next, b + i);
    }
  }
  // The fin: a two-sided strip (doubled winding, no material flag needed).
  for (let ring = 0; ring < RINGS - 1; ring++) {
    const a = RINGS * SIDES + ring * 2;
    const b = a + 2;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
    indices.push(b, a + 1, a, b, b + 1, a + 1);
  }

  const positionAttribute = new BufferAttribute(positions, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}
