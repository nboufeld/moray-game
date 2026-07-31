import { Group } from "three";
import { Random, SEEDS } from "../util/Random";
import { buildShoalRunner, type ShoalRunnerBuild } from "./regions/kit/ShoalRunner";
import { wingById } from "./wings/WingRegistry";
import type { WingDef } from "./wings/WingTypes";
import { seabedHeight } from "./Seabed";

/**
 * Connective-3 (MASTER Batch 3, connective plan §5): the traveller-shoal
 * network's WING LEGS — one route per province, commuting bowl rim ↔
 * gateway wing ↔ doorway on a seeded timetable, so every gateway road is
 * periodically alive and the shoals are wayfinding (follow the fish,
 * find the province). The vale/region legs are the regions' own (R3):
 * golden-waste-1's traveller picks this leg up at the Honey Gate (its
 * ledger: "the loop leaves the doorway at u 52 — the wing's own leg is
 * the connective worker's, and the two agree at the door"), verdant-1's
 * vale runner at the cathedral door, and each dark province's road shoal
 * likewise.
 *
 * Placement contract (the connective-2 finding, restated): `shoalRunner`
 * needs `frustumCulled = false` on its fish mesh, which MASTER R2 forbids
 * INSIDE a wing — so these legs are BOWL content, mounted by `Reef`
 * beside the wing flora and paid from the bowl budget, never from any
 * wing's R2 ceiling. Measured cost: 8 draws (5 fish ribbons + 3 glint
 * threads), ~19k triangles resident — recorded in the connective-3
 * ledger's program arithmetic.
 *
 * Seeds: `SEEDS.wingGates ^ <fresh route salt>` fed to kit-private
 * Randoms — the stream connective-1 registered for shared gate machinery
 * and left deliberately unused. Nothing existing consumes it, so the
 * reroll fence is structural. Every route's period is drawn from its own
 * substream (3–5 minutes), so two provinces never sync (§5).
 *
 * Saturation check (§5, MASTER §1.2's world row — THIS lane's check):
 * one route per province, never two shoals on a road at once, and every
 * route stays inside the bowl-and-wing shell (r ≤ ~47.5), hundreds of
 * metres from every registered rest. `tests/travellerShoals.test.ts`
 * asserts it against the registry's nearest-rest bounds.
 */

export interface TravellerRouteSpec {
  /** The province the route serves — the ledger's name for it. */
  readonly id: string;
  readonly wingId: string;
  /** Fresh substream salt off `SEEDS.wingGates` (grep-unique). */
  readonly salt: number;
  /** One shoal-light per province (MASTER §1.1). */
  readonly fish: {
    readonly scale: number;
    readonly color: number;
    readonly emissive?: number;
    readonly profile: "fusilier" | "tetra" | "fry";
  };
  readonly count: number;
  /** Loop period bounds in seconds; the exact period is seeded. */
  readonly period: readonly [number, number];
  readonly braid: { readonly lateral: number; readonly vertical: number };
  readonly glint?: { readonly count: number; readonly size: number };
  /** Metres over the local ground the route rides inside the wing. */
  readonly lift: number;
}

/**
 * The five routes, verdant first (it completes the game's only
 * two-region journey). Palettes per MASTER §1.1's shoal-light row:
 * silver-green, gold, pearl-white, ember-dark with warm bellies, and
 * calamity's sparse grey file — fewer, slower, melancholy.
 */
export const TRAVELLER_ROUTES: readonly TravellerRouteSpec[] = [
  {
    id: "verdant",
    wingId: "kelp-cathedral",
    salt: 0x7a01,
    // r2: a step larger and lighter — silver-green at 0.82 vanished into
    // the bowl's own greens at the route poses' range.
    fish: { scale: 0.88, color: 0xc2e2b6, profile: "fusilier" },
    count: 56,
    period: [200, 260],
    braid: { lateral: 0.34, vertical: 0.22 },
    glint: { count: 22, size: 0.11 },
    lift: 2.5,
  },
  {
    id: "golden",
    wingId: "sandfall-dunes",
    salt: 0x7a02,
    // The Hourglass traveller's own species (GoldenLife), so the two
    // legs read as one commute meeting at the Honey Gate.
    fish: { scale: 0.82, color: 0xf2da9a, emissive: 0x9a7a30, profile: "fusilier" },
    count: 44,
    period: [220, 280],
    braid: { lateral: 0.4, vertical: 0.24 },
    glint: { count: 20, size: 0.12 },
    lift: 2.4,
  },
  {
    id: "pale",
    wingId: "ghost-reef",
    salt: 0x7a03,
    // Pearl-white with a faint floor so the milk never eats the file.
    fish: { scale: 0.8, color: 0xeef2ea, emissive: 0x3c3e3a, profile: "tetra" },
    count: 44,
    period: [190, 250],
    braid: { lateral: 0.32, vertical: 0.2 },
    glint: { count: 16, size: 0.1 },
    lift: 2.4,
  },
  {
    id: "smoking",
    wingId: "vent-springs",
    salt: 0x7a04,
    // Ember-dark, warm-bellied: the body sits dark against the amber
    // light from below, the emissive holds the warm underside.
    fish: { scale: 0.84, color: 0x5a4038, emissive: 0x7a3a1a, profile: "fusilier" },
    count: 40,
    period: [210, 270],
    braid: { lateral: 0.36, vertical: 0.26 },
    lift: 2.6,
  },
  {
    id: "calamity",
    wingId: "ruins-terrace",
    salt: 0x7a05,
    // The sparse grey file: fewer, slower, no sparkle — melancholy.
    fish: { scale: 0.9, color: 0x9aa0a4, profile: "fusilier" },
    count: 16,
    period: [300, 345],
    braid: { lateral: 0.24, vertical: 0.16 },
    lift: 2.8,
  },
];

