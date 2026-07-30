import {
  BufferAttribute,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { buildGlowColony } from "../kit/GlowColony";
import { buildPercherColony } from "../kit/PercherColony";
import { buildShoalRunner } from "../kit/ShoalRunner";
import type { KitBuild } from "../kit/KitTypes";
import type { KelpFoot } from "./VerdantKelp";
import { smoothstep01 } from "./VerdantShared";
import {
  ERRATIC,
  FILL_SEEDS,
  GROTTO_MOUTH,
  WRECK_AT,
  faunaFree,
} from "./VerdantFillShared";
import {
  ROOT_MAZE,
  mazeWeight,
  valeChannelCenter,
  worldOf,
} from "./VerdantTerrain";

/**
 * The fill's T4 ambient life (fill plan §5) — life as a SYSTEM riding the
 * roads, not decor:
 *
 * - **the vale runner** (45, kit `shoalRunner`): commutes the approach
 *   channel on a closed loop u 62–185 with a glint thread — the guide the
 *   road never had. The loop ENDS below the narrows on purpose: MASTER
 *   §1.2 holds the shadow passage u 190–250 at "motes only", so the plan's
 *   "full channel u 60–280" is trimmed to the registry (ruling R10 —
 *   stillness beats cadence; deviation logged in the ledger). Life leads
 *   the diver in, goes quiet through the shadow, and the meadow shimmer
 *   picks the thread up past the lip.
 * - **the brooding shoal** (30): slow and low through the maze gullies.
 * - **the far shoal** (20): circling the Falling Edge's leaning pair.
 * - **drifter jellies** (8): violet-rose, 6–9 m over the meadows — the one
 *   warm accent the mid-water gets.
 * - **the meadow crab colony** (12, kit `percherColony`, dart) around the
 *   erratic's skirt; **bark-percher fry** (10 trunks × 5, hover).
 * - **glow-polyp colonies** (14 × 8, kit `glowColony`): the maze's OWN
 *   light — plus the wreck's glow moss, the grotto lantern pair and the
 *   vale gate's jamb moss. Warm green-gold; never cold (MASTER §1.1 — only
 *   Calamity burns cold).
 *
 * Fresh `FILL_SEEDS.*` streams throughout (the fence); every placement
 * multiplies {@link faunaFree}, so no colony and no route touches the
 * Sunwell bowl, the narrows, the crest or the shelf pocket.
 */

const SEED = SEEDS.regionVerdant1;

export interface VerdantFillLifeBuild {
  readonly groups: Group[];
  readonly meshes: InstancedMesh[];
  /** The vale runner's stations, exported for the clearance test. */
  readonly valeRunnerStations: readonly (readonly [number, number, number])[];
  update(timeSec: number): void;
}

/**
 * The vale runner's loop, as data: out along one side of the channel's
 * spine, home along the other. The lateral offset stays 2.2 m so the wall
 * boulders (at vc ± 4.6–7) and the wall rows (at vc ± half+9) keep real
 * clearance — the region test samples this loop against every collider.
 * Exported so the test and the build read one truth.
 */
export function valeRunnerStations(): [number, number, number][] {
  const stations: [number, number, number][] = [];
  for (let u = 64; u <= 184; u += 15) {
    const { x, z } = worldOf(u, valeChannelCenter(u) - 2.2);
    stations.push([x, seabedHeight(x, z) + 2.3, z]);
  }
  for (let u = 184; u >= 64; u -= 15) {
    const { x, z } = worldOf(u, valeChannelCenter(u) + 2.2);
    stations.push([x, seabedHeight(x, z) + 3.1, z]);
  }
  return stations;
}

export function buildVerdantFillLife(giants: readonly KelpFoot[]): VerdantFillLifeBuild {
  const groups: Group[] = [];
  const meshes: InstancedMesh[] = [];
  const updaters: ((timeSec: number) => void)[] = [];
  const keep = (build: KitBuild & { update?(timeSec: number): void }): void => {
    groups.push(build.group);
    if (build.update) {
      const update = build.update.bind(build);
      updaters.push(update);
    }
  };

  // ─── The vale runner ─────────────────────────────────────────────────────
  const runnerStations = valeRunnerStations();
  const runner = buildShoalRunner({
    seed: SEED ^ FILL_SEEDS.valeRunner,
    route: { stations: runnerStations, closed: true },
    count: 45,
    fish: { scale: 0.78, color: 0xbfe3d2, emissive: 0x2e5548, profile: "fusilier" },
    phaseSpeed: 0.011,
    braid: { lateral: 0.3, vertical: 0.24 },
    glint: { count: 24, size: 0.13 },
  });
  keep(runner);

  // ─── The brooding shoal ──────────────────────────────────────────────────
  // Slow and low through the maze's gullies, the dark quarter's pulse.
  const broodingStations: [number, number, number][] = [];
  for (const [du, dv, lift] of [
    [-26, 8, 2.2],
    [-10, 28, 2.8],
    [14, 22, 2.4],
    [30, 2, 3.0],
    [18, -20, 2.2],
    [-4, -34, 2.6],
    [-24, -18, 2.4],
  ] as const) {
    const { x, z } = worldOf(ROOT_MAZE.u + du, ROOT_MAZE.v + dv);
    broodingStations.push([x, seabedHeight(x, z) + lift, z]);
  }
  keep(
    buildShoalRunner({
      seed: SEED ^ FILL_SEEDS.broodingShoal,
      route: { stations: broodingStations, closed: true },
      count: 30,
      fish: { scale: 0.85, color: 0x9fb8a8, profile: "tetra" },
      phaseSpeed: 0.006,
      braid: { lateral: 0.4, vertical: 0.2 },
    }),
  );

  // ─── The far shoal ───────────────────────────────────────────────────────
  // Twenty pale fish circling the leaning pair at the Falling Edge.
  const farStations: [number, number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const { x, z } = worldOf(
      598 + Math.cos(angle) * 15,
      16.5 + Math.sin(angle) * 12,
    );
    farStations.push([x, seabedHeight(x, z) + 3.6 + Math.sin(angle * 2) * 1.2, z]);
  }
  keep(
    buildShoalRunner({
      seed: SEED ^ FILL_SEEDS.farShoal,
      route: { stations: farStations, closed: true },
      count: 20,
      fish: { scale: 0.7, color: 0xd8e8d8, profile: "fry" },
      phaseSpeed: 0.014,
    }),
  );

  // ─── The drifter jellies ─────────────────────────────────────────────────
  const jellies = buildJellies();
  meshes.push(jellies.mesh);
  updaters.push(jellies.update);

  // ─── The meadow crab colony ──────────────────────────────────────────────
  const crabAnchors: { pos: readonly [number, number, number] }[] = [];
  const crabRandom = new Random(SEED ^ FILL_SEEDS.crabs ^ 0x0a);
  for (let i = 0; i < 4; i++) {
    const u = ERRATIC.u + crabRandom.signed(9);
    const v = ERRATIC.v + crabRandom.signed(9);
    const { x, z } = worldOf(u, v);
    if (faunaFree(x, z) < 0.5) {
      continue;
    }
    crabAnchors.push({ pos: [x, seabedHeight(x, z) + 0.03, z] });
  }
  keep(
    buildPercherColony({
      seed: SEED ^ FILL_SEEDS.crabs,
      palette: { base: 0xb08a68, tip: 0xd8b088, shade: 0x7a5c4a },
      anchors: crabAnchors,
      perAnchor: 3,
      body: crabGeometry(),
      motion: "dart",
    }),
  );

  // ─── The bark-percher fry ────────────────────────────────────────────────
  // Ten trunks carry a hover cluster each: small life on the columns.
  const fryRandom = new Random(SEED ^ FILL_SEEDS.barkPerchers ^ 0x0a);
  const fryAnchors: { pos: readonly [number, number, number] }[] = [];
  const stride = Math.max(1, Math.floor(giants.length / 10));
  for (let i = 0; i < giants.length && fryAnchors.length < 10; i += stride) {
    const giant = giants[i]!;
    if (faunaFree(giant.x, giant.z) < 0.5) {
      continue;
    }
    const foot = seabedHeight(giant.x, giant.z);
    fryAnchors.push({
      pos: [
        giant.x + fryRandom.signed(0.5),
        foot + giant.height * fryRandom.range(0.2, 0.45),
        giant.z + fryRandom.signed(0.5),
      ],
    });
  }
  keep(
    buildPercherColony({
      seed: SEED ^ FILL_SEEDS.barkPerchers,
      palette: { base: 0x9fc06a, tip: 0xcfe090, shade: 0x5f7a48 },
      anchors: fryAnchors,
      perAnchor: 5,
      body: "fry",
      motion: "hover",
    }),
  );

  // ─── The glow colonies — the maze's own light ────────────────────────────
  // Warm green-gold foxfire on the gully rock: doctrine rule 4's answer
  // for the earned dark. Fourteen colonies of eight buds, gully-biased.
  const glowRandom = new Random(SEED ^ FILL_SEEDS.glowMaze ^ 0x0a);
  const glowAnchors: [number, number, number][] = [];
  let guard = 0;
  while (glowAnchors.length < 14 && guard++ < 300) {
    const angle = glowRandom.range(0, Math.PI * 2);
    const spread = 8 + Math.sqrt(glowRandom.next()) * 42;
    const u = ROOT_MAZE.u + Math.cos(angle) * spread;
    const v = ROOT_MAZE.v + Math.sin(angle) * spread;
    if (mazeWeight(u, v) < 0.35) {
      continue;
    }
    const { x, z } = worldOf(u, v);
    if (faunaFree(x, z) < 0.5) {
      continue;
    }
    const floor = seabedHeight(x, z);
    // The deeper the gully, the more welcome the light.
    if (floor > -17.5 && glowRandom.next() < 0.5) {
      continue;
    }
    glowAnchors.push([x, floor, z]);
  }
  keep(
    buildGlowColony({
      seed: SEED ^ FILL_SEEDS.glowMaze,
      tint: 0xb8e57c,
      anchors: glowAnchors,
      budsPerAnchor: 8,
      glow: 0.34,
    }),
  );

  // The accents: glow moss along the wreck's keel and the grotto's
  // lantern pair — the two warm points the deep edge is composed around.
  const accentAnchors: [number, number, number][] = [];
  for (const [du, dv] of [
    [-2.4, -0.6],
    [1.8, 1.0],
    [3.6, -1.4],
  ] as const) {
    const { x, z } = worldOf(WRECK_AT.u + du, WRECK_AT.v + dv);
    accentAnchors.push([x, seabedHeight(x, z) + 0.15, z]);
  }
  for (const side of [-1, 1]) {
    const { x, z } = worldOf(GROTTO_MOUTH.u + side * 2.2, GROTTO_MOUTH.v + 0.8);
    accentAnchors.push([x, seabedHeight(x, z) + 0.1, z]);
  }
  keep(
    buildGlowColony({
      seed: SEED ^ FILL_SEEDS.glowAccents,
      tint: 0xd8cc7a,
      anchors: accentAnchors,
      budsPerAnchor: 5,
      glow: 0.3,
    }),
  );

  // The vale gate's jamb moss: the doorway glows the diver in.
  const jambAnchors: [number, number, number][] = [];
  for (const [u, v] of [
    [55, -6.2],
    [57, 6.6],
  ] as const) {
    const { x, z } = worldOf(u, v);
    jambAnchors.push([x, seabedHeight(x, z) + 0.1, z]);
  }
  keep(
    buildGlowColony({
      seed: SEED ^ FILL_SEEDS.glowJambs,
      tint: 0x9fdf8a,
      anchors: jambAnchors,
      budsPerAnchor: 6,
      glow: 0.28,
    }),
  );

  return {
    groups,
    meshes,
    valeRunnerStations: runnerStations,
    update(timeSec: number): void {
      for (const update of updaters) {
        update(timeSec);
      }
    },
  };
}

// ─── The drifter jellies ─────────────────────────────────────────────────────

/** A soft bell with four trailing strands, ~120 tris, painted value-first:
 *  a bright violet-rose crown over a deeper skirt — the darkest part of
 *  the animal is a colour. */
function jellyGeometry(): BufferGeometry {
  const bell = new SphereGeometry(0.3, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.58);
  bell.scale(1, 0.78, 1);
  const parts: BufferGeometry[] = [bell];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const strand = new PlaneGeometry(0.045, 0.5, 1, 3);
    strand.translate(0, -0.26, 0);
    const position = strand.attributes.position!;
    for (let k = 0; k < position.count; k++) {
      // A gentle authored sway in the rest pose, so strands never hang
      // as dead straight tape.
      const t = -position.getY(k) / 0.5;
      position.setX(k, position.getX(k) + Math.sin(t * 4 + angle) * 0.04);
    }
    strand.rotateY(angle);
    strand.translate(Math.cos(angle) * 0.14, 0, Math.sin(angle) * 0.14);
    parts.push(strand);
  }
  const merged = mergeGeometries(
    parts.map((part) => (part.index ? part.toNonIndexed() : part)),
    false,
  );
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("verdant jelly parts could not be merged");
  }
  smoothNormals(merged);

  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const crown = new Color(0xdba8c8);
  const skirt = new Color(0x8a5a80);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = smoothstep01((position.getY(i) + 0.5) / 0.75);
    shade.copy(skirt).lerp(crown, t);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  return merged;
}

