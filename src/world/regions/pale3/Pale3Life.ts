import {
  CatmullRomCurve3,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
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
import { angelBodyGeometry } from "./Pale3Angel";
import { RESTS, pale3TerrainTarget, spokeOf, worldOf } from "./Pale3Terrain";
import type { CrownSpot } from "./Pale3Fonts";

/**
 * The life of the Dayspring — systemic, short of saturation, and
 * deterministic (every motion is a closed form of simulated time; a
 * capture can pin any moment).
 *
 * - **Dawn motes** breathe through the whole country (drift) with a
 *   second field on the threshold shelf; the mere and the doorstep
 *   keep their licences (nothing moves over the mirror; the doorstep
 *   admits only the Chorister and the light).
 * - **Font breath**: soft columns of spark rising from every lit
 *   crown — the towers welling the morning.
 * - **Two road files** (kit shoalRunner, the province's pearl-white
 *   shoal light): the PILGRIM FILE walks the threshold shelf and
 *   turns at the Matins Gate — even the fish respect the Undawn — and
 *   the MORNING FILE walks the country road from the descent's foot
 *   up the Dawn Steps' flank and home. Life as wayfinding, and the
 *   whole region's life walks TOWARD the light.
 * - **THE DAWN CHOIR** — the moving centrepiece: six lesser
 *   sea-angels on one slow closed procession through the font
 *   country, rising at each lit crown — sparks on their way up.
 * - **Perchers** (kit): porcelain brittle-stars at the font feet,
 *   whelk shrimps on the terrace lips, moth-fry hovering in the
 *   crown gardens' light.
 * - **Glow colonies** (kit): crown lamps on the lit fonts, terrace
 *   lamps up the Dawn Steps, rose accents in the Blushfields. All
 *   warm or pearl — the pale province burns nothing cold.
 */

const SEED = SEEDS.regionPale3;

const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

export interface Pale3LifeBuild {
  readonly meshes: (Mesh | InstancedMesh)[];
  readonly groups: Group[];
  update(timeSec: number, reducedMotion: boolean): void;
}

// ── The Dawn Choir ───────────────────────────────────────────────────

/** The choir's closed tour, in spoke coordinates + absolute y. It
 *  rises at the lit crowns and never enters a rest (the mere at
 *  (1438, 74) r 26, the doorstep at (1614, 0) r 13, the Undawn). */
const CHOIR_STATIONS: readonly (readonly [number, number, number])[] = [
  [1330, -8, -14],
  [1362, -28, -10],
  [1390, -10, -6],
  [1424, -34, -8],
  [1450, -20, -4],
  [1484, 4, -7],
  [1510, 34, -5],
  [1540, 16, -8],
  [1560, -12, -6],
  [1540, -46, -9],
  [1500, -60, -12],
  [1450, -66, -10],
  [1404, -48, -13],
  [1364, -18, -15],
] as const;

const CHOIR_COUNT = 6;
const CHOIR_LOOP_SEC = 190;

export function buildPale3Life(
  footSpots: readonly { x: number; z: number; facing: number }[],
  crownSpots: readonly CrownSpot[],
  budSpots: readonly (readonly [number, number, number])[],
  pearlCrest: { x: number; y: number; z: number },
): Pale3LifeBuild {
  const meshes: (Mesh | InstancedMesh)[] = [];
  const groups: Group[] = [];
  const particulates: ParticulateFieldBuild[] = [];
  const shoals: ShoalRunnerBuild[] = [];
  const perchers: PercherColonyBuild[] = [];

  // ── Dawn motes ─────────────────────────────────────────────────────
  const heart = worldOf(1460, -10);
  const drift = buildParticulateField({
    seed: SEED ^ 0x40a1,
    tint: 0xf6efe2,
    count: 1250,
    mode: "drift",
    volume: { center: [heart.x, -11, heart.z], size: [380, 14, 380] },
    size: 0.14,
    opacity: 0.5,
  });
  particulates.push(drift);
  groups.push(drift.group);
  const shelf = worldOf(1200, 0);
  const shelfDust = buildParticulateField({
    seed: SEED ^ 0x40a2,
    tint: 0xefe9dd,
    count: 240,
    mode: "drift",
    volume: { center: [shelf.x, 2.2, shelf.z], size: [110, 6, 110] },
    size: 0.13,
    opacity: 0.45,
  });
  particulates.push(shelfDust);
  groups.push(shelfDust.group);

  // ── Font breath: spark columns off every lit crown ─────────────────
  for (const [index, spot] of crownSpots.entries()) {
    const [mx, my, mz] = spot.mouth;
    const column = buildParticulateField({
      seed: SEED ^ (0x40b1 + index),
      tint: 0xffe4b0,
      count: 55,
      mode: "column",
      volume: { center: [mx, my + 2.6, mz], size: [3.2, 6.5, 3.2] },
      size: 0.11,
      opacity: 0.5,
    });
    particulates.push(column);
    groups.push(column.group);
  }

  // ── The first sparks over the pearl ────────────────────────────────
  const crestSwarm = buildParticulateField({
    seed: SEED ^ 0x40c1,
    tint: 0xffd9a0,
    count: 48,
    mode: "swarm",
    volume: { center: [pearlCrest.x, pearlCrest.y + 1.6, pearlCrest.z], size: [10, 6, 10] },
    size: 0.1,
    opacity: 0.55,
  });
  particulates.push(crestSwarm);
  groups.push(crestSwarm.group);

  // ── The two road files ─────────────────────────────────────────────
  const shelfRoute: [number, number, number][] = [];
  for (const [u, v, lift] of [
    [1142, 2, 2.2],
    [1166, 8, 2.5],
    [1194, -2, 2.4],
    [1220, 5, 2.2],
    [1242, -2, 2.0],
    [1234, 10, 2.8],
    [1200, 12, 3.0],
    [1162, -6, 2.6],
  ] as const) {
    const { x, z } = worldOf(u, v);
    shelfRoute.push([x, pale3TerrainTarget(x, z) + lift, z]);
  }
  const pilgrimFile = buildShoalRunner({
    seed: SEED ^ 0x41a1,
    route: { stations: shelfRoute, closed: true },
    count: 28,
    fish: { scale: 0.8, color: 0xf2ede2, profile: "fry" },
    phaseSpeed: 1 / 95,
    braid: { lateral: 0.8, vertical: 0.5 },
    glint: { count: 10, size: 0.06 },
  });
  shoals.push(pilgrimFile);
  groups.push(pilgrimFile.group);

  const morningRoute: [number, number, number][] = [];
  for (const [u, v, lift] of [
    [1318, -4, 2.4],
    [1350, -16, 2.6],
    [1384, -2, 3.0],
    [1420, -16, 2.6],
    [1456, -4, 2.8],
    [1492, 8, 3.2],
    [1528, 2, 3.0],
    [1560, 10, 3.4],
    [1590, 22, 3.0],
    [1596, 44, 2.8],
    [1560, 46, 2.6],
    [1520, 40, 2.4],
    [1470, 38, 2.6],
    [1420, 20, 2.4],
    [1372, 22, 2.6],
    [1338, 12, 2.4],
  ] as const) {
    const { x, z } = worldOf(u, v);
    morningRoute.push([x, pale3TerrainTarget(x, z) + lift, z]);
  }
  const morningFile = buildShoalRunner({
    seed: SEED ^ 0x41a2,
    route: { stations: morningRoute, closed: true },
    count: 44,
    fish: { scale: 0.9, color: 0xf4efe6, emissive: 0.12, profile: "fusilier" },
    phaseSpeed: 1 / 150,
    braid: { lateral: 1.1, vertical: 0.7 },
    glint: { count: 14, size: 0.07 },
  });
  shoals.push(morningFile);
  groups.push(morningFile.group);

  // ── The Dawn Choir ─────────────────────────────────────────────────
  const curve = new CatmullRomCurve3(
    CHOIR_STATIONS.map(([u, v, y]) => {
      const { x, z } = worldOf(u, v);
      return new Vector3(x, y, z);
    }),
    true,
  );
  const choirMaterial = createToonMaterial({ color: 0xf0eaf2, vertexColors: true });
  choirMaterial.transparent = true;
  choirMaterial.opacity = 0.88;
  choirMaterial.side = DoubleSide; // the wings are single sheets
  choirMaterial.emissive = new Color(0xe8d0d8);
  choirMaterial.emissiveIntensity = 0.34;
  choirMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  const choir = new InstancedMesh(angelBodyGeometry(), choirMaterial, CHOIR_COUNT);
  choir.name = "pale3-dawn-choir";
  choir.castShadow = false;
  choir.receiveShadow = false;
  // Every instance moves every frame — the sanctioned culling opt-out.
  choir.frustumCulled = false;
  meshes.push(choir);

  const choirDummy = new Object3D();
  const choirPos = new Vector3();
  const choirAhead = new Vector3();
  const updateChoir = (timeSec: number): void => {
    for (let i = 0; i < CHOIR_COUNT; i++) {
      const phase = (timeSec / CHOIR_LOOP_SEC + i / CHOIR_COUNT) % 1;
      curve.getPointAt(phase, choirPos);
      curve.getPointAt((phase + 0.004) % 1, choirAhead);
      const bob = Math.sin(timeSec * 0.4 + i * 1.9) * 1.2;
      choirDummy.position.set(choirPos.x, choirPos.y + bob, choirPos.z);
      const yaw = Math.atan2(choirAhead.x - choirPos.x, choirAhead.z - choirPos.z);
      choirDummy.rotation.set(0, yaw - Math.PI / 2, Math.sin(timeSec * 0.32 + i * 2.1) * 0.1);
      // The beat: the whole body breathes with the stroke, closed-form.
      const beat = 0.5 + 0.5 * Math.sin(timeSec * 1.9 + i * 1.3);
      const s = 1.0 + (i % 3) * 0.14;
      choirDummy.scale.set(s, s * (1 - beat * 0.08), s * (1 + beat * 0.12));
      choirDummy.updateMatrix();
      choir.setMatrixAt(i, choirDummy.matrix);
    }
    choir.instanceMatrix.needsUpdate = true;
  };
  updateChoir(0);

  // ── Perchers ───────────────────────────────────────────────────────
  const starRandom = new Random(SEED ^ 0x43a1);
  const starAnchors = footSpots
    .slice(0, 26)
    .map((spot) => {
      const jx = starRandom.signed(1.6);
      const jz = starRandom.signed(1.6);
      const x = spot.x + Math.cos(spot.facing) * 1.8 + jx;
      const z = spot.z + Math.sin(spot.facing) * 1.8 + jz;
      return { pos: [x, seabedHeight(x, z) + 0.04, z] as [number, number, number] };
    })
    // The rests keep their silence: the vigil font's feet stand on the
    // Undawn's shoulder, and a jittered star can slip into the band.
    .filter((anchor) => {
      const { u, v } = spokeOf(anchor.pos[0], anchor.pos[2]);
      if (u > RESTS.undawn.fromU - 4 && u < RESTS.undawn.toU + 4) {
        return false;
      }
      if (
        Math.hypot(u - RESTS.stillMorning.u, v - RESTS.stillMorning.v) <
        RESTS.stillMorning.radius + 2
      ) {
        return false;
      }
      return Math.hypot(u - RESTS.doorstep.u, v - RESTS.doorstep.v) > RESTS.doorstep.radius + 2;
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

  // Whelk shrimps on the terrace lips (never the doorstep pan).
  const shrimpAnchors: { pos: [number, number, number] }[] = [];
  const shrimpRandom = new Random(SEED ^ 0x43a2);
  for (const at of [1585, 1603, 1621] as const) {
    for (let i = 0; i < 3; i++) {
      const v = shrimpRandom.range(-44, 58);
      if (Math.hypot(at - 1614, v) < 15) {
        continue;
      }
      const { x, z } = worldOf(at, v);
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

  // Moth-fry hovering in the crown gardens' light.
  const mothAnchors = [
    ...crownSpots.slice(0, 4).map((spot) => ({
      pos: [spot.mouth[0], spot.mouth[1] + 1.2, spot.mouth[2]] as [number, number, number],
    })),
    ...budSpots.slice(0, 4).map((spot) => ({
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
  const crownGlow = buildGlowColony({
    seed: SEED ^ 0x44a1,
    tint: 0xffd9a0,
    anchors: crownSpots.map((spot) => spot.pos),
    budsPerAnchor: 7,
    glow: 0.36,
  });
  groups.push(crownGlow.group);

  const terraceGlowAnchors: (readonly [number, number, number])[] = [];
  const glowRandom = new Random(SEED ^ 0x44a2);
  for (const at of [1586, 1604, 1622] as const) {
    for (let i = 0; i < 2; i++) {
      const v = glowRandom.range(-40, 52);
      if (Math.hypot(at - 1614, v) < 15) {
        continue;
      }
      const { x, z } = worldOf(at, v);
      terraceGlowAnchors.push([x, seabedHeight(x, z) + 0.1, z]);
    }
  }
  const terraceGlow = buildGlowColony({
    seed: SEED ^ 0x44a2,
    tint: 0xf2cf96,
    anchors: terraceGlowAnchors,
    budsPerAnchor: 5,
    glow: 0.3,
  });
  groups.push(terraceGlow.group);

  const roseGlowAnchors: (readonly [number, number, number])[] = [];
  const roseRandom = new Random(SEED ^ 0x44a3);
  for (let i = 0; i < 4; i++) {
    const u = roseRandom.range(1390, 1540);
    const v = roseRandom.range(-108, -48);
    const { x, z } = worldOf(u, v);
    roseGlowAnchors.push([x, seabedHeight(x, z) + 0.1, z]);
  }
  const roseGlow = buildGlowColony({
    seed: SEED ^ 0x44a3,
    tint: 0xf0b6c4,
    anchors: roseGlowAnchors,
    budsPerAnchor: 5,
    glow: 0.26,
  });
  groups.push(roseGlow.group);

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
      updateChoir(t);
    },
  };
}

// Re-exported for the region's tests: the tour must respect the rests.
export { CHOIR_STATIONS };
