import { describe, expect, it } from "vitest";
import { canyonBlend } from "../src/world/Abyss";
import { seabedHeight } from "../src/world/Seabed";
import { angleBetween } from "../src/world/wings/WingGeometry";
import { WINGS } from "../src/world/wings/WingRegistry";

/**
 * The ground under the game is frozen; the ground between is not.
 *
 * W-L3 lays a couple of metres of fbm hollow-and-swell over the seabed's three
 * sines, which is the octave a smooth analytic surface cannot supply and the
 * reason a flat plane in one shading band read as a render. Everywhere the game
 * is actually *played* it must land at exactly zero: the four crevices are
 * placed to the centimetre against the discovery raycast, the moray heads sit
 * about a metre over the sand, and the spawn line down `x = 0` is flown blind.
 * A hand's width of floor there is a gameplay change wearing an art change's
 * clothes, and no screenshot can tell the two apart.
 *
 * So this is an equality test, not a tolerance one. Two halves, because they
 * fail differently: a table of literals captured from the pre-relief function
 * catches the mask being narrowed or moved, and a dense sweep against a copy of
 * the old formula catches a neighbourhood the table happens not to sample.
 */

/**
 * `seabedHeight` exactly as it stood before the relief was added.
 *
 * Copied rather than imported, obviously — the point is to have a second,
 * independent statement of what the answer has to be. The literal table below
 * guards this copy in turn, so a typo here cannot quietly pass both halves.
 */
function legacySeabedHeight(x: number, z: number): number {
  return (
    0.34 * Math.sin(x * 0.075) * Math.cos(z * 0.065) +
    0.18 * Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.17) +
    0.07 * Math.sin(x * 0.41) * Math.sin(z * 0.35 + 0.6)
  );
}

/**
 * Captured from the implementation as it stood at the `wl1-scaffold` baseline.
 *
 * Written out at full precision: a JavaScript number literal round-trips
 * exactly, so these are the same doubles the old function returned and `toBe`
 * is the right assertion.
 */
const FROZEN: readonly (readonly [number, number, number])[] = [
  // Around the snowflake crevice at (0, 1.5) — and the spawn line runs through
  // it, so this neighbourhood is protected twice over.
  [-4, -2.5, 0.004121213182912319],
  [-4, 1.5, -0.07345532795964953],
  [-4, 5.5, -0.07955077647489861],
  [0, -2.5, 0.1580109891065941],
  [0, 1.5, 0.1678319800719308],
  [0, 5.5, 0.10299214896917147],
  [4, -2.5, 0.2249428968115843],
  [4, 1.5, 0.3167566537798204],
  [4, 5.5, 0.2288556132677932],
  // The ribbon moray at (-13, 6).
  [-17, 2, -0.5241228261246366],
  [-17, 6, -0.4079745937852015],
  [-17, 10, -0.20088205161057926],
  [-13, 2, -0.3803027319921341],
  [-13, 6, -0.32263683725495323],
  [-13, 10, -0.24937660859349278],
  [-9, 2, -0.2431514857313184],
  [-9, 6, -0.21846584300788602],
  [-9, 10, -0.18975686210785764],
  // The zebra moray at (13, 6).
  [9, 2, 0.19777547390296202],
  [9, 6, 0.19327555706934374],
  [9, 10, 0.19595831568952282],
  [13, 2, 0.12429828123013023],
  [13, 6, 0.18051713443425826],
  [13, 10, 0.2843642519347733],
  [17, 2, 0.19837634830849832],
  [17, 6, 0.2271379228432729],
  [17, 10, 0.24540120567835277],
  // The dragon moray at (-6, -9).
  [-10, -13, -0.051769302033544295],
  [-10, -9, -0.22930775904308365],
  [-10, -5, -0.33898524013901254],
  [-6, -13, -0.14715984240297594],
  [-6, -9, -0.0975315969901117],
  [-6, -5, -0.08096507104637626],
  [-2, -13, -0.15616825852517352],
  [-2, -9, -0.007976927743638541],
  [-2, -5, 0.09308135457305075],
  // The spawn corridor, from the crevice back out to the drop-in point.
  [-5, 3, -0.13022591960183735],
  [0, 3, 0.15136922054159307],
  [5, 3, 0.306323751310585],
  [-5, 9, -0.06580432687632151],
  [0, 9, 0.007073771656350108],
  [5, 9, 0.07403371357877708],
  [-5, 15, -0.09504219154825994],
  [0, 15, -0.14396487807786784],
  [5, 15, -0.07244167856099104],
  [-5, 21, -0.14342082560706737],
  [0, 21, -0.15776640238045214],
  [5, 21, -0.040119271093459835],
];

