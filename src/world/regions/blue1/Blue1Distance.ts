import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  type Scene,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm } from "../../../rendering/ProceduralTexture";
import { Random, SEEDS } from "../../../util/Random";
import {
  SoftRingBuilder,
  applyCurtainDissolve,
  endAlpha,
  softCurtainMaterial,
} from "../kit/HorizonCurtain";
import { regionSlot } from "../RegionSlots";
import { smoothstep01 } from "./Blue1Shared";
import { BLUE1_SLOT, CENTER_X, CENTER_Z } from "./Blue1Terrain";

/**
 * The Drop Plains' painted distance — the `DistantReef` idiom re-authored
 * twice, because this region has two horizons:
 *
 * - **The prairie horizon** (three rings + monolith cards): low rolling
 *   swell-lines in milky blue standing past the rim's rise, pierced by
 *   sparse standing-stone silhouettes — the steppe going on forever. The
 *   rings hold gaps over the approach (the slope's own shoulders close
 *   that view) and over the World's Edge sector, where the second horizon
 *   takes over.
 * - **The deep steps** (three low arcs): the Friedrich distance below and
 *   beyond the drop — layered violet-blue ridges whose tops all sit below
 *   the overlook's eye line, each further arc a step paler, so the void
 *   ends in painted depth and never in bare fog.
 *
 * Every ink is re-derived from `scene.fog` per frame (one hex compare),
 * red held above green in the violet steps per the value key.
 */

interface HorizonLayer {
  readonly radius: number;
  readonly base: number;
  readonly vary: number;
  readonly ink: Color;
}

// Raised in round 2: the round-1 tops (0.5–5) barely cleared the rim's own
// dune-level ground and the rings read as thin water-lines, not swells.
// Round 5 measured the bands +20 of blue over the water they stand in and
// dead flat; every layer now carries its own authored ink (nearest a step
// darker-warmer, furthest nearly the water) instead of one ink lerped
// toward a fog that is intrinsically bluer than the backdrop behind it.
const PRAIRIE_LAYERS: readonly HorizonLayer[] = [
  { radius: 240, base: 3.2, vary: 2.4, ink: new Color(0.94, 0.86, 0.82) },
  { radius: 262, base: 6.5, vary: 3.0, ink: new Color(0.96, 0.9, 0.86) },
  { radius: 288, base: 10.0, vary: 3.8, ink: new Color(0.98, 0.94, 0.9) },
];
// Round 5: −9 floated five metres ABOVE the steppe floor, and the rings'
// straight bottom edges hung in the fog as flat wedges wherever the rim's
// rise dipped. The feet now tuck below the ground everywhere visible.
const PRAIRIE_FOOT = -20;

interface DeepStep {
  readonly radius: number;
  readonly top: number;
  readonly vary: number;
  readonly ink: Color;
}

// Round 4 (the fill-plan audit's "canyon-curtain gradient" fix): a fourth,
// palest arc so the void ends in four planes; `vary` halved and the
// columns more than doubled so the tops stop reading as sawtooth teeth.
// Round 5 re-derived the inks against the measured frame: the arcs render
// as fog × ink, and even with red held high the old fade-lerp back toward
// the fog re-supplied the blue it had just cut (bands measured blue 190
// against water at 151). Round 8's raycasts then caught the overcorrection:
// from Terrace-Stairs the same arcs rendered as maroon paper — red held
// TWICE as high as green survives any fog. The inks are now near-neutral
// violets (red a nose above green, level with blue), so the steps stay
// cool from every pose; nearest darkest, each further arc a step paler.
const DEEP_STEPS: readonly DeepStep[] = [
  { radius: 174, top: -38, vary: 0.7, ink: new Color(0.68, 0.52, 0.72) },
  { radius: 190, top: -32.5, vary: 1.1, ink: new Color(0.76, 0.6, 0.78) },
  { radius: 208, top: -27.5, vary: 1.5, ink: new Color(0.84, 0.68, 0.84) },
  { radius: 224, top: -23.5, vary: 1.9, ink: new Color(0.92, 0.78, 0.9) },
];
const DEEP_FOOT = -50;

/**
 * The Far Wall face curtains (critic #1): the drop's near rampart,
 * painted. Two offset planes just outside the rim sheets' rc-178 trim —
 * depth layering, because two planes beat one — in the Under-Blue's own
 * violet register, red held above green, never cobalt.
 */
interface WallFace {
  readonly radius: number;
  readonly ink: Color;
}

