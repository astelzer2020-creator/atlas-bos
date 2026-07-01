---
title: ERP Database Schema
document_id: ATLAS-DB-06
version: 1.0.0
status: draft
phase: 3
last_updated: 2026-06-30
bounded_context: stock, commercial
schemas:
  - stock
  - commercial
related_documents:
  - ATLAS-ARCH-05
  - 05-crm.md
  - 07-finance.md
tags:
  - database
  - erp
  - inventory
  - commercial
  - ddd
  - rls
---

# ERP Database Schema

## Overview

The ERP domain spans two PostgreSQL schemas:

| Schema | Responsibility |
|--------|----------------|
| `stock` | Product catalog, variants, BOM, warehouses, inventory, stock movements, suppliers |
| `commercial` | Purchase orders and sales orders (procurement + fulfillment) |

All tables include `organization_id`, audit columns, soft delete, and RLS.

---

## DDD Aggregate Boundaries

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ERP Aggregate Map                                │
├─────────────────────────────────────────────────────────────────────────┤
│  Product (AR) — stock.products                                           │
│    ├── productVariants[] (child entities)                               │
│    └── billOfMaterials[] (BOM lines referencing component products)     │
├─────────────────────────────────────────────────────────────────────────┤
│  Warehouse (AR) — stock.warehouses                                       │
│    └── inventoryItems[] (quantity snapshots per variant)                │
├─────────────────────────────────────────────────────────────────────────┤
│  InventoryItem (AR) — stock.inventory_items                              │
│    └── stockMovements[] (immutable ledger of qty changes)               │
├─────────────────────────────────────────────────────────────────────────┤
│  Supplier (AR) — stock.suppliers                                         │
│    └── purchaseOrders[] (reference)                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  PurchaseOrder (AR) — commercial.purchase_orders                         │
│    └── purchaseOrderLines[] (child entities; sum drives PO totals)      │
├─────────────────────────────────────────────────────────────────────────┤
│  SalesOrder (AR) — commercial.sales_orders                               │
│    └── salesOrderLines[] (child entities; drives fulfillment + revenue) │
└─────────────────────────────────────────────────────────────────────────┘
```

### Invariants

| Aggregate | Rule |
|-----------|------|
| **Product** | `sku` unique per org; discontinued products cannot be added to new order lines |
| **ProductVariant** | `sku` unique per org; must reference parent product |
| **BillOfMaterials** | No circular BOM; component qty > 0; same organization |
| **Warehouse** | One default warehouse per org; cannot delete warehouse with positive inventory |
| **InventoryItem** | `quantity_on_hand >= 0`; `quantity_reserved <= quantity_on_hand` |
| **StockMovement** | Immutable; every qty change creates a movement record |
| **PurchaseOrder** | Lines required; status: `draft → submitted → approved → received \| cancelled` |
| **SalesOrder** | Lines required; status: `draft → confirmed → fulfilled → invoiced \| cancelled` |
| **Supplier** | `code` unique per org |

---

## Entity Relationship Diagram

```
organizations ──┬── products ──┬── product_variants ── inventory_items ── stock_movements
                │              └── bill_of_materials
                ├── warehouses
                ├── suppliers ── purchase_orders ── purchase_order_lines
                └── sales_orders ── sales_order_lines
                      ↑ (optional FK to customer.accounts, customer.contacts)
