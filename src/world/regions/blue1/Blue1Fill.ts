import { Color, InstancedMesh, Object3D, type Group } from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry } from "../../RockShapes";
import { seabedHeight } from "../../Seabed";
import { buildBushBank } from "../kit/BushBank";
import { buildCarpetField, type CarpetFieldBuild } from "../kit/CarpetField";
import { buildFarGrassCards } from "../kit/FarGrassCards";
import { buildGroundLitter } from "../kit/GroundLitter";
import type { GateFn, KitArea, KitBuild } from "../kit/KitTypes";
import { buildParticulateField } from "../kit/ParticulateField";
import { buildPercherColony } from "../kit/PercherColony";
import { buildScreeApron, type ScreeAnchor } from "../kit/ScreeApron";
import { buildShoalRunner } from "../kit/ShoalRunner";
import { starGeometry, whelkGeometry } from "./Blue1Life";
import { smoothstep01, STONE_BLUE, WIND_X, WIND_Z } from "./Blue1Shared";
import { swardAt } from "./Blue1Steppe";
import type { Blue1StoneSite } from "./Blue1Stones";
import {
  CENTER_X,
  CENTER_Z,
  TERRACE_STEPS,
  blue1TerrainTarget,
  dropWeight,
  slopeChannelCenter,
  spokeOf,
  tongueHalfWidth,
  worldOf,
} from "./Blue1Terrain";
import {
  channelClear,
  crestWeight,
  FILL_SEEDS,
  leeWeight,
  restFree,
} from "./Blue1FillShared";

/**
 * THE DROP PLAINS' fill (Phase 3, docs/fill-plans/great-blue-1.md at the
 * R12 standard) — the space between the landmarks made deliberate:
 *
 * - **The grass tiers** (the prairie's ~4×): a near tier of the kit's
 *   QUALITY `"blade"` clumps (the R12 craft — S-bends, cups, tip taper,
 *   sun-through-leaf) for everything a pose can stand in; a mid `"tuft"`
 *   tier carrying the body; a far 4-tri card tier with `nearFade` so the
 *   cheap cards can never sit in a foreground. The region's own tall
 *   signature blades stay untouched above all three.
 * - **Wind-combed crest beds**: blade runs raked with the steppe's one
 *   wind on the swell crests, pale gravel pooled in the lees — the
 *   crest/lee vocabulary repeated on every spine crest.
 * - **Megalith collars** (region EXCLUSIVE composition): gravel apron
 *   (graded litter), calf-stones, whelk trios, stone-skirt blennies and a
 *   grass ring at every standing stone — each stone becomes a place.
 * - **The slope dressed**: shoulder gravel runs beside the clean sand
 *   road, the gate's warm last-reef bed dying out by u ≈ 74, waymark
 *   collars, and the outrider thread — a silver loop crossing the glide
 *   at u ≈ 150, the migration's promise shown early.
 * - **The Wayline's worn grit line** and the terrace-edge overlook cairn;
 *   scree tongues down every shelf lip; a deep star variant below the
 *   grass line; grass-fry pods at three named haunts; wind-blown grass
 *   seeds drifting off the crests.
 *
 * Every stream is `SEEDS.regionBlue1 ^ FILL_SEEDS.*`, appended after all
 * existing draws (the reroll fence). Every gate multiplies `restFree` —
 * the Under-Blue, the Fallen King hollow and the Prow tip take NOTHING,
 * and the channel lane stays a clean sand road its whole length.
 */

const SEED = SEEDS.regionBlue1;

export interface Blue1FillBuild {
  readonly nodes: Object3D[];
  /** Named for the tests: kit groups by role. */
  readonly named: Readonly<Record<string, Group | InstancedMesh>>;
  update(timeSec: number): void;
}

// ─── The grass palette (value-first for the blue register) ──────────────────

/** Tip owns the hue (the kit ceiling rule): pale wind-silver over green. */
const GRASS_PALETTE = { base: 0x66bda2, tip: 0xcfeadb, shade: 0x2f6e5c } as const;
/** The mid tier keeps GREEN tips: with the silver tip ink its 12-tri
 *  tufts rendered as pale wedges at close range (round-1 probe) — the
 *  near blades own the silver note. */
