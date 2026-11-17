# Generated manually for Phase 1 billing entitlement

import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('organizations', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='OrganizationEntitlement',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('plan', models.CharField(choices=[('free', 'Free'), ('annual', 'Annual')], default='free', max_length=20)),
                ('free_export_limit', models.PositiveIntegerField(default=10)),
                ('exports_used', models.PositiveIntegerField(default=0)),
                ('annual_expires_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'organization',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='entitlement',
                        to='organizations.organization',
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name='ExportGrant',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    'reason',
                    models.CharField(
                        choices=[
                            ('studio_export', 'Studio export'),
                            ('lab_client', 'Lab client download'),
                            ('manual', 'Manual'),
                        ],
                        max_length=40,
                    ),
                ),
                ('format', models.CharField(blank=True, max_length=16)),
                ('consumed_quota', models.BooleanField(default=True)),
                ('meta', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'actor',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='export_grants',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'organization',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='export_grants',
                        to='organizations.organization',
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name='UpgradeIntent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    'plan',
                    models.CharField(
                        choices=[('pay_per_use', 'Pay per use'), ('annual', 'Annual')],
                        max_length=32,
                    ),
                ),
                ('note', models.TextField(blank=True)),
                ('contact', models.CharField(blank=True, max_length=200)),
                (
                    'status',
                    models.CharField(
                        choices=[('submitted', 'Submitted'), ('closed', 'Closed')],
                        default='submitted',
                        max_length=20,
                    ),
                ),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'organization',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='upgrade_intents',
                        to='organizations.organization',
                    ),
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='upgrade_intents',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddIndex(
            model_name='organizationentitlement',
            index=models.Index(fields=['plan', 'annual_expires_at'], name='billing_org_plan_a5e1c2_idx'),
        ),
        migrations.AddIndex(
            model_name='exportgrant',
            index=models.Index(fields=['organization', '-created_at'], name='billing_exp_org_c8f3a1_idx'),
        ),
        migrations.AddIndex(
            model_name='upgradeintent',
            index=models.Index(fields=['organization', '-created_at'], name='billing_upg_org_b2d4e7_idx'),
        ),
    ]
