import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  Object3D,
  Vector3,
  type Mesh,
} from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import type { ContactPatch } from "../../Seabed";
import { chalkTexture, mergedMesh, smoothstep01 } from "./Pale3Shared";
import {
  FONTS,
  RESTS,
  dawn,
  pale3TerrainTarget,
  roadCenter,
  worldOf,
  type FontSpec,
} from "./Pale3Terrain";

/**
 * The font towers — the Dayspring's exclusive silhouette, and the
 * shape the Lantern Combs' painted horizon promised: hollow chalk
 * light-wells with a broad root skirt, a waisted shaft and a swollen
 * lantern crown. They stand in loose processional ranks walking toward
 * the morning; the lit ones carry crown gardens and well light from
 * their mouths. Nothing in the province (or the game) repeats the
 * shape — the Bone Meadows had thickets, the Combs had fins; the
 * Dayspring has towers.
 *
 * Geometry: per font, a station × level lathe — skirt, waist, crown
 * bulge, finial tuck — with seeded wobble and real UVs (the Combs'
 * round-2 lesson: chalk with no `uv` samples one texel and the strata
 * never draw). ~450 triangles per tower; all towers merge into TWO
 * draws (warm and cool chalk families) plus THE BELFRY alone on a
 * DoubleSide draw, because its doorway shows its own interior.
 *
 * Paint (value-first): violet root shade (a colour, never black),
 * paper mid, milky crown lift; faint strata banding by height; and the
 * region's signature — every tower catches the MORNING on its
 * dawn-facing flank, warmth scaled by `dawn`, so the whole country
 * reads lit from ahead.
 */

const SEED = SEEDS.regionPale3;

const SIDES = 14;
const LEVELS = 16;

export interface CrownSpot {
  /** World position on the crown's shoulder. */
  readonly pos: readonly [number, number, number];
  /** The crown mouth's world centre (light columns, glow anchors). */
  readonly mouth: readonly [number, number, number];
}

export interface Pale3FontsBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Foot seats for percher stars and scree aprons (world space). */
  readonly footSpots: readonly { x: number; z: number; facing: number }[];
  /** Crown seats of the LIT fonts, in FONTS order. */
  readonly crownSpots: readonly CrownSpot[];
  /** The Belfry's doorway, for the pose and the resident's licence. */
  readonly belfryDoor: { x: number; y: number; z: number; facing: number };
}

/** The lathe profile, as a multiple of the font's foot radius. */
function profileRadius(h: number, hollow: boolean): number {
  const skirt = 0.7 * (1 - smoothstep01(h / 0.24));
  const shaft = 0.5 * (1 - 0.12 * h);
  const bulge = 0.62 * Math.exp(-(((h - 0.8) / 0.13) ** 2));
  // The finial tuck: closed towers gather to a point; the hollow
  // Belfry keeps an open chimney mouth.
  const tuck = hollow
    ? 1 - 0.42 * smoothstep01((h - 0.9) / 0.1)
    : 1 - 0.82 * smoothstep01((h - 0.92) / 0.08);
  return (skirt + shaft + bulge) * tuck;
}

