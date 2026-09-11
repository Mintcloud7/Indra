# Database

SQLite via sql.js (WASM). Single-file database (`dev.db`) with in-memory runtime and file persistence.

## Tables

### Auth & RBAC

#### `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| email | TEXT | UNIQUE, NOT NULL | Login email |
| password | TEXT | NOT NULL | bcrypt hashed password |
| name | TEXT | NOT NULL | Display name |
| phone | TEXT | | Phone number |
| avatar | TEXT | | Avatar URL |
| isActive | INTEGER | DEFAULT 1 | Active flag |
| createdAt | TEXT | DEFAULT datetime('now') | Creation timestamp |
| updatedAt | TEXT | DEFAULT datetime('now') | Last update timestamp |

#### `roles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | UNIQUE, NOT NULL | Role name (ADMIN, SUPERVISOR, etc.) |
| description | TEXT | | Role description |
| createdAt | TEXT | DEFAULT datetime('now') | |
| updatedAt | TEXT | DEFAULT datetime('now') | |

#### `permissions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | UNIQUE, NOT NULL | Permission name (module.action) |
| module | TEXT | NOT NULL | Module name |
| action | TEXT | NOT NULL | Action name |
| description | TEXT | | Permission description |
| createdAt | TEXT | DEFAULT datetime('now') | |

#### `user_roles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| userId | TEXT | NOT NULL, FK users(id) CASCADE | |
| roleId | TEXT | NOT NULL, FK roles(id) CASCADE | |
| | | UNIQUE(userId, roleId) | |

#### `role_permissions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| roleId | TEXT | NOT NULL, FK roles(id) CASCADE | |
| permissionId | TEXT | NOT NULL, FK permissions(id) CASCADE | |
| | | UNIQUE(roleId, permissionId) | |

---

### Assets

#### `assets`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| assetCode | TEXT | UNIQUE, NOT NULL | Unique asset code (e.g. GS-001) |
| assetName | TEXT | NOT NULL | Asset name |
| assetType | TEXT | NOT NULL | Type (Generator, HVAC, Electrical, etc.) |
| location | TEXT | NOT NULL | Physical location |
| serialNumber | TEXT | | Serial number |
| manufacturer | TEXT | | Manufacturer name |
| model | TEXT | | Model number |
| purchaseDate | TEXT | | ISO date |
| warrantyStart | TEXT | | ISO date |
| warrantyEnd | TEXT | | ISO date |
| status | TEXT | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE, RETIRED |
| description | TEXT | | Description |
| createdAt | TEXT | DEFAULT datetime('now') | |
| updatedAt | TEXT | DEFAULT datetime('now') | |

#### `asset_documents`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| assetId | TEXT | NOT NULL, FK assets(id) CASCADE | |
| filename | TEXT | NOT NULL | Stored filename |
| type | TEXT | NOT NULL | MIME type category |
| path | TEXT | NOT NULL | File path |
| size | INTEGER | NOT NULL | File size in bytes |
| uploadedBy | TEXT | NOT NULL, FK users(id) | |
| uploadedAt | TEXT | DEFAULT datetime('now') | |

#### `asset_meters`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| assetId | TEXT | NOT NULL, FK assets(id) CASCADE | |
| meterType | TEXT | NOT NULL | Running Hours, Temperature, etc. |
| unit | TEXT | NOT NULL | hours, celsius, etc. |
| description | TEXT | | |
| createdAt | TEXT | DEFAULT datetime('now') | |

#### `asset_meter_readings`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| meterId | TEXT | NOT NULL, FK asset_meters(id) CASCADE | |
| assetId | TEXT | NOT NULL, FK assets(id) CASCADE | |
| value | REAL | NOT NULL | Reading value |
| readingDate | TEXT | DEFAULT datetime('now') | |
| recordedBy | TEXT | NOT NULL, FK users(id) | |

---

### Work Orders

