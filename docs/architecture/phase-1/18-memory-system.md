---
title: Memory System
document_id: ARCH-18
version: 1.0.0
status: approved
phase: 1
last_updated: 2026-06-30
authors:
  - Atlas Architecture Team
related_documents:
  - ARCH-04
  - ARCH-05
  - ARCH-08
  - ARCH-17
  - ARCH-14
  - ARCH-21
tags:
  - memory
  - vector
  - embeddings
  - rag
  - ai
---

# Memory System

## Purpose

Define the architecture for Atlas's **Memory System** — the layered cognitive storage that enables AI agents and platform features to retain, retrieve, and reason over business context across time scales. Memory transforms ephemeral conversations into durable organizational intelligence while enforcing strict **tenant privacy boundaries**, **consent**, and **decay policies**.

## Scope

### In Scope

- Short-term memory (conversation/session context)
- Long-term memory (vector embeddings of business knowledge)
- Episodic memory (past actions and outcomes)
- Semantic memory (structured facts about the organization)
- Memory consolidation pipelines
- Privacy boundaries per tenant (and per-user where required)
- Memory decay, refresh, and garbage collection
- Retrieval APIs for agents (ARCH-17) and search (ARCH-14)
- Embedding lifecycle and versioning

### Out of Scope

- LLM inference (ARCH-17)
- Full knowledge base UI (Phase 4)
- Model training on tenant data
- Cross-tenant federated learning

---

## Context

A Business Operating System generates continuous streams of facts, decisions, and interactions. Without memory:

- Every AI interaction starts from zero
- Agents repeat mistakes or contradict prior decisions
- Institutional knowledge remains trapped in documents and chats
- Users re-explain preferences and policies repeatedly

Atlas Memory provides **human-like memory types** with engineering rigor: explicit write paths, retrieval scoring, consolidation, and deletion rights (GDPR).

### Memory Types Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Atlas Memory System                          │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│ Short-Term  │  Long-Term  │  Episodic   │     Semantic        │
│ (session)   │  (vectors)  │  (actions)  │     (facts)           │
├─────────────┴─────────────┴─────────────┴─────────────────────┤
│              Consolidation & Decay Engine                          │
├─────────────────────────────────────────────────────────────────┤
│              Privacy Boundary Enforcer (tenant/user)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Design

### 1. Short-Term Memory (STM)

**Purpose:** Maintain coherent context within a session, agent run, or workflow instance.

| Property | Value |
|----------|-------|
| Storage | Redis (primary) + optional PostgreSQL snapshot |
| TTL | 24h default; extendable to 7d for active workflows |
| Scope | `session_id` or `agent_run_id` |
| Max size | 128KB compressed context per session |
| Contents | Message history, tool results (summarized), active variables |

**Context window management:**

1. Store full turns in Redis list
2. When token estimate > 80% of model budget → trigger **summarization**
3. Summarization produces `stm_summary` chunk; older turns archived to episodic
4. Recent 5 turns kept verbatim

```yaml
short_term_entry:
  session_id: sess_991
  tenant_id: org_abc
  user_id: user_442
  turns:
    - role: user
      content: "What's the status of Project Apollo?"
      timestamp: 2026-06-30T14:00:00Z
    - role: assistant
      content: "Project Apollo is 72% complete..."
      tool_calls: [query_entity]
  summary: "User asking about Project Apollo status. Retrieved: 72% complete, due Aug 15."
  token_estimate: 2400
  expires_at: 2026-07-01T14:00:00Z
```

### 2. Long-Term Memory (LTM) — Vector Store

**Purpose:** Semantic retrieval over unstructured business knowledge — documents, emails, meeting notes, help articles, CRM notes.

| Property | Value |
|----------|-------|
| Storage | pgvector (PostgreSQL) Phase 1; dedicated vector DB at scale |
| Embedding model | `text-embedding-3-large` (versioned) |
| Chunk size | 512 tokens, 64 token overlap |
| Dimensions | 3072 (model-dependent) |
| Index | HNSW per tenant partition |

**Ingestion sources:**