const GRASS_MID_PALETTE = { base: 0x58a486, tip: 0x9fd6b6, shade: 0x2f6e5c } as const;
const CREST_PALETTE = { base: 0x74c9ac, tip: 0xdcf2e2, shade: 0x35755f } as const;

// ─── The shared gate arithmetic ──────────────────────────────────────────────

/** Steppe-country base: on the disc, off the drop, off the deep shelves. */
function steppeBase(x: number, z: number): number {
  const { u, v } = spokeOf(x, z);
  if (dropWeight(u - 445, v) > 0.05) {
    return 0;
  }
  const floor = blue1TerrainTarget(x, z);
  if (floor < -25.5) {
    return 0;
  }
  // Grass thins as the shelves step the light away.
  const shelfThin = 1 - 0.6 * smoothstep01((-floor - 18.5) / 8);
  // The disc owns the prairie; the slope keeps its own composed shoulders.
  const open = smoothstep01((u - 292) / 16);
  return shelfThin * open;
}

function grassGate(sites: readonly Blue1StoneSite[], minBase: number, swardShare: number): GateFn {
  return (x, z) => {
    const base = steppeBase(x, z);
    if (base <= 0) {
      return 0;
    }
    let g = minBase + swardAt(x, z) * swardShare;
    // The collar ring: a deliberate grass ring around every standing
    // stone (skirts, not moats) — and nothing under the stone itself.
    for (const site of sites) {
      if (site.kind === "stump") {
        continue;
      }
      const d = Math.hypot(x - site.x, z - site.z);
      if (d < site.radius * 1.15) {
        return 0;
      }
      const ring = 1 - Math.abs(d - site.radius * 2.1) / 2.2;
      if (ring > 0) {
        g = Math.max(g, ring * 0.95);
      }
    }
    return Math.min(1, g) * base * restFree(x, z);
  };
}

// ─── Areas ───────────────────────────────────────────────────────────────────

function discArea(radius: number): KitArea {
  return { center: [CENTER_X, CENTER_Z], radius };
}

/** The slope corridor as a kit road area, stations along the channel. */
function slopeArea(fromU: number, toU: number, width: number): KitArea {
  const polyline: [number, number][] = [];
  for (let u = fromU; u <= toU; u += 18) {
    const { x, z } = worldOf(u, slopeChannelCenter(u));
    polyline.push([x, z]);
  }
  return { polyline, width };
}

// ─── The build ───────────────────────────────────────────────────────────────

