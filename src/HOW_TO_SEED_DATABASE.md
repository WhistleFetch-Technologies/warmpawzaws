# HOW TO SEED THE DATABASE - Step by Step

## ⚠️ IMPORTANT: The seed data is in the code, but you need to RUN the seeding!

The roles and services are **defined in the code files** but they are **NOT in the database yet**. You need to trigger the seeding endpoints to actually add them to the database.

---

## 🎯 Quick Fix - Seed via Browser Console

### Option 1: Use Browser Console (FASTEST - 30 seconds)

**Copy and paste this into your browser console on ANY page:**

```javascript
// Configuration
const projectId = 'your-project-id'; // REPLACE THIS
const publicAnonKey = 'your-anon-key'; // REPLACE THIS

// Or if you have utils/supabase/info.tsx imported:
// import { projectId, publicAnonKey } from './utils/supabase/info.tsx';

const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

// Step 1: Seed Roles
async function seedRoles() {
  console.log('🌱 Seeding roles...');
  const response = await fetch(`${baseUrl}/config/roles/seed`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  console.log('✅ Roles:', data);
  return data;
}

// Step 2: Seed Catalog
async function seedCatalog() {
  console.log('🌱 Seeding catalog...');
  const response = await fetch(`${baseUrl}/admin/catalog/seed`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  console.log('✅ Catalog:', data);
  return data;
}

// Step 3: Verify
async function verifySeeding() {
  console.log('🔍 Verifying...');
  
  // Check roles
  const rolesRes = await fetch(`${baseUrl}/config/roles`, {
    headers: { 'Authorization': `Bearer ${publicAnonKey}` }
  });
  const roles = await rolesRes.json();
  
  // Check services
  const servicesRes = await fetch(`${baseUrl}/admin/catalog/services`, {
    headers: { 'Authorization': `Bearer ${publicAnonKey}` }
  });
  const services = await servicesRes.json();
  
  const cafeRole = roles.roles?.find(r => r.id === 'pet_cafe');
  const sunsetRole = roles.roles?.find(r => r.id === 'sunset_services');
  const cafeServices = services.services?.filter(s => s.applicableRoles?.includes('pet_cafe'));
  const sunsetServices = services.services?.filter(s => s.applicableRoles?.includes('sunset_services'));
  
  console.log('\n📊 VERIFICATION RESULTS:');
  console.log('==========================================');
  console.log(`Total Roles: ${roles.roles?.length || 0} (expected: 12)`);
  console.log(`Total Services: ${services.services?.length || 0} (expected: 91)`);
  console.log('');
  console.log('Pet Cafe Role:', cafeRole ? '✅ FOUND' : '❌ MISSING');
  console.log('Sunset Services Role:', sunsetRole ? '✅ FOUND' : '❌ MISSING');
  console.log('');
  console.log(`Pet Cafe Services: ${cafeServices?.length || 0}/15`, cafeServices?.length === 15 ? '✅' : '❌');
  console.log(`Sunset Services: ${sunsetServices?.length || 0}/16`, sunsetServices?.length === 16 ? '✅' : '❌');
  console.log('==========================================\n');
  
  if (roles.roles?.length === 12 && services.services?.length >= 91) {
    console.log('🎉 SUCCESS! Database is fully seeded!');
  } else {
    console.log('⚠️ INCOMPLETE - Try running seedRoles() and seedCatalog() again');
  }
}

// RUN ALL
async function seedAll() {
  try {
    await seedRoles();
    await seedCatalog();
    await verifySeeding();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Execute
seedAll();
```

**What to do:**
1. Replace `your-project-id` and `your-anon-key` with your actual values
2. Paste into browser console
3. Press Enter
4. Wait ~10 seconds
5. Check the output

**Expected Output:**
```
🌱 Seeding roles...
✅ Roles: { success: true, message: "12 roles seeded successfully", ... }

🌱 Seeding catalog...
✅ Catalog: { success: true, message: "Catalog seeded successfully", added: { categories: 2, services: 31 }, ... }

🔍 Verifying...

📊 VERIFICATION RESULTS:
==========================================
Total Roles: 12 (expected: 12)
Total Services: 91 (expected: 91)

Pet Cafe Role: ✅ FOUND
Sunset Services Role: ✅ FOUND

Pet Cafe Services: 15/15 ✅
Sunset Services: 16/16 ✅
==========================================

🎉 SUCCESS! Database is fully seeded!
```

---

