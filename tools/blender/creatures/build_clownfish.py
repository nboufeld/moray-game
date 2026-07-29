"""Builds the clownfish — the anemone garden's banded hero, at true 11 cm.

    blender --background --python tools/blender/creatures/build_clownfish.py -- --tag wave8

The game renders this fish at 3.0x (a ~33 cm storybook presence in crowns that
grew to a metre and more), and at that size the whole legibility budget is the
silhouette and the THREE white bands edged in thin black — the field mark of
the real ocellaris and the only thing the owner asked to be able to see. So
the body is one plump lofted tube with the tail fan grown out of its own
profile (the shrimp's trick: solid from every side, no single-sided sheets),
and the rings are not uniform — `distribute` spends them where the bands and
their black edgings are, because a band edge that falls between two rings is a
pink smudge, and the bands are the point.

Scale contract: authored at the animal's true 0.11 m nose to tail edge, like
the shrimp's true 50 mm; `Clownfish.ts`'s FISH_SCALE makes the rendered size
and owns that decision. Fins: a dorsal blade and a small anal fin as thin
double-sided ribbons along the spine, two pectoral paddle fans at the cheeks.
No joints — the fish swims whole, and its yaw/pitch are the instance matrix's.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from creature_common import (  # noqa: E402
    catmull,
    clamp,
    distribute,
    export_glb,
    fan_faces,
    gauss,
    grid_faces,
    mesh_from,
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

import math  # noqa: E402

OUT = "public/assets/models/creature-clownfish.glb"
BUDGET = 900

RINGS = 26
COLS = 12

#: Snout at -Y, tail-fan edge at +Y: the animal measures 0.110 m between them.
NOSE_Y = -0.055
TAIL_Y = 0.055

#: Half-width (x), half-height (z) and spine height at stations from snout (0)
#: to the fan's edge (1). A clownfish is deep and compressed — taller than it
#: is wide, plump through the shoulder — and the last two stations are the
#: tail fan: tall, thin, and rounded by the tube's own columns.
PROFILE = [
    (0.00, 0.0012, 0.0022, 0.0075),
    (0.06, 0.0062, 0.0120, 0.0090),
    (0.16, 0.0110, 0.0215, 0.0115),
    (0.30, 0.0140, 0.0290, 0.0135),
    (0.48, 0.0135, 0.0280, 0.0150),
    (0.66, 0.0100, 0.0205, 0.0140),
    (0.80, 0.0055, 0.0105, 0.0110),
    (0.88, 0.0040, 0.0160, 0.0100),
    (1.00, 0.0015, 0.0235, 0.0100),
]

#: sRGB. The orange is loud on purpose — the one saturated accent the garden
#: owns, and a duller fish sank into the rose coral behind it (W-L5's note).
#: Atelier repaint: the orange counter-shades (ember back, golden belly),
#: the white bands shade cool toward the belly, the fins carry dark edges
#: and the eye is a round dot instead of a quantised bar. Nothing is black:
#: the darkest marks hold red above green.
ORANGE = (0.93, 0.42, 0.12)
ORANGE_BACK = (0.775, 0.295, 0.075)
ORANGE_BELLY = (0.975, 0.545, 0.210)
WHITE = (0.96, 0.94, 0.87)
WHITE_SHADE = (0.835, 0.855, 0.895)
BLACK = (0.095, 0.075, 0.090)
EYE_DARK = (0.135, 0.095, 0.105)
FIN_EDGE = (0.310, 0.135, 0.075)

#: The three bands, (centre t, half-width of the white plateau). Head band
#: through the eye, mid band under the dorsal blade's peak, peduncle band just
#: before the fan root. The black edging is painted as a rim just OUTSIDE the
#: plateau, BLACK_RIM wide.
BANDS = ((0.17, 0.052), (0.47, 0.062), (0.80, 0.042))
BLACK_RIM = 0.016

#: The eye sits inside the head band, on the upper cheek — a dark dot per
#: side. The angular half-window is under one column spacing on purpose: on
#: a body twice as tall as wide, three dark columns read as a bar, not an
#: eye (the r0 turntables show exactly that).
#: Centred exactly on the cheek column (angle π/2): a dot carried by one
#: column reads round; spread across two it smears into a bar on a body
#: twice as tall as wide.
EYE_T = 0.16
EYE_T_HALF = 0.026
EYE_ANGLE_HALF = 0.45
#: One full column spacing (2π/12): the dot lands exactly on the upper-cheek
#: column, inside the head band and clear of the pectoral paddle.
EYE_UP = math.tau / 12.0


def section(t):
    return catmull(PROFILE, t)


def ring_ts():
    """Ring stations, dense where the paint changes and the sculpture bends.

    A uniform 26 rings lands a band edge between rows and the black rim never
    paints anywhere (the shrimp's it1 lesson, one asset over). Density peaks
    sit on every band edge and band centre, with extra rings for the shoulder
    and the fan root.
    """
    def density(t):
        d = 0.35
        for centre, half in BANDS:
            d += 3.2 * gauss(t, centre - half, 0.013)
            d += 3.2 * gauss(t, centre + half, 0.013)
            d += 1.1 * gauss(t, centre, 0.05)
        d += 1.4 * gauss(t, 0.30, 0.06)
        d += 0.9 * gauss(t, 0.06, 0.03)
        d += 1.0 * gauss(t, 0.88, 0.03)
        return d

    return distribute(RINGS, density)


def body_colour(t, angle):
    """Orange, the three black-edged white bands, and the eye's dark dot."""
    dorsal = 0.5 - 0.5 * math.cos(angle)  # 0 belly, 1 back
    # The eye first: a round dot on the cheek inside the head band — the
    # box test quantised to the ring grid and read as a vertical bar.
    side = min(
        abs(angle - (math.pi / 2 + EYE_UP)),
        abs(angle - (3 * math.pi / 2 - EYE_UP)),
    )
    d = math.hypot((t - EYE_T) / EYE_T_HALF, side / EYE_ANGLE_HALF)
    if d < 1.6:
        # Blended, not stamped: one hard vertex on a 12-column body smears
        # into a vertical bar; a graded ellipse on one column reads as a
        # round dot, high on the cheek inside the head band.
        band = mix3(WHITE, WHITE_SHADE, (1.0 - dorsal) * 0.35)
        blend = 1.0 - smoothstep(0.3, 1.1, d)
        return mix3(band, EYE_DARK, blend)
    for centre, half in BANDS:
        edge = abs(t - centre) - half
        if edge < 0.0:
            # White shades cool toward the belly, so the band turns.
            return mix3(WHITE, WHITE_SHADE, (1.0 - dorsal) * 0.35)
        if edge < BLACK_RIM:
            return BLACK
    if t > 0.975:
        # The fan's trailing rim: a dark edge that draws the silhouette.
        return FIN_EDGE
    return mix3(ORANGE_BELLY, ORANGE_BACK, dorsal)


def build():
    reset_scene()

    verts = []
    uvs = []
    colours = []

    ts = ring_ts()
    for t in ts:
        half_x, half_z, spine_z = section(t)
        y = NOSE_Y + (TAIL_Y - NOSE_Y) * t
        for j in range(COLS):
            angle = math.tau * j / COLS
            verts.append((half_x * math.sin(angle), y, spine_z - half_z * math.cos(angle)))
            mirrored = min(angle, math.tau - angle)
            uvs.append((mirrored / math.tau, t))
            colours.append(body_colour(t, angle))

    faces = grid_faces(RINGS, COLS)

    # Caps. The snout ring is two millimetres across and the tail's is the
    # fan's trailing edge, so both are fans to a point on the spine line.
    nose_index = len(verts)
    verts.append((0.0, NOSE_Y - 0.0012, section(0.0)[2]))
    uvs.append((0.0, 0.0))
    colours.append(ORANGE)
    faces += fan_faces(list(range(COLS)), nose_index)

    tail_index = len(verts)
    verts.append((0.0, TAIL_Y + 0.0008, section(1.0)[2]))
    uvs.append((0.0, 1.0))
    colours.append(FIN_EDGE)
    faces += fan_faces(list(range((RINGS - 1) * COLS, RINGS * COLS)), tail_index)

    # The dorsal blade: a thin double-sided ribbon standing on the spine from
    # the shoulder to the taper, its top edge one smooth arc. Two faces a span
    # (one per side) plus a narrow rim closing the top.
    fin = [
        (0.26, 0.0030),
        (0.35, 0.0105),
        (0.45, 0.0170),
        (0.55, 0.0150),
        (0.64, 0.0085),
        (0.72, 0.0025),
    ]
    half_thick = 0.0011
    for stations, sign in ((fin, 1.0),):
        base = len(verts)
        for t, height in stations:
            half_x, half_z, spine_z = section(t)
            y = NOSE_Y + (TAIL_Y - NOSE_Y) * t
            top_z = spine_z + half_z
            for sx in (-half_thick, half_thick):
                verts.append((sx, y, top_z - 0.0015))
                verts.append((sx, y, top_z + height))
                uvs.append((0.5, t))
                uvs.append((0.5, t))
                colours.append(ORANGE_BACK)
                colours.append(mix3(ORANGE, FIN_EDGE, 0.7))
        for k in range(len(stations) - 1):
            a = base + k * 4
            b = a + 4
            # left side, right side, and the top rim between the tip rows
            faces.append((a, b, b + 1, a + 1))
            faces.append((a + 2, a + 3, b + 3, b + 2))
            faces.append((a + 1, b + 1, b + 3, a + 3))

    # The anal fin: the same ribbon, smaller, hanging off the belly line.
    anal = [
        (0.50, 0.0020),
        (0.58, 0.0060),
        (0.66, 0.0070),
        (0.74, 0.0020),
    ]
    base = len(verts)
    for t, height in anal:
        half_x, half_z, spine_z = section(t)
        y = NOSE_Y + (TAIL_Y - NOSE_Y) * t
        belly_z = spine_z - half_z
        for sx in (-half_thick, half_thick):
            verts.append((sx, y, belly_z + 0.0012))
            verts.append((sx, y, belly_z - height))
            uvs.append((0.5, t))
            uvs.append((0.5, t))
            colours.append(ORANGE_BELLY)
            colours.append(mix3(ORANGE, FIN_EDGE, 0.6))
    for k in range(len(anal) - 1):
        a = base + k * 4
        b = a + 4
        faces.append((a, b, b + 1, a + 1))
        faces.append((a + 2, a + 3, b + 3, b + 2))
        faces.append((a + 1, b + 1, b + 3, a + 3))

    # Pectoral paddles: a six-triangle fan per cheek, swept back and down so
    # they read from the side as well as the top, root just behind the head
    # band. At this size they are silhouette.
    half_x, half_z, spine_z = section(0.24)
    for side in (-1.0, 1.0):
        root = (side * (half_x + 0.0006), NOSE_Y + (TAIL_Y - NOSE_Y) * 0.24, spine_z - 0.004)
        centre_index = len(verts)
        verts.append(root)
        uvs.append((0.5, 0.24))
        colours.append(ORANGE_BACK)
        ring = []
        for k in range(6):
            a = math.tau * k / 6
            # Ellipse in the sweep-back / vertical plane, tilted outward.
            verts.append(
                (
                    root[0] + side * (0.0042 + 0.0032 * math.cos(a)),
                    root[1] + 0.0125 * math.sin(a) + 0.0050,
                    root[2] + 0.0075 * math.cos(a) - 0.0020,
                )
            )
            uvs.append((0.5, 0.24))
            colours.append(ORANGE_BELLY)
            ring.append(len(verts) - 1)
        faces += fan_faces(ring, centre_index)

    obj = mesh_from("creature-clownfish", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)
    return obj


def main():
    args = parse_args({"tag": "", "render": True})
    obj = build()
    tris = stats(obj, "creature-clownfish")
    if tris > BUDGET:
        raise SystemExit("clownfish over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj], OUT)
    if args.get("render"):
        stem = "clownfish" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
