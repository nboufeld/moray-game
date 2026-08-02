import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Points,
  PointsMaterial,
  RingGeometry,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { buildCarpetField } from "../../regions/kit/CarpetField";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { angleBetween, wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import { mountGateVeil } from "./GateVeilMount";
import { TIERB_GROUP_NAME } from "./TierBUplift";
import { buildBladeMeadow } from "./WreckMeadowBlades";

/**
 * Wing 5 — the Moonlit Lagoon. Serenity: a still, silver basin.
 *
 * The quietest place in the game, and deliberately the emptiest of the
 * three: a few smooth pale stones, sparse silver-green tufts, a slow dust
 * of sparkle motes, and one soft pool of light on the sand where the Moon
 * Koi turns its circle. The koi owns the middle of the wing — a ~4 m
 * circle around r 40 at mid-height — so the lagoon's one hard rule is
 * that nothing tall enters that volume: tufts inside it are capped short
 * rather than refused, stones stay low, and the motes hug the floor, so
 * the meadow reads continuous and the circle stays open water.
 *
 * Four draw calls: one instanced tuft meadow (the Wreck Meadow's blade
 * module, paled and spared down), one instanced stone field, one points
 * cloud, one additive ground ring. Under reduced motion the motes barely
 * drift; the stillness is the point either way.
 */

/**
 * The Moon Koi's circle, as a radial band and a ceiling over the floor.
 * Exported so the tests check the kept-clear volume against the same
 * numbers the flora was placed with.
 */
export const MOONLIT_KOI_CIRCLE = { from: 36, to: 44, maxTop: 1.25 } as const;
const KOI_BAND = MOONLIT_KOI_CIRCLE;

/** Where the pool of moonlight lies: under the koi's circle, on the axis. */
const MOON_POOL = { r: 40, radius: 2.3, opacity: 0.2 } as const;

/**
 * The pool DECAL's own reach and strength (edges-fix #7). The re-critic's
 * frame shows the interior stand reading no pool at all — 2.3 m at 0.2
 * additive is sub-threshold under the night mood at four metres'
 * distance. The decal grows and brightens; `MOON_POOL.radius` itself is
 * untouched because the moon-grass gate is measured from it, and moving
 * that gate would re-place every blade the Tier B probe pins. Light
 * spilling over the grass fringe is what a pool of light does anyway.
 */
const POOL_GLOW_RADIUS = 3.4;
const POOL_GLOW_OPACITY = 0.34;

/** Silver-green tufts, two drifts — pale, never white. */
const TUFT_PALETTE = {
  families: [
    [0xa4c2ae, 0xbfd6c2, 0x8aa894],
    [0x9cbaa4, 0xb2ccb6, 0x86a290],
  ],
} as const;

const MOTE_COUNT = 150;
const STONE_COUNT = 10;

/** How far a mote dims and brightens over its cycle, and how slow that is. */
const TWINKLE_FLOOR = 0.4;
const TWINKLE_RATE_MIN = 0.3;
const TWINKLE_RATE_MAX = 0.9;

export function buildMoonlitLagoonFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "moonlit-lagoon-flora";
  const random = new Random(SEEDS.wingMoonlitLagoon);
  const contacts: ContactPatch[] = [];

  const axisX = Math.cos(def.azimuth);
  const axisZ = Math.sin(def.azimuth);
  const perpX = -axisZ;
  const perpZ = axisX;

  // ── The tufts. ──
  const tufts = buildBladeMeadow({
    def,
    seed: SEEDS.wingMoonlitLagoon ^ 0x6d44,
    patches: 7,
    bladesPerPatch: 18,
    patchRadius: 2.2,
    radiusFrom: 33.5,
    radiusTo: 47,
    palette: TUFT_PALETTE,
    bladeHeight: 1.05,
    bladeWidth: 0.2,
    heightRange: [0.45, 0.9],
    emissive: 0x93a8d0,
    emissiveIntensity: 0.12,
    gateMargin: 1.7,
    shortBand: KOI_BAND,
  });
  group.add(tufts.mesh);

  // ── The stones. ──
  // Smooth pale water-worn lumps, silvered by the bake: a cool base, a
  // moonlit crown. Two stand at the gate's flanks so the doorway promises
  // the stillness inside.
  const stoneGeometry = new IcosahedronGeometry(1, 2);
  softenStone(stoneGeometry, SEEDS.wingMoonlitLagoon ^ 0x1f66);
  smoothNormals(stoneGeometry);
  silverStone(stoneGeometry);
  const stones = new InstancedMesh(
    stoneGeometry,
    createToonMaterial({ vertexColors: true }),
    STONE_COUNT,
  );
  stones.name = "moonlit-stones";
  stones.castShadow = false;
  stones.receiveShadow = true;

  const dummy = new Object3D();
  const color = new Color();
  let stoneIndex = 0;
  const layStone = (r: number, lateral: number, scale: number): void => {
    const x = axisX * r + perpX * lateral;
    const z = axisZ * r + perpZ * lateral;
    dummy.position.set(x, seabedHeight(x, z) - scale * 0.3, z);
    dummy.rotation.set(random.signed(0.3), random.range(0, Math.PI * 2), random.signed(0.3));
    dummy.scale.set(scale, scale * random.range(0.7, 0.95), scale * random.range(0.85, 1.1));
    dummy.updateMatrix();
    stones.setMatrixAt(stoneIndex, dummy.matrix);
    color.setRGB(random.range(0.92, 1.02), random.range(0.92, 1.02), random.range(0.95, 1.08));
    color.multiplyScalar(random.range(0.85, 1.08));
    stones.setColorAt(stoneIndex, color);
    contacts.push({ x, z, radius: scale * 1.7, strength: 0.4 });
    stoneIndex++;
  };

  for (let i = 0; i < 8; i++) {
    const r = random.range(34, 46.5);
    const side = random.next() < 0.5 ? -1 : 1;
    // Inside the koi's circle the stones stay low enough to swim over.
    const cap = r >= KOI_BAND.from && r <= KOI_BAND.to ? 0.55 : 0.85;
    const scale = random.range(0.3, cap);
    // Floor pieces: the flat basin band, not the wall slopes.
    const lateral = side * random.range(1.4, Math.max(1.6, r * def.wedge.floorHalf * 0.85));
    layStone(r, lateral, scale);
  }
  for (const side of [-1, 1]) {
    layStone(random.range(32.4, 33.4), side * random.range(2.1, 2.5), random.range(0.35, 0.5));
  }
  stones.instanceMatrix.needsUpdate = true;
  if (stones.instanceColor) {
    stones.instanceColor.needsUpdate = true;
  }
  stones.computeBoundingSphere();
  group.add(stones);

  // ── The sparkle motes. ──
  const motes = buildMotes(def);
  group.add(motes.points);

  // ── The pool of moonlight. ──
  // One soft additive ring on the sand beneath the koi's circle: the light
  // that the night water is holding visibly reaches the ground — a glow
  // that brightens nothing it points at is a decal.
  group.add(buildMoonPool(def));

  // ── Batch 4: the Tier B uplift (MASTER §4 closure, R2 ≤ +6 / ≤ 20k) ──
  // The T1 statement in the lagoon's own silver: a moon-grass blade carpet
  // over the basin floor — pale lavender-silver, tips toward the moonlit
  // crown, sway barely above stillness (serenity is the register). Every
  // blade tops out far under the koi circle's 1.25 m ceiling, and the
  // moon pool's mirror stays bare. Fresh `^` substream, kit-private
  // Random, appended after every wave-8 draw.
  const uplift = new Group();
  uplift.name = TIERB_GROUP_NAME;
  const poolX = axisX * MOON_POOL.r;
  const poolZ = axisZ * MOON_POOL.r;
  const moonGrass = buildCarpetField({
    seed: (SEEDS.wingMoonlitLagoon ^ 0xb404) >>> 0,
    palette: { base: 0x8e97b4, tip: 0xcdd3ea, shade: 0x565270 },
    area: { center: [axisX * 40.5, axisZ * 40.5], radius: 7.5 },
    gate: (x, z) => {
      const r = Math.hypot(x, z);
      if (r < 34.5 || r > 47) {
        return 0;
      }
      const away = angleBetween(Math.atan2(z, x), def.azimuth);
      if (away > wedgeHalfAt(def, r) - 0.02) {
        return 0;
      }
      // The mirror stays a mirror: nothing grows through the moon pool.
      if (Math.hypot(x - poolX, z - poolZ) < MOON_POOL.radius + 0.3) {
        return 0;
      }
      // A quiet swim line down the axis, the lagoon's own restraint.
      return Math.abs(x * perpX + z * perpZ) < 1.0 ? 0 : 1;
    },
    ground: seabedHeight,
    count: 220,
    profile: "blade",
    size: [0.3, 0.62],
    swayAmp: 0.015,
  });
  uplift.add(moonGrass.group);

  // ── edges-fix #7: the luminous brim. ──
  // The re-critic's residual: the far crest against the backdrop is "one
  // razor-straight full-width line", and the water band above it reads
  // as sky rather than as the lagoon's own water. The wing's geometry is
  // frozen, so the line is broken with LIGHT instead: a soft silver glow
  // hugging the crest silhouette, brightest exactly on the rim line and
  // dissolved both ways — the moonlit water standing luminous at its own
  // brim, which is the night register's answer to a grass fringe. One
  // draw, no stream consumed (the swell along it is direction-keyed
  // noise), every vertex inside the wedge and far outside the koi band.
  uplift.add(buildBrimGlow(def));
  group.add(uplift);

  // The doorway: a violet-silver gauze hung NARROW — two planes only,
  // their depths sized so every vertex stands radially short of the koi's
  // circle (r 36; the circle's law reads every world vertex and this veil
  // never enters it) — with a moon-pale column and a slow dust of pale
  // motes. The stillness promised from the bowl.
  // r3: the gauze read as nearly nothing at the door stand — taller
  // planes, a lighter far ink and a touch more column so the moon-gauze
  // silhouettes against the bright bowl water. Width unchanged: the koi
  // circle stays untouched by geometry.
  const veil = mountGateVeil(def, {
    doorR: 32,
    width: 1.85,
    height: 4.6,
    sillLift: -0.6,
    palette: [0x342e48, 0x6a6690],
    column: { tint: 0xe2e6f4, opacity: 0.1 },
    particulate: { tint: 0xdadff0, count: 50 },
  });
  group.add(veil.group);

  let kitTime = 0;
  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      tufts.update(dt, reducedMotion);
      motes.update(dt, reducedMotion);
      kitTime += dt * (reducedMotion ? 0.3 : 1);
      moonGrass.update(kitTime);
      veil.update(dt, reducedMotion);
    },
  };
}

