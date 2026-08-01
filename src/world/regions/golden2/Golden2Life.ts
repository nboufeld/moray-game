import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  InstancedMesh,
  Object3D,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony, type PercherAnchor } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import { COURT_ROAD } from "./Golden2Beats";
import { HOODOOS } from "./Golden2Rocks";
import { BELFRY, TOWERS } from "./Golden2Carillon";
import { G2_SEEDS, smoothstep01 } from "./Golden2Shared";
import {
  RIBBON_SPINE,
  SEEP_POOLS,
  CELL,
  gullyChannelCenter,
  ribbonDistance,
  worldOf,
} from "./Golden2Terrain";

/**
 * The Carillon Waste's systemic life (doctrine rule 5 — a SYSTEM, not
 * decor):
 *
 * - **Gold motes** rising off the sun-warmed stone (the province's own
 *   air, one additive draw) and a **midwater plankton layer** (large
 *   soft sparks in the swimming band — the verdant-2 sweep arithmetic
 *   adopted at its proven density, so random midwater frames keep a
 *   foreground).
 * - **The traveller shoal**: gold fusiliers (the province's one shoal
 *   light) commuting the whole journey — shore road, gully, court
 *   road, around the Carillon and back. Life as wayfinding.
 * - **THE TOWER SWIFTS** — the moving centrepiece: nine small golden
 *   rays riding one closed thermal — spiralling UP the Belfry's
 *   flutes, gliding across the Pavement's sky, spiralling down the
 *   far tower, and sweeping home low over the court. Swifts around a
 *   minaret; the Carillon's rings made visible.
 * - **Small fauna on every surface type**: cushion-star trios at
 *   hoodoo feet, blennies on the Windows' sills, darting crabs on the
 *   Ribbon's floor (clear of the Anchorite's Cell), hover-fry over the
 *   seep pools.
 *
 * Every stream is `SEEDS.regionGolden2 ^` a fresh constant; updates
 * are closed-form off simulated time — no wall-clock state (the
 * connective-3 traveller-phase lesson is pre-paid: captures settle
 * deterministically).
 */

const SEED = SEEDS.regionGolden2;

