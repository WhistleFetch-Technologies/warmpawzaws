# WarmPawz - System Architecture Documentation

## Project Overview

**WarmPawz** is an enterprise-ready, full-stack pet services ecosystem that connects pet owners with verified service providers through a comprehensive three-tier architecture.

## Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS v4.0 with custom design tokens
- **UI Components:** Shadcn/ui component library
- **Icons:** Lucide React
- **State Management:** React Hooks (useState, useEffect)
- **Routing:** Component-based app switching

### Backend
- **Runtime:** Deno (Supabase Edge Functions)
- **Framework:** Hono (Lightweight web framework)
- **Database:** Supabase Key-Value Store
- **Authentication:** Supabase Auth with role-based access
- **API Style:** RESTful JSON API

### Infrastructure
- **Hosting:** Supabase
- **Authentication:** Supabase Auth (Email/Password)
- **Data Storage:** Supabase KV Store (NoSQL)
- **Edge Functions:** Supabase Edge Functions (serverless)

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
├──────────────┬──────────────────┬───────────────────────────┤
│  Customer App │   Vendor Portal   │    Admin Portal         │
│  (Pet Owners) │ (Service Providers)│  (Platform Admins)     │
└──────────────┴──────────────────┴───────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│           Hono Web Server (Edge Function)                    │
│  - Authentication Routes                                     │
│  - Customer APIs                                             │
│  - Vendor APIs                                               │
│  - Admin APIs                                                │
│  - CRUD Operations                                           │
│  - Business Logic                                            │
└─────────────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
├─────────────────────────────────────────────────────────────┤
│              Supabase Services                               │
│  - Authentication (Multi-role)                               │
│  - Key-Value Store (NoSQL Database)                          │
│  - Row Level Security (Future)                               │
│  - Real-time Subscriptions (Future)                          │
└─────────────────────────────────────────────────────────────┘
```

## Application Structure

### 1. Customer Application
**Purpose:** Pet owners discover and book pet services

**Key Features:**
- User authentication (sign up/sign in)
- Pet profile management
- Service discovery and search
- Booking creation and tracking
- Deals and promotions viewing
- Multi-service categories

**Components:**
- `CustomerApp.tsx` - Main wrapper with auth state
- `CustomerAuth.tsx` - Login/registration
- `CustomerDashboard.tsx` - Main dashboard UI

**Services Available:**
- Pet Walking
- Grooming (Home & Centre)
- Veterinary Services (Home, Clinic, Tele-consultation)
- Pet Training
- Pet Food Delivery (Adhoc & Subscription)
- Medicine Delivery (Hyperlocal)
- Pet-Friendly Cafe Booking
- Pet Insurance
- Mating & Dating Services

### 2. Vendor Portal
**Purpose:** Service providers manage their business operations

**Key Features:**
- Multi-step registration with verification
- Business profile management
- Service offerings configuration
- Pricing and radius management
- Booking management
- Revenue tracking
- Performance analytics
- Promotion management

**Components:**
- `VendorApp.tsx` - Main wrapper
- `VendorAuth.tsx` - 4-step registration + login
- `VendorDashboard.tsx` - Business management dashboard

**Registration Steps:**
1. Basic Information (business name, owner, contact)
2. Service Selection (multi-select from 12+ services)
3. Business Address (city, state, pincode)
4. Documents (GSTIN, PAN, Aadhar, Bank details)

### 3. Admin Portal
**Purpose:** Platform administrators manage and verify vendors

**Key Features:**
- Vendor verification workflow
- Application approval/rejection
- Vendor management dashboard
- Platform statistics and analytics
- Deal and promotion management
- Compliance monitoring
- Revenue oversight

**Components:**
- `AdminApp.tsx` - Main wrapper
- `AdminAuth.tsx` - Secure admin login with master key
- `AdminDashboard.tsx` - Vendor management interface

**Admin Capabilities:**
- View all vendors (pending, approved, rejected)
- Search and filter vendors
- Review vendor details and documents
- Approve or reject applications
- Track platform metrics
- Export vendor data

## Data Models

### Customer Profile
```typescript
{
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  role: 'customer';
  pets: Pet[];
  bookings: string[];
  created_at: string;
}
```

### Pet
```typescript
{
  id: string;
  ownerId: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  image?: string;
  created_at: string;
}
```

### Vendor Profile
```typescript
{
  id: string;
  email: string;
  businessName: string;
  ownerName: string;
  phone: string;
  services: string[];
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin?: string;
  pan: string;
  aadhar: string;
  bankAccount: string;
  ifsc: string;
  role: 'vendor';
  status: 'pending' | 'approved' | 'rejected';
  verificationStatus: string;
  isActive: boolean;
  rating: number;
  totalBookings: number;
  revenue: number;
  serviceRadius: number; // in km
  pricing: Record<string, number>;
  promotions: Promotion[];
  documents: Record<string, string>;
  created_at: string;
  updated_at: string;
}
```

### Booking
```typescript
{
  id: string;
  customerId: string;
  vendorId: string;
  service: string;
  petId: string;
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  amount: number;
  created_at: string;
}
```

### Admin Profile
```typescript
{
  id: string;
  email: string;
  name: string;
  role: 'admin';
  permissions: string[];
  created_at: string;
}
```

## API Endpoints

Base URL: `https://{projectId}.supabase.co/functions/v1/make-server-3dd53475`

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/customer/signup` | Register new customer | No |
| POST | `/auth/vendor/signup` | Register new vendor | No |
| POST | `/auth/admin/signup` | Create admin account | Master Key |

### Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/vendors` | Get all vendors | Admin |
| POST | `/admin/vendors/:id/verify` | Approve/reject vendor | Admin |
| POST | `/admin/deals` | Create promotional deal | Admin |