| Source | Trigger | Priority |
|--------|---------|----------|
| Documents (ARCH-09) | On upload/update | High |
| Knowledge base articles | Publish event | High |
| Email threads (with consent) | Sync job | Medium |
| Meeting transcripts | Post-meeting | Medium |
| CRM notes | Create/update | Medium |
| Chat exports (opt-in) | User action | Low |

```yaml
memory_chunk:
  id: mem_chk_8821
  tenant_id: org_abc
  source_type: document
  source_id: doc_441
  source_version: 3
  content_hash: sha256:...
  text: "Q2 revenue target is $4.2M with focus on enterprise segment..."
  embedding: [0.012, -0.034, ...]
  metadata:
    department: finance
    classification: internal
    entity_refs: [project:apollo]
    created_at: 2026-06-15T10:00:00Z
  access_policy:
    min_clearance: employee
    allowed_roles: [finance, executive]
```

**Retrieval pipeline:**

```mermaid
flowchart LR
    Query[Agent Query] --> Embed[Embed Query]
    Embed --> Filter[Tenant + ACL Filter]
    Filter --> Search[Vector Similarity]
    Search --> Rerank[Cross-Encoder Rerank]
    Rerank --> Dedupe[Deduplicate Sources]
    Dedupe --> Context[Inject to Agent]
```

| Stage | Details |
|-------|---------|
| Pre-filter | `tenant_id` mandatory; ABAC filter on `allowed_roles` |
| Top-K | 20 candidates |
| Rerank | Top 5 to context |
| Score threshold | Min cosine similarity 0.72 (tunable per tenant) |
| Citations | Return `source_id` + snippet for UI attribution |

### 3. Episodic Memory

**Purpose:** Record **what happened** — agent actions, workflow outcomes, user corrections — to inform future decisions.

| Property | Value |
|----------|-------|
| Storage | PostgreSQL (structured) + vector index on `summary` |
| Retention | 2 years default; enterprise configurable |
| Scope | Tenant; optional user sub-scope |

```yaml
episodic_entry:
  id: epi_7712
  tenant_id: org_abc
  actor_type: agent
  actor_id: arun_441
  action: invoice.send
  entity_refs:
    - {type: invoice, id: inv_991}
    - {type: customer, id: cust_221}
  outcome: success | failure | rejected_by_human
  outcome_detail: "Customer disputed amount; invoice recalled"
  user_feedback: negative
  summary: "Sent invoice inv_991 to Acme Corp; customer disputed within 24h"
  embedding: [...]
  timestamp: 2026-06-28T09:00:00Z
  importance_score: 0.85
```

**Use cases:**

- "Last time we contacted this client about payment, what happened?"
- Avoid repeating failed approaches
- Learn from human rejections of agent proposals

**Importance scoring:** Boost retention for negative outcomes, human corrections, high-value entities.

### 4. Semantic Memory (Facts)

**Purpose:** Structured, queryable facts about the organization — preferences, policies, relationships, definitions.

| Property | Value |
|----------|-------|
| Storage | PostgreSQL `semantic_facts` table |
| Format | Subject-Predicate-Object triples + JSON properties |
| Provenance | Required: source, confidence, last_verified |

```yaml
semantic_fact:
  id: fact_331
  tenant_id: org_abc
  subject: org_abc
  predicate: approval_threshold_expense
  object: "1000 USD"
  properties:
    currency: USD
    effective_date: 2026-01-01
  source: admin_settings
  confidence: 1.0
  verified_at: 2026-06-01T00:00:00Z
  expires_at: null
  visibility: tenant_wide
```

**Fact categories:**

| Category | Examples |
|----------|----------|
| Policy | Approval thresholds, PTO rules |
| Preference | "CEO prefers bullet summaries" |
| Relationship | "Acme Corp is strategic account" |
| Definition | "MRR includes annual contracts amortized" |
| Constraint | "No emails to EU contacts before 9am CET" |

**Conflict resolution:** New fact with same `(subject, predicate)` → supersede if higher confidence or more recent `verified_at`; keep history in `semantic_facts_history`.

### 5. Memory Consolidation