export interface Golden2LifeBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildGolden2Life(): Golden2LifeBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ── The air: gold motes + the midwater plankton layer ────────────────────
  const heart = worldOf(940, 0);
  const motes = buildParticulateField({
    seed: SEED ^ G2_SEEDS.motes,
    tint: 0xf6dc9a,
    count: 700,
    mode: "drift",
    volume: { center: [heart.x, -2, heart.z], size: [400, 16, 400] },
    size: 0.11,
    opacity: 0.5,
  });
  groups.push(motes.group);
  updaters.push((t) => motes.update(t));

  const plankton = buildParticulateField({
    seed: SEED ^ G2_SEEDS.plankton,
    tint: 0xf2e2b0,
    count: 1100,
    mode: "drift",
    volume: { center: [heart.x, 3, heart.z], size: [420, 20, 420] },
    size: 0.4,
    opacity: 0.32,
    bias: { dir: [0.4, 0.05, 0.2], speed: 0.16 },
  });
  groups.push(plankton.group);
  updaters.push((t) => plankton.update(t));

  // ── The traveller shoal: the journey, swum ───────────────────────────────
  const stations: (readonly [number, number, number])[] = [];
  const seat = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    stations.push([x, seabedHeight(x, z) + lift, z] as const);
  };
  for (const u of [642, 676, 710, 744, 776, 806]) {
    seat(u, gullyChannelCenter(u) + 2.4, 2.6);
  }
  for (const [u, v] of COURT_ROAD) {
    seat(u, v + 2.4, 2.8);
  }
  // The turn at the Sunset Spires, and home along the road's west side.
  seat(1108, -4, 3.2);
  for (let i = COURT_ROAD.length - 1; i >= 0; i--) {
    seat(COURT_ROAD[i]![0], COURT_ROAD[i]![1] - 2.6, 3.4);
  }
  for (const u of [806, 776, 744, 710, 676]) {
    seat(u, gullyChannelCenter(u) - 2.4, 3.2);
  }
  const traveller = buildShoalRunner({
    seed: SEED ^ G2_SEEDS.traveller,
    route: { stations, closed: true },
    count: 48,
    fish: { scale: 0.82, color: 0xf2da9a, emissive: 0x9a7a30, profile: "fusilier" },
    phaseSpeed: 1 / 320,
    braid: { lateral: 0.5, vertical: 0.3 },
    glint: { count: 24, size: 0.12 },
  });
  groups.push(traveller.group);
  updaters.push((t) => traveller.update(t));

  // ── The Tower Swifts ─────────────────────────────────────────────────────
  const swifts = buildTowerSwifts();
  groups.push(swifts.group);
  updaters.push(swifts.update);

  // ── The perchers ─────────────────────────────────────────────────────────
  const whelkAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ G2_SEEDS.hoodooWhelks);
    for (let i = 0; i < HOODOOS.length && whelkAnchors.length < 12; i += 3) {
      const hoodoo = HOODOOS[i]!;
      const angle = random.range(0, Math.PI * 2);
      const { x, z } = worldOf(
        hoodoo.u + Math.cos(angle) * (hoodoo.cap + 1.2),
        hoodoo.v + Math.sin(angle) * (hoodoo.cap + 1.2),
      );
      whelkAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
    }
  }
  const whelks = buildPercherColony({
    seed: SEED ^ G2_SEEDS.hoodooWhelks,
    palette: { base: 0xd8b088, tip: 0xf0d8a8, shade: 0x8a6a7a },
    anchors: whelkAnchors,
    perAnchor: 3,
    body: "star",
    motion: "seated",
  });
  groups.push(whelks.group);

  const sillAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ G2_SEEDS.windowBlennies);
    for (let i = 0; i < 6; i++) {
      const t = 0.14 + i * 0.14;
      const u = 838 + (896 - 838) * t + random.signed(2);
      const v = 36 + (84 - 36) * t + random.signed(2);
      const { x, z } = worldOf(u, v);
      sillAnchors.push({ pos: [x, seabedHeight(x, z) + 0.1, z] });
    }
  }
  const blennies = buildPercherColony({
    seed: SEED ^ G2_SEEDS.windowBlennies,
    palette: { base: 0xc8a86a, tip: 0xe8d090, shade: 0x7a5f70 },
    anchors: sillAnchors,
    perAnchor: 2,
    body: "blenny",
    motion: "seated",
  });
  groups.push(blennies.group);

  const crabAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ G2_SEEDS.slotCrabs);
    for (let i = 1; i < RIBBON_SPINE.length - 1; i++) {
      const [su, sv] = RIBBON_SPINE[i]!;
      const u = su + random.signed(3);
      const v = sv + random.signed(3);
      // The Anchorite's Cell keeps its stillness.
      if (Math.hypot(u - CELL.u, v - CELL.v) < CELL.radius + 3) {
        continue;
      }
      if (ribbonDistance(u, v).d > 3) {
        continue;
      }
      const { x, z } = worldOf(u, v);
      crabAnchors.push({ pos: [x, seabedHeight(x, z) + 0.06, z] });
    }
  }
  const crabs = buildPercherColony({
    seed: SEED ^ G2_SEEDS.slotCrabs,
    palette: { base: 0xc09a7a, tip: 0xe0c096, shade: 0x74567a },
    anchors: crabAnchors,
    perAnchor: 2,
    body: "shrimp",
    motion: "dart",
  });
  groups.push(crabs.group);
  if (crabs.update) {
    updaters.push((t) => crabs.update!(t));
  }

  const fryAnchors: PercherAnchor[] = SEEP_POOLS.map((pool) => {
    const { x, z } = worldOf(pool.u, pool.v);
    return { pos: [x, seabedHeight(x, z) + 1.1, z] };
  });
  const seepFry = buildPercherColony({
    seed: SEED ^ G2_SEEDS.seepFry,
    palette: { base: 0xe8c882, tip: 0xf8e8b0, shade: 0x8a7a5a },
    anchors: fryAnchors,
    perAnchor: 6,
    body: "fry",
    motion: "hover",
  });
  groups.push(seepFry.group);
  if (seepFry.update) {
    updaters.push((t) => seepFry.update!(t));
  }

  return {
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}

// ─── The Tower Swifts ────────────────────────────────────────────────────────

