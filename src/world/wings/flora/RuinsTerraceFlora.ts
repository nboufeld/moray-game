import {
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  TorusGeometry,
  Vector2,
} from "three";
import { createRockMaterial, weatherRock } from "../../RockMaterial";
import { archGeometry, boulderGeometry } from "../../RockShapes";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import {
  instantiate,
  mossFaces,
  placeGeometry,
  signedWingAngle,
  tuftGeometry,
  wingFrame,
  wingPoint,
  worldMerge,
  type PlacedPart,
} from "./W4FloraKit";
import { mountGateVeil } from "./GateVeilMount";

/**
 * Wing 9 — the Ruins Terrace. Ancient majesty, no menace: a terrace of
 * mossed stone that has been sitting in gold-green water for a thousand
 * years, and the Reef Kirin grazing the meadow between the monuments.
 *
 * The composition is a processional way, read from the gate:
 *
 * - **A hero arch spans the swim corridor** (r 35.6) — the reef's own
 *   `archGeometry` idiom, legs 6.6 m apart so the lane passes *through* it:
 *   an opening is an invitation, and here it is the front door of the place.
 * - **A broken twin** stands further out on the east shelf (r 42.5), its
 *   span turned along the axis — the same gesture, older and smaller, which
 *   is what makes the first one read as part of a *place* rather than a prop.
 * - **A colonnade**: three standing column stumps ascending the east side,
 *   the last and tallest at the far edge; three fallen drums and their
 *   capital strewn down the west. Lathed barrels with broken crowns, mossed
 *   on every upward face.
 * - **A half-buried round doorway** (r 44.8) — a worn stone ring tilted
 *   against the sand, the terrace's one piece of pure storybook.
 * - **Moss** everywhere the sun would have touched: a blotch field over the
 *   baked algae tint (`mossFaces`), plus low green tufts at every foot.
 *
 * The fences, all checked by `tests/wingsW4Flora.test.ts`:
 *
 * - The corridor stays swimmable: r 30–46, |across| < 0.06 rad holds nothing
 *   below 2.4 m over the floor (the hero arch's lintel passes *over* it).
 * - The Kirin's meadow stays open: r 38–44 keeps a clear strip at least
 *   4 m wide down the middle of the monuments — everything stands |lateral|
 *   2.6 m or further out there.
 * - The gate stretch (r 31–34) is scenery-only: two low mossy boulders and
 *   nothing taller than a diver's knee.
 *
 * Four draws, ~10k triangles, one shared stone material. Seeds: only
 * `SEEDS.wingRuinsTerrace` and `^` substreams, drawn before anything async.
 */

/** The shared stone: a warm sage-grey, mossed per-vertex rather than tinted. */
const STONE_TINT = 0x99957f;

/** Moss tuft hues — the soft garden greens of a place kept by time. */
const TUFT_HUES = [0x7d9053, 0x8ba05c, 0x6f8a52] as const;

/** Corridor law: the swim lane down the axis, and how far pieces keep off it. */
const CORRIDOR_ANGLE = 0.06;
/** Meadow law: the Kirin's grazing strip inside the monument band. */
const MEADOW_LATERAL = 2.6;

interface MonumentSpec {
  readonly r: number;
  readonly lateral: number;
  readonly yaw: number;
  readonly span: number;
  readonly legHeight: number;
  readonly legRadius: number;
  readonly beamRadius: number;
  readonly rise: number;
  readonly seed: number;
}

