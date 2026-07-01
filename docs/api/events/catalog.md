# Atlas BOS Domain Event Catalog

**Document ID:** ATLAS-API-EVT-001  
**Phase:** 5  
**Version:** 1.0.0  
**Last Updated:** 2026-06-30  
**Format:** [CloudEvents 1.0](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md)

---

## Overview

Atlas publishes domain events via the **transactional outbox** pattern (PostgreSQL → Kafka). All events conform to CloudEvents 1.0 binary mode over Kafka headers with JSON data payload.

### Event Name Convention

```
{context}.{aggregate}.{action}.v{major}
```

| Component | Example |
|-----------|---------|
| Context | `customer`, `ledger`, `platform` |
| Aggregate | `contact`, `invoice`, `workflow` |
| Action | Past-tense verb: `created`, `confirmed`, `posted` |
| Version | Major only: `v1`, `v2` |

### Kafka Topic

```
atlas.{event-name}
# Example: atlas.customer.contact.created.v1
```

**Partition key:** `{organizationId}:{aggregateId}`

---

## CloudEvents Envelope

All events share this envelope structure:

```json
{
  "specversion": "1.0",
  "id": "01J8X9K2M4N5P6Q7R8S9T0UVW",
  "source": "atlas://customer-service",
  "type": "customer.contact.created.v1",
  "datacontenttype": "application/json",
  "time": "2026-06-30T14:32:01.123Z",
  "subject": "550e8400-e29b-41d4-a716-446655440000",
  "atlasorganizationid": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "atlasworkspaceid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "atlastraceid": "01JABC...",
  "data": {
    "eventId": "01J8X9K2M4N5P6Q7R8S9T0UVW",
    "organizationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "workspaceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "correlationId": "01JABC...",
    "causationId": "01JDEF...",
    "occurredAt": "2026-06-30T14:32:01.123Z",
    "actor": {
      "type": "user",
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
    },
    "aggregate": {
      "type": "contact",
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "version": 1
    },
    "payload": { }
  }
}
```

### Required `data` Fields

| Field | Type | Description |
|-------|------|-------------|
| `eventId` | ULID | Unique event identifier (dedup key) |
| `organizationId` | UUID | Tenant isolation key |
| `workspaceId` | UUID | Billing workspace |
| `correlationId` | ULID | Request trace |
| `causationId` | ULID | Parent event/command |
| `occurredAt` | ISO 8601 | Event timestamp (UTC) |
| `actor` | Object | `{ type, id }` — user, system, api_key, agent, workflow |
| `aggregate` | Object | `{ type, id, version }` |
| `payload` | Object | Event-specific data |

---

## Platform Events

### `platform.organization.created.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-platform-service` |
| **Consumers** | `atlas-billing`, `atlas-search-indexer`, `atlas-analytics`, `atlas-webhook-dispatcher` |
| **Trigger** | Organization provisioned after signup |

**Payload schema:**
```json
{
  "organizationId": "uuid",
  "workspaceId": "uuid",
  "slug": "string",
  "name": "string",
  "status": "PROVISIONING | ACTIVE",
  "dataRegion": "string",
  "planCode": "string"
}
```

**Example:**
```json
{
  "payload": {
    "organizationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "workspaceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "slug": "acme-us",
    "name": "Acme US Inc.",
    "status": "ACTIVE",
    "dataRegion": "us-east-1",
    "planCode": "growth"
  }
}
```

---

### `platform.organization.updated.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-platform-service` |
| **Consumers** | `atlas-search-indexer`, `atlas-webhook-dispatcher` |
| **Trigger** | Organization settings changed |

**Payload:** `{ organizationId, changes: { field: { old, new } } }`

---

### `platform.organization.suspended.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-platform-service` |
| **Consumers** | `atlas-billing`, `atlas-gateway`, `atlas-webhook-dispatcher` |
| **Trigger** | Admin or billing suspension |

**Payload:** `{ organizationId, reason, suspendedAt }`

---

