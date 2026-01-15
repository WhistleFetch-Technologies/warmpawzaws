# 🐾 WARMPAWZ SERVICE DELIVERY MASTER PLAN
## Comprehensive Flow Design for Vets, Groomers, Walkers & Trainers

**Version:** 1.0  
**Date:** January 15, 2026  
**Status:** Planning Phase

---

## 📊 EXECUTIVE SUMMARY

This document outlines the complete service delivery flows for 4 key vendor roles across all service styles, including package handling, repeat bookings, and revenue realization.

### Roles Covered:
| Role | Service Styles | Key Features |
|------|----------------|--------------|
| **Veterinarian** | at_center, at_home, tele | Medical records, Rx, Diagnostics |
| **Pet Groomer** | at_center, at_home | Packages, Before/After photos |
| **Pet Walker** | at_home only | GPS tracking, Session packs |
| **Pet Trainer** | at_center, at_home | Progress tracking, Skill milestones |

---

# PART 1: COMPLETE SERVICE FLOWS

## 🩺 1. VETERINARIAN FLOWS

### 1.1 Customer Journey - Vet Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VET SERVICE CUSTOMER FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HOME SCREEN                                                                │
│       │                                                                     │
│       ├── [Vet Services] ─────────────────────────────┐                    │
│       │                                                │                    │
│       ▼                                                ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   VET SERVICE DASHBOARD                              │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │   │
│  │  │ 📹 TELE   │  │ 🏥 CLINIC │  │ 🏠 HOME   │  │ 🧪 LAB    │        │   │
│  │  │ ₹299/15m  │  │ Book Slot │  │ ₹999+     │  │ Tests     │        │   │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘        │   │
│  └────────┼──────────────┼──────────────┼──────────────┼────────────────┘   │
│           │              │              │              │                    │
│           ▼              ▼              ▼              ▼                    │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  FLOW A: TELE CONSULTATION                                                  │
│  ─────────────────────────                                                  │
│  1. Select "Tele Consultation"                                              │
│  2. Choose: [Instant] or [Schedule Later]                                   │
│     │                                                                       │
│     ├── INSTANT:                                                            │
│     │   └── Join Queue → Match with Available Vet → Start Video Call       │
│     │       → Consultation → Rx via Chat → Payment Deducted → End          │
│     │                                                                       │
│     └── SCHEDULED:                                                          │
│         └── Select Vet → Pick Date/Time → Select Pet → Pay                  │
│             → Reminder → Join Call → Consultation → Rx → End               │
│                                                                             │
│  FLOW B: CLINIC VISIT                                                       │
│  ────────────────────                                                       │
│  1. Select "Clinic Visit"                                                   │
│  2. View Nearby Clinics (Map + List)                                        │
│  3. Select Clinic → View Services, Doctors, Reviews                         │
│  4. Select Service (from role-filtered catalog)                             │
│  5. Select Doctor (optional, if multi-doctor clinic)                        │
│  6. Select Pet                                                              │
│  7. Pick Date → Pick Time Slot (from availability)                          │
│  8. Review Booking → Pay                                                    │
│  9. Receive Confirmation + 4-digit OTP                                      │
│  10. Visit Clinic → Give OTP → Service → Get OTP to Complete               │
│  11. Receive Prescription/Medical Records in App                            │
│                                                                             │
│  FLOW C: HOME VISIT                                                         │
│  ─────────────────                                                          │
│  1. Select "Home Visit"                                                     │
│  2. View Available Vets in Area                                             │
│  3. Select Vet → View Profile                                               │
│  4. Select Service                                                          │
│  5. Select Pet                                                              │
│  6. Select/Add Address (with GPS pin)                                       │
│  7. Pick Date → Pick Time                                                   │
│  8. Review → Pay                                                            │
│  9. Receive Confirmation + OTP                                              │
│  10. Track Vet on Map (when en-route)                                       │
│  11. Vet Arrives → Enter OTP → Service Starts                               │
│  12. Service Complete → Enter OTP → Rx Shared                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Vendor Journey - Vet Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VET VENDOR DASHBOARD FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DASHBOARD HOME                                                             │
│  ├── Today's Schedule (Clinic/Home/Tele bookings)                          │
│  ├── Stats (Appointments, Earnings, Reviews)                                │
│  ├── Quick Actions (Accept Booking, Start Tele, View Rx Queue)             │
│  └── Notifications (New bookings, Follow-ups)                               │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  BOOKING FULFILLMENT:                                                       │
│                                                                             │
│  NEW BOOKING ARRIVES                                                        │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ [Accept] or [Reject with Reason]                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│       │                                                                     │
│       ▼ (Accepted)                                                          │
│                                                                             │
│  FOR CLINIC VISIT:                                                          │
│  ─────────────────                                                          │
│  1. Customer Arrives → Ask for OTP                                          │
│  2. Enter OTP → Booking Status = "In Progress"                              │
│  3. Conduct Consultation                                                    │
│  4. Add Notes, Diagnosis, Treatment                                         │
│  5. Create Prescription (if needed)                                         │
│  6. Enter Customer OTP → Complete Booking                                   │
│  7. Medical Record Saved                                                    │
│  8. Revenue Realized → Settlement Queue                                     │
│                                                                             │
│  FOR HOME VISIT:                                                            │
│  ───────────────                                                            │
│  1. View Address on Map → Navigate                                          │
│  2. Toggle "En Route" → GPS Tracking Enabled for Customer                   │
│  3. Arrive → Enter Customer OTP → Start Service                             │
│  4. Conduct Consultation at Home                                            │
│  5. Create Prescription/Records                                             │
│  6. Enter OTP → Complete → GPS Tracking Off                                 │
│  7. Revenue Realized                                                        │
│                                                                             │
│  FOR TELE CONSULTATION:                                                     │
│  ─────────────────────                                                      │
│  1. Toggle "Available for Tele" in Dashboard                                │
│  2. Receive Call Request / Scheduled Reminder                               │
│  3. Click "Start Call" → Video Interface Opens                              │
│  4. Conduct Consultation via Video                                          │
│  5. Share Screen/Notes as needed                                            │
│  6. End Call → Create Prescription                                          │
│  7. Share Rx via Chat (PDF download available)                              │
│  8. No OTP Required → Auto-Complete                                         │
│  9. Revenue Realized                                                        │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  CAPABILITIES SPECIFIC TO VETS:                                             │
│  ├── Medical Records (Create/View patient history)                          │
│  ├── Prescriptions (Create, PDF, Share via Chat)                            │
│  ├── Diagnostics (Order tests, View results)                                │
│  ├── Follow-up Chat (Enabled until follow-up date)                          │
│  ├── Vaccination Scheduler (Set reminders)                                  │
│  └── Referrals (Refer to specialists)                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Vet Packages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VET WELLNESS PACKAGES                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PACKAGE TYPES:                                                             │
│                                                                             │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ 🏥 WELLNESS PLAN   │  │ 💉 VACCINATION     │  │ 🔬 HEALTH CHECKUP  │    │
│  │    (Annual)        │  │    SCHEDULE        │  │    BUNDLE          │    │
│  │                    │  │                    │  │                    │    │
│  │ 4 Checkups/year    │  │ All vaccines      │  │ CBC + X-Ray +      │    │
│  │ 10% off services   │  │ Auto-scheduled    │  │ Ultrasound         │    │
│  │ Priority booking   │  │ Reminders         │  │                    │    │
│  │ ₹3,500/year        │  │ ₹2,500            │  │ ₹4,000 (save ₹800) │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                             │
│  TRACKING:                                                                  │
│  ├── Next scheduled visit date                                              │
│  ├── Remaining checkups in plan                                             │
│  ├── Discount applied automatically at checkout                             │
│  └── Expiry notification 30 days before                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## ✂️ 2. GROOMER FLOWS

