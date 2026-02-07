# Specialization Master Plan: Problem Grid & Vendor Specialization Unification

## Executive Summary

This plan transforms the **Categories tab in Catalog & Services** into a comprehensive master system for:
- Problem Grid items (customer-facing)
- Vendor Specializations (vendor profile configuration)
- Symptom/Condition mappings (searchable by customers)

---

## 1. Current State Analysis

### 1.1 Existing Tables

| Table | Purpose | Status |
|-------|---------|--------|
| `service_categories` | 10 high-level categories (veterinary, grooming, etc.) | ✅ Active |
| `service_catalog` | 65+ services linked to categories & roles | ✅ Active |
| `problem_grid_mappings` | Maps problems to subcategories & roles | ✅ Active |
| `vendor_specializations` | Vendor-selected specializations | ✅ Active |
| `vendors.specializations` | JSONB array in vendor profile | ⚠️ Redundant |

### 1.2 Current Data Flow

```
service_categories (Veterinary, Grooming...)
        ↓
service_catalog (General Health, Surgery, Grooming Full...)
        ↓
problem_grid_mappings (problem_id → sub_category_id → role_id)
        ↓
vendor_specializations (vendor picks from problem_grid)
        ↓
Customer selects problem → Matches vendor specializations
```

### 1.3 Current Specializations (Hardcoded)

**Veterinarian (10):** surgery, dermatology, dentistry, ophthalmology, cardiology, neurology, medicine, emergency, orthopedic, physiotherapy

**Groomer (6):** full_grooming, bath_only, haircut_styling, nail_care, deshedding, spa_treatment

**Trainer (6):** basic_obedience, potty_training, socialization, aggression, advanced_training, leash_training

### 1.4 Gap Analysis

| Issue | Impact |
|-------|--------|
| Specializations hardcoded in multiple places | Hard to add new ones |
| No symptom/condition linkage | Customers can't search by symptoms |
| Icons inconsistent across UI | Poor UX |
| No admin UI to manage specializations | Requires code changes |
| Problem grid static in customer app | Can't dynamically update |

---

## 2. Proposed Architecture

### 2.1 New Unified Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ADMIN: Categories Tab                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SERVICE CATEGORY (Level 1)                                         │
│  ├── Name: Veterinary                                               │
│  ├── Icon: 🩺                                                       │
│  │                                                                  │
│  └── SPECIALIZATIONS (Level 2) - Problem Grid Items                 │
│      ├── General Health                                             │
│      │   ├── Applicable Roles: [vet_solo, vet_clinic]              │
│      │   ├── Icon: ❤️                                               │
│      │   ├── Display on: [Customer Problem Grid, Vendor Profile]    │
│      │   └── SYMPTOMS (Level 3) - Editable List                     │
│      │       ├── Vomiting                                           │
│      │       ├── Fever                                              │
│      │       ├── Loss of appetite                                   │
│      │       ├── Lethargy                                           │
│      │       └── Diarrhea                                           │
│      │                                                              │
│      ├── Surgery & Procedures                                       │
│      │   ├── Applicable Roles: [vet_solo, vet_clinic]              │
│      │   ├── Icon: 🔪                                               │
│      │   └── SYMPTOMS                                               │
│      │       ├── Tumor/Lump                                         │
│      │       ├── Injury                                             │
│      │       ├── Spay/Neuter                                        │
│      │       └── Orthopedic issues                                  │
│      │                                                              │
│      └── Cardiology                                                 │
│          ├── Applicable Roles: [vet_clinic]  ← Only clinics        │
│          ├── Icon: 💓                                               │
│          └── SYMPTOMS                                               │
│              ├── Breathing difficulty                               │
│              ├── Coughing                                           │
│              ├── Fainting                                           │
│              └── Exercise intolerance                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Model

