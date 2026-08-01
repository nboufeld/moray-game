import {
  BufferAttribute,
  Color,
  CylinderGeometry,
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
  ASH_PALE,
  EMBER,
  GLASS_TONES,
  LAMP,
  LV_SEEDS,
  SHADOW_VIOLET,
  applyLampGlow,
  mergedMesh,
  smoothstep01,
} from "./Smoking3Shared";
import {
  LANTERNS,
  SMOKING3_SLOT,
  SPILT,
  VENT,
  worldOf,
  type LanternSpec,
} from "./Smoking3Terrain";

/**
 * The Lantern Spires — the region's exclusive: hollow basalt-glass
 * lanterns the forge's heat grew out of the night floor, each one a
 * lathe silhouette (flared foot, swollen glass belly, pinched throat,
 * small crowned cap) with dark rib lines dividing the belly into WINDOW
 * panels. The lit lanterns' windows carry the region's light: baked
 * amber vertex colour driven through the emissive-by-vertex chunk, so
 * the glass glows from inside and nothing else does. The Cold Lantern
 * is the same glass on a plain material — the one the fire never
 * reached.
 *
 * Also here, because they are the same glass family:
 *
 * - **the Morning Vent**: the great chimney at the far pole — dark
 *   basalt tapering 24 m, split by glowing meridian seams, its throat
 *   open to the sky; the Light module raises the Morning Column out of
 *   it;
 * - **the Spilt Light**: a fallen lantern lying at the fens' hem, its
 *   crown broken off, still faintly lit where the belly holds.
 */

const SEED = SEEDS.regionSmoking3;

export interface LanternsBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Crown points of the lit lanterns, world space, for the perchers. */
  readonly perchTops: readonly (readonly [number, number, number])[];
  /** Foot anchors for the scree aprons. */
  readonly feet: readonly { readonly pos: readonly [number, number]; readonly facing: number }[];
  /** Wall anchors on the Vent's flanks for the drape bank. */
  readonly ventAnchors: readonly {
    readonly pos: readonly [number, number, number];
    readonly normal: readonly [number, number, number];
  }[];
}

/** The lantern silhouette: [t, radius multiplier] pairs, foot → tip.
 *  R2: slimmed — the r1 profile's swollen belly and stubby throat read
 *  as terracotta jugs; a lantern is a drawn vertical with a held glass
 *  heart, a long narrow throat and a small crowned cap. */
const LANTERN_PROFILE: readonly (readonly [number, number])[] = [
  [0, 1.16],
  [0.05, 1.0],
  [0.14, 0.92],
  [0.28, 1.18],
  [0.42, 1.3],
  [0.56, 1.1],
  [0.66, 0.72],
  [0.76, 0.5],
  [0.86, 0.46],
  [0.92, 0.62],
  [0.96, 0.4],
  [1, 0.18],
] as const;

/** The Vent's chimney silhouette. */
const VENT_PROFILE: readonly (readonly [number, number])[] = [
  [0, 1.2],
  [0.08, 1.0],
  [0.3, 0.82],
  [0.55, 0.62],
  [0.75, 0.52],
  [0.9, 0.47],
  [1, 0.44],
] as const;

function profileAt(profile: readonly (readonly [number, number])[], t: number): number {
  for (let i = 1; i < profile.length; i++) {
    const [t1, r1] = profile[i]!;
    if (t <= t1) {
      const [t0, r0] = profile[i - 1]!;
      const k = smoothstep01((t - t0) / Math.max(1e-6, t1 - t0));
      return r0 + (r1 - r0) * k;
    }
  }
  return profile[profile.length - 1]![1];
}

/** The belly's window band, in profile t. */
const WINDOW_FROM = 0.26;
const WINDOW_TO = 0.56;

/** The slot's own fire — brighter than any lerp of the glass reaches. */
const WINDOW_FIRE = new Color(1.22, 0.86, 0.5);

/**
 * One lantern's glass: a reshaped cylinder — the profile above times
 * the spec radius, six dark ribs dividing the belly, windows between
 * them. `litness` scales the window paint (the Cold Lantern passes 0
 * and its windows stay night glass).
 */
