import { BufferAttribute, Matrix4, Mesh, Vector3, type BufferGeometry } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { MONOLITH_STONE } from "./GoldenShared";
import { SADDLE_LIP_U, saddleChannelCenter, worldOf } from "./GoldenTerrain";

/**
 * The Hourglass Sea's stone: the Honey Gate's jambs where the Sandfall
 * Dunes' end wall opens, the saddle's fog-rhythm boulders, the lip's
 * overlook slab, the Singing Monoliths standing alone on the ripple
 * flats with their long painted shadows, and the Gilded Shore's leaning
 * stacks framing the painted distance.
 *
 * Every stone is a `RockShapes` lathe wearing `createRockMaterial` in
 * this region's two families — warm pale sandstone and violet-warm
 * monolith stone — so the wash carries the hue and the silhouette
 * carries the drawing.
 */

const SEED = SEEDS.regionGolden1;

/**
 * The Singing Monoliths, in spoke coordinates — exported so the ground
 * painter can bake each one's long violet shadow, and the poses can
 * frame them. `shadow` is the painted shadow's length in metres, thrown
 * along the region's one low-sun direction (see GoldenGround).
 */
export const MONOLITHS: readonly { u: number; v: number; height: number; shadow: number }[] = [
  { u: 505, v: 66, height: 9.5, shadow: 30 },
  { u: 524, v: 92, height: 7.5, shadow: 24 },
  { u: 545, v: 74, height: 11, shadow: 34 },
  { u: 562, v: 104, height: 6.5, shadow: 21 },
  { u: 534, v: 120, height: 8.5, shadow: 27 },
] as const;

export interface GoldenRocksBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

