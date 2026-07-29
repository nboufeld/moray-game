import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  type BufferGeometry,
  type DataTexture,
  type Mesh,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView } from "../../SeaGrass";
import {
  CURTAIN_TONES,
  FERN_TONES,
  SHADOW_VIOLET,
  TIP_GOLD,
  VIRIDIAN_TONES,
  bakeSwayAttributes,
  injectHangingSway,
  mergedMesh,
  smoothstep01,
  type SwayUniforms,
} from "./Verdant2Shared";
import {
  CISTERN,
  FERN_VAULT,
  MISTFALL,
  cisternWeight,
  gardenTerraces,
  mistfallDrop,
  stairChannelCenter,
  stairChannelHalf,
  stepFootU,
  vaultWeight,
  worldOf,
} from "./Verdant2Terrain";

/**
 * The Hanging Gardens — every growing thing in the Emerald Terraces.
 *
 * Three idioms, none copied from upstream:
 *
 * - **Vine-fall curtains**: ribbons anchored at terrace lips, hanging
 *   *down* the riser faces — the inverted kelp. The sway reaches its
 *   maximum at the free hem, and the paint inverts the kelp sea's value
 *   scheme too: bright gold-green at the lit anchor, deepening through
 *   the family green to a violet-leaned hem in the face's shade (red
 *   above green — the darkest mark on a curtain is a colour).
 * - **Fern-kelp**: arching serrated fronds from a root crown — giants in
 *   the Fern Vault reaching for the stone shelf, smaller kin scattered
 *   over the garden treads.
 * - **Terrace turf**: the meadow-blade idiom in this country's own
 *   emerald/celadon families, drifted in patches over treads.
 *
 * Curtain and fern geometry is merged per area chunk for frustum
 * culling; turf is one instanced draw. Streams: anchors `SEED ^ 0x1e11`,
 * ribbons `^ 0x51ac`, ferns `^ 0xca9f`, turf `^ 0x9eae/^ 0x9e38`.
 */

const SEED = SEEDS.regionVerdant2;

export interface Verdant2GardensBuild {
  readonly meshes: (Mesh | InstancedMesh)[];
  readonly contacts: ContactPatch[];
  update(dt: number, reducedMotion: boolean): void;
}

interface Chunk {
  readonly parts: BufferGeometry[];
}

