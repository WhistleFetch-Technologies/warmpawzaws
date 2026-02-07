# Rule Engine for Service Discovery & Operations – Proposal

**Purpose:** Replace hardcoded business logic (radius, limits, sort, delivery caps) with a configurable **Rule Book** so you can change discovery, hyperlocal, and order rules per role without code changes.

**Date:** 2026-01-28

---

## 1. Current State (Research Summary)

### 1.1 Where Logic Is Hardcoded Today

| Area | Location | Current Hardcoding | Role/Flow |
|------|----------|--------------------|-----------|
| **Meal plans search** | `meal-plans.ts` | `maxRadius = 10` when lat/lng; ETA `15 + distanceKm * 3` | Nutritionist / meal discovery |
| **Meal plans (vendor)** | `specialized-services.ts` | `maxRadius = 10` | Vendor nutrition meal-plans |
| **Discover services** | `service-discovery.ts` | `radius = 50` km; `LIMIT 50`; no radius filter for at_home/tele | All roles (walker, vet, grooming, etc.) |
| **Vendors search** | `service-discovery.ts` | `radius = 10` (radar); `maxDistance` from query only; `sortBy` relevance/distance/rating/price | Discovery by style |
| **Pharmacy broadcast** | `pharmacy-orders.ts` | Start 5 km → expand 10 → 20 km; `current_broadcast_radius_km`, `max_broadcast_radius` | Pharmacy |
| **Pharmacy nearby** | `pharmacy-orders.ts` | `radiusKm = 5` (query default); bounding box then Haversine | Pharmacy order creation |
| **Staff / at_home** | `staff.ts` | Radius from `staff_services.radius_km` per service; no platform default | At-home booking |
| **Vendor live status** | `vendor-live-status.ts` | `maxDistance` from query; filter `v.distance <= maxDistance` | Live listing |
| **Logistics / delivery** | `logistics_rules` | `min_distance_km`, `max_distance_km`, `base_fee`, `per_km_rate`, `applies_to` (pharmacy, meal) | Delivery fee & eligibility |
| **Admin / finance** | `admin_settings` | `platform_fee_percentage`, `convenience_fee`, `max_platform_fee` by `service_type` | Meals, pharmacy, etc. |
| **Follow-up eligibility** | `customer-booking-history.ts`, `BookingDetailModal` | Completed bookings within **7 days** for follow-up CTA / follow-up-eligible API | Vet, all appointment roles |
| **Chat window post-appointment** | `chat.ts`, `vendor-bookings.ts` | Chat available for **7 days** after completion; cancelled = no chat | All roles with chat |
| **Review eligibility** | `reviews.ts`, `customer-enhanced.ts` | Completed bookings without review from last **7 days** | All roles |
| **Booking minimum notice** | `bookings.ts`, `bookings-enhanced.ts` | **MIN_NOTICE_HOURS = 1** (booking must be ≥1 hour in future) | All bookings |
| **Cancellation cutoff** | `refund-policy-engine.ts`, admin | **cancellation_cutoff_hours** (e.g. 12) for refund tiers | Refunds |
| **Appointment reminder** | `appointment-reminders.ts`, `scheduled-notification-processor` | **5 minutes** before (video/tele); chat auto-activated 5 min before tele | Tele / video |
| **Video call grace** | `video-call-enhanced.ts` | Join **5 minutes** before scheduled time | Tele |

### 1.2 Roles and Service Catalog

- **Roles** (from `roles` table + `service_catalog.applicable_roles`): vet, vet_clinic, vet_solo, groomer, groomer_center, groomer_solo, trainer, walker, pet_walker, nutritionist, pet_nutritionist, behaviourist, sitter, boarding, diagnostics, ambulance, pharmacy, insurance, resort, breeder, seller, adoption, event_organizer, photographer, relocation, cafe, etc. (~25+ role names).
- **Discovery entry points:**  
  - `GET /customer/discover-services` (category, roleId, serviceStyle, latitude, longitude, radius, sortBy, maxDistance, minRating)  
  - `GET /meal-plans/search` (lat, lng, maxRadius, purpose, mealType)  
  - `GET /service-discovery/vendors` (lat, lng, radius_km, serviceType)  
  - `GET /customer/radar/providers` (radius default 10 km)  
  - Pharmacy: broadcast radii 5 → 10 → 20 km; `radiusKm` for “pharmacies near me”.

