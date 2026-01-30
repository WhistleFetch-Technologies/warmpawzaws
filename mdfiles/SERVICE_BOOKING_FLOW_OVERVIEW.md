# Service Booking Flow - Overview & Architecture
## Customer App - Enterprise-Grade Booking Experience

**Date:** 2026-01-28  
**Version:** 1.0  
**Status:** Design Specification  
**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI, React Query

---

## 📋 Table of Contents

1. [Flow Architecture](#flow-architecture)
2. [Entry Points](#entry-points)
3. [Service Styles](#service-styles)
4. [Common Components](#common-components)
5. [Reusable Flows](#reusable-flows)
6. [Tech Stack Details](#tech-stack-details)
7. [Design System](#design-system)

---

## 🏗️ Flow Architecture

### High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER HOME SCREEN                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Service  │  │ Problem │  │ Search   │  │ Quick    │  │
│  │ Cards    │  │ Grid    │  │ Bar      │  │ Actions  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼──────────────┼──────────────┼──────────────┼───────┘
        │              │              │              │
        └──────────────┴──────────────┴──────────────┘
                          │
                          ▼
        ┌─────────────────────────────────────┐
        │     SERVICE STYLE SELECTION          │
        │  ┌──────┐  ┌──────┐  ┌──────┐      │
        │  │Center│  │ Home │  │ Tele │      │
        │  └──┬───┘  └──┬───┘  └──┬───┘      │
        └─────┼─────────┼──────────┼──────────┘
              │         │          │
        ┌─────┴─────────┴──────────┴─────┐
        │   PROVIDER DISCOVERY & FILTER   │
        │   (Reusable Component)          │
        └──────────────┬──────────────────┘
                       │
        ┌──────────────┴──────────────────┐
        │   PROVIDER PROFILE & SERVICES   │
        └──────────────┬──────────────────┘
                       │
        ┌──────────────┴──────────────────┐
        │   SCHEDULING & BOOKING DETAILS   │
        │   (Pet, Date, Time, Address)      │
        └──────────────┬──────────────────┘
                       │
        ┌──────────────┴──────────────────┐
        │      PAYMENT & CHECKOUT          │
        │   (Universal Payment Page)        │
        └──────────────┬──────────────────┘
                       │
        ┌──────────────┴──────────────────┐
        │    BOOKING CONFIRMATION           │
        │   (OTP, Tracking, Next Steps)    │
        └──────────────────────────────────┘
```

---

## 🚪 Entry Points

### 1. Service Card Click (Home Screen)
**Location:** `CustomerHomeComplete.tsx`  
**Action:** User clicks on a service card (Vet, Grooming, etc.)  
**Navigation:** Routes to service-specific booking flow  
**Component:** `ServiceCard` → `UnifiedBookingEngine`

**Why Click Here:**
- Visual service cards with icons and descriptions
- Clear call-to-action: "Book Now" or "View Services"
- Shows service availability and pricing preview

**Data Required:**
- Service ID
- Service Name
- Service Icon
- Service Category
- Base Price Range

**Endpoint:** `GET /customer/services/search?category={category}`

---

### 2. Problem Grid Selection
**Location:** `ProblemGridNavigation.tsx` → `ProblemGridFlowRouter.tsx`  
**Action:** User selects a problem/need from grid (e.g., "Bath & Brush", "Vaccination")  
**Navigation:** Routes to Problem Grid Flow Router  
**Component:** `ProblemGridItem` → `ProblemGridFlowRouter`

**Why Click Here:**
- Problem-focused approach - user knows what they need
- Visual grid with icons makes selection intuitive
- Pre-filters services based on problem type

**Data Required:**
- Problem Grid ID
- Allowed Service Styles
- Linked Service Roles
- Specializations

**Endpoint:** `GET /config/problem-grid`  
**Endpoint:** `GET /customer/services/search?problemGridId={id}`

---

### 3. Search Bar Query
**Location:** `EnhancedSearchBar.tsx`  
**Action:** User types service name or problem  
**Navigation:** Routes to search results → booking flow  
**Component:** `SearchBar` → `ServiceDiscovery` → `BookingFlow`

**Why Click Here:**
- Quick access for users who know what they want
- Autocomplete suggestions guide discovery
- Voice search option (future enhancement)

**Data Required:**
- Search Query
- User Location (for distance filtering)
- Service Category Filters

**Endpoint:** `GET /customer/services/search?q={query}&lat={lat}&lng={lng}`

---

### 4. Quick Actions (Home Screen)
**Location:** `CustomerHomeComplete.tsx`  
**Action:** User clicks quick action buttons (e.g., "Book Vet", "Book Grooming")  
**Navigation:** Direct routing to service booking flow  
**Component:** `QuickActionButton` → `UnifiedBookingEngine`

**Why Click Here:**
- One-tap access to frequently used services
- Personalized based on user history
- Reduces navigation steps

**Data Required:**
- Service Type
- Pre-selected Service Style (if applicable)

**Endpoint:** `GET /customer/services/quick-actions`

---

## 🎯 Service Styles

### 1. At Center (`at_center`)
**Description:** Customer visits vendor's physical location (clinic, center, shop)  
**Use Cases:** Vet consultations, Grooming, Shopping, Boarding  
**Key Differences:**
- No address selection needed
- Shows center amenities and location
- Distance-based filtering
- Center timing and availability

**Flow Components:**
- `VetServicesByStyle.tsx` (for vet services)
- `CenterBookingFlowEnhanced.tsx` (generic center flow)
- `UnifiedBookingEngine.tsx` (unified engine)

---

### 2. At Home (`at_home`)
**Description:** Service provider visits customer's location  
**Use Cases:** Home vet visits, Home grooming, Pet walking, Home diagnostics  
**Key Differences:**
- Address selection required
- GPS tracking enabled
- Shows staff/solo providers only
- ETA calculation and live tracking

**Flow Components:**
- `HomeServiceRouter.tsx`
- `UniversalHomeServiceRouter.tsx`
- `HomeServiceSelectionEnhanced.tsx`

---

### 3. Tele/Video (`tele`)
**Description:** Online consultation via video call  
**Use Cases:** Vet consultations, Nutrition counseling, Behavioral training  
**Key Differences:**
- Schedule or Instant options
- Video call integration
- No address needed
- Chat interface available

**Flow Components:**
- `TeleConsultationRouter.tsx`
- `InstantTeleQueue.tsx`
- `VideoCallInterface.tsx`

---

## 🔄 Common Components

### 1. Provider Discovery Component (Reusable)
**Component:** `ServiceDiscovery.tsx`  
**Purpose:** Lists service providers with filtering and sorting  
**Reusable Across:** All service styles (Center, Home, Tele)

**Features:**
- Provider cards with photo, rating, distance, price
- Filter by: Distance, Rating, Price, Availability, Specializations
- Sort by: Relevance, Distance, Rating, Price
- Search within results
- Infinite scroll or pagination

**Props:**
```typescript
interface ServiceDiscoveryProps {
  serviceStyle: 'at_center' | 'at_home' | 'tele';
  serviceId?: string;
  problemGridId?: string;
  filters?: FilterState;
  location?: { lat: number; lng: number };
  onProviderSelect: (provider: ServiceProvider) => void;
}
```

**Endpoint:** `GET /customer/services/search?style={style}&lat={lat}&lng={lng}&filters={filters}`

---

### 2. Scheduling Component (Reusable)
**Component:** `SchedulingSelector.tsx`  
**Purpose:** Date and time selection with availability checking  
**Reusable Across:** All service styles

**Features:**
- Calendar view with available dates highlighted
- Time slot selection
- Shows next available slot
- Handles timezone conversion
- Respects vendor availability and scheduling policies

**Props:**
```typescript
interface SchedulingSelectorProps {
  vendorId: string;
  serviceId: string;
  serviceStyle: ServiceStyle;
  staffId?: string;
  onSlotSelect: (date: string, time: string) => void;
}
```

**Endpoint:** `GET /vendor/${vendorId}/availability?serviceId={serviceId}&style={style}&staffId={staffId}`

---

### 3. Pet Selection Component (Reusable)
**Component:** `PetSelector.tsx`  
**Purpose:** Select pet for booking  
**Reusable Across:** All booking flows

**Features:**
- List of user's pets with photos
- Pet details preview
- "Add New Pet" option
- Pet-specific service recommendations

**Props:**
```typescript
interface PetSelectorProps {
  customerId: string;
  selectedPetId?: string;
  onPetSelect: (pet: Pet) => void;
  onAddPet: () => void;
}
```

**Endpoint:** `GET /customer/${customerId}/pets`

---

### 4. Address Selection Component (Reusable)
**Component:** `AddressSelector.tsx`  
**Purpose:** Select or add delivery/service address  
**Reusable Across:** Home services, Delivery services

**Features:**
- List of saved addresses
- "Add New Address" with map pin selection
- Address validation
- Default address selection

**Props:**
```typescript
interface AddressSelectorProps {
  customerId: string;
  selectedAddressId?: string;
  onAddressSelect: (address: Address) => void;
  onAddAddress: () => void;
}
```

**Endpoint:** `GET /customer/${customerId}/addresses`

---

## 🔀 Reusable Flows

### Filter System (Reusable Across All Flows)

**Component:** `FilterPanel.tsx`  
**Purpose:** Unified filtering system that adapts to service style

**Filter Types:**
1. **Distance Filter** (All styles)
   - Slider: 0-50km
   - Quick options: Within 5km, 10km, 20km

2. **Rating Filter** (All styles)
   - Minimum rating: 3.0, 3.5, 4.0, 4.5
   - Star-based selection

3. **Price Range** (All styles)
   - Min-Max slider
   - Quick ranges: Under ₹500, ₹500-1000, ₹1000-2000, Above ₹2000

4. **Availability** (All styles)
   - Next available slot
   - Today only
   - This week
   - Custom date range

5. **Specializations** (Service-specific)
   - Problem-based filters
   - Service-specific tags

6. **Amenities** (Center services)
   - Parking
   - Emergency services
   - Lab facilities
   - etc.

**Implementation:**
- Single `FilterPanel` component
- Dynamic filter options based on `serviceStyle` prop
- Filter state managed in URL query params for shareability
- Applied filters persist across navigation

**Endpoint:** `GET /customer/services/search?{filterParams}`

---

### Common Screen Pattern: Provider Listing

**Why Reusable:**
- Same UI/UX across Center, Home, and Tele flows
- Only data changes (provider type, availability format)
- Consistent filtering and sorting experience

**Screen Structure:**
```
┌─────────────────────────────────────┐
│  [←] Service Providers              │
│  [Filter] [Sort ▼]                  │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐ │
│  │ [Photo] Provider Name          │ │
│  │ ⭐ 4.8 (120) | 📍 2.5 km      │ │
│  │ Specializations: Surgery, ...  │ │
│  │ Next Available: Today 2 PM     │ │
│  │ Price: ₹999                    │ │
│  │ [View Profile →]                │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ [Photo] Provider Name          │ │
│  │ ...                             │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Data Variations:**
- **Center:** Shows center name, amenities, distance from user
- **Home:** Shows staff/solo name, next available slot, ETA
- **Tele:** Shows doctor name, instant availability, consultation price

**Component:** `ProviderCard.tsx` (reusable with props)

---

## 🛠️ Tech Stack Details

### Frontend Framework
- **Next.js 14:** App Router, Server Components, API Routes
- **React 18:** Hooks, Context API, Concurrent Features
- **TypeScript:** Type safety, IntelliSense, Refactoring support

### UI Libraries
- **Radix UI:** Accessible component primitives
- **Tailwind CSS:** Utility-first styling
- **Framer Motion:** Animations and transitions
- **Lucide React:** Icon library

### State Management
- **React Query (TanStack Query):** Server state, caching, synchronization
- **React Context:** Global state (cart, user, theme)
- **URL Query Params:** Filter state, navigation state

### Form Handling
- **React Hook Form:** Form state management
- **Zod:** Schema validation
- **@hookform/resolvers:** Form validation integration

### API Communication
- **Custom API Client:** Centralized HTTP client
- **Axios/Fetch:** HTTP requests
- **Error Handling:** Centralized error boundary

### Maps & Location
- **Google Maps API:** Location selection, distance calculation
- **Geolocation API:** User location detection

### Video Calls
- **Amazon Chime SDK:** Video consultation (WebRTC alternative)
- **WebRTC:** Direct peer-to-peer (future)

---

## 🎨 Design System

### Color Palette
- **Primary:** `#FF8C42` (Orange)
- **Primary Hover:** `#FF7A29`
- **Primary Gradient:** `from-[#FF8C42] to-[#FF6B35]`
- **Success:** `#10B981` (Green)
- **Error:** `#DC2626` (Red)
- **Warning:** `#F59E0B` (Amber)
- **Info:** `#3B82F6` (Blue)

### Typography
- **Headings:** `text-2xl font-bold` (h1), `text-xl font-bold` (h2)
- **Body:** `text-base` or `text-sm` with `text-gray-700`
- **Labels:** `text-sm font-semibold text-gray-900`

### Spacing
- **Container:** `max-w-[430px] mx-auto` (mobile-first)
- **Padding:** `p-4` to `p-8` based on content density
- **Gap:** `gap-3` to `gap-6` for flex/grid layouts

### Components
- **Buttons:** `bg-[#FF8C42] hover:bg-[#FF7A29] text-white rounded-xl`
- **Cards:** `bg-white rounded-2xl shadow-md border border-gray-200`
- **Inputs:** `rounded-xl border border-gray-300 focus:border-[#FF8C42]`

### Responsive Breakpoints
- **Mobile:** Default (< 640px)
- **Tablet:** `sm:` (≥ 640px)
- **Desktop:** `lg:` (≥ 1024px)

---

## 📱 Screen Flow Summary

### Minimum Viable Flow (5 Steps)
1. **Service Selection** → Choose service from home/search
2. **Service Style** → Choose Center/Home/Tele
3. **Provider Selection** → Browse and select provider
4. **Booking Details** → Pet, Date, Time, Address (if needed)
5. **Payment** → Checkout and confirmation

### Enhanced Flow (7 Steps)
1. **Service Selection**
2. **Service Style**
3. **Provider Discovery** (with filters)
4. **Provider Profile** (detailed view)
5. **Service Selection** (if multiple services)
6. **Booking Details**
7. **Payment & Confirmation**

---

## 🔗 Related Documents

- [Center Services Booking Flow](./CENTER_SERVICES_BOOKING_FLOW.md)
- [Home Services Booking Flow](./HOME_SERVICES_BOOKING_FLOW.md)
- [Tele Consultation Booking Flow](./TELE_CONSULTATION_BOOKING_FLOW.md)
- [Problem Grid Integration Flow](./PROBLEM_GRID_INTEGRATION_FLOW.md)
- [Payment & Checkout Flow](./PAYMENT_CHECKOUT_FLOW.md)
- [Booking Confirmation & Post-Booking Flow](./BOOKING_CONFIRMATION_FLOW.md)

---

**Document Status:** ✅ Complete  
**Last Updated:** 2026-01-28  
**Next Review:** After design implementation
