"""Builds the brain coral, the garden's landmark mass.

    blender --background --python tools/blender/build_brain.py -- <out.glb>

A dome with real meandering furrows cut into it. The furrows are the entire
point of the piece: `CoralField`'s boulder head already carries a Voronoi
corallite *map*, and a map cannot break a silhouette — a boulder wearing one is
still a lump at any distance where the normal map has mipped away. These
furrows are geometry, so the piece keeps its face at fifteen metres and reads
against the sand as something that grew rather than something that rolled.

How they meander: the sphere's surface point is warped by two octaves of
Perlin, and the ridge field is a sine of the *warped* coordinate. A sine of the
raw coordinate is corduroy; the warp is what makes the ridge wander back on
itself the way a maze coral's does. Same idea as the domain warping in
`ProceduralTexture`, in the one place where doing it in the vertex positions is
affordable — it happens once, at build time, for the whole reef.

The bottom is open. This head sits with its foot buried in the sand, so the
lower third of the sphere is deleted and the rim tucked in: half the triangles
of a closed dome, and nothing that can be seen from any pose the game allows.
"""

import bpy
import bmesh
import math
import sys
import os
from mathutils import Vector
from mathutils import noise as bnoise

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from coral_common import (  # noqa: E402
    clamp,
    export,
    normalise,
    out_path,
    paint,
    perceived,
    project_uvs,
    report,
    reset_scene,
    smoothstep,
)

OUT = out_path("public/assets/models/coral-brain.glb")

#: How deep a furrow is cut, as a fraction of the dome's radius.
FURROW_DEPTH = 0.085
#: Ridges around the head, and how far the field is dragged before it is read.
#:
#: Zero warp is corduroy. Too much of it at too high a period is the other
#: failure, and it is the one this pair was retuned out of: the ridges close on
#: themselves into a field of separate cells, and a dome covered in cells is a
#: pinecone or a tortoise. A maze coral's ridge is *long* — it runs a third of
#: the way round the head before it turns — so the period comes down and the
#: warp goes up together.
FURROW_PERIOD = 8.5
WARP = 0.95
#: Where the dome is cut off below its equator, in radii.
FOOT = -0.34

reset_scene()

# Five, not four. Blender's icosphere quadruples per level (4 → 1280 faces,
# 5 → 5120), and the furrow field below is cut at eleven ridges around the
# head: at 1280 that is four vertices per ridge and the meander comes out as a
# faceted zigzag. Five puts about eight across a cycle, and deleting the buried
# third brings the piece in at roughly 3200 triangles — inside the hero budget.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=1.0)
obj = bpy.context.view_layer.objects.active
obj.name = "brain"

mesh = bmesh.new()
mesh.from_mesh(obj.data)

# The buried third, gone. `bmesh` first, so the vertex work below only ever
# touches surface anyone can see.
below = [v for v in mesh.verts if v.co.z < FOOT]
bmesh.ops.delete(mesh, geom=below, context="VERTS")


def ridge_at(point):
    """The furrow field: 0 in the trough, 1 on the ridge."""
    warped = point + Vector(
        (
            bnoise.noise(point * 1.7) * WARP,
            bnoise.noise(point * 1.7 + Vector((5.3, 1.7, 9.1))) * WARP,
            bnoise.noise(point * 1.7 + Vector((2.9, 7.1, 4.3))) * WARP,
        )
    )
    # One axis carries the banding and the warp does the wandering; banding on
    # all three gives a golf ball.
    band = math.sin(warped.z * FURROW_PERIOD + warped.x * 2.1)
    return 0.5 + 0.5 * band


for vertex in mesh.verts:
    direction = vertex.co.normalized()
    ridge = ridge_at(vertex.co)
    # Squared, so the trough is a groove with a floor rather than a sine's
    # symmetric valley — a maze coral is mostly ridge with cuts in it.
    cut = (1.0 - ridge) ** 2
    # The dome flattens toward its foot, and the furrows fade out with it: a
    # groove running down into the sand reads as damage.
    fade = smoothstep(FOOT, FOOT + 0.45, vertex.co.z)
    vertex.co = direction * (1.0 - FURROW_DEPTH * cut * fade)
    # Squat. A hemisphere is a bubble; a brain coral is wider than it is tall.
    vertex.co.z *= 0.78

# Tuck the open rim inward and down so the foot meets the sand under itself
# rather than standing on a lip.
for vertex in mesh.verts:
    if vertex.co.z < FOOT * 0.62 + 0.02:
        vertex.co.x *= 0.94
        vertex.co.y *= 0.94
        vertex.co.z -= 0.03

mesh.to_mesh(obj.data)
mesh.free()
obj.data.update()

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.shade_smooth()

# Cut the count back once the furrows are in the vertices.
#
# The subdivision above is chosen for the *displacement* — eight vertices across
# a ridge, or the meander comes out as a zigzag — and once the shape exists most
# of that resolution is spent describing smooth dome between the grooves. At
# 3300 triangles this piece measured 13.5 ms of the garden's frame for seven
# instances; a collapse decimate keeps the ridges (they are where the curvature
# is, so they are the last edges to go) and halves the bill.
deci = obj.modifiers.new("deci", "DECIMATE")
deci.ratio = 0.45
bpy.ops.object.convert(target="MESH")
obj = bpy.context.view_layer.objects.active

normalise(obj, 1.0)

# Re-read the ridge field per vertex for the paint pass. Sampling the built
# mesh rather than caching the loop above keeps the two independent: the
# geometry can be retuned without silently keeping last build's shading.
#: Perceived value at the bottom of a furrow, against 1.0 on a ridge crown.
#: The ceiling is not a taste: COLOR_0 is a normalised integer, so a multiplier
#: over 1.0 clips, and the crown has to *be* the top of the range rather than
#: sit somewhere under an imaginary highlight.
FLAT = 0.68


def skin_of(x, y, height):
    """Deep in the furrow, pale on the ridge.

    A brain coral's whole read is the shadow in its grooves, and the toon ramp
    cannot supply it: a groove a centimetre deep never turns a surface far
    enough to cross a band, so every furrow on this dome would light exactly as
    its ridge does. This is the occlusion the geometry earns but the shading
    model will not pay out — the same argument `coralSkin`'s tone term makes for
    the boulder's corallites, one scale up.
    """
    # Undo the normalisation to get back to the unit sphere the field was cut
    # against: the piece is one metre tall and 0.62 squat, so its radius is
    # about 0.5 / 0.62 in x and y and its top is at 1.0.
    radius = math.sqrt(x * x + y * y)
    point = Vector((x, y, (height - 0.55) * 0.9)) * 2.0
    ridge = ridge_at(point)
    value = perceived(FLAT + ridge * 0.36 + clamp(1.0 - radius * 1.4) * 0.04)
    # Warm on the crown, where the light is; the flanks keep the body hue.
    return (value, value * 0.96, value * 0.88)


paint(obj, skin_of)
# Spherical, for the reason in `project_uvs`: this is a dome, and a cylinder's
# `v` would put its whole crown in one sliver of the map.
project_uvs(obj, repeat_u=8.0, repeat_v=4.0, mode="sphere")
report(obj, OUT)
export(obj, OUT)
