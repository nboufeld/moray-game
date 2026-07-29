"""Builds the staghorn thicket, the garden's tallest landmark.

    blender --background --python tools/blender/build_staghorn.py -- <out.glb>

Grown as a curve tree, skinned, smoothed and decimated, exactly as the
prototype proved. Three things are different from the prototype and all three
are about what this has to be *in the frame* rather than about the pipeline:

It is a thicket, not a tree. Three trunks lean out of one foot, because the
piece is instanced at up to 1.6 m and stands at the crown of a bommie where the
camera reads its outline against open water — a single trunk at that size is a
sapling, and a sapling is a land plant.

It grows along +Z. The prototype grew along +Y and then exported with
`export_yup`, which turns Blender's +Y into glTF's −Z: the coral came out lying
on its side. Everything vertical here is authored in Blender's own up axis and
converted once, at export.

Its branches are fat and few. Staghorn read at fifteen metres is a silhouette
of maybe a dozen strokes; the depth-5 spray the prototype grew is a hundred
hairline twigs that mip into a smudge and cost four times the triangles.
"""

import bpy
import math
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from coral_common import (  # noqa: E402
    export,
    finalise,
    normalise,
    out_path,
    paint,
    perceived,
    project_uvs,
    report,
    reset_scene,
)

OUT = out_path("public/assets/models/coral-staghorn.glb")

#: Fixed: the reef is seeded everywhere else and a build artefact is no different.
rng = random.Random(0xC0_5A_04)

#: Trunks out of the one foot, and how many times each one splits.
#:
#: Two trunks read as a fork and four as a bush, so three — but not three of
#: the same age. One full spray with two shorter ones banked against it is what
#: a thicket looks like, and it is also what fits: a collapse decimate will not
#: go below about half of the skinned hull however low the ratio is set (the
#: edges it would have to collapse next are the ones holding the tubes open),
#: so the triangle budget is spent in the branch *count* rather than recovered
#: afterwards. Measured: three full sprays floor at 4700 triangles, this at
#: 3100, against a hero budget of 4000.
TRUNK_DEPTHS = (3, 2, 2)

#: Trunk radius at the foot, in the piece's own units before normalising.
#:
#: It was 0.075, which is anatomically fine and reads as wire. The piece stands
#: 1.4 units tall as grown, so that is a branch about five centimetres across
#: on a 1.6 m thicket — and at the ten to fifteen metres the canonical cameras
#: sit at, five centimetres is under a pixel and the whole spray mips into a
#: smudge. It is also the wrong reference: this reef's rocks are three-metre
#: boulders and eight-metre arches, painted in broad strokes, and a coral drawn
#: at true thickness beside them is a wire model of a coral. Gouache does not
#: draw wire.
TRUNK_RADIUS = 0.125
#: How much of its parent's girth a branch keeps. Nearer 1 is a candelabra.
TAPER = 0.74

reset_scene()

segments = []


def grow(base, direction, length, radius, depth):
    tip = [base[i] + direction[i] * length for i in range(3)]
    segments.append((base, tip, radius))
    if depth == 0:
        return

    kids = 2 if rng.random() < 0.72 else 3
    for _ in range(kids):
        yaw = rng.uniform(0, math.tau)
        # Wide enough to open the silhouette, tight enough that the thicket
        # still climbs. A staghorn's branches turn *up* after they turn out —
        # but not immediately: a spray that recovers vertical at every split
        # exports about a third as wide as it is tall, which is a spire, and a
        # spire on a bommie crown reads as a stalagmite. These numbers are
        # picked against the exported bounding box (`inspect_glb.mjs`), which
        # now comes out around 0.9 wide per 1.0 tall.
        tilt = rng.uniform(0.62, 1.15)
        child = [
            direction[0] + math.cos(yaw) * tilt,
            direction[1] + math.sin(yaw) * tilt,
            direction[2] + rng.uniform(0.22, 0.72),
        ]
        mag = math.sqrt(sum(c * c for c in child)) or 1.0
        child = [c / mag for c in child]
        grow(tip, child, length * rng.uniform(0.62, 0.8), radius * TAPER, depth - 1)


