import { Matrix4, Mesh, Vector3, type BufferGeometry } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import {
  CALDERA,
  GORGE_LIP_U,
  gorgeChannelCenter,
  worldOf,
} from "./SmokingTerrain";

/**
 * The Smoulder Fields' stone: the Warm Gate's jambs where the Vent
 * Springs' end wall opens, the gorge's fog-rhythm boulders, the lip's
 * overlook slab, the ash flats' erratic, the caldera's rim crags, and
 * the Ember Shore's leaning stacks framing the painted distance.
 *
 * Every stone is a `RockShapes` lathe wearing `createRockMaterial` in
 * this region's two families — charcoal-violet and warm pale — so the
 * wash carries the hue and the silhouette carries the drawing.
 */

const SEED = SEEDS.regionSmoking1;

export interface SmokingRocksBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
}

export function buildSmokingRocks(): SmokingRocksBuild {
  const random = new Random(SEED ^ 0x50c9);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  const charcoalStone = createRockMaterial(0x6a5f68);
  const paleStone = createRockMaterial(0x8d8072);

  const stand = (
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    material = charcoalStone,
  ): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.name = "smoulder-rock";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
  };

  // ─── The Warm Gate ───────────────────────────────────────────────────────
  // Two jamb stacks where the Vent Springs' end wall opens.
  stand(
    stackGeometry(
      [
        { radius: 1.5, rise: 0.6, stretch: 1.9, lean: 0.4 },
        { radius: 1.1, rise: 3.4, stretch: 1.7, lean: 0.9 },
      ],
      { seed: SEED ^ 0x0a11 },
    ),
    55,
    -7.4,
    0.6,
    1.5,
    5.2,
    paleStone,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.3, rise: 0.5, stretch: 1.8, lean: -0.3 },
        { radius: 0.9, rise: 2.9, stretch: 1.6, lean: -0.8 },
      ],
      { seed: SEED ^ 0x0a12 },
    ),
    57,
    7.8,
    2.8,
    1.3,
    4.4,
    paleStone,
  );

  // ─── The gorge's wall boulders ───────────────────────────────────────────
  // Seven on alternating wall feet down the channel — with the flame
  // fronds and the First Breath they are what breaches the fog every
  // thirty metres of the approach.
  for (let i = 0; i < 7; i++) {
    const u = 84 + i * 28 + random.signed(6);
    const side = i % 2 === 0 ? -1 : 1;
    const lateral = gorgeChannelCenter(u) + side * random.range(4.6, 7);
    const radius = random.range(1.1, 2.2);
    const height = radius * random.range(0.9, 1.3);
    stand(
      boulderGeometry({ seed: SEED ^ (0x0aa1 + i), radius, height }),
      u,
      lateral,
      random.range(0, Math.PI * 2),
      radius,
      height,
      i % 3 === 0 ? paleStone : charcoalStone,
    );
  }

  // ─── The Overlook slab ───────────────────────────────────────────────────
  stand(
    slabGeometry({ seed: SEED ^ 0x0a13, radius: 2.6, height: 1.5 }),
    GORGE_LIP_U - 4,
    gorgeChannelCenter(GORGE_LIP_U - 4) - 7.5,
    random.range(0, Math.PI * 2),
    2.6,
    1.5,
    paleStone,
  );

  // ─── The ash flats' erratic ──────────────────────────────────────────────
  // One great charcoal boulder alone on the flats, the quiet's scale-giver.
  stand(
    boulderGeometry({ seed: SEED ^ 0x0a14, radius: 3.0, height: 3.9 }),
    322,
    16,
    random.range(0, Math.PI * 2),
    3.0,
    3.9,
    charcoalStone,
  );
  stand(
    boulderGeometry({ seed: SEED ^ 0x0a15, radius: 1.2, height: 1.5 }),
    327,
    11,
    random.range(0, Math.PI * 2),
    1.2,
    1.5,
    charcoalStone,
  );

  // ─── The caldera's rim crags ─────────────────────────────────────────────
  // Eight broken slabs around the bowl's lip, so the rim reads as a rim
  // from the flats and frames the haze from inside.
  for (let i = 0; i < 8; i++) {
    const theta = (i / 8) * Math.PI * 2 + random.signed(0.2);
    const d = 52 + random.signed(3);
    const u = CALDERA.u + Math.cos(theta) * d;
    const v = CALDERA.v + Math.sin(theta) * d;
    const slab = random.next() < 0.5;
    const radius = random.range(1.4, 2.4);
    const height = slab ? radius * random.range(0.6, 0.8) : radius * random.range(1.1, 1.5);
    stand(
      slab
        ? slabGeometry({ seed: SEED ^ (0x0b01 + i), radius, height })
        : boulderGeometry({ seed: SEED ^ (0x0b01 + i), radius, height }),
      u,
      v,
      random.range(0, Math.PI * 2),
      radius,
      height,
      i % 3 === 0 ? paleStone : charcoalStone,
    );
  }

  // ─── The Ember Shore pair ────────────────────────────────────────────────
  // Two leaning stacks framing the far shelf's view into the painted
  // distance — the last handmade thing before the silhouettes.
  stand(
    stackGeometry(
      [
        { radius: 1.6, rise: 0.8, stretch: 2.0, lean: 0.7 },
        { radius: 1.0, rise: 4.2, stretch: 1.8, lean: 1.5 },
      ],
      { seed: SEED ^ 0x0e11 },
    ),
    598,
    22,
    1.4,
    1.6,
    6.2,
    charcoalStone,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.4, rise: 0.7, stretch: 1.9, lean: -0.5 },
        { radius: 0.9, rise: 3.6, stretch: 1.7, lean: -1.2 },
      ],
      { seed: SEED ^ 0x0e12 },
    ),
    594,
    7,
    4.5,
    1.4,
    5.4,
    paleStone,
  );

  return { meshes, colliders, contacts };
}
