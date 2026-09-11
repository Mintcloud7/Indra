# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (React)                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ AuthCtx  │  │ NotifCtx │  │ Router   │  │ API Client     │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                                                                 │
│  Pages: Dashboard │ Work Orders │ Assets │ PM │ Inventory │ ... │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (JSON)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Server (Express.js)                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Middleware Chain                       │   │
│  │  CORS → JSON Parser → Static Files → Auth → RBAC → ...  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Route Handlers                        │   │
│  │  Auth │ Users │ Roles │ Assets │ WO │ PM │ Inventory │..│   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Service Layer                         │   │
│  │  Business logic, data access, validation                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Database Layer (sql.js/WASM)                │   │
│  │  SQLite in-memory → File persistence                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Integration Layer                           │   │
│  │  ZahirAdapter → IntegrationQueue → Retry → Webhook      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Backend Architecture

### Express.js Application

Entry point: `server/src/server.ts`

```
server.ts
├── Load environment (dotenv)
├── Create Express app
├── Configure middleware (CORS, JSON, static files)
├── Mount routes
│   ├── /api/health           (public)
│   ├── /api/auth/*           (public)
│   ├── /api/users/*          (authenticated)
│   ├── /api/roles/*          (authenticated)
│   ├── /api/assets/*         (authenticated)
│   ├── /api/work-orders/*    (authenticated)
│   ├── /api/preventive-maintenance/* (authenticated)
│   ├── /api/spare-parts/*    (authenticated)
│   ├── /api/warehouses/*     (authenticated)
│   ├── /api/transactions/*   (authenticated)
│   ├── /api/stock-in         (authenticated)
│   ├── /api/stock-out        (authenticated)
│   ├── /api/adjustment       (authenticated)
│   ├── /api/return           (authenticated)
│   ├── /api/notifications/*  (authenticated)
│   ├── /api/reports/*        (authenticated)
│   ├── /api/dashboard/*      (authenticated)
│   └── /api/purchase-requisitions/* (authenticated)
├── Error handler middleware
├── Run database migrations
└── Start listening on PORT
```

### Middleware Chain

```
Request
  │
  ▼
cors()                          -- Cross-origin resource sharing
  │
  ▼
express.json()                  -- Parse JSON body (10MB limit)
  │
  ▼
express.static('uploads')       -- Serve uploaded files
  │
  ▼
authenticate (JWT)              -- Verify Bearer token, attach user to req
  │
  ▼
requirePermission(module, action) -- Check RBAC permission
  │
  ▼
validate(schema)                -- Zod schema validation (where applicable)
  │
  ▼
Route Handler                   -- Business logic
  │
  ▼
logAudit(...)                   -- Write audit log (on mutations)
  │
  ▼
sendSuccess/sendError           -- Standardized JSON response
  │
  ▼
errorHandler                    -- Catch unhandled errors
```

### Service Layer

Each module follows the same pattern:

```
module/
├── module.routes.ts    -- Express Router, validation, audit logging
├── module.service.ts   -- Business logic, database queries
└── (types inline)      -- Uses shared/types.ts
```

Services interact directly with the sql.js database instance via `getDb()`. Queries are executed with parameterized SQL. Results are formatted from sql.js result format (`{ columns, values }`) to plain objects.

### Database Layer

- **Engine**: sql.js (SQLite compiled to WebAssembly)
- **Runtime**: In-memory database with file persistence (`dev.db`)
- **WAL Mode**: Enabled for better concurrent read performance
- **Foreign Keys**: Enforced via `PRAGMA foreign_keys=ON`

```
Startup:
  getDb() → Initialize sql.js → Load file buffer → Return DB instance
  migrate() → Read schema.sql → db.exec(schema)

Runtime:
  All queries go through getDb() → singleton pattern

Shutdown:
  SIGINT/SIGTERM → saveDb() → Export DB to buffer → Write to file → closeDb()
```

## Frontend Architecture

### React Application

```
App.tsx
├── BrowserRouter
│   ├── AuthProvider           -- JWT token management, user state
│   │   └── NotificationProvider  -- Toast notifications, unread count
│   │       └── Routes
│   │           ├── /login    -- Public route
│   │           └── /*        -- ProtectedRoute → Layout → Pages
│   │               ├── /dashboard
│   │               ├── /work-orders/*
│   │               ├── /assets/*
│   │               ├── /preventive-maintenance/*
│   │               ├── /inventory/*
│   │               ├── /reports/*
│   │               ├── /admin/*
│   │               ├── /integrations/*
│   │               └── /notifications
```

### State Management

