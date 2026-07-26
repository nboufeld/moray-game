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
  Object3D,
  Vector2,
  Vector3,
  type DataTexture,
} from "three";
import { Random, SEEDS } from "../util/Random";
import type { ReefBounds, SphereCollider } from "./CollisionField";
import { buildColorTexture, buildScalarTexture, fbm } from "../rendering/ProceduralTexture";
import { smoothNormals } from "../rendering/SmoothNormals";
import { createToonMaterial } from "../rendering/ToonShading";
import { CoralField } from "./CoralField";
import { createRockMaterial, weatherRock } from "./RockMaterial";
import { createSandMaterial } from "./SandMaterial";
import { bakeSeabedOcclusion, createSeabedGeometry, seabedHeight, type ContactPatch } from "./Seabed";
import { SeaGrass, type GrassClump } from "./SeaGrass";

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

/**
 * What is actually inside the crevice, shared by all four of them.
 *
 * A single flat colour behind the alpha falloff read as a sticker: the mouth
 * had no interior, just a tint. A radial ramp gives it one — deepest where the
 * passage runs furthest back, lifting toward broken rock near the rim where the
 * light still reaches. The noise is faint on purpose; the mouth has to read as
 * depth, and detail is what depth does not have.
 *
 * The throat used to be all but black, which is the one thing WP-G1 says this
 * world does not contain: the darkest thing in it is a colour, not the absence
 * of one, and a hole punched in the reef is where the eye goes first. It is a
 * deep violet-blue now, the same family the ambient casts its shadows in, so
 * the crevice reads as the darkest *shadow* in the frame rather than as a gap
 * in it. The animals in these mouths were tuned against the black — see the
 * WP-G4 note in AGENTS.md for how their legibility was re-checked.
 */