### `platform.user.invited.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-identity-service` |
| **Consumers** | `atlas-notification-service`, `atlas-email-worker` |
| **Trigger** | User invitation sent |

**Payload:** `{ invitationId, email, organizationId, roleIds[], invitedBy }`

---

### `platform.user.joined.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-identity-service` |
| **Consumers** | `atlas-analytics`, `atlas-webhook-dispatcher` |
| **Trigger** | Invitation accepted or SSO provision |

**Payload:** `{ userId, organizationId, membershipId }`

---

### `platform.role.assigned.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-authz-service` |
| **Consumers** | `atlas-audit-service`, `atlas-cache-invalidator` |
| **Trigger** | Role assigned to user |

**Payload:** `{ userId, roleId, scopeType, scopeId }`

---

### `platform.api_key.created.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-identity-service` |
| **Consumers** | `atlas-audit-service`, `atlas-webhook-dispatcher` |
| **Trigger** | API key generated |

**Payload:** `{ apiKeyId, name, prefix, scopes[], expiresAt }`

---

### `platform.api_key.revoked.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-identity-service` |
| **Consumers** | `atlas-gateway`, `atlas-audit-service` |
| **Trigger** | API key revoked |

**Payload:** `{ apiKeyId, revokedBy, revokedAt }`

---

### `platform.session.created.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-identity-service` |
| **Consumers** | `atlas-analytics`, `atlas-fraud-detector` |
| **Trigger** | Successful authentication |

**Payload:** `{ sessionId, userId, ipAddress, userAgent, mfaUsed }`

---

### `platform.workspace.plan_changed.v1`

| Attribute | Value |
|-----------|-------|
| **Producer** | `atlas-billing-service` |
| **Consumers** | `atlas-gateway`, `atlas-feature-flags`, `atlas-webhook-dispatcher` |
| **Trigger** | Subscription plan upgrade/downgrade |

**Payload:** `{ workspaceId, previousPlanCode, newPlanCode, effectiveAt }`

---

## CRM Events (`customer` context)

### `customer.account.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-search-indexer`, `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ accountId, name, accountType, ownerId }`

---

### `customer.account.updated.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-search-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ accountId, changes }`

---

### `customer.account.deleted.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-search-indexer`, `atlas-erp-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ accountId, deletedAt }`

---

### `customer.contact.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-search-indexer`, `atlas-marketing-service`, `atlas-webhook-dispatcher` |

**Payload example:**
```json
{
  "payload": {
    "contactId": "550e8400-e29b-41d4-a716-446655440000",
    "accountId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "displayName": "Jane Smith",
    "email": "jane@acme.com",
    "ownerId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
}
```

---

### `customer.contact.updated.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-search-indexer`, `atlas-marketing-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ contactId, changes }`

---

### `customer.contact.deleted.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-search-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ contactId, deletedAt }`

---

### `customer.lead.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-search-indexer`, `atlas-automation-engine`, `atlas-webhook-dispatcher` |

**Payload:** `{ leadId, source, displayName, email, ownerId }`

---

### `customer.lead.qualified.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-automation-engine`, `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ leadId, score, qualifiedBy }`

---

### `customer.lead.converted.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-analytics`, `atlas-automation-engine`, `atlas-webhook-dispatcher` |

**Payload:** `{ leadId, contactId, accountId, dealId }`

---

### `customer.lead.disqualified.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ leadId, reason }`

---

### `customer.deal.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-search-indexer`, `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ dealId, name, accountId, pipelineId, stage, amountCents, currencyCode }`

---

### `customer.deal.stage_changed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-automation-engine`, `atlas-notification-service`, `atlas-graphql-subscription-bridge`, `atlas-webhook-dispatcher` |

**Payload:** `{ dealId, previousStage, newStage, probability }`

---

### `customer.deal.won.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-erp-service`, `atlas-finance-service`, `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ dealId, accountId, amountCents, currencyCode, closedAt }`

---

