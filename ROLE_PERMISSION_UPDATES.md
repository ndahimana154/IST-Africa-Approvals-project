# Role and Permission Enhancement Updates

## Overview

This document describes the enhancements made to support refined role-based permissions and approval workflow improvements. Staff can now edit rejected requests for resubmission, approvers can view their approval history, and finance users see all request statuses with appropriate read-only access to pending requests.

## Backend Changes

### 1. **Updated `ensure_staff_owner()` in `procurement/services/workflows.py`**

- **Change**: Modified to allow staff editing of both `PENDING` and `REJECTED` requests
- **Purpose**: Enables staff to resubmit rejected requests
- **Code**:
  ```python
  def ensure_staff_owner(purchase_request: PurchaseRequest, user: User):
      if purchase_request.created_by != user:
          raise PermissionDenied("You may only modify your own requests.")
      # Allow edit when PENDING or when REJECTED (can be resubmitted)
      if purchase_request.status not in {PurchaseRequest.Status.PENDING, PurchaseRequest.Status.REJECTED}:
          raise ValidationError("Only pending or rejected requests can be modified.")
  ```

### 2. **Updated `get_queryset()` in `procurement/views.py`**

- **Change**: Modified role-based filtering to provide appropriate data visibility
- **Details**:
  - **Staff**: Now see their own `PENDING` and `REJECTED` requests (can resubmit rejected ones)
  - **Finance**: Now see all `APPROVED`, `REJECTED`, and `PENDING` requests
  - **Approvers** (Level 1 & 2): See all requests (unchanged)
- **Code**:
  ```python
  def get_queryset(self):
      # ... prefix code ...
      if user.role == User.Role.STAFF:
          # Staff can see their own PENDING and REJECTED requests (to resubmit)
          return qs.filter(created_by=user, status__in=[PurchaseRequest.Status.PENDING, PurchaseRequest.Status.REJECTED])
      if user.role == User.Role.FINANCE:
          # Finance can see all approved, rejected, and pending (read-only) requests
          return qs.filter(status__in=[PurchaseRequest.Status.APPROVED, PurchaseRequest.Status.REJECTED, PurchaseRequest.Status.PENDING])
      if user.role in {User.Role.APPROVER_LEVEL_1, User.Role.APPROVER_LEVEL_2}:
          # Approvers can see all requests for review
          return qs
      return qs.none()
  ```

### 3. **Added `rejected()` Action (Finance)**

- **Endpoint**: `GET /requests/rejected/`
- **Permission**: Finance users only
- **Purpose**: Allows finance to view rejected requests separately
- **Returns**: List of rejected purchase requests

### 4. **Added `finance_pending()` Action (Finance)**

- **Endpoint**: `GET /requests/finance-pending/`
- **Permission**: Finance users only
- **Purpose**: Allows finance to view pending requests in read-only mode (for monitoring)
- **Returns**: List of pending purchase requests

### 5. **Added `my_approvals()` Action (Approvers)**

- **Endpoint**: `GET /requests/my-approvals/`
- **Permission**: Approver Level 1 or Level 2 users only
- **Purpose**: Returns the current approver's approval/rejection history
- **Response Format**:
  ```json
  [
    {
      "id": <approval_id>,
      "request": {<PurchaseRequestSerializer data>},
      "decision": "APPROVED" | "REJECTED",
      "comments": "...",
      "level": 1 | 2,
      "decided_at": "ISO datetime"
    }
  ]
  ```

## Frontend Changes

### 1. **Updated `StaffDashboard.jsx`**

- **Change**: Added tabbed interface to filter by request status
- **Tabs**:
  - **Pending**: Displays staff's pending requests
  - **Rejected**: Displays rejected requests
- **State**: Added `activeTab` state to track selected tab
- **Behavior**: `filteredRequests` useMemo filters requests based on active tab

### 2. **Updated `FinanceDashboard.jsx`**

- **Change**: Added tabbed interface for different request statuses
- **Tabs**:
  - **Approved**: Editable requests where finance can upload receipts and add comments
  - **Rejected**: View-only display of rejected requests
  - **Pending (View Only)**: Read-only display of pending requests awaiting approvals