const WALL_FACES: readonly WallFace[] = [
  { radius: 183, ink: new Color(0.6, 0.5, 0.7) },
  { radius: 196, ink: new Color(0.72, 0.61, 0.79) },
];
/** The curtain's crest, tucked under the dune lip (~0) from every pose. */
const WALL_TOP = -2.4;
const WALL_FOOT = -52;
const WALL_FOOT_TINT: readonly [number, number, number] = [0.4, 0.39, 0.58];
const WALL_CREST_TINT: readonly [number, number, number] = [1.18, 1.12, 1.04];

const SEGMENTS = 220;

/** The monolith cards' inks: a step deeper than the rings they pierce. */
const CARD_INKS: readonly Color[] = [new Color(0.9, 0.8, 0.78), new Color(0.94, 0.86, 0.84)];

// The vertical grade every distance plane carries (the canyon-curtain
// lesson): a curtain seen from below fills the upper frame, and one flat
// value reads as paper. Feet sink toward the shadow violet, crowns pale
// toward the light. Baked as vertex colours; the materials multiply.
// Round 8: from Under-Blue the nearest curtain fills half the frame and the
// old grade (0.58 → 1.1) still compressed to one value through the fog —
// the foot now falls much further into shadow and the crown lifts, so the
// wall reads as a lit ridge over a dark base even at 70 m.
const DEEP_FOOT_TINT: readonly [number, number, number] = [0.36, 0.36, 0.52];
const DEEP_CROWN_TINT: readonly [number, number, number] = [1.22, 1.16, 1.06];
const PRAIRIE_FOOT_TINT: readonly [number, number, number] = [0.72, 0.72, 0.78];
const PRAIRIE_CROWN_TINT: readonly [number, number, number] = [1.06, 1.04, 1.0];

/** Half-angle of the gap over the approach corridor. */
const GAP_APPROACH = 0.4;
/** Half-angle of the World's Edge sector, where the deep steps stand. */
const GAP_EDGE = 0.62;

/**
 * R0.10 (journey-close): the Sunken Calamity's march runs down azimuth
 * 4.59, and the perpendicular distance from our centre to that line is
 * ≈ 293 m — 5 m outside the outermost prairie radius. The rings ran
 * tangent ALONG the march corridor, so once this region attaches
 * naturally beside the spur (the region's own QA always forced a lone
 * region and never saw it) the arcs stood in the swim-line as opaque
 * `fog:false` sheets. Part the curtain over the corridor: the R4 cut,
 * taken in world space against the spur's line rather than by our own
 * azimuth. The deep steps (radii ≤ 224, ≥ 69 m clear) stay whole.
 */
const SPUR = regionSlot("sunken-calamity-1");
const SPUR_COS = Math.cos(SPUR.azimuth);
const SPUR_SIN = Math.sin(SPUR.azimuth);
/** Lateral clearance the painted distance keeps off the spur's swim-line. */
const SPUR_CLEAR = 40;

/** True where a ring column would stand inside the spur's corridor. */
function overSpur(x: number, z: number): boolean {
  const along = x * SPUR_COS + z * SPUR_SIN;
  if (along < 100) {
    return false;
  }
  return Math.abs(z * SPUR_COS - x * SPUR_SIN) < SPUR_CLEAR;
}

