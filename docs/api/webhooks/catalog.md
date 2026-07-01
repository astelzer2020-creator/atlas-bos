# Atlas BOS Outbound Webhook Catalog

**Document ID:** ATLAS-API-WHK-001  
**Phase:** 5  
**Version:** 1.0.0  
**Last Updated:** 2026-06-30

---

## Overview

Atlas delivers **outbound webhooks** to customer-configured HTTPS endpoints when events occur in their organization. Webhooks enable integrations with Zapier, Make, custom middleware, and partner systems without polling.

### Management API

```
POST   /v1/webhook-endpoints          # Register endpoint
GET    /v1/webhook-endpoints          # List endpoints
PATCH  /v1/webhook-endpoints/{id}     # Update URL, events, secret
DELETE /v1/webhook-endpoints/{id}     # Delete endpoint
POST   /v1/webhook-endpoints/{id}/test  # Send test event
GET    /v1/webhook-deliveries         # Delivery log
POST   /v1/webhook-deliveries/{id}/retry  # Manual retry
```

---

## Delivery Guarantees

| Guarantee | Behavior |
|-----------|----------|
| **Delivery semantics** | At-least-once |
| **Ordering** | Best-effort per aggregate; not guaranteed across events |
| **Latency** | p95 < 5s from domain event to first delivery attempt |
| **Timeout** | 30s per delivery attempt (connect + response) |
| **Success criteria** | HTTP 2xx within timeout |
| **Idempotency** | Receivers must dedup on `event.id` |

### Retry Policy

```
Attempt 1: Immediate
Attempt 2: +1 minute
Attempt 3: +5 minutes
Attempt 4: +30 minutes
Attempt 5: +2 hours
Attempt 6: +8 hours
Attempt 7: +24 hours (final)
```

After 7 failed attempts (≈33 hours), delivery moves to **dead letter** state. Customers receive `webhook.endpoint.disabled` if failure rate exceeds 90% over 24h (auto-disable protection).

### Endpoint Requirements

| Requirement | Detail |
|-------------|--------|
| Protocol | HTTPS only (TLS 1.2+) |
| Port | 443 (default) |
| Response | 2xx within 30s |
| IP allowlist | Optional; Atlas egress IPs documented per region |
| Redirects | Max 3 redirects; POST body preserved |

---

## Signature Verification (HMAC-SHA256)

Every webhook request includes an HMAC-SHA256 signature for payload integrity and authenticity.

### Headers

| Header | Description |
|--------|-------------|
| `Atlas-Signature` | `t=<unix_timestamp>,v1=<hex_signature>` |
| `Atlas-Event-Id` | ULID — deduplication key |
| `Atlas-Event-Type` | Webhook event type (e.g., `contact.created`) |
| `Atlas-Delivery-Id` | Unique delivery attempt ID |
| `Atlas-Timestamp` | ISO 8601 UTC |
| `User-Agent` | `Atlas-Webhooks/1.0` |
| `Content-Type` | `application/json` |

### Signature Computation

```
signed_payload = "{timestamp}.{raw_body}"
signature = HMAC-SHA256(webhook_secret, signed_payload)
```

