import {
  BufferAttribute,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import type { KitBuild } from "../kit/KitTypes";
import { FILL_SEEDS } from "./CalamityFillShared";
import { crabGeometry } from "./CalamityLife";
import { SHRINE_GLEAM, smoothstep01 } from "./CalamityShared";
import type { GhostFoot } from "./CalamityForest";
import {
  FOREST_FLOOR,
  LAST_GROVE,
  SEEP_GARDENS,
  marchChannelCenter,
  worldOf,
} from "./CalamityTerrain";

/**
 * The fill's T4 ambient life (fill plan §5) — life as a SYSTEM riding the
 * roads:
 *
 * - **The pallid survivors, re-routed onto the spine** as two kit
 *   `shoalRunner` legs. The march leg commutes the sorrow road u 64–308
 *   and TURNS at the Card House's shadow — they will not pass into the
 *   Suffocated Mile (the registry's grief clause holds the whole Mile at
 *   "no shoal"; the plan's bank detour is walled off by the march's own
 *   collider rows, so the refusal is the honest telling — deviation
 *   logged in the ledger). The crater leg picks the thread up past the
 *   Gate: causeway → the forest aisle → the Wound's lip → out along the
 *   Quiet Rim's shoulder (off the mid-rim rest) → home along the forest's
 *   south eaves. Sparse grey shoal-light (MASTER §1.1) — no glint thread;
 *   the Calamity's survivors do not sparkle.
 * - **Hermit gleam-crabs** (region EXCLUSIVE): the shrine's two tiny
 *   pilgrims, each hauling one bright shell toward the Curator's pile in
 *   a slow closed-form shuttle. They stand outside the shrine's own rest.
 * - **Snail beads** on the dead stipes (kit `percherColony`, seated).
 * - **Darting white crabs** (kit `percherColony` on the region's own crab
 *   body): shatterfield singles and garden extras — crabs 18 → 36.
 * - **The grove wrasse pair** (hover) circling the survivor's stipe.
 * - **Ash-moths** over the forest midwater, **ghost-shrimp sparkle** over
 *   the gardens' felt, a warm **pollen bias** in the grove — all kit
 *   `particulateField`.
 *
 * Fresh `FILL_SEEDS.*` streams throughout (the fence). Nothing here
 * enters the Suffocated Mile, the Gardener's road, the crest, the lawn,
 * the shrine or the mid-Quiet-Rim (the registry gates are authored into
 * every route and anchor below; the region test walks the routes).
 */

const SEED = SEEDS.regionCalamity;

export interface CalamityFillLifeBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

/** The march leg's loop, exported so the test and the build agree. It
 *  starts past the Fallen Processional (the drums own the doorway's
 *  water) and turns at the Card House's shadow — the survivors will not
 *  pass into the Mile. Lateral ±2 m and low lifts keep the loop clear of
 *  the bank rows' overlapping seal spheres (held by the route test). */
export function marchRunnerStations(): [number, number, number][] {
  // The bulge parts the legs around the First Dead One (u 168, v −3):
  // the survivors give the annunciation a wide, quiet berth.
  // 2.0 m: enough to clear the giant (needs ≥ 0.9), small enough that
  // the widened legs stay off the bank rows' seal spheres (≤ 2.27).
  const bulge = (u: number): number => 2.0 * Math.max(0, 1 - Math.abs(u - 168) / 26);
  const stations: [number, number, number][] = [];
  for (let u = 96; u <= 308; u += 16) {
    const { x, z } = worldOf(u, marchChannelCenter(u) - 2 - bulge(u));
    stations.push([x, seabedHeight(x, z) + 2.2, z]);
  }
  for (let u = 308; u >= 96; u -= 16) {
    const { x, z } = worldOf(u, marchChannelCenter(u) + 2 + bulge(u));
    stations.push([x, seabedHeight(x, z) + 3.0, z]);
  }
  return stations;
}

/** The crater leg: causeway → aisle → lip → rim shoulder → south eaves. */
export function craterRunnerStations(): [number, number, number][] {
  const spots: readonly [number, number, number][] = [
    // High over the causeway: the slab procession is a collider forest
    // (spheres reach ~5.6 m over the benches), so the survivors ride the
    // open water above it and settle into the forest aisle past u 560.
    [504, -6, 6.5],
    [534, -8, 5.8],
    [560, -1.4, 4.5],
    // Off the aisle's own centre here: the Great Slab stands at (585, 6).
    [596, -2, 2.6],
    [620, -4.9, 2.8],
    [650, -15.2, 3.0],
    [662, 6, 3.6],
    [684, 30, 3.2],
    [716, 42, 3.0],
    [756, 38, 3.0],
    [796, 24, 3.2],
    [830, 32, 3.4],
    [850, 34, 3.2],
    [824, 2, 3.4],
    [786, -14, 3.4],
    // The ground climbs toward the grove ridge here; the lifts climb
    // with it so the curve's sag between stations stays above the floor.
    [764, -20, 4.2],
    [744, -28, 4.6],
    // Over the ejecta dike's crest: the ridge crossing is itself a
    // reveal (plan §2's grove loop), and the survivors take it visibly.
    [724, -42, 3.4],
    [700, -54, 4.0],
    // Home over the dead: the south eaves are trunk country (no aisle),
    // so the leg rides above the giants' collider tops (foot + 5.8) —
    // the survivors crossing high over the ghost ranks.
    [662, -46, 7.5],
    [620, -34, 7.5],
    [566, -22, 7.0],
    [524, -14, 7.0],
  ];
  return spots.map(([u, v, lift]) => {
    const { x, z } = worldOf(u, v);
    return [x, seabedHeight(x, z) + lift, z];
  });
}

/** A snail bead: a small squashed dome, pale over a violet foot. */
function beadGeometry(): BufferGeometry {
  const geometry = new SphereGeometry(0.055, 7, 5);
  geometry.scale(1, 0.75, 1.15);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = smoothstep01((position.getY(i) + 0.04) / 0.08);
    colors[i * 3] = 0.66 + 0.34 * t;
    colors[i * 3 + 1] = 0.6 + 0.38 * t;
    colors[i * 3 + 2] = 0.68 + 0.3 * t;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** A gleam-crab: the region's crab body carrying one bright shell. */
function gleamCrabGeometry(): BufferGeometry {
  const crab = crabGeometry();
  const shell = new IcosahedronGeometry(0.09, 1);
  shell.scale(1, 0.8, 1.15);
  shell.translate(0, 0.16, 0.02);
  const position = shell.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const gleam = new Color(SHRINE_GLEAM);
  for (let i = 0; i < position.count; i++) {
    const t = smoothstep01((position.getY(i) - 0.1) / 0.1);
    colors[i * 3] = gleam.r * (0.9 + t * 0.45);
    colors[i * 3 + 1] = gleam.g * (0.9 + t * 0.45);
    colors[i * 3 + 2] = gleam.b * (0.85 + t * 0.4);
  }
  shell.setAttribute("color", new BufferAttribute(colors, 3));
  if (!crab.attributes.color) {
    const filled = new Float32Array(crab.attributes.position!.count * 3);
    const body = new Color(0xd8d2c2);
    for (let i = 0; i < crab.attributes.position!.count; i++) {
      filled[i * 3] = body.r;
      filled[i * 3 + 1] = body.g;
      filled[i * 3 + 2] = body.b;
    }
    crab.setAttribute("color", new BufferAttribute(filled, 3));
  }
  const merged = mergeGeometries([crab, shell], false);
  crab.dispose();
  shell.dispose();
  if (!merged) {
    throw new Error("calamity gleam-crab parts could not be merged");
  }
  return merged;
}

export function buildCalamityFillLife(ghosts: readonly GhostFoot[]): CalamityFillLifeBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild & { update?(timeSec: number): void }): void => {
    groups.push(build.group);
    if (build.update) {
      const update = build.update.bind(build);
      updaters.push(update);
    }
  };

  // ─── The survivors, on the spine ─────────────────────────────────────────
  keep(
    buildShoalRunner({
      seed: SEED ^ FILL_SEEDS.marchRunner,
      route: { stations: marchRunnerStations(), closed: true },
      count: 22,
      // Silver-ash, value ABOVE the water (the pilot's round-8 lesson) —
      // a faint cool emissive so the survivors ghost instead of silting.
      fish: { scale: 0.8, color: 0xd4ddd6, emissive: 0x38403e, profile: "fusilier" },
      phaseSpeed: 0.008,
      braid: { lateral: 0.32, vertical: 0.22 },
    }),
  );
  keep(
    buildShoalRunner({
      seed: SEED ^ FILL_SEEDS.craterRunner,
      route: { stations: craterRunnerStations(), closed: true },
      count: 28,
      fish: { scale: 0.85, color: 0xcfd8d2, emissive: 0x343c3a, profile: "fusilier" },
      phaseSpeed: 0.004,
      braid: { lateral: 0.4, vertical: 0.26 },
    }),
  );

  // ─── The snail beads on the dead stipes ──────────────────────────────────
  {
    const fill = new Random(SEED ^ FILL_SEEDS.snailBeads);
    const anchors: { pos: readonly [number, number, number] }[] = [];
    const count = Math.min(20, ghosts.length);
    for (let i = 0; i < count; i++) {
      const foot = ghosts[Math.floor(fill.next() * ghosts.length)]!;
      const y = seabedHeight(foot.x, foot.z) + fill.range(0.8, 2.6);
      anchors.push({
        pos: [foot.x + fill.signed(0.28), y, foot.z + fill.signed(0.28)],
      });
    }
    keep(
      buildPercherColony({
        seed: SEED ^ FILL_SEEDS.snailBeads ^ 0x0001,
        palette: { base: 0xcac2b2, tip: 0xe0d8c6, shade: 0x8a8296 },
        anchors,
        perAnchor: 1,
        body: beadGeometry(),
        motion: "seated",
      }),
    );
  }

  // ─── The darting crabs: 18 → 36 ──────────────────────────────────────────
  {
    const crabAnchors: { pos: readonly [number, number, number] }[] = [];
    for (const [u, v] of [
      // Shatterfield singles, working the fallen pavement.
      [508, -12],
      [534, 16],
      [556, -26],
      // Garden extras and one terrace ledge below the lip.
      [744, 46],
      [762, 66],
      [694, 22],
    ] as const) {
      const { x, z } = worldOf(u, v);
      crabAnchors.push({ pos: [x, seabedHeight(x, z) + 0.06, z] });
    }
    keep(
      buildPercherColony({
        seed: SEED ^ FILL_SEEDS.crabColony,
        palette: { base: 0xd4cec0, tip: 0xe2dccd, shade: 0x9a92a0 },
        anchors: crabAnchors,
        perAnchor: 3,
        body: crabGeometry(),
        motion: "dart",
      }),
    );
  }

  // ─── The hermit gleam-crabs (EXCLUSIVE): the shrine's pilgrims ───────────
  {
    const fill = new Random(SEED ^ FILL_SEEDS.gleamCrabs);
    const geometry = gleamCrabGeometry();
    const material = createToonMaterial({
      vertexColors: true,
      emissive: 0x4a4030,
      emissiveIntensity: 0.6,
    });
    const mesh = new InstancedMesh(geometry, material, 2);
    mesh.name = "calamity-gleam-crabs";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const pile = worldOf(771, -82);
    const pilgrims = [0, 1].map((i) => {
      const from = worldOf(771 + (i === 0 ? 7.5 : 4.5), -82 + (i === 0 ? -6 : 9));
      return {
        from,
        phase: fill.range(0, Math.PI * 2),
        rate: fill.range(0.035, 0.05),
        scale: fill.range(0.8, 1.0),
      };
    });
    const dummy = new Object3D();
    const gleamUpdate = (timeSec: number): void => {
      for (const [i, pilgrim] of pilgrims.entries()) {
        // A slow shuttle: crawl most of the way to the pile, turn back
        // for the next shell — never entering the shrine's own rest
        // (the stroke tops out ~4.4 m from the pile; the rest holds 3.5).
        const along = 0.12 + 0.42 * (0.5 + 0.5 * Math.sin(timeSec * pilgrim.rate + pilgrim.phase));
        const x = pilgrim.from.x + (pile.x - pilgrim.from.x) * along;
        const z = pilgrim.from.z + (pile.z - pilgrim.from.z) * along;
        dummy.position.set(x, seabedHeight(x, z) + 0.05, z);
        const outbound = Math.cos(timeSec * pilgrim.rate + pilgrim.phase) >= 0;
        const yaw = Math.atan2(pile.x - pilgrim.from.x, pile.z - pilgrim.from.z);
        dummy.rotation.set(0, outbound ? yaw : yaw + Math.PI, 0);
        dummy.scale.setScalar(pilgrim.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    gleamUpdate(0);
    mesh.computeBoundingSphere();
    const group = new Group();
    group.name = "calamity-gleam-crabs-group";
    group.add(mesh);
    groups.push(group);
    updaters.push(gleamUpdate);
  }

  // ─── The grove wrasse pair ───────────────────────────────────────────────
  {
    const survivor = worldOf(LAST_GROVE.u - 1, LAST_GROVE.v - 2);
    keep(
      buildPercherColony({
        seed: SEED ^ FILL_SEEDS.wrassePair,
        palette: { base: 0x9ab86a, tip: 0xc9d078, shade: 0x5e7a4e },
        anchors: [
          { pos: [survivor.x, seabedHeight(survivor.x, survivor.z) + 4.2, survivor.z] },
          { pos: [survivor.x + 1.2, seabedHeight(survivor.x, survivor.z) + 6.6, survivor.z - 0.8] },
        ],
        perAnchor: 1,
        body: "fry",
        motion: "hover",
      }),
    );
  }

  // ─── The drifters ────────────────────────────────────────────────────────
  const forestAt = worldOf(626, -4);
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.ashMoths,
      tint: 0xcfc9bd,
      count: 80,
      mode: "drift",
      volume: { center: [forestAt.x, FOREST_FLOOR + 6, forestAt.z], size: [150, 9, 150] },
      size: 0.12,
      opacity: 0.45,
    }),
  );
  const gardensAt = worldOf(SEEP_GARDENS.u, SEEP_GARDENS.v);
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.ghostShrimp,
      tint: 0xd8e8da,
      count: 60,
      mode: "swarm",
      volume: {
        center: [gardensAt.x, seabedHeight(gardensAt.x, gardensAt.z) + 1.2, gardensAt.z],
        size: [30, 2.4, 30],
      },
      size: 0.08,
      opacity: 0.5,
    }),
  );
  const groveAt = worldOf(LAST_GROVE.u, LAST_GROVE.v);
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.pollenMotes,
      tint: 0xe8dcb4,
      count: 60,
      mode: "drift",
      volume: {
        center: [groveAt.x, seabedHeight(groveAt.x, groveAt.z) + 4.5, groveAt.z],
        size: [36, 8, 36],
      },
      size: 0.09,
      opacity: 0.5,
      bias: { dir: [0, 1, 0], speed: 0.05 },
    }),
  );

  return {
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}
