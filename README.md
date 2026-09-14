# CMMS Indra

Computerized Maintenance Management System with multi-provider accounting integration.

An enterprise-grade CMMS for managing maintenance operations, assets, work orders, preventive maintenance schedules, inventory, log books, and reporting — with bi-directional integration to Zahir Accounting, QuickBooks, and Xero.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | TypeScript, Express.js |
| Database | Turso Cloud SQLite (via HTTP pipeline API) |
| Frontend | React 18, React Router 6, Vite 5 |
| Styling | Tailwind CSS 3 |
| Charts | Recharts |
| Validation | Zod |
| Auth | JWT (jsonwebtoken, bcryptjs) |
| Export | docx (Word document generation) |
| File Upload | Multer (memory storage) |
| Deployment | Vercel (serverless) |

## Features

### Core Modules

- **Work Order Management** — Create, assign, track, and close work orders with full lifecycle management (`OPEN` -> `ASSIGNED` -> `IN_PROGRESS` -> `ON_HOLD` -> `CLOSED`). Includes checklists, file attachments, spare part usage tracking, root cause analysis, and resolution documentation.
- **Preventive Maintenance** — Schedule time-based (daily/weekly/monthly/quarterly/yearly/custom) or meter-based PM tasks. Auto-generate work orders on due dates. PM checklists with toggle completion. Submit PM activities to log book.
- **Asset Management** — Register assets with full metadata (serial, manufacturer, warranty, location). Track meter readings (running hours, vibration, temperature). Attach documents. View complete maintenance history.
- **Inventory Management** — Manage spare parts with multi-warehouse support. Stock in/out/adjustment/return transactions. Low stock alerts with automatic purchase requisition generation.
- **Log Books** — Daily work activity logging for technicians. Activity types (corrective, preventive, etc.) with duration tracking and spare part usage per entry.
- **Purchase Requisitions** — Create and manage PRs. Auto-generate from low stock items. Sync to accounting software.

### Analytics & Reporting

- **Dashboard & KPIs** — Real-time dashboard with total assets, active WOs, open/overdue counts, pending PMs, low stock alerts. Charts: WO by status, WO by priority, maintenance trend, spare part usage.
- **Work Order Reports** — Filterable by status, priority, asset, date range. Average completion time analysis.
- **Maintenance Cost Reports** — Cost by asset, cost by month trend analysis.
- **Spare Part Usage Reports** — Consumption analysis by item.
- **Downtime Reports** (MTTR — Mean Time To Repair) — Downtime analysis by asset with configurable good/warning thresholds.
- **MTBF Reports** (Mean Time Between Failures) — Reliability analysis by asset with configurable thresholds.
- **Asset History Reports** — Complete maintenance history per asset.
- **DOCX Export** — Professional Word document reports with summary tables, color-coded status, detail tables, and 3-level signature section (Technician, Supervisor, Manager).

### Integrations

- **Multi-provider Accounting Integration** — Adapter pattern supporting Zahir Accounting, QuickBooks Online, and Xero.
- **Queue & Retry** — Exponential backoff (5 attempts, 60s to 3600s delays). Dead letter queue for permanently failed jobs. Idempotency keys to prevent duplicate sync.
- **Webhook Handling** — Inbound webhook processing with deduplication.
- **Integration Scheduler** — Auto-processes pending jobs.

### System

- **RBAC** — Role-Based Access Control with granular permissions (module.action pattern). Pre-configured roles: Admin, Supervisor, Technician, Manager, Production.
- **Audit Logs** — Automatic logging of all CRUD operations with user, timestamp, old/new values, IP address, and user agent.
- **Notifications** — Types: WO_ASSIGNED, WO_CLOSED, LOW_STOCK, NEW_WO, PM_DUE, PR_APPROVED. Unread count badge, mark as read.
- **Settings** — Company name/logo, maintenance thresholds, PM notification days, low stock threshold, MTTR/MTBF thresholds.
- **Configurable Thresholds** — MTTR good/warning levels, MTBF good/warning levels configurable from settings.

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

```bash
# Clone the repository
git clone https://github.com/Mintcloud7/Indra.git
cd cmms-indra

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install

# Return to root
cd ..
```

