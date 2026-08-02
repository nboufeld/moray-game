import { Vector2, Vector3, type DataTexture } from "three";
import { SEEDS } from "../util/Random";
import { buildScalarTexture, fbm } from "./ProceduralTexture";

/** Edge of the paper grain tile, in texels. */
const GRAIN_SIZE = 256;

/**
 * The tooth of the paper, as a tiling scalar map.
 *
 * Three octaves on a 32-cell lattice: the coarse one is the sheet's own
 * unevenness, the finest lands a lattice cell every two texels, which at the
 * one-to-one sampling the grade does is the tooth itself. It is a `DataTexture`
 * for the same reasons every other map here is one — no DOM, and bit-identical
 * between runs, which is the only reason two screenshots can be compared.
 *
 * Not built at module scope, and not hung on {@link ColorGradeShader.uniforms}:
 * `ShaderPass` clones the shader's uniforms and `cloneUniforms` clones any
 * texture it finds, so a map parked there would be uploaded twice and the
 * original left orphaned. The pass that owns it sets it — see
 * `RendererAdapter`.
 */
export function createPaperGrain(): DataTexture {
  return buildScalarTexture(GRAIN_SIZE, (u, v) =>
    fbm(u, v, { seed: SEEDS.paperGrain, period: 32, octaves: 3, gain: 0.5 }),
  );
}

/** Grain tiles per screen: the repeat a buffer this wide has to sample with. */
export function grainRepeatFor(bufferWidth: number, bufferHeight: number): Vector2 {
  return new Vector2(bufferWidth / GRAIN_SIZE, bufferHeight / GRAIN_SIZE);
}

/**
 * Final grade, applied in linear space before tone mapping.
 *
 * Split toning is the workhorse here: throwing the shadows toward violet and
 * the highlights toward the sun separates depth planes far more
 * cheaply than any extra light would. The vignette settles the eye toward the
 * reticle, which is where the whole game asks the player to look — but only
 * just: a painted background is evenly lit to its corners, so anything the eye
 * can actually see as a darkening at the edge is already too much.
 *
 * Contrast sits *below* 1, which is not a mistake and not timidity. A gouache
 * painting has a shorter value range than a photograph: it starts from an
 * opaque mid-key ground and works a little way in each direction, so the
 * distance between the lightest and darkest note in the frame is small and
 * every step inside it counts. Above 1 the grade is spending that range on
 * separating the sunlit sand from the water, which is exactly the split this
 * pivot exists to close.
 */
