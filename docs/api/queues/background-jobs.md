# Atlas BOS Background Job Catalog

**Document ID:** ATLAS-API-QUE-001  
**Phase:** 5  
**Version:** 1.0.0  
**Last Updated:** 2026-06-30  
**Queue Backend:** BullMQ (Redis 7) + Kafka consumer workers

---

## Overview

Atlas offloads long-running, retriable, and scheduled work to **background job queues**. Jobs are enqueued by the API (sync handoff), domain event consumers, or cron schedulers.

### Architecture

```
API / Event Consumer
        │
        ▼
  Job Enqueue (BullMQ)
        │
        ▼
  Redis Queue ──► Worker Pool (atlas-worker)
        │
        ├── Success → ACK + metrics
        ├── Retry   → Backoff requeue
        └── Failed  → Dead letter queue (DLQ)
```

### Queue Topology

| Queue | Purpose | Workers | Concurrency |
|-------|---------|---------|-------------|
| `critical` | Payment, billing, auth | `atlas-worker-critical` | 20 |
| `default` | Standard async tasks | `atlas-worker` | 50 |
| `bulk` | Imports, exports, reports | `atlas-worker-bulk` | 10 |
| `scheduled` | Cron-triggered jobs | `atlas-worker-scheduler` | 5 |
| `email` | Email/SMS delivery | `atlas-worker-email` | 30 |
| `search` | OpenSearch indexing | `atlas-search-indexer` | 15 |
| `ai` | Embeddings, inference | `atlas-worker-ai` | 5 |
| `webhook` | Outbound webhook delivery | `atlas-webhook-dispatcher` | 25 |

---

## Job Envelope

All jobs share a standard payload envelope:

```json
{
  "jobId": "01J8X9K2M4N5P6Q7R8S9T0UVW",
  "jobName": "send-invoice-email",
  "queue": "email",
  "organizationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "workspaceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "correlationId": "01JABC...",
  "causationId": "01JDEF...",
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "enqueuedAt": "2026-06-30T14:32:01.123Z",
  "attempt": 1,
  "maxAttempts": 5,
  "payload": { }
}
```

### Standard Fields

| Field | Required | Description |
|-------|----------|-------------|
| `jobId` | Yes | ULID unique job identifier |
| `jobName` | Yes | Canonical job name (see catalog) |
| `queue` | Yes | Target queue |
| `organizationId` | Usually | Tenant scope; null for platform jobs |
| `idempotencyKey` | Recommended | Dedup key; `{jobName}:{entityId}:{action}` |
| `correlationId` | Yes | Request/event trace |
| `attempt` | Auto | Current attempt (1-based) |
| `maxAttempts` | Auto | Max retries before DLQ |

---

## Retry & Idempotency Policy

### Default Retry Configuration

```typescript
const DEFAULT_RETRY = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 }, // 2s, 4s, 8s, 16s, 32s
  removeOnComplete: { age: 86400, count: 1000 },  // 24h retention
  removeOnFail: false,                             // Keep for DLQ inspection
};
```

| Queue | Max Attempts | Backoff | Timeout |
|-------|-------------|---------|---------|
| `critical` | 7 | Exponential 1s base | 60s |
| `default` | 5 | Exponential 2s base | 120s |
| `bulk` | 3 | Fixed 60s | 3600s |
| `scheduled` | 5 | Exponential 5s base | 300s |
| `email` | 7 | Exponential 30s base | 30s |
| `search` | 5 | Exponential 5s base | 60s |
| `ai` | 3 | Exponential 10s base | 300s |
| `webhook` | 7 | Custom (see webhooks catalog) | 35s |

### Idempotency Rules

| Rule | Description |
|------|-------------|
| **ID-01** | Jobs with side effects require `idempotencyKey` |
| **ID-02** | Workers check `job_completions` table before executing |
| **ID-03** | Duplicate enqueue with same key within 24h returns existing `jobId` |
| **ID-04** | Financial jobs use `{jobName}:{entityId}:v{version}` key |
| **ID-05** | Completed job replay returns cached result (if `returnValue` stored) |

---

## Job Catalog

### Platform & Identity

#### `provision-organization`

| Attribute | Value |
|-----------|-------|
| **Queue** | `critical` |
| **Trigger** | `platform.organization.created.v1` |
| **Timeout** | 120s |
| **Idempotency key** | `provision-organization:{organizationId}` |

