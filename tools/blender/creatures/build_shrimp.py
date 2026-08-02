"""Builds the cleaner shrimp — a 5 cm animal that renders at about ten pixels.

    blender --background --python tools/blender/creatures/build_shrimp.py

Everything about this piece is decided by that ten pixels. There is no eye, no
leg, no antennal scale and no rostrum serration, because none of them is a
whole pixel; what survives at that size is the comma of the body, the pale
value with dark marks across it, and the two antennae drawn out in front. So
the shrimp is one lofted tube whose cross-section flattens and widens at the
back into the tail fan — the fan is part of the body's own profile rather than
a separate sheet, which is both cheaper and solid from every side, and a
single-sided fan blade would vanish the moment the camera got under it.

The bands are across the body rather than along it for the same reason. A
cleaner shrimp's real marking is a longitudinal stripe, and a stripe one pixel
wide running the length of a ten-pixel animal is a slightly pink shrimp. Bands
break the silhouette into light and dark chunks, which is what reads.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from creature_common import (  # noqa: E402
    catmull,
    clamp,
    export_glb,
    grid_faces,
    fan_faces,
    mesh_from,
    mix3,
    paint,
    parse_args,
    recalc_normals,
    render_views,
    reset_scene,
    shade_smooth,
    stats,
    write_uvs,
)

import math  # noqa: E402

OUT = "public/assets/models/creature-shrimp.glb"
BUDGET = 300

#: Rings along the body and columns around it. Eight columns is a visible
#: octagon on anything you can walk up to and is two vertices per pixel here.
RINGS = 13
COLS = 8

#: Snout at -Y, tail fan at +Y; the body measures 0.050 m between them.
NOSE_Y = -0.024
TAIL_Y = 0.026

#: Half-width (x) and half-height (z) of the section, and the spine's height,
#: at stations from the snout (0) to the tail tip (1). The carapace is the
#: fattest part and the last two stations are the fan: wide, and nearly flat.
PROFILE = [
    (0.00, 0.0009, 0.0011, 0.0092),
    (0.10, 0.0042, 0.0050, 0.0092),
    (0.26, 0.0053, 0.0064, 0.0094),
    (0.45, 0.0046, 0.0056, 0.0102),
    (0.62, 0.0037, 0.0044, 0.0118),
    (0.78, 0.0026, 0.0031, 0.0142),
    (0.88, 0.0055, 0.0011, 0.0163),
    (1.00, 0.0098, 0.0006, 0.0182),
]

#: sRGB. A warm white with a cool shadow side would be lighting; these are the
#: animal's two colours, flat.
SHELL = (0.955, 0.930, 0.885)
BAND = (0.760, 0.185, 0.140)
#: Where the bands sit along the body, and how wide each is in the same units.
BANDS = ((0.20, 0.055), (0.47, 0.050), (0.72, 0.045))


def section(t):
    return catmull(PROFILE, t)


def band_mix(t):
    """1 inside a band, 0 outside, with one station of softness at the edge.

    The slope is steep on purpose (it1 measured the failure): with a gentle
    `1 - edge` falloff, the 13 rings all landed on band *edges* and the mix
    never exceeded 0.4, so the authored red was never painted anywhere and the
    bands rendered as pale pink smudges. Tripling the slope gives each band a
    plateau wide enough that the ring nearest its centre paints at full value.
    """
    strongest = 0.0
    for centre, half in BANDS:
        edge = abs(t - centre) / half
        strongest = max(strongest, clamp((1.0 - edge) * 3.0))
    return strongest


def build():
    reset_scene()

    verts = []
    uvs = []
    colours = []

    for i in range(RINGS):
        t = i / (RINGS - 1)
        half_x, half_z, spine_z = section(t)
        y = NOSE_Y + (TAIL_Y - NOSE_Y) * t
        shell = mix3(SHELL, BAND, band_mix(t))
        for j in range(COLS):
            angle = math.tau * j / COLS
            verts.append((half_x * math.sin(angle), y, spine_z - half_z * math.cos(angle)))
            mirrored = min(angle, math.tau - angle)
            uvs.append((mirrored / math.tau, t))
            colours.append(shell)

    faces = grid_faces(RINGS, COLS)

    # Caps. The snout ring is 0.9 mm across and the tail's is a flat 20 mm
    # blade, so both are fans to a point rather than anything cleverer.
    nose_index = len(verts)
    verts.append((0.0, NOSE_Y - 0.0016, section(0.0)[2]))
    uvs.append((0.0, 0.0))
    colours.append(SHELL)
    faces += fan_faces(list(range(COLS)), nose_index)

    tail_index = len(verts)
    verts.append((0.0, TAIL_Y + 0.0012, section(1.0)[2]))
    uvs.append((0.0, 1.0))
    colours.append(mix3(SHELL, BAND, 0.8))
    faces += fan_faces(list(range((RINGS - 1) * COLS, RINGS * COLS)), tail_index)

    # Two antennae, each a tapering four-quad ribbon swept forward and out.
    # Ribbons rather than tubes: at this size a tube's silhouette is its width,
    # so the extra ring of vertices buys a rounder nothing. Thin (1 mm at the
    # base) and drooping: it1's 1.6 mm ribbons held level overlapped in the
    # side view into one bar the thickness of the rostrum — a spoon handle,
    # not a pair of feelers.
    for side in (-1.0, 1.0):
        base = len(verts)
        strip = []
        for k in range(5):
            a = k / 4.0
            reach = 0.030 * a
            width = 0.0010 * (1.0 - 0.78 * a)
            centre = (
                side * (0.0026 + reach * 0.30),
                NOSE_Y + 0.0010 - reach,
                0.0122 + reach * 0.10 - reach * reach * 11.0,
            )
            for edge in (-1.0, 1.0):
                verts.append((centre[0], centre[1], centre[2] + edge * width))
                uvs.append((0.24, 1.0 - a))
                colours.append(SHELL)
            strip.append(k)
        for k in range(4):
            a = base + k * 2
            faces.append((a, a + 1, a + 3, a + 2))

    obj = mesh_from("creature-shrimp", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)
    return obj


def main():
    args = parse_args({"tag": "", "render": True})
    obj = build()
    tris = stats(obj, "creature-shrimp")
    if tris > BUDGET:
        raise SystemExit("shrimp over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj], OUT)
    if args.get("render"):
        stem = "shrimp" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
