"""Builds the layered sea fan, the garden's lacy vertical mass.

    blender --background --python tools/blender/build_fan.py -- <out.glb>

The stand-in is one cupped quad wearing the painted lace sheet; the owner's
complaint ("very lazy 3D assets") is fair about the geometry even where the
painting is good. This is the same piece sculpted as a colony actually grows:
five cupped panels fanned apart in depth and yaw, staggered in height, every
panel wearing the full lace sheet exactly as the stand-in's quad does.

That last part is a contract, not a style choice. The swap in `CoralField`
replaces *geometry only* — the fan's material is fixed at construction: the
painted-or-generated lace with `alphaTest` at 0.45. A sculpted fan whose UVs
did not keep the quad's whole-sheet layout would be cut to ribbons by its own
map. Every panel here maps the sheet once, root row at v = 0, so the alpha
does the lacy margin on each layer and the geometry's job is only what a quad
cannot do: parallax. One panel is mirrored for asymmetry, and two are nudged
a few centimetres in UV so the layers do not print the same fan twice.

Vertex colours are near-neutral grey on purpose: the fan material does not
read COLOR_0 (it has no `vertexColors`), so the values exist to keep the
file's contract inspectable — one channel, normalized, never over 1.0 — and
nothing else. The hue stays with the per-instance colour either way.
"""

import bpy
import math
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from coral_common import (  # noqa: E402
    export,
    normalise,
    out_path,
    perceived,
    report,
    reset_scene,
)

OUT = out_path("public/assets/models/coral-fan.glb")

#: Grid resolution per panel: enough rows to carry the cup smoothly, and at
#: 5 × 240 the whole piece is half its 2200 budget — the lace's silhouette is
#: alpha, so geometry past what the cup needs buys nothing.
SEGS_X = 10
SEGS_Y = 12

#: The stand-in's back-lean, kept: a fan standing dead upright is a signpost.
LEAN = 0.06

#: The layers: (height, yaw about the root, depth offset, across offset,
#: cup, uv shift, mirrored). Centre panel tallest and square-on, the rest
#: fanned around it with the shortest at the edges — a colony, not a
#: clipboard. The cup varies per layer so the panels never nest perfectly.
PANELS = [
    (0.86, -0.22, -0.05, -0.02, 0.17, (0.03, 0.0), False),
    (0.94, -0.10, -0.02, 0.01, 0.13, (0.0, 0.02), False),
    (1.0, 0.0, 0.0, 0.0, 0.15, (0.0, 0.0), False),
    (0.92, 0.11, 0.025, -0.01, 0.12, (0.05, 0.0), True),
    (0.84, 0.23, 0.05, 0.02, 0.18, (0.0, 0.03), False),
]

reset_scene()

verts = []
faces = []
uvs = []  # one (u, v) per vertex, written to the layer after from_pydata
colors = []

for height, yaw, depth, across, cup, (du, dv), mirrored in PANELS:
    base = len(verts)
    cos_yaw = math.cos(yaw)
    sin_yaw = math.sin(yaw)
    for row in range(SEGS_Y + 1):
        v = row / SEGS_Y
        for col in range(SEGS_X + 1):
            u = col / SEGS_X
            x = (u - 0.5) * 1.0
            z = v * height
            # Cup across, lean back as it rises — the stand-in's own profile.
            y = -(x * x) * cup * 4 - v * v * LEAN
            # Rotate about the root (z stays the up axis), then stagger.
            rx = x * cos_yaw - y * sin_yaw
            ry = x * sin_yaw + y * cos_yaw
            verts.append((rx + across, ry + depth, z))
            uvs.append(((1.0 - u if mirrored else u) + du, v + dv))
            # Near-neutral and climbing to full: see the module header.
            value = perceived(0.94 + v * 0.06)
            colors.append((value, value, value))

    for row in range(SEGS_Y):
        for col in range(SEGS_X):
            a = base + row * (SEGS_X + 1) + col
            b = a + 1
            c = a + (SEGS_X + 1) + 1
            d = a + (SEGS_X + 1)
            # Normal on the cup's concave side, matching the stand-in quad.
            faces.append((a, d, c, b))

mesh = bpy.data.meshes.new("fan")
mesh.from_pydata(verts, [], faces)
obj = bpy.data.objects.new("fan", mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj

# UVs are written per corner rather than projected: the panels are separate
# sheets, each mapping the lace once, and `project_uvs`'s cylinder would wrap
# the sheet around the cup instead of laying it over. Each panel's loops are
# its own vertices in row order, one UV apiece.
layer = mesh.uv_layers.new(name="UVMap")
for polygon in mesh.polygons:
    for loop_index in polygon.loop_indices:
        u, v = uvs[mesh.loops[loop_index].vertex_index]
        layer.data[loop_index].uv = (u, v)

color_layer = mesh.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
for i, color in enumerate(colors):
    color_layer.data[i].color = (color[0], color[1], color[2], 1.0)

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.shade_smooth()

normalise(obj, 1.0)
report(obj, OUT)
export(obj, OUT)