```
service_categories (Veterinary, Grooming, Training...)
        │
        ▼
specialization_master (NEW)
   ├── id (UUID)
   ├── specialization_id (TEXT) ─────────► Used as problem_id
   ├── name / display_name
   ├── category_id (FK)
   ├── applicable_roles (TEXT[])
   ├── icon_name (TEXT) ─────────────────► Theme icon library
   ├── icon_emoji (TEXT) ────────────────► Fallback emoji
   ├── display_order
   ├── is_active
   ├── show_in_problem_grid (BOOLEAN)
   ├── show_in_vendor_profile (BOOLEAN)
   └── metadata (JSONB)
        │
        ▼
specialization_symptoms (NEW)
   ├── id (UUID)
   ├── specialization_id (FK)
   ├── symptom_name (TEXT)
   ├── symptom_keywords (TEXT[]) ────────► For search
   ├── display_order
   └── is_active
```

---

## 3. Database Schema Changes

### 3.1 New Table: `specialization_master`

```sql
CREATE TABLE specialization_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialization_id TEXT UNIQUE NOT NULL,  -- e.g., 'general_health', 'surgery'
    name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,
    
    -- Category linkage
    category_id TEXT REFERENCES service_categories(category_id),
    
    -- Role configuration
    applicable_roles TEXT[] NOT NULL DEFAULT '{}',  -- ['vet_solo', 'vet_clinic']
    
    -- Icons
    icon_name TEXT,           -- Lucide icon name: 'heart', 'scissors', 'stethoscope'
    icon_emoji TEXT,          -- Fallback: '❤️', '✂️', '🩺'
    icon_color TEXT,          -- Hex color: '#FF6B6B'
    
    -- Display settings
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    show_in_problem_grid BOOLEAN DEFAULT true,
    show_in_vendor_profile BOOLEAN DEFAULT true,
    
    -- Service style restrictions
    allowed_service_styles JSONB DEFAULT '["at_home", "at_center", "tele"]'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spec_master_category ON specialization_master(category_id);
CREATE INDEX idx_spec_master_roles ON specialization_master USING GIN(applicable_roles);
CREATE INDEX idx_spec_master_active ON specialization_master(is_active) WHERE is_active = true;
```

### 3.2 New Table: `specialization_symptoms`

```sql
CREATE TABLE specialization_symptoms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    specialization_id TEXT NOT NULL REFERENCES specialization_master(specialization_id) ON DELETE CASCADE,
    symptom_name TEXT NOT NULL,
    symptom_display_name TEXT,
    symptom_keywords TEXT[] DEFAULT '{}',  -- ['vomit', 'throwing up', 'nausea']
    pet_types TEXT[] DEFAULT '{}',         -- ['dog', 'cat', 'bird']
    severity_indicator TEXT CHECK (severity_indicator IN ('low', 'medium', 'high', 'emergency')),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(specialization_id, symptom_name)
);

CREATE INDEX idx_symptoms_spec ON specialization_symptoms(specialization_id);
CREATE INDEX idx_symptoms_keywords ON specialization_symptoms USING GIN(symptom_keywords);
```

---

## 4. Backfill Strategy

### 4.1 Migrate from `problem_grid_mappings`

```sql
-- Backfill specialization_master from existing problem_grid_mappings
INSERT INTO specialization_master (
    specialization_id, name, display_name, category_id, 
    applicable_roles, icon_emoji, display_order
)
SELECT DISTINCT
    pgm.problem_id as specialization_id,
    pgm.problem_name as name,
    COALESCE(pgm.problem_display_name, pgm.problem_name) as display_name,
    sc.category_id,
    ARRAY_AGG(DISTINCT pgm.role_id) as applicable_roles,
    '🔹' as icon_emoji,
    pgm.order_index as display_order
FROM problem_grid_mappings pgm
LEFT JOIN service_catalog sc ON pgm.sub_category_id = sc.sub_category_id
GROUP BY pgm.problem_id, pgm.problem_name, pgm.problem_display_name, 
         sc.category_id, pgm.order_index
ON CONFLICT (specialization_id) DO NOTHING;
```

### 4.2 Seed Default Symptoms

