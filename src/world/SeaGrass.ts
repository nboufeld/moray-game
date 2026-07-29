import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  Vector2,
  Vector3,
  type DataTexture,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { requestAlbedo } from "../rendering/AssetLibrary";
import { readImage, textureFromPixels } from "../rendering/ImagePixels";
import { SUN_POSITION } from "../rendering/Lighting";
import { buildColorTexture, fbm } from "../rendering/ProceduralTexture";
import { createToonMaterial } from "../rendering/ToonShading";
import { Random, SEEDS } from "../util/Random";
import { seabedHeight } from "./Seabed";

/**
 * Raised in Wave 8 (W11, from 1.25): the owner's ask was herbs that stand
 * higher. The meadow's envelope below is re-centred rather than simply
 * stretched — knee-high to chest-high, with the canopy carried by the tall
 * variant (`TALL_HEIGHT`) mixed through the same patches. The foreground
 * clumps' `heightScale` in `Reef` multiplies this number, so the envelope was
 * widened with one eye on their worst case: their top end lands a little
 * under the 3.6 m they could already reach, and the contract — grass tall
 * enough to crop the frame's edge — is kept at the meadow's new scale rather
 * than at twice it.
 */
const BLADE_HEIGHT = 1.8;
/**
 * Widened again (W-N2, from 0.182): the round critic read the close meadow as
 * "flat plastic straps", and half of that is width — a strap is a wire that
 * got wider, where a leaf has a face. The other half is the cross-section and
 * the twist, which live in `createBladeGeometry`. Widening is still the
 * cheapest lushness there is: the instance count and the draw call are
 * untouched, and what changes is how much of the frame the meadow covers.
 */
const BLADE_WIDTH = 0.26;

/**
 * Meadow patches read as habitat; blades sprinkled evenly read as a texture.
 *
 * Round L was asked for materially more vegetation, and the cheapest honest
 * answer is more meadow: a blade is ten vertices in a mesh that is already
 * drawn, so the whole of this is one number in a buffer. Coverage is up about
 * two fifths (32 patches at 3.4 m against 26 at 3.2, which is the area that
 * matters rather than either number on its own) and a patch is a sixth denser,
 * which is what stops a wider meadow reading as a thinner one.
 */
const PATCH_COUNT = 32;
const BLADES_PER_PATCH = 30;
const PATCH_RADIUS = 3.4;

/**
 * How often a patch is the broad-leaved kind, and what that means.
 *
 * One grass everywhere is one plant everywhere, and a reef flat has at least
 * two — the fine turf and the strappy stuff that grows in the hollows. This is
 * the second one, and it is deliberately not a second geometry or a second
 * draw: the blade is the same strip at nearly twice the width and three
 * quarters of the height, which is a different plant in the frame and a
 * per-instance scale in the buffer. Its greens are the same key a shade
 * deeper, so the two stands separate by value as well as by shape.
 */
const BROAD_PATCH_ODDS = 0.34;
/**
 * Half again rather than twice. At 1.85 a blade close to the lens was wider
 * than a moray is, which stops being a second plant and starts being a scale
 * error — the low tidepool shot came back looking like a wheat field seen by
 * something the size of a beetle. A blade has to stay smaller than the animals.
 * Taken down from 1.5 when the base width went up (W-N2), so the broad
 * variant's absolute width stays just under the 0.34m that documented failure
 * was measured at.
 */
const BROAD_WIDTH = 1.25;
const BROAD_HEIGHT = 0.74;
const BROAD_PALETTE = [0x5cb87f, 0x86cf8b, 0x4fa473];

/**
 * The per-instance height envelope (W11): knee-high to chest-high.
 *
 * Was `range(0.6, 1.45)` against the old 1.25 m blade — 0.75–1.81 m with
 * most of the mass near the top. Re-centred for the taller blade rather than
 * stretched: the spread is wider in absolute metres (1.22 against 1.06) so
 * neighbouring stands read as different ages of growth instead of one lawn,
 * the mean holds within a centimetre of the old meadow's, and the raise the
 * owner asked for is carried by the top of the envelope and the tall variant
 * below rather than by every blade at once, which would have read as a wall.
 */
const HEIGHT_LO = 0.34;
const HEIGHT_HI = 1.02;

