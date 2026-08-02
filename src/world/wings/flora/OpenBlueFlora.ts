import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import { slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import {
  SoftRingBuilder,
  applyCurtainDissolve,
  endAlpha,
  softCurtainMaterial,
} from "../../regions/kit/HorizonCurtain";
import { buildParticulateField } from "../../regions/kit/ParticulateField";
import { wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import {
  FogInk,
  instantiate,
  placeGeometry,
  softSprite,
  wingCurtain,
  wingFrame,
  wingPoint,
  type PlacedPart,
} from "./W4FloraKit";
import { mountGateVeil } from "./GateVeilMount";

/**
 * Wing 11 — the Open Blue. Vertigo and freedom: the drop-off, and then
 * almost nothing. The hardest brief here is restraint, so this module is
 * short on purpose. It builds exactly four things:
 *
 * - **The lip** (r 36–38): a crisp sandy edge read through a handful of
 *   pale slabs leaning seaward along it — the last solid thing the eye
 *   gets before the water takes over. They hug the flanks; the axis is
 *   left bare, because the bare middle *is* the edge.
 * - **Sparse motes** in the approach water: sixty-four pinpricks, pale and
 *   small, so the clear blue has something to measure itself against.
 * - **Two far curtains** near the end wall (r 48.4 / 48.9), the canyon's
 *   own silhouette idiom — fog-ink re-derived from the live water, deep
 *   blue values, drooping rippled skylines that sit *below* a standing
 *   diver's eye line, so they read as relief on the abyss floor rather
 *   than as walls. The end of the world stays open above them.
 * - **One lone spire** (r 47.6): a single standing stone on the west
 *   flank, the only vertical mark in the whole wing.
 *
 * Everything between r 38 and the far accents is empty on purpose — the
 * serpent patrols that water and the emptiness is the design.
 * `tests/wingsW4Flora.test.ts` asserts the emptiness, not just the pieces:
 * zero flora instances past r 38 except these accents.
 *
 * Five draws, ~2.4k triangles — far under budget, deliberately. Seeds:
 * only `SEEDS.wingOpenBlue` and `^` substreams.
 */

/** The lip's pale sand-stone — the drop-off's edge is lit, not gloomed. */
const LIP_TINT = 0xb7b098;
/** The spire's deep blue-grey: a silhouette, but a colour, never black. */
const SPIRE_TINT = 0x54687a;
/**
 * The curtains' ink: the Under-Blue's violet register, mixed the twilight's
 * way — green cut hardest, red held nearest (W-M3's fog arithmetic). Round 4
 * measured the old (0.55, 0.62, 0.9) step rendering the opening as bright
 * cobalt rgb(44, 112, 169) — blue over green over red, the one hue the
 * palette row forbids — and no 0.55 wash in front could overcome it.
 */
const CURTAIN_INK = new Color(0.6, 0.34, 0.66);

/** The mote field's level and tint — sparse is the whole point. */
const MOTE_COLOR = 0xd8e8ff;
const MOTE_COUNT = 64;

/** The lip stones, hand-placed along the edge: (r, lateral). */
const LIP_STONES: readonly [number, number][] = [
  [36.4, -3.1],
  [36.8, 2.7],
  [37.1, -2.5],
  [37.3, 3.4],
  [37.5, -3.4],
  [36.9, 3.0],
  [37.6, -2.9],
];

/** The two far accents, nearest first — planes of deeper water, below the eye. */
const CURTAINS: readonly {
  readonly radius: number;
  readonly halfSpan: number;
  readonly top: number;
  readonly droop: number;
  readonly ripple: number;
  readonly fade: number;
  readonly shadeFoot: number;
  readonly shadeTop: number;
}[] = [
  { radius: 48.4, halfSpan: 0.1, top: -1.4, droop: 1.3, ripple: 0.9, fade: 0.28, shadeFoot: 0.5, shadeTop: 1.0 },
  { radius: 48.9, halfSpan: 0.14, top: -3.6, droop: 1.7, ripple: 1.1, fade: 0.45, shadeFoot: 0.45, shadeTop: 0.95 },
];
const CURTAIN_FOOT = -13;

export function buildOpenBlueFlora(def: WingDef): WingFlora {
  const random = new Random(SEEDS[def.seedKey]);
  const frame = wingFrame(def);
  const seed = SEEDS[def.seedKey];
  const group = new Group();
  group.name = "open-blue-flora";
  const contacts: ContactPatch[] = [];

  // ── The lip: pale slabs leaning seaward along the drop-off's edge. ──
  const slab = slabGeometry({ seed: seed ^ 0x1a2b, radius: 0.85, height: 0.75, amount: 0.15, segments: 10, rings: 10 });
  const lipParts: PlacedPart[] = [];
  const lipColor = new Color();
  for (const [r, lateral] of LIP_STONES) {
    const { x, z } = wingPoint(frame, r, lateral);
    const lean = random.range(0.14, 0.3);
    const yaw = random.range(0, Math.PI * 2);
    const scale = random.range(1.0, 1.35);
    const tone = random.range(0.9, 1.08);
    lipParts.push({
      x,
      y: seabedHeight(x, z) - 0.12,
      z,
      // The lean: a slab tipping toward the drop, like strata letting go.
      rotation: [lean, yaw, lean * random.range(0.2, 0.5)],
      scale: [scale, scale * random.range(0.75, 1.0), scale * random.range(0.55, 0.75)],
      color: lipColor.setHex(LIP_TINT).multiplyScalar(tone).clone(),
    });
    contacts.push({ x, z, radius: 1.0, strength: 0.3 });
  }
  const lipMaterial = createToonMaterial({ vertexColors: true });
  group.add(instantiate(slab, lipMaterial, lipParts, "w4-openblue-lip"));

  // ── The motes: sixty-four pinpricks in the approach water, no more. ──
  const motePositions = new Float32Array(MOTE_COUNT * 3);
  for (let i = 0; i < MOTE_COUNT; i++) {
    const r = random.range(30, 39.5);
    const half = wedgeHalfAt(def, r) * 0.8;
    const theta = def.azimuth + random.signed(half);
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    motePositions[i * 3] = x;
    motePositions[i * 3 + 1] = seabedHeight(x, z) + random.range(0.5, 5.0);
    motePositions[i * 3 + 2] = z;
  }
  const moteGeometry = new BufferGeometry();
  moteGeometry.setAttribute("position", new BufferAttribute(motePositions, 3));
  moteGeometry.computeBoundingSphere();
  const moteMaterial = new PointsMaterial({
    color: MOTE_COLOR,
    size: 0.06,
    map: softSprite(),
    transparent: true,
    opacity: 0.42,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    fog: false,
  });
  const motes = new Points(moteGeometry, moteMaterial);
  motes.name = "w4-openblue-motes";
  group.add(motes);

  // ── The far curtains: two low planes of deeper water near the end wall. ──
  // Hard-geometry purge (critic #1, the wing-door SHIP-BLOCKER): the
  // authored wing-door stand is 1.4 m in front of these — raycast-proven
  // to be the "solid blue wall edge-to-edge": two opaque fog-inked
  // planes filling the whole frame and occluding the doorway's veil and
  // promise behind them. They keep their read as relief on the abyss
  // floor from the lip stands, and DISSOLVE when the camera closes so
  // no stand ever meets them as a wall.
  const inkEntries: { material: MeshBasicMaterial; fade: number }[] = [];
  const curtainMeshes: Mesh[] = [];
  for (const [index, curtain] of CURTAINS.entries()) {
    const material = new MeshBasicMaterial({
      color: 0x2c4a66,
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
    });
    applyCurtainDissolve(material, {
      nearFrom: 6,
      nearTo: 14,
      cacheKey: "w4-openblue-curtain-dissolve",
    });
    inkEntries.push({ material, fade: curtain.fade });
    const geometry = wingCurtain({
      azimuth: def.azimuth,
      radius: curtain.radius,
      halfSpan: curtain.halfSpan,
      foot: CURTAIN_FOOT,
      top: curtain.top,
      droop: curtain.droop,
      ripple: curtain.ripple,
      seed: seed ^ (0xc101 + index * 131),
      shadeFoot: curtain.shadeFoot,
      shadeTop: curtain.shadeTop,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = `w4-openblue-curtain-${index}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = -12 - index;
    curtainMeshes.push(mesh);
    group.add(mesh);
  }
  const ink = new FogInk(inkEntries, CURTAIN_INK);
  for (const mesh of curtainMeshes) {
    ink.hook(mesh);
  }

  // ── The lone spire: one vertical on the west flank, past the patrol. ──
  const spireGeometry = stackGeometry(
    [
      { radius: 1.5, rise: 0, stretch: 3.0, lean: 0 },
      { radius: 1.0, rise: 3.4, stretch: 2.4, lean: 0.5 },
      { radius: 0.62, rise: 6.2, stretch: 2.2, lean: 0.9 },
    ],
    { seed: seed ^ 0x5e11, amount: 0.13, segments: 14, rings: 18 },
  );
  const spireAt = wingPoint(frame, 47.6, -4.2);
  placeGeometry(
    spireGeometry,
    Math.atan2(-frame.axisZ, frame.axisX),
    spireAt.x,
    seabedHeight(spireAt.x, spireAt.z),
    spireAt.z,
  );
  spireGeometry.computeBoundingSphere();
  const spireMaterial = createToonMaterial({ color: SPIRE_TINT, vertexColors: true });
  const spire = new Mesh(spireGeometry, spireMaterial);
  spire.name = "w4-openblue-spire";
  spire.castShadow = false;
  spire.receiveShadow = false;
  group.add(spire);
  contacts.push({ x: spireAt.x, z: spireAt.z, radius: 2.4, strength: 0.5 });

  // ── The doorway (connective-1): the hole repainted, then veiled. ──
  // The wave-8 audit's words: "a flat poster-blue blob with a hard
  // scalloped edge ... the wing that sells vertigo currently sells a
  // sticker". The fix is the connective plan's own recipe — depth as
  // paint, not as a blue disc: a baked radial gradient standing in the
  // opening (deepest ink in the middle, dissolving to nothing before the
  // terrain edge), a faint rim-light band where the drop swallows the
  // sun, and a column of marine snow sinking into it. Behind those, the
  // gate veil promises the Drop Plains in the province's own arc — deep
  // prairie green handing to the Under-Blue's violet (red above green,
  // never cobalt). No light column here: the Old Current's water owns
  // the middle of this wing, and the emptiness stays composed.
  const dressing = new Group();
  dressing.name = "wing-gate-hole";
  const holeSeed = (seed ^ 0x9a7f) >>> 0;
  const hole = holeFrame(def);
  dressing.add(buildHoleGradient(hole, holeSeed));
  dressing.add(buildHoleRim(hole, holeSeed));
  const snow = buildParticulateField({
    seed: (seed ^ 0x9a80) >>> 0,
    tint: 0xcfe0ec,
    count: 90,
    mode: "fall",
    volume: { center: [hole.x, hole.y + 1.5, hole.z], size: [7, 11, 5] },
    opacity: 0.5,
  });
  dressing.add(snow.group);

  // ── Critic #1, the wing-door frame: the doorway PROMISE. ──
  // From the door the province read as a solid cobalt wall edge-to-edge
  // — nothing stood inside the fog's range (the vale is 150 m out, the
  // 0.2-opacity veil vanishes against its own fog-followed ink). Three
  // ranks of layered WALL-FIN masses now stand 13/24/34 m past the door
  // in the Drop Plains' register: staggered fin silhouettes with milky
  // rims over violet-deep feet, troughs diving to the foot between
  // them, a NEAR dissolve so the swim out passes through a fading
  // painting and never a pane. Layered fins are the promise of the
  // Worldwall — the province's identity — before the region streams in.
  // Budget: 3 draws, ~530 triangles, inside the dressing's ledger.
  const promiseInks: { material: MeshBasicMaterial; fade: number }[] = [];
  for (const [index, plane] of PROMISE_PLANES.entries()) {
    const material = softCurtainMaterial({ color: 0x2b3a68 });
    material.opacity = plane.opacity;
    applyCurtainDissolve(material, {
      nearFrom: 7,
      nearTo: 12.5,
      cacheKey: "w4-openblue-promise-dissolve",
    });
    promiseInks.push({ material, fade: plane.fade });
    const mesh = new Mesh(
      promisePlane(plane, def.azimuth, (seed ^ (0xb7a1 + index * 131)) >>> 0),
      material,
    );
    mesh.name = `w4-openblue-promise-${index}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.renderOrder = -14 - index;
    dressing.add(mesh);
  }
  const promiseInk = new FogInk(promiseInks, new Color(0.66, 0.56, 0.84));
  const firstPromise = dressing.children.find((child) =>
    child.name.startsWith("w4-openblue-promise"),
  ) as Mesh | undefined;
  if (firstPromise) {
    promiseInk.hook(firstPromise);
  }

  group.add(dressing);

  // The sill the mount samples stands high here (the carve is climbing
  // back up); the drop's promise begins below it, so the veil is let down
  // toward the opening's own centre depth.
  const veil = mountGateVeil(def, {
    width: 8,
    height: 7,
    sillLift: -4,
    palette: [0x1e4038, 0x3a3656, 0x565078],
  });
  group.add(veil.group);

  // The test asserts what this module refuses to build: the spire and the
  // curtains are the only marks past the drop-off's lip.
  let time = 0;
  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      veil.update(dt, reducedMotion);
      time += dt * (reducedMotion ? 0.3 : 1);
      snow.update(time);
    },
  };
}

/** The doorway promise planes: depth past the door, size, gauze weight. */
interface PromisePlane {
  readonly depth: number;
  readonly halfWidth: number;
  readonly foot: number;
  /** The fin crowns' peak height (absolute y). */
  readonly crest: number;
  readonly opacity: number;
  readonly fade: number;
  /** Fin masses: [centre t, weight, width] across the plane's span. */
  readonly fins: readonly (readonly [number, number, number])[];
}

// Widths sized to the connective-1 frustum guard: each plane's bounding
// sphere must stay inside the doorway's sight cone (endHalf + 0.08), so
// the panels are a layered centre-frame promise, and the fog owns the
// frame's edges the way it always did.
//
// Conviction wave (re-critique #1, the wing-door frame): the r1 promise
// was two straight full-width curtains, and their eased ends drew long
// straight diagonal facets across the door's blue volume — "sharp
// geometric faceting" — while their end columns held alpha 0.25 as a
// low ribbon. The promise is now three ranks of WALL-FIN MASSES — the
// Worldwall's own grammar, layered and staggered so the door frames a
// fin country receding into the blue — and every rim dissolves to true
// zero (endAlpha at the ends, troughs diving between the fins).
const PROMISE_PLANES: readonly PromisePlane[] = [
  // Round 3: the r2 front pair read as balanced teeth — the left fin
  // now clearly OWNS the rank (taller, broader) and the right fin
  // drops to a low shoulder pushed further out; asymmetry authored,
  // not left to the noise term.
  {
    depth: 13,
    halfWidth: 10.5,
    foot: -19,
    crest: -5.2,
    opacity: 0.9,
    fade: 0.12,
    fins: [
      [-0.27, 1.0, 0.155],
      [0.24, 0.48, 0.085],
    ],
  },
  {
    depth: 24,
    halfWidth: 12.5,
    foot: -21,
    crest: -3.4,
    opacity: 0.75,
    fade: 0.36,
    fins: [
      [0.26, 1.0, 0.15],
      [-0.18, 0.58, 0.09],
      [-0.38, 0.36, 0.07],
    ],
  },
  {
    depth: 34,
    halfWidth: 13.5,
    foot: -23,
    crest: -2.2,
    opacity: 0.62,
    fade: 0.55,
    fins: [
      [-0.05, 1.0, 0.2],
      [0.38, 0.5, 0.1],
    ],
  },
];

/** Foot → crest tints for the promise: violet-deep feet, milky rims.
 *  Round 2: crest 1.28 → 1.12 — the r1 fin rims rendered as glowing
 *  pale triangles against the door's ink (they read as light beams,
 *  not distant stone). */
const PROMISE_FOOT_TINT: readonly [number, number, number] = [0.55, 0.55, 0.74];
const PROMISE_CREST_TINT: readonly [number, number, number] = [1.12, 1.08, 1.02];

/**
 * One promise rank: fin masses across the doorway's sight line — bells
 * combined by max so each fin keeps its silhouette, troughs diving to
 * the foot line between them, every end and rim fading to true zero.
 */
function promisePlane(plane: PromisePlane, azimuth: number, seed: number): BufferGeometry {
  const builder = new SoftRingBuilder();
  const columns = 44;
  const r = HOLE_R + plane.depth;
  const cx = Math.cos(azimuth) * r;
  const cz = Math.sin(azimuth) * r;
  const tanX = -Math.sin(azimuth);
  const tanZ = Math.cos(azimuth);
  const bell = (t: number, at: number, width: number): number => {
    const d = (t - at) / width;
    return Math.exp(-d * d);
  };

  for (let i = 0; i <= columns; i++) {
    const t = i / columns - 0.5;
    const x = cx + tanX * t * plane.halfWidth * 2;
    const z = cz + tanZ * t * plane.halfWidth * 2;
    const end = 1 - smoothstep01((Math.abs(t) - 0.34) / 0.14);

    let fins = 0;
    for (const [at, weight, width] of plane.fins) {
      fins = Math.max(fins, bell(t, at, width) * weight);
    }
    // Round 2: roughness up a step — the r1 fins were too neat, their
    // clean gaussian shoulders reading as a row of teeth.
    const rough =
      (fbm(t * 3.4 + 1.2, plane.depth * 0.13, { seed, period: 3, octaves: 2 }) - 0.5) * 0.17;
    const top =
      plane.foot + 2.2 + (plane.crest - plane.foot - 2.2) * Math.min(1, fins + rough) * end;
    const runnel =
      fbm(t * 4.2 + 0.6, plane.depth * 0.17, { seed: seed ^ 0x8b11, period: 4, octaves: 2 }) - 0.5;
    const shoulder: [number, number, number] = [
      (PROMISE_FOOT_TINT[0] + PROMISE_CREST_TINT[0]) * 0.5 * (1 + runnel * 0.3),
      (PROMISE_FOOT_TINT[1] + PROMISE_CREST_TINT[1]) * 0.5 * (1 + runnel * 0.26),
      (PROMISE_FOOT_TINT[2] + PROMISE_CREST_TINT[2]) * 0.5 * (1 + runnel * 0.2),
    ];
    // Round 3: the planes stand past the drop-off's lip, so their
    // full-ink foot rows drew a straight horizontal seam over the
    // sill's sand — the feet now dissolve to zero and the fins melt
    // downward into the deep instead of terminating.
    builder.column(x, z, plane.foot, top, {
      alpha: endAlpha(end),
      footAlpha: 0,
      tints: [PROMISE_FOOT_TINT, shoulder, PROMISE_CREST_TINT],
    });
  }

  return builder.build();
}

/** Where the doorway's opening stands, and its frame vectors. */
interface HoleFrame {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Unit tangent across the doorway (perpendicular to the axis). */
  readonly tanX: number;
  readonly tanZ: number;
}

/** The aperture's visual centre: on the axis at the end wall, mid-water. */
const HOLE_R = 47.6;

/**
 * The opening's centre depth is AUTHORED, not sampled: at the end wall the
 * carve is already climbing back toward the rim, so `seabedHeight` there
 * answers with the sill — and round 1 hung the whole dressing up in the
 * sky. Round 2 sat it a step too deep (the wash landed on the wall below
 * the opening); the aperture the camera actually frames centres ≈ −4.5.
 */
const HOLE_Y = -4.5;

function holeFrame(def: WingDef): HoleFrame {
  const x = Math.cos(def.azimuth) * HOLE_R;
  const z = Math.sin(def.azimuth) * HOLE_R;
  return { x, y: HOLE_Y, z, tanX: -Math.sin(def.azimuth), tanZ: Math.cos(def.azimuth) };
}

/** The gradient's inks, centre → shoulder: violet over green, never black. */
const HOLE_INK_CENTRE = new Color(0x1e1c3c);
const HOLE_INK_SHOULDER = new Color(0x3c3760);
const HOLE_HALF_WIDTH = 7.4;
/**
 * Round 5 measured the aperture the camera actually frames: its top edge
 * sits near y −1.5, and at 5.0 the rim band's sun-heavy peak (0.8 of the
 * half-height) landed at −0.5 — on the tan wall above the opening, where
 * an additive pale blue dies. 4.2 puts the peak just inside the edge.
 */
const HOLE_HALF_HEIGHT = 4.2;
/** Normal-blend wash cap — the sandfall curtains' own 0.55 register. */
const HOLE_ALPHA = 0.55;

/**
 * The baked radial gradient: one vertical grid standing in the opening,
 * normal blending, alpha dissolving to zero well inside its own edge so
 * the geometry's rectangle can never read. The edge is wobbled by one
 * seeded fbm so the dissolve follows no perfect ellipse.
 */
function buildHoleGradient(hole: HoleFrame, seed: number): Mesh {
  const cols = 24;
  const rows = 14;
  const positions = new Float32Array((cols + 1) * (rows + 1) * 3);
  const colors = new Float32Array((cols + 1) * (rows + 1) * 4);
  const indices: number[] = [];
  const ink = new Color();

  for (let c = 0; c <= cols; c++) {
    const u = c / cols - 0.5;
    for (let r = 0; r <= rows; r++) {
      const v = r / rows - 0.5;
      const vertex = c * (rows + 1) + r;
      positions[vertex * 3] = hole.x + hole.tanX * u * HOLE_HALF_WIDTH * 2;
      positions[vertex * 3 + 1] = hole.y + v * HOLE_HALF_HEIGHT * 2;
      positions[vertex * 3 + 2] = hole.z + hole.tanZ * u * HOLE_HALF_WIDTH * 2;

      const wobble =
        (fbm(u * 2 + 3, v * 2, { seed, period: 4, octaves: 2 }) - 0.5) * 0.34;
      const d = Math.hypot(u * 2, v * 2) * (1 + wobble);
      const fall = 1 - smoothstep01((d - 0.28) / 0.62);
      ink.copy(HOLE_INK_CENTRE).lerp(HOLE_INK_SHOULDER, Math.min(1, d));
      colors[vertex * 4] = ink.r;
      colors[vertex * 4 + 1] = ink.g;
      colors[vertex * 4 + 2] = ink.b;
      colors[vertex * 4 + 3] = HOLE_ALPHA * fall;
    }
  }
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const a = c * (rows + 1) + r;
      const b = (c + 1) * (rows + 1) + r;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
    toneMapped: true,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "w4-openblue-hole-gradient";
  mesh.renderOrder = 1;
  return mesh;
}

/** The rim light: a faint additive band around the opening, sun-heavy on top. */
const RIM_TINT = new Color(0xbcd8ea);
const RIM_INNER = 0.62;
const RIM_PEAK = 0.8;
const RIM_ALPHA = 0.2;

function buildHoleRim(hole: HoleFrame, seed: number): Mesh {
  const spokes = 40;
  const rings = 4;
  const positions = new Float32Array((spokes + 1) * (rings + 1) * 3);
  const colors = new Float32Array((spokes + 1) * (rings + 1) * 4);
  const indices: number[] = [];

  for (let s = 0; s <= spokes; s++) {
    const theta = (s / spokes) * Math.PI * 2;
    const wobble = 1 + (fbm(Math.cos(theta) + 2, Math.sin(theta), { seed: seed ^ 0x11, period: 4, octaves: 2 }) - 0.5) * 0.22;
    for (let k = 0; k <= rings; k++) {
      const t = RIM_INNER + (k / rings) * (1.06 - RIM_INNER);
      const vertex = s * (rings + 1) + k;
      const across = Math.cos(theta) * t * HOLE_HALF_WIDTH * wobble;
      const up = Math.sin(theta) * t * HOLE_HALF_HEIGHT * wobble;
      positions[vertex * 3] = hole.x + hole.tanX * across;
      positions[vertex * 3 + 1] = hole.y + up;
      positions[vertex * 3 + 2] = hole.z + hole.tanZ * across;

      // The band: zero at both edges, peaking just inside the terrain's
      // rim; the top arc carries the sun, the underside barely answers.
      const band = 1 - Math.min(1, Math.abs(t - RIM_PEAK) / (1.06 - RIM_PEAK));
      const sunward = 0.35 + 0.65 * smoothstep01((Math.sin(theta) + 1) / 2);
      colors[vertex * 4] = RIM_TINT.r;
      colors[vertex * 4 + 1] = RIM_TINT.g;
      colors[vertex * 4 + 2] = RIM_TINT.b;
      colors[vertex * 4 + 3] = RIM_ALPHA * band * band * sunward;
    }
  }
  for (let s = 0; s < spokes; s++) {
    for (let k = 0; k < rings; k++) {
      const a = s * (rings + 1) + k;
      const b = (s + 1) * (rings + 1) + k;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "w4-openblue-hole-rim";
  mesh.renderOrder = 2;
  return mesh;
}

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}