/** Reduced motion slows the commute to the kelp's becalmed ratio. */
const REDUCED_RATE = 0.45;

/**
 * A route's polyline: a small loop at the bowl rim near the gateway,
 * out through the gate and down the wing's swim corridor to the
 * doorway, a turn just inside the door (r ≈ 47.2 — the region leg
 * takes over past the sill), and home along the other shoulder. All
 * stations ride the local ground, so the file climbs the sill and
 * sinks to the wing floor the way a diver does.
 */
export function travellerStations(
  def: WingDef,
  lift: number,
): (readonly [number, number, number])[] {
  const axisX = Math.cos(def.azimuth);
  const axisZ = Math.sin(def.azimuth);
  const perpX = -axisZ;
  const perpZ = axisX;
  const seat = (r: number, lateral: number, extraLift = 0): readonly [number, number, number] => {
    const x = axisX * r + perpX * lateral;
    const z = axisZ * r + perpZ * lateral;
    return [x, seabedHeight(x, z) + lift + extraLift, z] as const;
  };
  return [
    // The bowl loop: breathed-through rim doorways (§5's bowl end).
    seat(23.5, 3.6, 0.4),
    seat(26.5, 1.8, 0.2),
    // Over the rim's shoulder: the ridge climbs from r 26 to its crest,
    // and a station ON it keeps the interpolated path riding the ground.
    seat(28.8, 1.2, 0.2),
    // The gate: through the rim's notch on the wing's own axis.
    seat(31.2, 0.8),
    // Out along one shoulder of the corridor…
    seat(35.5, 0.8),
    seat(39.5, 0.7),
    seat(43.5, 0.6),
    // …the turn at the doorway (the region leg's handshake point)…
    seat(47.2, 0),
    // …and home along the other.
    seat(43.5, -0.6),
    seat(39.5, -0.7),
    seat(35.5, -0.8),
    seat(31.2, -0.8),
    seat(28.8, -1.2, 0.2),
    seat(26.5, -1.8, 0.2),
    seat(23.5, -3.6, 0.4),
    // The rim-side close of the loop, swinging wide of the doorway.
    seat(21.8, 0, 0.7),
  ];
}

export interface TravellerRoute {
  readonly spec: TravellerRouteSpec;
  readonly stations: readonly (readonly [number, number, number])[];
  readonly phaseSpeed: number;
  readonly build: ShoalRunnerBuild;
}

export class TravellerShoals {
  readonly group = new Group();
  readonly routes: TravellerRoute[] = [];
  private time = 0;

  constructor() {
    this.group.name = "traveller-shoals";
    for (const spec of TRAVELLER_ROUTES) {
      const def = wingById(spec.wingId);
      const stations = travellerStations(def, spec.lift);
      // The timetable: drawn from the route's own substream, so a fish
      // retune can never shift a departure and no two provinces sync.
      const clock = new Random((SEEDS.wingGates ^ spec.salt ^ 0xc10c) >>> 0);
      const period = clock.range(spec.period[0], spec.period[1]);
      const phaseSpeed = 1 / period;
      const build = buildShoalRunner({
        seed: (SEEDS.wingGates ^ spec.salt) >>> 0,
        route: { stations, closed: true },
        count: spec.count,
        fish: spec.fish,
        phaseSpeed,
        braid: spec.braid,
        ...(spec.glint ? { glint: spec.glint } : {}),
      });
      this.group.add(build.group);
      this.routes.push({ spec, stations, phaseSpeed, build });
    }
  }

  /** Forwarded from `Reef.update`; closed-form off simulated seconds. */
  update(dt: number, reducedMotion: boolean): void {
    this.time += dt * (reducedMotion ? REDUCED_RATE : 1);
    for (const route of this.routes) {
      route.build.update(this.time);
    }
  }

  /**
   * QA door (capture harness only): pins the shared traveller clock so the
   * named route sits at `phase` of its loop. The clock is wall-time off page
   * boot, which on a loaded capture box varies by MINUTES — more than any
   * route's whole period — so a pose that frames less than the entire loop
   * is a phase lottery without this. Everything downstream is a closed form
   * of the pinned time (the kit's determinism law), so the pin is exact.
   */
  pinPhase(routeId: string, phase: number): void {
    const route = this.routes.find((candidate) => candidate.spec.id === routeId);
    if (!route) {
      throw new Error(`no traveller route '${routeId}'`);
    }
    this.time = phase / route.phaseSpeed;
    for (const each of this.routes) {
      each.build.update(this.time);
    }
  }
}