**Payload:**
```json
{
  "organizationId": "uuid",
  "workspaceId": "uuid",
  "planCode": "growth",
  "dataRegion": "us-east-1",
  "seedData": true
}
```

**Actions:** Create default teams, roles, pipelines, chart of accounts, sample data (if enabled).

---

#### `send-user-invitation-email`

| Attribute | Value |
|-----------|-------|
| **Queue** | `email` |
| **Trigger** | `platform.user.invited.v1` |
| **Idempotency key** | `send-user-invitation-email:{invitationId}` |

**Payload:** `{ invitationId, email, organizationId, inviterName, acceptUrl }`

---

#### `sync-directory-users`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Cron `0 */6 * * *` per SSO connection |
| **Idempotency key** | `sync-directory-users:{ssoConnectionId}:{date}` |

**Payload:** `{ ssoConnectionId, organizationId, fullSync: boolean }`

---

#### `rotate-api-key-notify`

| Attribute | Value |
|-----------|-------|
| **Queue** | `email` |
| **Trigger** | API key rotation scheduled |
| **Idempotency key** | `rotate-api-key-notify:{apiKeyId}` |

**Payload:** `{ apiKeyId, organizationId, expiresAt, ownerUserId }`

---

#### `purge-soft-deleted-records`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Cron `0 3 * * *` (daily 03:00 UTC) |
| **Idempotency key** | `purge-soft-deleted:{organizationId}:{date}` |

**Payload:** `{ organizationId, entityTypes[], retentionDays: 30 }`

---

### CRM

#### `index-contact`

| Attribute | Value |
|-----------|-------|
| **Queue** | `search` |
| **Trigger** | `customer.contact.created.v1`, `customer.contact.updated.v1` |
| **Idempotency key** | `index-contact:{contactId}:v{version}` |

**Payload:** `{ contactId, organizationId, operation: "upsert" | "delete" }`

---

#### `score-lead`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | `customer.lead.created.v1`, lead enrichment webhook |
| **Idempotency key** | `score-lead:{leadId}` |

**Payload:** `{ leadId, organizationId, signals: {} }`

---

#### `convert-lead-side-effects`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | `customer.lead.converted.v1` |
| **Idempotency key** | `convert-lead-side-effects:{leadId}` |

**Payload:** `{ leadId, contactId, accountId, dealId, organizationId }`

**Actions:** Create default activities, notify owner, trigger automation workflows.

---

#### `sync-deal-to-forecast`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | `customer.deal.stage_changed.v1`, `customer.deal.won.v1` |
| **Idempotency key** | `sync-deal-forecast:{dealId}:v{version}` |

**Payload:** `{ dealId, organizationId, pipelineId, amountCents, probability }`

---

#### `send-deal-won-notification`

| Attribute | Value |
|-----------|-------|
| **Queue** | `email` |
| **Trigger** | `customer.deal.won.v1` |
| **Idempotency key** | `send-deal-won-notification:{dealId}` |

**Payload:** `{ dealId, organizationId, recipientUserIds[] }`

---

### ERP / Inventory

#### `reserve-inventory`

| Attribute | Value |
|-----------|-------|
| **Queue** | `critical` |
| **Trigger** | `commercial.order.confirmed.v1` |
| **Idempotency key** | `reserve-inventory:{orderId}` |

**Payload:**
```json
{
  "orderId": "uuid",
  "organizationId": "uuid",
  "lineItems": [
    { "productId": "uuid", "quantity": 10, "warehouseId": "uuid" }
  ]
}
```

---

#### `release-inventory-reservation`

| Attribute | Value |
|-----------|-------|
| **Queue** | `critical` |
| **Trigger** | `commercial.order.cancelled.v1` |
| **Idempotency key** | `release-inventory:{orderId}` |

**Payload:** `{ orderId, organizationId, reason }`

---

#### `check-low-stock-alerts`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Cron `0 */4 * * *` |
| **Idempotency key** | `check-low-stock:{organizationId}:{hour}` |

**Payload:** `{ organizationId }`

---

#### `sync-product-catalog`

| Attribute | Value |
|-----------|-------|
| **Queue** | `bulk` |
| **Trigger** | External integration sync request |
| **Idempotency key** | `sync-product-catalog:{integrationId}:{syncId}` |

