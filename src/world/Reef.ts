import {
  BoxGeometry,
  CircleGeometry,
  Color,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector2,
  Vector3,
  type DataTexture,
} from "three";
import { Random, SEEDS } from "../util/Random";
import type { ReefBounds, SphereCollider } from "./CollisionField";
import { buildScalarTexture } from "../rendering/ProceduralTexture";
import { CoralField } from "./CoralField";
import { createRockMaterial, weatherRock } from "./RockMaterial";
import { createSandMaterial } from "./SandMaterial";
import { bakeSeabedOcclusion, createSeabedGeometry, seabedHeight, type ContactPatch } from "./Seabed";
import { SeaGrass } from "./SeaGrass";

export interface HidingSpot {
  readonly speciesId: string;
  /** World position where the moray's head peeks into open water. */
  readonly position: Vector3;
  /** Yaw (radians) the head faces — its open, approachable side. */
  readonly facing: number;
}

interface SpotPlacement {
  readonly speciesId: string;
  readonly position: Vector3;
  readonly facing: number;
}

/** Shared by every crevice: opaque at the centre, gone by the rim. */
let caveFalloffTexture: DataTexture | undefined;
function caveFalloff(): DataTexture {
  caveFalloffTexture ??= buildScalarTexture(64, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    return 1 - smoothStep(0.35, 1, distance);
  });
  return caveFalloffTexture;
}

