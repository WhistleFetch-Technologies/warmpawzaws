# Problem Grid Integration Flow
## Customer App - Problem-Focused Booking Experience

**Date:** 2026-01-28  
**Version:** 1.0  
**Status:** Design Specification  
**Purpose:** Seamless integration of problem grid with main booking flows

---

## 📋 Table of Contents

1. [Flow Overview](#flow-overview)
2. [Problem Grid Structure](#problem-grid-structure)
3. [Integration Points](#integration-points)
4. [Reusable Flow Components](#reusable-flow-components)
5. [Filter Reusability](#filter-reusability)
6. [Screen Specifications](#screen-specifications)
7. [API Endpoints](#api-endpoints)
8. [Data Models](#data-models)
9. [Edge Cases](#edge-cases)

---

## 🎯 Flow Overview

### Entry Point
**Where:** Customer Home Screen → Problem Grid  
**Component:** `ProblemGridNavigation.tsx` → `ProblemGridFlowRouter.tsx`  
**Initial State:** User clicks on a problem/need from grid

### Flow Philosophy
**Problem-First Approach:**
- User knows what they need (problem/need)
- System filters services based on problem
- Shows only relevant service styles
- Pre-applies problem filters to provider discovery

### Flow Steps
1. **Problem Selection** → User selects problem from grid
2. **Service Style Selection** → Shows only allowed styles for problem
3. **Provider Discovery** → Pre-filtered by problem and specializations
4. **Provider Profile** → Problem context maintained
5. **Booking Flow** → Continues with standard booking flow
6. **Confirmation** → Problem tagged in booking

### Key Benefits
- ✅ **Reduced Confusion:** Problem-focused, not service-focused
- ✅ **Faster Discovery:** Pre-filtered results
- ✅ **Better Matching:** Problem-specific providers shown
- ✅ **Reusable Components:** Same booking flows, different entry point

---

## 🎨 Problem Grid Structure

### Problem Grid Item

```typescript
interface ProblemGridItem {
  id: string;
  name: string; // e.g., "Bath & Brush", "Vaccination"
  icon: string; // Icon identifier
  description?: string;
  category: string; // "grooming", "vet", "training", etc.
  
  // Service Style Configuration
  allowedServiceStyles: ServiceStyle[]; // ['at_home', 'at_center'] or ['tele'] or all
  
  // Service Role Linking
  linkedServiceRoles: string[]; // ['groomer', 'veterinarian', etc.]
  
  // Specialization Filtering
  specializations?: string[]; // ['bath', 'nail_trim', 'ear_cleaning']
  
  // Metadata
  popular?: boolean;
  tags?: string[];
}
```

### Example Problems

**Grooming Problems:**
- **Bath & Brush**
  - `allowedServiceStyles`: `['at_home', 'at_center']`
  - `linkedServiceRoles`: `['groomer']`
  - `specializations`: `['bath', 'brushing', 'nail_trim']`

- **Full Grooming**
  - `allowedServiceStyles`: `['at_home', 'at_center']`
  - `linkedServiceRoles`: `['groomer']`
  - `specializations`: `['full_grooming', 'haircut', 'styling']`

**Vet Problems:**
- **Vaccination**
  - `allowedServiceStyles`: `['at_center', 'at_home', 'tele']`
  - `linkedServiceRoles`: `['veterinarian']`
  - `specializations`: `['vaccination', 'preventive_care']`

- **Checkup**
  - `allowedServiceStyles`: `['at_center', 'at_home', 'tele']`
  - `linkedServiceRoles`: `['veterinarian']`
  - `specializations`: `['general_checkup', 'health_screening']`

**Training Problems:**
- **Basic Training**
  - `allowedServiceStyles`: `['at_home', 'tele']`
  - `linkedServiceRoles`: `['trainer']`
  - `specializations`: `['basic_obedience', 'house_training']`

---

## 🔗 Integration Points

### Point 1: Problem Grid Selection

**Screen:** Problem Grid Navigation  
**Component:** `ProblemGridNavigation.tsx`

**UI Elements:**
- Grid of problem cards
- Each card shows:
  - Problem icon
  - Problem name
  - Brief description
  - "Popular" badge (if applicable)

**User Action:** Click on problem card

**Why Click Here:**
- Problem-focused approach
- Visual grid makes selection intuitive
- Shows what's available for each problem

**Data Passed:**
- Problem Grid ID
- Problem name
- Allowed service styles
- Linked service roles
- Specializations

**Navigation:** → Problem Grid Flow Router

**Endpoint:** `GET /config/problem-grid`

**Result:** Problem selected, context passed to flow router

---

### Point 2: Service Style Selection (Filtered)

**Screen:** Service Style Selection (Problem Context)  
**Component:** `ProblemGridFlowRouter.tsx`

**UI Elements:**
- Service style cards (filtered by problem)
- Only shows styles allowed for selected problem
- Problem name displayed: "Bath & Brush - Choose Service Style"
- Problem icon shown

**Example:**
- Problem: "Bath & Brush"
- Shows: 🏠 At Home, 🏥 At Center
- Hides: 📹 Video Call (not allowed)

**User Action:** Select service style

**Why Click Here:**
- Only relevant options shown
- Reduces confusion
- Maintains problem context

**Data Passed:**
- Problem Grid ID
- Selected service style
- Specializations (for filtering)

**Navigation:** → Provider Discovery (Pre-filtered)

**Endpoint:** `GET /config/problem-grid/{problemId}`

**Result:** Service style selected with problem context

---

### Point 3: Provider Discovery (Pre-Filtered)

**Screen:** Provider Discovery (Problem-Filtered)  
**Component:** `ServiceDiscovery.tsx` (reused with problem filters)

**UI Elements:**

**Header:**
- Back button
- Problem name: "Bath & Brush - At Home Providers"
- Problem icon
- Filter button

**Problem Badge:**
- Shows selected problem
- "Clear Problem Filter" option

**Provider Cards:**
- Pre-filtered by:
  - Problem specializations
  - Service roles
  - Service style
- Shows providers who offer services for this problem

**Filters Panel:**
- Standard filters (distance, rating, price)
- **Problem-specific filters:**
  - Specializations related to problem
  - Service-specific options

**User Actions:**
- Browse filtered providers
- Apply additional filters
- Clear problem filter (if needed)
- Select provider

**Why Click Provider:**
- Provider already matched to problem
- Relevant services shown
- Faster selection

**Data Required:**
- Problem Grid ID
- Service style
- Specializations (from problem)
- User location
- Additional filters

**Navigation:** → Provider Profile (Problem Context)

**Endpoint:** `GET /customer/services/search?problemGridId={problemId}&style={style}&specializations={specializations}&lat={lat}&lng={lng}`

**Response:**
```typescript
{
  providers: Provider[];
  problemContext: {
    problemId: string;
    problemName: string;
    specializations: string[];
  };
  totalCount: number;
}
```

**Result:** Provider selected with problem context maintained

---

### Point 4: Provider Profile (Problem Context)

**Screen:** Provider Profile (Problem Tagged)  
**Component:** `ProviderProfileView.tsx` (reused)

**UI Elements:**

**Problem Context Banner:**
- Shows selected problem
- "Services for [Problem Name]"
- Problem icon

**Services Tab:**
- Shows services relevant to problem
- Problem-specific services highlighted
- "Book [Problem Name]" quick action button

**User Actions:**
- View provider profile
- Select problem-specific service
- Book directly for problem

**Why Click "Book [Problem Name]":**
- Quick booking for selected problem
- Pre-selects relevant service
- Maintains problem context

**Data Required:**
- Provider ID
- Problem Grid ID
- Service ID (if pre-selected)

**Navigation:** → Booking Flow (Problem Context)

**Endpoint:** `GET /vendor/{vendorId}/services?problemGridId={problemId}`

**Result:** Service selected, problem context maintained

---

### Point 5: Booking Flow (Standard with Problem Tag)

**Screen:** Standard Booking Flow  
**Component:** `BookingFlow.tsx` (reused)

**UI Elements:**
- Standard booking flow UI
- Problem badge shown (non-intrusive)
- Problem name in booking summary

**User Actions:**
- Complete standard booking steps
- Problem context maintained throughout

**Data Passed:**
- All standard booking data
- Problem Grid ID (tagged)

**Navigation:** → Payment → Confirmation

**Endpoint:** `POST /bookings/create` (includes `problemGridId`)

**Result:** Booking created with problem tag

---

## 🔄 Reusable Flow Components

### Component Reusability Matrix

| Component | Center Flow | Home Flow | Tele Flow | Problem Grid |
|-----------|------------|-----------|----------|--------------|
| `ServiceDiscovery.tsx` | ✅ | ✅ | ✅ | ✅ (with problem filters) |
| `ProviderProfileView.tsx` | ✅ | ✅ | ✅ | ✅ (with problem context) |
| `SchedulingSelector.tsx` | ✅ | ✅ | ✅ | ✅ |
| `PetSelector.tsx` | ✅ | ✅ | ✅ | ✅ |
| `AddressSelector.tsx` | ❌ | ✅ | ❌ | ✅ (if home style) |
| `UniversalPaymentPage.tsx` | ✅ | ✅ | ✅ | ✅ |
| `BookingConfirmationScreen.tsx` | ✅ | ✅ | ✅ | ✅ |

### How Components Adapt

**1. ServiceDiscovery Component**

**Standard Usage:**
```typescript
<ServiceDiscovery
  serviceStyle="at_home"
  category="grooming"
  onProviderSelect={handleSelect}
/>
```

**Problem Grid Usage:**
```typescript
<ServiceDiscovery
  serviceStyle="at_home"
  problemGridId="bath_brush"
  specializations={['bath', 'brushing']}
  onProviderSelect={handleSelect}
/>
```

**Adaptation:**
- Adds problem badge
- Pre-filters by specializations
- Shows problem context in header

---

**2. ProviderProfileView Component**

**Standard Usage:**
```typescript
<ProviderProfileView
  providerId={providerId}
  serviceStyle="at_home"
/>
```

**Problem Grid Usage:**
```typescript
<ProviderProfileView
  providerId={providerId}
  serviceStyle="at_home"
  problemGridId="bath_brush"
  problemName="Bath & Brush"
/>
```

**Adaptation:**
- Shows problem context banner
- Highlights problem-specific services
- Adds "Book [Problem]" quick action

---

## 🎛️ Filter Reusability

### Unified Filter System

**Component:** `FilterPanel.tsx` (single component, dynamic options)

**Filter Types:**

**1. Common Filters (All Flows)**
- Distance
- Rating
- Price Range
- Availability

**2. Style-Specific Filters**
- **Center:** Amenities, Operating Hours
- **Home:** ETA, Next Available Slot
- **Tele:** Languages, Instant Availability

**3. Problem-Specific Filters**
- Specializations (from problem)
- Problem tags
- Service-specific options

### Filter State Management

**URL Query Params:**
- Filters stored in URL for shareability
- Problem context in URL: `?problemGridId=bath_brush`
- Filter persistence across navigation

**Example URL:**
```
/customer/services/search?
  style=at_home&
  problemGridId=bath_brush&
  distance=10&
  rating=4.0&
  priceMin=500&
  priceMax=2000
```

### Filter Application Logic

**Standard Flow:**
```typescript
const filters = {
  style: 'at_home',
  distance: 10,
  rating: 4.0,
  // ... other filters
};
```

**Problem Grid Flow:**
```typescript
const filters = {
  style: 'at_home',
  problemGridId: 'bath_brush',
  specializations: ['bath', 'brushing'], // From problem
  distance: 10,
  rating: 4.0,
  // ... other filters
};
```

**Filter Component Adapts:**
- Shows problem-specific filter options
- Pre-applies problem filters
- Allows clearing problem filter

---

## 📱 Screen Specifications

### Screen 1: Problem Grid Selection

**Component:** `ProblemGridNavigation.tsx`

**Layout:**
```
┌─────────────────────────────────────┐
│  [←] What do you need?              │
├─────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │ 🛁   │  │ 💉   │  │ 🐕   │     │
│  │ Bath │  │ Vacc │  │ Walk │     │
│  └──────┘  └──────┘  └──────┘     │
│  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │ ✂️   │  │ 🏥   │  │ 🍽️   │     │
│  │ Groom│  │ Check│  │ Meal │     │
│  └──────┘  └──────┘  └──────┘     │
└─────────────────────────────────────┘
```

**UI Elements:**
- Grid of problem cards
- Each card: Icon, Name, Description
- "Popular" badge on popular problems
- Search bar (optional)

**User Action:** Click problem card

**Why Click:**
- Problem-focused selection
- Visual and intuitive

---

### Screen 2: Service Style Selection (Filtered)

**Component:** `ProblemGridFlowRouter.tsx`

**Layout:**
```
┌─────────────────────────────────────┐
│  [←] Bath & Brush                    │
│  Choose how you want the service     │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │ 🏠 At Home                     │ │
│  │ Service at your doorstep      │ │
│  │ [Select →]                     │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ 🏥 At Center                  │ │
│  │ Visit grooming center         │ │
│  │ [Select →]                     │ │
│  └───────────────────────────────┘ │
│  (Video Call hidden - not allowed) │
└─────────────────────────────────────┘
```

**UI Elements:**
- Problem name and icon (header)
- Service style cards (filtered)
- Only shows allowed styles
- Description for each style

**User Action:** Select service style

**Why Click:**
- Only relevant options shown
- Maintains problem context

---

### Screen 3: Provider Discovery (Pre-Filtered)

**Component:** `ServiceDiscovery.tsx` (with problem context)

**Layout:**
```
┌─────────────────────────────────────┐
│  [←] Bath & Brush - At Home          │
│  [Filter] [Sort ▼]                  │
├─────────────────────────────────────┤
│  🛁 Bath & Brush                     │
│  [Clear Problem Filter]             │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │ [Photo] Grooming Pro          │ │
│  │ ⭐ 4.8 | 📍 2.5 km           │ │
│  │ Specializations: Bath, Brush  │ │
│  │ Next: Today 2 PM              │ │
│  │ [View Profile →]              │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**UI Elements:**
- Problem badge (shows selected problem)
- "Clear Problem Filter" option
- Provider cards (pre-filtered)
- Standard filters (distance, rating, etc.)

**User Action:** Select provider

**Why Click:**
- Providers already matched to problem
- Faster selection

---

### Screen 4: Provider Profile (Problem Context)

**Component:** `ProviderProfileView.tsx` (with problem context)

**Layout:**
```
┌─────────────────────────────────────┐
│  [←] Grooming Pro                    │
├─────────────────────────────────────┤
│  🛁 Services for Bath & Brush        │
├─────────────────────────────────────┤
│  [Photo] Provider Name               │
│  ⭐ 4.8 (120 reviews)               │
│  📍 2.5 km                           │
├─────────────────────────────────────┤
│  [Overview] [Services] [Reviews]    │
├─────────────────────────────────────┤
│  Services Tab:                       │
│  ┌───────────────────────────────┐ │
│  │ 🛁 Bath & Brush               │ │
│  │ Full bath and brushing        │ │
│  │ ₹999 | 60 min                 │ │
│  │ [Book Bath & Brush →]         │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**UI Elements:**
- Problem context banner
- Provider profile (standard)
- Problem-specific services highlighted
- "Book [Problem]" quick action

**User Action:** Click "Book [Problem]" or select service

**Why Click:**
- Quick booking for problem
- Maintains context

---

## 🔌 API Endpoints

### Problem Grid
- **GET** `/config/problem-grid`
  - Returns: List of all problem grid items
- **GET** `/config/problem-grid/{problemId}`
  - Returns: Problem grid item details

### Provider Discovery (Problem-Filtered)
- **GET** `/customer/services/search?problemGridId={problemId}&style={style}&specializations={specializations}&lat={lat}&lng={lng}&filters={filters}`
  - Returns: Providers filtered by problem

### Provider Services (Problem Context)
- **GET** `/vendor/{vendorId}/services?problemGridId={problemId}`
  - Returns: Services relevant to problem

### Booking Creation (Problem Tagged)
- **POST** `/bookings/create`
  - Body: `BookingRequest` (includes `problemGridId`)
  - Returns: Booking with problem tag

---

## 📊 Data Models

### Problem Grid Item
```typescript
interface ProblemGridItem {
  id: string;
  name: string;
  icon: string;
  description?: string;
  category: string;
  allowedServiceStyles: ServiceStyle[];
  linkedServiceRoles: string[];
  specializations?: string[];
  popular?: boolean;
  tags?: string[];
}
```

### Booking Request (with Problem)
```typescript
interface BookingRequest {
  // Standard booking fields
  customerId: string;
  vendorId: string;
  serviceId: string;
  serviceType: ServiceStyle;
  bookingDate: string;
  bookingTime: string;
  petId: string;
  amount: number;
  
  // Problem Grid Context
  problemGridId?: string;
  problemName?: string;
  specializations?: string[];
}
```

---

## 🔀 Edge Cases

### 1. Problem Not Available in Selected Style
**Scenario:** User selects problem that doesn't support selected style  
**Solution:** Show message, suggest alternative styles

### 2. No Providers for Problem
**Scenario:** No providers match problem filters  
**Solution:** Show "No providers found", suggest clearing problem filter

### 3. Problem Filter Cleared Mid-Flow
**Scenario:** User clears problem filter during provider discovery  
**Solution:** Show all providers, maintain other filters

### 4. Multiple Problems Selected
**Scenario:** User wants to book for multiple problems  
**Solution:** Allow selecting multiple problems, show providers for all

---

## 🎯 Benefits of Problem Grid Integration

1. **Reduced Confusion**
   - Problem-focused, not service-focused
   - Users know what they need

2. **Faster Discovery**
   - Pre-filtered results
   - Relevant providers shown immediately

3. **Better Matching**
   - Problem-specific providers
   - Specializations matched

4. **Reusable Components**
   - Same booking flows
   - Different entry point
   - Consistent UX

5. **Flexible Filtering**
   - Problem filters + standard filters
   - Can clear problem filter if needed

---

## 📱 Reference Design

### Similar Patterns
- **Practo:** Problem-based doctor search
- **Urban Company:** Service-based booking
- **Zomato:** Cuisine-based restaurant discovery

### Design Principles
- Problem-first approach
- Visual grid selection
- Context maintenance
- Filter reusability

---

**Document Status:** ✅ Complete  
**Last Updated:** 2026-01-28  
**Next:** [Payment & Checkout Flow](./PAYMENT_CHECKOUT_FLOW.md)
