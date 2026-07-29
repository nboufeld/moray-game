import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FogExp2,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  Vector3,
  type Camera,
  type Material,
  type Scene,
} from "three";
import { buildColorTexture, fbm } from "../rendering/ProceduralTexture";
import { smoothNormals } from "../rendering/SmoothNormals";
import { createToonMaterial } from "../rendering/ToonShading";
import { Random, SEEDS } from "../util/Random";
import { CARVE_END, FLOOR_HALF, GATE_AXIS, GATE_AZIMUTH } from "./Abyss";
import { seabedHeight } from "./Seabed";

/**
 * What lives in the twilight (W-M3, `SEEDS.abyssFlora`; painted over by W-N1,
 * `SEEDS.canyonPaint`): ghost kelp with real leaf straps, clouds of faint
 * luminous motes, clusters of dimly glowing polyps, the silhouette curtains
 * that close the canyon's far end, a hand-mixed gradient in the water column
 * behind them, and the canyon's own light story — a moon column over the den
 * and two lesser shafts on the shelf. Nothing here sways, nothing here is
 * animated at all: the whole layer is a fixed seeded set of marks the fog and
 * the mood light differently as the diver descends.
 *
 * ## The reroll fence (W-N1)
 *
 * Everything W-M3 placed still draws from `SEEDS.abyssFlora` in exactly the
 * order and count it always did — the frond skeletons, the first six polyp
 * clusters, the first 220 motes are bit-identical, and
 * `tests/canyonPaint.test.ts` pins them to literals. Everything W-N1 added —
 * leaf straps, the extra sparkle, the light columns — draws from
 * `SEEDS.canyonPaint` streams, so retuning the paint can never move a mark
 * the biome already had.
 *
 * ## Why the layer can afford to exist with no gating at all
 *
 * The first cut toggled the contents from a sentinel mesh on camera
 * proximity, and the arithmetic killed it: pose B stands eighteen metres
 * from the gate mouth — nearly on the canyon's axis — so any positional
 * predicate wide enough for the gate shot kept the layer live across half
 * the canonical set anyway. What actually protects the bowl is cheaper and
 * already there: every mesh here carries a static bounding sphere and every
 * canonical camera looks south or south-west, so ordinary frustum culling
 * drops the whole layer from every canonical frame — and when a free
 * swimmer does look north-east, the entire biome is a few thousand triangles
 * in a dozen draw calls. `tests/abyssBiome.test.ts` rebuilds the canonical
 * frusta and asserts no bounding sphere here enters any of them.
 *
 * ## The glow discipline
 *
 * The polyps glow by `emissiveIntensity` 0.36 of a pale violet shaped by a
 * baked tip gradient (W-O1), their halo points sit at 0.28 opacity, the
 * ghost kelp glows by 0.14, and the light columns and the gate glow are
 * additive quads at 0.17 opacity or under — all sized, like the jelly
 * bells' 0.16, to stay far under the bloom pass's 0.82 threshold. Nothing
 * in the canyon may bloom: one spark is the discovery ceremony's, and it is
 * not here.
 *
 * ## The look-back (W-O1)
 *
 * The outbound view — standing at the den, facing the gate — is composed
 * here and in `Abyss`'s strata: gate-side ghost kelp silhouettes framing
 * the doorway, the gate glow's glare hanging in the notch, the strata's
 * gate-glow lift brightening the climb, and `Reef.buildShelfLipStones`'
 * standing stones notching the horizon. Everything new draws from fresh
 * `SEEDS.canyonPaint` substreams *after* every existing draw, so W-M3's and
 * W-N1's marks are bit-identical under it.
 */

/** The layer's palette: moonlit blue-greys, violet glow, ink curtains. */
const FROND_ROOT = new Color(0x67739b);
const FROND_TIP = new Color(0xd5e0ef);
/** Where a strap's tip heads beyond the frond tip: moonlit, faintly warm. */
const STRAP_TIP = new Color(0xe8eedd);
/** The ghost in the ghost kelp: a faint self-light, far under the bloom. */
const FROND_GLOW = 0x8fa3d6;
const FROND_GLOW_INTENSITY = 0.14;
const POLYP_COLOR = 0x776f9e;
const POLYP_GLOW = 0x8b83e6;
// Bright enough that a cluster reads as points of light in the twilight —
// total emissive luminance stays around a tenth, far under the bloom pass's
// 0.82 threshold, so nothing here can ever bloom.
// 0.36 since W-O1: the emissive now rides the buds' baked gradient (mean
// ~0.75 of the old flat term), so the intensity comes up to keep the
// cluster's total light where W-N1 left it. Peak — tip vertex 1.0, instance
// variance 1.2 — lands ~0.43 of a pale violet, far under the bloom's 0.82.
const POLYP_GLOW_INTENSITY = 0.36;
/**
 * The halo cloud's tint and level (W-O1). The additive point's centre is the
 * bud's "living light" — a hot pinprick — and the skirt is the water's own
 * glow around it. 0.28 of a sprite whose peak is 1 lands the brightest pixel
 * far under the bloom pass's 0.82, like every additive mark in the canyon.
 */
const POLYP_HALO = 0xa79ff2;
const POLYP_HALO_OPACITY = 0.28;

/** The emissive-by-vertex-colour patch; see the polyp material's note. */
const POLYP_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;
const MOTE_COLOR = 0x9fb2e6;

/**
 * The curtains' ink, as per-channel multipliers on the live fog colour —
 * `DistantReef`'s trick, one biome over, with one deliberate difference: the
 * ink *includes the whole twilight*. The first cut used a near-neutral ink
 * like the distant rings', and from the bowl the far end rendered as a pale
 * turquoise band — because through the notch the camera's fog is still the
 * bowl's bright water, and a curtain mixed from it can only be bright. These
 * multipliers carry `ABYSS_FOG.colorScale`'s green cut on top of the
 * violet-leaning step, so from the bowl the doorway is genuinely a plane of
 * darker blue, and from inside — where the fog itself is already twilight —
 * the curtains sit a step deeper than the water, which is what "continuing
 * down" looks like.
 */
