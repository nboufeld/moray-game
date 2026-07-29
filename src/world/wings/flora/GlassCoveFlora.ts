import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Object3D,
  Points,
  PointsMaterial,
  SphereGeometry,
  type MeshToonMaterial,
} from "three";
import { coralGeometry, coralSkin } from "../../CoralShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { WingDef, WingFlora } from "../WingTypes";
import {
  drawFloorSpot,
  drawGateSpot,
  floorWindowHalf,
  glintStarSprite,
  swayClock,
  wingFrame,
} from "./W3FloraKit";

/**
 * Wing 6 — the Sea-Glass Cove (worker W3). A tide-pool toybox at swimming
 * size: drifts of tumbled glass pebbles in pastel aquas, pinks, seafoam and
 * amber, banked into dunes and tide-lines the way real sea glass collects;
 * a few glossy-pale boulders; and sun glints winking slowly over the
 * drifts. The water is at its clearest here (`GLASS_COVE.mood`), so the
 * pastels read at distance.
 *
 * ## The composition
 *
 * The Kraken Hatchling dens on the axis near r ≈ 40 (another worker's
 * animal), so the cove's prettiest drift — the grand drift, two banks of
 * the largest, brightest pebbles — stands around r 38–42 in two lobes
 * either side of it. Every mark keeps a 3 m clearing off the axis through
 * the whole approach corridor (r 30–46), which is stricter than the
 * corridor's own 0.06 rad: the doorway the hatchling peeks out of is open
 * water framed by glass on both banks.
 *
 * ## The glass read, in toon
 *
 * Tumbled glass is frosted, not glossy — light goes *into* it a little and
 * comes back coloured. The toon ramp has no transmission, so the pebbles
 * borrow the abyss polyps' trick instead: a faint emissive (0.12, far under
 * the bloom pass's 0.82) multiplied by the instance colour in the shader,
 * so each pebble glows its own pastel from within and the drifts read as
 * glass rather than as painted gravel. Value variety (×0.86–1.14, with a
 * ~12% "gem" minority at ×1.3) is the sparkle the eye finds in a drift.
 *
 * Seeds: `SEEDS.wingGlassCove` and `^` substreams only, every draw taken
 * synchronously at build — nothing here loads anything.
 */

/** The pastel families, sea-glass true: aquas and seafoam lead, pink and amber accent. */
const PALETTE = [0x9fe2d8, 0xbdeed9, 0xf6c9d6, 0xf3d09c] as const;
const PALETTE_WEIGHTS = [0.32, 0.3, 0.2, 0.18] as const;

/**
 * The corridor fence, in metres: the 3 m clearing the hatchling's approach
 * keeps, plus a pebble's own girth, so even a pebble's outer face stays
 * outside the corridor's 0.06 rad at the far end of the live band.
 */
const AXIS_CLEAR = 3.15;
/** The gate's fence: the sill's welcome pebbles keep the full 3 m doorway. */
const GATE_CLEAR = 3.0;

/** How much of the cove's pebbles are the gem minority. */
const GEM_ODDS = 0.12;
const GEM_LIFT = 1.3;

/** The emissive that puts light inside the glass; see the module header. */
const GLASS_GLOW = 0.12;

/** The glint cloud's size: a wink of light, never a lens flare. */
const GLINT_COUNT = 46;
const GLINT_SIZE = 0.22;

interface PebblePart {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rx: number;
  readonly ry: number;
  readonly rz: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly tint: Color;
}

/** One pebble, from position through tint, on whichever stream the caller hands in. */
function drawPebble(
  random: Random,
  x: number,
  z: number,
  sizeMin: number,
  sizeMax: number,
): PebblePart {
  const y = seabedHeight(x, z) + random.range(0, 0.05);
  const rx = random.range(0, Math.PI);
  const ry = random.range(0, Math.PI);
  const rz = random.range(0, Math.PI);
  const size = random.range(sizeMin, sizeMax);
  // Settled, not dropped: every pebble lies a little flatter than it is wide.
  const sy = size * random.range(0.45, 0.72);
  const pick = random.next();
  const value = random.range(0.86, 1.14);
  const gem = random.next() < GEM_ODDS;

  let cumulative = 0;
  let family: number = PALETTE[0];
  for (let i = 0; i < PALETTE.length; i++) {
    cumulative += PALETTE_WEIGHTS[i]!;
    if (pick < cumulative) {
      family = PALETTE[i]!;
      break;
    }
  }
  const tint = new Color(family).multiplyScalar(gem ? value * GEM_LIFT : value);
  return { x, y, z, rx, ry, rz, sx: size, sy, sz: size * random.range(0.75, 1), tint };
}

