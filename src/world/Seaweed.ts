import {
  BufferAttribute,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  PlaneGeometry,
  SphereGeometry,
  type BufferGeometry,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothNormals } from "../rendering/SmoothNormals";
import { createToonMaterial } from "../rendering/ToonShading";
import { Random, SEEDS } from "../util/Random";
import { isClear } from "./CoralField";
import { seabedHeight } from "./Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView } from "./SeaGrass";

/**
 * The flora accents (W-L9): rounded seaweed bushes and drooping frond
 * rosettes, scattered between the meadow and the kelp.
 *
 * The reef's plants were two silhouettes — a blade and a stalk — and two
 * silhouettes read as a set dressed twice. These are the third and fourth: a
 * plump lobed clump in olive and wine, which is a *mass* where everything else
 * is a line, and a rosette of straps that arch up and hang over, which is the
 * one plant here drawn by its droop. Both are single instanced meshes, two
 * draw calls for the lot, no shadows in either direction (the meadow's
 * argument at the meadow's scale), and everything is seeded from
 * `SEEDS.seaweed`.
 *
 * Placement answers to the same law as the coral: `CoralField.isClear` is
 * imported and read — the legal direction, since `CoralField` must never
 * import back — which carries the crevice rings, the mound rings, the three
 * approach corridors and the anemone disc in one call. Nothing here is in
 * `obstructionMeshes`, so nothing here may ever stand where it could argue
 * with a sightline; `tests/seaweed.test.ts` reads the rule back the way the
 * coral test does.
 */

const BUSH_COUNT = 16;
const FROND_COUNT = 16;

/**
 * The real bush layer (Wave 8, W11): rounded, dense clumps of overlapping
 * curved leaves on the open sand between the set pieces — the owner's "some
 * kind of bushes". The lobed cushions above stay exactly what they were; this
 * is a third silhouette, leafy where they are smooth, and it draws only from
 * `SEEDS.bushes`, the stream the wave pre-registered for it, so neither the
 * cushions nor the fronds above re-roll.
 *
 * One instanced mesh — a third draw call, inside the round's seaweed budget
 * of six — and at 48 clumps of 256 triangles it is most of the package's
 * allowance spent on the thing the player will actually see: 12,288
 * triangles against a ceiling of 18k.
 */
const LEAFY_COUNT = 48;

/** Scatter bounds. Inside the rim's foot, so nothing floats on the ridge. */
const FIELD = 27;

/**
 * Olive and wine, per the art brief — and the wine is the crevice-mouth rule
 * again: the darkest plant on the sand is a colour, not a hole. All of them
 * sit under the meadow's value so the accents read as undergrowth.
 */
const BUSH_TONES = [0x7d8a45, 0x8f9a52, 0x7a4f62, 0x6e4557, 0x86904e];
const FROND_TONES = [0x74904c, 0x5f8747, 0x8a5d68];

/**
 * The leafies' deep greens (W11). Darker than everything else this module
 * grows on purpose: a dense leafy clump is the shadow mass of the undergrowth
 * layer, and against the meadow's bright spring key it should read as the
 * cool, shaded thing the bright thing grows over. The warm undersides the
 * brief asks for live in the geometry's vertex paint, not here — the instance
 * colour stays the hue owner, per-instance spread and all.
 */
const LEAFY_TONES = [0x3f6b3a, 0x527a3d, 0x38592f, 0x476b46, 0x5d7a3a];

/** The bush geometry's crown height, measured; the paint and sway key off it. */
const LEAFY_CROWN = 0.53;

/**
 * The three bush sizes, as (cumulative roll edge, min scale, max scale) —
 * about half small, a third mid, a sixth large. A stand of one age is a
 * plantation, and the big ones are the ones a diver navigates by. Against the
 * geometry's measured crown these land at the brief's 0.5–1.2 m.
 */
const LEAFY_BANDS: readonly (readonly [number, number, number])[] = [
  [0.45, 0.95, 1.25],
  [0.8, 1.3, 1.7],
  [1.0, 1.75, 2.25],
];

export class Seaweed {
  readonly group = new Group();

  private readonly sway = { value: 0 };
  private readonly windStrength = { value: 1 };
  private readonly sunView = createSunViewUniform();
  private readonly owned: (BufferGeometry | MeshToonMaterial)[] = [];

  constructor(seed: number = SEEDS.seaweed) {
    this.group.name = "seaweed";
    const random = new Random(seed);

    this.group.add(this.buildBushes(random));
    this.group.add(this.buildFronds(random));
    this.group.add(this.buildLeafy());
  }

