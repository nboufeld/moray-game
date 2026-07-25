import { Vector3 } from "three";

/**
 * Final grade, applied in linear space before tone mapping.
 *
 * Split toning is the workhorse here: cooling the shadows toward the water and
 * warming the highlights toward the sun separates depth planes far more
 * cheaply than any extra light would. The vignette settles the eye toward the
 * reticle, which is where the whole game asks the player to look.
 */
export const ColorGradeShader = {
  name: "ColorGradeShader",

  uniforms: {
    tDiffuse: { value: null },
    uSaturation: { value: 1.06 },
    uContrast: { value: 1.16 },
    uVignette: { value: 0.62 },
    uToe: { value: 0.012 },
    uShadowTint: { value: new Vector3(0.72, 0.93, 1.08) },
    uHighlightTint: { value: new Vector3(1.05, 1.0, 0.94) },
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
    uniform float uToe;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;

    varying vec2 vUv;

    // Linear-space mid grey, the pivot both contrast and the tint split use.
    const float MID = 0.18;
    const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;

      float luma = dot(color, LUMA);

      // The split crosses over well below mid grey. Everything that is merely
      // unlit — the whole shadow side of the reef — belongs on the cold side of
      // it, and a crossover at 0.6 put most of that in the warm half instead.
      color *= mix(uShadowTint, uHighlightTint, smoothstep(0.0, 0.45, luma));
      color = mix(vec3(luma), color, uSaturation);
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
      // Then a toe: ~1 for anything bright, rolling off only the last stop above
      // black, so cave mouths and rock undersides reach true black without
      // taking the shadow detail just above them with it.
      //
      // Both run on luminance and are applied back as a single gain. That keeps
      // them out of the business of colour — a per-channel power quietly shifts
      // hue as it lifts, and saturation is already a knob of its own right above
      // — and it costs one pow per pixel rather than three, which is not free on
      // the software rasteriser the capture and frame-cost harnesses run on.
      float lum = max(dot(color, LUMA), 1e-4);
      float graded = MID * pow(lum / MID, uContrast);
      graded *= graded / (graded + uToe);
      color *= graded / lum;

      vec2 offset = vUv - 0.5;
      color *= 1.0 - uVignette * dot(offset, offset);

      gl_FragColor = vec4(max(color, 0.0), texel.a);
    }
  `,
};
