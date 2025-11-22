from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Approval, PurchaseRequest
from .permissions import IsApprover, IsFinance, IsStaff
from .serializers import (
    ApprovalDecisionSerializer,
    FileUploadSerializer,
    PurchaseRequestCreateSerializer,
    PurchaseRequestSerializer,
    PurchaseRequestUpdateSerializer,
    ReceiptUploadSerializer,
    RegisterSerializer,
)
from .services import ai
from .services.workflows import apply_approval, ensure_staff_owner, handle_receipt_upload

User = get_user_model()


class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = {
            "id": self.user.id,
            "username": self.user.username,
            "email": self.user.email,
            "role": self.user.role,
        }
        return data


class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        user_payload = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
        }
        return Response(
            {
                "user": user_payload,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class PurchaseRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = PurchaseRequest.objects.select_related("created_by").prefetch_related(
            Prefetch("approvals", queryset=Approval.objects.select_related("approver"))
        )
        user = self.request.user
        if user.role == User.Role.STAFF:
            return qs.filter(created_by=user)
        if user.role == User.Role.FINANCE:
            return qs.filter(status=PurchaseRequest.Status.APPROVED)
        if user.role in {User.Role.APPROVER_LEVEL_1, User.Role.APPROVER_LEVEL_2}:
            return qs
        return qs.none()

    def get_serializer_class(self):
        if self.action == "create":
            return PurchaseRequestCreateSerializer
        if self.action in {"update", "partial_update"}:
            return PurchaseRequestUpdateSerializer
        return PurchaseRequestSerializer

    def perform_create(self, serializer):
        serializer.save()

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        ensure_staff_owner(instance, request.user)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        ensure_staff_owner(instance, request.user)
        return super().partial_update(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="pending", permission_classes=[permissions.IsAuthenticated, IsApprover])
    def pending(self, request):
        queryset = PurchaseRequest.objects.filter(status=PurchaseRequest.Status.PENDING)
        if request.user.role == User.Role.APPROVER_LEVEL_1:
            queryset = queryset.filter(current_level=1)
        else:
            queryset = queryset.filter(current_level=2)
        serializer = PurchaseRequestSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["get"],
        url_path="approved",
        permission_classes=[permissions.IsAuthenticated, IsFinance],
    )
    def approved(self, request):
        queryset = PurchaseRequest.objects.filter(status=PurchaseRequest.Status.APPROVED)
        serializer = PurchaseRequestSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="upload-proforma",
        permission_classes=[permissions.IsAuthenticated, IsStaff],
    )
    def upload_proforma(self, request, pk=None):
        purchase_request = self.get_object()
        ensure_staff_owner(purchase_request, request.user)
        serializer = FileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_request.proforma = serializer.validated_data["file"]
        extracted = ai.extract_proforma_data(serializer.validated_data["file"])
        purchase_request.purchase_order_metadata = extracted
        purchase_request.save()
        return Response({"message": "Proforma uploaded", "extracted": extracted}, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["post"],
        url_path="submit-receipt",
        permission_classes=[permissions.IsAuthenticated],
    )
    def submit_receipt(self, request, pk=None):
        purchase_request = self.get_object()
        if request.user.role not in {User.Role.STAFF, User.Role.FINANCE}:
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)
        if request.user.role == User.Role.STAFF:
            ensure_staff_owner(purchase_request, request.user)
        serializer = ReceiptUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = handle_receipt_upload(purchase_request, serializer.validated_data["file"])
        return Response(result, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["patch"],
        url_path="approve",
        permission_classes=[permissions.IsAuthenticated, IsApprover],
    )
    def approve(self, request, pk=None):
        serializer = ApprovalDecisionSerializer(data=request.data or {"decision": "APPROVED"})
        serializer.is_valid(raise_exception=True)
        purchase_request, _ = apply_approval(
            pk,
            request.user,
            decision=serializer.validated_data["decision"],
            comments=serializer.validated_data.get("comments", ""),
        )
        return Response(PurchaseRequestSerializer(purchase_request).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["patch"],
        url_path="reject",
        permission_classes=[permissions.IsAuthenticated, IsApprover],
    )
    def reject(self, request, pk=None):
        serializer = ApprovalDecisionSerializer(data=request.data or {"decision": "REJECTED"})
        serializer.is_valid(raise_exception=True)
        purchase_request, _ = apply_approval(
            pk,
            request.user,
            decision=serializer.validated_data["decision"],
            comments=serializer.validated_data.get("comments", ""),
        )
        return Response(PurchaseRequestSerializer(purchase_request).data, status=status.HTTP_200_OK)
