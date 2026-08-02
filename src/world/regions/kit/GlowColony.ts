import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Object3D,
  Points,
  PointsMaterial,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { buildScalarTexture } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random } from "../../../util/Random";
import type { KitBuild } from "./KitTypes";

/**
 * `glowColony` (KIT-SPEC §3.3) — clustered luminous buds for the dark
 * registers, the W-O1 polyp discipline baked in as LAW rather than as
 * habit:
 * - the bud's tip-gradient shapes the light itself through the
 *   `emissivemap_fragment` vertex-colour chunk (a flat emissive dome is
 *   a lit dot; a gradient one is a living bud);
 * - halo points hang just ABOVE the tips (the depth-test lesson — a
 *   halo inside the bud is swallowed by its own geometry);
 * - radial-sprite points, never bare squares;
 * - halo opacity ≤ 0.28 and emissive ≤ 0.36 — far under the bloom
 *   pass's 0.82, so a colony can never become a bloom source.
 *
 * Tint obeys MASTER §1.1's register rule at the CALL site: warm-rising
 * in Smoulder country, cold-settling in Calamity country, free
 * elsewhere — the kit takes one tint and asks no questions.
 *
 * Budget note: 2 draws (instanced buds + one halo `Points`). The bud is
 * an 80-tri squashed icosahedron; a 6-anchor × 7-bud colony is 42
 * instances ≈ 3.4k tris. Everything is still: seated colonies keep
 * frustum culling under instance-aware spheres, and there is no update.
 */

export interface GlowColonyOptions {
  readonly seed: number;
  /** sRGB hex — the colony's light. The register rule is the caller's. */
  readonly tint: number;
  /** Bud cluster centres, world space, already ON the caller's surface. */
  readonly anchors: readonly (readonly [number, number, number])[];
  readonly budsPerAnchor: number;
  /** Emissive intensity; clamped to the spec cap 0.36. */
  readonly glow?: number;
}

const EMISSIVE_CAP = 0.36;
const HALO_OPACITY_CAP = 0.28;

/** How far buds scatter around their anchor, metres. */
const CLUSTER_RADIUS = 0.45;

/**
 * The bud body's multiplier on the tint — deep and violet-leaning (red
 * held above green's cut), because the glow only reads as LIGHT against
 * a body that is clearly darker than it: a body near the tint's own
 * value is a pale egg, not a lantern (the canyon polyps' dark indigo
 * base, generalised to any tint).
 */
const BODY_MULTIPLIER = new Color(0.24, 0.18, 0.36);

