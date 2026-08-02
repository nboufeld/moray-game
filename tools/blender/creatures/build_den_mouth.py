"""Builds the den mouth — a rock archway a moray hides inside.

    blender --background --python tools/blender/creatures/build_den_mouth.py -- --tag it1

This is scenery in the creature folder because it exists for an animal: the
opening is sized for a moray's head and the piece is meant to sit against a
reef mound as a hiding spot's front door. Three facts about the reef decide
how it is built (all read from `src/world/Reef.ts` and AGENTS.md, none
guessed):

- **The reef's rocks are smooth-welded and near-neutral.** Every vertex here
  is shared (the lofts wrap), so the normals arrive welded; the colours are
  a pale neutral wash so the game's per-family rock tint — or an algae tint
  — multiplies into hue instead of fighting one. The mottle is a wash, not
  lighting: high-frequency, mean near 1, value only.
- **A crevice's darkness is a colour.** The game's `caveInterior` throat is
  violet-blue with red *below* green *below* blue (0.165, 0.227, 0.408
  in the throat). The arch's inner face shades toward that same ordering, so
  a den wearing this piece deepens into the reef's own darkness rather than
  into a grey hole.
- **The rock wash tiles every ~2.3 m** (`TILE_REPEAT` against
  `boxProjectUvs`' 0.22 UV per metre). The arch's parametric UVs are scaled
  so one UV unit spans about 2.3 m of surface, so the painted wash arrives
  at the density the reef's own rocks wear.

Determinism: the displacement is a hash-based value noise seeded by SEED —
no `random` module state, so two builds are bit-identical.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from creature_common import (  # noqa: E402
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

OUT = "public/assets/models/creature-den-mouth.glb"
BUDGET = 2500
SEED = 7.0

#: The opening: a moray head is ~0.2 m across, so a 0.9 m-wide, 0.75 m-tall
#: doorway leaves room for the animal and its shadow. it1's squat letterbox
#: (1.2 x 0.45) came from a low radius on a wide span.
ARCH_RADIUS = 1.05
ARCH_SPAN = 0.88  # footing centres at +/- this x
RINGS = 26  # along the arc
COLS = 18  # around the tube

STONE = (0.860, 0.845, 0.820)
THROAT = (0.400, 0.470, 0.640)
#: Ground plane the buried footings are clipped to.
GROUND = -0.04
#: The arch path is sunk so the feet thicken underground and clip flat —
#: a planted rock rather than a handle resting on a table.
SINK = 0.06

WASH_METRES_PER_TILE = 2.3


def hash01(x, y, z):
    value = math.sin(x * 127.1 + y * 311.7 + z * 74.7 + SEED * 53.13) * 43758.5453
    return value - math.floor(value)


def vnoise(x, y, z):
    """Trilinear value noise on an integer lattice."""
    xi, yi, zi = math.floor(x), math.floor(y), math.floor(z)
    xf, yf, zf = x - xi, y - yi, z - zi
    sx = xf * xf * (3 - 2 * xf)
    sy = yf * yf * (3 - 2 * yf)
    sz = zf * zf * (3 - 2 * zf)
    out = 0.0
    for dx, dy, dz, w in (
        (0, 0, 0, (1 - sx) * (1 - sy) * (1 - sz)),
        (1, 0, 0, sx * (1 - sy) * (1 - sz)),
        (0, 1, 0, (1 - sx) * sy * (1 - sz)),
        (1, 1, 0, sx * sy * (1 - sz)),
        (0, 0, 1, (1 - sx) * (1 - sy) * sz),
        (1, 0, 1, sx * (1 - sy) * sz),
        (0, 1, 1, (1 - sx) * sy * sz),
        (1, 1, 1, sx * sy * sz),
    ):
        out += w * hash01(xi + dx, yi + dy, zi + dz)
    return out


def fbm(x, y, z):
    return (
        0.62 * vnoise(x, y, z)
        + 0.26 * vnoise(x * 2.1 + 13.7, y * 2.1, z * 2.1)
        + 0.12 * vnoise(x * 4.3 + 41.3, y * 4.3, z * 4.3)
    )


def arch_path(beta):
    """Centre-line of the arch: a semicircle widened at the feet."""
    x = -math.cos(beta) * ARCH_SPAN
    z = math.sin(beta) * ARCH_RADIUS - SINK
    lean = 0.10 * math.sin(beta)  # crown leans back into the reef
    return (x, lean, z)


def tube_radius(beta):
    """Fat feet, slimmer crown."""
    footing = math.exp(-((math.sin(beta)) ** 2) * 3.2)
    return mix(0.30, 0.44, footing)


def build():
    reset_scene()
    verts, uvs, colours = [], [], []
    faces = []

    for i in range(RINGS):
        beta = math.pi * i / (RINGS - 1)
        cx, cy, cz = arch_path(beta)
        base_r = tube_radius(beta)
        # Local frame: tangent along the arc, and a ring around it.
        tx = math.sin(beta) * ARCH_SPAN
        tz = math.cos(beta) * ARCH_RADIUS
        norm = math.hypot(tx, tz) or 1.0
        tx, tz = tx / norm, tz / norm
        # ring axis u: in-plane normal; ring axis v: world -Y (out the mouth)
        ux, uz = -tz, tx
        for j in range(COLS):
            gamma = math.tau * j / COLS
            ring_u = math.cos(gamma)
            ring_v = math.sin(gamma)
            px = cx + ux * ring_u * base_r
            py = cy + ring_v * base_r * 0.86
            pz = cz + uz * ring_u * base_r
            # Low frequency and high amplitude, the reef's own rule for a
            # round rock: it1 at (2.2, 0.17) was an inflated pool toy.
            bump = (fbm(px * 1.5, py * 1.5, pz * 1.5) - 0.5) * 0.30
            px += ux * ring_u * bump
            py += ring_v * bump * 0.86
            pz += uz * ring_u * bump
            pz = max(pz, GROUND)
            verts.append((px, py, pz))

            # UVs run past 1 rather than wrapping with a mod: the rock wash
            # is a repeat-tiled texture, and a mod would put one quad per
            # wrap interpolating backwards across the whole image.
            arc_len = beta * ARCH_RADIUS * 1.35
            around = gamma * base_r
            uvs.append((arc_len / WASH_METRES_PER_TILE, around / WASH_METRES_PER_TILE))

            # Inner face of the arch (ring_u < 0 points into the opening):
            # shade toward the reef's own violet-blue throat.
            inward = clamp(-ring_u)
            crown = math.sin(beta)
            throat = smoothstep(0.25, 0.95, inward) * mix(0.55, 1.0, crown)
            mottle = 0.84 + 0.14 * vnoise(px * 6.1, py * 6.1, pz * 6.1)
            colour = mix3(STONE, THROAT, throat * 0.85)
            colours.append(tuple(c * mottle for c in colour))
    faces += grid_faces(RINGS, COLS)

    # Footing caps: fans just below ground level, sunk so the arch can be
    # planted on any seabed undulation.
    for end, base in ((0, 0), (1, (RINGS - 1) * COLS)):
        centre = len(verts)
        cx, cy, _ = arch_path(0.0 if end == 0 else math.pi)
        verts.append((cx, cy, -0.06))
        uvs.append((0.5, 0.5))
        colours.append(STONE)
        ring = list(range(base, base + COLS))
        faces += fan_faces(ring if end == 1 else list(reversed(ring)), centre)

    # Two footing boulders, one squat and one leaning, so the arch reads as
    # part of a rockfall rather than a manufactured gate.
    for side, scale, squash, dy in ((-1.0, 0.55, 0.70, -0.05), (1.0, 0.46, 0.78, 0.12)):
        b_rings, b_cols = 9, 12
        base = len(verts)
        bx = side * (ARCH_SPAN + 0.16)
        for i in range(b_rings):
            alpha = math.pi * i / (b_rings - 1)
            for j in range(b_cols):
                theta = math.tau * j / b_cols
                nx = math.sin(alpha) * math.cos(theta)
                ny = math.sin(alpha) * math.sin(theta)
                nz = math.cos(alpha)
                r = scale * (1.0 + (fbm(nx * 1.8 + side * 9.0, ny * 1.8, nz * 1.8) - 0.5) * 0.5)
                verts.append((bx + nx * r, dy + ny * r, max(nz * r * squash + scale * 0.42, GROUND)))
                mottle = 0.90 + 0.12 * vnoise(nx * 5.0 + side * 3.0, ny * 5.0, nz * 5.0)
                colours.append(tuple(c * mottle for c in STONE))
                uvs.append((0.5 + nx * 0.4, 0.5 + ny * 0.4))
        faces += grid_faces(b_rings, b_cols, base=base)

    obj = mesh_from("creature-den-mouth", verts, faces)
    recalc_normals(obj)
    shade_smooth(obj)
    paint(obj, colours)
    write_uvs(obj, uvs)
    return obj


def main():
    args = parse_args({"tag": "", "render": True})
    obj = build()
    tris = stats(obj, "creature-den-mouth")
    if tris > BUDGET:
        raise SystemExit("den mouth over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj], OUT)
    if args.get("render"):
        stem = "den" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