export function buildBlue1Fill(sites: readonly Blue1StoneSite[]): Blue1FillBuild {
  const nodes: Object3D[] = [];
  const named: Record<string, Group | InstancedMesh> = {};
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (
    build: KitBuild | CarpetFieldBuild,
    name: string,
  ): void => {
    build.group.name = name;
    named[name] = build.group;
    nodes.push(build.group);
    if ("update" in build) {
      updaters.push((timeSec) => (build as CarpetFieldBuild).update(timeSec));
    }
  };

  // The mid-glide hush (u 180–230) keeps its waymark bare: the one stone
  // whose foot the registry composes as silence — no collar, no calves.
  const outsideHush = (site: Blue1StoneSite): boolean => {
    if (site.kind !== "waymark") {
      return true;
    }
    const { u } = spokeOf(site.x, site.z);
    return u < 178 || u > 232;
  };
  const collarEligible = sites.filter(outsideHush);
  const collarSites = collarEligible.filter(
    (s) => s.kind === "megalith" || s.kind === "waymark",
  );
  const megalithSites = sites.filter((s) => s.kind === "megalith");
  const lipSites = sites.filter((s) => s.kind === "lip");

  // The wind's yaw for the rake knob: a blade's bow points along local +z.
  const windYaw = Math.atan2(WIND_X, WIND_Z);

  // ── T1: the grass tiers. ──
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.grassNear,
      palette: GRASS_PALETTE,
      area: discArea(205),
      gate: grassGate(sites, 0.38, 0.6),
      ground: seabedHeight,
      count: 7500,
      profile: "blade",
      size: [0.5, 1.05],
      swayAmp: 0.05,
      sunGlow: true,
      looseShare: 0.42,
    }),
    "blue1-fill-grass-near",
  );
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.grassMid,
      palette: GRASS_MID_PALETTE,
      area: discArea(212),
      gate: grassGate(sites, 0.22, 0.55),
      ground: seabedHeight,
      count: 9000,
      profile: "tuft",
      size: [0.32, 0.66],
      swayAmp: 0.035,
      looseShare: 0.5,
    }),
    "blue1-fill-grass-mid",
  );
  keep(
    buildFarGrassCards({
      seed: SEED ^ FILL_SEEDS.grassFar,
      palette: { base: 0x74c4ac, shade: 0x3f7a68 },
      area: discArea(222),
      gate: grassGate(sites, 0.3, 0.5),
      ground: seabedHeight,
      // 10,000 cards = 40k triangles (the piece's own budget note).
      count: 10000,
      size: [0.3, 0.62],
      nearFade: 14,
    }),
    "blue1-fill-grass-far",
  );

  // ── The wind-combed crest beds: raked runs on the crests… ──
  keep(
    buildCarpetField({
      seed: SEED ^ FILL_SEEDS.crestGrass,
      palette: CREST_PALETTE,
      area: discArea(205),
      gate: (x, z) => crestWeight(x, z) * steppeBase(x, z) * restFree(x, z),
      ground: seabedHeight,
      count: 1600,
      profile: "blade",
      size: [0.6, 1.2],
      rake: { yaw: windYaw, strength: 0.75 },
      swayAmp: 0.06,
      sunGlow: true,
      looseShare: 0.35,
    }),
    "blue1-fill-crest-grass",
  );
  // …and pale gravel pooled in the lees behind them.
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.crestLee,
      palette: { base: 0xa9b8c4, shade: 0x6e6886 },
      area: discArea(205),
      gate: (x, z) => leeWeight(x, z, WIND_X, WIND_Z) * steppeBase(x, z) * restFree(x, z),
      ground: seabedHeight,
      count: 900,
      shapeSet: "gravel",
      size: [0.05, 0.16],
      grade: 0.5,
    }),
    "blue1-fill-crest-lee",
  );

  // ── The slope's shoulder gravel runs (the road itself stays clean). ──
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.slopeGravel,
      palette: { base: 0x9aa9b2, accent: 0xa9b6c0, shade: 0x686279 },
      area: slopeArea(64, 298, 34),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        if (u < 60 || u > 300 || Math.abs(v) > tongueHalfWidth(u) - 2) {
          return 0;
        }
        return 0.55 * channelClear(u, v) * restFree(x, z);
      },
      ground: seabedHeight,
      count: 1500,
      shapeSet: "gravel",
      size: [0.05, 0.17],
      grade: 0.45,
      twoTone: true,
    }),
    "blue1-fill-slope-gravel",
  );

  // ── The megalith collars: graded gravel aprons at every stone's foot. ──
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.collarAprons,
      palette: { base: 0x93a6b6, shade: 0x635f7e },
      area: { polyline: spinePolyline(), width: 320 },
      gate: (x, z) => {
        let apron = 0;
        for (const site of collarEligible) {
          if (site.kind === "stump") {
            continue;
          }
          const d = Math.hypot(x - site.x, z - site.z);
          if (d < site.radius * 0.9) {
            return 0;
          }
          apron = Math.max(
            apron,
            1 - smoothstep01((d - site.radius * 1.2) / (site.radius * 1.6)),
          );
        }
        return apron * restFree(x, z);
      },
      ground: seabedHeight,
      count: 2000,
      shapeSet: "gravel",
      size: [0.05, 0.18],
      grade: 0.65,
    }),
    "blue1-fill-collar-aprons",
  );

  // Calf-stones ringing the stones, plus the terrace-edge overlook cairn.
  const calves = buildCalves(collarEligible);
  named["blue1-fill-calves"] = calves;
  nodes.push(calves);

  // Whelk trios at the stone feet and along the terrace lips.
  const whelks = buildCollarWhelks([...collarSites, ...lipSites]);
  named["blue1-fill-whelks"] = whelks;
  nodes.push(whelks);

  // Stone-skirt blennies: two tiny perchers per megalith collar.
  keep(
    buildPercherColony({
      seed: SEED ^ FILL_SEEDS.blennies,
      palette: { base: 0x9db6c6, tip: 0xc8dce4, shade: 0x5f6a8e },
      anchors: megalithSites.map((site) => {
        const a = seatAround(site, 1.5, FILL_SEEDS.blennies);
        return { pos: [a.x, seabedHeight(a.x, a.z) + 0.04, a.z] as const };
      }),
      perAnchor: 2,
      body: "blenny",
      motion: "seated",
    }),
    "blue1-fill-blennies",
  );

  // ── The terraces: scree tongues down every shelf lip. ──
  keep(
    buildScreeApron({
      seed: SEED ^ FILL_SEEDS.scree,
      palette: { base: 0x7e93aa, shade: 0x5a5878 },
      ground: seabedHeight,
      anchors: screeAnchors(),
      slabsPerAnchor: 9,
    }),
    "blue1-fill-scree",
  );

  // The deep star variant: cobalt-violet cushions below the grass line.
  const deepStars = buildDeepStars();
  named["blue1-fill-deep-stars"] = deepStars;
  nodes.push(deepStars);

  // ── Life: grass-fry pods at three named haunts. ──
  const pods = buildPercherColony({
    seed: SEED ^ FILL_SEEDS.fryPods,
    palette: { base: 0x9fd4c4, tip: 0xc9ecd9, shade: 0x54806e },
    anchors: fryAnchors(),
    perAnchor: 9,
    body: "fry",
    motion: "hover",
  });
  keep(pods, "blue1-fill-fry-pods");

  // The outrider thread: the migration's promise, crossing the glide high.
  keep(
    buildShoalRunner({
      seed: SEED ^ FILL_SEEDS.outriders,
      route: { stations: outriderStations(), closed: true },
      count: 30,
      fish: { scale: 1.35, color: 0xe2f2f6, emissive: 0x4a7a92, profile: "fusilier" },
      phaseSpeed: 0.02,
      braid: { lateral: 0.8, vertical: 0.4 },
      // No glint: on a loop this tight the static thread rendered as one
      // hot white ribbon on the shoulder (round-1 slope-glide) — the fish
      // themselves carry the crossing at the glide's range.
    }),
    "blue1-fill-outriders",
  );

  // ── The gate's last-reef bed: warm rubble dying out by u ≈ 74… ──
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.gateRubble,
      palette: { base: 0xa8886a, accent: 0xb5977a, shade: 0x74586a },
      area: slopeArea(50, 78, 26),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        if (u < 50 || Math.abs(v) > tongueHalfWidth(u) - 1) {
          return 0;
        }
        const die = 1 - smoothstep01((u - 62) / 12);
        const offLane = smoothstep01((Math.abs(v - slopeChannelCenter(u)) - 2.5) / 2);
        return die * offLane;
      },
      ground: seabedHeight,
      count: 340,
      shapeSet: "pebble",
      size: [0.06, 0.2],
      grade: 0.5,
      twoTone: true,
    }),
    "blue1-fill-gate-rubble",
  );
  // …with the last warm growths — the reef's colour falling away, literal.
  keep(
    buildBushBank({
      seed: SEED ^ FILL_SEEDS.gateBushes,
      palette: { base: 0x9a6a58, tip: 0xc48a6a, shade: 0x6a4658, accent: 0xd49a66 },
      area: (() => {
        const { x, z } = worldOf(61, 0);
        return { center: [x, z] as [number, number], radius: 15 };
      })(),
      gate: (x, z) => {
        const { u, v } = spokeOf(x, z);
        const offLane = smoothstep01((Math.abs(v - slopeChannelCenter(u)) - 3.5) / 2);
        return offLane * (1 - smoothstep01((u - 66) / 8));
      },
      ground: seabedHeight,
      count: 5,
      lobes: 6,
      fronds: 7,
      accents: 5,
    }),
    "blue1-fill-gate-bushes",
  );

  // ── The Wayline's worn grit line (the region's one drawn road). ──
  keep(
    buildGroundLitter({
      seed: SEED ^ FILL_SEEDS.waylineGrit,
      palette: { base: 0xb0bcc6, shade: 0x6e6886 },
      area: {
        polyline: [
          [455, 10],
          [492, 6],
          [526, 2],
          [538, 3],
        ].map(([u, v]) => {
          const { x, z } = worldOf(u!, v!);
          return [x, z] as [number, number];
        }),
        width: 3,
      },
      gate: (x, z) => restFree(x, z),
      ground: seabedHeight,
      count: 380,
      shapeSet: "grit",
      size: [0.03, 0.09],
    }),
    "blue1-fill-wayline-grit",
  );

  // ── Grass seeds: the wind made visible, drifting off the crests. ──
  keep(
    buildParticulateField({
      seed: SEED ^ FILL_SEEDS.grassSeeds,
      tint: 0xe6e0c0,
      count: 46,
      mode: "drift",
      volume: (() => {
        const { x, z } = worldOf(420, 10);
        return { center: [x, -11, z] as const, size: [220, 10, 160] as const };
      })(),
      size: 0.06,
      opacity: 0.5,
      bias: { dir: [WIND_X, 0.05, WIND_Z], speed: 0.35 },
    }),
    "blue1-fill-grass-seeds",
  );

  return {
    nodes,
    named,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}