/**
 * The brim glow (edges-fix #7): one arc of soft additive silver hugging
 * the far crest, peak alpha on the rim line itself, dissolved upward
 * into the water band and downward into the crater wall — plus a slow
 * swell along its run so the brim breathes instead of ruling a line.
 */
function buildBrimGlow(def: WingDef): Mesh {
  const columns = 28;
  const r = 49.4;
  /** Lift over the sampled crest → alpha; the rim row carries the peak. */
  const rows: readonly (readonly [number, number])[] = [
    [-1.1, 0],
    [0.05, 0.5],
    [1.3, 0.2],
    [3.0, 0],
  ];

  const positions = new Float32Array((columns + 1) * rows.length * 3);
  const colors = new Float32Array((columns + 1) * rows.length * 4);
  const indices: number[] = [];
  for (let c = 0; c <= columns; c++) {
    const t = c / columns;
    const half = wedgeHalfAt(def, r) - 0.012;
    const theta = def.azimuth + (t * 2 - 1) * half;
    const dx = Math.cos(theta);
    const dz = Math.sin(theta);
    // The crest the glow hugs: the highest ground across the rim band.
    let crest = -Infinity;
    for (const sample of [48.5, 50, 51.5]) {
      crest = Math.max(crest, seabedHeight(dx * sample, dz * sample));
    }
    const swell =
      fbm(t * 4 + 2, 0.37, { seed: SEEDS.wingMoonlitLagoon ^ 0xb70e, period: 3, octaves: 2 }) -
      0.5;
    // The cut ends dissolve into the walls, never onto them.
    const endEase = smooth01(t / 0.12) * smooth01((1 - t) / 0.12);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const [lift, alpha] = rows[rowIndex]!;
      const vertex = c * rows.length + rowIndex;
      positions[vertex * 3] = dx * r;
      positions[vertex * 3 + 1] = crest + lift * (0.9 + swell * 0.5);
      positions[vertex * 3 + 2] = dz * r;
      colors[vertex * 4] = 1;
      colors[vertex * 4 + 1] = 1;
      colors[vertex * 4 + 2] = 1;
      colors[vertex * 4 + 3] = alpha * (0.85 + swell * 0.5) * endEase;
    }
    if (c > 0) {
      for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex++) {
        const a = (c - 1) * rows.length + rowIndex;
        const b = c * rows.length + rowIndex;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("color", new BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({
      color: 0xbfd0f2,
      vertexColors: true,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      fog: false,
    }),
  );
  mesh.name = "moonlit-brim-glow";
  mesh.renderOrder = 1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/** Water-worn: low gentle noise, because the lagoon is where nothing is rough. */
function softenStone(geometry: IcosahedronGeometry, seed: number): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const lump = fbm(x * 0.4 + 0.5, z * 0.4 + y * 0.25, { seed, period: 3, octaves: 2 }) - 0.5;
    const scale = 1 + lump * 0.22;
    position.setXYZ(i, x * scale, y * (1 + lump * 0.14), z * scale);
  }
  position.needsUpdate = true;
}

