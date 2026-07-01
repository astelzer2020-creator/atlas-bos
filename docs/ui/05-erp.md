---
title: ERP UI Specification
document_id: ATLAS-UI-05
version: 1.0.0
status: draft
phase: 4
last_updated: 2026-06-30
module: erp
bounded_context: stock, commercial
related_documents:
  - ATLAS-DB-06
  - ATLAS-UI-04
  - ATLAS-UI-06
tags:
  - ui
  - erp
  - inventory
  - wireframes
  - permissions
---

# ERP UI Specification

## Purpose

Complete UI specification for the **ERP** module spanning `stock` (catalog, inventory) and `commercial` (purchase/sales orders) bounded contexts.

## Route Prefix

```
/app/:orgSlug/:workspaceSlug/erp/{resource}/:id?/{action}?
```

---

## Global Conventions

Inherits breakpoints, permission model, and standard states from `04-crm.md`. ERP-specific:

| Convention | Rule |
|------------|------|
| Quantity display | Right-aligned; unit of measure suffix |
| SKU fields | Monospace font; copy-to-clipboard |
| Stock status | `in_stock`, `low_stock`, `out_of_stock`, `discontinued` badges |
| Order status | State machine badges; no skip transitions in UI |

---

## Navigation Structure

```
ERP
├── Products
│   ├── Catalog                  → /erp/products
│   ├── Detail                   → /erp/products/:id
│   ├── Variants                 → /erp/products/:id/variants
│   └── BOM Editor               → /erp/products/:id/bom
├── Inventory
│   ├── Warehouses               → /erp/warehouses
│   ├── Levels                   → /erp/inventory
│   └── Movements                → /erp/inventory/movements
├── Procurement
│   ├── Purchase Orders          → /erp/purchase-orders
│   ├── Create PO                → /erp/purchase-orders/new
│   ├── PO Detail                → /erp/purchase-orders/:id
│   └── Receive                  → /erp/purchase-orders/:id/receive
├── Sales
│   └── Sales Orders             → /erp/sales-orders
│       └── Detail               → /erp/sales-orders/:id
└── Suppliers                    → /erp/suppliers
    └── Detail                   → /erp/suppliers/:id
```

---

## Screen Inventory

| Screen ID | Name | Route | Primary Permission |
|-----------|------|-------|-------------------|
| UI-ERP-001 | Products Catalog | `/erp/products` | `erp:products:read` |
| UI-ERP-002 | Product Detail | `/erp/products/:id` | `erp:products:read` |
| UI-ERP-003 | Product Variants | `/erp/products/:id/variants` | `erp:products:read` |
| UI-ERP-004 | BOM Editor | `/erp/products/:id/bom` | `erp:bom:read` |
| UI-ERP-005 | Warehouses | `/erp/warehouses` | `erp:warehouses:read` |
| UI-ERP-006 | Inventory Levels | `/erp/inventory` | `erp:inventory:read` |
| UI-ERP-007 | Stock Movements | `/erp/inventory/movements` | `erp:inventory:read` |
| UI-ERP-008 | Purchase Orders List | `/erp/purchase-orders` | `erp:purchase_orders:read` |
| UI-ERP-009 | Purchase Order Create | `/erp/purchase-orders/new` | `erp:purchase_orders:write` |
| UI-ERP-010 | Purchase Order Detail | `/erp/purchase-orders/:id` | `erp:purchase_orders:read` |
| UI-ERP-011 | Receive Purchase Order | `/erp/purchase-orders/:id/receive` | `erp:purchase_orders:receive` |
| UI-ERP-012 | Sales Orders List | `/erp/sales-orders` | `erp:sales_orders:read` |
| UI-ERP-013 | Sales Order Detail | `/erp/sales-orders/:id` | `erp:sales_orders:read` |
| UI-ERP-014 | Suppliers List | `/erp/suppliers` | `erp:suppliers:read` |
| UI-ERP-015 | Supplier Detail | `/erp/suppliers/:id` | `erp:suppliers:read` |

### Modal Inventory

