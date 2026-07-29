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
import { smoothstep01 } from "./Verdant2Shared";

/**
 * THE TERRACE WARDEN — the Emerald Terraces' findable resident.
 *
 * A great newt-bodied spirit, old as the stones, that patrols in and out
 * of the grotto behind the green curtain: it tends the vine-falls,
 * pressing torn ribbons back into the rock as it passes. Axolotl-headed
 * — a crown of six gold gill-frills — with a moss-dappled jade back, a
 * pale celadon belly and a deep ribbon tail.
 *
 * The body is the kelp sea weaver's proven trick, re-authored: a
 * fixed-topology tube (34 rings, 6 sides) whose positions are rewritten
 * each frame along a closed patrol path — plus a dorsal tail-fin strip
 * and the six frill strips anchored to the head rings. Cheap enough to
 * run forever; the update spends no randomness.
 *
 * The discovery target sits at the curtain's part; the patrol carries
 * the head through it twice a loop, so a diver watching the grotto's
 * green curtain is watching the animal.
 */

const SEED = SEEDS.regionVerdant2;

const RINGS = 34;
const SIDES = 6;
const FRILLS = 6;
/** The patrol's loop, in seconds — an unhurried keeper. */
const LOOP_SECONDS = 32;
/** How much of the loop the body occupies, nose to tail. */
const BODY_SPAN = 0.34;

export const WARDEN_SPECIES_ID = "terrace-warden";