/**
 * The tall variant (W11): a slimmer, longer blade bowed in a gentle S, mixed
 * through the meadow's own patches at this share of blades. It is a second
 * geometry and a second instanced mesh — the grass's one allowed extra draw
 * — planted from its own stream (`SEEDS.tallGrass` xor the room's seed, the
 * palette stream's own trick) so not one number in the meadow's stream moves.
 * Siblings are taken at the meadow's drawn blade positions, which is what
 * "mixed into the patches" costs nothing extra to say: a tall blade stands
 * where a meadow blade already proved it may.
 */
const TALL_ODDS = 0.15;
const TALL_HEIGHT = 2.3;
const TALL_WIDTH = 0.17;

/** Squared distance a blade must keep from a crevice mouth. */
const CLEARANCE_SQ = 16;

/**
 * Bright spring greens, where these used to be a stand of deep sea-green.
 *
 * The old palette was mixed for water that had a photograph's darkness in it,
 * and against WP-G1's turquoise its bottom end (0x2f7a58) read as a shadow
 * rather than as a leaf — a meadow of near-black spikes on bright sand. These
 * are the same family lifted into the light: a mid green, a pale sunlit one and
 * a deeper one to keep the clumps from flattening into a single wash. The value
 * spread the eye reads as depth comes from the multiplier below, which is wide
 * on purpose; the hues only have to stay in one key.
 */
const PALETTE = [0x69c184, 0x8fd98a, 0x4da96f];

/**
 * Per-patch palette drift (W-L9): a meadow all in one saturated green is a
 * lawn, and a reef flat is not a lawn. Each patch draws one of three families
 * — the spring green above, a calmer olive, a cool seafoam — so the ground
 * reads as drifts of related colour rather than one wash. The three sit in one
 * value band on purpose; what varies is temperature, which is what survives
 * ten metres of water.
 *
 * The family is drawn from a *side stream*, not the placement stream, so every
 * blade of the meadow stands exactly where it stood before this change — the
 * layout is bit-identical and only the colour is new in the next screenshot.
 */
const PALETTE_FAMILIES: readonly (readonly number[])[] = [
  PALETTE,
  [0x8cad57, 0xa8c46b, 0x6e934c],
  [0x71c49c, 0x93d6ae, 0x58a884],
];

/**
 * Sun-through-the-leaf translucency, shared by the meadow, the kelp and the
 * seaweed (W-L9).
 *
 * A leaf between the camera and the sun glows — that is the one light note the
 * old view-facing term could not supply, because it brightened a leaf equally
 * with the sun behind the camera. The term is `dot(camera→fragment, sunView)`
 * raised to a power: largest looking *into* the light, gone looking away from
 * it, exactly the read that puts light in a kelp crown.
 *
 * The sun's view-space direction cannot be a constant — it turns with the
 * camera — and this module may not reach into the renderer. So the uniform is
 * re-derived in `onBeforeRender`, which hands over the camera each frame: one
 * vector transform, no plumbing, the same self-winding compromise
 * `CoralField`'s sway makes and for the same reason (nothing owns an update
 * call with a camera in it).
 */
export interface SunViewUniform {
  readonly value: Vector3;
}

export function createSunViewUniform(): SunViewUniform {
  return { value: new Vector3(0, 1, 0) };
}

/** Hangs the per-frame sun-direction refresh on a mesh this module owns. */
export function trackSunView(mesh: Object3D, sun: SunViewUniform): void {
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    sun.value
      .copy(SUN_POSITION)
      .normalize()
      .transformDirection(camera.matrixWorldInverse);
  };
}

/**
 * The fragment injection both plant shaders share. `tipExpr` weights the glow
 * along the leaf (tips are thin, roots are not), and the warm tint is asked
 * for in the golden-olive family on purpose — under this water a warm additive
 * reads far louder than its luminance says (AGENTS' value key), which is why
 * the constants look timid.
 */
