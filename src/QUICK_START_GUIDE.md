# 🚀 WARMPAWZ PROBLEM GRID - QUICK START GUIDE

## ⚡ TL;DR - What You Need to Know

### The Problem Grid System:
**Instead of** users browsing lists of vendors → **Now** users select their pet's problem/need first → System finds matching specialists automatically.

### What Works Now:
- ✅ **Backend API**: 100% complete, tested, production-ready
- ✅ **VET flow**: Complete end-to-end (landing → problem grid → discovery → booking)
- ⚠️ **Other vendors**: Backend ready, need 2 hours to connect UI

---

## 🎯 Quick Test (2 minutes)

### Test the Universal API:

```bash
# Replace YOUR_PROJECT_ID and YOUR_ANON_KEY
export PROJECT_ID="your-project-id"
export ANON_KEY="your-anon-key"

# Test Vet Problem Discovery
curl "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/customer/universal-problem-discovery?roleId=veterinarian&problemGridId=skin_issues&sortBy=rating" \
  -H "Authorization: Bearer ${ANON_KEY}"

# Test Groomer Problem Discovery  
curl "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/customer/universal-problem-discovery?roleId=groomer&problemGridId=full_grooming&sortBy=rating" \
  -H "Authorization: Bearer ${ANON_KEY}"
```

**Expected:** JSON response with specialists matching the problem

---

## 📁 Key Files

### Backend APIs:
```
/supabase/functions/server/
├── universal-problem-discovery.tsx          ⭐ MAIN API
├── problem-grid-catalog.tsx                 ⭐ PROBLEM DEFINITIONS
├── db-schema-documentation.tsx              📖 DATA CONTRACTS
├── booking-validation-middleware.tsx        🛡️ VALIDATION
└── booking-lifecycle.tsx                    🔄 CANCEL/RESCHEDULE
```

### Frontend Components:
```
/components/customer/
├── ProblemGridSelector.tsx                  ⭐ UNIVERSAL (all vendors)
├── VendorDiscoveryByProblem.tsx            ⭐ UNIVERSAL (all vendors)
├── AppointmentDetails.tsx                   🆕 BOOKING DETAILS
└── VetServiceRouter.tsx                     ✅ REFERENCE IMPLEMENTATION
```

### Testing:
```
/test-problem-grid-apis.sh                   🧪 37 TEST CASES
/API_TESTING_REPORT.md                       📊 DETAILED ANALYSIS
/FINAL_IMPLEMENTATION_REPORT.md              📋 FULL DOCS
```

---

## 🔌 API Quick Reference

### 1. Discover Specialists by Problem

```
GET /customer/universal-problem-discovery
```

**Required Params:**
- `roleId`: veterinarian, groomer, trainer, walker, behaviourist, boarding_center
- `problemGridId`: skin_issues, full_grooming, basic_obedience, etc.

**Optional Params:**
- `lat`, `lon`: For distance sorting
- `feeMin`, `feeMax`: Price filtering
- `sortBy`: rating, fee_low, fee_high, experience, distance

**Example:**
```
/customer/universal-problem-discovery?roleId=groomer&problemGridId=full_grooming&sortBy=rating
```

---

### 2. Get All Problems for a Vendor Type

```
GET /customer/problem-grid/:roleId
```

**Example:**
```
/customer/problem-grid/veterinarian
/customer/problem-grid/groomer
/customer/problem-grid/trainer
```

**Returns:** Array of all problem grids for that vendor type

---

## 🏗️ How to Add Problem Grid to a Service Router

**Example: GroomingServiceRouter.tsx**

### Step 1: Import Components (top of file)

```typescript
import { ProblemGridSelector } from './ProblemGridSelector';
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem';
```

### Step 2: Add Views (update ViewType)

```typescript
type ViewType = 
  | 'landing'
  | 'problem_grid'        // ADD THIS
  | 'problem_discovery'   // ADD THIS
  | ... existing types
```

### Step 3: Add State

```typescript
const [selectedProblem, setSelectedProblem] = useState<any>(null);
```

### Step 4: Add Navigation Handlers (in component)

```typescript
// Handle navigation from landing
const handleGroomingNavigate = (screen: string, data?: any) => {
  if (screen === 'problem_grid') {
    setCurrentView('problem_grid');
    return;
  }
  // ... existing navigation
};

// Add views before return statement
if (currentView === 'problem_grid') {
  return (
    <ProblemGridSelector
      roleId="groomer"
      roleName="Groomer"
      onBack={() => setCurrentView('landing')}
      onProblemSelect={(problem) => {
        setSelectedProblem(problem);
        setCurrentView('problem_discovery');
      }}
      customerId={customerId}
      phone={phone}
    />
  );
}

if (currentView === 'problem_discovery' && selectedProblem) {
  return (
    <VendorDiscoveryByProblem
      roleId="groomer"
      roleName="Groomer"
      problem={selectedProblem}
      onBack={() => setCurrentView('problem_grid')}
      onVendorSelect={(vendor) => {
        // Navigate to booking flow
        setBookingFlow(prev => ({
          ...prev,
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName
        }));
        setCurrentView('select_service'); // or your service selection view
      }}
      customerId={customerId}
      phone={phone}
    />
  );
}
```