| Specialization | Default Symptoms |
|---------------|------------------|
| general_health | Vomiting, Fever, Diarrhea, Loss of appetite, Lethargy, Weight loss |
| dermatology | Itching, Hair loss, Rashes, Hot spots, Skin infections, Allergies |
| surgery | Tumor/Lump, Injury, Spay/Neuter, Foreign body, Fracture |
| cardiology | Breathing difficulty, Coughing, Fainting, Exercise intolerance |
| dentistry | Bad breath, Tartar, Tooth pain, Swollen gums, Broken tooth |
| ophthalmology | Eye discharge, Redness, Cloudiness, Squinting, Blindness |
| orthopedic | Limping, Joint pain, Difficulty walking, Swelling, Stiffness |
| emergency | Unconscious, Bleeding, Poisoning, Seizures, Trauma |

---

## 5. Admin UI Changes (Categories Tab)

### 5.1 Enhanced Categories Tab Structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CATALOG & SERVICES > Categories                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  [Search categories...]    [+ Add Category]                               │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🩺 Veterinary                                              [Expand] │ │
│  │    12 specializations • 48 symptoms                                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│       ↓ Expanded view:                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🩺 Veterinary                                           [Collapse]  │ │
│  │                                                                      │ │
│  │  Specializations:                        [+ Add Specialization]     │ │
│  │  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │  │ ❤️ General Health                                              │ │ │
│  │  │    Roles: Vet Solo, Vet Clinic                                 │ │ │
│  │  │    Symptoms: Vomiting, Fever, Diarrhea (+3 more)              │ │ │
│  │  │                                         [Edit] [Symptoms] [⋮]  │ │ │
│  │  └────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │  │ 🔪 Surgery & Procedures                                        │ │ │
│  │  │    Roles: Vet Solo, Vet Clinic                                 │ │ │
│  │  │    Symptoms: Tumor, Injury, Spay/Neuter (+2 more)             │ │ │
│  │  │                                         [Edit] [Symptoms] [⋮]  │ │ │
│  │  └────────────────────────────────────────────────────────────────┘ │ │
│  │  ┌────────────────────────────────────────────────────────────────┐ │ │
│  │  │ 💓 Cardiology                                                  │ │ │
│  │  │    Roles: Vet Clinic (Only)                                    │ │ │
│  │  │    Symptoms: Breathing difficulty, Coughing (+2 more)         │ │ │
│  │  │                                         [Edit] [Symptoms] [⋮]  │ │ │
│  │  └────────────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ✂️ Grooming                                                [Expand] │ │
│  │    6 specializations • 18 symptoms                                   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Add/Edit Specialization Modal

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Add Specialization                                              [×]     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Category: [Veterinary ▼]                                                │
│                                                                           │
│  Specialization ID: [nephrology________]  (auto-generated, editable)    │
│                                                                           │
│  Display Name: [Kidney & Nephrology___]                                  │
│                                                                           │
│  Description: [Treatment for kidney diseases and urinary issues___]     │
│                                                                           │
│  Icon:                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ [🫘] [💧] [🩺] [❤️] [🦴] [🔪] [👁️] [🦷] [🧠] [🫁] [Search icons...] │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  Selected: 🫘 (or Lucide: kidney)                                        │
│                                                                           │
│  Applicable Roles:                                                       │
│  ☑️ Veterinarian (Solo)                                                  │
│  ☑️ Veterinary Clinic                                                    │
│  ☐ Pet Hospital                                                          │
│                                                                           │
│  Display Settings:                                                       │
│  ☑️ Show in Customer Problem Grid                                        │
│  ☑️ Show in Vendor Profile Specializations                               │
│                                                                           │
│  Service Styles Allowed:                                                 │
│  ☑️ At Center    ☑️ At Home    ☑️ Tele-consultation                      │
│                                                                           │
│                                        [Cancel]  [Save Specialization]   │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Manage Symptoms Modal

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Symptoms: General Health (Veterinary)                           [×]     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  [+ Add Symptom]                        [Search symptoms...]             │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ⚪ Vomiting                                                        │  │
│  │    Keywords: vomit, throwing up, regurgitation, nausea             │  │
│  │    Pets: All                          Severity: Medium             │  │
│  │                                                    [Edit] [Delete] │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ 🔴 Fever                                                           │  │
│  │    Keywords: temperature, hot, warm nose                           │  │
│  │    Pets: Dog, Cat                     Severity: High               │  │
│  │                                                    [Edit] [Delete] │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ ⚪ Diarrhea                                                        │  │
│  │    Keywords: loose stool, runny, upset stomach                     │  │
│  │    Pets: All                          Severity: Medium             │  │
│  │                                                    [Edit] [Delete] │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Drag to reorder                                      [Save Changes]     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Icon Library