**Payload:** `{ integrationId, organizationId, products[], mode: "full" | "delta" }`

---

### Finance / Ledger

#### `post-invoice-to-gl`

| Attribute | Value |
|-----------|-------|
| **Queue** | `critical` |
| **Trigger** | `ledger.invoice.posted.v1` |
| **Idempotency key** | `post-invoice-to-gl:{invoiceId}` |

**Payload:** `{ invoiceId, organizationId, journalEntryTemplate }`

---

#### `send-invoice-email`

| Attribute | Value |
|-----------|-------|
| **Queue** | `email` |
| **Trigger** | `ledger.invoice.sent.v1` or manual send |
| **Idempotency key** | `send-invoice-email:{invoiceId}:{recipientEmail}` |

**Payload:** `{ invoiceId, organizationId, recipientEmail, pdfDocumentId }`

---

#### `process-payment-webhook`

| Attribute | Value |
|-----------|-------|
| **Queue** | `critical` |
| **Trigger** | Stripe/payment provider webhook |
| **Idempotency key** | `process-payment-webhook:{providerEventId}` |

**Payload:** `{ provider: "stripe", eventId, eventType, rawPayload }`

---

#### `generate-invoice-pdf`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | Invoice created/sent |
| **Idempotency key** | `generate-invoice-pdf:{invoiceId}:v{version}` |

**Payload:** `{ invoiceId, organizationId, templateId }`

---

#### `check-overdue-invoices`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Cron `0 6 * * *` |
| **Idempotency key** | `check-overdue-invoices:{organizationId}:{date}` |

**Payload:** `{ organizationId, gracePeriodDays: 0 }`

---

#### `reconcile-bank-transactions`

| Attribute | Value |
|-----------|-------|
| **Queue** | `bulk` |
| **Trigger** | Bank feed sync or manual |
| **Idempotency key** | `reconcile-bank:{bankAccountId}:{importBatchId}` |

**Payload:** `{ bankAccountId, organizationId, transactions[] }`

---

### HR / Workforce

#### `onboard-employee`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | `workforce.employee.hired.v1` |
| **Idempotency key** | `onboard-employee:{employeeId}` |

**Payload:** `{ employeeId, organizationId, createUserAccount: boolean, welcomeEmail: boolean }`

---

#### `process-payroll-run`

| Attribute | Value |
|-----------|-------|
| **Queue** | `critical` |
| **Trigger** | Payroll approval |
| **Idempotency key** | `process-payroll-run:{payrollRunId}` |

**Payload:** `{ payrollRunId, organizationId, periodStart, periodEnd }`

---

#### `accrue-time-off-balances`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Cron `0 0 1 * *` (monthly) |
| **Idempotency key** | `accrue-time-off:{organizationId}:{year}-{month}` |

**Payload:** `{ organizationId, accrualPolicyId }`

---

### Projects / Delivery

#### `notify-task-assignment`

| Attribute | Value |
|-----------|-------|
| **Queue** | `email` |
| **Trigger** | `delivery.task.assigned.v1` |
| **Idempotency key** | `notify-task-assignment:{taskId}:{assigneeId}` |

**Payload:** `{ taskId, projectId, assigneeId, assignedById, organizationId }`

---

#### `calculate-project-progress`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | `delivery.task.completed.v1` |
| **Idempotency key** | `calc-project-progress:{projectId}` |

**Payload:** `{ projectId, organizationId }`

---

#### `generate-timesheet-report`

| Attribute | Value |
|-----------|-------|
| **Queue** | `bulk` |
| **Trigger** | Manual export request |
| **Idempotency key** | `timesheet-report:{organizationId}:{reportId}` |

**Payload:** `{ reportId, organizationId, periodStart, periodEnd, format: "csv" | "xlsx" }`

---

### Marketing

#### `send-campaign-batch`

| Attribute | Value |
|-----------|-------|
| **Queue** | `bulk` |
| **Trigger** | `campaign.campaign.scheduled.v1` |
| **Idempotency key** | `send-campaign-batch:{campaignId}:{batchIndex}` |

**Payload:**
```json
{
  "campaignId": "uuid",
  "organizationId": "uuid",
  "batchIndex": 0,
  "recipientIds": ["uuid", "..."],
  "templateId": "uuid"
}
```

---

#### `refresh-segment-membership`

