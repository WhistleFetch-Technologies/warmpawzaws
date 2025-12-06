# 🐾 Warmpawz Problem Grid Search - System Overview

## 🎯 What This System Does

The **Problem Grid Search** system allows customers to find pet service providers based on their **specific needs**, not just by service categories.

### Example: Traditional vs Problem-Based Search

**❌ Old Way (Category-Based):**
```
Customer: "I need a vet"
App: Shows all vets
Customer: Has to browse through all to find a cardiologist
```

**✅ New Way (Problem-Based):**
```
Customer: Taps "Heart & Cardiovascular" problem card
App: Shows ONLY cardiologists
Customer: Finds specialist immediately
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CUSTOMER MOBILE APP                     │
│                    (Orange Brand #FF8C42)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Request
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTION                    │
│                  (Deno Runtime + Hono Server)                │
│                                                              │
│  Route: /customer/staff-by-problem/:roleId/:problemId       │
│                                                              │
│  1. Validate problem from catalog                           │
│  2. Get mapped subcategories                                │
│  3. Find approved vendors                                   │
│  4. Get active staff                                        │
│  5. Filter by specializations                               │
│  6. Return matched staff + clinics                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ KV Store Queries
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUPABASE POSTGRES                       │
│                      (KV Store Table)                        │
│                                                              │
│  • vendor:vendor_*        (Clinic/center data)              │
│  • staff:staff_*          (Doctor/staff data)               │
│  • service:service_*      (Service offerings)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow

### 1. Problem Catalog
```javascript
// Defined in: problem-grid-catalog.tsx
{
  id: 'cardiology',
  name: 'Cardiology',
  displayName: 'Heart & Cardiovascular',
  icon: '❤️',
  color: '#EC4899',
  mappedSubCategories: ['sub_specialty_services', 'sub_diagnostics']
}
```

### 2. Staff Specializations
```javascript
// Stored in KV store
{
  id: 'staff_abc123',
  fullName: 'Dr. Rajesh Kumar',
  specializations: ['sub_specialty_services', 'sub_diagnostics'],
  // ✅ MATCHES cardiology problem!
}
```

### 3. Search Response
```javascript
{
  success: true,
  problem: { id: 'cardiology', name: 'Heart & Cardiovascular', ... },
  staff: [
    {
      id: 'staff_abc123',
      fullName: 'Dr. Rajesh Kumar',
      clinicName: 'HeartCare Vet Clinic',
      consultationFee: 800,
      rating: 4.8,
      distance: 2.3,
      serviceCount: 5
    }
  ],
  clinics: [
    {
      id: 'vendor_xyz789',
      name: 'HeartCare Vet Clinic',
      matchingStaffCount: 2,
      doctors: [...]
    }
  ],
  total: 1
}
```

---

## 🎨 Problem Categories by Vendor Type

### 🏥 Veterinarian (9 Problems)
| Problem | Display Name | Icon | Subcategories |
|---------|--------------|------|---------------|
| `cardiology` | Heart & Cardiovascular | ❤️ | Specialty Services, Diagnostics |
| `surgery` | Surgery & Procedures | 🔪 | Surgical Services |
| `dermatology` | Skin & Coat Care | 🦴 | Specialty Services, Medical Treatment |
| `dentistry` | Dental Care | 🦷 | Specialty Services |
| `ophthalmology` | Eye Care | 👁️ | Specialty Services |
| `neurology` | Neurological Care | 🧠 | Specialty Services |
| `medicine` | General Health | 💊 | Preventive Wellness, Medical Treatment |
| `emergency` | Emergency Care | 🚨 | Emergency & Critical Care |
| `physiotherapy` | Physical Therapy | 🏃 | Specialty Services |

### ✂️ Groomer (6 Problems)
| Problem | Display Name | Icon | Subcategories |
|---------|--------------|------|---------------|
| `full_grooming` | Complete Grooming | ✂️ | Basic Grooming, Specialty Grooming |
| `bath_only` | Bath & Brush | 🛁 | Basic Grooming |
| `haircut_styling` | Haircut & Styling | 💇 | Basic Grooming |
| `nail_care` | Nail Trimming | 💅 | Basic Grooming |
| `deshedding` | De-shedding | 🌪️ | Specialty Grooming |
| `spa_treatment` | Spa & Wellness | 🧖 | Specialty Grooming |

### 🎓 Trainer (5 Problems)
| Problem | Display Name | Icon | Subcategories |
|---------|--------------|------|---------------|
| `obedience_training` | Basic Obedience | 🎓 | Basic Training |
| `puppy_training` | Puppy Training | 🐕 | Basic Training |
| `advanced_training` | Advanced Commands | 🏆 | Advanced Training |
| `agility_training` | Agility Training | 🏃 | Advanced Training |
| `protection_training` | Protection Training | 🛡️ | Advanced Training |

### 🚶 Dog Walker (4 Problems)
| Problem | Display Name | Icon | Subcategories |
|---------|--------------|------|---------------|
| `active_walk` | Active/Exercise Walk | 🏃 | Walking Services |
| `leisurely_walk` | Leisurely Walk | 🚶 | Walking Services |
| `puppy_walk` | Puppy Walking | 🐕 | Walking Services |
| `group_walk` | Group Walking | 👥 | Walking Services |

### 🧠 Behaviourist (4 Problems)
| Problem | Display Name | Icon | Subcategories |
|---------|--------------|------|---------------|
| `separation_anxiety` | Separation Anxiety | 😰 | Behavior Modification |
| `aggression` | Aggression Issues | 😠 | Behavior Modification |
| `fear_phobia` | Fear & Phobias | 😨 | Behavior Modification |
| `potty_training` | Potty Training Issues | 🚽 | Behavior Modification |

### 🏠 Boarding (4 Problems)
| Problem | Display Name | Icon | Subcategories |
|---------|--------------|------|---------------|
| `short_stay` | Short Stay (1-3 days) | 📅 | Boarding Services |
| `long_stay` | Long Stay (Weekly+) | 🗓️ | Boarding Services |
| `daycare` | Daycare Services | ☀️ | Boarding Services |
| `luxury_boarding` | Luxury Boarding | 💎 | Premium Boarding |

---

## 🔧 Specialization System

### How It Works

```
PROBLEM → SUBCATEGORIES → STAFF SPECIALIZATIONS
```

**Example: Cardiology Search**
```
1. Problem: "cardiology"
   ↓
