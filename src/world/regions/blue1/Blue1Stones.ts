import { Color, Matrix4, Mesh, Vector3, type BufferGeometry } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { STONE_BLUE, STONE_PALE } from "./Blue1Shared";
import { DROP_LIP_S, TERRACE_STEPS, worldOf } from "./Blue1Terrain";

/**
 * THE DROP PLAINS' stone: the Reef Gate at the slope's mouth, the waymark
 * stones down the glide, the Standing Stones themselves — lone blue
 * monoliths, each one a destination in the fog — the terrace lips' broken
 * slabs, and the Prow: the jutting overlook slab at the World's Edge.
 *
 * Every stone is a `RockShapes` lathe (the drawn-profile contract)
 * finished by `weatherRock`, wearing `createRockMaterial` in the region's
 * two blue-grey families so the wash carries the hue and the algae bake
 * carries the vertex paint. Everything solid returns sphere colliders;
 * everything standing returns a contact patch so the ground bake seats it.
 *
 * ## The megalith field's spacing argument
 *
 * The stones stand 40–70 m apart — a little under the fog's reach — so
 * from any one of them the next is a silhouette just breaching the haze:
 * the "reveal every 30–60 m" rhythm authored as geography. The Wayline's
 * three stones run straight at the Prow, so following the most obvious
 * line in the region *is* the tour's last act.
 */

const SEED = SEEDS.regionBlue1;

export interface Blue1StonesBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** Where every standing stone actually stands — the fill's collar
   *  anchors (Phase 3). Recording them spends no randomness, so the
   *  stones' own streams stay byte-identical. */
  readonly sites: readonly Blue1StoneSite[];
  /** The Fallen King's foot, where the secret ring lives. */
  readonly secret: { x: number; z: number; y: number };
  /** The Prow's tip, for the Ferryman's anchor and the overlook pose. */
  readonly prow: { x: number; z: number; y: number };
}

export interface Blue1StoneSite {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly kind: "gate" | "waymark" | "megalith" | "stump" | "lip" | "prow";
}

/** The standing stones: (u, v, height, girth, lean, pale?). */
const MEGALITHS: readonly {
  readonly u: number;
  readonly v: number;
  readonly height: number;
  readonly girth: number;
  readonly lean: number;
  readonly pale?: boolean;
}[] = [
  // The Gnomon — the tallest stone in the province, the steppe's pivot.
  { u: 415, v: 58, height: 13.2, girth: 1.9, lean: 0.5, pale: true },
  // The Sisters — two stones leaning together, a near-arch.
  { u: 468, v: -52, height: 9.6, girth: 1.5, lean: 1.3 },
  { u: 472, v: -57.5, height: 8.4, girth: 1.4, lean: -1.5 },
  // The Wayline — three stones in a row, aimed at the World's Edge.
  { u: 455, v: 10, height: 8.8, girth: 1.5, lean: 0.3 },
  { u: 492, v: 6, height: 9.4, girth: 1.6, lean: -0.2, pale: true },
  { u: 526, v: 2, height: 8.2, girth: 1.4, lean: 0.4 },
  // The Shepherd — alone on the north steppe, the far fog's one landmark.
  { u: 352, v: 118, height: 10.8, girth: 1.7, lean: -0.6, pale: true },
  // Two more singles so the field reads as a field.
  { u: 396, v: -22, height: 7.6, girth: 1.3, lean: 0.7 },
  { u: 438, v: 116, height: 8.9, girth: 1.5, lean: -0.4 },
  { u: 502, v: -74, height: 7.9, girth: 1.4, lean: 0.9 },
];