- **AuthContext** -- User state, JWT token, login/logout, permission checking
- **NotificationContext** -- Toast notifications, unread notification count
- **Local state** -- Page-level `useState`/`useEffect` for data fetching
- **No global store** -- Data is fetched per-page and cached locally

### API Client

Custom `ApiClient` class (`client/src/api/client.ts`):

```
ApiClient
├── token: string | null
├── setToken(token)          -- Set/clear JWT
├── request<T>(method, path, body?)  -- Core fetch wrapper
├── get<T>(path)
├── post<T>(path, body?)
├── put<T>(path, body?)
├── delete<T>(path)
└── uploadFile<T>(path, file, fieldName?)  -- FormData upload
```

- Automatically attaches `Authorization: Bearer <token>` header
- Handles JSON parsing and error extraction
- Base URL from `VITE_API_URL` env variable

## Database Layer

### Schema Management

```
schema.sql          -- DDL statements (CREATE TABLE, CREATE INDEX)
migrate.ts          -- Reads schema.sql, executes via db.exec()
seed.ts             -- Populates sample data after migration
connection.ts       -- sql.js initialization and persistence
```

### Table Overview

```
Auth & RBAC:
  users ←── user_roles ──→ roles ←── role_permissions ──→ permissions

Assets:
  assets
  assets ←── asset_documents
  assets ←── asset_meters ←── asset_meter_readings

Work Orders:
  work_orders
  work_orders ←── work_order_status_history
  work_orders ←── work_order_checklists
  work_orders ←── work_order_attachments
  work_orders ←── work_order_spare_parts ──→ spare_parts

Preventive Maintenance:
  preventive_maintenance
  preventive_maintenance ←── pm_checklists
  preventive_maintenance ←── pm_logs
  preventive_maintenance ←── pm_wos ──→ work_orders

Inventory:
  warehouses ←── spare_parts
  spare_parts ←── inventory_transactions
  warehouses ←── inventory_transactions

Notifications:
  notifications ──→ users

Purchase Requisitions:
  purchase_requisitions ──→ spare_parts

Integration:
  integration_configs
  integration_jobs
  integration_logs
  webhook_events

Audit:
  audit_logs ──→ users
```

## Authentication Flow

```
1. Client POST /api/auth/login { email, password }
2. Server validates credentials (bcrypt)
3. Server queries user roles and permissions
4. Server signs JWT: { id, email, name, roles[], permissions[] }
5. Server returns { token, user }
6. Client stores token in localStorage
7. Client sets token on ApiClient instance
8. Subsequent requests: Authorization: Bearer <token>
9. Server middleware: verify JWT → attach user to req
10. RBAC middleware: check req.user.permissions for required permission
```

### JWT Token Payload

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "roles": ["ADMIN"],
  "permissions": ["work_orders.read", "assets.*", "*.*"],
  "iat": 1234567890,
  "exp": 1234567890
}
```

### RBAC Permission Format

Pattern: `module.action`

Modules: `dashboard`, `work_orders`, `preventive_maintenance`, `assets`, `inventory`, `reports`, `users`, `roles`, `settings`, `integrations`, `audit_logs`

Actions: `create`, `read`, `update`, `delete`, `assign`, `close`

Wildcard support:
- `work_orders.*` -- All actions on work_orders
- `*.*` -- All permissions (admin)

## Integration Architecture

### Zahir Adapter Pattern

```
┌─────────────────────────────────────────────────┐
│              IZahirAdapter (Interface)           │
│  testConnection()                               │
│  syncInventoryItem(item)                        │
│  syncPurchaseRequisition(pr)                    │
│  syncFixedAsset(asset)                          │
│  sendStockAdjustment(transaction)               │
└────────────────────┬────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ MockZahirAdapter │  │ RealZahirAdapter │
│ (sandbox/dev)    │  │ (production)     │
│ Always succeeds  │  │ HTTP calls to    │
│ Returns mock IDs │  │ Zahir REST API   │
└──────────────────┘  └──────────────────┘
```

### Queue and Retry

```
Create Job → integration_jobs (PENDING, nextRetryAt = now + 60s)
     │
     ▼
Process Job → Mark as PROCESSING
     │
     ├── Success → Mark as SUCCESS, log success
     │
     └── Failure → Increment attempts
              │
              ├── attempts < maxAttempts → Schedule retry
              │   Status: PENDING, nextRetryAt += backoff
              │
              └── attempts >= maxAttempts → DEAD_LETTER
                  Log error, manual intervention needed
