# Commercial AI Copilot — Implementation Blueprint

**Status:** IMPLEMENTED (Phase A1 — Admin first, local)  
**Date:** 2026-07-08  
**Related analysis:** `COMMERCIAL_AI_ARCHITECTURE.md`, `COMMERCIAL_AI_SCOPE.md`, `COMMERCIAL_AI_SECURITY.md`, `COMMERCIAL_AI_CONTEXT.md`, `COMMERCIAL_AI_UX.md`, `COMMERCIAL_TOOLTIP_INVENTORY.md`

---

## 1. Summary

The **Commercial AI Gateway** is a read-only assistant beside (never inside) Promotion, Coupon, Campaign, Policy, Settlement, Analytics, and Notification engines. It explains and investigates commercial operations for **Admin only** in Phase A1. It does not calculate discounts, mutate records, or replace any engine.

---

## 2. Architecture

```
Admin UI (Commercial routes)
  → CommercialCopilotPanel / CommercialHelpTooltip
  → POST /admin/commercial-ai-copilot/chat
  → Commercial AI Gateway (backend/lambda/src/commercial-ai/)
       ├─ Kill switch (env + platform_settings)
       ├─ Intent router: Explain | Investigate | Refuse
       ├─ Explain → Glossary + RAG + Knowledge graph
       ├─ Investigate → Planner → Allowlisted read tools → Bedrock
       ├─ Refuse → Commercial-only message (no Bedrock)
       ├─ Response validation + source badges
       └─ Audit (admin_ai_audit)
  → Existing engines/APIs (authoritative)
```

**Module layout (`backend/lambda/src/commercial-ai/`):**

| File | Role |
|------|------|
| `gateway.ts` | Orchestration, Bedrock calls, audit metadata |
| `intent-router.ts` | Explain / Investigate / Refuse routing |
| `scope.ts` | Commercial-only gate + refusal message |
| `context.ts` | Resolve surface, module, domain from route/tab |
| `glossary.ts` | Single source of truth for tooltips + Explain |
| `rag.ts` | Glossary + doc chunks for Explain |
| `knowledge-graph.ts` | Metadata relationships (no business logic) |
| `tools-core.ts` | Allowlist, planner prompt, permission filter |
| `tools.ts` | Read-only tool execution via engines |
| `response-validate.ts` | Documentation / Live Data / Hybrid badges |
| `audit.ts` | Reuses `admin_ai_audit` table |
| `suggested-questions.ts` | Module-based prompt chips |

**HTTP endpoints (`commercial-ai-copilot.endpoints.ts`):**

- `GET /admin/commercial-ai-copilot/health`
- `GET /admin/commercial-ai-copilot/glossary`
- `GET /admin/commercial-ai-copilot/suggestions`
- `POST /admin/commercial-ai-copilot/chat`

Registered in `handler/index.ts` after Admin Copilot with rate limiting on `/admin/commercial-ai-copilot/*`.

---

## 3. Context injection

The UI sends a **context packet** on every chat request. The server merges route/tab with optional pinned entity.

| Field | Source |
|-------|--------|
| `surface` | marketing, ecommerce, finance, notifications |
| `discountDomain` | SERVICE / ECOMMERCE |
| `module` | promotions, coupons, policy, campaigns, analytics, settlement, finance, notifications |
| `route` | Current pathname |
| `tab` | URL search param |
| `entity` | Pinned from drawer/detail via `CommercialAiContext` |

**Frontend:**

- `apps/admin-web/lib/commercial-ai/commercial-routes.ts` — route allowlist
- `apps/admin-web/lib/commercial-ai/types.ts` — `buildContextFromPathname`
- `apps/admin-web/context/CommercialAiContext.tsx` — session entity + Ask AI prefill
- `CommercialCampaignHub` → `onEntityFocus` when campaign drawer opens

Context updates on navigation; no cross-session memory.

---

## 4. Intent router

| Intent | When | Pipeline |
|--------|------|----------|
| **Refuse** | Off-topic (programming, AWS, weather, etc.) | Static commercial-only message, no Bedrock |
| **Explain** | “What is…”, “Explain…”, definitions | Glossary + RAG + knowledge graph → Bedrock |
| **Investigate** | “Why…”, failures, health, amounts + entity context | Planner → read tools → Bedrock |

Separate pipelines — not a single generic chat flow.

---

## 5. Read tools (allowlisted, no writes)

| Tool | Wraps |
|------|--------|
| `get_promotion_snapshot` | `promotions` table (sanitized) |
| `get_coupon_snapshot` | `coupons` table (sanitized) |
| `get_campaign_snapshot` | Campaign Engine `getCampaign` |
| `get_campaign_health` | Campaign Engine `getHealth` |
| `get_campaign_analytics` | Campaign analytics bridge |
| `get_runtime_policy_summary` | Published runtime policy loader |
| `get_discount_analytics_overview` | Analytics engine report |
| `get_campaign_settlement_attribution` | Settlement attribution read |
| `get_campaign_notification_link` | Notification campaign linkage |

**Never exposed:** SQL, AWS, Terraform, deploy, write APIs.

Permission: `admin.ai_copilot` (same as Admin Copilot). Tools filtered server-side in `tools-core.ts`.

---

## 6. Bedrock integration

Reuses:

- `invokeBedrock` + guardrails (`BEDROCK_GUARDRAIL_BLOCKED`)
- Planner pattern from Admin Copilot (`COMMERCIAL_COPILOT_TOOL_PASS1_SYSTEM`)
- `parseChatBedrockCompletion` for main answer