  /** Plump lobed clumps: six squashed lobes welded into one worn cushion. */
  private buildBushes(random: Random): InstancedMesh {
    const geometry = seaweedBushGeometry(random);
    const material = createToonMaterial({ vertexColors: true });
    const mesh = new InstancedMesh(geometry, material, BUSH_COUNT);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    this.owned.push(geometry, material);

    const dummy = new Object3D();
    const color = new Color();
    for (let i = 0; i < BUSH_COUNT; i++) {
      const spot = scatter(random);
      dummy.position.set(spot.x, seabedHeight(spot.x, spot.z) - 0.06, spot.z);
      dummy.rotation.set(random.signed(0.1), random.range(0, Math.PI * 2), random.signed(0.1));
      const size = random.range(0.38, 0.72);
      dummy.scale.set(size * random.range(0.9, 1.25), size * random.range(0.55, 0.75), size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.setHex(BUSH_TONES[Math.floor(random.next() * BUSH_TONES.length)] ?? BUSH_TONES[0]!);
      color.multiplyScalar(random.range(0.85, 1.1));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    return mesh;
  }

  /** Rosettes of straps that arch up and hang over, swaying like the meadow. */
  private buildFronds(random: Random): InstancedMesh {
    const geometry = seaweedRosetteGeometry();
    const material = createToonMaterial({ side: DoubleSide, vertexColors: true });
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
           // Each rosette leans on its own phase, taken from where it stands —
           // the meadow's trick, at the meadow's cost of nothing.
           float phase = instanceMatrix[3][0] * 0.53 + instanceMatrix[3][2] * 0.47;
           float tip = clamp(transformed.y / 0.9, 0.0, 1.0);
           float bend = sin(uSway * 0.9 + phase) * 0.6 + sin(uSway * 0.37 + phase * 1.7) * 0.4;
           transformed.x += bend * 0.1 * uWind * tip * tip;
           transformed.z += bend * 0.06 * uWind * tip * tip;`,
        );
      // The tip weight rides the baked shade ramp: vColor climbs root → tip,
      // so its green channel is a free stand-in for "how far up the strap".
      injectLeafGlow(
        shader,
        this.sunView,
        "vec3(0.10, 0.20, 0.15)",
        "vec3(0.30, 0.24, 0.09)",
        "clamp(vColor.g * 1.6, 0.0, 1.0)",
      );
    };
    const mesh = new InstancedMesh(geometry, material, FROND_COUNT);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    trackSunView(mesh, this.sunView);
    this.owned.push(geometry, material);

    const dummy = new Object3D();
    const color = new Color();
    for (let i = 0; i < FROND_COUNT; i++) {
      const spot = scatter(random);
      dummy.position.set(spot.x, seabedHeight(spot.x, spot.z) - 0.04, spot.z);
      dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
      const size = random.range(0.75, 1.3);
      dummy.scale.set(size, size * random.range(0.85, 1.15), size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.setHex(FROND_TONES[Math.floor(random.next() * FROND_TONES.length)] ?? FROND_TONES[0]!);
      color.multiplyScalar(random.range(0.88, 1.08));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    return mesh;
  }

  /**
   * The real bushes (W11): dense clumps of curved, cupped leaves in deep
   * greens with warm undersides, scattered on the open sand between the set
   * pieces under exactly the law the cushions and fronds answer to — the same
   * `scatter`, the same `isClear`. Everything is drawn from `SEEDS.bushes`,
   * the stream the wave pre-registered for this layer: the geometry's leaves
   * first, then the placements, so neither existing accent moves a number.
   */
  private buildLeafy(): InstancedMesh {
    const random = new Random(SEEDS.bushes);
    const geometry = leafyBushGeometry(random);
    const material = createToonMaterial({ side: DoubleSide, vertexColors: true });
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
           // The fronds' trick at half amplitude: a dense clump rustles at
           // its crown rather than leaning at the root.
           float phase = instanceMatrix[3][0] * 0.53 + instanceMatrix[3][2] * 0.47;
           float tip = clamp(transformed.y / ${LEAFY_CROWN.toFixed(2)}, 0.0, 1.0);
           float bend = sin(uSway * 0.9 + phase) * 0.6 + sin(uSway * 0.37 + phase * 1.7) * 0.4;
           transformed.x += bend * 0.05 * uWind * tip * tip;
           transformed.z += bend * 0.03 * uWind * tip * tip;`,
        );
      // The vertex paint's green channel climbs toward the leaf tips, the
      // same stand-in for "how far up" the fronds use.
      injectLeafGlow(
        shader,
        this.sunView,
        "vec3(0.10, 0.20, 0.15)",
        "vec3(0.30, 0.24, 0.09)",
        "clamp(vColor.g * 1.5, 0.0, 1.0)",
      );
    };
    const mesh = new InstancedMesh(geometry, material, LEAFY_COUNT);
    mesh.name = "seaweed-leafy";
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    trackSunView(mesh, this.sunView);
    this.owned.push(geometry, material);

    const dummy = new Object3D();
    const color = new Color();
    for (let i = 0; i < LEAFY_COUNT; i++) {
      const spot = scatter(random);
      dummy.position.set(spot.x, seabedHeight(spot.x, spot.z) - 0.05, spot.z);
      dummy.rotation.set(random.signed(0.08), random.range(0, Math.PI * 2), random.signed(0.08));
      const roll = random.next();
      const band = LEAFY_BANDS.find(([edge]) => roll < edge) ?? LEAFY_BANDS[LEAFY_BANDS.length - 1]!;
      const size = random.range(band[1], band[2]);
      dummy.scale.set(size * random.range(0.9, 1.15), size * random.range(0.9, 1.1), size);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.setHex(LEAFY_TONES[Math.floor(random.next() * LEAFY_TONES.length)] ?? LEAFY_TONES[0]!);
      color.multiplyScalar(random.range(0.85, 1.08));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    return mesh;
  }

  update(dt: number, reducedMotion: boolean): void {
    this.sway.value += dt * (reducedMotion ? 0.35 : 1);
    this.windStrength.value = reducedMotion ? 0.45 : 1;
  }

  dispose(): void {
    for (const owned of this.owned) {
      owned.dispose();
    }
    this.owned.length = 0;
    this.group.removeFromParent();
    this.group.clear();
  }
}

/**
 * One clear spot, by rejection. `isClear` is the whole of the law; the draw
 * count per attempt is fixed at two so a rejected spot costs the stream
 * exactly one retry and nothing downstream shuffles when a clearance moves.
 */
function scatter(random: Random): { x: number; z: number } {
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = random.signed(FIELD);
    const z = random.signed(FIELD);
    if (isClear(x, z)) {
      return { x, z };
    }
  }
  // Statistically unreachable — the clear area is most of the field — but a
  // deterministic fallback beats an infinite loop on a future clearance.
  return { x: FIELD, z: FIELD };
}