### 2.1 Customer Journey - Grooming Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GROOMING SERVICE CUSTOMER FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   GROOMING SERVICE DASHBOARD                         │   │
│  │  ┌─────────────────┐              ┌─────────────────┐               │   │
│  │  │ 🏢 SALON VISIT  │              │ 🏠 HOME GROOMING │               │   │
│  │  │   50+ Salons    │              │   Track Live     │               │   │
│  │  └────────┬────────┘              └────────┬────────┘               │   │
│  └───────────┼────────────────────────────────┼─────────────────────────┘   │
│              │                                │                             │
│              ▼                                ▼                             │
│                                                                             │
│  FLOW A: SALON VISIT                                                        │
│  ───────────────────                                                        │
│  1. View Nearby Salons (Map + List with ratings)                            │
│  2. Select Salon → View Services, Photos, Reviews                           │
│  3. Select Service(s):                                                      │
│     ├── Individual: Bath, Haircut, Nail Trim, Ear Clean                     │
│     └── Package: Full Spa, Breed-Specific Styling                           │
│  4. Select Pet (with breed info for pricing)                                │
│  5. Pick Date → Pick Time Slot                                              │
│  6. Add Special Instructions (e.g., "sensitive skin")                       │
│  7. Review → Pay (or use package credit)                                    │
│  8. Receive Confirmation + OTP                                              │
│  9. Drop off Pet → Share OTP                                                │
│  10. Receive "Grooming Started" notification                                │
│  11. Receive "Ready for Pickup" + Before/After Photos                       │
│  12. Pick up → Share OTP → Complete                                         │
│                                                                             │
│  FLOW B: HOME GROOMING                                                      │
│  ────────────────────                                                       │
│  1. View Available Mobile Groomers                                          │
│  2. Select Groomer → View Portfolio, Reviews                                │
│  3. Select Services (may be limited vs salon)                               │
│  4. Select Pet                                                              │
│  5. Select/Add Address                                                      │
│  6. Pick Date → Pick Time                                                   │
│  7. Review → Pay                                                            │
│  8. Receive Confirmation + OTP                                              │
│  9. Track Groomer on Map (when en-route)                                    │
│  10. Groomer Arrives → Share OTP → Service Starts                           │
│  11. Service Complete → Before/After Photos                                 │
│  12. Share OTP → Complete → Rate & Review                                   │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  PREVIOUS GROOMER SECTION (on dashboard):                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔄 YOUR GROOMER                                                      │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ [Photo] Priya - Furry Friends Spa                               │ │   │
│  │ │ ⭐ 4.9 • Last visit: 3 weeks ago • 5 sessions with you          │ │   │
│  │ │ [Book Again with Priya]                                         │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Vendor Journey - Groomer Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GROOMER VENDOR DASHBOARD FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DASHBOARD HOME                                                             │
│  ├── Today's Appointments (sorted by time)                                  │
│  ├── Stats (Sessions, Earnings, Repeat Customers %)                         │
│  ├── Package Customers (customers with active packs)                        │
│  └── Photo Gallery (before/after showcase)                                  │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  BOOKING FULFILLMENT (SALON):                                               │
│  ───────────────────────────                                                │
│  1. Accept Booking                                                          │
│  2. Customer Drops Off Pet → Scan OTP                                       │
│  3. Take "Before" Photo                                                     │
│  4. Start Grooming                                                          │
│  5. Take "After" Photo(s)                                                   │
│  6. Mark "Ready for Pickup" → Customer Notified                             │
│  7. Customer Arrives → Scan OTP → Complete                                  │
│  8. Photos Shared with Customer                                             │
│  9. Revenue Realized                                                        │
│                                                                             │
│  BOOKING FULFILLMENT (HOME):                                                │
│  ─────────────────────────                                                  │
│  1. Accept Booking                                                          │
│  2. View Address → Start Navigation                                         │
│  3. Toggle "En Route" → GPS Tracking                                        │
│  4. Arrive → Enter Customer OTP → Start                                     │
│  5. Take Before/After Photos                                                │
│  6. Complete Grooming                                                       │
│  7. Enter OTP → Complete                                                    │
│  8. Revenue Realized                                                        │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  CAPABILITIES SPECIFIC TO GROOMERS:                                         │
│  ├── Before/After Photo Gallery                                             │
│  ├── Breed-Specific Pricing                                                 │
│  ├── Add-on Services (teeth, ears, nails)                                   │
│  ├── Product Recommendations (shampoos, etc.)                               │
│  └── Repeat Customer Tracking                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Grooming Packages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GROOMING PACKAGES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PACKAGE TYPES:                                                             │
│                                                                             │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ 📦 SESSION PACK    │  │ 📅 MONTHLY MEMBER  │  │ 👑 PREMIUM SPA     │    │
│  │                    │  │                    │  │                    │    │
│  │ 3 Full Grooms      │  │ 1 Groom/month      │  │ 6 Spa Sessions     │    │
│  │ ₹1,500 (save ₹300) │  │ ₹500/month         │  │ ₹5,000 (save ₹1K)  │    │
│  │ Valid 3 months     │  │ Priority booking   │  │ Valid 6 months     │    │
│  │                    │  │ 10% off add-ons    │  │ Includes add-ons   │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                             │
│  TRIAL → PACKAGE FLOW:                                                      │
│  ─────────────────────                                                      │
│  First Session Completed                                                    │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🎁 SPECIAL OFFER                                                    │   │
│  │                                                                      │   │
│  │ "Love your grooming experience? Save with a package!"               │   │
│  │                                                                      │   │
│  │ ☑ Stay with [Groomer Name] for all sessions                         │   │
│  │                                                                      │   │
│  │ [3 Sessions - ₹1,500]  [6 Sessions - ₹2,800]  [Monthly - ₹500/mo]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TRACKING:                                                                  │
│  ├── Sessions remaining: 2/3                                                │
│  ├── Next recommended grooming: Feb 15                                      │
│  ├── Same groomer assigned: Priya                                           │
│  └── Quick Book: [Book Next Session]                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚶 3. WALKER FLOWS

