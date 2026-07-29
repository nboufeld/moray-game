import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Object3D,
  OctahedronGeometry,
  Quaternion,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import { seabedHeight } from "../../world/Seabed";
import type { LifeContext } from "../life/LifeSystem";
import { Clownfish } from "./Clownfish";
import { FaunaSystem, paintVertices } from "./FaunaSystem";

/**
 * Where the garden stands — moved this wave, and the move is the contract.
 *
 * The reserved clearing the earlier waves kept is the disc at (7.5, 8.5), and
 * the coral still holds it empty (`CoralField.CLEARANCES`, which this package
 * may not edit). The grand garden needed a 2.4 m plant radius, and the old
 * centre would have put its southern rim at z = 6.1 — straight across the
 * z ≈ 6 band the ribbon and the zebra are approached along, with crowns that
 * now stand a metre tall rather than ankle-high. So the garden stepped
 * north-east, off the band: its southern rim is z = 7.8, flush with the
 * corridor box's own top edge, and nothing planted here ever crosses z = 7.
 *
 * The neighbours were measured, not guessed (a probe over the live
 * `CoralField.contacts` and the authored `Crabs` homes): the tidepool coral's
 * east edge stops 2.15 m west of this centre, the slab rock's foot is 3.3 m
 * north, and two crab doorsteps stand within a wander of the rim. The
 * keep-outs below hold trunks off all four; the garden shapes itself around
 * its neighbours the way the coral shapes itself around the clearances.
 */
const CENTER_X = 9.0;
const CENTER_Z = 10.2;
const PLANT_RADIUS = 2.4;

const ANEMONE_COUNT = 13;
/** Metres between trunk centres, so the crowns touch without merging. */
const SPACING = 0.75;

/** Discs a trunk may never plant inside, smallest carve first. */
const KEEPOUTS: readonly { x: number; z: number; radius: number }[] = [
  // The tidepool coral's eastern plate stack, measured off the live contacts
  // at (5.24, 10.73) with a 1.64 m footprint, plus a grand crown's reach.
  { x: 5.24, z: 10.73, radius: 2.35 },
  // `Reef.ts`'s slab at (7, 15), radius 1.9 — its foot is scenery, not soil.
  { x: 7, z: 15, radius: 2.9 },
  // The two crab doorsteps (`Crabs.ts` HOMES): a crab wanders a metre from
  // home, and a trunk planted on the path is a crab inside a trunk.
  { x: 5.3, z: 10.6, radius: 1.0 },
  { x: 10.2, z: 11.6, radius: 1.0 },
];

/**
 * Three families across the garden — rose-magenta, sand-gold and sea-green —
 * in the coral families' dusty-chroma discipline. The tentacle's vertex
 * gradient runs the value (deep root, full tip), so the instance colour is
 * authored as the *tip*. The gold is a full value step deeper than the sand
 * it stands on: the old garden's cream family taught that a pale anemone on
 * pale sand is an anemone that is not there.
 */
const FAMILIES = [0xda8fa8, 0xd0975a, 0x8fbf92];

/**
 * The anemone city and its clownfish trio. Four draw calls: instanced fluted
 * trunks, an instanced ring of long bulb-tipped tentacles that take the sway,
 * an instanced carpet of short inner tentacles, and the three fish. The sway
 * is the grass's own shader injection — a phase read off each instance's
 * position, a bend weighted to the tip — wound from simulated time, so a
 * capture holds it still.
 */
export class AnemoneGarden extends FaunaSystem {
  private clownfishPair: Clownfish | null = null;
  private readonly sway = { value: 0 };
  private readonly windStrength = { value: 1 };

  constructor(seed: number = SEEDS.anemonesGrand) {
    super("anemone-garden", seed);
  }

  /** Exposed for the unit tests; null until the garden joins a scene. */
  get clownfish(): Clownfish | null {
    return this.clownfishPair;
  }