/** One small golden ray-swift: a light delta with a forked tail. */
function swiftGeometry(): BufferGeometry {
  const positions = new Float32Array([
    // Left wing.
    0, 0.1, 0.7, -1.15, 0.0, -0.1, 0, 0.06, -0.1,
    0, 0.06, -0.1, -1.15, 0.0, -0.1, -0.5, 0.02, -0.5,
    // Right wing.
    0, 0.1, 0.7, 0, 0.06, -0.1, 1.15, 0.0, -0.1,
    0, 0.06, -0.1, 0.5, 0.02, -0.5, 1.15, 0.0, -0.1,
    // The forked tail.
    -0.04, 0.04, -0.45, 0.04, 0.04, -0.45, -0.22, 0.02, -1.3,
    0.04, 0.04, -0.45, 0.22, 0.02, -1.3, -0.04, 0.04, -0.45,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  const colors = new Float32Array(positions.length);
  const back = new Color(0xbc9c6c);
  const edge = new Color(0xf4e0a0);
  const shade = new Color();
  for (let i = 0; i < positions.length / 3; i++) {
    const x = Math.abs(positions[i * 3]!);
    shade.copy(back).lerp(edge, smoothstep01((x - 0.3) / 0.8));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildTowerSwifts(): { group: Group; update: (timeSec: number) => void } {
  const random = new Random(SEED ^ G2_SEEDS.swifts);

  // The thermal: up the Belfry in two turns, across the Pavement's
  // sky, down the far tower in one, and home low over the court. The
  // whole wheel fits inside the Carillon's bowl, so the poses that
  // frame the towers frame the flight (a centrepiece that cannot
  // leave the frame needs no phase luck — the caravan's r5 lesson).
  const belfry = worldOf(BELFRY.u, BELFRY.v);
  const far = worldOf(TOWERS[4]!.u, TOWERS[4]!.v);
  const belfryFloor = seabedHeight(belfry.x, belfry.z);
  const farFloor = seabedHeight(far.x, far.z);
  const points: Vector3[] = [];
  // Rising spiral around the Belfry.
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 4 + 0.6;
    const r = 6.8 - i * 0.22;
    points.push(
      new Vector3(
        belfry.x + Math.cos(angle) * r,
        belfryFloor + 3.5 + (i / 6) * (BELFRY.height - 2.5),
        belfry.z + Math.sin(angle) * r,
      ),
    );
  }
  // The glide across the Pavement's sky.
  points.push(
    new Vector3(
      (belfry.x + far.x) / 2,
      belfryFloor + BELFRY.height + 2.5,
      (belfry.z + far.z) / 2,
    ),
  );
  // Down the far tower in one turn.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 2.4;
    const r = 5.6 + i * 0.4;
    points.push(
      new Vector3(
        far.x + Math.cos(angle) * r,
        farFloor + TOWERS[4]!.height - (i / 3) * (TOWERS[4]!.height - 4),
        far.z + Math.sin(angle) * r,
      ),
    );
  }
  // Home low over the court's edge.
  const home = worldOf(1040, -46);
  points.push(new Vector3(home.x, seabedHeight(home.x, home.z) + 4.5, home.z));
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 9;
  const sway = { value: 0 };
  const material = createToonMaterial({
    vertexColors: true,
    side: 2,
    emissive: 0x9a7c3a,
    emissiveIntensity: 0.6,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSway = sway;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSway;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float wingPhase = instanceMatrix[3][0] * 0.13 + instanceMatrix[3][2] * 0.09;
         float span = abs(transformed.x);
         transformed.y += sin(uSway * 3.2 + wingPhase) * pow(span, 1.5) * 0.16;`,
      );
  };
  material.customProgramCacheKey = () => "carillon-swift";

  const mesh = new InstancedMesh(swiftGeometry(), material, count);
  mesh.name = "carillon-tower-swifts";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const group = new Group();
  group.name = "carillon-swift-wheel";
  group.add(mesh);

  const tint = new Color();
  const scales: number[] = [];
  for (let i = 0; i < count; i++) {
    scales.push(random.range(0.62, 0.85));
    tint.setScalar(random.range(0.9, 1.08));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const span = 0.5;
  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();

  const update = (timeSec: number): void => {
    sway.value = timeSec;
    // A lap of the whole thermal every ~75 s.
    const head = (0.2 + timeSec / 75) % 1;
    for (let i = 0; i < count; i++) {
      const s = (((head - (i / count) * span) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.005) % 1, ahead);
      dummy.position.copy(at);
      const yaw = Math.atan2(ahead.x - at.x, ahead.z - at.z);
      const pitch = Math.atan2(ahead.y - at.y, Math.hypot(ahead.x - at.x, ahead.z - at.z));
      dummy.rotation.set(0, yaw, 0);
      dummy.rotateX(-pitch * 0.75);
      dummy.rotateZ(Math.sin(timeSec * 0.35 + i * 1.3) * 0.14);
      dummy.scale.setScalar(scales[i]!);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { group, update };
}