function lanternGeometry(
  spec: { height: number; radius: number; lit: boolean },
  worldX: number,
  worldZ: number,
  baseY: number,
  random: Random,
  options: { broken?: boolean; lieAngle?: number; lieYaw?: number } = {},
): BufferGeometry {
  const rings = Math.max(16, Math.round(spec.height / 0.7));
  const geometry = new CylinderGeometry(1, 1, 1, 16, rings, true);
  geometry.translate(0, 0.5, 0);

  const noiseSeed = SEED ^ LV_SEEDS.lanterns ^ (Math.round(worldX * 7 + worldZ * 3) | 0);
  const ribPhase = random.range(0, Math.PI * 2);
  const lean = random.signed(0.05);
  const cut = options.broken ? 0.6 : 1;

  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = Math.min(position.getY(i), cut);
    const z = position.getZ(i);
    const theta = Math.atan2(z, x);
    const t = y;

    let r = profileAt(LANTERN_PROFILE, t) * spec.radius;
    // The six ribs stand faintly proud of the glass (R2: 0.08 read as
    // pumpkin lobes at portrait range).
    const rib = smoothstep01((Math.abs(Math.sin(theta * 3 + ribPhase)) - 0.78) / 0.16);
    r += rib * spec.radius * 0.035;
    // Grown glass, not turned: a slow seeded wobble.
    r *=
      1 +
      (fbm(theta * 0.7 + 2, t * 3.1, { seed: noiseSeed, period: 4, octaves: 2 }) - 0.5) * 0.16;

    position.setXYZ(
      i,
      Math.cos(theta) * r + t * t * lean * spec.height,
      t * spec.height,
      Math.sin(theta) * r,
    );
  }

  // The paint: night glass rising from violet shadow, amber windows in
  // the belly between the ribs, an ash-pale crown fed from below.
  const colors = new Float32Array(position.count * 3);
  const low = new Color(GLASS_TONES[2]);
  const mid = new Color(GLASS_TONES[0]);
  const high = new Color(GLASS_TONES[1]);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = Math.min(1, Math.max(0, y / spec.height));
    const theta = Math.atan2(z, x);

    shade.copy(low).lerp(mid, smoothstep01((t - 0.1) / 0.4));
    shade.lerp(high, smoothstep01((t - 0.55) / 0.35));

    // Vertical glass streaks — a value apart, so the body reads drawn.
    const streak =
      (fbm(theta * 1.2, t * 5, { seed: noiseSeed ^ 0x11, period: 5, octaves: 2 }) - 0.5) * 0.16;
    shade.offsetHSL(0, 0, streak);

    // The windows: three narrow slots in the belly between the ribs,
    // lit from inside (R2: the r1 panels covered most of the belly and
    // the whole spire read as one orange wash — a lantern is DARK glass
    // holding light in slots).
    const band =
      smoothstep01((t - WINDOW_FROM) / 0.05) * (1 - smoothstep01((t - WINDOW_TO) / 0.05));
    const panel = 1 - smoothstep01((Math.abs(Math.sin(theta * 3 + ribPhase)) - 0.28) / 0.2);
    const flicker =
      0.8 + 0.2 * fbm(theta * 1.6, t * 4 + 7, { seed: noiseSeed ^ 0x12, period: 6, octaves: 2 });
    const window = band * panel * (spec.lit ? 1 : 0) * flicker;
    if (window > 0.01) {
      shade.lerp(WINDOW_FIRE, Math.min(1, window * 1.1));
    }

    // The rib lines sink toward shadow — the drawing's dark ink.
    const rib = smoothstep01((Math.abs(Math.sin(theta * 3 + ribPhase)) - 0.78) / 0.16);
    shade.lerp(SHADOW_VIOLET, rib * (1 - window) * 0.4);

    // The crown: ash-pale crust, milk-bright top fed from below (held
    // moderate on lit spires: the squared emissive still warms it).
    const crown = smoothstep01((t - 0.86) / 0.1);
    shade.lerp(ASH_PALE, crown * (spec.lit ? 0.42 : 0.4));

    // Amber staining at the foot, where the wick's heat seeps.
    const stain =
      smoothstep01(
        (fbm(theta * 2.1, t * 6, { seed: noiseSeed ^ 0x13, period: 7, octaves: 2 }) - 0.62) / 0.12,
      ) *
      (1 - smoothstep01((t - 0.2) / 0.15));
    shade.lerp(AMBER, stain * (spec.lit ? 0.35 : 0.18));

    // The foot sinks into its own violet dark.
    shade.lerp(SHADOW_VIOLET, (1 - t) * 0.32);

    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  if (options.lieAngle !== undefined) {
    // The fallen lantern: tipped past horizontal, then yawed to its line.
    geometry.translate(0, 0, 0);
    geometry.rotateZ(options.lieAngle);
    geometry.rotateY(options.lieYaw ?? 0);
  } else {
    geometry.rotateY(random.range(0, Math.PI * 2));
  }
  geometry.translate(worldX, baseY, worldZ);
  return geometry;
}