export function buildBlue1Distance(): { meshes: (Mesh | InstancedMesh)[] } {
  const random = new Random(SEEDS.regionBlue1 ^ 0xd15b);
  const meshes: (Mesh | InstancedMesh)[] = [];
  const entries: { material: MeshBasicMaterial; ink: Color }[] = [];
  let lastFog = -1;

  const followFog = (scene: Scene): void => {
    const fog = scene.fog;
    if (!(fog instanceof FogExp2)) {
      return;
    }
    const hex = fog.color.getHex();
    if (hex === lastFog) {
      return;
    }
    lastFog = hex;
    for (const entry of entries) {
      entry.material.color.copy(fog.color).multiply(entry.ink);
    }
  };

  const gapToOrigin = BLUE1_SLOT.azimuth + Math.PI;
  const gapOutward = BLUE1_SLOT.azimuth;

  // ── The prairie horizon rings. ──
  for (const [index, layer] of PRAIRIE_LAYERS.entries()) {
    // Critic F2/F3 (the class fix): the two-row opaque strip is now the
    // kit's soft three-row curtain — dissolved crest, graded values,
    // gap ends fading out, and the far-clip self-dissolve so the 160 m
    // plane never slices an arc into hard vertical edges.
    const material = softCurtainMaterial({ color: 0x9fc4d8 });
    applyCurtainDissolve(material, { cacheKey: "blue1-horizon-dissolve" });
    entries.push({ material, ink: layer.ink });
    const geometry = horizonRing(
      layer,
      SEEDS.regionBlue1 ^ (0xd200 + index * 131),
      // R0.10: the spur-corridor test rides the same callback, so
      // endEase tapers the cut ends exactly like the angular gaps'.
      (theta) =>
        angleBetween(theta, gapToOrigin) < GAP_APPROACH ||
        angleBetween(theta, gapOutward) < GAP_EDGE ||
        overSpur(
          CENTER_X + Math.cos(theta) * layer.radius,
          CENTER_Z + Math.sin(theta) * layer.radius,
        ),
    );
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `blue1-horizon-${index}`;
    mesh.renderOrder = -(index + 3);
    if (index === 0) {
      mesh.onBeforeRender = (_renderer, scene) => followFog(scene);
    }
    meshes.push(mesh);
  }

  // ── The deep steps over the World's Edge. ──
  for (const [index, step] of DEEP_STEPS.entries()) {
    // Critic #1 (SHIP-BLOCKER): at the wall-face beat these arcs stood
    // beside the camera as opaque blades with sawtooth razor edges,
    // and from across the void their 0.7–1.9 m tops compressed into
    // one razor-straight line. Soft grammar + a NEAR guard (an arc the
    // swim-line passes beside dissolves rather than standing as a
    // pane) + the far-clip dissolve; the crest itself is broken in
    // `deepArc` below.
    const material = softCurtainMaterial({ color: 0x33406e });
    applyCurtainDissolve(material, {
      nearFrom: 26,
      nearTo: 58,
      cacheKey: "blue1-deep-step-dissolve",
    });
    entries.push({ material, ink: step.ink });
    const geometry = deepArc(step, SEEDS.regionBlue1 ^ (0xd300 + index * 131), gapOutward);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `blue1-deep-step-${index}`;
    mesh.renderOrder = -(index + 4) - PRAIRIE_LAYERS.length;
    meshes.push(mesh);
  }

  // ── The Far Wall face: the painted cliff under the World's Edge. ──
  // Critic #1's void: between blue-1's rim lip (its sheets end at
  // rc ≈ 178) and blue-2's pass sheet (u ≥ 626) the drop's near face
  // was BARE FOG — the wall-face identity beat looked at a hole. Two
  // offset curtain planes now paint the cliff: strata-runneled violet
  // rising to a milky crest tucked under the dune lip, broken crest
  // line, corridor parting over the crossing, near guard so the
  // ferryman's swim-line never meets a pane. Budget: 2 draws, ~1.9k
  // triangles, ledgered under blue-1's painted distance.
  for (const [index, wall] of WALL_FACES.entries()) {
    const material = softCurtainMaterial({ color: 0x4a4676 });
    applyCurtainDissolve(material, {
      nearFrom: 20,
      nearTo: 48,
      cacheKey: "blue1-wall-face-dissolve",
    });
    entries.push({ material, ink: wall.ink });
    const geometry = wallFaceCurtain(wall, SEEDS.regionBlue1 ^ (0xd500 + index * 131), gapOutward);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.name = `blue1-wall-face-${index}`;
    mesh.renderOrder = -11 - index;
    meshes.push(mesh);
  }

  // ── The distant monoliths: instanced silhouette cards in two bands. ──
  for (const [band, spec] of [
    { rFrom: 236, rTo: 252, count: 12, hMin: 11, hMax: 18 },
    { rFrom: 260, rTo: 282, count: 9, hMin: 15, hMax: 24 },
  ].entries()) {
    const material = new MeshBasicMaterial({
      color: 0x7d97b8,
      fog: false,
      side: DoubleSide,
      toneMapped: true,
      vertexColors: true,
    });
    entries.push({ material, ink: CARD_INKS[band]! });
    const mesh = new InstancedMesh(monolithCardGeometry(), material, spec.count);
    mesh.name = `blue1-distance-monoliths-${band}`;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const dummy = new Object3D();
    let placed = 0;
    let guard = 0;
    while (placed < spec.count && guard++ < 400) {
      const theta = random.range(0, Math.PI * 2);
      if (
        angleBetween(theta, gapToOrigin) < GAP_APPROACH + 0.12 ||
        angleBetween(theta, gapOutward) < GAP_EDGE + 0.08
      ) {
        continue;
      }
      const r = random.range(spec.rFrom, spec.rTo);
      // The cards keep their own base (−6): they stand on the rim's rise,
      // not on the rings' dropped foot line.
      dummy.position.set(CENTER_X + Math.cos(theta) * r, -6, CENTER_Z + Math.sin(theta) * r);
      dummy.rotation.set(0, random.range(0, Math.PI), random.signed(0.05));
      dummy.scale.set(
        random.range(1.0, 1.6),
        random.range(spec.hMin, spec.hMax) / CARD_HEIGHT,
        random.range(1.0, 1.6),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    mesh.count = placed;
    // Fill round 2, POST-filter (the placement stream above is consumed
    // identically, so every surviving card keeps its byte-exact matrix):
    // cards within 0.34 rad of the World's Edge gap stand where the rim
    // has already fallen away, and a card floating over the void read as
    // a flat grey rectangle from the ferryman-crossing pose. They
    // collapse to nothing in place.
    for (let i = 0; i < placed; i++) {
      const m = new Matrix4();
      mesh.getMatrixAt(i, m);
      const px = m.elements[12]!;
      const pz = m.elements[14]!;
      const theta = Math.atan2(pz - CENTER_Z, px - CENTER_X);
      // R0.10: the outer band reaches within 11 m of the Calamity march's
      // swim-line — cards over its corridor collapse with the void ones.
      if (angleBetween(theta, gapOutward) < GAP_EDGE + 0.34 || overSpur(px, pz)) {
        // Collapse in place (position kept, so the instance-aware bounds
        // stay honest about where the draw lives).
        const collapsed = new Matrix4().makeScale(0, 0, 0);
        collapsed.setPosition(px, m.elements[13]!, pz);
        mesh.setMatrixAt(i, collapsed);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }

  return { meshes };
}

/** The card's authored height; instances scale it to their drawn height. */
const CARD_HEIGHT = 16;

/**
 * One distant standing stone: two crossed tapering blades with a slight
 * lean and a blunt crown — drawn to the megaliths' own proportions so
 * the horizon promises more of exactly what the field delivers.
 */
let monolithCard: BufferGeometry | undefined;
function monolithCardGeometry(): BufferGeometry {
  if (monolithCard) {
    return monolithCard;
  }
  const blade = (spin: number): BufferGeometry => {
    const h = CARD_HEIGHT;
    const positions = new Float32Array([
      // The shaft, leaning gently as it rises.
      -1.5, 0, 0, 1.5, 0, 0, 1.7, h * 0.55, 0,
      -1.5, 0, 0, 1.7, h * 0.55, 0, -0.9, h * 0.57, 0,
      // The upper stone, narrowing to a blunt crown.
      -0.9, h * 0.57, 0, 1.7, h * 0.55, 0, 1.2, h * 0.92, 0,
      -0.9, h * 0.57, 0, 1.2, h * 0.92, 0, -0.3, h * 0.93, 0,
      -0.3, h * 0.93, 0, 1.2, h * 0.92, 0, 0.5, h, 0,
    ]);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.applyMatrix4(new Matrix4().makeRotationY(spin));
    return geometry;
  };
  const merged = mergeGeometries([blade(0), blade(Math.PI / 2)], false);
  if (!merged) {
    throw new Error("blue1 monolith card blades could not be merged");
  }
  // The same vertical grade the rings carry, so a card is never one value.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = smoothstep01(position.getY(i) / CARD_HEIGHT);
    colors[i * 3] = 0.78 + t * 0.28;
    colors[i * 3 + 1] = 0.78 + t * 0.26;
    colors[i * 3 + 2] = 0.82 + t * 0.18;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  monolithCard = merged;
  return monolithCard;
}

/** One prairie ring: a curtain whose top edge is a rolling swell-line. */
function horizonRing(
  layer: HorizonLayer,
  noiseSeed: number,
  inGap: (theta: number) => boolean,
): BufferGeometry {
  const builder = new SoftRingBuilder();
  const midTint: [number, number, number] = [
    (PRAIRIE_FOOT_TINT[0] + PRAIRIE_CROWN_TINT[0]) / 2,
    (PRAIRIE_FOOT_TINT[1] + PRAIRIE_CROWN_TINT[1]) / 2,
    (PRAIRIE_FOOT_TINT[2] + PRAIRIE_CROWN_TINT[2]) / 2,
  ];

  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = (i / SEGMENTS) * Math.PI * 2;
    if (inGap(theta)) {
      builder.gap();
      continue;
    }
    const end = endEase(theta, inGap);
    const x = CENTER_X + Math.cos(theta) * layer.radius;
    const z = CENTER_Z + Math.sin(theta) * layer.radius;
    const t = i / SEGMENTS;
    const crest =
      layer.base +
      (fbm(t * 6, layer.radius * 0.013, { seed: noiseSeed, period: 6, octaves: 3 }) - 0.5) *
        2 *
        layer.vary;
    builder.column(
      x,
      z,
      PRAIRIE_FOOT,
      PRAIRIE_FOOT + Math.max(1.2, crest - PRAIRIE_FOOT) * end + 0.2,
      {
        alpha: endAlpha(end),
        tints: [PRAIRIE_FOOT_TINT, midTint, PRAIRIE_CROWN_TINT],
      },
    );
  }

  return builder.build();
}

/** One deep step: an arc across the World's Edge sector, top below the lip. */
function deepArc(step: DeepStep, noiseSeed: number, gapOutward: number): BufferGeometry {
  const builder = new SoftRingBuilder();
  const span = GAP_EDGE + 0.26;
  // Round 4: 64 columns put ~6 m of arc in each quad and the per-column
  // noise rendered as regular sawtooth teeth; at 160 the ridge is a line.
  const count = 160;

  // R0.6 integration (the Deep Steps' flagged gate): the depth-2 corridor
  // crosses all four arcs dead-on at the outbound azimuth. Each arc parts
  // over the corridor (half-angle 0.10 rad ≈ v ±20 at these radii), the
  // cut edges diving under the ground line with the arcs' own ease — the
  // painting parting to admit the diver, the Deep Steps' wall face rising
  // behind it.
  const CORRIDOR_HALF = 0.1;
  const CORRIDOR_EASE = 0.12;

  for (let i = 0; i <= count; i++) {
    const off = (i / count) * 2 - 1;
    const theta = gapOutward + off * span;
    const offCorridor = Math.abs(off * span);
    if (offCorridor < CORRIDOR_HALF) {
      builder.gap();
      continue;
    }
    // The arc's ends sink so its cut edges never stand as walls — the
    // outer ends by |off|, the new corridor edges by their own ease.
    const end =
      (1 - smoothstep01((Math.abs(off) - 0.72) / 0.24)) *
      smoothstep01((offCorridor - CORRIDOR_HALF) / CORRIDOR_EASE);
    const x = CENTER_X + Math.cos(theta) * step.radius;
    const z = CENTER_Z + Math.sin(theta) * step.radius;
    // Critic #1: the old 0.7–1.9 m relief was sub-pixel from across the
    // void — the four tops compressed into one razor-straight line, the
    // "flat teal card band" of the wall beats. The crest is now BROKEN:
    // the broad swell carries real height (long ridge runs falling in
    // shoulders), and a sparse notch term bites down through it, so the
    // silhouette reads as shelf-country rock, not a rule. Same fbm
    // calls, same seeds — only the amplitudes and the notch are new.
    const broad =
      fbm((i / count) * 2.3 + 0.4, step.radius * 0.011, {
        seed: noiseSeed,
        period: 3,
        octaves: 2,
      }) - 0.5;
    const fine =
      fbm(i * 0.11, step.radius * 0.017, { seed: noiseSeed ^ 0x5a5a, period: 7, octaves: 3 }) -
      0.5;
    const notch = smoothstep01((Math.abs(fine) - 0.32) / 0.1);
    const ridge =
      step.top +
      broad * 2 * step.vary * 3.4 +
      fine * 1.4 * step.vary -
      notch * step.vary * 2.6;
    // Strata down the face (the wall-face brief: value variation, not
    // one flat ink): a slow runnel walk modulates the shoulder row per
    // column, so the face carries vertical rock striations through fog.
    const runnel =
      fbm((i / count) * 5.1, step.radius * 0.021, {
        seed: noiseSeed ^ 0x77aa,
        period: 5,
        octaves: 2,
      }) - 0.5;
    const shoulder: [number, number, number] = [
      (DEEP_FOOT_TINT[0] + DEEP_CROWN_TINT[0]) * 0.5 * (1 + runnel * 0.34),
      (DEEP_FOOT_TINT[1] + DEEP_CROWN_TINT[1]) * 0.5 * (1 + runnel * 0.3),
      (DEEP_FOOT_TINT[2] + DEEP_CROWN_TINT[2]) * 0.5 * (1 + runnel * 0.22),
    ];
    builder.column(x, z, DEEP_FOOT, DEEP_FOOT + Math.max(1.5, ridge - DEEP_FOOT) * end, {
      alpha: endAlpha(end),
      tints: [DEEP_FOOT_TINT, shoulder, DEEP_CROWN_TINT],
    });
  }

  return builder.build();
}

/**
 * One Far Wall face curtain: an arc across the World's Edge sector whose
 * crest is a broken line held under the dune lip, whose face carries
 * runneled strata down to a drowned violet foot, and which parts over
 * the crossing's corridor exactly the way the deep arcs part.
 */
function wallFaceCurtain(wall: WallFace, noiseSeed: number, gapOutward: number): BufferGeometry {
  const builder = new SoftRingBuilder();
  const span = GAP_EDGE + 0.3;
  const count = 150;
  const CORRIDOR_HALF = 0.11;
  const CORRIDOR_EASE = 0.14;

  for (let i = 0; i <= count; i++) {
    const off = (i / count) * 2 - 1;
    const theta = gapOutward + off * span;
    const offCorridor = Math.abs(off * span);
    if (offCorridor < CORRIDOR_HALF) {
      builder.gap();
      continue;
    }
    const end =
      (1 - smoothstep01((Math.abs(off) - 0.7) / 0.26)) *
      smoothstep01((offCorridor - CORRIDOR_HALF) / CORRIDOR_EASE);
    const x = CENTER_X + Math.cos(theta) * wall.radius;
    const z = CENTER_Z + Math.sin(theta) * wall.radius;

    // The broken crest: long swells dipping in shoulders, bitten by
    // sparse notches — a cliff line, never a rule. It only ever falls
    // AWAY from the lip, so the terrain's own silhouette stays king.
    const swell =
      fbm((i / count) * 3.1 + 0.2, wall.radius * 0.014, {
        seed: noiseSeed,
        period: 3,
        octaves: 2,
      }) - 0.5;
    const bite = fbm((i / count) * 9.3, wall.radius * 0.02, {
      seed: noiseSeed ^ 0x3c3c,
      period: 9,
      octaves: 2,
    });
    const notch = smoothstep01((bite - 0.62) / 0.12);
    const crest = WALL_TOP - Math.max(0, -swell) * 4.6 - notch * 5.2;

    // Strata runnels down the face: the value walk that keeps a 50 m
    // cliff from compressing to one flat band through fog.
    const runnel =
      fbm((i / count) * 6.4, wall.radius * 0.017, {
        seed: noiseSeed ^ 0x9d2f,
        period: 6,
        octaves: 2,
      }) - 0.5;
    const shoulder: [number, number, number] = [
      (WALL_FOOT_TINT[0] + WALL_CREST_TINT[0]) * 0.5 * (1 + runnel * 0.36),
      (WALL_FOOT_TINT[1] + WALL_CREST_TINT[1]) * 0.5 * (1 + runnel * 0.32),
      (WALL_FOOT_TINT[2] + WALL_CREST_TINT[2]) * 0.5 * (1 + runnel * 0.24),
    ];
    builder.column(x, z, WALL_FOOT, WALL_FOOT + Math.max(2, crest - WALL_FOOT) * end, {
      alpha: endAlpha(end),
      tints: [WALL_FOOT_TINT, shoulder, WALL_CREST_TINT],
    });
  }

  return builder.build();
}

/**
 * Eases an arc's height near a gap edge so ends never cut vertically.
 * Round 6: three coarse probes quantised the ease into three giant flat
 * steps — with the rings' feet dropped to −20 the eased columns stood as
 * 12-metre terraced slabs at the void poses' frame edges. The ease now
 * measures its distance to the gap finely and runs over 0.3 rad, so a
 * curtain's end is a long smooth dive under the ground line.
 */
const EASE_SPAN = 0.3;
function endEase(theta: number, inGap: (theta: number) => boolean): number {
  for (let probe = 0.02; probe <= EASE_SPAN; probe += 0.02) {
    if (inGap(theta - probe) || inGap(theta + probe)) {
      return smoothstep01(probe / EASE_SPAN);
    }
  }
  return 1;
}

function angleBetween(a: number, b: number): number {
  const delta = Math.abs(a - b) % (Math.PI * 2);
  return delta > Math.PI ? Math.PI * 2 - delta : delta;
}
