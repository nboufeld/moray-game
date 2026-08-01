import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  InstancedMesh,
  LatheGeometry,
  Object3D,
  Vector2,
  Vector3,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony, type PercherAnchor } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import { MIRROR_REST, SPINE_ROAD, insideRest } from "./Golden3Beats";
import { CANDLES } from "./Golden3Garden";
import { applyVeinGlow, G3_SEEDS, smoothstep01 } from "./Golden3Shared";
import {
  GARDEN_SPRING,
  PANS,
  DOOR,
  combeChannelCenter,
  worldOf,
} from "./Golden3Terrain";

/**
 * The Vesper Strand's systemic life (doctrine rule 5 — a SYSTEM, not
 * decor):
 *
 * - **Gold motes** settling out of the day's last light (the
 *   province's own air, one additive draw) and a **midwater plankton
 *   layer** (large soft sparks in the swimming band — the proven sweep
 *   density, so random midwater frames keep a foreground).
 * - **The traveller shoal**: gold fusiliers (the province's one shoal
 *   light) arriving down the pass from the Carillon Waste and
 *   commuting the whole road to the Sun's Door and home. Life as
 *   wayfinding on the province's last road.
 * - **THE LANTERN CARAVAN** — the moving centrepiece: ten amber
 *   lantern-jellies pacing one slow closed circuit of the spine road,
 *   lamps swinging — the desert's caravans, remade in light for the
 *   desert's last hour.
 * - **Small fauna on every surface type**: cushion-star trios at
 *   candle feet, salt-crabs darting on the two unprotected pan rims
 *   (THE STILL MIRROR keeps its stillness), hover-fry over the garden
 *   spring, whelk trios at the Sun's Door's kneeling stones.
 *
 * Every stream is `SEEDS.regionGolden3 ^` a fresh constant; updates
 * are closed-form off simulated time — no wall-clock state (captures
 * settle deterministically).
 */

const SEED = SEEDS.regionGolden3;

export interface Golden3LifeBuild {
  readonly groups: Group[];
  update(timeSec: number): void;
}

