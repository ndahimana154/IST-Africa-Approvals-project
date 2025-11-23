from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


def proforma_upload_path(instance, filename):
    return f"purchase_requests/{instance.id or 'new'}/proformas/{filename}"


def receipt_upload_path(instance, filename):
    return f"purchase_requests/{instance.id or 'new'}/receipts/{filename}"


def po_upload_path(instance, filename):
    return f"purchase_requests/{instance.id or 'new'}/purchase_orders/{filename}"


class User(AbstractUser):
    class Role(models.TextChoices):
        STAFF = "staff", "Staff"
        APPROVER_LEVEL_1 = "approver_level_1", "Approver Level 1"
        APPROVER_LEVEL_2 = "approver_level_2", "Approver Level 2"
        FINANCE = "finance", "Finance"

    role = models.CharField(max_length=32, choices=Role.choices, default=Role.STAFF)

    def __str__(self):
        return f"{self.username} ({self.role})"


class PurchaseRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    title = models.CharField(max_length=255)
    description = models.TextField()
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    current_level = models.PositiveSmallIntegerField(default=1)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="purchase_requests")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    proforma = models.FileField(upload_to=proforma_upload_path, null=True, blank=True)
    purchase_order_file = models.FileField(upload_to=po_upload_path, null=True, blank=True)
    purchase_order_metadata = models.JSONField(default=dict, blank=True)
    receipt = models.URLField(blank=True, null=True, )
    supplier = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def mark_approved(self, metadata=None):
        self.status = self.Status.APPROVED
        self.approved_at = timezone.now()
        if metadata:
            self.purchase_order_metadata = metadata

    def mark_rejected(self):
        self.status = self.Status.REJECTED

    def __str__(self):
        return f"{self.title} - {self.status}"


class Approval(models.Model):
    class Decision(models.TextChoices):
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    purchase_request = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name="approvals")
    approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="approvals")
    level = models.PositiveSmallIntegerField()
    decision = models.CharField(max_length=16, choices=Decision.choices)
    comments = models.TextField(blank=True)
    decided_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("purchase_request", "level")
        ordering = ["level"]

    def __str__(self):
        return f"{self.purchase_request_id} - L{self.level} - {self.decision}"


def attachment_upload_path(instance, filename):
    return f"purchase_requests/{instance.purchase_request.id or 'new'}/attachments/{filename}"


class Attachment(models.Model):
    purchase_request = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name='attachments')
    file = models.FileField(upload_to=attachment_upload_path, null=True, blank=True)
    # allow storing external URLs (e.g., Cloudinary) for client-side uploads
    external_url = models.URLField(null=True, blank=True)
    content_type = models.CharField(max_length=100, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"Attachment {self.id} for PR {self.purchase_request_id}"


class FinanceComment(models.Model):
    purchase_request = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name='finance_comments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"FinanceComment {self.id} on PR {self.purchase_request_id} by {self.user_id}"
