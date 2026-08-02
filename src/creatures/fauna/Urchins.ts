import {
  Color,
  CylinderGeometry,
  InstancedMesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import { isClear } from "../../world/CoralField";
import { seabedHeight } from "../../world/Seabed";
import type { LifeContext } from "../life/LifeSystem";
import { FaunaSystem, paintVertices } from "./FaunaSystem";

/**
 * Where the urchins tuck in: against the stack feet and under the bommies'
 * skirts, which is the shaded ground the animal actually keeps to. Every
 * anchor passes `CoralField.isClear` — the full clearance contract, including
 * the approach corridors, which matters most for the darkest thing this
 * package plants: an urchin *in* a lane would be invisible in exactly the way
 * that costs a sightline check nothing and the player everything.
 */
const ANCHORS: readonly { at: readonly [number, number]; count: number }[] = [
  { at: [-10.9, -0.5], count: 2 },
  { at: [15.6, -3.0], count: 2 },
  { at: [7.2, -5.6], count: 2 },
  { at: [-14.6, -3.9], count: 1 },
  { at: [5.6, 12.4], count: 1 },
];

/**
 * Deep violet-plum shells, not black: the darkest thing in this world is a
 * colour (the crevice mouths set that rule), and each of these keeps red
 * above green the way the shadow tint does, so the pincushion reads as the
 * reef's own darkness rather than a hole in it.
 */
const SHELLS = [0x3a2f55, 0x2f2a4a, 0x453156];

/**
 * The urchins: dark rounded pincushions near the rock bases. One instanced
 * mesh of a shared body-and-spines geometry; still decor, so `update` is a
 * no-op and the matrices are written once.
 */
export class Urchins extends FaunaSystem {
  constructor(seed: number = SEEDS.urchins) {
    super("urchins", seed);
  }

  protected build(): void {
    const random = new Random(this.seed);
    const material = this.own(createToonMaterial({ vertexColors: true }));
    const total = ANCHORS.reduce((sum, anchor) => sum + anchor.count, 0);
    const mesh = this.ownInstanced(
      // The geometry's shag draws from the registered polish stream, not the
      // placement stream: re-shagging the spines must never move an urchin.
      new InstancedMesh(this.own(createUrchinGeometry(SEEDS.urchinsGrand)), material, total),
    );
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.group.add(mesh);

    const dummy = new Object3D();
    const color = new Color();
    let placed = 0;

    for (const anchor of ANCHORS) {
      for (let i = 0; i < anchor.count; i++) {
        let x = anchor.at[0];
        let z = anchor.at[1];
        for (let attempt = 0; attempt < 3; attempt++) {
          const jx = anchor.at[0] + random.signed(0.55);
          const jz = anchor.at[1] + random.signed(0.55);
          if (isClear(jx, jz)) {
            x = jx;
            z = jz;
            break;
          }
        }

        const scale = random.range(0.75, 1.35);
        // Slightly sunk: an urchin wedges itself in, it does not perch.
        dummy.position.set(x, seabedHeight(x, z) - 0.015 * scale, z);
        dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(placed, dummy.matrix);

        color.setHex(SHELLS[placed % SHELLS.length]!);
        color.multiplyScalar(random.range(0.85, 1.1));
        mesh.setColorAt(placed, color);
        placed++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  update(_dt: number, _ctx: LifeContext): void {
    // Still decor: an urchin's whole performance is sitting there darkly.
  }
}

const SPINES = 40;

/** The spine gradient: roots sink into the shell's darkness, and the tips
 * carry the warm-violet glint the reef's shadow tint sets up — the animal's
 * own two values, so the pincushion reads as depth rather than sticks. */
const ROOT_SHADE: readonly [number, number, number] = [0.5, 0.46, 0.58];
const TIP_SHADE: readonly [number, number, number] = [1.08, 0.92, 1.16];

/**
 * A pincushion: a squashed body sphere with forty tapering spines fanned on a
 * golden spiral over the upper three quarters — the underside points at sand
 * nothing ever sees. Spine lengths vary from a seeded stream so the silhouette
 * is shaggy rather than machined (twenty spines read as a hedgehog's
 * haircut; forty is the animal); all parts are indexed grids, so the merge
 * holds. The wave-8 pass doubles the spine field and warms the tips — against
 * the plum instance tints the pale violet points are what separate an urchin
 * from a dark pom-pom at two metres.
 */
function createUrchinGeometry(seed: number): BufferGeometry {
  const rng = new Random((seed ^ 0x5f0a_11e5) >>> 0);
  const parts: BufferGeometry[] = [];

  const body = new SphereGeometry(0.06, 8, 6);
  body.scale(1, 0.82, 1);
  body.translate(0, 0.05, 0);
  parts.push(paintVertices(body, 1, 1, 1));

  const up = new Vector3(0, 1, 0);
  const swing = new Quaternion();
  const direction = new Vector3();
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < SPINES; i++) {
    // Golden spiral over y in [-0.35, 1): everything below stays bare.
    const y = 1 - (i / SPINES) * 1.35;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = i * golden;
    direction.set(Math.cos(angle) * ring, y, Math.sin(angle) * ring).normalize();

    const length = rng.range(0.045, 0.105);
    // Three-sided: a spike a few millimetres wide has no silhouette to lose.
    const spine = new CylinderGeometry(0.0012, 0.0055, length, 3, 1, true);
    paintVertices(spine, 1, 1, 1);
    shadeSpine(spine, length);
    swing.setFromUnitVectors(up, direction);
    spine.applyQuaternion(swing);
    // Rooted just inside the shell so no seam shows at the base.
    spine.translate(
      direction.x * (0.052 + length / 2),
      0.05 + direction.y * (0.045 + length / 2),
      direction.z * (0.052 + length / 2),
    );
    parts.push(spine);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) {
    part.dispose();
  }
  if (!merged) {
    return paintVertices(new SphereGeometry(0.06, 8, 6), 1, 1, 1);
  }
  merged.computeBoundingSphere();
  return merged;
}

/** Paints a spine root-to-tip: dark at the shell, warm-violet at the point. */
function shadeSpine(spine: BufferGeometry, length: number): void {
  const position = spine.attributes.position;
  const color = spine.attributes.color;
  if (!position || !color) {
    return;
  }
  for (let i = 0; i < position.count; i++) {
    // Cylinder is centred on its axis: -length/2 is the wide root. Clamped:
    // a float hair below zero is NaN the moment it meets the exponent.
    const t = Math.pow(Math.min(1, Math.max(0, (position.getY(i) + length / 2) / length)), 1.3);
    color.setXYZ(
      i,
      ROOT_SHADE[0] + (TIP_SHADE[0] - ROOT_SHADE[0]) * t,
      ROOT_SHADE[1] + (TIP_SHADE[1] - ROOT_SHADE[1]) * t,
      ROOT_SHADE[2] + (TIP_SHADE[2] - ROOT_SHADE[2]) * t,
    );
  }
}
