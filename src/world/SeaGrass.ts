import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  Vector2,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { buildColorTexture, fbm } from "../rendering/ProceduralTexture";
import { createToonMaterial } from "../rendering/ToonShading";
import { Random, SEEDS } from "../util/Random";
import { seabedHeight } from "./Seabed";

const BLADE_HEIGHT = 1.25;
const BLADE_WIDTH = 0.13;

/** Meadow patches read as habitat; blades sprinkled evenly read as a texture. */
const PATCH_COUNT = 26;
const BLADES_PER_PATCH = 26;
const PATCH_RADIUS = 3.2;

/** Squared distance a blade must keep from a crevice mouth. */
const CLEARANCE_SQ = 16;

const PALETTE = [0x4f9d6b, 0x3f8a5e, 0x63ab6d, 0x2f7a58, 0x76b877];

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
}

/**
 * Instanced sea grass. A blade is a tapered, slightly curved strip rather than
 * a cone — cones read as conifers, which is the single loudest "greybox" tell
 * in the reef. Sway happens in the vertex shader so a whole meadow costs one
 * uniform update per frame instead of hundreds of matrix rewrites.
 */
export class SeaGrass {
  readonly mesh: InstancedMesh;

  private readonly sway = { value: 0 };
  private readonly windStrength = { value: 1 };

  constructor(seed: number, clearances: readonly Vector2[], clumps: readonly GrassClump[] = []) {
    const random = new Random(seed);
    const material = createToonMaterial({
      side: DoubleSide,
      // Dark root climbing to a sun-bleached tip, with lengthwise fibre. A flat
      // green blade reads as a cactus spine; the gradient is what makes it read
      // as a leaf.
      map: bladeTexture(),
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

      // Cheap translucency. Blades are a fraction of a millimetre thick and are
      // backlit by the shafts as often as not, so the far side of a patch
      // should glow rather than fall into shadow.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
         float facing = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
         gl_FragColor.rgb += diffuseColor.rgb * vec3(0.16, 0.29, 0.22) * facing;`,
      );
    };

    const total =
      PATCH_COUNT * BLADES_PER_PATCH + clumps.reduce((sum, clump) => sum + clump.blades, 0);
    this.mesh = new InstancedMesh(createBladeGeometry(), material, total);
    this.mesh.receiveShadow = true;
    // Blades still catch shadow from the reef above them, but they do not cast:
    // several hundred double-sided instances in the shadow pass cost far more
    // than the faint stippling they would add to the sand.
    this.mesh.castShadow = false;

    const dummy = new Object3D();
    const color = new Color();
    let placed = 0;

    const plant = (x: number, z: number, heightScale: number): void => {
      if (clearances.some((spot) => spot.distanceToSquared(new Vector2(x, z)) < CLEARANCE_SQ)) {
        return;
      }

      dummy.position.set(x, seabedHeight(x, z) - 0.05, z);
      dummy.rotation.set(random.signed(0.12), random.range(0, Math.PI * 2), random.signed(0.12));
      dummy.scale.set(random.range(0.75, 1.25), random.range(0.6, 1.45) * heightScale, 1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(placed, dummy.matrix);

      color.setHex(PALETTE[Math.floor(random.next() * PALETTE.length)] ?? PALETTE[0]!);
      // Deeper blades sit in shade; lighter tips catch the surface light.
      color.multiplyScalar(random.range(0.75, 1.15));
      this.mesh.setColorAt(placed, color);
      placed++;
    };

    for (let patch = 0; patch < PATCH_COUNT; patch++) {
      const patchX = random.signed(30);
      const patchZ = random.signed(30);

      for (let blade = 0; blade < BLADES_PER_PATCH; blade++) {
        // Bias toward the middle so patches have a dense heart and soft edges.
        const spread = PATCH_RADIUS * Math.sqrt(random.next());
        const angle = random.range(0, Math.PI * 2);
        plant(patchX + Math.cos(angle) * spread, patchZ + Math.sin(angle) * spread, 1);
      }
    }

    // Authored clumps are drawn last so that adding one leaves the scattered
    // meadow taking exactly the numbers it took before, and only the clump is
    // new in the next screenshot.
    for (const clump of clumps) {
      for (let blade = 0; blade < clump.blades; blade++) {
        const spread = clump.radius * Math.sqrt(random.next());
        const angle = random.range(0, Math.PI * 2);
        plant(
          clump.x + Math.cos(angle) * spread,
          clump.z + Math.sin(angle) * spread,
          clump.heightScale,
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
  }

  update(dt: number, reducedMotion: boolean): void {
    this.sway.value += dt * (reducedMotion ? 0.35 : 1);
    this.windStrength.value = reducedMotion ? 0.45 : 1;
  }
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

/**
 * A blade: narrow at the tip, widest near the base, curled slightly forward so
 * a patch never collapses into a row of flat cards.
 */
function createBladeGeometry(): PlaneGeometry {
  const segments = 4;
  const geometry = new PlaneGeometry(BLADE_WIDTH, BLADE_HEIGHT, 1, segments);
  const position = geometry.attributes.position as BufferAttribute;

  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    // PlaneGeometry is centred on the origin; shift so the root sits at y = 0.
    const t = (y + BLADE_HEIGHT / 2) / BLADE_HEIGHT;
    position.setX(i, position.getX(i) * (1 - t * 0.82));
    position.setY(i, y + BLADE_HEIGHT / 2);
    position.setZ(i, t * t * 0.22);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}
