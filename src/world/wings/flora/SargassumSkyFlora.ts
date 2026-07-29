import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  type DataTexture,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildColorTexture, fbm } from "../../../rendering/ProceduralTexture";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { seabedHeight } from "../../Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView } from "../../SeaGrass";
import { wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";

/**
 * The Sargassum Sky's flora (wave 8, `SEEDS.wingSargassumSky` + substreams):
 * the dreamlike inversion. The ceiling is the scene; the floor is a held
 * breath.
 *
 * Three draw calls:
 *
 * - **The canopy** — one merged mesh of a hundred and thirty broad
 *   amber-gold weed pads hung at y 8–9.5 across the whole wedge, with
 *   sixty-four thin strands dangling a metre or two off it. This is the
 *   kelp forest's W-N2 canopy-pad idiom (`SEEDS.kelpCanopy`'s shapes, the
 *   `aPhase`/`aReach` sway, the sun-through-the-leaf glow) turned upside
 *   down and hung overhead: where the kelp giants hold a ceiling of leaf
 *   over one grove, here the whole wing's roof is weed, and looking up is
 *   the point of the place. The same two disciplines hold: every pad is its
 *   own outline (margin wave, cup, sag — no cloned silhouettes), and the
 *   warm backlit tint stays timid because a warm additive in this water
 *   reads far louder than its luminance says.
 * - **The light patches** — seven soft amber pools drifting slowly across
 *   the floor, the canopy's gaps made visible on the sand. The abyss's
 *   moon-pool idiom (additive quads, soft blob sprite, `fog: false`),
 *   moving because the water overhead moves.
 * - **The tufts** — twenty-two sparse straw tufts, and nothing else on the
 *   floor. The inversion is the design: a busy floor under a busy ceiling
 *   is two scenes fighting.
 *
 * The Island That Swims (W11's turtle elder) drifts beneath the canopy at
 * r 38–46, y 4–6. That volume is kept empty by construction — pads at
 * y ≥ 8, strand tips clamped to y ≥ 6.3, everything else on the sand — and
 * `tests/wingsW5Flora.test.ts` sweeps every vertex against it.
 */

/** The canopy's amber-golds, cycled per pad so the roof is not one colour. */
const PAD_TONES = [0xc9963f, 0xdbab4e, 0xb88236, 0xd9a844] as const;
/** The pale gold a pad's newest edge leans toward, backlit. */
const PAD_TIP = new Color(0xe8c76a);
/** The strands' deeper holdfast amber, darker for hanging in the shade. */
const STRAND_TONES = [0x9e7a34, 0xb08a3c, 0x8a6a2c] as const;

/** Where the canopy hangs, and how far its strands may dangle. */
const CANOPY_Y_MIN = 8.0;
const CANOPY_Y_MAX = 9.5;
/** The turtle corridor's top is y = 6; strand tips keep a hand above it. */
const STRAND_TIP_FLOOR = 6.3;

/**
 * The sway: gentler than the kelp's. A hung canopy of weed breathes rather
 * than whips — reach is a few centimetres of bob, and reduced motion takes
 * it to a third of that.
 */
const PAD_SWAY = 0.05;
const STRAND_SWAY = 0.07;

export function buildSargassumSkyFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "sargassum-sky-flora";

  const sway = { value: 0 };
  const windStrength = { value: 1 };
  const canopy = buildCanopy(def, sway, windStrength);
  group.add(canopy);
  const patches = buildLightPatches(def);
  group.add(patches.mesh);
  group.add(buildTufts(def));

  let time = 0;
  return {
    group,
    update(dt: number, reducedMotion: boolean): void {
      time += dt * (reducedMotion ? 0.3 : 1);
      sway.value = time;
      windStrength.value = reducedMotion ? 0.35 : 1;
      patches.update(time);
    },
  };
}

/**
 * One canopy pad or strand's vertices, written into a cloned template in
 * its own local frame (x = along the growth, y = up, z = across), coloured,
 * given its sway attributes, and transformed into world space. Shared by
 * both so a strand can never drift off the pad maths — the kelp module's
 * `attach` rule.
 */
