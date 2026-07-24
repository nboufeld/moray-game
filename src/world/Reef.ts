import {
  BoxGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from "three";
import type { ReefBounds, SphereCollider } from "./CollisionField";

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

  private readonly rockMaterial = new MeshStandardMaterial({
    color: 0x6a7a6c,
    roughness: 0.95,
    metalness: 0,
    flatShading: true,
  });

  constructor() {
    this.buildSeabed();
    this.buildRockField();
    this.buildCoral();
    for (const placement of SPOT_PLACEMENTS) {
      this.addHidingSpot(placement);
    }
    this.buildSeaGrass();
  }

  private buildSeabed(): void {
    const geometry = new PlaneGeometry(80, 80, 1, 1);
    const material = new MeshStandardMaterial({ color: 0xd8c69a, roughness: 1, metalness: 0 });
    const seabed = new Mesh(geometry, material);
    seabed.rotation.x = -Math.PI / 2;
    seabed.receiveShadow = true;
    this.group.add(seabed);
  }

  private buildRockField(): void {
    const material = new MeshStandardMaterial({
      color: 0x7c8a76,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    });

    const placements: Array<{ x: number; z: number; scale: number }> = [
      { x: -20, z: -2, scale: 2.4 },
      { x: 20, z: -3, scale: 3.1 },
      { x: -12, z: -18, scale: 2.0 },
      { x: 8, z: 16, scale: 1.6 },
      { x: 22, z: 14, scale: 2.2 },
      { x: -3, z: -20, scale: 2.8 },
    ];

    for (const p of placements) {
      const rock = new Mesh(new IcosahedronGeometry(p.scale, 0), material);
      rock.position.set(p.x, p.scale * 0.55, p.z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.y = 0.75;
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.group.add(rock);
      this.obstructionMeshes.push(rock);
      this.colliders.push({ center: rock.position.clone(), radius: p.scale * 0.85 });
    }
  }

  private buildCoral(): void {
    const palette = [0xff9e7a, 0xb98cff, 0xffd27a, 0x7ad0c0];
    const dummy = new Object3D();

    for (let cluster = 0; cluster < 5; cluster++) {
      const color = palette[cluster % palette.length] ?? 0xff9e7a;
      const material = new MeshStandardMaterial({
        color: new Color(color),
        roughness: 0.7,
        metalness: 0,
        flatShading: true,
      });
      const branches = new InstancedMesh(new ConeGeometry(0.32, 1.6, 6), material, 7);
      branches.castShadow = true;

      const base = new Vector3(-16 + cluster * 8, 0, 14 - cluster * 6);
      for (let i = 0; i < 7; i++) {
        dummy.position.set(
          base.x + (Math.random() - 0.5) * 2.4,
          0.8 + Math.random() * 0.5,
          base.z + (Math.random() - 0.5) * 2.4,
        );
        dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
        dummy.scale.setScalar(0.7 + Math.random() * 0.8);
        dummy.updateMatrix();
        branches.setMatrixAt(i, dummy.matrix);
      }
      branches.instanceMatrix.needsUpdate = true;
      this.group.add(branches);
    }
  }

  private addHidingSpot(placement: SpotPlacement): void {
    const { position, facing } = placement;
    const forward = new Vector3(Math.sin(facing), 0, Math.cos(facing));
    const back = forward.clone().negate();
    const right = new Vector3(forward.z, 0, -forward.x);

    // Coral mound behind the head (along the body/deeper direction).
    const mound = new Mesh(new DodecahedronGeometry(3.0, 0), this.rockMaterial);
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
    const cave = new Mesh(new CircleGeometry(1.05, 24), new MeshStandardMaterial({ color: 0x04141a }));
    cave.position.copy(position).addScaledVector(back, 0.95).setY(position.y - 0.05);
    cave.rotation.y = facing;
    this.group.add(cave);

    // Flank blocks framing the mouth (a natural cleaner-shrimp perch).
    const flankGeometry = new BoxGeometry(1.1, 1.7, 1.5);
    for (const sign of [-1, 1]) {
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

    this.hidingSpots.push({ speciesId: placement.speciesId, position: position.clone(), facing });
  }

  private buildSeaGrass(): void {
    const material = new MeshStandardMaterial({
      color: 0x4f9d6b,
      roughness: 0.8,
      metalness: 0,
      flatShading: true,
    });
    const count = 220;
    const grass = new InstancedMesh(new ConeGeometry(0.08, 1.1, 4), material, count);
    const dummy = new Object3D();
    const rotation = new Quaternion();
    const matrix = new Matrix4();
    const up = new Vector3(0, 1, 0);

    let placed = 0;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 58;
      const z = (Math.random() - 0.5) * 58;
      // Keep every crevice mouth clear.
      const nearSpot = this.hidingSpots.some((spot) => {
        const dx = x - spot.position.x;
        const dz = z - spot.position.z;
        return dx * dx + dz * dz < 16;
      });
      if (nearSpot) {
        continue;
      }
      dummy.position.set(x, 0.5 + Math.random() * 0.3, z);
      rotation.setFromAxisAngle(up, Math.random() * Math.PI);
      dummy.quaternion.copy(rotation);
      dummy.scale.set(1, 0.7 + Math.random() * 0.9, 1);
      dummy.updateMatrix();
      matrix.copy(dummy.matrix);
      grass.setMatrixAt(placed, matrix);
      placed++;
    }
    // Hide any unused instances beyond `placed`.
    for (let i = placed; i < count; i++) {
      dummy.position.set(0, -100, 0);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.receiveShadow = true;
    this.group.add(grass);
  }
}
