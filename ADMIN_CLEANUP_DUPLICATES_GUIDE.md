# 🧹 Admin Cleanup - Duplicate Detection & Removal Guide

**Date:** Created  
**Purpose:** Clean up duplicate promotions and coupons from the system  
**Status:** ✅ Ready for Use

---

## 📋 Overview

This guide explains how to use the admin cleanup endpoints to find and remove duplicate promotions and coupons from the system. The cleanup process is designed to be safe with a dry-run mode that allows you to preview changes before making them permanent.

---

## 🔍 How Duplicates Are Detected

### Promotions
Duplicates are identified by matching:
- **Name** (case-insensitive)
- **Type** (percentage, fixed, etc.)
- **Value** (discount amount/percentage)

Example: Two promotions with name "20% OFF Grooming", type "percentage", value 20 are considered duplicates.

### Coupons
Duplicates are identified by matching:
- **Code** (case-insensitive)

Example: Two coupons with code "GROOM50" are considered duplicates.

---

## 🛠️ API Endpoints

### 1. Find Duplicates (Safe - Read Only)

**Endpoint:** `POST /admin/cleanup/find-duplicates`

**Description:** Scans all promotions and coupons to identify duplicate groups. This is a read-only operation that doesn't modify any data.

**Request:**
```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/marketing/admin/cleanup/find-duplicates" \
  -H "apikey: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

**Note:** The cleanup endpoints are registered under `/marketing` path, so the full path is `/make-server-3dd53475/marketing/admin/cleanup/...`

**Response:**
```json
{
  "success": true,
  "promotions": {
    "total": 50,
    "duplicates": 3,
    "duplicateGroups": [
      {
        "key": "20% off grooming_percentage_20",
        "count": 2,
        "items": [
          {
            "id": "promo_123",
            "name": "20% OFF Grooming",
            "type": "percentage",
            "value": 20,
            "createdAt": "2024-01-01T00:00:00Z",
            "usageCount": 10
          },
          {
            "id": "promo_456",
            "name": "20% OFF Grooming",
            "type": "percentage",
            "value": 20,
            "createdAt": "2024-01-02T00:00:00Z",
            "usageCount": 5
          }
        ]
      }
    ],
    "totalDuplicateItems": 6
  },
  "coupons": {
    "total": 100,
    "duplicates": 2,
    "duplicateGroups": [
      {
        "code": "groom50",
        "count": 3,
        "items": [
          {
            "id": "coupon_789",
            "code": "GROOM50",
            "type": "percentage",
            "value": 20,
            "createdAt": "2024-01-01T00:00:00Z",
            "usageCount": 15
          },
          {
            "id": "coupon_101",
            "code": "GROOM50",
            "type": "percentage",
            "value": 20,
            "createdAt": "2024-01-02T00:00:00Z",
            "usageCount": 8
          },
          {
            "id": "coupon_102",
            "code": "GROOM50",
            "type": "percentage",
            "value": 20,
            "createdAt": "2024-01-03T00:00:00Z",
            "usageCount": 2
          }
        ]
      }
    ],
    "totalDuplicateItems": 5
  },
  "summary": {
    "totalPromotions": 50,
    "totalCoupons": 100,
    "duplicatePromotionGroups": 3,
    "duplicateCouponGroups": 2,
    "totalItemsToRemove": 8
  }
}
```

---

### 2. Remove Duplicates (Dry-Run Mode)

**Endpoint:** `POST /admin/cleanup/remove-duplicates`

**Description:** Simulates the removal of duplicates without actually deleting anything. Use this to preview what would be removed.

**Request:**
```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/marketing/admin/cleanup/remove-duplicates" \
  -H "apikey: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": true
  }'
```

**Response:**
```json
{
  "success": true,
  "dryRun": true,
  "message": "Dry run completed - no changes made",
  "wouldRemove": {
    "promotions": {
      "count": 3,
      "items": [
        {
          "id": "promo_456",
          "name": "20% OFF Grooming",
          "reason": "Duplicate of promo_123 (kept: usageCount=10, removed: usageCount=5)"
        }
      ]
    },
    "coupons": {
      "count": 2,
      "items": [
        {
          "id": "coupon_101",
          "code": "GROOM50",
          "reason": "Duplicate of coupon_789 (kept: usageCount=15, removed: usageCount=8)"
        },
        {
          "id": "coupon_102",
          "code": "GROOM50",
          "reason": "Duplicate of coupon_789 (kept: usageCount=15, removed: usageCount=2)"
        }
      ]
    }
  },
  "wouldKeep": {
    "promotions": 47,
    "coupons": 98
  },
  "summary": {
    "totalPromotionsRemoved": 3,
    "totalCouponsRemoved": 2,
    "totalItemsRemoved": 5
  }
}
```

---

### 3. Remove Duplicates (Actual Removal)

**Endpoint:** `POST /admin/cleanup/remove-duplicates`

**Description:** Permanently removes duplicate items. **Use with caution!** Always run dry-run mode first to preview changes.

**Request:**
```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/marketing/admin/cleanup/remove-duplicates" \
  -H "apikey: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dryRun": false
  }'