const CURTAIN_INK = new Color(0.48, 0.3, 0.7);
const CURTAINS = [
  // Tops picked from pose J's own geometry: the frame-top ray from the
  // canyon floor crosses the near curtain around y ≈ +1, so the near
  // skyline has to dip below that for the second layer — and the recession
  // — to show inside the frame at all. Taller, the whole sky was one flat
  // blue field. W-N1 turned the ripples up (0.7/1.1 → 1.15/1.4): through
  // the notch from shot I the old top read as one more straight line, and a
  // skyline is the thing the critic said the doorway lacked.
  { radius: 48.2, top: 3.4, fade: 0.3, droop: 2.4, ripple: 1.15 },
  { radius: 50.8, top: 6.0, fade: 0.55, droop: 3.4, ripple: 1.4 },
] as const;
const CURTAIN_FOOT = -13;
const CURTAIN_SEGMENTS = 48;

/**
 * The vertical stations a curtain's gradient is sampled at, as fractions of
 * foot → top. W-M3's curtains were two rows, which makes any gradient a
 * single linear ramp over sixteen metres — from shot I the visible slice
 * (the top three metres above the sill) came out one flat value, which is
 * the critic's "hard-edged flat blue band". The rows crowd toward the top
 * because that is where the band is actually seen from both canonical poses.
 */
const CURTAIN_ROWS = [0, 0.4, 0.65, 0.82, 0.92, 1] as const;

/**
 * Radians either side of the axis a curtain spans — deliberately far wider
 * than the wedge. At the wedge's own width the panels' vertical end-edges
 * hung exposed in the middle of the doorway from the saddle, which is a
 * screen, not water; this wide, the ends stand behind the rim's full-height
 * flanks from every angle the diver can occupy, and the drooping, rippled
 * top is the only edge that ever shows.
 */
const CURTAIN_HALF_SPAN = 0.55;

/**
 * The water-column veil (W-N1): the hand-mixed vertical gradient the critic
 * asked for in place of flat fog. One more arc, standing behind both
 * curtains, whose vertex colours run from deep violet water at its foot up
 * through the fog's own value to a faintly milky brightness — and whose
 * *alpha* fades to nothing at the top, so the panel dissolves into whatever
 * sky the frame has (the mood-dimmed backdrop from the canyon floor, the
 * painted distance from the bowl) instead of ending on an edge. The rgb rows
 * are multipliers on the live fog colour, `DistantReef`'s trick again, so
 * the gradient follows every repaint and every weather mood for free.
 *
 * Its foot stops at −2 rather than the curtains' −13: at this radius the
 * carve has faded and the local ground is back at dune level, so everything
 * below y ≈ 0 is behind the ridge from every reachable angle — and a shorter
 * panel is a smaller bounding sphere for the canonical frusta to reject.
 */
const VEIL = { radius: 51.5, foot: -2, top: 15.5 } as const;
const VEIL_ROWS: readonly {
  readonly y: number;
  readonly tint: readonly [number, number, number];
  readonly alpha: number;
}[] = [
  { y: VEIL.foot, tint: [0.34, 0.28, 0.62], alpha: 0.95 },
  { y: 1.5, tint: [0.5, 0.42, 0.78], alpha: 0.9 },
  { y: 4.5, tint: [0.72, 0.66, 0.92], alpha: 0.72 },
  { y: 8.5, tint: [0.95, 0.92, 1.02], alpha: 0.4 },
  { y: VEIL.top, tint: [1.06, 1.05, 1.02], alpha: 0 },
] as const;

/**
 * The canyon's light story (W-N1): a wide "moon column" standing over the
 * den and two lesser shafts on the descending shelf, so the twilight has a
 * visible direction of light — cool, vertical, scarce, everything the bowl's
 * warm raking sun is not. Additive crossed quads on the reef shafts'
 * pattern, with the same three disciplines: `fog: false` (fog on an additive
 * surface brightens distance instead of closing it), a ground fade baked
 * into vertex colours against `seabedHeight`, and an edge-on fade — here per
 * frame in `onBeforeRender`, since nothing owns an update call into this
 * module. The tint is baked cool into the map; opacity stays far under
 * anything the bloom pass could notice.
 *
 * Ordered nearest-first, and `lateral` keeps every foot off the descent
 * corridor's axis — the moon column deliberately stands *behind* the den,
 * so the animal's dark head silhouettes against it on the approach.
 */
const LIGHT_COLUMNS: readonly {
  readonly r: number;
  readonly lateral: number;
  readonly top: number;
  readonly width: number;
  readonly opacity: number;
}[] = [
  { r: 39.2, lateral: -3.4, top: 5.5, width: 2.6, opacity: 0.11 },
  { r: 42.9, lateral: 3.9, top: 6.2, width: 3.0, opacity: 0.1 },
  { r: 46.3, lateral: 1.1, top: 7.5, width: 4.8, opacity: 0.17 },
];

/**
 * The gate glow (W-O1): one soft additive plane hanging in the doorway, seen
 * only from inside the canyon. The look-back's narrative is that the way
 * home is made of light — the bright bowl water through the notch is already
 * the frame's brightest thing, and this is its glare: a wide soft ellipse of
 * the bowl's own turquoise standing just past the sill, so the doorway
 * *radiates* instead of ending on the crest's cut edge. It is single-sided
 * on purpose, facing down-canyon: from the bowl (shot I) the quad is
 * back-facing and culled, so the bowl-side doorway is untouched to the
 * pixel. Self-contained additive geometry on the light columns' pattern —
 * `fog: false`, no depth write, edge-on fade — and never a writer on any
 * fog or weather channel.
 */
const GATE_GLOW = {
  // Far enough past the sill that the quad's bounding sphere still clears
  // r = 27 at its nearest — the wedge-guard contract every new mark keeps.
  r: 32.4,
  centerY: 2.3,
  width: 8.4,
  height: 5.6,
  opacity: 0.16,
} as const;

/** The columns' ground fade window, in metres above the sand (shafts' own). */
const COLUMN_FADE_START = 0.15;
const COLUMN_FADE_END = 1.8;

/** How close to edge-on a column blade fades out (the shafts' constants). */
const EDGE_ON_FADE_IN = 0.06;
const EDGE_ON_FADE_OUT = 0.3;

function smoothstep01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

interface ColumnBlade {
  readonly material: MeshBasicMaterial;
  readonly normal: Vector3;
  readonly center: Vector3;
  readonly opacity: number;
}

export class AbyssFlora {
  readonly group = new Group();