### 3.1 Customer Journey - Walking Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WALKING SERVICE CUSTOMER FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    WALKING SERVICE DASHBOARD                         │   │
│  │                                                                      │   │
│  │  🚶 DOG WALKING - ALWAYS AT HOME (Walker comes to you)              │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ 📍 NEARBY WALKERS                                             │   │   │
│  │  │ [Interactive Map with Walker Pins]                            │   │   │
│  │  │                                                               │   │   │
│  │  │ • Rahul - ⭐4.9 - 0.5km - Available Now                       │   │   │
│  │  │ • Priya - ⭐4.8 - 1.2km - Available in 30min                  │   │   │
│  │  │ • Amit  - ⭐4.7 - 2.0km - Available Now                       │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │  YOUR WALKER:                                                        │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ [Photo] Rahul • ⭐4.9 • 15 walks with Buddy                   │   │   │
│  │  │ [Book Rahul Again]  [View Walk History]                       │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FLOW: BOOK A WALK                                                          │
│  ─────────────────                                                          │
│  1. Select Walker (or "Assign Best Available")                              │
│  2. Select Walk Type:                                                       │
│     ├── 30 Min Walk - ₹200                                                  │
│     ├── 60 Min Walk - ₹350                                                  │
│     ├── Group Walk (with other dogs) - ₹250                                 │
│     └── Jogging Session - ₹400                                              │
│  3. Select Dog(s)                                                           │
│  4. Confirm Address (with pickup point instructions)                        │
│  5. Pick Date → Pick Time                                                   │
│  6. Add Instructions ("Buddy pulls on leash", etc.)                         │
│  7. Review → Pay (or use package credit)                                    │
│  8. Receive Confirmation + OTP                                              │
│                                                                             │
│  DURING WALK:                                                               │
│  ────────────                                                               │
│  9. Walker En Route → Track on Map                                          │
│  10. Walker Arrives → Share OTP → Walk Starts                               │
│  11. LIVE TRACKING:                                                         │
│      ┌──────────────────────────────────────────────────────────────┐      │
│      │ 🗺️ [Live Map with Walker + Dog position]                     │      │
│      │                                                               │      │
│      │ Distance: 2.3 km | Duration: 25 min | Pace: Normal           │      │
│      │ Route: [Polyline showing path taken]                          │      │
│      │                                                               │      │
│      │ [Watch Live Photos] [Send Message to Walker]                  │      │
│      └──────────────────────────────────────────────────────────────┘      │
│  12. Walk Complete → Enter OTP → View Summary                               │
│      - Route Map with distance                                              │
│      - Duration                                                             │
│      - Photos taken during walk                                             │
│      - Behavior notes from walker                                           │
│                                                                             │
│  POST-WALK:                                                                 │
│  ──────────                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✅ Walk Completed!                                                   │   │
│  │                                                                      │   │
│  │ [Walk Summary Card with Map/Stats]                                   │   │
│  │                                                                      │   │
│  │ 🎁 SAVE WITH A PACKAGE                                               │   │
│  │ [10 Walks - ₹2,800 (Save ₹700)]  [Monthly Unlimited - ₹3,500]       │   │
│  │                                                                      │   │
│  │ ☑ Same walker (Rahul) for all sessions                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Vendor Journey - Walker Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WALKER VENDOR DASHBOARD FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DASHBOARD HOME                                                             │
│  ├── Toggle: [Available] / [Busy] / [Offline]                               │
│  ├── Today's Walks (Timeline View)                                          │
│  ├── Stats (Walks Today, Distance, Earnings)                                │
│  ├── Package Customers (regular clients)                                    │
│  └── Live Location Sharing Toggle                                           │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  WALK FULFILLMENT FLOW:                                                     │
│  ─────────────────────                                                      │
│  1. Receive Booking → [Accept] / [Reject]                                   │
│  2. View Customer Address on Map                                            │
│  3. When ready: Tap "Start Navigation"                                      │
│  4. Arrive at Pickup → Enter Customer OTP                                   │
│       │                                                                     │
│       ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🚶 WALK IN PROGRESS                                                  │   │
│  │                                                                      │   │
│  │ ┌──────────────────────────────────────────────────────────────┐    │   │
│  │ │ [Map showing current route]                                   │    │   │
│  │ │ Distance: 1.2 km | Time: 18:24                                │    │   │
│  │ └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │ [📸 Take Photo] [Add Note] [🆘 Emergency]                           │   │
│  │                                                                      │   │
│  │ [End Walk - Return to Pickup Point]                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  5. Walk Complete → Return Dog to Customer                                  │
│  6. Enter Customer OTP → Session Complete                                   │
│  7. Add Session Notes:                                                      │
│     - Behavior observations                                                 │
│     - Potty breaks                                                          │
│     - Interactions with other dogs                                          │
│  8. Upload Photos                                                           │
│  9. Revenue Realized → View Earnings                                        │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  CAPABILITIES SPECIFIC TO WALKERS:                                          │
│  ├── GPS Live Tracking (mandatory during walks)                             │
│  ├── Route Recording (distance, pace, path)                                 │
│  ├── In-Walk Photo Sharing                                                  │
│  ├── Behavior Notes                                                         │
│  ├── Emergency SOS Button                                                   │
│  └── Package Customer Priority Booking                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Walking Packages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WALKING PACKAGES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PACKAGE TYPES:                                                             │
│                                                                             │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ 📦 WALK PACKS      │  │ 📅 WEEKLY PLAN     │  │ ♾️ UNLIMITED       │    │
│  │                    │  │                    │  │                    │    │
│  │ 5 walks  - ₹900    │  │ 5 walks/week       │  │ Daily walks        │    │
│  │ 10 walks - ₹1,600  │  │ ₹800/week          │  │ ₹3,500/month       │    │
│  │ 20 walks - ₹2,800  │  │ Same time daily    │  │ Same walker        │    │
│  │ Valid 30 days      │  │ Same walker        │  │ Priority booking   │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                             │
│  PACKAGE FEATURES:                                                          │
│  ├── Same Walker Assignment (preferred provider)                            │
│  ├── Auto-Schedule (daily walks at same time)                               │
│  ├── Flexible Use (skip days, carry forward)                                │
│  ├── Walk History with Distance Tracking                                    │
│  └── Monthly Progress Report                                                │
│                                                                             │
│  TRACKING DASHBOARD:                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🚶 WALKING PACKAGE - 10 Walk Pack                                    │   │
│  │                                                                      │   │
│  │ Progress: ████████░░ 8/10 walks used                                 │   │
│  │ Distance covered: 24.5 km                                            │   │
│  │ Walker: Rahul (assigned)                                             │   │
│  │ Expires: Feb 15, 2026 (12 days left)                                 │   │
│  │                                                                      │   │
│  │ [Book Next Walk]  [View History]  [Renew Package]                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎓 4. TRAINER FLOWS