```

**Response:**
```json
{
  "success": true,
  "dryRun": false,
  "message": "Duplicates removed successfully",
  "removed": {
    "promotions": {
      "count": 3,
      "items": [
        {
          "id": "promo_456",
          "name": "20% OFF Grooming",
          "reason": "Duplicate of promo_123 (kept: usageCount=10, removed: usageCount=5)"
        }
      ]
    },
    "coupons": {
      "count": 2,
      "items": [
        {
          "id": "coupon_101",
          "code": "GROOM50",
          "reason": "Duplicate of coupon_789 (kept: usageCount=15, removed: usageCount=8)"
        },
        {
          "id": "coupon_102",
          "code": "GROOM50",
          "reason": "Duplicate of coupon_789 (kept: usageCount=15, removed: usageCount=2)"
        }
      ]
    }
  },
  "kept": {
    "promotions": 47,
    "coupons": 98
  },
  "summary": {
    "totalPromotionsRemoved": 3,
    "totalCouponsRemoved": 2,
    "totalItemsRemoved": 5
  }
}
```

---

## 🎯 Removal Logic

When duplicates are found, the system keeps the **best** item based on:

1. **Highest usage count** - Items with more usage are kept
2. **Oldest creation date** - If usage counts are equal, the oldest item is kept

All other duplicates are removed.

**Example:**
- Promotion A: usageCount=10, createdAt=2024-01-01
- Promotion B: usageCount=5, createdAt=2024-01-02
- **Result:** Promotion A is kept, Promotion B is removed

---

## 📝 Step-by-Step Workflow

### Step 1: Find All Duplicates (Safe)

```bash
./test-cleanup-duplicates.sh
# Or manually:
curl -X POST "${BASE_URL}/marketing/admin/cleanup/find-duplicates" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json"
```

**Review the results:**
- Check how many duplicate groups exist
- Review which items would be affected
- Verify the duplicate detection is correct

---

### Step 2: Test Removal in Dry-Run Mode (Safe)

```bash
curl -X POST "${BASE_URL}/marketing/admin/cleanup/remove-duplicates" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Review the dry-run results:**
- Check which items would be removed
- Verify the removal logic (keeps best items)
- Ensure no important data would be lost

---

### Step 3: Actually Remove Duplicates (After Review)

**⚠️ WARNING: This permanently deletes data!**

```bash
curl -X POST "${BASE_URL}/marketing/admin/cleanup/remove-duplicates" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

**After removal:**
- Verify the duplicates are gone
- Check that remaining items are correct
- Confirm system functionality is intact

---

## 🧪 Testing

Use the provided test script:

```bash
./test-cleanup-duplicates.sh
```

The script will:
1. ✅ Find duplicates (read-only)
2. ✅ Test dry-run mode (safe preview)
3. ⚠️ Ask for confirmation before actual removal

---

## ⚠️ Important Notes

1. **Always run dry-run first** - Preview changes before making them permanent
2. **Backup data** - Consider backing up your data before running actual removal
3. **Review duplicates carefully** - Some "duplicates" might be intentional
4. **Test in staging** - Test the cleanup process in a staging environment first
5. **Monitor after cleanup** - Verify system functionality after removal

---

## 🔍 Example Use Cases

### Use Case 1: Clean Up After Bulk Import

After bulk importing promotions or coupons, you might have accidentally created duplicates:

```bash
# Step 1: Find duplicates
POST /admin/cleanup/find-duplicates

# Step 2: Preview removal
POST /admin/cleanup/remove-duplicates {"dryRun": true}

# Step 3: Remove duplicates
POST /admin/cleanup/remove-duplicates {"dryRun": false}
```

### Use Case 2: Regular Maintenance

Run cleanup periodically to keep the system clean:

```bash
# Monthly cleanup
POST /admin/cleanup/find-duplicates
# Review results
POST /admin/cleanup/remove-duplicates {"dryRun": true}
# If satisfied, remove
POST /admin/cleanup/remove-duplicates {"dryRun": false}
```

---

## 📊 Response Fields Explained

### Find Duplicates Response

- `promotions.total` - Total number of promotions
- `promotions.duplicates` - Number of duplicate groups found
- `promotions.duplicateGroups` - Array of duplicate groups with details
- `promotions.totalDuplicateItems` - Total items in duplicate groups
- `coupons.*` - Same structure for coupons
- `summary.totalItemsToRemove` - Total items that would be removed

### Remove Duplicates Response

- `dryRun` - Whether this was a dry-run (true) or actual removal (false)
- `wouldRemove` / `removed` - Items that would be/were removed
- `wouldKeep` / `kept` - Count of items that would be/were kept
- `summary` - Summary statistics

---

## ✅ Checklist

Before running actual removal:

- [ ] Run `find-duplicates` to see what exists
- [ ] Run `remove-duplicates` with `dryRun: true`
- [ ] Review the dry-run results carefully
- [ ] Verify no important data would be lost
- [ ] Backup data (if needed)
- [ ] Run `remove-duplicates` with `dryRun: false`
- [ ] Verify system functionality after cleanup

---

## 🐛 Troubleshooting

### Issue: No duplicates found but I know they exist

**Solution:** Check the duplicate detection criteria:
- Promotions: name + type + value must match exactly
- Coupons: code must match exactly (case-insensitive)

### Issue: Wrong item kept after removal

**Solution:** The system keeps items with:
1. Highest usage count
2. Oldest creation date (if usage counts are equal)

If you need different logic, you may need to manually review and adjust.

### Issue: API returns error

**Solution:** 
- Check API key is valid
- Verify endpoint URL is correct
- Check request format (JSON)
- Review error message for details

---

## 📚 Related Documentation

- [Marketing Routes API Test Report](./MARKETING_ROUTES_API_TEST_REPORT.md)
- [Customer Promotions & Coupons Journey Test](./CUSTOMER_PROMOTIONS_COUPONS_JOURNEY_TEST_REPORT.md)

---

**Status:** ✅ Ready for Production Use  
**Last Updated:** 2024-01-15