export function buildGolden3Life(): Golden3LifeBuild {
  const groups: Group[] = [];
  const updaters: ((timeSec: number) => void)[] = [];

  // ── The air: gold motes + the midwater plankton layer ────────────────────
  const heart = worldOf(1460, 0);
  const motes = buildParticulateField({
    seed: SEED ^ G3_SEEDS.motes,
    tint: 0xf6d896,
    count: 900,
    mode: "drift",
    volume: { center: [heart.x, -18, heart.z], size: [400, 18, 400] },
    size: 0.11,
    opacity: 0.5,
  });
  groups.push(motes.group);
  updaters.push((t) => motes.update(t));

  // 1,600 is the province's PROVEN midwater density (below it, a
  // random midwater camera's 15 m readable bubble is empty a third of
  // the time).
  const plankton = buildParticulateField({
    seed: SEED ^ G3_SEEDS.plankton,
    tint: 0xf2e0ae,
    count: 1600,
    mode: "drift",
    volume: { center: [heart.x, -14, heart.z], size: [420, 22, 420] },
    size: 0.4,
    opacity: 0.32,
    bias: { dir: [0.4, 0.05, 0.2], speed: 0.16 },
  });
  groups.push(plankton.group);
  updaters.push((t) => plankton.update(t));

  // ── The traveller shoal: the last road, swum ─────────────────────────────
  const stations: (readonly [number, number, number])[] = [];
  const seat = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    stations.push([x, seabedHeight(x, z) + lift, z] as const);
  };
  for (const u of [1140, 1172, 1206, 1238, 1268, 1298]) {
    seat(u, combeChannelCenter(u) + 2.4, 2.6);
  }
  for (const [u, v] of SPINE_ROAD) {
    seat(u, v + 2.4, 2.8);
  }
  // The turn at the Sun's Door, and home along the road's other side.
  seat(1596, 8, 3.4);
  for (let i = SPINE_ROAD.length - 1; i >= 0; i--) {
    seat(SPINE_ROAD[i]![0], SPINE_ROAD[i]![1] - 2.6, 3.6);
  }
  for (const u of [1298, 1268, 1238, 1206, 1172]) {
    seat(u, combeChannelCenter(u) - 2.4, 3.2);
  }
  const traveller = buildShoalRunner({
    seed: SEED ^ G3_SEEDS.traveller,
    route: { stations, closed: true },
    count: 48,
    fish: { scale: 0.82, color: 0xf2da9a, emissive: 0x9a7a30, profile: "fusilier" },
    phaseSpeed: 1 / 340,
    braid: { lateral: 0.5, vertical: 0.3 },
    glint: { count: 24, size: 0.12 },
  });
  groups.push(traveller.group);
  updaters.push((t) => traveller.update(t));

  // ── The Lantern Caravan ──────────────────────────────────────────────────
  const caravan = buildLanternCaravan();
  groups.push(caravan.group);
  updaters.push(caravan.update);

  // ── The perchers ─────────────────────────────────────────────────────────
  // Cushion-star trios at every third candle's foot.
  const starAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ G3_SEEDS.candleStars);
    for (let i = 1; i < CANDLES.length && starAnchors.length < 10; i += 3) {
      const candle = CANDLES[i]!;
      const angle = random.range(0, Math.PI * 2);
      const { x, z } = worldOf(
        candle.u + Math.cos(angle) * (candle.radius + 1.1),
        candle.v + Math.sin(angle) * (candle.radius + 1.1),
      );
      starAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
    }
  }
  const stars = buildPercherColony({
    seed: SEED ^ G3_SEEDS.candleStars,
    palette: { base: 0xd8b088, tip: 0xf0d8a8, shade: 0x8a6a7a },
    anchors: starAnchors,
    perAnchor: 3,
    body: "star",
    motion: "seated",
  });
  groups.push(stars.group);

  // Salt-crabs on the two unprotected pans' rims — never the Mirror.
  const crabAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ G3_SEEDS.panCrabs);
    for (const pan of PANS) {
      if (pan.rest) {
        continue;
      }
      for (let i = 0; i < 3; i++) {
        const angle = random.range(0, Math.PI * 2);
        const u = pan.u + Math.cos(angle) * (pan.radius + 1.4);
        const v = pan.v + Math.sin(angle) * (pan.radius + 1.4);
        if (insideRest(u, v)) {
          continue;
        }
        const { x, z } = worldOf(u, v);
        crabAnchors.push({ pos: [x, seabedHeight(x, z) + 0.06, z] });
      }
    }
  }
  const crabs = buildPercherColony({
    seed: SEED ^ G3_SEEDS.panCrabs,
    palette: { base: 0xc09a7c, tip: 0xe0c098, shade: 0x74567a },
    anchors: crabAnchors,
    perAnchor: 2,
    body: "shrimp",
    motion: "dart",
  });
  groups.push(crabs.group);
  if (crabs.update) {
    updaters.push((t) => crabs.update!(t));
  }

  // Hover-fry over the garden spring.
  const springAt = worldOf(GARDEN_SPRING.u, GARDEN_SPRING.v);
  const springFry = buildPercherColony({
    seed: SEED ^ G3_SEEDS.springFry,
    palette: { base: 0xe8c884, tip: 0xf8e8b2, shade: 0x8a7a5a },
    anchors: [{ pos: [springAt.x, seabedHeight(springAt.x, springAt.z) + 1.1, springAt.z] }],
    perAnchor: 7,
    body: "fry",
    motion: "hover",
  });
  groups.push(springFry.group);
  if (springFry.update) {
    updaters.push((t) => springFry.update!(t));
  }

  // Whelk trios at the Sun's Door's kneeling stones (outside the rest).
  const whelkAnchors: PercherAnchor[] = [];
  {
    const random = new Random(SEED ^ G3_SEEDS.doorWhelks);
    for (const at of [
      { u: DOOR.u - 13.6, v: DOOR.v + 16 },
      { u: DOOR.u - 14.5, v: DOOR.v - 11.2 },
    ]) {
      const u = at.u + random.signed(0.8);
      const v = at.v + random.signed(0.8);
      if (insideRest(u, v)) {
        continue;
      }
      const { x, z } = worldOf(u, v);
      whelkAnchors.push({ pos: [x, seabedHeight(x, z) + 0.05, z] });
    }
  }
  const whelks = buildPercherColony({
    seed: SEED ^ G3_SEEDS.doorWhelks,
    palette: { base: 0xd8b088, tip: 0xf0d8a8, shade: 0x8a6a7a },
    anchors: whelkAnchors,
    perAnchor: 3,
    body: "star",
    motion: "seated",
  });
  groups.push(whelks.group);

  return {
    groups,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}

// ─── THE LANTERN CARAVAN ─────────────────────────────────────────────────────

// Round 2: the r1 bells read as saturated parade balloons on every
// horizon — the body joins the amber-cream family and only the crown
// truly glows.
const BELL_GLOW = new Color(0xffedc0);
const BELL_AMBER = new Color(0xe0bc84);
const SKIRT_DUSK = new Color(0x84688a);

