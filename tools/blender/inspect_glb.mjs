/**
 * Reports what a built GLB actually contains, without a browser.
 *
 *   node tools/blender/inspect_glb.mjs public/assets/models/coral-brain.glb
 *
 * It exists for one measurement in particular. `COLOR_0` is the only channel
 * these models carry into the game, and the whole question of whether it is
 * sRGB or linear is decided by what Blender's exporter writes — not by what
 * either end's documentation says. This prints the accessor's component type
 * and its value range, which is the evidence the `perceived()` helper in
 * `coral_common.py` is derived against: a vertex painted at 0.80 perceived
 * should arrive here at about 0.61.
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node tools/blender/inspect_glb.mjs <file.glb>");
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
  5126: [Float32Array, 1],
};
const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

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
  return { accessor, values: Array.from(raw, (v) => (accessor.normalized ? v / scale : v / scale)) };
}

for (const mesh of json.meshes) {
  for (const primitive of mesh.primitives) {
    const position = json.accessors[primitive.attributes.POSITION];
    console.info(`${mesh.name}: ${position.count} verts, ${json.accessors[primitive.indices].count / 3} tris`);
    console.info(`  bounds min ${position.min.map((v) => v.toFixed(3)).join(", ")}`);
    console.info(`  bounds max ${position.max.map((v) => v.toFixed(3)).join(", ")}`);
    console.info(`  attributes: ${Object.keys(primitive.attributes).join(", ")}`);

    const colorIndex = primitive.attributes.COLOR_0;
    if (colorIndex === undefined) {
      console.info("  COLOR_0: absent");
      continue;
    }
    const color = read(colorIndex);
    const accessor = color.accessor;
    const stride = SIZES[accessor.type];
    const channel = (c) => {
      const out = [];
      for (let i = c; i < color.values.length; i += stride) {
        out.push(color.values[i]);
      }
      return out;
    };
    console.info(
      `  COLOR_0: ${accessor.type} ${COMPONENTS[accessor.componentType]}` +
        `${accessor.normalized ? " normalized" : ""}, ${accessor.count} entries`,
    );
    for (const [name, c] of [["r", 0], ["g", 1], ["b", 2]]) {
      const values = channel(c);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      console.info(
        `    ${name}: min ${Math.min(...values).toFixed(4)} max ${Math.max(...values).toFixed(4)}` +
          ` mean ${mean.toFixed(4)}`,
      );
    }
  }
}
