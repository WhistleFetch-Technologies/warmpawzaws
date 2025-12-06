# 🧪 UAT TEST PLAN - Complete Vendor Visibility Testing

## CRITICAL DIAGNOSTIC STEPS FIRST

### STEP 1: Run Diagnostic (MANDATORY)
**Before any fixes, we MUST know what the database actually contains!**

1. Admin Panel → Click "Diagnostic" button
2. Test Phone: `9611377119`
3. Look at "Services Breakdown" section
4. **SCREENSHOT THE RESULTS**

Expected outcome:
- If shows 0 services → Database storage issue
- If shows 15 services → Search API filtering issue

### STEP 2: Check Service Style Mismatch

The screenshots show "Clinic" badge, but system uses:
- `at_center` (not "Clinic")
- `at_home` (not "Home")
- `tele` (not "Tele")

**Check if this is the issue**:
1. Run diagnostic
2. Look at service counts
3. If all zeros → service style mismatch

## ROOT CAUSE ANALYSIS

Based on screenshots, services ARE configured. So the issue is ONE of:

### Possibility #1: Service Style Mismatch ⚠️ MOST LIKELY
- Frontend shows "Clinic"
- Backend stores as "clinic" 
- Search API looks for "at_center"
- **Result**: Services exist but wrong key!

### Possibility #2: Staff-Vendor Link Broken
- Staff exists
- Services exist
- But search can't find staff for vendor

### Possibility #3: Service Publish Status
- Services created
- But `isEnabled=false` or `publishStatus='draft'`

### Possibility #4: Search API Wrong Filter
- Everything stored correctly
- But search API filters incorrectly

## COMPLETE FIX IMPLEMENTATION

I need to implement fixes for ALL possibilities:

### Fix #1: Normalize Service Styles
Create migration to:
1. Find all services with style="clinic" → change to "at_center"
2. Find all services with style="home" → change to "at_home"
3. Find all services with style="tele_consultation" → change to "tele"

### Fix #2: Universal Service Loader
Search API should check:
- `vendor_services:${vendorId}:at_center`
- `vendor_services:${vendorId}:clinic` (legacy)
- `staff:${staffId}:service:*`

### Fix #3: Service Validation
Ensure all services have:
- `isEnabled: true`
- `publishStatus: 'published'`
- Valid `serviceStyle` field

### Fix #4: Search API Enhancement
Make search check ALL possible keys and normalize results

## IMMEDIATE ACTION REQUIRED

### YOU NEED TO:
1. **Run diagnostic for 9611377119**
2. **Screenshot the results**
3. **Send me the screenshot**
4. **Look at "Services Breakdown" numbers**

This ONE diagnostic will tell me EXACTLY what's wrong:

- If At Center = 0 → Service style mismatch (I'll fix storage keys)
- If At Center = 15 → Search API issue (I'll fix search logic)
- If Total = 0 → Services not saved (I'll fix save endpoint)

## CANNOT PROCEED WITHOUT DIAGNOSTIC

I've built you a diagnostic tool specifically for this. 

**Please run it now and send results.**

Without seeing what's ACTUALLY in the database, I'm fixing blindly.

The diagnostic will show:
```
Services Breakdown:
  At Center: [NUMBER]  ← This tells us everything!
  At Home: [NUMBER]
  Tele: [NUMBER]
  Staff Services: [NUMBER]
```

Once I see these numbers, I'll know exactly what to fix!

---

**ACTION:** Run Admin Panel → Diagnostic → Test 9611377119 → Screenshot → Send results 🔍
