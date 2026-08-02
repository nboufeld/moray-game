"""Builds the hero moray head — 0.55 m from snout tip to neck ring.

    blender --background --python tools/blender/creatures/build_moray_head.py -- --tag it1

The whole piece is one closed lofted surface. The mouth is a deep groove in
that surface rather than a hole: walking a cross-section ring from the belly
upward you cross the lower jaw, dive inward down two tucked *lining* columns,
and come back out at the upper lip. The rest gape (~11 degrees) is baked by
rotating the lower-jaw side of that groove about the hinge, using exactly the
weight field that is then bound to the `jaw` bone — so the baked pose and the
skin agree, and an integrator who rotates `jaw` further gets more of the same
motion rather than a different one.

Contracts (see CREATURES.md for the measured versions and the ambiguities):
- pivot at the neck ring centre; the head extends 0.55 m forward (Blender -Y,
  glTF +Z) and nothing sits behind the origin.
- neck ring is an ellipse, half-width 0.072 m (x) by half-height 0.080 m.
- UVs are the analytic form of `projectHeadUvs`: u = phi_m / 2pi in [0, 0.5]
  (0 belly, 0.5 dorsal spine, mirrored across the flanks), v = 0.12 * s with
  s = 0 at the snout. Computed from the pre-gape parameters, as the game
  computes them from the rest pose.
- the `jaw` bone lies along Blender +X (glTF +X), so opening the jaw is a
  rotation about the bone's OWN local +Y, which is the model's +X axis.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from creature_common import (  # noqa: E402
    bind_groups,
    catmull,
    clamp,
    distribute,
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
    VIEWS,
)

OUT = "public/assets/models/creature-moray-head.glb"
BUDGET = 3500

LENGTH = 0.55
RINGS = 34
#: Half-columns from belly (0) to dorsal (21); the full ring mirrors the
#: twenty interior ones for 42 columns total.
HALF_COLS = 22

#: Cross-section stations: (s, half_width_a, half_height_b, centre_z).
#: s runs 0 at the snout tip to 1 at the neck ring; the neck ring pair
#: (0.072, 0.080) IS the integration contract.
PROFILE = [
    (0.00, 0.016, 0.018, -0.008),
    (0.08, 0.032, 0.038, -0.006),
    (0.18, 0.045, 0.055, -0.001),
    (0.30, 0.052, 0.064, 0.000),
    (0.44, 0.066, 0.084, 0.001),
    (0.58, 0.078, 0.098, 0.002),
    (0.72, 0.083, 0.100, 0.001),
    (0.86, 0.079, 0.092, 0.000),
    (1.00, 0.072, 0.080, 0.000),
]

#: Jaw hinge, as a fraction of the length and in metres of Blender -Y.
S_HINGE = 0.58
Y_HINGE = -LENGTH * (1.0 - S_HINGE)
#: Baked rest gape. Positive rotation about Blender +X drops the chin.
GAPE = math.radians(11.0)

#: How deep the mouth lining tucks toward the section centre, as a fraction
#: of the local radius, forward of the hinge. Asymmetric on purpose (it1
#: measured the failure): both columns at one depth made the open mouth a
#: flat plane — a shoebox. The floor ledge stays shallow and the upper
#: lining dives, so the interior recedes into shadow.
TUCK_FLOOR = 0.62
TUCK_THROAT = 0.44

#: sRGB. Dorsal-to-belly is the one permitted gradient; the lining is keyed
#: off tuck depth and the socket dish is the documented occlusion exception.
DORSAL = (0.871, 0.843, 0.776)  # ded7c6
BELLY = (0.949, 0.925, 0.875)  # f2ecdf
#: A step darker than the briefed 6e5250: under the preview key (and the
#: game's toon ramp) the briefed value rendered as pale pink and the open
#: mouth read as sliced foam rather than a maw. The briefed hue is kept.
LINING = (0.360, 0.262, 0.252)

EYE_S, EYE_PHI = 0.44, 0.60 * math.pi
BROW_S, BROW_PHI = 0.46, 0.72 * math.pi
NOSE_S, NOSE_PHI = 0.12, 0.72 * math.pi


def lip_angle(s):
    """The mouth line: drooped at the snout, rising late into an upturned
    corner at the hinge. The exponent is the curve — linear read as a
    straight slice from tip to corner, which is a boat and not a face."""
    return mix(0.38 * math.pi, 0.50 * math.pi, clamp(s / S_HINGE) ** 1.6)


#: Column layout. Fractions place the plain columns; the four named ones are
#: authored against the lip angle per ring. Interior columns are clustered
#: (once, on a nominal lip angle) so the eye socket and brow have vertices
#: to sculpt with.
BELLY_FRACS = [0.0, 0.22, 0.44, 0.64, 0.82]
UPPER_FRACS = distribute(
    13,
    lambda f: 1.0
    + 1.6 * gauss(0.53 + f * 0.47, EYE_PHI / math.pi, 0.05)
    + 1.2 * gauss(0.53 + f * 0.47, BROW_PHI / math.pi, 0.06),
)


def half_columns(s):
    """Returns [(phi_m, tuck_factor, is_lower_jaw)] for one ring.

    Behind the hinge the tuck fades to flush and the lip/lining offsets
    spread apart, so the groove runs out into plain surface with no
    degenerate quads.
    """
    lip = lip_angle(s)
    fade = smoothstep(S_HINGE, S_HINGE + 0.14, s)
    spread = 1.0 + 1.6 * fade
    floor = mix(TUCK_FLOOR, 1.0, fade)
    throat = mix(TUCK_THROAT, 1.0, fade)
    cols = []
    for frac in BELLY_FRACS:
        cols.append((frac * (lip - 0.02 * math.pi * spread), 1.0, True))
    cols.append((lip - 0.02 * math.pi * spread, 1.0, True))  # lower lip
    cols.append((lip - 0.008 * math.pi * spread, floor, True))  # lining A
    cols.append((lip + 0.008 * math.pi * spread, throat, False))  # lining B
    cols.append((lip + 0.02 * math.pi * spread, 1.0, False))  # upper lip
    # The dorsal columns must start clear of the spread upper lip: behind the
    # hinge the lip walks past a fixed 0.05 pi and the surface folds over
    # itself, which is the crease it2 wore from mouth corner to neck ring.
    base = lip + max(0.05, 0.02 * spread + 0.025) * math.pi
    for frac in UPPER_FRACS:
        cols.append((base + frac * (math.pi - base), 1.0, False))
    assert len(cols) == HALF_COLS
    return cols


def ring_positions():
    density = (
        lambda s: 1.0
        + 2.2 * gauss(s, EYE_S, 0.09)
        + 2.0 * gauss(s, S_HINGE, 0.08)
        + 1.6 * gauss(s, 0.04, 0.08)
    )
    return distribute(RINGS, density)


def jaw_ramp(s):
    """1 forward of the hinge, fading to 0 by S_HINGE + 0.14."""
    return 1.0 - smoothstep(S_HINGE, S_HINGE + 0.14, s)


def gape_bake(vertex, weight):
    """Rotates about world X through the hinge by `weight` of the rest gape."""
    if weight <= 0.0:
        return vertex
    angle = GAPE * weight
    c, si = math.cos(angle), math.sin(angle)
    x, y, z = vertex
    dy, dz = y - Y_HINGE, z - 0.0
    return (x, Y_HINGE + c * dy - si * dz, si * dy + c * dz)


def surface_colour(phi_m, tuck_factor, socket_dish):
    base = mix3(BELLY, DORSAL, phi_m / math.pi)
    lining_mix = clamp((1.0 - tuck_factor) / (1.0 - TUCK_THROAT))
    colour = mix3(base, LINING, lining_mix)
    # Occlusion is allowed in exactly two recesses: the socket dish and the
    # mouth lining. Both are multiplies, never a new hue.
    dim = (1.0 - 0.12 * socket_dish) * (1.0 - 0.18 * lining_mix)
    return (colour[0] * dim, colour[1] * dim, colour[2] * dim)


def build():
    reset_scene()

    verts, uvs, colours, weights = [], [], [], {}
    rings = ring_positions()

    for s in rings:
        a, b, cz = catmull(PROFILE, s)
        y = -LENGTH * (1.0 - s)
        ramp = jaw_ramp(s)
        cols = half_columns(s)
        # Full ring: left side 0..21, right side mirrors 20..1.
        full = [(phi, t, lower, 1.0) for (phi, t, lower) in cols]
        full += [(phi, t, lower, -1.0) for (phi, t, lower) in reversed(cols[1:-1])]
        for phi_m, tuck_factor, lower, side in full:
            x = side * a * math.sin(phi_m) * tuck_factor
            z = cz - b * math.cos(phi_m) * tuck_factor

            # Sculpt in (s, phi) space, before the gape.
            radial = (x, 0.0, z - cz)
            length = math.hypot(radial[0], radial[2]) or 1.0
            unit = (radial[0] / length, 0.0, radial[2] / length)
            socket = gauss(s, EYE_S, 0.05) * gauss(phi_m, EYE_PHI, 0.07 * math.pi)
            brow = gauss(s, BROW_S, 0.09) * gauss(phi_m, BROW_PHI, 0.08 * math.pi)
            push = -0.012 * socket + 0.014 * brow
            x += unit[0] * push
            z += unit[2] * push

            weight = ramp if lower else 0.0
            index = len(verts)
            verts.append(gape_bake((x, y, z), weight))
            if weight > 1e-4:
                weights[index] = weight
            uvs.append((phi_m / math.tau, 0.12 * s))
            colours.append(surface_colour(phi_m, tuck_factor, socket))

    cols_per_ring = 2 * HALF_COLS - 2
    faces = grid_faces(RINGS, cols_per_ring)

    # --- snout cap: a chin centre that rides the jaw and a snout centre that
    # stays with the skull, bridged across the lining so the groove's front
    # face is modelled lining rather than a torn fan.
    a0, b0, cz0 = catmull(PROFILE, 0.0)
    tip_cols = half_columns(0.0)
    lin_a, lin_b = 6, 7
    right = lambda j: (cols_per_ring - j) % cols_per_ring

    chin = len(verts)
    verts.append(gape_bake((0.0, -LENGTH - 0.006, cz0 - 0.006), 1.0))
    weights[chin] = 1.0
    uvs.append((0.0, 0.0))
    colours.append(BELLY)

    snout = len(verts)
    verts.append((0.0, -LENGTH - 0.006, cz0 + 0.006))
    uvs.append((0.5, 0.0))
    colours.append(DORSAL)

    lower_ring = [right(j) for j in range(lin_a, 0, -1)] + list(range(0, lin_a + 1))
    faces += [(chin, lower_ring[j], lower_ring[j + 1]) for j in range(len(lower_ring) - 1)]
    upper_ring = list(range(lin_b, HALF_COLS)) + [right(j) for j in range(HALF_COLS - 2, lin_b - 1, -1)]
    faces += [(snout, upper_ring[j], upper_ring[j + 1]) for j in range(len(upper_ring) - 1)]
    faces.append((lin_a, chin, snout, lin_b))
    faces.append((right(lin_b), snout, chin, right(lin_a)))

    # --- neck cap: a fan that sits inside the body tube. Deletable.
    base = (RINGS - 1) * cols_per_ring
    neck = len(verts)
    verts.append((0.0, -0.008, 0.0))
    uvs.append((0.25, 0.12))
    colours.append(mix3(BELLY, DORSAL, 0.5))
    faces += fan_faces(list(range(base, base + cols_per_ring)), neck)

    # --- nasal tubes: two small flared shells, separate in the same mesh.
    a_n, b_n, cz_n = catmull(PROFILE, NOSE_S)
    for side in (-1.0, 1.0):
        sx = side * a_n * math.sin(NOSE_PHI)
        sz = cz_n - b_n * math.cos(NOSE_PHI)
        sy = -LENGTH * (1.0 - NOSE_S)
        direction = (side * 0.45, -0.55, 0.70)
        norm = math.sqrt(sum(c * c for c in direction))
        direction = tuple(c / norm for c in direction)
        ortho_u = (direction[1], -direction[0], 0.0)
        norm = math.hypot(ortho_u[0], ortho_u[1]) or 1.0
        ortho_u = (ortho_u[0] / norm, ortho_u[1] / norm, 0.0)
        ortho_v = (
            direction[1] * ortho_u[2] - direction[2] * ortho_u[1],
            direction[2] * ortho_u[0] - direction[0] * ortho_u[2],
            direction[0] * ortho_u[1] - direction[1] * ortho_u[0],
        )
        tube_base = len(verts)
        stations = ((0.0, 0.0064), (0.4, 0.0053), (0.8, 0.0060), (1.0, 0.0071))
        reach = 0.030
        for t, radius in stations:
            centre = (
                sx - direction[0] * 0.004 + direction[0] * reach * t,
                sy - direction[1] * 0.004 + direction[1] * reach * t,
                sz - direction[2] * 0.004 + direction[2] * reach * t,
            )
            for j in range(6):
                angle = math.tau * j / 6
                offset = tuple(
                    ortho_u[k] * math.cos(angle) * radius + ortho_v[k] * math.sin(angle) * radius
                    for k in range(3)
                )
                verts.append(tuple(centre[k] + offset[k] for k in range(3)))
                uvs.append((NOSE_PHI / math.tau, 0.12 * NOSE_S))
                colours.append(mix3(DORSAL, LINING, 0.18))
        faces += grid_faces(len(stations), 6, base=tube_base)
        rim = list(range(tube_base + (len(stations) - 1) * 6, tube_base + len(stations) * 6))
        mouth = len(verts)
        tip_centre = (
            sx - direction[0] * 0.004 + direction[0] * reach,
            sy - direction[1] * 0.004 + direction[1] * reach,
            sz - direction[2] * 0.004 + direction[2] * reach,
        )
        verts.append(tuple(tip_centre[k] - direction[k] * 0.0012 for k in range(3)))
        uvs.append((NOSE_PHI / math.tau, 0.12 * NOSE_S))
        colours.append(mix3(DORSAL, LINING, 0.5))
        faces += fan_faces(rim, mouth)

    obj = mesh_from("creature-moray-head", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)

    armature = bind_groups(
        obj,
        [("jaw", (0.0, Y_HINGE, 0.0), (0.12, Y_HINGE, 0.0), weights)],
    )
    return obj, armature


def main():
    args = parse_args({"tag": "", "render": True})
    obj, armature = build()
    tris = stats(obj, "creature-moray-head")
    if tris > BUDGET:
        raise SystemExit("moray head over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj, armature], OUT)
    if args.get("render"):
        stem = "moray-head" + (("-" + args["tag"]) if args["tag"] else "")
        views = dict(VIEWS)
        # The mouth groove and gape can only be judged from below the chin.
        views["maw"] = (0.25, -0.9, -0.45)
        render_views([obj], stem, views=views)


main()