### 4.1 Customer Journey - Training Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TRAINING SERVICE CUSTOMER FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   TRAINING SERVICE DASHBOARD                         │   │
│  │  ┌─────────────────┐              ┌─────────────────┐               │   │
│  │  │ 🏢 TRAINING     │              │ 🏠 HOME TRAINING │               │   │
│  │  │    CENTER       │              │   Personalized   │               │   │
│  │  └────────┬────────┘              └────────┬────────┘               │   │
│  └───────────┼────────────────────────────────┼─────────────────────────┘   │
│              │                                │                             │
│              ▼                                ▼                             │
│                                                                             │
│  ENTRY POINT: FREE TRIAL                                                    │
│  ───────────────────────                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🎁 FREE TRIAL SESSION                                                │   │
│  │                                                                      │   │
│  │ Meet a trainer, assess your dog's needs, and get a training plan!   │   │
│  │                                                                      │   │
│  │ [Book Free Trial - 30 min]                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TRIAL FLOW:                                                                │
│  ──────────                                                                 │
│  1. Book Free Trial (30 min evaluation)                                     │
│  2. Meet Trainer (at center or home)                                        │
│  3. Trainer Assesses:                                                       │
│     - Current behavior                                                      │
│     - Training goals                                                        │
│     - Recommended program                                                   │
│  4. Receive Personalized Training Plan                                      │
│  5. View Package Options:                                                   │
│                                                                             │
│  POST-TRIAL CONVERSION:                                                     │
│  ─────────────────────                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📋 YOUR TRAINING PLAN (by Trainer Amit)                              │   │
│  │                                                                      │   │
│  │ Goal: Basic Obedience + Leash Training                               │   │
│  │ Recommended: 10-Session Program                                      │   │
│  │                                                                      │   │
│  │ ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │   │
│  │ │ 5 Sessions     │  │ 10 Sessions    │  │ 15 Sessions    │          │   │
│  │ │ ₹4,000         │  │ ₹7,500 (BEST)  │  │ ₹10,000        │          │   │
│  │ │ Basic Only     │  │ Basic+Advanced │  │ Comprehensive  │          │   │
│  │ └────────────────┘  └────────────────┘  └────────────────┘          │   │
│  │                                                                      │   │
│  │ ☑ Stay with Trainer Amit for all sessions                           │   │
│  │ ☑ Schedule all sessions now (or schedule later)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DURING TRAINING PROGRAM:                                                   │
│  ────────────────────────                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🎓 TRAINING PROGRESS                                                 │   │
│  │                                                                      │   │
│  │ Program: 10-Session Obedience Training                               │   │
│  │ Trainer: Amit                                                        │   │
│  │                                                                      │   │
│  │ Progress: ██████░░░░ 6/10 sessions                                   │   │
│  │                                                                      │   │
│  │ SKILLS LEARNED:                                                      │   │
│  │ ✅ Sit         ✅ Stay        ✅ Come                                 │   │
│  │ ✅ Down        🔄 Heel (in progress)                                 │   │
│  │ ⬜ Leave it    ⬜ Wait        ⬜ Place                                │   │
│  │                                                                      │   │
│  │ NEXT SESSION: Jan 18, 10:00 AM (Home Visit)                          │   │
│  │ Focus: Leash Manners, Heel Command                                   │   │
│  │                                                                      │   │
│  │ [View Full Progress] [Reschedule] [Message Trainer]                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Vendor Journey - Trainer Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TRAINER VENDOR DASHBOARD FLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DASHBOARD HOME                                                             │
│  ├── Today's Sessions (with session # of program)                           │
│  ├── Active Training Programs (customers in programs)                       │
│  ├── Free Trial Requests (pending evaluations)                              │
│  ├── Stats (Sessions, Completion Rate, Earnings)                            │
│  └── Progress Updates Pending                                               │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  SESSION FULFILLMENT:                                                       │
│  ────────────────────                                                       │
│  1. View Session Details:                                                   │
│     - Customer: Raj                                                         │
│     - Dog: Bruno (Golden Retriever, 1 year)                                 │
│     - Session: 4 of 10                                                      │
│     - Previous Session Notes: "Working on Heel"                             │
│     - Today's Focus: Continue Heel, Start Leave It                          │
│                                                                             │
│  2. Go to Location (if home visit)                                          │
│  3. Enter OTP → Start Session                                               │
│  4. Conduct Training                                                        │
│  5. Mark Session Complete → Record Progress:                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📝 SESSION PROGRESS - Session 4 of 10                                │   │
│  │                                                                      │   │
│  │ SKILLS PRACTICED:                                                    │   │
│  │ [✓] Heel   [✓] Stay   [✓] Leave It   [ ] Place                      │   │
│  │                                                                      │   │
│  │ PROFICIENCY LEVELS:                                                  │   │
│  │ Heel:     ⭐⭐⭐⭐☆ (Good, needs distraction work)                    │   │
│  │ Leave It: ⭐⭐⭐☆☆ (Learning, low distraction only)                   │   │
│  │                                                                      │   │
│  │ BEHAVIOR NOTES:                                                      │   │
│  │ [Bruno showed great improvement on heel today. Still              ]  │   │
│  │ [reactive to other dogs at distance. Recommend...                 ]  │   │
│  │                                                                      │   │
│  │ HOMEWORK FOR OWNER:                                                  │   │
│  │ [Practice heel in backyard 10 min daily. Use high-value treats.   ]  │   │
│  │                                                                      │   │
│  │ PHOTOS/VIDEOS:                                                       │   │
│  │ [+ Upload Media]                                                     │   │
│  │                                                                      │   │
│  │ NEXT SESSION FOCUS:                                                  │   │
│  │ [Heel with distractions, reinforce Leave It                       ]  │   │
│  │                                                                      │   │
│  │ [Save & Complete Session]                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  6. Enter Customer OTP → Session Complete                                   │
│  7. Progress Shared with Customer                                           │
│  8. Revenue Realized (pro-rated from package)                               │
│                                                                             │
│  ════════════════════════════════════════════════════════════════════════  │
│                                                                             │
│  CAPABILITIES SPECIFIC TO TRAINERS:                                         │
│  ├── Training Plan Builder                                                  │
│  ├── Skill Progress Tracker (per dog)                                       │
│  ├── Session Notes with Media                                               │
│  ├── Homework Assignments for Owners                                        │
│  ├── Progress Reports (shareable PDF)                                       │
│  └── Free Trial Evaluation Forms                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Training Packages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRAINING PACKAGES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PACKAGE TYPES:                                                             │
│                                                                             │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐    │
│  │ 🐕 PUPPY BASICS    │  │ 🎓 OBEDIENCE PROG  │  │ 🏆 BEHAVIOR MOD    │    │
│  │    (5 sessions)    │  │    (10 sessions)   │  │    (15 sessions)   │    │
│  │                    │  │                    │  │                    │    │
│  │ Socialization      │  │ Basic + Advanced   │  │ Aggression         │    │
│  │ Basic Commands     │  │ Commands           │  │ Anxiety            │    │
│  │ Potty Training     │  │ Leash Manners      │  │ Reactivity         │    │
│  │                    │  │ Recall             │  │                    │    │
│  │ ₹4,000             │  │ ₹7,500             │  │ ₹12,000            │    │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘    │
│                                                                             │
│  TRACKING FEATURES:                                                         │
│  ├── Skill Progress Matrix                                                  │
│  ├── Before/After Behavior Assessment                                       │
│  ├── Session-by-Session Notes                                               │
│  ├── Video Progress (owner can see improvement)                             │
│  ├── Graduation Certificate (on completion)                                 │
│  └── Maintenance Sessions (post-program)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# PART 2: WHAT'S MISSING

