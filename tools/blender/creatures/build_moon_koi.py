"""Builds the Moon Koi — a great pale koi spirit for the Moonlit Lagoon.

    blender --background --python tools/blender/creatures/build_moon_koi.py -- --tag wave8

A 1.8 m body (Blender -Y head to +Y peduncle, glTF +Z forward) with the
deep, laterally thin shape of a koi, a low dorsal ridge, two small pectoral
fans, and the signature: a caudal RIBBON — a silk veil more than half the
body's length again, which the runtime trails behind the circle with delay.

Silver-white with a blush of rose along the back and one deep-blue eye per
cheek; the palette is a colour (creature_common's BYTE_COLOR path), not a
multiplier.

Joints: `spine0`..`spine4` nose-to-peduncle and `ribbon0`, `ribbon1` along
the veil. Every bone lies along Blender +Z (glTF +Y, the dorsal axis), so a
rotation about the bone's own local +Y is a LATERAL bend — the swim's
undulation and the circle's constant curve. Body weights blend linearly
between neighbouring joints; the ribbon's between its own two.

Contracts (measured off the export with `inspect_creature.mjs`):
- pivot at mid-body; the fish faces glTF +Z; dorsal is glTF +Y.
- spine joints at glTF z 0.65 / 0.32 / 0 / -0.32 / -0.60; ribbon at -0.90
  and -1.42; all local +Y -> (0, 1, 0). Order: root, spine0..4, ribbon0, 1.
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
    stats,
    write_uvs,
)

OUT = "public/assets/models/creature-moon-koi.glb"
BUDGET = 3500

#: (y, half_width_x, half_height_z) stations, nose to peduncle.
BODY_PROFILE = [
    (-0.90, 0.020, 0.030),
    (-0.79, 0.075, 0.095),
    (-0.61, 0.120, 0.150),
    (-0.36, 0.150, 0.185),
    (-0.09, 0.155, 0.195),
    (0.18, 0.130, 0.165),
    (0.45, 0.085, 0.115),
    (0.68, 0.048, 0.065),
    (0.90, 0.022, 0.030),
]
BODY_RINGS = 26
BODY_COLS = 20

#: The spine's joints, in Blender y (head -0.9 to peduncle +0.9), then the
#: ribbon's. The TS rig stands exactly here; change one, change both.
SPINE_Y = [-0.65, -0.32, 0.0, 0.32, 0.60]
RIBBON_Y = [0.90, 1.42]

#: The caudal veil: length past the peduncle, width envelope, thinness.
RIBBON_LENGTH = 1.12
RIBBON_RINGS = 20
RIBBON_WIDTH = [(0.0, 0.06), (0.25, 0.20), (0.6, 0.34), (0.85, 0.24), (1.0, 0.08)]
RIBBON_THICK = 0.008

#: The fins: a low dorsal ridge and two pectoral fans.
DORSAL_FROM, DORSAL_TO, DORSAL_HEIGHT = -0.30, 0.50, 0.055
PECTORAL_Y = -0.62

#: sRGB gouache.
SILVER_DORSAL = (0.90, 0.92, 0.95)
SILVER_BELLY = (0.97, 0.97, 0.985)
ROSE_BLUSH = (0.95, 0.70, 0.70)
EYE_BLUE = (0.10, 0.14, 0.38)
FIN_PALE = (0.93, 0.85, 0.88)
RIBBON_SILVER = (0.90, 0.92, 0.965)
RIBBON_ROSE = (0.95, 0.75, 0.78)


def body(y):
    return catmull(BODY_PROFILE, y)


def blush(x, y, z, dorsal):
    """Rose blotches on the back: crown, saddle and tail base — off-centre
    and fading down the flanks, because a koi's hi is a map, not a band."""
    if dorsal < 0.45:
        return 0.0
    flank = clamp(1.25 - abs(x) * 6.0)
    patch = (
        gauss(y, -0.55, 0.13) * gauss(x, 0.045, 0.055)
        + 0.85 * gauss(y, -0.08, 0.16) * gauss(x, -0.035, 0.060)
        + 0.7 * gauss(y, 0.48, 0.10) * gauss(x, 0.025, 0.045)
    )
    return clamp(patch * (dorsal - 0.45) * 1.6 * (0.35 + 0.65 * flank))


