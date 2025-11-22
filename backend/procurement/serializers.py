from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Approval, PurchaseRequest, Attachment

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "role")
        read_only_fields = ("id", "role")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={"input_type": "password"})
    confirm_password = serializers.CharField(write_only=True, required=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "confirm_password",
            "role",
        )
        read_only_fields = ("id",)
        extra_kwargs = {
            "role": {"required": False},
            "email": {"required": True},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError("Passwords do not match.")
        validate_password(attrs["password"])
        attrs["role"] = attrs.get("role") or User.Role.STAFF
        if attrs["role"] != User.Role.STAFF:
            raise serializers.ValidationError("Self-service sign ups may only create staff accounts.")
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        role = validated_data.pop("role", User.Role.STAFF)
        user = User(role=role, **validated_data)
        user.set_password(password)
        user.save()
        return user


class ApprovalSerializer(serializers.ModelSerializer):
    approver = UserSerializer(read_only=True)

    class Meta:
        model = Approval
        fields = ("id", "level", "decision", "comments", "decided_at", "approver")
        read_only_fields = fields


class PurchaseRequestSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    approvals = ApprovalSerializer(many=True, read_only=True)
    attachments = serializers.SerializerMethodField()
    purchase_order_file_url = serializers.SerializerMethodField()
    proforma_url = serializers.SerializerMethodField()
    receipt_url = serializers.SerializerMethodField()

    def get_attachments(self, obj):
        attachments_qs = getattr(obj, 'attachments', None)
        if attachments_qs is None:
            return []
        result = []
        for a in attachments_qs.all():
            result.append({
                'id': a.id,
                'file': a.file.url if a.file else None,
                'content_type': a.content_type,
                'uploaded_at': a.uploaded_at,
                'download_url': f"/api/requests/{obj.id}/download-attachment/{a.id}/",
            })
        return result

    def get_purchase_order_file_url(self, obj):
        if obj.purchase_order_file:
            return f"/api/requests/{obj.id}/download-po/"
        return None

    def get_proforma_url(self, obj):
        if obj.proforma:
            return f"/api/requests/{obj.id}/download-proforma/"
        return None

    def get_receipt_url(self, obj):
        if obj.receipt:
            return f"/api/requests/{obj.id}/download-receipt/"
        return None

    class Meta:
        model = PurchaseRequest
        fields = (
            "id",
            "title",
            "description",
            "amount",
            "status",
            "current_level",
            "created_by",
            "created_at",
            "updated_at",
            "approved_at",
            "proforma",
            "proforma_url",
            "receipt",
            "receipt_url",
            "purchase_order_file",
            "purchase_order_file_url",
            "purchase_order_metadata",
            "supplier",
            "attachments",
            "approvals",
        )
        read_only_fields = (
            "id",
            "status",
            "current_level",
            "created_by",
            "created_at",
            "updated_at",
            "approved_at",
            "proforma",
            "receipt",
            "purchase_order_file",
            "purchase_order_metadata",
            "approvals",
            "attachments",
            "proforma_url",
            "receipt_url",
            "purchase_order_file_url",
        )


class PurchaseRequestCreateSerializer(serializers.ModelSerializer):
    supplier = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = PurchaseRequest
        fields = ("title", "description", "amount", "supplier")

    def validate_amount(self, value):
        if value is None:
            raise serializers.ValidationError("Amount is required.")
        return value

    def create(self, validated_data):
        request = self.context["request"]
        supplier = validated_data.pop('supplier', None)
        pr = PurchaseRequest.objects.create(created_by=request.user, supplier=supplier, **validated_data)
        return pr


class PurchaseRequestUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseRequest
        fields = ("title", "description", "amount")

    def validate(self, attrs):
        instance = self.instance
        if instance.status != PurchaseRequest.Status.PENDING:
            raise serializers.ValidationError("Only pending requests can be updated.")
        if instance.created_by != self.context["request"].user:
            raise serializers.ValidationError("You do not own this request.")
        return attrs


class FileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        if value.size > 25 * 1024 * 1024:
            raise serializers.ValidationError("File too large (max 25 MB).")
        return value


class ReceiptUploadSerializer(FileUploadSerializer):
    pass


class AttachmentUploadSerializer(serializers.Serializer):
    files = serializers.ListField(child=serializers.FileField(), allow_empty=False)

    def validate_files(self, value):
        # validate each file size/type
        for file in value:
            if file.size > 5 * 1024 * 1024:
                raise serializers.ValidationError("Each attachment must be <= 5 MB")
            # basic content type check (allow images and pdfs)
            if not (file.content_type.startswith('image/') or file.content_type in ('application/pdf',)):
                raise serializers.ValidationError("Unsupported file type")
        return value


class ApprovalDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=Approval.Decision.choices)
    comments = serializers.CharField(required=False, allow_blank=True)