## Gap Analysis by Category

### A. DATABASE/SCHEMA GAPS

| Gap | Current State | Required State | Priority |
|-----|---------------|----------------|----------|
| Package preferred vendor | Not tracked | `package_purchases.preferred_vendor_id` | HIGH |
| Booking package link | Not tracked | `bookings.package_purchase_id` | HIGH |
| Session scheduling | Manual only | `package_scheduled_sessions` table | HIGH |
| Trial conversion | No tracking | `bookings.is_trial`, `converted_to_package_id` | MEDIUM |
| Walker GPS routes | Not persisted | `walk_routes` table with polylines | MEDIUM |
| Training skill matrix | Not structured | `training_skills`, `pet_skill_progress` tables | MEDIUM |

### B. API ENDPOINT GAPS

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /customer/:id/packages/active` | Get active packages by vendor/service | ❌ Missing |
| `POST /bookings/create-from-package` | Book using package credit | ❌ Missing |
| `GET /packages/post-trial-offers` | Get packages after trial | ❌ Missing |
| `POST /packages/convert-from-trial` | Convert trial to package | ❌ Missing |
| `POST /packages/:id/schedule-sessions` | Bulk schedule sessions | ❌ Missing |
| `GET /walker/:id/active-session` | Get current walk with GPS | ❌ Missing |
| `POST /walker/:id/gps-update` | Update walker location | ❌ Missing |
| `GET /training/:packageId/skills` | Get skill progress matrix | ❌ Missing |
| `POST /training/:sessionId/skills` | Update skill progress | ❌ Missing |
| `GET /customer/:id/previous-providers` | Get past service providers | ⚠️ Partial |

### C. UI COMPONENT GAPS

| Component | Purpose | Status |
|-----------|---------|--------|
| `PackageAwareBookingFlow.tsx` | Detect & use packages in booking | ❌ Missing |
| `PostSessionPackageOffer.tsx` | Show package offers after trial | ❌ Missing |
| `PackageProgressDashboard.tsx` | Customer package tracking | ⚠️ Partial |
| `WalkerServiceDashboard.tsx` (Customer) | Full walker discovery | ⚠️ Placeholder |
| `WalkLiveTrackingView.tsx` | Real-time walk map | ❌ Missing |
| `TrainingSkillMatrix.tsx` | Visual skill progress | ❌ Missing |
| `VendorPackageCustomers.tsx` | Vendor sees package clients | ❌ Missing |
| `SessionScheduler.tsx` | Bulk schedule package sessions | ❌ Missing |

---

# PART 3: MODIFICATIONS REQUIRED

## A. Database Migrations

```sql
-- Migration 070: Package and Session Tracking Enhancements

