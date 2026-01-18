# Next Steps - Service Catalog Testing & Validation

## Status: Ready for Testing
All fixes have been applied. Now we need to validate the changes.

---

## STEP 1: Start Development Servers ✅

### Admin Web (Port 3001)
```bash
cd /Users/ketan/Documents/warmpawzecodev/apps/admin-web
npm run dev
```

### Backend API (If needed)
```bash
cd /Users/ketan/Documents/warmpawzecodev/backend/lambda
npm run dev
# or deploy to AWS Lambda
```

---

## STEP 2: Validate Service Catalog UI

### A. Test Service List Display
1. **Open Admin UI**: `http://localhost:3001` (or your CloudFront URL)
2. **Sign In**: 
   - Email: `admin@warmpawz.com`
   - Password: `Warmpawz2025`
3. **Navigate**: Dashboard → Catalog & Services → Service Catalog tab
4. **Verify**:
   - ✅ Services list displays (should show 119 services)
   - ✅ Services have names, categories, prices
   - ✅ No console errors

**Expected**: Service list populated from GET `/admin/service-catalog`

### B. Test Add Service Modal
1. **Click**: "Add Service" button
2. **Verify Modal Opens**:
   - ✅ Form fields visible
   - ✅ Role checkboxes loaded
   - ✅ Service type dropdown has 4 options (At Center, At Home, Tele/Video, Delivery)

---

## STEP 3: Create Test Service with Role Assignment

### Test Case: Create "Test Dog Walking" Service

**Fill in form**:
- **Service Name**: `Test Dog Walking Service`
- **Service Code**: `test_walk_001` (optional)
- **Description**: `30-minute neighborhood dog walking service`
- **Category**: Select any (or leave empty)
- **Price**: `250`
- **Duration**: `30` (or "30 min")
- **Service Type**: Select "At Home"
- **Status**: Active
- **Applicable Roles**: ✅ Check "Pet Walker"

**Submit**:
1. Click "Create Service"
2. **Verify Success**:
   - ✅ Success alert/message
   - ✅ Modal closes
   - ✅ Service appears in list

**Check Console**:
- No errors
- Network tab shows: POST `/admin/catalog/services` → 200 OK

---

## STEP 4: Verify Database Entry

### Check via API
```bash
# Get all services
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/service-catalog" \
  -H "Content-Type: application/json"

# Look for your test service
# Verify: applicable_roles: ["pet_walker"]
```

### Check via Database (If you have access)
```sql
SELECT 
  service_id, 
  service_name, 
  service_style,
  applicable_roles, 
  base_price,
  status
FROM service_catalog 
WHERE service_name LIKE '%Test Dog Walking%'
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Result**:
```json
{
  "service_id": "svc_admin_at_home_...",
  "service_name": "Test Dog Walking Service",
  "service_style": "at_home",
  "applicable_roles": ["pet_walker"],
  "base_price": 250,
  "status": "active"
}
```

---

## STEP 5: Test Vendor Service Visibility

### A. Via API
```bash
# Replace {vendor-id} with actual pet walker vendor ID
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/{vendor-id}/service-catalog/complete"
```

**Expected**:
- ✅ "Test Dog Walking Service" appears in response
- ✅ Only services with `applicable_roles` containing vendor's role

### B. Via Vendor UI (If available)
1. Navigate to vendor dashboard
2. Go to Services → Available Services
3. **Verify**:
   - ✅ "Test Dog Walking Service" visible
   - ✅ Can enable the service

---

## STEP 6: Test All Service Styles

Create one service for each style to ensure mapping works:

### 1. At Center Service
- Name: `Test Grooming at Center`
- Service Type: **At Center**
- Roles: Pet Groomer
- ✅ Verify: `service_style: "at_center"`

### 2. At Home Service
- Name: `Test Walking at Home`
- Service Type: **At Home**
- Roles: Pet Walker
- ✅ Verify: `service_style: "at_home"`

### 3. Tele Service
- Name: `Test Vet Tele Consultation`
- Service Type: **Tele/Video**
- Roles: Veterinarian
- ✅ Verify: `service_style: "tele"`

### 4. Delivery Service
- Name: `Test Medicine Delivery`
- Service Type: **Delivery**
- Roles: Pharmacy
- ✅ Verify: `service_style: "delivery"`

---

## STEP 7: Test Edge Cases

### Test 1: Service Without Roles
1. Create service
2. **Don't** select any roles
3. Click Create
4. **Expected**: Warning popup "No roles selected. Continue anyway?"
5. Confirm → Service created with `applicable_roles: []`
6. ✅ Verify: Service won't appear for any vendors

### Test 2: Service with Multiple Roles
1. Create service
2. Select **multiple roles**: Pet Walker, Pet Sitter, Pet Boarder
3. Submit
4. ✅ Verify: `applicable_roles: ["pet_walker", "pet_sitter", "pet_boarder"]`
5. ✅ Verify: Service visible to all three role types

### Test 3: Update Existing Service
1. Click edit on existing service
2. Add/remove roles
3. ✅ Verify: Changes saved correctly

---

## STEP 8: Full E2E Flow Test

### Complete Service Lifecycle:

**1. Admin Creates Service** ✅
- Service: "Premium Dog Walking"
- Roles: Pet Walker
- Style: at_home
- Price: 300

**2. Vendor Sees Service**
- Login as Pet Walker vendor
- Navigate to Services
- ✅ Verify: "Premium Dog Walking" in available catalog

**3. Vendor Enables Service**
- Click "Enable" on service
- Set custom price (optional): 350
- ✅ Verify: Service moves to "My Services"

**4. Staff Assignment**
- Navigate to Staff Management
- Select staff member
- Assign to "Premium Dog Walking"
- ✅ Verify: staff_services entry created

**5. Customer Sees Service**
- Open Customer App
- Search for pet walkers
- Select the vendor
- ✅ Verify: "Premium Dog Walking" appears at 350 (vendor's price)

---

## STEP 9: Monitor & Verify

### Check Browser Console
```javascript
// Should see in Network tab:
GET /admin/service-catalog → 200 OK
Response: { success: true, data: [...], services: [...] }

