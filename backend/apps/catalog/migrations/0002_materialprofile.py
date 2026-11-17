from django.db import migrations, models
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ('catalog', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='MaterialProfile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(max_length=64, unique=True)),
                ('name_zh', models.CharField(max_length=120)),
                ('name_ko', models.CharField(blank=True, max_length=120)),
                ('family', models.CharField(default='kraft', max_length=40)),
                ('flute', models.CharField(blank=True, max_length=16)),
                ('thickness_min', models.DecimalField(decimal_places=3, default=0, max_digits=8)),
                ('thickness_default', models.DecimalField(decimal_places=3, default=0, max_digits=8)),
                ('thickness_max', models.DecimalField(decimal_places=3, default=0, max_digits=8)),
                ('engine_material_id', models.CharField(default='kraft', max_length=32)),
                ('calibrated', models.BooleanField(default=False)),
                ('profile_version', models.CharField(default='0.1', max_length=32)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.AddIndex(
            model_name='materialprofile',
            index=models.Index(fields=['is_active', 'family'], name='catalog_mat_is_acti_7a1b2c_idx'),
        ),
    ]