### 1.3 Existing Config Tables

- **`logistics_rules`:** rule_name, rule_type, rule_config (JSONB), min_distance_km, max_distance_km, base_fee, per_km_rate, applies_to (array: pharmacy, meal_delivery), is_active. Used for delivery **fees** and partner selection, not discovery.
- **`admin_settings`:** setting_key, setting_value, service_type. Used for platform fee, convenience fee, etc., not discovery radius/limits.

There is **no** central place today to configure “list walkers in X km”, “max Y results for nutritionist”, “meal order max distance”, “pharmacy initial broadcast radius”, etc., per role or per flow.

---

## 2. Proposed: Discovery & Operations Rule Engine

### 2.1 Idea

- Introduce a **rule book** of **discovery_rules** (and optionally extend **logistics_rules** / a new **operation_rules** table) that are:
  - **Keyed by role (and optionally service type / flow)** so each of the ~25 roles can have its own defaults.
  - **Consumed by** discovery APIs, meal search, pharmacy broadcast, and delivery eligibility so behaviour is driven by config, not literals in code.

You then:
- **Configure** (e.g. in Admin UI): “For role **walker**, discovery radius = 10 km, max listing = 20, sort = nearest; use customer mobile location.”
- **Configure**: “For role **nutritionist** (meal plans), max radius = 10 km, max listing = 50; hyperlocal delivery.”
- **Configure**: “For **pharmacy**, initial broadcast radius = 5 km, steps = [5, 10, 20] km.”
- **Configure**: “Meal orders: max accept distance = 15 km from vendor.”
- **Change** any of these anytime without code deploy.

### 2.2 Rule Types to Support

| Rule type | Purpose | Example config | Used by |
|-----------|---------|----------------|---------|
| **discovery_radius_km** | Max distance (km) for listing providers/plans | 10, 15, 20 | Meal search, vendor discovery, radar |
| **discovery_max_results** | Cap on number of results returned | 20, 50, 100 | Discover services, meal-plans, vendors |
| **discovery_sort_default** | Default sort when location present | `nearest` \| `relevance` \| `rating` \| `price` | Discover, vendors search |
| **discovery_location_source** | Which location to use when available | `mobile` \| `base_address` \| `mobile_then_base` | Discovery (walker, at_home, etc.) |
| **hyperlocal_max_distance_km** | Max distance for “hyperlocal” delivery/order accept | 10, 15 | Meal orders, pharmacy (optional) |
| **order_accept_max_distance_km** | Vendor will not see order beyond this distance | 15 | Meal / pharmacy broadcast |
| **broadcast_radius_km_initial** | First broadcast radius (pharmacy) | 5 | Pharmacy |
| **broadcast_radius_km_steps** | Expansion steps (pharmacy) | [5, 10, 20] | Pharmacy |
| **delivery_fee_rule** | Already in logistics_rules; link by applies_to + role | — | Meals, pharmacy |
| **platform_fee_rule** | Already in admin_settings; can be referenced by role | — | All paid flows |

**Appointment & post-appointment (conversation / follow-up)**