### 6.1 Theme-Consistent Icons (Lucide)

| Specialization | Lucide Icon | Emoji Fallback | Color |
|---------------|-------------|----------------|-------|
| General Health | `heart-pulse` | ❤️ | #FF6B6B |
| Surgery | `scissors` | 🔪 | #4ECDC4 |
| Dermatology | `sparkles` | ✨ | #FFE66D |
| Dentistry | `smile` | 🦷 | #95E1D3 |
| Cardiology | `heart` | 💓 | #FF6B6B |
| Ophthalmology | `eye` | 👁️ | #A8D8EA |
| Neurology | `brain` | 🧠 | #DDA0DD |
| Orthopedic | `bone` | 🦴 | #F5DEB3 |
| Emergency | `siren` | 🚨 | #FF4444 |
| Grooming Full | `sparkles` | ✨ | #FFB6C1 |
| Bath & Hygiene | `droplets` | 💧 | #87CEEB |
| Haircut | `scissors` | ✂️ | #DDA0DD |
| Nail Care | `hand` | 💅 | #FFB6C1 |
| Training | `graduation-cap` | 🎓 | #90EE90 |
| Walking | `footprints` | 🐾 | #98D8C8 |
| Boarding | `home` | 🏠 | #FFE4B5 |
| Nutrition | `apple` | 🍎 | #90EE90 |

### 6.2 Icon Component

```tsx
// components/ui/SpecializationIcon.tsx
interface SpecializationIconProps {
  iconName?: string;      // Lucide icon name
  iconEmoji?: string;     // Fallback emoji
  iconColor?: string;     // Hex color
  size?: 'sm' | 'md' | 'lg';
}

export const SpecializationIcon = ({ 
  iconName, 
  iconEmoji, 
  iconColor = '#FF8C42',
  size = 'md' 
}) => {
  const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  
  if (iconName) {
    const LucideIcon = Icons[iconName];
    return <LucideIcon className={sizeClasses[size]} style={{ color: iconColor }} />;
  }
  
  return <span className={`text-${size === 'sm' ? 'sm' : size === 'lg' ? '2xl' : 'lg'}`}>{iconEmoji}</span>;
};
```

---

## 7. API Endpoints

### 7.1 New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/admin/specializations` | List all specializations (admin) |
| GET | `/admin/specializations/:categoryId` | List by category |
| POST | `/admin/specializations` | Create specialization |
| PUT | `/admin/specializations/:id` | Update specialization |
| DELETE | `/admin/specializations/:id` | Delete (soft) |
| GET | `/admin/specializations/:id/symptoms` | List symptoms |
| POST | `/admin/specializations/:id/symptoms` | Add symptom |
| PUT | `/admin/symptoms/:id` | Update symptom |
| DELETE | `/admin/symptoms/:id` | Delete symptom |
| GET | `/public/problem-grid/:roleId` | Customer problem grid |
| GET | `/vendor/specializations/:roleId` | Vendor profile options |

### 7.2 Response Format

