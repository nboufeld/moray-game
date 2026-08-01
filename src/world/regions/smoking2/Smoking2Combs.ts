import {
  BoxGeometry,
  BufferAttribute,
  Color,
  Mesh,
  Vector3,
  type BufferGeometry,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import {
  AMBER,
  COMB_TONES,
  CRUST_PALE,
  EMBER,
  FC_SEEDS,
  SHADOW_VIOLET,
  applySeamGlow,
  mergedMesh,
  smoothstep01,
} from "./Smoking2Shared";
import {
  ANVIL,
  COMBS,
  NIGHT_DOOR,
  SMOKING2_SLOT,
  washCenter,
  worldOf,
  type CombSpec,
} from "./Smoking2Terrain";

/**
 * The Comb Walls — the region's exclusive: long black basalt dike-fins
 * standing in broken ranks, the drowned galleries the country is named
 * for. Every fin is drawn from one seeded surface: a slab whose crest is
 * a broken line of notches, whose faces bulge with columnar ribbing, and
 * whose paint is iron-violet strata under a pale weathered crest — the
 * milk-bright top the province's gradient row demands, carried here by
 * stone instead of smoke.
 *
 * Also here, because they are the same stone family:
 *
 * - **the Broken Comb's lintel**: a fallen slab leaning across the
 *   Emberwash between two stubs — the road's one swim-under (clearance
 *   ≥ 3.5 m over the wash floor, held by the collider layout);
 * - **the Anvil**: the flat-topped block at the country's heart, split
 *   by ember seams that glow from inside (the seam-glow material);
 * - **the Night Door**: two narrow fins leaning together over the far
 *   pole, framing the reserved depth-3 corridor as a doorway silhouette.
 */

const SEED = SEEDS.regionSmoking2;

export interface CombsBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Crest points for the percher colonies, world space. */
  readonly perchTops: readonly (readonly [number, number, number])[];
  /** Wall-face anchors for the drape banks: position + outward normal. */
  readonly drapeAnchors: readonly {
    readonly pos: readonly [number, number, number];
    readonly normal: readonly [number, number, number];
  }[];
  /** Foot anchors for the scree aprons. */
  readonly feet: readonly { readonly pos: readonly [number, number]; readonly facing: number }[];
}

/** World yaw of a comb's long axis (spoke heading rotated onto the map). */
function combWorldYaw(comb: CombSpec): number {
  // worldOf maps +u to the spoke azimuth and +v a quarter-turn CCW; a
  // heading measured from +u toward +v therefore lands on the world at
  // azimuth + heading (both are atan2(z, x) angles).
  return SMOKING2_SLOT.azimuth + comb.heading;
}

/**
 * One fin: a segmented slab, crest broken into notches, faces ribbed
 * like weathered columnar basalt, painted iron-violet with a pale crest.
 * Built axis-aligned (length on x, height on y) and rotated into place.
 */