export function buildVerdant2Gardens(): Verdant2GardensBuild {
  const anchorRandom = new Random(SEED ^ 0x1e11);
  const ribbonRandom = new Random(SEED ^ 0x51ac);
  const fernRandom = new Random(SEED ^ 0xca9f);

  const sway: SwayUniforms = { sway: { value: 0 }, wind: { value: 1 } };
  const contacts: ContactPatch[] = [];

  const chunks: Record<string, Chunk> = {
    pass: { parts: [] },
    west: { parts: [] },
    east: { parts: [] },
    deep: { parts: [] },
  };

  // ─── The stair's ledge curtains ──────────────────────────────────────────
  // Every riser crest grows a run of ribbons across the channel: the
  // gardens deepen step by step, so the runs thicken and lengthen as the
  // stair descends.
  for (let step = 0; step < 8; step++) {
    const lipU = stepFootU(step) - 4.9;
    const lush = step / 7;
    const count = Math.round(5 + lush * 9);
    for (let i = 0; i < count; i++) {
      const v =
        stairChannelCenter(lipU) +
        anchorRandom.signed(stairChannelHalf(lipU) + 2.5);
      growCurtain(
        chunks.pass!,
        ribbonRandom,
        lipU + anchorRandom.signed(1.0),
        v,
        anchorRandom.range(2.2, 3.4 + lush * 1.4),
        CURTAIN_TONES,
      );
    }
  }
  // The gate jambs' drapes.
  for (const side of [-1, 1]) {
    const u = 735 + side;
    const v = stairChannelCenter(u) + side * (stairChannelHalf(u) + 0.5);
    for (let i = 0; i < 4; i++) {
      growCurtain(
        chunks.pass!,
        ribbonRandom,
        u + anchorRandom.signed(0.8),
        v + anchorRandom.signed(1.2),
        anchorRandom.range(2.4, 4.2),
        VIRIDIAN_TONES,
        4.6,
      );
    }
  }

  // ─── The garden terraces' curtains ───────────────────────────────────────
  // The heart of the region: ribbons hung along the terrace riser
  // contours, found by walking each contour line laterally.
  for (const [t, edge] of [10, 44, 82].entries()) {
    for (let k = 0; k < 34; k++) {
      const v = -78 + k * 4.6 + anchorRandom.signed(1.8);
      const u = contourU(edge, v);
      if (u === null) {
        continue;
      }
      if (cisternWeight(u, v) > 0.35 || vaultWeight(u, v) > 0.4) {
        continue;
      }
      if (mistfallDrop(u - 4, v) > 0.1) {
        continue;
      }
      // Anchor a hair up-slope of the riser crest, hem hanging past the
      // foot.
      const chunk = v < -10 ? chunks.west! : chunks.east!;
      growCurtain(
        chunk,
        ribbonRandom,
        u - 1.2,
        v,
        anchorRandom.range(3.2, 5.2),
        t % 2 === 0 ? CURTAIN_TONES : VIRIDIAN_TONES,
      );
    }
  }

  // ─── The grotto's green curtain ──────────────────────────────────────────
  // The landmark drape: a dense fall of long ribbons over the grotto's
  // mouth at (893, 26), parted just enough to swim through.
  for (let i = 0; i < 12; i++) {
    const v = 26 + (i - 5.5) * 0.9;
    if (Math.abs(v - 24.4) < 1.1) {
      continue; // the part the Warden swims through
    }
    growCurtain(
      chunks.east!,
      ribbonRandom,
      891.4 + anchorRandom.signed(0.5),
      v,
      anchorRandom.range(3.4, 4.6),
      CURTAIN_TONES,
      4.4,
    );
  }

  // ─── The Cistern rim's old gardens ───────────────────────────────────────
  // Short curtains hung from the worked rim ring — the oldest gardens,
  // draped over built stone.
  for (let i = 0; i < 16; i++) {
    const theta = anchorRandom.range(0, Math.PI * 2);
    const d = anchorRandom.range(33, 39);
    growCurtain(
      chunks.east!,
      ribbonRandom,
      CISTERN.u + Math.cos(theta) * d,
      CISTERN.v + Math.sin(theta) * d,
      anchorRandom.range(1.8, 3.0),
      VIRIDIAN_TONES,
    );
  }

  // ─── The Mistfall lip's long falls ───────────────────────────────────────
  // The longest ribbons in the region hang beside the silt-fall, so the
  // living green and the falling milk read as one cliff-face event.
  for (let i = 0; i < 14; i++) {
    const v = MISTFALL.v + (i - 6.5) * 3.4 + anchorRandom.signed(1.2);
    if (Math.abs(v - MISTFALL.v) < 9) {
      continue; // the fall itself owns the centre
    }
    const lipU = MISTFALL.u + 9 * Math.sin(v * 0.021 + 0.7);
    growCurtain(
      chunks.deep!,
      ribbonRandom,
      lipU - 1.0,
      v,
      anchorRandom.range(5.0, 8.5),
      CURTAIN_TONES,
    );
  }

  // ─── The ferns ───────────────────────────────────────────────────────────
  // Giants in the vault, reaching for the shelf; smaller kin on the
  // treads and along the balcony's inner edge.
  for (let i = 0; i < 11; i++) {
    const theta = fernRandom.range(0, Math.PI * 2);
    const d = Math.sqrt(fernRandom.next()) * 16;
    const u = FERN_VAULT.u + Math.cos(theta) * d;
    const v = FERN_VAULT.v + Math.sin(theta) * d * 0.9;
    growFern(chunks.west!, fernRandom, u, v, fernRandom.range(4.2, 6.4), FERN_TONES, contacts);
  }
  for (let i = 0; i < 9; i++) {
    const u = 838 + fernRandom.range(0, 130);
    const v = -60 + fernRandom.range(0, 120);
    if (vaultWeight(u, v) > 0.3 || cisternWeight(u, v) > 0.3 || mistfallDrop(u, v) > 0.05) {
      continue;
    }
    const chunk = v < -10 ? chunks.west! : chunks.east!;
    growFern(chunk, fernRandom, u, v, fernRandom.range(2.0, 3.4), VIRIDIAN_TONES, contacts);
  }
  // Two authored ferns flanking the balcony's landward approach.
  growFern(chunks.deep!, fernRandom, 1046, 34, 2.8, FERN_TONES, contacts);
  growFern(chunks.deep!, fernRandom, 1049, 52, 2.4, FERN_TONES, contacts);

  // ─── The meshes ──────────────────────────────────────────────────────────
  const meshes: (Mesh | InstancedMesh)[] = [];
  const sunView = createSunViewUniform();
  const material = curtainMaterial(sway, sunView);
  for (const [name, chunk] of Object.entries(chunks)) {
    if (chunk.parts.length === 0) {
      continue;
    }
    const mesh = mergedMesh(chunk.parts, material, `verdant2-gardens-${name}`);
    trackSunView(mesh, sunView);
    meshes.push(mesh);
  }

  const turf = buildTurf(sway, sunView);
  meshes.push(turf);

  return {
    meshes,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      sway.sway.value += dt * (reducedMotion ? 0.3 : 1);
      sway.wind.value = reducedMotion ? 0.4 : 1;
    },
  };
}