def eye_patch(x, y, z):
    best = 0.0
    for side in (-1.0, 1.0):
        d = (
            gauss(y, -0.78, 0.05)
            * gauss(x, side * 0.082, 0.05)
            * gauss(z, 0.015, 0.05)
        )
        best = max(best, d)
    return clamp(best * 2.2)


def spine_weights(y, out):
    """Linear blend between the two neighbouring spine joints."""
    joints = SPINE_Y + RIBBON_Y
    if y <= joints[0]:
        out[0] = 1.0
        return out
    for i in range(len(joints) - 1):
        if y <= joints[i + 1]:
            f = (y - joints[i]) / (joints[i + 1] - joints[i])
            out[i] = 1.0 - f
            out[i + 1] = f
            return out
    out[len(joints) - 1] = 1.0
    return out


def build():
    reset_scene()
    verts, uvs, colours = [], [], []
    weight_names = ["spine%d" % i for i in range(len(SPINE_Y))] + ["ribbon0", "ribbon1"]
    weights = {name: {} for name in weight_names}
    faces = []

    # ------------------------------------------------------------------ body
    ys = [BODY_PROFILE[0][0] + (BODY_PROFILE[-1][0] - BODY_PROFILE[0][0]) * k / (BODY_RINGS - 1) for k in range(BODY_RINGS)]
    for y in ys:
        half_w, half_h = body(y)
        row = [0.0] * len(weight_names)
        for j in range(BODY_COLS):
            angle = math.tau * j / BODY_COLS
            x = half_w * math.sin(angle)
            z = -half_h * math.cos(angle)
            verts.append((x, y, z))
            uvs.append((j / BODY_COLS, (y - BODY_PROFILE[0][0]) / 1.8))
            dorsal = 0.5 - 0.5 * math.cos(angle)
            colour = mix3(SILVER_BELLY, SILVER_DORSAL, dorsal)
            colour = mix3(colour, ROSE_BLUSH, blush(x, y, z, dorsal))
            eye = eye_patch(x, y, z)
            if eye > 0.0:
                colour = mix3(colour, EYE_BLUE, eye)
            colours.append(colour)
            index = len(verts) - 1
            for name, w in zip(weight_names, spine_weights(y, row)):
                if w > 1e-4:
                    weights[name][index] = w

    faces += grid_faces(BODY_RINGS, BODY_COLS)

    nose = len(verts)
    verts.append((0.0, BODY_PROFILE[0][0] - 0.012, 0.0))
    uvs.append((0.5, 0.0))
    colours.append(SILVER_BELLY)
    weights["spine0"][nose] = 1.0
    faces += fan_faces(list(reversed(range(0, BODY_COLS))), nose)

    tail_ring = (BODY_RINGS - 1) * BODY_COLS
    tail_cap = len(verts)
    verts.append((0.0, BODY_PROFILE[-1][0], 0.0))
    uvs.append((0.5, 1.0))
    colours.append(SILVER_DORSAL)
    weights["ribbon0"][tail_cap] = 1.0
    faces += fan_faces(list(range(tail_ring, tail_ring + BODY_COLS)), tail_cap)

    # ------------------------------------------------------------- dorsal fin
    fin_base = len(verts)
    fin_rings = 10
    for k in range(fin_rings):
        t = k / (fin_rings - 1)
        y = mix(DORSAL_FROM, DORSAL_TO, t)
        _, half_h = body(y)
        height = DORSAL_HEIGHT * math.sin(math.pi * min(1.0, t * 1.15)) ** 0.7
        # A thin diamond cross-section: base, crest pair, base.
        verts.append((0.0, y, half_h - 0.004))
        uvs.append((0.05, t))
        colours.append(FIN_PALE)
        verts.append((0.006, y, half_h + height))
        uvs.append((0.08, t))
        colours.append(FIN_PALE)
        verts.append((-0.006, y, half_h + height))
        uvs.append((0.08, t))
        colours.append(FIN_PALE)
        verts.append((0.0, y, half_h + 0.002))
        uvs.append((0.05, t))
        colours.append(FIN_PALE)
    for k in range(fin_rings - 1):
        a = fin_base + k * 4
        b = fin_base + (k + 1) * 4
        faces.append((a, b, b + 1, a + 1))
        faces.append((a + 1, b + 1, b + 2, a + 2))
        faces.append((a + 2, b + 2, b + 3, a + 3))
        faces.append((a + 3, b + 3, b, a))

    # ---------------------------------------------------------- pectoral fins
    for side in (-1.0, 1.0):
        half_w, _ = body(PECTORAL_Y)
        base = len(verts)
        rings = 6
        for k in range(rings):
            t = k / (rings - 1)
            width = mix(0.055, 0.012, t)
            cx = side * (half_w + 0.005 + 0.10 * t)
            cy = PECTORAL_Y - 0.16 * t
            cz = -0.02 - 0.05 * t
            verts.append((cx, cy + width, cz))
            uvs.append((0.12, t))
            colours.append(FIN_PALE)
            verts.append((cx, cy, cz + 0.008))
            uvs.append((0.14, t))
            colours.append(FIN_PALE)
            verts.append((cx, cy - width, cz))
            uvs.append((0.12, t))
            colours.append(FIN_PALE)
            verts.append((cx, cy, cz - 0.008))
            uvs.append((0.14, t))
            colours.append(FIN_PALE)
        for k in range(rings - 1):
            a = base + k * 4
            b = base + (k + 1) * 4
            faces.append((a, b, b + 1, a + 1))
            faces.append((a + 1, b + 1, b + 2, a + 2))
            faces.append((a + 2, b + 2, b + 3, a + 3))
            faces.append((a + 3, b + 3, b, a))

    # ---------------------------------------------------------------- ribbon
    ribbon_base = len(verts)
    for k in range(RIBBON_RINGS):
        t = k / (RIBBON_RINGS - 1)
        width = catmull(RIBBON_WIDTH, t)[0]
        y = RIBBON_Y[0] + RIBBON_LENGTH * t
        # The veil flows out of the peduncle, then pours down as silk does.
        z = -0.005 - 0.135 * t * t
        x_off = 0.02 * math.sin(2.0 * math.pi * t)
        row = [0.0] * len(weight_names)
        spine_weights(y, row)
        for lx, lz, u in (
            (-width / 2.0, 0.0, 0.0),
            (0.0, RIBBON_THICK / 2.0, 0.5),
            (width / 2.0, 0.0, 1.0),
            (0.0, -RIBBON_THICK / 2.0, 0.5),
        ):
            verts.append((x_off + lx, y, z + lz))
            uvs.append((u, 1.0 - t))
            edge = abs(lx) / (width / 2.0 + 1e-6)
            colours.append(mix3(RIBBON_SILVER, RIBBON_ROSE, clamp(edge)))
            index = len(verts) - 1
            for name, w in zip(weight_names, row):
                if w > 1e-4:
                    weights[name][index] = w
    for k in range(RIBBON_RINGS - 1):
        a = ribbon_base + k * 4
        b = ribbon_base + (k + 1) * 4
        faces.append((a, b, b + 1, a + 1))
        faces.append((a + 1, b + 1, b + 2, a + 2))
        faces.append((a + 2, b + 2, b + 3, a + 3))
        faces.append((a + 3, b + 3, b, a))
    tip = len(verts)
    verts.append((0.02 * math.sin(2.0 * math.pi), RIBBON_Y[0] + RIBBON_LENGTH + 0.03, -0.005 - 0.135))
    uvs.append((0.5, 0.0))
    colours.append(RIBBON_ROSE)
    weights["ribbon1"][tip] = 1.0
    last = ribbon_base + (RIBBON_RINGS - 1) * 4
    faces += fan_faces([last, last + 1, last + 2, last + 3], tip)

    obj = mesh_from("creature-moon-koi", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)

    joints = []
    for i, y in enumerate(SPINE_Y):
        joints.append(("spine%d" % i, (0.0, y, 0.0), (0.0, y, 0.1), weights["spine%d" % i]))
    for i, y in enumerate(RIBBON_Y):
        joints.append(("ribbon%d" % i, (0.0, y, 0.0), (0.0, y, 0.1), weights["ribbon%d" % i]))
    armature = bind_groups(obj, joints)
    return obj, armature


def main():
    args = parse_args({"tag": "", "render": True})
    obj, armature = build()
    tris = stats(obj, "creature-moon-koi")
    if tris > BUDGET:
        raise SystemExit("moon koi over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj, armature], OUT)
    if args.get("render"):
        stem = "moon-koi" + (("-" + args["tag"]) if args["tag"] else "")
        views = {
            "front": (0.0, -1.0, 0.0),
            "side": (1.0, 0.0, 0.06),
            "top": (0.0, -0.001, 1.0),
            "quarter": (0.72, -0.78, 0.42),
        }
        render_views([obj], stem, views=views)


main()
