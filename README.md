# CMMS Zahir

Computerized Maintenance Management System with Zahir Accounting Integration.

An enterprise-grade CMMS for managing maintenance operations, assets, work orders, preventive maintenance schedules, inventory, and reporting -- with bi-directional integration to Zahir Accounting software.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | TypeScript, Express.js |
| Database | sql.js (WASM SQLite) |
| Frontend | React 18, React Router 6 |
| Build | Vite 5, TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Charts | Recharts |
| Validation | Zod |
| Auth | JWT (jsonwebtoken) |
| Testing | Vitest |

## Features

- **Work Order Management** -- Create, assign, track, and close work orders with lifecycle management (OPEN -> ASSIGNED -> IN_PROGRESS -> ON_HOLD -> CLOSED), checklists, attachments, and spare part usage tracking.
- **Preventive Maintenance** -- Schedule time-based or meter-based PM tasks, auto-generate work orders on due dates, track PM completion history.
- **Asset Management** -- Register assets with full metadata (serial, manufacturer, warranty), track meter readings, attach documents, view maintenance history.
- **Inventory Management** -- Manage spare parts, warehouses, stock in/out/adjustment/return transactions, low stock alerts.
- **Dashboard & KPIs** -- Real-time dashboard with work order stats, PM status, stock alerts, maintenance cost trends, MTTR/MTBF metrics.
- **Reports** -- Work order reports, maintenance cost analysis, spare part usage, MTTR (Mean Time To Repair), MTBF (Mean Time Between Failures), asset history.
- **Zahir Integration** -- Sync inventory items, purchase requisitions, fixed assets, and stock adjustments with Zahir Accounting via adapter pattern with queue and retry.
- **RBAC** -- Role-Based Access Control with granular permissions (module.action pattern), pre-configured roles (Admin, Supervisor, Technician, Manager).
- **Audit Logs** -- Automatic logging of all CRUD operations with user, timestamp, old/new values, IP address, and user agent.

## Prerequisites

- Node.js 18+
- npm 9+

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd cmms-zahir

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
| `AUTH_SECRET` | `dev-secret-...` | JWT signing secret (**change in production**) |
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
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
| `VITE_API_URL` | `http://localhost:3001/api` | Backend API URL |

## Database Setup

```bash
# Seed the database with sample data
npm run seed
```

This runs migrations (creates all tables) and populates:
- 4 users with roles
- 5 assets
- 6 spare parts
- 5 work orders
- 3 preventive maintenance schedules
- 1 warehouse
- Sample transactions, notifications, and audit logs

## Development

Run both server and client in development mode:

```bash
# Server (with hot reload)
npm run server:dev

# Client (Vite dev server)
npm run client:dev
```

The server runs on `http://localhost:3001` and the client on `http://localhost:5173` (Vite default).

## Build

```bash
# Build both
npm run build

# Build individually
npm run server:build
npm run client:build
```

## Testing

```bash
npm run test
```

## API Overview

Base URL: `http://localhost:3001/api`

All endpoints (except `/auth/login` and `/health`) require a JWT Bearer token in the `Authorization` header.