for trunk, depth in enumerate(TRUNK_DEPTHS):
    around = (trunk / len(TRUNK_DEPTHS)) * math.tau + rng.uniform(-0.3, 0.3)
    lean = rng.uniform(0.22, 0.48)
    foot = [math.cos(around) * 0.1, math.sin(around) * 0.1, 0.0]
    # The shallower trunks are shorter too, so the thicket has a crown rather
    # than three tips at one height.
    reach = 0.5 if depth == 3 else 0.36
    grow(
        foot,
        [math.cos(around) * lean, math.sin(around) * lean, 1.0],
        reach * rng.uniform(0.9, 1.12),
        TRUNK_RADIUS,
        depth,
    )

mesh = bpy.data.meshes.new("staghorn")
verts, edges, vmap, radii = [], [], {}, {}


def vid(point):
    key = (round(point[0], 5), round(point[1], 5), round(point[2], 5))
    if key not in vmap:
        vmap[key] = len(verts)
        verts.append(key)
    return vmap[key]


for start, end, radius in segments:
    a, b = vid(start), vid(end)
    edges.append((a, b))
    radii[a] = max(radii.get(a, 0.0), radius)
    # A tip is thinner than the joint it grew from, which is the whole taper.
    radii[b] = max(radii.get(b, 0.0), radius * 0.72)

mesh.from_pydata(verts, edges, [])
obj = bpy.data.objects.new("staghorn", mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj

skin = obj.modifiers.new("skin", "SKIN")
skin.use_smooth_shade = True
for i, vertex in enumerate(obj.data.skin_vertices[0].data):
    r = radii.get(i, 0.02)
    vertex.radius = (r, r)
# One root, or the skin modifier picks its own and the hull can turn inside out.
obj.data.skin_vertices[0].data[0].use_root = True

subsurf = obj.modifiers.new("subsurf", "SUBSURF")
subsurf.levels = 1
subsurf.render_levels = 1

deci = obj.modifiers.new("deci", "DECIMATE")
# Measured rather than picked, twice over. The skinned, once-subdivided hull is
# around 3000 triangles at this girth and the collapse floors out near half of
# whatever it is given — see `TRUNK_DEPTHS`. The hero *budget* is 4000 and this
# sits at a third of it, because the budget is not the constraint that binds:
# ten instances of this piece measured 15 ms of the garden's frame at 2444
# triangles, against a whole-package allowance of a few, and at ten metres —
# nine degrees of frame — a branch is four pixels across whichever count it is
# built from.
deci.ratio = 0.42

obj = finalise(obj)
normalise(obj, 1.0)


def skin_of(x, y, height):
    """Pale, faintly warm tips over a deeper foot.

    A staghorn's growing tips carry the newest, thinnest tissue and the crotch
    of a branch never sees the sun. Both are value, not hue: the species colour
    arrives as the instance colour this multiplies.

    It only ever darkens, and that is a hard limit rather than a preference —
    COLOR_0 is exported as a normalised integer, so anything over 1.0 is
    clipped on the way out and a "highlight" written at 1.14 lands at exactly
    the same place as one written at 1.0. The tip is the full instance colour
    and everything below it is taken down from there.
    """
    lift = height * height
    value = perceived(0.80 + lift * 0.20)
    return (value, value * 0.97, value * 0.90)


paint(obj, skin_of)
# Eight turns of the grain around the piece and six up it. A thicket is about
# 0.6 m across at the metre it is exported at, so eight puts one tile of the
# map around every branch rather than one around the whole spray.
project_uvs(obj, repeat_u=8.0, repeat_v=6.0)
report(obj, OUT)
export(obj, OUT)
