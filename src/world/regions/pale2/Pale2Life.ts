import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Object3D,
  CatmullRomCurve3,
  Vector3,
  type Group,
  type Mesh,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildGlowColony } from "../kit/GlowColony";
import { buildParticulateField, type ParticulateFieldBuild } from "../kit/ParticulateField";
import { buildPercherColony, type PercherColonyBuild } from "../kit/PercherColony";
import { buildShoalRunner, type ShoalRunnerBuild } from "../kit/ShoalRunner";
import { smoothstep01 } from "./Pale2Shared";
import { POOLS, pale2TerrainTarget, worldOf } from "./Pale2Terrain";

/**
 * The life of the Lantern Combs — systemic, short of saturation, and
 * deterministic (every motion is a closed form of simulated time; a
 * capture can pin any moment).
 *
 * - **Pearl dust** breathes through the whole country (drift) with a
 *   second field on the threshold shelf; the White Chapel's licence
 *   admits dust and its one beam, nothing else.
 * - **Pool breath**: soft columns rising off the three lit moonmilk
 *   bowls; the Still Pool holds its breath (the rest).
 * - **Two road files** (kit shoalRunner, the province's pearl-white
 *   shoal light): the THRESHOLD FILE walks the shelf and turns at the
 *   Comb Gate — even the fish respect the Winnow's hush — and the
 *   GALLERY FILE walks the country road from the descent's foot to
 *   the Lamp Basin and home. Life as wayfinding, both directions.
 * - **THE LANTERN DRIFT** — the moving centrepiece: seven moon-jellies
 *   on one slow closed procession through the galleries, over the
 *   pools, around the Lamp — soft pearl bells rising and falling.
 * - **Perchers** (kit): porcelain brittle-stars at the comb feet,
 *   whelk shrimps at the pool lips, moth-fry hovering in the Lamp's
 *   own light.
 * - **Glow colonies** (kit): pearl lamps at the pool rims, the Lamp's
 *   warm interior garden, gold accents down the basin. All warm or
 *   pearl — the pale province burns nothing cold.
 */

const SEED = SEEDS.regionPale2;

const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

export interface Pale2LifeBuild {
  readonly meshes: (Mesh | InstancedMesh)[];
  readonly groups: Group[];
  update(timeSec: number, reducedMotion: boolean): void;
}

// ── The Lantern Drift ────────────────────────────────────────────────

/** The jellies' closed tour, in spoke coordinates + absolute y. */
const DRIFT_STATIONS: readonly (readonly [number, number, number])[] = [
  [830, 0, -5],
  [868, -26, -7],
  [908, -50, -8],
  [946, -38, -7.5],
  [978, -14, -8],
  [1008, 2, -9],
  [1002, 26, -7.5],
  [962, 36, -6],
  [918, 28, -5.5],
  [872, 16, -5],
] as const;