/** Moonlit silver: a cool pale base climbing to an almost-white crown. */
function silverStone(geometry: IcosahedronGeometry): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }
  const colors = new Float32Array(position.count * 3);
  const base = new Color(0x8d99a8);
  const crown = new Color(0xdfe8ee);
  const tint = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) * 0.5 + 0.5));
    tint.copy(base).lerp(crown, t * t);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

interface Motes {
  readonly points: Points;
  update(dt: number, reducedMotion: boolean): void;
}

/**
 * Dust in moonlight: tiny bright motes drifting almost imperceptibly, each
 * riding its own slow twinkle so the field never beats on one metronome.
 * The reef's `Particles` idiom — additive points, the twinkle carried in a
 * per-point colour attribute — scattered through the wing's water column,
 * hugging the floor inside the koi's circle.
 */
function buildMotes(def: WingDef): Motes {
  const random = new Random(SEEDS.wingMoonlitLagoon ^ 0x7e55);
  const basePositions = new Float32Array(MOTE_COUNT * 3);

  for (let i = 0; i < MOTE_COUNT; i++) {
    const r = random.range(33, 47.5);
    const away = random.signed(wedgeHalfAt(def, r) - 0.02);
    const x = Math.cos(def.azimuth + away) * r;
    const z = Math.sin(def.azimuth + away) * r;
    const floor = seabedHeight(x, z);
    const inCircle = r >= KOI_BAND.from && r <= KOI_BAND.to;
    basePositions[i * 3] = x;
    basePositions[i * 3 + 1] = floor + (inCircle ? random.range(0.25, 1.1) : random.range(0.4, 3.4));
    basePositions[i * 3 + 2] = z;
  }

  // Drawn after every position rather than interleaved with them, so the
  // twinkle never re-rolls the drift field it rides on.
  const phases = new Float32Array(MOTE_COUNT);
  const rates = new Float32Array(MOTE_COUNT);
  for (let i = 0; i < MOTE_COUNT; i++) {
    phases[i] = random.range(0, Math.PI * 2);
    rates[i] = random.range(TWINKLE_RATE_MIN, TWINKLE_RATE_MAX);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(basePositions.slice(), 3));
  geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(MOTE_COUNT * 3).fill(1), 3),
  );
  geometry.computeBoundingSphere();

  const material = new PointsMaterial({
    color: 0xdce8f8,
    size: 0.075,
    map: moteSprite(),
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
    fog: false,
  });
  const points = new Points(geometry, material);
  points.name = "moonlit-motes";

  let time = 0;
  return {
    points,
    update(dt: number, reducedMotion: boolean): void {
      time += dt * (reducedMotion ? 0.2 : 1);
      const attribute = geometry.getAttribute("position") as BufferAttribute;
      const shade = geometry.getAttribute("color") as BufferAttribute;
      const array = attribute.array as Float32Array;
      const levels = shade.array as Float32Array;
      for (let i = 0; i < MOTE_COUNT; i++) {
        const bx = basePositions[i * 3] ?? 0;
        const by = basePositions[i * 3 + 1] ?? 0;
        const bz = basePositions[i * 3 + 2] ?? 0;
        array[i * 3] = bx + Math.sin(time * 0.14 + i) * 0.22;
        array[i * 3 + 1] = by + Math.sin(time * 0.11 + i * 0.5) * 0.16;
        array[i * 3 + 2] = bz + Math.cos(time * 0.12 + i) * 0.22;

        const level =
          TWINKLE_FLOOR +
          (1 - TWINKLE_FLOOR) * (0.5 + 0.5 * Math.sin(time * (rates[i] ?? 1) + (phases[i] ?? 0)));
        levels[i * 3] = level;
        levels[i * 3 + 1] = level;
        levels[i * 3 + 2] = level;
      }
      attribute.needsUpdate = true;
      shade.needsUpdate = true;
    },
  };
}

