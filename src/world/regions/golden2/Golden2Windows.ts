import { Matrix4, Vector3, type BufferGeometry, type Mesh } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { archGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { CARVED_PALE, mergedMesh } from "./Golden2Shared";
import { ARCH_AT, WINDOWS_A, WINDOWS_B, worldOf } from "./Golden2Terrain";

/**
 * THE WINDOWS — the second exclusive: a pierced stone wall riding the
 * ridge between the Hoodoo Court and the Seep Terraces. The terrain
 * carries the rampart; this module stands the wall's broken teeth — a
 * row of flattened fins with sky between them (the windows the wind
 * cut) — and THE GREAT ARCH in the doorway where the ridge dips to
 * court level: the region's one swim-through, framing the seep country
 * from the court and the hoodoo ranks from the seeps.
 */

const SEED = SEEDS.regionGolden2;

export interface WindowsBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Fin feet, in spoke coordinates — the shard aprons fan from these. */
  readonly finFeet: readonly { u: number; v: number }[];
}

export function buildWindows(): WindowsBuild {
  const random = new Random(SEED ^ 0x62a1);
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const parts: BufferGeometry[] = [];
  const finFeet: { u: number; v: number }[] = [];

  const du = WINDOWS_B.u - WINDOWS_A.u;
  const dv = WINDOWS_B.v - WINDOWS_A.v;
  // The ridge's direction in WORLD space (worldOf is linear, so it
  // doubles as the vector transform); rotateY(θ) sends +x to
  // (cos θ, −sin θ), hence the negation.
  const ridgeWorld = worldOf(du, dv);
  const ridgeYaw = -Math.atan2(ridgeWorld.z, ridgeWorld.x);

  // ─── The fins ────────────────────────────────────────────────────────────
  // Seven flattened teeth along the crest, skipping the arch's doorway.
  // Each is a weathered lathe squashed thin across the ridge axis, so
  // the row reads as one broken wall with windows of water between.
  const seats = [0.1, 0.24, 0.38, 0.62, 0.75, 0.87, 0.97] as const;
  for (const [i, t] of seats.entries()) {
    const u = WINDOWS_A.u + du * t + random.signed(1.5);
    const v = WINDOWS_A.v + dv * t + random.signed(1.5);
    if (Math.hypot(u - ARCH_AT.u, v - ARCH_AT.v) < 9) {
      continue;
    }
    const height = random.range(3.6, 6.8);
    const fin = stackGeometry(
      [
        { radius: 2.0, rise: 0.4, stretch: (height * 0.55) / 2.0, lean: random.signed(0.3) },
        { radius: 1.4, rise: height * 0.6, stretch: (height * 0.42) / 1.4, lean: random.signed(0.6) },
      ],
      { seed: SEED ^ (0x62b0 + i) },
    );
    // Flatten across the ridge, then turn onto it.
    fin.applyMatrix4(new Matrix4().makeScale(1, 1, 0.36));
    fin.applyMatrix4(new Matrix4().makeRotationY(ridgeYaw));
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    fin.translate(x, y, z);
    parts.push(fin);
    finFeet.push({ u, v });
    contacts.push({ x, z, radius: 2.4, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: 1.9 });
    colliders.push({ center: new Vector3(x, y + height * 0.8, z), radius: 1.3 });
  }

  // ─── THE GREAT ARCH ──────────────────────────────────────────────────────
  // Standing in the ridge's doorway, legs on the dip's shoulders, the
  // beam framing whichever country the diver has not seen yet.
  const arch = archGeometry({
    seed: SEED ^ 0x62a3,
    span: 9.5,
    legHeight: 5.8,
    legRadius: 1.5,
    beamRadius: 1.35,
    rise: 1.6,
  });
  arch.applyMatrix4(new Matrix4().makeRotationY(ridgeYaw));
  const archAt = worldOf(ARCH_AT.u, ARCH_AT.v);
  const archY = seabedHeight(archAt.x, archAt.z);
  arch.translate(archAt.x, archY, archAt.z);
  parts.push(arch);

  // The legs stand along the ridge axis, ±span/2 from the centre.
  const ridgeLen = Math.hypot(ridgeWorld.x, ridgeWorld.z);
  const legDir = new Vector3(ridgeWorld.x / ridgeLen, 0, ridgeWorld.z / ridgeLen);
  {
    const a = worldOf(ARCH_AT.u + 4.75 * (du / Math.hypot(du, dv)), ARCH_AT.v + 4.75 * (dv / Math.hypot(du, dv)));
    const b = worldOf(ARCH_AT.u - 4.75 * (du / Math.hypot(du, dv)), ARCH_AT.v - 4.75 * (dv / Math.hypot(du, dv)));
    for (const leg of [a, b]) {
      contacts.push({ x: leg.x, z: leg.z, radius: 2.0, strength: 0.42 });
      colliders.push({ center: new Vector3(leg.x, archY + 1.6, leg.z), radius: 1.7 });
      colliders.push({ center: new Vector3(leg.x, archY + 4.2, leg.z), radius: 1.4 });
    }
    // The beam: three spheres over the swim-through, leaving the
    // doorway itself open (clearance ≈ 4.5 m under the beam's crown).
    const mid = new Vector3((a.x + b.x) / 2, archY + 7.2, (a.z + b.z) / 2);
    colliders.push({ center: mid, radius: 1.6 });
    colliders.push({ center: mid.clone().addScaledVector(legDir, 1.9), radius: 1.5 });
    colliders.push({ center: mid.clone().addScaledVector(legDir, -1.9), radius: 1.5 });
  }

  const mesh = mergedMesh(parts, createRockMaterial(CARVED_PALE), "carillon-windows");
  return { meshes: [mesh], colliders, contacts, finFeet };
}
