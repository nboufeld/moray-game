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
    uContrast: { value: 1.04 },
    uVignette: { value: 0.42 },
    uShadowTint: { value: new Vector3(0.9, 0.99, 1.06) },
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
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;

    varying vec2 vUv;

    // Linear-space mid grey, the pivot both contrast and the tint split use.
    const float MID = 0.18;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

      color *= mix(uShadowTint, uHighlightTint, smoothstep(0.0, 0.6, luma));
      color = mix(vec3(luma), color, uSaturation);
      color = (color - MID) * uContrast + MID;

      vec2 offset = vUv - 0.5;
      color *= 1.0 - uVignette * dot(offset, offset);

      gl_FragColor = vec4(max(color, 0.0), texel.a);
    }
  `,
};