```
POST   /api/auth/login          -- Authenticate and get token
POST   /api/auth/logout         -- Log out
GET    /api/auth/me             -- Get current user profile
POST   /api/auth/change-password -- Change password

GET    /api/users               -- List users (paginated)
POST   /api/users               -- Create user
PUT    /api/users/:id           -- Update user
DELETE /api/users/:id           -- Delete user
GET    /api/users/technicians   -- List technicians

GET    /api/roles               -- List roles
POST   /api/roles               -- Create role
PUT    /api/roles/:id           -- Update role
DELETE /api/roles/:id           -- Delete role
GET    /api/roles/permissions   -- List all permissions

GET    /api/assets              -- List assets (paginated)
POST   /api/assets              -- Create asset
GET    /api/assets/:id          -- Get asset detail
PUT    /api/assets/:id          -- Update asset
DELETE /api/assets/:id          -- Delete asset
GET    /api/assets/:id/documents  -- List asset documents
POST   /api/assets/:id/documents  -- Upload asset document
GET    /api/assets/:id/meters     -- List asset meters
POST   /api/assets/:id/meters     -- Create meter
POST   /api/assets/:id/meters/:meterId/readings -- Add meter reading
GET    /api/assets/:id/history    -- Asset maintenance history

GET    /api/work-orders         -- List work orders (paginated)
POST   /api/work-orders         -- Create work order
GET    /api/work-orders/:id     -- Get work order detail
PUT    /api/work-orders/:id     -- Update work order
DELETE /api/work-orders/:id     -- Delete work order
POST   /api/work-orders/:id/assign    -- Assign technician
POST   /api/work-orders/:id/start     -- Start work
POST   /api/work-orders/:id/hold      -- Put on hold
POST   /api/work-orders/:id/resume    -- Resume from hold
POST   /api/work-orders/:id/close     -- Close work order
POST   /api/work-orders/:id/checklist -- Add checklist item
PUT    /api/work-orders/:id/checklist/:checklistId -- Update checklist
POST   /api/work-orders/:id/attachments -- Upload attachment
POST   /api/work-orders/:id/spare-parts -- Add spare part
PUT    /api/work-orders/:id/spare-parts/:sparePartId -- Update spare part

GET    /api/preventive-maintenance    -- List PM schedules (paginated)
POST   /api/preventive-maintenance    -- Create PM schedule
GET    /api/preventive-maintenance/:id -- Get PM detail
PUT    /api/preventive-maintenance/:id -- Update PM schedule
DELETE /api/preventive-maintenance/:id -- Delete PM schedule
POST   /api/preventive-maintenance/:id/generate-wo -- Generate WO from PM
POST   /api/preventive-maintenance/check-due -- Check and generate due PMs

GET    /api/spare-parts              -- List spare parts (paginated)
POST   /api/spare-parts              -- Create spare part
GET    /api/spare-parts/:id          -- Get spare part detail
PUT    /api/spare-parts/:id          -- Update spare part
GET    /api/spare-parts/low-stock    -- List low stock items

GET    /api/warehouses               -- List warehouses
POST   /api/warehouses               -- Create warehouse

GET    /api/transactions             -- List inventory transactions (paginated)
POST   /api/stock-in                 -- Stock in
POST   /api/stock-out                -- Stock out
POST   /api/adjustment               -- Stock adjustment
POST   /api/return                   -- Stock return

GET    /api/notifications            -- List notifications (paginated)
GET    /api/notifications/unread-count -- Unread notification count
GET    /api/notifications/:id        -- Get notification
PUT    /api/notifications/:id/read   -- Mark as read
PUT    /api/notifications/read-all   -- Mark all as read

GET    /api/dashboard                -- Get dashboard data (KPIs, charts)

GET    /api/reports/work-orders      -- Work order report
GET    /api/reports/maintenance-cost -- Maintenance cost report
GET    /api/reports/spare-part-usage -- Spare part usage report
GET    /api/reports/mttr             -- Mean Time To Repair
GET    /api/reports/mtbf             -- Mean Time Between Failures
GET    /api/reports/asset-history/:assetId -- Asset maintenance history

GET    /api/purchase-requisitions    -- List purchase requisitions (paginated)
POST   /api/purchase-requisitions    -- Create purchase requisition
GET    /api/purchase-requisitions/:id -- Get PR detail
PUT    /api/purchase-requisitions/:id -- Update PR
POST   /api/purchase-requisitions/:id/sync-zahir -- Sync to Zahir
```

## Default Credentials

After running `npm run seed`:

| Email | Password | Role |
|-------|----------|------|
| `admin@example.com` | `password123` | ADMIN (full access) |
| `supervisor@example.com` | `password123` | SUPERVISOR |
| `technician@example.com` | `password123` | TECHNICIAN |
| `manager@example.com` | `password123` | MANAGER (read-only) |

## Architecture Overview

```
cmms-zahir/
├── server/                   # Express.js backend
│   ├── src/
│   │   ├── database/         # sql.js connection, migrations, seed
│   │   ├── middleware/        # Auth, RBAC, audit, validation, error
│   │   ├── modules/          # Feature modules (auth, assets, work-orders, etc.)
│   │   ├── shared/           # Types, errors, response helpers, utils
│   │   └── server.ts         # Entry point
│   ├── prisma/               # Prisma schema (reference)
│   └── uploads/              # Uploaded files
├── client/                   # React + Vite frontend
│   ├── src/
│   │   ├── api/              # API client and types
│   │   ├── components/       # Reusable UI components
│   │   ├── context/          # Auth and notification providers
│   │   ├── hooks/            # Custom React hooks
│   │   └── pages/            # Route pages
│   └── ...
├── package.json              # Root package with workspace scripts
└── README.md
```

## License

Private -- All rights reserved.
