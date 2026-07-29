"""Builds the antler frond, the garden's fill-layer branching finger.

    blender --background --python tools/blender/build_branch.py -- <out.glb>

One instance of this kind is one *finger* in a spray — `CoralField.addBranching`
leans four to eight of them out of a holdfast and cannot be edited from this
package — so the piece is a single elegant antler: one stem forking into long
upcurved tines, open and lifted where the staghorn landmark is a fat dense
thicket. It replaces a bare capsule, the laziest asset in the garden.

**The frame is the capsule's, and that is the whole point of this file.**
The staghorn and brain are authored one metre tall on a z = 0 foot because
their stand-ins are. This kind's stand-in was `CapsuleGeometry(0.16, 1.1)` —
1.42 tall, *centred* on the origin — and `addBranching` composes every finger
around that frame (position, lean and scale were all tuned against it). A GLB
authored on a z = 0 foot would land 0.72 of its height above where the capsule
stood and every finger in the garden would float. So the piece is normalised
to the capsule's frame instead: 1.42 tall, centred, z ∈ [−0.71, 0.71]. The
stand-in in `CoralShapes.branchGeometry` was rewritten to the same frame and
the same silhouette, and the swap is invisible exactly as the landmarks'.

Vertex colours are the staghorn's rule: pale new tips over a shaded crotch, a
multiplier that only ever darkens, every value through `perceived()` because
COLOR_0 is linear.
"""

import bpy
import math
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from coral_common import (  # noqa: E402
    UP,
    export,
    finalise,
    out_path,
    paint,
    perceived,
    project_uvs,
    report,
    reset_scene,
)

OUT = out_path("public/assets/models/coral-branch.glb")

#: Fixed, as every build artefact in this project is.
rng = random.Random(0xB4_A5_11)

#: The antler, as a polyline tree: (from, to, radius at the joint it grows
#: from). The layout matches the stand-in's prongs — same stem, same four
#: tines — with mid joints added so the tines arc rather than kink: that is
#: the sculpted half of the uplift, the other half being the skin.
SEGMENTS = [
    # Main stem, gently off-true.
    ((0.0, 0.0, 0.0), (0.01, 0.015, 0.5), 0.075),
    ((0.01, 0.015, 0.5), (0.03, 0.02, 0.98), 0.06),
    # Long tine, out and up.
    ((0.02, 0.01, 0.52), (0.08, 0.04, 0.85), 0.052),
    ((0.08, 0.04, 0.85), (0.17, 0.07, 1.14), 0.038),
    # The tall leeward tine.
    ((0.01, 0.0, 0.6), (-0.06, -0.03, 0.92), 0.048),
    ((-0.06, -0.03, 0.92), (-0.15, -0.05, 1.24), 0.034),
    # Low fork, the piece's asymmetry.
    ((0.02, 0.01, 0.3), (0.13, -0.12, 0.82), 0.042),
    # The highest fork, off the leeward tine.
    ((-0.08, -0.03, 0.95), (-0.07, 0.05, 1.12), 0.034),
    ((-0.07, 0.05, 1.12), (-0.04, 0.13, 1.3), 0.024),
]

#: Tip taper per segment, the staghorn's own number.
TIP_TAPER = 0.72

reset_scene()

mesh = bpy.data.meshes.new("branch")
verts, edges, vmap, radii = [], [], {}, {}


def vid(point):
    key = (round(point[0], 5), round(point[1], 5), round(point[2], 5))
    if key not in vmap:
        vmap[key] = len(verts)
        verts.append(key)
    return vmap[key]


for start, end, radius in SEGMENTS:
    # A hand-grown wobble at each joint; an antler is not a cylinder tree.
    jittered_end = tuple(c + rng.uniform(-0.012, 0.012) for c in end)
    a, b = vid(start), vid(jittered_end)
    edges.append((a, b))
    radii[a] = max(radii.get(a, 0.0), radius)
    radii[b] = max(radii.get(b, 0.0), radius * TIP_TAPER)

mesh.from_pydata(verts, edges, [])
obj = bpy.data.objects.new("branch", mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj

skin = obj.modifiers.new("skin", "SKIN")
skin.use_smooth_shade = True
for i, vertex in enumerate(obj.data.skin_vertices[0].data):
    r = radii.get(i, 0.02)
    vertex.radius = (r, r)
obj.data.skin_vertices[0].data[0].use_root = True

subsurf = obj.modifiers.new("subsurf", "SUBSURF")
#: Zero, where the staghorn took one — and the reason is the instance count.
#: A subdivided skin hull collapse-floors at about two thousand triangles
#: (measured twice: ratios 0.6 and 0.35 both landed at 2014), and with ~234
#: fingers in the reef's garden that is 471k triangles for the *fill* layer.
#: The raw hull keeps every arc and fork — the sculpted part — at a fraction
#: of that; what it gives up is cross-section roundness on tines three
#: centimetres thick, which is sub-pixel at the distance fill heads read.
subsurf.levels = 0
subsurf.render_levels = 0

deci = obj.modifiers.new("deci", "DECIMATE")
deci.ratio = 0.85

obj = finalise(obj)


def normalise_centered(obj, height=1.42):
    """Scales to `height` tall and centres on the origin — the capsule frame.

    `coral_common.normalise` puts the foot on z = 0, which is right for every
    piece whose stand-in was born there and wrong for this one; see the module
    header. Kept local: the shared rig must not learn a frame only one kind
    uses.
    """
    mesh = obj.data
    zs = [v.co[UP] for v in mesh.vertices]
    low, high = min(zs), max(zs)
    scale = height / max(1e-6, high - low)

    xs = [v.co[0] for v in mesh.vertices]
    ys = [v.co[1] for v in mesh.vertices]
    cx = (min(xs) + max(xs)) * 0.5
    cy = (min(ys) + max(ys)) * 0.5
    cz = (low + high) * 0.5

    for v in mesh.vertices:
        v.co[0] = (v.co[0] - cx) * scale
        v.co[1] = (v.co[1] - cy) * scale
        v.co[2] = (v.co[2] - cz) * scale
    mesh.update()


normalise_centered(obj)


def skin_of(x, y, height):
    """Pale growing tips over a shaded crotch — the stand-in's paint verbatim.

    `paint()` hands over height01 from the piece's own bounds, so the centred
    frame costs the gradient nothing: 0 at the buried foot, 1 at the highest
    tine, and the tip lands exactly at the 1.0 the exporter's normalised
    accessor clips at.
    """
    value = perceived(0.74 + height * height * 0.26)
    return (value, value * 0.97, value * 0.9)


paint(obj, skin_of)
# Four turns of the ribbed branch skin around a slim frond and three up it:
# the ribs are longitudinal, and four keeps them fine rather than corduroy.
project_uvs(obj, repeat_u=4.0, repeat_v=3.0)
report(obj, OUT)
export(obj, OUT)
