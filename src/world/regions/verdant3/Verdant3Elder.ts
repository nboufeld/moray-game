import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Mesh,
  Vector3,
} from "three";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import type { DiscoveryTarget } from "../../../discovery/DiscoverySystem";
import { smoothstep01 } from "./Verdant3Shared";

/**
 * THE ELDERLEAF — the Canopy Deep's findable resident, the province's
 * elder: the Kelp Weaver braids, the Terrace Warden keeps — the
 * Elderleaf REMEMBERS. A great leafy sea-dragon spirit, old as the
 * first canopy, whose body has grown its own garden: nine leaf-vanes
 * ride its spine and belly like drifting fronds, so at rest it reads as
 * a torn piece of the canopy come loose — until it turns.
 *
 * It patrols a slow rose-curve through the Hollow Mesa's curtained
 * mouth: out into the shade meadow, a drifting bank around the drape
 * hems, back through the green into the secret shaft's light and out
 * again. The body is the province's proven live-posed tube (the
 * weaver/warden trick, third generation): fixed topology, positions
 * rewritten each frame, no randomness spent after build.
 *
 * The discovery target sits at the curtain's part; the patrol carries
 * the head through it twice a loop, so a diver who has found the secret
 * and hangs in the mouth's green is watching the animal.
 */

const SEED = SEEDS.regionVerdant3;

const RINGS = 30;
const SIDES = 6;
const VANES = 9;
/** The patrol's loop, in seconds — an elder is never hurried. */
const LOOP_SECONDS = 38;
/** How much of the loop the body occupies, nose to tail. */
const BODY_SPAN = 0.3;

export const ELDER_SPECIES_ID = "canopy-elderleaf";

export interface ElderBuild {
  readonly mesh: Mesh;
  readonly target: DiscoveryTarget;
  update(time: number, reducedMotion: boolean): void;
}

