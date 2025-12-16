# 🧹 Vendor Duplicate Cleanup - Guide

**Date:** Created  
**Purpose:** Find and remove duplicate vendor applications that are in "pending" status (awaiting admin approval)  
**Status:** ✅ Endpoints Created, Ready for Deployment

---

## 📋 Overview

This guide explains how to use the vendor duplicate cleanup endpoints to find and remove duplicate vendor applications. The cleanup process:

- **Only checks applications with status 'pending'** (new applications awaiting approval)
- **Groups duplicates by phone number** (normalized for comparison)
- **Keeps the oldest application**, removes the rest
- **Includes dry-run mode** for safe preview before deletion

---

## 🎯 What Gets Cleaned

### Duplicate Detection Criteria

- **Phone Number Match:** Applications with the same normalized phone number
- **Status Filter:** Only applications with `status: 'pending'` are considered
- **Removal Logic:** Keeps the oldest application (by `submittedAt` or `createdAt`), removes newer duplicates

### What Gets Removed

1. **Duplicate Applications:** Applications with same phone number and 'pending' status
2. **Associated Vendors:** If a vendor has no other applications, the vendor record is also removed

### What Gets Kept

- The **oldest application** in each duplicate group
- All applications with status other than 'pending' (approved, rejected, etc.)
- All applications with unique phone numbers

---

## 🛠️ API Endpoints

### 1. Find Duplicate Vendor Applications

**Endpoint:** `POST /admin/vendors/cleanup/find-duplicates`

**Description:** Scans all vendor applications to find duplicates by phone number. Only checks applications with status 'pending'.

**Request:**
```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/cleanup/find-duplicates" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
  -H "Content-Type: application/json"
```

**⚠️ Note:** If you get a "Not Found" error, the server needs to be deployed first:
```bash
./deploy-server.sh
```

**Response:**
```json
{
  "success": true,
  "totalVendors": 150,
  "totalApplications": 200,
  "pendingApplications": 50,
  "duplicatePhones": 5,
  "duplicateApplications": 12,
  "duplicates": [
    {
      "phone": "9876543210",
      "count": 3,
      "applications": [
        {
          "applicationId": "app_123",
          "vendorId": "vendor_123",
          "phone": "9876543210",
          "email": "vendor@example.com",
          "status": "pending",
          "submittedAt": "2024-01-01T10:00:00Z",
          "roleId": "groomer"
        },
        {
          "applicationId": "app_456",
          "vendorId": "vendor_456",
          "phone": "9876543210",
          "email": "vendor@example.com",
          "status": "pending",
          "submittedAt": "2024-01-02T10:00:00Z",
          "roleId": "groomer"
        },
        {
          "applicationId": "app_789",
          "vendorId": "vendor_789",
          "phone": "9876543210",
          "email": "vendor@example.com",
          "status": "pending",
          "submittedAt": "2024-01-03T10:00:00Z",
          "roleId": "groomer"
        }
      ],
      "keep": {
        "applicationId": "app_123",
        "vendorId": "vendor_123",
        "phone": "9876543210",
        "submittedAt": "2024-01-01T10:00:00Z"
      },
      "remove": [
        {
          "applicationId": "app_456",
          "vendorId": "vendor_456",
          "phone": "9876543210",
          "submittedAt": "2024-01-02T10:00:00Z"
        },
        {
          "applicationId": "app_789",
          "vendorId": "vendor_789",
          "phone": "9876543210",
          "submittedAt": "2024-01-03T10:00:00Z"
        }
      ]
    }
  ],
  "message": "Found 5 duplicate applications that can be removed"
}
```

---

### 2. Remove Duplicate Vendor Applications (Dry-Run)

**Endpoint:** `POST /admin/vendors/cleanup/remove-duplicates`

**Description:** Simulates the removal of duplicate applications without actually deleting anything. Use this to preview what would be removed.

**Request:**
```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/cleanup/remove-duplicates" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
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
  "message": "DRY RUN: Would remove duplicate applications",
  "results": {
    "processed": 50,
    "kept": 38,
    "removed": 12,
    "errors": 0,
    "details": [
      {
        "applicationId": "app_456",
        "vendorId": "vendor_456",
        "phone": "9876543210",
        "submittedAt": "2024-01-02T10:00:00Z",
        "reason": "Duplicate of app_123 (kept oldest: 2024-01-01T10:00:00Z)"
      }
    ]
  }
}
```

---

### 3. Remove Duplicate Vendor Applications (Actual Removal)

**Endpoint:** `POST /admin/vendors/cleanup/remove-duplicates`

**Description:** Permanently removes duplicate applications. **Use with caution!** Always run dry-run mode first.