| Rule type | Purpose | Example config | Used by |
|-----------|---------|----------------|---------|
| **follow_up_days** | Days after completion during which customer can book follow-up / see “Follow-up” CTA | 7, 14 | Follow-up eligible API, BookingDetailModal, FollowUpModal |
| **chat_available_days_post_appointment** | Days chat window stays open after appointment completion (conversation post appointment) | 7, 14 | chat.ts, vendor-bookings.ts (chatEnabled), VendorChatModal, CommunicationHub |
| **chat_available_before_appointment_minutes** | Minutes before scheduled time when chat is auto-activated (e.g. for tele) | 5 | appointment-reminders.ts (chat_activated_at), CheckChatActivation |
| **review_eligible_days** | Days after completion during which customer is shown review prompt | 7 | reviews, customer-enhanced (pending reviews) |
| **booking_min_notice_hours** | Minimum hours in future for booking slot | 1 | bookings.ts, bookings-enhanced.ts |
| **cancellation_cutoff_hours** | Hours before booking; used for refund tiers (can stay in refund_rules; reference from rule book) | 12 | refund-policy-engine |
| **appointment_reminder_minutes_before** | Send reminder N minutes before appointment | 5 | appointment-reminders, scheduled-notification-processor |
| **video_call_grace_period_minutes** | Allow join N minutes before scheduled video call | 5 | video-call-enhanced |

Not all roles need every key; e.g. walker uses discovery_* and optionally order_accept_*, pharmacy uses broadcast_* and delivery_*, appointment-based roles (vet, groomer, trainer, etc.) use follow_up_days and chat_available_days_post_appointment.

### 2.3 Data Model (Suggested)

**Option A – Single table: `discovery_rules` (or `service_rules`)**

```sql
CREATE TABLE discovery_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id TEXT NOT NULL,                    -- e.g. 'walker', 'pet_nutritionist', 'pharmacy'
  rule_key TEXT NOT NULL,                  -- e.g. 'discovery_radius_km', 'discovery_max_results'
  rule_value JSONB NOT NULL,               -- e.g. {"value": 10} or {"value": "nearest", "unit": "km"}
  applies_to_flow TEXT,                    -- optional: 'discover', 'meal_search', 'pharmacy_broadcast', 'booking'
  city TEXT,                               -- optional: scope by city
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, rule_key, COALESCE(applies_to_flow, ''), COALESCE(city, ''))
);

CREATE INDEX idx_discovery_rules_role ON discovery_rules(role_id);
CREATE INDEX idx_discovery_rules_key ON discovery_rules(rule_key);
CREATE INDEX idx_discovery_rules_active ON discovery_rules(is_active) WHERE is_active = true;
```

**Option B – Key–value per role (simpler)**

```sql
CREATE TABLE discovery_rule_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id TEXT NOT NULL,
  config_key TEXT NOT NULL,    -- discovery_radius_km, discovery_max_results, ...
  config_value TEXT NOT NULL,  -- "10", "50", "nearest"
  config_type TEXT DEFAULT 'number',  -- number | string | json
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, config_key)
);
```

Recommendation: **Option A** with `rule_value` as JSONB so you can store numbers, strings, or arrays (e.g. broadcast steps) and add metadata (unit, label) without schema change.

### 2.4 Default Rule Set (By Role)

Suggested defaults so every role has a clear default until you override:

| role_id | discovery_radius_km | discovery_max_results | discovery_sort_default | discovery_location_source | hyperlocal_max_distance_km | notes |
|---------|---------------------|------------------------|------------------------|---------------------------|----------------------------|-------|
| walker | 10 | 20 | nearest | mobile | — | List walkers within 10 km, nearest first |
| pet_nutritionist | 10 | 50 | nearest | mobile | 10 | Meal plans hyperlocal |
| veterinarian / vet_clinic | 25 | 50 | relevance | mobile_then_base | — | Wider for clinics |
| groomer | 15 | 30 | nearest | mobile | — | |
| trainer | 15 | 30 | nearest | mobile | — | |
| pharmacy | — | — | — | — | — | Uses broadcast_radius_km_initial + steps |
| (pharmacy flow) | — | — | — | — | — | broadcast_radius_km_initial: 5, steps: [5,10,20] |
| meal / nutritionist (order) | — | — | — | — | 10 | order_accept_max_distance_km: 10 |

**Appointment / post-appointment defaults (apply by role or globally)**

