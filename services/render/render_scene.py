"""
Blender background script: import GLB, rebuild camera/lights/ground/background/IBL, Cycles render.

Invoked as:
  blender --background --python render_scene.py -- --glb scene.glb --params params.json --out out.png
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path


def _parse_args(argv):
    if '--' in argv:
        argv = argv[argv.index('--') + 1 :]
    parser = argparse.ArgumentParser()
    parser.add_argument('--glb', required=True)
    parser.add_argument('--params', required=True)
    parser.add_argument('--out', required=True)
    return parser.parse_args(argv)


def sun_direction(phi_deg: float, theta_deg: float, radius: float = 8.0):
    phi = math.radians(phi_deg)
    theta = math.radians(theta_deg)
    x = radius * math.sin(phi) * math.cos(theta)
    y = radius * math.cos(phi)
    z = radius * math.sin(phi) * math.sin(theta)
    return (x, y, z)


def hex_to_rgb(hex_color: str):
    h = (hex_color or '#F5F6F8').lstrip('#')
    if len(h) != 6:
        return (0.96, 0.965, 0.97)
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))


def main():
    args = _parse_args(sys.argv)
    params = json.loads(Path(args.params).read_text(encoding='utf-8'))

    import bpy
    from mathutils import Vector

    # Reset scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = int(params.get('samples') or 64)
    scene.cycles.use_denoising = True
    scene.render.resolution_x = int(params.get('width') or 2048)
    scene.render.resolution_y = int(params.get('height') or 2048)
    scene.render.resolution_percentage = 100

    fmt = str(params.get('format') or 'png').lower()
    out_path = Path(args.out)
    if fmt in ('jpg', 'jpeg'):
        scene.render.image_settings.file_format = 'JPEG'
        scene.render.image_settings.quality = 92
        if out_path.suffix.lower() not in ('.jpg', '.jpeg'):
            out_path = out_path.with_suffix('.jpg')
    else:
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_mode = 'RGB'
    scene.render.filepath = str(out_path)

    # World / background / HDR
    world = bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    out = nodes.new('ShaderNodeOutputWorld')
    bg_node = nodes.new('ShaderNodeBackground')

    hdr_path = params.get('hdr_path')
    env = params.get('environment') or {}
    bg = params.get('background') or {}
    use_hdr_bg = bool(params.get('hdr_use_as_background') or env.get('useAsBackground'))

    if hdr_path and Path(hdr_path).is_file():
        tex = nodes.new('ShaderNodeTexEnvironment')
        tex.image = bpy.data.images.load(str(hdr_path))
        mapping = nodes.new('ShaderNodeMapping')
        texcoord = nodes.new('ShaderNodeTexCoord')
        links.new(texcoord.outputs['Generated'], mapping.inputs['Vector'])
        links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
        rotation = float(params.get('hdr_rotation') or env.get('rotation') or 0)
        mapping.inputs['Rotation'].default_value[2] = math.radians(rotation)
        links.new(tex.outputs['Color'], bg_node.inputs['Color'])
        strength = float(params.get('hdr_intensity') or env.get('intensity') or 1.0)
        bg_node.inputs['Strength'].default_value = strength
        if not use_hdr_bg:
            # Keep IBL for lighting but solid/gradient for camera background via film transparent + compositor is heavy;
            # approximate by dimming world for non-background use and add a fill plane — keep strength for lighting.
            pass
    elif bg.get('type') == 'gradient':
        # Approximate gradient with mix of two colors via light path (camera ray)
        top = hex_to_rgb((bg.get('gradient') or {}).get('top') or '#EEF1F5')
        bottom = hex_to_rgb((bg.get('gradient') or {}).get('bottom') or '#D8DEE8')
        mix = nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MIX'
        mix.inputs['Fac'].default_value = 0.45
        mix.inputs['Color1'].default_value = (*top, 1.0)
        mix.inputs['Color2'].default_value = (*bottom, 1.0)
        links.new(mix.outputs['Color'], bg_node.inputs['Color'])
        bg_node.inputs['Strength'].default_value = 1.0
    else:
        color = hex_to_rgb(bg.get('color') or '#F5F6F8')
        bg_node.inputs['Color'].default_value = (*color, 1.0)
        bg_node.inputs['Strength'].default_value = 1.0

    links.new(bg_node.outputs['Background'], out.inputs['Surface'])

    # Import GLB and scale the whole hierarchy once.
    # Do NOT scale individual MESH objects: parent node translations (mm) must
    # stay in the same unit space as the camera (also multiplied by unit_scale).
    bpy.ops.import_scene.gltf(filepath=str(Path(args.glb)))
    imported = [obj for obj in bpy.context.selected_objects]
    if imported:
        scale = float(params.get('unit_scale') or 0.001)
        imported_set = set(imported)
        roots = [obj for obj in imported if obj.parent not in imported_set]
        root = bpy.data.objects.new('ImportRoot', None)
        scene.collection.objects.link(root)
        for obj in roots:
            # Keep world matrix while re-parenting under ImportRoot.
            matrix_world = obj.matrix_world.copy()
            obj.parent = root
            obj.matrix_world = matrix_world
        root.scale = (scale, scale, scale)
        for obj in imported:
            if obj.type == 'MESH':
                obj.cycles.use_adaptive_subdivision = False

    # Ground shadow catcher
    ground_cfg = params.get('ground') or {}
    shadow_intensity = float(ground_cfg.get('shadowIntensity') if ground_cfg.get('shadowIntensity') is not None else 0.45)
    if ground_cfg.get('visible', True):
        bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
        ground = bpy.context.active_object
        ground.name = 'Ground'
        ground.is_shadow_catcher = True
        # Approximate shadow intensity via object visibility / alpha
        ground.color = (1.0, 1.0, 1.0, max(0.05, min(1.0, shadow_intensity)))
        if hasattr(ground, 'visible_shadow'):
            ground.visible_shadow = True

    # Lights
    light = params.get('light') or {}
    phi = float(light.get('sunPhi') or 45)
    theta = float(light.get('sunTheta') or 35)
    sun_intensity = float(light.get('sunIntensity') or 1.6)
    env_intensity = float(light.get('envIntensity') or 0.85)
    sx, sy, sz = sun_direction(phi, theta, radius=12.0)
    sun_data = bpy.data.lights.new(name='Sun', type='SUN')
    sun_data.energy = sun_intensity * 3.0
    sun_obj = bpy.data.objects.new(name='Sun', object_data=sun_data)
    scene.collection.objects.link(sun_obj)
    sun_obj.location = (sx, sy, sz)
    direction = Vector((0.0, 0.0, 0.0)) - Vector((sx, sy, sz))
    sun_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    area_data = bpy.data.lights.new(name='Fill', type='AREA')
    area_data.energy = env_intensity * 40.0
    area_data.size = 6.0
    area_obj = bpy.data.objects.new(name='Fill', object_data=area_data)
    scene.collection.objects.link(area_obj)
    area_obj.location = (-6.0, -4.0, 8.0)

    # Camera
    cam_cfg = params.get('camera') or {}
    pos = cam_cfg.get('position') or {'x': 420, 'y': 320, 'z': 420}
    target = cam_cfg.get('target') or {'x': 0, 'y': 40, 'z': 0}
    fov = float(cam_cfg.get('fov') or 38)
    unit = float(params.get('unit_scale') or 0.001)

    def map_point(p):
        return (float(p['x']) * unit, -float(p['z']) * unit, float(p['y']) * unit)

    cam_data = bpy.data.cameras.new('Camera')
    cam_data.lens_unit = 'FOV'
    cam_data.angle = math.radians(fov)
    cam_data.clip_start = 0.01
    cam_data.clip_end = 1000.0
    cam_obj = bpy.data.objects.new('Camera', cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    cam_loc = map_point(pos)
    tgt_loc = map_point(target)
    cam_obj.location = cam_loc
    direction = Vector(tgt_loc) - Vector(cam_loc)
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    bpy.ops.render.render(write_still=True)
    print(f'[render_scene] wrote {out_path}')


if __name__ == '__main__':
    main()
