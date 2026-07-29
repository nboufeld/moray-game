"""Builds the tube sponge cluster, the garden's mid-piece organ pipes.

    blender --background --python tools/blender/build_tube.py -- <out.glb>

A stand of organ-pipe tubes out of one holdfast: varied heights, fluted lips,
each mouth a dark warm throat. It replaces the lathed single tube in
`CoralShapes.tubeGeometry`, whose W-N5 notes this keeps faith with — long and
narrow, walls near parallel with a soft trumpet only at the lip, no cream rim,
a throat that leans into red as it deepens — because those decisions were
right and the single lathe was not the problem; the problem was that one tube
read as pottery where a cluster reads as a sponge.

The cluster is authored one metre tall on a z = 0 foot, the garden's unit
footprint (`coral_common.normalise`), and `CoralField.addMid` plants three to
five of these clusters per holdfast — so one instance is already a stand, and
what the field adds is variety between stands.

Vertex colours are multipliers, never colours: exterior shading climbs a
calm ramp that deliberately stops short of a pale lip (the barrel-hoop
failure), the throat deepens into warmth, and nothing exceeds the 1.0 the
exporter's normalised accessor clips at. All values pass through
`perceived()`: COLOR_0 is linear, so author what the eye should see.
"""

import bpy
import math
import random
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from coral_common import (  # noqa: E402
    export,
    normalise,
    out_path,
    perceived,
    project_uvs,
    report,
    reset_scene,
)

OUT = out_path("public/assets/models/coral-tube.glb")

#: Fixed: the reef is seeded everywhere else and a build artefact is no different.
rng = random.Random(0xC0_7A_11)

#: Around each tube. Ten, where the stand-in lathe used nine: the flute at the
#: lip is the piece's signature and seven scallops around ten segments still
#: reads as a flute rather than as a gear.
RADIAL = 10

#: Exterior profile, as (fraction of the tube's height, radius multiplier,
#: flute amplitude). Near-parallel walls with the trumpet kept to the last
#: sixth — the W-N5 silhouette, per tube. The flute is the lip's scalloped
#: frill: organ-pipe sponges flare into seven or so shallow lobes at the
#: osculum, and it is the one thing about the piece that reads close up.
PROFILE = [
    (0.0, 1.0, 0.0),
    (0.22, 0.97, 0.0),
    (0.45, 0.95, 0.005),
    (0.65, 0.98, 0.015),
    (0.82, 1.05, 0.04),
    (0.93, 1.12, 0.075),
    (1.0, 1.18, 0.11),
]

#: Throat interior, as (fraction of the tube's height, radius multiplier of
#: the lip's interior, depth 0..1 for the paint). Two rings and a cone close
#: the mouth at mid-depth — far enough down that the warm shade band inside
#: the rim is the read, not the floor.
THROAT = [
    (0.965, 0.84, 0.0),
    (0.8, 0.8, 0.35),
    (0.55, 0.72, 0.75),
]

#: The stand: (height before normalising, base radius, out from centre, lean
#: outward in radians). One tall central chimney with six around it, the
#: juveniles shortest and tucked closest — an organ-pipe clump is a colony of
#: ages, not a rank of pipes at parade.
TUBES = [
    (1.0, 0.105, 0.0, 0.02),
    (0.84, 0.095, 0.17, 0.05),
    (0.68, 0.088, 0.22, 0.07),
    (0.9, 0.1, 0.2, 0.04),
    (0.55, 0.075, 0.15, 0.09),
    (0.74, 0.085, 0.25, 0.06),
    (0.6, 0.07, 0.19, 0.08),
    (0.42, 0.062, 0.11, 0.1),
]

reset_scene()

verts = []
faces = []
colors = []  # one (r, g, b) multiplier per vertex, written after from_pydata


def add_vertex(x, y, z, color):
    verts.append((x, y, z))
    colors.append(color)
    return len(verts) - 1


def exterior_paint(height01, theta=0.0, flute=0.0, phase=0.0):
    """Calm ramp, foot to top — and deliberately no bright lip.

    The stand-in's ceiling (perceived 0.9 at the rim) is kept: a pale hoop on
    a dark vessel is a barrel's defining mark, and this piece exists because
    the garden wanted sponges, not cooperage.

    Atelier repaint: the flute's bays sink a step where the wall pinches in
    (same phase the geometry uses), so the lip's scallop is drawn in value
    as well as silhouette — a ramp alone left the frill invisible from two
    metres. Still a multiplier, still nothing above the stand-in's ceiling.
    """
    bay = 1.15 * flute * (1.0 - math.sin(theta * 7 + phase))
    value = perceived(max(0.35, 0.72 + height01 * 0.2 - bay))
    return (value, value * 0.97, value * 0.92)


