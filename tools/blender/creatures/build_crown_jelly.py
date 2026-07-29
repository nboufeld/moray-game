"""Builds the Crown Jelly Sovereign — a 2.2 m crowned jelly for the Lumen Garden.

    blender --background --python tools/blender/creatures/build_crown_jelly.py -- --tag wave8

The jelly-bell idiom at throne scale: a closed thin shell (outer dome
recurving under the margin, inner dome rising back inside) so it reads from
below, no rig — a pulse is a scale animation and the bloom drives drift.
What makes it a *sovereign* is the coronet: a raised gold-rose band around
the bell's lower half carrying twelve standing spikes, with twelve long
tendrils trailing from it, their tips echoing the crown.

The crown's glow is painted value, per the brief: the band and spikes are
authored near sRGB 1.0 in a warm gold-rose while the bell sits a full two
value-steps down in deep indigo, so `COLOR_0` alone separates lamp from
body (the game's material lifts the warm vertices further, keyed on that
same red-over-blue gap). The inner shell is a step deeper than the outer,
the standing translucency cheat.

Radially symmetric, no facing direction. Pivot is the margin opening
plane (y = 0), apex at +0.72, tendrils trailing to y ~ -1.5.
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

OUT = "public/assets/models/creature-crown-jelly.glb"
BUDGET = 3000

RADIUS = 1.10
HEIGHT = 0.72
#: The dome continues past the equator so the margin tucks under.
ALPHA_MAX = 0.62 * math.pi

#: 60 — a multiple of the spike count, so every spike sits on a column.
COLS = 60
OUTER_RINGS = 11
INNER_RINGS = 7

#: The coronet: where it stands on the dome (in t, 0 apex -> 1 margin),
#: how far it swells, and how many spikes it carries.
CROWN_T = 0.55
CROWN_SWELL = 0.055
SPIKES = 12
SPIKE_REACH = 0.16
SPIKE_CHORD = 0.075

TENDRILS = 12
TENDRIL_SEGMENTS = 9
TENDRIL_LENGTH = 1.65

#: sRGB gouache. The bell is deep indigo two value-steps under the crown;
#: the crown is authored at the top of the range, a painted lamp.
APEX = (0.295, 0.255, 0.545)
MARGIN = (0.360, 0.280, 0.600)
INNER = (0.185, 0.150, 0.405)
CROWN = (1.000, 0.735, 0.430)
CROWN_TIP = (1.000, 0.820, 0.560)
TENDRIL_ROOT = (0.400, 0.320, 0.660)
TENDRIL_TIP = (0.950, 0.720, 0.520)


def dome_point(t, theta):
    alpha = ALPHA_MAX * t
    r = RADIUS * math.sin(alpha)
    # The coronet swells the dome where it stands.
    r *= 1.0 + CROWN_SWELL * gauss(t, CROWN_T, 0.045)
    z = HEIGHT * math.cos(alpha)
    return (r * math.cos(theta), r * math.sin(theta), z)


def bell_colour(t, theta):
    """Outer shell: deep indigo, the coronet a bright gold-rose band."""
    base = mix3(APEX, MARGIN, smoothstep(0.35, 1.0, t))
    # A soft rosette at the apex: twelve deeper petals aligned with the
    # spikes, value only — the dome's own painted centre.
    petal = 0.5 + 0.5 * math.cos(SPIKES * theta)
    rosette = smoothstep(0.55, 0.85, petal) * (1.0 - smoothstep(0.10, 0.30, t))
    base = mix3(base, INNER, rosette * 0.45)
    # The margin's lip lifts half a value step: a painted rim light.
    lip = smoothstep(0.93, 1.0, t)
    base = mix3(base, (0.44, 0.35, 0.66), lip * 0.5)
    crown = smoothstep(0.42, 0.50, t) * (1.0 - smoothstep(0.60, 0.68, t))
    return mix3(base, CROWN, crown)


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
            x, y, z = dome_point(t, theta)
            verts.append((x, y, z))
            uvs.append((0.5 + 0.5 * (x / RADIUS) * 0.9, 0.5 + 0.5 * (y / RADIUS) * 0.9))
            colours.append(bell_colour(t, theta))
    faces += fan_faces(list(range(outer_base, outer_base + COLS)), apex)
    faces += grid_faces(OUTER_RINGS, COLS, base=outer_base)

    # Inner shell, the jelly-bell idiom: first ring a hair under the margin,
    # then back up inside; painted a full step deeper so seeing interior is
    # seeing shadowed jelly.
    inner_base = len(verts)
    for i in range(INNER_RINGS):
        t_in = 1.0 - i / (INNER_RINGS - 1)
        t = mix(0.30, 1.0, t_in)
        for j in range(COLS):
            theta = math.tau * j / COLS
            x, y, z = dome_point(t, theta)
            shrink = 1.0 - 0.10 * (1.0 - t_in)
            lift = 0.045 * (1.0 - t_in)
            verts.append((x * shrink, y * shrink, z + lift if i > 0 else z - 0.006))
            uvs.append((0.5 + 0.5 * (x / RADIUS) * 0.6, 0.5 + 0.5 * (y / RADIUS) * 0.6))
            colours.append(mix3(MARGIN, INNER, smoothstep(0.0, 0.55, 1.0 - t_in)))
    faces += grid_faces(INNER_RINGS, COLS, base=inner_base)

    inner_apex = len(verts)
    verts.append((0.0, 0.0, HEIGHT * math.cos(ALPHA_MAX * 0.30) + 0.045))
    uvs.append((0.5, 0.5))
    colours.append(INNER)
    last = inner_base + (INNER_RINGS - 1) * COLS
    faces += fan_faces(list(reversed(range(last, last + COLS))), inner_apex)

    margin = outer_base + (OUTER_RINGS - 1) * COLS
    for j in range(COLS):
        a = margin + j
        b = margin + (j + 1) % COLS
        c = inner_base + (j + 1) % COLS
        d = inner_base + j
        faces.append((a, b, c, d))

    # The spikes: twelve tapered blades standing proud of the coronet,
    # tipped outward like a crown's points. A two-tri blade (not one
    # triangle) so the notch reads from every azimuth, not only in profile.
    for k in range(SPIKES):
        theta = math.tau * k / SPIKES
        dx, dy = math.cos(theta), math.sin(theta)
        px, py = -dy, dx  # around the ring
        bx, by, bz = dome_point(CROWN_T, theta)
        tip = (bx + dx * SPIKE_REACH, by + dy * SPIKE_REACH, bz + SPIKE_REACH * 0.75)
        half = SPIKE_CHORD * 0.5
        tip_half = half * 0.28
        left = len(verts)
        verts.append((bx - px * half, by - py * half, bz))
        uvs.append((0.5 + 0.45 * bx / RADIUS, 0.5 + 0.45 * by / RADIUS))
        colours.append(CROWN)
        right = len(verts)
        verts.append((bx + px * half, by + py * half, bz))
        uvs.append((0.5 + 0.45 * bx / RADIUS, 0.5 + 0.45 * by / RADIUS))
        colours.append(CROWN)
        tip_l = len(verts)
        verts.append((tip[0] - px * tip_half, tip[1] - py * tip_half, tip[2]))
        uvs.append((0.5 + 0.45 * tip[0] / RADIUS, 0.5 + 0.45 * tip[1] / RADIUS))
        colours.append(CROWN_TIP)
        tip_r = len(verts)
        verts.append((tip[0] + px * tip_half, tip[1] + py * tip_half, tip[2]))
        uvs.append((0.5 + 0.45 * tip[0] / RADIUS, 0.5 + 0.45 * tip[1] / RADIUS))
        colours.append(CROWN_TIP)
        faces.append((left, right, tip_r, tip_l))

    # The tendrils: twelve ribbons trailing from the coronet's underside,
    # waving gently outward, dark indigo at the root and pale gold-rose at
    # the tip — the crown's colour, rained down.
    for k in range(TENDRILS):
        theta = math.tau * (k + 0.5) / TENDRILS
        dx, dy = math.cos(theta), math.sin(theta)
        px, py = -dy, dx
        phase = 1.7 * k
        base_r = RADIUS * math.sin(ALPHA_MAX * CROWN_T) * 0.97
        root = (dx * base_r, dy * base_r, HEIGHT * math.cos(ALPHA_MAX * CROWN_T) - 0.01)
        prev = None
        for jseg in range(TENDRIL_SEGMENTS + 1):
            t = jseg / TENDRIL_SEGMENTS
            sway = math.sin(t * 2.6 + phase) * 0.10 * t * t
            drift = 0.16 * t * t
            cx = root[0] + dx * drift + px * sway
            cy = root[1] + dy * drift + py * sway
            cz = root[2] - TENDRIL_LENGTH * t
            width = mix(0.042, 0.006, t)
            shade = mix3(TENDRIL_ROOT, TENDRIL_TIP, smoothstep(0.25, 1.0, t))
            row = []
            for side in (-1.0, 1.0):
                index = len(verts)
                verts.append((cx + px * width * side, cy + py * width * side, cz))
                uvs.append((0.05 + 0.06 * t, 0.05 + 0.5 * (0.5 + 0.5 * side)))
                colours.append(shade)
                row.append(index)
            if prev is not None:
                faces.append((prev[0], prev[1], row[1], row[0]))
            prev = row

    obj = mesh_from("creature-crown-jelly", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)
    return obj


def main():
    args = parse_args({"tag": "", "render": True})
    obj = build()
    tris = stats(obj, "creature-crown-jelly")
    if tris > BUDGET:
        raise SystemExit("crown jelly over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj], OUT)
    if args.get("render"):
        stem = "crown-jelly" + (("-" + args["tag"]) if args["tag"] else "")
        views = {
            "front": (0.0, -1.0, 0.0),
            "quarter": (0.72, -0.78, 0.42),
            "below": (0.5, -0.7, -0.55),
            "top": (0.0, -0.001, 1.0),
        }
        render_views([obj], stem, views=views)


main()