### `customer.deal.lost.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ dealId, lostReason, closedAt }`

---

### `customer.activity.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-notification-service`, `atlas-graphql-subscription-bridge` |

**Payload:** `{ activityId, type, subject, contactId, dealId, dueAt }`

---

### `customer.activity.completed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-crm-service` | `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ activityId, completedAt, completedBy }`

---

## ERP / Commercial Events (`commercial` context)

### `commercial.product.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-erp-service` | `atlas-search-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ productId, sku, name, unitPriceCents, currencyCode }`

---

### `commercial.product.updated.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-erp-service` | `atlas-search-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ productId, changes }`

---

### `commercial.inventory.adjusted.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-stock-service` | `atlas-erp-service`, `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ productId, warehouseId, previousQty, newQty, reason }`

---

### `commercial.inventory.reserved.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-stock-service` | `atlas-erp-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ reservationId, orderId, productId, quantity, warehouseId }`

---

### `commercial.inventory.released.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-stock-service` | `atlas-erp-service` |

**Payload:** `{ reservationId, orderId, reason }`

---

### `commercial.order.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-erp-service` | `atlas-search-indexer`, `atlas-stock-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ orderId, orderNumber, accountId, status, grandTotalCents, currencyCode }`

---

### `commercial.order.confirmed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-erp-service` | `atlas-stock-service`, `atlas-finance-service`, `atlas-automation-engine`, `atlas-webhook-dispatcher` |

**Payload:** `{ orderId, confirmedAt, lineItems[] }`

---

### `commercial.order.shipped.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-erp-service` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ orderId, trackingNumber, carrier, shippedAt }`

---

### `commercial.order.cancelled.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-erp-service` | `atlas-stock-service`, `atlas-finance-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ orderId, reason, cancelledAt }`

---

### `commercial.purchase_order.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-erp-service` | `atlas-finance-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ purchaseOrderId, vendorId, grandTotalCents }`

---

### `commercial.purchase_order.received.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-erp-service` | `atlas-stock-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ purchaseOrderId, receivedLines[], receivedAt }`

---

## Finance / Ledger Events (`ledger` context)

### `ledger.invoice.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-search-indexer`, `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ invoiceId, invoiceNumber, accountId, grandTotalCents, currencyCode, dueDate }`

---

### `ledger.invoice.sent.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-email-worker`, `atlas-webhook-dispatcher` |

**Payload:** `{ invoiceId, sentTo, sentAt }`

---

### `ledger.invoice.posted.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-gl-service`, `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ invoiceId, journalEntryId, postedAt }`

---

### `ledger.invoice.overdue.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-scheduler` | `atlas-notification-service`, `atlas-automation-engine`, `atlas-webhook-dispatcher` |

**Payload:** `{ invoiceId, daysOverdue, amountDueCents }`

---

### `ledger.invoice.voided.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-gl-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ invoiceId, reason, voidedAt }`

---

### `ledger.payment.received.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-gl-service`, `atlas-crm-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ paymentId, invoiceId, amountCents, currencyCode, paymentMethod, paidAt }`

---

### `ledger.payment.failed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ paymentId, invoiceId, failureCode, failureMessage }`

---

### `ledger.payment.refunded.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-gl-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ refundId, paymentId, amountCents, reason }`

---

### `ledger.expense.submitted.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ expenseId, employeeId, amountCents, category }`

---

### `ledger.expense.approved.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-gl-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ expenseId, approvedBy, approvedAt }`

---

### `ledger.journal_entry.posted.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-gl-service` | `atlas-analytics`, `atlas-audit-service` |

**Payload:** `{ journalEntryId, entryNumber, lines[] }`

---

### `ledger.bank_reconciliation.completed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-finance-service` | `atlas-analytics`, `atlas-notification-service` |

**Payload:** `{ reconciliationId, bankAccountId, matchedCount, unmatchedCount }`

---

## HR / Workforce Events (`workforce` context)

