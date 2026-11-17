from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='exportgrant',
            name='refunded_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='exportgrant',
            name='reason',
            field=models.CharField(
                choices=[
                    ('studio_export', 'Studio export'),
                    ('workbench_export', 'Workbench export'),
                    ('lab_client', 'Lab client download'),
                    ('render_export', 'Render export'),
                    ('manual', 'Manual'),
                ],
                max_length=40,
            ),
        ),
        migrations.RenameIndex(
            model_name='exportgrant',
            new_name='billing_exp_organiz_f825aa_idx',
            old_name='billing_exp_org_c8f3a1_idx',
        ),
        migrations.RenameIndex(
            model_name='organizationentitlement',
            new_name='billing_org_plan_4cf323_idx',
            old_name='billing_org_plan_a5e1c2_idx',
        ),
        migrations.RenameIndex(
            model_name='upgradeintent',
            new_name='billing_upg_organiz_c2ecd4_idx',
            old_name='billing_upg_org_b2d4e7_idx',
        ),
    ]