| Modal ID | Name | Permission |
|----------|------|------------|
| UI-ERP-M001 | Create Product | `erp:products:write` |
| UI-ERP-M002 | Add Variant | `erp:products:write` |
| UI-ERP-M003 | Adjust Stock | `erp:inventory:adjust` |
| UI-ERP-M004 | Transfer Stock | `erp:inventory:transfer` |
| UI-ERP-M005 | Create Warehouse | `erp:warehouses:write` |
| UI-ERP-M006 | Add BOM Component | `erp:bom:write` |
| UI-ERP-M007 | Submit Purchase Order | `erp:purchase_orders:submit` |
| UI-ERP-M008 | Approve Purchase Order | `erp:purchase_orders:approve` |
| UI-ERP-M009 | Receive Line Items | `erp:purchase_orders:receive` |
| UI-ERP-M010 | Create Sales Order | `erp:sales_orders:write` |
| UI-ERP-M011 | Fulfill Sales Order | `erp:sales_orders:fulfill` |
| UI-ERP-M012 | Create Supplier | `erp:suppliers:write` |
| UI-ERP-M013 | Link Product to Supplier | `erp:suppliers:write` |
| UI-ERP-M014 | Discontinue Product | `erp:products:write` |
| UI-ERP-M015 | Import Products | `erp:imports:write` |

---

## Screen Specifications

---

### UI-ERP-001 — Products Catalog

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/products` |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Products (156)              [Import] [Export] [+ New Product]                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Search SKU or name...] [Category ▼] [Status ▼] [Type ▼]                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ SKU      │ Name           │ Type    │ Variants │ On Hand │ Status  │ ⋮  │
│───┼──────────┼────────────────┼─────────┼──────────┼─────────┼─────────┼────│
│ ☐ │ PRD-001  │ Widget Pro     │ Stock   │ 3        │ 1,240   │ Active  │ ⋮  │
│ ☐ │ PRD-002  │ Service Pack   │ Service │ —        │ —       │ Active  │ ⋮  │
│ ☐ │ PRD-003  │ Legacy Part    │ Stock   │ 1        │ 0       │ Disc.   │ ⋮  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Bulk: [Discontinue] [Export]                         Page 1 of 8  [< 1 2 >] │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View catalog | `erp:products:read` |
| Create product | `erp:products:write` → M001 |
| Edit | `erp:products:write` |
| Delete | `erp:products:delete` |
| Import | `erp:imports:write` → M015 |
| Export | `erp:exports:read` |
| Discontinue | `erp:products:write` → M014 |
| View inventory | `erp:inventory:read` |

#### Responsive

| Breakpoint | Layout |
|------------|--------|
| **Desktop** | Full table with on-hand aggregate |
| **Tablet** | Hide variants column; card fallback |
| **Mobile** | Product cards with SKU, stock badge; FAB create |

---

### UI-ERP-002 — Product Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/products/:productId` |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Products  Widget Pro  [Active]     [Edit] [Add Variant] [BOM] [⋮]         │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ PRODUCT INFO                 │ INVENTORY SUMMARY                             │
│ SKU: PRD-001                 │ Total on hand: 1,240 EA                       │
│ Type: Stock item             │ Reserved: 120 · Available: 1,120              │
│ Category: Hardware           │ By warehouse: [chart/table]                   │
│ UoM: Each (EA)               │                                               │
│ Description: ...             │ VARIANTS (3)                    [Manage →]    │
│                              │ Standard · Red · Blue                         │
│ SUPPLIERS (2)                │                                               │
│ Acme Supply · $12.50         │ RECENT MOVEMENTS              [View all →]  │
│ Beta Parts · $13.00          │ +50 received PO-1042 · 2h ago                 │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `erp:products:read` |
| Edit | `erp:products:write` |
| Add variant | `erp:products:write` → M002 |
| Edit BOM | `erp:bom:write` → 004 |
| Adjust stock | `erp:inventory:adjust` → M003 |
| Link supplier | `erp:suppliers:write` → M013 |
| Discontinue | `erp:products:write` |

---