### Step 5: Update Landing Page Clicks

In `GroomingServicesLanding.tsx` (line ~374):

```typescript
// BEFORE:
onClick={() => {
  onNavigate('problem_selected', { problemId: need.id }); // BROKEN
}}

// AFTER:
onClick={() => {
  onNavigate('problem_grid'); // Works!
}}
```

**Done!** Problem grid now works for this vendor type.

---

## 🎨 Problem Grid IDs Reference

### Veterinarian
- `skin_issues`, `digestive_issues`, `respiratory_issues`, `injury`, `vaccination`, `routine_checkup`, `dental_care`, `behavioral_consult`, `senior_care`, `nutrition_consult`, `surgery`, `parasites`

### Groomer
- `full_grooming`, `bath_brush`, `hair_trim`, `nail_clipping`, `ear_cleaning`, `teeth_cleaning`, `de_shedding`, `spa_treatment`

### Trainer
- `basic_obedience`, `puppy_training`, `advanced_training`, `agility_training`, `leash_training`, `potty_training`, `socialization`, `protection_training`, `therapy_dog`, `tricks_training`

### Walker
- `daily_walks`, `exercise_sessions`, `group_walks`, `running_sessions`, `hiking_trips`, `senior_gentle_walks`

### Behaviourist
- `aggression`, `anxiety`, `separation_anxiety`, `excessive_barking`, `destructive_behavior`, `fear_phobia`, `compulsive_behavior`, `socialization_issues`, `resource_guarding`

### Boarding Center
- `short_stay`, `long_stay`, `daycare`, `luxury_boarding`, `special_needs_boarding`, `training_boarding`, `overnight_care`

---

## ⚠️ Common Issues

### Issue: "Problem grid not found (404)"
**Solution:** Check problemGridId spelling (case-sensitive), must match IDs above

### Issue: Empty results
**Causes:**
1. No vendors of that role are approved
2. No staff are active
3. Staff don't have services matching the problem's subcategories

**Debug:**
```bash
# Check if problem exists
curl ".../customer/problem-grid/veterinarian"

# Check with broader filters
curl ".../universal-problem-discovery?roleId=veterinarian&problemGridId=skin_issues&feeMax=999999"
```

### Issue: roleId parameter missing (400)
**Solution:** Always include `roleId` in query params

---

## 📊 Testing Checklist

### Before Deploying:
- [ ] Run `./test-problem-grid-apis.sh`
- [ ] Verify all 37 tests pass
- [ ] Test vet flow end-to-end in UI
- [ ] Test groomer flow end-to-end in UI
- [ ] Test trainer flow end-to-end in UI
- [ ] Test walker flow end-to-end in UI
- [ ] Test behaviourist flow end-to-end in UI
- [ ] Test boarding flow end-to-end in UI
- [ ] Verify OTP appears after booking
- [ ] Test "Get Directions" for clinic visits
- [ ] Test cancel booking flow
- [ ] Test reschedule booking flow

---

## 🆘 Need More Help?

### Detailed Documentation:
- **Full API Specs**: `/API_TESTING_REPORT.md`
- **Implementation Details**: `/FINAL_IMPLEMENTATION_REPORT.md`
- **Progress Tracking**: `/IMPLEMENTATION_STATUS.md`
- **Data Contracts**: `/supabase/functions/server/db-schema-documentation.tsx`

### Reference Implementation:
- **See VetServiceRouter** for complete working example
- Lines 576-602: Problem grid navigation
- Lines 603-630: Vendor discovery navigation

---

## 🎉 Success Criteria

You'll know it's working when:
1. ✅ User taps problem on landing page
2. ✅ ProblemGridSelector shows all problems
3. ✅ User selects a problem
4. ✅ VendorDiscoveryByProblem shows matching specialists
5. ✅ User can book with a specialist
6. ✅ Booking confirmation shows with OTP
7. ✅ "View Appointment Details" shows full booking info

---

**Quick Start Complete!** You now have everything you need to implement problem grid discovery for all vendor types.

**Estimated Time:** 2-3 hours to wire up all remaining routers  
**Difficulty:** Easy (just copy VetServiceRouter pattern)

**Questions?** Check the detailed docs listed above. 🚀
