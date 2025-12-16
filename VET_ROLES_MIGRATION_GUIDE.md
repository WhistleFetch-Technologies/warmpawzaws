# 🔧 Vet Roles Migration Guide

**Date:** Created  
**Purpose:** Migrate all vendors with vet-related role IDs to standard 'veterinarian' role  
**Status:** ✅ Endpoint Created, Ready for Deployment

---

## 📋 Overview

This guide explains how to use the vet roles migration endpoint to standardize all vet-related role IDs to the canonical `pet_clinic` role. This ensures consistency across the system and proper role-based functionality.

---

## 🎯 What Gets Migrated

### Vet Role Variations That Will Be Migrated

**IMPORTANT:** All vet-related roles, including `veterinarian`, will be migrated to `pet_clinic`. The following role IDs will be migrated:

- ✅ `veterinarian` → `pet_clinic` (will be migrated)
- ✅ `vet_clinic` → `pet_clinic`
- ✅ `veterinary_clinic` → `pet_clinic`
- ✅ `role_veterinarian` → `pet_clinic`
- ✅ `role_vet_clinic` → `pet_clinic`
- ✅ `role_pet_clinic` → `pet_clinic` (if not already `pet_clinic`)
- ✅ `role_veterinary_clinic` → `pet_clinic`
- ✅ `veterinarian_clinic` → `pet_clinic`
- ✅ `vet` → `pet_clinic`
- ✅ `veterinary` → `pet_clinic`
- ✅ Any role containing 'vet' or 'clinic' → `pet_clinic`

### Target Role

**All migrated vendors will use: `pet_clinic`** (this is the ONLY target role for all vet-related roles)

**Note:** Vendors already using `pet_clinic` will be skipped. All other vet-related roles, including `veterinarian`, will be migrated to `pet_clinic`.

---

## 🛠️ API Endpoint

### Migrate Vet Roles (Dry-Run)

**Endpoint:** `POST /admin/migrate-vet-roles?dryRun=true`

**Description:** Preview which vendors would be migrated without making any changes.