/** One font tower's skin plus its dressing anchors. */
function fontGeometry(
  font: FontSpec,
  seed: number,
  cool: boolean,
  colliders: SphereCollider[],
  contacts: ContactPatch[],
  footSpots: { x: number; z: number; facing: number }[],
  crownSpots: CrownSpot[],
  doorwayTheta: number | null,
): BufferGeometry {
  const random = new Random(seed);
  const center = worldOf(font.u, font.v);
  const ground = pale3TerrainTarget(center.x, center.z);

  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // The morning's bearing in world space: warmth lands on the flank
  // that faces UP the spoke (toward the Dayspring).
  const toward = worldOf(font.u + 1, font.v);
  const dawnX = toward.x - center.x;
  const dawnZ = toward.z - center.z;
  const k = dawn(font.u, font.v);

  const uvArc = (font.footR * Math.PI * 2) / 6;
  const uvRise = font.height / 6;

  const spin = random.range(0, Math.PI * 2);
  const leanA = random.range(0, Math.PI * 2);
  const lean = random.range(0.008, 0.03);

  const vertexAt = (level: number, s: number): void => {
    const h = level / LEVELS;
    const theta = spin + (s / SIDES) * Math.PI * 2;
    const wobble =
      1 +
      (fbm(s / SIDES + level * 0.13, seed % 89, { seed: seed ^ 0x0aef, period: 5, octaves: 2 }) -
        0.5) *
        0.14;
    const radius = font.footR * profileRadius(h, font.hollow === true) * wobble + 0.06;
    const y = ground - 0.9 + (font.height + 0.9) * h;
    const cx = center.x + Math.cos(leanA) * lean * font.height * h * h;
    const cz = center.z + Math.sin(leanA) * lean * font.height * h * h;
    const nx = Math.cos(theta);
    const nz = Math.sin(theta);
    positions.push(cx + nx * radius, y, cz + nz * radius);
    uvs.push((s / SIDES) * uvArc, h * uvRise);

    // Paint: violet root → paper mid → milky crown; strata + streaks;
    // and the dawn flank warmth (the region's one light direction).
    const root = 1 - smoothstep01((h - 0.02) / 0.24);
    const crest = smoothstep01((h - 0.66) / 0.3);
    const band = 0.5 + 0.5 * Math.sin(h * font.height * 0.85 + s * 0.4);
    const streak = 0.5 + 0.5 * Math.sin(s * 1.7 + h * 2.6);
    const facing = Math.max(0, (nx * dawnX + nz * dawnZ) / Math.hypot(dawnX, dawnZ));
    const warm = facing * (0.25 + 0.75 * k) * (1 - root) * (cool ? 0.24 : 0.42);
    let r = 0.99 - root * 0.16 + crest * 0.13 + (band - 0.5) * 0.11 + (streak - 0.5) * 0.06;
    let g = 0.98 - root * 0.22 + crest * 0.12 + (band - 0.5) * 0.11 + (streak - 0.5) * 0.06;
    let b = 1.0 - root * 0.1 + crest * 0.16 + (band - 0.5) * 0.07 + (streak - 0.5) * 0.04;
    r += warm * 0.1;
    g += warm * 0.03;
    b -= warm * 0.11;
    colors.push(Math.min(1.14, r), Math.min(1.12, g), Math.min(1.16, b));
  };

  for (let level = 0; level <= LEVELS; level++) {
    for (let s = 0; s <= SIDES; s++) {
      vertexAt(level, s);
    }
  }
  for (let level = 0; level < LEVELS; level++) {
    for (let s = 0; s < SIDES; s++) {
      // THE BELFRY's doorway: quads near the doorway bearing are
      // skipped over the lowest levels, opening an arch into the room.
      if (doorwayTheta !== null && level / LEVELS < 0.22) {
        const theta = spin + ((s + 0.5) / SIDES) * Math.PI * 2;
        if (angleBetween(theta, doorwayTheta) < 0.42) {
          continue;
        }
      }
      const a = level * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  // Colliders: axis spheres sized to the profile (the tower is round);
  // the Belfry instead walls its ring with a doorway gap so the room
  // can be entered.
  if (doorwayTheta === null) {
    for (const h of [0.1, 0.45, 0.8]) {
      const radius = font.footR * profileRadius(h, false);
      colliders.push({
        center: new Vector3(center.x, ground + font.height * h, center.z),
        radius: radius + 0.5,
      });
    }
  } else {
    for (const h of [0.12, 0.5]) {
      const wallR = font.footR * profileRadius(h, true);
      for (let i = 0; i < 8; i++) {
        const theta = (i / 8) * Math.PI * 2;
        if (h < 0.3 && angleBetween(theta, doorwayTheta) < 0.55) {
          continue;
        }
        colliders.push({
          center: new Vector3(
            center.x + Math.cos(theta) * wallR,
            ground + font.height * h,
            center.z + Math.sin(theta) * wallR,
          ),
          radius: 1.7,
        });
      }
    }
    // The crown ring: the chimney mouth stays open at the axis.
    const crownR = font.footR * profileRadius(0.8, true);
    for (let i = 0; i < 6; i++) {
      const theta = (i / 6) * Math.PI * 2;
      colliders.push({
        center: new Vector3(
          center.x + Math.cos(theta) * crownR,
          ground + font.height * 0.8,
          center.z + Math.sin(theta) * crownR,
        ),
        radius: 1.5,
      });
    }
  }

  contacts.push({ x: center.x, z: center.z, radius: font.footR * 2.2, strength: 0.32 });
  for (let i = 0; i < 3; i++) {
    const theta = spin + (i / 3) * Math.PI * 2 + random.range(0, 0.8);
    const r = font.footR * 1.25;
    footSpots.push({
      x: center.x + Math.cos(theta) * r,
      z: center.z + Math.sin(theta) * r,
      facing: theta,
    });
  }
  if (font.lit) {
    const shoulderTheta = random.range(0, Math.PI * 2);
    const shoulderR = font.footR * profileRadius(0.86, font.hollow === true);
    crownSpots.push({
      pos: [
        center.x + Math.cos(shoulderTheta) * shoulderR,
        ground + font.height * 0.86,
        center.z + Math.sin(shoulderTheta) * shoulderR,
      ],
      mouth: [center.x, ground + font.height * 0.97, center.z],
    });
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A waymark splinter: a knee-high font shard, the road's pacing. */
function splinterGeometry(): BufferGeometry {
  const positions = new Float32Array([
    // A narrow doubled blade with a small crown swell, ~1 m authored.
    -0.28, 0, 0, 0.28, 0, 0, 0.2, 0.66, 0.06,
    -0.28, 0, 0, 0.2, 0.66, 0.06, -0.2, 0.6, 0.05,
    -0.2, 0.6, 0.05, 0.2, 0.66, 0.06, 0.3, 0.82, 0.08,
    -0.2, 0.6, 0.05, 0.3, 0.82, 0.08, -0.3, 0.8, 0.07,
    -0.3, 0.8, 0.07, 0.3, 0.82, 0.08, 0.0, 1.0, 0.1,
    0, 0, -0.24, 0, 0, 0.24, 0.1, 0.7, 0.05,
    // A broken stub beside it.
    0.34, 0, 0.12, 0.6, 0, 0.18, 0.48, 0.3, 0.15,
  ]);
  const colors = new Float32Array(positions.length);
  const uvs = new Float32Array((positions.length / 3) * 2);
  for (let i = 0; i < positions.length / 3; i++) {
    const h = positions[i * 3 + 1]!;
    const root = 1 - smoothstep01((h - 0.05) / 0.3);
    colors[i * 3] = 0.99 - root * 0.2;
    colors[i * 3 + 1] = 0.98 - root * 0.26;
    colors[i * 3 + 2] = 1.0 - root * 0.12;
    uvs[i * 2] = (positions[i * 3]! + 0.3) * 0.5;
    uvs[i * 2 + 1] = h * 0.4;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function buildPale3Fonts(): Pale3FontsBuild {
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const footSpots: { x: number; z: number; facing: number }[] = [];
  const crownSpots: CrownSpot[] = [];

  const warmChalk = createToonMaterial({
    map: chalkTexture(),
    color: 0xf6efdd,
    vertexColors: true,
  });
  const coolChalk = createToonMaterial({
    map: chalkTexture(),
    color: 0xeaecf4,
    vertexColors: true,
  });
  // The Belfry alone: its doorway shows the interior, so its backfaces
  // must exist (the Canopy Deep's hollow-mesa device).
  const belfryChalk = createToonMaterial({
    map: chalkTexture(),
    color: 0xf4eddb,
    vertexColors: true,
  });
  belfryChalk.side = DoubleSide;

  // The Belfry's doorway faces the road (toward the north-east flank).
  const belfry = FONTS.find((font) => font.hollow)!;
  const belfryCenter = worldOf(belfry.u, belfry.v);
  const doorAim = worldOf(belfry.u, belfry.v + belfry.footR + 12);
  const belfryDoorTheta = Math.atan2(doorAim.z - belfryCenter.z, doorAim.x - belfryCenter.x);

  const warmParts: BufferGeometry[] = [];
  const coolParts: BufferGeometry[] = [];
  let belfryPart: BufferGeometry | null = null;
  for (const [index, font] of FONTS.entries()) {
    const cool = !font.hollow && index % 3 === 1;
    const geometry = fontGeometry(
      font,
      SEED ^ (0x0a01 + index * 131),
      cool,
      colliders,
      contacts,
      footSpots,
      crownSpots,
      font.hollow ? belfryDoorTheta : null,
    );
    if (font.hollow) {
      belfryPart = geometry;
    } else {
      (cool ? coolParts : warmParts).push(geometry);
    }
  }

  meshes.push(mergedMesh(warmParts, warmChalk, "pale3-fonts-warm"));
  meshes.push(mergedMesh(coolParts, coolChalk, "pale3-fonts-cool"));
  meshes.push(mergedMesh([belfryPart!], belfryChalk, "pale3-belfry"));

  // The waymark splinters pacing the Sun Road: the reveal-cadence
  // carriers from the threshold (the first things of ours the fog
  // gives up past the Combs' Far Gate) to the Dawn Steps. Rests are
  // respected by construction.
  const random = new Random(SEED ^ 0x0b01);
  const splinters = new InstancedMesh(
    splinterGeometry(),
    createToonMaterial({ map: chalkTexture(), color: 0xf3ecdc, vertexColors: true }),
    52,
  );
  splinters.name = "pale3-waymarks";
  splinters.castShadow = false;
  splinters.receiveShadow = false;
  const dummy = new Object3D();
  let placed = 0;
  const placeSplinter = (u: number, v: number): void => {
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, pale3TerrainTarget(x, z) - 0.05, z);
    dummy.rotation.set(random.signed(0.08), random.range(0, Math.PI * 2), random.signed(0.08));
    const s = random.range(1.2, 2.4);
    dummy.scale.set(s, s * random.range(1.0, 1.5), s);
    dummy.updateMatrix();
    splinters.setMatrixAt(placed, dummy.matrix);
    placed++;
  };
  // An authored pair on the threshold (u 1150–1200) so the pass frame
  // carries a mark of OURS before the country (the Combs' round-3
  // lesson, pre-paid).
  placeSplinter(1158, roadCenter(1158) - 6);
  placeSplinter(1186, roadCenter(1186) + 6.5);
  for (let u = 1140; u <= 1608 && placed < 52; u += random.range(20, 30)) {
    const side = placed % 2 === 0 ? 1 : -1;
    const v = roadCenter(u) + side * random.range(4.5, 8);
    if (stationBlocked(u, v)) {
      continue;
    }
    placeSplinter(u, v);
  }
  splinters.count = placed;
  splinters.instanceMatrix.needsUpdate = true;
  splinters.computeBoundingSphere();
  meshes.push(splinters);

  const doorR = belfry.footR * profileRadius(0.1, true);
  return {
    meshes,
    colliders,
    contacts,
    footSpots,
    crownSpots,
    belfryDoor: {
      x: belfryCenter.x + Math.cos(belfryDoorTheta) * doorR,
      y: pale3TerrainTarget(belfryCenter.x, belfryCenter.z) + 2.2,
      z: belfryCenter.z + Math.sin(belfryDoorTheta) * doorR,
      facing: belfryDoorTheta,
    },
  };
}

/** True where a waymark may not stand: rests and the mere bowl. */
function stationBlocked(u: number, v: number): boolean {
  if (
    Math.hypot(u - RESTS.stillMorning.u, v - RESTS.stillMorning.v) <
    RESTS.stillMorning.radius + 3
  ) {
    return true;
  }
  if (Math.hypot(u - RESTS.doorstep.u, v - RESTS.doorstep.v) < RESTS.doorstep.radius + 3) {
    return true;
  }
  if (u > RESTS.undawn.fromU - 2 && u < RESTS.undawn.toU + 2) {
    return true;
  }
  return false;
}

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