### UI-ERP-003 — Product Variants

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/products/:productId/variants` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Widget Pro   Variants                              [+ Add Variant]         │
├──────────────────────────────────────────────────────────────────────────────┤
│ SKU         │ Attributes      │ Barcode      │ On Hand │ Price    │ Status │⋮│
│ PRD-001-STD │ —               │ 012345678901 │ 800     │ $29.99   │ Active │⋮│
│ PRD-001-RED │ Color: Red      │ 012345678902 │ 240     │ $32.99   │ Active │⋮│
│ PRD-001-BLU │ Color: Blue     │ 012345678903 │ 200     │ $32.99   │ Active │⋮│
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View variants | `erp:products:read` |
| Add variant | `erp:products:write` |
| Edit variant | `erp:products:write` |
| Delete variant | `erp:products:delete` | Blocked if inventory > 0 |
| Set default variant | `erp:products:write` |

---

### UI-ERP-004 — BOM Editor

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/products/:productId/bom` |
| **Layout** | Editable tree table |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Widget Pro   Bill of Materials                    [+ Add Component] [Save] │
├──────────────────────────────────────────────────────────────────────────────┤
│ Assembly: Widget Pro (PRD-001)                           Version: 3  [History]│
├──────────────────────────────────────────────────────────────────────────────┤
│ Component SKU  │ Name          │ Qty per │ UoM  │ Scrap % │ Cost roll-up │⋮│
│ CMP-100        │ Housing         │ 1.0     │ EA   │ 0%      │ $4.50        │⋮│
│ CMP-101        │ Circuit Board   │ 1.0     │ EA   │ 2%      │ $8.20        │⋮│
│ CMP-102        │ Fastener Kit    │ 2.0     │ EA   │ 0%      │ $0.80        │⋮│
├──────────────────────────────────────────────────────────────────────────────┤
│ Total material cost: $13.50/unit          [Explode BOM] [Where Used]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View BOM | `erp:bom:read` |
| Edit BOM | `erp:bom:write` |
| Add component | `erp:bom:write` → M006 |
| Remove component | `erp:bom:write` |
| Explode (multi-level) | `erp:bom:read` |
| Where used | `erp:bom:read` |

**Validation UI**: Circular BOM → inline error on save; component discontinued → warning badge.

#### Responsive

- **Mobile**: Read-only list; edit redirects to simplified M006 sequential flow

---

### UI-ERP-005 — Warehouses

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/warehouses` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Warehouses (4)                                        [+ New Warehouse]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Code   │ Name              │ Location        │ Default │ Items │ Value    │⋮ │
│ WH-01  │ Main Warehouse    │ Austin, TX      │ ★       │ 342   │ $284K    │⋮ │
│ WH-02  │ East Coast        │ Newark, NJ      │         │ 128   │ $92K     │⋮ │
│ WH-03  │ Returns           │ Austin, TX      │         │ 45    │ $8K      │⋮ │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `erp:warehouses:read` |
| Create | `erp:warehouses:write` → M005 |
| Edit | `erp:warehouses:write` |
| Set default | `erp:warehouses:write` |
| Delete | `erp:warehouses:delete` | Blocked if inventory > 0 |
| View inventory | `erp:inventory:read` → 006 filtered |

---

### UI-ERP-006 — Inventory Levels

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/inventory` |

#### Wireframe — Desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Inventory Levels            [Adjust] [Transfer]              [Export]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍] [Warehouse ▼] [Product ▼] [Low stock only ☐]                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ SKU         │ Product/Variant  │ Warehouse │ On Hand │ Reserved │ Avail │ ⋮ │
│ PRD-001-STD │ Widget Pro Std   │ WH-01     │ 800     │ 50       │ 750   │ ⋮ │
│ PRD-001-RED │ Widget Pro Red   │ WH-01     │ 240     │ 70       │ 170   │ ⋮ │
│ PRD-003     │ Legacy Part      │ WH-01     │ 0  🔴   │ 0        │ 0     │ ⋮ │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View levels | `erp:inventory:read` |
| Adjust quantity | `erp:inventory:adjust` → M003 |
| Transfer between warehouses | `erp:inventory:transfer` → M004 |
| View movements | `erp:inventory:read` → 007 |
| Set reorder point | `erp:inventory:write` |

**Low stock**: Rows where `available < reorder_point` highlighted amber.

#### Responsive

- **Mobile**: Filter sheet; swipe row → Adjust / Transfer

---

### UI-ERP-007 — Stock Movements

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/inventory/movements` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Stock Movements (immutable ledger)                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Date range ▼] [Warehouse ▼] [Type ▼] [Product ▼]                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ Timestamp        │ Type       │ SKU       │ Qty    │ Warehouse │ Reference   │
│ Jun 30 14:22     │ RECEIPT    │ PRD-001   │ +50    │ WH-01     │ PO-1042     │
│ Jun 30 11:05     │ TRANSFER   │ PRD-001   │ -20    │ WH-01     │ TRF-881     │
│ Jun 30 11:05     │ TRANSFER   │ PRD-001   │ +20    │ WH-02     │ TRF-881     │
│ Jun 29 09:00     │ ADJUSTMENT │ PRD-003   │ -5     │ WH-01     │ ADJ-102     │
└──────────────────────────────────────────────────────────────────────────────┘
```

