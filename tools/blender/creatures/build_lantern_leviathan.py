"""Builds the Lantern Leviathan — a 14 m whale-spirit hung with lantern barnacles.

    blender --background --python tools/blender/creatures/build_lantern_leviathan.py -- --tag wave8

The animal is a baleen-whale silhouette read through the reef's painted
vocabulary: a deep slate-blue body (never black — the shade band still has
colour in it), pale ventral pleats, and ROWS of warm gold lantern barnacles
along the flanks and back. The lanterns are authored at near-full value so
they read as lights against the body *without* any emissive: toon shading
gives them the lit band everywhere the sun and the fill can see.

No painting travels with this one — the whole read is `COLOR_0`, so the
script's colour function is the art. UVs are written anyway (parametric,
u around the mirrored flank, v along the body) and documented for the
integrator in the wave-8 ledger.

Joints, turtle idiom (see CREATURES.md's turtle table): `fluke` lies along
Blender +X (glTF +X), so the whale's vertical stroke is a rotation about the
bone's own +Y; the two pectorals lie along Blender -Y (glTF +Z, body-forward)
so a rotation rolls the fin about its root line. Weights ramp in over the
last stretch of the tail stock / the first stretch of each fin, so a rotation
bends at the joint rather than shearing.

Determinism: every jitter is drawn from one fixed `random.Random` seed, so a
rebuild is bit-identical.
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

OUT = "public/assets/models/creature-lantern-leviathan.glb"
BUDGET = 6000

#: Metres. Pivot is the body's mid-length; authored facing Blender -Y, so the
#: head sits at y = -HALF_L and arrives at glTF z = +HALF_L (facing +Z).
LENGTH = 14.0
HALF_L = LENGTH / 2.0

BODY_RINGS = 46
BODY_HALF_COLS = 15  # mirrored to 28 columns per ring

#: (s, half_width, half_height, centre_z); s = 0 at the rostrum, 1 at the
#: peduncle's end. A right-whale-ish head: broad, blunt, a third of the
#: animal; the deepest body just behind mid-length; a long slim tail stock.
BODY_PROFILE = [
    (0.00, 0.06, 0.07, -0.03),
    (0.05, 0.50, 0.54, 0.00),
    (0.12, 0.88, 0.95, 0.05),
    (0.22, 1.10, 1.18, 0.07),
    (0.34, 1.16, 1.26, 0.07),
    (0.46, 1.10, 1.24, 0.05),
    (0.58, 0.94, 1.06, 0.02),
    (0.70, 0.70, 0.80, -0.02),
    (0.80, 0.48, 0.56, -0.04),
    (0.88, 0.30, 0.34, -0.04),
    (0.95, 0.17, 0.18, -0.02),
    (1.00, 0.075, 0.075, 0.00),
]

#: The belly is flatter than the back is round.
VENTRAL_FLATTEN = 0.86

#: Ventral pleats: grooves across the throat and chest, fading out behind the
#: pectorals. Painted darker AND rippled into the section — at this animal's
#: scale the ripple alone is a texture, the paint alone is a stain; together
#: they are pleats.
PLEAT_S_FROM, PLEAT_S_TO = 0.06, 0.44
PLEAT_PHI = 0.46 * math.pi  # grooves live inside this ventral half-angle
PLEAT_COUNT = 9
PLEAT_DEPTH = 0.060
PLEAT_SHADE = 0.80

#: The mouth line: a whale's long lower-jaw seam, painted a step darker.
MOUTH_S_FROM, MOUTH_S_TO = 0.03, 0.30
MOUTH_PHI_CENTRE = 0.235 * math.pi
MOUTH_PHI_WIDTH = 0.022 * math.pi
MOUTH_SHADE = 0.80

#: Eyes sit low on the head, where the mouth line ends — deliberate and
#: readable, with a pale brow: a spirit's eye, not a measurement.
EYE_S = 0.155
EYE_PHI = 0.260 * math.pi
EYE_HALF_PHI = 0.120 * math.pi
EYE_RINGS = 2
BROW_PHI = 0.385 * math.pi
BROW_HALF_PHI = 0.055 * math.pi

#: The dorsal fin: a swept ridge two-thirds of the way back.
FIN_S = 0.660
FIN_HEIGHT = 0.74
FIN_SWEEP = 0.88
FIN_HALF_CHORD = 0.13
FIN_COLS = 8

#: Pectorals: long swept wings at the chest — the gesture that reads "whale"
#: from below. (side_x factor, root_s, length, root_chord, tip_chord, sweep).
PECT_ROOT_S = 0.315
PECT_LENGTH = 2.60
PECT_ROOT_CHORD = 0.80
PECT_TIP_CHORD = 0.17
PECT_SWEEP = 0.52
PECT_DROP = 0.55
PECT_RINGS = 9
PECT_COLS = 6

#: The fluke: two horizontal lobes, notched at the centre trailing edge —
#: the single strongest silhouette cue a whale has.
FLUKE_ROOT_S = 0.905
FLUKE_SPAN = 3.55
FLUKE_CHORD = 1.05
FLUKE_TIP_CHORD = 0.34
FLUKE_SWEEP = 0.42
FLUKE_NOTCH = 0.34
FLUKE_RINGS = 9
FLUKE_COLS = 6

#: sRGB gouache. Deep slate, but a *colour* in the shade band, never black.
#: Atelier repaint: the deep slate leant violet-warm (the value key's shadow
#: rule — cold grey-blue reads photographic), a pale rorqual blaze added
#: along the flank divide (edge light on the silhouette line), and the eye
#: warmed off near-black.
SLATE_DEEP = (0.260, 0.310, 0.470)  # spine and dorsal field
SLATE_MID = (0.320, 0.415, 0.555)  # flanks
VENTRAL = (0.830, 0.855, 0.820)  # pale blue-cream pleats and throat
PLEAT_DARK = (0.545, 0.600, 0.615)  # groove shadow paint
EDGE_PALE = (0.700, 0.760, 0.760)  # fin/fluke trailing edges
BLAZE = (0.640, 0.720, 0.730)  # the flank's lit line
EYE = (0.170, 0.130, 0.110)
MOUTH = (0.225, 0.245, 0.340)

#: The lanterns: deep warm gold studs with a hot heart. Authored bright
#: enough to sit in the ramp's lit band from most angles — lights, not paint.
LANTERN = (0.930, 0.660, 0.240)
LANTERN_HEART = (1.000, 0.850, 0.500)

#: Stud rows: (phi centre along the mirrored flank, s from, s to, count,
#: radius). Two flank rows and the dorsal ridge, per side where it mirrors.
LANTERN_ROWS = [
    (0.40 * math.pi, 0.20, 0.84, 17, 0.150),  # upper flank line
    (0.24 * math.pi, 0.16, 0.62, 12, 0.125),  # lower flank line
    (math.pi, 0.26, 0.90, 15, 0.135),  # dorsal ridge, unmirrored
]
LANTERN_JITTER_S = 0.012
LANTERN_JITTER_PHI = 0.014 * math.pi

#: One fixed stream for every jitter; a rebuild is bit-identical.
rng = random.Random(0x1A27_3E0)


def body_section(s):
    return catmull(BODY_PROFILE, s)


def pleat_amount(s, phi_m):
    """Groove depth factor in [0, 1]: which pleat band, and how deep into it."""
    if phi_m > PLEAT_PHI or s < PLEAT_S_FROM or s > PLEAT_S_TO:
        return 0.0
    along = smoothstep(PLEAT_S_FROM, PLEAT_S_FROM + 0.05, s) * (
        1.0 - smoothstep(PLEAT_S_TO - 0.10, PLEAT_S_TO, s)
    )
    across = 1.0 - smoothstep(PLEAT_PHI * 0.55, PLEAT_PHI, phi_m)
    return along * across


def body_point(s, phi_m, side):
    """Cross-section: a flattened-ventral ellipse, rippled where the pleats
    run, pinched slightly at the spine for a back ridge."""
    w, h, cz = body_section(s)
    x = side * w * math.sin(phi_m)
    if phi_m <= math.pi / 2.0:
        z = cz - h * VENTRAL_FLATTEN * math.cos(phi_m)
    else:
        z = cz - h * math.cos(phi_m)
    pleat = pleat_amount(s, phi_m)
    if pleat > 0.0:
        # Grooves as a standing wave across the ventral half.
        wave = 0.5 + 0.5 * math.cos(phi_m / PLEAT_PHI * math.pi * PLEAT_COUNT)
        depth = PLEAT_DEPTH * pleat * (0.35 + 0.65 * wave)
        z += depth * h
        x *= 1.0 - 0.35 * depth
    y = -HALF_L + LENGTH * s
    return (x, y, z)


def body_uv(s, phi_m):
    return (phi_m / (2.0 * math.pi), s)


def body_colour(s, phi_m):
    w, h, cz = body_section(s)
    # Zone base: ventral pale, flank slate, dorsal deep, spine ridge darkest.
    if phi_m < 0.16 * math.pi:
        base = VENTRAL
    elif phi_m < 0.55 * math.pi:
        t = smoothstep(0.16 * math.pi, 0.55 * math.pi, phi_m)
        base = mix3(VENTRAL, SLATE_MID, t)
    elif phi_m < 0.85 * math.pi:
        t = smoothstep(0.55 * math.pi, 0.85 * math.pi, phi_m)
        base = mix3(SLATE_MID, SLATE_DEEP, t)
    else:
        base = SLATE_DEEP
    # Pleats: grooves painted a step down from the pale ventral.
    pleat = pleat_amount(s, phi_m)
    if pleat > 0.0:
        wave = 0.5 + 0.5 * math.cos(phi_m / PLEAT_PHI * math.pi * PLEAT_COUNT)
        base = mix3(base, PLEAT_DARK, pleat * (0.25 + 0.75 * wave) * PLEAT_SHADE)
    # The rorqual blaze: a soft lifted line where flank turns into belly,
    # sweeping from behind the pleats toward the peduncle — the painted
    # edge light that lets a fourteen-metre silhouette read at distance.
    blaze = gauss(phi_m, 0.615 * math.pi, 0.05 * math.pi)
    blaze *= smoothstep(0.30, 0.48, s) * (1.0 - smoothstep(0.78, 0.94, s))
    base = mix3(base, BLAZE, blaze * 0.6)
    # The mouth seam.
    if MOUTH_S_FROM <= s <= MOUTH_S_TO:
        seam = 1.0 - clamp(abs(phi_m - MOUTH_PHI_CENTRE) / MOUTH_PHI_WIDTH)
        if seam > 0.0:
            base = mix3(base, MOUTH, seam * MOUTH_SHADE)
    return base


def surface_normal(s, phi_m, side):
    """Good-enough outward normal for placing studs: the ellipse gradient."""
    w, h, cz = body_section(s)
    x = math.sin(phi_m) / max(w, 1e-3)
    z = -math.cos(phi_m) / max(h, 1e-3)
    length = math.hypot(x, z) or 1.0
    return (side * x / length, 0.0, z / length)


def stud_at(centre, normal, radius):
    """One lantern barnacle: a squashed five-sided pyramid, gold with a hot
    heart. Six vertices, five triangles — a light, not a sculpture."""
    # Tangent frame: `normal` is in the section plane; body-forward is -Y.
    tx, ty, tz = normal
    verts, colours = [], []
    for j in range(5):
        angle = math.tau * j / 5
        # Ring lies in the plane spanned by (body-forward, section tangent).
        ring_x = centre[0] + tx * radius * math.cos(angle) * 0.9
        ring_y = centre[1] + radius * math.sin(angle)
        ring_z = centre[2] + tz * radius * math.cos(angle) * 0.9
        verts.append((ring_x, ring_y, ring_z))
        colours.append(LANTERN)
    apex = (centre[0] + tx * radius * 0.55, centre[1], centre[2] + tz * radius * 0.55)
    verts.append(apex)
    colours.append(LANTERN_HEART)
    faces = [(5, j, (j + 1) % 5) for j in range(5)]
    return verts, colours, faces


def build():
    reset_scene()
    verts, uvs, colours = [], [], []
    weights = {name: {} for name in ("fluke", "pectL", "pectR")}
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
            colours.append(body_colour(s, phi_m))
            index = len(verts) - 1
            w_fluke = smoothstep(0.86, 0.955, s)
            if w_fluke > 1e-4:
                weights["fluke"][index] = w_fluke

    cols = 2 * BODY_HALF_COLS - 2
    faces += grid_faces(BODY_RINGS, cols)

    # Rostrum and peduncle caps.
    rostrum = len(verts)
    verts.append((0.0, -HALF_L - 0.10, body_section(0.0)[2]))
    uvs.append((0.25, 0.0))
    colours.append(SLATE_MID)
    faces += fan_faces(list(range(0, cols)), rostrum)

    tail_base = (BODY_RINGS - 1) * cols
    peduncle = len(verts)
    verts.append((0.0, HALF_L + 0.02, body_section(1.0)[2]))
    uvs.append((0.25, 1.0))
    colours.append(SLATE_DEEP)
    weights["fluke"][peduncle] = 1.0
    faces += fan_faces(list(range(tail_base, tail_base + cols)), peduncle)

    # Eyes and brows: a dark bead a couple of columns wide over a pale brow
    # line, so the animal has a gaze at the distances it is met.
    ring_s = min(range(BODY_RINGS), key=lambda i: abs(i / (BODY_RINGS - 1) - EYE_S))
    for i in range(ring_s - EYE_RINGS, ring_s + EYE_RINGS + 1):
        falloff = 1.0 - 0.35 * abs(i - ring_s) / (EYE_RINGS + 1)
        for j in range(cols):
            phi_m = math.pi * (j if j < BODY_HALF_COLS else cols - j) / (BODY_HALF_COLS - 1)
            if abs(phi_m - EYE_PHI) < EYE_HALF_PHI * falloff:
                colours[i * cols + j] = EYE
            elif abs(phi_m - BROW_PHI) < BROW_HALF_PHI:
                colours[i * cols + j] = mix3(colours[i * cols + j], EDGE_PALE, 0.55)

    # ------------------------------------------------------------- dorsal fin
    fin_base = len(verts)
    fin_s0, fin_s1 = FIN_S - 0.045, FIN_S + 0.045
    _, h_fin, cz_fin = body_section(FIN_S)
    fin_root_z = cz_fin + h_fin * 0.985
    for i in range(FIN_COLS + 1):
        t = i / FIN_COLS
        sy = -HALF_L + LENGTH * (fin_s0 + (fin_s1 - fin_s0) * t)
        rise = math.sin(math.pi * min(1.0, t * 1.15))
        tip_y = sy - FIN_SWEEP * t
        tip_z = fin_root_z + FIN_HEIGHT * rise
        # Two walls per station (left/right), thin at the root, thinner at tip.
        half = FIN_HALF_CHORD * (1.0 - t * 0.85)
        verts.append((-half, sy, fin_root_z))
        verts.append((half, sy, fin_root_z))
        verts.append((0.0, tip_y, tip_z))
        uvs.append((0.47, 0.66 + 0.05 * t))
        uvs.append((0.53, 0.66 + 0.05 * t))
        uvs.append((0.50, 0.71))
        shade = mix3(SLATE_DEEP, EDGE_PALE, 0.25 + 0.55 * rise)
        colours.append(SLATE_DEEP)
        colours.append(SLATE_DEEP)
        colours.append(shade)
    for i in range(FIN_COLS):
        a = fin_base + i * 3
        b = fin_base + (i + 1) * 3
        faces.append((a, b, b + 2, a + 2))
        faces.append((a + 1, a + 2, b + 2, b + 1))

    # --------------------------------------------------------------- pectorals
    for name, sign in (("pectL", 1.0), ("pectR", -1.0)):
        w0, h0, cz0 = body_section(PECT_ROOT_S)
        root = (sign * w0 * 0.82, -HALF_L + LENGTH * PECT_ROOT_S, cz0 - h0 * 0.30)
        base = len(verts)
        for i in range(PECT_RINGS):
            f = i / (PECT_RINGS - 1)
            chord = catmull(
                [(0.0, PECT_ROOT_CHORD), (0.45, PECT_ROOT_CHORD * 0.92), (0.8, PECT_TIP_CHORD * 1.6), (1.0, PECT_TIP_CHORD)],
                f,
            )[0]
            thick = mix(0.16, 0.035, f)
            cx = root[0] + sign * PECT_LENGTH * f * 0.62
            cy = root[1] + PECT_LENGTH * f * PECT_SWEEP
            czf = root[2] - PECT_LENGTH * f * PECT_DROP
            for j in range(PECT_COLS):
                angle = math.tau * j / PECT_COLS
                y = cy + chord * math.cos(angle)
                z = czf + thick * math.sin(angle)
                verts.append((cx, y, z))
                uvs.append((0.05 + 0.9 * f, 0.32 + 0.05 * math.cos(angle)))
                shade = 0.5 + 0.5 * math.sin(angle)
                colours.append(mix3(SLATE_DEEP, mix3(SLATE_MID, EDGE_PALE, 0.45), shade))
                index = len(verts) - 1
                w_pect = smoothstep(0.05, 0.30, f)
                if w_pect > 1e-4:
                    weights[name][index] = w_pect
        faces += grid_faces(PECT_RINGS, PECT_COLS, base=base)
        tip = len(verts)
        verts.append(
            (
                root[0] + sign * PECT_LENGTH * 0.66,
                root[1] + PECT_LENGTH * PECT_SWEEP + PECT_TIP_CHORD * 0.4,
                root[2] - PECT_LENGTH * (PECT_DROP + 0.04),
            )
        )
        uvs.append((0.98, 0.32))
        colours.append(EDGE_PALE)
        weights[name][tip] = 1.0
        rim = list(range(base + (PECT_RINGS - 1) * PECT_COLS, base + PECT_RINGS * PECT_COLS))
        faces += fan_faces(rim, tip)
        root_rim = list(range(base, base + PECT_COLS))
        root_centre = len(verts)
        verts.append(root)
        uvs.append((0.02, 0.32))
        colours.append(SLATE_MID)
        faces += fan_faces(list(reversed(root_rim)), root_centre)

    # ------------------------------------------------------------------ fluke
    w_f, h_f, cz_f = body_section(FLUKE_ROOT_S)
    fluke_root = (0.0, -HALF_L + LENGTH * FLUKE_ROOT_S, cz_f)
    for sign in (1.0, -1.0):
        base = len(verts)
        for i in range(FLUKE_RINGS):
            f = i / (FLUKE_RINGS - 1)
            chord = catmull(
                [(0.0, FLUKE_CHORD), (0.4, FLUKE_CHORD * 0.82), (0.75, FLUKE_TIP_CHORD * 1.35), (1.0, FLUKE_TIP_CHORD)],
                f,
            )[0]
            thick = mix(0.14, 0.030, f)
            cx = sign * FLUKE_SPAN * 0.5 * f
            cy = fluke_root[1] + FLUKE_SWEEP * f + chord * 0.0
            czf = fluke_root[2] + 0.10 * f  # a whisper of dihedral
            # The centre notch: near the root the trailing edge is carved
            # forward, which is what reads "two lobes" from above and below.
            notch = FLUKE_NOTCH * max(0.0, 1.0 - f / 0.22)
            for j in range(FLUKE_COLS):
                angle = math.tau * j / FLUKE_COLS
                trailing = 0.5 + 0.5 * math.cos(angle)
                y = cy + chord * 0.5 * math.cos(angle) - notch * trailing * chord
                z = czf + thick * math.sin(angle)
                verts.append((cx, y, z))
                uvs.append((0.05 + 0.9 * f, 0.86 + 0.06 * math.cos(angle)))
                shade = 0.5 + 0.5 * math.sin(angle)
                colours.append(mix3(SLATE_DEEP, mix3(SLATE_MID, EDGE_PALE, 0.5), shade))
                weights["fluke"][len(verts) - 1] = 1.0
        faces += grid_faces(FLUKE_RINGS, FLUKE_COLS, base=base)
        tip = len(verts)
        verts.append(
            (
                sign * FLUKE_SPAN * 0.52,
                fluke_root[1] + FLUKE_SWEEP + FLUKE_TIP_CHORD * 0.3,
                fluke_root[2] + 0.11,
            )
        )
        uvs.append((0.98, 0.86))
        colours.append(EDGE_PALE)
        weights["fluke"][tip] = 1.0
        rim = list(range(base + (FLUKE_RINGS - 1) * FLUKE_COLS, base + FLUKE_RINGS * FLUKE_COLS))
        faces += fan_faces(rim, tip)

    # ------------------------------------------------------- lantern barnacles
    for phi_row, s_from, s_to, count, radius in LANTERN_ROWS:
        mirrored = phi_row < math.pi - 1e-6
        sides = (1.0, -1.0) if mirrored else (1.0,)
        for side in sides:
            for k in range(count):
                t = (k + 0.5) / count
                s = s_from + (s_to - s_from) * t + rng.uniform(-LANTERN_JITTER_S, LANTERN_JITTER_S)
                phi_m = clamp(
                    phi_row + rng.uniform(-LANTERN_JITTER_PHI, LANTERN_JITTER_PHI),
                    0.02,
                    math.pi - 0.02,
                )
                r_stud = radius * rng.uniform(0.82, 1.22)
                x, y, z = body_point(s, phi_m, side)
                normal = surface_normal(s, phi_m, side)
                # Sit half-sunk, like a real barnacle.
                centre = (x + normal[0] * r_stud * 0.30, y, z + normal[2] * r_stud * 0.30)
                sv, sc, sf = stud_at(centre, normal, r_stud)
                base = len(verts)
                verts += sv
                uvs += [(0.5, 0.5)] * len(sv)
                colours += sc
                faces += [tuple(base + i for i in tri) for tri in sf]

    obj = mesh_from("creature-lantern-leviathan", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)

    pect_w0, _, _ = body_section(PECT_ROOT_S)
    pect_x = pect_w0 * 0.82
    pect_y = -HALF_L + LENGTH * PECT_ROOT_S
    joints = [
        # Blender bones: head -> tail along the axis the joint rotates about.
        # `fluke` turns about model +X (the vertical stroke); the pectorals
        # lie along Blender -Y = glTF +Z (body-forward), the turtle idiom.
        ("fluke", (0.0, HALF_L - 1.6, 0.0), (0.12, HALF_L - 1.6, 0.0), weights["fluke"]),
        ("pectL", (pect_x, pect_y, -0.2), (pect_x, pect_y - 0.16, -0.2), weights["pectL"]),
        ("pectR", (-pect_x, pect_y, -0.2), (-pect_x, pect_y - 0.16, -0.2), weights["pectR"]),
    ]
    armature = bind_groups(obj, joints)
    return obj, armature


def main():
    args = parse_args({"tag": "", "render": True})
    obj, armature = build()
    tris = stats(obj, "creature-lantern-leviathan")
    if tris > BUDGET:
        raise SystemExit("lantern leviathan over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj, armature], OUT)
    if args.get("render"):
        stem = "lantern-leviathan" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