/** The Morning Vent's chimney: dark basalt split by glowing seams. */
function ventGeometry(worldX: number, worldZ: number, baseY: number): BufferGeometry {
  const height = 24;
  const footR = 7;
  const geometry = new CylinderGeometry(1, 1, 1, 18, 26, true);
  geometry.translate(0, 0.5, 0);
  const noiseSeed = SEED ^ LV_SEEDS.vent;

  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const t = position.getY(i);
    const z = position.getZ(i);
    const theta = Math.atan2(z, x);
    let r = profileAt(VENT_PROFILE, t) * footR;
    // Buttressed roots and a slow grown wobble.
    const root =
      Math.max(0, Math.sin(theta * 5 + 1.2)) * (1 - smoothstep01(t / 0.2)) * footR * 0.22;
    r += root;
    r *= 1 + (fbm(theta * 0.9, t * 2.6, { seed: noiseSeed, period: 4, octaves: 2 }) - 0.5) * 0.14;
    position.setXYZ(
      i,
      Math.cos(theta) * r + t * t * 0.9,
      t * height,
      Math.sin(theta) * r - t * t * 0.4,
    );
  }

  const colors = new Float32Array(position.count * 3);
  const body = new Color(GLASS_TONES[2]);
  const high = new Color(GLASS_TONES[1]);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = Math.min(1, Math.max(0, y / height));
    const theta = Math.atan2(z, x);
    shade.copy(body).lerp(high, smoothstep01((t - 0.3) / 0.5));

    // The meridian seams: the fire climbing the chimney's flanks —
    // THIN threads (R2: the r1 threshold cut broad diagonal bands and
    // the chimney read as a carnival tent), widest at the foot,
    // thinning as they rise; the glow material reads them as light.
    const seam = smoothstep01(
      (fbm(theta * 2.6, y * 0.5, { seed: noiseSeed ^ 0x21, period: 5, octaves: 2 }) -
        (0.72 + t * 0.12)) /
        0.045,
    );
    shade.multiplyScalar(1 - seam * 0.5);
    shade.r += seam * EMBER.r * (0.85 - t * 0.25);
    shade.g += seam * EMBER.g * (0.6 - t * 0.2);
    shade.b += seam * EMBER.b * 0.25;

    // The lip: ash-pale crust where the light leaves.
    const lip = smoothstep01((t - 0.9) / 0.08);
    shade.lerp(ASH_PALE, lip * 0.6);
    shade.lerp(SHADOW_VIOLET, (1 - t) * 0.3);

    colors[i * 3] = Math.min(1, shade.r);
    colors[i * 3 + 1] = Math.min(1, shade.g);
    colors[i * 3 + 2] = Math.min(1, shade.b);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));

  geometry.rotateY(-(SMOKING3_SLOT.azimuth + 0.7));
  geometry.translate(worldX, baseY, worldZ);
  return geometry;
}

