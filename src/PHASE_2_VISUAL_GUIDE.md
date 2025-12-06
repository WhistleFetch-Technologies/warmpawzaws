# 🎨 Phase 2 Visual Guide - UI Components

## Component Screenshots (Text Representation)

### 1. Create Regional Package Modal

```
┌──────────────────────────────────────────────────────────────────┐
│ 📦 Create Regional Package                            [X]        │
│ Step 1 of 2: Basic Information                                  │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                        │
│ ████████████████████░░░░░░░░░░░░░░░░░░░░░░                      │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Package Details                                            │ │
│ │                                                            │ │
│ │ Package Name *                                             │ │
│ │ [Basic Veterinary Checkup                              ]   │ │
│ │                                                            │ │
│ │ Description                                                │ │
│ │ ┌────────────────────────────────────────────────────────┐ │ │
│ │ │ Comprehensive health checkup for your pet             │ │ │
│ │ │                                                         │ │ │
│ │ └────────────────────────────────────────────────────────┘ │ │
│ │                                                            │ │
│ │ Category *              Package Type                       │ │
│ │ [Veterinary Services ▼] [Bundle Package         ▼]       │ │
│ │                                                            │ │
│ │ Validity Period         Validity Type                      │ │
│ │ [1                   ]  [Months              ▼]           │ │
│ │                                                            │ │
│ │ Terms & Conditions                                         │ │
│ │ ┌────────────────────────────────────────────────────────┐ │ │
│ │ │ Valid for 30 days                                      │ │ │
│ │ │ Non-refundable                                         │ │ │
│ │ └────────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                              [Cancel] [Next: Regional Settings] │
└──────────────────────────────────────────────────────────────────┘
```

---

### 2. Regional Availability Selector

```
┌──────────────────────────────────────────────────────────────────┐
│ 🌍 Regional Availability                                         │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ○  🌍 Available in all regions                             │ │
│ │    This package will be available in all active regions    │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ●  📍 Available in specific regions                        │ │
│ │    Choose which regions this package should be available   │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ○  ❌ Exclude from specific regions                        │ │
│ │    Available everywhere except selected regions            │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ────────────────────────────────────────────────────────────── │
│ Select Regions (2 selected)       [Select All] | [Clear]        │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ☑  🇮🇳  India                                   [Included] │ │
│ │        ₹ INR                                               │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ☐  🇺🇸  United States                                      │ │
│ │        $ USD                                               │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ☑  🇸🇬  Singapore                            [Included]   │ │
│ │        S$ SGD                                              │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Will show in: [🇮🇳 India] [🇸🇬 Singapore]                      │
└──────────────────────────────────────────────────────────────────┘
```

---

### 3. Regional Pricing Editor

