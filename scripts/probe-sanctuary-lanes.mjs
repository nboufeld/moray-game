/**
 * W6 / W-O2: the sanctuary chimera gate, re-run for nine residents.
 *
 *   npx vite-node scripts/probe-sanctuary-lanes.mjs
 *
 * The W-N3 stagger rules (height, turn, phase, direction) are necessary and
 * provably not sufficient: W-O2's zebra/dragon chimera formed inside the
 * rules, because a chimera is a *screen-space* event — two animals
 * near-parallel and near-touching in the frame, whatever their world
 * heights. With wave 8 the rules are also arithmetic-capped (nine phases
 * cannot sit 0.8 rad apart on a circle), so this probe is the acceptance.
 *
 * ## What it measures
 *
 * For each resident set it builds the real `SanctuaryScene`, sims a 90 s
 * visit at 30 Hz (long enough to cover the camera's whole swing, with the
 * first 40 s reported separately — that is the window the canonical settles
 * land in, W-O2's own), and per frame projects every resident's root and
 * body polyline (head plus every body-chain joint) through the sweeping
 * camera to the canonical 1600×900 frame. A pair is flagged while:
 *
 * - the animals' root screen positions are under 70 px apart, AND
 * - their *travel* runs the same direction — the tangent is the animal's
 *   screen-space velocity, so anti-parallel passes (dot < 0) and angled
 *   crossings (dot ≈ 0) are the praised depth-crossings and stay legal.
 *
 * Two diagnostics ride along (never gated): full body polylines under 70 px
 * near-parallel (dot > 0.9), and a head under 70 px of the other body with
 * aligned travel — both count many legal crossings, which is why the roots
 * reading is the gate.
 *
 * ## How the gate is calibrated, honestly
 *
 * W-O2's own script did not survive (the wave's scratch-file convention),
 * so this is a re-creation, and it does not reuse W-O2's absolute 2 s bar:
 * on this instrument the *shipped* five-lane table — the table the critic
 * accepted at both canonical settles — measures ≈2.5 s in the first 40 s
 * with a 2.2 s worst run (the zebra×dragon flicker W-O2 documented as
 * "sub-second flickers"). The gate is therefore relative to that table,
 * measured in the same run on the same instrument:
 *
 *   PASS iff  candidate.total40 ≤ shipped.total40 + 1.5 s
 *         AND candidate.worstRun ≤ shipped.worstRun + 0.5 s
 *
 * `LANES_SPECIES=id,id` restricts the resident set (calibration/debugging);
 * gating is skipped then.
 */
import { Vector3 } from "three";
import { MORAY_SPECIES } from "../src/creatures/morays/MoraySpeciesConfig";
import { SanctuaryScene } from "../src/sanctuary/SanctuaryScene";

const WIDTH = 1600;
const HEIGHT = 900;
const ADJACENT_PX = 70;
const STEP = 1 / 30;
const SECONDS = 90;
const W1 = 40; // W-O2's window: the canonical settles live inside it.
/** Gate margins over the shipped table's own readings, in seconds. */
const TOTAL_MARGIN = 1.5;
const RUN_MARGIN = 0.5;

const sanctuary = new SanctuaryScene();
sanctuary.resize(WIDTH, HEIGHT);
const camera = sanctuary.camera;
const world = new Vector3();

/** The resident's body polyline in screen pixels this frame, or null if any
 * of it crosses behind the camera plane (projection mirrors there). */
function screenPolyline(chain) {
  const points = [];
  const positions = [chain.moray.getHeadWorldPosition(world).clone()];
  for (const joint of chain.joints) {
    positions.push(joint.getWorldPosition(new Vector3()));
  }
  for (const p of positions) {
    const cam = p.clone().applyMatrix4(camera.matrixWorldInverse);
    if (cam.z >= 0) {
      return null;
    }
    const ndc = p.clone().project(camera);
    points.push([(ndc.x * 0.5 + 0.5) * WIDTH, (0.5 - ndc.y * 0.5) * HEIGHT]);
  }
  return points;
}

