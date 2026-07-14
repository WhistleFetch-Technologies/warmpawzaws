# Commercial AI Copilot — UX & Help System

**Status:** ANALYSIS ONLY  
**Date:** 2026-07-08

---

## 1. Placement recommendation

**Primary:** Floating assistant (bottom-right), same pattern as existing `AdminCopilotPanel`.

**Why**

- Works across Promotion Center, Ecommerce, Finance without rebuilding each page layout
- Matches current admin muscle memory
- Can receive route/context without a permanent sidebar eating campaign/builder density

**Secondary (detail surfaces):** Optional **Context panel** button on Campaign Details / Policy Center / Settlement detail: “Ask about this” pre-fills entity context.

**Avoid (v1)**

- Bottom panel stealing vertical space from builders
- Always-open right drawer on mobile vendor

| Portal | Placement |
|--------|-----------|
| Admin | Floating Commercial Copilot (or mode toggle on existing copilot) |
| Vendor | Floating panel on Promotions / Campaigns |
| Seller | Floating panel on Seller Hub Promotions / Campaigns |

---

## 2. Help system layers (together, not competing)

```
Field label  [?]
     │
     ├─ Hover/Click → Tooltip (1–2 sentences)
     │
     ├─ “Example” → mini illustration / numbers
     │
     ├─ “Learn more” → Help card / doc anchor
     │
     └─ “Ask AI” → Opens Copilot with:
            context.entity + prefilled question
```

| Layer | Job | Latency | Auth |
|-------|-----|---------|------|
| Tooltip `?` | Instant definition | 0 | None |
| Help card | Short curated article | Static | None |
| Docs | Deep reference | Static | Optional |
| Ask AI | Personalized explain / investigate | Network | Required |

**Rule:** Tooltips never call Bedrock. AI never replaces first-line `?` copy.

---

## 3. Suggested microcopy patterns

**Tooltip:** “Funding defines who pays the discount — Platform, Vendor, or Shared split.”  
**Ask AI:** “Explain funding for this campaign” / “Why is health Critical?”

---

## 4. Explain vs Investigate UX cues

- Explain answers → short, may cite glossary
- Investigate answers → show “Based on live data for …” + bullet causes from tools
- Refuse → single polite redirect to commercial topics

Show **chip**: `Explain` | `Investigation` | so users know whether runtime data was used.

---

## 5. Empty / disabled states

- Copilot disabled → same Coming Soon / disabled panel pattern as campaigns when mode OFF
- No permission → do not render float button
- Vendor without commercial features → hide

---

## 6. UX principles summary

1. One Floating Copilot for Commercial  
2. Tooltips first, AI second  
3. Auto context from page  
4. Read-only clarity (“I can’t change this policy — open Policy Center to publish”)  
5. Role-aware prompts (“Your participation” vs “Platform campaign”)