#### `work_orders`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| woNumber | TEXT | UNIQUE, NOT NULL | WO-YYYY-NNNNNN |
| title | TEXT | NOT NULL | Work order title |
| description | TEXT | | Description |
| assetId | TEXT | FK assets(id) | Associated asset |
| location | TEXT | | Work location |
| reportedById | TEXT | NOT NULL, FK users(id) | Reporter |
| supervisorId | TEXT | FK users(id) | Assigned supervisor |
| assignedToId | TEXT | FK users(id) | Assigned technician |
| priority | TEXT | DEFAULT 'MEDIUM' | LOW, MEDIUM, HIGH, CRITICAL |
| status | TEXT | DEFAULT 'OPEN' | OPEN, ASSIGNED, IN_PROGRESS, ON_HOLD, CLOSED |
| dueDate | TEXT | | Due date |
| createdAt | TEXT | DEFAULT datetime('now') | |
| assignedAt | TEXT | | When assigned |
| startedAt | TEXT | | When work started |
| completedAt | TEXT | | When work completed |
| closedAt | TEXT | | When WO closed |
| problemDescription | TEXT | | Problem details |
| repairInstruction | TEXT | | Repair instructions |
| workPerformed | TEXT | | Work performed |
| rootCause | TEXT | | Root cause analysis |
| resolution | TEXT | | Resolution details |
| notes | TEXT | | Additional notes |

#### `work_order_status_history`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| woId | TEXT | NOT NULL, FK work_orders(id) CASCADE | |
| fromStatus | TEXT | | Previous status |
| toStatus | TEXT | NOT NULL | New status |
| changedBy | TEXT | NOT NULL, FK users(id) | |
| notes | TEXT | | Status change notes |
| createdAt | TEXT | DEFAULT datetime('now') | |

#### `work_order_checklists`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| woId | TEXT | NOT NULL, FK work_orders(id) CASCADE | |
| title | TEXT | NOT NULL | Checklist item title |
| description | TEXT | | |
| required | INTEGER | DEFAULT 1 | Is required |
| completed | INTEGER | DEFAULT 0 | Completion status |
| completedBy | TEXT | FK users(id) | |
| completedAt | TEXT | | |
| notes | TEXT | | |

#### `work_order_attachments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| woId | TEXT | NOT NULL, FK work_orders(id) CASCADE | |
| filename | TEXT | NOT NULL | Stored filename |
| originalName | TEXT | NOT NULL | Original filename |
| mimeType | TEXT | NOT NULL | |
| path | TEXT | NOT NULL | File path |
| size | INTEGER | NOT NULL | File size in bytes |
| uploadedBy | TEXT | NOT NULL, FK users(id) | |
| createdAt | TEXT | DEFAULT datetime('now') | |

#### `work_order_spare_parts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| woId | TEXT | NOT NULL, FK work_orders(id) CASCADE | |
| itemId | TEXT | NOT NULL, FK spare_parts(id) | |
| plannedQuantity | REAL | | Planned quantity |
| usedQuantity | REAL | | Actual used quantity |
| unit | TEXT | | Unit of measure |
| unitCost | REAL | DEFAULT 0 | Cost per unit |
| totalCost | REAL | DEFAULT 0 | Total cost |
| createdAt | TEXT | DEFAULT datetime('now') | |

---

### Preventive Maintenance

#### `preventive_maintenance`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| assetId | TEXT | NOT NULL, FK assets(id) | Associated asset |
| title | TEXT | NOT NULL | PM title |
| description | TEXT | | |
| frequency | TEXT | DEFAULT 'MONTHLY' | DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, CUSTOM |
| customIntervalDays | INTEGER | | Custom interval in days |
| startDate | TEXT | NOT NULL | Schedule start date |
| nextDueDate | TEXT | NOT NULL | Next due date |
| meterType | TEXT | | Meter-based trigger type |
| meterThreshold | REAL | | Meter threshold value |
| assignedToId | TEXT | FK users(id) | Assigned technician |
| status | TEXT | DEFAULT 'ACTIVE' | ACTIVE, INACTIVE |
| createdAt | TEXT | DEFAULT datetime('now') | |
| updatedAt | TEXT | DEFAULT datetime('now') | |

