from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
import logging

from .models import Approval, PurchaseRequest, Attachment, FinanceComment
from .permissions import IsApprover, IsFinance, IsStaff
from .serializers import (
    ApprovalDecisionSerializer,
    FileUploadSerializer,
    ProformaUploadSerializer,
    PurchaseRequestCreateSerializer,
    PurchaseRequestSerializer,
    PurchaseRequestUpdateSerializer,
    ReceiptUrlSerializer,
    AttachmentUploadSerializer,
    RegisterSerializer,
)
from .services import ai
from .services.workflows import apply_approval, ensure_staff_owner, handle_receipt_upload
from .utils.ocr import extract_proforma_data
import mimetypes
import os
import boto3
import requests
import io

# Setup logging
logger = logging.getLogger(__name__)
from django.http import FileResponse, Http404, HttpResponseRedirect, StreamingHttpResponse
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

    def dispatch(self, request, *args, **kwargs):
        print(f"\n[VIEWSET DEBUG] dispatch() called")
        print(f"[VIEWSET DEBUG] path: {request.path}")
        print(f"[VIEWSET DEBUG] method: {request.method}")
        return super().dispatch(request, *args, **kwargs)

    def get_queryset(self):
        qs = PurchaseRequest.objects.select_related("created_by").prefetch_related(
            Prefetch("approvals", queryset=Approval.objects.select_related("approver")),
            Prefetch("finance_comments", queryset=FinanceComment.objects.select_related("user"))
        )
        user = self.request.user
        if user.role == User.Role.STAFF:
            # Staff can see their own PENDING, REJECTED, and APPROVED requests
            return qs.filter(created_by=user, status__in=[PurchaseRequest.Status.PENDING, PurchaseRequest.Status.REJECTED, PurchaseRequest.Status.APPROVED])
        if user.role == User.Role.FINANCE:
            # Finance can see all approved, rejected, and pending (read-only) requests
            return qs.filter(status__in=[PurchaseRequest.Status.APPROVED, PurchaseRequest.Status.REJECTED, PurchaseRequest.Status.PENDING])
        if user.role in {User.Role.APPROVER_LEVEL_1, User.Role.APPROVER_LEVEL_2}:
            # Approvers can see all requests for review
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
        detail=False,
        methods=["get"],
        url_path="rejected",
        permission_classes=[permissions.IsAuthenticated, IsFinance],
    )
    def rejected(self, request):
        """Finance can view rejected requests."""
        queryset = PurchaseRequest.objects.filter(status=PurchaseRequest.Status.REJECTED)
        serializer = PurchaseRequestSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["get"],
        url_path="finance-pending",
        permission_classes=[permissions.IsAuthenticated, IsFinance],
    )
    def finance_pending(self, request):
        """Finance can view pending requests (read-only)."""
        queryset = PurchaseRequest.objects.filter(status=PurchaseRequest.Status.PENDING)
        serializer = PurchaseRequestSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["get"],
        url_path="my-approvals",
        permission_classes=[permissions.IsAuthenticated, IsApprover],
    )
    def my_approvals(self, request):
        """Approvers can view their own approval history."""
        approver = request.user
        approvals = Approval.objects.filter(approver=approver).select_related("purchase_request", "approver").order_by("-decided_at")
        result = []
        for approval in approvals:
            result.append({
                "id": approval.id,
                "request": PurchaseRequestSerializer(approval.purchase_request, context={"request": request}).data,
                "decision": approval.decision,
                "comments": approval.comments,
                "level": approval.level,
                "decided_at": approval.decided_at,
            })
        return Response(result)

    @action(
        detail=True,
        methods=["post"],
        url_path="submit-receipt",
        permission_classes=[permissions.IsAuthenticated],
    )
    def submit_receipt(self, request, pk=None):
        purchase_request = self.get_object()

        # Permissions
        if request.user.role not in {User.Role.STAFF, User.Role.FINANCE}:
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

        if request.user.role == User.Role.STAFF:
            ensure_staff_owner(purchase_request, request.user)

        # Validate the external_url
        serializer = ReceiptUrlSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Save the URL directly
        purchase_request.receipt = serializer.validated_data["external_url"]
        purchase_request.save()

        return Response({
            "receipt_url": purchase_request.receipt,
            "message": "Receipt URL saved successfully"
        }, status=status.HTTP_200_OK)


    @action(
        detail=True,
        methods=["post"],
        url_path="upload-attachments",
        permission_classes=[permissions.IsAuthenticated, IsStaff],
    )
    def upload_attachments(self, request, pk=None):
        purchase_request = self.get_object()
        ensure_staff_owner(purchase_request, request.user)
        # Accept either uploaded files (multipart) or external URLs (Cloudinary)
        files = request.FILES.getlist('files') or []
        external_urls = request.data.get('external_urls') or []
        created = []

        # handle uploaded files
        for f in files:
            att = Attachment.objects.create(
                purchase_request=purchase_request,
                file=f,
                content_type=getattr(f, 'content_type', ''),
            )
            created.append({
                'id': att.id,
                'file': att.file.url if att.file else None,
                'external_url': att.external_url,
                'content_type': att.content_type,
                'uploaded_at': att.uploaded_at,
            })

        # handle external URLs (client uploaded to Cloudinary)
        for url in external_urls:
            # try to fetch headers/content-type
            content_type = ''
            try:
                head = requests.head(url, timeout=5)
                content_type = head.headers.get('content-type', '')
            except Exception:
                content_type = ''
            att = Attachment.objects.create(
                purchase_request=purchase_request,
                external_url=url,
                content_type=content_type,
            )
            created.append({
                'id': att.id,
                'file': att.file.url if att.file else None,
                'external_url': att.external_url,
                'content_type': att.content_type,
                'uploaded_at': att.uploaded_at,
            })

        if not created:
            return Response({"detail": "No files provided"}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'attachments': created}, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["post"],
        url_path="upload-proforma",
        permission_classes=[permissions.IsAuthenticated, IsStaff],
    )
    def upload_proforma(self, request, pk=None):
        """
        Upload and process proforma file (PDF or image).
        Accepts external URL (Cloudinary) via JSON: {"external_url": "https://..."}
        Extracts text and structured data (vendor, items, payment terms, grand total).
        Only staff (request creator) can upload while request is PENDING.
        """
        purchase_request = self.get_object()
        ensure_staff_owner(purchase_request, request.user)
        
        # Validate input - accepts external_url
        serializer = ProformaUploadSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        external_url = serializer.validated_data.get('external_url')
        
        if not external_url:
            return Response(
                {"detail": "external_url is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Download the file from external URL
        try:
            resp = requests.get(external_url, timeout=10)
            resp.raise_for_status()
            file_content = resp.content
        except Exception as e:
            return Response(
                {"detail": f"Failed to download from external URL: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create a file-like object for extraction
        from io import BytesIO
        file_obj = BytesIO(file_content)
        fname = external_url.split('/')[-1].split('?')[0] or 'proforma.pdf'
        file_obj.name = fname
        
        # Extract and parse proforma data
        result = extract_proforma_data(file_obj)
        
        if result['status'] == 'error':
            return Response(
                {"detail": result['message']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save the URL and extracted data to model
        purchase_request.proforma = external_url
        purchase_request.proforma_extracted_data = result['extracted_data']
        purchase_request.save(update_fields=['proforma', 'proforma_extracted_data'])
        
        return Response({
            "message": "Proforma uploaded and processed successfully",
            "proforma_url": purchase_request.proforma,
            "extracted_data": result['extracted_data']
        }, status=status.HTTP_200_OK)

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
        # If attachment uses external_url (e.g., Cloudinary), proxy the file so we can set attachment headers
        if att.external_url:
            try:
                resp = requests.get(att.external_url, stream=True, timeout=15)
                resp.raise_for_status()
            except Exception:
                # fallback to redirect if we cannot proxy
                return HttpResponseRedirect(att.external_url)

            # determine filename
            filename = os.path.basename(att.external_url.split('?')[0]) or f"attachment-{att.id}"
            content_type = resp.headers.get('content-type', 'application/octet-stream')
            streaming = StreamingHttpResponse(resp.iter_content(chunk_size=8192), content_type=content_type)
            streaming['Content-Disposition'] = f'attachment; filename="{filename}"'
            return streaming
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

    @action(detail=True, methods=["post"], url_path="finance-comment", permission_classes=[permissions.IsAuthenticated, IsFinance])
    def add_finance_comment(self, request, pk=None):
        pr = self.get_object()
        # finance may add comments regardless of PR status
        comment = request.data.get('comment')
        if not comment:
            return Response({"detail": "Comment is required"}, status=status.HTTP_400_BAD_REQUEST)
        fc = FinanceComment.objects.create(purchase_request=pr, user=request.user, comment=comment)
        # Return the updated request with the new comment
        return Response(PurchaseRequestSerializer(pr, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-comment", permission_classes=[permissions.IsAuthenticated])
    def add_comment(self, request, pk=None):
        pr = self.get_object()
        # Staff and Finance can add comments
        if request.user.role not in {User.Role.STAFF, User.Role.FINANCE}:
            return Response({"detail": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)
        
        # Staff can only comment on their own requests
        if request.user.role == User.Role.STAFF:
            ensure_staff_owner(pr, request.user)
        
        comment = request.data.get('comment')
        if not comment:
            return Response({"detail": "Comment is required"}, status=status.HTTP_400_BAD_REQUEST)
        fc = FinanceComment.objects.create(purchase_request=pr, user=request.user, comment=comment)
        # Return the updated request with the new comment
        return Response(PurchaseRequestSerializer(pr, context={'request': request}).data, status=status.HTTP_201_CREATED)

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
