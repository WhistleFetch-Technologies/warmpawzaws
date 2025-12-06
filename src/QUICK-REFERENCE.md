# 🐾 Warmpawz Problem Grid Search - Quick Reference Card

## 🚀 Test in 30 Seconds

```bash
# Replace YOUR_PROJECT and YOUR_ANON_KEY
curl "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/customer/staff-by-problem/veterinarian/cardiology?lat=28.6139&lng=77.2090" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq '.'
```

---

## 📡 API Endpoints

### Search by Problem
```
GET /customer/staff-by-problem/:roleId/:problemId?lat=X&lng=Y&radius=50
```

### Diagnostics
```
GET /admin/diagnostic/problem-search/:roleId/:problemId
GET /admin/diagnostic/staff-specializations/:roleId?withServices=true
```

### Update Specializations
```
POST /admin/staff/:staffId/specializations
Body: { "specializations": ["sub_specialty_services"] }
```

---

## 🎨 Problem IDs by Vendor Type

### Veterinarian
`cardiology` `surgery` `dermatology` `dentistry` `ophthalmology` `neurology` `medicine` `emergency` `physiotherapy`

### Groomer
`full_grooming` `bath_only` `haircut_styling` `nail_care` `deshedding` `spa_treatment`

### Trainer
`obedience_training` `puppy_training` `advanced_training` `agility_training` `protection_training`

### Dog Walker
`active_walk` `leisurely_walk` `puppy_walk` `group_walk`

### Behaviourist
`separation_anxiety` `aggression` `fear_phobia` `potty_training`

### Boarding
`short_stay` `long_stay` `daycare` `luxury_boarding`

---

## 🏷️ Specialization IDs

### Veterinarian
- `sub_preventive_wellness` - Preventive & Wellness
- `sub_diagnostics` - Diagnostics
- `sub_medical_treatment` - Medical Treatment
- `sub_surgical_services` - Surgical Services
- `sub_specialty_services` - Specialty Services
- `sub_emergency_critical` - Emergency & Critical
- `sub_vet_home` - Home Visits
- `sub_teleconsult` - Tele-consultation

### Groomer
- `sub_grooming_basic` - Basic Grooming
- `sub_grooming_specialty` - Specialty Grooming

### Trainer
- `sub_training_basic` - Basic Training
- `sub_training_advanced` - Advanced Training

### Dog Walker
- `sub_walking_services` - Walking Services

### Behaviourist
- `sub_behavior_modification` - Behavior Modification

### Boarding
- `sub_boarding_services` - Boarding Services
- `sub_boarding_premium` - Premium Boarding

---

## 🔧 Common Commands

### Test Search
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/customer/staff-by-problem/veterinarian/cardiology" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Run Diagnostic
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/admin/diagnostic/problem-search/veterinarian/cardiology" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Check Specializations
```bash
curl "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/admin/diagnostic/staff-specializations/veterinarian?withServices=true" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

### Set Specializations
```bash
curl -X POST \
  "https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/admin/staff/STAFF_ID/specializations" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"specializations": ["sub_specialty_services", "sub_diagnostics"]}'
```

---

## 📱 Mobile App Integration

### Search Call
```typescript
const response = await fetch(
  `${API_URL}/customer/staff-by-problem/${roleId}/${problemId}?lat=${lat}&lng=${lng}`,
  { headers: { 'Authorization': `Bearer ${ANON_KEY}` } }
);
const { staff, clinics, total } = await response.json();
```

### Response Structure
```typescript
{
  success: true,
  problem: { id, name, displayName, mappedSubCategories },
  staff: [
    {
      id, fullName, specialization, specializations,
      clinicName, consultationFee, rating, distance,
      services, serviceCount
    }
  ],
  clinics: [
    { id, name, matchingStaffCount, doctors }
  ],
  total: number
}
```

---

## 🧪 Testing Tools

### Web Dashboard
```bash
open problem-grid-test-dashboard.html
```

### Bash Script
```bash
chmod +x test-problem-grid.sh
./test-problem-grid.sh
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README-PROBLEM-GRID.md` | **Start here** - Overview |
| `NEXT-STEPS-PROBLEM-GRID.md` | Getting started guide |
| `SYSTEM-OVERVIEW.md` | Architecture details |
| `WARMPAWZ-STATUS-REPORT.md` | Complete status |
| `PROBLEM-GRID-SEARCH-TESTING.md` | Testing guide |
| `QUICK-REFERENCE.md` | This file - Quick ref |

---

## 🆘 Troubleshooting

### No Results?
1. Run diagnostic: `/admin/diagnostic/problem-search/:roleId/:problemId`
2. Check what's missing
3. Fix the issue
4. Test again

### Diagnostic Tells You:
- ✅ Vendors approved?
- ✅ Staff active?
- ✅ Services published?
- ✅ Specializations configured?

---

## ✅ Checklist

### Backend (Complete ✅)
- [x] API implemented
- [x] 32 problems defined
- [x] Specialization mapping
- [x] Diagnostic tools
- [x] Documentation

### Your Tasks (To Do)
- [ ] Test with your credentials
- [ ] Configure staff specializations
- [ ] Publish services
- [ ] Integrate into mobile app

---

## 🎯 Success Criteria

**System is working when:**
1. Diagnostic shows "SUCCESS"
2. Search returns staff
3. Staff have correct specializations
4. Distance calculations work

---

**Need More Help? Read `/NEXT-STEPS-PROBLEM-GRID.md`**
