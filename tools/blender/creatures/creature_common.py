"""Shared rig for the Round L creature builds.

Every asset in this folder is made the same way: sample a parametric surface
into a quad grid, displace it, bake flat vertex colour zones, write UVs, bind
the articulated parts to named joints, render four views and export one GLB.

Four of those steps are contracts rather than conveniences, and each one is a
mistake that was made once.

**Axes.** Blender is Z-up and glTF is Y-up, and `export_yup=True` maps
`(x, y, z)` to `(x, z, -y)`. So the game's "+Z forward" is Blender's **-Y**,
and the game's "+Y dorsal" is Blender's **+Z**. Every creature here is
therefore authored facing -Y, which has the pleasant side effect that Blender's
own front view (which looks along +Y) is a portrait.

**Vertex colours are BYTE_COLOR written through `color_srgb`.** Blender stores
a byte colour attribute in sRGB and the glTF exporter converts it to linear on
the way out, so the number written here is the number a painter would pick and
the number that arrives in `COLOR_0` is its linear equivalent — 0.80 authored
lands at about 0.603. That is the right way round for an integrator who
multiplies `COLOR_0` into a linear albedo: the surface then *looks* like the
authored colour. (The coral pipeline next door uses `FLOAT_COLOR` and a
`perceived()` helper because its colours are near-neutral *multipliers* against
a per-instance tint, not colours. Different job, different attribute.)

**A vertex group only survives the trip if it is a joint.** glTF has no notion
of a named vertex group; it has skins. So `bind_groups` builds a real armature
whose bones carry the group names, weights every remaining vertex to a `root`
bone so `WEIGHTS_0` sums to 1 (a vertex weighted to nothing is drawn at the
origin), and the exporter writes the lot as a skin. The integrator gets nodes
named `jaw`, `flipperFL` and so on, and can equally ignore the skin and use the
baked rest pose.

**A bone's local axes are not the model's.** A bone points down its own +Y, so
every articulated joint here is laid head-to-tail along the axis it turns
about; rotating the joint is then a rotation about the *bone's local Y*. The
per-asset manifest states the axis in model space as well, measured off the
exported file rather than asserted, because that is the only claim an
integrator can check.
"""

import bpy
import bmesh
import math
import os
import sys

from mathutils import Vector

#: Repository root, so a script can be run from anywhere.
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))


# ---------------------------------------------------------------------------
# scene


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def argv_after_dashes():
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args(defaults):
    """A flat `--key value` parser; `--flag` with no value is a boolean true."""
    out = dict(defaults)
    tokens = argv_after_dashes()
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if not token.startswith("--"):
            i += 1
            continue
        key = token[2:]
        if i + 1 < len(tokens) and not tokens[i + 1].startswith("--"):
            out[key] = tokens[i + 1]
            i += 2
        else:
            out[key] = True
            i += 1
    return out


# ---------------------------------------------------------------------------
# maths


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def smoothstep(edge0, edge1, x):
    t = clamp((x - edge0) / (edge1 - edge0)) if edge1 != edge0 else (0.0 if x < edge0 else 1.0)
    return t * t * (3.0 - 2.0 * t)


def mix(a, b, t):
    return a + (b - a) * t


def mix3(a, b, t):
    return tuple(mix(a[i], b[i], t) for i in range(3))


def gauss(x, centre, width):
    d = (x - centre) / width
    return math.exp(-d * d)


def catmull(points, x):
    """Catmull-Rom through `points`, a sorted list of `(x, *values)` tuples.

    Used for every body profile here: a handful of authored stations, read as a
    smooth curve. Straight linear interpolation puts a crease in the silhouette
    at every control point, and on a smooth-shaded round animal a crease is the
    one thing the eye finds instantly.
    """
    n = len(points)
    if x <= points[0][0]:
        return tuple(points[0][1:])
    if x >= points[-1][0]:
        return tuple(points[-1][1:])
    i = 0
    while i < n - 2 and x > points[i + 1][0]:
        i += 1
    p0 = points[max(0, i - 1)]
    p1 = points[i]
    p2 = points[i + 1]
    p3 = points[min(n - 1, i + 2)]
    span = p2[0] - p1[0]
    t = (x - p1[0]) / span if span else 0.0
    t2, t3 = t * t, t * t * t
    out = []
    for c in range(1, len(p1)):
        a0, a1, a2, a3 = p0[c], p1[c], p2[c], p3[c]
        out.append(
            0.5
            * (
                (2 * a1)
                + (-a0 + a2) * t
                + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2
                + (-a0 + 3 * a1 - 3 * a2 + a3) * t3
            )
        )
    return tuple(out)