**Request:**
```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/cleanup/remove-duplicates" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
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
  "results": {
    "processed": 50,
    "kept": 38,
    "removed": 12,
    "errors": 0,
    "details": [
      {
        "applicationId": "app_456",
        "vendorId": "vendor_456",
        "phone": "9876543210",
        "submittedAt": "2024-01-02T10:00:00Z",
        "reason": "Duplicate of app_123 (kept oldest: 2024-01-01T10:00:00Z)"
      }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 📝 Step-by-Step Workflow

### Step 1: Find Duplicate Applications (Safe)

```bash
./test-vendor-duplicates-cleanup.sh
# Or manually:
curl -X POST "${BASE_URL}/admin/vendors/cleanup/find-duplicates" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json"
```

**Review the results:**
- Check how many duplicate groups exist
- Review which applications would be affected
- Verify the duplicate detection is correct

---

### Step 2: Test Removal in Dry-Run Mode (Safe)

```bash
curl -X POST "${BASE_URL}/admin/vendors/cleanup/remove-duplicates" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Review the dry-run results:**
- Check which applications would be removed
- Verify the removal logic (keeps oldest)
- Ensure no important data would be lost

---

### Step 3: Actually Remove Duplicates (After Review)

**⚠️ WARNING: This permanently deletes data!**

```bash
curl -X POST "${BASE_URL}/admin/vendors/cleanup/remove-duplicates" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

**After removal:**
- Verify the duplicates are gone
- Check that remaining applications are correct
- Confirm system functionality is intact

---

## 🧪 Testing

Use the provided test script:

```bash
./test-vendor-duplicates-cleanup.sh
```

The script will:
1. ✅ Find duplicates (read-only)
2. ✅ Test dry-run mode (safe preview)
3. ⚠️ Ask for confirmation before actual removal

---

## ⚠️ Important Notes

1. **Only 'pending' applications are checked** - Applications with other statuses (approved, rejected, etc.) are not affected
2. **Phone number normalization** - Phone numbers are normalized before comparison (removes country codes, spaces, etc.)
3. **Oldest application is kept** - The application with the earliest `submittedAt` or `createdAt` date is kept
4. **Vendor records may be removed** - If a vendor has no other applications, the vendor record is also removed
5. **Always run dry-run first** - Preview changes before making them permanent
6. **Backup data** - Consider backing up your data before running actual removal

---

## 🔍 Example Use Cases

### Use Case 1: Clean Up After Multiple Submissions

A vendor accidentally submitted multiple applications with the same phone number:

```bash
# Step 1: Find duplicates
POST /admin/vendors/cleanup/find-duplicates

# Step 2: Preview removal
POST /admin/vendors/cleanup/remove-duplicates {"dryRun": true}

# Step 3: Remove duplicates
POST /admin/vendors/cleanup/remove-duplicates {"dryRun": false}
```

### Use Case 2: Regular Maintenance

Run cleanup periodically to keep the system clean:

```bash
# Monthly cleanup
POST /admin/vendors/cleanup/find-duplicates
# Review results
POST /admin/vendors/cleanup/remove-duplicates {"dryRun": true}
# If satisfied, remove
POST /admin/vendors/cleanup/remove-duplicates {"dryRun": false}
```

---

## 📊 Response Fields Explained

### Find Duplicates Response

- `totalVendors` - Total number of vendor records
- `totalApplications` - Total number of applications
- `pendingApplications` - Number of applications with 'pending' status
- `duplicatePhones` - Number of phone numbers with duplicates
- `duplicateApplications` - Total number of duplicate applications
- `duplicates` - Array of duplicate groups with details

### Remove Duplicates Response

- `dryRun` - Whether this was a dry-run (true) or actual removal (false)
- `results.processed` - Number of phone numbers processed
- `results.kept` - Number of applications kept
- `results.removed` - Number of applications removed
- `results.errors` - Number of errors during removal
- `results.details` - Array of removed applications with reasons

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

**Solution:** Check:
- Applications must have status 'pending' to be considered
- Phone numbers must match exactly after normalization
- Applications with other statuses are not checked

### Issue: Wrong application kept after removal

**Solution:** The system keeps the application with:
1. Earliest `submittedAt` date
2. If `submittedAt` is missing, uses `createdAt` date

If you need different logic, you may need to manually review and adjust.

### Issue: API returns error

**Solution:** 
- Check API key is valid
- Verify endpoint URL is correct
- Check request format (JSON)
- Review error message for details
- **Ensure server is deployed** with the latest endpoints

---

## 🚀 Deployment

The endpoints need to be deployed before they can be used:

```bash
./deploy-server.sh
```

After deployment, test the endpoints:

```bash
./test-vendor-duplicates-cleanup.sh
```

---

## 📚 Related Documentation

- [Admin Cleanup Duplicates Guide](./ADMIN_CLEANUP_DUPLICATES_GUIDE.md) - Promotions/Coupons cleanup
- [Vendor Onboarding Guide](./VENDOR_ONBOARDING_GAP_ANALYSIS_REPORT.md) - Vendor application process

---

**Status:** ✅ Ready for Deployment  
**Last Updated:** 2024-01-15

