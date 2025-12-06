# 🧪 Testing the Dynamic Role Configuration System

## Quick Start Guide

### Step 1: Access Platform Admin

1. Navigate to the app
2. Click "Platform Admin" login
3. Use admin credentials:
   - Email: `admin@warmpawz.com`
   - Password: `admin123`
   - Master Key: `warmpawz2025`

### Step 2: Navigate to Role Management

1. Click "Catalog & Services" in sidebar
2. Click "Roles" tab at the top
3. You'll see either:
   - **Empty state** with "Seed Initial Roles" button
   - **8 pre-configured role cards**

### Step 3: Seed the Roles

1. Click **"Seed Initial Roles"** button
2. Wait for success message
3. Refresh to see all 8 roles:
   - 🏥 Veterinarian
   - ✂️ Pet Groomer
   - 🎓 Pet Trainer
   - 🚶 Pet Walker
   - 🏠 Pet Boarder
   - 📸 Pet Photographer
   - 💊 Pet Pharmacy
   - 🏥 Pet Clinic

---

## Testing Scenarios

### Test 1: View Role Details

**Goal:** Understand what makes each role unique

1. Look at **Veterinarian** card:
   - Should show Healthcare Provider type
   - Three service styles (At Home, At Center, Tele)
   - ✓ Price and ✓ Duration control
   - Special badges: Staff, Multi-Service, License

2. Compare with **Pet Walker** card:
   - Service Provider type
   - Only "At Home" style
   - ✗ No pricing control (platform controlled!)
   - Capabilities: GPS, Photo Updates

3. Check **Pet Clinic** card:
   - ALL THREE vendor types (Healthcare + Service + Seller)
   - Multiple service styles
   - Full pricing control
   - Maximum capabilities

---

### Test 2: Edit a Role

**Goal:** Modify an existing role's configuration

1. Click **Edit** on "Pet Groomer" card
2. Dialog opens with 5 tabs
3. Go to **Pricing Tab**:
   - Currently: Can Control Price = Yes
   - Toggle it OFF
   - Save
4. Card updates immediately
5. Now groomers can't set their own prices!

**Undo:**
- Edit again → Toggle back ON → Save

---

### Test 3: Create Custom Role

**Goal:** Create a new "Pet Spa" role from scratch

1. Click **"Create Role"** button (orange, top right)
2. Fill in **Basic Tab**:
   - Name: `Pet Spa`
   - Description: `Luxury spa treatments for pampered pets`
   - Icon: `🛁`
   - Order: `9`
   - Active: ✓

3. **Types & Styles Tab**:
   - Vendor Types: ✓ Service Provider
   - Service Styles: ✓ At Center
   - Capabilities: ✓ booking, ✓ gallery

4. **Pricing Tab**:
   - Can Control Price: ✓
   - Can Control Duration: ✓
   - Min Price: `800`
   - Max Price: `6000`

5. **Onboarding Tab**:
   - Staff Management: ✗
   - Multi-Service: ✗

6. **Workflow Tab**:
   - Manual Approval: ✓
   - Background Check: ✓
   - License Verification: ✗

7. Click **"Create Role"**
8. New "Pet Spa" card appears!

---

### Test 4: API Testing

**Goal:** Verify API endpoints work

#### Get All Roles
```bash
curl https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/config/roles \
  -H "Authorization: Bearer [ANON_KEY]"
```

**Expected:** JSON array of 8 (or 9 if you created Pet Spa) roles

#### Get Single Role
```bash
curl https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/config/roles/veterinarian \
  -H "Authorization: Bearer [ANON_KEY]"
```

**Expected:** Full veterinarian role config

#### Get Onboarding Config
```bash
curl https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/config/roles/veterinarian/onboarding \
  -H "Authorization: Bearer [ANON_KEY]"
```

**Expected:** 
```json
{
  "config": {
    "roleId": "veterinarian",
    "roleName": "Veterinarian",
    "fields": {
      "required": [...],
      "custom": [...]
    },
    "documents": [...],
    "staffManagement": {...},
    "multiService": {...}
  }
}
```

---

### Test 5: Vendor App Integration

**Goal:** See how roles appear in vendor onboarding

1. Log out from Admin
2. Go to Vendor App
3. Click "Register as Vendor"
4. You should see role selection cards
5. The cards should match what you configured!

**Try:**
- Select "Pet Walker"
- Notice onboarding form has fewer fields
- No pricing inputs (because platform controls it!)
- Police verification required

**Compare with:**
- Select "Veterinarian"
- More fields appear (license number, specialization)
- Pricing inputs available
- More document uploads

---

### Test 6: Multi-Service Clinic

**Goal:** Test the most complex role

1. Vendor selects "Pet Clinic"
2. Onboarding form shows:
   - Clinic license field
   - Multi-service checkboxes:
     □ Veterinary
     □ Grooming
     □ Pharmacy
     □ Boarding