## Environment Variables

Copy the example files and configure:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### Server (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `NODE_ENV` | `development` | Environment |
| `AUTH_SECRET` | `dev-secret` | JWT signing secret (**change in production**) |
| `TURSO_DATABASE_URL` | | Turso database URL |
| `TURSO_AUTH_TOKEN` | | Turso authentication token |
| `STORAGE_PATH` | `./uploads` | File upload directory |
| `MAX_FILE_SIZE` | `10485760` | Max upload size (10MB) |
| `ZAHIR_API_URL` | | Zahir API base URL |
| `ZAHIR_API_KEY` | | Zahir API key |
| `ZAHIR_WEBHOOK_SECRET` | | Webhook verification secret |
| `ZAHIR_COMPANY_ID` | | Zahir company identifier |
| `ZAHIR_ENVIRONMENT` | `sandbox` | `sandbox` or `production` |
| `EMAIL_HOST` | | SMTP host |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_USER` | | SMTP username |
| `EMAIL_PASSWORD` | | SMTP password |

### Client (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | Backend API URL (relative for production, absolute for local dev) |

## Database

The app uses **Turso cloud SQLite** for production and local SQLite for development. The schema is managed via a migration script:

```bash
# Seed the database with sample data (runs migrations + seeds)
npm run seed
```

This populates:
- 5 users with roles (Admin, Supervisor, Technician, Manager, Production)
- Roles with granular permissions (72 permission types)
- 5 assets with meter types
- 6 spare parts
- 5 work orders with lifecycle states
- 3 preventive maintenance schedules
- 1 warehouse with sample transactions
- Sample notifications and audit logs

For load testing:

```bash
npm run seed:2000
```

This generates ~5,000+ records including 1,500 work orders, 800 transactions, 100 purchase requisitions, and more.

## Development

Run both server and client in development mode:

```bash
# Server (with hot reload)
npm run server:dev

# Client (Vite dev server)
npm run client:dev
```

The server runs on `http://localhost:3001` and the client on `http://localhost:5173` (Vite default). The Vite dev server proxies `/api` requests to the backend automatically.

## Build & Deploy

```bash
# Build both server and client
npm run build

# Build individually
npm run server:build
npm run client:build
```

### Vercel Deployment

The app is configured for Vercel deployment with serverless functions:

- `vercel.json` configures build commands, install commands, and rewrites
- Server builds to `api/index.js` (esbuild, CommonJS bundle)
- Client builds to `client/dist/` (Vite production build)
- Environment variables: set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` via Vercel dashboard or CLI

```bash
# Deploy to Vercel
npx vercel --yes --prod --force

# Add environment variables
npx vercel env add TURSO_DATABASE_URL production --value "<url>"
npx vercel env add TURSO_AUTH_TOKEN production --value "<token>"
```

## Testing

```bash
npm run test
```

## API Overview

Base URL: `/api` (production) or `http://localhost:3001/api` (development)

All endpoints (except `/auth/login` and `/health`) require a JWT Bearer token in the `Authorization` header.

### Authentication

```
POST   /api/auth/login              -- Authenticate and get token
POST   /api/auth/logout             -- Log out
GET    /api/auth/me                 -- Get current user profile
POST   /api/auth/change-password    -- Change password
```

### Users

```
GET    /api/users                   -- List users (paginated)
GET    /api/users/technicians       -- List technicians
POST   /api/users                   -- Create user
PUT    /api/users/:id               -- Update user
DELETE /api/users/:id               -- Delete user
```

### Roles & Permissions

```
GET    /api/roles                   -- List roles
GET    /api/roles/permissions       -- List all permissions
POST   /api/roles                   -- Create role
PUT    /api/roles/:id               -- Update role
DELETE /api/roles/:id               -- Delete role
```

### Assets

