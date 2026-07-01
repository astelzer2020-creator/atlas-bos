# ADR-0010: AI Agent Architecture

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Chief Software Architect, AI Team, Security Team
**Related:** [04-ai-architecture.md](../architecture/phase-1/04-ai-architecture.md), [17-ai-agent-system.md](../architecture/phase-1/17-ai-agent-system.md), [ADR-0005](./ADR-0005-rbac-abac-opa.md), [ADR-0006](./ADR-0006-rest-graphql-hybrid.md)

## Context

Atlas's AI is not a chatbot — it is the **business brain** that understands customers, projects, invoices, inventory, cash flow, and can **act** on that understanding. A single monolithic LLM prompt cannot safely:

- Execute financial transactions (create invoices, process payments)
- Modify HR records (hire, terminate, change compensation)
- Send communications on behalf of users
- Access data across tenant boundaries
- Operate without human oversight on irreversible actions

The AI system must balance **agency** (the AI can do things) with **accountability** (every action is attributable, auditable, and reversible where possible).

AI architecture candidates:

| Approach | Strengths | Weaknesses |
|----------|-----------|------------|
| **Single chatbot** | Simple, fast to build | Cannot safely execute actions, no specialization |
| **Multi-agent orchestration** | Specialized agents, safer execution, human-in-the-loop | Complex orchestration, higher latency/cost |
| **Workflow-only (no LLM)** | Deterministic, auditable | Cannot handle ambiguous natural language requests |
| **LLM with function calling** | Flexible, modern | Single agent lacks review/approval patterns |
| **Multi-agent + tools + memory** | Specialized, safe, context-aware | Most complex to build and operate |

Atlas must support natural language interaction while ensuring every AI action respects authorization, budget limits, and human approval gates.

## Decision

Atlas implements a **multi-agent orchestration architecture** in the Intelligence bounded context module:

### Agent Roles

| Agent | Responsibility | Permissions |
|-------|---------------|-------------|
| **Planner** | Decompose user request into actionable steps | Read-only context gathering |
| **Analyst** | Research, analyze data, generate insights | Read queries across modules |
| **Executor** | Execute approved actions via tools | Scoped write via ACL commands |
| **Reviewer** | Validate action outcomes, catch errors | Read + comparison with intent |

Agents are registered in an **Agent Registry** with configurable roles, tool access, and budget limits. New agent types can be added without architectural changes.

### Architecture

```
User / Workflow / Automation
    → Agent Orchestrator (Intelligence module)
        → Planner Agent: decompose request into plan
        → Analyst Agent: gather context (read models, search, memory)
        → [Human Approval Gate] (if high-risk action)
        → Executor Agent: invoke tools (ACL → module commands)
        → Reviewer Agent: validate outcome
    → Response to user
```

### Tool Registry

Agents execute business actions via a **Tool Registry** — structured functions mapped to Atlas API endpoints:

```typescript
// Illustrative tool definition
{
  name: 'create_invoice',
  description: 'Create an invoice for a customer',
  parameters: { customerId, lineItems, dueDate },
  endpoint: 'POST /v1/invoices',
  riskLevel: 'high',          // Requires human approval
  requiredPermission: 'invoices:write',
}
```

- Tools map to REST API endpoints (ADR-0006) for deterministic, auditable execution
- Tools invoke module commands via **ACL** — never direct database access
- Risk levels: `low` (auto-execute), `medium` (notify user), `high` (require approval), `critical` (blocked for agents)

### Authorization Integration

- Agents inherit **invoking user's permissions** (ADR-0005) — never exceed user entitlements
- Agent delegation: users explicitly grant scoped permissions to agents via OPA policies
- Every tool invocation logged with: agent ID, user ID, tool name, parameters, outcome, cost

### Memory Integration

- **Short-term memory:** Conversation context within agent run (in-memory + Redis)
- **Long-term memory:** Business context from Memory System (ARCH-18) — embeddings, entity graphs, interaction history
- **RAG retrieval:** Query read models + vector store for relevant business context before planning

### Human-in-the-Loop

| Risk Level | Behavior |
|------------|----------|
| `low` | Auto-execute (e.g., search contacts, generate report) |
| `medium` | Execute and notify user (e.g., send email draft) |
| `high` | Pause for user approval (e.g., create invoice, modify employee record) |
| `critical` | Blocked for agent execution (e.g., delete data, financial transfers above threshold) |

### Cost Management

- Token/compute budget per agent run (configurable per tenant tier)
- Cost attribution per agent, per user, per tenant
- Budget exhaustion pauses agent with user notification

### Observability

- Full trace: prompt → plan → tool calls → outcomes (OpenTelemetry)
- Agent run metrics: success rate, latency, cost, approval rate
- Evaluation testing: adversarial inputs, permission boundary tests, cost limit tests

### LLM Provider Strategy

- **Provider-agnostic** — abstraction layer supports OpenAI, Anthropic, Google, and self-hosted models
- **Model selection per agent role** — Planner uses reasoning model; Executor uses fast model
- **No vendor lock-in** — model provider configurable per tenant and per agent role

## Consequences

### Positive

- **Safe agency** — agents can act on business data with authorization, approval gates, and audit trails
- **Specialization** — dedicated agents for planning, analysis, execution, and review
- **Human oversight** — high-risk actions require explicit user approval
- **Least privilege** — agents inherit user permissions; delegation is scoped and time-limited
- **Observable** — full trace from natural language request to business outcome
- **Extensible** — new agents and tools added via registry without architectural changes
- **Budget-controlled** — cost caps prevent runaway LLM spending

### Negative

- **Complexity** — multi-agent orchestration is significantly more complex than a single chatbot
- **Latency** — multi-step agent loops (plan → analyze → approve → execute → review) add seconds to responses
- **Cost** — multiple LLM calls per user request; budget management critical
- **Testing difficulty** — non-deterministic LLM outputs require evaluation frameworks, not just unit tests
- **User experience** — approval gates interrupt flow; must balance safety with usability

### Neutral

- Agent UI (chat interface, approval dialogs) specified in Phase 4 UI specification
- LLM provider selection per tenant configurable in admin settings
- Agent evaluation test suite required in CI (see testing architecture)
- Integration with Workflow Engine (ARCH-15) and Automation Engine (ARCH-16) for triggered agent runs
- Model fine-tuning deferred — prompt engineering and RAG sufficient for Phase 1