3. Vendor checks: Veterinary + Pharmacy
4. Additional fields appear:
   - Drug license (for pharmacy)
   - Staff management section
5. Vendor adds staff:
   - Dr. John (Doctor)
   - Jane (Pharmacist)
6. Submit application
7. Admin sees TWO approval items:
   - Veterinary service (approve separately)
   - Pharmacy service (needs drug license verification)

---

### Test 7: Pricing Control Scenarios

**Scenario A: Full Control (Veterinarian)**
- Vendor can set: Price ₹200-₹5000, Duration 15-120 min
- Customer sees vendor's prices

**Scenario B: No Control (Pet Walker)**
- Platform sets: ₹100 for 30 min walk
- Vendor cannot change
- Customer sees fixed pricing

**Scenario C: Style-Based Control (Groomer)**
- At Home: Platform controls (₹500 fixed)
- At Center: Vendor controls (₹300-₹3000)
- Different UX for each style!

---

## Verification Checklist

Use this to verify everything works:

### Platform Admin
- [ ] Role cards display correctly
- [ ] Seed button creates 8 roles
- [ ] Edit dialog opens with all tabs
- [ ] Create new role works
- [ ] Delete role works (with confirmation)
- [ ] Badge indicators correct (Staff, Multi-Service, License)

### API Endpoints
- [ ] GET /config/roles returns all roles
- [ ] GET /config/roles/:roleId returns single role
- [ ] POST /config/roles creates new role
- [ ] PUT /config/roles/:roleId updates role
- [ ] DELETE /config/roles/:roleId deletes role
- [ ] POST /config/roles/seed seeds initial roles
- [ ] GET /config/roles/:roleId/onboarding returns config

### Vendor App Integration
- [ ] Role selection shows configured roles
- [ ] Onboarding form adapts to role
- [ ] Required fields match config
- [ ] Document uploads match config
- [ ] Pricing inputs show/hide based on role
- [ ] Multi-service checkboxes appear for clinic
- [ ] Staff management section shows for enabled roles

### Database
- [ ] Roles saved at role:config:{roleId}
- [ ] Vendor records reference roleId
- [ ] Onboarding data matches role config
- [ ] Approval flow follows role workflow

---

## Common Issues & Fixes

### Issue 1: "Seed Initial Roles" doesn't work
**Fix:** Check browser console for errors. Ensure ANON_KEY is valid.

### Issue 2: Role cards don't show
**Fix:** Refresh page. Check API response in Network tab.

### Issue 3: Edit dialog doesn't save
**Fix:** Check required fields. Name and vendor types are mandatory.

### Issue 4: Vendor app doesn't show new role
**Fix:** Ensure role is marked as "Active". Check isActive flag.

### Issue 5: Pricing control not working
**Fix:** Check pricingControl.canControlPrice and canControlDuration flags.

---

## Performance Testing

### Load Test: 100 Roles
1. Create 100 custom roles via API
2. Measure load time of role cards
3. Should load in < 2 seconds

### Stress Test: Concurrent Edits
1. Open role editor in 5 tabs
2. Edit same role simultaneously
3. Last save should win (no conflicts)

---

## Success Criteria

✅ **All 8 roles seeded successfully**  
✅ **Can create custom roles**  
✅ **Can edit existing roles**  
✅ **Vendor app adapts to role config**  
✅ **Pricing control works correctly**  
✅ **Multi-service clinics function properly**  
✅ **Staff management enabled for correct roles**  
✅ **Document requirements match role config**  
✅ **Approval workflow follows role settings**  

---

## Next Steps After Testing

1. **Production Deployment**
   - Deploy to production environment
   - Seed initial roles in production
   - Monitor for errors

2. **Training**
   - Train admin staff on role management
   - Create admin guide
   - Record training videos

3. **Vendor Migration**
   - Migrate existing vendors to new role system
   - Update vendor records with roleId
   - Test vendor experience

4. **Customer Experience**
   - Verify customer app shows correct services
   - Test booking flow end-to-end
   - Monitor conversion rates

---

## Support & Troubleshooting

### Debug Mode
Enable debug mode in browser console:
```javascript
localStorage.setItem('DEBUG_ROLES', 'true');
```

This will log:
- API requests/responses
- Role configuration loading
- Form field rendering
- Validation errors

### Database Inspection
View all roles in database:
```bash
# Using Supabase CLI
supabase db query "SELECT * FROM kv_store WHERE key LIKE 'role:config:%'"
```

### Reset Everything
Delete all roles and start fresh:
```bash
curl -X POST https://[PROJECT_ID].supabase.co/functions/v1/make-server-3dd53475/admin/reset-roles \
  -H "Authorization: Bearer [ANON_KEY]"
```

---

**🎉 Happy Testing! The future of configurable vendor management is here!**