2. Maps to: ["sub_specialty_services", "sub_diagnostics"]
   ↓
3. Find staff with ANY of these specializations
   ↓
4. Return matched staff
```

### Valid Specialization IDs

#### For Veterinarians
- `sub_preventive_wellness` - Preventive & Wellness Care
- `sub_diagnostics` - Diagnostics (X-ray, ultrasound, blood tests)
- `sub_medical_treatment` - Medical Treatment (medications, IV therapy)
- `sub_surgical_services` - Surgical Services (operations)
- `sub_specialty_services` - Specialty Services (cardiology, dermatology, etc.)
- `sub_emergency_critical` - Emergency & Critical Care
- `sub_vet_home` - Home Visit Services
- `sub_teleconsult` - Tele-consultation

#### For Groomers
- `sub_grooming_basic` - Basic Grooming
- `sub_grooming_specialty` - Specialty Grooming

#### For Trainers
- `sub_training_basic` - Basic Training
- `sub_training_advanced` - Advanced Training

#### For Dog Walkers
- `sub_walking_services` - Walking Services

#### For Behaviourists
- `sub_behavior_modification` - Behavior Modification

#### For Boarding
- `sub_boarding_services` - Boarding Services
- `sub_boarding_premium` - Premium Boarding

---

## 🎯 Matching Algorithm

```javascript
// Simplified version of the matching logic

