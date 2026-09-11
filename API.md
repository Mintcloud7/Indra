# API Reference

## Base URL

```
http://localhost:3001/api
```

## Authentication

All endpoints (except `/auth/login` and `/health`) require a JWT Bearer token:

```
Authorization: Bearer <token>
```

Obtain a token via `POST /api/auth/login`.

## Response Format

### Success

```json
{
  "success": true,
  "data": { ... }
}
```

### Success (Created)

```json
{
  "success": true,
  "data": { ... }
}
// HTTP Status: 201
```

### Paginated Success

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### Error

```json
{
  "success": false,
  "message": "Error description",
  "error_code": "ERROR_CODE"
}
```

## Error Codes

| HTTP Status | Error Code | Description |
|-------------|-----------|-------------|
| 400 | `BAD_REQUEST` | Invalid request body or parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists (e.g., duplicate email) |
| 500 | `INTERNAL_ERROR` | Server error |

## Pagination

Most list endpoints support pagination via query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `limit` | number | 20 | Items per page (max 100) |
| `search` | string | | Full-text search |

---

## Auth

### POST /api/auth/login

Authenticate and receive a JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "roles": ["ADMIN"],
      "permissions": ["*.*"]
    }
  }
}
```

### POST /api/auth/logout

Log out (client-side token removal).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": { "message": "Logged out" }
}
```

### GET /api/auth/me

Get current authenticated user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "phone": "081234567890",
    "avatar": null,
    "isActive": 1,
    "roles": ["ADMIN"],
    "permissions": ["*.*"],
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

### POST /api/auth/change-password

Change current user's password.

**Headers:** `Authorization: Bearer <token>`

**Request:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "message": "Password changed successfully" }
}
```

---

## Users

### GET /api/users

List users (paginated).

**Permission:** `users.read`

**Query Parameters:** `page`, `limit`, `search`

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "admin@example.com",
        "name": "Admin User",
        "phone": "081234567890",
        "isActive": 1,
        "roles": ["ADMIN"],
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ],
    "total": 4,
    "page": 1,
    "limit": 20
  }
}
```

### GET /api/users/technicians

List users with technician role.

**Permission:** `work_orders.read`

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Andi Pratama", "email": "technician@example.com" }
  ]
}
```

### POST /api/users

Create a new user.

**Permission:** `users.create`

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User",
  "phone": "081234567890",
  "isActive": true,
  "roleIds": ["role-uuid"]
}
```

**Response:** `201 Created` with user object.

### PUT /api/users/:id

Update a user.

**Permission:** `users.update`

**Request:** Partial user fields (all optional):
```json
{
  "name": "Updated Name",
  "email": "updated@example.com",
  "phone": "0987654321",
  "isActive": false,
  "password": "newpassword",
  "roleIds": ["role-uuid"]
}
```

**Response:** Updated user object.

### DELETE /api/users/:id

Delete a user.

**Permission:** `users.delete`

**Response:**
```json
{
  "success": true,
  "data": { "message": "User deleted" }
}
```

---

## Roles

### GET /api/roles

List all roles.

**Permission:** `roles.read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "ADMIN",
      "description": "Full system access",
      "permissions": ["*.*"]
    }
  ]
}
```

### GET /api/roles/permissions

List all available permissions.

**Permission:** `roles.read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "work_orders.create",
      "module": "work_orders",
      "action": "create",
      "description": null
    }
  ]
}
```

### POST /api/roles

Create a new role.

**Permission:** `roles.create`

**Request:**
```json
{
  "name": "CUSTOM_ROLE",
  "description": "Custom role description",
  "permissionIds": ["perm-uuid-1", "perm-uuid-2"]
}
```

**Response:** `201 Created` with role object.

### PUT /api/roles/:id

Update a role.

**Permission:** `roles.update`

**Request:**
```json
{
  "name": "UPDATED_ROLE",
  "description": "Updated description",
  "permissionIds": ["perm-uuid-1"]
}
```

**Response:** Updated role object.

