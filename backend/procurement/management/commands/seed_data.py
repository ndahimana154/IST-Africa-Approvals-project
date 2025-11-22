from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission


class Command(BaseCommand):
    help = 'Seed initial roles and a demo user'

    def handle(self, *args, **options):
        User = get_user_model()

        # Roles
        roles = ['staff', 'approver', 'finance', 'admin']
        for role in roles:
            group, created = Group.objects.get_or_create(name=role)
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created role: {role}'))

        # Create demo superuser if not exists
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser(username='admin', email='admin@example.com', password='adminpass')
            self.stdout.write(self.style.SUCCESS('Created superuser: admin'))

        self.stdout.write(self.style.SUCCESS('Seeding complete'))