-- 1. Add preferred vendor to package purchases
ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    preferred_vendor_id UUID REFERENCES vendors(id);

ALTER TABLE package_purchases ADD COLUMN IF NOT EXISTS 
    preferred_staff_id UUID; -- For specific trainer/walker

-- 2. Add package awareness to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    package_purchase_id UUID REFERENCES package_purchases(id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    is_package_session BOOLEAN DEFAULT false;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    package_session_number INTEGER;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    is_trial BOOLEAN DEFAULT false;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS 
    converted_to_package_id UUID REFERENCES package_purchases(id);

-- 3. Package scheduled sessions (pre-schedule all sessions)
CREATE TABLE IF NOT EXISTS package_scheduled_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_purchase_id UUID NOT NULL REFERENCES package_purchases(id),
    session_number INTEGER NOT NULL,
    scheduled_date DATE,
    scheduled_time TIME,
    booking_id UUID REFERENCES bookings(id),
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'scheduled', 'completed', 'cancelled', 'rescheduled')),
    reminder_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(package_purchase_id, session_number)
);

-- 4. Walk routes for GPS tracking
CREATE TABLE IF NOT EXISTS walk_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    walker_id UUID NOT NULL REFERENCES vendors(id),
    route_polyline TEXT, -- Encoded polyline
    total_distance_meters INTEGER,
    total_duration_seconds INTEGER,
    start_location JSONB, -- {lat, lng}
    end_location JSONB,
    waypoints JSONB DEFAULT '[]', -- Array of {lat, lng, timestamp}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Training skills master list
