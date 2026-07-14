# Commercial AI Copilot — Security & Permissions

**Status:** ANALYSIS ONLY  
**Date:** 2026-07-08

---

## 1. Threat model (abridged)

| Threat | Mitigation |
|--------|------------|
| Cross-tenant data leak (Vendor A sees Vendor B) | Tool-layer filters by `vendorId` from auth, never from freeform prompt alone |
| Vendor sees platform finance | Tools for finance requiring admin permission only |
| Prompt injection → mutate data | **No write tools**; system prompt forbids mutations; server ignores model-requested writes |
| Prompt injection → SQL / AWS | Tools are allowlisted function names only; no raw SQL / no AWS SDK exposure |
| Secrets in tool output | Redact credentials like existing admin tool for `platform_settings` |
| PII over-disclosure | Strip customer PII from investigation payloads; return aggregates / masked IDs |
| Disabled yet reachable | Kill switches (env + platform_settings) mirroring Admin Copilot |

---

## 2. Permission model

### Reuse patterns already in repo

- Admin: `admin.ai_copilot` gate + per-tool RBAC (`admin-ai-copilot-tools-core.ts`)
- Vendor/Seller: JWT + path `vendorId` ownership checks (same pattern as `/vendor/:vendorId/commercial-campaigns`)

### Proposed permission keys (conceptual)

| Key | Who | Capability |
|-----|-----|------------|
| `admin.ai_copilot` | Admin | Use Commercial Copilot (admin mode) |
| `admin.marketing` / promo perms | Admin | Promo/coupon/campaign tools |
| `admin.discount_policy` | Admin | Policy runtime/draft explain tools |
| `admin.finance` | Admin | Finance report tools |
| `vendor.commercial_copilot` | Vendor | Session-enabled commercial assist |
| *(implicit)* seller = vendor role with ecommerce surface | Seller | Same gateway, ecommerce scope |

### Enforcement order (must)

1. Authenticate  
2. Authorize portal permission  
3. Bind tenant (`vendorId` / admin global)  
4. Filter tool allowlist by permission  
5. Execute tool with **server-side** ownership filter  
6. Bedrock answer using filtered `TOOL_RESULTS_JSON` only  

Never let the model choose an arbitrary entity ID without server validation.

---

## 3. Tenant isolation rules

| Data class | Admin | Vendor | Seller |
|------------|-------|--------|--------|
| Own promotions | ✅ | ✅ | ✅ |
| Other vendors’ promotions | ✅ | ❌ | ❌ |
| Platform campaigns (participant) | ✅ | Own performance only | Own performance only |
| Policy published semantics | ✅ | Explain-only (no draft secrets if sensitive) | Explain-only |
| Settlement platform fees / margins | ✅ | ❌ | ❌ |
| Vendor payout / own commission | ✅ | ✅ own | ✅ own |
| Finance P&L | ✅ | ❌ | ❌ |
| Customer PII | Minimal / masked | Own-booking aggregates only | Own-order aggregates only |

---

## 4. Write / mutate ban list (non-negotiable)

AI must **never** be able to:

- Delete / publish / pause promotions or coupons (unless a future explicit confirm UX — **not** recommended v1)
- Publish / rollback Policy Center
- Create / fund / schedule campaigns
- Modify funding splits
- Execute SQL
- Call AWS APIs directly
- Deploy infrastructure
- Change fee config or settlement rules

All of these remain human UI + existing authenticated APIs.

---

## 5. Audit

Extend existing `admin_ai_audit` pattern to commercial sessions:

- Principal id (admin or vendor)
- Route / portal
- Tool names used
- Entity ids accessed (campaignId, promotionId)
- Outcome / latency / prompt hash
- Surface (`marketing` | `ecommerce`)

Vendor sessions need an equivalent audit table or unified `commercial_ai_audit` with `principal_type`.

---

## 6. Recommended security architecture

```
AuthN → AuthZ → Tenant bind → Scope classify → Allowlisted READ tools
         → Redact → Bedrock → Response validate (no secrets / no forbidden intents)
         → Audit
```

Security is **server-side**. The model is untrusted for authorization.
