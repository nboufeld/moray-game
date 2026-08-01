import { BufferAttribute, Color, Group, IcosahedronGeometry, Mesh, Vector3 } from "three";
import { SEEDS } from "../../../util/Random";
import type { SphereCollider } from "../../CollisionField";
import { fbm } from "../../../rendering/ProceduralTexture";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { seabedHeight } from "../../Seabed";
import { buildBeamAndPool } from "../kit/BeamAndPool";
import { B3_SEEDS, smoothstep01 } from "./Blue3Shared";
import { ANCHOR, DAYMARK, DOORSTEP, PEARL, WELLHEAD, worldOf } from "./Blue3Terrain";

/**
 * The light of the First Sea — the province's law kept to the last
 * room: spent rarely, and all at once. The register is DAWN, not
 * night: the deepest region's lights are the world's first, and every
 * one of them leans a step rose off the province silver (cool-pale,
 * never Calamity-cold; nothing here burns).
 *
 * - **THE DAYBREAK** — the named light peak: one colossal beam falling
 *   the full 62 m of the world's deepest water into the Wellhead's
 *   bowl, onto its painted circle — the first light of the sea,
 *   standing where the water is born. The Morning Whale rises through
 *   it once a round.
 * - **The Daymark's blade** — the lone waymark at the Longfall's
 *   crest, lit thin — the Morning Shelf hush's one licensed mark.
 * - **The Anchor's pool** — a soft slanted finder on the great shape.
 * - **THE PEARL** — the secret: the sea's first pearl in its fold, a
 *   faint patient glow (≤ the glow cap; far under bloom), with its own
 *   thin finder blade.
 * - **The Doorstep rays** — two slanted dawn blades reaching over the
 *   Hem onto the world's last rise: the morning beyond the world,
 *   arriving.
 *
 * All marks ride the kit's four-part additive discipline.
 */

const SEED = SEEDS.regionBlue3;

export interface Blue3LightBuild {
  readonly groups: Group[];
  readonly colliders: SphereCollider[];
}

