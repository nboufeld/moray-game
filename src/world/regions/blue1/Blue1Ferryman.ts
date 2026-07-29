import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { smoothstep01 } from "./Blue1Shared";
import { worldOf } from "./Blue1Terrain";

/**
 * THE FERRYMAN — the Drop Plains' findable resident: an ancient giant
 * sunfish that patrols the World's Edge, crossing and recrossing the lip
 * of the void the way a boatman works a river bank. Five and a half
 * metres of drifting grey coin, seen edge-on against the deep blue from
 * the Prow — the region's melancholy given one calm shape.
 *
 * ## The build
 *
 * A procedural mola: a laterally flattened lens truncated at the rear
 * into a scalloped clavus, with the animal's whole silhouette carried by
 * the two great vertical fins. Painted in vertex colours: slate-blue
 * back falling to a pale belly, drifted with paler mottling, fins a step
 * deeper — nothing near black, and the darkest band violet-leaned. No
 * GLB: the geometry is authored here, which is its own fallback.
 *
 * The patrol is one closed seeded line along the drop's arc, absolute
 * heights − 24 to −33: below the lip, above the deep, so from the
 * overlook the animal hangs *in* the void. The discovery anchor sits
 * where the line passes the Prow; a diver who holds the overlook is
 * holding the animal.
 */

const SEED = SEEDS.regionBlue1;

export const FERRYMAN_SPECIES_ID = "the-ferryman";

/** The patrol's stations: (u, v, absolute y). */
const PATROL: readonly [number, number, number][] = [
  [563, -72, -26],
  [571, -34, -25],
  [575, 5, -26],
  [570, 44, -25],
  [561, 78, -27],
  [582, 52, -31],
  [590, 6, -33],
  [584, -46, -31],
];

export interface FerrymanBuild {
  readonly mesh: Mesh;
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildFerryman(): FerrymanBuild {
  const random = new Random(SEED ^ 0xfe11);
  const points: Vector3[] = [];
  for (const [u, v, y] of PATROL) {
    const { x, z } = worldOf(u, v);
    points.push(new Vector3(x, y + random.signed(0.4), z));
  }
  const path = new CatmullRomCurve3(points, true, "centripetal", 0.5);

  const geometry = molaGeometry();
  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0x2e4152,
    emissiveIntensity: 0.5,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "blue1-ferryman";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  // The anchor: where the patrol passes the Prow.
  const anchorAt = worldOf(575, 5);
  const target: DiscoveryTarget = {
    speciesId: FERRYMAN_SPECIES_ID,
    position: new Vector3(anchorAt.x, -26, anchorAt.z),
  };

  const at = new Vector3();
  const ahead = new Vector3();
  const phase = random.range(0, Math.PI * 2);

  const pose = (time: number): void => {
    // One circuit in a little over three minutes — an unhurried animal.
    const s = (time / 200) % 1;
    path.getPointAt(s, at);
    path.getPointAt((s + 0.004) % 1, ahead);
    at.y += Math.sin(time * 0.11 + phase) * 0.5;
    mesh.position.copy(at);
    mesh.rotation.set(
      Math.sin(time * 0.07 + phase) * 0.04,
      Math.atan2(ahead.x - at.x, ahead.z - at.z),
      // The slow scull: the whole coin rocks as the fins beat.
      Math.sin(time * 0.35 + phase) * 0.07,
    );
  };

  pose(0);

  let slowTime = 0;
  let last = 0;
  return {
    mesh,
    target,
    update(time: number, reducedMotion: boolean): void {
      const dt = Math.max(0, time - last);
      last = time;
      slowTime += dt * (reducedMotion ? 0.5 : 1);
      pose(slowTime);
    },
  };
}

/** The mola: lens body, truncated clavus, two great vertical fins. */
function molaGeometry(): BufferGeometry {
  // Stripped to position-only (an icosahedron at detail 2 is already
  // non-indexed) so the fin blades' bare position buffers can merge with
  // it — the urchin trap, pre-paid.
  const body = new IcosahedronGeometry(2.6, 2);
  body.deleteAttribute("normal");
  body.deleteAttribute("uv");
  const position = body.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    let x = position.getX(i) * 0.3; // lateral flatness
    const y = position.getY(i) * 0.92;
    let z = position.getZ(i); // +z is the nose
    // The rear truncation: everything behind the midline compresses
    // toward the clavus plane, and the plane itself ripples into scallops.
    if (z < -0.9) {
      const over = -z - 0.9;
      z = -0.9 - over * 0.28;
      const scallop = Math.sin(y * 3.4) * 0.14;
      z -= scallop * smoothstep01(over / 1.6);
      x *= 1 - over * 0.16;
    }
    // The brow and chin round off; the nose blunts.
    if (z > 1.9) {
      z = 1.9 + (z - 1.9) * 0.55;
    }
    position.setXYZ(i, x, y, z);
  }
  position.needsUpdate = true;