| rule_key | Default | Scope | Notes |
|----------|---------|-------|-------|
| follow_up_days | 7 | per role or `all` | Vet, groomer, trainer, etc.: “Follow-up care within 7 days” |
| chat_available_days_post_appointment | 7 | per role or `all` | Chat window for conversation post appointment |
| chat_available_before_appointment_minutes | 5 | per role or `all` | Tele: activate chat 5 min before call |
| review_eligible_days | 7 | per role or `all` | Show review prompt for completed in last 7 days |
| booking_min_notice_hours | 1 | per role or `all` | Book at least 1 hour ahead |
| appointment_reminder_minutes_before | 5 | per role or `all` | Reminder 5 min before |
| video_call_grace_period_minutes | 5 | per role or `all` | Join 5 min early |

You can add rows for every role and only override where needed.

### 2.5 How It Helps You Control Behaviour

- **Distance:** Change “list walkers in 10 km” to 15 km by updating one row (role_id=walker, rule_key=discovery_radius_km); no code change.
- **Listing cap:** Change “max 50 meal plans” to 30 by updating discovery_max_results for pet_nutritionist.
- **Sort:** “Nearest first” vs “Rating first” per role via discovery_sort_default.
- **Location:** “Use mobile GPS” vs “use saved base address” via discovery_location_source (mobile / base_address / mobile_then_base).
- **Hyperlocal / meals:** “Meal orders only within 10 km” → one config (hyperlocal_max_distance_km or order_accept_max_distance_km for nutritionist).
- **Pharmacy:** Initial radius 5 km and expansion steps [5,10,20] in rule book; code reads from rule engine instead of constants.
- **All 25 roles:** Same table; each role can have its own discovery_radius_km, discovery_max_results, sort, and flow-specific keys (broadcast steps, max accept distance).
- **Follow-up & chat:** “Follow-up care for 7 days” and “Chat available 7 days after appointment” become configurable per role (e.g. vet 14 days, groomer 7 days) via follow_up_days and chat_available_days_post_appointment. Chat window availability for conversation post appointment is no longer hardcoded.
- **Reminders & grace:** Reminder timing and “chat open N minutes before tele” are configurable (appointment_reminder_minutes_before, chat_available_before_appointment_minutes, video_call_grace_period_minutes).

---

## 3. API and Code Integration

### 3.1 Rule Engine API (Backend)

- **GET /admin/discovery-rules**  
  Query params: roleId, ruleKey, flow. Returns list of rules (for Admin UI).
- **GET /config/discovery-rules** (or internal helper, no public URL)  
  Input: roleId, flow (e.g. discover, meal_search, pharmacy_broadcast). Returns merged key–value map (e.g. discovery_radius_km, discovery_max_results, …) with platform defaults + role overrides. Used by discovery and order flows.
- **PUT/POST /admin/discovery-rules**  
  Create/update a rule (role_id, rule_key, rule_value, applies_to_flow, city).
- **DELETE /admin/discovery-rules/:id**  
  Soft-delete or deactivate.

Implement a small **rule engine service** in Lambda:

- `getDiscoveryRules(roleId: string, flow?: string): Promise<DiscoveryRuleSet>`
- Resolves: default platform defaults + role-specific rows from `discovery_rules` (and optionally logistics_rules for delivery fee).
- Returns one object, e.g.  
  `{ discovery_radius_km: 10, discovery_max_results: 20, discovery_sort_default: 'nearest', discovery_location_source: 'mobile' }`.

### 3.2 Where to Use It in Code

1. **Meal plans search** (`meal-plans.ts`):  
   Replace `maxRadius = maxRadiusRaw ? parseFloat(maxRadiusRaw) : (lat && lng ? 10 : 0)` with:  
   `maxRadius = maxRadiusRaw ? parseFloat(maxRadiusRaw) : (await getDiscoveryRules('pet_nutritionist', 'meal_search')).discovery_radius_km ?? 10`.