/**
 * Solves the garden terrace contour `tc = edge` for `u` at a lateral
 * `v` — two fixed-point steps on the terrain module's own expression.
 * Returns null outside the gardens' band.
 */
function contourU(edge: number, v: number): number | null {
  let u = 830 + edge / 0.92;
  for (let i = 0; i < 3; i++) {
    u = 830 + (edge - v * 0.22 - 13 * Math.sin(v * 0.024 + 1.4) - 6 * Math.sin(u * 0.017)) / 0.92;
  }
  if (u < 838 || u > 990) {
    return null;
  }
  return u;
}

// ─── One curtain ─────────────────────────────────────────────────────────────

/**
 * A vine-fall: 2–4 ribbons sharing one anchor on a lip, hanging down the
 * face with a drift-shaped belly. The value story runs top-lit to
 * violet-shadow hem.
 */
function growCurtain(
  chunk: Chunk,
  random: Random,
  u: number,
  v: number,
  length: number,
  tones: readonly number[],
  anchorLift = 0.3,
): void {
  const { x, z } = worldOf(u, v);
  const top = seabedHeight(x, z) + anchorLift;
  const phase = random.range(0, Math.PI * 2);
  const strands = 2 + Math.floor(random.next() * 3);
  for (let s = 0; s < strands; s++) {
    const ribbon = ribbonGeometry(
      length * random.range(0.75, 1.1),
      random.range(0.22, 0.42),
      tones[Math.floor(random.next() * tones.length)]!,
      random,
    );
    ribbon.rotateY(random.range(0, Math.PI * 2));
    ribbon.translate(x + random.signed(0.5), top, z + random.signed(0.5));
    bakeSwayAttributes(ribbon, phase + s * 0.7, length * 0.09, (y) =>
      Math.min(1, Math.max(0, (top - y) / Math.max(1, length))),
    );
    chunk.parts.push(ribbon);
  }
}

/**
 * One hanging ribbon: a 2×9 plane draped downward with a drift belly,
 * ruffled margins and a soft point. Painted gold-lit at the anchor,
 * family green through the body, violet-leaned at the hem.
 */