let caveInteriorTexture: DataTexture | undefined;
function caveInterior(): DataTexture {
  caveInteriorTexture ??= buildColorTexture(64, (u, v) => {
    const distance = Math.hypot(u - 0.5, v - 0.5) * 2;
    // 0 in the throat, 1 out at the rim.
    const outward = smoothStep(0.1, 1.05, distance);
    const detail = fbm(u, v, { seed: SEEDS.cave, period: 5, octaves: 2 }) * 0.15;
    const lift = outward * (0.055 + detail);
    // Red is held above the old ramp's proportion for the same reason
    // `uShadowTint` holds it at 1.0: with red below green this stops being
    // violet and goes straight back to being a cool blue hole.
    return [0.165 + lift * 0.72, 0.227 + lift, 0.408 + lift * 0.8];
  });
  return caveInteriorTexture;
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

interface PinnacleSegment {
  /** Icosahedron radius before the vertical stretch. */
  readonly radius: number;
  /** Height of the segment's centre above the sand at the stack's foot. */
  readonly rise: number;
  /** Vertical stretch. Boulders are round; a sea stack is not. */
  readonly stretch: number;
  /** Width across the lean, as a fraction of the width along it. */
  readonly flatten: number;
  /** Radians off vertical, authored rather than jittered. */
  readonly tilt: number;
  /** How far the segment steps off the stack's axis, in metres. */
  readonly lean: number;
}

interface PinnaclePlacement {
  readonly x: number;
  readonly z: number;
  /** Compass direction (radians) the upper segments lean toward. */
  readonly leanTo: number;
  readonly segments: readonly PinnacleSegment[];
}

/**
 * Stone stacks that give the reef a skyline.
 *
 * Nothing here used to rise above three metres inside a twelve-metre swim
 * volume, so the top half of every frame was empty water and the reef read as
 * a floor with pimples. These are authored for the canonical cameras rather
 * than scattered: the first two stand either side of the snowflake crevice so
 * the opening shot looks at its subject through a gate, and the third sits
 * deep behind the dragon to give the frame a background layer to fade into.
 *
 * Their footprints deliberately clear every hiding spot's open side. The
 * dragon is approached up the x ≈ -6 channel and the ribbon and zebra across
 * the z ≈ 6 band, which is why the west stack sits at x = -10.5 rather than
 * the -9 the eye would prefer: a pinnacle in an approach corridor is an
 * undiscoverable moray.
 *
 * Every segment is stretched, flattened and tilted, and each one overlaps the
 * one below by more than a third of its height. Round segments stacked on a
 * shared axis do not read as a sea stack; they read as a snowman, which is
 * exactly what the first pass of these looked like.
 */
const PINNACLES: readonly PinnaclePlacement[] = [
  {
    x: -10.5,
    z: 1,
    leanTo: 2.3,
    segments: [
      { radius: 2.6, rise: 1.9, stretch: 1.5, flatten: 0.72, tilt: 0.16, lean: 0 },
      { radius: 1.9, rise: 5.5, stretch: 1.7, flatten: 0.68, tilt: -0.24, lean: 0.75 },
      { radius: 0.85, rise: 8.15, stretch: 1.45, flatten: 0.78, tilt: 0.32, lean: 1.6 },
    ],
  },
  {
    x: 10,
    z: -2,
    leanTo: -0.7,
    segments: [
      { radius: 3.0, rise: 1.5, stretch: 1.4, flatten: 1.18, tilt: -0.13, lean: 0 },
      // Deliberately the shorter of the two gate posts. Matched heights either
      // side of the subject would hand the frame back its symmetry.
      { radius: 2.05, rise: 5.0, stretch: 1.62, flatten: 0.8, tilt: 0.21, lean: 0.85 },
    ],
  },
  {
    x: -7.5,
    z: -17.5,
    leanTo: 1.2,
    segments: [
      { radius: 2.5, rise: 1.6, stretch: 1.45, flatten: 0.85, tilt: 0.15, lean: 0 },
      { radius: 1.5, rise: 5.3, stretch: 1.85, flatten: 1.1, tilt: -0.26, lean: 0.65 },
    ],
  },
];

/**
 * The foreground mass in the opening shot: a shoulder of dark stone just off
 * the diver's left, close enough to be cut by the frame edge.
 *
 * A repoussoir is the cheapest depth cue there is — one near, dark, partly
 * cropped object turns a flat vista into three layers — and it is what makes
 * the composition asymmetric. It sits west of the spawn line, well clear of
 * the snowflake's corridor, and the right of the frame is left deliberately
 * empty so the eye has somewhere to travel.
 */
const FOREGROUND_SHOULDER = { x: -5.4, z: 19, radius: 2.8, rise: 0.95 } as const;

/**
 * Its grass, standing taller and tighter than the meadow so that it crops the
 * frame edge instead of dressing the floor. It grows off the shoulder's inner
 * flank — the shoulder itself fills the sand behind it — and stops two metres
 * short of the spawn line, which the diver flies straight down.
 */
const FOREGROUND_CLUMPS: readonly GrassClump[] = [
  { x: -3.4, z: 18.6, radius: 1.3, blades: 34, heightScale: 2 },
];

/**
 * A hand-placed greybox of the Sunlit Coral Garden: seabed, rounded rocks,
 * the pinnacles and foreground shoulder that stage it for the camera, coral
 * bommies, instanced sea grass and several hero crevices — one per moray.
 * Each crevice's coral mound sits behind the peeking head so the line of sight
 * stays clear from the head's open side.
 *
 * Everything here is placed twice over: once for the eye, and once for the
 * raycast that decides whether a moray can be seen. `tests/reefSightlines`
 * guards the second one.
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
  private readonly boulderMaterial = createRockMaterial(0x93a089);
  // Only the foreground shoulder uses this. It stands a few metres from the
  // lens with the sun behind the diver, so nothing but its own darkness will
  // hold it down against the lit reef beyond.
  private readonly silhouetteMaterial = createRockMaterial(0x3a474a);

  private readonly random: Random;
  private readonly contacts: ContactPatch[] = [];
  private grass?: SeaGrass;

  constructor(seed: number = SEEDS.reef) {
    this.random = new Random(seed);
    this.buildRockField();
    this.buildStage();
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
    const material = this.boulderMaterial;

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
      weatherRock(geometry, SEEDS.rock + index * 131, { amount: 0.17 });
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

  /**
   * The staging pass: the pinnacles that carry the skyline and the foreground
   * shoulder that crops the opening frame.
   *
   * It draws from its own stream rather than the reef's shared one so that
   * adding to it does not reshuffle the rubble and the rock field downstream —
   * a screenshot comparison is worthless if everything moves at once.
   */
  private buildStage(): void {
    const random = new Random(SEEDS.pinnacle);

    for (const [index, pinnacle] of PINNACLES.entries()) {
      const foot = seabedHeight(pinnacle.x, pinnacle.z);
      const leanX = Math.cos(pinnacle.leanTo);
      const leanZ = Math.sin(pinnacle.leanTo);
      // Turning about this tips the segment's up-axis toward the lean.
      const leanAxis = new Vector3(leanZ, 0, -leanX);

      for (const [order, segment] of pinnacle.segments.entries()) {
        const geometry = new IcosahedronGeometry(segment.radius, 2);
        weatherRock(geometry, SEEDS.pinnacle + (index * 7 + order) * 131, { amount: 0.3 });
        const block = new Mesh(geometry, this.boulderMaterial);
        block.position.set(
          pinnacle.x + leanX * segment.lean,
          foot + segment.rise,
          pinnacle.z + leanZ * segment.lean,
        );
        // Turned so the flattened axis lies across the lean, then listed off
        // vertical in the lean's direction. A plumb stack reads as masonry.
        block.rotation.y = -pinnacle.leanTo + random.signed(0.16);
        block.scale.set(1, segment.stretch, segment.flatten);
        block.rotateOnWorldAxis(leanAxis, segment.tilt);
        block.castShadow = true;
        block.receiveShadow = true;
        this.group.add(block);
        this.obstructionMeshes.push(block);
        this.colliders.push({
          center: block.position.clone(),
          radius: segment.radius * 0.95 * Math.max(1, segment.flatten),
        });
      }

      const base = pinnacle.segments[0];
      if (base) {
        this.contacts.push({
          x: pinnacle.x,
          z: pinnacle.z,
          radius: base.radius * 2.1,
          strength: 0.6,
        });
      }
    }

    const shoulder = FOREGROUND_SHOULDER;
    const geometry = new IcosahedronGeometry(shoulder.radius, 2);
    weatherRock(geometry, SEEDS.pinnacle ^ 0x5c0d, { amount: 0.32 });
    const rock = new Mesh(geometry, this.silhouetteMaterial);
    rock.position.set(
      shoulder.x,
      seabedHeight(shoulder.x, shoulder.z) + shoulder.rise,
      shoulder.z,
    );
    rock.rotation.set(random.signed(0.22), random.range(0, Math.PI * 2), 0.26);
    rock.scale.set(1.2, 1.15, 0.82);
    rock.castShadow = true;
    rock.receiveShadow = true;
    this.group.add(rock);
    this.obstructionMeshes.push(rock);
    this.colliders.push({ center: rock.position.clone(), radius: shoulder.radius * 0.95 });
    this.contacts.push({
      x: shoulder.x,
      z: shoulder.z,
      radius: shoulder.radius * 2,
      strength: 0.55,
    });
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
    //
    // Every vertex of it stands exactly where it stood before the reef went
    // round: `preserveProfile` keeps the old displacement field, so this shape
    // is bit-identical and the line of sight through the crevice cannot have
    // moved. What it does take is the new smooth normals, which is the half of
    // "chiselled" the camera actually sees.
    const moundGeometry = new DodecahedronGeometry(3.0, 1);
    weatherRock(moundGeometry, SEEDS.rock ^ hashSpecies(placement.speciesId), {
      amount: 0.2,
      inwardOnly: true,
      preserveProfile: true,
    });
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
    // The interior ramp carries the depth — near-black in the throat, a trace
    // of cool rock by the rim — and the alpha falls off outward so the mouth
    // blends into the mound instead of sitting on it like a sticker.
    const cave = new Mesh(
      new CircleGeometry(1.25, 28),
      new MeshBasicMaterial({
        map: caveInterior(),
        transparent: true,
        depthWrite: false,
        alphaMap: caveFalloff(),
      }),
    );
    cave.position.copy(position).addScaledVector(back, 0.95).setY(position.y - 0.05);
    cave.rotation.y = facing;
    this.group.add(cave);

    // Flank blocks framing the mouth (a natural cleaner-shrimp perch).
    //
    // Segmented finely enough for `weatherRock` to have something to work
    // with. A box at two segments an axis has one vertex ring to displace per
    // face, so however much it is weathered it stays a box with a bevel — six
    // flat faces and twelve straight edges, standing beside the moray's head
    // where the camera is closest to it and reading as laid masonry. At four
    // it breaks up like every other stone in the reef.
    //
    // These hold the old profile for the same reason the mound does. They
    // stand a body's width either side of the head and narrow the view into the
    // crevice on purpose, which is the one thing the sightline test measures
    // and does not fully pin down: it asks that three quarters of the approach
    // be clear, and a stone free to bulge a third further out is free to spend
    // that margin. Smooth normals round them off without spending anything.
    for (const sign of [-1, 1]) {
      const flankGeometry = new BoxGeometry(1.1, 1.7, 1.5, 4, 4, 4);
      weatherRock(flankGeometry, SEEDS.rock ^ hashSpecies(placement.speciesId + sign), {
        amount: 0.3,
        preserveProfile: true,
      });
      const flank = new Mesh(flankGeometry, this.rockMaterial);
      flank.position
        .copy(position)
        .addScaledVector(back, 1.9)
        .addScaledVector(right, sign * 1.9)
        .setY(position.y - 0.5);
      // Two matched blocks square to the mouth form a right-angled doorway
      // around the eel — the last trace of greybox in the close-up. Yawing
      // each off the mound axis, sinking them, and scaling them unequally
      // turns the doorway back into two stones that happen to sit there.
      const skew = ((hashSpecies(placement.speciesId + String(sign)) % 100) / 100 - 0.5) * 0.4;
      flank.rotation.y = facing + sign * 0.24 + skew;
      flank.scale.set(1 + sign * 0.14, 0.94 - sign * 0.12, 1.08);
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
    const material = createToonMaterial({
      // Close to the sand it lies on. Stones darker than this read as holes
      // punched in the seabed rather than as pebbles resting on it.
      color: 0xc4baa0,
    });
    // Smooth, like every other stone in the reef now — and here that is the
    // whole of the change, because a dodecahedron at detail 0 is already
    // carrying face normals in its buffer and the material flag was doing
    // nothing. Welding them turns twelve pentagons into one worn pebble.
    const stoneGeometry = new DodecahedronGeometry(0.24, 0);
    smoothNormals(stoneGeometry);
    const stones = new InstancedMesh(stoneGeometry, material, count);
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
    this.grass = new SeaGrass(SEEDS.grass, clearances, FOREGROUND_CLUMPS);
    this.group.add(this.grass.mesh);
  }

  /** Advances the ambient life in the reef (currently the grass sway). */
  update(dt: number, reducedMotion: boolean): void {
    this.grass?.update(dt, reducedMotion);
  }
}
