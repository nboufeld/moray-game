import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  type BufferGeometry,
  type MeshToonMaterial,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { createToonMaterial } from "../rendering/ToonShading";
import { Random, SEEDS } from "../util/Random";
import { isClear } from "./CoralField";
import { coralGeometry, coralSkin, type CoralKind } from "./CoralShapes";
import { seabedHeight, type ContactPatch } from "./Seabed";
import { createSunViewUniform, injectLeafGlow, trackSunView } from "./SeaGrass";
import { seaweedBushGeometry, seaweedRosetteGeometry } from "./Seaweed";

/**
 * Low colour framing the spawn corridor's first ten metres (W-N5).
 *
 * The corridor itself is a deliberate approach lane — the channel of bare
 * sand from the spawn at (0, 2, 22) straight to the snowflake's den — and it
 * stays exactly as clear as `CoralField.CORRIDORS` demands. What the round
 * critic called out is the *edges*: between the foreground shoulder and the
 * arch group around z ≈ 12 there was nothing for six metres either side, so
 * the channel read as emptiness rather than as a path. This module lays small
 * coral heads, sponge tubes, seaweed cushions and frond rosettes in two
 * authored beds just outside the corridor box, the way stones line a garden
 * path: the eye now runs *between* two ribbons of colour to the den.
 *
 * The rules it lives under, all of them other packages' guarantees:
 *
 * - **Nothing stands inside the corridor.** Every piece answers
 *   `CoralField.isClear` — imported, never copied, the legal direction — and
 *   the beds are authored a margin outside the box on top of it, so the
 *   seeded jitter cannot walk a piece over the line.
 *   `tests/corridorDressing.test.ts` reads the rule back.
 * - **Nothing rerolls.** Every draw comes from `SEEDS.corridorDressing`
 *   (pre-registered for this package); the coral field, the seaweed field
 *   and the meadow keep their own streams untouched. The bed lists below are
 *   append-only for the same reason `FOREGROUND_CLUMPS` is: a spot inserted
 *   mid-list re-jitters everything after it.
 * - **Nothing obstructs and nothing collides.** Ankle-height scenery, in
 *   neither `obstructionMeshes` nor `colliders` — the sightline and swim
 *   contracts evaluate exactly what they did. The spawn sightline test walks
 *   x = 0 straight over these beds and cannot see them.
 * - **Cheap by construction.** Five instanced draws (bush, frond, boulder,
 *   polyp, tube), ~2.5k triangles, no shadows cast — the contact patches the
 *   seabed already bakes are the grounding, at the rubble's argument.
 */

/** One authored spot in a bed. Positions are the composition; jitter is felt. */
interface DressSpot {
  readonly x: number;
  readonly z: number;
  readonly kind: "bush" | "frond" | "head" | "tubes" | "tube";
  /** Which flanking garden's family the piece borrows. */
  readonly family: "rose" | "ochre";
}

/**
 * The two beds, west and east of the channel.
 *
 * Authored against everything already standing there: the west bed threads
 * between the arch group / near kelp stand (−5.9, 13.2) and the foreground
 * shoulder's slab (≥ 4 m off its centre at (−5.4, 19)); the east bed fills
 * the truly bare stretch z 16–21 at the spawn's right hand and ties into the
 * grass clump at (3.6, 15.4). Families follow the gardens each bed leads to —
 * rose out of the shot-A mass, rose-and-ochre toward the tidepool.
 */
const SPOTS: readonly DressSpot[] = [
  // West bed.
  { x: -4.3, z: 14.9, kind: "bush", family: "rose" },
  { x: -3.9, z: 13.7, kind: "head", family: "rose" },
  { x: -3.75, z: 12.9, kind: "frond", family: "rose" },
  { x: -4.75, z: 12.3, kind: "tubes", family: "rose" },
  { x: -4.15, z: 14.15, kind: "bush", family: "ochre" },
  // East bed.
  { x: 4.3, z: 20.8, kind: "tube", family: "ochre" },
  { x: 4.15, z: 19.9, kind: "bush", family: "rose" },
  { x: 4.85, z: 18.8, kind: "head", family: "ochre" },
  { x: 3.85, z: 18.1, kind: "frond", family: "rose" },
  { x: 4.55, z: 17.0, kind: "tubes", family: "rose" },
  { x: 3.8, z: 16.2, kind: "bush", family: "rose" },
  { x: 4.15, z: 13.3, kind: "head", family: "rose" },
  { x: 5.1, z: 12.5, kind: "frond", family: "ochre" },
];

/** How far the jitter may move an authored spot, in metres. */
const JITTER = 0.15;

/**
 * The flanking gardens' own hues (`CoralField.FAMILIES`, the small-piece
 * ends), and the seaweed field's olives. Tones stay off the reef range's
 * dark floor: a half-metre piece at the dark end reads as litter, not depth.
 */