/** Closest approach of two 2D segments, and the parameter along each. */
function segmentDistance(a0, a1, b0, b1) {
  const dA = [a1[0] - a0[0], a1[1] - a0[1]];
  const dB = [b1[0] - b0[0], b1[1] - b0[1]];
  const r = [a0[0] - b0[0], a0[1] - b0[1]];
  const a = dA[0] * dA[0] + dA[1] * dA[1];
  const e = dB[0] * dB[0] + dB[1] * dB[1];
  const b = dA[0] * dB[0] + dA[1] * dB[1];
  const c = dA[0] * r[0] + dA[1] * r[1];
  const f = dB[0] * r[0] + dB[1] * r[1];
  const denom = a * e - b * b;
  let s = denom > 1e-9 ? (b * f - c * e) / denom : 0;
  s = Math.min(1, Math.max(0, s));
  let t = e > 1e-9 ? (b * s + f) / e : 0;
  if (t < 0) {
    t = 0;
    s = a > 1e-9 ? -c / a : 0;
  } else if (t > 1) {
    t = 1;
    s = a > 1e-9 ? (b - c) / a : 0;
  }
  s = Math.min(1, Math.max(0, s));
  const pA = [a0[0] + dA[0] * s, a0[1] + dA[1] * s];
  const pB = [b0[0] + dB[0] * t, b0[1] + dB[1] * t];
  return Math.hypot(pA[0] - pB[0], pA[1] - pB[1]);
}

/** Min distance between two polylines, with the unit body tangent dot at
 * the closest points (the parallel-bodies diagnostic). */
function polylinesClosest(pa, pb) {
  let best = null;
  for (let i = 0; i < pa.length - 1; i++) {
    for (let j = 0; j < pb.length - 1; j++) {
      const distance = segmentDistance(pa[i], pa[i + 1], pb[j], pb[j + 1]);
      if (!best || distance < best.distance) {
        const tA = [pa[i + 1][0] - pa[i][0], pa[i + 1][1] - pa[i][1]];
        const tB = [pb[j + 1][0] - pb[j][0], pb[j + 1][1] - pb[j][1]];
        const lenA = Math.hypot(tA[0], tA[1]);
        const lenB = Math.hypot(tB[0], tB[1]);
        const dot = lenA < 1e-6 || lenB < 1e-6 ? 0 : (tA[0] * tB[0] + tA[1] * tB[1]) / (lenA * lenB);
        best = { distance, dot };
      }
    }
  }
  return best;
}

/** Min distance from a point to a polyline (the head-to-flank diagnostic). */
function pointToPolyline(p, poly) {
  let best = Infinity;
  for (let j = 0; j < poly.length - 1; j++) {
    best = Math.min(best, segmentDistance(p, p, poly[j], poly[j + 1]));
  }
  return best;
}

/** Sims one visit for the given species set (taking lanes in order) and
 * returns per-pair and total same-direction adjacency seconds. */
