# Cancellation Policy Type – Configuration & Impact

**Location:** Admin → Finance and Logistics → Cancellation Policy

---

## Policy Type – What It Is

**Policy Type** controls **who** the policy applies to (all vendors vs. specific vendor roles or service delivery types). It does **not** change the refund rules themselves (those are defined by Grace Period and Cancellation Windows).

| Type | Meaning | When it applies |
|------|--------|------------------|
| **Standard** | Platform-wide default | Applies to **all** vendors and services. Use for a single “default” cancellation rule (e.g. 100% refund if cancelled 24h+ before). |
| **Vendor Specific** | By vendor role | Applies only when the **vendor’s role** is in the selected **Vendor Types** (e.g. Veterinarian, Groomer, Tele). Use for different rules per role (e.g. stricter for vets, looser for walkers). |
| **Service Specific** | By how service is delivered | Applies only when the **service delivery type** is in the selected **Service Types** (At Home, At Center, Video Consultation, Delivery, Pickup). Use for different rules by channel (e.g. different rules for Video Consultation vs At Home). |

---

## How to Configure

1. **Admin → Finance and Logistics → Cancellation Policy → Create Policy** (or edit existing).
2. **Policy Type**
   - **Standard:** Leave Vendor Types and Service Types empty (or ignore). Policy applies to everyone.
   - **Vendor Specific:** Choose **Policy Type = Vendor Specific**, then select the **Vendor Types** (roles) this policy should apply to. Vendor Types are loaded dynamically from platform roles (e.g. Veterinarian, Groomer, Tele / Video Consultation).
   - **Service Specific:** Choose **Policy Type = Service Specific**, then select the **Service Types** (At Home, At Center, Video Consultation, Delivery, Pickup) this policy should apply to.
3. **Grace Period (hours)** – Minimum hours before the booking that count as “in time” (e.g. 2 = no penalty if cancelled at least 2 hours before).
4. **Cancellation Windows** – Refund % and fees by time (e.g. 48h → 100%, 24h → 75%, 0h → 0%). *(Defined in the policy’s cancellation windows; backend uses first window’s penalty for fee.)*
5. **Priority** – When multiple policies could match (e.g. one Standard and one Vendor Specific), the one with **higher priority** wins. Set Standard to 0 and more specific policies to 1+.
6. **Active** – Only active policies are used when resolving which policy applies.

---

## How It Impacts When a Cancellation Happens

1. **Customer (or vendor) cancels a booking**  
   The system needs to decide: **which cancellation policy applies** and thus **refund % and any fee**.

2. **Resolving the policy**
   - Load **active** cancellation policies, ordered by **priority** (higher first).
   - **Standard** policies apply to every booking.
   - **Vendor Specific** policies apply only if the vendor’s **role** is in that policy’s `vendor_types`.
   - **Service Specific** policies apply only if the booking’s **service delivery type** (e.g. at_home, video_consultation) is in that policy’s `service_types`.
   - The **first matching** policy (by priority) is used.

3. **Refund calculation**
   - **Grace Period** and **Cancellation Windows** from the chosen policy are used (e.g. hours before booking → refund %, cancellation fee).
   - Existing cancellation/refund logic (e.g. in `bookings-enhanced`, `refund-policy-engine`, `vendor-policies`) uses platform cancellation policies where integrated; extending that logic to filter by `policy_type`, `vendor_types`, and `service_types` makes the admin configuration fully effective at cancel time.

---

## Summary

- **Standard** = one default rule for all.
- **Vendor Specific** = different rules per vendor **role** (Vendor Types are loaded dynamically from `/config/roles` and `/admin/roles`).
- **Service Specific** = different rules per **delivery type** (At Home, At Center, Video Consultation, etc.).
- **Priority** and **Active** decide which policy wins when more than one could apply.

After adding the migration `530_cancellation_policies_policy_type_vendor_service.sql`, the backend persists and returns `policy_type`, `vendor_types`, and `service_types`, so the admin UI and any resolution logic can use them consistently.
