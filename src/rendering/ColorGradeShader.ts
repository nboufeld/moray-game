import { Vector3 } from "three";

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

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;

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

      gl_FragColor = vec4(max(color, 0.0), texel.a);
    }
  `,
};