/**
 * Six squashed lobes welded into one cushion, shaded down toward the sand.
 *
 * Exported for W-N5's corridor dressing, which grows the same two accent
 * silhouettes at undergrowth size — with its own `Random`, so the field's
 * stream here is untouched. Additive only: nothing about this field moved.
 */
export function seaweedBushGeometry(random: Random): BufferGeometry {
  const lobes: BufferGeometry[] = [];
  // Five lobes at a coarse tessellation: measured, the bushes were the
  // package's largest vertex bill after the meadow, and a lobed cushion at
  // half a metre reads identically one ring coarser.
  const count = 5;
  for (let i = 0; i < count; i++) {
    const lobe = new SphereGeometry(1, 6, 4);
    const angle = (i / count) * Math.PI * 2 + random.signed(0.4);
    const out = i === 0 ? 0 : random.range(0.45, 0.75);
    const size = i === 0 ? 1 : random.range(0.5, 0.75);
    lobe.scale(size, size * random.range(0.7, 0.9), size);
    lobe.translate(
      Math.cos(angle) * out,
      random.range(0.35, 0.6) * size,
      Math.sin(angle) * out,
    );
    lobes.push(lobe);
  }

  const merged = mergeGeometries(lobes, false);
  for (const lobe of lobes) {
    lobe.dispose();
  }
  if (!merged) {
    throw new Error("seaweed lobes could not be merged");
  }
  smoothNormals(merged);

  // Shade to the sand: the underside of a cushion is its own contact shadow.
  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const shade = 0.62 + Math.min(1, Math.max(0, position.getY(i) / 1.4)) * 0.48;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  return merged;
}

/**
 * Seven straps arching out from one root, each bowed over its own arc — the
 * grass blade's integration bowed twice as far, so the tip hangs.
 * Deterministic, no draws; exported alongside {@link seaweedBushGeometry}.
 */
export function seaweedRosetteGeometry(): BufferGeometry {
  const straps: BufferGeometry[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const strap = strapGeometry(0.9 + (i % 3) * 0.12, 0.11);
    const turn = (i / count) * Math.PI * 2 + i * 0.35;
    const tiltOut = 0.28 + (i % 2) * 0.14;
    strap.applyMatrix4(
      new Matrix4().makeRotationY(turn).multiply(new Matrix4().makeRotationX(tiltOut)),
    );
    straps.push(strap);
  }

  const merged = mergeGeometries(straps, false);
  for (const strap of straps) {
    strap.dispose();
  }
  if (!merged) {
    throw new Error("seaweed straps could not be merged");
  }
  return merged;
}

