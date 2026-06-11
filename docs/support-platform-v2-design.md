# WarmPawz Support Platform V2 — Product & Operations Design

**Version:** 1.0  
**Status:** Design specification (no implementation)  
**Audience:** Product, Design, Support Operations, Engineering  
**Last updated:** 2026-06-11

This document combines the **Support Platform V2** product design (customer + admin journeys, lifecycle, layout, AI, SLA, quick wins, vision) with the **Support Ticket Attachment System** specification (S3, security, wireframes, database).

**Related apps:** `apps/admin-web`, `apps/customer-web`, `apps/vendor-web`  
**Related backend:** `backend/lambda/src/endpoints/supportCrm/`

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Customer Journey](#2-customer-journey)
3. [Admin Agent Journey](#3-admin-agent-journey)
4. [New Ticket Lifecycle](#4-new-ticket-lifecycle)
5. [New Admin CRM Layout](#5-new-admin-crm-layout)
6. [AI Features](#6-ai-features)
7. [Internal Notes Design](#7-internal-notes-design)
8. [SLA and Escalation Design](#8-sla-and-escalation-design)
9. [Quick Wins](#9-quick-wins)
10. [Long-Term Vision](#10-long-term-vision)
11. [Attachment System Design](#11-attachment-system-design)

---

## 1. Design Principles

| Principle | Meaning for WarmPawz |
|-----------|----------------------|
| **Context before scroll** | Booking, payment, and pet context always visible while replying |
| **Status = promise** | Every status tells customer and agent what happens next |
| **AI assists, humans decide** | Auto-ack, classification, drafts — never auto-refund or auto-close |
| **Booking-native** | Booking tickets inherit booking timeline, vendor, service, refund eligibility |
| **Honest SLA** | No SLA breach UI until engine runs; when live, breaches are visible and actionable |
| **Files are first-class** | Attachments live in thread + context panel, not buried in JSON metadata |

### Current problems addressed

| # | Problem | V2 response |
|---|---------|-------------|
| 1 | Admin CRM heavily vertical, requires scrolling | Three-panel desktop layout |
| 2 | Agents scroll to read context and reply | Sticky composer; context in right rail |
| 3 | Booking, payment, conversation, reply compete for space | Dedicated columns per concern |
| 4 | No AI auto-acknowledgement | Auto-ack on every ticket create |
| 5 | No Awaiting Assignment workflow | New lifecycle state + Unassigned queue |
| 6 | No internal notes UI | Composer tab + visual distinction |
| 7 | Limited triage filters | Views, SLA, sentiment, type, source filters |
| 8 | SLA settings not operational | SLA engine + honest settings UX |
| 9 | Limited customer progress visibility | Status stepper + ETA + assigned agent |
| 10 | Booking support under-automated | Booking-native create, context, refund rail |

---

## 2. Customer Journey

### 2.1 General Ticket Flow

**Entry points:** Help Center → Contact, AI chatbot escalation, Home “24/7 Support”, Messages hub.

```
┌─────────────────────────────────────────────────────────────┐
│  Help Center                                                │
│  ┌─────────┐ ┌─────────┐ ┌──────────────┐                   │
│  │   FAQ   │ │ Contact │ │ My Tickets   │                   │
│  └─────────┘ └─────────┘ └──────────────┘                   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼ Contact
┌─────────────────────────────────────────────────────────────┐
│  What do you need help with?                                │
│  ○ Account & app    ○ Orders & delivery    ○ Billing        │
│  ○ Pet care advice  ○ Something else                          │
│                                                             │
│  Subject: [________________________]                        │
│  Message:  [________________________]                       │
│            [________________________]                       │
│  Attach:   [+ Add photo/screenshot]  (optional, max 5)    │
│                                                             │
│  [ Submit ticket ]                                          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼ Immediate (AI + system)
┌─────────────────────────────────────────────────────────────┐
│  ✓ Ticket #TKT-20260611-0042 created                        │
│                                                             │
│  🤖 Warmpawz Support                                        │
│  "We've received your request about [billing]. A support    │
│   agent will review this within [2 hours]. Track progress   │
│   in My Tickets."                                           │
│                                                             │
│  Expected first response: Today by 4:30 PM                  │
│  Status: Awaiting assignment                                │
│                                                             │
│  [ View ticket ]  [ Back to Help ]                          │
└─────────────────────────────────────────────────────────────┘
```

**Customer promises:**
- Instant acknowledgement (AI + ticket number)
- Clear next step and ETA (from SLA when operational)
- Single place to track: **My Tickets**

---

### 2.2 Booking Ticket Flow

**Entry points:** Booking detail → “Get help”, post-service issue, cancellation/refund intent, vendor no-show.

```
Booking Detail (#BK-8842)
┌─────────────────────────────────────────────────────────────┐
│  Grooming · ₹899 · Completed · 8 Jun                        │
│  [ Message vendor ]  [ Get support ]  [ Book again ]        │
└─────────────────────────────────────────────────────────────┘
         │ Get support
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Support for this booking                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📋 Booking summary (read-only)                       │    │
│  │ Service · Vendor · Date · Amount · Payment status    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  What's the issue?                                          │
│  ○ Service quality    ○ Vendor no-show    ○ Wrong charge    │
│  ○ Cancellation     ○ Refund request    ○ Other             │
│                                                             │
│  Details: [________________________________]                │
│  Attach:  [+ Receipt] [+ Screenshot] [+ Rx] [+ Medical]   │
│                                                             │
│  [ Create booking support ticket ]                          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Ticket linked to booking #BK-8842                          │
│  Type: Booking support · Priority: High (predicted)           │
│  Refund eligibility: ₹749 refundable (if applicable)        │
│  Status: Awaiting assignment                                │
│  [ View conversation ]                                      │
└─────────────────────────────────────────────────────────────┘
```

**Booking automation (V2):**
- Pre-fill subject from issue type + service name
- Auto-attach booking snapshot (no manual UUID on admin side)
- Show refund eligibility to customer in plain language
- Route to booking-specialist queue when category = billing/refund

---

### 2.3 AI Acknowledgement Flow

Runs on **every** ticket create (customer, AI escalation, chat handoff, vendor).

```
Ticket Created
      │
      ├─► System: status = Awaiting Assignment
      │
      ├─► AI: classify (category, priority, sentiment)
      │
      ├─► AI: generate acknowledgement message
      │         (personalized, sets expectations, no refund promises)
      │
      ├─► Post as system message in thread
      │
      ├─► Notify customer: in-app + SMS/push (if opted in)
      │
      └─► Notify support queue (badge / SNS)
```

| Ticket type | Ack tone |
|-------------|----------|
| General | “We received your request about [category]. An agent will respond by [SLA time].” |
| Booking | “We're looking into your [service] booking on [date]. Booking details are linked.” |
| Urgent / negative sentiment | “We understand this is frustrating. Your ticket is marked urgent.” |

**Guardrails:** AI ack must not promise refunds, legal outcomes, or times beyond SLA window.

---

### 2.4 My Tickets & Conversation

```
My Tickets
┌─────────────────────────────────────────────────────────────┐
│  Open (2)    Resolved (5)    All                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ● Booking · Refund request          Awaiting agent     │  │
│  │   TKT-0042 · Updated 2h ago · ETA: Today 4:30 PM       │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ ○ General · App login issue         Agent replied      │  │
│  │   TKT-0038 · 1 new message                           │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

Ticket Detail (mobile-first, sticky composer)
┌─────────────────────────────────────────────────────────────┐
│  ← Back          TKT-0042          [···]                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Status: ● Investigating                              │    │
│  │ Assigned: Priya (Support) · Updated 10 min ago       │    │
│  │ Linked: Booking #BK-8842                             │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─ Progress stepper ─────────────────────────────────┐    │
│  │ Received → Assigned → Investigating → Resolved      │    │
│  │            ✓          ●                           │    │
│  └────────────────────────────────────────────────────┘    │
│  [ scrollable messages + inline attachments ]               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Type a reply…  📎 Attach              [ Send ]        │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Home screen messages:** Badge for open tickets + “agent replied”; tap → My Tickets filtered to **Waiting For Customer**; unified Inbox with chips (`Support` vs `Vendor chat`).

---

## 3. Admin Agent Journey

### 3.1 Ticket Triage

```
Support CRM — Triage View (default landing)
┌──────────────────────────────────────────────────────────────────────────┐
│ Warmpawz Support    [🔔 12]  [My queue: 8]  [Settings]  Agent: Priya      │
├──────────────────────────────────────────────────────────────────────────┤
│ Views: [ Unassigned ▼ ] [ All open ] [ Booking ] [ Refunds ] [ Escalated ] │
│ Filter: Priority ▼  Category ▼  Source ▼  SLA ▼  Search [___________] 🔍  │
│ Sort: SLA breach first ▼                                                    │
├──────────────┬─────────────────────────────────────────────────────────────┤
│ QUEUE        │  Unassigned · 14 · 3 breaching SLA                          │
│              │  ┌─────────────────────────────────────────────────────┐   │
│ Unassigned   │  │ 🔴 URG  TKT-0091  Refund · Booking  SLA: 12m overdue   │   │
│ 14           │  │ Customer: Ananya · ₹1,299 · 📎2 · Created 2h ago       │   │
│              │  ├─────────────────────────────────────────────────────┤   │
│ My queue     │  │ 🟠 HIGH TKT-0088  Vendor no-show · Booking             │   │
│ 8            │  │ AI: negative sentiment · Grooming 7 Jun                 │   │
│              │  └─────────────────────────────────────────────────────┘   │
│ Breaching    │  [ Assign to me ]  [ Auto-assign ]  [ Bulk assign ▼ ]       │
│ SLA 5        │                                                             │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

| Filter | Purpose |
|--------|---------|
| Unassigned | **Awaiting Assignment** queue |
| My queue | Assigned to current agent |
| Booking / General | Type split |
| Refunds pending | `refund_status = processing` |
| Escalated | Supervisor queue |
| SLA breaching | When SLA engine live |
| Source | customer, AI, vendor, handoff |
| Sentiment | angry, frustrated, neutral |

**Default sort:** SLA breach → priority → oldest unassigned.

---

### 3.2 Assignment

```
Assign modal
┌─────────────────────────────────────┐
│ Assign 3 tickets                    │
│ Agent: [ Priya Sharma      ▼ ]      │
│        Workload: 6/10 · booking     │
│ ☑ Notify customer "Agent assigned"   │
│ [ Cancel ]  [ Assign ]               │
└─────────────────────────────────────┘

On assign: Awaiting Assignment → Assigned
Customer: "Priya is reviewing your ticket"
```

**Auto-assign:** Round-robin within specialty; respect `max_concurrent_tickets`; booking → booking/refund specialists.

---

### 3.3 Reply Workflow

```
Reply composer (center panel, sticky bottom)
┌─────────────────────────────────────────────────────────────┐
│ Reply to customer │ Internal note │  [ AI Suggest ▼ ]         │
├─────────────────────────────────────────────────────────────┤
│ [ Multi-line composer — min 4 lines visible ]               │
│ Attach: [+ File]   Canned: [Refund policy ▼]                │
│ [ Send reply ]  [ Send & mark Waiting For Customer ]        │
└─────────────────────────────────────────────────────────────┘
```

- **Reply to customer** — visible in app, triggers notification
- **Internal note** — amber, 🔒, no customer notify

---

### 3.4 Refund Workflow (booking tickets)

```
Context panel — Payment & Refund
┌─────────────────────────────────────┐
│ PAYMENT & REFUND                    │
│ Paid: ₹899 · Refundable: ₹749       │
│ [ Partial refund ]  [ Full refund ]   │
│ Preview: [receipt thumb] [UPI ss]   │
└─────────────────────────────────────┘

Partial refund drawer
┌─────────────────────────────────────┐
│ Amount: [ ₹749    ]  max ₹749       │
│ Reason: [ Customer complaint ▼ ]    │
│ ☑ Notify customer                   │
│ [ Cancel ]  [ Process refund ]      │
└─────────────────────────────────────┘
```

- Full refund: show computed max only (no misleading default amount)
- Supervisor approval for high amounts (long-term)

---

## 4. New Ticket Lifecycle

```
                    ┌─────────────────────┐
                    │  Awaiting Assignment │◄─── create / reopen
                    └──────────┬──────────┘
                               │ assign
                               ▼
                    ┌─────────────────────┐
              ┌────►│      Assigned        │
              │     └──────────┬──────────┘
              │                ▼
              │     ┌─────────────────────┐
              │     │   Investigating      │◄──┐
              │     └──────────┬──────────┘   │
              │     ┌──────────┴──────────┐   │
              │     ▼                     ▼   │
              │ ┌──────────────┐  ┌──────────────┐
              │ │ Waiting For  │  │  Escalated   │
              │ │  Customer    │  │ (supervisor) │
              │ └──────┬───────┘  └──────┬───────┘
              │        └────────┬────────┘
              │                 ▼
              │     ┌─────────────────────┐
              │     │      Resolved        │
              │     └──────────┬──────────┘
              │                ▼
              │     ┌─────────────────────┐
              └─────│       Closed         │
                    └─────────────────────┘
```

| Status | Customer sees | Agent action | SLA |
|--------|---------------|--------------|-----|
| **Awaiting Assignment** | “Finding the right agent” | Triage / assign | First-response starts |
| **Assigned** | “[Agent] will respond soon” | Open ticket | First-response |
| **Investigating** | “We're working on this” | Research, notes | Resolution |
| **Waiting For Customer** | “We need your reply” | Pause optional | Paused / soft |
| **Escalated** | “Senior agent reviewing” | Supervisor owns | Escalation SLA |
| **Resolved** | “Confirm if fixed?” | CSAT prompt | — |
| **Closed** | “Case closed” | Archive | — |

**Legacy mapping:** `open` → Awaiting Assignment; `in_progress` → Investigating; `escalated` → Escalated; align `resolved` vs `closed` semantics.

---

## 5. New Admin CRM Layout

### Desktop (1440px+) — three panels

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER: Support CRM │ Unassigned (14) │ 🔍 Search │ 🔔 │ Agent: Priya │ ⚙ Settings           │
├──────────────┬─────────────────────────────────────────────┬───────────────────────────────┤
│  TICKET LIST │           CONVERSATION PANEL                │        CONTEXT PANEL          │
│  (280px)     │              (flex grow)                    │         (360px)               │
│              │                                             │                               │
│ [Filters ▼]  │  TKT-0091 · Refund · 🔴 URGENT              │  ┌─ CUSTOMER ─────────────┐  │
│ ┌──────────┐ │  Status: Investigating · SLA: 18m left      │  │ Ananya · +91… · history  │  │
│ │● TKT-091 │ │  ─────────────────────────────────────────  │  └────────────────────────┘  │
│ │ 📎2      │ │  [System] Auto-ack                          │  ┌─ BOOKING ──────────────┐  │
│ ├──────────┤ │  [Customer] I want refund… + attachments    │  │ #BK-8842 · Grooming    │  │
│ │  TKT-088 │ │  [Agent] Reviewing payment…                 │  └────────────────────────┘  │
│ └──────────┘ │  [🔒 Internal note: vendor GPS checked]     │  ┌─ ATTACHMENTS (6) ──────┐  │
│              │  ─────────────────────────────────────────  │  │ [thumb][thumb][pdf]…   │  │
│              │  Reply │ Internal note │ [AI Suggest]       │  └────────────────────────┘  │
│              │  ┌────────────────────────────────────────┐ │  ┌─ PAYMENT / REFUND ─────┐  │
│              │  │ Composer (sticky, 4 lines)             │ │  │ [ Partial ] [ Full ]   │  │
│              │  └────────────────────────────────────────┘ │  └────────────────────────┘  │
│              │  [Send]  [Send & wait for customer]          │  ┌─ ACTIONS ──────────────┐  │
│              │                                             │  │ Assign │ Escalate │ …  │  │
├──────────────┴─────────────────────────────────────────────┴───────────────────────────────┤
│ STATS: Open 42 │ Breaching 5 │ Avg first response 1.2h │ CSAT 4.6                        │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Column | Contents | Scroll |
|--------|----------|--------|
| Left | Compact cards: #, subject, priority, SLA, 📎 count | Independent |
| Center | Thread + sticky composer | Messages scroll; composer fixed |
| Right | Customer, booking, attachments, payment, AI, actions | Independent |

**Tablet:** List drawer; conversation + context 60/40. **Mobile admin (V2.1):** Queue cards; context bottom sheet.

---

## 6. AI Features

| Feature | When | Output | Human gate |
|---------|------|--------|------------|
| **Auto acknowledgement** | Ticket create | Thread + notify | Template review |
| **Classification** | Create | category, type | Agent override |
| **Priority prediction** | Create + new customer msg | low → urgent | Override for urgent |
| **Sentiment** | Each customer message | neutral / frustrated / angry | Queue sort |
| **Suggested replies** | Agent clicks AI Suggest | 2–4 drafts | Must edit/send |
| **Summary on open** | Agent opens ticket | 3-line case summary | Read-only |
| **Duplicate detection** | Create | Similar ticket warning | Merge (long-term) |

**Placement:** AI Insights in context panel; AI Suggest in composer. **Never** auto-refund or auto-close.

---

## 7. Internal Notes Design

```
Thread visual:
  Customer message     │ left, white bubble
  Agent reply          │ right, brand bubble
  System / auto-ack    │ center, gray
  Internal note        │ full-width, amber, 🔒

Composer: [ Reply to customer ] [ Internal note ]
  - No customer notification
  - Optional @supervisor
  - Attach files (internal visibility only)
  - Pin note for handoff
```

**Policy:** Notes required before escalation and large refunds; not in customer export.

---

## 8. SLA and Escalation Design

### Phase 1 — Honest UX

Settings show **“SLA tracking: Active / Not yet enabled”** until engine ships.

### Phase 2 — SLA engine

```
FIRST_RESPONSE_SLA:  created_at → first public agent reply
RESOLUTION_SLA:      created_at → resolved (pause in Waiting For Customer)

T-15m  → amber chip
T+0    → red chip + sort top + notify lead
T+escalation_after → auto-escalate or supervisor queue
```

### Escalation rules (runtime)

| Trigger | Action |
|---------|--------|
| First-response SLA breached | Escalate + email `notify_email` |
| Angry + unassigned 30m | Supervisor assign |
| Refund > threshold | Approval task |
| Legal / safety category | Immediate Escalated |

### Agent-facing SLA

Chips on list cards + countdown in conversation header.

---

## 9. Quick Wins

| # | Win | Impact |
|---|-----|--------|
| 1 | Three-panel layout | Stops scroll-to-reply |
| 2 | Sticky reply composer | Agent efficiency |
| 3 | Unassigned default queue | Awaiting Assignment ops |
| 4 | Internal note tab | Uses existing API capability |
| 5 | Customer progress stepper | Visibility |
| 6 | Admin replies trigger customer notify | Fixes silent replies |
| 7 | Booking ticket from booking detail only | No manual UUID attach |
| 8 | SLA “config only” label until engine live | Trust |
| 9 | Ticket list search | Triage speed |
| 10 | AI auto-ack on create | Instant expectations |
| 11 | Attachment presign + inline preview | Evidence in thread |

---

## 10. Long-Term Vision

```
V2 (0–6 mo)     Three-panel CRM · lifecycle · notes · auto-ack · SLA live · attachments · API auth
V2.5 (6–12 mo)  Supervisor dashboards · CSAT · merge/link · vendor dispute view · proactive tickets
V3 (12+ mo)     WhatsApp/email ingest · AI copilot · WFM · analytics · self-service deflection
```

| Metric | Target |
|--------|--------|
| First response (median) | Within SLA by priority |
| SLA breach rate | < 5% |
| CSAT on resolved | > 4.5/5 |
| Refund resolution (booking) | < 24h |
| Agent handle time | −25% vs vertical UI |

| Role | Primary view |
|------|----------------|
| Tier 1 | Unassigned + My queue |
| Booking/refund specialist | Booking + Refunds filters |
| Supervisor | Escalated + SLA breach + approvals |
| Ops admin | Settings, SLA, agents |

---

## 11. Attachment System Design

WarmPawz already uses **AWS S3**. V2 makes attachments first-class: presigned upload, private bucket, metadata in PostgreSQL, inline preview in customer and admin UIs.

### 11.1 Overview

| Type | MIME | Extension |
|------|------|-----------|
| PNG | `image/png` | `.png` |
| JPEG | `image/jpeg` | `.jpg`, `.jpeg` |
| PDF | `application/pdf` | `.pdf` |

| Limit | Default | Config key |
|-------|---------|------------|
| Max files per message | 5 | `support.attachments.max_files_per_message` |
| Max file size | 10 MB | `support.attachments.max_file_size_bytes` |
| Max total per message | 25 MB | `support.attachments.max_total_size_bytes` |
| Download URL TTL | 15 min | `support.attachments.download_url_ttl_seconds` |
| Upload URL TTL | 10 min | `support.attachments.upload_url_ttl_seconds` |

**Principles:** Direct-to-S3 upload; DB metadata; fail-closed access; virus-scan ready.

---

### 11.2 Customer UX Flow

**Create ticket:**

```
Compose → [+ Add files] → Preview strip (thumbs, ✕, count/size)
    → Submit
    → Create ticket
    → Presign each file
    → PUT to S3 (per-file progress)
    → Confirm uploads
    → Success + auto-ack
```

**Reply:**

```
Ticket detail → composer → [+ Attach] → preview → Send
    → Presign → PUT → Confirm → linked to support_ticket_responses row
```

**Rules:** Submit disabled during upload; closed tickets read-only; text required with attachments.

---

### 11.3 Admin UX Flow

- **Reply tab:** customer-visible attachments + notify
- **Internal note tab:** `visibility: internal`, 🔒, no customer SMS
- **Conversation:** inline thumbnail grid per message
- **Context panel:** Attachment hub — filter All | Customer | Agent | Internal; preview pane

---

### 11.4 Customer Wireframes

**Create with preview:**

```
┌─────────────────────────────────────────────────────────┐
│  Contact Support                                         │
│  Subject: [ Payment not reflected________________ ]     │
│  Message: [____________________________________]       │
│  Attachments (2/5) · 3.2 MB / 25 MB                     │
│  ┌────────┐ ┌────────┐ ┌ ─ ─ ─ ─ ┐                      │
│  │ [img]  │ │ [PDF]  │   + Add    │                      │
│  │  ✕     │ │  ✕     │   files    │                      │
│  └────────┘ └────────┘ └ ─ ─ ─ ─ ┘                      │
│  [ Submit ticket ]                                       │
└─────────────────────────────────────────────────────────┘
```

**Message with attachments:**

```
┌──────────────────────────────────────────┐
│  You · 2:34 PM                            │
│  Please see attached receipt              │
│  ┌──────────┐ ┌──────────┐               │
│  │  thumb   │ │ PDF icon │ → lightbox    │
│  └──────────┘ └──────────┘               │
└──────────────────────────────────────────┘
```

---

### 11.5 Admin Wireframes

**Conversation inline:**

```
│  Customer · 10:02 AM                         │
│  Payment deducted twice                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │ [thumb] │ │ [thumb] │ │  PDF    │       │
│  └─────────┘ └─────────┘ └─────────┘         │
```

**Context attachment hub (booking tickets — prominent):**

```
┌─────────────────────────────────────┐
│ ATTACHMENTS (6)          [ View all]│
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│ │ 💳 │ │ 📱 │ │ 📱 │ │ 💊 │        │
│ └────┘ └────┘ └────┘ └────┘        │
│ [ inline preview pane ]             │
│ Scan: ✓ Clean · Customer · 2h ago   │
└─────────────────────────────────────┘
```

---

### 11.6 Booking Ticket Attachment Purposes

| Value | Customer label | Admin badge |
|-------|----------------|-------------|
| `receipt` | Payment receipt | 💳 Receipt |
| `screenshot` | Screenshot | 📱 Screenshot |
| `prescription` | Prescription | 💊 Rx |
| `medical_report` | Medical report | 🏥 Medical |
| `other` | Attachment | 📎 File |

| Issue type | Prompted purposes |
|------------|-------------------|
| Refund / payment | Receipt, Screenshot |
| Service quality | Screenshot |
| Vet / medical | Prescription, Medical report |

**Admin:** List card shows 📎 count; refund rail shows receipt preview one-click.

---

### 11.7 Database Design

**New table: `support_ticket_attachments`**

```
support_ticket_attachments
├── id                 UUID PK
├── ticket_id          UUID NOT NULL → support_tickets(id) CASCADE
├── response_id        UUID NULL     → support_ticket_responses(id) CASCADE
│                      -- NULL = initial ticket create
├── s3_bucket          TEXT NOT NULL
├── s3_key             TEXT NOT NULL UNIQUE
├── original_filename  TEXT NOT NULL
├── mime_type          TEXT NOT NULL
├── file_size_bytes    BIGINT NOT NULL
├── uploader_type      TEXT NOT NULL  -- customer | agent | system
├── uploader_id        UUID NULL
├── visibility         TEXT NOT NULL  -- customer | internal
├── attachment_purpose TEXT NULL      -- receipt | screenshot | prescription | medical_report | other
├── scan_status        TEXT DEFAULT 'pending'  -- pending | clean | infected | skipped | failed
├── scan_metadata      JSONB NULL
├── upload_status      TEXT DEFAULT 'pending'  -- pending | uploaded | confirmed | failed | deleted
├── created_at         TIMESTAMPTZ NOT NULL
├── confirmed_at       TIMESTAMPTZ NULL
└── deleted_at         TIMESTAMPTZ NULL
```

**Indexes:** `ticket_id`, `response_id`, pending upload/scan (partial).

**Legacy:** Migrate from `support_tickets.metadata.attachments`; dual-read during transition; stop writing JSONB after P2.

**Optional on `support_ticket_responses`:** `has_attachments`, `attachment_count`.

---

### 11.8 S3 Folder Structure

**Bucket:** `warmpawz-{env}-support-attachments` (private, block public access)

**Key pattern:**

```
support/{environment}/tickets/{ticket_id}/{attachment_id}/original.{ext}
support/{environment}/tickets/{ticket_id}/{attachment_id}/thumb_256.webp  # optional async
```

**Example:**

```
s3://warmpawz-dev-support-attachments/support/dev/tickets/{ticket_id}/{attachment_id}/original.jpg
```

**Lifecycle:** Orphan `pending` > 24h cleanup; soft-deleted → S3 delete after 90d.

---

### 11.9 Metadata Model (API shape)

```json
{
  "id": "uuid",
  "ticketId": "uuid",
  "responseId": "uuid | null",
  "originalFilename": "payment_receipt.pdf",
  "mimeType": "application/pdf",
  "fileSizeBytes": 2048576,
  "uploaderType": "customer",
  "uploaderId": "uuid",
  "visibility": "customer",
  "attachmentPurpose": "receipt",
  "scanStatus": "clean",
  "uploadStatus": "confirmed",
  "createdAt": "ISO-8601",
  "downloadUrl": "short-lived when requested",
  "thumbnailUrl": "images only, short-lived"
}
```

---

### 11.10 Security Model

**Upload auth**

| Actor | Condition |
|-------|-----------|
| Customer | JWT; owns ticket; ticket not closed |
| Admin | JWT + `admin.support` |
| Anonymous | Denied |

**Presign validates:** MIME allowlist, size, count ≤ 5, ticket access.

**Download flow:**

```
GET /support/attachments/{id}/download-url
  → JWT + ticket permission
  → internal → admin only
  → infected → deny (admin quarantine message)
  → presigned GET (15 min TTL)
```

**IDOR prevention:** Resolve `ticket_id` from attachment; never expose raw `s3://` keys.

**MIME:** Client declare + S3 Content-Type on PUT + magic-byte sniff on confirm.

**Audit:** presign_requested, confirmed, downloaded, deleted.

---

### 11.11 API Workflow (Conceptual)

```
Step A  POST .../attachments/presign     → attachmentId, uploadUrl, expiresAt
Step B  Client PUT to S3
Step C  POST .../attachments/{id}/confirm → upload_status=confirmed

GET  .../tickets/{id}/attachments
GET  .../attachments/{id}/download-url
DELETE .../attachments/{id}  (admin soft-delete)
```

---

### 11.12 Virus Scanning (Future-Ready)

```
S3 confirm → EventBridge → scan_lambda → update scan_status
  clean    → download OK
  infected → quarantine prefix, block customer download
  pending  → UI "Scanning…" (V1: skipped in dev, pending in prod until scanner live)
```

---

### 11.13 Attachment Permission Matrix

| Action | Customer (own) | Admin | Vendor | Anonymous |
|--------|----------------|-------|--------|-----------|
| Presign upload | ✓ open ticket | ✓ | ✗ | ✗ |
| Confirm | ✓ | ✓ | ✗ | ✗ |
| List (customer visibility) | ✓ | ✓ | ✗ | ✗ |
| List internal | ✗ | ✓ | ✗ | ✗ |
| Download URL | ✓ | ✓ | ✗ | ✗ |
| Delete | ✗ | ✓ | ✗ | ✗ |

---

### 11.14 Attachment Rollout Phases

| Phase | Deliverables |
|-------|----------------|
| P0 | Table, presign/confirm/download, bucket, customer create+reply, admin inline view |
| P1 | Admin reply attach, internal visibility, context hub, booking purpose tags |
| P2 | Thumbnails, orphan cleanup, JSONB migration |
| P3 | Virus scan, quarantine UI |

---

## Appendix — Implementation Mapping (Reference)

| Area | Current location | V2 touches |
|------|------------------|------------|
| Admin CRM | `apps/admin-web/app/support/page.tsx` | Layout, lifecycle, notes, attachments |
| Admin settings | `apps/admin-web/app/support/settings/page.tsx` | SLA honesty, attachment config |
| Customer help | `apps/customer-web/components/customer/SupportHelpCenter.tsx` | Stepper, attach, booking flow |
| API | `backend/lambda/src/endpoints/supportCrm/endpoint/support-crm.ts` | Auth, SLA engine, attachment endpoints |
| DB | `db/migrations/` | `support_ticket_attachments`, lifecycle columns |

---

**Document owner:** Product / Support Operations  
**Path:** `docs/support-platform-v2-design.md`