/** Stable per-crevice variation so each mound weathers differently. */
function hashSpecies(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const SPOT_PLACEMENTS: readonly SpotPlacement[] = [
  { speciesId: "snowflake-moray", position: new Vector3(0, 1.4, 1.5), facing: 0 },
  { speciesId: "ribbon-moray", position: new Vector3(-13, 1.6, 6), facing: Math.PI / 2 },
  { speciesId: "zebra-moray", position: new Vector3(13, 1.4, 6), facing: -Math.PI / 2 },
  { speciesId: "dragon-moray", position: new Vector3(-6, 1.6, -9), facing: 0 },
];

/**
 * A hand-placed greybox of the Sunlit Coral Garden: seabed, rounded rocks,
 * coral clusters, instanced sea grass and several hero crevices — one per
 * moray. Each crevice's coral mound sits behind the peeking head so the line
 * of sight stays clear from the head's open side.
 */
export class Reef {
  readonly group = new Group();
  readonly colliders: SphereCollider[] = [];
  readonly obstructionMeshes: Mesh[] = [];
  readonly hidingSpots: HidingSpot[] = [];
  readonly bounds: ReefBounds = {
    minX: -30,
    maxX: 30,
    minY: 0.6,
    maxY: 12,
    minZ: -30,
    maxZ: 30,
  };

  // Lifted well off the old near-black: against bright sand and blue water the
  // previous value read as a silhouette hole rather than as stone.
  private readonly rockMaterial = createRockMaterial(0x8b9184);

  private readonly random: Random;
  private readonly contacts: ContactPatch[] = [];
  private grass?: SeaGrass;

  constructor(seed: number = SEEDS.reef) {
    this.random = new Random(seed);
    this.buildRockField();
    this.buildCoral();
    for (const placement of SPOT_PLACEMENTS) {
      this.addHidingSpot(placement);
    }
    this.buildRubble();
    this.buildSeaGrass();
    // Last: the sand bakes a contact shadow under everything standing on it,
    // so it has to know where everything ended up. Nothing above consumes the
    // seabed mesh, and none of them share a random stream, so the reordering
    // leaves the layout identical.
    this.buildSeabed();
  }

  private buildSeabed(): void {
    const geometry = createSeabedGeometry(90, 96);
    bakeSeabedOcclusion(geometry, this.contacts);
    const seabed = new Mesh(geometry, createSandMaterial());
    seabed.receiveShadow = true;
    this.group.add(seabed);
  }

  private buildRockField(): void {
    const material = createRockMaterial(0x93a089);

    const placements: Array<{ x: number; z: number; scale: number }> = [
      { x: -20, z: -2, scale: 2.4 },
      { x: 20, z: -3, scale: 3.1 },
      { x: -12, z: -18, scale: 2.0 },
      { x: 8, z: 16, scale: 1.6 },
      { x: 22, z: 14, scale: 2.2 },
      { x: -3, z: -20, scale: 2.8 },
    ];

    for (const [index, p] of placements.entries()) {
      const geometry = new IcosahedronGeometry(p.scale, 2);
      weatherRock(geometry, SEEDS.rock + index * 131, 0.17);
      const rock = new Mesh(geometry, material);
      rock.position.set(p.x, p.scale * 0.55 + seabedHeight(p.x, p.z), p.z);
      rock.rotation.set(this.random.next(), this.random.next(), this.random.next());
      rock.scale.y = 0.75;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
      this.obstructionMeshes.push(rock);
      this.colliders.push({ center: rock.position.clone(), radius: p.scale * 0.85 });
      this.contacts.push({ x: p.x, z: p.z, radius: p.scale * 1.9, strength: 0.5 });
    }
  }

  private buildCoral(): void {
    const coral = new CoralField(SEEDS.coral);
    this.group.add(coral.group);
    this.contacts.push(...coral.contacts);
  }

  private addHidingSpot(placement: SpotPlacement): void {
    const { position, facing } = placement;
    const forward = new Vector3(Math.sin(facing), 0, Math.cos(facing));
    const back = forward.clone().negate();
    const right = new Vector3(forward.z, 0, -forward.x);

    // Coral mound behind the head (along the body/deeper direction).
    const moundGeometry = new DodecahedronGeometry(3.0, 1);
    weatherRock(moundGeometry, SEEDS.rock ^ hashSpecies(placement.speciesId), 0.2, true);
    const mound = new Mesh(moundGeometry, this.rockMaterial);
    mound.position.copy(position).addScaledVector(back, 3.9);
    mound.position.y = position.y + 1.0;
    mound.scale.set(1.5, 0.8, 1.2);
    mound.rotation.y = facing;
    mound.castShadow = true;
    mound.receiveShadow = true;
    this.group.add(mound);
    this.obstructionMeshes.push(mound);
    this.colliders.push({
      center: position.clone().addScaledVector(back, 3.9).setY(position.y + 0.3),
      radius: 3.0,
    });

    // Dark cave mouth framing the crevice, facing the head's open side.
    // Dark enough to read as depth, but not the flat black that looked like a
    // hole punched through the reef. The alpha falls off toward the rim so the
    // mouth blends into the mound instead of sitting on it like a sticker.
    const cave = new Mesh(
      new CircleGeometry(1.25, 28),
      new MeshBasicMaterial({
        color: 0x081d26,
        transparent: true,
        depthWrite: false,
        alphaMap: caveFalloff(),
      }),
    );
    cave.position.copy(position).addScaledVector(back, 0.95).setY(position.y - 0.05);
    cave.rotation.y = facing;
    this.group.add(cave);

    // Flank blocks framing the mouth (a natural cleaner-shrimp perch).
    for (const sign of [-1, 1]) {
      const flankGeometry = new BoxGeometry(1.1, 1.7, 1.5, 2, 2, 2);
      weatherRock(flankGeometry, SEEDS.rock ^ hashSpecies(placement.speciesId + sign), 0.22);
      const flank = new Mesh(flankGeometry, this.rockMaterial);
      flank.position
        .copy(position)
        .addScaledVector(back, 1.9)
        .addScaledVector(right, sign * 1.9)
        .setY(position.y - 0.3);
      flank.castShadow = true;
      flank.receiveShadow = true;
      this.group.add(flank);
    }

    this.contacts.push({
      x: mound.position.x,
      z: mound.position.z,
      radius: 5.4,
      strength: 0.5,
    });

    this.hidingSpots.push({ speciesId: placement.speciesId, position: position.clone(), facing });
  }

  /**
   * Small stones strewn across the sand. Bare seabed is the dead space that
   * makes an open reef read as an empty stage, and rubble is the cheapest way
   * to give the eye something to travel over between the set pieces.
   */
  private buildRubble(): void {
    const count = 150;
    const material = new MeshStandardMaterial({
      // Close to the sand it lies on. Stones darker than this read as holes
      // punched in the seabed rather than as pebbles resting on it.
      color: 0xc4baa0,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    const stones = new InstancedMesh(new DodecahedronGeometry(0.24, 0), material, count);
    stones.receiveShadow = true;
    // No cast shadow: at this size the contact shadow is larger than the stone
    // and turns a scattering of pebbles into a scattering of dark smudges.
    stones.castShadow = false;

    const dummy = new Object3D();
    const color = new Color();
    for (let i = 0; i < count; i++) {
      const x = this.random.signed(30);
      const z = this.random.signed(30);
      dummy.position.set(x, seabedHeight(x, z) + this.random.range(-0.04, 0.06), z);
      dummy.rotation.set(
        this.random.range(0, Math.PI),
        this.random.range(0, Math.PI),
        this.random.range(0, Math.PI),
      );
      // Flattened, as though long settled rather than freshly dropped.
      dummy.scale.set(
        this.random.range(0.35, 1.1),
        this.random.range(0.18, 0.45),
        this.random.range(0.35, 1.1),
      );
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);

      color.setHex(0xc4baa0).multiplyScalar(this.random.range(0.82, 1.1));
      stones.setColorAt(i, color);
    }
    stones.instanceMatrix.needsUpdate = true;
    if (stones.instanceColor) {
      stones.instanceColor.needsUpdate = true;
    }
    this.group.add(stones);
  }

  private buildSeaGrass(): void {
    const clearances = this.hidingSpots.map((spot) => new Vector2(spot.position.x, spot.position.z));
    this.grass = new SeaGrass(SEEDS.grass, clearances);
    this.group.add(this.grass.mesh);
  }

  /** Advances the ambient life in the reef (currently the grass sway). */
  update(dt: number, reducedMotion: boolean): void {
    this.grass?.update(dt, reducedMotion);
  }
}