function buildJellies(): {
  mesh: InstancedMesh;
  update: (timeSec: number) => void;
} {
  const random = new Random(SEED ^ FILL_SEEDS.jellies);
  const count = 8;
  const geometry = jellyGeometry();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x40284a,
    emissiveIntensity: 0.4,
  });
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "verdant-drifter-jellies";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);

  const homes: { x: number; y: number; z: number; phase: number; scale: number }[] = [];
  const tint = new Color();
  let placedGuard = 0;
  while (homes.length < count && placedGuard++ < 120) {
    const u = random.range(300, 396);
    const v = random.signed(64);
    const { x, z } = worldOf(u, v);
    if (faunaFree(x, z) < 0.5) {
      continue;
    }
    homes.push({
      x,
      y: seabedHeight(x, z) + random.range(6, 9),
      z,
      phase: random.range(0, Math.PI * 2),
      scale: random.range(0.8, 1.3),
    });
    tint.setRGB(1, 1, 1).multiplyScalar(random.range(0.85, 1.1));
    mesh.setColorAt(homes.length - 1, tint);
  }
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  const dummy = new Object3D();
  const update = (timeSec: number): void => {
    for (const [i, home] of homes.entries()) {
      const pulse = 1 + Math.sin(timeSec * 1.1 + home.phase) * 0.12;
      dummy.position.set(
        home.x + Math.sin(timeSec * 0.07 + home.phase) * 3.2,
        home.y + Math.sin(timeSec * 0.16 + home.phase * 1.7) * 1.1,
        home.z + Math.cos(timeSec * 0.06 + home.phase) * 3.2,
      );
      dummy.rotation.set(
        Math.sin(timeSec * 0.2 + home.phase) * 0.14,
        home.phase,
        Math.cos(timeSec * 0.17 + home.phase) * 0.14,
      );
      dummy.scale.set(home.scale / Math.sqrt(pulse), home.scale * pulse, home.scale / Math.sqrt(pulse));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  mesh.computeBoundingSphere();
  return { mesh, update };
}

// ─── The crab body — region geometry fed to the kit (MASTER R8) ─────────────

/** A flattened, fringed carapace with two claw nubs, ~60 tris. */
function crabGeometry(): BufferGeometry {
  const shell = new SphereGeometry(0.075, 7, 4);
  shell.scale(1.25, 0.5, 1);
  const parts: BufferGeometry[] = [shell];
  for (const side of [-1, 1]) {
    const claw = new SphereGeometry(0.026, 4, 3);
    claw.scale(1.5, 0.8, 1);
    claw.translate(0.08 * side, -0.008, 0.075);
    parts.push(claw);
  }
  const merged = mergeGeometries(
    parts.map((part) => (part.index ? part.toNonIndexed() : part)),
    false,
  );
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("verdant crab parts could not be merged");
  }
  smoothNormals(merged);

  // Top-lift paint: the carapace crown catches the light, the fringe and
  // claws sit a value lower and warmer.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = smoothstep01((position.getY(i) + 0.02) / 0.06);
    const value = 0.66 + t * 0.42;
    colors[i * 3] = Math.min(1, value * 1.04);
    colors[i * 3 + 1] = Math.min(1, value * 0.94);
    colors[i * 3 + 2] = Math.min(1, value * 0.82);
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  return merged;
}
