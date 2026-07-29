import { describe, expect, it } from "vitest";
import { Mesh, Scene, Vector3, type BufferAttribute } from "three";
import { Kelp, KELP_CLUMPS } from "../src/world/Kelp";
import { SEEDS } from "../src/util/Random";

/** The four crevice mouths, exactly as `SPOT_PLACEMENTS` in `Reef` has them. */
const SPOTS = [
  { x: 0, y: 1.4, z: 1.5, facing: 0 },
  { x: -13, y: 1.6, z: 6, facing: Math.PI / 2 },
  { x: 13, y: 1.4, z: 6, facing: -Math.PI / 2 },
  { x: -6, y: 1.6, z: -9, facing: 0 },
] as const;

/**
 * The forest, checked in plain Node.
 *
 * Same rule the sanctuary and the life scaffolds are built under: if a thing
 * cannot be constructed without a `document` then none of it can be unit tested
 * and all of it has to be reviewed from a screenshot. Kelp is the largest new
 * object in the reef and three of the things it could get wrong are invisible
 * in a capture — a leaf standing over a moray's head, a second load leaking two
 * merged buffers, and a stand that is different on every reload.
 */

function meshesOf(kelp: Kelp): Mesh[] {
  return kelp.group.children.filter((child): child is Mesh => child instanceof Mesh);
}

function positionsOf(kelp: Kelp): Float32Array {
  const parts = meshesOf(kelp).map(
    (mesh) => (mesh.geometry.attributes.position as BufferAttribute).array as Float32Array,
  );
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const all = new Float32Array(total);
  let at = 0;
  for (const part of parts) {
    all.set(part, at);
    at += part.length;
  }
  return all;
}