Consolidation transforms high-volume raw data into durable, retrievable memory.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Raw Events  │────►│  Consolidator │────►│ LTM / Episodic│
│  STM overflow│     │   Workers     │     │ / Semantic   │
└──────────────┘     └──────────────┘     └──────────────┘
```

| Pipeline | Input | Output |
|----------|-------|--------|
| Session → Episodic | STM summaries on session end | Episodic entries |
| Document → LTM | Storage events | Chunked embeddings |
| Agent run → Episodic | Tool invocations | Action records |
| Fact extractor | Documents, settings | Semantic facts (LLM-assisted, human-review for policy) |
| Deduplication | New chunks | Merge near-duplicates (cosine > 0.95) |

**Consolidation schedule:**

- Real-time: high-priority sources (published KB, agent outcomes)
- Batch: nightly email/meeting ingestion
- Weekly: importance re-scoring, decay application

**LLM-assisted extraction guardrails:**

- Extracted facts land in `pending_facts` queue
- Auto-approve only `confidence > 0.95` and `source_type = admin_settings`
- Policy/category facts require admin approval

### 6. Privacy Boundaries

| Boundary | Enforcement |
|----------|-------------|
| **Tenant** | All queries include `tenant_id`; vector indexes partitioned |
| **User** | Personal STM scoped to `user_id`; episodic `visibility: private` |
| **Role/ABAC** | LTM chunks carry `access_policy`; filtered at retrieval |
| **Entity** | Memory linked to entities inherits entity permissions |
| **Consent** | Email/chat ingestion requires tenant opt-in + user notice |
| **GDPR** | Right to erasure propagates to all memory stores |

```python
# Pseudocode: retrieval filter
def recall(query, context):
    assert context.tenant_id is not None
    candidates = vector_search(
        query,
        tenant_id=context.tenant_id,
        filter=abac_filter(context.user_permissions)
    )
    audit_log("memory.recall", query_hash, len(candidates))
    return redact_pii(candidates)
```

**Cross-user memory:** Semantic facts marked `tenant_wide` visible to authorized roles; never leak across tenants even for platform templates (synthetic anonymized benchmarks only).

### 7. Memory Decay and Refresh

Not all memory should persist forever. Decay prevents stale context from polluting retrieval.

| Memory Type | Decay Policy |
|-------------|--------------|
| STM | TTL expiry (automatic) |
| LTM chunks | Half-life 365d; importance score modulates |
| Episodic | Decay after 2y unless `importance > 0.9` |
| Semantic facts | `expires_at` or manual invalidation |

**Decay formula (LTM/Episodic):**

```
effective_score = similarity × importance × recency_factor
recency_factor = exp(-λ × days_since_access_or_creation)
```

**Refresh triggers:**

- Source document updated → re-embed, invalidate old chunks
- User correction → boost importance, update episodic
- Scheduled re-verification for policy facts (quarterly)
- Access-based refresh: frequently recalled memories resist decay

**Garbage collection:**

- Soft-delete chunks with `effective_score < 0.1` for 90 days
- Hard-delete after GDPR erasure request
- Tombstone index prevents resurrection from stale caches

### 8. Service Architecture

| Service | Responsibility |
|---------|----------------|
| `memory-api` | CRUD, recall, store, forget |
| `memory-ingestion` | Document/event → chunks |
| `memory-consolidator` | Batch pipelines |
| `embedding-worker` | Async embedding generation |
| `memory-gc` | Decay and garbage collection |

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ memory-api  │────►│  PostgreSQL      │◄────│ embedding-  │
└──────┬──────┘     │  + pgvector      │     │ worker      │
       │            └──────────────────┘     └─────────────┘
       │            ┌──────────────────┐
       └───────────►│  Redis (STM)     │
                    └──────────────────┘
```

**Kafka topics:**

| Topic | Purpose |
|-------|---------|
| `memory.ingest.requested` | New content to process |
| `memory.chunk.created` | Search index update |
| `memory.fact.pending` | Admin review queue |
| `memory.erasure.requested` | GDPR propagation |

### 9. API Surface (Summary)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/memory/recall` | POST | Semantic search across memory types |
| `/v1/memory/store` | POST | Explicit store (user or agent) |
| `/v1/memory/forget` | POST | Delete by id or entity scope |
| `/v1/memory/facts` | CRUD | Semantic facts management |
| `/v1/memory/sessions/{id}` | GET | STM retrieval (authorized) |
| `/v1/memory/consolidation/status` | GET | Pipeline health |

