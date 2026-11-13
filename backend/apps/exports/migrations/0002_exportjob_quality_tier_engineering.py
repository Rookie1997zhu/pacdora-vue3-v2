from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('exports', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='exportjob',
            name='quality_tier',
            field=models.CharField(
                choices=[
                    ('preview', 'Preview'),
                    ('vector_proof', 'Vector proof'),
                    ('engineering', 'Engineering candidate'),
                    ('manufacturing', 'Manufacturing'),
                ],
                max_length=32,
            ),
        ),
    ]