CREATE TABLE IF NOT EXISTS training_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_name TEXT NOT NULL UNIQUE,
    skill_category TEXT NOT NULL, -- basic, advanced, behavior
    description TEXT,
    proficiency_levels JSONB DEFAULT '["learning", "developing", "proficient", "mastered"]',
    display_order INTEGER DEFAULT 0
);

-- 6. Pet skill progress tracking
CREATE TABLE IF NOT EXISTS pet_skill_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id),
    skill_id UUID NOT NULL REFERENCES training_skills(id),
    current_level TEXT DEFAULT 'learning',
    last_practiced_at TIMESTAMPTZ,
    notes TEXT,
    training_package_id UUID REFERENCES package_purchases(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pet_id, skill_id)
);

-- 7. Walker live location (for active sessions)
CREATE TABLE IF NOT EXISTS walker_live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    walker_id UUID NOT NULL REFERENCES vendors(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    current_lat DECIMAL(10, 8),
    current_lng DECIMAL(11, 8),
    heading DECIMAL(5, 2), -- Direction in degrees
    speed DECIMAL(5, 2), -- km/h
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);
```

## B. Backend Code Modifications

### 1. Modify `bookings-enhanced.ts`

```typescript
// Add package detection before booking creation
app.post("/bookings/create", async (c) => {
  // ... existing code ...
  
  // NEW: Check for active packages
  const activePackage = await checkActivePackage(customerId, vendorId, serviceType);
  
  if (activePackage && !body.skipPackageCheck) {
    return c.json({
      hasActivePackage: true,
      package: activePackage,
      message: "Customer has an active package. Use /bookings/create-from-package or pass skipPackageCheck=true"
    }, 200);
  }
  
  // ... continue with normal booking ...
});
```

### 2. Create `package-booking.ts` endpoint

```typescript
// POST /bookings/create-from-package
// Uses package credit instead of new payment
```

### 3. Modify `vendor-services.ts`

```typescript
// Add endpoint to get vendor's package customers
app.get("/vendor/:vendorId/package-customers", async (c) => {
  // Returns customers with active packages for this vendor
  // Including sessions remaining, next scheduled session
});
```

## C. Frontend Code Modifications

### 1. Modify Booking Flows

Each service dashboard should include:

```typescript
// In VetServiceRouter, GroomingServiceRouter, TrainingServiceRouter, WalkerService

// Add before starting booking:
const { hasActivePackage, package: activePkg } = await checkActivePackages(vendorId, serviceType);