/** One drooping strap, integrated along a bend that passes the horizontal. */
function strapGeometry(length: number, width: number): BufferGeometry {
  const segments = 5;
  const geometry = new PlaneGeometry(width, length, 1, segments);
  const position = geometry.attributes.position!;

  const rows = segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const step = length / segments;
  let y = 0;
  let z = 0;
  for (let row = 0; row < rows; row++) {
    arcY[row] = y;
    arcZ[row] = z;
    // 1.9 rad by the tip: up, over, and hanging a little past horizontal.
    const angle = 1.9 * Math.pow((row + 0.5) / segments, 1.5);
    y += Math.cos(angle) * step;
    z += Math.sin(angle) * step;
  }

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + length / 2) / length;
    const row = Math.round(t * segments);
    position.setX(i, position.getX(i) * (1 - t * 0.7));
    position.setY(i, arcY[row] ?? 0);
    position.setZ(i, arcZ[row] ?? 0);

    // The green channel doubles as the glow's tip weight (vColor.g in the
    // fragment injection), so it must climb root → tip like the shade does.
    const shade = 0.68 + t * 0.42;
    colors[i * 3] = shade;
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade;
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  return geometry;
}

/**
 * One bush leaf (W11): a tapered plane, bowed over its length and cupped
 * across it. The cup rides the centre column, which is the whole reason for
 * the second width segment — a flat leaf catches one toon band across its
 * width, and a bush of flat leaves is the "flat plastic" complaint growing
 * back at a smaller scale.
 */
function leafGeometry(length: number, width: number): BufferGeometry {
  const segments = 4;
  const geometry = new PlaneGeometry(width, length, 2, segments);
  const position = geometry.attributes.position!;

  const rows = segments + 1;
  const arcY = new Float32Array(rows);
  const arcZ = new Float32Array(rows);
  const step = length / segments;
  let y = 0;
  let z = 0;
  for (let row = 0; row < rows; row++) {
    arcY[row] = y;
    arcZ[row] = z;
    // 0.9 rad by the tip: a leaf bowed toward the light, not a drooping strap.
    const angle = 0.9 * Math.pow((row + 0.5) / segments, 1.4);
    y += Math.cos(angle) * step;
    z += Math.sin(angle) * step;
  }

  const half = width / 2;
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) + length / 2) / length;
    const row = Math.round(t * segments);
    const column = position.getX(i) / half;
    const taper = 1 - t * 0.55;
    const across = column * half * taper;
    const cup = (1 - Math.abs(column)) * half * taper * 0.5;
    position.setXYZ(i, across, arcY[row] ?? 0, (arcZ[row] ?? 0) + cup);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A dense rounded clump of overlapping leaves (W11): three rings — a skirt
 * leaning out, a middle tier, a near-upright heart — so the clump reads as a
 * mass of foliage from every angle rather than a rosette from above and a
 * fan from the side. Sixteen leaves of sixteen triangles: 256 per clump,
 * and the whole layer is one geometry, one mesh, one draw.
 *
 * The paint is the brief's "deep greens with warm undersides" written as a
 * multiplier: dark and warm toward the root tangle at the sand, climbing to
 * the full instance hue at the crown. The hue itself stays with the
 * per-instance colour, the garden's rule one module over.
 */
function leafyBushGeometry(random: Random): BufferGeometry {
  const leaves: BufferGeometry[] = [];
  const rings: readonly { count: number; tilt: readonly [number, number]; length: number; width: number; rise: number }[] = [
    { count: 7, tilt: [0.38, 0.58], length: 0.6, width: 0.17, rise: 0 },
    { count: 5, tilt: [0.22, 0.38], length: 0.52, width: 0.15, rise: 0.04 },
    { count: 4, tilt: [0.08, 0.2], length: 0.44, width: 0.14, rise: 0.08 },
  ];
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const leaf = leafGeometry(
        ring.length * random.range(0.85, 1.15),
        ring.width * random.range(0.85, 1.2),
      );
      const tilt = random.range(ring.tilt[0], ring.tilt[1]);
      const around = (i / ring.count) * Math.PI * 2 + random.signed(0.5);
      leaf.applyMatrix4(
        new Matrix4()
          .makeRotationY(around)
          .multiply(new Matrix4().makeRotationX(tilt))
          .multiply(new Matrix4().makeTranslation(0, ring.rise, 0)),
      );
      leaves.push(leaf);
    }
  }

  const merged = mergeGeometries(leaves, false);
  for (const leaf of leaves) {
    leaf.dispose();
  }
  if (!merged) {
    throw new Error("leafy bush leaves could not be merged");
  }

  const position = merged.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) / LEAFY_CROWN));
    const shade = 0.5 + t * 0.55;
    colors[i * 3] = shade * (1 + 0.24 * (1 - t));
    colors[i * 3 + 1] = shade;
    colors[i * 3 + 2] = shade * (0.82 + 0.18 * t);
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  return merged;
}