  private readonly materials: Material[] = [];
  private readonly curtainMaterials: MeshBasicMaterial[] = [];
  private veilMaterial: MeshBasicMaterial | null = null;
  private readonly geometries: BufferGeometry[] = [];
  private lastFog = -1;

  constructor(seed: number = SEEDS.abyssFlora) {
    this.group.name = "abyss-flora";

    const random = new Random(seed);
    this.buildFronds(random);
    this.buildPolyps(random);
    this.buildMotes(random);
    this.buildCurtains();
    this.buildVeil();
    this.buildLightColumns();
    this.buildGateGlow();
  }

  /**
   * Ghost kelp, with leaves now (W-N1): each plant is the pale stalk W-M3
   * placed plus a crown of drooping leaf straps, so it reads as a plant
   * rather than as the "bare dark quills" the round critic called whiskers.
   * The stalk skeletons take *exactly* the eight `SEEDS.abyssFlora` draws
   * per plant they always took — count, order and ranges untouched, so the
   * polyps and motes downstream of them cannot re-roll — and every strap
   * draws from `SEEDS.canyonPaint`. They stand off the den's approach
   * corridor — the strap arithmetic keeps every vertex at least ~2.8 m of
   * lateral clearance from the canyon's axis, which the corridor runs down —
   * because a plant is not an obstruction mesh and nothing downstream would
   * ever notice one crossing the head.
   */
  private buildFronds(random: Random): void {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const color = new Color();
    const straps = new Random(SEEDS.canyonPaint ^ 0x51a9);

    const perpX = -GATE_AXIS.z;
    const perpZ = GATE_AXIS.x;
    const count = 24;

    /**
     * Grows one plant — stalk plus leaf straps — from already-drawn numbers,
     * so the W-M3 skeleton loop below and W-O1's gate-side silhouettes can
     * share the geometry without sharing a stream. The `leafStream` argument
     * is which stream the straps spend; the caller owns every draw.
     */
    const growPlant = (
      plant: {
        x: number;
        z: number;
        foot: number;
        height: number;
        lean: number;
        leanAzimuth: number;
        width: number;
        facing: number;
      },
      leafStream: Random,
    ): void => {
      const { x, z, foot, height, lean, leanAzimuth, width, facing } = plant;
      // The stalk: the old blade at just over half width, since the straps
      // now carry the plant's mass and a stalk as wide as its leaves is a
      // paddle.
      const stalkWidth = width * 0.6;
      const acrossX = Math.cos(facing) * stalkWidth;
      const acrossZ = Math.sin(facing) * stalkWidth;

      const segments = 5;
      const base = positions.length / 3;
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const bow = t * t * lean * height;
        const cx = x + Math.cos(leanAzimuth) * bow;
        const cz = z + Math.sin(leanAzimuth) * bow;
        const cy = foot + t * height;
        const half = (1 - t * 0.92) * 0.5;
        positions.push(cx - acrossX * half, cy, cz - acrossZ * half);
        positions.push(cx + acrossX * half, cy, cz + acrossZ * half);

        color.copy(FROND_ROOT).lerp(FROND_TIP, t);
        colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

        if (s < segments) {
          const a = base + s * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }

      // ── The straps (W-N1, `SEEDS.canyonPaint`). ──
      const strapCount = 6 + Math.floor(leafStream.next() * 3);
      for (let leaf = 0; leaf < strapCount; leaf++) {
        // Draws first, decisions after: a strap skipped for clearance still
        // consumes its draws, so a threshold tune cannot re-roll a sibling.
        const attach = leafStream.range(0.38, 0.92);
        const azimuth = leafStream.range(0, Math.PI * 2);
        const length = leafStream.range(0.55, 1.1) * (0.55 + height * 0.14);
        const lift = leafStream.range(0.15, 0.4);
        const sag = leafStream.range(0.5, 0.9);
        const strapWidth = leafStream.range(0.12, 0.2);
        const tipFade = leafStream.range(0.55, 0.95);

        // Where the stalk's centreline is at the attach height.
        const bow = attach * attach * lean * height;
        const rootX = x + Math.cos(leanAzimuth) * bow;
        const rootZ = z + Math.sin(leanAzimuth) * bow;
        const rootY = foot + attach * height;
        const rootLat = rootX * perpX + rootZ * perpZ;

        // The corridor fence. The stalk skeleton clears the axis by seeded
        // luck the guard test has already blessed; a strap must not spend
        // that margin, so anywhere near the fence it grows outward only,
        // and a root already on the fence grows no strap at all.
        if (Math.abs(rootLat) < 2.85) {
          continue;
        }
        let dirX = Math.cos(azimuth);
        let dirZ = Math.sin(azimuth);
        let dirLat = dirX * perpX + dirZ * perpZ;
        const inward = Math.sign(rootLat) * dirLat < 0;
        if (inward && Math.abs(rootLat) - Math.abs(dirLat) * length < 3.0) {
          dirLat = -dirLat;
          const dirAlong = dirX * GATE_AXIS.x + dirZ * GATE_AXIS.z;
          dirX = GATE_AXIS.x * dirAlong + perpX * dirLat;
          dirZ = GATE_AXIS.z * dirAlong + perpZ * dirLat;
        }

        // A ribbon: narrow at the attachment, widest mid-strap, a point at
        // the tip — arcing up a little and then drooping well below its
        // root, which is the kelp forest's own crown-strap silhouette.
        const acrossLeafX = -dirZ;
        const acrossLeafZ = dirX;
        const rows = 4;
        const leafBase = positions.length / 3;
        for (let s = 0; s <= rows; s++) {
          const t = s / rows;
          const reach = t * length;
          const drop = lift * length * t - (lift + sag) * length * t * t;
          const px = rootX + dirX * reach;
          const pz = rootZ + dirZ * reach;
          const py = rootY + drop;
          const half = strapWidth * 0.5 * Math.sin(Math.min(Math.PI, 0.35 + t * Math.PI));
          positions.push(px - acrossLeafX * half, py, pz - acrossLeafZ * half);
          positions.push(px + acrossLeafX * half, py, pz + acrossLeafZ * half);

          color.copy(FROND_ROOT).lerp(FROND_TIP, attach);
          color.lerp(STRAP_TIP, t * tipFade);
          colors.push(color.r, color.g, color.b, color.r, color.g, color.b);

          if (s < rows) {
            const a = leafBase + s * 2;
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        }
      }
    };

    for (let i = 0; i < count; i++) {
      // ── The W-M3 skeleton: these eight draws are frozen in order. ──
      const r = random.range(36.5, 47);
      const side = random.next() < 0.5 ? -1 : 1;
      const lateral = side * random.range(3.2, Math.max(3.4, r * FLOOR_HALF + 1.5));
      const x = GATE_AXIS.x * r + perpX * lateral;
      const z = GATE_AXIS.z * r + perpZ * lateral;
      const foot = seabedHeight(x, z);

      const height = random.range(2.6, 4.6);
      const lean = random.range(-0.25, 0.25);
      const leanAzimuth = random.range(0, Math.PI * 2);
      const width = random.range(0.22, 0.34);
      const facing = random.range(0, Math.PI * 2);
      // ── End of the frozen draws. ──
      growPlant({ x, z, foot, height, lean, leanAzimuth, width, facing }, straps);
    }

    // ── The gate-side silhouettes (W-O1, their own stream). ──
    //
    // The look-back's horizon is the sill crest with the bright bowl water
    // above it, and W-M3's plants all stand at r ≥ 36.5 — behind the camera.
    // These four stand on the walls just inside the gate, alternating jambs,
    // so their crowned tips rise into the doorway's light and the climb out
    // is framed by living silhouettes. Heights are capped against the local
    // ground so no tip clears the crest enough to show from the bowl side
    // (shot I's grazing ray passes the sill around y ≈ +2.2 here), and roots
    // stay 3.7 m off the axis, comfortably outside both the frond-clearance
    // guard (2.6 m) and the straps' own 2.85 m fence.
    const gate = new Random(SEEDS.canyonPaint ^ 0x6a1e);
    const gateCount = 4;
    for (let i = 0; i < gateCount; i++) {
      const r = gate.range(32.4, 35.6);
      const side = i % 2 === 0 ? -1 : 1;
      const lateral = side * gate.range(3.7, 5.4);
      const x = GATE_AXIS.x * r + perpX * lateral;
      const z = GATE_AXIS.z * r + perpZ * lateral;
      const foot = seabedHeight(x, z);
      const height = Math.min(gate.range(3.0, 4.6), 1.7 - foot);
      const lean = gate.range(-0.18, 0.18);
      const leanAzimuth = gate.range(0, Math.PI * 2);
      const width = gate.range(0.24, 0.34);
      const facing = gate.range(0, Math.PI * 2);
      growPlant({ x, z, foot, height, lean, leanAzimuth, width, facing }, gate);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    this.geometries.push(geometry);

    // The faint self-light is what makes them *ghost* kelp: the mood takes
    // most of the rig's light away down here, and a toon surface with no
    // emissive floor rendered the pale palette as near-black quills.
    const material = createToonMaterial({
      vertexColors: true,
      side: DoubleSide,
      emissive: FROND_GLOW,
      emissiveIntensity: FROND_GLOW_INTENSITY,
    });
    this.materials.push(material);
    const fronds = new Mesh(geometry, material);
    fronds.name = "abyss-fronds";
    fronds.castShadow = false;
    fronds.receiveShadow = false;
    this.group.add(fronds);
  }

  /**
   * Clusters of faintly glowing polyps, low on the twilight floor. W-M3's
   * six clusters draw first, untouched; W-N1 triples the count along the
   * den's approach from its own stream, so the descent has sparkle.
   *
   * W-O1 gives each bud a dimensional read — the round critic's "flat blue
   * dots" was exact: a six-centimetre toon bud under a flat emissive is one
   * value at any distance a camera stands. Two marks fix it without touching
   * a single draw: a baked vertex gradient (dim violet base to a pale tip, so
   * the diffuse response models the bud's own form), and one additive point
   * per bud — a hot pinprick core inside a soft halo, riding the same
   * position and the same per-bud brightness the instance colour already
   * drew. The halo sprite's centre is the "living light"; its skirt is the
   * glow the water carries. Everything stays far under the bloom threshold.
   */
  private buildPolyps(random: Random): void {
    const clusters = 6;
    const extraClusters = 12;
    const perCluster = 7;
    // Detail 1, not 0: at 0 a polyp is a visible hexagon, and forty-two flat
    // hexagons in violet read as confetti, not animals. 80 triangles each is
    // still a rounding error on a layer the bowl's frusta never contain.
    const geometry = new IcosahedronGeometry(0.11, 1);
    smoothNormals(geometry);
    bakeBudGradient(geometry);
    this.geometries.push(geometry);

    const material = createToonMaterial({
      color: POLYP_COLOR,
      emissive: POLYP_GLOW,
      emissiveIntensity: POLYP_GLOW_INTENSITY,
      vertexColors: true,
    });
    // The bud's glow is nearly all emissive down here — the mood takes most
    // of the rig away — and emissive ignores vertex colours, which is
    // exactly why the buds measured flat: the gradient was riding a diffuse
    // term the twilight had already removed. The coral field's own pattern,
    // one biome over: patch the emissive by `vColor`, so the baked gradient
    // (and the per-bud variance the instance colour carries) shapes the
    // light itself. The chunk is a module constant, so three's program
    // cache keys it once.
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        POLYP_EMISSIVE_CHUNK,
      );
    };
    this.materials.push(material);

    const mesh = new InstancedMesh(geometry, material, (clusters + extraClusters) * perCluster);
    mesh.name = "abyss-polyps";
    mesh.castShadow = false;
    mesh.receiveShadow = false;

    const perpX = -GATE_AXIS.z;
    const perpZ = GATE_AXIS.x;
    const dummy = new Object3D();
    const color = new Color();
    let index = 0;

    // W-O1's halo cloud rides the buds' own numbers: position, vertical
    // scale and the brightness variance are *recorded* as the draws happen,
    // never re-drawn, so the instanced matrices stay bit-identical.
    const halos: { x: number; y: number; z: number; glow: number }[] = [];

    const plant = (cx: number, cz: number, stream: Random): void => {
      for (let p = 0; p < perCluster; p++) {
        const x = cx + stream.signed(0.55);
        const z = cz + stream.signed(0.55);
        dummy.position.set(x, seabedHeight(x, z) + stream.range(0.02, 0.08), z);
        const scale = stream.range(0.25, 0.55);
        dummy.scale.set(scale, scale * stream.range(0.8, 1.5), scale);
        dummy.rotation.set(0, stream.range(0, Math.PI * 2), 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        // The glow varies per polyp: an even cluster is a string of fairy
        // lights, and these are animals.
        const glow = stream.range(0.75, 1.2);
        color.setHex(POLYP_COLOR).multiplyScalar(glow);
        mesh.setColorAt(index, color);
        // The halo hangs just *above* the tip, not on it: a point at the
        // bud's own depth loses its hot core to the bud's depth test and
        // renders as a dim ring — measured, not guessed (`wo1-r3`).
        halos.push({
          x: dummy.position.x,
          y: dummy.position.y + dummy.scale.y * 0.11 * 1.15,
          z: dummy.position.z,
          glow,
        });
        index++;
      }
    };

    for (let c = 0; c < clusters; c++) {
      const r = random.range(38, 47.5);
      const side = random.next() < 0.5 ? -1 : 1;
      // On the flat floor band only: a cluster on the wall slope reads as
      // marks floating against the far sand from half the canyon's angles.
      const lateral = side * random.range(1.8, Math.max(2.2, r * FLOOR_HALF - 0.4));
      plant(GATE_AXIS.x * r + perpX * lateral, GATE_AXIS.z * r + perpZ * lateral, random);
    }

    // W-N1's sparkle, hugging the approach a little closer than the six
    // above — the descent looks straight down this band.
    const extra = new Random(SEEDS.canyonPaint ^ 0x901f);
    for (let c = 0; c < extraClusters; c++) {
      const r = extra.range(37.5, 47);
      const side = extra.next() < 0.5 ? -1 : 1;
      const lateral = side * extra.range(1.3, 3.6);
      plant(GATE_AXIS.x * r + perpX * lateral, GATE_AXIS.z * r + perpZ * lateral, extra);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    this.group.add(mesh);

    // The halos: one additive point per bud, at the bud's tip, carrying the
    // bud's own brightness in a colour attribute (a `PointsMaterial` has one
    // `size` for the whole cloud — the motes' constraint — so variety lives
    // in brightness, which under additive blending is the same quantity).
    const haloPositions = new Float32Array(halos.length * 3);
    const haloColors = new Float32Array(halos.length * 3);
    for (const [i, halo] of halos.entries()) {
      haloPositions[i * 3] = halo.x;
      haloPositions[i * 3 + 1] = halo.y;
      haloPositions[i * 3 + 2] = halo.z;
      haloColors[i * 3] = halo.glow;
      haloColors[i * 3 + 1] = halo.glow;
      haloColors[i * 3 + 2] = halo.glow;
    }
    const haloGeometry = new BufferGeometry();
    haloGeometry.setAttribute("position", new BufferAttribute(haloPositions, 3));
    haloGeometry.setAttribute("color", new BufferAttribute(haloColors, 3));
    haloGeometry.computeBoundingSphere();
    this.geometries.push(haloGeometry);

    const haloMaterial = new PointsMaterial({
      color: POLYP_HALO,
      size: 0.3,
      map: polypHaloSprite(),
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: POLYP_HALO_OPACITY,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.materials.push(haloMaterial);
    const haloPoints = new Points(haloGeometry, haloMaterial);
    haloPoints.name = "abyss-polyp-halos";
    this.group.add(haloPoints);
  }

  /**
   * The luminous motes: denser than the bowl's cloud and dimmer, hanging in
   * the canyon's water column. Additive points, `fog: false` like every
   * additive mark in the project — fog on an additive surface brightens
   * distance instead of closing it. W-M3's 220 draw first, untouched; W-N1
   * adds 440 more along the approach from its own stream, and they stay off
   * the corridor's own axis so nothing twinkles over the dark head the
   * descent is asking the player to find.
   */
  private buildMotes(random: Random): void {
    const count = 220;
    const extraCount = 440;
    const positions = new Float32Array((count + extraCount) * 3);
    const perpX = -GATE_AXIS.z;
    const perpZ = GATE_AXIS.x;

    for (let i = 0; i < count; i++) {
      const r = random.range(34, 48);
      const lateral = random.signed(r * FLOOR_HALF + 1.2);
      const x = GATE_AXIS.x * r + perpX * lateral;
      const z = GATE_AXIS.z * r + perpZ * lateral;
      const floor = seabedHeight(x, z);
      positions[i * 3] = x;
      positions[i * 3 + 1] = floor + random.range(0.4, 5.2);
      positions[i * 3 + 2] = z;
    }

    const extra = new Random(SEEDS.canyonPaint ^ 0x307e);
    for (let i = count; i < count + extraCount; i++) {
      const r = extra.range(35, 47.5);
      const side = extra.next() < 0.5 ? -1 : 1;
      const lateral = side * extra.range(0.9, r * FLOOR_HALF + 1.3);
      const x = GATE_AXIS.x * r + perpX * lateral;
      const z = GATE_AXIS.z * r + perpZ * lateral;
      const floor = seabedHeight(x, z);
      positions[i * 3] = x;
      positions[i * 3 + 1] = floor + extra.range(0.3, 5.8);
      positions[i * 3 + 2] = z;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    this.geometries.push(geometry);

    const material = new PointsMaterial({
      color: MOTE_COLOR,
      size: 0.07,
      // A bare point rasterises as a square, and a square of additive light
      // is a pixel error, not a mote. The sprite is a soft radial falloff;
      // under additive blending its black rim adds nothing, so no alpha test
      // is needed.
      map: moteSprite(),
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.materials.push(material);

    const motes = new Points(geometry, material);
    motes.name = "abyss-motes";
    this.group.add(motes);
  }

  /**
   * The far end: two arc curtains standing across the wedge where the carve
   * fades out, so the canyon ends in receding planes of deeper water rather
   * than in its own floor climbing back up. Their colour is re-derived from
   * `scene.fog` on render — see {@link CURTAIN_INK} — and the vertical
   * gradient lives in {@link CURTAIN_ROWS}' vertex colours: dark at depth,
   * milky toward the light, steepest exactly where the band is seen.
   */
  private buildCurtains(): void {
    for (const [index, curtain] of CURTAINS.entries()) {
      const material = new MeshBasicMaterial({
        color: 0x1d2b4a,
        fog: false,
        side: DoubleSide,
        toneMapped: true,
        vertexColors: true,
      });
      this.curtainMaterials.push(material);
      this.materials.push(material);

      // Three segments per curtain, not one mesh: an arc this wide carries a
      // bounding sphere ~27 m across, which three's conservative
      // plane-distance test reports as intersecting canonical frusta it is
      // nowhere near — the curtain would be submitted and clipped instead of
      // culled. Cut in thirds, each sphere is small enough to cull honestly,
      // the seams share exact vertex columns, and the extra draw calls only
      // ever exist where the curtains are actually on screen.
      const seed = SEEDS.abyssFlora ^ (0xc0a7 + index * 131);
      for (let segment = 0; segment < 3; segment++) {
        const geometry = curtainArc(curtain, seed, segment / 3, (segment + 1) / 3);
        this.geometries.push(geometry);
        const mesh = new Mesh(geometry, material);
        mesh.name = "abyss-curtain";
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        // Every segment carries the fog-following hook (W-O1). It used to
        // ride only the near curtain's middle segment, which left a stale
        // tint whenever a weather mood crossfaded while the camera framed
        // only an outer segment — the hook short-circuits on the fog's hex,
        // so the extra riders cost one comparison per drawn segment.
        mesh.onBeforeRender = (_renderer, scene) => {
          this.followFog(scene);
        };
        this.group.add(mesh);
      }
    }
  }

  /** The water-column gradient standing behind the curtains; see {@link VEIL}. */
  private buildVeil(): void {
    const material = new MeshBasicMaterial({
      color: 0x53b2bb,
      fog: false,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      toneMapped: true,
      vertexColors: true,
    });
    this.veilMaterial = material;
    this.materials.push(material);

    for (let segment = 0; segment < 3; segment++) {
      const geometry = veilArc(segment / 3, (segment + 1) / 3);
      this.geometries.push(geometry);
      const mesh = new Mesh(geometry, material);
      mesh.name = "abyss-veil";
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // The veil can be the only far plane in frame (looking up from the
      // floor, over the curtain skylines), so every segment carries the
      // fog-following hook too; `followFog` short-circuits on the fog's hex.
      mesh.onBeforeRender = (_renderer, scene) => {
        this.followFog(scene);
      };
      this.group.add(mesh);
    }
  }

  /** The moon column and the shelf shafts; see {@link LIGHT_COLUMNS}. */
  private buildLightColumns(): void {
    const random = new Random(SEEDS.canyonPaint ^ 0x115a);
    const perpX = -GATE_AXIS.z;
    const perpZ = GATE_AXIS.x;
    const map = columnSprite();

    for (const column of LIGHT_COLUMNS) {
      const x = GATE_AXIS.x * column.r + perpX * column.lateral;
      const z = GATE_AXIS.z * column.r + perpZ * column.lateral;
      const foot = seabedHeight(x, z) - 0.8;
      const length = column.top - foot;
      const centerY = (column.top + foot) / 2;
      const center = new Vector3(x, centerY, z);

      for (const spin of [0, Math.PI / 2]) {
        const material = new MeshBasicMaterial({
          map,
          transparent: true,
          opacity: column.opacity,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
          vertexColors: true,
          fog: false,
        });
        this.materials.push(material);

        // World-space geometry, like everything else in this module: the
        // canonical-frustum guard (and three's culling) reads the geometry's
        // own sphere as world coordinates.
        const geometry = new PlaneGeometry(column.width, length, 4, 24);
        const turn = spin + random.signed(0.35);
        geometry.rotateY(turn);
        geometry.translate(center.x, center.y, center.z);
        geometry.computeBoundingSphere();
        this.geometries.push(geometry);
        const blade = new Mesh(geometry, material);
        blade.name = "abyss-light-column";
        blade.renderOrder = 2;
        bakeColumnGroundFade(geometry);

        // The edge-on fade, per frame: a crossed quad seen along its plane
        // rasterises as a bright hairline, and nothing owns an update call
        // into this module — so each blade fades itself as the camera
        // crosses its plane, the same arithmetic `LightShafts.facing` runs.
        const info: ColumnBlade = {
          material,
          normal: new Vector3(Math.sin(turn), 0, Math.cos(turn)),
          center,
          opacity: column.opacity,
        };
        blade.onBeforeRender = (_renderer, _scene, camera) => {
          fadeEdgeOn(info, camera);
        };
        this.group.add(blade);
      }
    }

    // The moon column lands: a small cool pool on the floor beneath it, so
    // the one real light source in the canyon visibly reaches the ground —
    // a beam that brightens nothing it points at is a decal, the bowl's own
    // shaft/pool rule.
    const moon = LIGHT_COLUMNS[LIGHT_COLUMNS.length - 1]!;
    const poolX = GATE_AXIS.x * moon.r + perpX * moon.lateral;
    const poolZ = GATE_AXIS.z * moon.r + perpZ * moon.lateral;
    const pool = new RingGeometry(0, moon.width * 0.55, 32, 8);
    pool.rotateX(-Math.PI / 2);
    pool.rotateY(random.range(0, Math.PI * 2));
    const position = pool.attributes.position;
    if (position) {
      const fade = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
        const localX = position.getX(i);
        const localZ = position.getZ(i);
        position.setY(i, seabedHeight(poolX + localX, poolZ + localZ) + 0.06);
        const edge =
          1 - smoothstep01((Math.hypot(localX, localZ) / (moon.width * 0.55) - 0.45) / 0.55);
        fade[i * 3] = edge;
        fade[i * 3 + 1] = edge;
        fade[i * 3 + 2] = edge;
      }
      position.needsUpdate = true;
      pool.setAttribute("color", new BufferAttribute(fade, 3));
    }
    // World space, like the columns above.
    pool.translate(poolX, 0, poolZ);
    pool.computeBoundingSphere();
    this.geometries.push(pool);

    const poolMaterial = new MeshBasicMaterial({
      map: poolSprite(),
      color: 0xbfc9f0,
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.materials.push(poolMaterial);
    const poolMesh = new Mesh(pool, poolMaterial);
    poolMesh.name = "abyss-light-pool";
    poolMesh.renderOrder = 1;
    this.group.add(poolMesh);
  }

  /** The doorway's glare, seen only from inside; see {@link GATE_GLOW}. */
  private buildGateGlow(): void {
    const x = GATE_AXIS.x * GATE_GLOW.r;
    const z = GATE_AXIS.z * GATE_GLOW.r;
    const geometry = new PlaneGeometry(GATE_GLOW.width, GATE_GLOW.height, 1, 1);
    // A plane's normal is +z; turn it onto the gate axis so the front face
    // looks down-canyon and the bowl side only ever meets the culled back.
    const turn = Math.atan2(GATE_AXIS.x, GATE_AXIS.z);
    geometry.rotateY(turn);
    geometry.translate(x, GATE_GLOW.centerY, z);
    geometry.computeBoundingSphere();
    this.geometries.push(geometry);

    const material = new MeshBasicMaterial({
      map: gateGlowSprite(),
      transparent: true,
      opacity: GATE_GLOW.opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.materials.push(material);
    const mesh = new Mesh(geometry, material);
    mesh.name = "abyss-gate-glow";
    mesh.renderOrder = 2;

    // The edge-on fade, like the columns': a glare plane crossed at a right
    // angle is a bright hairline, and the saddle can be approached from its
    // flanks.
    const info: ColumnBlade = {
      material,
      normal: new Vector3(GATE_AXIS.x, 0, GATE_AXIS.z),
      center: new Vector3(x, GATE_GLOW.centerY, z),
      opacity: GATE_GLOW.opacity,
    };
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      fadeEdgeOn(info, camera);
    };
    this.group.add(mesh);
  }

  /** `DistantReef.followFog`, aimed at whatever water the mood has mixed. */
  private followFog(scene: Scene): void {
    const fog = scene.fog;
    if (!(fog instanceof FogExp2)) {
      return;
    }
    const hex = fog.color.getHex();
    if (hex === this.lastFog) {
      return;
    }
    this.lastFog = hex;

    const ink = fog.color.clone().multiply(CURTAIN_INK);
    for (const [index, curtain] of CURTAINS.entries()) {
      this.curtainMaterials[index]?.color.copy(ink).lerp(fog.color, curtain.fade);
    }
    // The veil's rows carry their own multipliers, so its material takes the
    // fog straight: the gradient is authored relative to the live water.
    this.veilMaterial?.color.copy(fog.color);
  }

  dispose(): void {
    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    for (const material of this.materials) {
      material.dispose();
    }
    this.geometries.length = 0;
    this.materials.length = 0;
    this.curtainMaterials.length = 0;
    this.veilMaterial = null;
    this.group.removeFromParent();
    this.group.clear();
  }
}

/** The blades' shared edge-on fade; see `LightShafts.facing` for the why. */
function fadeEdgeOn(blade: ColumnBlade, camera: Camera): void {
  const view = new Vector3().subVectors(blade.center, camera.position);
  const distance = view.length();
  if (distance < 1e-4) {
    return;
  }
  view.multiplyScalar(1 / distance);
  const facing = smoothstep01(
    (Math.abs(view.dot(blade.normal)) - EDGE_ON_FADE_IN) / (EDGE_ON_FADE_OUT - EDGE_ON_FADE_IN),
  );
  blade.material.opacity = blade.opacity * facing;
}

/**
 * Writes a column blade's fade into the sand into its vertex colours — the
 * shafts' `bakeGroundFade`, without the matrix (the geometry is already in
 * world space).
 */
function bakeColumnGroundFade(geometry: PlaneGeometry): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const above = position.getY(i) - seabedHeight(position.getX(i), position.getZ(i));
    const fade = smoothstep01((above - COLUMN_FADE_START) / (COLUMN_FADE_END - COLUMN_FADE_START));
    colors[i * 3] = fade;
    colors[i * 3 + 1] = fade;
    colors[i * 3 + 2] = fade;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** The motes' soft round sprite, shared by every instance and never disposed. */
let moteSpriteTexture: ReturnType<typeof buildColorTexture> | undefined;
function moteSprite(): ReturnType<typeof buildColorTexture> {
  moteSpriteTexture ??= buildColorTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    const glow = Math.max(0, 1 - distance);
    const soft = glow * glow;
    return [soft, soft, soft];
  });
  return moteSpriteTexture;
}

/**
 * The light columns' map: a soft bell across, brightest in the upper body
 * and fading toward both ends, with the cool tint baked in — a moon's light,
 * not the sun shafts' warm ribbon. `DataTexture`, so the canyon still
 * constructs in plain Node, unlike the shafts' canvas map.
 */
let columnSpriteTexture: ReturnType<typeof buildColorTexture> | undefined;
function columnSprite(): ReturnType<typeof buildColorTexture> {
  columnSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const bell = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 1.5);
    // v runs 0 at the blade's foot to 1 at its head (PlaneGeometry's own
    // convention): dim at the foot where the water has absorbed the light,
    // brightest high, gone just under the head so the top edge never cuts.
    const along = Math.pow(v, 1.15) * Math.min(1, (1 - v) * 5);
    const value = bell * along;
    return [value * 0.72, value * 0.82, value];
  });
  return columnSpriteTexture;
}

/**
 * The polyps' halo sprite (W-O1): a hot pinprick core inside a wide soft
 * skirt. The core is what makes a bud read as a *light* rather than a lit
 * object — the sprite's centre reaches 1 and the material opacity is what
 * keeps the mark far under the bloom threshold.
 */
let polypHaloSpriteTexture: ReturnType<typeof buildColorTexture> | undefined;
function polypHaloSprite(): ReturnType<typeof buildColorTexture> {
  polypHaloSpriteTexture ??= buildColorTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    const core = Math.max(0, 1 - distance / 0.3);
    const skirt = Math.pow(Math.max(0, 1 - distance), 2.4) * 0.38;
    const value = Math.min(1, core * core + skirt);
    return [value, value, value];
  });
  return polypHaloSpriteTexture;
}

/**
 * The doorway glare (W-O1): a soft ellipse, wider than tall, its falloff
 * slow enough that the glow dissolves into the water instead of ending on a
 * rim. The bowl's turquoise is baked in — green above blue, red held low but
 * present, the water's own order of channels.
 */
let gateGlowSpriteTexture: ReturnType<typeof buildColorTexture> | undefined;
function gateGlowSprite(): ReturnType<typeof buildColorTexture> {
  gateGlowSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const dx = (u - 0.5) * 2;
    const dy = (v - 0.5) * 2 * 1.3;
    const distance = Math.min(1, Math.hypot(dx, dy));
    const value = Math.pow(1 - distance, 1.7);
    return [value * 0.62, value, value * 0.9];
  });
  return gateGlowSpriteTexture;
}

