import { BufferAttribute, Color, Group, IcosahedronGeometry, InstancedMesh, Object3D } from "three";
import { smoothNormals } from "../../../rendering/SmoothNormals";
import { createToonMaterial } from "../../../rendering/ToonShading";
import { Random, SEEDS } from "../../../util/Random";
import { fbm } from "../../../rendering/ProceduralTexture";
import { seabedHeight, type ContactPatch } from "../../Seabed";
import { wedgeHalfAt } from "../WingGeometry";
import type { WingDef, WingFlora } from "../WingTypes";
import { VentSpringsBubbles, type VentSource } from "./VentSpringsBubbles";
import { applyVeinGlow, chimneyGeometry } from "./VentSpringsChimneys";
import { mountGateVeil } from "./GateVeilMount";

/**
 * Wing 4 — the Vent Springs. Otherworldly warmth: mineral chimneys on a
 * charcoal floor, thin columns of shimmer above them, and amber held in
 * the gloom.
 *
 * The field is four clusters standing off the wing's axis, alternating
 * flanks, so the descent corridor the ember moray owns runs between banks
 * of warm silhouettes — the canyon's fronds-off-the-corridor argument, one
 * biome hotter. That corridor is a hard rule here: the den sits on the
 * axis around r 40–43 and another worker's animal approaches down it, so
 * every piece in this wing — chimney, stone, fissure and the bubbles above
 * them — keeps its whole footprint at least 0.06 rad off the axis for
 * r 30–46, and the gate corridor (r 30–34) holds nothing at all.
 *
 * Five draw calls: three chimney archetypes instanced across the clusters,
 * one instanced amber-stone field, one instanced bubble system. The
 * chimneys' amber veins and the stones' warm cores carry the only
 * emissive in the wing, both shaped by their vertex bakes and both far
 * under the bloom threshold.
 */

/** The chimney field: radial stations, alternating flanks off the axis. */
const CLUSTERS = [
  { r: 38.2, side: 1 },
  { r: 40.8, side: -1 },
  { r: 43.4, side: 1 },
  { r: 45.8, side: -1 },
] as const;

/** Flat fissures that breathe without a chimney over them. */
const FISSURES = [
  { r: 36.6, side: -1 },
  { r: 39.4, side: 1 },
  { r: 44.6, side: -1 },
] as const;

const STONE_COUNT = 12;
const BUBBLE_COUNT = 120;