  const fin = (up: boolean): BufferGeometry => {
    // A tall swept blade: root chord along the body's rear third.
    const sign = up ? 1 : -1;
    const positions = new Float32Array([
      0, sign * 1.6, -0.2, 0, sign * 1.7, -1.3, 0, sign * 4.3, -1.55,
      0, sign * 1.6, -0.2, 0, sign * 4.3, -1.55, 0, sign * 3.4, -0.55,
    ]);
    const blade = new BufferGeometry();
    blade.setAttribute("position", new BufferAttribute(positions, 3));
    // Give the blade a hair of thickness by doubling it, offset and
    // reverse-wound, so it lights from both sides without DoubleSide.
    const back = blade.clone();
    back.applyMatrix4(new Matrix4().makeScale(-1, 1, 1));
    back.translate(0.06, 0, 0);
    blade.translate(-0.06, 0, 0);
    const merged = mergeGeometries([blade, back], false);
    blade.dispose();
    back.dispose();
    if (!merged) {
      throw new Error("blue1 ferryman fin could not be merged");
    }
    return merged;
  };

  const merged = mergeGeometries([body, fin(true), fin(false)], false);
  body.dispose();
  if (!merged) {
    throw new Error("blue1 ferryman parts could not be merged");
  }
  // The merge was fed position-only parts (the body's own normals had to be
  // deleted for the attribute sets to match), so the merged geometry has NO
  // normal attribute — and `smoothNormals` silently requires one. Drawing a
  // lit material with the normal array unbound corrupted whole frames on
  // this driver: every pose whose render list put the Ferryman early enough
  // rendered as one flat violet field. Face normals first, then the weld.
  merged.computeVertexNormals();
  smoothNormals(merged);

  // The paint: slate back, pale belly, mottle drifts, deep-toned fins.
  const pos = merged.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const back = new Color(0x64788c);
  const belly = new Color(0xb9c6c8);
  const finTone = new Color(0x53638a);
  const shade = new Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(x) <= 0.07 && Math.abs(y) > 1.5) {
      // The fins: a step deeper, violet-leaned at the tips.
      const tip = smoothstep01((Math.abs(y) - 2.2) / 2.1);
      shade.copy(finTone).lerp(new Color(0x6a5f96), tip * 0.6);
    } else {
      const height = smoothstep01((y + 2.2) / 4.4);
      shade.copy(belly).lerp(back, height);
      const mottle = fbm(z * 0.5 + 3, y * 0.5, { seed: SEED ^ 0xf0aa, period: 4, octaves: 2 });
      shade.lerp(new Color(0xc4d2d6), smoothstep01((mottle - 0.58) / 0.16) * 0.5);
      // The old scar-pale ring the codex mentions, forward of the clavus.
      if (Math.abs(x) > 0.2 && z < 0.2 && z > -0.5) {
        shade.lerp(new Color(0xd0dade), 0.12);
      }
    }
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  merged.setAttribute("color", new BufferAttribute(colors, 3));
  merged.computeBoundingSphere();
  return merged;
}