  protected build(): void {
    const random = new Random(this.seed);

    // Scatter the trunks with a minimum spacing, dense heart first, and never
    // inside a keep-out — the disc is generous, so a rejected draw retires to
    // a smaller garden rather than a spin.
    const spots: { x: number; z: number; size: number }[] = [];
    while (spots.length < ANEMONE_COUNT) {
      let placed = false;
      for (let attempt = 0; attempt < 64 && !placed; attempt++) {
        const reach = PLANT_RADIUS * Math.sqrt(random.next());
        const angle = random.range(0, Math.PI * 2);
        const x = CENTER_X + Math.cos(angle) * reach;
        const z = CENTER_Z + Math.sin(angle) * reach;
        if (!this.plantable(x, z)) {
          continue;
        }
        if (spots.every((spot) => Math.hypot(spot.x - x, spot.z - z) >= SPACING)) {
          spots.push({ x, z, size: random.range(1.8, 3.0) });
          placed = true;
        }
      }
      if (!placed) {
        break;
      }
    }

    this.buildAnemones(random, spots);
    this.buildClownfish(spots);
  }

  /** Inside the disc, south of nothing, and clear of every measured neighbour. */
  private plantable(x: number, z: number): boolean {
    for (const keepout of KEEPOUTS) {
      if (Math.hypot(x - keepout.x, z - keepout.z) < keepout.radius) {
        return false;
      }
    }
    return true;
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
    // stands within a forearm of its siblings. The bend is normalised by the
    // instance's own length-to-girth ratio: these stalks are five times
    // longer than they are thick, and an un-normalised offset would scale
    // with the girth and vanish.
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
           float stretch = length(instanceMatrix[1].xyz) / max(length(instanceMatrix[0].xyz), 1e-4);
           transformed.x += bend * 0.12 * uWind * tip * tip * stretch;
           transformed.z += bend * 0.07 * uWind * tip * tip * stretch;`,
        );
    };

    let longTotal = 0;
    let shortTotal = 0;
    const perAnemone: { long: number; short: number }[] = spots.map((spot) => {
      const tier = {
        long: Math.round(7 + spot.size * 0.9),
        short: Math.round(10 + spot.size * 1.6),
      };
      longTotal += tier.long;
      shortTotal += tier.short;
      return tier;
    });

    const trunks = this.ownInstanced(
      new InstancedMesh(this.own(createTrunkGeometry()), trunkMaterial, spots.length),
    );
    trunks.name = "anemone-trunks";
    const tentacles = this.ownInstanced(
      new InstancedMesh(this.own(createTentacleGeometry(true)), tentacleMaterial, longTotal),
    );
    tentacles.name = "anemone-tentacles";
    const carpet = this.ownInstanced(
      new InstancedMesh(this.own(createTentacleGeometry(false)), tentacleMaterial, shortTotal),
    );
    carpet.name = "anemone-carpet";
    for (const mesh of [trunks, tentacles, carpet]) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      this.group.add(mesh);
    }

    const dummy = new Object3D();
    const color = new Color();
    const tiltAxis = new Vector3();
    const swing = new Quaternion();
    let longIndex = 0;
    let shortIndex = 0;

    for (let i = 0; i < spots.length; i++) {
      const spot = spots[i]!;
      const ground = seabedHeight(spot.x, spot.z);
      const trunkHeight = 0.22 * spot.size;
      const crownRadius = 0.17 * spot.size;
      const family = FAMILIES[i % FAMILIES.length]!;
      const crownBase = ground + trunkHeight * 0.96 - 0.01;

      dummy.position.set(spot.x, ground - 0.02, spot.z);
      dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
      dummy.scale.set(crownRadius * 0.8, trunkHeight, crownRadius * 0.8);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      // The column is the crown's colour taken down and warmed: one plant.
      color.setHex(family).multiplyScalar(0.55);
      color.r *= 1.06;
      color.b *= 0.92;
      trunks.setColorAt(i, color);

      const tier = perAnemone[i]!;
      for (let k = 0; k < tier.long + tier.short; k++) {
        const isLong = k < tier.long;
        const n = isLong ? tier.long : tier.short;
        const j = isLong ? k : k - tier.long;
        // Long outer stalks splay and carry the beads; the short carpet
        // stands dense and nearly upright. One ring parameter each.
        const ringT = random.next();
        const yawA = (j / n) * Math.PI * 2 + random.signed(0.3);
        const tilt = isLong ? 0.55 + ringT * 0.4 : 0.1 + ringT * 0.45;
        const radial = crownRadius * (isLong ? 0.6 + 0.2 * ringT : 0.05 + 0.45 * ringT);
        const length = spot.size * (isLong ? random.range(0.115, 0.135) : random.range(0.075, 0.095));

        dummy.position.set(
          spot.x + Math.cos(yawA) * radial,
          crownBase,
          spot.z + Math.sin(yawA) * radial,
        );
        tiltAxis.set(Math.sin(yawA), 0, -Math.cos(yawA));
        swing.setFromAxisAngle(tiltAxis, tilt);
        dummy.quaternion.copy(swing);
        dummy.rotateY(random.range(0, Math.PI * 2));
        const girth = length * (isLong ? random.range(0.15, 0.19) : random.range(0.17, 0.21));
        dummy.scale.set(girth, length, girth);
        dummy.updateMatrix();

        color.setHex(family).multiplyScalar(random.range(0.92, 1.08));
        if (!isLong) {
          // The carpet sits a half-step deeper, so the beaded ring reads.
          color.multiplyScalar(0.92);
        }
        if (isLong) {
          tentacles.setMatrixAt(longIndex, dummy.matrix);
          tentacles.setColorAt(longIndex, color);
          longIndex++;
        } else {
          carpet.setMatrixAt(shortIndex, dummy.matrix);
          carpet.setColorAt(shortIndex, color);
          shortIndex++;
        }
      }
    }

    for (const mesh of [trunks, tentacles, carpet]) {
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
    const rng = new Random(SEEDS.clownfishGrand);
    // The three plumpest crowns are home; a fish dives into its own anemone.
    const bySize = [...spots].sort((a, b) => b.size - a.size);
    const homes = [bySize[0]!, bySize[1] ?? bySize[0]!, bySize[2] ?? bySize[0]!];
    const refuge = (spot: { x: number; z: number; size: number }): Vector3 =>
      // Up the trunk, in amongst the carpet — the fish nests *into* the crown.
      new Vector3(spot.x, seabedHeight(spot.x, spot.z) + 0.22 * spot.size + 0.1, spot.z);

    const center = new Vector3(
      CENTER_X,
      // Just over the crown tops: the weave skims the beaded ring and dips
      // between the crowns, a hand's width above the tallest trunk.
      seabedHeight(CENTER_X, CENTER_Z) + 1.15,
      CENTER_Z,
    );
    const trio = new Clownfish(rng, center, homes.map(refuge));
    this.own(trio.geometry);
    this.own(trio.material);
    this.ownInstanced(trio.mesh);
    this.group.add(trio.mesh);
    this.clownfishPair = trio;
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
 * A unit trunk (height 1, radius ~1, scaled per instance): a fluted column,
 * wide at the foot, waisted at mid-height, flaring again into the oral disc
 * the tentacles root into. Seven ribs wind a slow quarter-turn up the column
 * — the flutes are what stops a metre-wide anemone reading as a traffic cone.
 * Vertex colour deepens the foot into the sand and shades the valleys between
 * ribs. Fourteen columns because seven flutes need two verts apiece.
 */
function createTrunkGeometry(): BufferGeometry {
  const cols = 14;
  const rings = [0, 0.3, 0.55, 0.8, 1];
  // Radius along the column: foot flare, waist, swell, oral-disc flare.
  const profile = [1.12, 0.9, 0.86, 0.98, 1.18];
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rings.length; r++) {
    const t = rings[r]!;
    for (let j = 0; j < cols; j++) {
      const angle = (j / cols) * Math.PI * 2;
      const flute = Math.cos(angle * 7 + t * 1.6);
      const radius = profile[r]! * (1 + 0.07 * flute);
      positions.push(Math.cos(angle) * radius, t, Math.sin(angle) * radius);
      const shade = (0.55 + 0.45 * t) * (0.93 + 0.07 * flute);
      colors.push(shade, shade * 0.98, shade);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let j = 0; j < cols; j++) {
      const a = r * cols + j;
      const b = r * cols + ((j + 1) % cols);
      const c = (r + 1) * cols + ((j + 1) % cols);
      const d = (r + 1) * cols + j;
      indices.push(a, b, d, b, c, d);
    }
  }
  // Caps: a fan under the foot and one over the slightly domed oral disc.
  const footIndex = positions.length / 3;
  positions.push(0, 0, 0);
  colors.push(0.55, 0.54, 0.55);
  for (let j = 0; j < cols; j++) {
    indices.push(footIndex, j, (j + 1) % cols);
  }
  const discIndex = positions.length / 3;
  positions.push(0, 1.04, 0);
  colors.push(1, 0.99, 1);
  const topRow = (rings.length - 1) * cols;
  for (let j = 0; j < cols; j++) {
    indices.push(discIndex, topRow + ((j + 1) % cols), topRow + j);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * A unit tentacle: root at y = 0, tip at y = 1, tapering and gently recurved
 * so a crown never reads as a brush of straight pins. The long tier carries a
 * bead at its tip — the bubble-tip's swollen sphere, the thing a real
 * clownfish-hosting anemone is recognised by — merged into the same geometry
 * rather than instanced apart, so the bead inherits the tentacle's own sway
 * phase for free (a separate instanced bead would sway to its own position's
 * phase and drift off its stalk). Vertex colour runs deep root to full tip,
 * and the bead burns a touch brighter than full: the pastel lives in the
 * instance colour, so tips are pastel and hearts are shaded, which is what
 * makes a fish half-buried in the crown read as *inside* it.
 *
 * Four sides and two or three rings, and that is a perf decision, not a shape
 * one: this is the largest instanced buffer the package owns (~300 tentacles
 * across both tiers), and a tube nine millimetres across cannot be told from
 * a tube twelve.
 */
function createTentacleGeometry(beaded: boolean): BufferGeometry {
  const tube = new CylinderGeometry(0.055, 0.16, 1, 4, beaded ? 3 : 2, true);
  tube.translate(0, 0.5, 0);
  const recurve = beaded ? 0.24 : 0.16;
  const position = tube.attributes.position;
  if (position) {
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      const t = Math.min(1, Math.max(0, position.getY(i)));
      // A soft recurve, strongest at the tip.
      position.setX(i, position.getX(i) + t * t * recurve);
      const shade = 0.5 + 0.5 * t;
      colors[i * 3] = shade;
      colors[i * 3 + 1] = shade * 0.97;
      colors[i * 3 + 2] = shade * 1.03;
    }
    position.needsUpdate = true;
    tube.setAttribute("color", new BufferAttribute(colors, 3));
    tube.computeVertexNormals();
  }
  if (!beaded) {
    tube.computeBoundingSphere();
    return tube;
  }

  const bead = new OctahedronGeometry(0.16, 0);
  bead.scale(1, 0.85, 1);
  bead.translate(recurve + 0.03, 1.0, 0);
  paintVertices(bead, 1.12, 1.08, 1.12);

  // The tube is indexed and the octahedron is not; `mergeGeometries` insists
  // on one convention, and a failed merge is a silent bead-less fallback.
  const tubeNonIndexed = tube.toNonIndexed();
  tube.dispose();
  const merged = mergeGeometries([tubeNonIndexed, bead], false);
  tubeNonIndexed.dispose();
  bead.dispose();
  if (!merged) {
    const fallback = new CylinderGeometry(0.055, 0.16, 1, 4, 3, true);
    fallback.translate(0, 0.5, 0);
    paintVertices(fallback, 0.75, 0.73, 0.77);
    return fallback;
  }
  merged.computeBoundingSphere();
  return merged;
}
