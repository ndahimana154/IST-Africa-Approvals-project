from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('procurement', '0003_add_attachments'),
    ]

    operations = [
        migrations.AddField(
            model_name='attachment',
            name='external_url',
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='attachment',
            name='file',
            field=models.FileField(blank=True, null=True, upload_to='purchase_requests/%Y/%m/%d/attachments'),
        ),
        migrations.CreateModel(
            name='FinanceComment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('comment', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('purchase_request', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='finance_comments', to='procurement.purchaserequest')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
