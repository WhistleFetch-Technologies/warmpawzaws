# 🔍 How to Debug Staff Visibility Issues

## Problem: Staff Not Appearing in Customer Search

You mentioned that only Niranjan D is showing up when there should be many more staff with live services and specializations.

---

## Quick Diagnosis Steps

### Step 1: Click "🛠️ Staff Fix" Button
*(Top-right of the screen)*

This opens the Staff Array Diagnostics tool.

### Step 2: Scroll Down to "Advanced Debugging" Section
*(Purple-bordered box at the bottom)*

### Step 3: Enter a Vendor ID

**Where to find vendor IDs:**
- Open browser console (F12)
- Click "Customer App" → Search for "Surgery & Procedures"
- Look at the console logs, you'll see vendor IDs like:
  ```
  🔍 Checking: Dr. Anjali Menon (vendor_anjali_123)
  ```

**Enter that vendor ID** in the debugger input box (e.g., `vendor_anjali_123`)

### Step 4: Click "Check" Button

The tool will show you:
- ✅ ALL staff for that vendor
- ✅ Each staff member's services
- ✅ Which services pass the current filter
- ❌ Why each staff member is/isn't appearing

---

## What You'll See

### Example Good Staff (Should Appear):
```
✅ Niranjan D
   ID: staff_123
   Active: true
   Specializations: [surgery, orthopedics]
   
   Filter Results:
   - isEnabled: 5 services
   - isActive: 5 services
   - isLive: 5 services
   
   Services (5):
   ✅ Spay Surgery - ₹7000
      isEnabled: true ✅
      isActive: true ✅
   
   ✅ This staff member SHOULD appear in search results
```

### Example Bad Staff (Won't Appear):
```
❌ Dr. Priya Sharma
   ID: staff_456
   Active: true
   Specializations: [cardiology, surgery]
   
   Filter Results:
   - isEnabled: 0 services ❌
   - isActive: 0 services ❌
   - isLive: 3 services
   
   Services (3):
   ❌ Cardiac Checkup - ₹1500
      isEnabled: false ❌
      isActive: false ❌
      isLive: true
   
   ❌ This staff member will NOT appear (no services pass filter)
```

---

## The Root Cause

Based on the debugger output, you'll see one of these issues:

### Issue A: Services Don't Have `isEnabled` or `isActive` Set
**Symptom:** Services show `isEnabled: false` or `isActive: false`  
**Solution:** Update your service creation to set these flags to `true`

### Issue B: Services Use Different Property Names
**Symptom:** Services have `isLive: true` but `isEnabled` is `undefined`  
**Solution:** The API needs to be updated to check `isLive` instead of `isEnabled`

### Issue C: No Matching Specializations
**Symptom:** Staff has services but specializations don't match the problem  
**Solution:** Check problem mapping or staff specializations

---

## How to Fix Based on Findings

### If Services Need `isEnabled: true`

The API currently checks:
```typescript
const enabledServices = staffServices.filter((s: any) => 
  s.isEnabled === true || s.isActive === true
);
```

**Option 1:** Update existing services to set `isEnabled: true`
**Option 2:** Change the API filter (see below)

### If Services Use Different Properties

If the debugger shows your services use `isLive` or `isPublished` instead, I need to update the API filter to:

```typescript
const enabledServices = staffServices.filter((s: any) => 
  s.isEnabled === true || 
  s.isActive === true ||
  s.isLive === true ||  // ✅ ADD THIS
  s.isPublished === true ||  // ✅ ADD THIS
  s.status === 'published' ||  // ✅ ADD THIS
  s.status === 'live'  // ✅ ADD THIS
);
```

---

## What to Tell Me

After running the debugger, tell me:

1. **Vendor ID you checked:** (e.g., `vendor_anjali_123`)

2. **What you see in "Filter Results":**
   ```
   - isEnabled: 0
   - isActive: 0
   - isLive: 5  ← This one!
   - isPublished: 3
   ```

3. **Example service object** (copy from debugger):
   ```json
   {
     "name": "Spay Surgery",
     "price": 7000,
     "isEnabled": false,
     "isActive": false,
     "isLive": true,  ← This is true!
     "status": "published"
   }
   ```

4. **Staff with services but not appearing:**
   - Dr. Priya Sharma - 3 services, specializations match, but filter fails
   - Dr. Neha Patel - 5 services, specializations match, but filter fails

---

## Likely Solution

Based on your description ("most categories where other staff are also having multiple live services"), I suspect:

**Your services have `isLive: true` but NOT `isEnabled: true`**

The API is checking for `isEnabled === true || isActive === true`, which fails.

**Quick fix:** I need to update the API to also check `isLive === true`.

---

## Example Console Output to Copy

When you run the debugger, check the browser console (F12). You should see logs like:

```
🔍 Found 3 services at: staff:staff_123:service:
   📋 Service: Spay Surgery - Female (Medium Breed)
      - isEnabled: false
      - isActive: false
      - isLive: true
      - price: 7000
   📋 Service: Dewarming Services
      - isEnabled: false
      - isActive: false
      - isLive: true
      - price: 1000
```

**Copy this and send it to me!**

---

## Quick Test After Fix

1. I'll update the API filter based on your findings
2. Go to Customer App
3. Search "Surgery & Procedures"
4. You should see ALL staff with live services appearing

---

## Key Questions to Answer

1. ❓ **Do your services have `isLive: true`?**
2. ❓ **Do your services have `status: 'published'` or `status: 'live'`?**
3. ❓ **Do your dynamically onboarded vendors structure data differently than Dr. Anjali Menon?**

Answer these and I'll fix the API immediately! 🚀