### DELETE /api/roles/:id

Delete a role.

**Permission:** `roles.delete`

**Response:**
```json
{
  "success": true,
  "data": { "message": "Role deleted" }
}
```

---

## Assets

### GET /api/assets

List assets (paginated).

**Permission:** `assets.read`

**Query Parameters:** `page`, `limit`, `search`, `assetType`, `status`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "assetCode": "GS-001",
      "assetName": "Generator Set 500kVA",
      "assetType": "Generator",
      "location": "Building A - Power Room",
      "status": "ACTIVE",
      "manufacturer": "Cummins",
      "model": "C500D5",
      "serialNumber": "CUMMINS-GS-2023-001",
      "purchaseDate": "2023-03-15",
      "warrantyEnd": "2025-12-31"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### POST /api/assets

Create an asset.

**Permission:** `assets.create`

**Request:**
```json
{
  "assetCode": "GS-002",
  "assetName": "Generator Set 250kVA",
  "assetType": "Generator",
  "location": "Building B - Power Room",
  "serialNumber": "CUMMINS-GS-2026-002",
  "manufacturer": "Cummins",
  "model": "C250D5",
  "purchaseDate": "2026-01-15",
  "warrantyStart": "2026-01-15",
  "warrantyEnd": "2028-12-31",
  "status": "ACTIVE",
  "description": "Backup generator for Building B"
}
```

**Response:** `201 Created` with asset object.

### GET /api/assets/:id

Get asset detail.

**Permission:** `assets.read`

**Response:** Full asset object with documents, meters, and recent work orders.

### PUT /api/assets/:id

Update an asset.

**Permission:** `assets.update`

**Request:** Partial asset fields.

**Response:** Updated asset object.

### DELETE /api/assets/:id

Delete an asset.

**Permission:** `assets.delete`

**Response:**
```json
{ "success": true, "data": { "message": "Asset deleted" } }
```

### GET /api/assets/:id/documents

List asset documents.

**Permission:** `assets.read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "filename": "manual.pdf",
      "type": "application/pdf",
      "path": "/uploads/123456.pdf",
      "size": 1024000,
      "uploadedBy": "uuid",
      "uploadedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

### POST /api/assets/:id/documents

Upload an asset document.

**Permission:** `assets.create`

**Request:** `multipart/form-data` with `file` field.

**Response:** `201 Created` with document metadata.

### GET /api/assets/:id/meters

List asset meters.

**Permission:** `assets.read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "meterType": "Running Hours",
      "unit": "hours",
      "description": null,
      "latestReading": 4520.5
    }
  ]
}
```

### POST /api/assets/:id/meters

Create a meter for an asset.

**Permission:** `assets.create`

**Request:**
```json
{
  "meterType": "Temperature",
  "unit": "celsius",
  "description": "Ambient temperature sensor"
}
```

**Response:** `201 Created` with meter object.

### POST /api/assets/:id/meters/:meterId/readings

Add a meter reading.

**Permission:** `assets.create`

**Request:**
```json
{
  "value": 4520.5
}
```

**Response:** `201 Created` with reading object.

### GET /api/assets/:id/history

Get asset maintenance history (all work orders for this asset).

**Permission:** `assets.read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "woNumber": "WO-2026-000001",
      "title": "Generator Set Overheating",
      "status": "CLOSED",
      "priority": "HIGH",
      "completedAt": "2026-01-15T00:00:00.000Z"
    }
  ]
}
```

---

## Work Orders

### GET /api/work-orders

List work orders (paginated).

**Permission:** `work_orders.read`

**Query Parameters:** `page`, `limit`, `status`, `priority`, `assignedToId`, `assetId`, `search`

**Status values:** `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `ON_HOLD`, `CLOSED`