function matchStaffToProblem(staff, problem) {
  // 1. Get problem's mapped subcategories
  const requiredSubcategories = problem.mappedSubCategories;
  // Example: ["sub_specialty_services", "sub_diagnostics"]
  
  // 2. Get staff's specializations
  const staffSpecs = staff.specializations || [];
  // Example: ["sub_specialty_services", "sub_diagnostics"]
  
  // 3. Check if ANY specialization matches
  const hasMatch = staffSpecs.some(spec => 
    requiredSubcategories.includes(spec)
  );
  
  // 4. Also support display names
  const displayNameMatch = requiredSubcategories.some(subcat => 
    displayNameAliases[staff.specialization]?.includes(subcat)
  );
  
  return hasMatch || displayNameMatch;
}
```

### Matching Rules
1. ✅ **Exact ID match**: Staff has `sub_specialty_services` → Matches cardiology
2. ✅ **Array contains**: Staff has `["sub_specialty_services", "other"]` → Matches
3. ✅ **Display name**: Staff has `"Heart & Cardiovascular"` → Automatically mapped
4. ✅ **Case insensitive**: All matching is case-insensitive
5. ✅ **Partial match**: Normalized string matching for variations

---

## 📱 Mobile App Integration Example

### Step 1: Display Problem Grid
```typescript
// VetDashboard.tsx
const VetProblemsGrid = () => {
  const problems = [
    { id: 'cardiology', name: 'Heart & Cardiovascular', icon: '❤️', color: '#EC4899' },
    { id: 'surgery', name: 'Surgery & Procedures', icon: '🔪', color: '#EF4444' },
    // ... more
  ];
  
  return (
    <View style={styles.grid}>
      {problems.map(problem => (
        <TouchableOpacity 
          key={problem.id}
          onPress={() => searchByProblem(problem.id)}
          style={[styles.card, { borderColor: problem.color }]}
        >
          <Text style={styles.icon}>{problem.icon}</Text>
          <Text style={styles.name}>{problem.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

### Step 2: Search API Call
```typescript
const searchByProblem = async (problemId: string) => {
  const { latitude, longitude } = await getCurrentLocation();
  
  const response = await fetch(
    `${API_URL}/customer/staff-by-problem/veterinarian/${problemId}?lat=${latitude}&lng=${longitude}&radius=50`,
    {
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`
      }
    }
  );
  
  const data = await response.json();
  
  // Navigate to results
  navigation.navigate('SearchResults', {
    problem: data.problem,
    staff: data.staff,
    clinics: data.clinics
  });
};
```

### Step 3: Display Results
```typescript
const SearchResults = ({ route }) => {
  const { problem, staff, clinics } = route.params;
  
  return (
    <ScrollView>
      <Text style={styles.header}>
        {problem.icon} {problem.displayName}
      </Text>
      
      {staff.map(doctor => (
        <StaffCard 
          key={doctor.id}
          doctor={doctor}
          onBook={() => bookAppointment(doctor)}
        />
      ))}
    </ScrollView>
  );
};
```

---

## 🔍 Diagnostic Tools

### 1. Problem Search Diagnostic
**Purpose:** Check if search will work BEFORE running it

```bash
GET /admin/diagnostic/problem-search/:roleId/:problemId
```

**Returns:**
- ✅ Step-by-step validation
- ✅ Issues found
- ✅ Recommendations to fix
- ✅ Expected result count

### 2. Staff Specializations Diagnostic
**Purpose:** View all staff and their specialization config

```bash
GET /admin/diagnostic/staff-specializations/:roleId?withServices=true
```

**Returns:**
- Total staff count
- Staff with services
- Staff matching problem grid
- Detailed staff list with specializations

---

## 🚦 System Status Indicators

### ✅ Fully Working
```
• Approved vendors exist
• Active staff configured
• Specializations set correctly
• Services published
• Search returns results
```

### ⚠️ Partially Working
```
• Vendors exist but staff missing specializations
• Staff exist but no published services
• Services exist but wrong publish status
```

### ❌ Not Working
```
• No approved vendors
• No active staff
• No services
• Specializations not configured
```

---

## 📊 Success Metrics

Track these metrics in production:

1. **Problem Search Usage**
   - Which problems are searched most?
   - Do customers prefer problem search vs regular search?

2. **Match Quality**
   - Are search results relevant?
   - Do customers book from problem search?

3. **Coverage**
   - How many staff match each problem?
   - Which problems have low coverage?

4. **Performance**
   - Average search response time
   - Results per problem category

---

## 🎓 Key Concepts Summary

### Problem Grid
- User-facing problem categories
- Maps customer needs to backend subcategories
- Each problem has icon, color, description

### Subcategories
- Internal service classification
- Used for specialization matching
- Links problems to staff expertise

### Specializations
- Staff expertise areas
- Can be array of IDs or display names
- Determines which problems staff match

### Matching
- Staff appears if specialization matches ANY problem subcategory
- Multiple matching strategies supported
- Flexible to handle various data formats

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `/PROBLEM-GRID-SEARCH-TESTING.md` | Complete testing guide with curl examples |
| `/NEXT-STEPS-PROBLEM-GRID.md` | Step-by-step guide to get started |
| `/SYSTEM-OVERVIEW.md` | This file - high-level overview |
| `/problem-grid-test-dashboard.html` | Visual testing dashboard |
| `/test-problem-grid.sh` | Automated bash test suite |

---

## 🎯 Quick Start

1. **Read** `/NEXT-STEPS-PROBLEM-GRID.md` for detailed steps
2. **Test** using `/problem-grid-test-dashboard.html`
3. **Verify** with diagnostic endpoints
4. **Integrate** into mobile app
5. **Monitor** search usage and results

---

**Questions? Check the diagnostic endpoints - they'll tell you exactly what's happening! 🔍**