export function buildSmoking3Lanterns(): LanternsBuild {
  const random = new Random(SEED ^ LV_SEEDS.lanterns);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const perchTops: (readonly [number, number, number])[] = [];
  const feet: { pos: [number, number]; facing: number }[] = [];

  const litParts: BufferGeometry[] = [];
  const coldParts: BufferGeometry[] = [];

  const placeColliders = (spec: LanternSpec, x: number, z: number, baseY: number): void => {
    // Three spheres up the silhouette: foot, belly, throat-and-crown.
    colliders.push(
      { center: new Vector3(x, baseY + spec.height * 0.08, z), radius: spec.radius * 1.5 },
      { center: new Vector3(x, baseY + spec.height * 0.44, z), radius: spec.radius * 1.75 },
      { center: new Vector3(x, baseY + spec.height * 0.82, z), radius: spec.radius * 1.05 },
    );
    contacts.push({ x, z, radius: spec.radius * 2.4, strength: 0.35 });
    for (const side of [0.9, -2.2]) {
      const fx = x + Math.cos(side) * spec.radius * 1.7;
      const fz = z + Math.sin(side) * spec.radius * 1.7;
      feet.push({ pos: [fx, fz], facing: Math.atan2(fz - z, fx - x) });
    }
  };

  for (const spec of LANTERNS) {
    const { x, z } = worldOf(spec.u, spec.v);
    const baseY = seabedHeight(x, z) - 1.2;
    const geometry = lanternGeometry(spec, x, z, baseY, random);
    (spec.lit ? litParts : coldParts).push(geometry);
    placeColliders(spec, x, z, baseY);
    if (spec.lit) {
      perchTops.push([x, baseY + spec.height + 0.3, z]);
    }
  }

  // ─── The Spilt Light: the fallen lantern ──────────────────────────────────
  // R2: the r1 full tube tipped exactly sideways read as a torn hoop
  // floating on the sky (an open-ended single-sided shell). Now a
  // broken BELLY only — cut at the throat, tipped past horizontal so
  // the mouth kisses the ground, half-sunk: a cracked glass dome with
  // its light spilled at the break.
  const tail = worldOf(SPILT.tailU, SPILT.tailV);
  const head = worldOf(SPILT.headU, SPILT.headV);
  const lieYaw = Math.atan2(head.x - tail.x, head.z - tail.z) + Math.PI / 2;
  const spiltBase = seabedHeight((tail.x + head.x) / 2, (tail.z + head.z) / 2);
  const spiltSpec = { height: 10, radius: 2.3, lit: true };
  litParts.push(
    lanternGeometry(spiltSpec, tail.x, tail.z, spiltBase + 0.6, random, {
      broken: true,
      lieAngle: -1.92,
      lieYaw,
    }),
  );
  // Colliders lie along the fallen belly.
  for (let t = 0.1; t <= 0.7; t += 0.2) {
    colliders.push({
      center: new Vector3(
        tail.x + (head.x - tail.x) * t * 0.7,
        spiltBase + 1.2,
        tail.z + (head.z - tail.z) * t * 0.7,
      ),
      radius: 2.3,
    });
  }
  contacts.push({
    x: (tail.x + head.x) / 2,
    z: (tail.z + head.z) / 2,
    radius: 8,
    strength: 0.3,
  });

  // ─── The Morning Vent ─────────────────────────────────────────────────────
  const ventAt = worldOf(VENT.u, VENT.v);
  const ventBase = seabedHeight(ventAt.x, ventAt.z) - 1.4;
  litParts.push(ventGeometry(ventAt.x, ventAt.z, ventBase));
  for (const [y, r] of [
    [2.5, 7.6],
    [7.5, 6.2],
    [12.5, 5.0],
    [17, 4.2],
    [21.5, 3.8],
  ] as const) {
    colliders.push({ center: new Vector3(ventAt.x, ventBase + y, ventAt.z), radius: r });
  }
  contacts.push({ x: ventAt.x, z: ventAt.z, radius: 12, strength: 0.42 });
  for (const side of [0.4, 2.4, 4.4]) {
    const fx = ventAt.x + Math.cos(side) * 8.2;
    const fz = ventAt.z + Math.sin(side) * 8.2;
    feet.push({ pos: [fx, fz], facing: Math.atan2(fz - ventAt.z, fx - ventAt.x) });
  }
  // Drape anchors on the chimney's shaded flanks, mid-height.
  const ventAnchors: { pos: [number, number, number]; normal: [number, number, number] }[] = [];
  for (const theta of [1.1, 2.6, 4.3, 5.6]) {
    const nx = Math.cos(theta);
    const nz = Math.sin(theta);
    const r = profileAt(VENT_PROFILE, 0.42) * 7;
    ventAnchors.push({
      pos: [ventAt.x + nx * (r + 0.3), ventBase + 10, ventAt.z + nz * (r + 0.3)],
      normal: [nx, 0, nz],
    });
  }

  // ─── The materials and the merges ─────────────────────────────────────────
  // 0.42 with the squared chunk: the window slots (vColor ~1.2) land
  // near 0.6 of emissive — bright fire, still under the bloom pass's
  // 0.82 threshold; the dark glass contributes ~0.02.
  const litMaterial = createToonMaterial({
    vertexColors: true,
    emissive: LAMP.getHex(),
    emissiveIntensity: 0.42,
  });
  applyLampGlow(litMaterial, "vigil-lantern-glass");
  meshes.push(mergedMesh(litParts, litMaterial, "vigil-lanterns"));

  const coldMaterial = createToonMaterial({ vertexColors: true });
  meshes.push(mergedMesh(coldParts, coldMaterial, "vigil-cold-lantern"));

  return { meshes, colliders, contacts, perchTops, feet, ventAnchors };
}

/** The Vent's world seat and lip height, for the light composition. */
export function ventSpot(): { x: number; z: number; lipY: number } {
  const { x, z } = worldOf(VENT.u, VENT.v);
  return { x, z, lipY: seabedHeight(x, z) - 1.4 + 24 };
}
