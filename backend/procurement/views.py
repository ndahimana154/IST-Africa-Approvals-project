from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import Approval, PurchaseRequest, Attachment
from .permissions import IsApprover, IsFinance, IsStaff
from .serializers import (
    ApprovalDecisionSerializer,
    FileUploadSerializer,
    PurchaseRequestCreateSerializer,
    PurchaseRequestSerializer,
    PurchaseRequestUpdateSerializer,
    ReceiptUploadSerializer,
    AttachmentUploadSerializer,
    RegisterSerializer,
)
from .services import ai
from .services.workflows import apply_approval, ensure_staff_owner, handle_receipt_upload
import mimetypes
import os
import boto3
from django.http import FileResponse, Http404, HttpResponseRedirect
from django.conf import settings

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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        out = PurchaseRequestSerializer(instance, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

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
        methods=["post"],
        url_path="upload-attachments",
        permission_classes=[permissions.IsAuthenticated, IsStaff],
    )
    def upload_attachments(self, request, pk=None):
        purchase_request = self.get_object()
        ensure_staff_owner(purchase_request, request.user)
        serializer = AttachmentUploadSerializer(data=request.data)
        # For file lists, DRF requires passing files via request.FILES
        # Build files list from request.FILES.getlist('files') if present
        files = request.FILES.getlist('files') or []
        if not files:
            return Response({"detail": "No files provided"}, status=status.HTTP_400_BAD_REQUEST)
        # Validate using serializer
        serializer.initial_data['files'] = files
        serializer.is_valid(raise_exception=True)
        created = []
        for f in serializer.validated_data['files']:
            att = Attachment.objects.create(purchase_request=purchase_request, file=f, content_type=getattr(f, 'content_type', ''))
            created.append({
                'id': att.id,
                'file': att.file.url if att.file else None,
                'content_type': att.content_type,
                'uploaded_at': att.uploaded_at,
            })
        return Response({'attachments': created}, status=status.HTTP_201_CREATED)

    def _has_file_access(self, user, purchase_request: PurchaseRequest):
        # Staff may only access their own files
        if user.role == User.Role.STAFF:
            return purchase_request.created_by_id == user.id
        # Approvers can access requests for review
        if user.role in {User.Role.APPROVER_LEVEL_1, User.Role.APPROVER_LEVEL_2}:
            return True
        # Finance only for approved
        if user.role == User.Role.FINANCE:
            return purchase_request.status == PurchaseRequest.Status.APPROVED
        return False

    @action(detail=True, methods=['get'], url_path='download-proforma', permission_classes=[permissions.IsAuthenticated])
    def download_proforma(self, request, pk=None):
        pr = self.get_object()
        if not self._has_file_access(request.user, pr):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        if not pr.proforma:
            raise Http404
        # If S3 is configured, generate a presigned URL and redirect
        if getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None):
            key = pr.proforma.name
            client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', None),
            )
            presigned = client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key},
                ExpiresIn=3600,
            )
            return HttpResponseRedirect(presigned)
        filepath = pr.proforma.path
        filename = os.path.basename(filepath)
        content_type, _ = mimetypes.guess_type(filename)
        return FileResponse(open(filepath, 'rb'), as_attachment=True, filename=filename, content_type=content_type or 'application/octet-stream')

    @action(detail=True, methods=['get'], url_path='download-receipt', permission_classes=[permissions.IsAuthenticated])
    def download_receipt(self, request, pk=None):
        pr = self.get_object()
        if not self._has_file_access(request.user, pr):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        if not pr.receipt:
            raise Http404
        if getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None):
            key = pr.receipt.name
            client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', None),
            )
            presigned = client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key},
                ExpiresIn=3600,
            )
            return HttpResponseRedirect(presigned)
        filepath = pr.receipt.path
        filename = os.path.basename(filepath)
        content_type, _ = mimetypes.guess_type(filename)
        return FileResponse(open(filepath, 'rb'), as_attachment=True, filename=filename, content_type=content_type or 'application/octet-stream')

    @action(detail=True, methods=['get'], url_path='download-po', permission_classes=[permissions.IsAuthenticated])
    def download_po(self, request, pk=None):
        pr = self.get_object()
        if not self._has_file_access(request.user, pr):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        if not pr.purchase_order_file:
            raise Http404
        if getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None):
            key = pr.purchase_order_file.name
            client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', None),
            )
            presigned = client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key},
                ExpiresIn=3600,
            )
            return HttpResponseRedirect(presigned)
        filepath = pr.purchase_order_file.path
        filename = os.path.basename(filepath)
        content_type, _ = mimetypes.guess_type(filename)
        return FileResponse(open(filepath, 'rb'), as_attachment=True, filename=filename, content_type=content_type or 'application/octet-stream')

    @action(detail=True, methods=['get'], url_path='download-attachment/(?P<att_id>[^/.]+)', permission_classes=[permissions.IsAuthenticated])
    def download_attachment(self, request, pk=None, att_id=None):
        pr = self.get_object()
        try:
            att = Attachment.objects.get(pk=att_id, purchase_request=pr)
        except Attachment.DoesNotExist:
            raise Http404
        if not self._has_file_access(request.user, pr):
            return Response({'detail': 'Not allowed'}, status=status.HTTP_403_FORBIDDEN)
        if getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None):
            key = att.file.name
            client = boto3.client(
                's3',
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', None),
            )
            presigned = client.generate_presigned_url(
                'get_object',
                Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': key},
                ExpiresIn=3600,
            )
            return HttpResponseRedirect(presigned)
        filepath = att.file.path
        filename = os.path.basename(filepath)
        content_type, _ = mimetypes.guess_type(filename)
        return FileResponse(open(filepath, 'rb'), as_attachment=True, filename=filename, content_type=content_type or 'application/octet-stream')

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
