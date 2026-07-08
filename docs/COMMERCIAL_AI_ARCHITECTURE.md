# Warmpawz Commercial AI Copilot — Architecture Analysis

**Status:** ANALYSIS ONLY — no implementation  
**Date:** 2026-07-08  
**Branch context:** Post Campaign completion + Part 19 (vendor/seller visibility)

---

## Verdict

The Commercial AI Copilot should be a **read-only, role-scoped orchestration layer** sitting *beside* the Commercial Platform — not inside Pricing, Policy, Campaign, Settlement, or Analytics engines.

It reuses the existing Admin AI Copilot stack (Bedrock + allowlisted tools + RAG + RBAC + kill switch) but must be **narrowed to Commercial domain** and extended to Vendor / Seller with strict tenant isolation.

---

## 1. Current Commercial Platform (relevant engines)

| Engine | Role | AI relationship |
|--------|------|-----------------|
| **Promotion Engine** | Creates / schedules / activates promotions | Explain + investigate via APIs |
| **Coupon Engine** | Codes, eligibility, redemptions | Explain + investigate via APIs |
| **Policy Center** | Winning strategy, funding defaults, stacking | Explain runtime + draft/published policy |
| **Campaign Engine** | Orchestrates offers/funding/schedule (no pricing) | Explain + health + participant scope; `aiReady` metadata already present |
| **Discount Resolver** | Applies prices at booking/checkout | Explain outcomes only (never mutate) |
| **Settlement Engine** | Funding splits → payout attribution | Investigate vendor-scoped settlements |
| **Analytics Engine** | Discount / campaign KPIs | Investigate reports |
| **Notification Engine** | Customer + vendor inboxes | Explain campaign enrollment / push linkage |
| **Finance** | Payouts, fee config, platform money | **Admin only** |

**Hard rule:** Engines stay authoritative. AI never duplicates discount math, never publishes policy, never creates campaigns.

---

## 2. Integration architecture (recommended)

```
┌─────────────────────────────────────────────────────────────┐
│  Admin / Vendor / Seller UI                                 │
│  Floating Commercial Copilot + ? tooltips → Ask AI           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Commercial AI Gateway (new thin layer)                     │
│  - Auth + role + tenant scope                               │
│  - Intent router: Explain vs Investigate vs Refuse          │
│  - Context injector: page / surface / entity IDs            │
│  - System prompt + commercial guardrails                    │
└──────────┬───────────────────────────┬──────────────────────┘
           │                           │
           ▼                           ▼
┌──────────────────────┐    ┌──────────────────────────────┐
│  Doc / RAG plane     │    │  Tool plane (READ ONLY)      │
│  Commercial docs     │    │  Allowlisted commercial APIs │
│  Tooltip glossary    │    │  (already exist per engine)  │
│  Policy vocabulary   │    └──────────────┬───────────────┘
└──────────────────────┘                   │
           │                               │
           └───────────────┬───────────────┘
                           ▼
                 ┌──────────────────┐
                 │  Bedrock (Claude)│
                 │  + Guardrails    │
                 └──────────────────┘
```

### Why this shape

1. **No engine modification:** tools call *existing* HTTP/service facades (`/admin/commercial-campaigns`, `/admin/discount-policy/*`, analytics, settlement APIs, participant vendor campaign APIs).
2. **Matches current Admin Copilot:** planner pass → allowlisted tools → main Bedrock turn with `TOOL_RESULTS_JSON` + RAG appendix (already in `admin-ai-copilot.ts`).
3. **Campaign readiness:** `enrichAiReadyCampaignMetadata` already stamps `aiReady`, objectives, budget, health, timeline for explanations.
4. **Future modules (Loyalty/Wallet/Membership):** register new *read tools* + RAG chunks; gateway stays the same.

---

## 3. Layering vs existing Admin Copilot

| Aspect | Today (Admin Copilot) | Commercial Copilot (proposed) |
|--------|----------------------|-------------------------------|
| Scope | Portal navigation, vendors, settings | Commercial operations only |
| Tools | 3 vendor/settings tools | Commercial read tools (promos, coupons, campaigns, policy, analytics, settlement, finance-admin) |
| Roles | Admin only | Admin + Vendor + Seller |
| RAG | Ops/vendor chunks | Commercial glossary + engine docs |
| UI | `AdminCopilotPanel` floating | Same pattern; context-aware commercial mode; Vendor/Seller panels |

**Recommendation:** Specialize into a **Commercial Copilot profile** (shared Bedrock client + shared audit pattern), rather than stuffing commercial tools into the general admin chatbot without scope guards.

---

## 4. Non-goals (architectural)

- Second pricing engine
- Mutating Commercial state from chat
- Direct AWS / SQL / Terraform from the model
- General customer chat
- Embedding a freeform LLM into resolver/settlement hot path

---

## 5. Related analysis docs

| Doc | Focus |
|-----|--------|
| `COMMERCIAL_AI_SCOPE.md` | In/out of scope topics + roles |
| `COMMERCIAL_AI_SECURITY.md` | Permissions & isolation |
| `COMMERCIAL_AI_CONTEXT.md` | Page context + memory |
| `COMMERCIAL_AI_UX.md` | Placement + help system |
| `COMMERCIAL_TOOLTIP_INVENTORY.md` | Field-level `?` coverage |
| `COMMERCIAL_AI_IMPLEMENTATION_BLUEPRINT.md` | Phased build plan (still not implementing here) |

---

## 6. Recommended architecture (one paragraph)

A **Commercial AI Gateway** authenticates Admin/Vendor/Seller, injects UI context (surface, domain, entity), classifies Explain vs Investigate vs Refuse, retrieves hybrid doc+runtime facts only through **allowlisted read tools** that wrap existing Commercial APIs, and answers via Bedrock under a commercial-only system prompt with audit logging — never modifying Promotions, Policy, Campaigns, Settlement, or Infrastructure.
