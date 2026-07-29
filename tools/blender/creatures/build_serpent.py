"""Builds the Old Current — a benevolent sea serpent, authored 1 m long.

    blender --background --python tools/blender/creatures/build_serpent.py -- --tag wave8

The game scales the model x9 at runtime, so every number here is in model
metres and every silhouette decision has to survive being read from ten
metres away. The serpent is a blunt-snouted tube with a continuous deep
violet dorsal fin, a small pair of pectoral fins, a cream belly and soft
painted saddle bands — the palette the wave-8 brief fixes (sea-green body,
cream belly, deep violet dorsal).

The swim is lateral undulation, so the seven spine joints point dorsal
(Blender +Z, glTF +Y): a bone rotates about its own local +Y, and rotating
these yaws the vertebra. Weights form a partition of unity between
neighbouring joints, so `WEIGHTS_0` sums to 1 everywhere with nothing left
for `root` — a serpent has no rigid part.

The fin is a single zero-thickness ribbon (the shrimp-antenna idiom at
ceremony scale); the game's serpent material is DoubleSide to match.
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

OUT = "public/assets/models/creature-serpent.glb"
BUDGET = 6000

#: Head tip at Blender y = -Y_HEAD (glTF z = +Y_HEAD), tail tip at +Y_TAIL.
Y_HEAD = 0.52
Y_TAIL = 0.48
LENGTH = Y_HEAD + Y_TAIL

RINGS = 56
COLS = 24

#: (s, radius): 0 at the snout, 1 at the tail tip. A blunt, kind head —
#: the skull bulge is wide against the neck the way the turtle's is.
BODY_PROFILE = [
    (0.00, 0.016),
    (0.02, 0.026),
    (0.06, 0.040),
    (0.11, 0.050),
    (0.17, 0.033),
    (0.26, 0.043),
    (0.45, 0.041),
    (0.65, 0.033),
    (0.80, 0.024),
    (0.92, 0.014),
    (1.00, 0.005),
]

#: The seven spine joints, in s along the body. glTF z = Y_HEAD - s.
JOINTS = [
    ("neck", 0.16),
    ("spine1", 0.30),
    ("spine2", 0.44),
    ("spine3", 0.58),
    ("spine4", 0.70),
    ("spine5", 0.82),
    ("tail", 0.92),
]
#: Half-width of the s-zone over which a boundary hands weight to the next
#: joint. Narrow: a serpent's bend is between vertebrae, not smeared along.
BLEND = 0.045

#: Dorsal fin: (s, membrane height) — a long low crest, tallest aft of mid.
FIN_PROFILE = [
    (0.21, 0.018),
    (0.36, 0.045),
    (0.55, 0.062),
    (0.75, 0.052),
    (0.90, 0.028),
    (0.97, 0.008),
]
FIN_SCALLOP_HZ = 9

#: sRGB gouache. The brief's palette, value-structured: the belly is the
#: light plane, the flank the local colour, the spine a step deeper, the
#: fin a deep violet with a lifted edge so the crest reads against water.
BELLY = (0.905, 0.870, 0.700)
FLANK = (0.385, 0.615, 0.510)
SPINE = (0.235, 0.440, 0.400)
BAND = (0.205, 0.380, 0.350)
FIN_BASE = (0.360, 0.265, 0.520)
FIN_EDGE = (0.520, 0.400, 0.660)
MOUTH = (0.195, 0.350, 0.320)
EYE = (0.115, 0.105, 0.095)


def body_radius(s):
    return catmull(BODY_PROFILE, s)[0]


def body_point(s, a):
    """Ring vertex: a = 0 at the belly, pi at the dorsal spine (mirrored)."""
    r = body_radius(s)
    # The head's cheeks widen a touch; a serpent's skull is not a circle.
    cheek = 1.0 + 0.14 * math.exp(-(((s - 0.085) / 0.035) ** 2))
    x = r * 0.90 * cheek * math.sin(a)
    z = -r * 1.04 * math.cos(a)
    # The body line drops almost imperceptibly toward the tail.
    cz = -0.012 * smoothstep(0.55, 1.0, s)
    y = -Y_HEAD + LENGTH * s
    return (x, y, z + cz)


def body_uv(s, a):
    u = (a if a <= math.pi else math.tau - a) / math.tau
    return (u, s)


def joint_weights(s):
    """Partition of unity over the spine joints for a vertex at `s`."""
    boundaries = [(JOINTS[i][1] + JOINTS[i + 1][1]) * 0.5 for i in range(len(JOINTS) - 1)]
    out = {}
    for i, (name, _sj) in enumerate(JOINTS):
        # Ramp in across the previous boundary, out across the next.
        if i == 0:
            w = 1.0 - smoothstep(boundaries[0] - BLEND, boundaries[0] + BLEND, s)
        elif i == len(JOINTS) - 1:
            w = smoothstep(boundaries[-1] - BLEND, boundaries[-1] + BLEND, s)
        else:
            w = smoothstep(boundaries[i - 1] - BLEND, boundaries[i - 1] + BLEND, s) * (
                1.0 - smoothstep(boundaries[i] - BLEND, boundaries[i] + BLEND, s)
            )
        if w > 1e-4:
            out[name] = w
    return out


def build():
    reset_scene()
    verts, uvs, colours = [], [], []
    weights = {name: {} for name, _ in JOINTS}
    faces = []

    def add_weights(index, s):
        for name, w in joint_weights(s).items():
            weights[name][index] = w

    # ------------------------------------------------------------------ body
    for i in range(RINGS):
        s = i / (RINGS - 1)
        for j in range(COLS):
            a = math.tau * j / COLS
            verts.append(body_point(s, a))
            uvs.append(body_uv(s, a))
            belly = 0.5 - 0.5 * math.cos(a * 2.0)  # 1 belly, 0 spine
            dorsal = smoothstep(0.55 * math.pi, 0.95 * math.pi, a)
            base = mix3(mix3(FLANK, SPINE, dorsal), BELLY, belly * belly)
            # Painted saddles: soft deeper marks along the back, fading on
            # the flanks and gone from the belly — value, not pattern noise.
            saddle = 0.5 + 0.5 * math.sin(s * 7.0 * math.tau + 0.9)
            saddle = smoothstep(0.58, 0.90, saddle) * dorsal * (1.0 - belly)
            colours.append(mix3(base, BAND, saddle * 0.75))
            add_weights(len(verts) - 1, s)
    faces += grid_faces(RINGS, COLS)

    snout = len(verts)
    verts.append((0.0, -Y_HEAD - 0.012, 0.004))
    uvs.append((0.25, 0.0))
    colours.append(FLANK)
    add_weights(snout, 0.0)
    faces += fan_faces(list(range(0, COLS)), snout)

    tail_tip = len(verts)
    tail_base = (RINGS - 1) * COLS
    verts.append((0.0, Y_TAIL + 0.010, -0.012))
    uvs.append((0.25, 1.0))
    colours.append(SPINE)
    add_weights(tail_tip, 1.0)
    faces += fan_faces(list(range(tail_base, tail_base + COLS)), tail_tip)

    # Face: a soft dark eye oval per cheek (the turtle's vertex trick, an
    # oval of rings so at x9 scale the eye is a kind oval rather than a
    # dot), set just above the flank midline, mirrored across the spine.
    # A faint mouth seam runs the lower flank of the head.
    EYE_AZ = (0.62 * math.pi, 1.38 * math.pi)
    for i in range(RINGS):
        s = i / (RINGS - 1)
        for j in range(COLS):
            a = math.tau * j / COLS
            index = i * COLS + j
            for centre in EYE_AZ:
                da = abs(a - centre)
                if da < 0.11 * math.pi and 0.058 < s < 0.112:
                    colours[index] = EYE
            side = abs(math.sin(a))
            if side > 0.94 and 0.030 < s < 0.075:
                if 0.42 * math.pi < a < 0.58 * math.pi or 1.42 * math.pi < a < 1.58 * math.pi:
                    colours[index] = MOUTH

    # ------------------------------------------------------------ dorsal fin
    fin = []
    for i in range(RINGS):
        s = i / (RINGS - 1)
        if s < FIN_PROFILE[0][0] or s > FIN_PROFILE[-1][0]:
            continue
        r = body_radius(s)
        cz = -0.012 * smoothstep(0.55, 1.0, s)
        base_z = 1.04 * r + cz
        height = catmull(FIN_PROFILE, s)[0]
        # The scallop grows in over the fin's first fifth — a cold sine at
        # the leading edge put a kink in the crest where it left the neck.
        grow = smoothstep(FIN_PROFILE[0][0], FIN_PROFILE[0][0] + 0.09, s)
        scallop = 1.0 + 0.16 * grow * math.sin(s * FIN_SCALLOP_HZ * math.tau)
        y = -Y_HEAD + LENGTH * s
        base_i = len(verts)
        verts.append((0.0, y, base_z))
        uvs.append((0.5, s))
        colours.append(FIN_BASE)
        tip_i = len(verts)
        verts.append((0.0, y, base_z + height * scallop))
        uvs.append((0.52, s))
        colours.append(mix3(FIN_BASE, FIN_EDGE, 0.85))
        add_weights(base_i, s)
        add_weights(tip_i, s)
        fin.append((base_i, tip_i))
    for k in range(len(fin) - 1):
        (a0, t0), (a1, t1) = fin[k], fin[k + 1]
        faces.append((a0, t0, t1, a1))

    # --------------------------------------------------------- pectoral fins
    for sign in (1.0, -1.0):
        root = body_point(0.205, math.pi / 2.0)
        root = (sign * abs(root[0]), root[1], root[2])
        stations = []
        for k in range(4):
            t = k / 3.0
            reach = 0.052 * t
            drop = 0.030 * t * t
            back = 0.030 * t
            chord = 0.020 * (1.0 - 0.55 * t)
            x = root[0] + sign * reach
            y = root[1] - back
            z = root[2] - drop
            lead = len(verts)
            verts.append((x, y + chord, z))
            uvs.append((0.5, 0.2 + 0.6 * t))
            colours.append(FIN_BASE)
            trail = len(verts)
            verts.append((x, y - chord * 0.7, z))
            uvs.append((0.52, 0.2 + 0.6 * t))
            colours.append(mix3(FIN_BASE, FIN_EDGE, 0.5 + 0.4 * t))
            add_weights(lead, 0.205)
            add_weights(trail, 0.205)
            stations.append((lead, trail))
        for k in range(len(stations) - 1):
            (a0, b0), (a1, b1) = stations[k], stations[k + 1]
            if sign > 0:
                faces.append((a0, b0, b1, a1))
            else:
                faces.append((a0, a1, b1, b0))

    obj = mesh_from("creature-serpent", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)

    joints = []
    for name, s in JOINTS:
        y = -Y_HEAD + LENGTH * s
        r = body_radius(s)
        cz = -0.012 * smoothstep(0.55, 1.0, s)
        # Bone along Blender +Z (dorsal): local +Y is glTF +Y, so the game
        # yaws the vertebra with a plain `rotation.y`.
        joints.append((name, (0.0, y, cz), (0.0, y, cz + max(0.06, r)), weights[name]))
    armature = bind_groups(obj, joints)
    return obj, armature


def main():
    args = parse_args({"tag": "", "render": True})
    obj, armature = build()
    tris = stats(obj, "creature-serpent")
    if tris > BUDGET:
        raise SystemExit("serpent over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj, armature], OUT)
    if args.get("render"):
        stem = "serpent" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