describe("the kelp forest", () => {
  it("comes to two draw calls, and neither of them casts a shadow", () => {
    // One bucket of stalks and one of leaves. The budget for this package is
    // two milliseconds, and a per-clump mesh would have spent it on state
    // changes before a single frond was drawn.
    const kelp = new Kelp();
    const meshes = meshesOf(kelp);
    expect(meshes).toHaveLength(2);
    for (const mesh of meshes) {
      // Neither, and both on purpose — see the note in `build`. This is the
      // largest new surface in the reef and it lives in open water.
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
      expect(mesh.geometry.getAttribute("aPhase")).toBeDefined();
      expect(mesh.geometry.getAttribute("aReach")).toBeDefined();
      expect(mesh.geometry.getAttribute("color")).toBeDefined();
    }
    kelp.dispose();
  });

  it("grows the same forest from the same seed", () => {
    const first = positionsOf(new Kelp(SEEDS.kelp));
    const second = positionsOf(new Kelp(SEEDS.kelp));
    expect(first.length).toBe(second.length);
    expect(first.length).toBeGreaterThan(1000);
    for (let i = 0; i < first.length; i++) {
      if (first[i] !== second[i]) {
        expect.fail(`vertex component ${i} drifted: ${first[i]} vs ${second[i]}`);
      }
    }
  });

  it("raises a canopy: the giants reach toward the surface", () => {
    // W-L9's whole point. The forest used to top out under five metres and
    // the upper half of every frame was empty water; the giant stands are the
    // fix, and a tune that quietly shrinks them back is this test's business.
    const positions = positionsOf(new Kelp());
    let crown = 0;
    for (let i = 1; i < positions.length; i += 3) {
      crown = Math.max(crown, positions[i]!);
    }
    expect(crown).toBeGreaterThan(7.5);
  });

  it("keeps every pre-canopy holdfast where W-L9 left it", () => {
    // W-N2's placement contract, frozen the way the seabed test freezes the
    // crevice table. The canopy package tripled the straps and appended the
    // NW grove, and all of it is legal *only* because the placement stream
    // never moved: leaf counts draw from the leaf stream, crowns from the
    // canopy stream, and appended clumps consume placement draws after every
    // existing one. These literals are the first stalk of the (deliberately
    // re-authored) near stand plus a running hash of the whole stalk buffer;
    // if either drifts, something is drawing from the placement stream that
    // should not be — or a clump was edited rather than appended.
    const kelp = new Kelp(SEEDS.kelp);
    const stalks = meshesOf(kelp)[0]!;
    const position = stalks.geometry.attributes.position as BufferAttribute;
    const array = position.array as Float32Array;

    expect(position.count).toBe(5768);
    const first12 = [
      -5.917562961578369, -0.19533619284629822, 13.275659561157227, -5.862152576446533,
      -0.07533618807792664, 13.38269329071045, -5.6794047355651855, 0.17019376158714294,
      13.248282432556152, -5.586468696594238, 0.4157237112522125, 13.182744979858398,
    ];
    for (let i = 0; i < first12.length; i++) {
      expect(array[i], `stalk component ${i}`).toBe(first12[i]);
    }
    let hash = 0;
    for (let i = 0; i < array.length; i++) {
      const bits = new Uint32Array(new Float32Array([array[i]!]).buffer)[0]!;
      hash = ((hash * 31) ^ bits) >>> 0;
    }
    expect(hash).toBe(4264248344);
    kelp.dispose();
  });

  it("hangs a real canopy overhead, and a grove of it over the NW bench", () => {
    // The round critic's verdict, held as arithmetic: "there is no canopy
    // overhead — nothing between the camera and open water". Leaf area above
    // six metres is what an upward camera actually sees, so that is what is
    // counted — first across the whole forest, then inside the appended NW
    // grove, where the Z-kelp-canopy capture stands. And the meaning of
    // "roughly triple the straps": the leaf mesh's triangle count, asserted
    // as a floor so a quiet retune cannot shrink the forest back to wires.
    const kelp = new Kelp(SEEDS.kelp);
    const meshes = meshesOf(kelp);
    const leaves = meshes[1]!;
    const position = leaves.geometry.attributes.position as BufferAttribute;

    let overhead = 0;
    let grove = 0;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      if (y > 6) {
        overhead++;
        if (Math.hypot(position.getX(i) - -16.8, position.getZ(i) - 14.8) < 5) {
          grove++;
        }
      }
    }
    expect(overhead).toBeGreaterThan(2000);
    expect(grove).toBeGreaterThan(400);

    const triangles = (leaves.geometry.getIndex()?.count ?? position.count) / 3;
    expect(triangles).toBeGreaterThan(25000);
    kelp.dispose();
  });

  it("keeps every stand six metres off a crevice mouth", () => {
    for (const clump of KELP_CLUMPS) {
      for (const spot of SPOTS) {
        expect(
          Math.hypot(clump.x - spot.x, clump.z - spot.z),
          `the stand at (${clump.x}, ${clump.z})`,
        ).toBeGreaterThan(6);
      }
    }
  });

  it("stands clear of every approach the player is asked to look down", () => {
    // The constraint that actually matters, and the one no raycast in the game
    // will ever catch: kelp is not in `obstructionMeshes` — no plant is — so
    // `DiscoverySystem` would cheerfully call a head visible through a frond.
    //
    // A radius around the mouth is the wrong shape for it: a stand three metres
    // *behind* a moray blocks nothing and a stand ten metres out on the line
    // the player looks down blocks everything. So this walks the sample grid
    // `reefSightlines` raycasts and asks that no leaf crowd those lines.
    //
    // Two thresholds, because two different things are being protected. The
    // spawn swim is scripted — the e2e presses W and holds, with the view
    // centred and nothing steering around anything — so it gets a wide berth.
    // The four approach fans are explored by hand, and `reefSightlines` itself
    // only asks that three quarters of one be clear: their outer corners
    // (offset 0.6, thirteen metres out) are where the crevice's own flanks are
    // *meant* to narrow the view, and a plant there is a plant the player swims
    // a metre around. What may not be crowded is the axis and the near field.
    const positions = positionsOf(new Kelp());
    const lanes: { from: Vector3; to: Vector3; clearance: number }[] = [];

    for (const spot of SPOTS) {
      const head = new Vector3(spot.x, spot.y, spot.z);
      const forward = new Vector3(Math.sin(spot.facing), 0, Math.cos(spot.facing));
      const right = new Vector3(forward.z, 0, -forward.x);
      for (const distance of [3, 5, 7, 9, 11, 13]) {
        for (const offset of [-0.3, 0, 0.3]) {
          const from = head
            .clone()
            .addScaledVector(forward, distance)
            .addScaledVector(right, distance * offset)
            .setY(2.1);
          if (from.distanceTo(head) <= 14) {
            // From the head out to arm's reach of the observer, and no
            // further. What is being asserted is that nothing stands *between*
            // the two: a frond beside the diver's own shoulder is a frond they
            // have swum into, which is a thing that happens in a kelp bed and
            // is not a thing that hides a moray.
            lanes.push({
              from: from.clone().lerp(head, 1.6 / from.distanceTo(head)),
              to: head,
              clearance: 0.8,
            });
          }
        }
      }
    }
    lanes.push({
      from: new Vector3(0, 2, 22),
      to: new Vector3(0, 1.4, 1.5),
      clearance: 2.2,
    });
    expect(lanes.length).toBeGreaterThan(50);

    // Hand-rolled point-to-segment in the ground plane, because this is four
    // million comparisons and `Line3` is a method call per vertex. Horizontal
    // only on purpose: every one of these lines runs a metre or two over the
    // sand, so a frond passing above one is a frond in open water.
    let worst = Infinity;
    let where = "";
    for (const lane of lanes) {
      const ax = lane.from.x;
      const az = lane.from.z;
      const dx = lane.to.x - ax;
      const dz = lane.to.z - az;
      const lengthSq = dx * dx + dz * dz || 1;

      for (let i = 0; i < positions.length; i += 3) {
        const px = positions[i]! - ax;
        const pz = positions[i + 2]! - az;
        const along = Math.min(1, Math.max(0, (px * dx + pz * dz) / lengthSq));
        const margin =
          Math.hypot(px - dx * along, pz - dz * along) - lane.clearance;
        if (margin < worst) {
          worst = margin;
          where =
            `a frond at (${positions[i]!.toFixed(2)}, ${positions[i + 2]!.toFixed(2)}) ` +
            `comes within ${lane.clearance}m of the approach to (${lane.to.x}, ${lane.to.z})`;
        }
      }
    }

    expect(worst, where).toBeGreaterThan(0);
  });

  it("leaves the anemone garden's disc empty", () => {
    // Held for a Wave-3 package. Nothing of this one may grow into it.
    const positions = positionsOf(new Kelp());
    for (let i = 0; i < positions.length; i += 3) {
      expect(Math.hypot(positions[i]! - 7.5, positions[i + 2]! - 8.5)).toBeGreaterThan(2);
    }
  });

  it("runs a minute of frames and lets go of everything after it", () => {
    const kelp = new Kelp();
    const scene = new Scene();
    scene.add(kelp.group);

    for (let i = 0; i < 3600; i++) {
      kelp.update(1 / 60, false);
    }
    kelp.update(1 / 60, true);
    kelp.update(0, false);

    kelp.dispose();
    expect(scene.children).not.toContain(kelp.group);
    expect(kelp.group.children).toHaveLength(0);
    // Twice, because teardown runs on a path that may already have run.
    kelp.dispose();
  });
});