def throat_paint(depth):
    """Warm and deepening — living tissue over a dim interior."""
    value = perceived(0.8 - depth * 0.45)
    return (value, value * (0.72 - depth * 0.12), value * (0.55 - depth * 0.12))


for height, radius, out, lean in TUBES:
    around = rng.uniform(0, math.tau)
    cx = math.cos(around) * out
    cy = math.sin(around) * out
    # The lean tips the whole tube away from the stand's heart, about its foot.
    lean_x = math.cos(around) * lean
    lean_y = math.sin(around) * lean
    # A tiny random walk of the column's centre keeps a hand-grown wobble in
    # the silhouette; organ pipes are never surveyed straight.
    drift_x = rng.uniform(-0.012, 0.012)
    drift_y = rng.uniform(-0.012, 0.012)
    phase = rng.uniform(0, math.tau)

    def centre(fraction):
        """The tube's axis at a height fraction; the foot stays planted."""
        z = height * fraction
        sway = fraction * fraction
        return (
            cx + drift_x * sway + math.sin(lean_x) * z,
            cy + drift_y * sway + math.sin(lean_y) * z,
            z,
        )

    ring_starts = []
    for fraction, spread, flute in PROFILE:
        start = len(verts)
        ring_starts.append(start)
        px, py, pz = centre(fraction)
        # A slow vertical undulation on top of the lip flute: a sponge wall
        # breathes in and out as it climbs, and a true lathe never does.
        breathe = 1.0 + 0.03 * math.sin(fraction * math.pi * 3 + phase * 1.7)
        for j in range(RADIAL):
            theta = (j / RADIAL) * math.tau
            r = radius * spread * breathe * (1.0 + flute * math.sin(theta * 7 + phase))
            add_vertex(
                px + math.cos(theta) * r,
                py + math.sin(theta) * r,
                pz,
                exterior_paint(fraction, theta, flute, phase),
            )

    # Exterior bands.
    for ring in range(len(PROFILE) - 1):
        a = ring_starts[ring]
        b = ring_starts[ring + 1]
        for j in range(RADIAL):
            nj = (j + 1) % RADIAL
            faces.append((a + j, a + nj, b + nj, b + j))

    # The lip folds over and the throat runs down to a cone.
    lip = ring_starts[-1]
    prev = lip
    prev_r = radius * PROFILE[-1][1]
    for fraction, inner, depth in THROAT:
        start = len(verts)
        px, py, pz = centre(fraction)
        for j in range(RADIAL):
            theta = (j / RADIAL) * math.tau
            r = prev_r * inner
            add_vertex(
                px + math.cos(theta) * r,
                py + math.sin(theta) * r,
                pz,
                throat_paint(depth),
            )
        for j in range(RADIAL):
            nj = (j + 1) % RADIAL
            faces.append((prev + j, prev + nj, start + nj, start + j))
        prev = start
        prev_r = r

    ax, ay, az = centre(THROAT[-1][0])
    apex = add_vertex(ax, ay, az - height * 0.04, throat_paint(1.0))
    for j in range(RADIAL):
        nj = (j + 1) % RADIAL
        faces.append((prev + j, prev + nj, apex))

mesh = bpy.data.meshes.new("tube")
mesh.from_pydata(verts, [], faces)
obj = bpy.data.objects.new("tube", mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj

# The per-vertex multipliers computed during generation — FLOAT_COLOR through
# `paint()`'s own contract, written directly because only the generator knows
# which vertices are throat.
layer = mesh.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
for i, color in enumerate(colors):
    layer.data[i].color = (color[0], color[1], color[2], 1.0)

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.shade_smooth()
# Exterior out, throat in toward the cavity: one continuous sheet, so a
# consistent-normals pass orients both walls correctly off the connectivity.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode="OBJECT")

normalise(obj, 1.0)
# Six turns of the sponge felt around the cluster and four up it: the felt's
# channels are vertical, and four tiles puts the grain at about the scale the
# stand-in's lathe UVs gave it.
project_uvs(obj, repeat_u=6.0, repeat_v=4.0)
report(obj, OUT)
export(obj, OUT)
