"""Builds the sea turtle — a 1.4 m carapace and the visitor that wears it.

    blender --background --python tools/blender/creatures/build_turtle.py -- --tag it1

The painting `public/assets/creatures/turtle-shell.png` decides the UV plan:
its left two thirds are the carapace oval (hexagonal scutes inside a ring of
marginals) and its right third is a dotted sage field painted as *skin*. So
the carapace top is planar-projected onto the oval from above — the marginal
ring lands on the shell's own rim by construction — and everything else
(plastron, neck, flippers, tail) is projected into the dotted field.

The shell's silhouette is a loft with a deliberate crease: the cross-section
uses one half-depth below the waterline of the section and another above, so
the widest point is a hard rim all the way around, flared a little outward.
That rim is what says "turtle" from twenty metres, and a smooth ellipsoid
does not have it.

Joints: `head` lies along model +X (pitch/nod is a rotation about the bone's
own +Y); the four flippers lie along Blender -Y = glTF +Z (body-forward), so
the flap — the stroke a swimming turtle actually makes — is likewise a
rotation about each bone's own +Y. Weights ramp smoothly from the body wall
so a rotated flipper bends at the shoulder instead of shearing.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from creature_common import (  # noqa: E402
    bind_groups,
    catmull,
    clamp,
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

OUT = "public/assets/models/creature-turtle.glb"
BUDGET = 4000

#: Carapace length and where it sits: centred on the origin, so the pivot is
#: the shell's centre. Forward is Blender -Y (glTF +Z).
SHELL_LENGTH = 1.40
HALF_L = SHELL_LENGTH / 2.0

BODY_RINGS = 18
BODY_HALF_COLS = 14  # mirrored to 26 columns per ring

#: (s, half_width, dome_height, plastron_depth, centre_z); s runs 0 at the
#: shell's front edge to 1 at its rear.
BODY_PROFILE = [
    (0.00, 0.070, 0.050, 0.035, 0.030),
    (0.10, 0.280, 0.160, 0.070, 0.010),
    (0.25, 0.420, 0.260, 0.095, 0.000),
    (0.45, 0.500, 0.330, 0.105, 0.000),
    (0.60, 0.510, 0.335, 0.105, 0.000),
    (0.75, 0.460, 0.300, 0.100, 0.000),
    (0.90, 0.300, 0.180, 0.075, 0.010),
    (1.00, 0.080, 0.060, 0.035, 0.020),
]

#: How far past the section width the rim skirt flares, at the crease, and
#: how far the skirt turns down. Narrow on purpose: it1's wide gaussian
#: smeared the crease into a smooth bun and the animal lost its rim.
RIM_FLARE = 0.13
RIM_WIDTH = 0.14
RIM_DROOP = 0.05
#: The UV split between shell painting and skin field sits just below the
#: rim, so the painted marginal scutes wrap over the edge and read from the
#: side.
RIM_SPLIT_PHI = 0.40 * math.pi

#: The painting's regions, measured off the file (512 px): the oval is
#: centred at (0.335, 0.50) with radii (0.315, 0.465); the dotted skin field
#: fills u in [0.70, 0.98].
OVAL_CU, OVAL_CV = 0.335, 0.500
OVAL_RU, OVAL_RV = 0.315, 0.465
SKIN_CU, SKIN_RU = 0.845, 0.130

#: sRGB gouache. Flat zones; the only gradients are zone boundaries.
SHELL_TOP = (0.660, 0.580, 0.330)
MARGINAL = (0.880, 0.830, 0.660)
PLASTRON = (0.900, 0.860, 0.700)
SKIN = (0.620, 0.680, 0.420)
SKIN_LIGHT = (0.780, 0.800, 0.580)
EYE = (0.150, 0.130, 0.100)

NECK_ROOT = (0.0, -0.66, 0.045)
NECK_LENGTH = 0.42
#: (t, radius, lift): the neck narrows hard, the skull bulges wide, the beak
#: rounds and drops. The skull-to-neck ratio is what makes it a head rather
#: than a slug's nub — it1 at 0.103/0.082 had no head at all.
NECK_PROFILE = [
    (0.00, 0.100, 0.000),
    (0.25, 0.070, 0.030),
    (0.50, 0.072, 0.062),
    (0.70, 0.120, 0.080),
    (0.88, 0.088, 0.066),
    (1.00, 0.040, 0.028),
]
NECK_RINGS = 10
NECK_COLS = 10

#: Flippers: (side_x, root_y, length, root_chord, mid_chord, sweep_back).
FRONT_FLIPPER = (0.42, -0.36, 0.58, 0.17, 0.21, 0.42)
REAR_FLIPPER = (0.33, 0.42, 0.30, 0.13, 0.15, 0.55)
FLIPPER_RINGS = 8
FLIPPER_COLS = 6

TAIL_ROOT = (0.0, 0.68, -0.015)
TAIL_LENGTH = 0.16


def body_section(s):
    return catmull(BODY_PROFILE, s)


def body_point(s, phi_m, side):
    """Cross-section: plastron curve below the rim, dome above, and a hard
    crease plus flare where they meet."""
    a, dome, plast, cz = body_section(s)
    rim = gauss(phi_m, math.pi / 2.0, RIM_WIDTH)
    flare = 1.0 + RIM_FLARE * rim
    x = side * a * math.sin(phi_m) * flare
    if phi_m <= math.pi / 2.0:
        z = cz - plast * math.cos(phi_m)
    else:
        z = cz - dome * math.cos(phi_m)
    z -= RIM_DROOP * a * rim
    y = -HALF_L + SHELL_LENGTH * s
    return (x, y, z)


def shell_uv(x, y):
    return (
        OVAL_CU + (x / 0.56) * OVAL_RU,
        OVAL_CV + (y / (HALF_L + 0.02)) * OVAL_RV,
    )


def skin_uv(x, y, scale=0.44):
    return (
        SKIN_CU + clamp(x / 0.56, -1.0, 1.0) * SKIN_RU,
        clamp(0.5 + y * scale, 0.03, 0.97),
    )


def build():
    reset_scene()
    verts, uvs, colours = [], [], []
    weights = {name: {} for name in ("head", "flipperFL", "flipperFR", "flipperBL", "flipperBR")}
    faces = []

    # ------------------------------------------------------------------ body
    for i in range(BODY_RINGS):
        s = i / (BODY_RINGS - 1)
        half = [math.pi * j / (BODY_HALF_COLS - 1) for j in range(BODY_HALF_COLS)]
        ring = [(phi, 1.0) for phi in half] + [(phi, -1.0) for phi in reversed(half[1:-1])]
        for phi_m, side in ring:
            x, y, z = body_point(s, phi_m, side)
            verts.append((x, y, z))
            if phi_m >= RIM_SPLIT_PHI:
                uvs.append(shell_uv(x, y))
            else:
                uvs.append(skin_uv(x, y))
            if phi_m >= 0.55 * math.pi:
                colours.append(SHELL_TOP)
            elif phi_m >= RIM_SPLIT_PHI:
                colours.append(MARGINAL)
            else:
                colours.append(PLASTRON)

    cols = 2 * BODY_HALF_COLS - 2
    faces += grid_faces(BODY_RINGS, cols)

    front = len(verts)
    verts.append((0.0, -HALF_L - 0.02, body_section(0.0)[3] + 0.01))
    uvs.append(shell_uv(0.0, -HALF_L - 0.02))
    colours.append(MARGINAL)
    faces += fan_faces(list(range(0, cols)), front)

    rear_base = (BODY_RINGS - 1) * cols
    rear = len(verts)
    verts.append((0.0, HALF_L + 0.02, body_section(1.0)[3] + 0.01))
    uvs.append(shell_uv(0.0, HALF_L + 0.02))
    colours.append(MARGINAL)
    faces += fan_faces(list(range(rear_base, rear_base + cols)), rear)

    # ------------------------------------------------------------------ neck
    neck_base = len(verts)
    for i in range(NECK_RINGS):
        t = i / (NECK_RINGS - 1)
        radius, lift = catmull(NECK_PROFILE, t)[0:2]
        cy = NECK_ROOT[1] - NECK_LENGTH * t
        czn = NECK_ROOT[2] + lift
        for j in range(NECK_COLS):
            angle = math.tau * j / NECK_COLS
            x = radius * 0.92 * math.sin(angle)
            z = czn - radius * math.cos(angle)
            verts.append((x, cy, z))
            uvs.append((0.72 + 0.26 * (0.5 + 0.5 * math.sin(angle)), 0.08 + 0.30 * t))
            shade = 0.5 - 0.5 * math.cos(angle)  # 0 belly, 1 crown
            colours.append(mix3(SKIN_LIGHT, SKIN, shade))
            index = len(verts) - 1
            w = smoothstep(0.12, 0.5, t)
            if w > 1e-4:
                weights["head"][index] = w
    faces += grid_faces(NECK_RINGS, NECK_COLS, base=neck_base)

    beak = len(verts)
    tip = catmull(NECK_PROFILE, 1.0)
    verts.append((0.0, NECK_ROOT[1] - NECK_LENGTH - 0.035, NECK_ROOT[2] + tip[1] - 0.025))
    uvs.append((0.85, 0.40))
    colours.append(SKIN)
    weights["head"][beak] = 1.0
    rim = list(range(neck_base + (NECK_RINGS - 1) * NECK_COLS, neck_base + NECK_RINGS * NECK_COLS))
    faces += fan_faces(rim, beak)

    # Eyes: one darkened vertex per cheek on the skull ring, the same trick
    # the game's fish uses. At this animal's draw distance a modelled orbit
    # is spent triangles.
    skull_ring = neck_base + 7 * NECK_COLS
    for j in range(NECK_COLS):
        angle = math.tau * j / NECK_COLS
        if abs(abs(math.sin(angle)) - 1.0) < 0.35 and math.cos(angle) < -0.2:
            colours[skull_ring + j] = EYE

    # -------------------------------------------------------------- flippers
    for name, (side_x, root_y, length, root_chord, mid_chord, sweep) in (
        ("flipperFL", FRONT_FLIPPER),
        ("flipperFR", tuple(-v if k == 0 else v for k, v in enumerate(FRONT_FLIPPER))),
        ("flipperBL", REAR_FLIPPER),
        ("flipperBR", tuple(-v if k == 0 else v for k, v in enumerate(REAR_FLIPPER))),
    ):
        sign = 1.0 if side_x > 0 else -1.0
        base = len(verts)
        for i in range(FLIPPER_RINGS):
            f = i / (FLIPPER_RINGS - 1)
            chord = catmull(
                [(0.0, root_chord), (0.4, mid_chord), (0.75, mid_chord * 0.72), (1.0, mid_chord * 0.26)],
                f,
            )[0]
            thick = mix(0.042, 0.010, f)
            cx = side_x + sign * length * f
            cy = root_y + sweep * length * f * f
            czf = -0.02 - 0.05 * f * f
            for j in range(FLIPPER_COLS):
                angle = math.tau * j / FLIPPER_COLS
                y = cy + chord * math.cos(angle)
                z = czf + thick * math.sin(angle)
                verts.append((cx, y, z))
                uvs.append((0.72 + 0.26 * f, 0.55 + 0.36 * (0.5 + 0.5 * math.cos(angle))))
                colours.append(SKIN if math.sin(angle) >= 0.0 else SKIN_LIGHT)
                index = len(verts) - 1
                w = smoothstep(0.06, 0.35, f)
                if w > 1e-4:
                    weights[name][index] = w
        faces += grid_faces(FLIPPER_RINGS, FLIPPER_COLS, base=base)
        tip_index = len(verts)
        verts.append((side_x + sign * (length + 0.02), root_y + sweep * length, -0.02 - 0.05))
        uvs.append((0.97, 0.73))
        colours.append(SKIN)
        weights[name][tip_index] = 1.0
        rim = list(range(base + (FLIPPER_RINGS - 1) * FLIPPER_COLS, base + FLIPPER_RINGS * FLIPPER_COLS))
        faces += fan_faces(rim, tip_index)
        root_rim = list(range(base, base + FLIPPER_COLS))
        root_centre = len(verts)
        verts.append((side_x, root_y, -0.02))
        uvs.append((0.72, 0.73))
        colours.append(SKIN)
        faces += fan_faces(list(reversed(root_rim)), root_centre)

    # ------------------------------------------------------------------ tail
    tail_base = len(verts)
    for i in range(4):
        t = i / 3.0
        radius = mix(0.050, 0.012, t)
        for j in range(6):
            angle = math.tau * j / 6
            verts.append(
                (
                    radius * math.sin(angle),
                    TAIL_ROOT[1] + TAIL_LENGTH * t,
                    TAIL_ROOT[2] - radius * math.cos(angle) - 0.03 * t,
                )
            )
            uvs.append((0.90, 0.90))
            colours.append(SKIN)
    faces += grid_faces(4, 6, base=tail_base)
    tail_tip = len(verts)
    verts.append((0.0, TAIL_ROOT[1] + TAIL_LENGTH + 0.02, TAIL_ROOT[2] - 0.035))
    uvs.append((0.90, 0.92))
    colours.append(SKIN)
    faces += fan_faces(list(range(tail_base + 18, tail_base + 24)), tail_tip)

    obj = mesh_from("creature-turtle", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)

    joints = [
        ("head", (0.0, NECK_ROOT[1], NECK_ROOT[2]), (0.12, NECK_ROOT[1], NECK_ROOT[2]), weights["head"]),
        ("flipperFL", (0.42, -0.36, -0.02), (0.42, -0.52, -0.02), weights["flipperFL"]),
        ("flipperFR", (-0.42, -0.36, -0.02), (-0.42, -0.52, -0.02), weights["flipperFR"]),
        ("flipperBL", (0.33, 0.42, -0.02), (0.33, 0.26, -0.02), weights["flipperBL"]),
        ("flipperBR", (-0.33, 0.42, -0.02), (-0.33, 0.26, -0.02), weights["flipperBR"]),
    ]
    armature = bind_groups(obj, joints)
    return obj, armature


def main():
    args = parse_args({"tag": "", "render": True})
    obj, armature = build()
    tris = stats(obj, "creature-turtle")
    if tris > BUDGET:
        raise SystemExit("turtle over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj, armature], OUT)
    if args.get("render"):
        stem = "turtle" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)
        # A second textured pass: the shell painting sampled through the
        # exported UVs is the only way to *see* the mapping contract.
        render_views(
            [obj],
            stem + "-mapped",
            views={"top": (0.0, -0.001, 1.0), "quarter": (0.72, -0.78, 0.42)},
            texture_path="public/assets/creatures/turtle-shell.png",
        )


main()