export function buildElderleaf(anchor: {
  x: number;
  y: number;
  z: number;
  facing: number;
}): ElderBuild {
  const random = new Random(SEED ^ 0x0ee3);
  const phase = random.range(0, Math.PI * 2);

  // The patrol: a flattened rose through the curtain's part — out over
  // the meadow, a slow bank, back through the green into the shaft.
  const cosF = Math.cos(anchor.facing);
  const sinF = Math.sin(anchor.facing);
  const pathAt = (t: number, out: Vector3): Vector3 => {
    const theta = t * Math.PI * 2;
    const r = 2.8 + 0.9 * Math.sin(theta * 2 + phase);
    const lx = Math.cos(theta) * r * 1.3;
    const lz = Math.sin(theta) * r * 0.85;
    out.set(
      anchor.x + lx * cosF - lz * sinF,
      anchor.y + 1.0 + 0.6 * Math.sin(theta * 3 + phase * 0.7),
      anchor.z + lx * sinF + lz * cosF,
    );
    return out;
  };

  const geometry = buildBody();
  const material = createToonMaterial({ vertexColors: true });
  const mesh = new Mesh(geometry, material);
  mesh.name = "verdant3-elderleaf";
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;

  const target: DiscoveryTarget = {
    speciesId: ELDER_SPECIES_ID,
    position: new Vector3(anchor.x, anchor.y + 1.1, anchor.z),
  };

  const position = geometry.attributes.position as BufferAttribute;
  const at = new Vector3();
  const ahead = new Vector3();
  const tangent = new Vector3();
  const side = new Vector3();
  const lift = new Vector3();
  const up = new Vector3(0, 1, 0);

  const pose = (time: number): void => {
    const head = (time / LOOP_SECONDS) % 1;
    for (let ring = 0; ring < RINGS; ring++) {
      const along = ring / (RINGS - 1);
      const s = (((head - along * BODY_SPAN) % 1) + 1) % 1;
      pathAt(s, at);
      pathAt((s + 0.01) % 1, ahead);
      tangent.subVectors(ahead, at).normalize();
      side.crossVectors(tangent, up).normalize();
      lift.crossVectors(side, tangent).normalize();

      const radius = bodyRadius(along);
      for (let i = 0; i < SIDES; i++) {
        const a = (i / SIDES) * Math.PI * 2;
        const idx = ring * SIDES + i;
        position.setXYZ(
          idx,
          at.x + (side.x * Math.cos(a) + lift.x * Math.sin(a)) * radius,
          at.y + (side.y * Math.cos(a) + lift.y * Math.sin(a)) * radius * 1.1,
          at.z + (side.z * Math.cos(a) + lift.z * Math.sin(a)) * radius,
        );
      }
    }

    // The leaf-vanes: nine drifting frond blades seated along the spine
    // and belly, each a two-triangle strip standing off the body on a
    // stalk, trailing the swim like weed in current.
    for (let f = 0; f < VANES; f++) {
      const along = 0.12 + (f / (VANES - 1)) * 0.78;
      const s = (((head - along * BODY_SPAN) % 1) + 1) % 1;
      pathAt(s, at);
      pathAt((s + 0.01) % 1, ahead);
      tangent.subVectors(ahead, at).normalize();
      side.crossVectors(tangent, up).normalize();
      lift.crossVectors(side, tangent).normalize();

      const belly = f % 3 === 2 ? -1 : 1;
      const sideLean = f % 2 === 0 ? 0.5 : -0.5;
      const radius = bodyRadius(along);
      const reach = 0.42 + 0.2 * Math.sin(f * 1.7 + phase);
      const sway = Math.sin(time * 0.7 + f * 1.3 + phase) * 0.1;
      const rootX = at.x + lift.x * radius * belly * 0.9 + side.x * sideLean * radius;
      const rootY = at.y + lift.y * radius * belly * 0.9;
      const rootZ = at.z + lift.z * radius * belly * 0.9 + side.z * sideLean * radius;
      const base = RINGS * SIDES + f * 3;
      position.setXYZ(base, rootX, rootY, rootZ);
      position.setXYZ(
        base + 1,
        rootX + lift.x * reach * belly * 0.7 - tangent.x * (reach * 0.5 + sway) + side.x * sideLean * 0.3,
        rootY + lift.y * reach * belly * 0.7 + Math.abs(sway) * 0.2,
        rootZ + lift.z * reach * belly * 0.7 - tangent.z * (reach * 0.5 + sway) + side.z * sideLean * 0.3,
      );
      position.setXYZ(
        base + 2,
        rootX + lift.x * reach * belly - tangent.x * (reach + sway),
        rootY + lift.y * reach * belly,
        rootZ + lift.z * reach * belly - tangent.z * (reach + sway),
      );
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };

  pose(0);
  geometry.computeBoundingSphere();
  // The patrol never leaves the anchor's reach; one honest sphere.
  geometry.boundingSphere!.center.set(anchor.x, anchor.y + 1.1, anchor.z);
  geometry.boundingSphere!.radius = 6.5;

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

/** Long tapered dragon body: fine snout, deep chest, ribbon tail. */
function bodyRadius(along: number): number {
  const snout = smoothstep01(along / 0.06);
  const chest = 1 + 0.4 * Math.exp(-Math.pow((along - 0.22) / 0.14, 2));
  const taper = 1 - smoothstep01((along - 0.35) / 0.65) * 0.88;
  return 0.2 * snout * chest * taper + 0.012;
}

function buildBody(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertexCount = RINGS * SIDES + VANES * 3;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const jade = new Color(0x5f9e6e);
  const celadon = new Color(0xaed2a4);
  const bark = new Color(0x4a6a50);
  const gold = new Color(0xd8b95c);
  const maskViolet = new Color(0x5c4f72);
  const shade = new Color();

  for (let ring = 0; ring < RINGS; ring++) {
    const along = ring / (RINGS - 1);
    // Old-growth banding down the body — moss over bark, the darkest
    // mark leaning violet.
    const band = Math.max(0, Math.sin(along * Math.PI * 9 + 1.1)) ** 3 * 0.7 * (1 - along * 0.3);
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      const bellyMix = smoothstep01((Math.sin(a) * -1 + 0.4) / 1.2);
      shade.copy(jade).lerp(celadon, bellyMix);
      shade.lerp(bark, band * (1 - bellyMix * 0.8));
      if (band > 0.4) {
        shade.r = Math.min(1, shade.r * 1.12);
        shade.b = Math.min(1, shade.b * 1.22);
      }
      if (along < 0.08) {
        shade.lerp(maskViolet, (1 - along / 0.08) * 0.5);
      }
      const idx = ring * SIDES + i;
      colors[idx * 3] = shade.r;
      colors[idx * 3 + 1] = shade.g;
      colors[idx * 3 + 2] = shade.b;
    }
  }
  // The vanes: jade at the root, bright leaf-gold at the drifting tip.
  for (let f = 0; f < VANES; f++) {
    const base = RINGS * SIDES + f * 3;
    for (const [k, mix] of [0.1, 0.6, 1].entries()) {
      shade.copy(jade).lerp(gold, mix).multiplyScalar(0.9 + mix * 0.3);
      colors[(base + k) * 3] = shade.r;
      colors[(base + k) * 3 + 1] = shade.g;
      colors[(base + k) * 3 + 2] = shade.b;
    }
  }

  // Tube strips.
  for (let ring = 0; ring < RINGS - 1; ring++) {
    const a = ring * SIDES;
    const b = a + SIDES;
    for (let i = 0; i < SIDES; i++) {
      const next = (i + 1) % SIDES;
      indices.push(a + i, a + next, b + i);
      indices.push(a + next, b + next, b + i);
    }
  }
  // The vanes: one two-sided triangle each, doubled winding.
  for (let f = 0; f < VANES; f++) {
    const base = RINGS * SIDES + f * 3;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 2, base + 1, base);
  }

  const positionAttribute = new BufferAttribute(positions, 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}