export function buildBlue3Light(): Blue3LightBuild {
  const groups: Group[] = [];
  const colliders: SphereCollider[] = [];

  // ── THE DAYBREAK ─────────────────────────────────────────────────────────
  const well = worldOf(WELLHEAD.u, WELLHEAD.v);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ B3_SEEDS.daybreak,
      tint: 0xf0e6da,
      ground: seabedHeight,
      beams: [
        {
          pos: [well.x, well.z],
          top: WELLHEAD.bowlFloor + 62,
          width: 7.5,
          opacity: 0.18,
          slant: [0.03, 0.04],
        },
      ],
      pools: [
        {
          pos: [well.x, well.z],
          radius: 8.5,
          opacity: 0.2,
        },
      ],
    }).group,
  );

  // ── The Daymark's blade ──────────────────────────────────────────────────
  const daymark = worldOf(DAYMARK.u + 1.2, DAYMARK.v + 1.5);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ B3_SEEDS.daymarkBlade,
      tint: 0xeee2da,
      ground: seabedHeight,
      beams: [
        {
          pos: [daymark.x, daymark.z],
          top: seabedHeight(daymark.x, daymark.z) + 12,
          width: 1.6,
          opacity: 0.08,
        },
      ],
    }).group,
  );

  // ── The Anchor's finder ──────────────────────────────────────────────────
  const anchorAt = worldOf(ANCHOR.u + 2, ANCHOR.v - 2);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ B3_SEEDS.anchorPool,
      tint: 0xe6e4de,
      ground: seabedHeight,
      beams: [
        {
          pos: [anchorAt.x, anchorAt.z],
          top: seabedHeight(anchorAt.x, anchorAt.z) + 18,
          width: 2.8,
          opacity: 0.1,
          slant: [0.06, -0.04],
        },
      ],
      pools: [
        {
          pos: [anchorAt.x, anchorAt.z],
          radius: 5,
          opacity: 0.16,
        },
      ],
    }).group,
  );

  // ── THE PEARL + its finder ───────────────────────────────────────────────
  const pearlGroup = new Group();
  pearlGroup.name = "firstsea-pearl";
  const pearlAt = worldOf(PEARL.u, PEARL.v);
  const pearlFloor = seabedHeight(pearlAt.x, pearlAt.z);
  pearlGroup.add(buildPearlMesh(pearlAt.x, pearlFloor, pearlAt.z));
  colliders.push({ center: new Vector3(pearlAt.x, pearlFloor + 0.8, pearlAt.z), radius: 1.35 });
  groups.push(pearlGroup);

  groups.push(
    buildBeamAndPool({
      seed: SEED ^ B3_SEEDS.pearlGlow,
      tint: 0xf2e8e0,
      ground: seabedHeight,
      beams: [
        {
          pos: [pearlAt.x + 0.6, pearlAt.z + 0.8],
          top: pearlFloor + 9,
          width: 1.2,
          opacity: 0.07,
        },
      ],
    }).group,
  );

  // ── The Doorstep rays ────────────────────────────────────────────────────
  const door = worldOf(DOORSTEP.u, DOORSTEP.v);
  const rayA = worldOf(DOORSTEP.u + 2, DOORSTEP.v + 6);
  groups.push(
    buildBeamAndPool({
      seed: SEED ^ B3_SEEDS.doorstepRays,
      tint: 0xf0ddd0,
      ground: seabedHeight,
      beams: [
        {
          pos: [door.x, door.z],
          top: seabedHeight(door.x, door.z) + 22,
          width: 3.2,
          opacity: 0.09,
          slant: [-0.14, 0.05],
        },
        {
          pos: [rayA.x, rayA.z],
          top: seabedHeight(rayA.x, rayA.z) + 18,
          width: 2.2,
          opacity: 0.08,
          slant: [-0.12, 0.08],
        },
      ],
    }).group,
  );

  return { groups, colliders };
}

/**
 * The sea's first pearl: a hand-rounded orb, painted — pale
 * star-bright crown over a violet under-shade with a faint iridescent
 * lean — glowing softly by vertex-ridden emissive (intensity 0.3,
 * far under the 0.36 cap and further under bloom).
 */
function buildPearlMesh(x: number, floor: number, z: number): Mesh {
  const geometry = new IcosahedronGeometry(1.15, 3);
  geometry.deleteAttribute("uv");
  const position = geometry.attributes.position!;
  // A hair of seeded irregularity: grown, not machined.
  for (let i = 0; i < position.count; i++) {
    const px = position.getX(i);
    const py = position.getY(i);
    const pz = position.getZ(i);
    const n = fbm(px * 0.5 + 9, pz * 0.5 + py * 0.3, { seed: SEED ^ B3_SEEDS.pearl, period: 3, octaves: 2 });
    const s = 1 + (n - 0.5) * 0.06;
    position.setXYZ(i, px * s, py * s, pz * s);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  smoothNormals(geometry);

  const colors = new Float32Array(position.count * 3);
  const crown = new Color(0xf2ece4);
  const under = new Color(0x9a88ae);
  const iris = new Color(0xdcc8c2);
  const shade = new Color();
  for (let i = 0; i < position.count; i++) {
    const py = position.getY(i);
    const t = smoothstep01((py + 1.15) / 2.3);
    shade.copy(under).lerp(crown, t);
    const band = Math.sin(position.getX(i) * 2.4 + py * 3.1);
    shade.lerp(iris, Math.max(0, band) * 0.22 * (1 - t * 0.5));
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = createToonMaterial({
    vertexColors: true,
    emissive: 0xcabfd2,
    emissiveIntensity: 0.3,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "firstsea-pearl-orb";
  mesh.position.set(x, floor + 0.75, z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
