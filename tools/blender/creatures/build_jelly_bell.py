"""Builds the jellyfish bell — a 0.62 m pastel dome for the jelly bloom.

    blender --background --python tools/blender/creatures/build_jelly_bell.py -- --tag it1

One shape, no rig: the bloom system drives whole-body drift and pulse, and a
pulse is a scale animation, not a bone. The bell is a thin closed shell —
an outer dome recurving under at the margin and an inner dome rising back up
inside — because a jelly is seen from below as often as from above, and a
single-sided dome viewed from underneath is a hole in the water.

"Translucent-looking" is done with value, not alpha: the inner surface is
painted a full step deeper than the outer, so wherever the bell's own
geometry lets you see interior (under the margin, through the opening) the
colour deepens the way light through jelly actually behaves. The outer dome
runs apex-pale to margin-rose (zone boundary, not lighting), and the margin
carries eight scallop lobes whose bays are tinted a touch deeper — which is
where a real jelly's pigment sits.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from creature_common import (  # noqa: E402
    export_glb,
    fan_faces,
    gauss,
    grid_faces,
    mesh_from,
    mix,
    mix3,
    paint,
    parse_args,
    recalc_normals,
    render_views,
    reset_scene,
    shade_smooth,
    smoothstep,
    stats,
    write_uvs,
)

OUT = "public/assets/models/creature-jelly-bell.glb"
BUDGET = 1200

RADIUS = 0.31
HEIGHT = 0.33
#: The dome continues past the equator so the margin tucks under.
ALPHA_MAX = 0.62 * math.pi

#: 40, because it is a multiple of the lobe count: at 36 the eight scallops
#: were sampled 4.5 columns each and alternated pointy and flat around the
#: margin (measured in it1's front view).
COLS = 40
OUTER_RINGS = 9
INNER_RINGS = 6

LOBES = 8
SCALLOP_R = 0.055
SCALLOP_Z = 0.032

APEX = (0.900, 0.815, 0.880)
MARGIN = (0.820, 0.650, 0.855)
BAY = (0.765, 0.565, 0.805)
INNER = (0.630, 0.440, 0.720)


def scallop(theta, t):
    """Radius and height modulation of the margin, fading in over the skirt."""
    grow = smoothstep(0.55, 1.0, t)
    wave = math.cos(LOBES * theta)
    return (
        1.0 + SCALLOP_R * wave * grow,
        -SCALLOP_Z * (0.5 - 0.5 * wave) * grow,
    )


def outer_point(t, theta):
    alpha = ALPHA_MAX * t
    r_mod, z_mod = scallop(theta, t)
    r = RADIUS * math.sin(alpha) * r_mod
    z = HEIGHT * math.cos(alpha) + z_mod
    return (r * math.cos(theta), r * math.sin(theta), z)


def build():
    reset_scene()
    verts, uvs, colours = [], [], []
    faces = []

    apex = len(verts)
    verts.append((0.0, 0.0, HEIGHT))
    uvs.append((0.5, 0.5))
    colours.append(APEX)

    outer_base = len(verts)
    for i in range(OUTER_RINGS):
        t = (i + 1) / OUTER_RINGS
        for j in range(COLS):
            theta = math.tau * j / COLS
            x, y, z = outer_point(t, theta)
            verts.append((x, y, z))
            uvs.append((0.5 + 0.5 * (x / RADIUS) * 0.9, 0.5 + 0.5 * (y / RADIUS) * 0.9))
            wave = 0.5 - 0.5 * math.cos(LOBES * theta)
            rim = mix3(MARGIN, BAY, wave * smoothstep(0.6, 1.0, t))
            # Plain t, no knees: the smoothstepped version banded like a
            # beach ball where the mix rate changed.
            colours.append(mix3(APEX, rim, t))
    faces += fan_faces(list(range(outer_base, outer_base + COLS)), apex)
    faces += grid_faces(OUTER_RINGS, COLS, base=outer_base)

    # Inner surface: from the margin ring back up inside the bell. Its first
    # ring duplicates the margin's positions so outer and inner meet exactly;
    # the duplication is deliberate, a shared ring would average the normals
    # across the rim and soften the edge to nothing.
    inner_base = len(verts)
    for i in range(INNER_RINGS):
        t_in = 1.0 - i / (INNER_RINGS - 1)  # 1 margin -> 0 interior apex ring
        t = mix(0.30, 1.0, t_in)
        for j in range(COLS):
            theta = math.tau * j / COLS
            x, y, z = outer_point(t, theta)
            shrink = 1.0 - 0.10 * (1.0 - t_in)
            lift = 0.035 * (1.0 - t_in)
            # The first inner ring sits 5 mm under the margin, not on it: a
            # coincident ring would make the rim stitch degenerate.
            verts.append((x * shrink, y * shrink, z + lift if i > 0 else z - 0.005))
            uvs.append((0.5 + 0.5 * (x / RADIUS) * 0.6, 0.5 + 0.5 * (y / RADIUS) * 0.6))
            colours.append(mix3(mix3(MARGIN, BAY, 0.5), INNER, smoothstep(0.0, 0.6, 1.0 - t_in)))
    faces += grid_faces(INNER_RINGS, COLS, base=inner_base)

    inner_apex = len(verts)
    verts.append((0.0, 0.0, HEIGHT * math.cos(ALPHA_MAX * 0.30) + 0.035))
    uvs.append((0.5, 0.5))
    colours.append(INNER)
    last = inner_base + (INNER_RINGS - 1) * COLS
    faces += fan_faces(list(reversed(range(last, last + COLS))), inner_apex)

    # Weld the rim: the outer margin ring and inner first ring are coincident;
    # stitch them with a quad strip so the shell is closed.
    margin = outer_base + (OUTER_RINGS - 1) * COLS
    for j in range(COLS):
        a = margin + j
        b = margin + (j + 1) % COLS
        c = inner_base + (j + 1) % COLS
        d = inner_base + j
        faces.append((a, b, c, d))

    obj = mesh_from("creature-jelly-bell", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)
    return obj


def main():
    args = parse_args({"tag": "", "render": True})
    obj = build()
    tris = stats(obj, "creature-jelly-bell")
    if tris > BUDGET:
        raise SystemExit("jelly bell over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj], OUT)
    if args.get("render"):
        stem = "jelly" + (("-" + args["tag"]) if args["tag"] else "")
        views = {
            "front": (0.0, -1.0, 0.0),
            "quarter": (0.72, -0.78, 0.42),
            "below": (0.5, -0.7, -0.55),
            "top": (0.0, -0.001, 1.0),
        }
        render_views([obj], stem, views=views)


main()