function finGeometry(comb: CombSpec, random: Random, baseY: number): BufferGeometry {
  const length = comb.halfLength * 2;
  const lengthSegments = Math.max(14, Math.round(length / 1.6));
  const heightSegments = Math.max(8, Math.round(comb.height / 1.1));
  const geometry = new BoxGeometry(length, comb.height, comb.thickness, lengthSegments, heightSegments, 2);
  geometry.translate(0, comb.height / 2, 0);

  const noiseSeed = SEED ^ FC_SEEDS.combs ^ (comb.u * 31 + comb.v * 7);
  const lean = random.signed(0.05);
  const position = geometry.attributes.position!;

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const alongT = x / length + 0.5;
    const heightT = y / comb.height;

    // The broken crest: a notch line eating down into the top edge. The
    // noise is sampled along a SLANTED coordinate so the notch walls lean
    // (r1's straight-down notches read as rectangular punched holes
    // against bright water).
    const slant = alongT + heightT * 0.22;
    const crest =
      fbm(slant * 6, 0.3, { seed: noiseSeed ^ 0x01, period: 6, octaves: 2 }) * 0.9 +
      fbm(slant * 17, 0.7, { seed: noiseSeed ^ 0x02, period: 9, octaves: 2 }) * 0.4;
    const crestDrop = (0.35 + crest) * comb.height * 0.28;
    const newY = y - crestDrop * smoothstep01((heightT - 0.55) / 0.45);

    // Columnar ribbing on the faces, and a taper toward the crest.
    const rib =
      (fbm(alongT * 11, heightT * 1.1, { seed: noiseSeed ^ 0x03, period: 7, octaves: 2 }) - 0.5) *
      0.9;
    const taper = 1 - smoothstep01((heightT - 0.2) / 0.8) * 0.42;
    const side = Math.sign(z) || 1;
    const newZ =
      z * taper + side * Math.max(0, rib) * 0.55 * (1 - smoothstep01((heightT - 0.85) / 0.15));

    // The ends flare into buttress feet.
    const endT = Math.abs(x) / (length / 2);
    const foot = smoothstep01((endT - 0.75) / 0.25) * (1 - heightT) * 1.4;

    position.setXYZ(
      i,
      x + newY * lean + side * 0,
      Math.max(-2.2, newY - foot * 0.4),
      newZ + side * foot * 0.5,
    );
  }

  // The paint: iron strata rising to a pale crest, violet in the shade.
  const colors = new Float32Array(position.count * 3);
  const low = new Color(COMB_TONES[2]);
  const mid = new Color(COMB_TONES[0]);
  const high = new Color(COMB_TONES[1]);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const alongT = x / length + 0.5;
    const heightT = Math.min(1, Math.max(0, y / comb.height));

    shade.copy(low).lerp(mid, smoothstep01((heightT - 0.12) / 0.4));
    shade.lerp(high, smoothstep01((heightT - 0.5) / 0.4));

    // Strata bands: horizontal weathering lines a value apart.
    const band =
      Math.sin(y * 1.35 + fbm(alongT * 4, 0.2, { seed: noiseSeed ^ 0x04, period: 5, octaves: 2 }) * 3.2) *
      0.075;
    shade.offsetHSL(0, 0, band);

    // The pale weathered crest — the milk-bright top.
    const crestT = smoothstep01((heightT - 0.72) / 0.24);
    const crustNoise = smoothstep01(
      (fbm(alongT * 9, heightT * 2, { seed: noiseSeed ^ 0x05, period: 6, octaves: 2 }) - 0.42) / 0.2,
    );
    shade.lerp(CRUST_PALE, crestT * (0.4 + 0.45 * crustNoise));

    // Amber mineral staining low on the faces, where the ground is warm.
    const stain =
      smoothstep01(
        (fbm(alongT * 7, heightT * 3, { seed: noiseSeed ^ 0x06, period: 8, octaves: 2 }) - 0.6) / 0.14,
      ) *
      (1 - smoothstep01((heightT - 0.3) / 0.25));
    shade.lerp(AMBER, stain * 0.4);

    // Violet in the under-shade: the feet sink into their own dark, so
    // the wall grows out of shadow instead of standing on pale ground.
    shade.lerp(SHADOW_VIOLET, (1 - heightT) * 0.3);

    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const { x: wx, z: wz } = worldOf(comb.u, comb.v);
  geometry.rotateY(-combWorldYaw(comb));
  geometry.translate(wx, baseY, wz);
  return geometry;
}

/** The Anvil: a flat-topped block, undercut on its south face. */
function anvilGeometry(baseY: number): BufferGeometry {
  const geometry = new BoxGeometry(21, 12.5, 14, 14, 9, 9);
  geometry.translate(0, 12.5 / 2, 0);
  const noiseSeed = SEED ^ FC_SEEDS.anvil;
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const heightT = y / 12.5;
    // The overhang: the top spreads, the waist pulls in — an anvil.
    const spread = 0.82 + 0.3 * smoothstep01((heightT - 0.55) / 0.3);
    const waist = 1 - 0.18 * Math.sin(heightT * Math.PI);
    // The swim-under notch on the -z face, at the base.
    const notch =
      smoothstep01((1 - heightT - 0.72) / 0.28) *
      smoothstep01((-z - 3.2) / 3) *
      smoothstep01((1 - Math.abs(x) / 10.5 - 0.25) / 0.3);
    const bulge =
      (fbm(x * 0.24, y * 0.24 + z * 0.11, { seed: noiseSeed, period: 7, octaves: 2 }) - 0.5) * 1.1;
    position.setXYZ(
      i,
      x * spread * waist + Math.sign(x) * Math.max(0, bulge) * 0.5,
      y - smoothstep01((heightT - 0.9) / 0.1) * (0.4 + Math.max(0, bulge)),
      z * spread * waist - notch * (-z > 0 ? -3.6 : 0) + Math.sign(z) * Math.max(0, bulge) * 0.5,
    );
  }
  // The paint: dark iron body, ember seams splitting the faces, a pale
  // worked top — the country's heart wears its heat openly.
  const colors = new Float32Array(position.count * 3);
  const body = new Color(COMB_TONES[2]);
  const top = new Color(COMB_TONES[1]);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const heightT = Math.min(1, Math.max(0, y / 12.5));
    const theta = Math.atan2(z, x);
    shade.copy(body).lerp(top, smoothstep01((heightT - 0.4) / 0.5));
    // The seams: meridian cracks widening toward the base — the glow
    // material reads these as light.
    const seam = smoothstep01(
      (fbm(theta * 1.9, y * 0.4, { seed: noiseSeed ^ 0x11, period: 4, octaves: 2 }) -
        (0.64 + heightT * 0.12)) /
        0.07,
    );
    shade.multiplyScalar(1 - seam * 0.5);
    shade.r += seam * EMBER.r * (0.75 - heightT * 0.3);
    shade.g += seam * EMBER.g * (0.55 - heightT * 0.25);
    shade.b += seam * EMBER.b * 0.25;
    // The worked top: pale crust dusted over the flat.
    const crown = smoothstep01((heightT - 0.86) / 0.12);
    shade.lerp(CRUST_PALE, crown * 0.5);
    colors[i * 3] = Math.min(1, shade.r);
    colors[i * 3 + 1] = Math.min(1, shade.g);
    colors[i * 3 + 2] = Math.min(1, shade.b);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const at = worldOf(ANVIL.u, ANVIL.v);
  geometry.rotateY(-(SMOKING2_SLOT.azimuth + 1.25));
  geometry.translate(at.x, baseY, at.z);
  return geometry;
}

