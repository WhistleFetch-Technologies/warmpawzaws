# 🔍 DIAGNOSTIC INSTRUCTIONS - Find Out Why Vendors Aren't Showing

## Step 1: Run Diagnostic Tool (2 minutes)

1. **Open Admin Panel**
2. **Click "Diagnostic" button** (blue button, top right)
3. **Enter phone number**: `9611377119` (Omega Pet Care)
4. **Click "Run Diagnostic"**
5. **Wait 5-10 seconds**
6. **READ THE REPORT CAREFULLY**

## What The Report Will Tell You

### ✅ Green Boxes = Working
### ❌ Red Boxes = Problem Found

The report checks:
1. **Vendor Exists** - Is vendor in database?
2. **Approved** - Is vendor approved by admin?
3. **Has Staff** - Does vendor have staff records?
4. **Has Services** - Does vendor have published services?

### Services Breakdown Section
Shows EXACTLY how many services in each category:
- **At Center**: Services at clinic/facility
- **At Home**: Home visit services
- **Tele**: Tele-consultation services
- **Staff Services**: Personal staff services

### Issues Section
Lists EXACTLY what's wrong:
- ❌ No staff records found
- ❌ No live/published services found
- ⚠️ Found X services but none are published/enabled

## Step 2: Check Both Vendors

Run diagnostic for:
1. **Vendor**: `9611377119` (Omega Pet Care Hospital)
2. **Staff**: `8098078086` (Anjali Pandey)

Compare the reports!

## Step 3: Check All Vendors

Click "Check All Vendors" button to see:
- Which vendors are visible (green)
- Which vendors are hidden (red)
- Staff count and service count for each

## Expected Results

If services are configured correctly, you should see:

### For Omega Pet Care (9611377119):
```
✅ Vendor Exists
✅ Approved
✅ Has Staff: 1
✅ Has Services: 15

Services Breakdown:
  At Center: 15
  At Home: 0
  Tele: 0
  Staff Services: 0

✅ This vendor SHOULD be visible in customer search
```

### For Anjali Pandey (8098078086):
```
✅ Vendor Exists
✅ Approved
✅ Has Staff: 1
✅ Has Services: 5

Services Breakdown:
  At Center: 5
  At Home: 0
  Tele: 0
  Staff Services: 0

✅ This vendor SHOULD be visible in customer search
```

## If Report Shows "NOT Searchable"

Look at the "Issues" section. Common issues:

### Issue #1: "No staff records found"
**Problem**: Staff record wasn't created during approval
**Solution**: Click "Fix Data" button → "Run Auto-Fix"

### Issue #2: "No live/published services found"
**Problem**: Services exist but aren't published/enabled
**Solution**: 
1. Vendor logs into dashboard
2. Goes to Services
3. Enables ALL services (toggle switch)
4. Ensures "Live" badge shows (green)

### Issue #3: "Found X services but none are published"
**Problem**: Services are in draft mode
**Solution**:
1. Vendor dashboard → Services
2. Click each service
3. Change status to "Published"
4. Save

## After Running Diagnostic

**COPY THE REPORT** and send it to me. The report will tell us:
1. Exact number of services in database
2. Which service styles are configured
3. Staff count
4. Whether search should find them

## Next Steps Based on Report

### If Report Says "✅ SHOULD be visible"
But customer app still doesn't show them → **API filtering issue**
I need to check the search API logic

### If Report Says "❌ NOT visible"
Check the "Issues" list and fix those first:
- Run auto-fix for staff
- Publish services
- Enable services

## Advanced: Check Supabase Logs

1. Go to Supabase Dashboard
2. Edge Functions → Logs
3. Filter by "diagnostic"
4. You'll see detailed breakdown:
   ```
   📊 Services Check:
      at_center key: vendor_services:vendor_xxx:at_center
      at_center total: 15
      at_center live: 15
   ```

This shows EXACTLY what's in the database!

## What To Send Me

After running diagnostic, send me:
1. Screenshot of the diagnostic report
2. Phone numbers tested
3. Whether report says "SHOULD be visible" or "NOT visible"
4. List of issues from the report

This will help me identify the EXACT problem!

---

**RUN THE DIAGNOSTIC NOW - IT WILL TELL US EVERYTHING!** 🔍