export const ColorGradeShader = {
  name: "ColorGradeShader",

  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.04 },
    uContrast: { value: 0.98 },
    uVignette: { value: 0.22 },
    /**
     * Violet, not cyan: red is held at full and *green* is the channel that
     * gives way. A shadow tint with red below green is the reflex for water,
     * and it is what was quietly cancelling the violet in the ambient — the
     * light put red into the shadows and the grade took it straight back out,
     * leaving the ordinary blue-green shadow of a photograph.
     */
    uShadowTint: { value: new Vector3(1.0, 0.95, 1.16) },
    uHighlightTint: { value: new Vector3(1.06, 1.02, 0.94) },
    /**
     * Discovery swell, 0 when nothing is happening. The reef itself does not
     * change — the grade does, briefly: the water saturates and the vignette
     * opens, which reads as the moment landing rather than as an effect being
     * played over it.
     */
    uPulse: { value: 0 },
    /** The paper, set by whoever owns the pass; see {@link createPaperGrain}. */
    tGrain: { value: null },
    /** How many grain tiles cover the frame, so the tooth is fixed in pixels. */
    uGrainRepeat: { value: new Vector2(1, 1) },
    /** One texel of this pass's own buffer — the reach of the edge taps. */
    uTexel: { value: new Vector2(1 / 1920, 1 / 1080) },
    /**
     * The water's pigment, scaled so its largest channel is 1.
     *
     * The pooling below is a *multiply* by this, which is what makes it a
     * darkening that can never reach black however strong the edge: the tint
     * only ever takes a channel down toward the water's own proportions, and
     * this water is turquoise, so what an edge loses is red. Written from
     * `scene.fog` each frame, so the reef and the sanctuary each pool in their
     * own water.
     */
    uPoolTint: { value: new Vector3(1, 1, 1) },
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uVignette;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uPulse;
    uniform sampler2D tGrain;
    uniform vec2 uGrainRepeat;
    uniform vec2 uTexel;
    uniform vec3 uPoolTint;

    varying vec2 vUv;

    /** How far the swell lifts saturation and opens the vignette at full strength. */
    const float PULSE_SATURATION = 0.12;
    const float PULSE_VIGNETTE = 0.2;

    // Linear-space mid grey, the pivot both contrast and the tint split use.
    const float MID = 0.18;
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

    /**
     * The floor of the world, in linear light. Nothing in frame is allowed
     * below it, and it is bluer than it is anything else, so the place a
     * shadow bottoms out is a blue-violet and not a black.
     */
    const vec3 SHADOW_LIFT = vec3(0.05, 0.045, 0.10);
    /** Where the lift has faded to nothing — well under the reef's midtone. */
    const float SHADOW_LIFT_TOP = 0.25;

    /**
     * The window the difference is read through, in linear luminance across one
     * texel. Below the first, everything the frame has — dither, the grain of a
     * map, the terminator of a toon band — would pool, and the whole picture
     * would gain a dirty outline. Above the second lie only the boundaries
     * between one wash and the next.
     *
     * Two thirds of what they were when this read across two texels rather than
     * one — not half, which is the arithmetic answer and the wrong one. A step
     * this frame actually contains is two or three pixels wide by the time the
     * bloom has been over it, and a one-texel difference across a soft ramp is
     * more than half a two-texel one. Halved, the probe measured the pooling
     * covering a quarter more of the frame and a fifth deeper than the version
     * it replaced.
     */
    const float EDGE_LOW = 0.02;
    const float EDGE_HIGH = 0.145;
    /** How far a fully pooled edge is taken toward the water's hue, and down. */
    const float POOL_TINT = 0.2;
    const float POOL_DARKEN = 0.06;

    /**
     * The paper: a multiplier that averages 1 and swings three percent either
     * side of it.
     *
     * That is twice the swing this started at, and the reason is measurement
     * rather than taste. Linear light is what this multiplies, and the sRGB
     * transfer flattens a proportional change by roughly a factor of two on the
     * way out, so a one-and-a-half percent swing arrives as *one part in 255* on
     * lit sand — under the frame's own dither, and probe-paint.mjs reports it as
     * a range of -2..2 with a median of nothing. Doubled it lands at two to
     * three parts, which is a tooth you can find in the flat water of shot A and
     * still cannot see in the sand. Doubling it again is visible as mottling,
     * which is a filter rather than a sheet.
     *
     * (No backticks in here, or anywhere else inside these shader strings: the
     * whole program is a template literal and one closes it.)
     */
    const float GRAIN_FLOOR = 0.97;
    const float GRAIN_RANGE = 0.06;

    float lumaAt(vec2 uv) {
      return dot(texture2D(tDiffuse, uv).rgb, LUMA);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;

      // Pigment pooling at the boundary between two washes. Read as a gradient
      // rather than as a laplacian, so that a smooth ramp — a fogged distance,
      // the swell of a dune — scores nothing.
      //
      // Two taps, forward from the pixel already in hand, rather than the
      // symmetric cross of four this started as. That is not a stylistic
      // choice: measured with probe-paint.mjs, a full-frame texture fetch costs
      // between four and five milliseconds on the software rasteriser the
      // capture harness runs on, and the cross was eighteen of them — more than
      // the rest of this package put together and more than the frame budget
      // had. Forward differencing shifts the mark half a pixel off centre,
      // which on an effect that is a soft darkening is not a thing that can be
      // seen, and it halves the bill.
      //
      // It runs here, on the picture, rather than at the end on the graded
      // frame: this is meant to be pigment that settled while the wash was wet,
      // so everything below has to happen *to* it. The floor further down is
      // what keeps a pooled edge inside a shadow from sinking toward black.
      float here = dot(color, LUMA);
      float edge =
        abs(here - lumaAt(vUv + vec2(uTexel.x, 0.0))) +
        abs(here - lumaAt(vUv + vec2(0.0, uTexel.y)));
      float pooling = smoothstep(EDGE_LOW, EDGE_HIGH, edge);
      color *= mix(vec3(1.0), uPoolTint, POOL_TINT * pooling) * (1.0 - POOL_DARKEN * pooling);

      float luma = dot(color, LUMA);

      // The split crosses over well below mid grey. Everything that is merely
      // unlit — the whole shadow side of the reef — belongs on the cold side of
      // it, and a crossover at 0.6 put most of that in the warm half instead.
      color *= mix(uShadowTint, uHighlightTint, smoothstep(0.0, 0.45, luma));
      color = mix(vec3(luma), color, uSaturation + PULSE_SATURATION * uPulse);
      // Saturation can drive a channel of a strongly coloured pixel below zero.
      color = max(color, 0.0);

      // Contrast about the pivot as a ratio, not as a subtraction. This buffer
      // is scene-linear and most of a lit underwater frame sits well below mid
      // grey, so subtracting the pivot, scaling and adding it back does not
      // expand the range there — it subtracts a constant, and everything under
      // MID - MID/uContrast lands negative and clamps to pure black, which is
      // the mud this grade was accused of. Scaling the ratio to the pivot
      // instead expands about the same point, pushes darks toward black
      // asymptotically rather than into it, and lifts what is above the pivot
      // the way a contrast control is supposed to.
      //
      // It runs on luminance and is applied back as a single gain. That keeps it
      // out of the business of colour — a per-channel power quietly shifts hue
      // as it lifts, and saturation is already a knob of its own right above —
      // and it costs one pow per pixel rather than three, which is not free on
      // the software rasteriser the capture and frame-cost harnesses run on.
      float lum = max(dot(color, LUMA), 1e-4);
      float graded = MID * pow(lum / MID, uContrast);
      color *= graded / lum;

      // The floor. There used to be a toe here doing the exact opposite —
      // rolling the last stop above black *into* black so cave mouths went
      // properly dark. This is the pivot in one line: the darkest thing in the
      // world is now a colour, not the absence of one, and the frame is lifted
      // onto it before anything else can reach zero. It is an addition rather
      // than a mix so it cannot touch the midtones at all.
      color += SHADOW_LIFT * (1.0 - smoothstep(0.0, SHADOW_LIFT_TOP, graded));

      vec2 offset = vUv - 0.5;
      color *= 1.0 - max(uVignette - PULSE_VIGNETTE * uPulse, 0.0) * dot(offset, offset);

      // The paper, last and in screen space: it is the sheet the picture is
      // printed on, not a surface inside it, so it does not move with the
      // camera and nothing in the frame is allowed to modulate it. One fetch,
      // and a swing of a percent and a half either side — at the point where
      // it can be *seen* as noise it has stopped being paper.
      float grain = texture2D(tGrain, vUv * uGrainRepeat).r;
      color *= GRAIN_FLOOR + grain * GRAIN_RANGE;

      gl_FragColor = vec4(max(color, 0.0), texel.a);
    }
  `,
};