export function buildRuinsTerraceFlora(def: WingDef): WingFlora {
  const random = new Random(SEEDS[def.seedKey]);
  const frame = wingFrame(def);
  const group = new Group();
  group.name = "ruins-terrace-flora";
  const contacts: ContactPatch[] = [];

  const stoneMaterial = createRockMaterial(STONE_TINT);
  const seed = SEEDS[def.seedKey];

  // The yaw that turns an arch's span perpendicular to the wing's axis, so
  // the corridor swims *through* it; the yaw that turns it along the axis,
  // so its legs stand fore and aft off the meadow.
  const spanAcrossYaw = Math.atan2(-frame.perpZ, frame.perpX);
  const spanAlongYaw = Math.atan2(-frame.axisZ, frame.axisX);

  const monuments: BufferGeometry[] = [];

  const arches: readonly MonumentSpec[] = [
    {
      // The front door: the corridor threads it, legs 3.3 m off the axis.
      r: 35.6,
      lateral: 0,
      yaw: spanAcrossYaw,
      span: 6.6,
      legHeight: 3.8,
      legRadius: 0.55,
      beamRadius: 0.45,
      rise: 1.4,
      seed: seed ^ 0x1a11,
    },
    {
      // The broken twin on the east shelf, span along the axis of approach.
      r: 42.5,
      lateral: -4.6,
      yaw: spanAlongYaw + 0.15,
      span: 4.4,
      legHeight: 2.8,
      legRadius: 0.48,
      beamRadius: 0.4,
      rise: 1.0,
      seed: seed ^ 0x2b22,
    },
  ];

  for (const spec of arches) {
    const { x, z } = wingPoint(frame, spec.r, spec.lateral);
    const foot = seabedHeight(x, z);
    const geometry = archGeometry({
      seed: spec.seed,
      span: spec.span,
      legHeight: spec.legHeight,
      legRadius: spec.legRadius,
      beamRadius: spec.beamRadius,
      rise: spec.rise,
    });
    mossFaces(geometry, spec.seed ^ 0x50, 1);
    monuments.push(placeGeometry(geometry, spec.yaw, x, foot, z));
    for (const side of [-1, 1]) {
      // Legs lie along the geometry's local x, turned by the same yaw.
      const legX = x + Math.cos(spec.yaw) * side * (spec.span / 2);
      const legZ = z - Math.sin(spec.yaw) * side * (spec.span / 2);
      contacts.push({ x: legX, z: legZ, radius: spec.legRadius * 3, strength: 0.5 });
    }
  }

  // The round doorway: a worn ring, toppled a third of the way over and
  // sunk to its midriff in the sand — half buried, exactly as found.
  const door = { r: 44.8, lateral: 5.0, yaw: spanAlongYaw + 0.7, lean: 0.22 };
  {
    const { x, z } = wingPoint(frame, door.r, door.lateral);
    const foot = seabedHeight(x, z);
    const ring = new TorusGeometry(1.5, 0.42, 10, 28);
    ring.rotateX(door.lean);
    weatherRock(ring, seed ^ 0x3c33, { amount: 0.05 });
    mossFaces(ring, seed ^ 0x3c44, 1);
    monuments.push(placeGeometry(ring, door.yaw, x, foot + 0.6, z));
    contacts.push({ x, z, radius: 1.9, strength: 0.5 });
  }

  // The fallen colonnade's capital, a squared block off the last drum.
  const capital = { r: 43.6, lateral: 5.3 };
  {
    const { x, z } = wingPoint(frame, capital.r, capital.lateral);
    const foot = seabedHeight(x, z);
    const block = boulderGeometry({ seed: seed ^ 0x4d44, radius: 0.9, height: 1.1, amount: 0.12 });
    block.scale(1.25, 0.62, 0.95);
    mossFaces(block, seed ^ 0x4d55, 1);
    monuments.push(placeGeometry(block, random.range(0, Math.PI * 2), x, foot, z));
    contacts.push({ x, z, radius: 1.3, strength: 0.45 });
  }

  const monumentMesh = new Mesh(worldMerge(monuments, "ruins monuments"), stoneMaterial);
  monumentMesh.name = "w4-ruins-monuments";
  monumentMesh.castShadow = true;
  monumentMesh.receiveShadow = true;
  group.add(monumentMesh);

  // ── The drums: one lathed barrel, three standing and three fallen. ──
  const drumGeometry = brokenDrumGeometry(seed ^ 0x5e55);
  const drumParts: PlacedPart[] = [];
  const drumTone = new Color(0xffffff);
  const standing: readonly [number, number, number][] = [
    [37.6, -4.0, 1.4],
    [40.4, -4.6, 0.9],
    [43.2, -4.1, 1.75],
  ];
  for (const [r, lateral, stretch] of standing) {
    const { x, z } = wingPoint(frame, r, lateral);
    const yaw = random.range(0, Math.PI * 2);
    const tone = random.range(0.92, 1.06);
    drumParts.push({
      x,
      y: seabedHeight(x, z) - 0.06,
      z,
      rotation: [0, yaw, 0],
      scale: [1, stretch, 1],
      color: drumTone.clone().multiplyScalar(tone),
    });
    contacts.push({ x, z, radius: 1.1, strength: 0.5 });
  }
  const fallen: readonly [number, number][] = [
    [39.4, 4.3],
    [40.9, 4.7],
    [42.4, 4.4],
  ];
  // Lying drums point their crowns down-terrace, with a sleeper's jitter.
  const fallenYaw = Math.atan2(frame.axisZ, -frame.axisX);
  for (const [r, lateral] of fallen) {
    const { x, z } = wingPoint(frame, r, lateral);
    const yaw = fallenYaw + random.signed(0.22);
    const stretch = random.range(1.2, 1.45);
    const tone = random.range(0.9, 1.05);
    drumParts.push({
      x,
      y: seabedHeight(x, z) + 0.3,
      z,
      rotation: [random.signed(0.08), yaw, Math.PI / 2 + random.signed(0.1)],
      scale: [1, stretch, 1],
      color: drumTone.clone().multiplyScalar(tone),
    });
    contacts.push({ x, z, radius: 1.4, strength: 0.45 });
  }
  const drums = instantiate(drumGeometry, stoneMaterial, drumParts, "w4-ruins-drums");
  // Columns are substantial — the reef's own arch casts, and so do these.
  drums.castShadow = true;
  group.add(drums);

  // ── The moss stones: the gate pair, then a scatter along the way. ──
  const stoneGeometry = boulderGeometry({
    seed: seed ^ 0x6f66,
    radius: 0.42,
    height: 0.5,
    amount: 0.16,
    segments: 9,
    rings: 10,
  });
  mossFaces(stoneGeometry, seed ^ 0x6f77, 1);
  const stoneParts: PlacedPart[] = [];
  const stoneSpots: [number, number][] = [
    [33.4, -3.0],
    [33.6, 3.0],
  ];
  for (let i = 0; i < 10; i++) {
    const r = random.range(34.6, 45.4);
    const side = random.next() < 0.5 ? -1 : 1;
    const lateral = side * random.range(2.9, 5.4);
    stoneSpots.push([r, lateral]);
  }
  for (const [r, lateral] of stoneSpots) {
    if (!keepsCorridor(r, lateral, 0.8) || !keepsMeadow(r, lateral) || !insideWedge(def, frame, r, lateral, 0.7)) {
      continue;
    }
    const { x, z } = wingPoint(frame, r, lateral);
    const scale = random.range(0.7, 1.4);
    const yaw = random.range(0, Math.PI * 2);
    const tone = random.range(0.9, 1.08);
    stoneParts.push({
      x,
      y: seabedHeight(x, z) - 0.05,
      z,
      rotation: [0, yaw, 0],
      scale: [scale, scale * random.range(0.7, 0.9), scale],
      color: drumTone.clone().multiplyScalar(tone),
    });
    contacts.push({ x, z, radius: scale * 0.9, strength: 0.35 });
  }
  group.add(instantiate(stoneGeometry, stoneMaterial, stoneParts, "w4-ruins-stones"));

  // ── The moss itself: low green tufts at every foot and meadow edge. ──
  const tuftMaterial = createToonMaterial({ vertexColors: true, side: DoubleSide });
  const tuftParts: PlacedPart[] = [];
  const tuftColor = new Color();
  const anchors: readonly [number, number][] = [
    // Around the hero arch's feet.
    [35.2, -3.4],
    [36.0, 3.4],
    // Around the colonnade and the fallen drums.
    [38.6, -4.3],
    [40.2, 4.7],
    [42.9, -4.4],
    [43.8, 5.0],
  ];
  for (const [ar, alat] of anchors) {
    const count = 4 + Math.floor(random.next() * 3);
    for (let i = 0; i < count; i++) {
      const r = ar + random.signed(1.0);
      const lateral = alat + random.signed(1.1);
      if (!keepsCorridor(r, lateral, 0.5) || !keepsMeadow(r, lateral) || !insideWedge(def, frame, r, lateral, 0.5)) {
        continue;
      }
      placeTuft(random, frame, r, lateral, tuftParts, tuftColor);
    }
  }
  // The meadow's borders: a low green fringe the Kirin grazes between.
  for (let i = 0; i < 14; i++) {
    const r = random.range(37.8, 44.2);
    const side = random.next() < 0.5 ? -1 : 1;
    const lateral = side * random.range(MEADOW_LATERAL + 0.15, 3.6);
    if (!keepsCorridor(r, lateral, 0.5) || !insideWedge(def, frame, r, lateral, 0.5)) {
      continue;
    }
    placeTuft(random, frame, r, lateral, tuftParts, tuftColor);
  }
  group.add(instantiate(tuftGeometry(), tuftMaterial, tuftParts, "w4-ruins-tufts"));

  // ── The gate veil (connective-1). ──
  // The processional way ends on the Sunken Calamity's promise: grey-violet
  // inks (the march's own distance family) behind the door, a faint COLD
  // column — the one register allowed to burn cold (MASTER §1.1) — and a
  // sparse settling drift of ash-grey motes. The gold of the intact wing
  // against the grey beyond IS the story. Appended after every existing
  // draw, on its own `^` substream.
  const veil = mountGateVeil(def, {
    width: 7,
    height: 5.5,
    palette: [0x2f2b38, 0x4a4656, 0x635f70],
    column: { tint: 0xaebccc, opacity: 0.08 },
    particulate: { tint: 0xb8bcc4, count: 60 },
  });
  group.add(veil.group);

  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      veil.update(dt, reducedMotion);
    },
  };
}

