"""Builds the storybook shore crab — a hand-sized animal that renders at a few
hundred pixels from the tidepool camera.

    blender --background --python tools/blender/creatures/build_crab.py

The animal this replaces was a sphere squashed flat with six cylinder sticks
under it, and it read as exactly that. This one is sculpted the way the whole
atelier builds: a domed carapace with a scalloped rim (a shore crab's
anterolateral teeth, rounded the way a picture book draws them), legs folded
in the shore crab's Z-fold with pale planted tips, two stalked eyes, and one
claw carried larger than the other — the charm claw, the asymmetry that makes
a drawn crab a *character* rather than a diagram.

Everything is baked. No joints: the game's crabs scuttle on an ease and their
legs ride the body's bob (`Crabs.ts`), so articulation would buy nothing a
silhouette can show. The piece is authored at the exact world size of the
procedural body it replaces — carapace 0.143 m across — so the adoption swap
in `Crabs.ts` is geometry alone, with `CRAB_SCALE` at 1.0 and every instance
matrix bit-identical.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from creature_common import (  # noqa: E402
    clamp,
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
    smoothstep,
    stats,
    write_uvs,
)

import math  # noqa: E402

OUT = "public/assets/models/creature-crab.glb"
BUDGET = 800

#: Authored at the replaced procedural crab's size: the instance matrices in
#: `Crabs.ts` (scale 0.8–1.3) then give the briefed 0.10–0.14 m carapace.
CARAPACE_RX = 0.0715  # across (x), half-width
CARAPACE_RY = 0.055  # front-to-back (Blender y), half-length
RIM_Z = 0.030  # carapace edge height; the legs bridge rim to ground
APEX_Z = 0.082  # dome crown

#: sRGB, written through `color_srgb` like every asset here. A warm terracotta
#: shell over a cream underside — the per-instance tint in `Crabs.ts` is a
#: near-neutral warm multiplier, so what is painted here is what renders.
#: Atelier repaint: the dome was one terracotta. Crown lifted toward cream,
#: rim dropped a full step, paired dorsal patches added (the shore crab's
#: field mark), eyes warmed off black with a lifted bead tip.
SHELL = (0.70, 0.40, 0.28)
SHELL_RIM = (0.475, 0.245, 0.185)
PATCH = (0.435, 0.215, 0.170)
CREAM = (0.90, 0.84, 0.72)
MITTEN = (0.930, 0.820, 0.640)
LEG = (0.60, 0.33, 0.24)
EYE = (0.165, 0.105, 0.105)
EYE_TIP = (0.235, 0.140, 0.135)

COLS = 24
#: Eight rounded teeth around the rim: the shore crab's scalloped edge. Soft:
#: at three columns a tooth a hard amplitude reads as a star's points.
SCALLOPS = 8
SCALLOP_AMP = 0.038


def scallop(theta, strength):
    """Radial multiplier for the rim's teeth.

    The teeth grow toward the front half (Blender -Y, theta near -pi/2),
    which is where a shore crab carries its anterolateral points; the rear
    margin stays nearly round.
    """
    front = 0.45 + 0.55 * clamp(0.5 - 0.5 * math.sin(theta))
    return 1.0 + SCALLOP_AMP * strength * front * math.cos(SCALLOPS * theta)


def footprint(theta, t):
    """The carapace outline: an ellipse squared off into the shore crab's D.

    The front margin is clamped to a shallow chord (the straight face a shore
    crab carries between its eye sockets), and the rear quarter is eased in,
    so the widest point sits ahead of the middle the way the real animal's
    does — an unmodified ellipse reads as a pie from above.
    """
    x = CARAPACE_RX * t * math.cos(theta)
    y = CARAPACE_RY * t * math.sin(theta)
    rear = clamp(math.sin(theta))
    y *= 1.0 - 0.12 * rear * rear
    y = max(y, -CARAPACE_RY * t * 0.86)
    return x, y


def add_carapace(verts, faces, uvs, colours):
    """The domed shell with its scalloped rim, skirt and cream underside.

    One lattice from just under the apex down over the rim and tucking back
    inside, so the whole shell is a single welded sheet: apex fan, ring
    strips, underside fan. The rim ring carries the scallops at full strength,
    the rings above at a fading half and quarter (so the teeth root into the
    dome rather than creasing out of it), and the skirt follows the rim down.
    """
    base = len(verts)
    # (t, z, scallop strength): near-apex to rim, then skirt and the tucked-in
    # underside ring. t is the fraction of the footprint outline.
    rings = [
        (0.24, RIM_Z + (APEX_Z - RIM_Z) * 0.90, 0.0),
        (0.52, RIM_Z + (APEX_Z - RIM_Z) * 0.62, 0.25),
        (0.78, RIM_Z + (APEX_Z - RIM_Z) * 0.34, 0.5),
        (1.00, RIM_Z, 1.0),
        (1.03, RIM_Z - 0.008, 1.0),  # skirt lip, downturned
        (0.58, RIM_Z - 0.002, 0.0),  # underside, tucked up into the cavity
    ]
    for t, z, strength in rings:
        for j in range(COLS):
            theta = math.tau * j / COLS
            x, y = footprint(theta, t)
            mod = scallop(theta, strength)
            verts.append((x * mod, y * mod, z))
            mirrored = min(theta, math.tau - theta)
            uvs.append((mirrored / math.pi, t))
            # Crown a real step lighter, rim a real step darker, everything
            # under cream — three values on the dome, plus the paired dorsal
            # patches on the mid rings.
            if t > 1.0:
                colours.append(mix3(CREAM, SHELL_RIM, 0.3))
            elif strength >= 1.0:
                colours.append(SHELL_RIM)
            else:
                light = mix3(SHELL, CREAM, 0.40 * (1.0 - t))
                base_c = mix3(light, SHELL_RIM, 0.55 * smoothstep(0.5, 1.0, t))
                spot = gauss(mirrored / math.pi, 0.33, 0.17)
                spot *= smoothstep(0.05, 0.25, strength) * (1.0 - smoothstep(0.6, 0.95, strength))
                colours.append(mix3(base_c, PATCH, spot * 0.85))

    apex = len(verts)
    verts.append((0.0, 0.0, APEX_Z))
    uvs.append((0.5, 0.0))
    colours.append(mix3(SHELL, CREAM, 0.22))
    belly = len(verts)
    verts.append((0.0, 0.0, RIM_Z + 0.004))
    uvs.append((0.5, 1.0))
    colours.append(CREAM)

    faces += fan_faces([base + j for j in range(COLS)], apex)
    faces += grid_faces(len(rings), COLS, base=base)
    faces += fan_faces(
        [base + (len(rings) - 1) * COLS + j for j in range(COLS)], belly
    )


def add_tube(verts, faces, uvs, colours, points, radii, cols, colour_root, colour_tip):
    """Lofts a tapered tube along a 3D polyline with parallel-transport frames.

    Legs, eye stalks and claw arms are all this one machine: rings
    perpendicular to the path, a pole cap at the far end, the root left open
    where it disappears into the shell. Colour runs root to tip with the last
    stretch fully tipped — the pale planted feet, the pale claw fingers.
    """
    base = len(verts)
    n = len(points)
    # Parallel transport: carry a side vector along the path so the rings
    # never twist between stations.
    tangent = (
        points[1][0] - points[0][0],
        points[1][1] - points[0][1],
        points[1][2] - points[0][2],
    )
    length = math.sqrt(sum(c * c for c in tangent)) or 1.0
    tangent = tuple(c / length for c in tangent)
    side = (1.0, 0.0, 0.0) if abs(tangent[0]) < 0.9 else (0.0, 1.0, 0.0)
    for i, (point, radius) in enumerate(zip(points, radii)):
        if i > 0:
            raw = (
                points[min(i + 1, n - 1)][0] - points[i - 1][0],
                points[min(i + 1, n - 1)][1] - points[i - 1][1],
                points[min(i + 1, n - 1)][2] - points[i - 1][2],
            )
            length = math.sqrt(sum(c * c for c in raw)) or 1.0
            tangent = tuple(c / length for c in raw)
            dot = sum(side[k] * tangent[k] for k in range(3))
            side = tuple(side[k] - dot * tangent[k] for k in range(3))
            norm = math.sqrt(sum(c * c for c in side)) or 1.0
            side = tuple(c / norm for c in side)
        up = (
            tangent[1] * side[2] - tangent[2] * side[1],
            tangent[2] * side[0] - tangent[0] * side[2],
            tangent[0] * side[1] - tangent[1] * side[0],
        )
        # The last ring and the cap carry the tip colour in full; the run-up
        # to it is a short blend so the pale foot reads painted, not dipped.
        blend = clamp((i / (n - 1) - 0.55) / 0.3)
        for j in range(cols):
            theta = math.tau * j / cols
            offset = (
                radius * (math.cos(theta) * side[0] + math.sin(theta) * up[0]),
                radius * (math.cos(theta) * side[1] + math.sin(theta) * up[1]),
                radius * (math.cos(theta) * side[2] + math.sin(theta) * up[2]),
            )
            verts.append(
                (point[0] + offset[0], point[1] + offset[1], point[2] + offset[2])
            )
            uvs.append((j / cols, i / (n - 1)))
            colours.append(mix3(colour_root, colour_tip, blend))

    tip = len(verts)
    verts.append(points[-1])
    uvs.append((0.5, 1.0))
    colours.append(colour_tip)
    faces += grid_faces(n, cols, base=base)
    faces += fan_faces([base + (n - 1) * cols + j for j in range(cols)], tip)


def add_leg(verts, faces, uvs, colours, sign, y, reach):
    """One walking leg in the shore crab's Z-fold: out to a raised knee, down
    to the ankle, tip planted on the sand with a pale foot. The rear legs are
    shorter, as the animal's are."""
    path = [
        (sign * 0.054, y, RIM_Z - 0.004),
        (sign * 0.092 * reach, y * 1.1, 0.047),
        (sign * 0.110 * reach, y * 1.2, 0.013),
        (sign * 0.118 * reach, y * 1.25, 0.0),
    ]
    add_tube(
        verts, faces, uvs, colours, path,
        (0.0072, 0.0062, 0.0046, 0.0016), 5, LEG, CREAM,
    )


