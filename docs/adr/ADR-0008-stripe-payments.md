# ADR-0008: Stripe for Payment Processing

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, Finance Team, Product Team
**Related:** [12-payments.md](../architecture/phase-1/12-payments.md), [ADR-0002](./ADR-0002-postgresql-primary-oltp.md)

## Context

Atlas BOS includes financial capabilities — invoicing, payment collection, subscription billing, and marketplace transactions. The platform must process payments securely while supporting:

- **Subscription billing** — Atlas's own SaaS pricing tiers (monthly/annual plans)
- **Invoice payments** — Atlas customers collecting payments from their end customers
- **Multi-currency** — global businesses operating in USD, EUR, GBP, and dozens of currencies
- **Payment methods** — credit cards, ACH/bank transfers, digital wallets (Apple Pay, Google Pay)
- **Compliance** — PCI DSS compliance without handling raw card data
- **Marketplace** — future Atlas marketplace with split payments between vendors
- **Reconciliation** — payment status synchronized with Ledger module

Payment processor candidates:

| Processor | Strengths | Weaknesses |
|-----------|-----------|------------|
| **Stripe** | Best developer experience, global coverage, Connect for marketplaces, Billing for subscriptions | US-centric support, higher fees in some regions |
| **Adyen** | Global payment methods, unified commerce | More complex integration, higher minimum commitment |
| **PayPal/Braintree** | Consumer trust, wide adoption | Weaker subscription billing, less developer-friendly API |
| **Square** | POS integration | Limited B2B/subscription focus |
| **Custom/processor-direct** | Lower fees, full control | PCI compliance burden, years of integration work |

Atlas is building a platform comparable to Stripe's own developer experience standards. The payment integration must be excellent, well-documented, and support both Atlas billing and customer payment collection.

## Decision

**Stripe** is the primary payment processor for Atlas BOS:

### Stripe Products Used

| Stripe Product | Atlas Use Case |
|----------------|----------------|
| **Stripe Billing** | Atlas SaaS subscription management (pricing tiers) |
| **Stripe Payments** | One-time and recurring payment collection |
| **Stripe Connect** | Marketplace vendor payouts (future) |
| **Stripe Invoicing** | Reference architecture for Atlas's own invoicing module |
| **Stripe Webhooks** | Payment status events → Ledger module integration |
| **Stripe Customer Portal** | Self-service subscription management for Atlas customers |
| **Stripe Elements** | PCI-compliant card input in Atlas web UI |

### Integration Architecture

```
Atlas Web UI
    → Stripe Elements (card input, PCI scope minimized)
    → Atlas API (creates PaymentIntent via Stripe API)
    → Stripe processes payment
    → Stripe Webhook → Atlas Worker → Ledger module (payment recorded)
    → Customer receives confirmation
```

- **PCI scope:** SAQ-A (Stripe Elements handles card data; Atlas never touches raw PAN)
- **Webhook handling:** Idempotent consumers in `apps/worker` with signature verification
- **Anti-corruption layer:** `modules/ledger/infrastructure/acl/stripe/` maps Stripe events to domain commands
- **Multi-currency:** Stripe's native currency support; Ledger module handles exchange rate recording
- **Atlas billing:** Stripe Billing manages Atlas's own SaaS subscriptions (separate Stripe account or Connect)

### Data Ownership

- **Stripe is authoritative** for payment status, card tokens, dispute status
- **Atlas Ledger is authoritative** for accounting records, invoice state, revenue recognition
- Payment state synchronized via webhooks with reconciliation job for drift detection

### Stripe Configuration

- **API version:** Pinned to specific Stripe API version; upgraded quarterly with testing
- **Webhook endpoints:** Per-environment (`/v1/webhooks/stripe`)
- **Idempotency:** Stripe idempotency keys on all mutating API calls
- **Test mode:** Full Stripe test mode integration in development and CI

## Consequences

### Positive

- **Best-in-class developer experience** — excellent API, documentation, SDKs, test tooling
- **PCI compliance simplified** — SAQ-A scope; Stripe handles card data security
- **Global coverage** — 135+ currencies, local payment methods
- **Subscription billing** — Stripe Billing handles Atlas's own SaaS pricing out of the box
- **Marketplace ready** — Stripe Connect for future vendor payouts
- **Webhook reliability** — Stripe's webhook infrastructure with retry and signing
- **Team familiarity** — Stripe is the industry standard; hiring and integration patterns well-known

### Negative

- **Vendor dependency** — Atlas payment capabilities tied to Stripe's platform and pricing
- **Fee structure** — Stripe fees (2.9% + $0.30) passed through or absorbed depending on pricing model
- **Regional gaps** — some local payment methods require Adyen or regional processors as supplement
- **Dual accounting** — Stripe records vs Atlas Ledger records require reconciliation
- **API version pinning** — must actively manage Stripe API version upgrades

### Neutral

- Adyen evaluation for enterprise customers requiring specific local payment methods (Phase 2)
- Stripe Connect marketplace integration planned for Phase 2
- Reconciliation job runs daily to detect Stripe ↔ Ledger drift
- Stripe webhook events cataloged in integration event documentation (Phase 5)