## Option 2: Use Admin Panel UI (if UI buttons exist)

**In Admin Panel:**

1. **Seed Roles:**
   ```
   Navigate to: Role Management
   Click: "Seed Initial Roles" button
   Wait for: Success message
   ```

2. **Seed Catalog:**
   ```
   Navigate to: Service Catalog → Admin Controls
   Click: "Seed Catalog" button
   Wait for: Success message
   ```

3. **Verify:**
   ```
   - Role Management should show 12 roles
   - Service Catalog should show ~91 services
   - Filter by "Pet Cafe" → 15 services
   - Filter by "Sunset Services" → 16 services
   ```

---

## Option 3: Use cURL (Terminal/Command Line)

```bash
# Replace these variables
PROJECT_ID="your-project-id"
ANON_KEY="your-anon-key"

BASE_URL="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"

# 1. Seed Roles
curl -X POST "${BASE_URL}/config/roles/seed" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json"

# 2. Seed Catalog
curl -X POST "${BASE_URL}/admin/catalog/seed" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json"

# 3. Verify Roles
curl "${BASE_URL}/config/roles" \
  -H "Authorization: Bearer ${ANON_KEY}"

# 4. Verify Services
curl "${BASE_URL}/admin/catalog/services" \
  -H "Authorization: Bearer ${ANON_KEY}"
```

---

## 🔍 Troubleshooting

### Issue: "CORS error" or "Failed to fetch"

**Solution:** Make sure you're running the code from the same domain as your app, or use cURL instead.

### Issue: "401 Unauthorized"

**Solution:** Check that your `publicAnonKey` is correct. Get it from `/utils/supabase/info.tsx` or your Supabase project settings.

### Issue: "Services still show 60"

**Possible causes:**
1. The seeding endpoint wasn't called (check console for request/response)
2. There was an error during seeding (check Network tab)
3. Browser cache (hard refresh with Ctrl+Shift+R)
4. Wrong project/environment

**Debug steps:**
```javascript
// Check the KV store directly
const checkKV = async () => {
  const response = await fetch(
    `${baseUrl}/admin/catalog/services`,
    { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
  );
  const data = await response.json();
  console.log('Database services:', data.services?.length);
  console.log('First 5 services:', data.services?.slice(0, 5));
};
checkKV();
```

### Issue: "Roles still show 11"

**Same as above** - the endpoint needs to be called to add the roles to the database.

---

## 📊 What Gets Seeded

### Roles (12 total, 2 new):
1. Veterinarian ✅ (existing)
2. Pet Groomer ✅ (existing)
3. Pet Trainer ✅ (existing)
4. Pet Walker ✅ (existing)
5. Pet Boarder ✅ (existing)
6. Pet Photographer ✅ (existing)
7. Pet Pharmacy ✅ (existing)
8. Pet Clinic ✅ (existing)
9. Insurance Provider ✅ (existing)
10. **Pet Cafe ⭐ NEW**
11. **Sunset Services ⭐ NEW**
12. Generic Service Provider ✅ (existing)

### Services (91 total, 31 new):
- Existing: ~60 services (vet, grooming, training, etc.)
- **Pet Cafe: 15 services ⭐ NEW**
- **Sunset Services: 16 services ⭐ NEW**

---

## ✅ Success Criteria

After seeding, you should see:

**In Admin Panel:**
- ✅ 12 roles in Role Management
- ✅ Pet Cafe (order 10) with ☕ icon
- ✅ Sunset Services (order 11) with 💜 icon
- ✅ ~91 services in Service Catalog
- ✅ Filter by "Pet Cafe" shows 15 services
- ✅ Filter by "Sunset Services" shows 16 services

**In Vendor App:**
- ✅ "Pet Cafe" appears in role selection
- ✅ "Pet Sunset Services" appears in role selection
- ✅ Selecting Pet Cafe shows custom fields (FSSAI License, Seating Capacity)
- ✅ Selecting Sunset Services shows custom fields (Crematorium License)

---

## 🚀 After Seeding

1. **Hard refresh** your browser (Ctrl+Shift+R / Cmd+Shift+R)
2. **Clear any filters** in Service Catalog
3. **Verify counts** match expected values
4. **Test vendor onboarding** for new roles

If you still don't see the changes after seeding, check:
- Browser console for errors
- Network tab for failed requests
- That you're on the correct project/environment

---

**Remember:** The seed data exists in your code files, but it won't appear in the frontend until you **RUN the seeding endpoints** to actually insert it into the database!
