/**
 * Reports what a built creature GLB actually contains, without a browser.
 *
 *   node tools/blender/creatures/inspect_creature.mjs public/assets/models/creature-shrimp.glb
 *
 * Modelled on tools/blender/inspect_glb.mjs and extended for the atelier's
 * three extra claims, which are exactly the ones an integrator cannot check
 * from a screenshot:
 *
 * - **Skins and joints.** glTF has no named vertex groups, only skins, so the
 *   contract "there is a bone called `jaw`" is a claim about the skin's joint
 *   list. This prints every skin's joints by name, each joint's origin in
 *   model space (the node hierarchy's composed translation) and the direction
 *   its local +Y points in model space — a Blender bone rotates its content
 *   about its own local axes, so that direction *is* the articulation axis an
 *   integrator will rotate about.
 * - **UV bounds.** The moray head band contract is `u in [0, 0.5]`,
 *   `v in [0, 0.12]`; a projection bug shows up here as a bound, not a look.
 * - **Weight sums.** `WEIGHTS_0` must sum to 1 per vertex; a vertex weighted
 *   to nothing is drawn at the skeleton origin, silently.
 *
 * COLOR_0 statistics are kept from the original: the vertex-colour round trip
 * (sRGB byte authored -> linear in the accessor) is measured, never assumed.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node tools/blender/creatures/inspect_creature.mjs <file.glb>");
  process.exit(1);
}

const buffer = readFileSync(file);
const magic = buffer.readUInt32LE(0);
if (magic !== 0x46546c67) {
  throw new Error("not a GLB");
}

let offset = 12;
let json = null;
let bin = null;
while (offset < buffer.length) {
  const length = buffer.readUInt32LE(offset);
  const type = buffer.readUInt32LE(offset + 4);
  const body = buffer.subarray(offset + 8, offset + 8 + length);
  if (type === 0x4e4f534a) {
    json = JSON.parse(body.toString("utf8"));
  } else if (type === 0x004e4942) {
    bin = body;
  }
  offset += 8 + length + ((4 - (length % 4)) % 4);
}

const COMPONENTS = { 5120: "byte", 5121: "ubyte", 5122: "short", 5123: "ushort", 5125: "uint", 5126: "float" };
const READERS = {
  5121: [Uint8Array, 255],
  5123: [Uint16Array, 65535],
  5125: [Uint32Array, 1],
  5126: [Float32Array, 1],
};
const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function read(index) {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  const [Kind, scale] = READERS[accessor.componentType] ?? [];
  if (!Kind) {
    return null;
  }
  const count = accessor.count * SIZES[accessor.type];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const raw = new Kind(bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + count * Kind.BYTES_PER_ELEMENT));
  return { accessor, values: Array.from(raw, (v) => (accessor.normalized ? v / scale : v)) };
}

// ---------------------------------------------------------------------------
// node hierarchy: composed global transforms, so a joint's origin and axes can
// be reported in model space rather than in whatever frame Blender parked it.

function quatToMatrix([x, y, z, w]) {
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
    2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y),
  ];
}

function localMatrix(node) {
  if (node.matrix) {
    const m = node.matrix;
    return { rot: [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]], pos: [m[12], m[13], m[14]] };
  }
  const t = node.translation ?? [0, 0, 0];
  const r = quatToMatrix(node.rotation ?? [0, 0, 0, 1]);
  const s = node.scale ?? [1, 1, 1];
  return {
    rot: [r[0] * s[0], r[1] * s[0], r[2] * s[0], r[3] * s[1], r[4] * s[1], r[5] * s[1], r[6] * s[2], r[7] * s[2], r[8] * s[2]],
    pos: t,
  };
}

function compose(parent, child) {
  const a = parent.rot;
  const b = child.rot;
  const rot = [];
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      rot[col * 3 + row] = a[row] * b[col * 3] + a[3 + row] * b[col * 3 + 1] + a[6 + row] * b[col * 3 + 2];
    }
  }
  const p = child.pos;
  const pos = [
    parent.pos[0] + a[0] * p[0] + a[3] * p[1] + a[6] * p[2],
    parent.pos[1] + a[1] * p[0] + a[4] * p[1] + a[7] * p[2],
    parent.pos[2] + a[2] * p[0] + a[5] * p[1] + a[8] * p[2],
  ];
  return { rot, pos };
}

const IDENTITY = { rot: [1, 0, 0, 0, 1, 0, 0, 0, 1], pos: [0, 0, 0] };
const globals = new Array(json.nodes?.length ?? 0);
function walk(index, parent) {
  const node = json.nodes[index];
  const global = compose(parent, localMatrix(node));
  globals[index] = global;
  for (const child of node.children ?? []) {
    walk(child, global);
  }
}
for (const sceneIndex of json.scenes?.[json.scene ?? 0]?.nodes ?? []) {
  walk(sceneIndex, IDENTITY);
}

const fmt = (v) => v.map((x) => (Math.abs(x) < 5e-4 ? "0.000" : x.toFixed(3))).join(", ");

console.info(`nodes: ${(json.nodes ?? []).map((n) => n.name ?? "?").join(", ")}`);

for (const [skinIndex, skin] of (json.skins ?? []).entries()) {
  console.info(`skin ${skinIndex} (${skin.joints.length} joints):`);
  for (const [slot, jointIndex] of skin.joints.entries()) {
    const node = json.nodes[jointIndex];
    const g = globals[jointIndex] ?? localMatrix(node);
    // A bone's articulation axis is its local +Y expressed in model space —
    // column 1 of the composed rotation.
    const localY = [g.rot[3], g.rot[4], g.rot[5]];
    const localX = [g.rot[0], g.rot[1], g.rot[2]];
    console.info(
      `  joint[${slot}] "${node.name}": origin (${fmt(g.pos)}), local +Y -> (${fmt(localY)}), local +X -> (${fmt(localX)})`,
    );
  }
}

for (const mesh of json.meshes) {
  for (const primitive of mesh.primitives) {
    const position = json.accessors[primitive.attributes.POSITION];
    console.info(`${mesh.name}: ${position.count} verts, ${json.accessors[primitive.indices].count / 3} tris`);
    console.info(`  bounds min ${position.min.map((v) => v.toFixed(4)).join(", ")}`);
    console.info(`  bounds max ${position.max.map((v) => v.toFixed(4)).join(", ")}`);
    console.info(`  attributes: ${Object.keys(primitive.attributes).join(", ")}`);

    const uvIndex = primitive.attributes.TEXCOORD_0;
    if (uvIndex !== undefined) {
      const uv = read(uvIndex);
      const us = uv.values.filter((_, i) => i % 2 === 0);
      const vs = uv.values.filter((_, i) => i % 2 === 1);
      console.info(
        `  TEXCOORD_0: u=[${Math.min(...us).toFixed(4)}, ${Math.max(...us).toFixed(4)}]` +
          ` v=[${Math.min(...vs).toFixed(4)}, ${Math.max(...vs).toFixed(4)}]`,
      );
    } else {
      console.info("  TEXCOORD_0: absent");
    }

    const colorIndex = primitive.attributes.COLOR_0;
    if (colorIndex !== undefined) {
      const color = read(colorIndex);
      const accessor = color.accessor;
      const stride = SIZES[accessor.type];
      console.info(
        `  COLOR_0: ${accessor.type} ${COMPONENTS[accessor.componentType]}` +
          `${accessor.normalized ? " normalized" : ""}, ${accessor.count} entries`,
      );
      for (const [name, c] of [["r", 0], ["g", 1], ["b", 2]]) {
        const values = [];
        for (let i = c; i < color.values.length; i += stride) {
          values.push(color.values[i]);
        }
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        console.info(
          `    ${name}: min ${Math.min(...values).toFixed(4)} max ${Math.max(...values).toFixed(4)}` +
            ` mean ${mean.toFixed(4)}`,
        );
      }
    } else {
      console.info("  COLOR_0: absent");
    }

    const jointsIndex = primitive.attributes.JOINTS_0;
    const weightsIndex = primitive.attributes.WEIGHTS_0;
    if (jointsIndex !== undefined && weightsIndex !== undefined) {
      const joints = read(jointsIndex);
      const weights = read(weightsIndex);
      const skin = json.skins?.[0];
      const used = new Map();
      let worstSum = 1;
      for (let vertex = 0; vertex < position.count; vertex++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          const w = weights.values[vertex * 4 + k];
          sum += w;
          if (w > 0) {
            const slot = joints.values[vertex * 4 + k];
            const name = skin ? json.nodes[skin.joints[slot]].name : `#${slot}`;
            used.set(name, (used.get(name) ?? 0) + 1);
          }
        }
        if (Math.abs(sum - 1) > Math.abs(worstSum - 1)) {
          worstSum = sum;
        }
      }
      console.info(`  WEIGHTS_0: worst per-vertex sum ${worstSum.toFixed(4)}`);
      console.info(
        `  joints used: ${[...used.entries()].map(([name, count]) => `${name} (${count} verts)`).join(", ")}`,
      );
    } else {
      console.info("  skin attributes: absent");
    }
  }
}
