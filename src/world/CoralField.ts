import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { Random } from "../util/Random";
import { seabedHeight } from "./Seabed";

interface ClusterSite {
  readonly x: number;
  readonly z: number;
}

const SITES: readonly ClusterSite[] = [
  { x: -16, z: 14 },
  { x: -8, z: 8 },
  { x: 1.5, z: 2 },
  { x: 9, z: -4 },
  { x: 16, z: -10 },
  { x: -19, z: -6 },
  { x: 18, z: 7 },
  { x: -4, z: 17 },
];

/**
 * Reef-building coral in three silhouettes — branching, boulder and table.
 *
 * A garden of identical cones reads as traffic cones however it is coloured;
 * the variety of silhouette is what makes it read as coral, so shape carries
 * more weight here than the palette does. The palette itself stays muted —
 * saturated candy colours fight the calm the rest of the reef is going for.
 *
 * Every head is flattened into shared instanced meshes. Built as individual
 * meshes this field cost roughly two hundred draw calls, twice over once the
 * shadow pass ran, which dominated the frame on machines without hardware
 * acceleration. Instanced, the whole garden is ten.
 */
const PALETTE = [0xe08f72, 0xc9788d, 0xdfb379, 0x7fbfb2, 0x9d8cc4, 0xd18874];

type ShapeKind = "branch" | "boulder" | "polyp" | "tableTop" | "tableStalk";

interface Part {
  readonly kind: ShapeKind;
  readonly matrix: Matrix4;
  readonly color: Color;
  readonly glowing: boolean;
}

export class CoralField {
  readonly group = new Group();

  constructor(seed: number) {
    const random = new Random(seed);
    const parts: Part[] = [];

    for (const site of SITES) {
      const heads = Math.round(random.range(3, 6));
      for (let i = 0; i < heads; i++) {
        const x = site.x + random.signed(2.8);
        const z = site.z + random.signed(2.8);

        const color = new Color(
          PALETTE[Math.floor(random.next() * PALETTE.length)] ?? PALETTE[0]!,
        ).multiplyScalar(random.range(0.78, 1.1));
        // A minority of heads are bioluminescent. Kept rare on purpose:
        // everything glowing reads as neon, a few glowing reads as magic.
        const glowing = random.next() < 0.28;

        const head = new Object3D();
        head.position.set(x, seabedHeight(x, z), z);
        head.rotation.y = random.range(0, Math.PI * 2);
        head.scale.setScalar(random.range(0.72, 1.35));
        head.updateMatrix();

        const roll = random.next();
        if (roll < 0.45) {
          addBranching(parts, head.matrix, color, glowing, random);
        } else if (roll < 0.78) {
          addBoulder(parts, head.matrix, color, glowing, random);
        } else {
          addTable(parts, head.matrix, color, glowing);
        }
      }
    }

    const geometries: Record<ShapeKind, BufferGeometry> = {
      branch: new ConeGeometry(0.17, 1.5, 6),
      boulder: new IcosahedronGeometry(0.62, 1),
      polyp: new SphereGeometry(0.1, 6, 5),
      tableTop: new CylinderGeometry(1.05, 1.15, 0.16, 9),
      tableStalk: new CylinderGeometry(0.14, 0.2, 0.7, 6),
    };

    for (const kind of Object.keys(geometries) as ShapeKind[]) {
      for (const glowing of [false, true]) {
        const matching = parts.filter((part) => part.kind === kind && part.glowing === glowing);
        if (matching.length === 0) {
          continue;
        }
        this.group.add(buildInstances(geometries[kind], matching, glowing));
      }
    }
  }
}

function buildInstances(
  geometry: BufferGeometry,
  parts: readonly Part[],
  glowing: boolean,
): InstancedMesh {
  const material = new MeshStandardMaterial({ roughness: 0.72, metalness: 0, flatShading: true });

  if (glowing) {
    // Emissive is a material uniform, so on its own every glowing head would
    // share one colour. Multiplying it by the per-instance colour lets each
    // head glow in its own hue while still sharing a single draw call.
    material.emissive = new Color(0xffffff);
    material.emissiveIntensity = 0.4;
    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         totalEmissiveRadiance *= vColor;`,
      );
    };
  }

  const mesh = new InstancedMesh(geometry, material, parts.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  parts.forEach((part, index) => {
    mesh.setMatrixAt(index, part.matrix);
    mesh.setColorAt(index, part.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }

  return mesh;
}

/** Composes a part's local transform into its head's world matrix. */
function push(
  parts: Part[],
  kind: ShapeKind,
  headMatrix: Matrix4,
  local: Object3D,
  color: Color,
  glowing: boolean,
): void {
  local.updateMatrix();
  parts.push({
    kind,
    matrix: new Matrix4().multiplyMatrices(headMatrix, local.matrix),
    color,
    glowing,
  });
}

/** A spray of tapered fingers, the classic staghorn silhouette. */
function addBranching(
  parts: Part[],
  headMatrix: Matrix4,
  color: Color,
  glowing: boolean,
  random: Random,
): void {
  const local = new Object3D();
  const fingers = Math.round(random.range(4, 8));
  for (let i = 0; i < fingers; i++) {
    const lean = random.range(0.1, 0.42);
    const around = (i / fingers) * Math.PI * 2 + random.signed(0.4);
    const height = random.range(0.6, 1.15);
    local.scale.set(random.range(0.7, 1.1), height, random.range(0.7, 1.1));
    local.position.set(Math.cos(around) * 0.28, height * 0.72, Math.sin(around) * 0.28);
    local.rotation.set(Math.sin(around) * lean, 0, -Math.cos(around) * lean);
    push(parts, "branch", headMatrix, local, color, glowing);
  }
}

/** A squat dome, crusted with polyps. */
function addBoulder(
  parts: Part[],
  headMatrix: Matrix4,
  color: Color,
  glowing: boolean,
  random: Random,
): void {
  const local = new Object3D();
  local.scale.set(random.range(0.9, 1.4), random.range(0.55, 0.85), random.range(0.9, 1.4));
  local.position.set(0, 0.28, 0);
  local.rotation.set(0, 0, 0);
  push(parts, "boulder", headMatrix, local, color, glowing);

  const polyps = Math.round(random.range(4, 9));
  for (let i = 0; i < polyps; i++) {
    const around = random.range(0, Math.PI * 2);
    const radius = random.range(0.1, 0.5);
    local.scale.setScalar(1);
    local.position.set(Math.cos(around) * radius, random.range(0.45, 0.68), Math.sin(around) * radius);
    push(parts, "polyp", headMatrix, local, color, glowing);
  }
}

/** A flat plate on a stalk, the shape that casts the best shade to hide under. */
function addTable(parts: Part[], headMatrix: Matrix4, color: Color, glowing: boolean): void {
  const local = new Object3D();
  local.scale.setScalar(1);
  local.rotation.set(0, 0, 0);

  local.position.set(0, 0.35, 0);
  push(parts, "tableStalk", headMatrix, local, color, glowing);

  local.position.set(0, 0.72, 0);
  push(parts, "tableTop", headMatrix, local, color, glowing);
}