### `workforce.employee.hired.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-hr-service` | `atlas-identity-service`, `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ employeeId, userId, departmentId, hireDate, jobTitle }`

---

### `workforce.employee.updated.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-hr-service` | `atlas-search-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ employeeId, changes }`

---

### `workforce.employee.terminated.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-hr-service` | `atlas-identity-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ employeeId, terminationDate, reason }`

---

### `workforce.time_off.requested.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-hr-service` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ requestId, employeeId, type, startDate, endDate, days }`

---

### `workforce.time_off.approved.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-hr-service` | `atlas-calendar-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ requestId, approvedBy, approvedAt }`

---

### `workforce.time_off.rejected.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-hr-service` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ requestId, rejectedBy, reason }`

---

### `workforce.payroll.processed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-hr-service` | `atlas-finance-service`, `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ payrollRunId, periodStart, periodEnd, totalGrossCents, employeeCount }`

---

### `workforce.department.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-hr-service` | `atlas-search-indexer` |

**Payload:** `{ departmentId, name, parentId }`

---

## Projects / Delivery Events (`delivery` context)

### `delivery.project.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-projects-service` | `atlas-search-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ projectId, name, accountId, dealId, ownerId }`

---

### `delivery.project.status_changed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-projects-service` | `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ projectId, previousStatus, newStatus }`

---

### `delivery.project.completed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-projects-service` | `atlas-finance-service`, `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ projectId, completedAt, actualHours }`

---

### `delivery.task.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-projects-service` | `atlas-notification-service`, `atlas-graphql-subscription-bridge` |

**Payload:** `{ taskId, projectId, title, assigneeId, dueDate }`

---

### `delivery.task.assigned.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-projects-service` | `atlas-notification-service`, `atlas-graphql-subscription-bridge`, `atlas-webhook-dispatcher` |

**Payload:** `{ taskId, assigneeId, assignedBy }`

---

### `delivery.task.completed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-projects-service` | `atlas-analytics`, `atlas-graphql-subscription-bridge`, `atlas-webhook-dispatcher` |

**Payload:** `{ taskId, projectId, completedAt, actualHours }`

---

### `delivery.milestone.reached.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-projects-service` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ milestoneId, projectId, name, reachedAt }`

---

### `delivery.timesheet.submitted.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-projects-service` | `atlas-notification-service`, `atlas-finance-service` |

**Payload:** `{ timesheetId, employeeId, totalHours, weekStart }`

---

### `delivery.timesheet.approved.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-projects-service` | `atlas-finance-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ timesheetId, approvedBy, billableHours }`

---

## Marketing Events (`campaign` context)

### `campaign.campaign.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-marketing-service` | `atlas-search-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ campaignId, name, campaignType, ownerId }`

---

### `campaign.campaign.scheduled.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-marketing-service` | `atlas-job-scheduler`, `atlas-webhook-dispatcher` |

**Payload:** `{ campaignId, scheduledAt, segmentId, audienceSize }`

---

### `campaign.campaign.started.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-marketing-service` | `atlas-analytics`, `atlas-graphql-subscription-bridge` |

**Payload:** `{ campaignId, startedAt }`

---

### `campaign.campaign.completed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-marketing-service` | `atlas-analytics`, `atlas-webhook-dispatcher` |

**Payload:** `{ campaignId, metrics: { sent, delivered, opened, clicked } }`

---

### `campaign.email.bounced.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-marketing-service` | `atlas-crm-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ contactId, email, bounceType, campaignId }`

---

### `campaign.email.unsubscribed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-marketing-service` | `atlas-crm-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ contactId, email, campaignId, unsubscribedAt }`

---

### `campaign.segment.refreshed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-marketing-service` | `atlas-analytics` |

**Payload:** `{ segmentId, previousCount, newCount, refreshedAt }`

---

## Automation Events (`orchestration` context)

### `orchestration.workflow.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-automation-engine` | `atlas-search-indexer` |

**Payload:** `{ workflowId, name, triggerType }`

---