def distribute(count, density, low=0.0, high=1.0, resolution=512):
    """`count` samples over [low, high], clustered where `density` is large.

    A uniform grid spends its resolution evenly, and on these creatures the
    resolution is wanted in three or four small places — an eye socket, a mouth
    corner, a shell rim — while the tri budget is hard. Inverting the density's
    CDF puts the rings where the sculpture is, at no cost anywhere else.
    """
    xs = [low + (high - low) * i / (resolution - 1) for i in range(resolution)]
    ds = [max(1e-6, density(x)) for x in xs]
    cdf = [0.0]
    for i in range(1, resolution):
        cdf.append(cdf[-1] + 0.5 * (ds[i] + ds[i - 1]) * (xs[i] - xs[i - 1]))
    total = cdf[-1]
    cdf = [c / total for c in cdf]

    out = []
    for k in range(count):
        target = k / (count - 1) if count > 1 else 0.0
        j = 0
        while j < resolution - 2 and cdf[j + 1] < target:
            j += 1
        gap = cdf[j + 1] - cdf[j]
        t = (target - cdf[j]) / gap if gap > 1e-12 else 0.0
        out.append(mix(xs[j], xs[j + 1], t))
    out[0], out[-1] = low, high
    return out


# ---------------------------------------------------------------------------
# mesh construction


def mesh_from(name, verts, faces):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    return obj


def grid_faces(rings, cols, wrap=True, base=0):
    """Quads for a (rings x cols) lattice, wound outward for a tube facing -Y.

    Winding is checked rather than trusted: `recalc_normals` runs afterwards, so
    this only has to be consistent, not correct.
    """
    faces = []
    last = cols if wrap else cols - 1
    for i in range(rings - 1):
        for j in range(last):
            a = base + i * cols + j
            b = base + i * cols + (j + 1) % cols
            c = base + (i + 1) * cols + (j + 1) % cols
            d = base + (i + 1) * cols + j
            faces.append((a, b, c, d))
    return faces


def fan_faces(ring_indices, centre_index):
    return [
        (centre_index, ring_indices[j], ring_indices[(j + 1) % len(ring_indices)])
        for j in range(len(ring_indices))
    ]


def recalc_normals(obj):
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(mesh, faces=mesh.faces)
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def shade_smooth(obj):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.data.update()


def decimate_to(obj, budget):
    """Collapse-decimates only if the mesh is over `budget` triangles.

    The grids here are authored to land under their budget, so this is a
    backstop: it fires when a profile change adds rings, and it says so.
    """
    obj.data.calc_loop_triangles()
    tris = len(obj.data.loop_triangles)
    if tris <= budget:
        return tris
    modifier = obj.modifiers.new("decimate", "DECIMATE")
    modifier.ratio = budget / tris * 0.98
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.calc_loop_triangles()
    after = len(obj.data.loop_triangles)
    print("DECIMATED %d -> %d tris (budget %d)" % (tris, after, budget))
    return after


# ---------------------------------------------------------------------------
# attributes


def paint(obj, colours):
    """Writes `colours` (a list of sRGB (r, g, b) per vertex) as BYTE_COLOR.

    See the module header for why byte-and-sRGB rather than float-and-linear.
    """
    mesh = obj.data
    while mesh.color_attributes:
        mesh.color_attributes.remove(mesh.color_attributes[0])
    layer = mesh.color_attributes.new("Color", "BYTE_COLOR", "POINT")
    for i, rgb in enumerate(colours):
        value = (clamp(rgb[0]), clamp(rgb[1]), clamp(rgb[2]), 1.0)
        try:
            layer.data[i].color_srgb = value
        except AttributeError:  # pragma: no cover - older API
            layer.data[i].color = value
    mesh.update()


def write_uvs(obj, uvs):
    """Writes a per-*vertex* UV list onto the loops, in glTF convention.

    Per-vertex rather than per-loop because none of these unwraps has a seam: a
    mirrored `u` turns around at the belly and at the spine instead of jumping,
    and the oval and planar projections used elsewhere are single-valued. A
    projection that did wrap would need the corner-disagreement fix
    `coral_common.project_uvs` carries.

    The `v` handed in is the `v` that arrives in the exported TEXCOORD_0.
    Blender's UV origin is bottom-left and glTF's is top-left, so the exporter
    writes `1 - v` — measured off a real export, where a band authored at
    [0, 0.12] arrived at [0.88, 1.0]. Every UV contract in this folder is
    stated against the game's loader (`flipY: false`, `v = 0` at the top row
    of the painting), so the flip is compensated here, once, rather than in
    five scripts.
    """
    mesh = obj.data
    while mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[0])
    layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        u, v = uvs[loop.vertex_index]
        layer.data[loop.index].uv = (u, 1.0 - v)
    mesh.update()


