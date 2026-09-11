# SaaS Accounting Integration

Multi-provider integration between CMMS Indra and SaaS accounting platforms (Zahir, QuickBooks, Xero) for inventory, purchase requisitions, fixed assets, stock adjustments, and work orders.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       CMMS Indra                                │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐ │
│  │ Spare Parts │   │   Purchase   │   │      Assets /        │ │
│  │   Module    │   │Requisitions  │   │    Work Orders       │ │
│  └──────┬──────┘   └──────┬───────┘   └──────────┬───────────┘ │
│         │                 │                       │             │
│         ▼                 ▼                       ▼             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              IntegrationQueueService                     │   │
│  │  createJob() → integration_jobs (PENDING)                │   │
│  │  processNextJob() → adapter.sync*() → update status     │   │
│  │  retryJob() → reset attempts, requeue                    │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼───────────────────────────────┐   │
│  │              AdapterRegistry                             │   │
│  │  getAdapter(provider) → cached IIntegrationAdapter       │   │
│  │                                                          │   │
│  │  ┌──────────────┐ ┌───────────────┐ ┌──────────────┐   │   │
│  │  │ ZahirAdapter │ │QuickBooksAdapt│ │  XeroAdapter │   │   │
│  │  └──────────────┘ └───────────────┘ └──────────────┘   │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  MockAdapter (fallback when no API key/config)   │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
              │                 │                 │
              │ HTTPS           │ HTTPS           │ HTTPS
              ▼                 ▼                 ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Zahir Accounting │ │ QuickBooks Online│ │   Xero Cloud     │
│ REST API         │ │ REST API         │ │ REST API         │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## IIntegrationAdapter Interface

```typescript
interface IIntegrationAdapter {
  readonly provider: string;
  testConnection(): Promise<boolean>;
  syncInventoryItem(item: any): Promise<SyncResult>;
  syncPurchaseRequisition(pr: any): Promise<SyncResult>;
  syncFixedAsset(asset: any): Promise<SyncResult>;
  sendStockAdjustment(transaction: any): Promise<SyncResult>;
  syncWorkOrderClose(wo: any): Promise<SyncResult>;
}

interface SyncResult {
  success: boolean;
  externalId?: string;
  error?: string;
}
```

## Supported Providers

| Provider | Adapter | Auth Method | Config Keys |
|----------|---------|-------------|-------------|
| Zahir | `ZahirAdapter` | Bearer token + Company ID | `api_url`, `api_key`, `company_id` |
| QuickBooks | `QuickBooksAdapter` | OAuth2 Bearer token | `api_url`, `access_token`, `realm_id` |
| Xero | `XeroAdapter` | Bearer token + Tenant ID | `api_url`, `api_key`, `tenant_id` |

## AdapterRegistry

```typescript
class AdapterRegistry {
  async getAdapter(provider: string): Promise<IIntegrationAdapter>;
  async getConfig(provider: string): Promise<ProviderConfig>;
  invalidateCache(provider: string): void;
}
```

### Provider Selection Logic

1. Check `integration_configs` table for `{provider}_*` keys
2. If no `api_key` or `use_mock=true` → return `MockAdapter`
3. Otherwise, instantiate the real adapter for the provider
4. Adapters are cached in memory; call `invalidateCache()` after config changes

### MockAdapter

Fallback when no real provider is configured. Always returns success with mock IDs:

```
MOCK-{provider}-INV-{itemCode}
MOCK-{provider}-PR-{id}
MOCK-{provider}-ASSET-{id}
MOCK-{provider}-TXN-{id}
MOCK-{provider}-WO-{id}
```

## Supported Sync Operations

| Operation | Adapter Method | Trigger | Endpoint |
|-----------|---------------|---------|----------|
| Inventory sync | `syncInventoryItem()` | Spare part created/updated | Varies by provider |
| Purchase requisition sync | `syncPurchaseRequisition()` | PR submitted for sync | Varies by provider |
| Fixed asset sync | `syncFixedAsset()` | Asset created/updated | Varies by provider |
| Stock adjustment | `sendStockAdjustment()` | Stock adjustment made | Varies by provider |
| Work order close | `syncWorkOrderClose()` | Work order marked done | Varies by provider |

## Queue and Retry Mechanism

### Job Lifecycle

```
                    ┌──────────┐
                    │ PENDING  │ ← nextRetryAt set
                    └────┬─────┘
                         │ processNextJob()
                         ▼
                    ┌──────────┐
                    │PROCESSING│
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
        ┌─────────┐ ┌────────┐ ┌───────────┐
        │ SUCCESS │ │ FAILED │ │DEAD_LETTER│
        └─────────┘ └────┬───┘ └───────────┘
                         │
                         │ retryJob() or auto-retry
                         ▼
                    ┌──────────┐
                    │ PENDING  │ ← reset attempts, new nextRetryAt
                    └──────────┘
```

### Exponential Backoff

| Attempt | Delay | Cumulative Wait |
|---------|-------|-----------------|
| 1 | 60s | 1 minute |
| 2 | 300s | 6 minutes |
| 3 | 900s | 21 minutes |
| 4 | 1800s | 51 minutes |
| 5 | 3600s | 101 minutes |

After 5 failed attempts → `DEAD_LETTER` (requires manual review).

### Idempotency

Each job accepts an optional `idempotencyKey`. Duplicate keys are rejected unless the existing job is in `FAILED` or `DEAD_LETTER` status.

```typescript
const idempotencyKey = `sync-item-${sparePart.id}-${sparePart.updatedAt}`;
```

## Configuration

### Database Table: `integration_configs`

| Key Pattern | Description |
|-------------|-------------|
| `{provider}_api_url` | API base URL |
| `{provider}_api_key` | API authentication key |
| `{provider}_company_id` | Company identifier (Zahir) |
| `{provider}_realm_id` | Realm ID (QuickBooks) |
| `{provider}_tenant_id` | Tenant ID (Xero) |
| `{provider}_access_token` | OAuth2 access token |
| `{provider}_use_mock` | `true` / `false` |

### Runtime Config

Configs are managed via the UI at `/integrations` and stored in `integration_configs`. The `AdapterRegistry` reads from this table on first access and caches the result.

## Webhook Handling

Incoming webhooks from SaaS providers are stored in `webhook_events`:

| Field | Description |
|-------|-------------|
| externalEventId | Unique event ID from provider |
| source | Provider name (`zahir`, `quickbooks`, `xero`) |
| eventType | e.g. `item.updated`, `invoice.paid` |
| payload | JSON event data |
| status | `RECEIVED` → `PROCESSED` / `FAILED` |

## Monitoring

### Integration Logs

All sync operations logged to `integration_logs`:

| Status | Description |
|--------|-------------|
| `CREATED` | Job created |
| `SUCCESS` | Sync completed |
| `RETRY` | Failed, scheduled for retry |
| `FAILED` | Attempt failed |
| `DEAD_LETTER` | Max retries exceeded |
| `MANUAL_RETRY` | Admin retried manually |

### Dead Letter Queue

Navigate to `/integrations/failed-jobs` to review and retry failed jobs.