export interface WardenBuild {
  readonly mesh: Mesh;
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildWarden(anchor: { x: number; y: number; z: number; facing: number }): WardenBuild {
  const random = new Random(SEED ^ 0x0ee2);
  const phase = random.range(0, Math.PI * 2);

  // The patrol: a flattened figure through the curtain's part — out over
  // the terrace, a slow bank around, back through the green into the
  // grotto's shade and out again. A rose curve, leaned along the facing.
  const cosF = Math.cos(anchor.facing);
  const sinF = Math.sin(anchor.facing);
  const pathAt = (t: number, out: Vector3): Vector3 => {
    const theta = t * Math.PI * 2;
    const r = 2.4 + 0.8 * Math.sin(theta * 2 + phase);
    const lx = Math.cos(theta) * r * 1.25;
    const lz = Math.sin(theta) * r * 0.8;
    out.set(
      anchor.x + lx * cosF - lz * sinF,
      anchor.y + 0.9 + 0.5 * Math.sin(theta * 3 + phase * 0.7),
      anchor.z + lx * sinF + lz * cosF,
    );
    return out;
  };

  const geometry = buildBody();
  const material = createToonMaterial({ vertexColors: true });
  const mesh = new Mesh(geometry, material);
  mesh.name = "verdant2-terrace-warden";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const target: DiscoveryTarget = {
    speciesId: WARDEN_SPECIES_ID,
    position: new Vector3(anchor.x, anchor.y + 1.0, anchor.z),
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
          at.y + (side.y * Math.cos(a) + lift.y * Math.sin(a)) * radius * 1.15,
          at.z + (side.z * Math.cos(a) + lift.z * Math.sin(a)) * radius,
        );
      }
      // The tail fin: two verts per ring riding above the spine, tallest
      // over the last third.
      const finBase = RINGS * SIDES + ring * 2;
      const fin = finHeight(along);
      position.setXYZ(
        finBase,
        at.x + lift.x * radius,
        at.y + lift.y * radius,
        at.z + lift.z * radius,
      );
      position.setXYZ(
        finBase + 1,
        at.x + lift.x * (radius + fin),
        at.y + lift.y * (radius + fin),
        at.z + lift.z * (radius + fin),
      );
    }

    // The gill crown: six frills fanned from the second ring, three per
    // side, angled back and up — each a two-triangle strip whose tip
    // trails the head's own motion.
    const headS = head;
    pathAt(headS, at);
    pathAt((headS + 0.01) % 1, ahead);
    tangent.subVectors(ahead, at).normalize();
    side.crossVectors(tangent, up).normalize();
    lift.crossVectors(side, tangent).normalize();
    const neckS = (((headS - 0.045 * BODY_SPAN) % 1) + 1) % 1;
    const neck = new Vector3();
    pathAt(neckS, neck);
    for (let f = 0; f < FRILLS; f++) {
      const sideSign = f < 3 ? 1 : -1;
      const tier = f % 3;
      const spread = 0.5 + tier * 0.42;
      const rise = 0.34 + tier * 0.12;
      const back = 0.22 + tier * 0.16;
      const base = RINGS * SIDES + RINGS * 2 + f * 3;
      const rootX = neck.x + side.x * sideSign * 0.16;
      const rootY = neck.y + 0.08;
      const rootZ = neck.z + side.z * sideSign * 0.16;
      position.setXYZ(base, rootX, rootY, rootZ);
      position.setXYZ(
        base + 1,
        rootX + side.x * sideSign * spread * 0.5 - tangent.x * back * 0.5 + lift.x * rise * 0.7,
        rootY + rise * 0.6,
        rootZ + side.z * sideSign * spread * 0.5 - tangent.z * back * 0.5 + lift.z * rise * 0.7,
      );
      position.setXYZ(
        base + 2,
        rootX + side.x * sideSign * spread - tangent.x * back,
        rootY + rise,
        rootZ + side.z * sideSign * spread - tangent.z * back,
      );
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  pose(0);
  geometry.computeBoundingSphere();
  // The patrol never leaves the anchor's reach; one honest sphere.
  geometry.boundingSphere!.center.set(anchor.x, anchor.y + 1.0, anchor.z);
  geometry.boundingSphere!.radius = 5.5;

  let slowTime = 0;
  let last = 0;
  return {
    mesh,
    target,
    update(time: number, reducedMotion: boolean): void {
      const dt = Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}

/** Broad axolotl head, thick trunk, long ribbon tail. */
function bodyRadius(along: number): number {
  const snout = smoothstep01(along / 0.05);
  const headSwell = 1 + 0.35 * Math.exp(-Math.pow((along - 0.09) / 0.07, 2));
  const taper = 1 - smoothstep01((along - 0.3) / 0.7) * 0.9;
  return 0.24 * snout * headSwell * taper + 0.014;
}

function finHeight(along: number): number {
  return 0.16 * Math.sin(Math.PI * Math.min(1, Math.max(0, (along - 0.25) / 0.75))) ** 0.8;
}

function buildBody(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertexCount = RINGS * SIDES + RINGS * 2 + FRILLS * 3;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const jade = new Color(0x6aa578);
  const celadon = new Color(0xb2d4ac);
  const dapple = new Color(0x41604e);
  const gold = new Color(0xd8b95c);
  const maskViolet = new Color(0x5c4f72);
  const shade = new Color();

  for (let ring = 0; ring < RINGS; ring++) {
    const along = ring / (RINGS - 1);
    // Moss dapple down the back, in irregular pairs; the dapple's dark
    // leans violet so the darkest mark on the animal is a colour.
    const dappleMix =
      Math.max(0, Math.sin(along * Math.PI * 7 + 0.8)) ** 4 * 0.8 * (1 - along * 0.35);
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      const bellyMix = smoothstep01((Math.sin(a) * -1 + 0.4) / 1.2);
      shade.copy(jade).lerp(celadon, bellyMix);
      shade.lerp(dapple, dappleMix * (1 - bellyMix * 0.8));
      if (dappleMix > 0.4) {
        shade.r = Math.min(1, shade.r * 1.14);
        shade.b = Math.min(1, shade.b * 1.2);
      }
      if (along < 0.1) {
        shade.lerp(maskViolet, (1 - along / 0.1) * 0.5);
      }
      const idx = ring * SIDES + i;
      colors[idx * 3] = shade.r;
      colors[idx * 3 + 1] = shade.g;
      colors[idx * 3 + 2] = shade.b;
    }
    const finBase = RINGS * SIDES + ring * 2;
    for (const [k, mix] of [0.35, 1].entries()) {
      shade.copy(jade).lerp(gold, mix);
      colors[(finBase + k) * 3] = shade.r;
      colors[(finBase + k) * 3 + 1] = shade.g;
      colors[(finBase + k) * 3 + 2] = shade.b;
    }
  }
  // The frills: jade at the root, bright gold at the tip.
  for (let f = 0; f < FRILLS; f++) {
    const base = RINGS * SIDES + RINGS * 2 + f * 3;
    for (const [k, mix] of [0.15, 0.7, 1].entries()) {
      shade.copy(jade).lerp(gold, mix).multiplyScalar(0.9 + mix * 0.25);
      colors[(base + k) * 3] = shade.r;
      colors[(base + k) * 3 + 1] = shade.g;
      colors[(base + k) * 3 + 2] = shade.b;
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
  // The tail fin: a two-sided strip (doubled winding).
  for (let ring = 0; ring < RINGS - 1; ring++) {
    const a = RINGS * SIDES + ring * 2;
    const b = a + 2;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
    indices.push(b, a + 1, a, b, b + 1, a + 1);
  }
  // The frills: one two-sided triangle each, doubled winding.
  for (let f = 0; f < FRILLS; f++) {
    const base = RINGS * SIDES + RINGS * 2 + f * 3;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 2, base + 1, base);
  }

  const positionAttribute = new BufferAttribute(positions, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}