/** The live band's radius: every floor piece stands where the carve is full. */
const BAND_MIN = 34.2;
const BAND_MAX = 45.8;

function clampBand(r: number): number {
  return Math.min(BAND_MAX, Math.max(BAND_MIN, r));
}

/**
 * A bank of pebbles. The cove's floor band is a narrow ribbon — the 3 m
 * corridor fence inside, the wedge's shoulder outside — so a bank is a
 * crest *along* it: a radial string with a dense heart and soft ends, each
 * pebble drawing its own lateral inside the window at its own radius. Tide
 * glass drifts exactly this way, in long wrack lines following the shore.
 */
function drawBank(
  random: Random,
  def: WingDef,
  frame: ReturnType<typeof wingFrame>,
  rMin: number,
  rMax: number,
  count: number,
  sizeMin: number,
  sizeMax: number,
  out: PebblePart[],
): void {
  const centre = random.range(rMin, rMax);
  const halfLength = random.range(1.4, 2.4);
  for (let i = 0; i < count; i++) {
    const r = clampBand(centre + (random.next() + random.next() - 1) * halfLength);
    const side = random.next() < 0.5 ? -1 : 1;
    const lateral = side * random.range(AXIS_CLEAR, floorWindowHalf(def, r));
    const x = frame.axisX * r + frame.perpX * lateral;
    const z = frame.axisZ * r + frame.perpZ * lateral;
    out.push(drawPebble(random, x, z, sizeMin, sizeMax));
  }
}

/** A tide-line: a thin concentric arc of strays, on both banks at once. */
function drawLine(
  random: Random,
  def: WingDef,
  frame: ReturnType<typeof wingFrame>,
  r: number,
  count: number,
  out: PebblePart[],
): void {
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const jitter = random.signed(0.22);
    const hi = floorWindowHalf(def, r + jitter);
    const lateral = side * random.range(AXIS_CLEAR, hi);
    const x = frame.axisX * (r + jitter) + frame.perpX * lateral;
    const z = frame.axisZ * (r + jitter) + frame.perpZ * lateral;
    out.push(drawPebble(random, x, z, 0.42, 0.8));
  }
}