export function buildVentSpringsFlora(def: WingDef): WingFlora {
  const group = new Group();
  group.name = "vent-springs-flora";
  const random = new Random(SEEDS.wingVentSprings);
  const contacts: ContactPatch[] = [];
  const vents: VentSource[] = [];

  const axisX = Math.cos(def.azimuth);
  const axisZ = Math.sin(def.azimuth);
  const perpX = -axisZ;
  const perpZ = axisX;

  /**
   * The corridor rule, as a lateral distance in metres: 0.06 rad off the
   * axis for the whole radial run the den's approach crosses, plus the
   * piece's own footprint — and inside the gate corridor, never nearer
   * than the doorway's swimmable width either.
   */
  const minLateral = (r: number, itemRadius: number): number =>
    Math.max(r * 0.06, r < 34.5 ? 1.6 : 0) + itemRadius;

  const solveLateral = (
    r: number,
    side: number,
    drawn: number,
    itemRadius: number,
  ): number => {
    const low = minLateral(r, itemRadius);
    const high = wedgeHalfAt(def, r) * r - itemRadius * 0.6;
    return side * Math.min(Math.max(drawn, low), Math.max(low, high));
  };

  // ── The chimneys. ──
  // Three archetype geometries, instanced: the field reads as fourteen
  // chimneys, the GPU sees three shapes.
  const chimneyMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0xff8c3a,
    emissiveIntensity: 0.34,
  });
  applyVeinGlow(chimneyMaterial);

  const archetypes = [0, 1, 2].map((variant) =>
    chimneyGeometry(SEEDS.wingVentSprings ^ 0x7a11, variant),
  );
  // Drawn up front so a count tune never re-rolls what a cluster drew.
  const perCluster = CLUSTERS.map(() => 3 + (random.next() < 0.5 ? 1 : 0));
  // Each archetype's arena: its share of the whole field plus slack, so no
  // cluster's variant draw can overrun the mesh it lands in.
  const totalChimneys = perCluster.reduce((sum, count) => sum + count, 0);
  const perArchetype = Math.ceil(totalChimneys / archetypes.length) + 2;
  const chimneys = archetypes.map(
    (geometry) => new InstancedMesh(geometry, chimneyMaterial, perArchetype),
  );
  for (const mesh of chimneys) {
    mesh.name = "vent-chimneys";
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  const dummy = new Object3D();
  const color = new Color();
  const counts = [0, 0, 0];

  for (const [clusterIndex, cluster] of CLUSTERS.entries()) {
    for (let c = 0; c < perCluster[clusterIndex]!; c++) {
      const variant = Math.floor(random.next() * archetypes.length);
      const scaleR = random.range(0.72, 1.2);
      const scaleH = random.range(1.5, 2.9);
      const r = cluster.r + random.signed(1.1);
      // The footprint a chimney needs off the axis: its fattest ring.
      const itemRadius = scaleR * 1.25;
      const lateral = solveLateral(r, cluster.side, random.range(2.4, 4.4), itemRadius);
      const yaw = random.range(0, Math.PI * 2);
      const squash = random.range(0.85, 1);
      const warm = random.range(0.9, 1.05);
      const mid = random.range(0.85, 1);
      const cool = random.range(0.8, 0.95);
      const value = random.range(0.8, 1.1);

      const x = axisX * r + perpX * lateral;
      const z = axisZ * r + perpZ * lateral;
      const foot = seabedHeight(x, z);
      dummy.position.set(x, foot - 0.06, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(scaleR, scaleH, scaleR * squash);
      dummy.updateMatrix();

      const mesh = chimneys[variant]!;
      const index = counts[variant]!;
      mesh.setMatrixAt(index, dummy.matrix);
      color.setRGB(warm, mid, cool).multiplyScalar(value);
      mesh.setColorAt(index, color);
      counts[variant] = index + 1;

      contacts.push({ x, z, radius: itemRadius * 1.9, strength: 0.45 });
      // The mouth breathes: a bubble source at the crater rim.
      vents.push({ x, y: foot + scaleH * 0.98, z });
    }
  }

  // The fissures: flat vents breathing between the clusters.
  for (const fissure of FISSURES) {
    const lateral = solveLateral(fissure.r, fissure.side, random.range(2.6, 3.6), 0.35);
    const x = axisX * fissure.r + perpX * lateral;
    const z = axisZ * fissure.r + perpZ * lateral;
    vents.push({ x, y: seabedHeight(x, z) + 0.08, z });
  }

  // Park the instances a cluster did not take.
  dummy.position.set(0, -200, 0);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.setScalar(0.0001);
  dummy.updateMatrix();
  for (const [variant, mesh] of chimneys.entries()) {
    for (let i = counts[variant]!; i < perArchetype; i++) {
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }

  // ── The amber accent stones. ──
  // Heat-worn lumps holding the floor's warm note between the clusters:
  // smooth water-and-mineral-worn icosahedra, baked pale at the crown,
  // glowing faintly from their own bake like the chimneys do.
  const stoneGeometry = new IcosahedronGeometry(1, 1);
  roughenStone(stoneGeometry, SEEDS.wingVentSprings ^ 0x3c5a);
  smoothNormals(stoneGeometry);
  bakeStone(stoneGeometry);
  const stoneMaterial = createToonMaterial({
    vertexColors: true,
    emissive: 0xff9a44,
    emissiveIntensity: 0.16,
  });
  applyVeinGlow(stoneMaterial);
  const stones = new InstancedMesh(stoneGeometry, stoneMaterial, STONE_COUNT);
  stones.name = "vent-amber-stones";
  stones.castShadow = false;
  stones.receiveShadow = true;
  for (let i = 0; i < STONE_COUNT; i++) {
    const r = random.range(35.5, 46);
    const side = random.next() < 0.5 ? -1 : 1;
    const scale = random.range(0.24, 0.58);
    const lateral = solveLateral(r, side, random.range(1.8, 4.2), scale * 1.1);
    const x = axisX * r + perpX * lateral;
    const z = axisZ * r + perpZ * lateral;
    dummy.position.set(x, seabedHeight(x, z) - scale * 0.35, z);
    dummy.rotation.set(random.signed(0.4), random.range(0, Math.PI * 2), random.signed(0.4));
    dummy.scale.set(scale, scale * random.range(0.7, 1), scale);
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
    color.setRGB(random.range(0.9, 1.05), random.range(0.85, 1), random.range(0.8, 0.95));
    stones.setColorAt(i, color);
  }
  stones.instanceMatrix.needsUpdate = true;
  if (stones.instanceColor) {
    stones.instanceColor.needsUpdate = true;
  }
  stones.computeBoundingSphere();
  group.add(stones);

  // ── The shimmer columns. ──
  const bubbles = new VentSpringsBubbles(vents, BUBBLE_COUNT, SEEDS.wingVentSprings ^ 0x5b22);
  group.add(bubbles.mesh);

  // ── The gate veil (connective-1). ──
  // The end wall dressed with the Smoulder's own inks — charcoal-rust
  // silhouettes and a warm amber column, light from BELOW held warm and
  // rising per the province's register. The doorway is kept narrow and a
  // half-metre deeper than the others so the mote drift stays wholly past
  // r 46 — the den corridor law reads every vertex under that radius.
  // Appended after every existing draw, on its own `^` substream.
  const veil = mountGateVeil(def, {
    doorR: 48.9,
    width: 4.6,
    height: 5,
    palette: [0x2c1c14, 0x513226, 0x7a5138],
    column: { tint: 0xffc27a, opacity: 0.11 },
    particulate: { tint: 0xffb680, count: 70 },
  });
  group.add(veil.group);

  return {
    group,
    contacts,
    update(dt: number, reducedMotion: boolean): void {
      bubbles.update(dt, reducedMotion);
      veil.update(dt, reducedMotion);
    },
  };
}

/** Water-and-mineral-worn: gentle radial noise, nothing like the chimneys' tooth. */
function roughenStone(geometry: IcosahedronGeometry, seed: number): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const lump =
      fbm(x * 0.5 + 0.5, z * 0.5 + y * 0.3, { seed, period: 3, octaves: 2 }) - 0.5;
    const scale = 1 + lump * 0.3;
    position.setXYZ(i, x * scale, y * (1 + lump * 0.2), z * scale);
  }
  position.needsUpdate = true;
}

/** Pale warm crown over a deep amber base — a stone that holds heat. */
function bakeStone(geometry: IcosahedronGeometry): void {
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }
  const colors = new Float32Array(position.count * 3);
  const base = new Color(0x7a4218);
  const crown = new Color(0xc28a4a);
  const tint = new Color();
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, Math.max(0, position.getY(i) * 0.5 + 0.5));
    tint.copy(base).lerp(crown, t * t);
    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
}
