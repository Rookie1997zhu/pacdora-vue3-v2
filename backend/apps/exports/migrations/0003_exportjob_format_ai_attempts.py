from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exports', '0002_exportjob_quality_tier_engineering'),
    ]

    operations = [
        migrations.AddField(
            model_name='exportjob',
            name='attempts',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='exportjob',
            name='format',
            field=models.CharField(
                choices=[
                    ('svg', 'SVG'),
                    ('dxf', 'DXF'),
                    ('pdf', 'PDF'),
                    ('ai', 'AI'),
                ],
                max_length=16,
            ),
        ),
    ]