/** The emissive chunk the canyon's polyps proved: light wears the tint. */
const TINTED_EMISSIVE_CHUNK = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance *= vColor;
`;

let haloSpriteTexture: DataTexture | undefined;

function haloSprite(): DataTexture {
  haloSpriteTexture ??= buildScalarTexture(32, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    // A hot pinprick core inside a soft skirt — what makes a bud read as
    // LIGHT rather than as a lit object.
    const core = Math.pow(Math.max(0, 1 - distance * 2.2), 2);
    const skirt = Math.pow(Math.max(0, 1 - distance), 2.6) * 0.55;
    return Math.min(1, core + skirt);
  });
  return haloSpriteTexture;
}

/** The shared bud: a squashed dome with the tip gradient baked in. */
function budGeometry(): BufferGeometry {
  const geometry = new IcosahedronGeometry(0.13, 1);
  geometry.scale(1, 0.62, 1);
  smoothNormals(geometry);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    // Apex-lit, RADIALLY: the canyon's bottom-to-top ramp reads only from
    // ground level — seen from above, a dome's whole visible cap shares
    // one y band and the bud goes flat. Distance from the apex axis
    // darkens the rim from EVERY viewpoint, so the tip always reads as
    // the light source and the rim as the body holding it.
    const radial = Math.hypot(position.getX(i), position.getZ(i)) / 0.13;
    const t = Math.min(1, Math.max(0, 1 - radial));
    const value = 0.18 + 0.82 * Math.pow(t, 1.2);
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    // A whisper of blue at the rim, so the shaded edge stays a colour.
    colors[i * 3 + 2] = Math.min(1, value + 0.08 * (1 - t));
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

export function buildGlowColony(options: GlowColonyOptions): KitBuild {
  const random = new Random(options.seed);
  const group = new Group();
  group.name = "kit-glow-colony";
  const tint = new Color(options.tint);
  const count = options.anchors.length * options.budsPerAnchor;

  // ─── The buds ─────────────────────────────────────────────────────────────
  const geometry = budGeometry();
  const material = createToonMaterial({
    color: tint.clone().multiply(BODY_MULTIPLIER),
    emissive: options.tint,
    emissiveIntensity: Math.min(options.glow ?? 0.3, EMISSIVE_CAP),
    vertexColors: true,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      TINTED_EMISSIVE_CHUNK,
    );
  };
  material.customProgramCacheKey = () => "kit-glow-colony";

  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "kit-glow-buds";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const dummy = new Object3D();
  const instanceTint = new Color();
  const halos = new Float32Array(count * 3);
  const haloShade = new Float32Array(count * 3);
  let index = 0;
  for (const [ax, ay, az] of options.anchors) {
    for (let b = 0; b < options.budsPerAnchor; b++) {
      const angle = random.range(0, Math.PI * 2);
      // Biased outward, so the cluster reads as a bed and not a stack.
      const radius = CLUSTER_RADIUS * Math.sqrt(random.next());
      const x = ax + Math.cos(angle) * radius;
      const z = az + Math.sin(angle) * radius;
      const scaleXZ = random.range(0.7, 1.4);
      const scaleY = scaleXZ * random.range(0.75, 1.1);
      dummy.position.set(x, ay + 0.02, z);
      dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
      dummy.scale.set(scaleXZ, scaleY, scaleXZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      // Value jitter only — variety by value, never by hue noise.
      const value = random.range(0.8, 1.15);
      instanceTint.setRGB(value, value, value);
      mesh.setColorAt(index, instanceTint);

      // The halo hangs just ABOVE the tip (the depth-test lesson).
      halos[index * 3] = x;
      halos[index * 3 + 1] = ay + 0.02 + scaleY * 0.0806 + 0.045;
      halos[index * 3 + 2] = z;
      const haloValue = value * random.range(0.75, 1);
      haloShade[index * 3] = tint.r * haloValue;
      haloShade[index * 3 + 1] = tint.g * haloValue;
      haloShade[index * 3 + 2] = tint.b * haloValue;
      index += 1;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  // Instance-aware bounds off the REAL matrices (the sill-stones trap):
  // seated colonies keep frustum culling.
  mesh.computeBoundingSphere();
  group.add(mesh);

  // ─── The halos ────────────────────────────────────────────────────────────
  const haloGeometry = new BufferGeometry();
  haloGeometry.setAttribute("position", new BufferAttribute(halos, 3));
  haloGeometry.setAttribute("color", new BufferAttribute(haloShade, 3));
  haloGeometry.computeBoundingSphere();

  const haloMaterial = new PointsMaterial({
    size: 0.2,
    map: haloSprite(),
    transparent: true,
    opacity: HALO_OPACITY_CAP,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
    vertexColors: true,
  });
  const haloPoints = new Points(haloGeometry, haloMaterial);
  haloPoints.name = "kit-glow-halos";
  haloPoints.renderOrder = 3;
  group.add(haloPoints);

  return {
    group,
    draws: 2,
    triangles: ((geometry.index?.count ?? geometry.attributes.position!.count) / 3) * count,
    dispose(): void {
      geometry.dispose();
      material.dispose();
      mesh.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      group.clear();
      group.removeFromParent();
    },
  };
}