export function injectLeafGlow(
  shader: WebGLProgramParametersWithUniforms,
  sun: SunViewUniform,
  coolTint: string,
  warmTint: string,
  tipExpr: string,
): void {
  shader.uniforms.uSunView = sun;
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
       uniform vec3 uSunView;`,
    )
    .replace(
      "#include <dithering_fragment>",
      `#include <dithering_fragment>
       float facing = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
       float toward = max(dot(normalize(-vViewPosition), uSunView), 0.0);
       float backlit = pow(toward, 4.0);
       float leafTip = ${tipExpr};
       gl_FragColor.rgb += diffuseColor.rgb * ${coolTint} * facing;
       gl_FragColor.rgb += diffuseColor.rgb * ${warmTint} * backlit * (0.25 + 0.75 * leafTip);`,
    );
}

/**
 * A hand-placed patch, for the few clumps that are composition rather than
 * ground cover — a foreground clump has to stand tall enough to crop the
 * frame, which the scattered meadow never does.
 */
export interface GrassClump {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly blades: number;
  readonly heightScale: number;
  /** The strappy variant; see {@link BROAD_PATCH_ODDS}. */
  readonly broad?: boolean;
}

/**
 * Instanced sea grass. A blade is a tapered, slightly curved strip rather than
 * a cone — cones read as conifers, which is the single loudest "greybox" tell
 * in the reef. Sway happens in the vertex shader so a whole meadow costs one
 * uniform update per frame instead of hundreds of matrix rewrites.
 */
export class SeaGrass {
  readonly mesh: InstancedMesh;
  /**
   * The tall variant's mesh, hung on {@link mesh} as a child: both callers
   * (`Reef`, the sanctuary) add only `mesh`, and a child rides along with it
   * for the one extra draw the grass budget allows.
   */
  readonly tallMesh: InstancedMesh;

  private readonly sway = { value: 0 };
  private readonly windStrength = { value: 1 };

  constructor(seed: number, clearances: readonly Vector2[], clumps: readonly GrassClump[] = []) {
    const random = new Random(seed);
    // The palette drift's own stream; see PALETTE_FAMILIES for why it is not
    // the placement stream.
    const paletteRandom = new Random(seed ^ 0x9e37_79b9);
    // The tall variant's own stream (W11), off `SEEDS.tallGrass` by the same
    // side-stream trick as the palette: nothing the meadow already drew moves.
    const tallRandom = new Random(seed ^ SEEDS.tallGrass);
    const sunView = createSunViewUniform();
    const material = createToonMaterial({
      side: DoubleSide,
      // Dark root climbing to a sun-bleached tip, with lengthwise fibre. A flat
      // green blade reads as a cactus spine; the gradient is what makes it read
      // as a leaf.
      map: bladeTexture(),
    });
    requestAlbedo("world/grass-blade.png", (texture) => {
      const painted = unpackBlade(texture);
      if (painted) {
        material.map = painted;
        material.needsUpdate = true;
      }
    });
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSway = this.sway;
      shader.uniforms.uWind = this.windStrength;
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
           // Each clump leans on its own phase, taken from where it stands.
           float phase = instanceMatrix[3][0] * 0.6 + instanceMatrix[3][2] * 0.43;
           float tip = clamp(transformed.y / ${BLADE_HEIGHT.toFixed(2)}, 0.0, 1.0);
           float bend = sin(uSway * 1.3 + phase) * 0.5 + sin(uSway * 0.47 + phase * 1.7) * 0.5;
           transformed.x += bend * 0.16 * uWind * tip * tip;
           transformed.z += bend * 0.09 * uWind * tip * tip;`,
        );

      // Cheap translucency, in two notes (W-L9). The cool view-facing term is
      // the old one — a blade is a fraction of a millimetre thick, so its far
      // side glows rather than falling into shadow. The warm term is new: a
      // tip between the camera and the sun lights up golden, weighted up the
      // blade because the root is the thick part.
      injectLeafGlow(
        shader,
        sunView,
        "vec3(0.14, 0.26, 0.20)",
        "vec3(0.34, 0.28, 0.10)",
        "clamp(vMapUv.y, 0.0, 1.0)",
      );
    };

    const total =
      PATCH_COUNT * BLADES_PER_PATCH + clumps.reduce((sum, clump) => sum + clump.blades, 0);
    this.mesh = new InstancedMesh(createBladeGeometry(), material, total);
    this.mesh.name = "sea-grass";
    this.mesh.receiveShadow = true;
    // Blades still catch shadow from the reef above them, but they do not cast:
    // several hundred double-sided instances in the shadow pass cost far more
    // than the faint stippling they would add to the sand.
    this.mesh.castShadow = false;
    trackSunView(this.mesh, sunView);

    // The tall variant's material is the meadow's with one number changed:
    // the sway's tip weight divides by the tall blade's own height, or its
    // top third would bend like a root.
    const tallSunView = createSunViewUniform();
    const tallMaterial = createToonMaterial({
      side: DoubleSide,
      map: bladeTexture(),
    });
    requestAlbedo("world/grass-blade.png", (texture) => {
      const painted = unpackBlade(texture);
      if (painted) {
        tallMaterial.map = painted;
        tallMaterial.needsUpdate = true;
      }
    });
    tallMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uSway = this.sway;
      shader.uniforms.uWind = this.windStrength;
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
           float tip = clamp(transformed.y / ${TALL_HEIGHT.toFixed(2)}, 0.0, 1.0);
           float bend = sin(uSway * 1.1 + phase) * 0.5 + sin(uSway * 0.43 + phase * 1.7) * 0.5;
           transformed.x += bend * 0.22 * uWind * tip * tip;
           transformed.z += bend * 0.12 * uWind * tip * tip;`,
        );
      injectLeafGlow(
        shader,
        tallSunView,
        "vec3(0.14, 0.26, 0.20)",
        "vec3(0.34, 0.28, 0.10)",
        "clamp(vMapUv.y, 0.0, 1.0)",
      );
    };

    // Capacity is the patch-blade count — every blade could draw a sibling —
    // but `count` below is set to what was actually planted, so the undrawn
    // tail of the buffer is never submitted.
    this.tallMesh = new InstancedMesh(
      createTallBladeGeometry(),
      tallMaterial,
      PATCH_COUNT * BLADES_PER_PATCH,
    );
    this.tallMesh.name = "sea-grass-tall";
    this.tallMesh.receiveShadow = true;
    this.tallMesh.castShadow = false;
    trackSunView(this.tallMesh, tallSunView);
    this.mesh.add(this.tallMesh);

    const dummy = new Object3D();
    const color = new Color();
    let placed = 0;

    const plant = (
      x: number,
      z: number,
      heightScale: number,
      broad: boolean,
      palette: readonly number[],
    ): void => {
      if (clearances.some((spot) => spot.distanceToSquared(new Vector2(x, z)) < CLEARANCE_SQ)) {
        return;
      }

      dummy.position.set(x, seabedHeight(x, z) - 0.05, z);
      dummy.rotation.set(random.signed(0.12), random.range(0, Math.PI * 2), random.signed(0.12));
      dummy.scale.set(
        random.range(0.75, 1.25) * (broad ? BROAD_WIDTH : 1),
        random.range(HEIGHT_LO, HEIGHT_HI) * heightScale * (broad ? BROAD_HEIGHT : 1),
        1,
      );
      dummy.updateMatrix();
      this.mesh.setMatrixAt(placed, dummy.matrix);

      color.setHex(palette[Math.floor(random.next() * palette.length)] ?? palette[0]!);
      // Deeper blades sit in shade; lighter tips catch the surface light.
      color.multiplyScalar(random.range(0.75, 1.15));
      this.mesh.setColorAt(placed, color);
      placed++;
    };

    /**
     * The tall sibling. Its draws come only from `tallRandom`: one decision
     * per patch blade whether or not a sibling is taken, then the planting
     * draws only where one stands — the same rule {@link plant} keeps, so the
     * stream is fixed given the seed and the clearances. The palette is the
     * patch's own family, so the canopy reads as the same stand of grass
     * grown long rather than a second species sown over it.
     */
    let tallPlaced = 0;
    const plantTall = (x: number, z: number, palette: readonly number[]): void => {
      if (clearances.some((spot) => spot.distanceToSquared(new Vector2(x, z)) < CLEARANCE_SQ)) {
        return;
      }

      dummy.position.set(x, seabedHeight(x, z) - 0.05, z);
      dummy.rotation.set(tallRandom.signed(0.1), tallRandom.range(0, Math.PI * 2), tallRandom.signed(0.1));
      dummy.scale.set(
        tallRandom.range(0.85, 1.15),
        tallRandom.range(0.82, 1.12),
        1,
      );
      dummy.updateMatrix();
      this.tallMesh.setMatrixAt(tallPlaced, dummy.matrix);

      color.setHex(palette[Math.floor(tallRandom.next() * palette.length)] ?? palette[0]!);
      // The canopy is the lit layer: its floor sits a step above the meadow's.
      color.multiplyScalar(tallRandom.range(0.8, 1.15));
      this.tallMesh.setColorAt(tallPlaced, color);
      tallPlaced++;
    };

    for (let patch = 0; patch < PATCH_COUNT; patch++) {
      const patchX = random.signed(30);
      const patchZ = random.signed(30);
      // Drawn before the blades, so a patch's kind is one number and the
      // blades after it take the same stream they always did.
      const broad = random.next() < BROAD_PATCH_ODDS;
      // Drawn whether or not it is used, so a patch changing kind cannot
      // re-roll the families of every patch after it.
      const drawn = drawFamily(paletteRandom);
      const family = broad ? BROAD_PALETTE : drawn;

      for (let blade = 0; blade < BLADES_PER_PATCH; blade++) {
        // Bias toward the middle so patches have a dense heart and soft edges.
        const spread = PATCH_RADIUS * Math.sqrt(random.next());
        const angle = random.range(0, Math.PI * 2);
        const x = patchX + Math.cos(angle) * spread;
        const z = patchZ + Math.sin(angle) * spread;
        plant(x, z, 1, broad, family);
        // Tall siblings mix through the patches only — the authored clumps
        // are compositions, and their heights are already deliberate.
        if (tallRandom.next() < TALL_ODDS) {
          plantTall(x, z, family);
        }
      }
    }

    // Authored clumps are drawn last so that adding one leaves the scattered
    // meadow taking exactly the numbers it took before, and only the clump is
    // new in the next screenshot.
    for (const clump of clumps) {
      const drawn = drawFamily(paletteRandom);
      const family = clump.broad === true ? BROAD_PALETTE : drawn;
      for (let blade = 0; blade < clump.blades; blade++) {
        const spread = clump.radius * Math.sqrt(random.next());
        const angle = random.range(0, Math.PI * 2);
        plant(
          clump.x + Math.cos(angle) * spread,
          clump.z + Math.sin(angle) * spread,
          clump.heightScale,
          clump.broad === true,
          family,
        );
      }
    }

    // Park the unused instances well out of sight rather than at the origin.
    dummy.position.set(0, -200, 0);
    dummy.scale.setScalar(0.0001);
    dummy.updateMatrix();
    for (let i = placed; i < total; i++) {
      this.mesh.setMatrixAt(i, dummy.matrix);
    }

    this.mesh.count = total;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }

    // Only the planted siblings are submitted; the rest of the buffer never
    // had a matrix written and is culled by the count.
    this.tallMesh.count = tallPlaced;
    this.tallMesh.instanceMatrix.needsUpdate = true;
    if (this.tallMesh.instanceColor) {
      this.tallMesh.instanceColor.needsUpdate = true;
    }
  }

  update(dt: number, reducedMotion: boolean): void {
    this.sway.value += dt * (reducedMotion ? 0.35 : 1);
    this.windStrength.value = reducedMotion ? 0.45 : 1;
  }
}

/**
 * The painted blade strip, unpacked from its black field and levelled onto the
 * map it replaces.
 *
 * Two things have to happen to `grass-blade.png` before it can be a blade's
 * map, and both are one-off arithmetic at load.
 *
 * It is painted as a silhouette: one tapering blade on black, tip at the top
 * row. The obvious use for that is an alpha map, and it is the wrong one here —
 * the geometry is *already* a tapered curved blade, so a cut-out silhouette
 * would buy nothing but a per-fragment discard, and a mostly-black image
 * mipmapped down to the two or three pixels a distant blade covers averages to
 * black and puts a dark meadow at the back of the frame. So instead every row
 * is stretched from the painted span out to the full width: the file becomes
 * solid leaf, the geometry keeps the silhouette, and the mip chain is all
 * blade. The rows are written bottom-up as they go, because the strip is
 * painted tip-up and the blade's `v` runs root to tip.
 *
 * And it is painted at its own colour, where the map it replaces is authored to
 * sit *under* the per-instance palette — three greens with a wide value spread,
 * which is where the meadow's variety comes from. Multiplying one by the other
 * gives a stand of near-black weed. So the unpacked strip is scaled per channel
 * onto the generated map's own mean, measured from both rather than picked:
 * the meadow keeps exactly the colour and value it had, and what the painting
 * changes is the *variation* — a green root running to a sunlit yellow tip,
 * with brush fibre along it, in place of a linear ramp and some noise.
 */
const BLADE_INSET = 0.12;

/**
 * The general form of the two paragraphs above, because the kelp leaf arrives
 * painted to exactly the same contract: one frond on black, tip at the top row,
 * to be laid over a generated map that is already carrying the palette.
 *
 * `levelTo` is the map the strip has to stand in for, and its mean is what the
 * painting is scaled onto — so the caller keeps the colour and the value it
 * shipped with, and what the file changes is the variation along the leaf.
 *
 * Nothing is memoised here: the result is a second GPU upload, so the caller
 * holds it, one per painting.
 */
export function unpackStrip(texture: Texture, levelTo: DataTexture): Texture | null {
  const source = readImage(texture);
  if (!source) {
    return null;
  }
  return textureFromPixels(levelOnto(fullBleed(source), levelTo), texture);
}

let paintedBlade: Texture | undefined | null;
function unpackBlade(texture: Texture): Texture | null {
  if (paintedBlade !== undefined) {
    return paintedBlade;
  }

  paintedBlade = unpackStrip(texture, bladeTexture());
  return paintedBlade;
}

/** Stretches each row's painted span across the full width, root row first. */
function fullBleed(source: ImageData): ImageData {
  const { width, height, data } = source;
  const out = new ImageData(width, height);
  const luma = (i: number): number =>
    0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);

  /**
   * Where the paint is on each source row, resolved up front.
   *
   * Both strips taper to a point at *both* ends, so the outermost rows of each
   * are pure field with nothing on them at all. That used to be handled by
   * copying the row below, which is right in the middle of the image and wrong
   * at its edges — at `y = 0` "the row below" is index -1, `copyWithin` reads a
   * negative start as an offset from the end of the buffer, and every blade in
   * the meadow came out with the pale green of its own tip printed across its
   * root. It is a pale collar an inch above the sand, and it was in the frame
   * for two rounds before a wider blade made it big enough to notice.
   */
  const spans: ({ lo: number; hi: number } | null)[] = [];
  for (let row = 0; row < height; row++) {
    let lo = -1;
    let hi = -1;
    for (let x = 0; x < width; x++) {
      if (luma((row * width + x) * 4) > 24) {
        if (lo < 0) {
          lo = x;
        }
        hi = x;
      }
    }
    spans[row] = lo < 0 ? null : { lo, hi };
  }

  for (let y = 0; y < height; y++) {
    // The strip is painted tip-up; `v = 0` is the root.
    const row = nearestPainted(spans, height - 1 - y);
    const painted = spans[row];
    if (!painted) {
      // Nothing painted anywhere: hand the caller back its own procedural map.
      return source;
    }
    const { lo, hi } = painted;

    // Inset, because the painted edge is antialiased against the black and the
    // outermost column of every span is half field.
    const margin = (hi - lo) * BLADE_INSET;
    const from = lo + margin;
    const span = Math.max(1e-3, hi - lo - margin * 2);

    for (let x = 0; x < width; x++) {
      const at = from + ((x + 0.5) / width) * span;
      const left = Math.floor(at);
      const t = at - left;
      const a = (row * width + Math.max(0, Math.min(width - 1, left))) * 4;
      const b = (row * width + Math.max(0, Math.min(width - 1, left + 1))) * 4;
      const target = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        out.data[target + c] = (data[a + c] ?? 0) * (1 - t) + (data[b + c] ?? 0) * t;
      }
      out.data[target + 3] = 255;
    }
  }

  return out;
}

/** The given row if it carries paint, otherwise the closest row that does. */
function nearestPainted(
  spans: readonly ({ lo: number; hi: number } | null)[],
  row: number,
): number {
  if (spans[row]) {
    return row;
  }
  for (let step = 1; step < spans.length; step++) {
    if (spans[row - step]) {
      return row - step;
    }
    if (spans[row + step]) {
      return row + step;
    }
  }
  return row;
}

/** Scales a strip onto the generated map's mean, per channel. */
function levelOnto(strip: ImageData, target: DataTexture): ImageData {
  const generated = meanOf(target.image.data, 4);
  const painted = meanOf(strip.data, 4);

  for (let c = 0; c < 3; c++) {
    const scale = (generated[c] ?? 0) / Math.max(1, painted[c] ?? 1);
    for (let i = c; i < strip.data.length; i += 4) {
      const value = (strip.data[i] ?? 0) * scale;
      strip.data[i] = value > 255 ? 255 : value;
    }
  }

  return strip;
}

function meanOf(data: ArrayLike<number>, stride: number): number[] {
  const total = [0, 0, 0];
  for (let i = 0; i < data.length; i += stride) {
    for (let c = 0; c < 3; c++) {
      total[c] = (total[c] ?? 0) + (data[i + c] ?? 0);
    }
  }
  const count = data.length / stride;
  return total.map((sum) => sum / count);
}

/**
 * Root-to-tip gradient with lengthwise fibre. Narrow because the blade's UVs
 * only ever need one column: all the variation is along its length.
 */
let bladeMap: DataTexture | undefined;
function bladeTexture(): DataTexture {
  bladeMap ??= buildColorTexture(32, (u, v) => {
    // PlaneGeometry's v runs base (0) to tip (1) after the remap below.
    const toTip = v;
    const fibre = 0.9 + fbm(u * 4, v, { seed: SEEDS.grassBlade, period: 12, octaves: 2 }) * 0.24;
    // Edges of the blade catch a little more light than the centre rib.
    const across = 0.86 + Math.abs(u - 0.5) * 0.5;
    const shade = (0.52 + toTip * 0.72) * fibre * across;
    return [shade * 0.82, shade, shade * 0.66];
  });
  return bladeMap;
}

/** One of the three families, uniformly. */
function drawFamily(random: Random): readonly number[] {
  return (
    PALETTE_FAMILIES[Math.floor(random.next() * PALETTE_FAMILIES.length)] ?? PALETTE_FAMILIES[0]!
  );
}

/**
 * How far over the tip has turned by the top of the blade, in radians (W-L9).
 *
 * The old shape slid the tip sideways (`z = t² · 0.35`), which is a lean — the
 * blade stayed straight and the meadow read as hatching however it was
 * coloured. This is a true bow: the bend angle grows toward the tip and the
 * strip is *integrated* along it, so the blade is an arc that stands up at the
 * root and lies over at the tip, catching the light on its face exactly where
 * the sun-glow term wants a face to catch it. At 1.0 rad the tip has turned
 * about sixty degrees — a grass in current, well short of wilting.
 */
const TIP_BOW = 1.0;

/**
 * How far the blade turns about its own spine, root to tip, and how deep its
 * cross-section cups (W-N2, both).
 *
 * These two are what separate a leaf from a strap. A flat card catches the
 * toon ramp in one value across its whole width — the "flat plastic" the round
 * critic named — where a cupped section rolls the band across it, and a twist
 * means no blade is ever caught perfectly edge-on down its whole length (an
 * edge-on flat blade is a hairline, and a meadow of hairlines is hatching).
 * The cup rides the centre column the blade did not use to have.
 */
const BLADE_TWIST = 0.55;
const BLADE_CUP = 0.4;

/** Half-width along the blade: widest a quarter up, easing to a soft point. */
function lanceolate(t: number): number {
  const s = Math.min(1, Math.max(0, t));
  return Math.max(0.05, Math.sin(Math.PI * Math.pow(0.16 + s * 0.84, 0.72)) ** 0.8);
}

/**
 * A blade: a lanceolate leaf, bowed forward, cupped across and gently twisted
 * so a patch never collapses into a row of flat cards.
 *
 * Three columns rather than the two the strap had, and that is the vertex
 * cost of this package's meadow half — the centre column is what carries the
 * cup, and there is no cross-curvature without a vertex in the middle. The
 * four length segments stay: W-L9 measured a fifth as pure cost.
 */
function createBladeGeometry(): PlaneGeometry {
  const segments = 4;
  const geometry = new PlaneGeometry(BLADE_WIDTH, BLADE_HEIGHT, 2, segments);
  const position = geometry.attributes.position as BufferAttribute;

  // The arc, integrated once per row: each step advances along the current
  // bend angle, so height trades smoothly into reach and the strip's length
  // is exactly the blade's length however hard it bows. `bendAt` keeps each
  // row's own angle so the cup and twist can ride the row's frame.
  const rows = segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const bendAt = new Float32Array(rows);
  const step = BLADE_HEIGHT / segments;
  let y = 0;
  let z = 0;
  for (let row = 0; row < rows; row++) {
    arcY[row] = y;
    arcZ[row] = z;
    bendAt[row] = TIP_BOW * Math.pow(row / segments, 1.7);
    const angle = TIP_BOW * Math.pow((row + 0.5) / segments, 1.7);
    y += Math.cos(angle) * step;
    z += Math.sin(angle) * step;
  }

  const half = BLADE_WIDTH / 2;
  for (let i = 0; i < position.count; i++) {
    // PlaneGeometry is centred on the origin; recover the row from y and the
    // column from x, then rebuild the vertex in the row's own frame.
    const t = (position.getY(i) + BLADE_HEIGHT / 2) / BLADE_HEIGHT;
    const row = Math.round(t * segments);
    const column = position.getX(i) / half;
    const theta = bendAt[row] ?? 0;
    const twist = BLADE_TWIST * t;
    // The row's normal leans back as the blade bows; the across axis starts
    // as +x and turns about the spine as it climbs.
    const normalY = -Math.sin(theta);
    const normalZ = Math.cos(theta);
    const across = column * half * lanceolate(t);
    const cup = (1 - Math.abs(column)) * half * lanceolate(t) * BLADE_CUP;
    const offNormal = across * Math.sin(twist) + cup;
    position.setXYZ(
      i,
      across * Math.cos(twist),
      (arcY[row] ?? 0) + offNormal * normalY,
      (arcZ[row] ?? 0) + offNormal * normalZ,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}

/**
 * The tall variant's S-curve (W11), in radians at the blade's mid-bow.
 *
 * The meadow blade bows one way and stays bowed; a long eelgrass blade bows
 * out and then returns, the tip ending a third of a radian past vertical on
 * the way back. That return is what separates "grass that grew long" from
 * "grass that fell over" — the silhouette keeps a lifted, living tip instead
 * of a wilting one.
 */
const TALL_BOW = 0.7;
/** Spread over one extra length segment: the return of the S needs the row. */
const TALL_TWIST = 0.75;
const TALL_CUP = 0.5;

/**
 * The tall blade: the same lanceolate leaf, slimmer and nearly twice as long,
 * bowed in a gentle S and twisted a touch further so its length never reads
 * as a ribbon seen edge-on.
 */
function createTallBladeGeometry(): PlaneGeometry {
  const segments = 5;
  const geometry = new PlaneGeometry(TALL_WIDTH, TALL_HEIGHT, 2, segments);
  const position = geometry.attributes.position as BufferAttribute;

  const rows = segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const bendAt = new Float32Array(rows);
  const step = TALL_HEIGHT / segments;
  let y = 0;
  let z = 0;
  for (let row = 0; row < rows; row++) {
    arcY[row] = y;
    arcZ[row] = z;
    // The S: the bend angle peaks a little over a third of the way up and
    // comes back through vertical by the last quarter, so the tip hooks back
    // over the stand behind it instead of falling forward.
    bendAt[row] = TALL_BOW * Math.sin((row / segments) * Math.PI * 1.35);
    const angle = TALL_BOW * Math.sin(((row + 0.5) / segments) * Math.PI * 1.35);
    y += Math.cos(angle) * step;
    z += Math.sin(angle) * step;
  }

  const half = TALL_WIDTH / 2;
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + TALL_HEIGHT / 2) / TALL_HEIGHT;
    const row = Math.round(t * segments);
    const column = position.getX(i) / half;
    const theta = bendAt[row] ?? 0;
    const twist = TALL_TWIST * t;
    const normalY = -Math.sin(theta);
    const normalZ = Math.cos(theta);
    const across = column * half * lanceolate(t);
    const cup = (1 - Math.abs(column)) * half * lanceolate(t) * TALL_CUP;
    const offNormal = across * Math.sin(twist) + cup;
    position.setXYZ(
      i,
      across * Math.cos(twist),
      (arcY[row] ?? 0) + offNormal * normalY,
      (arcZ[row] ?? 0) + offNormal * normalZ,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}
