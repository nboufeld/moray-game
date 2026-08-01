import {
  BufferAttribute,
  Color,
  LatheGeometry,
  Vector2,
  Vector3,
  type BufferGeometry,
  type Mesh,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import {
  FLUTE_VIOLET,
  STONE_AMBER,
  STONE_BRIGHT,
  applyVeinGlow,
  mergedMesh,
  smoothstep01,
} from "./Golden2Shared";
import { CARILLON, worldOf } from "./Golden2Terrain";

/**
 * THE CARILLON — the region's heart and its first exclusive: five great
 * fluted towers of honey sandstone standing around the swept Pavement,
 * hollowed and ribbed by ten thousand years of moving water until the
 * currents RING them. The tallest — the Belfry — is open at the crown:
 * a bell-mouth hollow the Bell Ringer rises out of, slow as an hour.
 *
 * All five towers and the eight chime-stones ringing the Pavement merge
 * into ONE lit draw; the paint carries the drawing (lit amber flanks,
 * violet flute grooves, strata bands, grain jitter — the mesa-pillar
 * "plastic column" lesson pre-paid: 28 segments, strata at full pitch).
 */

const SEED = SEEDS.regionGolden2;

export interface Tower {
  /** Spoke coordinates of the foot. */
  readonly u: number;
  readonly v: number;
  /** Height from the pavement to the crown, metres. */
  readonly height: number;
  /** Base radius, metres. */
  readonly radius: number;
  /** Flute ribs around the shaft. */
  readonly ribs: number;
  /** True for the open-crowned Belfry. */
  readonly bell?: boolean;
}

/**
 * The five, ringing the Pavement (centre (1030, −18), rest radius 14):
 * feet at 16–21 m from centre so the swept circle stays swept.
 */
export const TOWERS: readonly Tower[] = [
  { u: 1033, v: 1, height: 23, radius: 3.1, ribs: 9, bell: true }, // THE BELFRY
  { u: 1011, v: -12, height: 16.5, radius: 2.5, ribs: 8 },
  { u: 1019, v: -35, height: 18.5, radius: 2.7, ribs: 10 },
  { u: 1045, v: -33, height: 14.5, radius: 2.3, ribs: 7 },
  { u: 1049, v: -8, height: 20.5, radius: 2.8, ribs: 9 },
] as const;

export const BELFRY = TOWERS[0]!;

export interface CarillonBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** World-space bell mouth: where the Bell Ringer rises. */
  readonly bellMouth: Vector3;
}

/** The tower profile: a drawn outline, not a cylinder. */
function towerProfile(tower: Tower, random: Random): Vector2[] {
  const r = tower.radius;
  const h = tower.height;
  const waist = r * random.range(0.68, 0.76);
  const points: Vector2[] = [
    new Vector2(r * 1.28, -0.6), // buried foot flare
    new Vector2(r * 1.16, h * 0.06),
    new Vector2(r, h * 0.2),
    new Vector2(waist, h * random.range(0.52, 0.6)),
    new Vector2(r * 0.82, h * 0.78),
  ];
  if (tower.bell) {
    // The bell mouth: the crown flares open and the profile returns
    // DOWN inside — the hollow the resident lives in.
    points.push(
      new Vector2(r * 0.95, h * 0.94),
      new Vector2(r * 1.02, h),
      new Vector2(r * 0.72, h * 0.985),
      new Vector2(r * 0.5, h * 0.86),
      new Vector2(r * 0.34, h * 0.7),
      new Vector2(0.01, h * 0.68),
    );
  } else {
    points.push(
      new Vector2(r * 0.66, h * 0.9),
      new Vector2(r * random.range(0.3, 0.42), h * 0.985),
      new Vector2(0.01, h),
    );
  }
  return points;
}

/** Radial fluting + drawn paint, applied to a lathed tower in place. */
function fluteAndPaint(geometry: BufferGeometry, tower: Tower, seed: number): void {
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  const bright = new Color().copy(STONE_BRIGHT);
  const amber = new Color().copy(STONE_AMBER);
  const violet = new Color().copy(FLUTE_VIOLET);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, z);
    const theta = Math.atan2(z, x);
    const t = Math.min(1, Math.max(0, y / tower.height));
    // The flutes: ribs deepen through the wind-worked middle, fade at
    // the foot flare and the crown. Groove depth rides the sine —
    // deepened in round 2 (0.085 read as a smooth slug at pose range).
    const groove = Math.sin(theta * tower.ribs + t * 1.6);
    const band = smoothstep01((t - 0.06) / 0.12) * (1 - smoothstep01((t - 0.82) / 0.14));
    const flute = 1 + groove * 0.14 * band;
    if (radius > 0.02) {
      position.setX(i, x * flute);
      position.setZ(i, z * flute);
    }
    // Paint: lit amber rising to bright at the crown, violet pooled in
    // every groove, strata bands at full pitch, grain jitter so no
    // facet holds one toon value. Round 2: the violet terms halved and
    // the base lifted — the r1 shade sides collapsed to flat maroon.
    // Round 3: value contrast UP and a fine close-range grain added —
    // the r2 flat emissive floor ironed the drawing out of the shade
    // side (the vein-glow patch below puts the emissive under the
    // paint's control, so the paint must carry the whole drawing).
    const strata =
      fbm(t * 6.5, theta * 0.7, { seed: seed ^ 0x17, period: 5, octaves: 2 }) - 0.5;
    const grain =
      fbm(theta * 2.2, y * 0.5, { seed: seed ^ 0x2b, period: 7, octaves: 2 }) - 0.5;
    const fine =
      fbm(theta * 6.4, y * 2.3, { seed: seed ^ 0x3d, period: 9, octaves: 2 }) - 0.5;
    shade
      .copy(amber)
      .lerp(bright, smoothstep01((t - 0.35) / 0.6) * 0.8)
      .lerp(violet, Math.max(0, -groove) * 0.38 * band + Math.max(0, -strata) * 0.26)
      .multiplyScalar(1.06 + strata * 0.28 + grain * 0.24 + fine * 0.13);
    // The foot stands in its own contact dusk.
    shade.lerp(violet, (1 - smoothstep01((t - 0.02) / 0.1)) * 0.22);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** Lerps a painted stone's colours toward the sunlit pale crest. */