#### `pm_checklists`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| pmId | TEXT | NOT NULL, FK preventive_maintenance(id) CASCADE | |
| title | TEXT | NOT NULL | Checklist item |
| description | TEXT | | |
| required | INTEGER | DEFAULT 1 | |
| createdAt | TEXT | DEFAULT datetime('now') | |

#### `pm_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| pmId | TEXT | NOT NULL, FK preventive_maintenance(id) CASCADE | |
| woId | TEXT | | Associated work order |
| completedAt | TEXT | DEFAULT datetime('now') | |
| notes | TEXT | | |

#### `pm_wos`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| pmId | TEXT | NOT NULL, FK preventive_maintenance(id) CASCADE | |
| woId | TEXT | NOT NULL, FK work_orders(id) CASCADE | |
| createdAt | TEXT | DEFAULT datetime('now') | |
| | | UNIQUE(pmId, woId) | |

---

### Inventory

#### `warehouses`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | UNIQUE, NOT NULL | Warehouse name |
| location | TEXT | | Physical location |
| description | TEXT | | |
| createdAt | TEXT | DEFAULT datetime('now') | |
| updatedAt | TEXT | DEFAULT datetime('now') | |

#### `spare_parts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| itemCode | TEXT | UNIQUE, NOT NULL | Item code (SP-001) |
| itemName | TEXT | NOT NULL | Item name |
| category | TEXT | | Category (Electrical, Mechanical, etc.) |
| specification | TEXT | | Specification |
| unit | TEXT | DEFAULT 'PCS' | Unit of measure |
| warehouseId | TEXT | FK warehouses(id) | |
| stockLocation | TEXT | | Shelf/bin location |
| currentStock | REAL | DEFAULT 0 | Current quantity |
| minimumStock | REAL | DEFAULT 0 | Min stock level |
| maximumStock | REAL | DEFAULT 0 | Max stock level |
| unitCost | REAL | DEFAULT 0 | Cost per unit |
| zahirItemId | TEXT | | Zahir accounting item ID |
| lastSync | TEXT | | Last sync timestamp |
| createdAt | TEXT | DEFAULT datetime('now') | |
| updatedAt | TEXT | DEFAULT datetime('now') | |

#### `inventory_transactions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| itemId | TEXT | NOT NULL, FK spare_parts(id) | |
| warehouseId | TEXT | NOT NULL, FK warehouses(id) | |
| transactionType | TEXT | NOT NULL | IN, OUT, ADJUSTMENT, RETURN |
| quantity | REAL | NOT NULL | Transaction quantity |
| unitCost | REAL | DEFAULT 0 | |
| referenceType | TEXT | | WORK_ORDER, PURCHASE_ORDER, etc. |
| referenceId | TEXT | | Reference entity ID |
| notes | TEXT | | |
| createdBy | TEXT | NOT NULL, FK users(id) | |
| createdAt | TEXT | DEFAULT datetime('now') | |

---

### Notifications

#### `notifications`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| userId | TEXT | NOT NULL, FK users(id) CASCADE | |
| type | TEXT | NOT NULL | WO_ASSIGNED, WO_CLOSED, LOW_STOCK, etc. |
| title | TEXT | NOT NULL | |
| message | TEXT | NOT NULL | |
| referenceType | TEXT | | Entity type reference |
| referenceId | TEXT | | Entity ID reference |
| read | INTEGER | DEFAULT 0 | Read status |
| createdAt | TEXT | DEFAULT datetime('now') | |

---

### Purchase Requisitions

#### `purchase_requisitions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| itemId | TEXT | NOT NULL, FK spare_parts(id) | |
| quantity | REAL | NOT NULL | Requested quantity |
| unit | TEXT | | Unit of measure |
| reason | TEXT | | Reason for requisition |
| currentStock | REAL | | Current stock at request time |
| minimumStock | REAL | | Minimum stock level |
| status | TEXT | DEFAULT 'DRAFT' | DRAFT, APPROVED, SYNCED, REJECTED |
| externalPrId | TEXT | | Zahir PR ID |
| syncStatus | TEXT | | Sync status |
| syncError | TEXT | | Sync error message |
| createdAt | TEXT | DEFAULT datetime('now') | |
| updatedAt | TEXT | DEFAULT datetime('now') | |