### `orchestration.workflow.activated.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-automation-engine` | `atlas-webhook-dispatcher` |

**Payload:** `{ workflowId, activatedAt }`

---

### `orchestration.workflow_run.started.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-automation-engine` | `atlas-graphql-subscription-bridge`, `atlas-analytics` |

**Payload:** `{ runId, workflowId, triggeredBy, context }`

---

### `orchestration.workflow_run.completed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-automation-engine` | `atlas-graphql-subscription-bridge`, `atlas-webhook-dispatcher` |

**Payload:** `{ runId, workflowId, durationMs, stepCount }`

---

### `orchestration.workflow_run.failed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-automation-engine` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ runId, workflowId, failedStepId, error }`

---

### `orchestration.webhook_action.dispatched.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-automation-engine` | `atlas-audit-service` |

**Payload:** `{ actionId, url, method, statusCode }`

---

## AI / Intelligence Events (`intelligence` context)

### `intelligence.agent.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-ai-service` | `atlas-search-indexer` |

**Payload:** `{ agentId, name, model, tools[] }`

---

### `intelligence.conversation.started.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-ai-service` | `atlas-analytics` |

**Payload:** `{ conversationId, agentId, userId }`

---

### `intelligence.message.completed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-ai-service` | `atlas-billing-metering`, `atlas-analytics` |

**Payload:** `{ messageId, conversationId, tokensUsed, model }`

---

### `intelligence.embedding.indexed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-ai-indexer` | `atlas-search-indexer` |

**Payload:** `{ entityType, entityId, chunkCount }`

---

### `intelligence.tool.invoked.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-ai-service` | `atlas-audit-service` |

**Payload:** `{ toolName, agentId, input, output, durationMs }`

---

## Documents / Content Events (`content` context)

### `content.document.uploaded.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-documents-service` | `atlas-search-indexer`, `atlas-ai-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ documentId, name, mimeType, sizeBytes, folderId }`

---

### `content.document.deleted.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-documents-service` | `atlas-search-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ documentId, deletedAt }`

---

### `content.document.shared.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-documents-service` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ documentId, sharedWith[], permission }`

---

### `content.folder.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-documents-service` | `atlas-search-indexer` |

**Payload:** `{ folderId, name, parentId, path }`

---

## Support / Service Events (`service` context)

### `service.ticket.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-support-service` | `atlas-notification-service`, `atlas-search-indexer`, `atlas-webhook-dispatcher` |

**Payload:** `{ ticketId, ticketNumber, subject, priority, contactId }`

---

### `service.ticket.assigned.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-support-service` | `atlas-notification-service`, `atlas-graphql-subscription-bridge`, `atlas-webhook-dispatcher` |

**Payload:** `{ ticketId, assigneeId, assignedBy }`

---

### `service.ticket.escalated.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-support-service` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ ticketId, previousPriority, newPriority, reason }`

---

### `service.ticket.resolved.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-support-service` | `atlas-analytics`, `atlas-graphql-subscription-bridge`, `atlas-webhook-dispatcher` |

**Payload:** `{ ticketId, resolution, resolvedAt, resolvedBy }`

---

### `service.ticket.sla_breached.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-support-scheduler` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ ticketId, slaType, breachedAt, assigneeId }`

---

### `service.comment.added.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-support-service` | `atlas-notification-service`, `atlas-graphql-subscription-bridge` |

**Payload:** `{ commentId, ticketId, authorId, isInternal }`

---

## Billing Events (`billing` context)

### `billing.subscription.created.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-billing-service` | `atlas-platform-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ subscriptionId, workspaceId, planCode, seatCount }`

---

### `billing.subscription.updated.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-billing-service` | `atlas-platform-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ subscriptionId, changes }`

---

### `billing.subscription.cancelled.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-billing-service` | `atlas-platform-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ subscriptionId, cancelAt, reason }`

---

### `billing.invoice.paid.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-billing-service` (Stripe) | `atlas-platform-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ stripeInvoiceId, workspaceId, amountCents, paidAt }`