export function buildGoldenRocks(): GoldenRocksBuild {
  const random = new Random(SEED ^ 0x50cb);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  // Warmed HARD in round 5 (with MONOLITH_STONE): both families
  // rendered near-identical plum under the lavender wash + this
  // region's quarter-sun in round 4, and the first correction
  // (0xb09a74) did not survive the violet ambient — the red/blue
  // ratio is the lever, not the value.
  const paleStone = createRockMaterial(0xc2a066);
  const monolithStone = createRockMaterial(MONOLITH_STONE);

  const stand = (
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    material = paleStone,
  ): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.name = "hourglass-rock";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
  };

  // ─── The Honey Gate ──────────────────────────────────────────────────────
  // Two pale jamb stacks where the Sandfall Dunes' end wall opens.
  stand(
    stackGeometry(
      [
        { radius: 1.4, rise: 0.6, stretch: 1.9, lean: 0.4 },
        { radius: 1.0, rise: 3.2, stretch: 1.7, lean: 0.9 },
      ],
      { seed: SEED ^ 0x0a21 },
    ),
    55,
    -7.4,
    0.6,
    1.4,
    5.0,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.2, rise: 0.5, stretch: 1.8, lean: -0.3 },
        { radius: 0.9, rise: 2.8, stretch: 1.6, lean: -0.8 },
      ],
      { seed: SEED ^ 0x0a22 },
    ),
    57,
    7.8,
    2.8,
    1.2,
    4.2,
  );

  // ─── The saddle's wall boulders ──────────────────────────────────────────
  // Nine water-worn stones on alternating dune shoulders down the
  // channel (six until round 4 — the descent frame read near-empty) —
  // with the crescent dunelings and the vale falls they are what
  // breaches the fog every twenty metres of the approach.
  for (let i = 0; i < 9; i++) {
    const u = 84 + i * 21 + random.signed(5);
    const side = i % 2 === 0 ? -1 : 1;
    const lateral = saddleChannelCenter(u) + side * random.range(4.8, 7.2);
    const radius = random.range(1.0, 2.0);
    const height = radius * random.range(0.8, 1.2);
    stand(
      boulderGeometry({ seed: SEED ^ (0x0ab1 + i), radius, height }),
      u,
      lateral,
      random.range(0, Math.PI * 2),
      radius,
      height,
    );
  }

  // ─── The Overlook slab ───────────────────────────────────────────────────
  stand(
    slabGeometry({ seed: SEED ^ 0x0a23, radius: 2.5, height: 1.4 }),
    SADDLE_LIP_U - 4,
    saddleChannelCenter(SADDLE_LIP_U - 4) - 7.5,
    random.range(0, Math.PI * 2),
    2.5,
    1.4,
  );

  // ─── The Singing Monoliths ───────────────────────────────────────────────
  // Lone standing stones on the ripple flats — the emptiness's witnesses.
  // Tall single-segment stacks with a slight lean, violet-warm stone; the
  // ground bakes each one's long violet shadow.
  const monolithFrom = meshes.length;
  for (const [i, m] of MONOLITHS.entries()) {
    stand(
      stackGeometry(
        [
          { radius: 1.35, rise: 0.5, stretch: (m.height * 0.62) / 1.35, lean: random.signed(0.5) },
          {
            radius: 0.85,
            rise: m.height * 0.58,
            stretch: (m.height * 0.5) / 0.85,
            lean: random.signed(0.9),
          },
        ],
        { seed: SEED ^ (0x0ac1 + i) },
      ),
      m.u,
      m.v,
      random.range(0, Math.PI * 2),
      1.5,
      m.height,
      monolithStone,
    );
  }

  // Phase 3 fill (plan §4): each monolith wears a warm rim-band on its
  // sun side, so stone and painted shadow read as ONE lighting statement
  // at capture distance — the shadow says where the light comes from and
  // the stone now agrees. Painted against the ground's own low-sun
  // direction (the shadows run along spoke (−0.6, 0.8), so the sun
  // stands opposite at (0.6, −0.8)). Vertex paint on already-built
  // geometry: zero stream draws, the reroll fence untouched.
  {
    const sun = worldOf(0.6, -0.8);
    const sunLength = Math.hypot(sun.x, sun.z);
    const sunX = sun.x / sunLength;
    const sunZ = sun.z / sunLength;
    for (const mesh of meshes.slice(monolithFrom)) {
      const geometry = mesh.geometry;
      const position = geometry.attributes.position!;
      const normal = geometry.attributes.normal!;
      const colors = geometry.attributes.color as BufferAttribute | undefined;
      if (!colors) {
        continue;
      }
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < position.count; i++) {
        const y = position.getY(i);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const span = Math.max(1e-3, maxY - minY);
      for (let i = 0; i < position.count; i++) {
        const facing = normal.getX(i) * sunX + normal.getZ(i) * sunZ;
        if (facing <= 0.2) {
          continue;
        }
        const rise = (position.getY(i) - minY) / span;
        const band =
          Math.min(1, (facing - 0.2) / 0.5) * Math.min(1, Math.max(0, (rise - 0.15) / 0.4));
        colors.setXYZ(
          i,
          colors.getX(i) * (1 + 0.16 * band),
          colors.getY(i) * (1 + 0.07 * band),
          colors.getZ(i) * (1 - 0.14 * band),
        );
      }
      colors.needsUpdate = true;
    }
  }

  // ─── The Gilded Shore pair ───────────────────────────────────────────────
  // Two leaning stacks framing the far shelf's view into the painted
  // distance — the last handmade thing before the silhouettes.
  stand(
    stackGeometry(
      [
        { radius: 1.6, rise: 0.8, stretch: 2.0, lean: 0.7 },
        { radius: 1.0, rise: 4.2, stretch: 1.8, lean: 1.5 },
      ],
      { seed: SEED ^ 0x0e21 },
    ),
    598,
    38,
    1.4,
    1.6,
    6.2,
    monolithStone,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.4, rise: 0.7, stretch: 1.9, lean: -0.5 },
        { radius: 0.9, rise: 3.6, stretch: 1.7, lean: -1.2 },
      ],
      { seed: SEED ^ 0x0e22 },
    ),
    594,
    22,
    4.5,
    1.4,
    5.4,
  );

  return { meshes, colliders, contacts };
}