function palenStone(geometry: BufferGeometry): void {
  const colors = geometry.attributes.color as BufferAttribute;
  const c = new Color();
  for (let i = 0; i < colors.count; i++) {
    c.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).lerp(STONE_BRIGHT, 0.42);
    colors.setXYZ(i, c.r, c.g, c.b);
  }
  colors.needsUpdate = true;
}

export function buildCarillon(): CarillonBuild {
  const random = new Random(SEED ^ 0x61a1);
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const parts: BufferGeometry[] = [];

  let bellMouth = new Vector3();

  for (const [i, tower] of TOWERS.entries()) {
    const geometry = new LatheGeometry(towerProfile(tower, random), 28);
    fluteAndPaint(geometry, tower, SEED ^ (0x61b0 + i));
    const { x, z } = worldOf(tower.u, tower.v);
    const y = seabedHeight(x, z);
    geometry.rotateY(random.range(0, Math.PI * 2));
    geometry.translate(x, y, z);
    parts.push(geometry);

    contacts.push({ x, z, radius: tower.radius * 1.7, strength: 0.45 });
    // Stacked collider spheres the tower's whole height.
    const steps = Math.ceil(tower.height / 3.4);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const r = tower.radius * (1.22 - 0.4 * t);
      colliders.push({
        center: new Vector3(x, y + 0.6 + tower.height * t, z),
        radius: Math.max(1.1, r),
      });
    }
    if (tower.bell) {
      bellMouth = new Vector3(x, y + tower.height * 0.99, z);
    }
  }

  // The chime-stones: eight small hollow-worn stones ringing the
  // Pavement's edge — the carillon's little bells, and the whelk
  // colonies' perches. Drawn from the same stream, merged into the
  // same draw.
  const centre = worldOf(CARILLON.u, CARILLON.v);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + random.signed(0.12);
    const ringR = 15.2 + random.range(0, 1.4);
    const x = centre.x + Math.cos(angle) * ringR;
    const z = centre.z + Math.sin(angle) * ringR;
    const h = random.range(1.1, 1.9);
    const stone = new LatheGeometry(
      [
        new Vector2(h * 0.42, -0.3),
        new Vector2(h * 0.46, h * 0.25),
        new Vector2(h * 0.3, h * 0.6),
        new Vector2(h * 0.34, h * 0.85),
        new Vector2(0.01, h),
      ],
      12,
    );
    fluteAndPaint(
      stone,
      { u: 0, v: 0, height: h, radius: h * 0.45, ribs: 5 },
      SEED ^ (0x61c0 + i),
    );
    // Round 3: the chime-stones step into the pale family — at the
    // towers' feet the r2 stones wore the shafts' own amber and the
    // two reads fused into one mass.
    palenStone(stone);
    stone.rotateY(random.range(0, Math.PI * 2));
    stone.translate(x, seabedHeight(x, z), z);
    parts.push(stone);
    contacts.push({ x, z, radius: h * 0.7, strength: 0.35 });
    colliders.push({ center: new Vector3(x, seabedHeight(x, z) + h * 0.4, z), radius: h * 0.5 });
  }

  // The stone dusk-lift (round 2), put under the paint's control in
  // round 3: the r2 FLAT emissive floor kept the shade side a colour
  // but ironed the drawing out of it — a 20 m shaft read as one smooth
  // slug. The vein-glow patch multiplies the emissive by the baked
  // vertex paint, so the grooves stay dusk-violet while the lit strata
  // carry the lift, and the drawing survives on the shade side.
  const material = createToonMaterial({
    color: 0xdfc79a,
    vertexColors: true,
    emissive: 0x584430,
    emissiveIntensity: 0.55,
  });
  applyVeinGlow(material, "golden2-tower-dusk");
  const mesh = mergedMesh(parts, material, "carillon-towers");

  return { meshes: [mesh], colliders, contacts, bellMouth };
}
