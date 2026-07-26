"""Proof-of-pipeline: build a branching coral headlessly and export GLB.

Run:  blender --background --python tools/blender/proto_coral.py -- <out.glb>

Builds a recursive branching structure as a curve tree, skins it with a
Skin modifier, smooths it with Subdivision, bakes a two-tone vertex
colour (warm tips), and exports a single GLB mesh. Deterministic via a
fixed seed.
"""

import bpy
import math
import random
import sys

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/tmp/proto_coral.glb"
rng = random.Random(20260726)

# Clean scene
bpy.ops.wm.read_factory_settings(use_empty=True)


def grow(points, base, direction, length, radius, depth):
    """Recursively grow branch segments as (start, end, radius) tuples."""
    tip = [base[i] + direction[i] * length for i in range(3)]
    points.append((base, tip, radius))
    if depth == 0:
        return
    kids = 2 if rng.random() < 0.7 else 3
    for _ in range(kids):
        yaw = rng.uniform(0, math.tau)
        tilt = rng.uniform(0.35, 0.75)
        mag = math.sqrt(sum(c * c for c in direction))
        up = [c / mag for c in direction]
        # steer child: blend parent direction with a tilted offshoot
        child = [
            up[0] + math.cos(yaw) * tilt,
            up[1] + rng.uniform(0.4, 0.9),
            up[2] + math.sin(yaw) * tilt,
        ]
        cmag = math.sqrt(sum(c * c for c in child))
        child = [c / cmag for c in child]
        grow(points, tip, child, length * rng.uniform(0.6, 0.8), radius * 0.62, depth - 1)


segments = []
grow(segments, [0, 0, 0], [0, 1, 0], 0.5, 0.055, 4)

# Build a mesh of vertices/edges for the Skin modifier
mesh = bpy.data.meshes.new("coral")
verts, edges, vmap = [], [], {}


def vid(p):
    key = (round(p[0], 5), round(p[1], 5), round(p[2], 5))
    if key not in vmap:
        vmap[key] = len(verts)
        verts.append(key)
    return vmap[key]


radii = {}
for start, end, radius in segments:
    a, b = vid(start), vid(end)
    edges.append((a, b))
    radii[a] = max(radii.get(a, 0), radius)
    radii[b] = max(radii.get(b, 0), radius * 0.8)

mesh.from_pydata(verts, edges, [])
obj = bpy.data.objects.new("coral", mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj

skin = obj.modifiers.new("skin", "SKIN")
for i, v in enumerate(obj.data.skin_vertices[0].data):
    r = radii.get(i, 0.02)
    v.radius = (r, r)

subsurf = obj.modifiers.new("subsurf", "SUBSURF")
subsurf.levels = 2
subsurf.render_levels = 2

deci = obj.modifiers.new("deci", "DECIMATE")
deci.ratio = 0.45  # keep the poly budget sane after subdivision

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.ops.object.convert(target="MESH")
obj = bpy.context.view_layer.objects.active
bpy.ops.object.shade_smooth()

# Vertex colours: warm cream tips over terracotta body, by height
mesh = obj.data
top = max(v.co.y for v in mesh.vertices) or 1.0
layer = mesh.color_attributes.new("Color", "BYTE_COLOR", "POINT")
for i, v in enumerate(mesh.vertices):
    t = max(0.0, min(1.0, v.co.y / top))
    w = t * t
    r = 0.79 + w * 0.17
    g = 0.42 + w * 0.44
    b = 0.26 + w * 0.50
    layer.data[i].color = (r, g, b, 1.0)

bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True)
print("EXPORTED", OUT, "verts", len(mesh.vertices), "tris", len(mesh.loop_triangles))
