"""Shared rig for the hero-coral build scripts.

Every hero piece in `src/world/CoralShapes.ts` is built the same way: grow or
displace a mesh, normalise it into the unit footprint the game instances it in,
bake a vertex-colour *multiplier*, export one GLB.

Two of those steps are contracts rather than conveniences.

**The unit footprint.** A GLB arrives after the field is already standing, and
`CoralField` swaps it onto an `InstancedMesh` whose matrices were written for
the procedural fallback. So both have to agree on what "one unit" means or the
whole garden jumps when the model lands: every piece is exported one metre tall,
with its foot on y = 0 and its mass centred on the y axis, and the instance
matrix carries the real size.

**The vertex colour is a multiplier, never a colour.** The species' hue is a
per-instance `InstancedMesh` colour, and the garden's variety lives in that
spread. A GLB that brings its own terracotta multiplies against it and the
garden goes to mud — the same mistake `levelToBlade` exists to undo for the
painted grass strip. So these bake near-neutral values around 1.0: tips a little
pale, furrows a little deep, and nothing else.

`perceived()` is where the one arithmetic trap lives. COLOR_0 multiplies
*linear* light, and the sRGB transfer flattens a proportional change on the way
out, so a 0.7 written here does not read as 0.7 of the ridge beside it — it
reads as about 0.85. Author what the eye should see and let this convert it.
"""

import bpy
import math

#: Blender's up is +Z and glTF's is +Y; every export below converts.
UP = 2


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def perceived(value):
    """A linear multiplier that *reads* as `value` of the surface beside it.

    See the module header: the frame is encoded through an sRGB-like transfer,
    so proportional changes in linear light land at roughly their 1/2.2 power.
    """
    return value ** 2.2


def finalise(obj):
    """Applies the modifier stack and smooths the result."""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.shade_smooth()
    return obj


def normalise(obj, height=1.0):
    """Scales the mesh to `height` tall, foot on z = 0, centred on the z axis.

    Applied to the vertices rather than left on the object transform, because
    only the mesh survives the GLB round trip into an `InstancedMesh`.
    """
    mesh = obj.data
    zs = [v.co[UP] for v in mesh.vertices]
    low, high = min(zs), max(zs)
    scale = height / max(1e-6, high - low)

    xs = [v.co[0] for v in mesh.vertices]
    ys = [v.co[1] for v in mesh.vertices]
    cx = (min(xs) + max(xs)) * 0.5
    cy = (min(ys) + max(ys)) * 0.5

    for v in mesh.vertices:
        v.co[0] = (v.co[0] - cx) * scale
        v.co[1] = (v.co[1] - cy) * scale
        v.co[2] = (v.co[2] - low) * scale
    mesh.update()


def paint(obj, sample):
    """Bakes a per-vertex multiplier from `sample(x, y, height01) -> (r, g, b)`.

    `FLOAT_COLOR`, not `BYTE_COLOR`: Blender stores byte colour attributes in
    sRGB and converts them on the way out, which puts a curve between what is
    written here and what the shader multiplies by. A float attribute is already
    the scene-referred value the exporter writes.
    """
    mesh = obj.data
    zs = [v.co[UP] for v in mesh.vertices]
    low, high = min(zs), max(zs)
    span = max(1e-6, high - low)

    layer = mesh.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(mesh.vertices):
        r, g, b = sample(v.co[0], v.co[1], (v.co[UP] - low) / span)
        layer.data[i].color = (r, g, b, 1.0)


def project_uvs(obj, repeat_u=1.0, repeat_v=1.0, mode="cylinder"):
    """Wraps a UV set around the piece, seam-corrected.

    The game textures these with a fine grain map and its derived normal, so
    they need coordinates — and neither the Skin modifier nor a bmesh rebuild
    leaves a usable layer behind, whatever `export_texcoords` is set to.
    Projected rather than unwrapped because the map is *noise*: what a
    projection has to get right is the physical scale of the grain, and both a
    seam and a little distortion are invisible in noise where an unwrap's cost
    in build complexity is not.

    `mode` picks which stretch to accept. `cylinder` runs `v` up the piece,
    which is right for anything that stands — and wrong for a dome, where the
    whole crown falls into the last sliver of `v` and the grain smears into
    vertical streaks exactly where a swimming diver looks straight down at it.
    `sphere` runs `v` out from the crown by polar angle instead and pays for it
    with a pinch at the pole, over a few percent of the area, in noise.

    The seam correction is the part that is not optional. `atan2` jumps from 1
    back to 0 along one meridian, and a face straddling it would otherwise run
    the whole map backwards across itself — one triangle wide, and loud,
    because it compresses the entire image into a few centimetres. Faces whose
    corners disagree by more than half a turn have their low corners pushed up
    a turn instead, which has no jump anywhere.
    """
    mesh = obj.data
    # Whatever the primitive shipped with, gone: an icosphere brings its own
    # layer, which survives the bmesh rebuild and exports as a second
    # `TEXCOORD` the game uploads and never samples.
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    layer = mesh.uv_layers.new(name="UVMap")

    zs = [v.co[UP] for v in mesh.vertices]
    low, high = min(zs), max(zs)
    span = max(1e-6, high - low)

    def coordinate_v(co):
        if mode == "sphere":
            # Polar angle from the crown, in half-turns, so a hemisphere's rim
            # lands at 1 and the very top at 0.
            return math.acos(clamp(co[UP] / max(1e-6, length(co)), -1.0, 1.0)) / (math.pi * 0.5)
        return (co[UP] - low) / span

    for polygon in mesh.polygons:
        corners = [mesh.vertices[mesh.loops[i].vertex_index].co for i in polygon.loop_indices]
        raw = [math.atan2(co[1], co[0]) / math.tau + 0.5 for co in corners]
        if max(raw) - min(raw) > 0.5:
            raw = [u + 1.0 if u < 0.5 else u for u in raw]

        for u, co, loop_index in zip(raw, corners, polygon.loop_indices):
            layer.data[loop_index].uv = (u * repeat_u, coordinate_v(co) * repeat_v)


def report(obj, path):
    mesh = obj.data
    mesh.calc_loop_triangles()
    tris = len(mesh.loop_triangles)
    print("BUILT %s verts=%d tris=%d" % (path, len(mesh.vertices), tris))
    return tris


def export(obj, path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        use_selection=True,
        export_apply=True,
        export_normals=True,
        # The UVs are the ones `project_uvs` wrote; the maps they address are
        # the game's own procedural corallite and rib skins, built in
        # `CoralShapes`. No material travels with the file — every lit surface
        # in this project is built by `createToonMaterial`, and one arriving
        # from disk would be the only thing in the reef not reading the shared
        # ramp.
        export_texcoords=True,
        export_materials="NONE",
    )


def out_path(default):
    import sys

    return sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else default


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def smoothstep(edge0, edge1, x):
    t = clamp((x - edge0) / (edge1 - edge0))
    return t * t * (3.0 - 2.0 * t)


def length(vector):
    return math.sqrt(sum(c * c for c in vector))