function simulate(species) {
  sanctuary.setSpecies(species);
  const residents = sanctuary.residents;
  const chains = residents.map((resident) => {
    const joints = [];
    let joint = resident.moray.asset.bodyRoot.children[0];
    while (joint) {
      joints.push(joint);
      joint = joint.children[0];
    }
    return { id: resident.moray.asset.speciesId, moray: resident.moray, joints, px: null, velocity: null, screen: null };
  });

  const counters = () => ({ a40: 0, a90: 0, worst: 0, run: 0 });
  const pairs = [];
  for (let a = 0; a < chains.length; a++) {
    for (let b = a + 1; b < chains.length; b++) {
      pairs.push({
        name: `${chains[a].id} × ${chains[b].id}`,
        a,
        b,
        roots: counters(),
        body: counters(),
        head: counters(),
        minPx: Infinity,
      });
    }
  }

  const frames = Math.round(SECONDS / STEP);
  for (let frame = 0; frame < frames; frame++) {
    const t = frame * STEP;
    sanctuary.update(STEP, false);
    camera.updateMatrixWorld();
    for (const chain of chains) {
      chain.moray.asset.root.updateMatrixWorld(true);
      chain.screen = screenPolyline(chain);
      // The tangent: this frame's travel on screen, from the root's own
      // positions — a reversed lane's velocity flips with it, which is what
      // makes nose-to-tail passes legal.
      const root = chain.moray.asset.root.position;
      const ndc = root.clone().project(camera);
      const px = [(ndc.x * 0.5 + 0.5) * WIDTH, (0.5 - ndc.y * 0.5) * HEIGHT];
      chain.velocity = chain.px ? [px[0] - chain.px[0], px[1] - chain.px[1]] : null;
      chain.px = px;
    }
    for (const pair of pairs) {
      const ca = chains[pair.a];
      const cb = chains[pair.b];
      if (!ca.screen || !cb.screen || !ca.velocity || !cb.velocity) {
        pair.roots.run = 0;
        pair.body.run = 0;
        pair.head.run = 0;
        continue;
      }
      const closest = polylinesClosest(ca.screen, cb.screen);
      pair.minPx = Math.min(pair.minPx, closest.distance);
      const speedA = Math.hypot(ca.velocity[0], ca.velocity[1]);
      const speedB = Math.hypot(cb.velocity[0], cb.velocity[1]);
      const travelDot =
        speedA < 1e-6 || speedB < 1e-6
          ? 0
          : (ca.velocity[0] * cb.velocity[0] + ca.velocity[1] * cb.velocity[1]) / (speedA * speedB);
      const rootDistance = Math.hypot(ca.px[0] - cb.px[0], ca.px[1] - cb.px[1]);
      const headDistance = Math.min(
        pointToPolyline(ca.screen[0], cb.screen),
        pointToPolyline(cb.screen[0], ca.screen),
      );
      const flags = {
        roots: rootDistance < ADJACENT_PX && travelDot > 0,
        body: closest.distance < ADJACENT_PX && closest.dot > 0.9,
        head: headDistance < ADJACENT_PX && travelDot > 0,
      };
      for (const key of Object.keys(flags)) {
        const counter = pair[key];
        if (flags[key]) {
          counter.run += STEP;
          counter.a90 += STEP;
          if (t < W1) {
            counter.a40 += STEP;
          }
          counter.worst = Math.max(counter.worst, counter.run);
        } else {
          counter.run = 0;
        }
      }
    }
  }

  let worstRun = 0;
  for (const pair of pairs) {
    worstRun = Math.max(worstRun, pair.roots.worst);
  }
  return { pairs, worstRun };
}

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
function report(label, species, result) {
  console.log(
    `\n${label}: ${species.length} residents, viewport ${WIDTH}×${HEIGHT}, threshold ${ADJACENT_PX}px, dt 1/30, visit ${SECONDS}s`,
  );
  console.log(
    `${pad("pair", 52)}${pad("roots 40/90s", 16)}${pad("worst run", 12)}${pad("body>0.9 40/90s", 18)}${pad("head 40/90s", 16)}closest`,
  );
  const totals = { roots: [0, 0], body: [0, 0], head: [0, 0] };
  const pairs = [...result.pairs].sort(
    (x, y) => y.roots.a90 + y.body.a90 + y.head.a90 - (x.roots.a90 + x.body.a90 + x.head.a90),
  );
  for (const pair of pairs) {
    for (const key of Object.keys(totals)) {
      totals[key][0] += pair[key].a40;
      totals[key][1] += pair[key].a90;
    }
    if (pair.roots.a90 + pair.body.a90 + pair.head.a90 < 0.05) {
      continue;
    }
    console.log(
      pad(pair.name, 52) +
        pad(`${pair.roots.a40.toFixed(2)}/${pair.roots.a90.toFixed(2)}`, 16) +
        pad(`${pair.roots.worst.toFixed(2)}s`, 12) +
        pad(`${pair.body.a40.toFixed(2)}/${pair.body.a90.toFixed(2)}`, 18) +
        pad(`${pair.head.a40.toFixed(2)}/${pair.head.a90.toFixed(2)}`, 16) +
        (pair.minPx === Infinity ? "—" : `${pair.minPx.toFixed(0)}px`),
    );
  }
  console.log(
    `TOTAL roots: ${totals.roots[0].toFixed(2)}s (0-40s), ${totals.roots[1].toFixed(2)}s (0-90s); ` +
      `body: ${totals.body[0].toFixed(2)}/${totals.body[1].toFixed(2)}s; head: ${totals.head[0].toFixed(2)}/${totals.head[1].toFixed(2)}s; ` +
      `worst run ${result.worstRun.toFixed(2)}s`,
  );
  return { total40: totals.roots[0], total90: totals.roots[1], worstRun: result.worstRun };
}

const wanted = process.env.LANES_SPECIES?.split(",");
if (wanted) {
  const species = MORAY_SPECIES.filter((s) => wanted.includes(s.id));
  report("selected residents", species, simulate(species));
} else {
  const shipped = report("shipped five-lane table (calibration)", MORAY_SPECIES.slice(0, 5), simulate(MORAY_SPECIES.slice(0, 5)));
  const candidate = report("wave-8 nine-lane table", MORAY_SPECIES, simulate(MORAY_SPECIES));
  console.log(
    `\ngate: total40 ${candidate.total40.toFixed(2)}s ≤ shipped ${shipped.total40.toFixed(2)}s + ${TOTAL_MARGIN}s ` +
      `AND worst run ${candidate.worstRun.toFixed(2)}s ≤ shipped ${shipped.worstRun.toFixed(2)}s + ${RUN_MARGIN}s`,
  );
  const pass =
    candidate.total40 <= shipped.total40 + TOTAL_MARGIN && candidate.worstRun <= shipped.worstRun + RUN_MARGIN;
  console.log(pass ? "PASS — no chimera beyond the shipped table's own accepted shape" : "FAIL");
  process.exit(pass ? 0 : 1);
}
