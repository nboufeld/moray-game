import {
  BufferAttribute,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import { seabedHeight } from "../../world/Seabed";
import type { LifeContext } from "../life/LifeSystem";
import { Clownfish } from "./Clownfish";
import { FaunaSystem } from "./FaunaSystem";

/**
 * The reserved ground. W-L2 wrote this disc into the coral's `CLEARANCES` and
 * W-L3's kelp test asserts nothing grows into it — it was held for exactly
 * this garden, a wave early, so the numbers here are the contract and not a
 * choice. Planting stays inside {@link PLANT_RADIUS} so the garden's own edge
 * breathes inside its clearing.
 *
 * The disc's southern edge dips into the ribbon-and-zebra corridor band
 * (z 4.2–7.8), and that is fine *for this population*: those sightlines run at
 * head height, a metre and a half over crowns that top out around 0.45 m, and
 * the raycast never tested plants anyway — what the corridor rule protects is
 * the player's view of a head, which nothing ankle-high can cross.
 */
const CENTER_X = 7.5;
const CENTER_Z = 8.5;
const PLANT_RADIUS = 2.1;

const ANEMONE_COUNT = 10;
/** Metres between trunk centres, so the crowns touch without merging. */
const SPACING = 0.55;

/**
 * Pastel crowns in three families — rose, lavender, seafoam — the same dusty
 * chroma discipline the coral families keep. The tentacle's vertex gradient
 * runs the value (deep root, full tip), so the instance colour is authored as
 * the *tip*, which is the pastel the brief names. The third family was cream
 * first, and a cream anemone on cream sand is an anemone that is not there —
 * seafoam is the hue the garden lacked and the one the sand cannot eat.
 */
const FAMILIES = [0xe2a9ba, 0xc4b2e0, 0xa9d8b8];

/**
 * The anemone garden and its clownfish pair, on the disc the earlier waves
 * kept clear. Three draw calls: instanced trunks, instanced swaying tentacles,
 * and the two fish. The sway is the grass's own shader injection — a phase
 * read off each instance's position, a bend weighted to the tip — wound from
 * simulated time, so a capture holds it still.
 */
export class AnemoneGarden extends FaunaSystem {
  private clownfishPair: Clownfish | null = null;
  private readonly sway = { value: 0 };
  private readonly windStrength = { value: 1 };

  constructor(seed: number = SEEDS.anemones) {
    super("anemone-garden", seed);
  }

  /** Exposed for the unit tests; null until the garden joins a scene. */
  get clownfish(): Clownfish | null {
    return this.clownfishPair;
  }

  protected build(): void {
    const random = new Random(this.seed);

    // Scatter the trunks with a minimum spacing, dense heart first.
    const spots: { x: number; z: number; size: number }[] = [];
    while (spots.length < ANEMONE_COUNT) {
      let placed = false;
      for (let attempt = 0; attempt < 12 && !placed; attempt++) {
        const reach = PLANT_RADIUS * Math.sqrt(random.next());
        const angle = random.range(0, Math.PI * 2);
        const x = CENTER_X + Math.cos(angle) * reach;
        const z = CENTER_Z + Math.sin(angle) * reach;
        if (spots.every((spot) => Math.hypot(spot.x - x, spot.z - z) >= SPACING)) {
          spots.push({ x, z, size: random.range(0.75, 1.3) });
          placed = true;
        }
      }
      if (!placed) {
        // The disc is generous for ten anemones; if packing ever fails, a
        // smaller garden is better than a spin.
        break;
      }
    }

    this.buildAnemones(random, spots);
    this.buildClownfish(spots);
  }

  private buildAnemones(
    random: Random,
    spots: readonly { x: number; z: number; size: number }[],
  ): void {
    const trunkMaterial = this.own(createToonMaterial({ vertexColors: true }));
    const tentacleMaterial = this.own(createToonMaterial({ vertexColors: true }));

    // The grass's sway, re-injected: same uniforms, same phase-from-position
    // trick — a whole garden breathes for one uniform write per frame. The
    // phase is per-anemone in effect, because every tentacle of one crown
    // stands within centimetres of its siblings.
    tentacleMaterial.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
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
           float phase = instanceMatrix[3][0] * 2.1 + instanceMatrix[3][2] * 1.7;
           float tip = clamp(transformed.y, 0.0, 1.0);
           float bend = sin(uSway * 0.9 + phase) * 0.6 + sin(uSway * 0.37 + phase * 1.9) * 0.4;
           transformed.x += bend * 0.085 * uWind * tip * tip;
           transformed.z += bend * 0.05 * uWind * tip * tip;`,
        );
    };

    let tentacleTotal = 0;
    const perAnemone: number[] = spots.map((spot) => {
      const count = Math.round(12 + spot.size * 4);
      tentacleTotal += count;
      return count;
    });

    const trunks = this.ownInstanced(
      new InstancedMesh(this.own(createTrunkGeometry()), trunkMaterial, spots.length),
    );
    trunks.name = "anemone-trunks";
    const tentacles = this.ownInstanced(
      new InstancedMesh(this.own(createTentacleGeometry()), tentacleMaterial, tentacleTotal),
    );
    tentacles.name = "anemone-tentacles";
    for (const mesh of [trunks, tentacles]) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);
    }

    const dummy = new Object3D();
    const color = new Color();
    const tiltAxis = new Vector3();
    const swing = new Quaternion();
    let tentacleIndex = 0;

    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i]!;
      const ground = seabedHeight(spot.x, spot.z);
      const trunkHeight = 0.15 * spot.size;
      const crownRadius = 0.16 * spot.size;
      const family = FAMILIES[i % FAMILIES.length]!;

      dummy.position.set(spot.x, ground - 0.01, spot.z);
      dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
      dummy.scale.set(crownRadius * 0.9, trunkHeight, crownRadius * 0.9);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      // The column is the crown's colour taken down and warmed: one plant.
      color.setHex(family).multiplyScalar(0.58);
      trunks.setColorAt(i, color);

      const count = perAnemone[i]!;
      for (let k = 0; k < count; k++) {
        // Inner tentacles stand tall, outer ones splay: one ring parameter.
        const ringT = random.next();
        const yawA = (k / count) * Math.PI * 2 + random.signed(0.3);
        const tilt = 0.16 + ringT * 0.75;
        const radial = crownRadius * (0.15 + 0.6 * ringT);
        const length = random.range(0.2, 0.34) * spot.size;

        dummy.position.set(
          spot.x + Math.cos(yawA) * radial,
          ground + trunkHeight - 0.015,
          spot.z + Math.sin(yawA) * radial,
        );
        tiltAxis.set(Math.sin(yawA), 0, -Math.cos(yawA));
        swing.setFromAxisAngle(tiltAxis, tilt);
        dummy.quaternion.copy(swing);
        dummy.rotateY(random.range(0, Math.PI * 2));
        const girth = length * random.range(0.85, 1.2);
        dummy.scale.set(girth, length, girth);
        dummy.updateMatrix();
        tentacles.setMatrixAt(tentacleIndex, dummy.matrix);

        color.setHex(family).multiplyScalar(random.range(0.9, 1.08));
        tentacles.setColorAt(tentacleIndex, color);
        tentacleIndex++;
      }
    }

    for (const mesh of [trunks, tentacles]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  private buildClownfish(spots: readonly { x: number; z: number; size: number }[]): void {
    if (spots.length === 0) {
      return;
    }
    const rng = new Random(SEEDS.clownfish);
    // The two plumpest crowns are home; a fish dives into its own anemone.
    const bySize = [...spots].sort((a, b) => b.size - a.size);
    const first = bySize[0]!;
    const second = bySize[1] ?? first;
    const refuge = (spot: { x: number; z: number; size: number }): Vector3 =>
      new Vector3(spot.x, seabedHeight(spot.x, spot.z) + 0.15 * spot.size + 0.04, spot.z);

    const center = new Vector3(
      CENTER_X,
      // High enough to weave clear of the crowns and most of the grass the
      // meadow scattered into the clearing before the disc was reserved.
      seabedHeight(CENTER_X, CENTER_Z) + 0.62,
      CENTER_Z,
    );
    const pair = new Clownfish(rng, center, [refuge(first), refuge(second)]);
    this.own(pair.geometry);
    this.own(pair.material);
    this.ownInstanced(pair.mesh);
    this.group.add(pair.mesh);
    this.clownfishPair = pair;
  }

  update(dt: number, ctx: LifeContext): void {
    if (dt <= 0) {
      return;
    }
    // Simulated time, deliberately not the wall clock: `capture()` advances
    // the world by whole fixed steps and the garden must hold still with it.
    this.sway.value += dt * (ctx.reducedMotion ? 0.35 : 1);
    this.windStrength.value = ctx.reducedMotion ? 0.45 : 1;
    this.clownfishPair?.update(dt, ctx);
  }
}

/**
 * A unit trunk (height 1, radius ~1, scaled per instance): a squat column,
 * slightly waisted, capped for the crown the tentacles root into. Vertex
 * colour deepens the foot into the sand.
 */
function createTrunkGeometry(): BufferGeometry {
  const geometry = new CylinderGeometry(0.92, 1.05, 1, 7, 2);
  geometry.translate(0, 0.5, 0);
  const position = geometry.attributes.position;
  if (position) {
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const t = Math.min(1, Math.max(0, position.getY(i)));
      const shade = 0.66 + 0.34 * t;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade;
      colors[i * 3 + 2] = shade;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
  }
  return geometry;
}

/**
 * A unit tentacle: root at y = 0, tip at y = 1, tapering and gently recurved
 * so a crown never reads as a brush of straight pins. Radii are proportions of
 * the height, so a uniform-ish instance scale keeps a tentacle's girth in
 * proportion to its length. Open-ended: the tip hole is five millimetres on
 * the largest anemone. Vertex colour runs deep root to full tip — the pastel
 * lives in the instance colour, so tips are pastel and hearts are shaded,
 * which is what makes a fish half-buried in the crown read as *inside* it.
 *
 * Four sides and three rings, and that is a perf decision, not a shape one:
 * this is the largest instanced buffer the package owns (160 tentacles), and
 * cutting 5×4 down to 4×3 took a third off the whole layer's triangles for a
 * change no portrait pose could find on a tube two centimetres wide.
 */
function createTentacleGeometry(): BufferGeometry {
  const geometry = new CylinderGeometry(0.055, 0.16, 1, 4, 3, true);
  geometry.translate(0, 0.5, 0);
  const position = geometry.attributes.position;
  if (position) {
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const t = Math.min(1, Math.max(0, position.getY(i)));
      // A soft recurve, strongest at the tip.
      position.setX(i, position.getX(i) + t * t * 0.24);
      const shade = 0.52 + 0.48 * t;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.96;
      colors[i * 3 + 2] = shade * 1.04;
    }
    position.needsUpdate = true;
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingSphere();
  return geometry;
}
