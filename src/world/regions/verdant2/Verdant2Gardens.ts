import {
  BufferAttribute,
  CircleGeometry,
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
  BALCONY,
  CISTERN,
  FERN_VAULT,
  MISTFALL,
  cisternWeight,
  gardenTerraces,
  mistfallDrop,
  mistfallLipU,
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
 *
 * The Phase 3 fill (fill plan §6b.1, §6c) adds a fourth idiom — the
 * region's signature EXCLUSIVE, the **riser-face garden strips**: dense
 * rows of short hanging turf and moss pads grown ON the vertical riser
 * faces themselves (the surface every pose actually looks at, where
 * nothing grew), along the stair steps and the garden contours. The kit
 * `wallDrapeBank` (Verdant2Carpets) is the base layer on the same
 * lines; the strips are the layer only this region wears. Densification
 * reuses the existing loops with new constants (curtain anchors ×~2,
 * strands 3–5, lengths +30%); every NEW section draws from a fresh
 * `SEED ^ 0xf4xx` substream appended after the pre-fill draws.
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
    "strip-pass": { parts: [] },
    "strip-west": { parts: [] },
    "strip-east": { parts: [] },
  };

  // ─── The stair's ledge curtains ──────────────────────────────────────────
  // Every riser crest grows a run of ribbons across the channel: the
  // gardens deepen step by step, so the runs thicken and lengthen as the
  // stair descends. Fill round: anchors ×1.6 and lengths +30% — the old
  // runs were too sparse to draw the lip lines (`stair-descent` audit).
  for (let step = 0; step < 8; step++) {
    const lipU = stepFootU(step) - 3.1;
    const lush = step / 7;
    const count = Math.round((7 + lush * 11) * 1.6);
    for (let i = 0; i < count; i++) {
      const v =
        stairChannelCenter(lipU) +
        anchorRandom.signed(stairChannelHalf(lipU) + 2.5);
      growCurtain(
        chunks.pass!,
        ribbonRandom,
        lipU + anchorRandom.signed(1.0),
        v,
        anchorRandom.range(3.9, 6.0 + lush * 2.3),
        CURTAIN_TONES,
      );
    }
  }
  // The gate jambs' drapes (the jambs moved to u 747/749 in round 4).
  // Fill round: 4 → 9 per jamb, full length — the audit read them as "a
  // few dark sticks" on monumental stone.
  for (const side of [-1, 1]) {
    const u = 748 + side;
    const v = stairChannelCenter(u) + side * (stairChannelHalf(u) - 3);
    for (let i = 0; i < 9; i++) {
      growCurtain(
        chunks.pass!,
        ribbonRandom,
        u + anchorRandom.signed(1.0),
        v + anchorRandom.signed(1.4),
        anchorRandom.range(3.1, 5.5),
        VIRIDIAN_TONES,
        4.6 + anchorRandom.signed(1.6),
      );
    }
  }

  // ─── The garden terraces' curtains ───────────────────────────────────────
  // The heart of the region: ribbons hung along the terrace riser
  // contours, found by walking each contour line laterally.
  // Round 2: the runs thickened (spacing 4.6 → 3.1) and the ribbons
  // doubled in length — 3–5 m sticks did not read as hanging gardens.
  // Fill round: density ×2 (anchors 50 → 96 per contour, spacing 1.6)
  // and +30% length — at vista range the old runs were dark dots.
  for (const [t, edge] of [10, 44, 82].entries()) {
    for (let k = 0; k < 96; k++) {
      const v = -78 + k * 1.62 + anchorRandom.signed(0.8);
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
        anchorRandom.range(5.8, 9.8),
        t % 2 === 0 ? CURTAIN_TONES : VIRIDIAN_TONES,
      );
    }
  }

  // ─── The grotto's green curtain ──────────────────────────────────────────
  // The landmark drape: a dense fall of long ribbons over the grotto's
  // mouth at (893, 26), parted just enough to swim through. Fill round:
  // 12 → 20 anchors — "~8 visible ribbons is a bead curtain, not a green
  // wall". The Warden's part at v ≈ 24.4 is kept by construction.
  for (let i = 0; i < 20; i++) {
    const v = 26 + (i - 9.5) * 0.58;
    if (Math.abs(v - 24.4) < 1.1) {
      continue; // the part the Warden swims through
    }
    growCurtain(
      chunks.east!,
      ribbonRandom,
      891.4 + anchorRandom.signed(0.5),
      v,
      anchorRandom.range(4.4, 6.2),
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
  for (let i = 0; i < 18; i++) {
    const v = MISTFALL.v + (i - 8.5) * 3.4 + anchorRandom.signed(1.2);
    if (Math.abs(v - MISTFALL.v) < 10) {
      continue; // the fall itself owns the centre
    }
    growCurtain(
      chunks.deep!,
      ribbonRandom,
      mistfallLipU(v) - 1.0,
      v,
      anchorRandom.range(7.0, 11.5),
      CURTAIN_TONES,
    );
  }

  // ─── The ferns ───────────────────────────────────────────────────────────
  // Giants in the vault, reaching for the shelf; smaller kin on the
  // treads and along the balcony's inner edge.
  for (let i = 0; i < 14; i++) {
    const theta = fernRandom.range(0, Math.PI * 2);
    const d = Math.sqrt(fernRandom.next()) * 16;
    const u = FERN_VAULT.u + Math.cos(theta) * d;
    const v = FERN_VAULT.v + Math.sin(theta) * d * 0.9;
    growFern(chunks.west!, fernRandom, u, v, fernRandom.range(5.6, 8.4), FERN_TONES, contacts);
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

  // ─── The fill growth (fresh substreams, appended after every pre-fill
  // draw — the reroll fence) ───────────────────────────────────────────────

  // Eight more long curtains on the Mistfall's south lip (§3): the
  // living green thickens on the quiet side of the pour.
  const lipRandom = new Random(SEED ^ 0xf418);
  for (let i = 0; i < 8; i++) {
    const v = MISTFALL.v - 12 - i * 2.6 + lipRandom.signed(1.0);
    growCurtain(
      chunks.deep!,
      lipRandom,
      mistfallLipU(v) - 1.0,
      v,
      lipRandom.range(7.5, 11.5),
      CURTAIN_TONES,
    );
  }

  // The vault grows: four more giants (18 total) and sixteen low fronds
  // so the half-light floor carries its own understory.
  const fillFernRandom = new Random(SEED ^ 0xf416);
  for (let i = 0; i < 4; i++) {
    const theta = fillFernRandom.range(0, Math.PI * 2);
    const d = 6 + Math.sqrt(fillFernRandom.next()) * 11;
    growFern(
      chunks.west!,
      fillFernRandom,
      FERN_VAULT.u + Math.cos(theta) * d,
      FERN_VAULT.v + Math.sin(theta) * d * 0.9,
      fillFernRandom.range(5.6, 8.4),
      FERN_TONES,
      contacts,
    );
  }
  for (let i = 0; i < 16; i++) {
    const theta = fillFernRandom.range(0, Math.PI * 2);
    const d = 4 + Math.sqrt(fillFernRandom.next()) * 16;
    growFern(
      chunks.west!,
      fillFernRandom,
      FERN_VAULT.u + Math.cos(theta) * d,
      FERN_VAULT.v + Math.sin(theta) * d,
      fillFernRandom.range(1.1, 1.9),
      FERN_TONES,
      contacts,
    );
  }
  // The balcony dresses: four ferns inside the balustrade arc and six
  // short curtains hung from the worked slabs themselves.
  for (let i = 0; i < 4; i++) {
    growFern(
      chunks.deep!,
      fillFernRandom,
      BALCONY.u + fillFernRandom.signed(7),
      BALCONY.v + fillFernRandom.signed(8),
      fillFernRandom.range(1.8, 2.8),
      FERN_TONES,
      contacts,
    );
  }
  const balustradeRandom = new Random(SEED ^ 0xf417);
  for (let i = 0; i < 6; i++) {
    const theta = -0.7 + i * 0.29 + balustradeRandom.signed(0.06);
    growCurtain(
      chunks.deep!,
      balustradeRandom,
      BALCONY.u + Math.cos(theta) * 11,
      BALCONY.v + Math.sin(theta) * 11,
      balustradeRandom.range(1.6, 2.6),
      VIRIDIAN_TONES,
      1.1,
    );
  }

  // ─── The riser-face garden strips — the region's signature EXCLUSIVE ────
  // Growth on the vertical faces every pose actually looks at: dense rows
  // of short hanging turf and moss pads ON the stair risers and the
  // garden contour walls (kit wallDrapeBank lays the base on the same
  // lines from Verdant2Carpets; this layer is the one only this region
  // wears). Own chunks, so the tests can hold their determinism.
  const stripRandom = new Random(SEED ^ 0xf413);
  for (let step = 0; step < 8; step++) {
    const lipU = stepFootU(step) - 2.6;
    const half = stairChannelHalf(lipU) + 1;
    for (let v = stairChannelCenter(lipU) - half; v <= stairChannelCenter(lipU) + half; v += 1.1) {
      growRiserStrip(chunks["strip-pass"]!, stripRandom, lipU, v + stripRandom.signed(0.4));
    }
  }
  const stripGardenRandom = new Random(SEED ^ 0xf414);
  for (const edge of [10, 44, 82]) {
    for (let k = 0; k < 110; k++) {
      const v = -78 + k * 1.42 + stripGardenRandom.signed(0.5);
      const u = contourU(edge, v);
      if (u === null) {
        continue;
      }
      if (cisternWeight(u, v) > 0.35 || vaultWeight(u, v) > 0.4 || mistfallDrop(u - 4, v) > 0.1) {
        continue;
      }
      const chunk = v < -10 ? chunks["strip-west"]! : chunks["strip-east"]!;
      growRiserStrip(chunk, stripGardenRandom, u - 0.4, v);
    }
  }

  // ─── R12.3 headroom spend (fresh streams, appended after every existing
  // draw — the reroll fence holds; these only APPEND parts to the merged
  // chunks) ─────────────────────────────────────────────────────────────────

  // Denser riser-face garden strips: a second interleaved row on the
  // stair risers (offset half a spacing) and on the garden contours —
  // the vertical faces are the close poses' whole subject.
  const stripRandom2 = new Random(SEED ^ 0xf419);
  for (let step = 0; step < 8; step++) {
    const lipU = stepFootU(step) - 2.6;
    const half = stairChannelHalf(lipU) + 1;
    for (
      let v = stairChannelCenter(lipU) - half + 0.55;
      v <= stairChannelCenter(lipU) + half;
      v += 1.1
    ) {
      growRiserStrip(chunks["strip-pass"]!, stripRandom2, lipU + 0.5, v + stripRandom2.signed(0.3));
    }
  }
  const stripGardenRandom2 = new Random(SEED ^ 0xf41a);
  for (const edge of [10, 44, 82]) {
    for (let k = 0; k < 110; k++) {
      const v = -78 + (k + 0.5) * 1.42 + stripGardenRandom2.signed(0.4);
      const u = contourU(edge, v);
      if (u === null) {
        continue;
      }
      if (cisternWeight(u, v) > 0.35 || vaultWeight(u, v) > 0.4 || mistfallDrop(u - 4, v) > 0.1) {
        continue;
      }
      const chunk = v < -10 ? chunks["strip-west"]! : chunks["strip-east"]!;
      growRiserStrip(chunk, stripGardenRandom2, u + 0.1, v);
    }
  }

  // Richer curtain layering: a second garden-contour run hung between the
  // fill's anchors (the contours were still open lacework at close
  // range), an outer veil on the grotto, and heavier low-stair runs.
  const layerRandom = new Random(SEED ^ 0xf41c);
  for (const [t, edge] of [10, 44, 82].entries()) {
    for (let k = 0; k < 48; k++) {
      const v = -76 + k * 3.2 + layerRandom.signed(1.1);
      const u = contourU(edge, v);
      if (u === null) {
        continue;
      }
      if (cisternWeight(u, v) > 0.35 || vaultWeight(u, v) > 0.4 || mistfallDrop(u - 4, v) > 0.1) {
        continue;
      }
      const chunk = v < -10 ? chunks.west! : chunks.east!;
      growCurtain(
        chunk,
        layerRandom,
        u - 0.7,
        v,
        layerRandom.range(4.6, 8.6),
        t % 2 === 0 ? VIRIDIAN_TONES : CURTAIN_TONES,
      );
    }
  }
  const veilRandom = new Random(SEED ^ 0xf41d);
  for (let i = 0; i < 6; i++) {
    const v = 26 + (i - 2.5) * 1.35;
    if (Math.abs(v - 24.4) < 1.1) {
      continue; // the Warden's part stays open
    }
    growCurtain(
      chunks.east!,
      veilRandom,
      889.9 + veilRandom.signed(0.4),
      v,
      veilRandom.range(3.8, 5.6),
      VIRIDIAN_TONES,
      4.2,
    );
  }
  const stairLayerRandom = new Random(SEED ^ 0xf41e);
  for (let step = 3; step < 8; step++) {
    const lipU = stepFootU(step) - 3.1;
    for (let i = 0; i < 4; i++) {
      const v =
        stairChannelCenter(lipU) + stairLayerRandom.signed(stairChannelHalf(lipU) + 2.5);
      growCurtain(
        chunks.pass!,
        stairLayerRandom,
        lipU + stairLayerRandom.signed(0.8),
        v,
        stairLayerRandom.range(4.4, 7.2),
        VIRIDIAN_TONES,
      );
    }
  }

  // The vault's understory deepens: eight more low ferns drifted toward
  // the mouth (the inner shadow keeps its rest by the same gate the
  // carpets use — these stay outside r 4 of the heart by construction).
  const understoryRandom = new Random(SEED ^ 0xf41b);
  for (let i = 0; i < 8; i++) {
    const theta = understoryRandom.range(0, Math.PI * 2);
    const d = 5 + Math.sqrt(understoryRandom.next()) * 15;
    growFern(
      chunks.west!,
      understoryRandom,
      FERN_VAULT.u + Math.cos(theta) * d,
      FERN_VAULT.v + Math.sin(theta) * d,
      understoryRandom.range(1.4, 2.4),
      FERN_TONES,
      contacts,
    );
  }

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
 * Returns null outside the gardens' band. Exported for the fill's other
 * consumers (the drape base in Verdant2Carpets walks the same lines).
 */
export function contourU(edge: number, v: number): number | null {
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
      random.range(0.3, 0.55),
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
  const lit = tint.clone().lerp(TIP_GOLD, 0.45).multiplyScalar(1.22);
  const hem = tint.clone().lerp(SHADOW_VIOLET, 0.42);
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

// ─── One riser strip (the signature exclusive) ───────────────────────────────

/** The world direction the riser faces look toward (downhill, +u). */
const DOWNHILL = ((): { x: number; z: number; yaw: number } => {
  const a = worldOf(0, 0);
  const b = worldOf(1, 0);
  const x = b.x - a.x;
  const z = b.z - a.z;
  return { x, z, yaw: Math.atan2(x, z) };
})();

/**
 * One strip anchor: 2–3 short hanging turf ribbons off the lip crest and
 * 1–2 moss pads seated on the face below them. Everything is drawn in
 * the curtain palette so the strips and the big curtains read as one
 * growth; the short blades are 8-tri planes (a riser wears hundreds).
 */
function growRiserStrip(chunk: Chunk, random: Random, u: number, v: number): void {
  const crest = worldOf(u, v);
  const top = seabedHeight(crest.x, crest.z) + 0.12;
  const below = worldOf(u + 2.6, v);
  const drop = Math.max(0.4, top - seabedHeight(below.x, below.z));
  const phase = random.range(0, Math.PI * 2);

  // Round 2: blades a third longer — from the stair pose the strip rows
  // were too fine to draw the faces they grow on.
  const blades = 2 + Math.floor(random.next() * 2);
  for (let i = 0; i < blades; i++) {
    const tones = random.next() < 0.5 ? VIRIDIAN_TONES : CURTAIN_TONES;
    const ribbon = shortRibbonGeometry(
      Math.min(drop * random.range(0.45, 0.9), random.range(0.9, 2.1)),
      random.range(0.16, 0.28),
      tones[Math.floor(random.next() * tones.length)]!,
      random,
    );
    ribbon.rotateY(random.range(0, Math.PI * 2));
    ribbon.translate(crest.x + random.signed(0.4), top, crest.z + random.signed(0.4));
    bakeSwayAttributes(ribbon, phase + i, 0.08, (y) => Math.min(1, Math.max(0, (top - y) / 1.2)));
    chunk.parts.push(ribbon);
  }

  const pads = 1 + Math.floor(random.next() * 2);
  const slope = Math.atan2(drop, 2.6);
  for (let i = 0; i < pads; i++) {
    const along = random.range(0.3, 1.5);
    const t = along / 2.6;
    const pad = mossPadGeometry(random.range(0.14, 0.3), random);
    pad.rotateX(slope * random.range(0.8, 1.1));
    pad.rotateY(DOWNHILL.yaw + random.signed(0.3));
    const at = worldOf(u + along, v + random.signed(0.5));
    pad.translate(at.x, top - drop * t + 0.06, at.z);
    bakeSwayAttributes(pad, phase, 0, () => 0);
    chunk.parts.push(pad);
  }
}

/** A short hanging blade: 1×4 plane, 8 tris, tip-lit to violet hem. */
function shortRibbonGeometry(
  length: number,
  width: number,
  tone: number,
  random: Random,
): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1, 1, 4);
  const position = geometry.attributes.position!;
  const belly = random.range(0.1, 0.3) * length;
  const twist = random.signed(0.6);

  const tint = new Color(tone).multiplyScalar(random.range(0.85, 1.1));
  const lit = tint.clone().lerp(TIP_GOLD, 0.4).multiplyScalar(1.18);
  const hem = tint.clone().lerp(SHADOW_VIOLET, 0.38);
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = 0.5 - position.getY(i);
    const edge = position.getX(i) * 2;
    const half = Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.9)) ** 0.6;
    const across = edge * half * 0.5 * width;
    const spin = twist * t;
    const bellyOut = Math.sin(Math.PI * Math.min(1, t / 0.7) * 0.5) * belly;
    position.setXYZ(
      i,
      across * Math.cos(spin) + bellyOut * 0.55,
      -t * length,
      across * Math.sin(spin) + bellyOut * 0.35,
    );
    shade
      .copy(lit)
      .lerp(tint, smoothstep01(t / 0.3))
      .lerp(hem, smoothstep01((t - 0.5) / 0.45));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/** A moss pad: a 6-wedge disc, dark centre, tip-lit rim — 6 tris. */
function mossPadGeometry(radius: number, random: Random): BufferGeometry {
  const geometry = new CircleGeometry(radius, 6);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position!;
  const tint = new Color(CURTAIN_TONES[Math.floor(random.next() * CURTAIN_TONES.length)]!)
    .multiplyScalar(random.range(0.8, 1.05));
  const centre = tint.clone().lerp(SHADOW_VIOLET, 0.5);
  const rim = tint.clone().lerp(TIP_GOLD, 0.25).multiplyScalar(1.1);
  const shade = new Color();
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const r = Math.hypot(position.getX(i), position.getZ(i)) / radius;
    shade.copy(centre).lerp(rim, smoothstep01((r - 0.2) / 0.7));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
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

  // Fill round: room for the threshold's turf islands and the grown rim
  // lawn (the new sections draw from fresh substreams, appended last).
  const capacity = 2400;
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

  // Fringe rows along the garden terrace crests (round 5): a bright turf
  // line just uphill of each riser, so the terrace edges read from the
  // overlook the way hedgerows draw a field map.
  for (const [t, edge] of [10, 44, 82].entries()) {
    const family = TURF_FAMILIES[t % TURF_FAMILIES.length]!;
    for (let k = 0; k < 26; k++) {
      const v = -74 + k * 5.9 + random.signed(1.6);
      const u = contourU(edge, v);
      if (u === null) {
        continue;
      }
      if (
        vaultWeight(u, v) > 0.3 ||
        cisternWeight(u, v) > 0.3 ||
        mistfallDrop(u - 3, v) > 0.05
      ) {
        continue;
      }
      plant(u - 1.6 + random.signed(0.5), v, family, 1.15);
      plant(u - 2.2 + random.signed(0.5), v + random.signed(1.2), family, 0.95);
    }
  }

  // The Fern Vault's floor tufts (round 4): sparse celadon between the
  // giants, so the half-light floor is a place and not a mud sheet.
  for (let patch = 0; patch < 7; patch++) {
    const theta = random.range(0, Math.PI * 2);
    const d = random.range(3, 15);
    const patchU = FERN_VAULT.u + Math.cos(theta) * d;
    const patchV = FERN_VAULT.v + Math.sin(theta) * d;
    for (let blade = 0; blade < 18; blade++) {
      const spread = 2.4 * Math.sqrt(random.next());
      const angle = random.range(0, Math.PI * 2);
      plant(
        patchU + Math.cos(angle) * spread,
        patchV + Math.sin(angle) * spread,
        TURF_FAMILIES[2]!,
        0.75,
      );
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

  // The threshold's turf islands (fill plan §3): six green marks every
  // ~16 m down the emptiest road in the province, milky-pale near the
  // kelp sea and deepening toward the gate — the waymark rhythm, grown.
  const fillRandom = new Random(SEED ^ 0xf415);
  for (let island = 0; island < 6; island++) {
    const islandU = 650 + island * 16.5 + fillRandom.signed(3);
    const islandV = stairChannelCenter(islandU) + fillRandom.signed(5);
    const family = TURF_FAMILIES[island < 3 ? 2 : 1]!;
    for (let blade = 0; blade < 20; blade++) {
      const spread = 2.6 * Math.sqrt(fillRandom.next());
      const angle = fillRandom.range(0, Math.PI * 2);
      plant(
        islandU + Math.cos(angle) * spread,
        islandV + Math.sin(angle) * spread,
        family,
        0.85,
      );
    }
  }

  // The Cistern's rim lawn grows ×1.6 (180 → 290): the oldest gardens
  // thicken on their built ring. The bowl inside stays the mirror rest.
  for (let i = 0; i < 110; i++) {
    const theta = fillRandom.range(0, Math.PI * 2);
    const d = fillRandom.range(26, 34);
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
    // A floor under the toon shade: the hems kept reading black through
    // three rounds of tone lifts — in this water the shadow side needs
    // its own light, a colour, never a black (round 4).
    emissive: 0x243d2c,
    emissiveIntensity: 0.55,
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
