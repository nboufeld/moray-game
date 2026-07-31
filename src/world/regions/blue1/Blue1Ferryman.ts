import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  Object3D,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createFishGeometry } from "../../../creatures/fish/FishGeometry";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { FILL_SEEDS } from "./Blue1FillShared";
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
  /** The two pilot jacks riding a metre off the flank — the great coin's
   *  scale cue (fill plan §5). One instanced draw; they pose with the
   *  patrol, so the pair never spends randomness in update. */
  readonly jacks: InstancedMesh;
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

  // The pilot jacks: two small silver fish holding station off the flank.
  // Their stream is fresh (appended after every existing draw), so the
  // mola's own path jitter and phase stay byte-identical.
  const jackRandom = new Random(SEED ^ FILL_SEEDS.jacks);
  const jackGeometry = createFishGeometry({
    width: 0.85,
    height: 0.95,
    length: 1.1,
    tailTaper: 0.52,
    dorsal: 0.4,
    pectoral: 0.8,
    tail: { reach: 1.45, lobe: 0.6, notch: 1.05 },
  });
  const jackMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0x3e6478,
    emissiveIntensity: 0.6,
  });
  const jacks = new InstancedMesh(jackGeometry, jackMaterial, 2);
  jacks.name = "blue1-ferryman-jacks";
  jacks.castShadow = false;
  jacks.receiveShadow = false;
  jacks.frustumCulled = false;
  jacks.instanceMatrix.setUsage(DynamicDrawUsage);
  const jackTint = new Color();
  const jackSpecs = [-1, 1].map((side, i) => {
    jackTint.setHex(0xdceef4).multiplyScalar(jackRandom.range(0.9, 1.05));
    jacks.setColorAt(i, jackTint);
    return {
      side,
      out: jackRandom.range(1.6, 2.2),
      lift: jackRandom.signed(0.7),
      lead: jackRandom.range(0.6, 1.6),
      bobPhase: jackRandom.range(0, Math.PI * 2),
      scale: jackRandom.range(0.5, 0.68),
    };
  });
  if (jacks.instanceColor) {
    jacks.instanceColor.needsUpdate = true;
  }
  const jackDummy = new Object3D();

  const at = new Vector3();
  const ahead = new Vector3();
  const phase = random.range(0, Math.PI * 2);

  // Where the patrol starts when the region wakes: 28 s shy of nothing —
  // measured, the circuit passes the Prow anchor at t ≈ 48.75. The clock
  // below runs from the region's own attach (not the page's global time),
  // and the capture harness's shutter lands ≈ 18 s after attach (its 10 s
  // asset wait plus the pose's settle), so the canonical Ferryman pose
  // meets the animal arriving at the crossing instead of gambling on
  // whatever phase the page's load history happened to leave the loop in.
  const PATROL_PHASE = 28;

  const pose = (time: number): void => {
    // One circuit in a little over three minutes — an unhurried animal.
    const s = (time / 200) % 1;
    path.getPointAt(s, at);
    path.getPointAt((s + 0.004) % 1, ahead);
    at.y += Math.sin(time * 0.11 + phase) * 0.5;
    mesh.position.copy(at);
    const heading = Math.atan2(ahead.x - at.x, ahead.z - at.z);
    mesh.rotation.set(
      Math.sin(time * 0.07 + phase) * 0.04,
      heading,
      // The slow scull: the whole coin rocks as the fins beat.
      Math.sin(time * 0.35 + phase) * 0.07,
    );
    // The jacks ride in the mola's own frame: a little ahead, a metre or
    // two off each flank, bobbing on their own beat.
    for (const [i, jack] of jackSpecs.entries()) {
      const rightX = Math.cos(heading);
      const rightZ = -Math.sin(heading);
      const aheadX = Math.sin(heading);
      const aheadZ = Math.cos(heading);
      jackDummy.position.set(
        at.x + rightX * jack.side * jack.out + aheadX * jack.lead,
        at.y + jack.lift + Math.sin(time * 0.9 + jack.bobPhase) * 0.25,
        at.z + rightZ * jack.side * jack.out + aheadZ * jack.lead,
      );
      jackDummy.rotation.set(0, heading, Math.sin(time * 1.3 + jack.bobPhase) * 0.08);
      jackDummy.scale.setScalar(jack.scale);
      jackDummy.updateMatrix();
      jacks.setMatrixAt(i, jackDummy.matrix);
    }
    jacks.instanceMatrix.needsUpdate = true;
  };

  pose(PATROL_PHASE);

  let slowTime = PATROL_PHASE;
  let last: number | null = null;
  return {
    mesh,
    jacks,
    target,
    update(time: number, reducedMotion: boolean): void {
      // Lazy first sample: `last = 0` here once made the first update jump
      // slowTime to the page's whole global time, handing the patrol's
      // phase to the load history.
      const dt = last === null ? 0 : Math.max(0, time - last);
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