---

### Integration

#### `integration_configs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| key | TEXT | UNIQUE, NOT NULL | Config key |
| value | TEXT | | Config value |
| encrypted | INTEGER | DEFAULT 0 | Is value encrypted |
| description | TEXT | | |
| createdAt | TEXT | DEFAULT datetime('now') | |
| updatedAt | TEXT | DEFAULT datetime('now') | |

#### `integration_jobs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| type | TEXT | NOT NULL | INVENTORY_SYNC, PURCHASE_REQ_SYNC, etc. |
| referenceType | TEXT | | Source entity type |
| referenceId | TEXT | | Source entity ID |
| payload | TEXT | NOT NULL | JSON payload |
| status | TEXT | DEFAULT 'PENDING' | PENDING, PROCESSING, SUCCESS, FAILED, DEAD_LETTER |
| attempts | INTEGER | DEFAULT 0 | Current attempt count |
| maxAttempts | INTEGER | DEFAULT 5 | Maximum retry attempts |
| nextRetryAt | TEXT | | Next retry timestamp |
| lastError | TEXT | | Last error message |
| idempotencyKey | TEXT | UNIQUE | Idempotency key |
| createdAt | TEXT | DEFAULT datetime('now') | |
| processedAt | TEXT | | When processed |

#### `integration_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| type | TEXT | NOT NULL | Log type |
| endpoint | TEXT | | API endpoint |
| requestId | TEXT | | Request ID |
| referenceType | TEXT | | Entity type |
| referenceId | TEXT | | Entity ID |
| status | TEXT | NOT NULL | CREATED, SUCCESS, FAILED, RETRY, DEAD_LETTER |
| responseStatus | INTEGER | | HTTP status code |
| responseMessage | TEXT | | Response message |
| duration | INTEGER | | Duration in ms |
| createdAt | TEXT | DEFAULT datetime('now') | |

#### `webhook_events`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| externalEventId | TEXT | UNIQUE | External event dedup key |
| source | TEXT | NOT NULL | Event source (zahir) |
| eventType | TEXT | NOT NULL | Event type |
| payload | TEXT | NOT NULL | JSON payload |
| status | TEXT | DEFAULT 'RECEIVED' | RECEIVED, PROCESSED, FAILED |
| processedAt | TEXT | | |
| error | TEXT | | |
| createdAt | TEXT | DEFAULT datetime('now') | |

---

### Audit

#### `audit_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| userId | TEXT | FK users(id) | Acting user |
| action | TEXT | NOT NULL | CREATE, UPDATE, DELETE, LOGIN, etc. |
| entity | TEXT | NOT NULL | Entity type |
| entityId | TEXT | | Entity ID |
| oldValue | TEXT | | JSON of previous state |
| newValue | TEXT | | JSON of new state |
| ipAddress | TEXT | | Client IP |
| userAgent | TEXT | | Client user agent |
| createdAt | TEXT | DEFAULT datetime('now') | |

---

## Relationships (Text ER Diagram)

```
users ──1:N── user_roles ──N:1── roles ──1:N── role_permissions ──N:1── permissions

users ──1:N── work_orders (reportedById)
users ──1:N── work_orders (supervisorId)
users ──1:N── work_orders (assignedToId)
users ──1:N── work_order_status_history (changedBy)
users ──1:N── work_order_checklists (completedBy)
users ──1:N── work_order_attachments (uploadedBy)
users ──1:N── inventory_transactions (createdBy)
users ──1:N── asset_documents (uploadedBy)
users ──1:N── asset_meter_readings (recordedBy)
users ──1:N── notifications (userId)
users ──1:N── audit_logs (userId)

assets ──1:N── work_orders (assetId)
assets ──1:N── preventive_maintenance (assetId)
assets ──1:N── asset_documents (assetId)
assets ──1:N── asset_meters (assetId)
assets ──1:N── asset_meter_readings (assetId)

asset_meters ──1:N── asset_meter_readings (meterId)

work_orders ──1:N── work_order_status_history (woId)
work_orders ──1:N── work_order_checklists (woId)
work_orders ──1:N── work_order_attachments (woId)
work_orders ──1:N── work_order_spare_parts (woId)
work_orders ──1:N── pm_wos (woId)

preventive_maintenance ──1:N── pm_checklists (pmId)
preventive_maintenance ──1:N── pm_logs (pmId)
preventive_maintenance ──1:N── pm_wos (pmId)

warehouses ──1:N── spare_parts (warehouseId)
warehouses ──1:N── inventory_transactions (warehouseId)

spare_parts ──1:N── inventory_transactions (itemId)
spare_parts ──1:N── work_order_spare_parts (itemId)
spare_parts ──1:N── purchase_requisitions (itemId)
```

