# API Behavior Guide: Role-Based Request Access

## Overview

This document details the exact API behavior for each user role after the permission enhancements.

---

## STAFF ROLE (User.Role.STAFF)

### Available Endpoints

- `GET /requests/` - List own requests
- `GET /requests/{id}/` - View own request details
- `PATCH /requests/{id}/` - Edit own request
- `POST /requests/` - Create new request
- `POST /requests/{id}/upload-attachments/` - Upload files
- `POST /requests/{id}/upload-proforma/` - Upload proforma

### What Staff Can See

Staff users **only** see their own requests with status `PENDING` or `REJECTED`:

**GET /requests/ Response:**

```json
{
  "count": 2,
  "results": [
    {
      "id": 1,
      "title": "Office Supplies",
      "status": "PENDING",
      "created_by": <current_staff_user_id>
    },
    {
      "id": 2,
      "title": "IT Equipment",
      "status": "REJECTED",
      "created_by": <current_staff_user_id>
    }
  ]
}
```

### What Staff Can Do

✅ Edit their own PENDING requests
✅ Resubmit REJECTED requests (now possible!)
✅ Upload attachments/proforma
❌ View other staff members' requests
❌ View approved or fully processed requests
❌ Perform approvals

### Request Lifecycle for Staff

```
CREATE → PENDING [✓ CAN EDIT] → (Approver actions) → REJECTED [✓ CAN RESUBMIT] → PENDING → APPROVED
```

---

## APPROVER ROLE (APPROVER_LEVEL_1 or APPROVER_LEVEL_2)

### Available Endpoints

- `GET /requests/pending/` - List pending requests
- `GET /requests/` - List all requests
- `GET /requests/my-approvals/` - **[NEW]** List own approval history
- `PATCH /requests/{id}/approve/` - Approve a request
- `PATCH /requests/{id}/reject/` - Reject a request

### What Approvers Can See

#### All Requests

**GET /requests/ Response:**

```json
{
  "count": 50,
  "results": [
    { "id": 1, "title": "...", "status": "PENDING", ... },
    { "id": 2, "title": "...", "status": "APPROVED", ... },
    { "id": 3, "title": "...", "status": "REJECTED", ... }
  ]
}
```

Approvers see **ALL** requests regardless of status.

#### Pending Requests (for action)

**GET /requests/pending/ Response:**

```json
[
  {
    "id": 1,
    "title": "Request requiring approval",
    "status": "PENDING",
    "amount": 5000,
    "created_by": <staff_user_id>,
    "attachments": [ ... ]
  }
]
```

#### My Approvals **[NEW ENDPOINT]**

**GET /requests/my-approvals/ Response:**

```json
[
  {
    "id": 1,
    "request": {
      "id": 1,
      "title": "Approved Request",
      "status": "APPROVED",
      ...
    },
    "decision": "APPROVED",
    "comments": "Looks good, proceed with purchase",
    "level": 1,
    "decided_at": "2024-01-15T10:30:00Z"
  },
  {
    "id": 2,
    "request": {
      "id": 2,
      "title": "Rejected Request",
      "status": "REJECTED",
      ...
    },
    "decision": "REJECTED",
    "comments": "Missing supplier information",
    "level": 1,
    "decided_at": "2024-01-14T14:22:00Z"
  }
]
```

### What Approvers Can Do

✅ View all requests in the system
✅ Approve pending requests
✅ Reject pending requests (with comments)
✅ View their own approval history
✅ See all details of requests they reviewed
❌ Modify requests
❌ Create requests
❌ Access finance-specific actions

### Approval Workflow

```
PENDING [View] → [APPROVE] → APPROVED
              ↘ [REJECT]  → REJECTED
```

---

## FINANCE ROLE (User.Role.FINANCE)

### Available Endpoints

- `GET /requests/` - List viewable requests
- `GET /requests/{id}/` - View request details
- `GET /requests/approved/` - List approved requests
- `GET /requests/rejected/` - **[NEW]** List rejected requests
- `GET /requests/finance-pending/` - **[NEW]** List pending requests (read-only)
- `POST /requests/{id}/submit-receipt/` - Upload receipt (approved only)
- `POST /requests/{id}/finance-comment/` - Add comment (approved only)
- `PATCH /requests/{id}/` - Update request (approved only)

### What Finance Can See

#### All Viewable Requests

**GET /requests/ Response:**

```json
{
  "count": 150,
  "results": [
    { "id": 1, "status": "APPROVED", ... },
    { "id": 2, "status": "REJECTED", ... },
    { "id": 3, "status": "PENDING", ... }
  ]
}
```

Finance sees **APPROVED, REJECTED, and PENDING** requests.

#### Approved Requests (Editable)

**GET /requests/approved/ Response:**

```json
[
  {
    "id": 1,
    "title": "Office Supplies",
    "status": "APPROVED",
    "amount": 5000,
    "created_by": <staff_user_id>,
    "receipt": null,
    "receipt_url": null,
    "finance_comments": []
  }
]
```

Finance can:

- Upload receipts
- Add finance comments
- View proforma/attachments

#### Rejected Requests (View-Only)

**GET /requests/rejected/ Response:**