2. **Discover services** (`service-discovery.ts`):  
   For category/roleId, call `getDiscoveryRules(roleId, 'discover')`; use discovery_radius_km for filtering when lat/lng present, discovery_max_results for LIMIT, discovery_sort_default for sort.
3. **Vendor/nutrition meal-plans** (`specialized-services.ts`):  
   Same as meal-plans: maxRadius from rule for role pet_nutritionist / nutritionist.
4. **Pharmacy broadcast** (`pharmacy-orders.ts`):  
   Read broadcast_radius_km_initial and broadcast_radius_km_steps from rules for role pharmacy (or flow pharmacy_broadcast); replace 5, 10, 20 constants.
5. **Radar/providers** (`service-discovery.ts`):  
   radius from rule by role or default 10.
6. **Staff at_home** (`staff.ts`):  
   Platform default radius from rule when staff_services.radius_km is null; else keep per-service radius.
7. **Vendor live status** (`vendor-live-status.ts`):  
   maxDistance default from rule by role.
8. **Meal order create** (optional):  
   Reject if distance > hyperlocal_max_distance_km from rules for nutritionist.
9. **Follow-up eligible** (`customer-booking-history.ts`, BookingDetailModal):  
   Use follow_up_days from rules (by vendor role) instead of hardcoded 7; `completed_at >= NOW() - INTERVAL 'N days'`.
10. **Chat availability** (`chat.ts`, `vendor-bookings.ts`):  
    Use chat_available_days_post_appointment from rules (by vendor role) instead of `daysSinceCompletion <= 7`.
11. **Review eligibility** (reviews, customer-enhanced):  
    Use review_eligible_days from rules instead of “last 7 days”.
12. **Booking min notice** (bookings, bookings-enhanced):  
    Use booking_min_notice_hours from rules instead of MIN_NOTICE_HOURS = 1.
13. **Appointment reminders** (appointment-reminders, scheduled-notification-processor):  
    Use appointment_reminder_minutes_before and chat_available_before_appointment_minutes from rules.
14. **Video call join** (video-call-enhanced):  
    Use video_call_grace_period_minutes from rules instead of 5.

All “magic numbers” (10, 50, 5, 10, 20, 7 days, 1 hour, etc.) become config-driven per role/flow.

---

## 4. Admin UI: “Rule Book”

### 4.1 Screens

- **Rule Book / Discovery Rules** (under Platform Settings or a new “Rules” section):
  - **List view:** Filters by Role, Rule key, Flow. Table: Role | Rule key | Value | Flow | City | Active.
  - **Edit/Create:** Dropdown Role (all 25 roles), Dropdown Rule key:
    - **Discovery:** discovery_radius_km, discovery_max_results, discovery_sort_default, discovery_location_source, hyperlocal_max_distance_km, order_accept_max_distance_km, broadcast_radius_km_initial, broadcast_radius_km_steps.
    - **Appointment / post-appointment:** follow_up_days, chat_available_days_post_appointment, chat_available_before_appointment_minutes, review_eligible_days, booking_min_notice_hours, appointment_reminder_minutes_before, video_call_grace_period_minutes (cancellation_cutoff_hours can stay in refund policy UI and be referenced).
    Value (number / string / JSON for steps), optional Flow, optional City.
  - **Bulk defaults:** “Apply default rule set for all roles” to seed the table from the suggested default table above.

### 4.2 Labelling and UX

- **Role** = Service provider type (Walker, Nutritionist, Vet, Groomer, Pharmacy, …).
- **Rule key** = Human labels, e.g. “Discovery radius (km)”, “Max listing count”, “Default sort”, “Location source”, “Hyperlocal max distance (km)”, “Pharmacy initial broadcast radius (km)”, “Pharmacy radius expansion steps”, “Follow-up days”, “Chat available days (post appointment)”, “Chat available before appointment (min)”, “Review eligible days”, “Booking min notice (hours)”, “Appointment reminder (min before)”, “Video call grace period (min)”.
- Help text per key: e.g. “List providers within this distance from customer.”; “Days after appointment completion when customer can book follow-up and see Follow-up CTA.”; “Days after completion the chat window stays open for conversation post appointment.”; “Minutes before scheduled time when chat is auto-activated (e.g. for tele).”

