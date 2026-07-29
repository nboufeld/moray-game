"""Builds the Kraken Hatchling — a shy octopus child for the Sea-Glass Cove.

    blender --background --python tools/blender/creatures/build_kraken_hatchling.py -- --tag wave8

A mantle bulb the size of a diver's two fists (~0.5 m) with eight arms
reaching to ~1 m, authored mid-splay with the tips lifting — the rest pose an
octopus holds while deciding whether you are interesting. The silhouette is
the animal: a smooth crown, two wide dark eyes on the face (Blender -Y,
glTF +Z), and the arms pouring outward from the skirt rim.

Palette is the PALE tint set, on purpose: the runtime keys the calm animal
down to dusty rose by multiplication and blanches it back to white when
startled — the authored colour *is* the startled colour, and the rose is
earned. (Vertex colours are colours here, not multipliers; see the
creature_common header.)

Joints: `arm0`..`arm7`, one per arm, standing at 22.5° + 45°i around the rim
(r 0.16 m, z 0.02). Each bone lies along its rim tangent so its local +Y is
the tangent: a positive rotation about it curls the arm's tip up toward the
mantle. Weights ramp in over the arm's first third, so a curl bends at the
skirt rather than shearing.

Contracts (measured off the export with `inspect_creature.mjs`):
- pivot at the skirt's centre; the mantle rises along glTF +Y, the eyes look
  along glTF +Z; arm tips span ~2 m.
- joint origins and axes as above; order is root, arm0..arm7.
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
)

OUT = "public/assets/models/creature-kraken-hatchling.glb"
BUDGET = 4000

#: (z, half_width_x, half_depth_y) stations, skirt rim to crown.
MANTLE_PROFILE = [
    (0.00, 0.150, 0.140),
    (0.06, 0.185, 0.170),
    (0.16, 0.210, 0.195),
    (0.28, 0.195, 0.185),
    (0.38, 0.155, 0.150),
    (0.46, 0.100, 0.095),
    (0.52, 0.030, 0.028),
]
MANTLE_RINGS = 16
MANTLE_COLS = 20

#: The arms: count, rim radius, rest direction droop, length and curl of the
#: baked pose. Angles are 22.5° + 45°i so two arms flank the face.
ARM_COUNT = 8
ARM_ROOT_R = 0.16
ARM_ROOT_Z = 0.02
ARM_LENGTH = 0.95
ARM_DROOP = 0.50
ARM_TIP_LIFT = 0.16
ARM_RINGS = 10
ARM_COLS = 8
ARM_ROOT_RADIUS = 0.048
ARM_TIP_RADIUS = 0.010

#: The eyes: two wide dark beads on the face, proud of the skin — a buried
#: bead is invisible, and the shy is mostly eyes.
EYE_X = 0.115
EYE_Y = -0.208
EYE_Z = 0.175
EYE_R = 0.050

#: sRGB gouache — the PALE set; see the header. Atelier repaint: the set
#: stays pale (the runtime's calm-rose multiply and the blanch depend on
#: it), but it carries value structure now — a dusty crown melting into a
#: near-white skirt rim, arm roots a step under their tips, cream sucker
#: lines — because a multiply preserves whatever structure is authored.
MANTLE_LOW = (0.945, 0.815, 0.775)
MANTLE_HIGH = (0.775, 0.495, 0.470)
SKIRT_RIM = (0.975, 0.905, 0.865)
ARM_LOW = (0.875, 0.675, 0.630)
ARM_HIGH = (0.960, 0.865, 0.815)
SUCKER = (0.985, 0.930, 0.860)
EYE_DARK = (0.170, 0.105, 0.120)
EYE_RING = (0.980, 0.920, 0.850)


def mantle(z):
    return catmull(MANTLE_PROFILE, z)


def arm_angle(i):
    return math.radians(22.5 + 45 * i)


def build():
    reset_scene()
    verts, uvs, colours = [], [], []
    weights = {"arm%d" % i: {} for i in range(ARM_COUNT)}
    faces = []

    # ---------------------------------------------------------------- mantle
    # Rings cluster at the eye band and the crown, where the sculpture is.
    ring_zs = distribute(
        MANTLE_RINGS,
        lambda z: 1.0 + 1.6 * gauss(z, 0.16, 0.05) + 1.2 * gauss(z, 0.50, 0.06),
        low=MANTLE_PROFILE[0][0],
        high=MANTLE_PROFILE[-1][0],
    )
    for z in ring_zs:
        half_w, half_d = mantle(z)
        for j in range(MANTLE_COLS):
            angle = math.tau * j / MANTLE_COLS
            x = half_w * math.sin(angle)
            y = -half_d * math.cos(angle)
            verts.append((x, y, z))
            uvs.append((j / MANTLE_COLS, z / MANTLE_PROFILE[-1][0]))
            zt = z / MANTLE_PROFILE[-1][0]
            body = mix3(MANTLE_LOW, MANTLE_HIGH, zt ** 1.3)
            # The skirt's rim lifts to near-white — the palest band on the
            # animal, so the mantle reads bottom-lit the way a shy thing
            # peeking over its own arms does.
            body = mix3(body, SKIRT_RIM, 1.0 - smoothstep(0.0, 0.14, zt))
            # Freckled mottling over the crown: two crossed waves, not one
            # machine sine — chromatophores at rest, upper mantle only.
            freckle = math.sin(3.1 * x / half_w + 5.0 * z) * math.sin(7.3 * y / half_d + 11.0 * z)
            mottle = 1.0 + 0.09 * freckle * smoothstep(0.3, 0.7, zt)
            body = tuple(clamp(c * mottle) for c in body)
            # A pale spectacle ring where each eye bead sits proud.
            for side in (-1.0, 1.0):
                d = math.hypot((x - side * EYE_X) / (EYE_R * 1.9), (z - EYE_Z) / (EYE_R * 1.9))
                if y < 0.0:
                    ring = gauss(d, 1.0, 0.35)
                    body = mix3(body, EYE_RING, ring * 0.6)
            colours.append(body)

    faces += grid_faces(len(ring_zs), MANTLE_COLS)

    rim = len(verts)
    verts.append((0.0, 0.0, MANTLE_PROFILE[0][0] - 0.012))
    uvs.append((0.5, 0.0))
    colours.append(SKIRT_RIM)
    faces += fan_faces(list(reversed(range(0, MANTLE_COLS))), rim)

    crown_ring = (len(ring_zs) - 1) * MANTLE_COLS
    crown = len(verts)
    verts.append((0.0, 0.0, MANTLE_PROFILE[-1][0] + 0.008))
    uvs.append((0.5, 1.0))
    colours.append(MANTLE_HIGH)
    faces += fan_faces(list(range(crown_ring, crown_ring + MANTLE_COLS)), crown)

    # ------------------------------------------------------------------ eyes
    for side in (-1.0, 1.0):
        eye_base = len(verts)
        for i in range(5):
            t = i / 4.0
            phi = math.pi * t
            ring_r = EYE_R * math.sin(phi)
            cz = EYE_Z + EYE_R * 0.9 * math.cos(phi)
            for j in range(8):
                angle = math.tau * j / 8
                verts.append(
                    (
                        side * EYE_X + ring_r * math.sin(angle),
                        EYE_Y - ring_r * 0.55 * math.cos(angle),
                        cz,
                    )
                )
                uvs.append((0.95, 0.95))
                colours.append(EYE_DARK)
        faces += grid_faces(5, 8, base=eye_base)
        tip = len(verts)
        verts.append((side * EYE_X, EYE_Y - EYE_R * 0.55 - 0.004, EYE_Z))
        uvs.append((0.95, 0.95))
        colours.append(EYE_DARK)
        rim_idx = list(range(eye_base + 32, eye_base + 40))
        faces += fan_faces(rim_idx, tip)

    # ------------------------------------------------------------------ arms
    for i in range(ARM_COUNT):
        theta = arm_angle(i)
        cos_t, sin_t = math.cos(theta), math.sin(theta)
        direction = (cos_t, sin_t, -ARM_DROOP)
        norm = math.sqrt(sum(c * c for c in direction))
        direction = tuple(c / norm for c in direction)
        base = len(verts)
        for k in range(ARM_RINGS):
            t = k / (ARM_RINGS - 1)
            radius = mix(ARM_ROOT_RADIUS, ARM_TIP_RADIUS, t ** 0.85)
            centre = (
                ARM_ROOT_R * cos_t + direction[0] * ARM_LENGTH * t,
                ARM_ROOT_R * sin_t + direction[1] * ARM_LENGTH * t,
                ARM_ROOT_Z + direction[2] * ARM_LENGTH * t + ARM_TIP_LIFT * t * t,
            )
            for j in range(ARM_COLS):
                angle = math.tau * j / ARM_COLS
                # Around the arm: x within the rim plane, z across it.
                lx = radius * math.sin(angle)
                lz = radius * math.cos(angle)
                verts.append(
                    (
                        centre[0] - sin_t * lx,
                        centre[1] + cos_t * lx,
                        centre[2] + lz,
                    )
                )
                uvs.append((j / ARM_COLS, t))
                # The sucker side: the columns facing the floor.
                if math.cos(angle) < -0.45:
                    colours.append(mix3(SUCKER, ARM_HIGH, t))
                else:
                    colours.append(mix3(ARM_LOW, ARM_HIGH, t))
                index = len(verts) - 1
                w = smoothstep(0.04, 0.3, t)
                if w > 1e-4:
                    weights["arm%d" % i][index] = w
        faces += grid_faces(ARM_RINGS, ARM_COLS, base=base)
        tip = len(verts)
        tip_centre = (
            ARM_ROOT_R * cos_t + direction[0] * ARM_LENGTH,
            ARM_ROOT_R * sin_t + direction[1] * ARM_LENGTH,
            ARM_ROOT_Z + direction[2] * ARM_LENGTH + ARM_TIP_LIFT,
        )
        verts.append(tip_centre)
        uvs.append((0.5, 1.0))
        colours.append(ARM_HIGH)
        weights["arm%d" % i][tip] = 1.0
        rim_idx = list(range(base + (ARM_RINGS - 1) * ARM_COLS, base + ARM_RINGS * ARM_COLS))
        faces += fan_faces(rim_idx, tip)

    obj = mesh_from("creature-kraken-hatchling", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)

    joints = [
        (
            "arm%d" % i,
            (ARM_ROOT_R * math.cos(arm_angle(i)), ARM_ROOT_R * math.sin(arm_angle(i)), ARM_ROOT_Z),
            (
                ARM_ROOT_R * math.cos(arm_angle(i)) + 0.1 * math.sin(arm_angle(i)),
                ARM_ROOT_R * math.sin(arm_angle(i)) - 0.1 * math.cos(arm_angle(i)),
                ARM_ROOT_Z,
            ),
            weights["arm%d" % i],
        )
        for i in range(ARM_COUNT)
    ]
    armature = bind_groups(obj, joints)
    return obj, armature


def main():
    args = parse_args({"tag": "", "render": True})
    obj, armature = build()
    tris = stats(obj, "creature-kraken-hatchling")
    if tris > BUDGET:
        raise SystemExit("kraken hatchling over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj, armature], OUT)
    if args.get("render"):
        stem = "kraken-hatchling" + (("-" + args["tag"]) if args["tag"] else "")
        views = {
            "front": (0.0, -1.0, 0.0),
            "side": (1.0, 0.0, 0.06),
            "top": (0.0, -0.001, 1.0),
            "quarter": (0.72, -0.78, 0.42),
            "below": (0.3, -0.5, -1.0),
        }
        render_views([obj], stem, views=views)


main()