def bind_groups(obj, joints, root_name="root"):
    """Builds vertex groups, an armature carrying their names, and the skin.

    `joints` is a list of `(name, head, tail, weights)`, where `weights` maps a
    vertex index to its weight in [0, 1]. Everything left over goes on
    `root_name`, whose bone sits at the origin — glTF's `WEIGHTS_0` has to sum
    to 1 per vertex, and a vertex weighted to nothing is not "unrigged", it is
    collapsed onto the skeleton's origin.

    Returns the armature object, which has to be exported alongside the mesh.
    """
    total = [0.0] * len(obj.data.vertices)
    for _, _, _, weights in joints:
        for index, weight in weights.items():
            total[index] += weight
    if any(t > 1.0001 for t in total):
        raise ValueError("joint weights exceed 1 on %d vertices" % sum(1 for t in total if t > 1.0001))

    armature_data = bpy.data.armatures.new(obj.name + "-rig")
    armature = bpy.data.objects.new(obj.name + "-rig", armature_data)
    bpy.context.collection.objects.link(armature)

    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    root = armature_data.edit_bones.new(root_name)
    root.head = (0.0, 0.0, 0.0)
    root.tail = (0.0, 0.0, 0.12)
    for name, head, tail, _ in joints:
        bone = armature_data.edit_bones.new(name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        bone.parent = root
        bone.use_connect = False
    bpy.ops.object.mode_set(mode="OBJECT")

    root_group = obj.vertex_groups.new(name=root_name)
    for index, carried in enumerate(total):
        root_group.add([index], 1.0 - carried, "REPLACE")
    for name, _, _, weights in joints:
        group = obj.vertex_groups.new(name=name)
        for index, weight in weights.items():
            group.add([index], weight, "REPLACE")

    obj.parent = armature
    modifier = obj.modifiers.new("armature", "ARMATURE")
    modifier.object = armature
    modifier.use_vertex_groups = True
    return armature


# ---------------------------------------------------------------------------
# export and stats


def export_glb(objects, path):
    absolute = path if os.path.isabs(path) else os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(absolute), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=absolute,
        export_format="GLB",
        export_yup=True,
        use_selection=True,
        # False, not True: "apply modifiers" would apply the armature and take
        # the skin with it. Every other modifier in these builds is applied by
        # hand before this point, so there is nothing left for it to do.
        export_apply=False,
        export_normals=True,
        export_texcoords=True,
        export_skins=True,
        export_animations=False,
        # No material travels with these files. Every lit surface in the game is
        # built by `createToonMaterial` against one shared ramp, and a material
        # arriving from disk would be the only thing in the reef not reading it.
        export_materials="NONE",
    )
    print("EXPORTED", absolute)
    return absolute


def stats(obj, label=""):
    mesh = obj.data
    mesh.calc_loop_triangles()
    tris = len(mesh.loop_triangles)
    xs = [v.co.x for v in mesh.vertices]
    ys = [v.co.y for v in mesh.vertices]
    zs = [v.co.z for v in mesh.vertices]
    print(
        "STATS %s verts=%d tris=%d size=(%.4f, %.4f, %.4f) "
        "x=[%.4f, %.4f] y=[%.4f, %.4f] z=[%.4f, %.4f]"
        % (
            label or obj.name,
            len(mesh.vertices),
            tris,
            max(xs) - min(xs),
            max(ys) - min(ys),
            max(zs) - min(zs),
            min(xs),
            max(xs),
            min(ys),
            max(ys),
            min(zs),
            max(zs),
        )
    )
    if mesh.uv_layers:
        us = [d.uv[0] for d in mesh.uv_layers[0].data]
        vs = [d.uv[1] for d in mesh.uv_layers[0].data]
        print("STATS %s uv u=[%.4f, %.4f] v=[%.4f, %.4f]" % (label or obj.name, min(us), max(us), min(vs), max(vs)))
    if obj.vertex_groups:
        print("STATS %s groups=%s" % (label or obj.name, ", ".join(g.name for g in obj.vertex_groups)))
    return tris


# ---------------------------------------------------------------------------
# preview renders


#: The four canonical atelier views. `front` looks the animal in the face,
#: because everything here is authored facing -Y.
VIEWS = {
    "front": (0.0, -1.0, 0.0),
    "side": (1.0, 0.0, 0.06),
    "top": (0.0, -0.001, 1.0),
    "quarter": (0.72, -0.78, 0.42),
}
#: Only the three-quarter is a lens. The orthographic three read proportion
#: without perspective arguing about it, which is what a proportion check is.
PERSPECTIVE_VIEWS = {"quarter"}