This gives you a single place to change “list walkers in 10 km”, “meal plans within 10 km”, “pharmacy start at 5 km then 10, 20”, “max 20 results for walker”, “sort by nearest”, **“follow-up care for 7 days”**, **“chat window 7 days post appointment”**, **“reminder 5 min before”**, etc., for every role.

---

## 5. Scope Summary

| What | Description |
|------|-------------|
| **New table** | `discovery_rules` (or `service_rules`) with role_id, rule_key, rule_value (JSONB), optional applies_to_flow, city. |
| **New API** | GET/PUT/POST/DELETE admin discovery-rules; internal getDiscoveryRules(roleId, flow). |
| **Code changes** | Meal-plans search, discover-services, vendor meal-plans, pharmacy broadcast, radar, staff at_home, vendor-live-status: read from rule engine with fallback to current defaults. |
| **Admin UI** | Rule Book: list/filter by role and key, edit/create/delete rules, optional “reset to defaults” per role. |
| **Coverage** | All ~25 roles; configurable items: discovery radius, max listing, sort, location source, hyperlocal/order max distance, pharmacy broadcast radii; **follow-up days**, **chat window availability (days post appointment, minutes before appointment)**, review eligible days, booking min notice, reminder/grace timing. |

---

## 6. Benefits

- **Flexible:** Change radius, limits, sort, and delivery caps per role without deployments.
- **Consistent:** One rule book for discovery and hyperlocal behaviour across walker, nutritionist, vet, pharmacy, etc.
- **Auditable:** Stored in DB; you can track who changed what and when if you add audit fields.
- **Extensible:** New rule_key (e.g. min_rating, max_price) can be added and wired to discovery/filters later.
- **Clear ownership:** Business/ops can own “list walkers in 10 km” and “meal orders max 10 km” in the Rule Book instead of relying on code.

---

## 7. Additional Rules Considered (Nothing Critical Missing)

- **Prescription follow-up date:** Per-prescription `follow_up_date` is **data** (doctor sets it per prescription), not a platform rule. Optional rule: “default_follow_up_reminder_days” (e.g. remind customer X days before prescription’s follow_up_date) can be added later if needed.
- **Settlement hold days:** Currently “7 days” in copy; could be a rule (e.g. `settlement_hold_days`) if you want it configurable.
- **Presigned URL / token expiry:** Various “7 days” for presigned URLs; usually keep as code unless you need per-environment expiry.
- **Refund tiers:** Already in refund_rules / admin (cancellation_cutoff_hours, percentages); Rule Book can **reference** the same keys so one place lists “all configurable keys” including cancellation.

---

## 8. Implementation Runbook

- **Migration:** Run `db/migrations/090_discovery_rules.sql` on RDS.
  - With `DATABASE_URL`: `DATABASE_URL=postgresql://... ./scripts/run-migration-090-discovery-rules.sh`
  - With AWS RDS: `ENVIRONMENT=dev node scripts/run-migration-rds-node.js 090_discovery_rules.sql`
- **Admin Rule Book:** Admin Web → Platform Settings → **Rule Book** tab. List/filter by Role and Rule key; Add/Edit/Deactivate rules. API: `GET/POST/PUT/DELETE /admin/discovery-rules`, `GET /admin/discovery-rules/keys`.
- **Verification:** `API_URL=https://your-api... ./scripts/verify-rule-engine.sh` (optional: `ADMIN_TOKEN=...` for list).
- **Where rules apply:** Meal search, discover-services, radar, pharmacy broadcast, chat/follow-up/review days, booking min notice, appointment reminder, video grace. No code deploy needed to change values—edit in Rule Book.
