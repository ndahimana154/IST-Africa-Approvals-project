from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Approval, PurchaseRequest

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
            "receipt",
            "purchase_order_file",
            "purchase_order_metadata",
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
        )


class PurchaseRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseRequest
        fields = ("title", "description", "amount")

    def create(self, validated_data):
        request = self.context["request"]
        return PurchaseRequest.objects.create(created_by=request.user, **validated_data)


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


class ApprovalDecisionSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=Approval.Decision.choices)
    comments = serializers.CharField(required=False, allow_blank=True)