```
GET    /api/assets                  -- List assets (paginated)
POST   /api/assets                  -- Create asset
GET    /api/assets/:id              -- Get asset detail
PUT    /api/assets/:id              -- Update asset
DELETE /api/assets/:id              -- Delete asset
GET    /api/assets/:id/documents    -- List asset documents
POST   /api/assets/:id/documents    -- Upload asset document
GET    /api/assets/:id/meters       -- List asset meters
POST   /api/assets/:id/meters       -- Create meter
POST   /api/assets/:id/meters/:meterId/readings -- Add meter reading
GET    /api/assets/:id/history      -- Asset maintenance history
```

### Work Orders

```
GET    /api/work-orders                         -- List work orders (paginated)
POST   /api/work-orders                         -- Create work order
GET    /api/work-orders/:id                     -- Get work order detail
PUT    /api/work-orders/:id                     -- Update work order
DELETE /api/work-orders/:id                     -- Delete work order
POST   /api/work-orders/:id/assign              -- Assign technician
POST   /api/work-orders/:id/start               -- Start work
POST   /api/work-orders/:id/hold                -- Put on hold
POST   /api/work-orders/:id/resume              -- Resume from hold
POST   /api/work-orders/:id/close               -- Close work order
GET    /api/work-orders/:id/checklist            -- List checklist items
POST   /api/work-orders/:id/checklist            -- Add checklist item
PUT    /api/work-orders/:id/checklist/:checklistId -- Update checklist
DELETE /api/work-orders/:id/checklist/:checklistId -- Delete checklist
POST   /api/work-orders/:id/attachments          -- Upload attachment
POST   /api/work-orders/:id/spare-parts          -- Add spare part usage
PUT    /api/work-orders/:id/spare-parts/:sparePartId -- Update spare part usage
```

### Preventive Maintenance

```
GET    /api/preventive-maintenance                    -- List PM schedules
POST   /api/preventive-maintenance                    -- Create PM schedule
GET    /api/preventive-maintenance/checklist-stats     -- PM checklist statistics
GET    /api/preventive-maintenance/:id                 -- Get PM detail
PUT    /api/preventive-maintenance/:id                 -- Update PM schedule
DELETE /api/preventive-maintenance/:id                 -- Delete PM schedule
POST   /api/preventive-maintenance/:id/generate-wo     -- Generate WO from PM
POST   /api/preventive-maintenance/check-due            -- Auto-check due PMs
PUT    /api/preventive-maintenance/checklists/:checklistId/toggle -- Toggle checklist
POST   /api/preventive-maintenance/submit-to-logbook    -- Submit to log book
```

### Inventory

```
GET    /api/spare-parts              -- List spare parts (paginated)
POST   /api/spare-parts              -- Create spare part
GET    /api/spare-parts/:id          -- Get spare part detail
PUT    /api/spare-parts/:id          -- Update spare part
GET    /api/spare-parts/low-stock    -- List low stock items
POST   /api/spare-parts/:id/generate-pr -- Generate PR from low stock

GET    /api/warehouses               -- List warehouses
POST   /api/warehouses               -- Create warehouse
PUT    /api/warehouses/:id           -- Update warehouse
DELETE /api/warehouses/:id           -- Delete warehouse

GET    /api/transactions             -- List inventory transactions
POST   /api/stock-in                 -- Stock in
POST   /api/stock-out                -- Stock out
POST   /api/adjustment               -- Stock adjustment
POST   /api/return                   -- Stock return
```

### Purchase Requisitions

```
GET    /api/purchase-requisitions         -- List PRs (paginated)
POST   /api/purchase-requisitions         -- Create PR
GET    /api/purchase-requisitions/:id     -- Get PR detail
PUT    /api/purchase-requisitions/:id     -- Update PR
DELETE /api/purchase-requisitions/:id     -- Delete PR
POST   /api/purchase-requisitions/:id/sync-zahir -- Sync to accounting
```

### Log Books

```
GET    /api/log-books                -- List log books (paginated)
POST   /api/log-books                -- Create log book entry
GET    /api/log-books/:id            -- Get log book detail
PUT    /api/log-books/:id            -- Update log book
DELETE /api/log-books/:id            -- Delete log book
```

### Reports

