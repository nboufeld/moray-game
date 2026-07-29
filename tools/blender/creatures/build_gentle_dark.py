"""Builds the Gentle Dark — the umibōzu hull off the Open Blue's drop-off.

    blender --background --python tools/blender/creatures/build_gentle_dark.py -- --tag wave8

A colossal smooth head-and-shoulders silhouette, ~10 m from the base of its
shoulders to the crown, seen against the far curtain at 3.5–14 m. There are
no joints: the whole behaviour is the runtime's slow vertical rise. What the
mesh has to carry is the silhouette — broad shoulders pouring into a slight
neck, a great bald head, a crown with no parting — and exactly two warm pale
eye discs, the only warm thing on it.

Palette: a deep blue-violet, NEVER black (a black hull would read as a hole
in the water; this reads as a presence), lifting one value step toward the
crown so the top of the head separates from the shoulders at silhouette
distance. The eyes are painted discs on the face; the runtime adds the soft
glow they are seen by.

Contracts (measured off the export with `inspect_creature.mjs` after each
build; see the wave-8 ledger):
- pivot at the base of the shoulders; the hull rises along glTF +Y; the face
  (and the eyes) look along glTF +Z. Nothing sits behind the face plane.
- the brow's front surface is at glTF z ≈ +1.95, eye height y ≈ 6.55.
- no joints; UVs are a plain cylindrical wrap for completeness.
"""

import math
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
    stats,
    write_uvs,
)

OUT = "public/assets/models/creature-gentle-dark.glb"
BUDGET = 2000

#: (z, half_width_x, half_depth_y) stations, base of the shoulders to the
#: crown. The face is Blender -Y, so half_depth is measured to each side.
PROFILE = [
    (0.0, 3.60, 2.20),
    (0.8, 3.55, 2.15),
    (2.0, 3.10, 1.95),
    (3.4, 2.40, 1.72),
    (4.6, 2.00, 1.70),
    (5.6, 1.95, 1.85),
    (6.4, 2.02, 1.95),
    (7.2, 1.88, 1.80),
    (8.1, 1.55, 1.50),
    (8.9, 1.10, 1.05),
    (9.4, 0.55, 0.52),
    (9.7, 0.16, 0.15),
]

RINGS = 22
COLS = 26

#: sRGB gouache. Deep blue-violet, one value step up at the crown; the eye
#: discs are the only warm note on the being.
BODY_LOW = (0.145, 0.125, 0.300)
BODY_HIGH = (0.205, 0.175, 0.385)
EYE_PALE = (0.955, 0.875, 0.660)

#: The eye discs, on the face at the brow: centres (x, z), radii (rx, rz).
EYE_X, EYE_Z = 0.92, 6.90
EYE_RX, EYE_RZ = 0.52, 0.58

#: The pour: above the neck the whole mass leans toward the water it regards,
#: a third of a metre at the crown. Without it the side view reads hunched —
#: a bulge symmetric about its own neck — instead of *rising over*.
POUR_FROM = 4.6
POUR_METRES = 0.35


def surface(z):
    return catmull(PROFILE, z)


def pour(z):
    t = clamp((z - POUR_FROM) / (PROFILE[-1][0] - POUR_FROM))
    return -POUR_METRES * t * t * (3.0 - 2.0 * t)


def eye_blend(x, z):
    """0 outside both discs, 1 at their centres, a soft rim between."""
    best = 0.0
    for side in (-1.0, 1.0):
        d = math.hypot((x - side * EYE_X) / EYE_RX, (z - EYE_Z) / EYE_RZ)
        best = max(best, 1.0 - d)
    return best


def build():
    reset_scene()
    verts, uvs, colours = [], [], []

    # Rings cluster where the silhouette turns: the neck and the crown — and
    # at the eye band, or the discs are painted by too few vertices to read.
    ring_zs = distribute(
        RINGS,
        lambda z: 1.0
        + 1.4 * gauss(z, 4.8, 1.6)
        + 1.8 * gauss(z, 9.2, 0.7)
        + 2.2 * gauss(z, EYE_Z, 0.55),
        low=PROFILE[0][0],
        high=PROFILE[-1][0],
    )
    for z in ring_zs:
        half_w, half_d = surface(z)
        y0 = pour(z)
        for j in range(COLS):
            angle = math.tau * j / COLS
            x = half_w * math.sin(angle)
            y = y0 - half_d * math.cos(angle)
            verts.append((x, y, z))
            uvs.append((j / COLS, z / PROFILE[-1][0]))
            body = mix3(BODY_LOW, BODY_HIGH, (z / PROFILE[-1][0]) ** 1.4)
            eye = eye_blend(x, z)
            # Only the face side can hold an eye: the discs do not wrap.
            if y < y0 - 0.35 * half_d and eye > 0.0:
                colours.append(mix3(body, EYE_PALE, min(1.0, eye * 1.6)))
            else:
                colours.append(body)

    faces = grid_faces(RINGS, COLS)

    base = len(verts)
    verts.append((0.0, 0.0, PROFILE[0][0] - 0.05))
    uvs.append((0.5, 0.0))
    colours.append(BODY_LOW)
    faces += fan_faces(list(reversed(range(0, COLS))), base)

    crown_base = (RINGS - 1) * COLS
    crown = len(verts)
    verts.append((0.0, pour(PROFILE[-1][0]), PROFILE[-1][0] + 0.06))
    uvs.append((0.5, 1.0))
    colours.append(BODY_HIGH)
    faces += fan_faces(list(range(crown_base, crown_base + COLS)), crown)

    obj = mesh_from("creature-gentle-dark", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)
    return obj


def main():
    args = parse_args({"tag": "", "render": True})
    obj = build()
    tris = stats(obj, "creature-gentle-dark")
    if tris > BUDGET:
        raise SystemExit("gentle dark over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj], OUT)
    if args.get("render"):
        stem = "gentle-dark" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
