import { Matrix4, Mesh, Vector3, type BufferGeometry } from "three";
import { Random, SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { createRockMaterial } from "../../RockMaterial";
import { boulderGeometry, slabGeometry, stackGeometry } from "../../RockShapes";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { mergedMesh } from "./Verdant2Shared";
import {
  BALCONY,
  CISTERN,
  FERN_VAULT,
  MISTFALL,
  VAULT_CEILING,
  mistfallLipU,
  stairChannelCenter,
  stairChannelHalf,
  stepFootU,
  worldOf,
} from "./Verdant2Terrain";

/**
 * The Emerald Terraces' stone: the pass's gate and sentinels, the step
 * ledges, the slab bridge over the garden riser, the grotto behind the
 * green curtain, the Cistern's worked rim ring, the Fern Vault's pillars
 * and stone shelf, the Mistfall's lip horns and the Far Balcony's
 * balustrade.
 *
 * Every stone is a `RockShapes` lathe (the drawn-profile contract) in
 * one of three families — mossy field stone, pale worked jade (the
 * "half-worked" memory the Cistern keeps), and the deep basin's cool
 * stone — merged into one mesh per family so forty stones cost three
 * draws. Everything solid returns sphere colliders; everything standing
 * returns a contact patch so the ground bake seats it.
 */

const SEED = SEEDS.regionVerdant2;

export interface Verdant2StoneBuild {
  readonly meshes: Mesh[];
  readonly colliders: SphereCollider[];
  readonly contacts: ContactPatch[];
  /** The grotto's mouth, where the Terrace Warden keeps its rounds. */
  readonly grotto: { x: number; z: number; y: number; facing: number };
  /** The slab bridge's midpoint, for the poses. */
  readonly bridge: { u: number; v: number };
}

export function buildVerdant2Stone(): Verdant2StoneBuild {
  const random = new Random(SEED ^ 0x50c9);
  const colliders: SphereCollider[] = [];
  const contacts: ContactPatch[] = [];

  const moss: BufferGeometry[] = [];
  const jade: BufferGeometry[] = [];
  const deep: BufferGeometry[] = [];

  /** Seats a stone on the composed ground and books its physics. */
  const stand = (
    bucket: BufferGeometry[],
    geometry: BufferGeometry,
    u: number,
    v: number,
    yaw: number,
    radius: number,
    height: number,
    lift = 0,
  ): { x: number; z: number; y: number } => {
    const { x, z } = worldOf(u, v);
    const y = seabedHeight(x, z) + lift;
    geometry.applyMatrix4(new Matrix4().makeRotationY(yaw));
    geometry.translate(x, y, z);
    bucket.push(geometry);
    contacts.push({ x, z, radius: radius * 1.3, strength: 0.4 });
    colliders.push({ center: new Vector3(x, y + height * 0.35, z), radius: radius * 0.85 });
    if (height > radius * 1.6) {
      colliders.push({ center: new Vector3(x, y + height * 0.75, z), radius: radius * 0.6 });
    }
    return { x, z, y };
  };

  // ─── The Rim Sentinel ────────────────────────────────────────────────────
  // One lone worn stack on the threshold, just past the kelp sea's rim:
  // the first thing of ours the fog gives up, and the promise that the
  // shelf is leading somewhere.
  stand(
    jade,
    stackGeometry(
      [
        { radius: 1.4, rise: 0.6, stretch: 1.9, lean: 0.3 },
        { radius: 0.9, rise: 3.2, stretch: 1.7, lean: 0.8 },
      ],
      { seed: SEED ^ 0x0a01 },
    ),
    672,
    stairChannelCenter(672) - 6.5,
    0.7,
    1.4,
    4.6,
  );

  // ─── The waymark pair ────────────────────────────────────────────────────
  // Two mossy boulders mid-threshold, where the ground begins its draw-in.
  for (const [i, side] of [-1, 1].entries()) {
    const u = 704 + i * 3;
    stand(
      moss,
      boulderGeometry({ seed: SEED ^ (0x0a10 + i), radius: 1.5 - i * 0.3, height: 1.9 - i * 0.4 }),
      u,
      stairChannelCenter(u) + side * random.range(5, 7),
      random.range(0, Math.PI * 2),
      1.5,
      1.9,
    );
  }

  // ─── The Emerald Gate ────────────────────────────────────────────────────
  // Two great jamb stacks where the first riser falls away: the doorway
  // into the country, worked-looking, moss-hung (the gardens dress them).
  // Round 3: the jambs stand *inside* the channel (round 2 left them on
  // the wall slopes, camouflaged against the banks) and wear the cool
  // deep stone so they read as a doorway against the warm walls. The
  // corridor narrows to ~9 m between them — a door, not a pinch.
  // Round 4: moved past u 733 — verdant-1's outermost distance ring
  // crosses the pass there as an opaque fog-coloured curtain, and three
  // rounds of gate poses photographed the back of it (see the ledger).
  for (const [i, side] of [-1, 1].entries()) {
    const u = 747 + i * 2;
    stand(
      deep,
      stackGeometry(
        [
          { radius: 2.2 - i * 0.2, rise: 0.9, stretch: 2.2, lean: side * 0.4 },
          { radius: 1.5 - i * 0.2, rise: 6.4 - i * 0.7, stretch: 2.0, lean: side * 1.2 },
        ],
        { seed: SEED ^ (0x0a20 + i) },
      ),
      u,
      stairChannelCenter(u) + side * (stairChannelHalf(u) - 3),
      side * 0.9,
      2.2,
      9.4 - i * 0.8,
    );
  }

  // ─── The step ledges ─────────────────────────────────────────────────────
  // A low slab lip at every other step's foot, alternating sides — the
  // crisp edge the soft terrain riser needs, and the fog-rhythm dressing
  // down the stair with the ledge gardens above them.
  // Round 3: lips on both flanks of every step, so the descent reads as
  // rhythm from above as well as from the side.
  for (let i = 0; i < 8; i++) {
    const u = stepFootU(i) + 0.8;
    for (const side of [-1, 1]) {
      const v = stairChannelCenter(u) + side * random.range(4, 7);
      const radius = random.range(1.7, 2.8);
      stand(
        moss,
        slabGeometry({ seed: SEED ^ (0x0a30 + i * 2 + (side + 1) / 2), radius, height: radius * 0.42 }),
        u + random.signed(1.2),
        v,
        random.range(0, Math.PI * 2),
        radius,
        radius * 0.42,
      );
    }
  }

  // ─── The stair-foot overlook boulder ─────────────────────────────────────
  // One great stone where the stair opens into the gardens: the place to
  // hold the frame's edge while the terrace country reveals itself.
  stand(
    moss,
    boulderGeometry({ seed: SEED ^ 0x0a40, radius: 2.8, height: 3.6 }),
    851,
    stairChannelCenter(845) - 11,
    random.range(0, Math.PI * 2),
    2.8,
    3.6,
  );

  // ─── The Slab Bridge ─────────────────────────────────────────────────────
  // A fallen sheet of terrace stone bridging the second garden riser: its
  // near end rests on the upper tread, its far end on a support boulder
  // on the lower — a swim-under at its middle.
  const bridge = buildBridge(moss, colliders, contacts, random);

  // ─── The Curtain Grotto ──────────────────────────────────────────────────
  // Two shoulder boulders and a leaning roof slab set into a garden
  // riser; the vine-fall curtains hang over its mouth, and the Terrace
  // Warden patrols in and out of the green.
  const grottoU = 893;
  const grottoV = 26;
  for (const [i, side] of [-1, 1].entries()) {
    stand(
      moss,
      boulderGeometry({ seed: SEED ^ (0x0a50 + i), radius: 1.8, height: 2.7 }),
      grottoU + side * 2.8,
      grottoV - 0.6,
      random.range(0, Math.PI * 2),
      1.8,
      2.7,
    );
  }
  const grottoPos = worldOf(grottoU, grottoV);
  const grottoY = seabedHeight(grottoPos.x, grottoPos.z);
  const roof = slabGeometry({ seed: SEED ^ 0x0a52, radius: 3.8, height: 1.5 });
  roof.applyMatrix4(new Matrix4().makeRotationZ(0.14));
  roof.applyMatrix4(new Matrix4().makeRotationY(1.2));
  roof.translate(grottoPos.x, grottoY + 2.6, grottoPos.z + 0.5);
  moss.push(roof);
  colliders.push({
    center: new Vector3(grottoPos.x, grottoY + 3.8, grottoPos.z + 0.5),
    radius: 2.5,
  });
  const grottoMouth = worldOf(grottoU - 3.2, grottoV - 1.2);

  // ─── The Cistern's rim ring ──────────────────────────────────────────────
  // Ten worked stones spaced *evenly* — regularity is what says "built" —
  // leaning gently inward over the mirror floor, with two of the ring
  // fallen where the ages won.
  // Round 2: the ring grown ~40% and tightened (33 m) — metre stones on
  // a 72 m ring read as pebbles on a horizon.
  for (let i = 0; i < 10; i++) {
    const theta = (i / 10) * Math.PI * 2 + 0.25;
    const u = CISTERN.u + Math.cos(theta) * 33;
    const v = CISTERN.v + Math.sin(theta) * 33;
    if (i === 3 || i === 7) {
      // The fallen pair: lying along the ring, half-sunk.
      const fallen = stackGeometry(
        [
          { radius: 1.5, rise: 0.7, stretch: 2.0, lean: 0.2 },
          { radius: 1.1, rise: 3.6, stretch: 1.8, lean: 0.5 },
        ],
        { seed: SEED ^ (0x0a60 + i) },
      );
      fallen.applyMatrix4(new Matrix4().makeRotationZ(Math.PI / 2 - 0.12));
      stand(jade, fallen, u, v, theta + 0.4, 2.1, 1.9, 0.45);
      continue;
    }
    const lean = 0.35;
    const stone = stackGeometry(
      [
        { radius: 1.45, rise: 0.75, stretch: 2.1, lean: 0 },
        { radius: 1.0, rise: 4.4, stretch: 1.9, lean: 0 },
      ],
      { seed: SEED ^ (0x0a60 + i) },
    );
    // The inward lean, applied as a rotation toward the bowl's centre.
    stone.applyMatrix4(new Matrix4().makeRotationX(lean * Math.sin(theta)));
    stone.applyMatrix4(new Matrix4().makeRotationZ(-lean * Math.cos(theta)));
    stand(jade, stone, u, v, random.range(0, Math.PI * 2), 1.45, 6.2);
  }

  // ─── The Fern Vault's shelf and pillars ──────────────────────────────────
  // Three flattened roof slabs at the authored ceiling's height, seated
  // toward the rising garden side and carried by three pillar stacks:
  // the low stone sky the giant ferns grow up against.
  const vaultPos = worldOf(FERN_VAULT.u, FERN_VAULT.v);
  for (let i = 0; i < 3; i++) {
    const angle = 0.8 + i * 1.9;
    const px = FERN_VAULT.u + Math.cos(angle) * 10;
    const pv = FERN_VAULT.v + Math.sin(angle) * 10;
    const stone = stackGeometry(
      [
        { radius: 1.15, rise: 0.6, stretch: 2.2, lean: 0.15 },
        { radius: 0.95, rise: 4.8, stretch: 2.4, lean: -0.1 },
      ],
      { seed: SEED ^ (0x0a70 + i) },
    );
    stone.scale(1, 1.72, 1);
    stand(deep, stone, px, pv, random.range(0, Math.PI * 2), 1.15, 9.4);
  }
  for (let i = 0; i < 3; i++) {
    const slab = slabGeometry({ seed: SEED ^ (0x0a80 + i), radius: 10 - i * 1.5, height: 2.2 });
    const angle = 0.4 + i * 2.0;
    const sx = vaultPos.x + Math.cos(angle) * 7;
    const sz = vaultPos.z + Math.sin(angle) * 7;
    slab.applyMatrix4(new Matrix4().makeRotationZ(0.05 * (i - 1)));
    // The slab's belly sits above the annex ceiling: unreachable stone sky.
    slab.translate(sx, VAULT_CEILING + 1.9 + i * 0.4, sz);
    deep.push(slab);
  }

  // ─── The Mistfall's lip horns ────────────────────────────────────────────
  // Two tall stacks flanking the fall where it leaves the lip — the
  // frame the whole cliff composition hangs from, above and below.
  // Round 2: the horns stand on the *local* lip (the meander carries the
  // cliff ~7 m past MISTFALL.u here) and grew into the frame they hold.
  stand(
    deep,
    stackGeometry(
      [
        { radius: 2.0, rise: 1.0, stretch: 2.3, lean: 0.5 },
        { radius: 1.3, rise: 7.0, stretch: 2.1, lean: 1.3 },
      ],
      { seed: SEED ^ 0x0a90 },
    ),
    mistfallLipU(MISTFALL.v - 15) - 2.5,
    MISTFALL.v - 15,
    0.8,
    2.0,
    9.6,
  );
  stand(
    deep,
    stackGeometry(
      [
        { radius: 1.7, rise: 0.9, stretch: 2.2, lean: -0.4 },
        { radius: 1.1, rise: 6.0, stretch: 2.0, lean: -1.1 },
      ],
      { seed: SEED ^ 0x0a91 },
    ),
    mistfallLipU(MISTFALL.v + 17) - 2.5,
    MISTFALL.v + 17,
    3.9,
    1.7,
    8.4,
  );

  // ─── The basin's sleepers ────────────────────────────────────────────────
  // Great half-buried boulders on the Mistfall basin's floor, catching
  // the fall's milk — the scale-givers of the deepest ground.
  for (let i = 0; i < 5; i++) {
    const u = 1022 + random.range(0, 46);
    const v = MISTFALL.v + random.signed(34);
    const radius = random.range(2.2, 3.6);
    stand(
      deep,
      boulderGeometry({ seed: SEED ^ (0x0aa0 + i), radius, height: radius * random.range(0.7, 1.0) }),
      u,
      v,
      random.range(0, Math.PI * 2),
      radius,
      radius * 0.85,
    );
  }

  // ─── The Far Balcony's balustrade ────────────────────────────────────────
  // Five low worked slabs in an arc along the balcony's outward edge, and
  // two tall stacks framing the painted distance beyond.
  for (let i = 0; i < 5; i++) {
    const theta = -0.7 + i * 0.35;
    const u = BALCONY.u + Math.cos(theta) * 11;
    const v = BALCONY.v + Math.sin(theta) * 11;
    const radius = random.range(1.2, 1.7);
    stand(
      jade,
      slabGeometry({ seed: SEED ^ (0x0ab0 + i), radius, height: radius * 0.6 }),
      u,
      v,
      theta,
      radius,
      radius * 0.6,
    );
  }
  for (const [i, side] of [-1, 1].entries()) {
    stand(
      jade,
      stackGeometry(
        [
          { radius: 1.4, rise: 0.7, stretch: 2.1, lean: side * 0.5 },
          { radius: 0.95, rise: 4.8, stretch: 1.9, lean: side * 1.2 },
        ],
        { seed: SEED ^ (0x0ac0 + i) },
      ),
      BALCONY.u + 6,
      BALCONY.v + side * 9,
      side * 1.1,
      1.4,
      6.6,
    );
  }

  // ─── The garden field stones ─────────────────────────────────────────────
  // Scattered mossy boulders along the terrace treads, denser near the
  // risers where fallen terrace stone would gather.
  for (let i = 0; i < 8; i++) {
    const u = 840 + random.range(0, 130);
    const v = -55 + random.range(0, 110);
    if (Math.hypot(u - CISTERN.u, v - CISTERN.v) < 46) {
      continue;
    }
    if (Math.hypot(u - FERN_VAULT.u, v - FERN_VAULT.v) < 44) {
      continue;
    }
    const radius = random.range(1.0, 2.2);
    stand(
      moss,
      boulderGeometry({ seed: SEED ^ (0x0ad0 + i), radius, height: radius * random.range(0.8, 1.2) }),
      u,
      v,
      random.range(0, Math.PI * 2),
      radius,
      radius,
    );
  }

  const meshes = [
    mergedMesh(moss, createRockMaterial(0x6d7a62), "verdant2-stone-moss"),
    mergedMesh(jade, createRockMaterial(0x94a289), "verdant2-stone-jade"),
    // Round 4: cool green-grey — the slate-violet read purple-orange
    // against the rust weathering at close range (mistfall-above r3).
    // Round 5: a half-value lift; the gate jambs read as pure blacks.
    mergedMesh(deep, createRockMaterial(0x6a7a6a), "verdant2-stone-deep"),
  ];

  return {
    meshes,
    colliders,
    contacts,
    grotto: {
      x: grottoMouth.x,
      z: grottoMouth.z,
      y: seabedHeight(grottoMouth.x, grottoMouth.z) + 1.2,
      facing: 1.35 + Math.PI,
    },
    bridge,
  };
}

/** The slab bridge over the second garden riser. */
function buildBridge(
  moss: BufferGeometry[],
  colliders: SphereCollider[],
  contacts: ContactPatch[],
  random: Random,
): { u: number; v: number } {
  // The riser near tc = 42 falls across u ≈ 872–878 at v ≈ −34; the deck
  // runs down-slope (along u), near end on the upper tread, far end on a
  // support boulder standing on the lower tread.
  const nearEnd = { u: 868.5, v: -34 };
  const farEnd = { u: 882, v: -35.5 };
  const near = worldOf(nearEnd.u, nearEnd.v);
  const far = worldOf(farEnd.u, farEnd.v);
  const nearY = seabedHeight(near.x, near.z) + 0.4;

  // The support boulder under the far end.
  const support = boulderGeometry({ seed: SEED ^ 0x0ae0, radius: 1.7, height: 2.4 });
  const farY = seabedHeight(far.x, far.z);
  support.translate(far.x, farY, far.z);
  moss.push(support);
  contacts.push({ x: far.x, z: far.z, radius: 2.2, strength: 0.45 });
  colliders.push({ center: new Vector3(far.x, farY + 1.0, far.z), radius: 1.5 });

  const deckFarY = farY + 2.5;
  const midX = (near.x + far.x) / 2;
  const midZ = (near.z + far.z) / 2;
  const midY = (nearY + deckFarY) / 2;
  const length = Math.hypot(far.x - near.x, far.z - near.z, deckFarY - nearY);

  const deck = slabGeometry({ seed: SEED ^ 0x0ae1, radius: 1.9, height: 1.1 });
  deck.scale(length / 3.4, 0.75, 0.95);
  const yaw = Math.atan2(far.x - near.x, far.z - near.z);
  const pitch = Math.atan2(deckFarY - nearY, Math.hypot(far.x - near.x, far.z - near.z));
  deck.applyMatrix4(new Matrix4().makeRotationZ(-pitch));
  deck.applyMatrix4(new Matrix4().makeRotationY(yaw + Math.PI / 2));
  deck.translate(midX, midY - 0.4, midZ);
  moss.push(deck);
  void random;

  // Deck colliders: a row along the span, sized to leave the swim-under
  // clear beneath the deck's middle.
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    colliders.push({
      center: new Vector3(
        near.x + (far.x - near.x) * t,
        nearY + (deckFarY - nearY) * t + 0.25,
        near.z + (far.z - near.z) * t,
      ),
      radius: 1.05,
    });
  }

  return { u: (nearEnd.u + farEnd.u) / 2, v: (nearEnd.v + farEnd.v) / 2 };
}