```
┌──────────────────────────────────────────────────────────────────┐
│ 💰 Regional Pricing (2 regions)      [Auto-fill from first ↗]  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 🇮🇳  India                                    Final: ₹590  │ │
│ │     Currency: INR (₹)                                      │ │
│ │ ─────────────────────────────────────────────────────────  │ │
│ │                                                            │ │
│ │ Base Price (₹)              Tax Rate (%)                   │ │
│ │ [₹ 500                 ]    [18                  ]         │ │
│ │                                                            │ │
│ │ ┌────────────────────────────────────────────────────────┐ │ │
│ │ │ Base Price    GST (18%)         Final Price            │ │ │
│ │ │ ₹500          +₹90               ₹590                  │ │ │
│ │ └────────────────────────────────────────────────────────┘ │ │
│ │                                                            │ │
│ │ [+ Show advanced options]                                  │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 🇸🇬  Singapore                                Final: S$54 │ │
│ │     Currency: SGD (S$)                                     │ │
│ │ ─────────────────────────────────────────────────────────  │ │
│ │                                                            │ │
│ │ Base Price (S$)             Tax Rate (%)                   │ │
│ │ [S$ 50                 ]    [8                   ]         │ │
│ │                                                            │ │
│ │ ┌────────────────────────────────────────────────────────┐ │ │
│ │ │ Base Price    GST (8%)          Final Price            │ │ │
│ │ │ S$50          +S$4               S$54                  │ │ │
│ │ └────────────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Pricing Summary                                            │ │
│ │ ┌──────────────────────┐  ┌──────────────────────┐        │ │
│ │ │ 🇮🇳 India            │  │ 🇸🇬 Singapore        │        │ │
│ │ │      ₹590            │  │      S$54             │        │ │
│ │ └──────────────────────┘  └──────────────────────┘        │ │
│ └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

### 4. Regional Package List

```
┌──────────────────────────────────────────────────────────────────┐
│ Regional Packages                        [+ Create Package]      │
│ Manage packages with region-specific pricing and availability   │
│                                                                  │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│ │ 📦 45   │ │ 🌍 2    │ │ 🌐 4    │ │ 💰 23   │               │
│ │ Total   │ │ Active  │ │ Total   │ │ Avg per │               │
│ │ Packages│ │ Regions │ │ Regions │ │ Region  │               │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ [🔍 Search...        ] [🌍 India (45) ▼] [⚡ All Cat ▼]  │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 📦  Basic Veterinary Checkup                       ₹590   │ │
│ │     Comprehensive health checkup for your pet              │ │
│ │     [veterinary] [🌍 All Regions] [✓ Active]              │ │
│ │     [🇮🇳₹590] [🇺🇸$50] [🇸🇬S$54] [🇦🇪AED150]            │ │
│ │                                       [👁] [✏] [🗑]        │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 📦  Pet Cafe Package                               ₹800   │ │
│ │     Premium pet cafe experience with grooming              │ │
│ │     [petCafe] [📍 2 Regions] [✓ Active]                   │ │
│ │     [🇮🇳₹800] [🇸🇬S$60]                                   │ │
│ │                                       [👁] [✏] [🗑]        │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 📦  Premium Grooming Package                       ₹1,180 │ │
│ │     Complete grooming service                              │ │
│ │     [grooming] [🌍 All Regions] [✓ Active]                │ │
│ │     [🇮🇳₹1,180] [🇺🇸$94] [🇸🇬S$97] +1 more              │ │
│ │                                       [👁] [✏] [🗑]        │ │
│ └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

### 5. Region Active Packages Tab (In Region Manager)