**Priority values:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "woNumber": "WO-2026-000001",
      "title": "Generator Set Overheating",
      "description": "GS-001 experiencing high temperature alarm",
      "assetId": "uuid",
      "assetName": "Generator Set 500kVA",
      "reportedById": "uuid",
      "reportedByName": "Budi Santoso",
      "assignedToId": "uuid",
      "assignedToName": "Andi Pratama",
      "priority": "HIGH",
      "status": "CLOSED",
      "dueDate": "2026-01-20T00:00:00.000Z",
      "createdAt": "2026-01-10T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### POST /api/work-orders

Create a work order.

**Permission:** `work_orders.create`

**Request:**
```json
{
  "title": "Pump Bearing Noise",
  "description": "Unusual noise from pump bearing",
  "assetId": "uuid",
  "location": "Building A - Pump Room",
  "priority": "HIGH",
  "status": "OPEN",
  "dueDate": "2026-02-01T00:00:00.000Z",
  "problemDescription": "Grinding noise from pump bearing housing"
}
```

**Response:** `201 Created` with work order object including `woNumber`.

### GET /api/work-orders/:id

Get work order detail.

**Permission:** `work_orders.read`

**Response:** Full work order with status history, checklists, attachments, spare parts.

### PUT /api/work-orders/:id

Update a work order.

**Permission:** `work_orders.update`

**Request:** Partial work order fields.

**Response:** Updated work order object.

### DELETE /api/work-orders/:id

Delete a work order.

**Permission:** `work_orders.delete`

**Response:**
```json
{ "success": true, "data": { "message": "Work Order deleted" } }
```

### POST /api/work-orders/:id/assign

Assign a technician to a work order.

**Permission:** `work_orders.assign`

**Request:**
```json
{
  "assignedToId": "technician-uuid",
  "supervisorId": "supervisor-uuid",
  "dueDate": "2026-02-05T00:00:00.000Z"
}
```

**Response:** Updated work order with status changed to `ASSIGNED`.

### POST /api/work-orders/:id/start

Start work on a work order (ASSIGNED → IN_PROGRESS).

**Permission:** `work_orders.update`

**Response:** Updated work order with `startedAt` timestamp.

### POST /api/work-orders/:id/hold

Put a work order on hold (IN_PROGRESS → ON_HOLD).

**Permission:** `work_orders.update`

**Request:**
```json
{
  "notes": "Waiting for spare part delivery"
}
```

**Response:** Updated work order with status `ON_HOLD`.

### POST /api/work-orders/:id/resume

Resume a work order from hold (ON_HOLD → IN_PROGRESS).

**Permission:** `work_orders.update`

**Response:** Updated work order with status `IN_PROGRESS`.

### POST /api/work-orders/:id/close

Close a work order (→ CLOSED).

**Permission:** `work_orders.close`

**Request:**
```json
{
  "workPerformed": "Replaced bearing housing",
  "rootCause": "Bearing wear due to misalignment",
  "resolution": "Realigned coupling and replaced bearing",
  "notes": "PM schedule updated to check alignment quarterly"
}
```

**Response:** Updated work order with `closedAt` timestamp.

### POST /api/work-orders/:id/checklist

Add a checklist item to a work order.

**Permission:** `work_orders.update`

**Request:**
```json
{
  "title": "Isolate power supply",
  "description": "Disconnect main power before maintenance",
  "required": true
}
```

**Response:** `201 Created` with checklist item.

### PUT /api/work-orders/:id/checklist/:checklistId

Update/complete a checklist item.

**Permission:** `work_orders.update`

**Request:**
```json
{
  "completed": true,
  "notes": "Power isolated and verified"
}
```

**Response:** Updated checklist item.

### POST /api/work-orders/:id/attachments

Upload an attachment to a work order.

**Permission:** `work_orders.update`

**Request:** `multipart/form-data` with `file` field.

Accepted file types: jpeg, jpg, png, gif, pdf, doc, docx, xls, xlsx, txt, csv. Max size: 10MB.

**Response:** `201 Created` with attachment metadata.

### POST /api/work-orders/:id/spare-parts

Add a spare part usage to a work order.

**Permission:** `work_orders.update`

