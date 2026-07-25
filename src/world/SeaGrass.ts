import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Vector2,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { Random } from "../util/Random";
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
 * Instanced sea grass. A blade is a tapered, slightly curved strip rather than
 * a cone — cones read as conifers, which is the single loudest "greybox" tell
 * in the reef. Sway happens in the vertex shader so a whole meadow costs one
 * uniform update per frame instead of hundreds of matrix rewrites.
 */
export class SeaGrass {
  readonly mesh: InstancedMesh;

  private readonly sway = { value: 0 };
  private readonly windStrength = { value: 1 };

  constructor(seed: number, clearances: readonly Vector2[]) {
    const random = new Random(seed);
    const material = new MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0,
      side: DoubleSide,
      // Blades are thin and backlit as often as not; a little translucency
      // stops the far side of a patch reading as a dark hole.
      transparent: false,
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
    };

    const total = PATCH_COUNT * BLADES_PER_PATCH;
    this.mesh = new InstancedMesh(createBladeGeometry(), material, total);
    this.mesh.receiveShadow = true;
    // Blades still catch shadow from the reef above them, but they do not cast:
    // several hundred double-sided instances in the shadow pass cost far more
    // than the faint stippling they would add to the sand.
    this.mesh.castShadow = false;

    const dummy = new Object3D();
    const color = new Color();
    let placed = 0;

    for (let patch = 0; patch < PATCH_COUNT; patch++) {
      const patchX = random.signed(30);
      const patchZ = random.signed(30);

      for (let blade = 0; blade < BLADES_PER_PATCH; blade++) {
        // Bias toward the middle so patches have a dense heart and soft edges.
        const spread = PATCH_RADIUS * Math.sqrt(random.next());
        const angle = random.range(0, Math.PI * 2);
        const x = patchX + Math.cos(angle) * spread;
        const z = patchZ + Math.sin(angle) * spread;

        if (clearances.some((spot) => spot.distanceToSquared(new Vector2(x, z)) < CLEARANCE_SQ)) {
          continue;
        }

        dummy.position.set(x, seabedHeight(x, z) - 0.05, z);
        dummy.rotation.set(random.signed(0.12), random.range(0, Math.PI * 2), random.signed(0.12));
        dummy.scale.set(random.range(0.75, 1.25), random.range(0.6, 1.45), 1);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(placed, dummy.matrix);

        color.setHex(PALETTE[Math.floor(random.next() * PALETTE.length)] ?? PALETTE[0]!);
        // Deeper blades sit in shade; lighter tips catch the surface light.
        color.multiplyScalar(random.range(0.75, 1.15));
        this.mesh.setColorAt(placed, color);
        placed++;
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
