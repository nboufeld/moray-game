import {
  BufferAttribute,
  BufferGeometry,
  Color,
  InstancedMesh,
  Object3D,
  Vector3,
} from "three";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import { isClear } from "../../world/CoralField";
import { seabedHeight } from "../../world/Seabed";
import type { LifeContext } from "../life/LifeSystem";
import { FaunaSystem, seabedNormal } from "./FaunaSystem";

/**
 * Where the stars gather. Anchors rather than a field-wide scatter, placed on
 * the skirts of the gardens and the stack feet the canonical cameras look at
 * — still colour spent where the frame is, exactly as the coral spends its
 * density. Each anchor seeds a couple of stars with a little jitter.
 */
const ANCHORS: readonly (readonly [number, number])[] = [
  [3.8, 12.6],
  [8.9, 11.8],
  [6.2, -2.9],
  [14.2, -1.5],
  [-12.1, -2.6],
  [-4.6, 14.6],
  [16.2, -4.4],
  [2.0, -14.5],
  [8.2, 0.6],
];

const COUNT = 13;

/**
 * Gouache accent colours, chroma held down the way the coral families are:
 * a swatch orange ten metres under this water is a plastic toy. Dusty orange,
 * violet and rose, exactly the three the art brief names.
 */
const FAMILIES = [0xcf7a45, 0x8b7ab0, 0xc9707e];

/**
 * The starfish: still colour on the sand and against the rock feet. One
 * instanced mesh of a plump five-armed cushion, tilted to the dune it lies on
 * — the conform is the whole of its "animation", so `update` is a no-op.
 */
export class Starfish extends FaunaSystem {
  constructor(seed: number = SEEDS.starfish) {
    super("starfish", seed);
  }

  protected build(): void {
    const random = new Random(this.seed);
    const material = this.own(createToonMaterial({ vertexColors: true }));
    const mesh = this.ownInstanced(
      new InstancedMesh(this.own(createStarGeometry()), material, COUNT),
    );
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);

    const dummy = new Object3D();
    const color = new Color();
    const up = new Vector3(0, 1, 0);
    const normal = new Vector3();

    for (let i = 0; i < COUNT; i++) {
      const anchor = ANCHORS[i % ANCHORS.length]!;
      let x = anchor[0];
      let z = anchor[1];
      for (let attempt = 0; attempt < 3; attempt++) {
        const jx = anchor[0] + random.signed(0.9);
        const jz = anchor[1] + random.signed(0.9);
        if (isClear(jx, jz)) {
          x = jx;
          z = jz;
          break;
        }
      }

      const radius = random.range(0.09, 0.21);
      // Slightly sunk, and tilted to the dune: a starfish is a decal the
      // moment it hovers, and a conform is the whole trick of draping it.
      dummy.position.set(x, seabedHeight(x, z) - 0.012 * radius * 5, z);
      dummy.quaternion.setFromUnitVectors(up, seabedNormal(x, z, normal));
      dummy.rotateY(random.range(0, Math.PI * 2));
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      color.setHex(FAMILIES[i % FAMILIES.length]!);
      color.multiplyScalar(random.range(0.82, 1.12));
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  update(_dt: number, _ctx: LifeContext): void {
    // Still life. The stars are placed once and never move.
  }
}

const SEGMENTS = 40;
const RINGS = 5;
/** Dome height as a fraction of unit radius. Plump, not a pancake. */
const DOME = 0.3;
/** Arm-tip lift: the gentle curl a real cushion star holds its arms at. */
const CURL = 0.16;
/** Dorsal ridge height along each arm's midline. */
const RIDGE = 0.055;

/**
 * A plump five-armed cushion star, unit radius, foot at y = 0.
 *
 * Radial rings from a centre vertex, with the ring radius shaped by a
 * five-lobed profile — rounded arms out of a fat web, closer to a cushion star
 * than to a brittle star, which is what "storybook" asks for. The wave-8 pass
 * sculpts what the flat pancake only hinted at: the lobe's exponent grows
 * along the arm so each arm *tapers* rather than ending in the web's own
 * width; the tips lift on a cubic, the slight curl a living star carries its
 * arms at; and a seeded, bumpy ridge runs each arm's midline — the dorsal
 * ossicle row, which is the one mark that reads "starfish" at a metre.
 * Vertex colour lightens toward the rim (pale tips, as before) and along the
 * ridge, mild so it does not fight the ramp's own shading. 360 triangles
 * against the brief's 400.
 */
function createStarGeometry(): BufferGeometry {
  // Bump stations along every arm, jittered once per build from the
  // registered polish stream so no arm's ridge is a photocopy of a sine.
  const rng = new Random(SEEDS.starfishGrand);
  const bumps: readonly (readonly [number, number])[] = [0.34, 0.58, 0.82].map(
    (centre, k) => [
      centre + rng.signed(0.04),
      (1 - k * 0.22) * rng.range(0.78, 1.18),
    ],
  );

  const positions: number[] = [0, DOME, 0];
  const colors: number[] = [0.86, 0.86, 0.86];
  const indices: number[] = [];

  for (let ring = 1; ring <= RINGS; ring++) {
    const t = ring / RINGS;
    for (let j = 0; j < SEGMENTS; j++) {
      const theta = (j / SEGMENTS) * Math.PI * 2;
      // The taper: the exponent grows down the arm, so the lobe narrows to a
      // rounded point instead of a constant-width wedge.
      const lobe = Math.pow(0.5 + 0.5 * Math.cos(5 * theta), 1.5 + 1.6 * t);
      const arm = 0.55 + 0.45 * lobe;
      const r = t * arm;
      const dome = DOME * Math.pow(Math.max(0, 1 - t * t), 0.6);
      const curl = CURL * t * t * t * lobe * lobe;
      let ridge = 0;
      const midline = Math.pow(lobe, 7);
      for (const [centre, amp] of bumps) {
        const d = (t - centre) / 0.085;
        ridge += amp * Math.exp(-d * d);
      }
      ridge *= RIDGE * midline;
      const y = dome + curl + ridge;
      positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r);
      const shade = Math.min(1.04, 0.86 + 0.14 * t + (ridge / RIDGE) * 0.1);
      colors.push(shade, shade, shade);
    }
  }

  // Centre fan, then the ring strips.
  for (let j = 0; j < SEGMENTS; j++) {
    indices.push(0, 1 + ((j + 1) % SEGMENTS), 1 + j);
  }
  for (let ring = 0; ring < RINGS - 1; ring++) {
    const a = 1 + ring * SEGMENTS;
    const b = a + SEGMENTS;
    for (let j = 0; j < SEGMENTS; j++) {
      const next = (j + 1) % SEGMENTS;
      indices.push(a + j, a + next, b + j);
      indices.push(a + next, b + next, b + j);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