**Request:**
```json
{
  "itemId": "spare-part-uuid",
  "plannedQuantity": 2,
  "usedQuantity": 1,
  "unit": "PCS",
  "unitCost": 850000,
  "totalCost": 850000
}
```

**Response:** `201 Created` with spare part entry.

### PUT /api/work-orders/:id/spare-parts/:sparePartId

Update spare part usage (e.g., update used quantity).

**Permission:** `work_orders.update`

**Request:**
```json
{
  "usedQuantity": 2,
  "totalCost": 1700000
}
```

**Response:** Updated spare part entry.

---

## Preventive Maintenance

### GET /api/preventive-maintenance

List PM schedules (paginated).

**Permission:** `preventive_maintenance.read`

**Query Parameters:** `page`, `limit`, `status`, `frequency`, `assetId`, `assignedToId`, `search`

**Frequency values:** `DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY`, `CUSTOM`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Monthly Genset Inspection",
      "description": "Monthly inspection and maintenance of generator set",
      "assetId": "uuid",
      "assetName": "Generator Set 500kVA",
      "frequency": "MONTHLY",
      "startDate": "2026-01-01T00:00:00.000Z",
      "nextDueDate": "2026-02-01T00:00:00.000Z",
      "assignedToId": "uuid",
      "assignedToName": "Andi Pratama",
      "status": "ACTIVE"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

### POST /api/preventive-maintenance

Create a PM schedule.

**Permission:** `preventive_maintenance.create`

**Request:**
```json
{
  "assetId": "uuid",
  "title": "Quarterly Chiller Service",
  "description": "Quarterly chiller maintenance",
  "frequency": "QUARTERLY",
  "startDate": "2026-01-01",
  "nextDueDate": "2026-04-01",
  "meterType": "Running Hours",
  "meterThreshold": 500,
  "assignedToId": "technician-uuid"
}
```

**Response:** `201 Created` with PM object.

### GET /api/preventive-maintenance/:id

Get PM schedule detail.

**Permission:** `preventive_maintenance.read`

**Response:** Full PM object with checklists, logs, and generated work orders.

### PUT /api/preventive-maintenance/:id

Update a PM schedule.

**Permission:** `preventive_maintenance.update`

**Request:** Partial PM fields.

**Response:** Updated PM object.

### DELETE /api/preventive-maintenance/:id

Delete a PM schedule.

**Permission:** `preventive_maintenance.delete`

**Response:**
```json
{ "success": true, "data": { "message": "Preventive Maintenance deleted" } }
```

### POST /api/preventive-maintenance/:id/generate-wo

Generate a work order from a PM schedule.

**Permission:** `preventive_maintenance.update`

**Response:** `201 Created` with new work order, linked to the PM.

### POST /api/preventive-maintenance/check-due

Check all PMs and generate work orders for due/overdue items.

**Permission:** `preventive_maintenance.read`

**Response:**
```json
{
  "success": true,
  "data": {
    "generatedCount": 2,
    "workOrders": [ ... ]
  }
}
```

---

## Inventory

### GET /api/spare-parts

List spare parts (paginated).

**Permission:** `inventory.read`