/** The Broken Comb's fallen lintel: a slab leaning across the wash. */
function lintelGeometry(): { geometry: BufferGeometry; colliders: SphereCollider[] } {
  // The stubs stand at (863, 24) and (855, -6); the lintel leans from
  // the north stub's shoulder down onto the south stub's break face,
  // crossing the wash (centre ≈ v 9.5 at u 858) with swim-under
  // clearance beneath — the road passes under the slab's high third.
  const north = worldOf(862, 20);
  const south = worldOf(856, -2);
  const northY = seabedHeight(north.x, north.z) + 7.6;
  const southY = seabedHeight(south.x, south.z) + 5.0;
  const span = Math.hypot(south.x - north.x, south.z - north.z);

  const geometry = new BoxGeometry(span + 4, 1.9, 4.6, 12, 2, 3);
  const noiseSeed = SEED ^ FC_SEEDS.combs ^ 0xb07;
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const bulge =
      (fbm(x * 0.3, z * 0.3, { seed: noiseSeed, period: 6, octaves: 2 }) - 0.5) * 0.5;
    position.setXYZ(i, x, y + bulge, z + Math.sign(z) * Math.max(0, bulge));
  }
  const colors = new Float32Array(position.count * 3);
  const body = new Color(COMB_TONES[0]);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) / 1.4 + 0.5));
    shade.copy(SHADOW_VIOLET).lerp(body, 0.55 + t * 0.45);
    shade.lerp(CRUST_PALE, smoothstep01((t - 0.72) / 0.28) * 0.5);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  const yaw = Math.atan2(south.z - north.z, south.x - north.x);
  const pitch = Math.atan2(southY - northY, span);
  geometry.rotateZ(pitch);
  geometry.rotateY(-yaw);
  geometry.translate((north.x + south.x) / 2, (northY + southY) / 2, (north.z + south.z) / 2);

  // Colliders ride the slab itself, never the water under it: the
  // swim-under stays open (the collider centres sit at the slab's line).
  const colliders: SphereCollider[] = [];
  for (let t = 0.1; t <= 0.9; t += 0.2) {
    colliders.push({
      center: new Vector3(
        north.x + (south.x - north.x) * t,
        northY + (southY - northY) * t + 0.2,
        north.z + (south.z - north.z) * t,
      ),
      radius: 2.6,
    });
  }
  return { geometry, colliders };
}