```
GET    /api/reports/work-orders              -- Work order report
GET    /api/reports/work-orders/export-docx   -- Export WO report as Word
GET    /api/reports/work-orders/:id/export-docx -- Export single WO as Word
GET    /api/reports/maintenance-cost          -- Maintenance cost report
GET    /api/reports/spare-part-usage          -- Spare part usage report
GET    /api/reports/downtime                  -- MTTR (downtime) report
GET    /api/reports/mtbf                      -- MTBF report
GET    /api/reports/asset-history/:assetId    -- Asset history report
```

### Integrations

```
GET    /api/integrations/providers        -- List supported providers
GET    /api/integrations/:provider/config -- Get provider config
PUT    /api/integrations/:provider/config -- Update provider config
POST   /api/integrations/:provider/test   -- Test connection
GET    /api/integrations/jobs             -- List integration jobs
POST   /api/integrations/jobs/:id/retry   -- Retry failed job
POST   /api/integrations/process          -- Process pending jobs
GET    /api/integrations/logs             -- List integration logs
GET    /api/integrations/failed-jobs      -- List dead letter jobs
```

### Notifications, Dashboard, Settings

```
GET    /api/notifications               -- List notifications
GET    /api/notifications/unread-count   -- Unread count
PUT    /api/notifications/:id/read      -- Mark as read
PUT    /api/notifications/read-all      -- Mark all as read

GET    /api/dashboard                   -- Dashboard KPIs and charts

GET    /api/settings                    -- Get system settings
PUT    /api/settings                    -- Update settings
POST   /api/settings/logo               -- Upload company logo

GET    /api/audit-logs                  -- List audit logs

GET    /api/health                      -- Health check (no auth)
```

## Default Credentials

After running `npm run seed`:

| Username | Password | Role |
|----------|----------|------|
| `admin` | `password123` | ADMIN (full access) |
| `supervisor` | `password123` | SUPERVISOR |
| `technician` | `password123` | TECHNICIAN |
| `manager` | `password123` | MANAGER (read-only) |
| `production` | `password123` | PRODUCTION |

## Roles & Permissions

| Role | Description |
|------|-------------|
| **ADMIN** | Full system access — all permissions |
| **SUPERVISOR** | Create/read/update WOs, PM, assets; assign WOs; read inventory, reports |
| **TECHNICIAN** | Read/update/close WOs; read assets, inventory; manage log books |
| **MANAGER** | Read-only access to dashboard, WOs, PM, assets, inventory, reports |
| **PRODUCTION** | Create/read/update WOs; read assets, inventory |

Permission format: `module.action` (e.g., `work_orders.create`, `assets.read`)

## Architecture

```
cmms-indra/
├── api/                          # Vercel serverless entry (generated by build)
├── server/                       # Express.js backend
│   └── src/
│       ├── database/             # Turso connection, migrations, seed
│       ├── middleware/           # Auth, RBAC, audit, validation, error
│       ├── modules/
│       │   ├── auth/             # Authentication (JWT)
│       │   ├── assets/           # Asset management
│       │   ├── work-orders/      # Work order lifecycle
│       │   ├── preventive-maintenance/ # PM scheduling
│       │   ├── inventory/        # Spare parts, warehouses, transactions
│       │   ├── purchase-requisitions/ # PR management
│       │   ├── log-books/        # Daily activity logging
│       │   ├── reports/          # Reports + DOCX export
│       │   ├── integrations/     # Multi-provider accounting adapters
│       │   ├── notifications/    # Notification system
│       │   ├── audit-logs/       # Audit trail
│       │   ├── settings/         # System settings
│       │   ├── users/            # User management
│       │   └── roles/            # Role & permission management
│       ├── shared/               # Types, errors, response helpers, utils
│       ├── vercel-handler.ts     # Vercel serverless entry point
│       └── server.ts             # Local dev entry point
├── client/                       # React + Vite frontend
│   └── src/
│       ├── api/                  # API client and types
│       ├── components/           # Reusable UI components
│       ├── context/              # Auth and notification providers
│       ├── hooks/                # Custom React hooks
│       └── pages/                # Route pages (30+ pages)
├── vercel.json                   # Vercel deployment config
├── package.json                  # Root package with workspace scripts
└── README.md
```

## License

Private — All rights reserved.
