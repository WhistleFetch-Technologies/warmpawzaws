# 📊 VENDORS DATABASE REPORT

**Generated:** 2024-12-24  
**Total Vendors:** 3

---

## 📋 ALL VENDORS

| ID | Vendor ID | Phone | Business Name | Owner Name | Email | Role | Vendor Type | Service Category | Status | Approval Status | Service Styles (Mode) | Active | Created At |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `c0059522-b1ef-42fb-a656-2bad8f3402ff` | `vendor_9880826240:staff` | `9880826240:staff` | - | - | - | `service_provider` | - | - | `pending` | `pending` | `at_center`, `at_home`, `tele` | ✅ Yes | 2025-12-22 07:28:27 UTC |
| `3806e4b2-9af4-46de-8d20-d1748040bd9e` | `vendor_9876543216:status` | `9876543216:status` | - | - | - | `service_provider` | - | - | `pending` | `pending` | `at_center`, `at_home`, `tele` | ✅ Yes | 2025-12-22 07:28:23 UTC |
| `fcd64ed6-6a9a-4340-b44a-2d4a79536920` | `vendor_9876543216:staff` | `9876543216:staff` | - | - | - | `service_provider` | - | - | `pending` | `pending` | `at_center`, `at_home`, `tele` | ✅ Yes | 2025-12-22 07:28:23 UTC |

---

## 📊 SUMMARY STATISTICS

### By Role
- **service_provider:** 3 vendors (100%)

### By Status
- **pending:** 3 vendors (100%)

### By Approval Status
- **pending:** 3 vendors (100%)

### By Service Styles (Mode)
All vendors support:
- `at_center` - Service at vendor's center/facility
- `at_home` - Service at customer's home
- `tele` - Teleconsultation/remote service

### By Vendor Type
- **No vendor_type set:** 3 vendors (100%)

---

## ⚠️ OBSERVATIONS

1. **Missing Data:** All vendors have null values for:
   - `business_name`
   - `owner_name` (full_name)
   - `email`
   - `vendor_type`
   - `service_category`

2. **Phone Format:** Phone numbers include suffixes (`:staff`, `:status`) which suggests these might be test/development records.

3. **Role Format:** `role_id` is stored as string `"service_provider"` rather than UUID reference to `roles` table.

4. **Service Modes:** All vendors have the same service styles: `at_center`, `at_home`, `tele`.

---

## 🔍 DETAILED VENDOR INFORMATION

### Vendor 1
- **UUID:** `c0059522-b1ef-42fb-a656-2bad8f3402ff`
- **Vendor ID:** `vendor_9880826240:staff`
- **Phone:** `9880826240:staff`
- **Role:** `service_provider`
- **Service Modes:** `at_center`, `at_home`, `tele`
- **Status:** `pending` (approval pending)
- **Created:** 2025-12-22 07:28:27 UTC

### Vendor 2
- **UUID:** `3806e4b2-9af4-46de-8d20-d1748040bd9e`
- **Vendor ID:** `vendor_9876543216:status`
- **Phone:** `9876543216:status`
- **Role:** `service_provider`
- **Service Modes:** `at_center`, `at_home`, `tele`
- **Status:** `pending` (approval pending)
- **Created:** 2025-12-22 07:28:23 UTC

### Vendor 3
- **UUID:** `fcd64ed6-6a9a-4340-b44a-2d4a79536920`
- **Vendor ID:** `vendor_9876543216:staff`
- **Phone:** `9876543216:staff`
- **Role:** `service_provider`
- **Service Modes:** `at_center`, `at_home`, `tele`
- **Status:** `pending` (approval pending)
- **Created:** 2025-12-22 07:28:23 UTC

---

## 📝 NOTES

- **Service Styles (Mode):** This appears to be the "mode" field - indicating which service delivery methods the vendor supports.
- **Role:** Currently all vendors have role `service_provider` (stored as string, not UUID reference).
- **Data Quality:** Most vendor records appear to be incomplete or test data.

---

**Report Generated via SQL Query**  
**Database:** Supabase (vpvpbdwtyugbknrntkho)