### Verification (Node.js)

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifyAtlasWebhook(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=') as [string, string]),
  );
  const timestamp = parseInt(parts.t, 10);
  const expectedSig = parts.v1;

  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    return false; // Replay protection
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const computed = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return timingSafeEqual(
    Buffer.from(computed, 'hex'),
    Buffer.from(expectedSig, 'hex'),
  );
}
```

### Secret Rotation

- Endpoints have `secret` (shown once at creation) and optional `previousSecret` (24h overlap)
- Signatures verified against both during rotation window
- `POST /v1/webhook-endpoints/{id}/rotate-secret` generates new secret

---

## Webhook Payload Envelope

All webhook types share this envelope:

```json
{
  "id": "01J8X9K2M4N5P6Q7R8S9T0UVW",
  "type": "contact.created",
  "apiVersion": "2026-06-30",
  "createdAt": "2026-06-30T14:32:01.123Z",
  "organizationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "data": {
    "object": { },
    "previousAttributes": { }
  },
  "livemode": true,
  "requestId": "req_01JABC..."
}
```

| Field | Description |
|-------|-------------|
| `id` | Unique event ID (dedup key) |
| `type` | Webhook event type |
| `apiVersion` | API version at event creation |
| `data.object` | Full resource snapshot |
| `data.previousAttributes` | Changed fields only (update events) |
| `livemode` | `false` for test/sandbox events |

---

## Webhook Event Types

### Platform

#### `organization.updated`

**Trigger:** Organization settings changed  
**Domain event:** `platform.organization.updated.v1`

```json
{
  "type": "organization.updated",
  "data": {
    "object": {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "Acme US Inc.",
      "slug": "acme-us",
      "status": "ACTIVE",
      "timezone": "America/New_York",
      "currencyCode": "USD"
    },
    "previousAttributes": { "name": "Acme Inc." }
  }
}
```

---

#### `user.joined`

**Trigger:** User accepted invitation  
**Domain event:** `platform.user.joined.v1`

```json
{
  "data": {
    "object": {
      "userId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "email": "jane@acme.com",
      "displayName": "Jane Smith",
      "membershipId": "uuid",
      "joinedAt": "2026-06-30T14:32:01.123Z"
    }
  }
}
```

---

#### `user.invited`

**Trigger:** Invitation email sent  
**Domain event:** `platform.user.invited.v1`

---

#### `api_key.created`

**Trigger:** New API key generated  
**Domain event:** `platform.api_key.created.v1`

---

#### `api_key.revoked`

**Trigger:** API key revoked  
**Domain event:** `platform.api_key.revoked.v1`

---

### CRM

#### `account.created`

**Trigger:** CRM account created  
**Domain event:** `customer.account.created.v1`

```json
{
  "type": "account.created",
  "data": {
    "object": {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "Acme Corp",
      "accountType": "CUSTOMER",
      "ownerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "createdAt": "2026-06-30T14:32:01.123Z"
    }
  }
}
```

---

#### `account.updated`

**Trigger:** Account fields changed  
**Domain event:** `customer.account.updated.v1`

---

#### `account.deleted`

**Trigger:** Account soft-deleted  
**Domain event:** `customer.account.deleted.v1`

---

#### `contact.created`

**Trigger:** Contact created  
**Domain event:** `customer.contact.created.v1`

```json
{
  "type": "contact.created",
  "data": {
    "object": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "displayName": "Jane Smith",
      "email": "jane@acme.com",
      "accountId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "ownerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "status": "active",
      "createdAt": "2026-06-30T14:32:01.123Z"
    }
  }
}
```

---

#### `contact.updated`

**Trigger:** Contact fields changed  
**Domain event:** `customer.contact.updated.v1`

---

#### `contact.deleted`

**Trigger:** Contact soft-deleted  
**Domain event:** `customer.contact.deleted.v1`

---

#### `lead.created`

**Trigger:** New lead captured  
**Domain event:** `customer.lead.created.v1`

---

#### `lead.qualified`

**Trigger:** Lead marked qualified  
**Domain event:** `customer.lead.qualified.v1`

---

#### `lead.converted`

**Trigger:** Lead converted to contact/account/deal  
**Domain event:** `customer.lead.converted.v1`

```json
{
  "data": {
    "object": {
      "leadId": "uuid",
      "contactId": "uuid",
      "accountId": "uuid",
      "dealId": "uuid",
      "convertedAt": "2026-06-30T14:32:01.123Z"
    }
  }
}
```

---

#### `deal.created`

**Trigger:** Deal created  
**Domain event:** `customer.deal.created.v1`

---

#### `deal.updated`

**Trigger:** Deal fields changed  
**Domain event:** `customer.deal.stage_changed.v1` (and other updates)

---

#### `deal.won`

**Trigger:** Deal marked won  
**Domain event:** `customer.deal.won.v1`

```json
{
  "type": "deal.won",
  "data": {
    "object": {
      "id": "uuid",
      "name": "Acme Enterprise License",
      "accountId": "uuid",
      "amountCents": 5000000,
      "currencyCode": "USD",
      "closedAt": "2026-06-30T14:32:01.123Z"
    }
  }
}
```

---

#### `deal.lost`

**Trigger:** Deal marked lost  
**Domain event:** `customer.deal.lost.v1`

---

#### `activity.completed`

**Trigger:** CRM activity marked complete  
**Domain event:** `customer.activity.completed.v1`

---

### ERP / Inventory

#### `product.created`

**Trigger:** Product catalog item created  
**Domain event:** `commercial.product.created.v1`

---

#### `product.updated`

**Trigger:** Product details changed  
**Domain event:** `commercial.product.updated.v1`

---

#### `inventory.low_stock`

**Trigger:** Stock below reorder point  
**Domain event:** Derived from `commercial.inventory.adjusted.v1`

```json
{
  "type": "inventory.low_stock",
  "data": {
    "object": {
      "productId": "uuid",
      "sku": "WIDGET-001",
      "warehouseId": "uuid",
      "onHand": 5,
      "reorderPoint": 10
    }
  }
}
```

---

#### `order.created`

**Trigger:** Sales order created  
**Domain event:** `commercial.order.created.v1`

---

#### `order.confirmed`

**Trigger:** Sales order confirmed  
**Domain event:** `commercial.order.confirmed.v1`

```json
{
  "type": "order.confirmed",
  "data": {
    "object": {
      "id": "uuid",
      "orderNumber": "SO-5010",
      "accountId": "uuid",
      "status": "CONFIRMED",
      "grandTotalCents": 1250000,
      "currencyCode": "USD",
      "confirmedAt": "2026-06-30T14:32:01.123Z"
    }
  }
}
```

---

#### `order.shipped`

**Trigger:** Order shipped  
**Domain event:** `commercial.order.shipped.v1`

---

#### `order.cancelled`

**Trigger:** Order cancelled  
**Domain event:** `commercial.order.cancelled.v1`

---

### Finance

#### `invoice.created`

**Trigger:** Invoice created  
**Domain event:** `ledger.invoice.created.v1`

```json
{
  "type": "invoice.created",
  "data": {
    "object": {
      "id": "uuid",
      "invoiceNumber": "INV-2026-0042",
      "accountId": "uuid",
      "status": "DRAFT",
      "grandTotalCents": 5000000,
      "amountDueCents": 5000000,
      "currencyCode": "USD",
      "dueDate": "2026-07-30T00:00:00.000Z"
    }
  }
}
```

---

#### `invoice.sent`

**Trigger:** Invoice emailed to customer  
**Domain event:** `ledger.invoice.sent.v1`

---

#### `invoice.paid`

**Trigger:** Invoice fully paid  
**Domain event:** `ledger.payment.received.v1` (full payment)

---

#### `invoice.overdue`

**Trigger:** Invoice past due date  
**Domain event:** `ledger.invoice.overdue.v1`

---

#### `invoice.voided`

**Trigger:** Invoice voided  
**Domain event:** `ledger.invoice.voided.v1`

---

#### `payment.received`

**Trigger:** Payment recorded  
**Domain event:** `ledger.payment.received.v1`

```json
{
  "type": "payment.received",
  "data": {
    "object": {
      "id": "uuid",
      "invoiceId": "uuid",
      "amountCents": 2500000,
      "currencyCode": "USD",
      "paymentMethod": "ach",
      "paidAt": "2026-06-30T14:32:01.123Z"
    }
  }
}
```

---

#### `payment.failed`

**Trigger:** Payment attempt failed  
**Domain event:** `ledger.payment.failed.v1`

---

#### `expense.approved`

**Trigger:** Expense report approved  
**Domain event:** `ledger.expense.approved.v1`

---

### HR

#### `employee.hired`

**Trigger:** New employee onboarded  
**Domain event:** `workforce.employee.hired.v1`

---

#### `employee.terminated`

**Trigger:** Employee terminated  
**Domain event:** `workforce.employee.terminated.v1`

---

#### `time_off.approved`

**Trigger:** Time-off request approved  
**Domain event:** `workforce.time_off.approved.v1`

---

#### `payroll.processed`

**Trigger:** Payroll run completed  
**Domain event:** `workforce.payroll.processed.v1`

---

### Projects

#### `project.created`

**Trigger:** Project created  
**Domain event:** `delivery.project.created.v1`

---

#### `project.completed`

**Trigger:** Project marked complete  
**Domain event:** `delivery.project.completed.v1`

---

#### `task.assigned`

**Trigger:** Task assigned to user  
**Domain event:** `delivery.task.assigned.v1`

```json
{
  "type": "task.assigned",
  "data": {
    "object": {
      "id": "uuid",
      "projectId": "uuid",
      "title": "Implement SSO integration",
      "assigneeId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "dueDate": "2026-07-15T00:00:00.000Z"
    }
  }
}
```

---

#### `task.completed`

**Trigger:** Task marked done  
**Domain event:** `delivery.task.completed.v1`

---

#### `timesheet.approved`

**Trigger:** Timesheet approved  
**Domain event:** `delivery.timesheet.approved.v1`

---

### Marketing

#### `campaign.started`

**Trigger:** Campaign send initiated  
**Domain event:** `campaign.campaign.started.v1`

---

#### `campaign.completed`

**Trigger:** Campaign finished sending  
**Domain event:** `campaign.campaign.completed.v1`

---

#### `email.bounced`

**Trigger:** Email hard/soft bounce  
**Domain event:** `campaign.email.bounced.v1`

---

#### `email.unsubscribed`

**Trigger:** Contact unsubscribed  
**Domain event:** `campaign.email.unsubscribed.v1`

---

### Automation

#### `workflow.activated`

**Trigger:** Workflow enabled  
**Domain event:** `orchestration.workflow.activated.v1`

---

#### `workflow_run.completed`

**Trigger:** Workflow run succeeded  
**Domain event:** `orchestration.workflow_run.completed.v1`

---

#### `workflow_run.failed`

**Trigger:** Workflow run failed  
**Domain event:** `orchestration.workflow_run.failed.v1`

```json
{
  "type": "workflow_run.failed",
  "data": {
    "object": {
      "runId": "uuid",
      "workflowId": "uuid",
      "workflowName": "Lead Nurture Sequence",
      "failedStepId": "uuid",
      "error": "HTTP 500 from external API",
      "failedAt": "2026-06-30T14:32:01.123Z"
    }
  }
}
```

---

### Support

#### `ticket.created`

**Trigger:** Support ticket opened  
**Domain event:** `service.ticket.created.v1`

---

#### `ticket.assigned`

**Trigger:** Ticket assigned to agent  
**Domain event:** `service.ticket.assigned.v1`

---

#### `ticket.resolved`

**Trigger:** Ticket resolved  
**Domain event:** `service.ticket.resolved.v1`

---

#### `ticket.sla_breached`

**Trigger:** SLA deadline missed  
**Domain event:** `service.ticket.sla_breached.v1`

---

### Documents

#### `document.uploaded`

**Trigger:** File uploaded  
**Domain event:** `content.document.uploaded.v1`

---

#### `document.shared`

**Trigger:** Document shared with users  
**Domain event:** `content.document.shared.v1`

---

### Billing (Workspace-level)

#### `subscription.updated`

**Trigger:** Plan or seats changed  
**Domain event:** `billing.subscription.updated.v1`

---

#### `subscription.cancelled`

**Trigger:** Subscription cancelled  
**Domain event:** `billing.subscription.cancelled.v1`

---

#### `usage.threshold_exceeded`

**Trigger:** Usage limit threshold crossed  
**Domain event:** `billing.usage.threshold_exceeded.v1`

---

### System / Meta

#### `webhook.endpoint.disabled`

**Trigger:** Endpoint auto-disabled due to failures  
**Domain event:** Internal

```json
{
  "type": "webhook.endpoint.disabled",
  "data": {
    "object": {
      "endpointId": "uuid",
      "url": "https://hooks.example.com/atlas",
      "reason": "FAILURE_RATE_EXCEEDED",
      "failureRate": 0.95,
      "disabledAt": "2026-06-30T14:32:01.123Z"
    }
  }
}
```

---

#### `ping`

**Trigger:** Test delivery or endpoint verification  
**Domain event:** N/A (synthetic)

```json
{
  "type": "ping",
  "data": {
    "object": { "message": "Atlas webhook endpoint verified" }
  },
  "livemode": false
}
```

---

## Event Type Index

| Category | Event Types | Count |
|----------|-------------|-------|
| Platform | `organization.updated`, `user.joined`, `user.invited`, `api_key.created`, `api_key.revoked` | 5 |
| CRM | `account.*`, `contact.*`, `lead.*`, `deal.*`, `activity.completed` | 14 |
| ERP | `product.*`, `inventory.low_stock`, `order.*` | 7 |
| Finance | `invoice.*`, `payment.*`, `expense.approved` | 8 |
| HR | `employee.*`, `time_off.approved`, `payroll.processed` | 4 |
| Projects | `project.*`, `task.*`, `timesheet.approved` | 5 |
| Marketing | `campaign.*`, `email.*` | 4 |
| Automation | `workflow.*`, `workflow_run.*` | 3 |
| Support | `ticket.*` | 4 |
| Documents | `document.*` | 2 |
| Billing | `subscription.*`, `usage.threshold_exceeded` | 3 |
| System | `webhook.endpoint.disabled`, `ping` | 2 |
| **Total** | | **58** |

---

## Subscription Configuration

```json
{
  "url": "https://hooks.example.com/atlas",
  "description": "Production integration",
  "enabledEvents": [
    "contact.created",
    "contact.updated",
    "deal.won",
    "invoice.paid",
    "order.confirmed"
  ],
  "apiVersion": "2026-06-30",
  "metadata": { "environment": "production" }
}
```

| Field | Rules |
|-------|-------|
| `enabledEvents` | Subset of catalog; `["*"]` for all (Enterprise) |
| `apiVersion` | Pins payload shape; defaults to latest |
| Max endpoints | 10 (Starter), 25 (Growth), 100 (Enterprise) |

---

## Filtering & Scoping

- Webhooks are scoped to **organization** — never cross-tenant
- Workspace-level billing events use `workspaceId` in payload
- Sandbox organizations receive `livemode: false` events only to sandbox endpoints

---

## Best Practices for Receivers

1. **Respond quickly** — Return 2xx immediately; process async
2. **Dedup events** — Store `id` in idempotency table (7-day TTL minimum)
3. **Verify signatures** — Reject unsigned or invalid signatures
4. **Handle replays** — Same `id` may arrive multiple times
5. **Log `Atlas-Delivery-Id`** — For support correlation
6. **Use `apiVersion`** — Pin version in endpoint config for stability

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [events/catalog.md](../events/catalog.md) | Source domain events |
| [ADR-0008](../../adr/ADR-0008-stripe-payments.md) | Billing webhook patterns |
| [openapi/platform.yaml](../openapi/platform.yaml) | Webhook management REST API |

---

*Document owner: Partner Integrations Team · Review cadence: Per release*