/** The corridor: nothing inside |across| 0.06 rad of the axis, plus the piece's own margin. */
function keepsCorridor(r: number, lateral: number, margin: number): boolean {
  if (r < 30 || r > 46) {
    return true;
  }
  return Math.abs(Math.atan2(lateral, r)) >= CORRIDOR_ANGLE + margin / r;
}

/** The Kirin's meadow: inside the monument band, everything stands off the middle. */
function keepsMeadow(r: number, lateral: number): boolean {
  if (r < 38 || r > 44) {
    return true;
  }
  return Math.abs(lateral) >= MEADOW_LATERAL;
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

function placeTuft(
  random: Random,
  frame: ReturnType<typeof wingFrame>,
  r: number,
  lateral: number,
  parts: PlacedPart[],
  color: Color,
): void {
  const { x, z } = wingPoint(frame, r, lateral);
  const scale = random.range(0.22, 0.4);
  const yaw = random.range(0, Math.PI * 2);
  const hue = TUFT_HUES[Math.floor(random.next() * TUFT_HUES.length)] ?? TUFT_HUES[0];
  const tone = random.range(0.85, 1.1);
  parts.push({
    x,
    y: seabedHeight(x, z) - 0.03,
    z,
    rotation: [0, yaw, 0],
    scale: [scale, scale * random.range(0.7, 1.1), scale],
    color: color.setHex(hue).multiplyScalar(tone).clone(),
  });
}

/**
 * One column drum: a lathed barrel with a broken crown. The break is a
 * noise field read off the top ring's direction, so the jagged edge is
 * closed and shared vertices agree — the same argument `roughLathe` makes.
 * Weathered and mossed like every stone on the terrace.
 */
function brokenDrumGeometry(seed: number): BufferGeometry {
  const profile: Vector2[] = [
    new Vector2(0, -0.3),
    new Vector2(0.42, -0.3),
    new Vector2(0.45, -0.1),
    new Vector2(0.47, 0.4),
    new Vector2(0.45, 0.9),
    new Vector2(0.44, 1.3),
    new Vector2(0.4, 1.55),
    new Vector2(0, 1.55),
  ];
  const geometry = new LatheGeometry(profile, 12);
  const position = geometry.attributes.position;
  if (position) {
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      if (y <= 1.1) {
        continue;
      }
      const u = Math.atan2(position.getZ(i), position.getX(i)) / (Math.PI * 2) + 0.5;
      const jag = fbm(u, 0.5, { seed: seed ^ 0x77, period: 3, octaves: 2 });
      position.setY(i, y - jag * 0.5 * ((y - 1.1) / 0.45));
    }
    position.needsUpdate = true;
  }
  weatherRock(geometry, seed, { amount: 0.05 });
  mossFaces(geometry, seed ^ 0x88, 1);
  return geometry;
}
