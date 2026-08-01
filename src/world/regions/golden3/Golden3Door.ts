import { Matrix4, Vector3, type BufferGeometry, type Mesh } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { archGeometry, boulderGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import {
  CARVED_PALE,
  STONE_DUSK,
  STONE_DUSK_INTENSITY,
  mergedMesh,
} from "./Golden3Shared";
import { DOOR, GOLDEN3_SLOT, worldOf } from "./Golden3Terrain";

/**
 * THE SUN'S DOOR — the region's centrepiece and the province's last
 * statement: a great natural arch standing on the balcony rise at the
 * far pole, its window squared to the spoke so the whole journey looks
 * THROUGH it at the painted sun going down at the world's edge. Two
 * leaning flank stacks bracket it (the waymark idiom grown to its
 * final size), and a pair of kneeling stones hold the balcony's edges.
 * The swept circle at its foot is THE PILGRIM'S THRESHOLD — a
 * registered rest; the only thing that crosses it is the resident's
 * shadow.
 */

const SEED = SEEDS.regionGolden3;

/** The arch's clear window, for the Pilgrim's path and the poses. */
export const DOOR_SPAN = 14;
export const DOOR_LEG_HEIGHT = 9;
export const DOOR_RISE = 2.4;

export interface DoorBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** World-space centre of the window — where the Pilgrim crosses. */
  readonly window: Vector3;
}

export function buildDoor(): DoorBuild {
  const random = new Random(SEED ^ 0x64a1);
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const parts: BufferGeometry[] = [];

  // The arch: legs lateral to the spoke, window facing the journey.
  const arch = archGeometry({
    seed: SEED ^ 0x64a2,
    span: DOOR_SPAN,
    legHeight: DOOR_LEG_HEIGHT,
    legRadius: 2.0,
    beamRadius: 1.7,
    rise: DOOR_RISE,
  });
  // rotateY(θ) maps local +z (the window's normal) to (sin θ, cos θ):
  // aim it along the spoke so the door faces the arriving diver.
  const yaw = Math.atan2(Math.cos(GOLDEN3_SLOT.azimuth), Math.sin(GOLDEN3_SLOT.azimuth));
  arch.applyMatrix4(new Matrix4().makeRotationY(yaw));
  const at = worldOf(DOOR.u, DOOR.v);
  const atY = seabedHeight(at.x, at.z);
  arch.translate(at.x, atY, at.z);
  parts.push(arch);

  // The legs stand lateral (±v) from the door's centre.
  const legDirWorld = worldOf(0, 1);
  const legDir = new Vector3(legDirWorld.x, 0, legDirWorld.z).normalize();
  for (const side of [-1, 1]) {
    const leg = new Vector3(at.x, 0, at.z).addScaledVector(legDir, side * (DOOR_SPAN / 2));
    contacts.push({ x: leg.x, z: leg.z, radius: 2.6, strength: 0.42 });
    colliders.push({ center: new Vector3(leg.x, atY + 2.0, leg.z), radius: 2.2 });
    colliders.push({ center: new Vector3(leg.x, atY + 5.6, leg.z), radius: 1.8 });
    colliders.push({ center: new Vector3(leg.x, atY + 8.4, leg.z), radius: 1.6 });
  }
  // The lintel: three spheres over the swim-through, window kept open
  // (clearance ≈ 7 m under the beam's crown).
  const crown = new Vector3(at.x, atY + DOOR_LEG_HEIGHT + DOOR_RISE + 0.6, at.z);
  colliders.push({ center: crown, radius: 2.0 });
  colliders.push({ center: crown.clone().addScaledVector(legDir, 2.8), radius: 1.7 });
  colliders.push({ center: crown.clone().addScaledVector(legDir, -2.8), radius: 1.7 });

  const window = new Vector3(at.x, atY + DOOR_LEG_HEIGHT * 0.62, at.z);

  /** Seats a one-off stone and records its footprint. */
  const stand = (
    geometry: BufferGeometry,
    u: number,
    v: number,
    stoneYaw: number,
    radius: number,
    height: number,
  ): void => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(stoneYaw));
    geometry.translate(x, y, z);
    parts.push(geometry);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
  };

  // The flank stacks: the waymark idiom at its final size, bracketing
  // the door a road-width off each shoulder.
  stand(
    stackGeometry(
      [
        { radius: 1.8, rise: 0.8, stretch: 2.6, lean: 0.7 },
        { radius: 1.1, rise: 6.4, stretch: 2.6, lean: 1.5 },
      ],
      { seed: SEED ^ 0x64b1 },
    ),
    DOOR.u - 6,
    DOOR.v - 20,
    1.2,
    1.8,
    9.2,
  );
  stand(
    stackGeometry(
      [
        { radius: 1.5, rise: 0.7, stretch: 2.4, lean: -0.5 },
        { radius: 0.95, rise: 5.2, stretch: 2.5, lean: -1.2 },
      ],
      { seed: SEED ^ 0x64b2 },
    ),
    DOOR.u - 2,
    DOOR.v + 17,
    -0.6,
    1.5,
    7.6,
  );

  // The kneeling pair at the balcony's edges. Round 2: the north stone
  // moved off the close-door-foot lens (it stood 2 m from the camera
  // and filled 70% of the frame — the close-flute-foot lesson).
  stand(
    boulderGeometry({ seed: SEED ^ 0x64b3, radius: 1.3, height: 1.8 }),
    DOOR.u - 13,
    DOOR.v + 15,
    random.range(0, Math.PI * 2),
    1.3,
    1.8,
  );
  stand(
    boulderGeometry({ seed: SEED ^ 0x64b4, radius: 1.0, height: 1.4 }),
    DOOR.u - 14,
    DOOR.v - 10,
    random.range(0, Math.PI * 2),
    1.0,
    1.4,
  );

  const material = createRockMaterial(CARVED_PALE);
  material.emissive.setHex(STONE_DUSK);
  material.emissiveIntensity = STONE_DUSK_INTENSITY;
  const mesh = mergedMesh(parts, material, "vesper-door");

  return { meshes: [mesh], colliders, contacts, window };
}
