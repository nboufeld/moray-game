import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  CubicBezierCurve3,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { wedgeHalfAt, wingCeiling } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import {
  instantiate,
  signedWingAngle,
  softSprite,
  taperedTube,
  tuftGeometry,
  wingFrame,
  wingPoint,
  worldMerge,
  type PlacedPart,
} from "./W4FloraKit";

/**
 * Wing 10 — the Mangrove Roots. Intimacy and shelter: the shallowest,
 * lowest-ceilinged wing, a maze of prop-root columns holding a low warm
 * roof over amber water. The game's blanket fort.
 *
 * The roots are the whole gesture, and they are drawn, not scattered: six
 * clusters alternate down the sides of the wedge, each a crown just past
 * the ceiling that lets seven tapered arcs fall outward into the sand —
 * thick where they leave the crown, narrowing to the ankle that enters the
 * sediment, the way a mangrove's prop roots actually stand. One merged
 * draw for all forty-two, the wood's own gradient baked per vertex (warm
 * at the crown, damp at the foot), so the material stays one flat warm
 * umber and the form does the shading.
 *
 * Around them: root-knee stumps poking out of the sand between the
 * clusters, small warm-tinted tufts at the feet, and — the wing's only
 * light story — amber dapple: a handful of soft warm quads hanging high
 * between the roots, additive and far under the bloom threshold, so the
 * low roof has sun coming through it. Their shimmer is the wing's one
 * animation, and it dims rather than stops under reduced motion.
 *
 * The fences, all checked by `tests/wingsW4Flora.test.ts`:
 *
 * - The swim path winds but stays generous: r 30–46, |across| < 0.05 rad
 *   holds no solid geometry at all — clusters stand off-axis and every
 *   root arcs *away* from the lane, and the gate stretch (r < 34) keeps
 *   nothing but the high crowns' scenery.
 * - Everything — crown, arc, foot, stump — stays inside the wedge and the
 *   carve's radial envelope.
 *
 * Four draws, ~6k triangles. Seeds: only `SEEDS.wingMangroveRoots` and `^`
 * substreams. Roots join no colliders (scenery, per the scaffold's flag
 * option) — noted in the ledger.
 */

/** The wood: one warm umber; the baked gradient supplies the modelling. */
const WOOD_TINT = 0x7a6750;
/**
 * Crown and foot values of that gradient, as multipliers on the tint.
 * The crown warms and the foot cools (red still first) so the columns
 * separate by hue as well as value — as flat multipliers the roots read
 * as one dark silhouette against the bright water.
 */
const CROWN_VALUE: readonly [number, number, number] = [1.08, 0.98, 0.78];
const FOOT_VALUE: readonly [number, number, number] = [0.6, 0.55, 0.53];

/** Warm undergrowth hues — the path's edges, not its floor. */
const TUFT_HUES = [0x9c8a52, 0x8a7c46, 0xa7963f] as const;

/** The dapple's amber and its level, far under the bloom pass's 0.82. */
const DAPPLE_COLOR = 0xffc98a;
const DAPPLE_OPACITY = 0.12;

/** Corridor law: the winding lane down the axis, |across| 0.05 rad. */
const CORRIDOR_ANGLE = 0.05;

interface ClusterSpec {
  readonly r: number;
  readonly side: -1 | 1;
}

/**
 * The five clusters, alternating sides so the path winds between them. They
 * begin past the doorway: the wedge is only ±0.115 rad at the gate, and a
 * cluster that arcs a metre outward only fits where the walls have opened.
 */
const CLUSTERS: readonly ClusterSpec[] = [
  { r: 39.5, side: -1 },
  { r: 41.5, side: 1 },
  { r: 43.2, side: -1 },
  { r: 44.8, side: 1 },
  { r: 46.2, side: -1 },
];