/** A moon-jelly bell with a short pleated skirt. ~140 triangles. */
function jellyGeometry(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const SIDES = 12;
  const LEVELS = 5;
  for (let j = 0; j <= LEVELS; j++) {
    const h = j / LEVELS;
    const y = 0.62 * Math.cos((1 - h) * Math.PI * 0.5);
    const radius = 0.78 * Math.sin((1 - h) * Math.PI * 0.5) + 0.02;
    for (let s = 0; s <= SIDES; s++) {
      const a = (s / SIDES) * Math.PI * 2;
      const scallop = 1 + (j === 0 ? 0.06 * Math.sin(a * 6) : 0);
      positions.push(Math.cos(a) * radius * scallop, y, Math.sin(a) * radius * scallop);
      // Apex-lit pearl: the crown glows softly, the skirt cools violet.
      // Round 2: values lifted — the r1 bells read grey against the milk.
      const t = smoothstep01((h - 0.1) / 0.8);
      colors.push(0.64 + 0.36 * t, 0.62 + 0.34 * t, 0.68 + 0.32 * t);
    }
  }
  for (let j = 0; j < LEVELS; j++) {
    for (let s = 0; s < SIDES; s++) {
      const a = j * (SIDES + 1) + s;
      const b = a + SIDES + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // Four short trailing ribbons.
  for (let r = 0; r < 4; r++) {
    const a = (r / 4) * Math.PI * 2 + 0.4;
    const base = positions.length / 3;
    const bx = Math.cos(a) * 0.3;
    const bz = Math.sin(a) * 0.3;
    positions.push(bx - 0.04, 0, bz, bx + 0.04, 0, bz, bx, -0.85, bz + 0.05);
    colors.push(0.62, 0.58, 0.7, 0.62, 0.58, 0.7, 0.4, 0.36, 0.5);
    indices.push(base, base + 1, base + 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const JELLY_COUNT = 7;
const DRIFT_LOOP_SEC = 210;

export function buildPale2Life(
  footSpots: readonly { x: number; z: number; facing: number }[],
  lampGlowAnchors: readonly (readonly [number, number, number])[],
  lampMouth: { x: number; y: number; z: number },
  lanternSpots: readonly (readonly [number, number, number])[],
): Pale2LifeBuild {
  const meshes: (Mesh | InstancedMesh)[] = [];
  const groups: Group[] = [];
  const particulates: ParticulateFieldBuild[] = [];
  const shoals: ShoalRunnerBuild[] = [];
  const perchers: PercherColonyBuild[] = [];

  // ── Pearl dust ─────────────────────────────────────────────────────
  const heart = worldOf(940, -10);
  const drift = buildParticulateField({
    seed: SEED ^ 0x40a1,
    tint: 0xf4eee0,
    count: 1300,
    mode: "drift",
    volume: { center: [heart.x, -7, heart.z], size: [380, 12, 380] },
    size: 0.14,
    opacity: 0.5,
  });
  particulates.push(drift);
  groups.push(drift.group);
  const shelf = worldOf(706, 0);
  const shelfDust = buildParticulateField({
    seed: SEED ^ 0x40a2,
    tint: 0xefe9dd,
    count: 260,
    mode: "drift",
    volume: { center: [shelf.x, 2.2, shelf.z], size: [110, 6, 110] },
    size: 0.13,
    opacity: 0.45,
  });
  particulates.push(shelfDust);
  groups.push(shelfDust.group);

  // ── Pool breath: columns off the lit bowls ─────────────────────────
  for (const [index, pool] of POOLS.entries()) {
    if (pool.rest) {
      continue;
    }
    const { x, z } = worldOf(pool.u, pool.v);
    const column = buildParticulateField({
      seed: SEED ^ (0x40b1 + index),
      tint: 0xd8ecdc,
      count: 70,
      mode: "column",
      volume: {
        center: [x, pool.depth + 4, z],
        size: [pool.radius * 1.2, 7, pool.radius * 1.2],
      },
      size: 0.12,
      opacity: 0.5,
    });
    particulates.push(column);
    groups.push(column.group);
  }

  // ── The Lamp's own sparks ──────────────────────────────────────────
  const lampSwarm = buildParticulateField({
    seed: SEED ^ 0x40c1,
    tint: 0xffd9a0,
    count: 60,
    mode: "swarm",
    volume: { center: [lampMouth.x, lampMouth.y, lampMouth.z], size: [11, 9, 11] },
    size: 0.1,
    opacity: 0.55,
  });
  particulates.push(lampSwarm);
  groups.push(lampSwarm.group);

  // ── The two road files ─────────────────────────────────────────────
  const shelfRoute: [number, number, number][] = [];
  for (const [u, v, lift] of [
    [648, 2, 2.2],
    [672, 8, 2.5],
    [700, -2, 2.4],
    [726, 5, 2.2],
    [746, -2, 2.0],
    [738, 10, 2.8],
    [706, 12, 3.0],
    [668, -6, 2.6],
  ] as const) {
    const { x, z } = worldOf(u, v);
    shelfRoute.push([x, pale2TerrainTarget(x, z) + lift, z]);
  }
  const thresholdFile = buildShoalRunner({
    seed: SEED ^ 0x41a1,
    route: { stations: shelfRoute, closed: true },
    count: 28,
    fish: { scale: 0.8, color: 0xf2ede2, profile: "fry" },
    phaseSpeed: 1 / 95,
    braid: { lateral: 0.8, vertical: 0.5 },
    glint: { count: 10, size: 0.06 },
  });
  shoals.push(thresholdFile);
  groups.push(thresholdFile.group);

  const galleryRoute: [number, number, number][] = [];
  for (const [u, v, lift] of [
    [818, -6, 2.4],
    [850, -20, 2.6],
    [880, -40, 3.0],
    [915, -48, 2.6],
    [945, -30, 2.8],
    [975, -12, 3.2],
    [1005, -4, 3.6],
    [1015, 18, 3.0],
    [985, 34, 2.6],
    [945, 36, 2.4],
    [905, 26, 2.6],
    [860, 12, 2.4],
  ] as const) {
    const { x, z } = worldOf(u, v);
    galleryRoute.push([x, pale2TerrainTarget(x, z) + lift, z]);
  }
  const galleryFile = buildShoalRunner({
    seed: SEED ^ 0x41a2,
    route: { stations: galleryRoute, closed: true },
    count: 44,
    fish: { scale: 0.9, color: 0xf4efe6, emissive: 0.12, profile: "fusilier" },
    phaseSpeed: 1 / 150,
    braid: { lateral: 1.1, vertical: 0.7 },
    glint: { count: 14, size: 0.07 },
  });
  shoals.push(galleryFile);
  groups.push(galleryFile.group);

  // ── The Lantern Drift ──────────────────────────────────────────────
  const curve = new CatmullRomCurve3(
    DRIFT_STATIONS.map(([u, v, y]) => {
      const { x, z } = worldOf(u, v);
      return new Vector3(x, y, z);
    }),
    true,
  );
  const jellyMaterial = createToonMaterial({ color: 0xe8ecf0, vertexColors: true });
  jellyMaterial.transparent = true;
  jellyMaterial.opacity = 0.86;
  jellyMaterial.emissive = new Color(0xd8e4e8);
  jellyMaterial.emissiveIntensity = 0.42;
  jellyMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const jellies = new InstancedMesh(jellyGeometry(), jellyMaterial, JELLY_COUNT);
  jellies.name = "pale2-lantern-drift";
  jellies.castShadow = false;
  jellies.receiveShadow = false;
  // Every instance moves every frame — the sanctioned culling opt-out.
  jellies.frustumCulled = false;
  meshes.push(jellies);

  const jellyDummy = new Object3D();
  const jellyPos = new Vector3();
  const jellyAhead = new Vector3();
  const updateJellies = (timeSec: number): void => {
    for (let i = 0; i < JELLY_COUNT; i++) {
      const phase = (timeSec / DRIFT_LOOP_SEC + i / JELLY_COUNT) % 1;
      curve.getPointAt(phase, jellyPos);
      curve.getPointAt((phase + 0.004) % 1, jellyAhead);
      const bob = Math.sin(timeSec * 0.45 + i * 1.9) * 1.1;
      jellyDummy.position.set(jellyPos.x, jellyPos.y + bob, jellyPos.z);
      jellyDummy.rotation.set(
        Math.sin(timeSec * 0.3 + i) * 0.08,
        Math.atan2(jellyAhead.x - jellyPos.x, jellyAhead.z - jellyPos.z),
        Math.cos(timeSec * 0.26 + i * 2.3) * 0.08,
      );
      // The pulse: the bell squeezes and releases, closed-form.
      const pulse = 0.5 + 0.5 * Math.sin(timeSec * 1.15 + i * 1.3);
      const s = 1.5 + (i % 3) * 0.28;
      jellyDummy.scale.set(s * (1 + pulse * 0.1), s * (1 - pulse * 0.14), s * (1 + pulse * 0.1));
      jellyDummy.updateMatrix();
      jellies.setMatrixAt(i, jellyDummy.matrix);
    }
    jellies.instanceMatrix.needsUpdate = true;
  };
  updateJellies(0);

  // ── Perchers ───────────────────────────────────────────────────────
  const starRandom = new Random(SEED ^ 0x43a1);
  const starAnchors = footSpots.slice(0, 26).map((spot) => {
    const jx = starRandom.signed(1.6);
    const jz = starRandom.signed(1.6);
    const x = spot.x + Math.cos(spot.facing) * 1.8 + jx;
    const z = spot.z + Math.sin(spot.facing) * 1.8 + jz;
    return { pos: [x, seabedHeight(x, z) + 0.04, z] as [number, number, number] };
  });
  if (starAnchors.length > 0) {
    const stars = buildPercherColony({
      seed: SEED ^ 0x43a1,
      palette: { base: 0xefe7e2, tip: 0xf7f1ea, shade: 0xb193a8 },
      anchors: starAnchors,
      perAnchor: 3,
      body: "star",
      motion: "seated",
    });
    perchers.push(stars);
    groups.push(stars.group);
  }

  const shrimpAnchors: { pos: [number, number, number] }[] = [];
  const shrimpRandom = new Random(SEED ^ 0x43a2);
  for (const pool of POOLS) {
    if (pool.rest) {
      continue;
    }
    for (let i = 0; i < 3; i++) {
      const a = shrimpRandom.range(0, Math.PI * 2);
      const { x, z } = worldOf(
        pool.u + Math.cos(a) * pool.radius * 1.05,
        pool.v + Math.sin(a) * pool.radius * 1.05,
      );
      shrimpAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
    }
  }
  const shrimps = buildPercherColony({
    seed: SEED ^ 0x43a2,
    palette: { base: 0xe8ded2, tip: 0xf4ece0, shade: 0x9a86a8 },
    anchors: shrimpAnchors,
    perAnchor: 2,
    body: "shrimp",
    motion: "seated",
  });
  perchers.push(shrimps);
  groups.push(shrimps.group);

  const mothAnchors = [
    { pos: [lampMouth.x, lampMouth.y + 1.2, lampMouth.z] as [number, number, number] },
    ...lanternSpots.slice(0, 5).map((spot) => ({
      pos: [spot[0], spot[1] + 0.5, spot[2]] as [number, number, number],
    })),
  ];
  const moths = buildPercherColony({
    seed: SEED ^ 0x43a3,
    palette: { base: 0xf4e3c0, tip: 0xffedc8, shade: 0xb99a78 },
    anchors: mothAnchors,
    perAnchor: 3,
    body: "fry",
    motion: "hover",
  });
  perchers.push(moths);
  groups.push(moths.group);

  // ── Glow colonies (all warm or pearl — nothing cold) ───────────────
  const rimGlowAnchors: (readonly [number, number, number])[] = [];
  const glowRandom = new Random(SEED ^ 0x44a1);
  for (const pool of POOLS) {
    if (pool.rest) {
      continue;
    }
    for (let i = 0; i < 2; i++) {
      const a = glowRandom.range(0, Math.PI * 2);
      const { x, z } = worldOf(
        pool.u + Math.cos(a) * pool.radius * 1.15,
        pool.v + Math.sin(a) * pool.radius * 1.15,
      );
      rimGlowAnchors.push([x, seabedHeight(x, z) + 0.1, z]);
    }
  }
  const poolGlow = buildGlowColony({
    seed: SEED ^ 0x44a1,
    tint: 0xd8ecdc,
    anchors: rimGlowAnchors,
    budsPerAnchor: 6,
    glow: 0.3,
  });
  groups.push(poolGlow.group);

  const lampGlow = buildGlowColony({
    seed: SEED ^ 0x44a2,
    tint: 0xffd9a0,
    anchors: lampGlowAnchors,
    budsPerAnchor: 7,
    glow: 0.36,
  });
  groups.push(lampGlow.group);

  const gardenGlowAnchors: (readonly [number, number, number])[] = [];
  const gardenRandom = new Random(SEED ^ 0x44a3);
  for (let i = 0; i < 4; i++) {
    const a = gardenRandom.range(0, Math.PI * 2);
    const r = gardenRandom.range(22, 40);
    const { x, z } = worldOf(1022 + Math.cos(a) * r, -4 + Math.sin(a) * r);
    gardenGlowAnchors.push([x, seabedHeight(x, z) + 0.1, z]);
  }
  const gardenGlow = buildGlowColony({
    seed: SEED ^ 0x44a3,
    tint: 0xeec98e,
    anchors: gardenGlowAnchors,
    budsPerAnchor: 5,
    glow: 0.28,
  });
  groups.push(gardenGlow.group);

  return {
    meshes,
    groups,
    update(timeSec: number, reducedMotion: boolean): void {
      const t = timeSec * (reducedMotion ? 0.45 : 1);
      for (const field of particulates) {
        field.update(t);
      }
      for (const shoal of shoals) {
        shoal.update(t);
      }
      for (const colony of perchers) {
        colony.update?.(t);
      }
      updateJellies(t);
    },
  };
}

// Re-exported for the region's tests: the tours must respect the rests.
export { DRIFT_STATIONS };
