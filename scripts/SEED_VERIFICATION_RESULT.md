# Seed Verification Result

**Run date:** Systematic run completed (migrations 510, 511, 512 + RDS seed).

---

## 1. What was run

| Step | Action | Result |
|------|--------|--------|
| 1 | Migration `510_promotions_code_column.sql` | OK – `promotions.code` column added |
| 2 | Migration `511_scheduling_policies_table_only.sql` | OK – `scheduling_policies` table created |
| 3 | Migration `512_gst_rules_table_only.sql` | OK – `gst_rules` table created |
| 4 | Seed `booking_cancellation_rules` | OK – 1 platform default (48h full, 24h 50%, 6h cutoff) |
| 5 | Seed `cancellation_policies` | OK |
| 6 | Seed `scheduling_policies` | OK – 2 (Standard Buffer, Standard Slot Reservation) |
| 7 | Seed `gst_rules` | OK – 5 rules (18%/12% by service/category) |
| 8 | Seed `hsn_codes` | OK – 9 HSN codes (vet, food, medicines, accessories) |
| 9 | Seed `banners` | OK – 3 main banners (grooming, vet, shop) |
| 10 | Seed `spotlight_offers` | OK – 4 (vet, groomer, trainer, boarder) |
| 11 | Seed `promotions` | OK – 3 with codes GROOM50, VET100, SAVE20 |

---

## 2. Verification row counts (after seed)

| Table | Count | What to expect |
|-------|--------|----------------|
| `booking_cancellation_rules` | 1 | One platform default rule |
| `cancellation_policies` | 5 | At least 1 “Standard Cancellation” |
| `scheduling_policies` | 2 | Standard Buffer, Standard Slot Reservation |
| `gst_rules` | 10 | At least 5 (Standard 18%, At-Home, Tele, Medicines, Pet Food) |
| `hsn_codes` | 11 | At least 9 (998351, 998612, 2309, 0106, 3004, 4201, 6307, 3926, 9609) |
| `banners` | 9 | At least 3 type=main (grooming, vet, shop) |
| `spotlight_offers` | 16 | At least 4 (vet, groomer, trainer, boarder) |
| `promotions` | 5 | At least 3 with codes GROOM50, VET100, SAVE20 |

Counts may be higher if you ran the seed multiple times or had existing data; the important part is that each table has the expected seeded rows.

---

## 3. Where to verify in the UI

### Admin

| Area | What to check |
|------|----------------|
| **Finance > Cancellation / Refund** | Refund rules and cancellation policies listed; at least one “Standard Cancellation”. |
| **Finance > GST / Tax** | Tax rules and HSN codes listed; rules for 18%/12% and HSN for vet, food, medicines, accessories. |
| **Scheduling / Availability** | Scheduling policies include “Standard Buffer” and “Standard Slot Reservation”. |
| **Marketing > Banners** | At least 3 banners (type=main): e.g. 50% grooming, Free vet check, 20% shop. |
| **Marketing > Spotlights** | At least 4 spotlights (vet, groomer, trainer, boarder). |
| **Marketing > Promotions** | At least 3 promotions with codes GROOM50, VET100, SAVE20. |

### Customer

| Area | What to check |
|------|----------------|
| **Home** | Carousel shows banners (e.g. grooming, vet, shop). |
| **Service dashboards** | Spotlights / highlights visible per service (vet, grooming, etc.). |
| **Booking / Checkout** | Policies (cancellation/refund) shown; tax applied; promo codes GROOM50, VET100, SAVE20 work. |

---

## 4. API checks (optional)

- **Banners:** `GET /customer/banners?position=home_top` → returns banners (type=main).
- **Promotions:** `GET /promotions/list?service=grooming&published=true` → returns promotions.
- **Spotlights:** `GET /marketing/spotlights?active=true` → returns spotlight offers.
- **Policies:** `GET /config/policies?service_type=booking` → returns cancellation/refund/tax policy text.

---

## 5. Re-run seed

To re-run migrations + seed (safe; uses ON CONFLICT / “only if not exists” where applicable):

```bash
ENVIRONMENT=dev node scripts/run-seed-policies-tax-banners-rds.js
```

With a direct DB URL:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/warmpawz" node scripts/run-seed-policies-tax-banners-rds.js
```

---

**Result:** Migrations and seed completed successfully. Use the table and UI checks above to confirm in your environment.