### Vendor Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/vendor/profile` | Get vendor profile | Vendor |
| PUT | `/vendor/profile` | Update vendor profile | Vendor |
| GET | `/vendor/bookings` | Get vendor bookings | Vendor |

### Customer Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/customer/profile` | Get customer profile | Customer |
| POST | `/customer/pets` | Add/update pet | Customer |
| GET | `/customer/vendors` | Get available vendors | Customer |
| POST | `/customer/bookings` | Create booking | Customer |
| GET | `/customer/bookings` | Get customer bookings | Customer |

### Public Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/deals` | Get active deals | No |
| GET | `/health` | Health check | No |

## Authentication Flow

### Customer/Vendor Sign Up
1. User fills registration form
2. Frontend calls backend signup endpoint
3. Backend creates Supabase Auth user with role metadata
4. Backend creates profile in KV store
5. User automatically signs in (customers) or waits for approval (vendors)

### Vendor Approval Flow
1. Vendor registers → Status: "pending"
2. Vendor added to `admin:pending_vendors` list
3. Admin reviews application
4. Admin approves → Status: "approved", isActive: true
5. Vendor can now access dashboard
6. Admin rejects → Status: "rejected", isActive: false

### Admin Sign Up
1. Admin provides master key (default: "warmpawz2025")
2. Backend verifies master key
3. Admin account created with full permissions

### Session Management
- JWT tokens managed by Supabase Auth
- Token stored in browser localStorage
- Token passed in Authorization header: `Bearer {token}`
- Session persists across page refreshes
- Sign out clears session and redirects to login

## Security Features

1. **Role-Based Access Control (RBAC)**
   - Three distinct roles: customer, vendor, admin
   - Role stored in user metadata
   - Backend validates role before processing requests

2. **Protected Routes**
   - All authenticated endpoints verify JWT token
   - Admin endpoints verify admin role
   - Vendor endpoints check approval status

3. **Master Key Protection**
   - Admin creation requires master key
   - Master key stored securely in KV store
   - Prevents unauthorized admin creation

4. **Email Confirmation**
   - Auto-confirmed in development (email_confirm: true)
   - Production should implement email verification

5. **Data Isolation**
   - Customers only see their own data
   - Vendors only see their bookings
   - Admins see all data

## Design System

### Color Palette
- **Primary Orange:** `#FF8C42` - Brand color, CTAs, highlights
- **Secondary Colors:**
  - Blue: `#4ECDC4` - Grooming services
  - Green: `#95E1D3` - Home services
  - Red: `#F38181` - Vet services
  - Purple: `#AA96DA` - Pet cafe
  - Pink: `#FCBAD3` - Training
  - Yellow: `#FDDB27` - Pet food

### Typography
- **Font Family:** System default
- **Headings:** Medium weight (500)
- **Body:** Normal weight (400)
- **Scale:** 16px base, semantic sizing

### Components
- **Cards:** Rounded corners (0.625rem), subtle shadows
- **Buttons:** Orange primary, ghost secondary, proper hover states
- **Inputs:** Subtle backgrounds, focus rings
- **Badges:** Status-based colors (green/yellow/red)
- **Tables:** Clean borders, hover states, responsive

### Layout Principles
- Mobile-first responsive design
- Consistent spacing (4px grid)
- Clear visual hierarchy
- Ample white space
- Intuitive navigation

## Data Flow Examples

### Vendor Registration & Approval
```
Vendor → Frontend (Multi-step form)
       → Backend (/auth/vendor/signup)
       → Create Auth user with metadata
       → Store vendor profile (status: pending)
       → Add to pending_vendors list
       → Return success

Admin → Frontend (View pending vendors)
      → Backend (/admin/vendors)
      → Fetch all vendors
      → Filter by status
      → Display in table

Admin → Click "Approve"
      → Backend (/admin/vendors/:id/verify)
      → Update vendor status to "approved"
      → Set isActive: true
      → Remove from pending list
      → Return success
      → Frontend updates UI
```

