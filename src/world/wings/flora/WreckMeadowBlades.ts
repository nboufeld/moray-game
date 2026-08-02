import {
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  Vector3,
  type Camera,
  type DataTexture,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { SUN_POSITION } from "../../../rendering/Lighting";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { angleBetween, wedgeHalfAt, wingBlend } from "../WingGeometry";
import type { WingDef } from "../WingTypes";

/**
 * A wing's blade meadow, rebuilt locally from the reef's seagrass idiom —
 * `SeaGrass` itself scatters the bowl's meadow around the origin and is
 * another worker's file this wave, so the wings grow their own. The shape
 * language is the same, because the round critic was right about it: a
 * blade is a tapered strip with a bow in it, a cup across it and a twist
 * along it, never a cone and never a flat card.
 *
 * Everything the two client wings share is decided here once (geometry,
 * shader, placement arithmetic); everything that makes a place itself
 * arrives as options — the Wreck Meadow's dense, muted stands riding the
 * wing floor, the Moonlit Lagoon's sparse silver tufts kept short around
 * the koi's circle. One geometry, one texture, one draw call per meadow.
 */

/**
 * A patch family: three greens (mid, pale, deep) in one value band, the
 * meadow's drift of related colour rather than a lawn's single wash.
 */
export interface BladePalette {
  readonly families: readonly (readonly number[])[];
}

export interface BladeMeadowOptions {
  readonly def: WingDef;
  /** The meadow's own substream (`SEEDS[def.seedKey] ^ …`). */
  readonly seed: number;
  readonly patches: number;
  readonly bladesPerPatch: number;
  readonly patchRadius: number;
  /** The radial band along the wing's axis the meadow rides. */
  readonly radiusFrom: number;
  readonly radiusTo: number;
  readonly palette: BladePalette;
  /** Blade height and width, before per-instance spread. */
  readonly bladeHeight?: number;
  readonly bladeWidth?: number;
  /** Per-blade height draw, multiplied by `bladeHeight`. */
  readonly heightRange?: readonly [number, number];
  /** Faint self-light for wings whose mood takes the rig away. */
  readonly emissive?: number;
  readonly emissiveIntensity?: number;
  /**
   * Lateral clearance a blade must keep from the wing's axis while inside
   * the gate corridor, in metres. The doorway stays swimmable.
   */
  readonly gateMargin?: number;
  /**
   * A radial band whose flora must stay low — the Moon Koi's circle. A
   * blade in the band is capped so its top never rises above `maxTop`
   * metres over the local floor rather than being refused a place.
   */
  readonly shortBand?: { readonly from: number; readonly to: number; readonly maxTop: number };
  /** Extra keep-out (e.g. the wreck's keel line), consulted per blade. */
  readonly avoid?: (x: number, z: number) => boolean;
}

export interface BladeMeadow {
  readonly mesh: InstancedMesh;
  update(dt: number, reducedMotion: boolean): void;
}

const DEFAULT_BLADE_HEIGHT = 1.15;
const DEFAULT_BLADE_WIDTH = 0.24;

/** How far over the tip has turned by the top of the blade, in radians. */
const TIP_BOW = 0.95;
const BLADE_TWIST = 0.5;
const BLADE_CUP = 0.38;

/** Half-width along the blade: widest a quarter up, easing to a soft point. */
function lanceolate(t: number): number {
  const s = Math.min(1, Math.max(0, t));
  return Math.max(0.05, Math.sin(Math.PI * Math.pow(0.16 + s * 0.84, 0.72)) ** 0.8);
}

/**
 * A blade: a lanceolate leaf, bowed forward, cupped across and gently
 * twisted so a patch never collapses into a row of flat cards. Three
 * columns because the centre one carries the cup; four length segments.
 */
function createBladeGeometry(width: number, height: number): PlaneGeometry {
  const segments = 4;
  const geometry = new PlaneGeometry(width, height, 2, segments);
  const position = geometry.attributes.position as BufferAttribute;

  // The arc, integrated once per row: each step advances along the current
  // bend angle, so height trades smoothly into reach and the strip's length
  // is exactly the blade's length however hard it bows.
  const rows = segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const bendAt = new Float32Array(rows);
  const step = height / segments;
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

  const half = width / 2;
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + height / 2) / height;
    const row = Math.round(t * segments);
    const column = position.getX(i) / half;
    const theta = bendAt[row] ?? 0;
    const twist = BLADE_TWIST * t;
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
 * Root-to-tip gradient with lengthwise fibre, held neutral so the
 * per-instance palette carries the colour — the reef meadow's contract:
 * the map is variation, the palette is variety.
 */
let bladeMap: DataTexture | undefined;
function bladeTexture(): DataTexture {
  bladeMap ??= buildColorTexture(32, (u, v) => {
    const fibre = 0.9 + fbm(u * 4, v, { seed: SEEDS.grassBlade, period: 12, octaves: 2 }) * 0.24;
    const across = 0.86 + Math.abs(u - 0.5) * 0.5;
    const shade = (0.52 + v * 0.72) * fibre * across;
    return [shade * 0.84, shade, shade * 0.7];
  });
  return bladeMap;
}

export function buildBladeMeadow(options: BladeMeadowOptions): BladeMeadow {
  const { def } = options;
  const bladeHeight = options.bladeHeight ?? DEFAULT_BLADE_HEIGHT;
  const bladeWidth = options.bladeWidth ?? DEFAULT_BLADE_WIDTH;
  const heightRange = options.heightRange ?? [0.6, 1.35];
  const gateMargin = options.gateMargin ?? 1.7;

  const random = new Random(options.seed);
  // The palette drift's own stream, so a placement tune can never re-roll
  // a stand's colour family (the reef meadow's side-stream argument).
  const paletteRandom = new Random(options.seed ^ 0x9e37_79b9);

  const sway = { value: 0 };
  const windStrength = { value: 1 };
  const sunView = { value: new Vector3(0, 1, 0) };

  const material = createToonMaterial({
    side: DoubleSide,
    map: bladeTexture(),
    ...(options.emissive !== undefined ? { emissive: options.emissive } : {}),
    ...(options.emissiveIntensity !== undefined
      ? { emissiveIntensity: options.emissiveIntensity }
      : {}),
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSway = sway;
    shader.uniforms.uWind = windStrength;
    shader.uniforms.uSunView = sunView;
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
         float tip = clamp(transformed.y / ${bladeHeight.toFixed(2)}, 0.0, 1.0);
         float bend = sin(uSway * 1.3 + phase) * 0.5 + sin(uSway * 0.47 + phase * 1.7) * 0.5;
         transformed.x += bend * 0.16 * uWind * tip * tip;
         transformed.z += bend * 0.09 * uWind * tip * tip;`,
      );
    // Cheap translucency, two notes: the far side of a blade glows rather
    // than falling into shadow, and a tip between the camera and the sun
    // catches warm. The uniform is wound in onBeforeRender below, so the
    // meadow needs no camera passed through `update`.
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
         float leafTip = clamp(vMapUv.y, 0.0, 1.0);
         gl_FragColor.rgb += diffuseColor.rgb * vec3(0.14, 0.26, 0.20) * facing;
         gl_FragColor.rgb += diffuseColor.rgb * vec3(0.30, 0.26, 0.12) * backlit * (0.25 + 0.75 * leafTip);`,
      );
  };

  const total = options.patches * options.bladesPerPatch;
  const mesh = new InstancedMesh(createBladeGeometry(bladeWidth, bladeHeight), material, total);
  mesh.name = `${def.id}-blades`;
  // Blades catch shade from above but do not cast: several hundred
  // double-sided instances in the shadow pass cost far more than the faint
  // stippling they would add.
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.onBeforeRender = (_renderer, _scene, camera: Camera) => {
    sunView.value.copy(SUN_POSITION).normalize().transformDirection(camera.matrixWorldInverse);
  };

  const axisX = Math.cos(def.azimuth);
  const axisZ = Math.sin(def.azimuth);
  const perpX = -axisZ;
  const perpZ = axisX;

  const dummy = new Object3D();
  const color = new Color();
  let placed = 0;

  const plant = (x: number, z: number, family: readonly number[]): void => {
    const r = Math.hypot(x, z);
    if (r <= def.carve.carveFrom + 0.5 || r >= def.carve.fadeFrom + 2.5) {
      return;
    }
    const away = angleBetween(Math.atan2(z, x), def.azimuth);
    if (away >= wedgeHalfAt(def, r) - 0.012) {
      return;
    }
    // A floor piece: it stands where the wing owns the ground outright.
    if (wingBlend(def, x, z) <= 0.5) {
      return;
    }
    // The doorway stays swimmable: nothing crowds the axis near the gate.
    if (r < 34.5 && Math.abs(x * perpX + z * perpZ) < gateMargin) {
      return;
    }
    if (options.avoid && options.avoid(x, z)) {
      return;
    }

    const floor = seabedHeight(x, z);
    let heightScale = random.range(heightRange[0], heightRange[1]);
    const band = options.shortBand;
    if (band && r >= band.from && r <= band.to) {
      // Inside the kept-clear volume a blade is not refused, it is simply
      // short: the meadow reads continuous and the circle stays open water.
      heightScale = Math.min(heightScale, band.maxTop / bladeHeight);
    }

    dummy.position.set(x, floor - 0.04, z);
    dummy.rotation.set(random.signed(0.12), random.range(0, Math.PI * 2), random.signed(0.12));
    dummy.scale.set(random.range(0.75, 1.25), heightScale, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);

    color.setHex(family[Math.floor(random.next() * family.length)] ?? family[0]!);
    // The value spread the eye reads as depth; the hues stay in one key.
    color.multiplyScalar(random.range(0.72, 1.14));
    mesh.setColorAt(placed, color);
    placed++;
  };

  for (let patch = 0; patch < options.patches; patch++) {
    const r = random.range(options.radiusFrom, options.radiusTo);
    const away = random.signed(wedgeHalfAt(def, r) * 0.62);
    const patchX = axisX * r + perpX * away * r;
    const patchZ = axisZ * r + perpZ * away * r;
    // Drawn whether or not the patch plants, so a confinement tune cannot
    // re-roll the families of every patch after it.
    const family =
      options.palette.families[
        Math.floor(paletteRandom.next() * options.palette.families.length)
      ] ?? options.palette.families[0]!;

    for (let blade = 0; blade < options.bladesPerPatch; blade++) {
      // Bias toward the middle so patches have a dense heart and soft edges.
      const spread = options.patchRadius * Math.sqrt(random.next());
      const angle = random.range(0, Math.PI * 2);
      plant(patchX + Math.cos(angle) * spread, patchZ + Math.sin(angle) * spread, family);
    }
  }

  // Park the refused blades well out of sight rather than at the origin.
  dummy.position.set(0, -200, 0);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (let i = placed; i < total; i++) {
    mesh.setMatrixAt(i, dummy.matrix);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();

  return {
    mesh,
    update(dt: number, reducedMotion: boolean): void {
      sway.value += dt * (reducedMotion ? 0.35 : 1);
      windStrength.value = reducedMotion ? 0.45 : 1;
    },
  };
}