| Attribute | Value |
|-----------|-------|
| **Queue** | `bulk` |
| **Trigger** | Segment save or cron refresh |
| **Idempotency key** | `refresh-segment:{segmentId}` |

**Payload:** `{ segmentId, organizationId, criteria }`

---

#### `process-email-bounce`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | ESP bounce webhook |
| **Idempotency key** | `process-email-bounce:{espMessageId}` |

**Payload:** `{ contactId, email, bounceType, campaignId, organizationId }`

---

### Automation

#### `execute-workflow-run`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | Workflow trigger event |
| **Idempotency key** | `execute-workflow-run:{runId}` |

**Payload:** `{ runId, workflowId, organizationId, context, triggeredBy }`

---

#### `execute-workflow-step`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | Parent step completion |
| **Idempotency key** | `execute-workflow-step:{runId}:{stepId}` |

**Payload:** `{ runId, stepId, stepType, config, input }`

---

#### `schedule-delayed-workflow-step`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Workflow delay step |
| **Idempotency key** | `schedule-delayed-step:{runId}:{stepId}` |

**Payload:** `{ runId, stepId, executeAt, organizationId }`

---

### AI / Intelligence

#### `index-entity-embeddings`

| Attribute | Value |
|-----------|-------|
| **Queue** | `ai` |
| **Trigger** | `content.document.uploaded.v1`, knowledge article publish |
| **Idempotency key** | `index-embeddings:{entityType}:{entityId}:v{version}` |

**Payload:** `{ entityType, entityId, organizationId, content, chunkSize: 512 }`

---

#### `process-ai-conversation`

| Attribute | Value |
|-----------|-------|
| **Queue** | `ai` |
| **Trigger** | User message in AI chat |
| **Idempotency key** | `process-ai-conversation:{conversationId}:{messageId}` |

**Payload:** `{ conversationId, messageId, agentId, organizationId, userId }`

---

#### `summarize-entity`

| Attribute | Value |
|-----------|-------|
| **Queue** | `ai` |
| **Trigger** | On-demand or scheduled |
| **Idempotency key** | `summarize-entity:{entityType}:{entityId}` |

**Payload:** `{ entityType, entityId, organizationId, summaryType }`

---

### Documents

#### `virus-scan-document`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | `content.document.uploaded.v1` |
| **Idempotency key** | `virus-scan:{documentId}` |

**Payload:** `{ documentId, organizationId, storageKey, mimeType }`

---

#### `generate-document-preview`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | Post virus-scan pass |
| **Idempotency key** | `generate-preview:{documentId}` |

**Payload:** `{ documentId, organizationId, mimeType }`

---

### Support

#### `check-ticket-sla`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Cron `*/15 * * * *` |
| **Idempotency key** | `check-ticket-sla:{organizationId}:{window}` |

**Payload:** `{ organizationId, windowMinutes: 15 }`

---

#### `auto-assign-ticket`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | `service.ticket.created.v1` (if auto-assign enabled) |
| **Idempotency key** | `auto-assign-ticket:{ticketId}` |

**Payload:** `{ ticketId, organizationId, routingRules }`

---

### Webhooks & Notifications

#### `dispatch-webhook`

| Attribute | Value |
|-----------|-------|
| **Queue** | `webhook` |
| **Trigger** | Any webhook-eligible domain event |
| **Idempotency key** | `dispatch-webhook:{eventId}:{endpointId}` |

**Payload:** `{ eventId, endpointId, eventType, payload, attempt }`

---

#### `send-push-notification`

| Attribute | Value |
|-----------|-------|
| **Queue** | `default` |
| **Trigger** | `communication.notification.sent.v1` |
| **Idempotency key** | `send-push:{notificationId}:{channel}` |

**Payload:** `{ notificationId, userId, title, body, actionUrl, deviceTokens[] }`

---

#### `batch-email-digest`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Cron per user preference |
| **Idempotency key** | `batch-email-digest:{userId}:{date}` |

**Payload:** `{ userId, organizationId, digestType: "daily" | "weekly", notificationIds[] }`

---

### Analytics & Reporting

#### `generate-report`

| Attribute | Value |
|-----------|-------|
| **Queue** | `bulk` |
| **Trigger** | Scheduled or on-demand report |
| **Idempotency key** | `generate-report:{reportDefinitionId}:{runId}` |

**Payload:** `{ reportDefinitionId, organizationId, runId, format, parameters }`

---

