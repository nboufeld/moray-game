"""Builds the Drowned Gardener — the Sunken Calamity's hero set-piece.

    blender --background --python tools/blender/calamity_drowned_gardener.py -- --tag <tag>

A toppled monumental statue of a terrace-builder, lying on the Long
Sorrow where the blast road left it: a robed, hooded figure face-up on a
broken plinth, one arm still raised toward a surface it never reached.
Faceless on purpose — three hundred years of water wears a face to a
shadow, and a shadow grieves better than a nose.

Authored the way the whole atelier builds: an authored lathe for the
robe, a squashed sphere with an elliptical face recess for the hood, a
bent tapered tube for the raised arm, a beveled box with a broken corner
for the plinth, and seeded-noise weathering over all of it. Every
displacement is position-seeded, so a rebuild is bit-identical.

Orientation: in Blender the figure lies along Y, head at −Y, face toward
+Z; with `export_yup` it arrives in glTF lying along Z, head toward +Z,
face up. Pivot at the plinth's underside centre — the region plants it
with one translate and a yaw. Vertex colours are authored sRGB (the
creature convention: these are colours, not multipliers).
"""

import bpy
import bmesh
import math
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "creatures"))
from creature_common import (  # noqa: E402
    clamp,
    decimate_to,
    export_glb,
    paint,
    parse_args,
    recalc_normals,
    render_views,
    reset_scene,
    shade_smooth,
    stats,
    write_uvs,
)

OUT = "public/assets/models/calamity-drowned-gardener.glb"
BUDGET = 3000

SEED = 0xC411


def new_bmesh():
    return bmesh.new()


def add_box(mesh, centre, size, bevel=0.0):
    """A box (optionally beveled) appended to `mesh`."""
    result = bmesh.ops.create_cube(mesh, size=1.0)
    for v in result["verts"]:
        v.co.x = centre[0] + v.co.x * size[0]
        v.co.y = centre[1] + v.co.y * size[1]
        v.co.z = centre[2] + v.co.z * size[2]
    if bevel > 0:
        edges = [e for e in mesh.edges]
        bmesh.ops.bevel(
            mesh,
            geom=edges,
            offset=bevel,
            segments=2,
            affect="EDGES",
        )


def add_lathe(mesh, profile, sides=14, transform=None):
    """A lathe around +Z from a [(radius, z)] profile, then `transform`
    applied to every vertex (a function co -> co)."""
    verts = []
    for radius, z in profile:
        ring = []
        for i in range(sides):
            a = (i / sides) * math.tau
            ring.append(mesh.verts.new((radius * math.cos(a), radius * math.sin(a), z)))
        verts.append(ring)
    for r in range(len(verts) - 1):
        for i in range(sides):
            a = verts[r][i]
            b = verts[r][(i + 1) % sides]
            c = verts[r + 1][(i + 1) % sides]
            d = verts[r + 1][i]
            mesh.faces.new((a, b, c, d))
    # Caps.
    bottom = mesh.verts.new((0, 0, profile[0][1]))
    top = mesh.verts.new((0, 0, profile[-1][1]))
    for i in range(sides):
        mesh.faces.new((bottom, verts[0][(i + 1) % sides], verts[0][i]))
        mesh.faces.new((top, verts[-1][i], verts[-1][(i + 1) % sides]))
    if transform:
        for ring in verts + [[bottom], [top]]:
            for v in ring:
                v.co = transform(v.co)


def add_sphere(mesh, centre, radius, squash=(1.0, 1.0, 1.0), segments=12, rings=9):
    result = bmesh.ops.create_uvsphere(
        mesh, u_segments=segments, v_segments=rings, radius=radius
    )
    for v in result["verts"]:
        v.co.x = centre[0] + v.co.x * squash[0]
        v.co.y = centre[1] + v.co.y * squash[1]
        v.co.z = centre[2] + v.co.z * squash[2]


def add_tube(mesh, points, radius_from, radius_to, sides=8):
    """A tapered tube through `points` (a curved arm)."""
    spine = []
    for i, p in enumerate(points):
        spine.append((p, radius_from + (radius_to - radius_from) * (i / (len(points) - 1))))
    rings = []
    for j, (p, radius) in enumerate(spine):
        # Frame: tangent from neighbours, side from cross with up.
        if j == 0:
            tangent = (Vector3(points[1]) - Vector3(points[0])).normalized()
        elif j == len(spine) - 1:
            tangent = (Vector3(points[-1]) - Vector3(points[-2])).normalized()
        else:
            tangent = (Vector3(points[j + 1]) - Vector3(points[j - 1])).normalized()
        side = tangent.cross(Vector3((0, 0, 1)))
        if side.length < 0.01:
            side = tangent.cross(Vector3((1, 0, 0)))
        side.normalize()
        lift = side.cross(tangent).normalized()
        ring = []
        for i in range(sides):
            a = (i / sides) * math.tau
            offset = side * (math.cos(a) * radius) + lift * (math.sin(a) * radius)
            ring.append(mesh.verts.new(Vector3(p) + offset))
        rings.append(ring)
    for r in range(len(rings) - 1):
        for i in range(sides):
            mesh.faces.new(
                (rings[r][i], rings[r][(i + 1) % sides], rings[r + 1][(i + 1) % sides], rings[r + 1][i])
            )