// ─── Placement helpers ───────────────────────────────────────────────────────

/** The spine road as one polyline: slope mouth → steppe → the lip. */
function spinePolyline(): [number, number][] {
  const polyline: [number, number][] = [];
  for (let u = 80; u <= 540; u += 24) {
    const { x, z } = worldOf(u, u < 300 ? slopeChannelCenter(u) : 0);
    polyline.push([x, z]);
  }
  return polyline;
}

/** One deterministic seat on a site's ring — for percher anchors. */
function seatAround(
  site: Blue1StoneSite,
  reach: number,
  salt: number,
): { x: number; z: number } {
  const random = new Random(
    SEED ^ salt ^ (Math.round(site.x * 7 + site.z * 13) & 0x7fffffff),
  );
  const angle = random.range(0, Math.PI * 2);
  const d = site.radius * reach + random.range(0.2, 0.9);
  return { x: site.x + Math.cos(angle) * d, z: site.z + Math.sin(angle) * d };
}

/** The calf-stones and the overlook cairn: one instanced draw. */
function buildCalves(sites: readonly Blue1StoneSite[]): InstancedMesh {
  const random = new Random(SEED ^ FILL_SEEDS.calves);
  const geometry = boulderGeometry({ seed: SEED ^ FILL_SEEDS.calves, radius: 1, height: 0.85 });
  const material = createRockMaterial(new Color(STONE_BLUE).lerp(new Color(0xdce6f0), 0.24).getHex());

  const placements: { x: number; z: number; y: number; yaw: number; s: number }[] = [];
  for (const site of sites) {
    if (site.kind === "stump" || site.kind === "lip") {
      continue;
    }
    const per = site.kind === "megalith" ? 3 : 2;
    for (let i = 0; i < per; i++) {
      const angle = random.range(0, Math.PI * 2);
      const d = site.radius * random.range(1.7, 2.8);
      const x = site.x + Math.cos(angle) * d;
      const z = site.z + Math.sin(angle) * d;
      if (restFree(x, z) < 0.5) {
        continue;
      }
      const s = site.radius * random.range(0.24, 0.44);
      placements.push({
        x,
        z,
        y: seabedHeight(x, z) - s * 0.3,
        yaw: random.range(0, Math.PI * 2),
        s,
      });
    }
  }
  // The overlook cairn at (508, −30): a small stack marking where the
  // first shelf drops — three stones shrinking upward.
  const cairnAt = worldOf(508, -30);
  const cairnY = seabedHeight(cairnAt.x, cairnAt.z);
  let rise = -0.1;
  for (const s of [0.55, 0.4, 0.28]) {
    placements.push({
      x: cairnAt.x + random.signed(0.08),
      z: cairnAt.z + random.signed(0.08),
      y: cairnY + rise,
      yaw: random.range(0, Math.PI * 2),
      s,
    });
    rise += s * 0.72;
  }

  const mesh = new InstancedMesh(geometry, material, placements.length);
  mesh.name = "blue1-fill-calves";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const dummy = new Object3D();
  for (const [i, p] of placements.entries()) {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.setScalar(p.s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** Whelk trios at the stone feet: the fill's own stream, the pilot's shell. */
function buildCollarWhelks(sites: readonly Blue1StoneSite[]): InstancedMesh {
  const random = new Random(SEED ^ FILL_SEEDS.collarWhelks);
  const geometry = whelkGeometry();
  const material = createWhelkMaterial();
  const placements: { x: number; z: number }[] = [];
  for (const site of sites) {
    const per = 2 + (random.next() < 0.4 ? 1 : 0);
    for (let i = 0; i < per; i++) {
      const angle = random.range(0, Math.PI * 2);
      const d = site.radius * random.range(1.3, 2.3);
      const x = site.x + Math.cos(angle) * d;
      const z = site.z + Math.sin(angle) * d;
      if (restFree(x, z) < 0.5) {
        continue;
      }
      placements.push({ x, z });
    }
  }
  const mesh = new InstancedMesh(geometry, material, placements.length);
  mesh.name = "blue1-fill-whelks";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const dummy = new Object3D();
  const tint = new Color();
  for (const [i, p] of placements.entries()) {
    dummy.position.set(p.x, seabedHeight(p.x, p.z) + 0.03, p.z);
    dummy.rotation.set(random.signed(0.3), random.range(0, Math.PI * 2), random.signed(0.3));
    dummy.scale.setScalar(random.range(0.8, 1.4));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setScalar(random.range(0.85, 1.12));
    mesh.setColorAt(i, tint);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/** The deep star variant: violet-cobalt cushions on the shelves. */
function buildDeepStars(): InstancedMesh {
  const random = new Random(SEED ^ FILL_SEEDS.deepStars);
  const geometry = starGeometry();
  const material = createWhelkMaterial();
  const count = 16;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "blue1-fill-deep-stars";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const palette = [0x4a5f9e, 0x6a5f9e, 0x3f6f8e];
  const dummy = new Object3D();
  const tint = new Color();
  let placed = 0;
  let guard = 0;
  while (placed < count && guard++ < 600) {
    const step = TERRACE_STEPS[Math.floor(random.next() * TERRACE_STEPS.length)]!;
    const u = 445 + step.s + random.range(2, 22);
    const v = random.signed(120);
    const { x, z } = worldOf(u, v);
    const floor = blue1TerrainTarget(x, z);
    if (floor > -19.5 || dropWeight(u - 445, v) > 0.05 || restFree(x, z) < 0.5) {
      continue;
    }
    dummy.position.set(x, seabedHeight(x, z) + 0.02, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(random.range(1.0, 1.8));
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    tint.setHex(palette[placed % palette.length]!).multiplyScalar(random.range(0.9, 1.15));
    mesh.setColorAt(placed, tint);
    placed++;
  }
  dummy.position.set(0, -300, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = placed; i < count; i++) {
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

function createWhelkMaterial() {
  return createToonMaterial({ vertexColors: true });
}

/** The scree anchors: four tongues down each of the three shelf lips. */
function screeAnchors(): ScreeAnchor[] {
  const dir = worldOf(1, 0);
  const facing = Math.atan2(dir.z, dir.x);
  const anchors: ScreeAnchor[] = [];
  for (const step of TERRACE_STEPS) {
    for (const v of [-96, -38, 34, 92]) {
      const { x, z } = worldOf(445 + step.s + 1, v);
      anchors.push({ pos: [x, z], facing, spread: 7 });
    }
  }
  return anchors;
}

/** The fry pods' six anchors: two per named grass haunt. */
function fryAnchors(): { pos: readonly [number, number, number] }[] {
  const haunts: [number, number][] = [
    [412, 30],
    [418, 36],
    [452, 88],
    [458, 82],
    [338, -44],
    [344, -40],
  ];
  return haunts.map(([u, v]) => {
    const { x, z } = worldOf(u, v);
    return { pos: [x, seabedHeight(x, z) + 1.7, z] as const };
  });
}

/** The outrider loop: a small closed circuit crossing the glide at u ≈ 150. */
function outriderStations(): (readonly [number, number, number])[] {
  const spec: [number, number, number][] = [
    [150, -28, -6.5],
    [130, -4, -7.5],
    [150, 26, -6],
    [170, 4, -8],
  ];
  return spec.map(([u, v, y]) => {
    const { x, z } = worldOf(u, v);
    return [x, y, z] as const;
  });
}