/** The four crevice mouths and the spawn line, as `Seabed` copies them. */
const SPOTS: readonly (readonly [number, number])[] = [
  [0, 1.5],
  [-13, 6],
  [13, 6],
  [-6, -9],
];
const CLEAR_RADIUS = 6;

describe("the seabed's protected neighbourhoods", () => {
  it("returns the pre-relief height exactly, at every captured sample", () => {
    for (const [x, z, expected] of FROZEN) {
      expect(seabedHeight(x, z), `at (${x}, ${z})`).toBe(expected);
    }
  });

  it("agrees with the frozen formula over a dense sweep of every crevice", () => {
    for (const [spotX, spotZ] of SPOTS) {
      // A quarter-metre grid over the whole protected disc, which is far finer
      // than the seabed mesh's own 0.94 m spacing.
      for (let dx = -CLEAR_RADIUS; dx <= CLEAR_RADIUS; dx += 0.25) {
        for (let dz = -CLEAR_RADIUS; dz <= CLEAR_RADIUS; dz += 0.25) {
          if (Math.hypot(dx, dz) > CLEAR_RADIUS) {
            continue;
          }
          const x = spotX + dx;
          const z = spotZ + dz;
          expect(seabedHeight(x, z), `at (${x}, ${z})`).toBe(legacySeabedHeight(x, z));
        }
      }
    }
  });

  it("agrees with the frozen formula the length of the spawn corridor", () => {
    // The e2e swim holds W from (0, 2, 22) to the crevice; the sightline test
    // raycasts every half metre of it. Both are flown blind, so the floor under
    // the whole width of that lane has to be the floor they were tuned on.
    for (let z = 1.5; z <= 24; z += 0.25) {
      for (let x = -CLEAR_RADIUS; x <= CLEAR_RADIUS; x += 0.25) {
        expect(seabedHeight(x, z), `at (${x}, ${z})`).toBe(legacySeabedHeight(x, z));
      }
    }
  });

  it("is the frozen formula plus bounded relief everywhere else", () => {
    // The other half of the contract: a mask that never lets go is a mask that
    // has quietly deleted the feature. Out in the open reef the two differ —
    // and since W-L9 they differ by more than the hand-depth micro relief, so
    // the bound is an *envelope* computed from the same literals the terrain
    // is authored against, copied here like the crevice table above. What it
    // still guarantees: the ground can only move where a feature was declared,
    // and never by more than the feature declares.
    let moved = 0;
    for (let x = -30; x <= 30; x += 1) {
      for (let z = -30; z <= 30; z += 1) {
        const delta = Math.abs(seabedHeight(x, z) - legacySeabedHeight(x, z));
        expect(delta, `at (${x}, ${z})`).toBeLessThanOrEqual(0.1 + macroEnvelope(x, z) + 1e-9);
        if (delta > 0.02) {
          moved++;
        }
      }
    }
    expect(moved).toBeGreaterThan(1000);
  });

  it("raises a rim beyond the playable bowl, and nothing before it", () => {
    // Sampled on rings, clear of the authored features and the protected
    // notch the spawn corridor's mask cuts through the northern rim.
    //
    // Wave 8 restated the crest half of this contract: the rim is mostly
    // doorways now — the canyon's gate plus fifteen wings' — so "there is a
    // ridge out there" is asserted where the ridge still stands, at the
    // midpoint of every stretch of rock between two adjacent gates. The
    // inner ring at r = 24 is untouched wave over wave: inside the bowl the
    // ground is micro relief only, to the same bound as ever.
    let inner = 0;
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      const ix = 24 * Math.cos(theta);
      const iz = 24 * Math.sin(theta);
      if (FEATURES.every((f) => Math.hypot(ix - f.x, iz - f.z) > f.radius)) {
        inner = Math.max(inner, Math.abs(seabedHeight(ix, iz) - legacySeabedHeight(ix, iz)));
      }
    }
    expect(inner).toBeLessThanOrEqual(0.1 + 1e-9);

    // The standing rock between doorways: at every inter-gate midpoint the
    // crest ring still carries a real ridge, metres rather than hands.
    const gates = [CANYON.azimuth, ...WINGS.map((wing) => wing.azimuth % (Math.PI * 2))].sort(
      (a, b) => a - b,
    );
    let crest = 0;
    let count = 0;
    for (let i = 0; i < gates.length; i++) {
      const current = gates[i]!;
      const next = gates[(i + 1) % gates.length]!;
      const span = i + 1 < gates.length ? next - current : next + Math.PI * 2 - current;
      const theta = current + span / 2;
      const cx = 35 * Math.cos(theta);
      const cz = 35 * Math.sin(theta);
      // The corridor's protection notches the rim around x = 0 on the north
      // side; measure the skyline where the mask has let go.
      if (Math.hypot(cx - 0, cz - Math.min(24, Math.max(1.5, cz))) > 10) {
        crest += seabedHeight(cx, cz) - legacySeabedHeight(cx, cz);
        count++;
      }
    }
    expect(count).toBeGreaterThan(12);
    expect(crest / count).toBeGreaterThan(1.8);
  });

  it("stands the shelves and sinks the hollow where they were authored", () => {
    for (const feature of FEATURES) {
      const delta = seabedHeight(feature.x, feature.z) - legacySeabedHeight(feature.x, feature.z);
      if (feature.height > 0) {
        expect(delta, `shelf at (${feature.x}, ${feature.z})`).toBeGreaterThan(
          feature.height * 0.5,
        );
      } else {
        expect(delta, `hollow at (${feature.x}, ${feature.z})`).toBeLessThan(
          feature.height * 0.4,
        );
      }
    }
  });

  // ─── W-M3: the canyon past the rim ─────────────────────────────────────────

  it("cuts the gate's saddle and the twilight floor where they were authored", () => {
    const axis = (r: number): readonly [number, number] => [
      r * Math.cos(CANYON.azimuth),
      r * Math.sin(CANYON.azimuth),
    ];

    // The notch: the rim's metres of ridge become a shallow saddle the diver
    // can swim through — below dune level, nowhere near the old crest.
    const [sx, sz] = axis(33.5);
    const saddle = seabedHeight(sx, sz) - legacySeabedHeight(sx, sz);
    expect(saddle).toBeLessThan(-0.6);
    expect(saddle).toBeGreaterThan(-4);

    // The floor: six to ten metres below dune level, as designed.
    for (const r of [43, 44, 45.5]) {
      const [fx, fz] = axis(r);
      const drop = seabedHeight(fx, fz) - legacySeabedHeight(fx, fz);
      expect(drop, `floor at r=${r}`).toBeLessThan(-6);
      expect(drop, `floor at r=${r}`).toBeGreaterThan(-10);
    }

    // The shelf between them actually descends, monotonically enough to swim.
    let last = seabedHeight(...axis(34));
    for (let r = 35; r <= 44; r += 1) {
      const height = seabedHeight(...axis(r));
      expect(height, `shelf at r=${r}`).toBeLessThan(last + 0.45);
      last = height;
    }
  });

  it("carves nothing at all outside the canyon's wedge", () => {
    // Just past the wedge's angular edge, and just inside/outside its radial
    // envelope, the ground is exactly the bowl's own answer — the same
    // early-return contract the protection mask keeps, one biome over.
    for (const across of [CANYON.wedgeHalf + 0.002, CANYON.wedgeHalf + 0.3, -CANYON.wedgeHalf - 0.002]) {
      for (const r of [31, 36, 42, 48]) {
        const theta = CANYON.azimuth + across;
        const x = r * Math.cos(theta);
        const z = r * Math.sin(theta);
        expect(canyonBlend(x, z), `blend at r=${r}, off-axis ${across.toFixed(3)}`).toBe(0);
      }
    }
    for (const r of [29.4, 50.1, 55]) {
      const x = r * Math.cos(CANYON.azimuth);
      const z = r * Math.sin(CANYON.azimuth);
      expect(canyonBlend(x, z), `blend on-axis at r=${r}`).toBe(0);
    }
  });

  it("keeps the seabed under the swim volume inside the playable box", () => {
    // The diver's floor is y = 0.6 and `Reef` rings the rim with colliders,
    // but those only guard the crest — mid-field features may never climb
    // into the swim volume on their own.
    for (const feature of FEATURES) {
      for (let dx = -feature.radius; dx <= feature.radius; dx += 0.5) {
        for (let dz = -feature.radius; dz <= feature.radius; dz += 0.5) {
          const x = feature.x + dx;
          const z = feature.z + dz;
          if (Math.hypot(x, z) > RIM.from) {
            // The rim's own foot; the collider ring guards it, not this test.
            continue;
          }
          expect(seabedHeight(x, z), `at (${x}, ${z})`).toBeLessThan(2.1);
        }
      }
    }
  });
});