## Indexes

```sql
-- RBAC
idx_user_roles_user          ON user_roles(userId)
idx_user_roles_role          ON user_roles(roleId)
idx_role_permissions_role    ON role_permissions(roleId)

-- Assets
idx_assets_code              ON assets(assetCode)
idx_assets_status            ON assets(status)

-- Work Orders
idx_wo_status                ON work_orders(status)
idx_wo_number                ON work_orders(woNumber)
idx_wo_asset                 ON work_orders(assetId)
idx_wo_assigned              ON work_orders(assignedToId)
idx_wo_supervisor            ON work_orders(supervisorId)
idx_wo_reported              ON work_orders(reportedById)
idx_wo_due                   ON work_orders(dueDate)
idx_wo_created               ON work_orders(createdAt)
idx_wo_history_wo            ON work_order_status_history(woId)
idx_wo_checklist_wo          ON work_order_checklists(woId)
idx_wo_attach_wo             ON work_order_attachments(woId)
idx_wo_spare_wo              ON work_order_spare_parts(woId)

-- Preventive Maintenance
idx_pm_asset                 ON preventive_maintenance(assetId)
idx_pm_due                   ON preventive_maintenance(nextDueDate)
idx_pm_status                ON preventive_maintenance(status)

-- Inventory
idx_spare_code               ON spare_parts(itemCode)
idx_spare_warehouse          ON spare_parts(warehouseId)
idx_inv_trans_item           ON inventory_transactions(itemId)
idx_inv_trans_warehouse      ON inventory_transactions(warehouseId)
idx_inv_trans_type           ON inventory_transactions(transactionType)
idx_inv_trans_created        ON inventory_transactions(createdAt)

-- Notifications
idx_notif_user               ON notifications(userId)
idx_notif_read               ON notifications(read)

-- Integration
idx_jobs_status              ON integration_jobs(status)
idx_jobs_retry               ON integration_jobs(nextRetryAt)
idx_jobs_type                ON integration_jobs(type)
idx_logs_type                ON integration_logs(type)
idx_logs_created             ON integration_logs(createdAt)

-- Audit
idx_audit_user               ON audit_logs(userId)
idx_audit_entity             ON audit_logs(entity, entityId)
idx_audit_created            ON audit_logs(createdAt)
```

## Data Types

All columns use SQLite's type system:

| SQLite Type | Used For | Examples |
|-------------|----------|----------|
| TEXT | Strings, UUIDs, ISO timestamps | UUIDs, names, dates as ISO 8601 |
| INTEGER | Booleans (0/1), counts, sizes | `isActive`, `attempts`, `size` |
| REAL | Decimal numbers | `unitCost`, `currentStock`, `quantity` |

SQLite does not enforce column types strictly, but the schema defines expected types for each column.

## Migration Approach

The migration system is a single-step schema application:

1. `migrate()` reads `schema.sql` in full
2. Executes `db.exec(schema)` which runs all DDL statements
3. All statements use `IF NOT EXISTS`, making migrations idempotent
4. No version tracking -- schema changes are applied by adding/modifying `schema.sql`
5. For breaking changes, the `seed` command clears and re-populates all data

This is a simple approach suitable for single-tenant deployments. For multi-tenant or production environments with data preservation needs, a versioned migration system (e.g., Knex migrations) should be adopted.
