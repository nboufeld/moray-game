"""Builds the Reef Kirin — a seahorse-deer spirit, 1.6 m to the antler tips.

    blender --background --python tools/blender/creatures/build_kirin.py -- --tag wave8

An upright seahorse's body — curled tail, full belly, arched neck — carrying
a deer's head: long muzzle, small leaf ears, and two branching antlers of
living coral. A moss mane runs from the crown of the head down the back of
the neck, the way a deer's mane would if a deer were also a reef.

The body is one tube lofted along an authored centreline (the S-curve is
the whole animal, so it is sculpted as stations rather than assembled);
mane, ears and antlers are merged into the same mesh. The palette is the
brief's: pale gold body with a cream belly, moss-green mane accents,
coral-rose antlers.

Joints, the brief's minimum plus the one the behaviour needs: `neck`
(axis Blender +Z, glTF +Y: a yaw, the deer turning to look), `head`
(axis Blender +X, glTF +X: a pitch, the nibble bob), and `tail` (axis +Z:
the curl's slow sway). The chest keeps `root` weight, so the animal stays
planted while its attention moves — a grazer, not a fish.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from creature_common import (  # noqa: E402
    bind_groups,
    catmull,
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

OUT = "public/assets/models/creature-kirin.glb"
BUDGET = 4500

RINGS = 72
COLS = 16

#: The centreline: (t, y, z, radius) — x is always 0, so the ring frame is
#: analytic and stable. Blender: -y is forward (glTF +Z), +z is up.
#: t = 0 is the tail tip inside the curl; t = 1 is the nose.
SPINE = [
    (0.00, 0.10, 0.16, 0.014),
    (0.04, 0.02, 0.05, 0.020),
    (0.08, -0.10, 0.05, 0.026),
    (0.12, -0.16, 0.16, 0.030),
    (0.16, -0.10, 0.27, 0.034),
    (0.20, 0.02, 0.33, 0.040),
    (0.28, 0.06, 0.45, 0.062),
    (0.36, 0.08, 0.58, 0.078),
    (0.46, 0.06, 0.72, 0.088),
    (0.56, 0.02, 0.85, 0.082),
    (0.64, -0.03, 0.97, 0.062),
    (0.72, -0.08, 1.09, 0.052),
    (0.80, -0.13, 1.20, 0.048),
    (0.86, -0.17, 1.30, 0.050),
    (0.90, -0.20, 1.38, 0.058),
    (0.94, -0.25, 1.40, 0.045),
    (0.97, -0.30, 1.395, 0.034),
    (1.00, -0.345, 1.380, 0.022),
]

#: Ring cross-section squeezes: belly round, skull wide, muzzle narrow.
def section(t):
    y, z, r = catmull(SPINE, t)
    # The skull is wider than it is deep; the chest the reverse.
    wide = 1.0 + 0.22 * smoothstep(0.86, 0.92, t)
    deep = 1.0 - 0.10 * smoothstep(0.90, 1.00, t)
    return y, z, r, wide, deep


#: Mane: (t, height) from mid-back up onto the crown of the skull, so the
#: ridge meets the antlers instead of stopping short of them.
MANE_PROFILE = [
    (0.50, 0.020),
    (0.62, 0.060),
    (0.74, 0.078),
    (0.84, 0.062),
    (0.90, 0.034),
    (0.93, 0.018),
]

#: sRGB gouache. Pale gold body, cream belly, moss mane, coral antlers;
#: the nose wears the antlers' hue, deepened — a doe's soft muzzle.
#: Atelier repaint: the first pass's back and band sat a half-step under the
#: body and the whole animal read as one cream tube. Three honest bands now —
#: cream belly, gold flank, umber back — with tail rings deep enough to read
#: and a mane/antler set that carries its own value structure.
BODY = (0.905, 0.800, 0.575)
BELLY = (0.955, 0.910, 0.755)
BACK = (0.615, 0.495, 0.305)
BAND = (0.545, 0.405, 0.260)
MANE = (0.360, 0.445, 0.255)
MANE_TIP = (0.665, 0.720, 0.430)
ANTLER = (0.800, 0.480, 0.400)
ANTLER_TIP = (0.975, 0.805, 0.680)
NOSE = (0.560, 0.360, 0.335)
EYE = (0.185, 0.130, 0.115)
BROW = (0.960, 0.930, 0.800)


def ring_frame(t):
    """Centre C, tangent T, and the two ring axes (N1 across, N2 in-plane)."""
    y, z, r, wide, deep = section(t)
    eps = 0.004
    y0, z0 = section(max(0.0, t - eps))[0], section(max(0.0, t - eps))[1]
    y1, z1 = section(min(1.0, t + eps))[0], section(min(1.0, t + eps))[1]
    ty, tz = y1 - y0, z1 - z0
    length = math.hypot(ty, tz) or 1.0
    ty, tz = ty / length, tz / length
    # N1 = (1, 0, 0) is perpendicular to any tangent in the y-z plane.
    # N2 = T x N1 = (0, tz, -ty): points backward along the body surface.
    return (y, z, r, wide, deep), (ty, tz), (tz, -ty)


def spine_point(t, a):
    (y, z, r, wide, deep), _, (n2y, n2z) = ring_frame(t)
    return (
        r * wide * math.cos(a),
        y + r * deep * math.sin(a) * n2y,
        z + r * deep * math.sin(a) * n2z,
    )


def body_weights(t):
    """neck/head/tail ramps; the chest keeps the root's share."""
    w = {}
    neck = smoothstep(0.54, 0.62, t) * (1.0 - smoothstep(0.82, 0.88, t))
    head = smoothstep(0.82, 0.88, t)
    tail = 1.0 - smoothstep(0.16, 0.30, t)
    if neck > 1e-4:
        w["neck"] = neck
    if head > 1e-4:
        w["head"] = head
    if tail > 1e-4:
        w["tail"] = tail
    return w