const CORAL_HUES: Record<"rose" | "ochre", readonly number[]> = {
  rose: [0xc9707e, 0xd2867c, 0xc7755a],
  ochre: [0xcca572, 0xd3b47e, 0xb9925f],
};
const BUSH_HUES = [0x86904e, 0x8f9a52, 0x7a4f62];
const FROND_HUES = [0x74904c, 0x5f8747];
const TONE = { min: 0.78, max: 1.12 } as const;

export class CorridorDressing {
  readonly group = new Group();
  /** Where each piece meets the sand, for the seabed's baked contact shadows. */
  readonly contacts: ContactPatch[] = [];

  private readonly sway = { value: 0 };
  private readonly windStrength = { value: 1 };
  private readonly sunView = createSunViewUniform();
  private readonly owned: (BufferGeometry | MeshToonMaterial)[] = [];

  constructor(seed: number = SEEDS.corridorDressing) {
    this.group.name = "corridor-dressing";
    const random = new Random(seed);

    // Gathered per kind first, so each list becomes one instanced draw. The
    // spots are walked once in authored order; a spot's *kind* is part of its
    // identity (kinds consume different draw counts), so retunes may move a
    // piece's own jitter and never a neighbour's — and the list stays
    // append-only, like `FOREGROUND_CLUMPS`.
    const placed: PlacedBuckets = { bush: [], frond: [], boulder: [], polyp: [], tube: [] };
    for (const spot of SPOTS) {
      const x = spot.x + random.signed(JITTER);
      const z = spot.z + random.signed(JITTER);
      const yaw = random.range(0, Math.PI * 2);
      const size = random.range(0, 1);
      const tone = random.range(TONE.min, TONE.max);
      if (!isClear(x, z)) {
        // Statistically unreachable at these margins; a skipped piece beats a
        // piece standing in the lane, and the stream length is unchanged.
        continue;
      }
      this.placeSpot(placed, random, spot, { x, z, yaw, size, tone });
    }

    this.group.add(this.buildBushes(random, placed.bush));
    this.group.add(this.buildFronds(placed.frond));
    this.group.add(this.buildCoral("boulder", placed.boulder));
    this.group.add(this.buildCoral("polyp", placed.polyp));
    this.group.add(this.buildCoral("tube", placed.tube));
  }

  private placeSpot(
    placed: PlacedBuckets,
    random: Random,
    spot: DressSpot,
    draw: { x: number; z: number; yaw: number; size: number; tone: number },
  ): void {
    const { x, z, yaw, size, tone } = draw;
    const ground = seabedHeight(x, z);
    const hue = (list: readonly number[], pick: number): Color =>
      new Color(list[Math.floor(pick * list.length)] ?? list[0]!).multiplyScalar(tone);
    const coralColor = hue(CORAL_HUES[spot.family], size);

    switch (spot.kind) {
      case "bush": {
        const scale = 0.32 + size * 0.18;
        placed.bush.push({
          x,
          y: ground - 0.05,
          z,
          yaw,
          scale: [scale * 1.1, scale * random.range(0.6, 0.75), scale],
          color: hue(BUSH_HUES, random.next()),
        });
        this.contacts.push({ x, z, radius: 0.7, strength: 0.32 });
        return;
      }
      case "frond": {
        const scale = 0.62 + size * 0.3;
        placed.frond.push({
          x,
          y: ground - 0.04,
          z,
          yaw,
          scale: [scale, scale * random.range(0.85, 1.1), scale],
          color: hue(FROND_HUES, random.next()),
        });
        this.contacts.push({ x, z, radius: 0.55, strength: 0.28 });
        return;
      }
      case "head": {
        // A crusted dome, the fill garden's own gesture at half its size.
        const scale = 0.42 + size * 0.2;
        placed.boulder.push({
          x,
          y: ground + scale * 0.34,
          z,
          yaw,
          scale: [scale * 1.15, scale * random.range(0.55, 0.7), scale * 1.1],
          color: coralColor,
        });
        for (let i = 0; i < 3; i++) {
          const around = random.range(0, Math.PI * 2);
          const out = random.range(0.08, 0.3) * scale * 2;
          placed.polyp.push({
            x: x + Math.cos(around) * out,
            y: ground + scale * random.range(0.5, 0.72),
            z: z + Math.sin(around) * out,
            yaw: 0,
            scale: [scale * 1.4, scale * 1.4, scale * 1.4],
            color: coralColor,
          });
        }
        this.contacts.push({ x, z, radius: scale * 2, strength: 0.36 });
        return;
      }
      case "tubes": {
        // The sponge cluster gesture from `CoralField.addMid`, two barrels.
        for (const [out, heightScale] of [
          [0.12, 1],
          [0.2, 0.68],
        ] as const) {
          const around = random.range(0, Math.PI * 2);
          const height = (0.26 + size * 0.14) * heightScale;
          const tx = x + Math.cos(around) * out;
          const tz = z + Math.sin(around) * out;
          placed.tube.push({
            x: tx,
            y: seabedHeight(tx, tz) - 0.03,
            z: tz,
            yaw: random.range(0, Math.PI * 2),
            scale: [height, height, height],
            color: coralColor,
          });
        }
        this.contacts.push({ x, z, radius: 0.6, strength: 0.3 });
        return;
      }
      case "tube": {
        const height = 0.24 + size * 0.14;
        placed.tube.push({
          x,
          y: ground - 0.03,
          z,
          yaw,
          scale: [height, height, height],
          color: coralColor,
        });
        this.contacts.push({ x, z, radius: 0.45, strength: 0.28 });
        return;
      }
      default: {
        const exhaustive: never = spot.kind;
        throw new Error(`Unhandled dressing kind: ${String(exhaustive)}`);
      }
    }
  }