**Query Parameters:** `page`, `limit`, `search`, `category`, `warehouseId`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "itemCode": "SP-001",
      "itemName": "Contactor 3P 40A",
      "category": "Electrical",
      "specification": "Schneider LC1D40M7C",
      "unit": "PCS",
      "warehouseId": "uuid",
      "currentStock": 12,
      "minimumStock": 5,
      "maximumStock": 30,
      "unitCost": 850000
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 6, "totalPages": 1 }
}
```

### POST /api/spare-parts

Create a spare part.

**Permission:** `inventory.create`

**Request:**
```json
{
  "itemCode": "SP-007",
  "itemName": "Bearing 6205",
  "category": "Mechanical",
  "specification": "SKF 6205-2RS1",
  "unit": "PCS",
  "warehouseId": "uuid",
  "stockLocation": "A-01-03",
  "currentStock": 10,
  "minimumStock": 3,
  "maximumStock": 20,
  "unitCost": 125000
}
```

**Response:** `201 Created` with spare part object.

### GET /api/spare-parts/:id

Get spare part detail.

**Permission:** `inventory.read`

**Response:** Full spare part object with recent transactions.

### PUT /api/spare-parts/:id

Update a spare part.

**Permission:** `inventory.update`

**Request:** Partial spare part fields.

**Response:** Updated spare part object.

### GET /api/spare-parts/low-stock

List spare parts below minimum stock level.

**Permission:** `inventory.read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "itemCode": "SP-003",
      "itemName": "Fuse 250A",
      "currentStock": 3,
      "minimumStock": 5,
      "deficit": 2
    }
  ]
}
```

### GET /api/warehouses

List all warehouses.

**Permission:** `inventory.read`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Main Warehouse",
      "location": "Building A - Ground Floor",
      "description": "Primary spare parts storage"
    }
  ]
}
```

### POST /api/warehouses

Create a warehouse.

**Permission:** `inventory.create`

**Request:**
```json
{
  "name": "Secondary Warehouse",
  "location": "Building B - Ground Floor",
  "description": "Overflow storage"
}
```

**Response:** `201 Created` with warehouse object.

### GET /api/transactions

List inventory transactions (paginated).

**Permission:** `inventory.read`

**Query Parameters:** `page`, `limit`, `itemId`, `warehouseId`, `transactionType`, `startDate`, `endDate`

**Transaction types:** `IN`, `OUT`, `ADJUSTMENT`, `RETURN`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "itemId": "uuid",
      "itemName": "Contactor 3P 40A",
      "warehouseId": "uuid",
      "warehouseName": "Main Warehouse",
      "transactionType": "IN",
      "quantity": 20,
      "unitCost": 850000,
      "referenceType": null,
      "referenceId": null,
      "notes": "Initial stock",
      "createdBy": "uuid",
      "createdByName": "Admin User",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 }
}
```

### POST /api/stock-in

Stock in (receive inventory).

**Permission:** `inventory.update`

**Request:**
```json
{
  "itemId": "uuid",
  "warehouseId": "uuid",
  "quantity": 10,
  "unitCost": 850000,
  "notes": "Purchase order delivery"
}
```

**Response:** `201 Created` with transaction object.

### POST /api/stock-out

Stock out (consume inventory).

**Permission:** `inventory.update`

**Request:**
```json
{
  "itemId": "uuid",
  "warehouseId": "uuid",
  "quantity": 2,
  "unitCost": 850000,
  "referenceType": "WORK_ORDER",
  "referenceId": "wo-uuid",
  "notes": "WO-2026-000001 usage"
}
```

**Response:** `201 Created` with transaction object.

### POST /api/adjustment

Stock adjustment.

**Permission:** `inventory.update`

**Request:**
```json
{
  "itemId": "uuid",
  "warehouseId": "uuid",
  "quantity": -1,
  "unitCost": 850000,
  "notes": "Damaged item write-off"
}
```

**Response:** `201 Created` with transaction object.

### POST /api/return

Stock return (return unused items).

**Permission:** `inventory.update`

**Request:**
```json
{
  "itemId": "uuid",
  "warehouseId": "uuid",
  "quantity": 1,
  "unitCost": 850000,
  "notes": "Unused from WO-2026-000001"
}
```

**Response:** `201 Created` with transaction object.

---

## Notifications

### GET /api/notifications

List notifications (paginated).

**Query Parameters:** `page`, `limit`, `unreadOnly` (string "true")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "WO_ASSIGNED",
      "title": "Work Order Assigned",
      "message": "WO-2026-000003 has been assigned to you",
      "referenceType": "WORK_ORDER",
      "referenceId": "uuid",
      "read": 0,
      "createdAt": "2026-01-15T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### GET /api/notifications/unread-count

Get count of unread notifications.

**Response:**
```json
{
  "success": true,
  "data": { "count": 3 }
}
```

### GET /api/notifications/:id

Get a single notification.

**Response:** Notification object.

### PUT /api/notifications/:id/read

Mark a notification as read.

**Response:** Updated notification with `read: 1`.

### PUT /api/notifications/read-all

Mark all notifications as read.

**Response:**
```json
{
  "success": true,
  "data": { "message": "All notifications marked as read" }
}
```

---

## Dashboard

### GET /api/dashboard

Get full dashboard data (KPIs, charts, recent items).

**Permission:** `dashboard.read`

**Response:**
```json
{
  "success": true,
  "data": {
    "kpi": {
      "totalAssets": 5,
      "activeAssets": 5,
      "totalWorkOrders": 5,
      "openWorkOrders": 1,
      "overdueWorkOrders": 0,
      "pendingPm": 1,
      "lowStockItems": 1,
      "pendingPr": 0
    },
    "woByStatus": [
      { "name": "OPEN", "value": 1 },
      { "name": "IN_PROGRESS", "value": 1 },
      { "name": "CLOSED", "value": 2 }
    ],
    "woByPriority": [
      { "name": "HIGH", "value": 2 },
      { "name": "CRITICAL", "value": 1 },
      { "name": "MEDIUM", "value": 1 }
    ],
    "maintenanceTrend": [
      { "month": "Jan", "count": 5 },
      { "month": "Feb", "count": 3 }
    ],
    "sparePartUsage": [
      { "name": "Contactor 3P 40A", "quantity": 8 }
    ],
    "recentWorkOrders": [ ... ],
    "upcomingPM": [ ... ],
    "lowStockItems": [ ... ]
  }
}
```

---

## Reports

### GET /api/reports/work-orders

Work order report.

**Permission:** `reports.read`

**Query Parameters:** `startDate`, `endDate`, `status`, `priority`, `assignedToId`, `assetId`

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 5,
    "byStatus": { "OPEN": 1, "IN_PROGRESS": 1, "CLOSED": 3 },
    "byPriority": { "HIGH": 2, "CRITICAL": 1, "MEDIUM": 1, "LOW": 1 },
    "averageCompletionDays": 3.2,
    "workOrders": [ ... ]
  }
}
```