Flow:

```
Intent → (Investigate: Planner rounds → execute tools) → Bedrock → validate → audit
```

Guardrails are never bypassed.

---

## 7. Admin UI

| Component | Path |
|-----------|------|
| Floating panel | `CommercialCopilotPanel.tsx` |
| Help `?` tooltips | `CommercialHelpTooltip.tsx` |
| Route switch | `AdminLayout.tsx` — commercial routes → Commercial Copilot; else Admin Copilot |

**Commercial routes:** promotion-center, promotions, policy-center, marketing, ecommerce, finance, settlements, notification-engine, notifications.

**Help system:** `?` → tooltip (glossary API, no Bedrock) → Example → Learn more → **Ask AI** (opens copilot with prefill).

**Wired tooltips (P0):** Policy Center header, Winning Strategy, Stack Rules, Funding defaults, Runtime Policy, Campaign Funding editor.

**Response badges:** Explain → Documentation; Investigate → Live Data; hybrid when both used.

---

## 8. Glossary

`COMMERCIAL_GLOSSARY` in `glossary.ts` is the single source of truth for tooltips and Explain RAG. Exposed via `GET /admin/commercial-ai-copilot/glossary`.

---

## 9. Suggested questions

Module-specific chips from `suggested-questions.ts`, loaded when panel opens. Examples: “Explain Campaign Health”, “Explain Funding”, “Explain Best Offer Only”, “Why did Vendor receive this amount?”.

---

## 10. Knowledge graph

`knowledge-graph.ts` provides metadata relationships only:

```
Promotion → Campaign → Policy → Funding → Settlement → Analytics
```

Used in Explain prompts; no duplicated engine logic.

---

## 11. Security

- RBAC: `admin.ai_copilot` required for chat
- Tenant isolation: tools use existing admin APIs; no cross-vendor leakage
- Model never authorizes itself
- Draft policy internals not exposed in runtime tool
- No customer PII, secrets, or platform finance beyond scoped admin reads
- See `COMMERCIAL_AI_SECURITY.md`

---

## 12. Audit

Reuses `admin_ai_audit` via `appendCommercialAiAudit`. Logs:

- Principal, route, surface, module, entity type/id
- Prompt hash (not raw prompt), message length
- Tools used, latency, outcome (explain / investigate / refused / guardrail / disabled)
- No sensitive values

---

## 13. Feature flags

| Layer | Key | Dev | Prod |
|-------|-----|-----|------|
| Terraform | `COMMERCIAL_AI_COPILOT_ENABLED` | `true` | `false` |
| Platform settings | `admin:settings:commercial_ai_copilot` | JSON `{ enabled: false }` kills | same |
| Deploy script | `scripts/_deploy-dev-all.ps1` | defaults `true` | — |

Health endpoint returns `vendorAiEnabled: false`, `sellerAiEnabled: false` (prepared for future rollout).

---

## 14. Deployment

1. Merge feature branch → `develop` (CI deploys dev Lambda + admin)
2. Dev smoke test on commercial routes
3. Prod: set `COMMERCIAL_AI_COPILOT_ENABLED=true` in Terraform after approval; deploy Lambda + admin web
4. Optional platform_settings kill switch without redeploy

**Order:** Backend (new endpoints) before admin UI that calls them.

---

## 15. Testing

**Unit tests (`backend/lambda/src/commercial-ai/__tests__/`):**

- `commercial-ai-scope.test.ts` — off-topic refusal, commercial acceptance
- `commercial-ai-intent-router.test.ts` — explain / investigate / refuse routing

**Manual validation checklist:**

- [ ] Commercial question on Policy Center → Documentation badge, glossary-backed answer
- [ ] “Why is campaign X Critical?” with campaign selected → Live Data badge, health tool used
- [ ] “Write terraform for lambda” → polite refuse, no Bedrock tools
- [ ] Tooltip `?` loads glossary only; Ask AI opens copilot with prefill
- [ ] Navigate marketing → campaigns → entity pins in context
- [ ] Kill switch `COMMERCIAL_AI_COPILOT_ENABLED=false` → 503 on chat
- [ ] No promotion/policy/campaign mutations from copilot

Run: `cd backend/lambda && npm test -- commercial-ai`

---

## 16. Rollback

1. Set `COMMERCIAL_AI_COPILOT_ENABLED=false` in Lambda env (Terraform prod/dev)
2. Or set `platform_settings.admin:settings:commercial_ai_copilot` → `{ "enabled": false }`
3. Redeploy admin web only if UI regression — panel hides when health reports disabled
4. No DB migration required for Phase A1

---

## 17. Future: Vendor / Seller / Customer AI

Architecture prepared but **not implemented** in A1:

- Gateway role parameter (`vendor` / `seller` / `customer`)
- Participant-scoped tools only (`/vendor/:id/commercial-campaigns…`)
- Strip finance/platform tools for vendor/seller
- Feature flags: `vendorAiEnabled`, `sellerAiEnabled` in health (currently false)
- Same Explain / Investigate / Refuse + read-only allowlist pattern

See blueprint Phase D in original analysis and `COMMERCIAL_AI_ARCHITECTURE.md` § Portal rollout.

---

## 18. Constraints preserved

- Admin first, read-only
- One Commercial AI Gateway beside engines
- Reuses Bedrock, Admin Copilot patterns, guardrails, audit, RBAC
- No duplicated business logic or write tools
- Engines remain authoritative