#### `aggregate-dashboard-metrics`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Cron `*/5 * * * *` |
| **Idempotency key** | `aggregate-metrics:{organizationId}:{period}` |

**Payload:** `{ organizationId, period: "day" | "week" | "month" }`

---

### Data Import / Export

#### `import-contacts-csv`

| Attribute | Value |
|-----------|-------|
| **Queue** | `bulk` |
| **Trigger** | REST `POST /v1/contacts/import` |
| **Idempotency key** | `import-contacts:{importJobId}` |

**Payload:** `{ importJobId, organizationId, documentId, mapping, dedupeStrategy }`

---

#### `export-organization-data`

| Attribute | Value |
|-----------|-------|
| **Queue** | `bulk` |
| **Trigger** | GDPR export request |
| **Idempotency key** | `export-org-data:{exportRequestId}` |

**Payload:** `{ exportRequestId, organizationId, entityTypes[], format: "json" | "csv" }`

---

### Billing

#### `sync-stripe-subscription`

| Attribute | Value |
|-----------|-------|
| **Queue** | `critical` |
| **Trigger** | Stripe webhook or plan change |
| **Idempotency key** | `sync-stripe-sub:{stripeSubscriptionId}:{eventId}` |

**Payload:** `{ stripeSubscriptionId, workspaceId, eventType, rawPayload }`

---

#### `meter-usage-snapshot`

| Attribute | Value |
|-----------|-------|
| **Queue** | `scheduled` |
| **Trigger** | Cron `0 * * * *` |
| **Idempotency key** | `meter-usage:{workspaceId}:{hour}` |

**Payload:** `{ workspaceId, metrics: ["api_calls", "ai_tokens", "storage_bytes"] }`

---

## Job Index Summary

| Module | Jobs | Queues Used |
|--------|------|-------------|
| Platform | 5 | critical, email, scheduled |
| CRM | 5 | search, default, email |
| ERP | 4 | critical, scheduled, bulk |
| Finance | 6 | critical, email, default, scheduled, bulk |
| HR | 3 | default, critical, scheduled |
| Projects | 3 | email, default, bulk |
| Marketing | 3 | bulk, default |
| Automation | 3 | default, scheduled |
| AI | 3 | ai |
| Documents | 2 | default |
| Support | 2 | scheduled, default |
| Webhooks/Notifications | 3 | webhook, default, scheduled |
| Analytics | 2 | bulk, scheduled |
| Import/Export | 2 | bulk |
| Billing | 2 | critical, scheduled |
| **Total** | **46** | |

---

## Monitoring & Operations

### Metrics

```
atlas_job_enqueued_total{queue, job_name}
atlas_job_completed_total{queue, job_name}
atlas_job_failed_total{queue, job_name}
atlas_job_duration_seconds{queue, job_name}
atlas_job_queue_depth{queue}
atlas_job_dlq_depth{queue}
```

### Alerts

| Condition | Severity |
|-----------|----------|
| DLQ depth > 100 for 15m | Warning |
| DLQ depth > 500 | Critical |
| `critical` queue latency p99 > 30s | Critical |
| Job failure rate > 5% over 1h | Warning |
| Worker pod count = 0 | Critical |

### Admin API

```
GET  /v1/internal/jobs?queue=default&status=failed
GET  /v1/internal/jobs/{jobId}
POST /v1/internal/jobs/{jobId}/retry
POST /v1/internal/jobs/dlq/replay  # Platform admin only
```

---

## Dead Letter Queue (DLQ)

Failed jobs after max attempts move to `dlq:{queue}`:

```json
{
  "originalJob": { },
  "failedAt": "2026-06-30T14:32:01.123Z",
  "lastError": {
    "message": "Connection timeout",
    "stack": "...",
    "code": "ETIMEDOUT"
  },
  "attempts": 5
}
```

DLQ retention: 30 days. Replay requires platform admin or organization owner (for tenant-scoped jobs).

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [events/catalog.md](../events/catalog.md) | Event triggers |
| [webhooks/catalog.md](../webhooks/catalog.md) | `dispatch-webhook` job |
| [ADR-0003](../../adr/ADR-0003-event-driven-kafka.md) | Event-driven architecture |
| [20-audit-events.md](../../database/20-audit-events.md) | Outbox relay |

---

*Document owner: Platform Infrastructure Team · Review cadence: Per release*