### GET /api/reports/maintenance-cost

Maintenance cost report.

**Permission:** `reports.read`

**Query Parameters:** `startDate`, `endDate`, `assetId`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCost": 12500000,
    "costByAsset": [
      { "assetId": "uuid", "assetName": "Generator Set", "cost": 8500000 }
    ],
    "costByMonth": [
      { "month": "2026-01", "cost": 8500000 }
    ]
  }
}
```

### GET /api/reports/spare-part-usage

Spare part usage report.

**Permission:** `reports.read`

**Query Parameters:** `startDate`, `endDate`, `itemId`, `assetId`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCost": 4250000,
    "byItem": [
      { "itemId": "uuid", "itemName": "Contactor 3P 40A", "quantity": 5, "cost": 4250000 }
    ]
  }
}
```

### GET /api/reports/mttr

Mean Time To Repair report.

**Permission:** `reports.read`

**Query Parameters:** `startDate`, `endDate`, `assetId`

**Response:**
```json
{
  "success": true,
  "data": {
    "averageMttrHours": 4.5,
    "mttrByAsset": [
      { "assetId": "uuid", "assetName": "Generator Set", "mttrHours": 3.2 }
    ]
  }
}
```

### GET /api/reports/mtbf

Mean Time Between Failures report.

**Permission:** `reports.read`

**Query Parameters:** `startDate`, `endDate`, `assetId`

**Response:**
```json
{
  "success": true,
  "data": {
    "averageMtbfHours": 720,
    "mtbfByAsset": [
      { "assetId": "uuid", "assetName": "Generator Set", "mtbfHours": 1200 }
    ]
  }
}
```

### GET /api/reports/asset-history/:assetId

Get complete maintenance history for an asset.

**Permission:** `reports.read`