export function buildBlue1Stones(): Blue1StonesBuild {
  const random = new Random(SEED ^ 0x570e);
  const meshes: Mesh[] = [];
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];
  const sites: Blue1StoneSite[] = [];

  // Fill round 1 (the plan's step-5 stone value fix): the raw hexes
  // rendered as dark muddy violet-brown under this mood's taken light —
  // the plains-final gnomon frame measured nothing of STONE_PALE's
  // blue-grey. The material tints are lifted toward the intended read;
  // the geometry streams are untouched. Round 2: the round-1 lift still
  // measured (101,96,120) on the gnomon — red above green, mud — so the
  // lift deepened and its target cooled toward the pale sky key.
  const liftStone = (hex: number, lift: number): number => {
    const c = new Color(hex).lerp(new Color(0xc8dcee), lift);
    return c.getHex();
  };
  const blueStone = createRockMaterial(liftStone(STONE_BLUE, 0.34));
  const paleStone = createRockMaterial(liftStone(STONE_PALE, 0.44));
  // The gate keeps the reef's warmth: the last warm colour on the way out.
  const warmStone = createRockMaterial(0x9a8a72);

  const stand = (
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    material = blueStone,
    kind: Blue1StoneSite["kind"] = "megalith",
  ): { x: number; z: number; y: number } => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z);
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material);
    mesh.name = "blue1-stone";
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    contacts.push({ x, z, radius: radius * 1.4, strength: 0.42 });
    sites.push({ x, z, radius, kind });
    colliders.push({ center: new Vector3(x, y + height * 0.32, z), radius: radius * 0.9 });
    if (height > radius * 2.2) {
      colliders.push({ center: new Vector3(x, y + height * 0.68, z), radius: radius * 0.62 });
      colliders.push({ center: new Vector3(x, y + height * 0.92, z), radius: radius * 0.45 });
    }
    return { x, z, y };
  };

  // ─── The Reef Gate ───────────────────────────────────────────────────────
  // Two warm jamb stones where the Open Blue's end wall lets go — the last
  // reef colour, falling away behind the diver from here on.
  stand(
    stackGeometry(
      [
        { radius: 1.5, rise: 0.6, stretch: 1.9, lean: 0.4 },
        { radius: 1.0, rise: 3.3, stretch: 1.7, lean: 0.9 },
      ],
      { seed: SEED ^ 0x0a01 },
    ),
    55,
    -7.6,
    0.6,
    1.5,
    5.1,
    warmStone,
    "gate",
  );
  stand(
    stackGeometry(
      [
        { radius: 1.3, rise: 0.5, stretch: 1.8, lean: -0.4 },
        { radius: 0.85, rise: 2.8, stretch: 1.6, lean: -0.9 },
      ],
      { seed: SEED ^ 0x0a02 },
    ),
    57,
    7.9,
    2.4,
    1.3,
    4.3,
    warmStone,
    "gate",
  );

  // ─── The waymarks ────────────────────────────────────────────────────────
  // Half-buried stones alternating down the glide's shoulders: the fog
  // rhythm of the 200 m approach, one mark every ~35 m.
  for (let i = 0; i < 6; i++) {
    const u = 92 + i * 35 + random.signed(6);
    const side = i % 2 === 0 ? -1 : 1;
    const lateral = side * random.range(9, 14);
    const radius = random.range(1.0, 1.9);
    const height = radius * random.range(0.8, 1.2);
    stand(
      boulderGeometry({ seed: SEED ^ (0x0aa0 + i), radius, height }),
      u,
      lateral,
      random.range(0, Math.PI * 2),
      radius,
      height,
      i % 3 === 0 ? paleStone : blueStone,
      "waymark",
    );
  }

  // ─── The Standing Stones ─────────────────────────────────────────────────
  for (const [i, stone] of MEGALITHS.entries()) {
    stand(
      stackGeometry(
        [
          { radius: stone.girth, rise: 0.5, stretch: 2.4, lean: stone.lean * 0.4 },
          {
            radius: stone.girth * 0.72,
            rise: stone.height * 0.46,
            stretch: 2.6,
            lean: stone.lean,
          },
          {
            radius: stone.girth * 0.5,
            rise: stone.height * 0.8,
            stretch: 1.9,
            lean: stone.lean * 1.6,
          },
        ],
        { seed: SEED ^ (0x0b00 + i), amount: 0.1 },
      ),
      stone.u,
      stone.v,
      random.range(0, Math.PI * 2),
      stone.girth,
      stone.height,
      stone.pale ? paleStone : blueStone,
    );
  }

  // ─── The Fallen King ─────────────────────────────────────────────────────
  // A toppled megalith: the stump still standing, the crown lying where it
  // fell, and the secret kept at its foot.
  const kingAt = { u: 382, v: -96 };
  const stump = stand(
    stackGeometry(
      [{ radius: 1.7, rise: 0.5, stretch: 1.7, lean: 0.9 }],
      { seed: SEED ^ 0x0c01 },
    ),
    kingAt.u,
    kingAt.v,
    1.1,
    1.7,
    3.2,
    blueStone,
    "stump",
  );
  // Round 4 re-stage (the audit's "the toppled story does not read"): the
  // crown is thinner than any standing stone's girth, half-sunk in the
  // sand, and its long axis lies exactly along the fall line from the
  // stump — a stone that fell, not a second boulder.
  const crown = slabGeometry({ seed: SEED ^ 0x0c02, radius: 1.6, height: 0.7 });
  crown.scale(1, 1, 3.4);
  crown.applyMatrix4(new Matrix4().makeRotationZ(0.08));
  const crownAt = worldOf(kingAt.u + 4.6, kingAt.v - 3.4);
  const fallFrom = worldOf(kingAt.u, kingAt.v);
  crown.applyMatrix4(
    new Matrix4().makeRotationY(Math.atan2(crownAt.x - fallFrom.x, crownAt.z - fallFrom.z)),
  );
  const crownY = seabedHeight(crownAt.x, crownAt.z);
  crown.translate(crownAt.x, crownY - 0.22, crownAt.z);
  crown.computeBoundingSphere();
  const crownMesh = new Mesh(crown, blueStone);
  crownMesh.name = "blue1-fallen-crown";
  crownMesh.castShadow = false;
  crownMesh.receiveShadow = false;
  meshes.push(crownMesh);
  contacts.push({ x: crownAt.x, z: crownAt.z, radius: 4.6, strength: 0.4 });
  colliders.push({ center: new Vector3(crownAt.x, crownY + 0.45, crownAt.z), radius: 1.9 });
  const secretSpot = worldOf(kingAt.u + 1.8, kingAt.v - 6.2);

  // ─── The terrace lips ────────────────────────────────────────────────────
  // Broken slabs seated along each shelf's edge, so every step reads as
  // masonry the sea laid down rather than a contour line.
  for (const [stepIndex, step] of TERRACE_STEPS.entries()) {
    for (let i = 0; i < 4; i++) {
      const v = -110 + i * 68 + random.signed(16);
      const u = 445 + step.s - 3 + random.signed(2.5);
      const radius = random.range(1.6, 2.6);
      const height = radius * random.range(0.45, 0.62);
      stand(
        slabGeometry({ seed: SEED ^ (0x0d00 + stepIndex * 8 + i), radius, height }),
        u,
        v,
        random.range(0, Math.PI * 2),
        radius,
        height,
        i % 2 === 0 ? blueStone : paleStone,
        "lip",
      );
    }
  }

  // ─── The Prow ────────────────────────────────────────────────────────────
  // The overlook: a long slab jutting past the lip with two flanking
  // stones behind it — the Friedrich foreground, built.
  const prowBase = worldOf(445 + DROP_LIP_S - 4, 4);
  const prowY = seabedHeight(prowBase.x, prowBase.z);
  const prowSlab = slabGeometry({ seed: SEED ^ 0x0e01, radius: 2.4, height: 1.0 });
  prowSlab.scale(1, 1, 2.6);
  // Point the slab's long axis down-spoke, over the drop.
  const spokeDir = worldOf(1, 0);
  prowSlab.applyMatrix4(new Matrix4().makeRotationY(Math.atan2(spokeDir.x, spokeDir.z)));
  const prowTipSpot = worldOf(445 + DROP_LIP_S + 2.4, 4);
  prowSlab.translate(prowBase.x, prowY + 0.25, prowBase.z);
  prowSlab.computeBoundingSphere();
  const prowMesh = new Mesh(prowSlab, paleStone);
  prowMesh.name = "blue1-prow";
  prowMesh.castShadow = false;
  prowMesh.receiveShadow = false;
  meshes.push(prowMesh);
  contacts.push({ x: prowBase.x, z: prowBase.z, radius: 3.4, strength: 0.42 });
  for (const s of [-2.2, 0.6, 3.2]) {
    const at = worldOf(445 + DROP_LIP_S - 4 + s, 4);
    colliders.push({ center: new Vector3(at.x, prowY + 0.7, at.z), radius: 1.7 });
  }
  for (const [i, side] of [-1, 1].entries()) {
    stand(
      stackGeometry(
        [
          { radius: 1.2, rise: 0.5, stretch: 1.9, lean: side * 0.5 },
          { radius: 0.8, rise: 2.6, stretch: 1.7, lean: side * 1.1 },
        ],
        { seed: SEED ^ (0x0e10 + i) },
      ),
      445 + DROP_LIP_S - 10,
      4 + side * 6.5,
      random.range(0, Math.PI * 2),
      1.2,
      4.2,
      blueStone,
      "prow",
    );
  }

  return {
    meshes,
    colliders,
    contacts,
    sites,
    secret: {
      x: secretSpot.x,
      z: secretSpot.z,
      y: Math.min(stump.y, seabedHeight(secretSpot.x, secretSpot.z)),
    },
    prow: { x: prowTipSpot.x, z: prowTipSpot.z, y: prowY },
  };
}