Movement types: `RECEIPT`, `SHIPMENT`, `TRANSFER`, `ADJUSTMENT`, `ASSEMBLY`, `RETURN`.

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View ledger | `erp:inventory:read` |
| Export | `erp:exports:read` |
| Reverse adjustment | `erp:inventory:adjust` | Creates compensating movement |

**No edit/delete** — immutable by design; show info tooltip on hover.

---

### UI-ERP-008 — Purchase Orders List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/purchase-orders` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Purchase Orders (67)                                    [+ Create PO]        │
├──────────────────────────────────────────────────────────────────────────────┤
│ [🔍] [Status ▼] [Supplier ▼] [Date ▼]                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ PO #     │ Supplier     │ Status    │ Total    │ Expected  │ Created  │ ⋮   │
│ PO-1042  │ Acme Supply  │ Approved  │ $4,250   │ Jul 5     │ Jun 28   │ ⋮   │
│ PO-1041  │ Beta Parts   │ Draft     │ $1,100   │ —         │ Jun 27   │ ⋮   │
│ PO-1040  │ Acme Supply  │ Received  │ $8,900   │ Jun 25    │ Jun 20   │ ⋮   │
└──────────────────────────────────────────────────────────────────────────────┘
```

Status flow: `draft → submitted → approved → received | cancelled`

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View list | `erp:purchase_orders:read` |
| Create | `erp:purchase_orders:write` → 009 |
| Submit | `erp:purchase_orders:submit` → M007 |
| Approve | `erp:purchase_orders:approve` → M008 |
| Receive | `erp:purchase_orders:receive` → 011 |
| Cancel | `erp:purchase_orders:cancel` |
| Delete (draft only) | `erp:purchase_orders:delete` |

---

### UI-ERP-009 — Purchase Order Create

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/purchase-orders/new` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Create Purchase Order                                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│ Supplier *     [Search supplier...           ▼]                              │
│ Warehouse *    [WH-01 Main Warehouse         ▼]                              │
│ Expected date  [Jul 5, 2026]                                                 │
│ Notes          [________________________________]                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ LINE ITEMS                                              [+ Add Line]         │
│ Product/Variant     │ Qty  │ Unit Cost │ Tax │ Line Total │                   │
│ [Search product ▼]  │ 100  │ $12.50    │ 0%  │ $1,250.00  │ [×]              │
│ [Search product ▼]  │ 50   │ $8.00     │ 0%  │ $400.00    │ [×]              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                    Subtotal: $1,650.00                       │
│                                    Tax:      $0.00                           │
│                                    Total:    $1,650.00                       │
├──────────────────────────────────────────────────────────────────────────────┤
│              [Cancel]  [Save Draft]  [Save & Submit]                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| Create/save draft | `erp:purchase_orders:write` |
| Submit on save | `erp:purchase_orders:submit` |
| Add discontinued product | — | Blocked with error |

---

### UI-ERP-010 — Purchase Order Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/purchase-orders/:poId` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← POs  PO-1042  [Approved]     [Receive] [Print] [Cancel] [Edit] [⋮]        │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ ORDER INFO                   │ STATUS TIMELINE                               │
│ Supplier: Acme Supply        │ Draft → Submitted → Approved ● → Received     │
│ Warehouse: WH-01             │                                               │
│ Expected: Jul 5, 2026        │ RECEIPT HISTORY                               │
│ Total: $4,250.00             │ (empty — not yet received)                    │
├──────────────────────────────┴───────────────────────────────────────────────┤
│ LINE ITEMS                                                                   │
│ SKU       │ Product      │ Ordered │ Received │ Remaining │ Unit │ Total    │
│ CMP-100   │ Housing      │ 200     │ 0        │ 200       │ $4.50│ $900     │
│ CMP-101   │ Circuit Board│ 100     │ 0        │ 100       │ $8.20│ $820     │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission | State Gate |
|--------|------------|------------|
| View | `erp:purchase_orders:read` | — |
| Edit | `erp:purchase_orders:write` | `draft`, `submitted` |
| Submit | `erp:purchase_orders:submit` | `draft` |
| Approve | `erp:purchase_orders:approve` | `submitted` |
| Receive | `erp:purchase_orders:receive` | `approved`, partial |
| Cancel | `erp:purchase_orders:cancel` | not `received` |
| Print/PDF | `erp:purchase_orders:read` | — |