**Response:**
```json
{
  "success": true,
  "data": {
    "asset": { "id": "uuid", "assetCode": "GS-001", "assetName": "Generator Set" },
    "workOrders": [ ... ],
    "preventiveMaintenance": [ ... ],
    "totalMaintenanceCost": 8500000
  }
}
```

---

## Purchase Requisitions

### GET /api/purchase-requisitions

List purchase requisitions (paginated).

**Permission:** `inventory.read`

**Query Parameters:** `page`, `limit`, `status`, `itemId`

**Status values:** `DRAFT`, `APPROVED`, `SYNCED`, `REJECTED`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "itemId": "uuid",
      "itemName": "Fuse 250A",
      "quantity": 10,
      "unit": "PCS",
      "reason": "Low stock replenishment",
      "currentStock": 3,
      "minimumStock": 5,
      "status": "DRAFT",
      "createdAt": "2026-01-15T00:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 }
}
```

### POST /api/purchase-requisitions

Create a purchase requisition.

**Permission:** `inventory.create`

**Request:**
```json
{
  "itemId": "uuid",
  "quantity": 10,
  "unit": "PCS",
  "reason": "Low stock replenishment"
}
```

**Response:** `201 Created` with PR object. Current stock and minimum stock are auto-populated.

### GET /api/purchase-requisitions/:id

Get PR detail.

**Permission:** `inventory.read`

**Response:** Full PR object.

### PUT /api/purchase-requisitions/:id

Update a PR (status change).

**Permission:** `inventory.update`

**Request:**
```json
{
  "status": "APPROVED"
}
```

**Response:** Updated PR object.

### POST /api/purchase-requisitions/:id/sync-zahir

Sync a PR to Zahir Accounting.

**Permission:** `inventory.update`

**Response:** `201 Created` with integration job object. The PR is queued for sync.

---

## Integration (Zahir)

### GET /api/integrations/zahir/config

Get Zahir integration configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "apiUrl": "https://api.zahir.example.com",
    "apiKey": "****",
    "companyId": "COMP-001",
    "syncInventory": true,
    "syncWorkOrders": true
  }
}
```

### POST /api/integrations/zahir/test

Test connection to Zahir API.

**Response:**
```json
{
  "success": true,
  "data": { "connected": true }
}
```

### PUT /api/integrations/zahir/config

Update Zahir configuration.

**Request:**
```json
{
  "apiUrl": "https://api.zahir.example.com",
  "apiKey": "new-api-key",
  "companyId": "COMP-001",
  "syncInventory": true,
  "syncWorkOrders": true
}
```

**Response:** Updated configuration.

### GET /api/integrations/jobs

List integration jobs.

**Query Parameters:** `status`, `type`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "INVENTORY_SYNC",
      "referenceType": "spare_part",
      "referenceId": "uuid",
      "status": "SUCCESS",
      "attempts": 1,
      "maxAttempts": 5,
      "createdAt": "2026-01-15T00:00:00.000Z",
      "processedAt": "2026-01-15T00:01:00.000Z"
    }
  ]
}
```

### POST /api/integrations/jobs/:id/retry

Manually retry a failed job.

**Response:** Updated job with status `PENDING` and reset attempts.

### GET /api/integrations/logs

List integration logs.

**Query Parameters:** `page`, `limit`, `type`, `status`, `referenceType`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "INVENTORY_SYNC",
      "status": "SUCCESS",
      "responseStatus": 200,
      "responseMessage": "Synced successfully",
      "duration": 245,
      "createdAt": "2026-01-15T00:01:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
```

### GET /api/integrations/failed-jobs

List dead letter (failed) integration jobs.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "PURCHASE_REQ_SYNC",
      "payload": { ... },
      "lastError": "Zahir API timeout",
      "attempts": 5,
      "createdAt": "2026-01-15T00:00:00.000Z"
    }
  ]
}
```

---

## Health

### GET /api/health

Public health check endpoint.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-01-15T00:00:00.000Z"
  }
}
```