function ribbonGeometry(
  length: number,
  width: number,
  tone: number,
  random: Random,
): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1, 2, 9);
  const position = geometry.attributes.position!;

  const belly = random.range(0.18, 0.45) * length;
  const bellyAt = random.range(0.45, 0.7);
  const marginFreq = random.range(1.8, 3.2);
  const marginPhase = random.range(0, Math.PI * 2);
  const twist = random.signed(0.7);

  const tint = new Color(tone).multiplyScalar(random.range(0.85, 1.12));
  const lit = tint.clone().lerp(TIP_GOLD, 0.45).multiplyScalar(1.12);
  const hem = tint.clone().lerp(SHADOW_VIOLET, 0.55).multiplyScalar(0.8);
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    // v runs 0 at the anchor to 1 at the hem.
    const t = 0.5 - position.getY(i);
    const edge = position.getX(i) * 2;
    const wave = 1 - 0.14 * (0.5 + 0.5 * Math.sin(t * marginFreq * Math.PI * 2 + marginPhase));
    const half = Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.92)) ** 0.5 * wave;
    const across = edge * half * 0.5 * width;
    const bellyOut = Math.sin(Math.PI * Math.min(1, t / bellyAt) * 0.5) * belly * smoothstep01(t / 0.25);
    const spin = twist * t;
    position.setXYZ(
      i,
      across * Math.cos(spin) + bellyOut * 0.55,
      -t * length,
      across * Math.sin(spin) + bellyOut * 0.35,
    );

    shade
      .copy(lit)
      .lerp(tint, smoothstep01(t / 0.35))
      .lerp(hem, smoothstep01((t - 0.55) / 0.4));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

// ─── One fern ────────────────────────────────────────────────────────────────

/**
 * A fern-kelp: 6–9 serrated fronds arching from a root crown. The frond
 * is a bent plane whose margins are notched hard — the serration *is*
 * the silhouette — with a gold midrib and violet-cooled underside base.
 */
function growFern(
  chunk: Chunk,
  random: Random,
  u: number,
  v: number,
  size: number,
  tones: readonly number[],
  contacts: ContactPatch[],
): void {
  const { x, z } = worldOf(u, v);
  const foot = seabedHeight(x, z);
  const phase = random.range(0, Math.PI * 2);
  const fronds = 6 + Math.floor(random.next() * 4);
  for (let i = 0; i < fronds; i++) {
    const around = (i / fronds) * Math.PI * 2 + random.signed(0.4);
    const frond = frondGeometry(
      size * random.range(0.75, 1.05),
      size * random.range(0.16, 0.24),
      random.range(0.9, 1.5),
      tones[i % tones.length]!,
      random,
    );
    frond.rotateY(around);
    frond.translate(x, foot - 0.1, z);
    bakeSwayAttributes(frond, phase + i, size * 0.05, (y) => (y - foot) / Math.max(1, size));
    chunk.parts.push(frond);
  }
  contacts.push({ x, z, radius: size * 0.4, strength: 0.4 });
}

function frondGeometry(
  length: number,
  width: number,
  arch: number,
  tone: number,
  random: Random,
): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1, 2, 8);
  const position = geometry.attributes.position!;

  const serration = random.range(0.26, 0.4);
  const teeth = random.range(7, 10);
  const phase = random.range(0, Math.PI * 2);

  const tint = new Color(tone).multiplyScalar(random.range(0.85, 1.1));
  const rib = tint.clone().lerp(TIP_GOLD, 0.5);
  const base = tint.clone().lerp(SHADOW_VIOLET, 0.4).multiplyScalar(0.78);
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);

  for (let i = 0; i < position.count; i++) {
    const t = position.getY(i) + 0.5;
    const edge = position.getX(i) * 2;
    const notch = 1 - serration * Math.abs(Math.sin(t * teeth * Math.PI + phase));
    const half = Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)) ** 0.7 * notch;
    const across = edge * half * 0.5 * width;
    // The arch: rises steeply then lays over.
    const angle = arch * Math.pow(t, 1.35);
    const along = t * length;
    const up = Math.cos(angle) * along * 0.85 + 0.15;
    const out = Math.sin(angle) * along * 0.9;
    const cup = Math.abs(across) * 0.35;
    position.setXYZ(i, out + cup * Math.sin(angle), up - cup * Math.cos(angle), across);

    const ribness = 1 - Math.min(1, Math.abs(edge) * 2.4);
    shade
      .copy(base)
      .lerp(tint, smoothstep01(t / 0.3))
      .lerp(rib, ribness * 0.5 * t)
      .multiplyScalar(0.86 + t * 0.3);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