/**
 * The pool of moonlight under the koi's circle: a soft radial glow hugging
 * the carved floor, its edge dissolved into the sand by the vertex bake.
 */
function buildMoonPool(def: WingDef): Mesh {
  const x = Math.cos(def.azimuth) * MOON_POOL.r;
  const z = Math.sin(def.azimuth) * MOON_POOL.r;
  const geometry = new RingGeometry(0, POOL_GLOW_RADIUS, 40, 5);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  if (position) {
    const fade = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const localX = position.getX(i);
      const localZ = position.getZ(i);
      position.setY(i, seabedHeight(x + localX, z + localZ) + 0.06);
      const edge = 1 - smooth01((Math.hypot(localX, localZ) / POOL_GLOW_RADIUS - 0.35) / 0.65);
      fade[i * 3] = edge;
      fade[i * 3 + 1] = edge;
      fade[i * 3 + 2] = edge;
    }
    position.needsUpdate = true;
    geometry.setAttribute("color", new BufferAttribute(fade, 3));
  }
  geometry.translate(x, 0, z);
  geometry.computeBoundingSphere();

  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({
      map: poolSprite(),
      color: 0xaebfe8,
      vertexColors: true,
      transparent: true,
      opacity: POOL_GLOW_OPACITY,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  mesh.name = "moonlit-pool";
  mesh.renderOrder = 1;
  return mesh;
}

/** A soft round mote: opaque core fading to nothing at the rim. */
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

/** The pool's soft radial glow, wobbled so its rim is not a circle. */
let poolSpriteTexture: ReturnType<typeof buildColorTexture> | undefined;
function poolSprite(): ReturnType<typeof buildColorTexture> {
  poolSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const wobble = fbm(u, v, { seed: SEEDS.wingMoonlitLagoon ^ 0x9001, period: 3, octaves: 2 });
    const rim = Math.hypot(u - 0.5, v - 0.5) * 2;
    const distance = Math.min(1, rim * (0.86 + 0.3 * wobble));
    const halo = Math.pow(Math.max(0, 1 - distance * distance), 2.4);
    return [halo, halo, halo];
  });
  return poolSpriteTexture;
}

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}