### Customer Booking Creation
```
Customer → Select service & vendor
         → Choose pet & time slot
         → Frontend (/customer/bookings POST)
         → Backend validates vendor is active
         → Create booking with status: pending
         → Save to customer:{userId}:bookings
         → Save to vendor:{vendorId}:bookings
         → Update customer booking list
         → Update vendor stats
         → Return booking confirmation
         → Frontend shows success
```

## State Management

### Frontend State
- **Local Component State:** useState for forms, UI state
- **Authentication State:** Supabase session management
- **Data Fetching:** useEffect with async/await
- **Error Handling:** try/catch with toast notifications

### Backend State
- **Stateless API:** Each request is independent
- **Session Validation:** Token verification on protected routes
- **Data Consistency:** Atomic KV operations

## File Structure

```
/
├── App.tsx                          # Main app with switcher
├── components/
│   ├── CustomerApp.tsx              # Customer app wrapper
│   ├── VendorApp.tsx                # Vendor app wrapper
│   ├── AdminApp.tsx                 # Admin app wrapper
│   ├── customer/
│   │   ├��─ CustomerAuth.tsx         # Customer login/signup
│   │   └── CustomerDashboard.tsx    # Customer main UI
│   ├── vendor/
│   │   ├── VendorAuth.tsx           # Vendor multi-step form
│   │   └── VendorDashboard.tsx      # Vendor business dashboard
│   ├── admin/
│   │   ├── AdminAuth.tsx            # Admin secure login
│   │   └── AdminDashboard.tsx       # Vendor management UI
│   └── ui/                          # Shadcn components
├── supabase/functions/server/
│   ├── index.tsx                    # Main server file
│   └── kv_store.tsx                 # KV helper functions
├── utils/supabase/
│   ├── client.ts                    # Supabase client singleton
│   └── info.tsx                     # Project credentials
├── styles/
│   └── globals.css                  # Global styles & tokens
├── TESTING_GUIDE.md                 # Complete testing instructions
└── SYSTEM_ARCHITECTURE.md           # This file
```

## Performance Considerations

1. **Frontend Optimization**
   - Component lazy loading ready
   - Minimal re-renders with proper state management
   - Efficient list rendering with keys

2. **Backend Optimization**
   - Serverless edge functions (low latency)
   - KV store (fast read/write)
   - Minimal data transfer (JSON)

3. **Network Optimization**
   - Single page app (no page reloads)
   - Session persistence (fewer auth calls)
   - Parallel data fetching ready

## Scalability

### Current Capacity
- KV store handles thousands of records
- Edge functions auto-scale
- Supabase Auth handles concurrent users

### Future Scaling Strategies
1. Implement caching layer
2. Add database indexes
3. Implement pagination for large lists
4. Add CDN for static assets
5. Implement rate limiting
6. Add load balancing

## Monitoring & Logging

### Current Implementation
- Console.log for backend errors
- Toast notifications for user feedback
- Error boundaries recommended for production

### Recommended Additions
1. Error tracking service (Sentry)
2. Analytics (Mixpanel, Amplitude)
3. Performance monitoring (New Relic)
4. User behavior tracking
5. API usage metrics

## Development Workflow

### Local Development
1. Code changes auto-reload
2. Three apps accessible via switcher
3. Supabase handles auth and data
4. No local database setup needed

### Testing Strategy
1. Manual testing per TESTING_GUIDE.md
2. End-to-end user flows
3. Cross-app data verification
4. Authentication edge cases
5. UI/UX validation

### Deployment
1. Supabase auto-deploys edge functions
2. Frontend builds automatically
3. Zero-downtime deployments
4. Instant rollback capability

## Maintenance & Updates

### Regular Tasks
1. Monitor vendor applications
2. Review and approve vendors
3. Update promotional deals
4. Check system health
5. Review user feedback

### Version Control
- Keep design consistency
- Document all changes
- Test thoroughly before deploy
- Maintain backward compatibility

## Future Enhancements (Roadmap)

### Phase 2: Enhanced Booking
- Complete booking flow UI
- Real-time booking status
- Booking cancellation
- Reschedule functionality
- Booking history

### Phase 3: Payments
- Payment gateway integration
- Wallet system
- Subscription management
- Invoice generation
- Payout automation

### Phase 4: Advanced Features
- Real-time notifications
- In-app messaging
- Rating and review system
- Advanced search and filters
- Map integration
- Route optimization for walkers

### Phase 5: Mobile Apps
- React Native apps
- Push notifications
- Offline mode
- Camera integration for photos
- Geolocation services

### Phase 6: Analytics & AI
- Business intelligence dashboard
- Predictive analytics
- Recommendation engine
- Demand forecasting
- Smart pricing

## Support & Documentation

### For Developers
- Code is well-commented
- TypeScript for type safety
- Consistent naming conventions
- Modular architecture

### For Users
- TESTING_GUIDE.md for complete flows
- Intuitive UI with clear labels
- Error messages guide users
- Success feedback on actions

---

**Version:** 1.0.0  
**Last Updated:** November 2025  
**Architecture:** Three-tier microservices  
**Status:** MVP Phase 1 Complete ✅