function shapeElement(
  template: BufferGeometry,
  matrix: Matrix4,
  shape: (v: number, edge: number) => { x: number; y: number; z: number },
  colorAt: (v: number) => Color,
  phase: number,
  reachAt: (v: number) => number,
): BufferGeometry {
  const geometry = template.clone();
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const phases = new Float32Array(position.count);
  const reaches = new Float32Array(position.count);

  for (let i = 0; i < position.count; i++) {
    const v = position.getY(i);
    const edge = position.getX(i);
    const p = shape(v, edge);
    position.setXYZ(i, p.x, p.y, p.z);
    const c = colorAt(v);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    phases[i] = phase;
    reaches[i] = reachAt(v);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aReach", new BufferAttribute(reaches, 1));
  geometry.applyMatrix4(matrix);
  return geometry;
}

/**
 * The canopy: pads and strands scattered over the whole wedge (there is no
 * den corridor here — the wing's resident swims *under* this roof), merged
 * into one world-space geometry so the sway is two lines of GLSL reading
 * one float per vertex, exactly the kelp forest's argument.
 */
function buildCanopy(
  def: WingDef,
  sway: { value: number },
  windStrength: { value: number },
): Mesh {
  const random = new Random(SEEDS.wingSargassumSky);
  const strandRandom = new Random(SEEDS.wingSargassumSky ^ 0xca09);
  const parts: BufferGeometry[] = [];
  const padTemplate = padGeometry();
  const strandTemplate = strandGeometry();

  // ── The pads: the roof itself. ──
  const padCount = 130;
  const tone = new Color();
  const tip = new Color();
  for (let i = 0; i < padCount; i++) {
    const r = 33 + random.next() * 15.5;
    const acrossT = random.signed(1);
    const y = random.range(CANOPY_Y_MIN, CANOPY_Y_MAX);
    const yaw = random.range(0, Math.PI * 2);
    const tilt = random.signed(0.16);
    const roll = random.signed(0.16);
    const length = random.range(1.7, 2.9);
    const width = length * random.range(0.5, 0.68);
    const droop = random.range(0.1, 0.28);
    const cup = random.range(0.05, 0.12);
    const margin = random.range(0.05, 0.13);
    const marginFreq = random.range(1.4, 2.6);
    const marginPhase = random.range(0, Math.PI * 2);
    const phase = random.range(0, Math.PI * 2);
    const fade = random.range(0.9, 1.1);
    // The pad's window: its own semi-diagonal is what can cross the wedge
    // line, so the across draw is scaled by what is left once that fits.
    const padWindow = Math.max(0.005, wedgeHalfAt(def, r) - (length * 1.06) / r - 0.005);
    const across = acrossT * padWindow;
    const theta = def.azimuth + across;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    const base = tone.setHex(PAD_TONES[i % PAD_TONES.length] ?? PAD_TONES[0]).multiplyScalar(fade);
    const matrix = new Matrix4()
      .makeTranslation(x, y, z)
      .multiply(new Matrix4().makeRotationY(yaw))
      .multiply(new Matrix4().makeRotationX(tilt))
      .multiply(new Matrix4().makeRotationZ(roll));

    parts.push(
      shapeElement(
        padTemplate,
        matrix,
        (v, edge) => {
          // Broad lanceolate outline with an inward-only margin wave — the
          // W-O3 rule, one canopy over: variation can only shrink a pad.
          const half =
            Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, v)), 0.78)) ** 0.55 *
            (1 -
              margin *
                (0.5 + 0.5 * Math.sin(v * marginFreq * Math.PI * 2 + marginPhase + (edge < 0 ? 2.1 : 0))));
          const acrossPad = edge * half * width * 0.5;
          // Sagging rim and a gentle lengthwise droop: hung weed, not paper.
          const yy = -droop * length * v * v - cup * Math.abs(acrossPad);
          return { x: v * length, y: yy, z: acrossPad };
        },
        (v) => tip.copy(base).lerp(PAD_TIP, v * 0.55).multiplyScalar(0.78 + v * 0.3),
        phase,
        (v) => v * v * PAD_SWAY,
      ),
    );
  }

  // ── The strands: thin weed dangling off the roof. ──
  const strandCount = 64;
  for (let i = 0; i < strandCount; i++) {
    const r = 33.5 + strandRandom.next() * 14.5;
    const strandWindow = Math.max(0.005, wedgeHalfAt(def, r) - 0.42 / r - 0.004);
    const across = strandRandom.signed(1) * strandWindow;
    const theta = def.azimuth + across;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const rootY = strandRandom.range(CANOPY_Y_MIN + 0.2, CANOPY_Y_MAX - 0.2);
    // The turtle's corridor fence: no strand tip may enter y < 6.3.
    const length = Math.min(strandRandom.range(1.2, 2.2), rootY - STRAND_TIP_FLOOR);
    const width = strandRandom.range(0.06, 0.13);
    const curl = strandRandom.range(0, Math.PI * 2);
    const yaw = strandRandom.range(0, Math.PI * 2);
    const phase = strandRandom.range(0, Math.PI * 2);
    const toneHex = STRAND_TONES[i % STRAND_TONES.length] ?? STRAND_TONES[0];
    const fade = strandRandom.range(0.88, 1.08);

    const base = tone.setHex(toneHex).multiplyScalar(fade);
    const matrix = new Matrix4()
      .makeTranslation(x, rootY, z)
      .multiply(new Matrix4().makeRotationY(yaw));

    parts.push(
      shapeElement(
        strandTemplate,
        matrix,
        (v, edge) => ({
          // A lazy S as it hangs, thinning to the tip.
          x: Math.sin(v * 2.0 + curl) * 0.14 * length * v,
          y: -v * length,
          z: edge * width * (1 - v * 0.45),
        }),
        (v) => tip.copy(base).multiplyScalar(0.82 + v * 0.3),
        phase,
        (v) => v * v * STRAND_SWAY,
      ),
    );
  }

  padTemplate.dispose();
  strandTemplate.dispose();
  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    throw new Error("sargassum canopy parts could not be merged");
  }
  merged.computeBoundingSphere();

  const sunView = createSunViewUniform();
  const material: MeshToonMaterial = createToonMaterial({
    side: DoubleSide,
    vertexColors: true,
  });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uSway = sway;
    shader.uniforms.uWind = windStrength;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSway;
         uniform float uWind;
         attribute float aPhase;
         attribute float aReach;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float bend = sin(uSway * 0.55 + aPhase) * 0.62 + sin(uSway * 0.23 + aPhase * 1.6) * 0.38;
         transformed.y += bend * aReach * uWind;
         transformed.x += sin(uSway * 0.34 + aPhase * 0.7) * aReach * 0.6 * uWind;`,
      );
    // Light through the weed: cool along the blade's edge, and the amber
    // backlit term that is the whole reason this wing asks you to look up.
    injectLeafGlow(
      shader,
      sunView,
      "vec3(0.10, 0.13, 0.09)",
      "vec3(0.42, 0.28, 0.07)",
      "clamp(vColor.g * 1.3, 0.0, 1.0)",
    );
  };

  const mesh = new Mesh(merged, material);
  mesh.name = "sargassum-canopy";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  trackSunView(mesh, sunView);
  return mesh;
}

/** The pad template: an edge coordinate and a root-to-tip `v`, like kelp's. */
function padGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1, 2, 6);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, position.getX(i) * 2, position.getY(i) + 0.5, 0);
  }
  position.needsUpdate = true;
  return geometry;
}

/** The strand template: two across, seven down. */
function strandGeometry(): BufferGeometry {
  const geometry = new PlaneGeometry(1, 1, 1, 6);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(i, position.getX(i), position.getY(i) + 0.5, 0);
  }
  position.needsUpdate = true;
  return geometry;
}

/**
 * The light patches: soft amber pools on the sand where the canopy's gaps
 * let the sun through, drifting the way the water overhead drifts. The
 * abyss moon-pool's idiom — additive, `fog: false`, depth write off — at a
 * fraction of its opacity, instanced so all seven cost one draw call.
 */
function buildLightPatches(def: WingDef): {
  mesh: InstancedMesh;
  update: (time: number) => void;
} {
  const random = new Random(SEEDS.wingSargassumSky ^ 0xda99);
  const count = 7;

  interface Patch {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly scale: number;
    readonly phase: number;
    readonly pulse: number;
  }
  const patches: Patch[] = [];
  for (let i = 0; i < count; i++) {
    const r = random.range(35, 47);
    const acrossT = random.signed(1);
    const scale = random.range(1.4, 2.4);
    // Soft blobs, hard confinement: the drift radius plus the sprite's
    // half-extent is what the window must hold inside the wedge.
    const patchWindow = Math.max(0.005, wedgeHalfAt(def, r) - (scale * 0.56 + 0.55) / r - 0.004);
    const across = acrossT * patchWindow;
    const theta = def.azimuth + across;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    patches.push({
      x,
      y: seabedHeight(x, z) + 0.07,
      z,
      scale,
      phase: random.range(0, Math.PI * 2),
      pulse: random.range(0, Math.PI * 2),
    });
  }

  const material = new MeshBasicMaterial({
    map: patchSprite(),
    color: 0xffd27a,
    transparent: true,
    opacity: 0.16,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, count);
  mesh.name = "sargassum-light-patches";
  mesh.renderOrder = 1;
  // Every patch drifts every frame — the bubbles' argument.
  mesh.frustumCulled = false;

  const dummy = new Object3D();
  const update = (time: number): void => {
    for (const [i, patch] of patches.entries()) {
      dummy.position.set(
        patch.x + Math.sin(time * 0.11 + patch.phase) * 0.55,
        patch.y,
        patch.z + Math.cos(time * 0.09 + patch.phase * 1.3) * 0.55,
      );
      const scale = patch.scale * (1 + 0.12 * Math.sin(time * 0.2 + patch.pulse));
      dummy.scale.set(scale, scale, 1);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh, update };
}

/** The floor's few tufts: straw-pale, sparse, and deliberately unremarkable. */
function buildTufts(def: WingDef): InstancedMesh {
  const random = new Random(SEEDS.wingSargassumSky ^ 0x7af7);
  const geometry = tuftGeometry();
  const material = createToonMaterial({ side: DoubleSide, vertexColors: true });

  const count = 22;
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.name = "sargassum-tufts";
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  const TUFT_TONES = [0xa89f66, 0xb8ad72, 0x98905e] as const;
  const dummy = new Object3D();
  const color = new Color();
  for (let i = 0; i < count; i++) {
    const r = random.range(33.5, 47);
    const tuftWindow = Math.max(0.005, wedgeHalfAt(def, r) - 0.35 / r - 0.004);
    const across = random.signed(1) * tuftWindow;
    const theta = def.azimuth + across;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    dummy.position.set(x, seabedHeight(x, z) - 0.02, z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    const scale = random.range(0.6, 1.0);
    dummy.scale.set(scale, scale * random.range(0.8, 1.1), scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    color
      .setHex(TUFT_TONES[Math.floor(random.next() * TUFT_TONES.length)] ?? TUFT_TONES[0])
      .multiplyScalar(random.range(0.88, 1.06));
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  return mesh;
}

/** One tuft: three short blades crossed at thirds, bent a touch. */
function tuftGeometry(): BufferGeometry {
  const blades: BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const blade = new PlaneGeometry(0.16, 0.6, 1, 3);
    const position = blade.attributes.position!;
    const colors = new Float32Array(position.count * 3);
    for (let v = 0; v < position.count; v++) {
      const t = (position.getY(v) + 0.3) / 0.6;
      position.setZ(v, position.getZ(v) + t * t * 0.14);
      position.setY(v, t * 0.6);
      const shade = 0.7 + t * 0.36;
      colors[v * 3] = shade;
      colors[v * 3 + 1] = shade;
      colors[v * 3 + 2] = shade;
    }
    position.needsUpdate = true;
    blade.computeVertexNormals();
    blade.setAttribute("color", new BufferAttribute(colors, 3));
    blade.applyMatrix4(
      new Matrix4()
        .makeRotationY((i / 3) * Math.PI * 2)
        .multiply(new Matrix4().makeRotationX(0.12)),
    );
    blades.push(blade);
  }
  const merged = mergeGeometries(blades, false);
  for (const blade of blades) {
    blade.dispose();
  }
  if (!merged) {
    throw new Error("sargassum tuft blades could not be merged");
  }
  return merged;
}

/** The light pools' soft blob, rim wobbled so the edge is not a circle. */
let patchSpriteTexture: DataTexture | undefined;
function patchSprite(): DataTexture {
  patchSpriteTexture ??= buildColorTexture(64, (u, v) => {
    const wobble = fbm(u, v, { seed: SEEDS.wingSargassumSky ^ 0x9001, period: 3, octaves: 2 });
    const distance = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2 * (0.84 + 0.32 * wobble));
    const halo = Math.pow(Math.max(0, 1 - distance * distance), 2.2);
    return [halo, halo, halo];
  });
  return patchSpriteTexture;
}
