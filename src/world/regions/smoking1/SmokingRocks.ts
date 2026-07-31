import { Matrix4, Mesh, Vector3, type BufferGeometry } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { mergedMesh } from "./SmokingShared";
import { FILL_SEEDS, MID_SHORE, inCalderaNorthQuadrant, inFlatsRest } from "./SmokingFillShared";
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

  // ─── Phase 3 fill stones (fresh substream, appended — the fence) ─────────
  // ~32 more stones for the reveal cadence: gorge boulders 7 → 18, flats
  // cobble pairs, the fork cairn, six shore leaners and eight more caldera
  // rim crags — merged into two draws (one per stone family) instead of
  // one mesh per stone, colliders per stone as before.
  const fill = new Random(SEED ^ FILL_SEEDS.fillRocks);
  const charcoalParts: BufferGeometry[] = [];
  const paleParts: BufferGeometry[] = [];

  const standMerged = (
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    pale: boolean,
  ): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    (pale ? paleParts : charcoalParts).push(geometry);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
  };

  // Eleven more gorge boulders, filling the gaps between the pilot's seven
  // so a wall foot breaches the fog every ~15 m of the approach.
  for (const [i, u] of [70, 98, 112, 126, 140, 152, 168, 182, 210, 224, 238].entries()) {
    const uu = u + fill.signed(3);
    const side = i % 2 === 0 ? 1 : -1;
    const lateral = gorgeChannelCenter(uu) + side * fill.range(4.6, 7);
    const radius = fill.range(0.8, 1.7);
    const height = radius * fill.range(0.85, 1.25);
    standMerged(
      boulderGeometry({ seed: SEED ^ (0x5fa1 + i), radius, height }),
      uu,
      lateral,
      fill.range(0, Math.PI * 2),
      radius,
      height,
      i % 4 === 0,
    );
  }

  // Flats cobble pairs: three two-stone stations off the road, outside
  // the Ash Meadows rest bar.
  for (const [i, [u, v]] of ([
    [296, 10],
    [314, 34],
    [346, -32],
  ] as const).entries()) {
    for (const [k, spread] of [0, 2.4].entries()) {
      const radius = fill.range(0.6, 1.3) * (k === 0 ? 1 : 0.7);
      const uu = u + spread * (k === 0 ? 0 : 1) + fill.signed(0.8);
      const vv = v + (k === 0 ? 0 : fill.range(1.2, 2.6));
      if (inFlatsRest(uu, vv)) {
        continue;
      }
      standMerged(
        boulderGeometry({ seed: SEED ^ (0x5fb1 + i * 2 + k), radius, height: radius }),
        uu,
        vv,
        fill.range(0, Math.PI * 2),
        radius,
        radius,
        i === 1,
      );
    }
  }

  // The fork cairn: a small pale stack marking the loop split — held off
  // the rest bar's east edge (deviation from the plan's u 360, logged:
  // the registry's flats rest ends at u 360, and the registry wins).
  standMerged(
    stackGeometry(
      [
        { radius: 0.9, rise: 0.4, stretch: 1.5, lean: 0.2 },
        { radius: 0.6, rise: 1.6, stretch: 1.4, lean: -0.4 },
      ],
      { seed: SEED ^ 0x5fc1 },
    ),
    363,
    24,
    fill.range(0, Math.PI * 2),
    0.9,
    2.6,
    true,
  );

  // Six shore leaners: the stacks' outriders, clear of the mid-shore rest.
  for (let i = 0; i < 6; i++) {
    const u = 562 + i * 14 + fill.signed(4);
    const v = (i % 2 === 0 ? 1 : -1) * fill.range(18, 38);
    if (Math.hypot(u - MID_SHORE.u, v - MID_SHORE.v) < 10) {
      continue;
    }
    const radius = fill.range(0.9, 1.6);
    const slab = fill.next() < 0.4;
    const height = slab ? radius * fill.range(0.6, 0.8) : radius * fill.range(1.2, 1.8);
    standMerged(
      slab
        ? slabGeometry({ seed: SEED ^ (0x5fd1 + i), radius, height })
        : boulderGeometry({ seed: SEED ^ (0x5fd1 + i), radius, height }),
      u,
      v,
      fill.range(0, Math.PI * 2),
      radius,
      height,
      i % 3 === 0,
    );
  }

  // Eight more rim crags, so the caldera's lip reads broken all the way
  // round (the rim stands outside the north floor quadrant's rest ring).
  for (let i = 0; i < 8; i++) {
    const theta = ((i + 0.5) / 8) * Math.PI * 2 + fill.signed(0.18);
    const d = 52 + fill.signed(3);
    const u = CALDERA.u + Math.cos(theta) * d;
    const v = CALDERA.v + Math.sin(theta) * d;
    if (inCalderaNorthQuadrant(u, v)) {
      continue;
    }
    const radius = fill.range(1.0, 2.0);
    const slab = fill.next() < 0.5;
    const height = slab ? radius * fill.range(0.6, 0.8) : radius * fill.range(1.0, 1.4);
    standMerged(
      slab
        ? slabGeometry({ seed: SEED ^ (0x5fe1 + i), radius, height })
        : boulderGeometry({ seed: SEED ^ (0x5fe1 + i), radius, height }),
      u,
      v,
      fill.range(0, Math.PI * 2),
      radius,
      height,
      i % 3 === 1,
    );
  }

  if (charcoalParts.length > 0) {
    meshes.push(mergedMesh(charcoalParts, charcoalStone, "smoulder-fill-rocks-charcoal"));
  }
  if (paleParts.length > 0) {
    meshes.push(mergedMesh(paleParts, paleStone, "smoulder-fill-rocks-pale"));
  }

  return { meshes, colliders, contacts };
}
