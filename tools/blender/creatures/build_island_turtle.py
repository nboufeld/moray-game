"""Builds the Island That Swims — a turtle elder whose shell is a garden.

    blender --background --python tools/blender/creatures/build_island_turtle.py -- --tag wave8

A 4.5 m carapace, centuries old: broader and flatter than the visitor
turtle's, the dome worn to a gentle saddle, and on that dome a hanging
garden — moss mats, small coral knobs, a few golden seaweed tufts — all
AUTHORED INTO THE MESH with `COLOR_0`, so the game assembles nothing at
runtime. The palette is age: olive-and-amber shell, moss greens, coral-rose
accents, a plastron gone ivory with years.

Joints are the visitor turtle's idiom, scaled (see CREATURES.md's turtle
table): `head` lies along Blender +X (glTF +X; the nod is a rotation about
the bone's own +Y), and the four flippers lie along Blender -Y (glTF +Z,
body-forward) so the stroke is a roll about the root line. Weights ramp in
over the first stretch of each limb so a rotation bends at the shoulder.

Determinism: every scatter is drawn from one fixed `random.Random` seed, so
a rebuild is bit-identical. UVs are parametric and documented in the wave-8
ledger; no painting travels with this asset — the vertex colours are the art.
"""

import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from creature_common import (  # noqa: E402
    bind_groups,
    catmull,
    clamp,
    export_glb,
    fan_faces,
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

OUT = "public/assets/models/creature-island-turtle.glb"
BUDGET = 6000

#: Carapace length and where it sits: centred on the origin, pivot at the
#: shell's centre — the visitor turtle's own contract, scaled up. Forward is
#: Blender -Y (glTF +Z).
SHELL_LENGTH = 4.50
HALF_L = SHELL_LENGTH / 2.0

BODY_RINGS = 24
BODY_HALF_COLS = 17  # mirrored to 32 columns per ring

#: (s, half_width, dome_height, plastron_depth, centre_z); s runs 0 at the
#: shell's front edge to 1 at its rear. Elder proportions: wide, long, and
#: worn low — a young turtle is a dome, an old one is a hill.
BODY_PROFILE = [
    (0.00, 0.240, 0.170, 0.120, 0.060),
    (0.10, 0.900, 0.520, 0.230, 0.030),
    (0.25, 1.340, 0.800, 0.300, 0.010),
    (0.45, 1.600, 0.950, 0.330, 0.000),
    (0.60, 1.620, 0.955, 0.330, -0.010),
    (0.75, 1.460, 0.860, 0.310, -0.005),
    (0.90, 0.960, 0.560, 0.240, 0.020),
    (1.00, 0.260, 0.180, 0.120, 0.040),
]

#: The worn rim: wider and less crisp than the young turtle's — centuries of
#: bumping into the world soften an edge.
RIM_FLARE = 0.10
RIM_WIDTH = 0.17
RIM_DROOP = 0.045
RIM_SPLIT_PHI = 0.40 * math.pi

#: sRGB gouache — age and gardens.
SHELL_OLIVE = (0.470, 0.440, 0.260)  # costal fields
SHELL_SEAM = (0.365, 0.345, 0.200)  # worn dark lines between the plates
SHELL_AMBER = (0.700, 0.560, 0.300)  # vertebral ridge and scute hearts
MARGINAL = (0.780, 0.715, 0.480)  # worn cream-amber rim scutes
PLASTRON = (0.810, 0.760, 0.570)  # ivory with years
SKIN = (0.545, 0.580, 0.370)  # sage
SKIN_LIGHT = (0.700, 0.715, 0.500)
SKIN_WRINKLE = (0.435, 0.470, 0.300)
EYE = (0.130, 0.115, 0.095)
MOSS = (0.400, 0.520, 0.260)
MOSS_PALE = (0.560, 0.640, 0.330)
CORAL_ROSE = (0.800, 0.440, 0.360)
CORAL_TIP = (0.925, 0.650, 0.565)
TUFT_BASE = (0.360, 0.445, 0.205)
TUFT_TIP = (0.820, 0.700, 0.300)

#: Neck and head: the elder's head is large and its beak blunt — the face is
#: where the discovery happens, so it gets rings.
NECK_ROOT = (0.0, -2.10, 0.150)
NECK_LENGTH = 1.30
NECK_PROFILE = [
    (0.00, 0.320, 0.000),
    (0.25, 0.235, 0.090),
    (0.50, 0.240, 0.190),
    (0.70, 0.360, 0.250),
    (0.88, 0.285, 0.205),
    (1.00, 0.130, 0.095),
]
NECK_RINGS = 12
NECK_COLS = 12

#: Flippers: (side_x, root_y, length, root_chord, mid_chord, sweep_back).
FRONT_FLIPPER = (1.34, -1.16, 1.75, 0.52, 0.62, 0.42)
REAR_FLIPPER = (1.06, 1.35, 0.95, 0.42, 0.47, 0.55)
FLIPPER_RINGS = 8
FLIPPER_COLS = 6

TAIL_ROOT = (0.0, 2.18, -0.050)
TAIL_LENGTH = 0.50

#: Eyes: low on the skull, with the pale elder brow.
EYE_T = 0.70
EYE_ANGLE = 0.42 * math.pi  # in the neck-section's own angle convention

#: The garden, scattered over the dome above the rim crease: moss mats
#: (flat), coral knobs (stubby), tufts (ribbons). All counts small — the
#: garden reads as a place, not a noise field.
MOSS_MATS = 12
CORAL_KNOBS = 22
TUFTS = 4
GARDEN_S = (0.14, 0.88)
GARDEN_PHI = (0.58 * math.pi, 0.92 * math.pi)  # above the rim, off the spine

rng = random.Random(0x151_A4D)


def body_section(s):
    return catmull(BODY_PROFILE, s)


def gauss(x, centre, width):
    d = (x - centre) / width
    return math.exp(-d * d)


def body_point(s, phi_m, side):
    """The visitor turtle's section, aged: plastron curve below the rim, dome
    above, a soft crease where they meet."""
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


def shell_colour(s, phi_m):
    """The aged carapace: olive costals, an amber vertebral ridge with scute
    hearts beating down it, worn cream marginals, ivory plastron."""
    if phi_m < RIM_SPLIT_PHI:
        return PLASTRON
    if phi_m < 0.55 * math.pi:
        return MARGINAL
    if phi_m > 0.88 * math.pi:
        # Vertebral ridge: amber, breathing gently darker at the scute seams —
        # worn plates, not a barcode.
        cell = (s * 5.0) % 1.0
        seam = smoothstep(0.0, 0.25, cell) * (1.0 - smoothstep(0.75, 1.0, cell))
        return mix3(mix3(SHELL_AMBER, SHELL_OLIVE, 0.45), SHELL_AMBER, 0.55 + 0.45 * seam)
    # Costal fields: olive plates with dark seams and long amber hearts, all
    # on the vertebrals' own grid.
    cell = (s * 5.0) % 1.0
    heart = gauss(cell, 0.5, 0.30) * gauss(phi_m, 0.72 * math.pi, 0.16 * math.pi)
    seam = smoothstep(0.0, 0.18, cell) * (1.0 - smoothstep(0.82, 1.0, cell))
    plate = mix3(SHELL_SEAM, SHELL_OLIVE, 0.45 + 0.55 * seam)
    return mix3(plate, SHELL_AMBER, 0.60 * clamp(heart))


def body_uv(s, phi_m):
    return (phi_m / (2.0 * math.pi), s)


def dome_normal(s, phi_m, side):
    a, dome, _plast, _cz = body_section(s)
    x = math.sin(phi_m) / max(a, 1e-3)
    z = -math.cos(phi_m) / max(dome, 1e-3)
    length = math.hypot(x, z) or 1.0
    return (side * x / length, 0.0, z / length)


def tangent_frame(normal):
    """The dome normal has no body-axis component, so the frame is exact:
    `along` runs around the shell's girth, `body` runs its length."""
    tx, _, tz = normal
    along = (-tz, 0.0, tx)
    return along, (0.0, 1.0, 0.0)


def moss_mat(centre, normal, radius):
    """A flat moss patch: two rings and a centre, painted moss with the edge
    falling back to the shell's olive so the mat sits IN the carapace."""
    verts, colours, faces = [], [], []
    tx, _, tz = normal
    (ax, ay, az), (bx, by, bz) = tangent_frame(normal)
    for j in range(8):
        angle = math.tau * j / 8
        c, sn = math.cos(angle) * radius, math.sin(angle) * radius
        verts.append((centre[0] + ax * c + bx * sn, centre[1] + ay * c + by * sn, centre[2] + az * c + bz * sn))
        colours.append(SHELL_OLIVE)
    for j in range(8):
        angle = math.tau * j / 8
        c, sn = math.cos(angle) * radius * 0.62, math.sin(angle) * radius * 0.62
        lift = radius * 0.14
        verts.append(
            (
                centre[0] + ax * c + bx * sn + tx * lift,
                centre[1] + ay * c + by * sn,
                centre[2] + az * c + bz * sn + tz * lift,
            )
        )
        colours.append(MOSS)
    verts.append((centre[0] + tx * radius * 0.22, centre[1], centre[2] + tz * radius * 0.22))
    colours.append(MOSS_PALE)
    for j in range(8):
        a, b = j, (j + 1) % 8
        faces.append((a, b, 8 + b, 8 + a))
        faces.append((16, 8 + a, 8 + b))
    return verts, colours, faces


def coral_knob(centre, normal, radius, height):
    """A stubby coral knob: a two-segment taper with a rounded rose tip."""
    verts, colours, faces = [], [], []
    tx, _, tz = normal
    (ax, ay, az), (bx, by, bz) = tangent_frame(normal)
    rings = [(0.0, radius), (0.45, radius * 0.72), (0.8, radius * 0.45)]
    for f, r in rings:
        for j in range(5):
            angle = math.tau * j / 5
            c, sn = math.cos(angle) * r, math.sin(angle) * r
            rise = height * f
            verts.append(
                (
                    centre[0] + tx * rise + ax * c + bx * sn,
                    centre[1] + ay * c + by * sn,
                    centre[2] + tz * rise + az * c + bz * sn,
                )
            )
            colours.append(mix3(CORAL_ROSE, CORAL_TIP, f * 0.6))
    tip = len(verts)
    verts.append((centre[0] + tx * height * 1.08, centre[1], centre[2] + tz * height * 1.08))
    colours.append(CORAL_TIP)
    for i in range(2):
        for j in range(5):
            a, b = i * 5 + j, i * 5 + (j + 1) % 5
            faces.append((a, b, b + 5, a + 5))
    for j in range(5):
        faces.append((tip, 10 + j, 10 + (j + 1) % 5))
    return verts, colours, faces


def tuft(centre, normal, height, lean):
    """One golden seaweed tuft: three crossed ribbons, base green to tips of
    sargassum gold, bowed a little by a current long since gone."""
    verts, colours, faces = [], [], []
    tx, _, tz = normal
    sections = 5
    for ribbon in range(3):
        axis = math.tau * ribbon / 3
        ux, uy = math.cos(axis), math.sin(axis)
        base = len(verts)
        for i in range(sections):
            f = i / (sections - 1)
            bow = lean * f * f
            cx = centre[0] + tx * height * f + bow
            cz = centre[2] + tz * height * f + bow * 0.3
            cy = centre[1] + 0.02 * math.sin(f * math.pi)
            width = 0.075 * (1.0 - f * 0.55)
            verts.append((cx + ux * width, cy + uy * width, cz))
            verts.append((cx - ux * width, cy - uy * width, cz))
            shade = mix3(TUFT_BASE, TUFT_TIP, f)
            colours.append(shade)
            colours.append(shade)
        for i in range(sections - 1):
            a = base + i * 2
            faces.append((a, a + 1, a + 3, a + 2))
    return verts, colours, faces


def garden_spot(used, min_gap_s, min_gap_phi):
    """Draws a dome position not too near one already taken."""
    for _ in range(40):
        s = rng.uniform(*GARDEN_S)
        phi_m = rng.uniform(*GARDEN_PHI)
        if all(abs(s - us) > min_gap_s or abs(phi_m - up) > min_gap_phi for us, up in used):
            used.append((s, phi_m))
            return s, phi_m
    s = rng.uniform(*GARDEN_S)
    phi_m = rng.uniform(*GARDEN_PHI)
    used.append((s, phi_m))
    return s, phi_m


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
            uvs.append(body_uv(s, phi_m))
            colours.append(shell_colour(s, phi_m))

    cols = 2 * BODY_HALF_COLS - 2
    faces += grid_faces(BODY_RINGS, cols)

    front = len(verts)
    verts.append((0.0, -HALF_L - 0.06, body_section(0.0)[3] + 0.03))
    uvs.append((0.25, 0.0))
    colours.append(MARGINAL)
    faces += fan_faces(list(range(0, cols)), front)

    rear_base = (BODY_RINGS - 1) * cols
    rear = len(verts)
    verts.append((0.0, HALF_L + 0.06, body_section(1.0)[3] + 0.03))
    uvs.append((0.25, 1.0))
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
            uvs.append((0.05 + 0.9 * t, 0.5 + 0.4 * (0.5 + 0.5 * math.sin(angle))))
            shade = 0.5 - 0.5 * math.cos(angle)  # 0 belly, 1 crown
            base = mix3(SKIN_LIGHT, SKIN, shade)
            # Elders are wrinkled: darker bands around the throat.
            wrinkle = gauss((t * 3.2) % 1.0, 0.5, 0.10) * (1.0 - smoothstep(0.55, 0.8, t)) * smoothstep(0.10, 0.25, t)
            colours.append(mix3(base, SKIN_WRINKLE, 0.55 * clamp(wrinkle)))
            index = len(verts) - 1
            w = smoothstep(0.12, 0.5, t)
            if w > 1e-4:
                weights["head"][index] = w
    faces += grid_faces(NECK_RINGS, NECK_COLS, base=neck_base)

    beak = len(verts)
    tip = catmull(NECK_PROFILE, 1.0)
    verts.append((0.0, NECK_ROOT[1] - NECK_LENGTH - 0.11, NECK_ROOT[2] + tip[1] - 0.08))
    uvs.append((0.5, 0.9))
    colours.append(SKIN)
    weights["head"][beak] = 1.0
    rim = list(range(neck_base + (NECK_RINGS - 1) * NECK_COLS, neck_base + NECK_RINGS * NECK_COLS))
    faces += fan_faces(rim, beak)

    # Eyes: a dark bead with the pale elder brow, painted on the skull rings.
    eye_ring = neck_base + round(EYE_T * (NECK_RINGS - 1)) * NECK_COLS
    for i in (eye_ring, eye_ring + NECK_COLS):
        for j in range(NECK_COLS):
            angle = math.tau * j / NECK_COLS
            if abs(abs(angle - math.pi / 2) - EYE_ANGLE) < 0.32:
                colours[i + j] = EYE
            elif abs(abs(angle - math.pi / 2) - (EYE_ANGLE + 0.55)) < 0.22:
                colours[i + j] = mix3(SKIN_LIGHT, SKIN, 0.25)

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
            thick = mix(0.130, 0.032, f)
            cx = side_x + sign * length * f
            cy = root_y + sweep * length * f * f
            czf = -0.06 - 0.15 * f * f
            for j in range(FLIPPER_COLS):
                angle = math.tau * j / FLIPPER_COLS
                y = cy + chord * math.cos(angle)
                z = czf + thick * math.sin(angle)
                verts.append((cx, y, z))
                uvs.append((0.05 + 0.9 * f, 0.1 + 0.3 * (0.5 + 0.5 * math.cos(angle))))
                colours.append(SKIN if math.sin(angle) >= 0.0 else SKIN_LIGHT)
                index = len(verts) - 1
                w = smoothstep(0.06, 0.35, f)
                if w > 1e-4:
                    weights[name][index] = w
        faces += grid_faces(FLIPPER_RINGS, FLIPPER_COLS, base=base)
        tip_index = len(verts)
        verts.append((side_x + sign * (length + 0.06), root_y + sweep * length, -0.06 - 0.15))
        uvs.append((0.95, 0.2))
        colours.append(SKIN)
        weights[name][tip_index] = 1.0
        rim = list(range(base + (FLIPPER_RINGS - 1) * FLIPPER_COLS, base + FLIPPER_RINGS * FLIPPER_COLS))
        faces += fan_faces(rim, tip_index)
        root_rim = list(range(base, base + FLIPPER_COLS))
        root_centre = len(verts)
        verts.append((side_x, root_y, -0.06))
        uvs.append((0.02, 0.2))
        colours.append(SKIN)
        faces += fan_faces(list(reversed(root_rim)), root_centre)

    # ------------------------------------------------------------------ tail
    tail_base = len(verts)
    for i in range(4):
        t = i / 3.0
        radius = mix(0.150, 0.040, t)
        for j in range(6):
            angle = math.tau * j / 6
            verts.append(
                (
                    radius * math.sin(angle),
                    TAIL_ROOT[1] + TAIL_LENGTH * t,
                    TAIL_ROOT[2] - radius * math.cos(angle) - 0.09 * t,
                )
            )
            uvs.append((0.5, 0.95))
            colours.append(SKIN)
    faces += grid_faces(4, 6, base=tail_base)
    tail_tip = len(verts)
    verts.append((0.0, TAIL_ROOT[1] + TAIL_LENGTH + 0.06, TAIL_ROOT[2] - 0.11))
    uvs.append((0.5, 0.97))
    colours.append(SKIN)
    faces += fan_faces(list(range(tail_base + 18, tail_base + 24)), tail_tip)

    # ---------------------------------------------------------- the garden
    used = []
    for _ in range(MOSS_MATS):
        s, phi_m = garden_spot(used, 0.10, 0.10 * math.pi)
        side = rng.choice((1.0, -1.0))
        phi_draw = phi_m if side > 0 else phi_m  # dome is mirrored; paint either flank
        x, y, z = body_point(s, phi_draw, side)
        normal = dome_normal(s, phi_draw, side)
        radius = rng.uniform(0.28, 0.50)
        centre = (x + normal[0] * 0.02, y, z + normal[2] * 0.02)
        sv, sc, sf = moss_mat(centre, normal, radius)
        base = len(verts)
        verts += sv
        uvs += [(0.5, 0.5)] * len(sv)
        colours += sc
        faces += [tuple(base + i for i in quad) for quad in sf]

    for _ in range(CORAL_KNOBS):
        s, phi_m = garden_spot(used, 0.07, 0.07 * math.pi)
        side = rng.choice((1.0, -1.0))
        x, y, z = body_point(s, phi_m, side)
        normal = dome_normal(s, phi_m, side)
        radius = rng.uniform(0.10, 0.16)
        height = rng.uniform(0.16, 0.34)
        centre = (x + normal[0] * 0.01, y, z + normal[2] * 0.01)
        sv, sc, sf = coral_knob(centre, normal, radius, height)
        base = len(verts)
        verts += sv
        uvs += [(0.5, 0.5)] * len(sv)
        colours += sc
        faces += [tuple(base + i for i in face) for face in sf]

    for _ in range(TUFTS):
        s, phi_m = garden_spot(used, 0.16, 0.16 * math.pi)
        x, y, z = body_point(s, math.pi, 1.0)  # tufts crown the spine
        normal = dome_normal(s, math.pi, 1.0)
        height = rng.uniform(0.45, 0.62)
        lean = rng.uniform(-0.10, 0.10)
        centre = (x, y, z + 0.02)
        sv, sc, sf = tuft(centre, normal, height, lean)
        base = len(verts)
        verts += sv
        uvs += [(0.5, 0.5)] * len(sv)
        colours += sc
        faces += [tuple(base + i for i in face) for face in sf]

    obj = mesh_from("creature-island-turtle", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)

    joints = [
        ("head", (0.0, NECK_ROOT[1], NECK_ROOT[2]), (0.40, NECK_ROOT[1], NECK_ROOT[2]), weights["head"]),
        ("flipperFL", (1.34, -1.16, -0.06), (1.34, -1.52, -0.06), weights["flipperFL"]),
        ("flipperFR", (-1.34, -1.16, -0.06), (-1.34, -1.52, -0.06), weights["flipperFR"]),
        ("flipperBL", (1.06, 1.35, -0.06), (1.06, 0.99, -0.06), weights["flipperBL"]),
        ("flipperBR", (-1.06, 1.35, -0.06), (-1.06, 0.99, -0.06), weights["flipperBR"]),
    ]
    armature = bind_groups(obj, joints)
    return obj, armature


def main():
    args = parse_args({"tag": "", "render": True})
    obj, armature = build()
    tris = stats(obj, "creature-island-turtle")
    if tris > BUDGET:
        raise SystemExit("island turtle over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj, armature], OUT)
    if args.get("render"):
        stem = "island-turtle" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