---

### UI-ERP-011 — Receive Purchase Order

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/purchase-orders/:poId/receive` |
| **Layout** | Full-page receiving workflow |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Receive PO-1042 — Acme Supply                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│ Receive date: [Jun 30, 2026]    Warehouse: [WH-01 ▼]    Ref: [RCV-____]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ SKU     │ Product       │ Remaining │ Receive Qty │ Lot/Batch │ Notes   │
│ ☑ │ CMP-100 │ Housing       │ 200       │ [200      ] │ [LOT-1  ] │         │
│ ☑ │ CMP-101 │ Circuit Board │ 100       │ [80       ] │ [       ] │ Partial │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☑ Allow partial receipt                                                      │
│                         [Cancel]  [Save Partial]  [Complete Receipt]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Workflow

1. Scan barcode → auto-focus matching line
2. Enter quantities ≤ remaining
3. Partial receipt → PO stays `approved` with received qty updated
4. Full receipt → PO status `received`; stock movements created

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| Receive | `erp:purchase_orders:receive` |
| Over-receive | `erp:purchase_orders:receive_override` | ABAC admin |

#### Mobile

- Barcode scanner primary input
- One line per screen option for warehouse floor use

---

### UI-ERP-012 — Sales Orders List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/sales-orders` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sales Orders (124)                                   [+ Create Sales Order]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ SO #     │ Customer      │ Status     │ Total    │ Source   │ Date     │ ⋮  │
│ SO-5010  │ Acme Corp     │ Confirmed  │ $12,500  │ CRM Deal │ Jun 29   │ ⋮  │
│ SO-5009  │ Beta Inc      │ Fulfilled  │ $3,200   │ Manual   │ Jun 28   │ ⋮  │
│ SO-5008  │ Gamma LLC     │ Invoiced   │ $8,100   │ CRM Deal │ Jun 25   │ ⋮  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Status: `draft → confirmed → fulfilled → invoiced | cancelled`

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `erp:sales_orders:read` |
| Create | `erp:sales_orders:write` → M010 |
| Confirm | `erp:sales_orders:confirm` |
| Fulfill | `erp:sales_orders:fulfill` → M011 |
| Cancel | `erp:sales_orders:cancel` |
| Create from deal | `erp:sales_orders:write` | CRM integration |

---

### UI-ERP-013 — Sales Order Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/sales-orders/:soId` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← SOs  SO-5010  [Confirmed]    [Fulfill] [Create Invoice] [Cancel] [Edit]    │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ ORDER INFO                   │ FULFILLMENT                                   │
│ Customer: Acme Corp (CRM)    │ WH-01: 2 lines ready                          │
│ Deal: [Acme Enterprise →]    │ WH-02: 1 line backordered                     │
│ Ship to: [address]           │                                               │
│ Total: $12,500               │ SHIPMENTS                                     │
│                              │ (none)                                        │
├──────────────────────────────┴───────────────────────────────────────────────┤
│ LINE ITEMS                                                                   │
│ SKU       │ Product     │ Qty │ Shipped │ Unit Price │ Total    │ Avail     │
│ PRD-001   │ Widget Pro  │ 100 │ 0       │ $99.00     │ $9,900   │ 750 ✓     │
│ PRD-002   │ Service Pack│ 10  │ 0       │ $260.00    │ $2,600   │ N/A       │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `erp:sales_orders:read` |
| Edit | `erp:sales_orders:write` | `draft`, `confirmed` |
| Confirm | `erp:sales_orders:confirm` |
| Fulfill | `erp:sales_orders:fulfill` |
| Create invoice | `finance:invoices:write` |
| View CRM deal | `crm:deals:read` |
| Reserve inventory | `erp:inventory:reserve` | On confirm |

---