```json
// GET /admin/specializations
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "specializationId": "general_health",
      "name": "General Health",
      "displayName": "General Health & Wellness",
      "description": "...",
      "categoryId": "veterinary",
      "categoryName": "Veterinary",
      "applicableRoles": ["vet_solo", "vet_clinic"],
      "applicableRoleNames": ["Veterinarian (Solo)", "Veterinary Clinic"],
      "iconName": "heart-pulse",
      "iconEmoji": "❤️",
      "iconColor": "#FF6B6B",
      "displayOrder": 1,
      "showInProblemGrid": true,
      "showInVendorProfile": true,
      "allowedServiceStyles": ["at_home", "at_center", "tele"],
      "symptomCount": 6,
      "symptoms": [
        { "id": "uuid", "name": "Vomiting", "keywords": ["vomit", "throwing up"], "severity": "medium" },
        { "id": "uuid", "name": "Fever", "keywords": ["temperature", "hot"], "severity": "high" }
      ]
    }
  ]
}
```

---

## 8. Customer Flow Integration

### 8.1 Problem Grid (Dynamic)

Replace hardcoded `VET_PROBLEMS`, `GROOMING_NEEDS` with API-driven data:

```tsx
// Current (Static):
const VET_PROBLEMS = [
  { id: 'general_health', name: 'General Health', icon: HeartPulse },
  ...
];

// New (Dynamic):
const [problems, setProblems] = useState([]);

useEffect(() => {
  fetch(`/public/problem-grid/${roleId}`)
    .then(res => res.json())
    .then(data => setProblems(data.problems));
}, [roleId]);

// Render with SpecializationIcon component
problems.map(p => (
  <ProblemCard 
    key={p.id}
    icon={<SpecializationIcon iconName={p.iconName} iconEmoji={p.iconEmoji} />}
    name={p.displayName}
    symptoms={p.symptoms}
  />
))
```

### 8.2 Symptom Search Integration

```tsx
// Customer can search by symptoms
const searchResults = await fetch(`/public/search/symptoms?q=${query}`);

// Returns matching specializations with highlighted symptoms:
{
  "results": [
    {
      "specializationId": "general_health",
      "name": "General Health",
      "matchedSymptom": "Vomiting",
      "category": "Veterinary",
      "icon": "❤️"
    }
  ]
}
```

### 8.3 Flow Preservation

The existing flow remains unchanged:
1. **Problem Grid** → Now dynamic from `specialization_master`
2. **Service Style Selection** → Uses `allowed_service_styles` from specialization
3. **Vendor Matching** → Uses `vendor_specializations` (unchanged)
4. **Booking** → Same flow, problem context preserved

---

## 9. Vendor Profile Integration

### 9.1 Specialization Selector (Enhanced)

```tsx
// Vendor onboarding/profile
const specializations = await fetch(`/vendor/specializations/${roleId}`);

// Returns only specializations where showInVendorProfile = true
// and roleId is in applicable_roles

specializations.map(s => (
  <SpecializationCheckbox
    key={s.specializationId}
    icon={<SpecializationIcon {...s} />}
    name={s.displayName}
    description={s.description}
    selected={vendorSpecializations.includes(s.specializationId)}
    onChange={() => toggleSpecialization(s.specializationId)}
  />
))
```

### 9.2 Vendor Dashboard Services

```tsx
// Vet Services Dashboard shows specializations from master
// Links back to the same specialization_master for consistency
```

---

## 10. Implementation Phases

### Phase 1: Database & Backend (Day 1-2)
- [ ] Create `specialization_master` table
- [ ] Create `specialization_symptoms` table
- [ ] Backfill from `problem_grid_mappings`
- [ ] Seed default symptoms
- [ ] Create admin API endpoints
- [ ] Create public/vendor API endpoints

### Phase 2: Admin UI (Day 2-3)
- [ ] Enhance CategoriesTab with specialization list
- [ ] Create AddSpecializationModal
- [ ] Create ManageSymptomsModal
- [ ] Create SpecializationIcon component
- [ ] Add icon picker UI