export function buildSmoking2Combs(): CombsBuild {
  const random = new Random(SEED ^ FC_SEEDS.combs);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const perchTops: (readonly [number, number, number])[] = [];
  const drapeAnchors: { pos: [number, number, number]; normal: [number, number, number] }[] = [];
  const feet: { pos: [number, number]; facing: number }[] = [];

  // ─── The fins, one merged draw ────────────────────────────────────────────
  const finParts: BufferGeometry[] = [];
  for (const comb of COMBS) {
    const at = worldOf(comb.u, comb.v);
    const endA = worldOf(
      comb.u + Math.cos(comb.heading) * comb.halfLength,
      comb.v + Math.sin(comb.heading) * comb.halfLength,
    );
    const endB = worldOf(
      comb.u - Math.cos(comb.heading) * comb.halfLength,
      comb.v - Math.sin(comb.heading) * comb.halfLength,
    );
    const baseY =
      Math.min(
        seabedHeight(at.x, at.z),
        seabedHeight(endA.x, endA.z),
        seabedHeight(endB.x, endB.z),
      ) - 1.6;
    finParts.push(finGeometry(comb, random, baseY));

    // Colliders: stations along the axis, two or three spheres stacked.
    const yaw = combWorldYaw(comb);
    const ax = Math.cos(yaw);
    const az = Math.sin(yaw);
    const stations = Math.max(3, Math.round((comb.halfLength * 2) / 6));
    for (let s = 0; s < stations; s++) {
      const t = stations === 1 ? 0 : (s / (stations - 1) - 0.5) * 2;
      const x = at.x + ax * t * comb.halfLength * 0.92;
      const z = at.z + az * t * comb.halfLength * 0.92;
      const floor = seabedHeight(x, z);
      const crest = baseY + comb.height * (0.72 - 0.2 * Math.abs(t));
      for (let y = floor + 2; y < crest + 1.5; y += 4.4) {
        colliders.push({ center: new Vector3(x, y, z), radius: comb.thickness * 0.5 + 2.1 });
      }
      // Perch tops on the crest stations.
      if (s % 2 === 0) {
        perchTops.push([x, crest + 0.4, z]);
      }
      // Drape anchors on alternating faces, mid-height.
      if (s % 2 === 1) {
        const side = s % 4 === 1 ? 1 : -1;
        const nx = -az * side;
        const nz = ax * side;
        drapeAnchors.push({
          pos: [
            x + nx * (comb.thickness * 0.5 + 0.3),
            floor + comb.height * 0.5,
            z + nz * (comb.thickness * 0.5 + 0.3),
          ],
          normal: [nx, 0, nz],
        });
      }
    }
    contacts.push({ x: at.x, z: at.z, radius: comb.halfLength * 0.9, strength: 0.32 });
    // Scree feet at both ends and both mid-faces.
    for (const side of [1, -1]) {
      const fx = at.x + ax * side * comb.halfLength * 0.75;
      const fz = at.z + az * side * comb.halfLength * 0.75;
      feet.push({ pos: [fx, fz], facing: Math.atan2(fz - at.z, fx - at.x) });
      feet.push({
        pos: [at.x - az * side * (comb.thickness * 0.5 + 2.4), at.z + ax * side * (comb.thickness * 0.5 + 2.4)],
        facing: Math.atan2(ax * side, -az * side),
      });
    }
  }
  const finMaterial = createToonMaterial({ vertexColors: true });
  meshes.push(mergedMesh(finParts, finMaterial, "forge-comb-walls"));

  // ─── The Broken Comb's lintel ─────────────────────────────────────────────
  const lintel = lintelGeometry();
  const lintelMesh = new Mesh(lintel.geometry, finMaterial);
  lintelMesh.name = "forge-broken-lintel";
  lintelMesh.castShadow = false;
  lintelMesh.receiveShadow = false;
  lintel.geometry.computeBoundingSphere();
  meshes.push(lintelMesh);
  colliders.push(...lintel.colliders);

  // ─── The Anvil ────────────────────────────────────────────────────────────
  const anvilAt = worldOf(ANVIL.u, ANVIL.v);
  const anvilBase = seabedHeight(anvilAt.x, anvilAt.z) - 1.2;
  const anvil = anvilGeometry(anvilBase);
  anvil.computeBoundingSphere();
  const anvilMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0xff7a38,
    emissiveIntensity: 0.3,
  });
  applySeamGlow(anvilMaterial, "forge-anvil");
  const anvilMesh = new Mesh(anvil, anvilMaterial);
  anvilMesh.name = "forge-anvil";
  anvilMesh.castShadow = false;
  anvilMesh.receiveShadow = true;
  meshes.push(anvilMesh);
  for (const [dx, dz, y, r] of [
    [0, 0, 3.6, 7.4],
    [0, 0, 9.2, 7.8],
    [6.2, 3.4, 5.5, 4.2],
    [-6.2, -3.2, 5.5, 4.2],
  ] as const) {
    colliders.push({
      center: new Vector3(anvilAt.x + dx, anvilBase + y, anvilAt.z + dz),
      radius: r,
    });
  }
  contacts.push({ x: anvilAt.x, z: anvilAt.z, radius: 13, strength: 0.42 });

  return { meshes, colliders, contacts, perchTops, drapeAnchors, feet };
}

/** The Emberwash's world-space centre at a spoke distance — a convenience
 *  for the modules that dress the road. */
export function washSpot(u: number): { x: number; z: number } {
  return worldOf(u, washCenter(u));
}

/** The Night Door's world seat, for light and distance composition. */
export function nightDoorSpot(): { x: number; z: number } {
  return worldOf(NIGHT_DOOR.u, NIGHT_DOOR.v);
}