### UI-ERP-014 — Suppliers List

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/suppliers` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Suppliers (28)                                         [+ New Supplier]      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Code   │ Name          │ Contact        │ Lead Time │ Open POs │ Status  │ ⋮ │
│ SUP-01 │ Acme Supply   │ orders@acme.com│ 5 days    │ 3        │ Active  │ ⋮ │
│ SUP-02 │ Beta Parts    │ sales@beta.com │ 10 days   │ 1        │ Active  │ ⋮ │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `erp:suppliers:read` |
| Create | `erp:suppliers:write` → M012 |
| Edit | `erp:suppliers:write` |
| Delete | `erp:suppliers:delete` | Blocked if open POs |
| Create PO | `erp:purchase_orders:write` | Pre-fill supplier |

---

### UI-ERP-015 — Supplier Detail

| Attribute | Value |
|-----------|-------|
| **Route** | `/app/:orgSlug/:workspaceSlug/erp/suppliers/:supplierId` |

#### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Suppliers  Acme Supply  [Active]           [Create PO] [Edit] [⋮]          │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ SUPPLIER INFO                │ OPEN PURCHASE ORDERS (3)                      │
│ Code: SUP-01                 │ PO-1042 · $4,250 · Approved                   │
│ Payment terms: Net 30        │ PO-1038 · $2,100 · Submitted                  │
│ Lead time: 5 days            │                                               │
│ Address: ...                 │ PRODUCT CATALOG (45)          [+ Link Product]│
│                              │ PRD-001 · $12.50 · Preferred ★                │
│                              │ CMP-100 · $4.50                               │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

#### Actions & Permissions

| Action | Permission |
|--------|------------|
| View | `erp:suppliers:read` |
| Edit | `erp:suppliers:write` |
| Link product | `erp:suppliers:write` → M013 |
| Set preferred supplier | `erp:suppliers:write` |
| View POs | `erp:purchase_orders:read` |

---

## Modals Catalog (Detail)

### UI-ERP-M003 — Adjust Stock

```
┌─────────────────────────────────────┐
│ Adjust Stock                     [×]│
├─────────────────────────────────────┤
│ Product:  Widget Pro Standard       │
│ Warehouse:[WH-01 Main        ▼]     │
│ Current:   800 EA                     │
│ Adjustment:[+50_______________] EA    │
│ Reason:    [Cycle count      ▼]      │
│ Notes:     [________________]       │
├─────────────────────────────────────┤
│ New quantity will be: 850 EA          │
│           [Cancel]  [Adjust]        │
└─────────────────────────────────────┘
```

**Permission**: `erp:inventory:adjust`  
**Audit**: Requires reason code; creates `ADJUSTMENT` movement.

### UI-ERP-M004 — Transfer Stock

```
┌─────────────────────────────────────┐
│ Transfer Stock                   [×]│
├─────────────────────────────────────┤
│ From: [WH-01 Main Warehouse   ▼]    │
│ To:   [WH-02 East Coast       ▼]    │
│ Product/Variant: [PRD-001-STD ▼]    │
│ Available at source: 750              │
│ Quantity: [20________________]      │
├─────────────────────────────────────┤
│           [Cancel]  [Transfer]      │
└─────────────────────────────────────┘
```

**Permission**: `erp:inventory:transfer`

### UI-ERP-M010 — Create Sales Order

Multi-step modal: (1) Customer/deal (2) Lines (3) Shipping (4) Review.

Pre-fill from CRM deal when launched from Deal Detail.

### UI-ERP-M011 — Fulfill Sales Order

Pick lines, select warehouse per line, enter ship qty, tracking number, carrier. Partial fulfillment supported.

**Permission**: `erp:sales_orders:fulfill`

---

## Cross-Module Workflows

| Workflow | Entry Point | Steps | Permissions |
|----------|-------------|-------|-------------|
| Deal → Sales Order | CRM Deal Detail | M010 pre-filled → Confirm → Reserve stock | `erp:sales_orders:write` |
| SO → Invoice | SO Detail | Finance create invoice modal | `finance:invoices:write` |
| PO → Stock Receipt | PO Detail | 011 Receive → Movements ledger | `erp:purchase_orders:receive` |
| Low stock → PO | Inventory 006 | Suggested PO banner → 009 with lines | `erp:purchase_orders:write` |

---

## Accessibility & Localization

- Barcode fields: `inputmode="none"` with screen reader instructions
- Quantity adjustments: announce new total on change
- Currency/units per org settings
- RTL: table columns mirror; SKU stays LTR

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-30 | Initial ERP UI specification |