/**
 * The buds' baked form (W-O1): a vertical gradient from a dim violet-leaning
 * base to a pale tip, written into the polyp geometry's vertex colours so
 * the toon response models the bud's own shape. It multiplies the instance
 * colour, so the per-bud brightness variance is untouched, and it never
 * exceeds 1.0 — the glow lives in the halo, not in a buffer.
 */
function bakeBudGradient(geometry: IcosahedronGeometry): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    // y runs −0.11 (base) to +0.11 (tip) on the unit bud.
    const t = Math.min(1, Math.max(0, position.getY(i) / 0.11 * 0.5 + 0.5));
    const value = 0.45 + 0.55 * t;
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    // The base leans a step further violet, so the bud sits into the floor's
    // own shadow colour instead of onto a cut edge.
    colors[i * 3 + 2] = Math.min(1, value + 0.08 * (1 - t));
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

/** The moon pool's soft radial glow, wobbled so its rim is not a circle. */
let poolSpriteTexture: ReturnType<typeof buildColorTexture> | undefined;
function poolSprite(): ReturnType<typeof buildColorTexture> {
  poolSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const wobble = fbm(u, v, { seed: SEEDS.canyonPaint ^ 0x9001, period: 3, octaves: 2 });
    const rim = Math.hypot(u - 0.5, v - 0.5) * 2;
    const distance = Math.min(1, rim * (0.86 + 0.3 * wobble));
    const halo = Math.pow(Math.max(0, 1 - distance * distance), 2.4);
    return [halo, halo, halo];
  });
  return poolSpriteTexture;
}