/**
 * The W-L9 terrain features, copied from `TERRAIN_FEATURES` the way the spot
 * table above is copied from `SPOT_PLACEMENTS` — an independent statement of
 * where the ground was allowed to move.
 */
const FEATURES: readonly { x: number; z: number; radius: number; height: number }[] = [
  { x: 4, z: -19, radius: 8, height: 1.25 },
  { x: -19, z: 13, radius: 6, height: 1.05 },
  { x: 13, z: 14, radius: 4.8, height: -0.5 },
];

/** The rim band and its tallest possible skyline, from the same literals. */
const RIM = { from: 26, end: 45, maxHeight: 3.3 + 0.75 + 0.75 * 0.7 + 0.75 * 0.45 + 0.75 * 0.3 };

/**
 * The W-M3 canyon, copied from `Abyss` the way the tables above are copied
 * from their owners: the drawn azimuth (0.78 + 0.0481… × 0.21 from
 * `SEEDS.abyss`), the wedge's half-angle, its radial envelope, and the
 * deepest the floor may drop below the frozen dunes — 8.4 m of authored
 * floor plus 0.3 of detail plus the dunes' own ±0.6 of swing.
 */
const CANYON = {
  azimuth: 0.7901019979873672,
  wedgeHalf: 0.32,
  from: 29.5,
  end: 50,
  maxDrop: 9.5,
};

function macroEnvelope(x: number, z: number): number {
  let bound = 0;
  const r = Math.hypot(x, z);
  if (r > RIM.from && r < RIM.end) {
    bound += RIM.maxHeight;
  }
  for (const feature of FEATURES) {
    if (Math.hypot(x - feature.x, z - feature.z) < feature.radius) {
      bound += Math.abs(feature.height);
    }
  }
  if (r > CANYON.from && r < CANYON.end) {
    const away = Math.abs(Math.atan2(z, x) - CANYON.azimuth);
    if (Math.min(away, Math.PI * 2 - away) < CANYON.wedgeHalf) {
      bound += CANYON.maxDrop;
    }
  }
  // Wave 8: each wing's wedge may carve to its own floor (or lift to it —
  // the shallows rise), plus its authored detail, inside its envelope.
  for (const wing of WINGS) {
    if (r > wing.carve.carveFrom && r < wing.carve.carveEnd) {
      if (angleBetween(Math.atan2(z, x), wing.azimuth) < wing.wedge.endHalf) {
        bound +=
          Math.max(Math.abs(wing.carve.floorDepth), Math.abs(wing.carve.sillDepth)) +
          wing.carve.detailAmplitude;
      }
    }
  }
  return bound;
}
