from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from django.utils import timezone

from apps.catalog.models import Product, ProductVariant, TemplateApproval, TemplateDefinition, TemplateVersion

# Limits aligned with src/templates/*.js (geometry server OUT_OF_RANGE uses same shape).
PARAMETRIC = [
    (
        'mailer-parametric-demo',
        '翻盖邮寄盒（参数化）',
        'mailer',
        {'lengthMm': 300, 'widthMm': 200, 'heightMm': 50},
        {'length': [80, 1200], 'width': [70, 1200], 'height': [20, 600]},
    ),
    (
        'fefco-0201',
        'FEFCO 0201 开槽纸箱',
        'carton',
        {'lengthMm': 400, 'widthMm': 300, 'heightMm': 200},
        {'length': [80, 1500], 'width': [60, 1200], 'height': [40, 1200]},
    ),
    (
        'fefco-0427',
        'FEFCO 0427',
        'carton',
        {'lengthMm': 250, 'widthMm': 180, 'heightMm': 60},
        {'length': [80, 1200], 'width': [60, 1000], 'height': [20, 500]},
    ),
    (
        'tuck-end-straight',
        '直插舌盒',
        'tuck',
        {'lengthMm': 80, 'widthMm': 50, 'heightMm': 150},
        {'length': [30, 600], 'width': [20, 400], 'height': [30, 800]},
    ),
    (
        'rea-carton-0201',
        'REA Carton 0201',
        'carton',
        {'lengthMm': 430, 'widthMm': 270, 'heightMm': 210},
        {'length': [80, 1200], 'width': [60, 1000], 'height': [40, 1000]},
    ),
    (
        'lid-base',
        '天地盖',
        'rigid',
        {'lengthMm': 300, 'widthMm': 200, 'heightMm': 60},
        {'length': [60, 1500], 'width': [40, 1200], 'height': [15, 600]},
    ),
    (
        'sleeve',
        '袖套',
        'sleeve',
        {'lengthMm': 200, 'widthMm': 40, 'heightMm': 0},
        {'length': [40, 1200], 'width': [30, 800], 'height': [15, 400]},
    ),
]

SHIPPING_SAMPLES = [
    ('import-102040', '插口式产品盒', '102040', 300, 150, 181.5),
    ('import-200010', '运输箱 200010', '200010', 430, 270, 210),
]


class Command(BaseCommand):
    help = 'Seed BOXCRAFT catalog templates and published products'

    @transaction.atomic
    def handle(self, *args, **options):
        for key, title, category, defaults, limits in PARAMETRIC:
            tpl, _ = TemplateDefinition.objects.get_or_create(
                template_key=key,
                defaults={
                    'title': title,
                    'geometry_mode': TemplateDefinition.GeometryMode.PARAMETRIC,
                },
            )
            ver, _ = TemplateVersion.objects.get_or_create(
                template=tpl,
                version='1',
                defaults={
                    'engine_version': 'boxcraft.knife.v3',
                    'param_schema': {'defaults': defaults},
                    'limits': limits,
                    'capabilities': {'editable_size': True},
                    'is_current': True,
                },
            )
            can_mfg = key == 'mailer-parametric-demo'
            caps = {'editable_size': True}
            if can_mfg:
                caps['canExportManufacturing'] = True
            ver.engine_version = 'boxcraft.knife.v3'
            ver.param_schema = {'defaults': defaults}
            ver.limits = limits
            ver.capabilities = caps
            ver.is_current = True
            ver.save(
                update_fields=['engine_version', 'param_schema', 'limits', 'capabilities', 'is_current']
            )
            TemplateVersion.objects.filter(template=tpl).exclude(pk=ver.pk).update(is_current=False)
            if can_mfg:
                approval = TemplateApproval.objects.filter(template_version=ver, approved=True).first()
                if not approval:
                    approval = TemplateApproval(template_version=ver)
                approval.material_ids = ['kraft']
                approval.thickness_min_mm = '0.500'
                approval.thickness_max_mm = '3.000'
                approval.notes = 'P7.2 seed manufacturing gate for mailer-parametric-demo'
                approval.approved = True
                approval.approved_at = approval.approved_at or timezone.now()
                approval.save()
            slug = slugify(key) or key
            prod_caps = {
                'editable_size': True,
                'geometry_mode': 'parametric',
                'default_params': {
                    **defaults,
                    'thicknessMm': 1.5,
                    'sizeMode': 'inner',
                    'fluteDirection': 'L',
                    'materialId': 'kraft',
                    'bleedInputMm': 3,
                    'advanced': {},
                },
            }
            if can_mfg:
                prod_caps['canExportManufacturing'] = True
            prod, _ = Product.objects.update_or_create(
                slug=slug,
                defaults={
                    'name': title,
                    'name_ko': title,
                    'category': category,
                    'description': f'{title} · 参数化刀版',
                    'status': Product.Status.PUBLISHED,
                    'default_template': tpl,
                    'default_template_version': ver,
                    'capabilities': prod_caps,
                },
            )
            ProductVariant.objects.get_or_create(
                product=prod,
                code='default',
                defaults={'material_id': 'kraft', 'min_quantity': 1},
            )

        for preset_id, title, source_num, length, width, height in SHIPPING_SAMPLES:
            key = f'fixed-{source_num}'
            locked_dims = {'lengthMm': length, 'widthMm': width, 'heightMm': height}
            tpl, _ = TemplateDefinition.objects.get_or_create(
                template_key=key,
                defaults={
                    'title': f'{title}（尺寸锁定）',
                    'geometry_mode': TemplateDefinition.GeometryMode.FIXED_SNAPSHOT,
                },
            )
            ver, _ = TemplateVersion.objects.get_or_create(
                template=tpl,
                version='1',
                defaults={
                    'engine_version': 'boxcraft.knife.v3',
                    'param_schema': {
                        'source_num': source_num,
                        'preset_id': preset_id,
                        'locked_dims': locked_dims,
                    },
                    'capabilities': {'editable_size': False, 'size_locked': True},
                    'is_current': True,
                },
            )
            ver.engine_version = 'boxcraft.knife.v3'
            ver.param_schema = {
                'source_num': source_num,
                'preset_id': preset_id,
                'locked_dims': locked_dims,
            }
            ver.capabilities = {'editable_size': False, 'size_locked': True}
            ver.is_current = True
            ver.save(update_fields=['engine_version', 'param_schema', 'capabilities', 'is_current'])
            TemplateVersion.objects.filter(template=tpl).exclude(pk=ver.pk).update(is_current=False)
            Product.objects.update_or_create(
                slug=slugify(preset_id) or preset_id,
                defaults={
                    'name': title,
                    'category': 'shipping',
                    'description': '导入运输箱尺寸目录 · 参数锁定（fixed_snapshot）',
                    'status': Product.Status.PUBLISHED,
                    'default_template': tpl,
                    'default_template_version': ver,
                    'capabilities': {
                        'editable_size': False,
                        'geometry_mode': 'fixed_snapshot',
                        'preset_id': preset_id,
                        'source_num': source_num,
                        'default_params': {
                            'lengthMm': length,
                            'widthMm': width,
                            'heightMm': height,
                            'thicknessMm': 1.5,
                            'sizeMode': 'inner',
                            'fluteDirection': 'L',
                            'materialId': 'white',
                            'bleedInputMm': 3,
                            'advanced': {},
                        },
                    },
                    'sort_order': 100,
                },
            )

        self.stdout.write(self.style.SUCCESS('seed_catalog done'))