// ─── The turf ────────────────────────────────────────────────────────────────

const BLADE_WIDTH = 0.24;
const BLADE_HEIGHT = 1.5;

const TURF_FAMILIES: readonly (readonly number[])[] = [
  [0x63c084, 0x82d48e, 0x4da672],
  [0x9cc86e, 0xb4da7f, 0x7fae60],
  [0x84cfab, 0xa2dfbc, 0x69b995],
];

function buildTurf(
  sway: SwayUniforms,
  sunView: ReturnType<typeof createSunViewUniform>,
): InstancedMesh {
  const random = new Random(SEED ^ 0x9eae);
  const paletteRandom = new Random(SEED ^ 0x9e38);

  const material = createToonMaterial({ side: DoubleSide, map: bladeTexture() });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSway = sway.sway;
    shader.uniforms.uWind = sway.wind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSway;
         uniform float uWind;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float phase = instanceMatrix[3][0] * 0.6 + instanceMatrix[3][2] * 0.43;
         float tip = clamp(transformed.y / ${BLADE_HEIGHT.toFixed(2)}, 0.0, 1.0);
         float bend = sin(uSway * 1.2 + phase) * 0.5 + sin(uSway * 0.45 + phase * 1.7) * 0.5;
         transformed.x += bend * 0.14 * uWind * tip * tip;
         transformed.z += bend * 0.08 * uWind * tip * tip;`,
      );
    injectLeafGlow(
      shader,
      sunView,
      "vec3(0.12, 0.24, 0.18)",
      "vec3(0.34, 0.28, 0.1)",
      "clamp(vMapUv.y, 0.0, 1.0)",
    );
  };
  material.customProgramCacheKey = () => "verdant2-turf";

  const capacity = 1500;
  const mesh = new InstancedMesh(bladeGeometry(), material, capacity);
  mesh.name = "verdant2-turf";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  trackSunView(mesh, sunView);

  const dummy = new Object3D();
  const color = new Color();
  let placed = 0;

  const plant = (u: number, v: number, family: readonly number[], heightScale = 1): void => {
    if (placed >= capacity) {
      return;
    }
    const { x, z } = worldOf(u, v);
    dummy.position.set(x, seabedHeight(x, z) - 0.05, z);
    dummy.rotation.set(random.signed(0.12), random.range(0, Math.PI * 2), random.signed(0.12));
    dummy.scale.set(random.range(0.75, 1.25), random.range(0.55, 1.15) * heightScale, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    color.setHex(family[Math.floor(random.next() * family.length)] ?? family[0]!);
    color.multiplyScalar(random.range(0.88, 1.18));
    mesh.setColorAt(placed, color);
    placed++;
  };

  // Stair treads: a patch below each riser where the light pools.
  for (let step = 0; step < 8; step++) {
    const u = stepFootU(step) + 3.4;
    const family = TURF_FAMILIES[step % TURF_FAMILIES.length]!;
    for (let blade = 0; blade < 26; blade++) {
      const spread = 3.2 * Math.sqrt(random.next());
      const angle = random.range(0, Math.PI * 2);
      plant(
        u + Math.cos(angle) * spread * 0.6,
        stairChannelCenter(u) + random.signed(stairChannelHalf(u) - 2) + Math.sin(angle) * spread * 0.5,
        family,
      );
    }
  }

  // Garden treads: drifts of related colour, never a lawn.
  for (let patch = 0; patch < 26; patch++) {
    const patchU = 838 + random.range(0, 140);
    const patchV = -70 + random.range(0, 130);
    if (
      vaultWeight(patchU, patchV) > 0.3 ||
      cisternWeight(patchU, patchV) > 0.3 ||
      mistfallDrop(patchU, patchV) > 0.05 ||
      gardenTerraces(patchU, patchV).riser > 0.5
    ) {
      continue;
    }
    const family = TURF_FAMILIES[Math.floor(paletteRandom.next() * TURF_FAMILIES.length)]!;
    for (let blade = 0; blade < 30; blade++) {
      const spread = 3.6 * Math.sqrt(random.next());
      const angle = random.range(0, Math.PI * 2);
      plant(patchU + Math.cos(angle) * spread, patchV + Math.sin(angle) * spread, family);
    }
  }

  // The Cistern's rim lawn: the palest turf, between the worked stones.
  for (let i = 0; i < 180; i++) {
    const theta = random.range(0, Math.PI * 2);
    const d = random.range(26, 34);
    plant(
      CISTERN.u + Math.cos(theta) * d,
      CISTERN.v + Math.sin(theta) * d,
      TURF_FAMILIES[2]!,
      0.9,
    );
  }

  // Park anything unplanted far below the world.
  dummy.position.set(0, -300, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = placed; i < capacity; i++) {
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  return mesh;
}

/** The bowl meadow's blade, at this country's proportions. */
function bladeGeometry(): PlaneGeometry {
  const segments = 4;
  const geometry = new PlaneGeometry(BLADE_WIDTH, BLADE_HEIGHT, 2, segments);
  const position = geometry.attributes.position as BufferAttribute;
  const half = BLADE_WIDTH / 2;
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + BLADE_HEIGHT / 2) / BLADE_HEIGHT;
    const column = position.getX(i) / half;
    const bow = 0.9 * Math.pow(t, 1.7);
    const across = column * half * Math.max(0.05, Math.sin(Math.PI * Math.pow(0.16 + t * 0.84, 0.72)) ** 0.8);
    const cup = (1 - Math.abs(column)) * half * 0.4;
    position.setXYZ(
      i,
      across * Math.cos(0.5 * t),
      t * BLADE_HEIGHT * Math.cos(bow * 0.6) + cup * -Math.sin(bow),
      Math.sin(bow * 0.6) * t * BLADE_HEIGHT + cup * Math.cos(bow) * 0.5 + across * Math.sin(0.5 * t),
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/** Root-to-tip gradient with lengthwise brush fibre, near hue-neutral. */
let bladeMap: DataTexture | undefined;
function bladeTexture(): DataTexture {
  bladeMap ??= buildColorTexture(32, (u, v) => {
    const fibre = 0.9 + fbm(u * 4, v, { seed: SEED ^ 0xb1ae, period: 12, octaves: 2 }) * 0.24;
    const across = 0.86 + Math.abs(u - 0.5) * 0.5;
    const shade = (0.5 + v * 0.74) * fibre * across;
    return [shade * 0.8, shade, shade * 0.62];
  });
  return bladeMap;
}

/** The curtain/fern material: double-sided toon with hanging sway + glow. */
function curtainMaterial(
  sway: SwayUniforms,
  sunView: ReturnType<typeof createSunViewUniform>,
): MeshToonMaterial {
  const material = createToonMaterial({
    side: DoubleSide,
    map: ribbonTexture(),
    vertexColors: true,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    injectHangingSway(shader, sway);
    injectLeafGlow(
      shader,
      sunView,
      "vec3(0.09, 0.2, 0.15)",
      "vec3(0.4, 0.32, 0.11)",
      "clamp(1.0 - vMapUv.y, 0.0, 1.0)",
    );
  };
  material.customProgramCacheKey = () => "verdant2-curtain";
  return material;
}

/** The ribbon map: midrib, fibre and cross-bands — moss braid, not vinyl. */
let ribbonMap: DataTexture | undefined;
function ribbonTexture(): DataTexture {
  ribbonMap ??= buildColorTexture(64, (u, v) => {
    const rib = 1 - Math.exp(-((u - 0.5) ** 2) / 0.006) * 0.2;
    const fibre = 0.9 + fbm(u * 3, v, { seed: SEED ^ 0x1e12, period: 10, octaves: 2 }) * 0.2;
    const bands = 1 - Math.max(0, Math.sin(v * Math.PI * 14 + Math.sin(u * 7) * 1.2)) ** 2 * 0.12;
    const shade = (0.66 + (1 - v) * 0.42) * fibre * rib * bands;
    return [shade * 0.84, shade, shade * 0.66];
  });
  return ribbonMap;
}
