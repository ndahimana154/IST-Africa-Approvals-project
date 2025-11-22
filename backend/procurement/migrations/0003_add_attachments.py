# Generated migration to add supplier field and Attachment model
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0002_alter_user_groups'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaserequest',
            name='supplier',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.CreateModel(
            name='Attachment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='purchase_requests/attachments/')),
                ('content_type', models.CharField(blank=True, max_length=100)),
                ('uploaded_at', models.DateTimeField(auto_now_add=True)),
                ('purchase_request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attachments', to='procurement.purchaserequest')),
            ],
            options={
                'ordering': ['-uploaded_at'],
            },
        ),
    ]