export function buildMangroveRootsFlora(def: WingDef): WingFlora {
  const random = new Random(SEEDS[def.seedKey]);
  const frame = wingFrame(def);
  const group = new Group();
  group.name = "mangrove-roots-flora";
  const contacts: ContactPatch[] = [];

  const woodMaterial = createToonMaterial({ color: WOOD_TINT, vertexColors: true });

  // ── The prop-root columns. ──
  const roots: BufferGeometry[] = [];
  for (const cluster of CLUSTERS) {
    // The cluster's stand is measured off the wedge at its own radius: the
    // crown hugs the lane's edge, and the roots' outward reach is whatever
    // the walls leave, capped so no ankle ever enters the rock.
    const maxLateral = Math.tan(wedgeHalfAt(def, cluster.r) - 0.02) * cluster.r;
    const lateral = cluster.side * (CORRIDOR_ANGLE * cluster.r + 1.8);
    const maxReach = Math.max(0.6, Math.min(1.5, maxLateral - Math.abs(lateral) - 0.4));
    const { x: cx, z: cz } = wingPoint(frame, cluster.r, lateral);
    const crownY = wingCeiling(def, cx, cz) + random.range(0.2, 1.0);
    // Outward is away from the lane — the roots lean off the path, never over it.
    const outX = frame.perpX * cluster.side;
    const outZ = frame.perpZ * cluster.side;

    for (let root = 0; root < 7; root++) {
      const fan = random.signed(0.55);
      const reach = random.range(0.5, maxReach);
      const along = random.signed(1.4);
      const thick = random.range(0.6, 1.0);
      const tone = random.range(0.9, 1.05);
      // The fan turns the outward direction, so feet spread fore and aft of
      // the crown along the wing — where the wedge has room to give.
      const cos = Math.cos(fan);
      const sin = Math.sin(fan);
      const dirX = outX * cos - outZ * sin;
      const dirZ = outX * sin + outZ * cos;

      // In wing coordinates the fanned direction lands the foot `reach`
      // metres outward of the crown and bends it fore or aft along the wing.
      const footR = cluster.r + along - cluster.side * sin * reach;
      const footLat = lateral + cluster.side * cos * reach;
      const { x: fx, z: fz } = wingPoint(frame, footR, footLat);
      const footY = seabedHeight(fx, fz) - 0.3;

      const curve = new CubicBezierCurve3(
        new Vector3(cx, crownY, cz),
        new Vector3(cx + dirX * reach * 0.25, crownY - 2.4, cz + dirZ * reach * 0.25),
        new Vector3(fx - dirX * reach * 0.35, footY + 2.0, fz - dirZ * reach * 0.35),
        new Vector3(fx, footY, fz),
      );
      roots.push(
        taperedTube(
          curve,
          9,
          6,
          (t) => 0.3 * (1 - t) * (0.6 + 0.4 * thick) + 0.08,
          (t) => mixValue(CROWN_VALUE, FOOT_VALUE, Math.pow(t, 0.8), tone),
        ),
      );
    }
    contacts.push({ x: cx, z: cz, radius: 2.0, strength: 0.35 });
  }

  const rootMesh = new Mesh(worldMerge(roots, "mangrove roots"), woodMaterial);
  rootMesh.name = "w4-mangrove-roots";
  rootMesh.castShadow = false;
  rootMesh.receiveShadow = true;
  group.add(rootMesh);

  // ── The root-knee stumps between the clusters. ──
  const kneeGeometry = taperedTube(
    new CubicBezierCurve3(
      new Vector3(0, -0.15, 0),
      new Vector3(0.06, 0.18, 0),
      new Vector3(0.16, 0.3, 0),
      new Vector3(0.3, 0.34, 0.02),
    ),
    5,
    5,
    (t) => 0.09 - 0.04 * t,
    (t) => mixValue(CROWN_VALUE, FOOT_VALUE, 0.4 + 0.6 * t, 1),
  );
  const kneeParts: PlacedPart[] = [];
  const kneeColor = new Color();
  for (let i = 0; i < 22; i++) {
    const r = random.range(34.5, 45.5);
    const side = random.next() < 0.5 ? -1 : 1;
    const lateral = side * random.range(CORRIDOR_ANGLE * r + 0.7, CORRIDOR_ANGLE * r + 3.4);
    if (!insideWedge(def, frame, r, lateral, 0.45)) {
      continue;
    }
    const { x, z } = wingPoint(frame, r, lateral);
    const scale = random.range(0.8, 1.6);
    kneeParts.push({
      x,
      y: seabedHeight(x, z) - 0.05,
      z,
      rotation: [0, random.range(0, Math.PI * 2), random.signed(0.12)],
      scale: [scale, scale, scale],
      color: kneeColor.setScalar(random.range(0.9, 1.05)).clone(),
    });
  }
  group.add(instantiate(kneeGeometry, woodMaterial, kneeParts, "w4-mangrove-stumps"));

  // ── The amber dapple, high between the roots. ──
  const dappleQuads: BufferGeometry[] = [];
  for (let i = 0; i < 15; i++) {
    const r = random.range(34, 46);
    const lateral = random.signed(wedgeHalfAt(def, r) * r * 0.55);
    const { x, z } = wingPoint(frame, r, lateral);
    const quad = new PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2 + random.signed(0.2));
    quad.rotateY(random.range(0, Math.PI * 2));
    const size = random.range(0.5, 1.3);
    quad.scale(size, size, size);
    quad.translate(x, random.range(4.4, 5.6), z);
    dappleQuads.push(quad);
  }
  const dappleMaterial = new MeshBasicMaterial({
    map: softSprite(),
    color: DAPPLE_COLOR,
    transparent: true,
    opacity: DAPPLE_OPACITY,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  const dapple = new Mesh(worldMerge(dappleQuads, "mangrove dapple"), dappleMaterial);
  dapple.name = "w4-light-mangrove-dapple";
  dapple.renderOrder = 2;
  group.add(dapple);

  // ── The warm tufts at the feet and along the path's edges. ──
  const tuftMaterial = createToonMaterial({ vertexColors: true, side: DoubleSide });
  const tuftParts: PlacedPart[] = [];
  const tuftColor = new Color();
  for (const cluster of CLUSTERS) {
    const centreLat = cluster.side * (CORRIDOR_ANGLE * cluster.r + 2.7);
    for (let i = 0; i < 3; i++) {
      const r = cluster.r + random.signed(1.6);
      const lateral = centreLat + random.signed(1.8);
      if (!keepsCorridor(r, lateral, 0.55) || !insideWedge(def, frame, r, lateral, 0.5)) {
        continue;
      }
      placeTuft(random, frame, r, lateral, tuftParts, tuftColor);
    }
  }
  for (let i = 0; i < 18; i++) {
    const r = random.range(34, 45.5);
    const side = random.next() < 0.5 ? -1 : 1;
    const lateral = side * random.range(CORRIDOR_ANGLE * r + 0.6, CORRIDOR_ANGLE * r + 3.2);
    if (!insideWedge(def, frame, r, lateral, 0.5)) {
      continue;
    }
    placeTuft(random, frame, r, lateral, tuftParts, tuftColor);
  }
  group.add(instantiate(tuftGeometry(), tuftMaterial, tuftParts, "w4-mangrove-tufts"));

  // The wing's one animation: the dapple breathes, slowly.
  let clock = 0;
  const update = (dt: number, reducedMotion: boolean): void => {
    clock += dt * (reducedMotion ? 0.3 : 1);
    dappleMaterial.opacity = DAPPLE_OPACITY * (0.92 + 0.16 * Math.sin(clock * 0.6));
  };

  return { group, contacts, update };
}

/** The corridor: nothing solid inside |across| 0.05 rad of the axis, plus margin. */
function keepsCorridor(r: number, lateral: number, margin: number): boolean {
  if (r < 30 || r > 46) {
    return true;
  }
  return Math.abs(Math.atan2(lateral, r)) >= CORRIDOR_ANGLE + margin / r;
}

/** The wedge: the whole piece, margin included, inside the wing's own walls. */
function insideWedge(
  def: WingDef,
  frame: ReturnType<typeof wingFrame>,
  r: number,
  lateral: number,
  margin: number,
): boolean {
  const { x, z } = wingPoint(frame, r, lateral);
  const away = Math.abs(signedWingAngle(def, x, z));
  return away + margin / r < wedgeHalfAt(def, r) - 0.004;
}

function mixValue(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
  tone: number,
): readonly [number, number, number] {
  const k = Math.min(1, Math.max(0, t));
  return [
    (a[0] + (b[0] - a[0]) * k) * tone,
    (a[1] + (b[1] - a[1]) * k) * tone,
    (a[2] + (b[2] - a[2]) * k) * tone,
  ];
}

function placeTuft(
  random: Random,
  frame: ReturnType<typeof wingFrame>,
  r: number,
  lateral: number,
  parts: PlacedPart[],
  color: Color,
): void {
  const { x, z } = wingPoint(frame, r, lateral);
  const scale = random.range(0.2, 0.36);
  const hue = TUFT_HUES[Math.floor(random.next() * TUFT_HUES.length)] ?? TUFT_HUES[0];
  const tone = random.range(0.85, 1.1);
  parts.push({
    x,
    y: seabedHeight(x, z) - 0.03,
    z,
    rotation: [0, random.range(0, Math.PI * 2), 0],
    scale: [scale, scale * random.range(0.7, 1.1), scale],
    color: color.setHex(hue).multiplyScalar(tone).clone(),
  });
}