/**
 * The curtains' gradient: dark violet water low, milky toward the light.
 * The span is wide (−10 to +4) because the slice a camera sees depends on
 * where it stands: from shot I the band runs −8 up to the skyline, and from
 * the den's doorstep the frame top is the curtain at −5 to −2 — a gradient
 * centred narrowly around the skyline left that close slice a flat plateau,
 * which was AB5's whole "flat indigo field".
 */
function curtainShade(y: number): readonly [number, number, number] {
  const k = smoothstep01((y + 10) / 14);
  const value = 0.45 + 0.9 * k;
  return [value, value, value + 0.06 * (1 - k)];
}

/**
 * A vertical arc of curtain: foot buried, top a drooping, gently rippled
 * skyline — `DistantReef`'s ring profile cut down to one wedge of it. The
 * droop takes the ends well below the middle and the fbm ripple breaks the
 * straight line, because a flat top is the one thing that says "screen"
 * instead of "far water". Several rows per column since W-N1, so the
 * vertical gradient has somewhere to live; see {@link CURTAIN_ROWS}.
 */
function curtainArc(
  curtain: { radius: number; top: number; droop: number; ripple: number },
  seed: number,
  from = 0,
  to = 1,
): BufferGeometry {
  const rows = CURTAIN_ROWS.length;
  const positions = new Float32Array((CURTAIN_SEGMENTS + 1) * rows * 3);
  const colors = new Float32Array((CURTAIN_SEGMENTS + 1) * rows * 3);
  const indices: number[] = [];

  for (let i = 0; i <= CURTAIN_SEGMENTS; i++) {
    // `t` runs over the whole arc whatever slice is asked for, so adjacent
    // segments sample identical columns at their shared edge and the cuts
    // cannot open.
    const t = from + (i / CURTAIN_SEGMENTS) * (to - from);
    const theta = GATE_AZIMUTH + (t * 2 - 1) * CURTAIN_HALF_SPAN;
    const x = Math.cos(theta) * Math.min(curtain.radius, CARVE_END + 4);
    const z = Math.sin(theta) * Math.min(curtain.radius, CARVE_END + 4);
    const droop = (1 - Math.cos((t * 2 - 1) * Math.PI * 0.5)) * curtain.droop;
    const ripple =
      (fbm(t * 3, curtain.radius * 0.05, { seed, period: 3, octaves: 2 }) - 0.5) *
      2 *
      curtain.ripple;
    const topY = curtain.top - droop + ripple;

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const s = CURTAIN_ROWS[rowIndex]!;
      const y = CURTAIN_FOOT + s * (topY - CURTAIN_FOOT);
      const base = (i * rows + rowIndex) * 3;
      positions[base] = x;
      positions[base + 1] = y;
      positions[base + 2] = z;
      const [r, g, b] = curtainShade(y);
      colors[base] = r;
      colors[base + 1] = g;
      colors[base + 2] = b;
    }

    if (i < CURTAIN_SEGMENTS) {
      for (let rowIndex = 0; rowIndex < rows - 1; rowIndex++) {
        const a = i * rows + rowIndex;
        indices.push(a, a + 1, a + rows, a + 1, a + rows + 1, a + rows);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * One slice of the water-column veil: a flat arc whose vertex colours are
 * {@link VEIL_ROWS}' multipliers on the live fog, with alpha dissolving the
 * top into the sky. RGBA vertex colours, which is what the four-component
 * attribute is for — an edge the alpha has already taken to zero needs no
 * skyline, no droop and no ripple.
 */
function veilArc(from: number, to: number): BufferGeometry {
  const segments = 16;
  const rows = VEIL_ROWS.length;
  const positions = new Float32Array((segments + 1) * rows * 3);
  const colors = new Float32Array((segments + 1) * rows * 4);
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = from + (i / segments) * (to - from);
    const theta = GATE_AZIMUTH + (t * 2 - 1) * CURTAIN_HALF_SPAN;
    const x = Math.cos(theta) * VEIL.radius;
    const z = Math.sin(theta) * VEIL.radius;

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const row = VEIL_ROWS[rowIndex]!;
      const base = i * rows + rowIndex;
      positions[base * 3] = x;
      positions[base * 3 + 1] = row.y;
      positions[base * 3 + 2] = z;
      colors[base * 4] = row.tint[0];
      colors[base * 4 + 1] = row.tint[1];
      colors[base * 4 + 2] = row.tint[2];
      colors[base * 4 + 3] = row.alpha;
    }

    if (i < segments) {
      for (let rowIndex = 0; rowIndex < rows - 1; rowIndex++) {
        const a = i * rows + rowIndex;
        indices.push(a, a + 1, a + rows, a + 1, a + rows + 1, a + rows);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