---

### `billing.usage.threshold_exceeded.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-billing-metering` | `atlas-notification-service`, `atlas-webhook-dispatcher` |

**Payload:** `{ workspaceId, metric, threshold, currentValue }`

---

### `billing.trial.expiring.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-billing-scheduler` | `atlas-email-worker`, `atlas-webhook-dispatcher` |

**Payload:** `{ workspaceId, expiresAt, daysRemaining }`

---

## Notification Events (`communication` context)

### `communication.notification.sent.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-notification-service` | `atlas-analytics` |

**Payload:** `{ notificationId, userId, channel, type }`

---

### `communication.notification.read.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-notification-service` | `atlas-analytics` |

**Payload:** `{ notificationId, userId, readAt }`

---

### `communication.message.received.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-messaging-service` | `atlas-notification-service`, `atlas-graphql-subscription-bridge` |

**Payload:** `{ messageId, channelId, authorId, preview }`

---

## Analytics / Insight Events (`insight` context)

### `insight.report.generated.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-analytics-service` | `atlas-notification-service`, `atlas-documents-service` |

**Payload:** `{ reportId, reportType, documentId, generatedAt }`

---

### `insight.metric.snapshot.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-analytics-aggregator` | `atlas-dashboard-cache` |

**Payload:** `{ organizationId, period, metrics: {} }`

---

## Audit Events (`audit` context)

### `audit.entity.changed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-audit-service` | `atlas-compliance-exporter`, `atlas-siem-connector` |

**Payload:** `{ entityType, entityId, action, changes, actorId }`

---

### `audit.permission.changed.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-audit-service` | `atlas-siem-connector`, `atlas-compliance-exporter` |

**Payload:** `{ targetUserId, roleId, action, changedBy }`

---

### `audit.data.exported.v1`

| Producer | Consumers |
|----------|-----------|
| `atlas-audit-service` | `atlas-siem-connector` |

**Payload:** `{ exportId, entityType, recordCount, exportedBy }`

---

## Event Index Summary

| Context | Count | Examples |
|---------|-------|----------|
| `platform` | 10 | organization.created, user.joined |
| `customer` | 16 | contact.created, deal.won |
| `commercial` | 11 | order.confirmed, inventory.reserved |
| `ledger` | 12 | invoice.posted, payment.received |
| `workforce` | 8 | employee.hired, payroll.processed |
| `delivery` | 9 | task.completed, project.completed |
| `campaign` | 7 | campaign.completed, email.bounced |
| `orchestration` | 6 | workflow_run.failed |
| `intelligence` | 5 | message.completed, tool.invoked |
| `content` | 4 | document.uploaded |
| `service` | 6 | ticket.resolved, sla_breached |
| `billing` | 6 | subscription.created, trial.expiring |
| `communication` | 3 | notification.sent, message.received |
| `insight` | 2 | report.generated |
| `audit` | 3 | entity.changed, data.exported |
| **Total** | **108** | |

---

## Consumer Guidelines

1. **Idempotency** — Dedup on `data.eventId`; store processed IDs 7 days minimum
2. **Ordering** — Per-partition ordering guaranteed; cross-partition not guaranteed
3. **Retries** — Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5); then DLQ
4. **Schema evolution** — Additive changes only within major version; new major for breaking
5. **Dead letter** — `atlas.dead-letter.{consumer-group}` after 10 failures or 72h

---

## Cross-References

| Document | Relationship |
|----------|--------------|
| [webhooks/catalog.md](../webhooks/catalog.md) | Customer-facing webhook mappings |
| [queues/background-jobs.md](../queues/background-jobs.md) | Async job triggers |
| [ADR-0003](../../adr/ADR-0003-event-driven-kafka.md) | Kafka architecture |
| [20-audit-events.md](../../database/20-audit-events.md) | Outbox schema |

---

*Document owner: Platform Integration Team · Review cadence: Per release*