**Recall request:**

```json
{
  "query": "What is our expense approval policy?",
  "memory_types": ["semantic", "long_term"],
  "entity_refs": [{"type": "department", "id": "finance"}],
  "max_results": 5,
  "include_citations": true
}
```

### 10. Integration Points

| Consumer | Usage |
|----------|-------|
| AI Agents (ARCH-17) | `memory.recall`, `memory.store` tools |
| Search (ARCH-14) | Unified search includes memory chunks |
| Workflow (ARCH-15) | Attach episodic context to human tasks |
| Automation (ARCH-16) | Trigger on `memory.fact.pending` approval |

### 11. Embedding Versioning

When embedding model changes:

1. Deploy new model version alongside old
2. Background re-embedding job per tenant
3. Dual-query during migration (merge results)
4. Cutover when > 95% chunks migrated
5. Archive old embeddings

Track `embedding_model_version` on each chunk.

### 12. Observability

| Metric | Description |
|--------|-------------|
| `memory_recall_latency_seconds` | P50/P99 retrieval |
| `memory_chunks_total` | Per tenant |
| `memory_ingestion_lag_seconds` | Source event → indexed |
| `memory_decay_purged_total` | GC activity |
| `memory_recall_hit_rate` | Agent usefulness proxy |

### 13. Security

- Encryption at rest for all memory stores (ARCH-21)
- PII detection on ingestion; tag chunks with `contains_pii`
- Audit all `recall` and `forget` operations
- Admin cannot browse another tenant's memory without break-glass procedure
- Prompt injection defense: retrieved chunks sanitized before LLM injection

---

## Alternatives Considered

### Alternative 1: Single Vector Store for Everything

**Rejected:** Conflates facts, episodes, and documents; poor precision for structured policies; difficult GDPR erasure mapping.

### Alternative 2: Rely on LLM Context Window Only (1M tokens)

**Rejected:** Cost prohibitive at scale; no durable organizational memory; no citation/provenance.

### Alternative 3: External Memory SaaS (Mem0, Zep)

**Evaluation:** Accelerates time-to-market but raises data residency concerns.

**Decision:** Build native memory with pgvector Phase 1; abstract interface allows future vendor adapter for enterprise self-hosted option.

### Alternative 4: Knowledge Graph Only (No Vectors)

**Rejected:** Insufficient for unstructured document retrieval; hybrid (facts + vectors) is optimal.

---

## Consequences

### Positive

- AI agents improve over time within each organization
- Reduced repetitive user explanation
- Citable answers build trust
- GDPR-compliant memory lifecycle
- Foundation for proactive AI ("based on past outcomes...")

### Negative

- Storage and embedding costs grow with tenant data
- Consolidation pipelines require ongoing tuning
- Incorrect extracted facts can propagate (mitigated by review queue)
- Retrieval latency adds to agent response time

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Stale policy retrieval | Semantic facts with `verified_at`; decay old LTM |
| Privacy leak via embeddings | ABAC filter at query; penetration test retrieval |
| Memory poisoning | Provenance required; user corrections boost counter-facts |
| Embedding model drift | Versioning + re-embed pipeline |

---

## Open Questions

| ID | Question | Owner | Target |
|----|----------|-------|--------|
| OQ-18-01 | pgvector vs. dedicated Pinecone/Weaviate at what chunk count? | Data Platform | 10M chunks/tenant |
| OQ-18-02 | User-visible "AI remembers" dashboard — Phase 1 or 4? | Product | Phase 4 |
| OQ-18-03 | Cross-session memory for anonymous website visitors? | Product | Out of scope Phase 1 |
| OQ-18-04 | Automatic episodic memory from all workflow steps? | Eng | Opt-in default |
| OQ-18-05 | Federated anonymized insights across tenants (platform benchmarks)? | Legal/Product | Phase 3+ |

---

## References

- ARCH-04 AI Architecture
- ARCH-05 Database Architecture
- ARCH-08 Authorization
- ARCH-14 Search
- ARCH-17 AI Agent System
- ARCH-21 Security