### Phase 3: Customer App Integration (Day 3-4)
- [ ] Replace static problem grid with dynamic API
- [ ] Implement symptom search
- [ ] Update ProblemGridSelector to use new data
- [ ] Test all booking flows

### Phase 4: Vendor App Integration (Day 4)
- [ ] Update SpecializationSelector
- [ ] Update vendor profile specializations
- [ ] Test onboarding flow

### Phase 5: Testing & Polish (Day 5)
- [ ] E2E testing all flows
- [ ] Icon consistency check
- [ ] Performance optimization
- [ ] Documentation

---

## 11. Backward Compatibility

### 11.1 Preserved

| Component | Compatibility |
|-----------|---------------|
| `vendor_specializations` table | ✅ Unchanged, still used |
| `problem_grid_mappings` table | ✅ Keep for migration, deprecate later |
| Booking flow | ✅ Same endpoints, same flow |
| Vendor matching logic | ✅ Unchanged |

### 11.2 Deprecated (Post-Migration)

| Component | Action |
|-----------|--------|
| `problem_grid_mappings` | Keep until fully migrated |
| Hardcoded `VET_PROBLEMS` | Replace with API |
| `vendors.specializations` JSONB | Migrate to `vendor_specializations` table |

---

## 12. Sample Data Structure

### 12.1 Veterinary Category

```json
{
  "categoryId": "veterinary",
  "name": "Veterinary",
  "specializations": [
    {
      "specializationId": "general_health",
      "displayName": "General Health",
      "iconName": "heart-pulse",
      "iconEmoji": "❤️",
      "applicableRoles": ["vet_solo", "vet_clinic"],
      "symptoms": ["Vomiting", "Fever", "Diarrhea", "Loss of appetite", "Lethargy", "Weight loss"]
    },
    {
      "specializationId": "surgery",
      "displayName": "Surgery & Procedures",
      "iconName": "scissors",
      "iconEmoji": "🔪",
      "applicableRoles": ["vet_solo", "vet_clinic"],
      "symptoms": ["Tumor/Lump", "Injury", "Spay/Neuter", "Foreign body ingestion", "Fracture"]
    },
    {
      "specializationId": "cardiology",
      "displayName": "Cardiology",
      "iconName": "heart",
      "iconEmoji": "💓",
      "applicableRoles": ["vet_clinic"],  // Only clinics
      "symptoms": ["Breathing difficulty", "Coughing", "Fainting", "Exercise intolerance"]
    }
  ]
}
```

### 12.2 Grooming Category

```json
{
  "categoryId": "grooming",
  "name": "Grooming",
  "specializations": [
    {
      "specializationId": "full_grooming",
      "displayName": "Full Grooming",
      "iconName": "sparkles",
      "iconEmoji": "✨",
      "applicableRoles": ["groomer_solo", "groomer_center"],
      "symptoms": ["Matted fur", "Long nails", "Dirty coat", "Shedding"]
    },
    {
      "specializationId": "bath_only",
      "displayName": "Bath & Hygiene",
      "iconName": "droplets",
      "iconEmoji": "💧",
      "applicableRoles": ["groomer_solo", "groomer_center"],
      "symptoms": ["Dirty coat", "Bad smell", "Flea/tick infestation"]
    }
  ]
}
```

---

## 13. Questions for Review

1. **Role Granularity**: Should specializations like "Cardiology" be restricted to `vet_clinic` only, or allow `vet_solo` with additional certification?

2. **Symptom Severity**: Should we show severity indicators (🟢🟡🔴) to customers to help them choose urgency?

3. **Icon Source**: Use Lucide icons (consistent with theme) or allow emoji selection for admin flexibility?

4. **Search Priority**: Should symptom search return exact matches first, then related specializations?

5. **Backward Compatibility**: Keep `problem_grid_mappings` as fallback for 30 days or migrate immediately?

---

## Next Steps

Please review this plan and provide feedback on:
1. Architecture approval
2. UI/UX preferences
3. Priority adjustments
4. Any missing requirements

Once approved, I'll proceed with implementation in the defined phases.