def body_colour(t, a):
    """a = 0 at the animal's left, pi/2 at the back, 3pi/2 at the belly."""
    belly = smoothstep(0.20, 0.80, -math.sin(a))
    dorsal = smoothstep(0.18, 0.85, math.sin(a))
    base = mix3(mix3(BODY, BACK, dorsal), BELLY, belly)
    # Painted rings around the tail curl, fading up the belly.
    rings = 0.5 + 0.5 * math.sin(t * 9.0 * math.tau + 1.3)
    rings = smoothstep(0.58, 0.88, rings) * (1.0 - smoothstep(0.30, 0.46, t))
    base = mix3(base, BAND, rings * 0.78)
    # The muzzle dips toward the antlers' rose.
    nose = smoothstep(0.955, 0.995, t)
    return mix3(base, NOSE, nose * 0.85)


def build():
    reset_scene()
    verts, uvs, colours = [], [], []
    weights = {"neck": {}, "head": {}, "tail": {}}
    faces = []

    def add_weights(index, w):
        for name, value in w.items():
            weights[name][index] = value

    # ------------------------------------------------------------------ body
    for i in range(RINGS):
        t = i / (RINGS - 1)
        for j in range(COLS):
            a = math.tau * j / COLS
            verts.append(spine_point(t, a))
            u = (a if a <= math.pi else math.tau - a) / math.tau
            uvs.append((u, t))
            colours.append(body_colour(t, a))
            add_weights(len(verts) - 1, body_weights(t))
    faces += grid_faces(RINGS, COLS)

    for t, tip_i in ((0.0, "tail"), (1.0, "head")):
        tip = len(verts)
        y, z, r, _, _ = section(t)
        y1, z1 = section(1.0)[0], section(1.0)[1]
        if t == 0.0:
            verts.append((0.0, y + 0.02, z - 0.01))
        else:
            verts.append((0.0, y1 - 0.028, z1 - 0.012))
        uvs.append((0.25, t))
        colours.append(NOSE if t == 1.0 else BODY)
        add_weights(tip, {tip_i: 1.0})
        base = (RINGS - 1) * COLS if t == 1.0 else 0
        ring = list(range(base, base + COLS))
        faces += fan_faces(ring if t == 1.0 else list(reversed(ring)), tip)

    # Eyes: a dark oval per side of the skull, set forward of the ears the
    # way a deer's sit — front-flank on each side, mirrored across x.
    # Blended, not stamped: the stamped box quantised to the ring grid. A
    # pale brow crescent sits dorsal of each eye — the deer's lit lid.
    for i in range(RINGS):
        t = i / (RINGS - 1)
        for j in range(COLS):
            a = math.tau * j / COLS
            index = i * COLS + j
            for centre, toward_back in ((1.85 * math.pi, 1.0), (1.15 * math.pi, -1.0)):
                da = min(abs(a - centre), math.tau - abs(a - centre)) / (0.10 * math.pi)
                ds = (t - 0.9175) / 0.020
                d = math.hypot(da, ds)
                if d < 1.7:
                    colours[index] = mix3(colours[index], EYE, 1.0 - smoothstep(0.8, 1.4, d))
                brow_centre = centre + toward_back * 0.14 * math.pi
                db = min(abs(a - brow_centre), math.tau - abs(a - brow_centre)) / (0.10 * math.pi)
                dbs = math.hypot(db, (t - 0.9175) / 0.028)
                colours[index] = mix3(colours[index], BROW, gauss(dbs, 0.0, 0.75) * 0.5)

    # ------------------------------------------------------------------ mane
    mane = []
    for i in range(0, RINGS, 2):
        t = i / (RINGS - 1)
        if t < MANE_PROFILE[0][0] or t > MANE_PROFILE[-1][0]:
            continue
        base = spine_point(t, math.pi / 2.0)
        height = catmull(MANE_PROFILE, t)[0]
        frond = 0.5 + 0.5 * math.sin(t * 8.0 * math.tau)
        height *= 1.0 + 0.15 * (frond * 2.0 - 1.0)
        _, _, (n2y, n2z) = ring_frame(t)
        base_i = len(verts)
        verts.append(base)
        uvs.append((0.5, t))
        # The mane's value rides its own scallop: tall fronds catch light at
        # the tip, the bays between sink toward the root's shade.
        colours.append(mix3(MANE, (0.290, 0.365, 0.215), 0.5 * (1.0 - frond)))
        tip_i = len(verts)
        verts.append((base[0], base[1] + n2y * height, base[2] + n2z * height))
        uvs.append((0.53, t))
        colours.append(mix3(MANE, MANE_TIP, 0.35 + 0.65 * frond))
        add_weights(base_i, body_weights(t))
        add_weights(tip_i, body_weights(t))
        mane.append((base_i, tip_i))
    for k in range(len(mane) - 1):
        (a0, t0), (a1, t1) = mane[k], mane[k + 1]
        faces.append((a0, a1, t1, t0))

    # --------------------------------------------------------------- antlers
    for sign in (1.0, -1.0):
        base = (sign * 0.040, -0.195, 1.415)
        beam = [
            base,
            (sign * 0.072, -0.150, 1.500),
            (sign * 0.108, -0.105, 1.585),
            (sign * 0.138, -0.070, 1.665),
        ]
        tines = [
            [(sign * 0.072, -0.150, 1.500), (sign * 0.100, -0.255, 1.560), (sign * 0.114, -0.305, 1.595)],
            [(sign * 0.108, -0.105, 1.585), (sign * 0.155, -0.085, 1.655), (sign * 0.172, -0.075, 1.700)],
            [(sign * 0.108, -0.105, 1.585), (sign * 0.120, -0.005, 1.640), (sign * 0.128, 0.045, 1.670)],
        ]
        for branch in (beam, *tines):
            rows = []
            for k, (bx, by, bz) in enumerate(branch):
                bt = k / (len(branch) - 1)
                r = mix(0.020, 0.006, bt)
                # Direction of the branch for the ring frame.
                if k < len(branch) - 1:
                    nx, ny, nz = (branch[k + 1][c] - branch[k][c] for c in range(3))
                else:
                    nx, ny, nz = (branch[k][c] - branch[k - 1][c] for c in range(3))
                nl = math.sqrt(nx * nx + ny * ny + nz * nz) or 1.0
                nx, ny, nz = nx / nl, ny / nl, nz / nl
                # Any perpendicular pair.
                ax, ay, az = 0.0, -nz, ny
                al = math.hypot(ay, az) or 1.0
                ay, az = ay / al, az / al
                bxv, byv, bzv = ny * az - nz * ay, nz * 0.0 - nx * az, nx * ay - ny * 0.0
                row = []
                for j in range(6):
                    a = math.tau * j / 6
                    ca, sa = math.cos(a), math.sin(a)
                    index = len(verts)
                    verts.append(
                        (
                            bx + r * (ca * ax + sa * bxv),
                            by + r * (ca * ay + sa * byv),
                            bz + r * (ca * az + sa * bzv),
                        )
                    )
                    uvs.append((0.8 + 0.1 * ca, 0.6 + 0.35 * bt))
                    colours.append(mix3(ANTLER, ANTLER_TIP, bt * bt))
                    add_weights(index, {"head": 1.0})
                    row.append(index)
                rows.append(row)
            for k in range(len(rows) - 1):
                for j in range(6):
                    a = rows[k][j]
                    b = rows[k][(j + 1) % 6]
                    c = rows[k + 1][(j + 1) % 6]
                    d = rows[k + 1][j]
                    faces.append((a, b, c, d))
            tip_i = len(verts)
            tx, ty, tz = branch[-1]
            verts.append((tx, ty, tz))
            uvs.append((0.85, 0.97))
            colours.append(ANTLER_TIP)
            add_weights(tip_i, {"head": 1.0})
            faces += fan_faces(list(reversed(rows[-1])), tip_i)

    # ------------------------------------------------------------------ ears
    for sign in (1.0, -1.0):
        base = (sign * 0.048, -0.175, 1.400)
        tip = (sign * 0.140, -0.115, 1.470)
        back = (sign * 0.085, -0.095, 1.425)
        b_i = len(verts)
        verts.append(base)
        uvs.append((0.75, 0.5))
        colours.append(MANE)
        t_i = len(verts)
        verts.append(tip)
        uvs.append((0.85, 0.6))
        colours.append(MANE_TIP)
        k_i = len(verts)
        verts.append(back)
        uvs.append((0.8, 0.45))
        colours.append(MANE)
        for i in (b_i, t_i, k_i):
            add_weights(i, {"head": 1.0})
        faces.append((b_i, t_i, k_i) if sign > 0 else (b_i, k_i, t_i))

    obj = mesh_from("creature-kirin", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)

    # Joints: neck (yaw), head (pitch), tail (curl sway). Origins sit on the
    # centreline; axes per the module header.
    neck_y, neck_z = section(0.72)[0], section(0.72)[1]
    head_y, head_z = section(0.86)[0], section(0.86)[1]
    tail_y, tail_z = section(0.22)[0], section(0.22)[1]
    joints = [
        ("neck", (0.0, neck_y, neck_z), (0.0, neck_y, neck_z + 0.10), weights["neck"]),
        ("head", (0.0, head_y, head_z), (0.10, head_y, head_z), weights["head"]),
        ("tail", (0.0, tail_y, tail_z), (0.0, tail_y, tail_z + 0.08), weights["tail"]),
    ]
    armature = bind_groups(obj, joints)
    return obj, armature


def main():
    args = parse_args({"tag": "", "render": True})
    obj, armature = build()
    tris = stats(obj, "creature-kirin")
    if tris > BUDGET:
        raise SystemExit("kirin over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj, armature], OUT)
    if args.get("render"):
        stem = "kirin" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
