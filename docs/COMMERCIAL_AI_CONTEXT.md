# Commercial AI Copilot — Context Awareness & Memory

**Status:** ANALYSIS ONLY  
**Date:** 2026-07-08

---

## 1. Context problem

Operators should not re-explain:

> “I’m on the ecommerce Policy Center looking at Winning Strategy for Best Offer.”

The Copilot must receive **structured UI context** automatically.

---

## 2. Context packet (recommended)

Send with every chat turn:

```ts
type CommercialAiContext = {
  principal: { type: 'admin' | 'vendor' | 'seller'; id: string };
  surface: 'marketing' | 'ecommerce' | 'finance' | 'notifications' | 'unknown';
  discountDomain?: 'SERVICE' | 'ECOMMERCE';
  module:
    | 'promotions'
    | 'coupons'
    | 'policy'
    | 'campaigns'
    | 'analytics'
    | 'settlement'
    | 'finance'
    | 'notifications'
    | 'other';
  route: string;           // e.g. /ecommerce/policy
  entity?: {
    type: 'promotion' | 'coupon' | 'campaign' | 'booking' | 'order' | 'settlement' | 'policy_draft';
    id: string;
    name?: string;
  };
  uiState?: {
    tab?: string;
    statusFilter?: string;
    campaignHealth?: string;
  };
  locale?: string;
};
```

### Module → context mapping

| Module | Surface | Auto-context |
|--------|---------|--------------|
| Promotion Center platform | marketing | SERVICE domain, promotions list / selected promo |
| Promotion Center policy | marketing | Policy tab, runtime fingerprint if shown |
| Promotion Center campaigns | marketing | Selected campaignId, health |
| Ecommerce promotions | ecommerce | ECOMMERCE domain |
| Ecommerce policy | ecommerce | Policy + domain |
| Ecommerce campaigns | ecommerce | Campaign participant / admin view |
| Finance / settlements | finance | Settlement ids; Admin only for platform money |
| Notification engine | notifications | Campaign link ids if commercial-linked |
| Vendor Service Promotions | marketing | vendorId + own promos |
| Vendor/Seller Campaigns | marketing/ecommerce | participantVendorId + campaignId |

---

## 3. Explain vs Investigate pipelines

### Explain (documentation / glossary)

Triggers: “What is Funding?”, “Explain Winning Strategy”, “What is Campaign Health?”

Sources:

1. Commercial glossary (tooltip copy)
2. RAG chunks from product docs (`CAMPAIGN_*`, Policy docs)
3. Context fields for domain-specific wording (SERVICE vs ECOMMERCE)

No tools required unless citing *current* published policy summary.

### Investigate (runtime)

Triggers: “Why didn’t coupon X apply on booking Y?”, “Why is campaign healthy/critical?”, “Why did vendor get this settlement amount?”

Sources:

1. Allowlisted read tools
2. Entity ids from context (preferred) or validated ids in message
3. `TOOL_RESULTS_JSON` as sole factual base

### Router rules

| Signal | Pipeline |
|--------|----------|
| Starts with “What is / Explain / Define” + no entity needed | Explain |
| “Why / Diagnose / Failed / Didn’t apply / How much” | Investigate |
| Off-topic | Refuse |
| Ambiguous | Ask one clarifying question **within commercial scope** |

---

## 4. Conversation memory (session)

### Remember within session

- Current page context packet (update on navigation)
- Last selected entity (promotion / campaign / booking)
- Last tool results summary (ids + key metrics, not raw dumps)
- User’s domain/surface preference this session

### Do not persist across sessions (v1)

- Freeform chat history about other vendors
- Cached policy drafts beyond TTL
- Cross-device memory

### Recommended model

**Sliding window** of last N turns + **always-fresh context packet** + optional **entity pin** (“focus: campaign abc”).

When the user navigates away, replace module/entity context; keep conversation text but mark stale entity as superseded.

---

## 5. Commercial investigations (runtime) without over-exposure

| Scenario | Tools (conceptual) | Redaction |
|----------|-------------------|-----------|
| Coupon didn’t apply | Get booking apply log / rejection reasons; coupon eligibility | Hide other customers |
| Promotion failed | Promo status, schedule, policy conflict flags, linked campaign health | No platform margin |
| Campaign budget exhausted | Campaign health + budget fields from `aiReady` metadata | OK |
| Settlement amount | Settlement attribution for **own** vendorId | Strip platform fee breakdown from vendor view if sensitive |
| Analytics lag | Report availability flags | No raw DB |

Prefer **structured reasons** already produced by engines (rejection codes, health reasons) over LLM inventing causes.

---

## 6. Recommendation

Context = structured client packet + session entity pin.  
Memory = short session window.  
Pipelines = Explain vs Investigate vs Refuse.  
Facts = tools + docs, never model invention when runtime is available.