  /** The seaweed field's cushion, at undergrowth size. */
  private buildBushes(random: Random, parts: readonly Placed[]): InstancedMesh {
    const geometry = seaweedBushGeometry(random);
    const material = createToonMaterial({ vertexColors: true });
    this.owned.push(geometry, material);
    return this.instantiate(geometry, material, parts, "corridor-bush");
  }

  /** The seaweed field's rosette, with the same sway and leaf glow. */
  private buildFronds(parts: readonly Placed[]): InstancedMesh {
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
           float phase = instanceMatrix[3][0] * 0.53 + instanceMatrix[3][2] * 0.47;
           float tip = clamp(transformed.y / 0.9, 0.0, 1.0);
           float bend = sin(uSway * 0.9 + phase) * 0.6 + sin(uSway * 0.37 + phase * 1.7) * 0.4;
           transformed.x += bend * 0.1 * uWind * tip * tip;
           transformed.z += bend * 0.06 * uWind * tip * tip;`,
        );
      injectLeafGlow(
        shader,
        this.sunView,
        "vec3(0.10, 0.20, 0.15)",
        "vec3(0.30, 0.24, 0.09)",
        "clamp(vColor.g * 1.6, 0.0, 1.0)",
      );
    };
    this.owned.push(geometry, material);
    const mesh = this.instantiate(geometry, material, parts, "corridor-frond");
    trackSunView(mesh, this.sunView);
    return mesh;
  }

  /** A coral silhouette on the shared `CoralShapes` geometry and skin. */
  private buildCoral(kind: CoralKind, parts: readonly Placed[]): InstancedMesh {
    const skin = coralSkin(kind);
    const geometry = coralGeometry(kind);
    const material = createToonMaterial({
      map: skin.map,
      normalMap: skin.normal,
      vertexColors: geometry.hasAttribute("color"),
    });
    // The geometry and the skin are `CoralShapes`' shared caches, exactly as
    // the reef's garden holds them — only the material joins the owned list.
    this.owned.push(material);
    return this.instantiate(geometry, material, parts, `corridor-${kind}`);
  }

  private instantiate(
    geometry: BufferGeometry,
    material: MeshToonMaterial,
    parts: readonly Placed[],
    name: string,
  ): InstancedMesh {
    const mesh = new InstancedMesh(geometry, material, parts.length);
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    const dummy = new Object3D();
    parts.forEach((part, index) => {
      dummy.position.set(part.x, part.y, part.z);
      dummy.rotation.set(0, part.yaw, 0);
      dummy.scale.set(...part.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, part.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    // Instance-aware bounds, computed once: nothing here ever moves, and the
    // geometry's own metre sphere at the node origin would cull the whole
    // draw whenever the world origin left the frustum — the sill stones' trap.
    mesh.computeBoundingSphere();
    return mesh;
  }

  /** Winds the fronds' sway; driven by `Reef.update` like the seaweed field. */
  update(dt: number, reducedMotion: boolean): void {
    this.sway.value += dt * (reducedMotion ? 0.35 : 1);
    this.windStrength.value = reducedMotion ? 0.45 : 1;
  }

  /** Releases what this module owns — never the shared coral caches. */
  dispose(): void {
    for (const owned of this.owned) {
      owned.dispose();
    }
    this.owned.length = 0;
    for (const child of [...this.group.children]) {
      if (child instanceof InstancedMesh) {
        child.dispose();
      }
    }
    this.group.removeFromParent();
    this.group.clear();
  }
}

interface Placed {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: readonly [number, number, number];
  readonly color: Color;
}

/** One list per instanced draw the constructor assembles. */
interface PlacedBuckets {
  readonly bush: Placed[];
  readonly frond: Placed[];
  readonly boulder: Placed[];
  readonly polyp: Placed[];
  readonly tube: Placed[];
}
