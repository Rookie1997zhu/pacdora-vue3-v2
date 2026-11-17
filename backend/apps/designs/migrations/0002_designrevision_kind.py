from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('designs', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='designrevision',
            name='kind',
            field=models.CharField(
                choices=[('checkpoint', 'Checkpoint'), ('autosave', 'Autosave')],
                default='checkpoint',
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name='designrevision',
            index=models.Index(fields=['kind', 'created_at'], name='designs_des_kind_3f8a1b_idx'),
        ),
    ]