def _preview_material(texture_path=None):
    """Vertex-colour preview, or — when a texture path is given — the actual
    painting sampled through the mesh's own UVs. The textured mode exists to
    *verify a UV contract by looking at it*; it never exports (materials are
    stripped), and the game applies the map itself."""
    material = bpy.data.materials.new("atelier-preview")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes["Principled BSDF"]
    principled.inputs["Roughness"].default_value = 0.82
    if "Specular IOR Level" in principled.inputs:
        principled.inputs["Specular IOR Level"].default_value = 0.22
    if texture_path:
        image_node = nodes.new("ShaderNodeTexImage")
        absolute = texture_path if os.path.isabs(texture_path) else os.path.join(ROOT, texture_path)
        image_node.image = bpy.data.images.load(absolute)
        links.new(image_node.outputs["Color"], principled.inputs["Base Color"])
    else:
        attribute = nodes.new("ShaderNodeVertexColor")
        attribute.layer_name = "Color"
        links.new(attribute.outputs["Color"], principled.inputs["Base Color"])
    return material


def _three_point(centre, size):
    """Key, fill and rim, sized to the subject.

    Soft and broad on purpose: this is a sculpture check, and a hard key hides
    a bad silhouette behind a good highlight.
    """
    rig = []
    for name, offset, energy, radius in (
        ("key", (-1.5, -1.9, 1.7), 1.0, 1.6),
        ("fill", (1.9, -1.1, 0.15), 0.34, 2.4),
        ("rim", (0.35, 1.9, 1.15), 0.62, 1.5),
    ):
        data = bpy.data.lights.new("atelier-" + name, type="AREA")
        data.shape = "DISK"
        data.size = radius * size
        # Inverse square, so the energy has to track the subject's size or a
        # 5 cm shrimp and a 1.4 m turtle are lit a hundred times apart.
        # 420, not the 900 first tried: these creatures are painted near
        # white, and at 900 everything above ~0.8 sRGB clipped to flat white
        # — the moray's whole value structure (gradient, socket, lining)
        # measured invisible in its own preview.
        data.energy = energy * 420.0 * size * size
        light = bpy.data.objects.new("atelier-" + name, data)
        light.location = Vector(centre) + Vector(offset) * size * 2.0
        direction = Vector(centre) - light.location
        light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(light)
        rig.append(light)
    return rig


def render_views(objects, stem, out_dir="visual-qa/atelier", size=512, margin=1.18, views=None, texture_path=None):
    """Renders the canonical four and returns their paths.

    EEVEE if the build can start it, Workbench otherwise — the fallback is not
    hypothetical on a headless mac, where the GPU backend is exactly what a
    background Blender is least sure of.
    """
    scene = bpy.context.scene
    material = _preview_material(texture_path)
    meshes = [o for o in objects if o.type == "MESH"]
    for obj in meshes:
        obj.data.materials.clear()
        obj.data.materials.append(material)

    corners = []
    for obj in meshes:
        for corner in obj.bound_box:
            corners.append(obj.matrix_world @ Vector(corner))
    low = Vector((min(c[i] for c in corners) for i in range(3)))
    high = Vector((max(c[i] for c in corners) for i in range(3)))
    centre = (low + high) * 0.5
    extent = max((high - low)[i] for i in range(3))

    _three_point(centre, extent)

    world = bpy.data.worlds.new("atelier-world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.44, 0.50, 0.53, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.65
    scene.world = world

    camera_data = bpy.data.cameras.new("atelier-camera")
    camera = bpy.data.objects.new("atelier-camera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera

    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 24
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"

    absolute_dir = out_dir if os.path.isabs(out_dir) else os.path.join(ROOT, out_dir)
    os.makedirs(absolute_dir, exist_ok=True)

    written = []
    for name, direction in (views or VIEWS).items():
        axis = Vector(direction).normalized()
        if name in PERSPECTIVE_VIEWS:
            camera_data.type = "PERSP"
            camera_data.lens = 62.0
            distance = extent * 3.1
        else:
            camera_data.type = "ORTHO"
            camera_data.ortho_scale = extent * margin
            distance = extent * 3.0
        camera.location = centre + axis * distance
        camera.rotation_euler = (camera.location - centre).to_track_quat("Z", "Y").to_euler()
        path = os.path.join(absolute_dir, "%s-%s.png" % (stem, name))
        scene.render.filepath = path
        try:
            bpy.ops.render.render(write_still=True)
        except RuntimeError as error:
            print("RENDER fell back to Workbench:", error)
            scene.render.engine = "BLENDER_WORKBENCH"
            scene.display.shading.light = "STUDIO"
            scene.display.shading.color_type = "VERTEX"
            bpy.ops.render.render(write_still=True)
        written.append(path)
        print("RENDERED", path)
    return written
