import {
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { requestModel } from "../../rendering/AssetLibrary";
import { createToonMaterial } from "../../rendering/ToonShading";
import { Random, SEEDS } from "../../util/Random";
import { coralFeedingSites } from "../../world/CoralField";
import type { LifeContext } from "../life/LifeSystem";
import { FaunaSystem, paintVertices } from "./FaunaSystem";

/**
 * How much larger than life the shrimp render.
 *
 * The GLB is authored at the animal's true 50 mm, and at that size it is
 * sub-pixel from every distance this game is played at — CREATURES.md sizes it
 * "to render at ~10 px", which assumes a camera far closer than the reef's.
 * 2.75× puts the body at ~14 cm: still the smallest animal in the reef by a
 * wide margin, big enough that its red bands survive to a handful of pixels
 * from the tidepool camera. Storybook legibility over field-guide accuracy,
 * the same trade the whole art direction makes.
 */
const SHRIMP_SCALE = 2.75;

/** How many of the coral feeding sites host a cleaning station. */
const STATION_COUNT = 5;

/** Seconds a shrimp picks at its perch between darts. */
const SIT_RANGE: readonly [number, number] = [6, 14];
const DART_SECONDS = 0.35;

interface ShrimpState {
  readonly rng: Random;
  readonly siteX: number;
  readonly siteY: number;
  readonly siteZ: number;
  x: number;
  y: number;
  z: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  toX: number;
  toY: number;
  toZ: number;
  yaw: number;
  darting: boolean;
  timer: number;
  duration: number;
}

/**
 * Cleaner shrimp at the coral feeding sites: tiny banded animals that perch on
 * the heads, rock through a picking motion, and occasionally dart a hand's
 * width to a new station. One instanced mesh wearing the GLB when it lands and
 * a banded procedural stand-in until then (and forever, in the no-assets
 * build) — the repo's one-door asset contract, one asset class over.
 */
export class Shrimp extends FaunaSystem {
  private mesh: InstancedMesh | null = null;
  private readonly shrimp: ShrimpState[] = [];
  private readonly dummy = new Object3D();

  constructor(seed: number = SEEDS.shrimp) {
    super("shrimp", seed);
  }

  protected build(): void {
    const random = new Random(this.seed);
    const sites = coralFeedingSites();

    // Draw the stations without replacement, then one or two shrimp each.
    const pool = sites.map((_, index) => index);
    const stations: number[] = [];
    while (stations.length < Math.min(STATION_COUNT, pool.length)) {
      const pick = Math.floor(random.next() * pool.length);
      stations.push(...pool.splice(pick, 1));
    }

    const perStation = stations.map(() => (random.next() < 0.45 ? 2 : 1));
    const total = perStation.reduce((sum, count) => sum + count, 0);

    const material = this.own(createToonMaterial({ vertexColors: true }));
    const mesh = this.ownInstanced(
      new InstancedMesh(this.own(createShrimpFallback()), material, total),
    );
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // The instances hop between perches; see the crabs for why culling is off.
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh = mesh;
    this.group.add(mesh);

    // The painted animal, when it arrives. The stand-in geometry stays owned
    // by this system and is disposed on teardown; the GLB is the library's,
    // shared with any future caller, and must never be disposed here.
    requestModel("models/creature-shrimp.glb", (geometry) => {
      mesh.geometry = geometry;
    });

    const color = new Color();
    let placed = 0;
    for (let s = 0; s < stations.length; s++) {
      const site = sites[stations[s]!]!;
      for (let k = 0; k < perStation[s]!; k++) {
        const rng = new Random((this.seed ^ ((placed + 1) * 0x85eb_ca6b)) >>> 0);
        const state: ShrimpState = {
          rng,
          siteX: site.x,
          siteY: site.y,
          siteZ: site.z,
          x: 0,
          y: 0,
          z: 0,
          fromX: 0,
          fromY: 0,
          fromZ: 0,
          toX: 0,
          toY: 0,
          toZ: 0,
          yaw: rng.range(0, Math.PI * 2),
          darting: false,
          timer: rng.range(1, SIT_RANGE[1]),
          duration: 1,
        };
        const perch = this.pickPerch(state);
        state.x = state.fromX = state.toX = perch[0];
        state.y = state.fromY = state.toY = perch[1];
        state.z = state.fromZ = state.toZ = perch[2];
        this.shrimp.push(state);

        // Nearly-white shell with a warm cast; the bands live in the vertex
        // colours, so the tint only breathes a little variety across the pods.
        color.setRGB(1, 0.97, 0.94).multiplyScalar(rng.range(0.9, 1.05));
        mesh.setColorAt(placed, color);
        this.pose(placed, state, 0, 0);
        placed++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  update(dt: number, ctx: LifeContext): void {
    const mesh = this.mesh;
    if (!mesh || dt <= 0) {
      return;
    }

    for (let i = 0; i < this.shrimp.length; i++) {
      const state = this.shrimp[i]!;
      state.timer -= dt;
      if (state.timer <= 0) {
        if (state.darting) {
          state.darting = false;
          state.x = state.toX;
          state.y = state.toY;
          state.z = state.toZ;
          state.duration = state.rng.range(SIT_RANGE[0], SIT_RANGE[1]);
          state.timer = state.duration;
        } else {
          const perch = this.pickPerch(state);
          state.darting = true;
          state.fromX = state.x;
          state.fromY = state.y;
          state.fromZ = state.z;
          state.toX = perch[0];
          state.toY = perch[1];
          state.toZ = perch[2];
          state.duration = DART_SECONDS;
          state.timer = state.duration;
          state.yaw = Math.atan2(perch[0] - state.x, perch[2] - state.z);
        }
      }

      let pick = 0;
      let hop = 0;
      if (state.darting) {
        const t = 1 - state.timer / state.duration;
        const ease = t * t * (3 - 2 * t);
        state.x = state.fromX + (state.toX - state.fromX) * ease;
        state.y = state.fromY + (state.toY - state.fromY) * ease;
        state.z = state.fromZ + (state.toZ - state.fromZ) * ease;
        // A shallow arc, so a dart is a hop and not a slide.
        hop = Math.sin(t * Math.PI) * 0.05;
      } else if (!ctx.reducedMotion) {
        // The picking: a small rocking nod on the perch.
        pick = Math.sin(ctx.time * Math.PI * 2 * 1.7 + state.yaw * 5) * 0.13;
      }
      this.pose(i, state, pick, hop);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** A perch: a hand's reach around the feeding site, in amongst the heads. */
  private pickPerch(state: ShrimpState): [number, number, number] {
    const angle = state.rng.range(0, Math.PI * 2);
    const reach = state.rng.range(0.15, 0.5);
    return [
      state.siteX + Math.cos(angle) * reach,
      // Below the site point more often than above: the site is the crown of
      // the cluster, and a cleaner works the flanks of the heads.
      state.siteY + state.rng.range(-0.35, 0.1),
      state.siteZ + Math.sin(angle) * reach,
    ];
  }

  private pose(index: number, state: ShrimpState, pick: number, hop: number): void {
    this.dummy.position.set(state.x, state.y + hop, state.z);
    this.dummy.rotation.set(pick, state.yaw, 0, "YXZ");
    this.dummy.scale.setScalar(SHRIMP_SCALE);
    this.dummy.updateMatrix();
    this.mesh?.setMatrixAt(index, this.dummy.matrix);
  }
}

/**
 * The stand-in shrimp, authored at the GLB's own true 50 mm so the instance
 * matrices mean the same thing whichever geometry is wearing them: a pale
 * ellipsoid body with three deep-red transverse bands and a red tail fan —
 * the same field marks CREATURES.md gives the painted animal, at a fraction
 * of the triangles. Linear vertex colours, matching the `COLOR_0` contract.
 */
function createShrimpFallback(): BufferGeometry {
  const body = new SphereGeometry(0.012, 6, 5);
  body.scale(0.85, 0.7, 2.2);
  body.translate(0, 0.012, 0.004);
  paintShrimpBands(body);

  const tail = new CylinderGeometry(0.001, 0.008, 0.012, 5, 1);
  tail.rotateX(Math.PI / 2);
  tail.translate(0, 0.01, -0.028);
  paintVertices(tail, 0.42, 0.05, 0.04);

  const merged = mergeGeometries([body, tail], false);
  body.dispose();
  tail.dispose();
  if (!merged) {
    const fallback = new SphereGeometry(0.012, 6, 5);
    fallback.scale(0.85, 0.7, 2.2);
    fallback.translate(0, 0.012, 0.004);
    paintShrimpBands(fallback);
    return fallback;
  }
  merged.computeBoundingSphere();
  return merged;
}

function paintShrimpBands(body: BufferGeometry): void {
  paintVertices(body, 0.9, 0.88, 0.84);
  const position = body.attributes.position;
  const color = body.attributes.color;
  if (!position || !color) {
    return;
  }
  for (let i = 0; i < position.count; i++) {
    const zn = (position.getZ(i) - 0.004) / 0.0264;
    const banded =
      (zn > -0.6 && zn < -0.35) || (zn > -0.05 && zn < 0.2) || (zn > 0.5 && zn < 0.75);
    if (banded) {
      color.setXYZ(i, 0.42, 0.05, 0.04);
    }
  }
}