class Vector3(tuple):
    """A minimal 3-vector over tuples, just enough for the arm frames."""

    def __new__(cls, value=(0, 0, 0)):
        return super().__new__(cls, value)

    def __add__(self, other):
        return Vector3((self[0] + other[0], self[1] + other[1], self[2] + other[2]))

    def __sub__(self, other):
        return Vector3((self[0] - other[0], self[1] - other[1], self[2] - other[2]))

    def __mul__(self, k):
        return Vector3((self[0] * k, self[1] * k, self[2] * k))

    @property
    def x(self):
        return self[0]

    @property
    def y(self):
        return self[1]

    @property
    def z(self):
        return self[2]

    @property
    def length(self):
        return math.sqrt(sum(c * c for c in self))

    def normalized(self):
        span = max(1e-9, self.length)
        return Vector3((self[0] / span, self[1] / span, self[2] / span))

    def normalize(self):
        return self.normalized()

    def cross(self, other):
        return Vector3(
            (
                self[1] * other[2] - self[2] * other[1],
                self[2] * other[0] - self[0] * other[2],
                self[0] * other[1] - self[1] * other[0],
            )
        )


def build():
    reset_scene()
    rng = random.Random(SEED)
    mesh = new_bmesh()

    # ─── The plinth fragment ────────────────────────────────────────────
    add_box(mesh, (0, 0.55, 0.24), (1.7, 2.3, 0.42), bevel=0.05)
    # The broken corner: verts near one corner sag and scatter.
    corner = (0.85, 1.7, 0.45)
    for v in mesh.verts:
        d = (Vector3(v.co) - Vector3(corner)).length
        if d < 0.55:
            k = 1 - d / 0.55
            v.co.z -= k * (0.22 + 0.12 * rng.random())
            v.co.x += k * 0.1 * (rng.random() - 0.5)
            v.co.y += k * 0.1 * (rng.random() - 0.5)

    # ─── The robed figure, lying on its back along Y ────────────────────
    # The lathe is authored standing, then laid down: hem at the far end.
    profile = [
        (0.80, 0.0),
        (0.74, 0.3),
        (0.64, 0.7),
        (0.58, 1.1),
        (0.66, 1.5),
        (0.63, 1.75),
        (0.34, 1.95),
        (0.23, 2.06),
    ]

    def lay_down(co):
        # Standing axis +Z → lying along +Y, resting on the plinth.
        return Vector3((co.x, 0.62 - co.z * 0.98 + 1.35, 0.62 + co.y * 0.16))

    add_lathe(mesh, profile, sides=14, transform=lay_down)

    # Robe folds: vertical banding down the lathe, so the cloth reads.
    for v in mesh.verts:
        if 0.6 < v.co.y < 2.6:
            angle = math.atan2(v.co.x, v.co.z - 0.62)
            fold = 1 + 0.035 * math.sin(angle * 7 + 1.3) * (1 - (v.co.y - 0.6) / 2.4)
            v.co.x *= fold
            v.co.z = 0.62 + (v.co.z - 0.62) * fold

    # ─── The hooded head ────────────────────────────────────────────────
    add_sphere(mesh, (0, -0.88, 0.66), 0.36, squash=(0.95, 1.1, 0.9))
    # The face recess: a shallow elliptical shadow where the face was.
    face_centre = Vector3((0, -1.16, 0.66))
    for v in mesh.verts:
        local = Vector3((v.co.x / 0.22, (v.co.y - face_centre.y) / 0.26, (v.co.z - face_centre.z) / 0.24))
        if local.length < 1.0 and v.co.y < -0.9:
            depth = (1 - local.length) * 0.09
            v.co.y += depth
            v.co.z -= depth * 0.5

    # ─── The raised arm ─────────────────────────────────────────────────
    add_tube(
        mesh,
        [
            (0.34, -0.28, 0.72),
            (0.52, -0.05, 0.9),
            (0.48, 0.12, 1.22),
            (0.4, 0.16, 1.52),
        ],
        0.14,
        0.09,
    )
    add_sphere(mesh, (0.4, 0.16, 1.6), 0.13, squash=(0.9, 0.9, 1.15), segments=8, rings=6)

    # ─── The weathering ─────────────────────────────────────────────────
    # Seeded small noise everywhere, plus four blunt dents — three hundred
    # years of water wears every edge.
    for v in mesh.verts:
        p = v.co
        wobble = (
            math.sin(p.x * 5.1 + p.y * 3.7) * 0.5
            + math.sin(p.y * 7.3 + p.z * 4.9) * 0.3
            + math.sin(p.z * 9.1 + p.x * 6.3) * 0.2
        )
        v.co.x += wobble * 0.012
        v.co.y += wobble * 0.008
        v.co.z += wobble * 0.01
    for cx, cy, cz, reach, depth in [
        (0.5, 1.4, 0.9, 0.4, 0.05),
        (-0.3, 0.2, 0.8, 0.35, 0.04),
        (0.1, -0.9, 0.85, 0.3, 0.035),
        (-0.6, 2.0, 0.4, 0.45, 0.05),
    ]:
        for v in mesh.verts:
            d = (Vector3(v.co) - Vector3((cx, cy, cz))).length
            if d < reach:
                k = 1 - d / reach
                v.co.z -= depth * k * k

    obj = bpy.data.objects.new("drowned-gardener", bpy.data.meshes.new("drowned-gardener"))
    bpy.context.collection.objects.link(obj)
    mesh.to_mesh(obj.data)
    mesh.free()
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    recalc_normals(obj)
    shade_smooth(obj)
    decimate_to(obj, BUDGET)

    # ─── The paint (authored sRGB — these are colours) ──────────────────
    SAGE = (0.60, 0.585, 0.54)
    MOSS = (0.47, 0.57, 0.37)
    RECESS = (0.46, 0.44, 0.54)
    FRESH = (0.72, 0.70, 0.63)
    colours = []
    normals = obj.data.vertices
    for v in normals:
        co = v.co
        n = v.normal
        r, g, b = SAGE
        # Moss on every upward face, the terrace's own idiom.
        up = clamp((n.z - 0.25) / 0.6)
        r = r * (1 - up * 0.5) + MOSS[0] * up * 0.5
        g = g * (1 - up * 0.5) + MOSS[1] * up * 0.5
        b = b * (1 - up * 0.5) + MOSS[2] * up * 0.5
        # The face recess holds the violet shadow — red above green.
        face = Vector3((co.x / 0.24, (co.y + 1.16) / 0.28, (co.z - 0.64) / 0.26))
        if face.length < 1.1 and co.y < -0.85:
            k = 1 - face.length / 1.1
            r = r * (1 - k * 0.6) + RECESS[0] * k * 0.6
            g = g * (1 - k * 0.6) + RECESS[1] * k * 0.6
            b = b * (1 - k * 0.6) + RECESS[2] * k * 0.6
        # The underside sits in its own contact shade.
        down = clamp((-n.z - 0.3) / 0.6)
        r *= 1 - down * 0.22
        g *= 1 - down * 0.22
        b *= 1 - down * 0.18
        # The broken corner reads fresh: pale where the plinth sheared.
        chip = Vector3((co.x - 0.85, co.y - 1.7, co.z - 0.4))
        if chip.length < 0.5:
            k = 1 - chip.length / 0.5
            r = r * (1 - k * 0.5) + FRESH[0] * k * 0.5
            g = g * (1 - k * 0.5) + FRESH[1] * k * 0.5
            b = b * (1 - k * 0.5) + FRESH[2] * k * 0.5
        colours.append((r, g, b))
    paint(obj, colours)

    # Planar UVs at the rock wash's own tile spacing: the map is noise,
    # so a projection only has to get the grain's physical scale right.
    uvs = [(v.co.x * 0.45 + 0.5, v.co.y * 0.45 + v.co.z * 0.3 + 0.5) for v in obj.data.vertices]
    write_uvs(obj, uvs)

    return obj


def main():
    args = parse_args({"tag": "", "render": True})
    obj = build()
    tris = stats(obj, "calamity-drowned-gardener")
    if tris > BUDGET:
        raise SystemExit("drowned gardener over budget: %d > %d" % (tris, BUDGET))
    export_glb([obj], OUT)
    if args.get("render"):
        stem = "calamity-drowned-gardener" + (("-" + args["tag"]) if args["tag"] else "")
        render_views([obj], stem)


main()