**Request:**
```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/migrate-vet-roles?dryRun=true" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "dryRun": true,
  "message": "DRY RUN: Would migrate vet roles",
  "summary": {
    "totalVendors": 150,
    "vendorsToMigrate": 12,
    "targetRole": "pet_clinic",
    "sourceRoles": [
      "veterinarian",
      "vet_clinic",
      "veterinary_clinic"
    ]
  },
  "vendors": [
    {
      "vendorId": "vendor_123",
      "currentRole": "veterinarian",
      "newRole": "pet_clinic",
      "businessName": "ABC Pet Clinic",
      "phone": "9876543210"
    },
    {
      "vendorId": "vendor_456",
      "currentRole": "vet_clinic",
      "newRole": "pet_clinic",
      "businessName": "XYZ Veterinary Services",
      "phone": "9876543211"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

### Migrate Vet Roles (Actual Migration)

**Endpoint:** `POST /admin/migrate-vet-roles?dryRun=false`

**Description:** Actually migrate vendors to the standard `veterinarian` role.

**Request:**
```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/migrate-vet-roles?dryRun=false" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "dryRun": false,
  "message": "Vet roles migrated successfully",
  "summary": {
    "totalVendors": 150,
    "vendorsToMigrate": 12,
    "migrated": 12,
    "errors": 0,
    "targetRole": "pet_clinic"
  },
  "migrated": [
    {
      "vendorId": "vendor_123",
      "oldRole": "veterinarian",
      "newRole": "pet_clinic",
      "businessName": "ABC Pet Clinic"
    },
    {
      "vendorId": "vendor_456",
      "oldRole": "vet_clinic",
      "newRole": "pet_clinic",
      "businessName": "XYZ Veterinary Services"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 📝 Step-by-Step Workflow

### Step 1: Preview Migration (Dry-Run)

```bash
curl -X POST "${BASE_URL}/admin/migrate-vet-roles?dryRun=true" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json"
```

**Review the results:**
- Check how many vendors would be migrated
- Review which vendors would be affected
- Verify the role mappings are correct

---

### Step 2: Execute Migration

**⚠️ WARNING: This will permanently update vendor roles!**

```bash
curl -X POST "${BASE_URL}/admin/migrate-vet-roles?dryRun=false" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json"
```

**After migration:**
- Verify vendors have been updated
- Check that role-based features work correctly
- Confirm system functionality is intact

---

## 🔍 What Gets Updated

### Vendor Records

The following fields are updated in vendor records:

- `roleId`: Set to `pet_clinic`
- `role`: Set to `pet_clinic`
- `roleName`: Set to `Pet Clinic`
- `updatedAt`: Updated to current timestamp
- `migratedAt`: Added with migration timestamp
- `migrationNote`: Added with migration details

### Application Records

If a vendor has an associated application, the application's `roleId` is also updated to `pet_clinic`.

---

## ⚠️ Important Notes

1. **Dry-run mode is default** - If `dryRun` parameter is omitted or set to `true`, no changes are made
2. **Idempotent operation** - Running the migration multiple times is safe (vendors already using `veterinarian` are skipped)
3. **Backup recommended** - Consider backing up vendor data before running migration
4. **Role consistency** - All vet-related roles are standardized to `veterinarian` for consistency
5. **Application updates** - Associated applications are also updated to maintain consistency

---

## 🧪 Testing

### Test Dry-Run

```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/migrate-vet-roles?dryRun=true" \
  -H "apikey: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### Test Actual Migration

```bash
curl -X POST "https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475/admin/migrate-vet-roles?dryRun=false" \
  -H "apikey: YOUR_API_KEY" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

---

## 📊 Response Fields Explained

### Dry-Run Response

- `dryRun`: Always `true` for dry-run mode
- `summary.totalVendors`: Total number of vendors in system
- `summary.vendorsToMigrate`: Number of vendors that would be migrated
- `summary.targetRole`: Target role ID (`pet_clinic`)
- `summary.sourceRoles`: Array of source role IDs that would be migrated
- `vendors`: Array of vendors that would be migrated with details

### Migration Response

- `dryRun`: Always `false` for actual migration
- `summary.migrated`: Number of vendors successfully migrated
- `summary.errors`: Number of errors during migration
- `migrated`: Array of successfully migrated vendors
- `errors`: Array of errors (if any)

---

## ✅ Checklist

Before running actual migration:

- [ ] Run dry-run mode to see what would be migrated
- [ ] Review the list of vendors that would be affected
- [ ] Verify the role mappings are correct
- [ ] Backup vendor data (if needed)
- [ ] Run actual migration with `dryRun=false`
- [ ] Verify vendors have been updated correctly
- [ ] Test role-based features after migration

---

## 🐛 Troubleshooting

### Issue: No vendors found to migrate

**Solution:** Check:
- Vendors must have vet-related role IDs to be migrated
- Vendors already using `pet_clinic` role are skipped
- Verify vendor records have role fields populated

### Issue: Migration fails for some vendors

**Solution:** 
- Check error details in the `errors` array
- Verify vendor records are valid
- Check for missing required fields
- Review server logs for detailed error messages

### Issue: API returns "Not Found"

**Solution:** 
- **Ensure server is deployed** with the latest endpoints
- Check endpoint URL is correct
- Verify API key is valid
- Deploy server: `./deploy-server.sh`

---

## 🚀 Deployment

The endpoint needs to be deployed before it can be used:

```bash
./deploy-server.sh
```

After deployment, test the endpoint:

```bash
# Dry-run
curl -X POST "${BASE_URL}/admin/migrate-vet-roles?dryRun=true" \
  -H "apikey: ${API_KEY}" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json"
```

---

## 📚 Related Documentation

- [Vendor Duplicates Cleanup Guide](./VENDOR_DUPLICATES_CLEANUP_GUIDE.md) - Clean up duplicate vendor applications
- [Role Capabilities Guide](./ROLE_CAPABILITIES_COMPREHENSIVE_GUIDE.md) - Role-based capabilities

---

**Status:** ✅ Ready for Deployment  
**Last Updated:** 2024-01-15

