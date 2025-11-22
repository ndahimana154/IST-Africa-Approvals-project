from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Approval, PurchaseRequest, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Procurement", {"fields": ("role",)}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Procurement", {"fields": ("role",)}),
    )
    list_display = ("username", "email", "role", "is_active", "is_staff")
    list_filter = ("role", "is_active")


@admin.register(PurchaseRequest)
class PurchaseRequestAdmin(admin.ModelAdmin):
    list_display = ("title", "amount", "status", "current_level", "created_by", "created_at")
    list_filter = ("status", "current_level", "created_at")
    search_fields = ("title", "description", "created_by__username")
    readonly_fields = ("created_at", "updated_at", "approved_at")


@admin.register(Approval)
class ApprovalAdmin(admin.ModelAdmin):
    list_display = ("purchase_request", "approver", "level", "decision", "decided_at")
    list_filter = ("decision", "level")
