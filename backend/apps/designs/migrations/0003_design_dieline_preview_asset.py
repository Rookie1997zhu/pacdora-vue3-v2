import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('assets', '0001_initial'),
        ('designs', '0002_designrevision_kind'),
    ]

    operations = [
        migrations.AddField(
            model_name='design',
            name='dieline_preview_asset',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='+',
                to='assets.asset',
            ),
        ),
    ]