```

### Exponential Backoff Schedule

| Attempt | Delay | Cumulative |
|---------|-------|------------|
| 1 | 60s | 1 min |
| 2 | 300s | 6 min |
| 3 | 900s | 21 min |
| 4 | 1800s | 51 min |
| 5 | 3600s | 101 min |

### Idempotency

Jobs can be created with an optional `idempotencyKey`. If a job with the same key exists and is not in FAILED/DEAD_LETTER status, the existing job is returned instead of creating a duplicate.

### Webhook Handling

Incoming webhooks from Zahir are stored in `webhook_events` with deduplication via `externalEventId`. Processed events are marked as `PROCESSED`.

## File Structure

```
cmms-zahir/
├── package.json
├── README.md
├── ARCHITECTURE.md
├── DATABASE.md
├── ZAHIR-INTEGRATION.md
├── API.md
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── .env
│   ├── dev.db                          # SQLite database file
│   │
│   ├── prisma/
│   │   └── schema.prisma               # Reference schema
│   │
│   ├── uploads/                        # Uploaded files
│   │
│   └── src/
│       ├── server.ts                   # Entry point
│       │
│       ├── database/
│       │   ├── connection.ts           # sql.js init, save, close
│       │   ├── migrate.ts              # Schema migration
│       │   ├── schema.sql              # DDL (CREATE TABLE/INDEX)
│       │   └── seed.ts                 # Sample data seeder
│       │
│       ├── middleware/
│       │   ├── auth.ts                 # JWT authentication
│       │   ├── rbac.ts                 # Role-Based Access Control
│       │   ├── audit.ts                # Audit log writer
│       │   ├── validate.ts             # Zod validation
│       │   └── error.ts                # Error handler
│       │
│       ├── shared/
│       │   ├── types.ts                # TypeScript interfaces
│       │   ├── errors.ts               # Custom error classes
│       │   ├── response.ts             # Standardized responses
│       │   └── utils.ts                # generateId, paginate, etc.
│       │
│       └── modules/
│           ├── auth/
│           │   ├── auth.routes.ts
│           │   └── auth.service.ts
│           ├── users/
│           │   ├── users.routes.ts
│           │   └── users.service.ts
│           ├── roles/
│           │   ├── roles.routes.ts
│           │   └── roles.service.ts
│           ├── assets/
│           │   ├── assets.routes.ts
│           │   └── assets.service.ts
│           ├── work-orders/
│           │   ├── work-orders.routes.ts
│           │   └── work-orders.service.ts
│           ├── preventive-maintenance/
│           │   ├── pm.routes.ts
│           │   └── pm.service.ts
│           ├── inventory/
│           │   ├── inventory.routes.ts
│           │   └── inventory.service.ts
│           ├── notifications/
│           │   ├── notifications.routes.ts
│           │   └── notifications.service.ts
│           ├── dashboard/
│           │   ├── dashboard.routes.ts
│           │   └── dashboard.service.ts
│           ├── reports/
│           │   ├── reports.routes.ts
│           │   └── reports.service.ts
│           ├── purchase-requisitions/
│           │   ├── pr.routes.ts
│           │   └── pr.service.ts
│           └── integrations/
│               ├── zahir/
│               │   └── zahir.adapter.ts
│               └── queue/
│                   └── integration-queue.service.ts
│
└── client/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env.example
    ├── .env
    │
    └── src/
        ├── main.tsx                    # React entry point
        ├── App.tsx                     # Router and providers
        ├── index.css                   # Tailwind base styles
        ├── vite-env.d.ts
        │
        ├── api/
        │   ├── client.ts              # ApiClient class
        │   └── types.ts               # Frontend type definitions
        │
        ├── context/
        │   ├── AuthContext.tsx          # Auth state management
        │   └── NotificationContext.tsx  # Toast notifications
        │
        ├── hooks/                      # Custom React hooks
        │
        ├── components/
        │   ├── auth/
        │   │   └── ProtectedRoute.tsx
        │   ├── layout/
        │   │   ├── Layout.tsx
        │   │   ├── Sidebar.tsx
        │   │   ├── Header.tsx
        │   │   └── Breadcrumb.tsx
        │   ├── charts/                 # Recharts wrappers
        │   └── ui/                     # Button, Input, Card, Badge, etc.
        │
        └── pages/
            ├── auth/                   # LoginPage
            ├── dashboard/              # DashboardPage
            ├── work-orders/            # List, Detail, Create
            ├── assets/                 # List, Detail, Create
            ├── preventive-maintenance/ # List, Detail, Create
            ├── inventory/              # SpareParts, Warehouses, Transactions, LowStock
            ├── reports/                # WorkOrder, Cost, Usage, MTTR, MTBF
            ├── admin/                  # Users, Roles, AuditLogs, Settings
            ├── integrations/           # ZahirConfig, Logs, FailedJobs
            └── notifications/          # NotificationCenter
```