```
┌──────────────────────────────────────────────────────────────────┐
│ Edit Region: India                                               │
│ [Basic] [Currency] [Phone] [Localization] [Services] [Breeds]   │
│ [📦 Packages]                                                    │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 45 Active Packages                          Categories: 8  │ │
│ │ Available in India                                         │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ▼ 🏥 Veterinary Services (12 packages)  ₹500 - ₹2,500     │ │
│ ├────────────────────────────────────────────────────────────┤ │
│ │ 📦 Basic Vet Checkup                            ₹590      │ │
│ │    Base: ₹500 + Tax (18%)                                 │ │
│ │                                                            │ │
│ │ 📦 Vaccination Package                          ₹944      │ │
│ │    Base: ₹800 + Tax (18%)                                 │ │
│ │                                                            │ │
│ │ 📦 Surgery Consultation                         ₹1,416    │ │
│ │    Base: ₹1,200 + Tax (18%)                               │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ▶ ✂️ Grooming & Spa (8 packages)            ₹400 - ₹1,180 │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ ▶ 🎓 Training & Behavior (15 packages)    ₹3,000 - ₹8,000 │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Pricing Overview                                           │ │
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐             │ │
│ │ │ Lowest     │ │ Average    │ │ Highest    │             │ │
│ │ │ ₹472       │ │ ₹1,534     │ │ ₹9,440     │             │ │
│ │ └────────────┘ └────────────┘ └────────────┘             │ │
│ └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

### 6. Regional Catalog Manager (Main View)

```
┌──────────────────────────────────────────────────────────────────┐
│ ← 📦 Regional Catalog Manager                                   │
│    Manage packages with multi-region pricing                     │
│                                                                  │
│ [📦 Packages] [⚙️ Settings] [📊 Analytics]                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ (Regional Package List content here - same as screenshot #4)    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Color Legend

| Color | Usage | Example |
|-------|-------|---------|
| 🟠 Orange | Primary actions, brand | Create buttons, active states |
| 🔵 Blue | Information, "All" mode | Info boxes, global packages |
| 🟢 Green | Success, prices, "Specific" | Final prices, checkmarks |
| 🔴 Red | Errors, warnings, "Exclude" | Error messages, delete |
| 🟣 Purple | Analytics, stats | Metrics, charts |
| ⚪ Gray | Neutral, disabled | Borders, inactive states |

---

## Icon Legend

| Icon | Meaning |
|------|---------|
| 📦 | Package/Product |
| 🌍 | All Regions |
| 📍 | Specific Regions |
| ❌ | Exclude/Delete |
| 💰 | Pricing/Money |
| 🏥 | Veterinary |
| ✂️ | Grooming |
| 🎓 | Training |
| 🐕 | Walking |
| ☕ | Pet Cafe |
| 🇮🇳 | India |
| 🇺🇸 | USA |
| 🇸🇬 | Singapore |
| 🇦🇪 | UAE |
| ✓ | Active/Enabled |
| ✗ | Inactive/Disabled |
| 👁 | View |
| ✏ | Edit |
| 🗑 | Delete |
| 🔍 | Search |
| ⚙️ | Settings |
| 📊 | Analytics |

---

## Interaction Patterns

### Buttons
```
Primary:    [● Create Package]      Orange, high emphasis
Secondary:  [○ Cancel]               Gray outline, medium emphasis
Tertiary:   [≡ Select All]          Text only, low emphasis
Icon:       [👁] [✏] [🗑]           Icon only, minimal space
```

### Form Inputs
```
Text:       [Basic Vet Checkup    ]
Number:     [₹ 500                 ]
Select:     [Veterinary Services ▼]
Textarea:   ┌──────────────────────┐
            │ Multi-line text      │
            └──────────────────────┘
Checkbox:   ☑ Selected   ☐ Not selected
Radio:      ● Selected   ○ Not selected
```

### Cards
```
Default:    ┌──────────────┐ Gray border
Hover:      ┌──────────────┐ Orange border
Active:     ┌──────────────┐ Orange background
Disabled:   ┌──────────────┐ Gray + opacity
```

---

## Responsive Behavior

### Desktop (> 1024px)
- Multi-column layouts (grid-cols-2, grid-cols-3)
- Full sidebar navigation
- Expanded card views
- Inline actions

### Tablet (768px - 1024px)
- 2-column layouts
- Collapsible sidebar
- Card views maintained
- Inline actions

### Mobile (< 768px)
- Single column layouts
- Hidden sidebar (hamburger menu)
- Stacked cards
- Bottom sheet actions

---

## Accessibility Features

✅ **Keyboard Navigation**
- Tab through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals
- Arrow keys in lists

✅ **Screen Reader Support**
- Proper ARIA labels
- Form field descriptions
- Error announcements
- Status updates

✅ **Visual Indicators**
- Focus outlines on all interactive elements
- Loading states
- Error states
- Success states

✅ **Color Contrast**
- WCAG AA compliant
- Text legibility
- Icon clarity
- State differentiation

---

## Animation & Transitions

### Modal Entrance
```
Fade in + Scale up (200ms)
Background blur (150ms)
```

### Card Hover
```
Border color change (150ms)
Shadow elevation (150ms)
```

### Button Click
```
Scale down (100ms)
Scale up (100ms)
```

### Toast Notification
```
Slide in from top (300ms)
Auto-dismiss after 3s
Slide out (200ms)
```

---

## Success States

### Package Created
```
┌────────────────────────────────────┐
│ ✓ Package created successfully!   │
└────────────────────────────────────┘
Green toast, 3 second display
```

### Package Updated
```
┌────────────────────────────────────┐
│ ✓ Package updated successfully!   │
└────────────────────────────────────┘
Green toast, 3 second display
```

---

## Error States

### Validation Error
```
┌────────────────────────────────────┐
│ ⚠ Missing pricing for: USA, UAE   │
└────────────────────────────────────┘
Red toast, stays until dismissed
```

### Network Error
```
┌────────────────────────────────────┐
│ ❌ Failed to load regions          │
└────────────────────────────────────┘
Red toast, stays until dismissed
```

---

**Visual Guide Complete!** 🎨  
**All UI components documented with ASCII art representations** ✅
