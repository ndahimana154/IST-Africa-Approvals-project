from django.core.exceptions import PermissionDenied, ValidationError
from django.core.files.base import ContentFile
from django.db import transaction

from ..models import Approval, PurchaseRequest, User
from .ai import compare_receipt_to_po, extract_receipt_data, generate_purchase_order_metadata, serialize_metadata

ROLE_BY_LEVEL = {
    1: User.Role.APPROVER_LEVEL_1,
    2: User.Role.APPROVER_LEVEL_2,
}
MAX_LEVEL = max(ROLE_BY_LEVEL.keys())


def ensure_staff_owner(purchase_request: PurchaseRequest, user: User):
    if purchase_request.created_by != user:
        raise PermissionDenied("You may only modify your own requests.")
    if purchase_request.status != PurchaseRequest.Status.PENDING:
        raise ValidationError("Only pending requests can be modified.")


@transaction.atomic
def apply_approval(purchase_request_id: int, approver: User, decision: str, comments: str = ""):
    purchase_request = (
        PurchaseRequest.objects.select_for_update()
        .prefetch_related("approvals")
        .get(pk=purchase_request_id)
    )

    if purchase_request.status != PurchaseRequest.Status.PENDING:
        raise ValidationError("Request already finalized.")

    expected_role = ROLE_BY_LEVEL.get(purchase_request.current_level)
    if approver.role != expected_role:
        raise PermissionDenied("You are not assigned to this approval level.")

    if Approval.objects.filter(purchase_request=purchase_request, level=purchase_request.current_level).exists():
        raise ValidationError("This level decision already recorded.")

    approval = Approval.objects.create(
        purchase_request=purchase_request,
        approver=approver,
        level=purchase_request.current_level,
        decision=decision,
        comments=comments,
    )

    if decision == Approval.Decision.REJECTED:
        purchase_request.mark_rejected()
    else:
        if purchase_request.current_level >= MAX_LEVEL:
            metadata = generate_purchase_order_metadata(purchase_request, purchase_request.purchase_order_metadata)
            purchase_request.mark_approved(metadata)
            content = ContentFile(serialize_metadata(metadata))
            purchase_request.purchase_order_file.save(f"po-{purchase_request.id}.json", content, save=False)
        else:
            purchase_request.current_level += 1

    purchase_request.save()
    return purchase_request, approval


def handle_receipt_upload(purchase_request: PurchaseRequest, receipt_file):
    purchase_request.receipt = receipt_file
    receipt_data = extract_receipt_data(receipt_file)
    comparison = compare_receipt_to_po(purchase_request, receipt_data)
    purchase_request.save()
    return {
        "receipt_data": receipt_data,
        "comparison": comparison,
    }

