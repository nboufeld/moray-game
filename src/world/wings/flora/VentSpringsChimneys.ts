import { BufferAttribute, Color, LatheGeometry, Vector2, type BufferGeometry } from "three";
import { fbm } from "../../../rendering/ProceduralTexture";
import { Random } from "../../../util/Random";
import type { MeshToonMaterial } from "three";

/**
 * The Vent Springs' mineral chimneys: stacked lathe profiles in charcoal,
 * veined with amber.
 *
 * A chimney is the one place in the wing where the silhouette does the
 * geology: a fat buried foot, a waist, a shoulder, and a crater lip that
 * turns back into the stack — the profile a smoker actually grows as
 * mineral falls out of its own plume. The outline is an authored point
 * list with a seeded wobble per archetype (the `RockShapes` argument: the
 * silhouette is the drawing, the noise is the tooth), revolved by
 * `LatheGeometry` and roughed seam-safe afterwards.
 *
 * The colour is baked per vertex because it is mineral, not paint: charcoal
 * strata climbing the stack — warm dark greys, red above green, the darkest
 * still a colour — with amber veins that strengthen toward the crown, where
 * the heat is. The same vertex colour then does double duty in the
 * material's emissive term (see {@link VEIN_GLOW_CHUNK}), so the veins are
 * the only part that glows and the glow is the vein's own amber, far under
 * the bloom threshold.
 */

/** The charcoal strata: warm dark greys, never black. */
const FOOT = new Color(0x3a2f28);
const MID = new Color(0x4a3c32);
const CROWN = new Color(0x5a4636);
/** The veins' amber, held to one hot note so the water stays strange, not loud. */
const VEIN = new Color(0.95, 0.48, 0.14);
/** Pale sinter crust near the crown, where fresh mineral falls out. */
const CRUST = new Color(0x8a7460);

const SINK = 0.3;

/**
 * The emissive-by-vertex-colour patch, the canyon polyps' own trick: the
 * chimney's glow rides the baked veins instead of lying flat over the
 * whole stack. Module constant so three's program cache keys it once.
 */
export const VEIN_GLOW_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

/** Patches a toon material so its emissive follows the baked vertex colour. */
export function applyVeinGlow(material: MeshToonMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      VEIN_GLOW_CHUNK,
    );
  };
}

/**
 * One chimney archetype, unit height and roughly unit base radius. The
 * variant jitters the authored profile's control points, so three
 * archetypes read as three chimneys rather than one chimney three times —
 * and the per-instance transforms do the rest.
 */
export function chimneyGeometry(seed: number, variant: number): BufferGeometry {
  const random = new Random(seed ^ (0x1c2e + variant * 0x9e37));
  const wobble = (magnitude: number): number => 1 + random.signed(magnitude);

  // The authored outline: (radius, height) pairs from the buried foot to
  // the crater's floor, the lip turning back inside the stack.
  const profile: readonly (readonly [number, number])[] = [
    [1.12, -SINK + 0.05],
    [1.02, 0.08],
    [0.84, 0.28],
    [0.7, 0.5],
    [0.6, 0.7],
    [0.52, 0.86],
    [0.46, 0.96],
    [0.42, 1.0],
    [0.27, 1.0],
    [0.18, 0.9],
    [0.12, 0.78],
  ];

  const points: Vector2[] = [new Vector2(0, -SINK)];
  for (const [radius, y] of profile) {
    points.push(new Vector2(radius * wobble(0.09), y * wobble(0.04)));
  }
  points.push(new Vector2(0, 0.74));

  const geometry = new LatheGeometry(points, 13);
  roughChimney(geometry, seed);
  bakeMineral(geometry, seed);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Knocks a chimney out of round, the `roughLathe` contract: the noise
 * multiplies the horizontal radius and is sampled by direction and height,
 * so the lathe's duplicated seam column displaces identically. The taper
 * keeps the buried foot and the crater lip exactly where they were drawn.
 */
function roughChimney(geometry: BufferGeometry, seed: number): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const extent = Math.max(1e-3, maxY - minY);

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radius = Math.hypot(x, z);
    if (radius < 1e-4) {
      continue;
    }
    const t = (y - minY) / extent;
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;
    const lump = fbm(u, t, { seed, period: 3, octaves: 2 }) - 0.5;
    const scale = 1 + lump * 2 * 0.1 * Math.sin(Math.PI * t);
    position.setX(i, x * scale);
    position.setZ(i, z * scale);
  }
  position.needsUpdate = true;
}

/**
 * The mineral bake: charcoal strata low to high, amber veins strengthening
 * toward the crown, and drifts of pale sinter crust. All of it multiplies
 * the instance colour in the material, so the per-chimney weathering drift
 * is untouched.
 */
function bakeMineral(geometry: BufferGeometry, seed: number): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const extent = Math.max(1e-3, maxY - minY);

  const colors = new Float32Array(position.count * 3);
  const tint = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const t = (y - minY) / extent;
    const u = Math.atan2(z, x) / (Math.PI * 2) + 0.5;

    // The strata, with a within-band ripple so the stack is not three flat
    // washes.
    if (t < 0.45) {
      tint.copy(FOOT).lerp(MID, t / 0.45);
    } else {
      tint.copy(MID).lerp(CROWN, (t - 0.45) / 0.55);
    }
    const ripple = 0.92 + fbm(u * 2, t * 3, { seed: seed ^ 0x6a31, period: 4, octaves: 2 }) * 0.16;
    tint.multiplyScalar(ripple);

    // The veins: a thresholded field stretched vertically, waking above the
    // waist. Taking colour *out* first and adding amber back keeps the
    // vein a mineral inclusion rather than a stripe painted over the rock.
    const field = fbm(u * 2.5, t * 1.1, { seed: seed ^ 0x4b17, period: 3, octaves: 2 });
    const vein = smooth01((field - 0.6) / 0.14) * smooth01((t - 0.3) / 0.3);
    tint.multiplyScalar(1 - vein * 0.45);
    tint.r += vein * VEIN.r * 0.85;
    tint.g += vein * VEIN.g * 0.85;
    tint.b += vein * VEIN.b * 0.85;

    // The crust: pale sinter drifts near the crown.
    const crust =
      smooth01((fbm(u * 4, t * 5, { seed: seed ^ 0x2f09, period: 3, octaves: 2 }) - 0.58) / 0.2) *
      smooth01((t - 0.55) / 0.25) *
      0.45;
    tint.lerp(CRUST, crust);

    colors[i * 3] = Math.min(1, tint.r);
    colors[i * 3 + 1] = Math.min(1, tint.g);
    colors[i * 3 + 2] = Math.min(1, tint.b);
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}