POST /admin/catalog/services → 200 OK
Response: { success: true, service: {...}, message: "Service created successfully" }
```

### Check Backend Logs
```bash
# CloudWatch or local logs
# Look for:
✅ "Service created successfully"
⚠️ "Service created without applicable_roles" (if no roles selected)
❌ Any error messages
```

### Check Database Consistency
```sql
-- Count services by style
SELECT service_style, COUNT(*) 
FROM service_catalog 
GROUP BY service_style;

-- Services without roles
SELECT service_id, service_name 
FROM service_catalog 
WHERE applicable_roles = '{}' OR applicable_roles IS NULL;

-- Services by role
SELECT 
  unnest(applicable_roles) as role,
  COUNT(*) as service_count
FROM service_catalog
GROUP BY role
ORDER BY service_count DESC;
```

---

## STEP 10: Document Test Results

### Create Test Report
```markdown
# Service Catalog Test Results
Date: [DATE]
Tester: [NAME]

## Test Summary
- Total Tests: 10
- Passed: __
- Failed: __

## Test Cases

### ✅ Service List Display
- Status: PASS/FAIL
- Notes: 

### ✅ Add Service Modal
- Status: PASS/FAIL
- Notes:

### ✅ Create with Roles
- Status: PASS/FAIL
- Service ID:
- Roles Assigned:

### ✅ Vendor Visibility
- Status: PASS/FAIL
- Vendor ID Tested:

[Continue for all test cases...]

## Issues Found
1. [If any]

## Next Actions
1. [If issues found]
```

---

## SUCCESS CRITERIA

All must be TRUE:
- [ ] Service list loads without errors
- [ ] Add Service modal shows role checkboxes
- [ ] Services created with selected roles
- [ ] Database shows correct `applicable_roles` array
- [ ] Vendor API returns role-filtered services
- [ ] All 4 service styles work (at-center, at-home, tele, delivery)
- [ ] Warning shown when no roles selected
- [ ] No duplicate endpoint errors
- [ ] Consistent API response format
- [ ] Full E2E flow works: Admin → Vendor → Staff → Customer

---

## TROUBLESHOOTING

### Issue: Services list not loading
**Check**:
1. Network tab: GET `/admin/service-catalog` status
2. Response format: Has `data` or `services` key
3. Console errors
4. Backend endpoint registered

### Issue: Modal doesn't show roles
**Check**:
1. GET `/admin/roles` returns data
2. Console error: "Error loading roles"
3. Roles state populated

### Issue: Service created without roles
**Check**:
1. `applicableRoles` sent in POST body
2. Backend logs: "Service created without applicable_roles"
3. Database: `applicable_roles` column value

### Issue: Vendor can't see service
**Check**:
1. Service has vendor's role in `applicable_roles`
2. Vendor role_id matches role in database
3. GET `/vendor/:id/service-catalog/complete` filters correctly

---

## ROLLBACK (If Major Issues)

```bash
# Revert all changes
cd /Users/ketan/Documents/warmpawzecodev

git checkout HEAD -- backend/lambda/src/endpoints/admin-advanced.ts
git checkout HEAD -- backend/lambda/src/endpoints/service-catalog.ts
git checkout HEAD -- apps/admin-web/components/admin/catalog/AddServiceModal.tsx

# Rebuild
cd apps/admin-web
npm run build

# Redeploy backend if needed
```

---

## COMPLETION CHECKLIST

- [ ] Admin web dev server running
- [ ] Service list displays 119 services
- [ ] Add Service modal opens with roles
- [ ] Test service created with roles assigned
- [ ] Database verified: `applicable_roles` populated
- [ ] Vendor API tested: services filtered by role
- [ ] All 4 service styles tested
- [ ] Warning for no roles works
- [ ] E2E flow completed successfully
- [ ] Test report documented
- [ ] No critical errors in logs

---

## NEXT ACTIONS AFTER VALIDATION

1. **If All Tests Pass**:
   - Deploy to production
   - Update documentation
   - Notify team of fixes

2. **If Issues Found**:
   - Document specific failures
   - Check ROOT_CAUSE_ANALYSIS.md
   - Apply additional fixes
   - Re-test

3. **Production Deployment**:
   ```bash
   # Build production
   cd apps/admin-web
   npm run build
   
   # Deploy backend
   cd backend/lambda
   npm run deploy
   ```

---

**Current Status**: Ready for Step 1 - Start testing 🚀