- **State**: Added `activeTab` state
- **Behavior**:
  - `fetchApproved()` now uses different endpoints based on active tab
  - `useEffect` refetch when tab changes
  - Receipt upload and finance comments only available for "Approved" tab
  - "Pending" tab shows message "View only" instead of upload options
- **Endpoints Used**:
  - `/requests/approved/` for approved tab
  - `/requests/rejected/` for rejected tab
  - `/requests/finance-pending/` for pending tab

### 3. **Enhanced `ApproverDashboard.jsx`**

- **Change**: Added tabbed interface with approval history view
- **Tabs**:
  - **Pending**: Shows pending requests for approval/rejection (existing functionality)
  - **My history**: Shows approver's approval history with filters
- **Sub-filters** (in history tab):
  - **All**: Shows all approvals/rejections
  - **Approved**: Shows only approved requests
  - **Rejected**: Shows only rejected requests
- **States**: Added `activeTab` and `historyFilter` states
- **Behavior**:
  - `loadMyApprovals()` fetches from `/requests/my-approvals/` endpoint
  - History displays decision, comments, approval level, and timestamp
  - Shows proforma link for viewing original documents
- **UI Enhancements**:
  - Each history entry shows decision status badge (Approved/Rejected)
  - Displays approver's comments in separate box
  - Shows approval level and formatted date/time
  - Link to view associated proforma document

## Key Improvements

### Permission Model

1. **Staff**: Can create, edit, and resubmit rejected requests (cannot see others' requests)
2. **Approvers**: Can review all pending requests, approve/reject, and view their own approval history
3. **Finance**: Can view approved requests (with upload/comment ability), rejected requests, and pending requests (read-only)

### Workflow Enhancements

1. **Rejected Request Resubmission**: Staff can edit and resubmit rejected requests without needing admin intervention
2. **Approver Accountability**: Approvers can track their approval decisions with timestamps and comments
3. **Finance Visibility**: Finance now has visibility into all request statuses for better reconciliation and monitoring

### User Experience

1. **Tabbed Interfaces**: Clear organization of requests by status in each dashboard
2. **Read-only Mode**: Finance can monitor pending requests without risk of accidental modifications
3. **History Tracking**: Approvers can review their decisions with full context

## API Endpoints Summary

| Endpoint                     | Method | Role     | Purpose                            |
| ---------------------------- | ------ | -------- | ---------------------------------- |
| `/requests/`                 | GET    | All      | List requests (filtered by role)   |
| `/requests/approved/`        | GET    | Finance  | List approved requests             |
| `/requests/rejected/`        | GET    | Finance  | List rejected requests             |
| `/requests/finance-pending/` | GET    | Finance  | List pending requests (read-only)  |
| `/requests/pending/`         | GET    | Approver | List pending requests for approval |
| `/requests/my-approvals/`    | GET    | Approver | List approver's approval history   |
| `/requests/{id}/approve/`    | PATCH  | Approver | Approve a request                  |
| `/requests/{id}/reject/`     | PATCH  | Approver | Reject a request                   |

## Testing Recommendations

1. **Staff User Test**:

   - Create a request (PENDING status)
   - Verify it appears in "Pending" tab
   - Reject the request via approver
   - Verify it appears in "Resubmit (Rejected)" tab
   - Edit and resubmit the request

2. **Approver User Test**:

   - View pending requests in "Pending" tab
   - Approve/reject some requests
   - Switch to "My history" tab
   - Verify approval decisions with timestamps and comments

3. **Finance User Test**:
   - Switch between "Approved", "Rejected", and "Pending (View Only)" tabs
   - Verify receipt upload/comment options only available in "Approved" tab
   - Verify "Pending" tab shows "View only" message
   - Verify rejected requests are viewable

## Files Modified

- `backend/procurement/services/workflows.py`
- `backend/procurement/views.py`
- `frontend/src/pages/StaffDashboard.jsx`
- `frontend/src/pages/FinanceDashboard.jsx`
- `frontend/src/pages/ApproverDashboard.jsx`