def add_eye(verts, faces, uvs, colours, sign):
    """A stalked eye standing proud of the clamped front margin, dark bead.

    The bead is the whole face of the piece at two metres, so it is built
    bigger than the real animal's and painted full dark from the stalk's
    second ring on — a terracotta stalk with a black tip reads as neither.
    """
    path = [
        (sign * 0.027, -0.042, RIM_Z + 0.004),
        (sign * 0.029, -0.050, 0.068),
        (sign * 0.030, -0.053, 0.078),
    ]
    add_tube(
        verts, faces, uvs, colours, path,
        (0.0046, 0.0085, 0.0018), 6, EYE, EYE_TIP,
    )


def add_claw(verts, faces, uvs, colours, sign, s):
    """An arm folded forward under the face, ending in the mitten.

    The charm claw (the animal's left, +X) is built at 1.28 — a fiddler's
    asymmetry at shore-crab scale, which is the whole personality of the
    piece at two metres' viewing distance. The mitten is carried up at rim
    height and pushed past the shell's edge, or it vanishes under the dome
    from every angle the game looks at it.
    """
    path = [
        (sign * 0.044, -0.024, RIM_Z - 0.004),
        (sign * 0.068 * s, -0.044 * s, 0.028),
        (sign * 0.054 * s, -0.062 * s, 0.026),
        (sign * 0.034 * s, -0.078 * s, 0.032),
        (sign * 0.022 * s, -0.090 * s, 0.033),
    ]
    # The mitten is the widest ring and the tip a blunt finger beside it: a
    # long needle past the mitten reads as a stinger from the side, not a claw.
    radii = (0.0095 * s, 0.0108 * s, 0.0088 * s, 0.0148 * s, 0.0055)
    add_tube(verts, faces, uvs, colours, path, radii, 6, mix3(SHELL, LEG, 0.45), MITTEN)


def build():
    reset_scene()

    verts = []
    faces = []
    uvs = []
    colours = []

    add_carapace(verts, faces, uvs, colours)
    for sign in (-1.0, 1.0):
        # Four legs a side, shortening toward the rear like the animal's.
        for y, reach in ((-0.030, 1.0), (-0.004, 1.02), (0.022, 0.96), (0.044, 0.82)):
            add_leg(verts, faces, uvs, colours, sign, y, reach)
        add_eye(verts, faces, uvs, colours, sign)
    # The charm claw is the animal's left (+X); the right stays modest.
    add_claw(verts, faces, uvs, colours, 1.0, 1.28)
    add_claw(verts, faces, uvs, colours, -1.0, 0.9)

    obj = mesh_from("creature-crab", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)
    return obj


def main():
    args = parse_args({"tag": "", "render": True})
    obj = build()
    tris = stats(obj, "creature-crab")
    if tris > BUDGET:
        raise SystemExit("crab over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj], OUT)
    if args.get("render"):
        stem = "crab" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