```json
[
  {
    "id": 2,
    "title": "IT Equipment",
    "status": "REJECTED",
    "amount": 12000,
    "created_by": <staff_user_id>,
    "proforma": "https://..."
  }
]
```

Finance can:

- View request details and proforma
- See approver rejection comments
- Track why request was rejected

#### Pending Requests (View-Only) **[NEW ENDPOINT]**

**GET /requests/finance-pending/ Response:**

```json
[
  {
    "id": 3,
    "title": "Monitor Replacements",
    "status": "PENDING",
    "amount": 8000,
    "created_by": <staff_user_id>,
    "current_level": 1,
    "approvals": [
      {
        "level": 1,
        "decision": null,
        "approver": <approver_user_id>
      }
    ]
  }
]
```

Finance can:

- Monitor approval progress
- See which approver level is reviewing
- Track incoming work

### What Finance Can Do

✅ View approved requests
✅ Upload receipts to approved requests
✅ Add finance comments to approved requests
✅ View rejected requests (understand why)
✅ Monitor pending requests (see approval status)
❌ Modify requests
❌ Approve/reject requests
❌ Create requests
❌ Access staff/approver-only actions

### Finance Workflow

```
APPROVED [Upload receipt] [Add comment] → Ready for payment
REJECTED [View only] → Understand issues, communicate with staff
PENDING  [View only] → Monitor approval progress
```

---

## Request Status Visibility Matrix

| User Role | Can See PENDING | Can See APPROVED | Can See REJECTED |
| --------- | :-------------: | :--------------: | :--------------: |
| Staff     |   ✅ Own only   |        ❌        |   ✅ Own only    |
| Approver  |     ✅ All      |      ✅ All      |      ✅ All      |
| Finance   |  ✅ Read-only   |  ✅ Full access  |   ✅ Read-only   |

---

## Request Edit Permissions Matrix

| User Role | Can Edit PENDING |   Can Edit APPROVED   |   Can Edit REJECTED    |
| --------- | :--------------: | :-------------------: | :--------------------: |
| Staff     |   ✅ Own only    |          ❌           | ✅ Own only (resubmit) |
| Approver  |        ❌        |          ❌           |           ❌           |
| Finance   |        ❌        | ✅ (receipt/comments) |           ❌           |

---

## Example: Full Request Lifecycle

### 1. Staff Creates Request (PENDING)

```
Staff: POST /requests/
Staff: POST /requests/1/upload-proforma/
  ↓
Status: PENDING
Visible to: Staff (own), All Approvers, Finance (read-only)
```

### 2. Approver Level 1 Reviews (PENDING)

```
Approver: GET /requests/pending/
Approver: PATCH /requests/1/approve/  [or reject]
  ↓
If APPROVED: Status: APPROVED
If REJECTED: Status: REJECTED
Visible to: All Approvers, Finance (if rejected), Staff (if rejected)
Approval recorded in my-approvals history
```

### 3a. Request Rejected (REJECTED)

```
Staff: GET /requests/ [sees rejected request]
Staff: PATCH /requests/1/ [edits request]
Staff: PATCH /requests/1/upload-proforma/ [re-uploads]
Staff: [Request goes back to PENDING for new approval]
```

### 3b. Request Approved (APPROVED)

```
Finance: GET /requests/approved/
Finance: POST /requests/1/submit-receipt/
Finance: POST /requests/1/finance-comment/
  ↓
Ready for Payment
```

---

## Query Examples

### Staff Viewing Their Requests

```
GET /requests/
Authorization: Bearer {staff_token}

Response: Only PENDING and REJECTED requests created by this staff member
```

### Approver Viewing Their Approval History

```
GET /requests/my-approvals/
Authorization: Bearer {approver_token}

Response: All approvals/rejections with timestamps and comments
```

### Finance Monitoring Workflow

```
GET /requests/approved/
GET /requests/rejected/
GET /requests/finance-pending/
Authorization: Bearer {finance_token}

Response: All requests in each status category
```

---

## Error Scenarios

### Staff Trying to Edit Approved Request

```
PATCH /requests/1/
Request 1 Status: APPROVED

Response: 400 Bad Request
{
  "error": "Only pending or rejected requests can be modified."
}
```

### Finance Trying to Upload Receipt to Pending Request

```
POST /requests/3/submit-receipt/
Request 3 Status: PENDING

Response: 403 Forbidden (or 400 depending on implementation)
{
  "detail": "Receipts can only be uploaded for approved requests."
}
```

### Approver Trying to Approve Already Approved Request

```
PATCH /requests/1/approve/
Request 1 Status: APPROVED

Response: 400 Bad Request
{
  "error": "Request is not in a valid state for approval."
}
```

---

## Summary: What Changed

| Feature                              | Before | After                      |
| ------------------------------------ | ------ | -------------------------- |
| Staff can resubmit rejected requests | ❌     | ✅                         |
| Approvers can see their history      | ❌     | ✅                         |
| Finance can see pending requests     | ❌     | ✅ Read-only               |
| Finance can see rejected requests    | ❌     | ✅                         |
| Staff sees all their requests        | ✅     | ✅ PENDING + REJECTED only |
| Finance sees approved only           | ✅     | ✅ Now sees all 3 statuses |
