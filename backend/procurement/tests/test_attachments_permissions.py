import io
import tempfile

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient

from ..models import PurchaseRequest, Attachment


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture(autouse=True)
def tmp_media_root(tmp_path, settings):
    # use a temporary media root for file operations
    media = tmp_path / "media"
    media.mkdir()
    settings.MEDIA_ROOT = str(media)
    yield


@pytest.mark.django_db
def test_staff_can_upload_attachments(api_client):
    User = get_user_model()
    staff = User.objects.create_user(username="staff1", password="pass", role=User.Role.STAFF)
    pr = PurchaseRequest.objects.create(title="Test", description="desc", amount="10.00", created_by=staff)

    api_client.force_authenticate(staff)

    f = SimpleUploadedFile("test.pdf", b"%PDF-1.4 test", content_type="application/pdf")
    url = reverse("requests-upload-attachments", args=[pr.id])
    resp = api_client.post(url, {"files": [f]}, format="multipart")
    assert resp.status_code == 201, resp.content
    data = resp.json()
    assert "attachments" in data and len(data["attachments"]) == 1
    # check attachment exists in DB
    att_id = data["attachments"][0]["id"]
    att = Attachment.objects.get(pk=att_id)
    assert att.purchase_request_id == pr.id


@pytest.mark.django_db
def test_unauthorized_user_cannot_download_attachment(api_client):
    User = get_user_model()
    staff = User.objects.create_user(username="owner", password="pass", role=User.Role.STAFF)
    other = User.objects.create_user(username="other", password="pass", role=User.Role.STAFF)
    pr = PurchaseRequest.objects.create(title="Test2", description="desc", amount="5.00", created_by=staff)

    # create attachment
    django_file = SimpleUploadedFile("pic.png", b"\x89PNG\r\n", content_type="image/png")
    att = Attachment.objects.create(purchase_request=pr, file=django_file, content_type="image/png")

    url = reverse("requests-download-attachment", args=[pr.id, att.id])

    api_client.force_authenticate(other)
    resp = api_client.get(url)
    assert resp.status_code in (403, 404)


@pytest.mark.django_db
def test_approver_can_approve_with_comments(api_client):
    User = get_user_model()
    staff = User.objects.create_user(username="staffx", password="pass", role=User.Role.STAFF)
    approver = User.objects.create_user(username="approver1", password="pass", role=User.Role.APPROVER_LEVEL_1)
    pr = PurchaseRequest.objects.create(title="ApproveMe", description="desc", amount="15.00", created_by=staff)

    api_client.force_authenticate(approver)
    url = reverse("requests-approve", args=[pr.id])
    resp = api_client.patch(url, {"decision": "APPROVED", "comments": "Looks good"}, format="json")
    assert resp.status_code == 200, resp.content
    pr.refresh_from_db()
    assert pr.status == PurchaseRequest.Status.APPROVED
    # approvals should include the approver's decision
    assert pr.approvals.filter(approver=approver, decision="APPROVED").exists()