if (hasActivePackage) {
  // Show PackageAwareBookingModal
  showPackageModal(activePkg);
} else {
  // Normal booking flow
  startNormalBooking();
}
```

### 2. Add Post-Session Package Offer

```typescript
// In booking completion handler:
if (booking.is_trial || !hasRecentPackageOffer(vendorId)) {
  showPostSessionPackageOffer(vendorId, serviceType);
}
```

---

# PART 4: COMPLETE MISSING PIECES

## A. UI Components to Create

| Component | Location | Description |
|-----------|----------|-------------|
| `PackageAwareBookingFlow.tsx` | `customer-web/components/customer/booking/` | Wrapper that detects packages |
| `PostSessionPackageOffer.tsx` | `customer-web/components/customer/` | Modal after trial/session |
| `ActivePackageCard.tsx` | `customer-web/components/customer/` | Shows active package on dashboards |
| `WalkerServiceDashboard.tsx` | `customer-web/components/customer/walker/` | Complete walker discovery |
| `WalkLiveTrackingView.tsx` | `customer-web/components/customer/walker/` | Real-time walk map |
| `TrainingSkillMatrix.tsx` | `customer-web/components/customer/` | Visual skill progress |
| `SessionScheduler.tsx` | `customer-web/components/customer/booking/` | Bulk schedule package sessions |
| `VendorPackageCustomers.tsx` | `vendor-web/components/vendor/` | Package clients list |
| `WalkerActiveSession.tsx` | `vendor-web/components/vendor/walker/` | GPS tracking during walk |
| `TrainerProgressForm.tsx` | `vendor-web/components/vendor/training/` | Session progress input |

## B. API Endpoints to Create

| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/customer/:id/packages/active` | `packages.ts` | GET | Get active packages |
| `/bookings/create-from-package` | `package-booking.ts` | POST | Book using package |
| `/packages/post-trial-offers` | `packages.ts` | GET | Package offers |
| `/packages/convert-from-trial` | `packages.ts` | POST | Convert trial |
| `/packages/:id/schedule-sessions` | `packages.ts` | POST | Bulk schedule |
| `/walker/:id/gps-update` | `walker-gps.ts` | POST | Update location |
| `/walker/:id/active-session` | `walker-gps.ts` | GET | Get live session |
| `/customer/:bookingId/track-walk` | `walker-gps.ts` | GET | Customer tracking |
| `/training/:packageId/skills` | `training-progress.ts` | GET | Skill matrix |
| `/training/:sessionId/skills` | `training-progress.ts` | POST | Update skills |
| `/vendor/:id/package-customers` | `vendor-services.ts` | GET | Package clients |

## C. Wireframe Requirements

### Customer App Wireframes Needed:

1. **Walker Service Dashboard** - Map with nearby walkers, previous walker, packages
2. **Walk Live Tracking** - Real-time map with route, stats, photos
3. **Training Progress View** - Skill matrix, session history, homework
4. **Package Aware Booking Modal** - "Use Package" vs "Book New" options
5. **Post-Session Package Offer** - Package cards with "Same Provider" toggle
6. **Active Packages Dashboard** - All packages with progress and quick actions

### Vendor App Wireframes Needed:

1. **Walker Active Session** - GPS tracking, photo capture, notes
2. **Trainer Progress Form** - Skill checkboxes, proficiency sliders, homework input
3. **Package Customers View** - List of package clients with sessions remaining
4. **Bulk Session Scheduler** - Calendar view for scheduling all sessions

## D. Integration Requirements

| Integration | Purpose | Status |
|-------------|---------|--------|
| Google Maps Live Tracking | Walker GPS during walks | ❌ Needs implementation |
| AWS Chime | Tele-consultation video calls | ✅ Exists |
| Push Notifications | Package expiry, session reminders | ⚠️ Partial |
| PDF Generation | Training progress reports, prescriptions | ✅ Exists |
| Payment Gateway | Package purchase, renewals | ✅ Exists |
| SMS Notifications | OTP, booking confirmations | ✅ Exists |

## E. Other Requirements

1. **Cron Jobs/Scheduled Tasks:**
   - Package expiry reminders (30, 7, 1 day before)
   - Session reminders (24h, 1h before)
   - Auto-expire unused packages
   - Walking stats aggregation (weekly summary)

2. **Analytics Events:**
   - Trial to package conversion rate
   - Package utilization rate
   - Same-provider rebooking rate
   - Package renewal rate

3. **Admin Dashboard:**
   - Package sales reports
   - Trial conversion funnel
   - Provider performance (package customers)

---

# PART 5: IMPLEMENTATION PLAN

## Phase 1: Database & Core APIs (3 days)
- [ ] Create migration 070 for new tables
- [ ] Implement `/customer/:id/packages/active`
- [ ] Implement `/bookings/create-from-package`
- [ ] Modify booking creation to detect packages

## Phase 2: Package Flow UI (3 days)
- [ ] Create `PackageAwareBookingFlow.tsx`
- [ ] Create `PostSessionPackageOffer.tsx`
- [ ] Create `ActivePackageCard.tsx`
- [ ] Integrate into service dashboards

## Phase 3: Walker GPS Features (2 days)
- [ ] Create `walker-gps.ts` endpoints
- [ ] Create `WalkLiveTrackingView.tsx`
- [ ] Create `WalkerActiveSession.tsx` (vendor)
- [ ] Implement route recording

## Phase 4: Training Progress (2 days)
- [ ] Seed training skills master data
- [ ] Create skill progress endpoints
- [ ] Create `TrainingSkillMatrix.tsx`
- [ ] Create `TrainerProgressForm.tsx`

## Phase 5: Vendor Package Management (2 days)
- [ ] Create `VendorPackageCustomers.tsx`
- [ ] Add package info to booking cards
- [ ] Create session scheduling for vendors
- [ ] Add package reports to analytics

## Phase 6: Testing & Polish (2 days)
- [ ] End-to-end flow testing
- [ ] Package purchase → use → complete
- [ ] GPS tracking accuracy testing
- [ ] Performance optimization

---

**Total Estimated Effort: 14 days**

---

*Document created: January 15, 2026*
*Last updated: January 15, 2026*
