# 🐾 WarmPawz - Pet Services Ecosystem

A comprehensive three-tier pet service platform connecting pet owners with verified service providers through an enterprise-ready architecture.

![Version](https://img.shields.io/badge/version-1.0.0-orange)
![Status](https://img.shields.io/badge/status-MVP%20Phase%201-success)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)

---

## 🎯 Project Overview

**WarmPawz** is a 360-degree pet service ecosystem that provides:

- 🏠 **Customer App** - Pet owners discover and book services
- 🏢 **Vendor Portal** - Service providers manage their business
- ⚙️ **Admin Portal** - Platform administrators verify and manage vendors

### Services Offered
- 🚶 Pet Walking
- ✂️ Grooming (Home & Centre)
- 🏥 Veterinary Services (Home, Clinic, Tele-consultation)
- 🎓 Pet Training
- 🍖 Pet Food Delivery (Adhoc & Subscription)
- 💊 Medicine Delivery (Hyperlocal)
- ☕ Pet-Friendly Cafe Booking
- 🛡️ Pet Insurance
- ❤️ Mating & Dating Services

---

## 🚀 Quick Start

### 1. Start the Application
Open the application in your browser. You'll see three apps accessible via the **App Switcher** in the top-right corner.

### 2. Test the Complete Flow

#### Step 1: Create Admin Account
```
1. Click "Admin Portal"
2. Click "Create new admin account"
3. Use Master Key: warmpawz2025
4. Complete registration
```

#### Step 2: Register Vendors
```
1. Click "Vendor App"
2. Complete 4-step registration
3. Vendor status: "Pending Approval"
```

#### Step 3: Approve Vendors
```
1. Switch to "Admin Portal"
2. View pending vendors
3. Review details and approve/reject
```

#### Step 4: Vendor Access
```
1. Switch to "Vendor App"
2. Login with approved vendor credentials
3. Access vendor dashboard
```

#### Step 5: Customer Registration
```
1. Switch to "Customer App"
2. Sign up as pet owner
3. Access dashboard and services
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Complete testing instructions with all test cases |
| [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | Full architecture, data models, and API documentation |
| [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) | Development patterns, code examples, and best practices |

---

## 🏗️ Architecture

### Three-Tier Design

```
┌─────────────┬─────────────┬─────────────┐
│  Customer   │   Vendor    │    Admin    │
│     App     │   Portal    │   Portal    │
└─────────────┴─────────────┴─────────────┘
              ▼
      ┌─────────────────┐
      │  Hono Server    │
      │ (Edge Function) │
      └─────────────────┘
              ▼
      ┌─────────────────┐
      │    Supabase     │
      │  Auth & KV DB   │
      └─────────────────┘
```

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS v4.0
- Shadcn/ui Components
- Lucide React Icons

**Backend:**
- Supabase Edge Functions
- Hono Web Framework
- Deno Runtime
- RESTful JSON API

**Database:**
- Supabase Authentication
- Key-Value Store (NoSQL)
- Role-Based Access Control

---

## ✨ Features Implemented (Phase 1)

### Customer App ✅
- [x] User authentication (sign up/login)
- [x] Dashboard with service categories
- [x] Deals and promotions display
- [x] Pet profile card
- [x] Service discovery UI
- [x] Mobile-responsive design

### Vendor Portal ✅
- [x] Multi-step registration (4 steps)
- [x] Business profile management
- [x] Service selection (12+ services)
- [x] Document collection (GSTIN, PAN, Aadhar, Bank)
- [x] Pending approval status
- [x] Vendor dashboard with stats
- [x] Booking management UI

### Admin Portal ✅
- [x] Secure admin authentication (master key)
- [x] Vendor management dashboard
- [x] Application review system
- [x] Approve/Reject workflow
- [x] Search and filter vendors
- [x] Platform statistics
- [x] Vendor detail modal

### Backend API ✅
- [x] Role-based authentication (3 roles)
- [x] Customer endpoints
- [x] Vendor endpoints
- [x] Admin endpoints
- [x] Vendor approval workflow
- [x] Data persistence (KV store)
- [x] CORS enabled
- [x] Error logging

---

## 📱 Application Screens

### Customer App
- **Dashboard:** Services, deals, pet profile, quick actions
- **Auth:** Login and signup forms

### Vendor Portal
- **Registration:** 4-step form (Basic Info → Services → Address → Documents)
- **Dashboard:** Stats, bookings, revenue, business info
- **Pending Status:** Waiting for admin approval

### Admin Portal
- **Dashboard:** Vendor table with search/filter
- **Stats Cards:** Total, pending, approved, rejected, revenue
- **Vendor Details Modal:** Complete vendor information review
- **Approve/Reject:** One-click vendor verification

---

## 🎨 Design System

### Brand Colors
- **Primary:** `#FF8C42` (Orange) - Used for all CTAs and highlights
- **Service Colors:** Custom palette for each service category
- **Status Colors:** Green (approved), Yellow (pending), Red (rejected)

### Design Philosophy
- **Pixel-perfect** implementation from design mockups
- **Consistent** orange theme across all three apps
- **Mobile-first** responsive approach
- **Intuitive** user experience with clear visual hierarchy

---

## 🔐 Security Features

- **Role-Based Access Control:** Three distinct user roles
- **Protected Routes:** JWT token verification
- **Master Key Protection:** Admin creation requires master key
- **Session Management:** Persistent authentication
- **Data Isolation:** Users only see their own data

---

## 🗄️ Database Schema

### Key-Value Store Structure

```
customer:{userId}                    - Customer profiles
vendor:{userId}                      - Vendor profiles
admin:{userId}                       - Admin profiles
booking:customer:{userId}:{bookingId} - Customer bookings
booking:vendor:{vendorId}:{bookingId} - Vendor bookings
admin:pending_vendors                - Pending vendor IDs
system:active_deals                  - Active promotions
system:master_key                    - Admin master key
```

---

## 🔌 API Endpoints

Base URL: `https://{projectId}.supabase.co/functions/v1/make-server-3dd53475`

### Authentication
- `POST /auth/customer/signup` - Register customer
- `POST /auth/vendor/signup` - Register vendor
- `POST /auth/admin/signup` - Create admin (requires master key)

### Admin Operations
- `GET /admin/vendors` - List all vendors
- `POST /admin/vendors/:id/verify` - Approve/reject vendor
- `POST /admin/deals` - Create promotional deal

### Vendor Operations
- `GET /vendor/profile` - Get vendor profile
- `PUT /vendor/profile` - Update vendor profile
- `GET /vendor/bookings` - Get vendor bookings

### Customer Operations
- `GET /customer/profile` - Get customer profile
- `POST /customer/pets` - Add/update pet
- `GET /customer/vendors` - Get available vendors
- `POST /customer/bookings` - Create booking
- `GET /customer/bookings` - Get customer bookings

### Public
- `GET /deals` - Get active deals
- `GET /health` - Health check

---

## 🧪 Testing

### Quick Test Sequence
1. **Admin:** Create account with master key → ✅
2. **Vendor:** Register with 4-step form → ✅
3. **Admin:** Approve vendor → ✅
4. **Vendor:** Login and access dashboard → ✅
5. **Customer:** Register and view services → ✅

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed test cases.

---

## 🚧 Roadmap

### Phase 2: Enhanced Booking (Next)
- [ ] Complete booking creation flow
- [ ] Booking status tracking
- [ ] Vendor booking acceptance
- [ ] Booking cancellation
- [ ] Booking history

### Phase 3: Payments
- [ ] Payment gateway integration
- [ ] Wallet system
- [ ] Subscription management
- [ ] Invoice generation
- [ ] Vendor payouts

### Phase 4: Advanced Features
- [ ] Real-time notifications
- [ ] In-app messaging
- [ ] Rating and review system
- [ ] Map integration
- [ ] File upload for documents

### Phase 5: Mobile Apps
- [ ] React Native customer app
- [ ] React Native vendor app
- [ ] Push notifications
- [ ] Offline mode

### Phase 6: AI & Analytics
- [ ] Business intelligence dashboard
- [ ] Recommendation engine
- [ ] Demand forecasting
- [ ] Smart pricing

---

## 📊 Current Status

### ✅ Completed (Phase 1)
- Three-tier architecture
- Role-based authentication
- Vendor registration & approval workflow
- Admin vendor management
- Customer service discovery
- Pixel-perfect UI implementation
- Backend API with CRUD operations
- Data persistence
- Cross-app data synchronization

### 🚧 In Progress
- Booking flow completion
- Pet profile management
- Service provider search

### 📝 Planned
- Payment integration
- Notifications
- Reviews and ratings
- Analytics dashboard

---

## 🛠️ Development

### Project Structure
```
/
├── App.tsx                    # Main app with switcher
├── components/
│   ├── customer/              # Customer app
│   ├── vendor/                # Vendor portal
│   ├── admin/                 # Admin portal
│   └── ui/                    # Shadcn components
├── supabase/functions/server/
│   └── index.tsx              # Backend API
├── utils/supabase/            # Supabase helpers
├── styles/globals.css         # Global styles
└── [Documentation files]
```

### Key Files
- **Backend:** `/supabase/functions/server/index.tsx`
- **Customer Dashboard:** `/components/customer/CustomerDashboard.tsx`
- **Vendor Dashboard:** `/components/vendor/VendorDashboard.tsx`
- **Admin Dashboard:** `/components/admin/AdminDashboard.tsx`

---

## 🤝 Contributing

### Development Guidelines
1. Follow existing code patterns
2. Maintain pixel-perfect design
3. Keep orange theme consistent (#FF8C42)
4. Test across all three apps
5. Update documentation
6. Use TypeScript properly
7. Handle errors gracefully

See [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) for detailed guidelines.

---

## 📝 License

Proprietary - WarmPawz Platform

---

## 👥 Support

For issues or questions:
1. Check documentation files
2. Review testing guide
3. Inspect browser console
4. Check network requests

---

## 🎯 Success Metrics

### Phase 1 Achievements
- ✅ Three fully functional apps
- ✅ Complete vendor approval workflow
- ✅ Role-based authentication
- ✅ Pixel-perfect UI implementation
- ✅ Enterprise-ready architecture
- ✅ Comprehensive documentation
- ✅ Full CRUD operations
- ✅ Data synchronization across apps

---

## 🌟 Highlights

- **Seamless Multi-App Architecture:** Switch between three apps instantly
- **Pixel-Perfect Design:** Matches design mockups exactly
- **Enterprise-Ready:** Scalable architecture with proper separation of concerns
- **Secure:** Role-based access control with proper authentication
- **Well-Documented:** Complete guides for testing and development
- **Type-Safe:** Full TypeScript implementation
- **Modern Stack:** React 18, Tailwind v4, Supabase Edge Functions

---

## 📞 Contact

**Project:** WarmPawz Pet Services Platform  
**Version:** 1.0.0 (MVP Phase 1)  
**Status:** ✅ Ready for Testing  
**Architecture:** Three-Tier Microservices  
**Tech Lead:** Full Stack Developer with 100 years experience 😄

---

**Built with ❤️ for pet lovers and their furry friends! 🐕🐈**

---

*Last Updated: November 2025*