```

---

## `stock` Schema Tables

### 1. `stock.products`

```sql
CREATE TABLE stock.products (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    external_id         TEXT,
    sku                 TEXT NOT NULL,
    name                TEXT NOT NULL,
    description         TEXT,
    product_type        TEXT NOT NULL DEFAULT 'goods'
                        CHECK (product_type IN ('goods', 'service', 'digital', 'bundle')),
    category            TEXT,
    unit_of_measure     TEXT NOT NULL DEFAULT 'each',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_serialized       BOOLEAN NOT NULL DEFAULT false,
    is_batch_tracked    BOOLEAN NOT NULL DEFAULT false,
    weight_kg           NUMERIC(12, 4),
    dimensions          JSONB NOT NULL DEFAULT '{}',
    tax_category        TEXT,
    default_cost        NUMERIC(19, 4) NOT NULL DEFAULT 0,
    default_price       NUMERIC(19, 4) NOT NULL DEFAULT 0,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_products_org_sku_active
    ON stock.products (organization_id, lower(sku))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_products_org_external_id
    ON stock.products (organization_id, external_id)
    WHERE external_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_products_organization_id ON stock.products (organization_id);
CREATE INDEX idx_products_org_active ON stock.products (organization_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_org_category ON stock.products (organization_id, category) WHERE deleted_at IS NULL;
```

### 2. `stock.product_variants`

```sql
CREATE TABLE stock.product_variants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    product_id          UUID NOT NULL REFERENCES stock.products(id),
    external_id         TEXT,
    sku                 TEXT NOT NULL,
    name                TEXT NOT NULL,
    barcode             TEXT,
    attributes          JSONB NOT NULL DEFAULT '{}',
    cost                NUMERIC(19, 4) NOT NULL DEFAULT 0,
    price               NUMERIC(19, 4) NOT NULL DEFAULT 0,
    weight_kg           NUMERIC(12, 4),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_product_variants_org_sku_active
    ON stock.product_variants (organization_id, lower(sku))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_product_variants_org_product
    ON stock.product_variants (organization_id, product_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_product_variants_org_barcode
    ON stock.product_variants (organization_id, barcode)
    WHERE barcode IS NOT NULL AND deleted_at IS NULL;
```

### 3. `stock.bill_of_materials`

```sql
CREATE TABLE stock.bill_of_materials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    parent_product_id   UUID NOT NULL REFERENCES stock.products(id),
    component_product_id UUID NOT NULL REFERENCES stock.products(id),
    component_variant_id UUID REFERENCES stock.product_variants(id),
    quantity            NUMERIC(19, 6) NOT NULL CHECK (quantity > 0),
    unit_of_measure     TEXT NOT NULL DEFAULT 'each',
    scrap_factor        NUMERIC(5, 4) NOT NULL DEFAULT 0 CHECK (scrap_factor >= 0 AND scrap_factor < 1),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    notes               TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_bom_no_self_reference CHECK (parent_product_id <> component_product_id)
);

CREATE UNIQUE INDEX uq_bom_org_parent_component_active
    ON stock.bill_of_materials (organization_id, parent_product_id, component_product_id, COALESCE(component_variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE deleted_at IS NULL;

CREATE INDEX idx_bom_org_parent ON stock.bill_of_materials (organization_id, parent_product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bom_org_component ON stock.bill_of_materials (organization_id, component_product_id) WHERE deleted_at IS NULL;
```

### 4. `stock.warehouses`

```sql
CREATE TABLE stock.warehouses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    warehouse_type      TEXT NOT NULL DEFAULT 'standard'
                        CHECK (warehouse_type IN ('standard', 'transit', 'quarantine', 'returns', 'virtual')),
    address             JSONB NOT NULL DEFAULT '{}',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    is_default          BOOLEAN NOT NULL DEFAULT false,
    manager_id          UUID REFERENCES atlas_core.users(id),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_warehouses_org_code_active
    ON stock.warehouses (organization_id, lower(code)) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_warehouses_org_default
    ON stock.warehouses (organization_id) WHERE is_default = true AND deleted_at IS NULL;

CREATE INDEX idx_warehouses_organization_id ON stock.warehouses (organization_id);
```

### 5. `stock.inventory_items`

```sql
CREATE TABLE stock.inventory_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    warehouse_id        UUID NOT NULL REFERENCES stock.warehouses(id),
    product_variant_id  UUID NOT NULL REFERENCES stock.product_variants(id),
    quantity_on_hand    NUMERIC(19, 6) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    quantity_reserved   NUMERIC(19, 6) NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    quantity_available  NUMERIC(19, 6) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    reorder_point       NUMERIC(19, 6),
    reorder_quantity    NUMERIC(19, 6),
    last_counted_at     TIMESTAMPTZ,
    bin_location        TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_inventory_reserved_lte_on_hand CHECK (quantity_reserved <= quantity_on_hand)
);

CREATE UNIQUE INDEX uq_inventory_items_org_warehouse_variant
    ON stock.inventory_items (organization_id, warehouse_id, product_variant_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_inventory_items_org_warehouse ON stock.inventory_items (organization_id, warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_items_org_variant ON stock.inventory_items (organization_id, product_variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_items_low_stock
    ON stock.inventory_items (organization_id, quantity_available)
    WHERE deleted_at IS NULL AND reorder_point IS NOT NULL AND quantity_available <= reorder_point;
```

### 6. `stock.stock_movements`

```sql
CREATE TABLE stock.stock_movements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    inventory_item_id   UUID NOT NULL REFERENCES stock.inventory_items(id),
    warehouse_id        UUID NOT NULL REFERENCES stock.warehouses(id),
    product_variant_id  UUID NOT NULL REFERENCES stock.product_variants(id),
    movement_type       TEXT NOT NULL
                        CHECK (movement_type IN (
                            'receipt', 'shipment', 'adjustment', 'transfer_in', 'transfer_out',
                            'reservation', 'release', 'production_consume', 'production_output', 'return'
                        )),
    quantity            NUMERIC(19, 6) NOT NULL,
    unit_cost           NUMERIC(19, 4),
    reference_type      TEXT,
    reference_id        UUID,
    reason              TEXT,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES atlas_core.users(id),

    CONSTRAINT stock_movements_immutable CHECK (true)  -- enforced by revoking UPDATE/DELETE
);

CREATE INDEX idx_stock_movements_org_item ON stock.stock_movements (organization_id, inventory_item_id, occurred_at DESC);
CREATE INDEX idx_stock_movements_org_reference ON stock.stock_movements (organization_id, reference_type, reference_id);
CREATE INDEX idx_stock_movements_org_variant ON stock.stock_movements (organization_id, product_variant_id, occurred_at DESC);
CREATE INDEX idx_stock_movements_org_warehouse ON stock.stock_movements (organization_id, warehouse_id, occurred_at DESC);
```

### 7. `stock.suppliers`

```sql
CREATE TABLE stock.suppliers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    external_id         TEXT,
    code                TEXT NOT NULL,
    name                TEXT NOT NULL,
    contact_name        TEXT,
    email               CITEXT,
    phone               TEXT,
    address             JSONB NOT NULL DEFAULT '{}',
    payment_terms_days  INTEGER NOT NULL DEFAULT 30,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    tax_id              TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    rating              INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_suppliers_org_code_active ON stock.suppliers (organization_id, lower(code)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_suppliers_org_external_id ON stock.suppliers (organization_id, external_id) WHERE external_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_suppliers_organization_id ON stock.suppliers (organization_id);
```

---

## `commercial` Schema Tables

### 8. `commercial.purchase_orders`

```sql
CREATE TABLE commercial.purchase_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    po_number           TEXT NOT NULL,
    supplier_id         UUID NOT NULL REFERENCES stock.suppliers(id),
    warehouse_id        UUID NOT NULL REFERENCES stock.warehouses(id),
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled')),
    order_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date       DATE,
    received_date       DATE,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    subtotal            NUMERIC(19, 4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(19, 4) NOT NULL DEFAULT 0,
    notes               TEXT,
    approved_by         UUID REFERENCES atlas_core.users(id),
    approved_at         TIMESTAMPTZ,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_purchase_orders_org_number ON commercial.purchase_orders (organization_id, po_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_org_supplier ON commercial.purchase_orders (organization_id, supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_org_status ON commercial.purchase_orders (organization_id, status) WHERE deleted_at IS NULL;
```

### 9. `commercial.purchase_order_lines`

```sql
CREATE TABLE commercial.purchase_order_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    purchase_order_id   UUID NOT NULL REFERENCES commercial.purchase_orders(id) ON DELETE CASCADE,
    line_number         INTEGER NOT NULL,
    product_variant_id  UUID NOT NULL REFERENCES stock.product_variants(id),
    description         TEXT,
    quantity_ordered    NUMERIC(19, 6) NOT NULL CHECK (quantity_ordered > 0),
    quantity_received   NUMERIC(19, 6) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_price          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    tax_rate            NUMERIC(7, 4) NOT NULL DEFAULT 0,
    line_total          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_po_lines_received_lte_ordered CHECK (quantity_received <= quantity_ordered)
);

CREATE UNIQUE INDEX uq_po_lines_org_order_line ON commercial.purchase_order_lines (organization_id, purchase_order_id, line_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_po_lines_org_order ON commercial.purchase_order_lines (organization_id, purchase_order_id) WHERE deleted_at IS NULL;
```

### 10. `commercial.sales_orders`

```sql
CREATE TABLE commercial.sales_orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    order_number        TEXT NOT NULL,
    account_id          UUID REFERENCES customer.accounts(id),
    contact_id          UUID REFERENCES customer.contacts(id),
    deal_id             UUID REFERENCES customer.deals(id),
    warehouse_id        UUID NOT NULL REFERENCES stock.warehouses(id),
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'confirmed', 'processing', 'partially_fulfilled', 'fulfilled', 'invoiced', 'cancelled')),
    order_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    requested_date      DATE,
    fulfilled_date      DATE,
    currency_code       CHAR(3) NOT NULL DEFAULT 'USD',
    subtotal            NUMERIC(19, 4) NOT NULL DEFAULT 0,
    discount_amount     NUMERIC(19, 4) NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    shipping_amount     NUMERIC(19, 4) NOT NULL DEFAULT 0,
    total_amount        NUMERIC(19, 4) NOT NULL DEFAULT 0,
    shipping_address    JSONB NOT NULL DEFAULT '{}',
    billing_address     JSONB NOT NULL DEFAULT '{}',
    notes               TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX uq_sales_orders_org_number ON commercial.sales_orders (organization_id, order_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_org_account ON commercial.sales_orders (organization_id, account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_org_status ON commercial.sales_orders (organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_org_deal ON commercial.sales_orders (organization_id, deal_id) WHERE deal_id IS NOT NULL AND deleted_at IS NULL;
```

### 11. `commercial.sales_order_lines`

```sql
CREATE TABLE commercial.sales_order_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     UUID NOT NULL REFERENCES atlas_core.organizations(id),
    sales_order_id      UUID NOT NULL REFERENCES commercial.sales_orders(id) ON DELETE CASCADE,
    line_number         INTEGER NOT NULL,
    product_variant_id  UUID NOT NULL REFERENCES stock.product_variants(id),
    description         TEXT,
    quantity_ordered    NUMERIC(19, 6) NOT NULL CHECK (quantity_ordered > 0),
    quantity_fulfilled  NUMERIC(19, 6) NOT NULL DEFAULT 0 CHECK (quantity_fulfilled >= 0),
    unit_price          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    discount_percent    NUMERIC(5, 2) NOT NULL DEFAULT 0,
    tax_rate            NUMERIC(7, 4) NOT NULL DEFAULT 0,
    line_total          NUMERIC(19, 4) NOT NULL DEFAULT 0,
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    created_by          UUID REFERENCES atlas_core.users(id),
    updated_by          UUID REFERENCES atlas_core.users(id),
    version             INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_so_lines_fulfilled_lte_ordered CHECK (quantity_fulfilled <= quantity_ordered)
);

CREATE UNIQUE INDEX uq_so_lines_org_order_line ON commercial.sales_order_lines (organization_id, sales_order_id, line_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_so_lines_org_order ON commercial.sales_order_lines (organization_id, sales_order_id) WHERE deleted_at IS NULL;
```

---

## Row-Level Security (RLS)

```sql
-- stock schema
DO $$
DECLARE tbl TEXT;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'stock' LOOP
        EXECUTE format('ALTER TABLE stock.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE stock.%I FORCE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;

-- commercial schema
DO $$
DECLARE tbl TEXT;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'commercial' LOOP
        EXECUTE format('ALTER TABLE commercial.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE commercial.%I FORCE ROW LEVEL SECURITY', tbl);
    END LOOP;
END $$;

-- Policy template (apply to each table)
CREATE POLICY org_isolation_select ON stock.products
    FOR SELECT USING (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY org_isolation_insert ON stock.products
    FOR INSERT WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY org_isolation_update ON stock.products
    FOR UPDATE
    USING (organization_id = current_setting('app.organization_id', true)::uuid)
    WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);

CREATE POLICY org_isolation_delete ON stock.products
    FOR DELETE USING (organization_id = current_setting('app.organization_id', true)::uuid);
```

**Immutable table exception:** `stock_movements` — REVOKE UPDATE, DELETE from application role; SELECT/INSERT only with RLS.

---

## Soft Delete Strategy

| Entity | Soft Delete | Notes |
|--------|-------------|-------|
| Products, Variants | Yes | Cannot soft-delete if referenced by open order lines |
| Warehouses | Yes | Blocked if `quantity_on_hand > 0` |
| Inventory Items | Yes | Prefer zeroing qty via adjustment movement first |
| Stock Movements | **No** | Immutable ledger — corrections via reversing movements |
| Purchase/Sales Orders | Yes | Cancelled orders retain history; `deleted_at` for GDPR only |
| Suppliers | Yes | Blocked if open POs exist |

---

## Audit Strategy

| Mechanism | Scope |
|-----------|-------|
| Optimistic locking | All mutable tables via `version` |
| Immutable movements | `stock_movements` append-only |
| Financial audit | PO/SO totals recalculated on line change; audit log entry |
| Domain events | `stock.inventory.adjusted.v1`, `commercial.order.confirmed.v1`, `commercial.purchase_order.received.v1` |
| Outbox | All status transitions publish to `commercial_outbox` / `stock_outbox` |

---

## Migration Notes

| Migration | Description |
|-----------|-------------|
| `V070__create_stock_schema.sql` | Create `stock` schema |
| `V071__create_products_and_variants.sql` | Product catalog |
| `V072__create_bill_of_materials.sql` | BOM table |
| `V073__create_warehouses.sql` | Warehouses + default seed |
| `V074__create_inventory_items.sql` | Inventory snapshots |
| `V075__create_stock_movements.sql` | Movement ledger + immutability grants |
| `V076__create_suppliers.sql` | Supplier master |
| `V077__create_commercial_schema.sql` | Create `commercial` schema |
| `V078__create_purchase_orders.sql` | PO header + lines |
| `V079__create_sales_orders.sql` | SO header + lines |
| `V080__create_erp_rls_policies.sql` | RLS all ERP tables |
| `V081__citus_distribute_erp_tables.sql` | Citus on `organization_id` |

---

## Prisma Mapping

See [`prisma/models/erp.prisma`](../../prisma/models/erp.prisma).

---

*Document owner: Stock + Commercial Module Teams · Review cadence: Per schema change*