/** One lantern-jelly: a lathed bell with a fluted hanging skirt. */
function lanternGeometry(): BufferGeometry {
  const profile: Vector2[] = [
    new Vector2(0.01, 0.62),
    new Vector2(0.3, 0.58),
    new Vector2(0.5, 0.44),
    new Vector2(0.56, 0.22),
    new Vector2(0.5, 0.0),
    new Vector2(0.42, -0.1),
    new Vector2(0.34, -0.42),
    new Vector2(0.3, -0.72),
    new Vector2(0.02, -0.78),
  ];
  const geometry = new LatheGeometry(profile, 14);
  const position = geometry.attributes.position!;
  // Flute the skirt so the bell reads as cloth, not a bulb.
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y < -0.05) {
      const theta = Math.atan2(position.getZ(i), position.getX(i));
      const flute = 1 + Math.sin(theta * 6) * 0.12 * Math.min(1, -y * 1.6);
      position.setX(i, position.getX(i) * flute);
      position.setZ(i, position.getZ(i) * flute);
    }
  }
  const colors = new Float32Array(position.count * 3);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    // The lamp burns in the crown; the skirt hangs dusk-violet.
    const burn = smoothstep01((y - 0.05) / 0.5);
    const skirt = smoothstep01((-y - 0.1) / 0.5);
    shade.copy(BELL_AMBER).lerp(BELL_GLOW, burn).lerp(SKIRT_DUSK, skirt * 0.8);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildLanternCaravan(): { group: Group; update: (timeSec: number) => void } {
  const random = new Random(SEED ^ G3_SEEDS.caravan);

  // The circuit: out along the road's sunward shoulder, a slow turn
  // before the Sun's Door, home along the other shoulder — the whole
  // journey, walked nightly.
  const points: Vector3[] = [];
  const seat = (u: number, v: number, lift: number): void => {
    const { x, z } = worldOf(u, v);
    points.push(new Vector3(x, seabedHeight(x, z) + lift, z));
  };
  for (const [u, v] of SPINE_ROAD) {
    seat(u, v + 4, 5.2 + Math.sin(u * 0.02) * 0.6);
  }
  seat(1602, 10, 5.6);
  for (let i = SPINE_ROAD.length - 1; i >= 0; i--) {
    seat(SPINE_ROAD[i]![0], SPINE_ROAD[i]![1] - 4.5, 6.0 + Math.cos(i * 1.1) * 0.5);
  }
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const count = 10;
  const material = createToonMaterial({
    vertexColors: true,
    side: 2,
    emissive: 0xcf9440,
    emissiveIntensity: 0.6,
  });
  applyVeinGlow(material, "golden3-lantern");
  // Round 2: the lanterns keep the FOG. The Keeper's fog-free licence
  // is for a resident confined to its own circle; ten movers pacing
  // the whole map wearing fog-free orange read as parade balloons on
  // every horizon (five r1 frames photobombed). In fog they are warm
  // lamps in the near-mid field and soft ghosts beyond — the honest
  // read for a caravan walking away down a road.

  const mesh = new InstancedMesh(lanternGeometry(), material, count);
  mesh.name = "vesper-lantern-caravan";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const group = new Group();
  group.name = "vesper-caravan";
  group.add(mesh);

  const scales: number[] = [];
  const tint = new Color();
  for (let i = 0; i < count; i++) {
    scales.push(random.range(1.25, 1.65));
    tint.setScalar(random.range(0.92, 1.08));
    mesh.setColorAt(i, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const at = new Vector3();
  const ahead = new Vector3();

  const update = (timeSec: number): void => {
    // One circuit every ~150 s; the caravan walks, it does not race.
    const head = (0.35 + timeSec / 150) % 1;
    for (let i = 0; i < count; i++) {
      const s = (((head - i / count) % 1) + 1) % 1;
      path.getPointAt(s, at);
      path.getPointAt((s + 0.004) % 1, ahead);
      dummy.position.copy(at);
      // The lamps swing as they walk — closed-form, capture-safe.
      dummy.position.y += Math.sin(timeSec * 0.7 + i * 1.7) * 0.4;
      const yaw = Math.atan2(ahead.x - at.x, ahead.z - at.z);
      dummy.rotation.set(0, yaw, 0);
      dummy.rotateZ(Math.sin(timeSec * 0.5 + i * 0.9) * 0.08);
      const breathe = 1 + Math.sin(timeSec * 1.1 + i * 2.3) * 0.06;
      dummy.scale.set(scales[i]! * breathe, scales[i]! / breathe, scales[i]! * breathe);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { group, update };
}

// Re-export for tests: the caravan must never cross the Still Mirror.
export { MIRROR_REST };
