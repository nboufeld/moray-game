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

/**
 * A hand-placed greybox of the Sunlit Coral Garden: seabed, rounded rocks,
 * a few coral clusters, instanced sea grass and one hero crevice that hides
 * the first moray. Deliberately low-poly and readable.
 */
export class Reef {
  readonly group = new Group();
  readonly colliders: SphereCollider[] = [];
  readonly obstructionMeshes: Mesh[] = [];
  readonly bounds: ReefBounds = {
    minX: -28,
    maxX: 28,
    minY: 0.6,
    maxY: 11,
    minZ: -28,
    maxZ: 26,
  };

  /** World position where the hidden moray's head peeks from the crevice. */
  readonly crevicePosition = new Vector3(0, 1.15, -1.6);

  constructor() {
    this.buildSeabed();
    this.buildRockField();
    this.buildCoral();
    this.buildCrevice();
    this.buildSeaGrass();
  }

  private buildSeabed(): void {
    const geometry = new PlaneGeometry(70, 70, 1, 1);
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
      { x: -8, z: 2, scale: 2.4 },
      { x: 9, z: -4, scale: 3.1 },
      { x: -12, z: -10, scale: 2.0 },
      { x: 6, z: 8, scale: 1.6 },
      { x: 14, z: 4, scale: 2.2 },
      { x: -4, z: -14, scale: 2.8 },
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

    for (let cluster = 0; cluster < 4; cluster++) {
      const color = palette[cluster % palette.length] ?? 0xff9e7a;
      const material = new MeshStandardMaterial({
        color: new Color(color),
        roughness: 0.7,
        metalness: 0,
        flatShading: true,
      });
      const branches = new InstancedMesh(new ConeGeometry(0.32, 1.6, 6), material, 7);
      branches.castShadow = true;

      const base = new Vector3(-14 + cluster * 9, 0, 10 - cluster * 7);
      for (let i = 0; i < 7; i++) {
        dummy.position.set(
          base.x + (Math.random() - 0.5) * 2.2,
          0.8 + Math.random() * 0.5,
          base.z + (Math.random() - 0.5) * 2.2,
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

  private buildCrevice(): void {
    const rockMaterial = new MeshStandardMaterial({
      color: 0x6a7a6c,
      roughness: 0.95,
      metalness: 0,
      flatShading: true,
    });

    // A broad coral shelf the moray hides beneath.
    const shelf = new Mesh(new DodecahedronGeometry(3.2, 0), rockMaterial);
    shelf.position.set(0, 1.9, -3.4);
    shelf.scale.set(1.3, 0.7, 1.1);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    this.group.add(shelf);
    this.obstructionMeshes.push(shelf);
    this.colliders.push({ center: new Vector3(0, 1.4, -3.9), radius: 2.6 });

    // A dark opening so the eye is drawn to the crevice mouth.
    const cave = new Mesh(new CircleGeometry(0.95, 24), new MeshStandardMaterial({ color: 0x04141a }));
    cave.position.set(0, 1.2, -2.35);
    this.group.add(cave);

    // Side blocks framing the crevice mouth (also gives cleaner-shrimp perch feel).
    const flankGeometry = new BoxGeometry(1.1, 1.6, 1.4);
    for (const sign of [-1, 1]) {
      const flank = new Mesh(flankGeometry, rockMaterial);
      flank.position.set(sign * 1.7, 1.0, -2.6);
      flank.castShadow = true;
      flank.receiveShadow = true;
      this.group.add(flank);
    }
  }

  private buildSeaGrass(): void {
    const material = new MeshStandardMaterial({
      color: 0x4f9d6b,
      roughness: 0.8,
      metalness: 0,
      flatShading: true,
    });
    const count = 160;
    const grass = new InstancedMesh(new ConeGeometry(0.08, 1.1, 4), material, count);
    const dummy = new Object3D();
    const rotation = new Quaternion();
    const matrix = new Matrix4();

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 52;
      const z = (Math.random() - 0.5) * 52;
      if (Math.abs(x) < 3 && Math.abs(z + 3) < 4) {
        // Keep the crevice mouth clear.
        continue;
      }
      dummy.position.set(x, 0.5 + Math.random() * 0.3, z);
      rotation.setFromAxisAngle(new Vector3(0, 1, 0), Math.random() * Math.PI);
      dummy.quaternion.copy(rotation);
      dummy.scale.set(1, 0.7 + Math.random() * 0.9, 1);
      dummy.updateMatrix();
      matrix.copy(dummy.matrix);
      grass.setMatrixAt(i, matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.receiveShadow = true;
    this.group.add(grass);
  }
}