function fillInstances(
  mesh: InstancedMesh,
  parts: readonly PebblePart[],
): void {
  const dummy = new Object3D();
  parts.forEach((part, index) => {
    dummy.position.set(part.x, part.y, part.z);
    dummy.rotation.set(part.rx, part.ry, part.rz);
    dummy.scale.set(part.sx, part.sy, part.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    mesh.setColorAt(index, part.tint);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

export function buildGlassCoveFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "w3-glass-cove";
  const frame = wingFrame(def);
  const contacts: ContactPatch[] = [];

  /* ------------------------------------------------------------------ *
   *  The pebble drifts — one material, two silhouettes, two draws.
   * ------------------------------------------------------------------ */

  // The shared glass: white under the instance pastels, with the faint
  // inner light the emissive-by-instance-colour patch shapes per pebble.
  const glassMaterial: MeshToonMaterial = createToonMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: GLASS_GLOW,
  });
  glassMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
       totalEmissiveRadiance *= vColor;`,
    );
  };

  const dodeca: PebblePart[] = [];
  const spheres: PebblePart[] = [];

  // The gate's welcome scatter — two handfuls of pebbles, each on its own
  // spot on the sill's shoulders, the doorway's full 3 m kept between them.
  const gate = new Random(SEEDS[def.seedKey] ^ 0x0a7e);
  for (let cluster = 0; cluster < 2; cluster++) {
    for (let i = 0; i < 12; i++) {
      const spot = drawGateSpot(gate, def, frame, 31.6, 33.4, GATE_CLEAR);
      dodeca.push(drawPebble(gate, spot.x, spot.z, 0.4, 0.75));
    }
    for (let i = 0; i < 4; i++) {
      const spot = drawGateSpot(gate, def, frame, 31.6, 33.4, GATE_CLEAR);
      spheres.push(drawPebble(gate, spot.x, spot.z, 0.38, 0.66));
    }
  }

  // Six banks strung down the cove, alternating sides as the draws fall.
  const banks = new Random(SEEDS[def.seedKey] ^ 0x0ba9);
  const bankRadii: readonly [number, number][] = [
    [35, 36.4],
    [36.6, 37.8],
    [42.4, 43.6],
    [43.8, 45],
    [37.2, 38.2],
    [41.2, 42.2],
  ];
  for (const [rMin, rMax] of bankRadii) {
    drawBank(banks, def, frame, rMin, rMax, 26, 0.45, 0.9, dodeca);
    drawBank(banks, def, frame, rMin, rMax, 10, 0.4, 0.78, spheres);
  }

  // The grand drift (r 38–42, both lobes): the largest and brightest glass,
  // banked highest where the hatchling's neighbours look out at it.
  const grand = new Random(SEEDS[def.seedKey] ^ 0x09ad);
  for (const rBand of [38.2, 40.8] as const) {
    drawBank(grand, def, frame, rBand, rBand + 1.4, 48, 0.6, 1.15, dodeca);
    drawBank(grand, def, frame, rBand, rBand + 1.4, 30, 0.5, 0.95, spheres);
  }

  // Three tide-lines of strays trailing the banks.
  const lines = new Random(SEEDS[def.seedKey] ^ 0x01fe);
  for (const r of [35.6, 41.8, 44.6] as const) {
    drawLine(lines, def, frame, r, 8, dodeca);
    drawLine(lines, def, frame, r, 4, spheres);
  }

  // Smooth, like the reef's own rubble: a dodecahedron at detail 0 carries
  // face normals until they are welded, and tumbled glass has no facets.
  const dodecaGeometry = new DodecahedronGeometry(0.24, 0);
  smoothNormals(dodecaGeometry);
  const dodecaMesh = new InstancedMesh(dodecaGeometry, glassMaterial, dodeca.length);
  dodecaMesh.name = "w3-glass-drift-dodeca";
  dodecaMesh.userData.floorBound = "foot";
  dodecaMesh.receiveShadow = true;
  // No cast shadow on smallwork — the contact shadow would outsize the pebble.
  dodecaMesh.castShadow = false;
  fillInstances(dodecaMesh, dodeca);
  group.add(dodecaMesh);

  const sphereGeometry = new SphereGeometry(0.15, 6, 4);
  const sphereMesh = new InstancedMesh(sphereGeometry, glassMaterial, spheres.length);
  sphereMesh.name = "w3-glass-drift-sphere";
  sphereMesh.userData.floorBound = "foot";
  sphereMesh.receiveShadow = true;
  sphereMesh.castShadow = false;
  fillInstances(sphereMesh, spheres);
  group.add(sphereMesh);

  /* ------------------------------------------------------------------ *
   *  The boulders — five glossy-pale anchor stones among the glass.
   * ------------------------------------------------------------------ */

  const boulders = new Random(SEEDS[def.seedKey] ^ 0x0b01);
  const boulderParts: PebblePart[] = [];
  for (let i = 0; i < 5; i++) {
    // Scale first, then the fence: a boulder keeps the full 3 m clearing
    // with its own girth accounted for, not just its centre.
    const scale = boulders.range(0.95, 1.45);
    const spot = drawFloorSpot(boulders, def, frame, 41, 45, 3.1 + 0.62 * scale);
    const y = seabedHeight(spot.x, spot.z) + 0.62 * scale * 0.55;
    const ry = boulders.range(0, Math.PI * 2);
    const rx = boulders.signed(0.1);
    const rz = boulders.signed(0.1);
    // Near-white with a whisper of the drift's own palette.
    const tint = new Color(0xf6f3ec)
      .lerp(new Color(PALETTE[i % PALETTE.length]!), 0.22)
      .multiplyScalar(boulders.range(0.94, 1.04));
    boulderParts.push({ x: spot.x, y, z: spot.z, rx, ry, rz, sx: scale, sy: scale * 0.82, sz: scale, tint });
    contacts.push({ x: spot.x, z: spot.z, radius: 0.62 * scale * 1.5, strength: 0.42 });
  }
  const boulderSkin = coralSkin("boulder");
  const boulderMaterial = createToonMaterial({
    color: 0xffffff,
    map: boulderSkin.map,
    normalMap: boulderSkin.normal,
  });
  const boulderMesh = new InstancedMesh(coralGeometry("boulder"), boulderMaterial, boulderParts.length);
  boulderMesh.name = "w3-glass-boulders";
  boulderMesh.userData.floorBound = "rest";
  boulderMesh.receiveShadow = true;
  boulderMesh.castShadow = false;
  fillInstances(boulderMesh, boulderParts);
  group.add(boulderMesh);

  /* ------------------------------------------------------------------ *
   *  The glints — slow sun winks hovering over the drifts.
   * ------------------------------------------------------------------ */

  const glintStream = new Random(SEEDS[def.seedKey] ^ 0x9117);
  const glintPositions = new Float32Array(GLINT_COUNT * 3);
  const glintColors = new Float32Array(GLINT_COUNT * 3);
  const glintBase = new Float32Array(GLINT_COUNT);
  const glintRate = new Float32Array(GLINT_COUNT);
  const glintPhase = new Float32Array(GLINT_COUNT);
  for (let i = 0; i < GLINT_COUNT; i++) {
    const spot = drawFloorSpot(glintStream, def, frame, 34.5, 45.5, AXIS_CLEAR, 0);
    glintPositions[i * 3] = spot.x;
    glintPositions[i * 3 + 1] = seabedHeight(spot.x, spot.z) + glintStream.range(0.1, 0.4);
    glintPositions[i * 3 + 2] = spot.z;
    const base = glintStream.range(0.45, 1);
    glintBase[i] = base;
    glintRate[i] = glintStream.range(0.4, 0.9);
    glintPhase[i] = glintStream.range(0, Math.PI * 2);
    glintColors[i * 3] = base;
    glintColors[i * 3 + 1] = base;
    glintColors[i * 3 + 2] = base;
  }
  const glintGeometry = new BufferGeometry();
  glintGeometry.setAttribute("position", new BufferAttribute(glintPositions, 3));
  glintGeometry.setAttribute("color", new BufferAttribute(glintColors, 3));
  glintGeometry.computeBoundingSphere();
  const glintMaterial = new PointsMaterial({
    color: 0xfff6e2,
    size: GLINT_SIZE,
    map: glintStarSprite(),
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.6,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const glints = new Points(glintGeometry, glintMaterial);
  glints.name = "w3-glass-glints";
  glints.userData.floorBound = "no";
  group.add(glints);

  const clock = swayClock();
  let calmScale = 1;
  const update = (dt: number, reducedMotion: boolean): void => {
    clock.advance(dt, reducedMotion, 0.25);
    calmScale = reducedMotion ? 0.65 : 1;
    const attribute = glintGeometry.attributes.color as BufferAttribute | undefined;
    if (!attribute) {
      return;
    }
    for (let i = 0; i < GLINT_COUNT; i++) {
      // A slow, sharp twinkle: dark most of the cycle, a brief bright wink.
      const wave = 0.5 + 0.5 * Math.sin(clock.time.value * glintRate[i]! + glintPhase[i]!);
      const twinkle = (0.3 + 0.7 * wave * wave * wave) * calmScale;
      const value = glintBase[i]! * twinkle;
      attribute.setXYZ(i, value, value, value);
    }
    attribute.needsUpdate = true;
  };

  return { group, contacts, update };
}
