# 🔴 CRITICAL GAPS & SYSTEM CONTRACTS ADDENDUM

**Added:** January 2026 - Phase 2 Pre-requisite  
**Purpose:** Address enterprise-grade system requirements before migration

---

## 🔄 GAP 1: STATE TRANSITION DIAGRAMS (CRITICAL)

### **1.1 BOOKING STATE MACHINE**

```
┌─────────────────────────────────────────────────────────────────┐
│                    BOOKING LIFECYCLE STATE MACHINE              │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │   CREATED    │ (Customer books, payment pending)
                    └──────┬───────┘
                           │
                    [Payment Success]
                           │
                           ▼
                    ┌──────────────┐
              ┌─────│  CONFIRMED   │◄────┐ (Vendor accepts)
              │     └──────┬───────┘     │
              │            │             │ [Reschedule Request]
              │     [Vendor Accepts]     │
              │            │             │
              │            ▼             │
              │     ┌──────────────┐    │
              │     │  IN_PROGRESS │────┘
              │     └──────┬───────┘
              │            │
              │     [Service Completed]
              │            │
              │            ▼
              │     ┌──────────────┐
              │     │  COMPLETED   │
              │     └──────────────┘
              │
              │     [Cancel Request]
              │            │
              ▼            ▼
       ┌──────────────┐   │
       │  CANCELLED   │◄──┘
       └──────────────┘
              │
       [Refund Processed]
              │
              ▼
       ┌──────────────┐
       │   REFUNDED   │
       └──────────────┘
```

#### **State Definitions & Allowed Transitions**

| State | Description | Allowed Next States | Who Can Transition | UI Elements |
|-------|-------------|--------------------|--------------------|-------------|
| **CREATED** | Booking created, awaiting payment | CONFIRMED, CANCELLED | System (payment), Customer (cancel) | Payment button, Cancel button |
| **CONFIRMED** | Payment successful, vendor notified | IN_PROGRESS, CANCELLED, RESCHEDULED | Vendor (accept), Customer (cancel) | Accept/Decline buttons, Reschedule button |
| **IN_PROGRESS** | Service actively being delivered | COMPLETED, CANCELLED | Vendor (complete), System (timeout) | Complete button, Add notes, Upload photos |
| **COMPLETED** | Service finished | None (terminal) | Vendor (completion OTP) | Rate/Review modal |
| **CANCELLED** | Booking cancelled | REFUNDED | Customer/Vendor/Admin | Refund status, Cancellation reason |
| **REFUNDED** | Money returned to customer | None (terminal) | System (auto after cancel) | Refund receipt |
| **RESCHEDULED** | Date/time changed | CONFIRMED | Customer (reschedule) | New date/time picker |

#### **Invalid Transitions (Blocked)**
- ❌ CREATED → IN_PROGRESS (Must go through CONFIRMED)
- ❌ COMPLETED → CANCELLED (Cannot cancel after completion)
- ❌ REFUNDED → CONFIRMED (Cannot reactivate refunded booking)
- ❌ IN_PROGRESS → CREATED (Cannot go backward)

#### **UI Lock Rules Per State**

**CREATED:**
- ✅ Show: Payment button, Booking details, Cancel button
- 🔒 Locked: All vendor actions, Service start
- ⏱️ Timeout: 15 minutes to complete payment, else auto-cancel

**CONFIRMED:**
- ✅ Customer: Can view details, reschedule, cancel
- ✅ Vendor: Can accept, decline, view customer info
- 🔒 Locked: Payment button, Service actions
- 📱 Notifications: Push + SMS to vendor

**IN_PROGRESS:**
- ✅ Vendor: Can add notes, upload photos, complete service
- ✅ Customer: Can track GPS (home services), chat, call
- 🔒 Locked: Cancel button (must contact support), Reschedule
- 🔴 Critical: OTP required to move to COMPLETED

**COMPLETED:**
- ✅ Customer: Can rate/review (once)
- ✅ Vendor: Can view review, respond
- 🔒 Locked: All modification actions
- 📊 Analytics: Updates vendor rating

**CANCELLED:**
- ✅ Show: Cancellation reason, Refund status
- 🔒 Locked: All actions except view
- 💰 Auto-refund: Processed based on cancellation policy

---

### **1.2 VENDOR ONBOARDING STATE MACHINE**

```
┌─────────────────────────────────────────────────────────────────┐
│              VENDOR ONBOARDING STATE MACHINE                    │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   PENDING    │ (Application submitted)
    └──────┬───────┘
           │
    [Admin Reviews]
           │
           ├──────────────────┬──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌──────────────┐   ┌──────────────┐  ┌──────────────┐
    │   APPROVED   │   │CLARIFICATION │  │   REJECTED   │
    └──────┬───────┘   │  _REQUESTED  │  └──────────────┘
           │           └──────┬───────┘         │
           │                  │                 │
           │           [Vendor Updates]         │
           │                  │                 │
           │                  ▼                 │
           │           ┌──────────────┐        │
           │           │UNDER_REVIEW  │        │
           │           └──────┬───────┘        │
           │                  │                 │
           │          [Admin Re-reviews]       │
           │                  │                 │
           │                  ├─────────────────┘
           │                  │
           ▼                  ▼
    ┌──────────────┐   ┌──────────────┐
    │    ACTIVE    │   │   REJECTED   │
    └──────────────┘   └──────────────┘
           │
    [Violation/Deactivation]
           │
           ▼
    ┌──────────────┐
    │  SUSPENDED   │
    └──────┬───────┘
           │
    [Appeal Approved]
           │
           ▼
    ┌──────────────┐
    │    ACTIVE    │
    └──────────────┘
```

#### **State Definitions**

| State | Who Can Transition | UI Access | Next Actions |
|-------|-------------------|-----------|--------------|
| **PENDING** | System (on submit) | View application status | Wait for admin |
| **UNDER_REVIEW** | Admin (starts review) | View status, track progress | Admin reviews docs |
| **CLARIFICATION_REQUESTED** | Admin | Edit application, upload new docs | Vendor fixes issues |
| **APPROVED** | Admin | Access setup wizard | Complete profile setup |
| **ACTIVE** | Vendor (completes setup) | Full dashboard access | Start accepting bookings |
| **REJECTED** | Admin | View rejection reason, reapply | Start new application |
| **SUSPENDED** | Admin | Limited read-only access | Appeal or comply |

#### **UI Lock Rules Per State**

**PENDING:**
- ✅ Show: Application status badge, Timeline
- 🔒 Locked: Dashboard, Service management
- 📱 Notification: "Application under review"

**CLARIFICATION_REQUESTED:**
- ✅ Show: Admin comments, Edit form, Upload buttons
- 🔒 Locked: Dashboard access
- 🔴 Required: Must update before timeout (7 days)

**APPROVED:**
- ✅ Show: Setup wizard, Profile completion checklist
- 🔒 Locked: Booking management (until ACTIVE)
- 🎉 Banner: "Congratulations! Complete your setup"

**ACTIVE:**
- ✅ Full Access: All dashboard features unlocked
- 📊 Metrics: Bookings, earnings, analytics visible

**SUSPENDED:**
- 🔒 Locked: New bookings disabled
- ✅ Show: Existing bookings (read-only), Appeal button
- 🔴 Alert: "Account suspended - Contact support"

---

### **1.3 ORDER STATE MACHINE (E-commerce)**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER LIFECYCLE STATE MACHINE                │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   CREATED    │ (Cart checkout)
    └──────┬───────┘
           │
    [Payment Success]
           │
           ▼
    ┌──────────────┐
    │  CONFIRMED   │ (Seller notified)
    └──────┬───────┘
           │
    [Seller Packs]
           │
           ▼
    ┌──────────────┐
    │    PACKED    │
    └──────┬───────┘
           │
    [Handed to Delivery]
           │
           ▼
    ┌──────────────┐
    │   SHIPPED    │
    └──────┬───────┘
           │
    [Out for Delivery]
           │
           ▼
    ┌──────────────┐
    │OUT_FOR_DELIVERY│
    └──────┬───────┘
           │
    [Customer Receives]
           │
           ▼
    ┌──────────────┐
    │  DELIVERED   │
    └──────┬───────┘
           │
           ├──────────[Return Request]────────┐
           │                                  │
           ▼                                  ▼
    ┌──────────────┐                  ┌──────────────┐
    │  COMPLETED   │                  │   RETURNED   │
    └──────────────┘                  └──────┬───────┘
                                             │
                                      [Refund Processed]
                                             │
                                             ▼
                                      ┌──────────────┐
                                      │   REFUNDED   │
                                      └──────────────┘

    [Cancel anytime before PACKED]
           │
           ▼
    ┌──────────────┐
    │  CANCELLED   │
    └──────┬───────┘
           │
    [Auto Refund]
           │
           ▼
    ┌──────────────┐
    │   REFUNDED   │
    └──────────────┘
```

#### **UI Elements Per State**

| State | Customer Actions | Seller Actions | Tracking |
|-------|-----------------|----------------|----------|
| **CONFIRMED** | Cancel order | Accept order, Start packing | Order confirmed badge |
| **PACKED** | Track order | Generate shipping label | Packing progress |
| **SHIPPED** | Track GPS | Update tracking | Live map, ETA |
| **OUT_FOR_DELIVERY** | Track GPS, Call delivery | Monitor delivery | Delivery partner info |
| **DELIVERED** | Rate/Review, Request return | View feedback | Delivery confirmation |
| **RETURNED** | Track refund | Process return | Return reason, photos |
| **CANCELLED** | View refund status | N/A | Cancellation reason |

---

## ❌ GAP 2: ERROR / EDGE / FAILURE UX (CRITICAL)

### **2.1 PAYMENT FAILURES**

#### **Scenario 1: Payment Success but Booking Creation Fails**
```
┌─────────────────────────────────────────────────────────────────┐
│                    ⚠️ Payment Successful                        │
│                 But Booking Creation Failed                     │
├─────────────────────────────────────────────────────────────────┤
│ What Happened:                                                  │
│ Your payment of ₹500 was successful, but we couldn't create    │
│ your booking due to a technical issue.                         │
│                                                                 │
│ What We're Doing:                                              │
│ 🔄 Retrying booking creation automatically...                  │
│ 💰 Your money is safe in our system                           │
│                                                                 │
│ Your Options:                                                   │
│ [Retry Now] [View Transaction] [Contact Support]              │
│                                                                 │
│ Reference: TXN-2026-001                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Backend Behavior:**
- Auto-retry booking creation 3 times (30 sec apart)
- If all fail: Credit amount to wallet
- Send email/SMS with transaction details
- Create support ticket automatically

**UI States:**
1. Show loading spinner: "Processing booking..."
2. After 5 sec: Show warning banner
3. After retry exhausted: Show failure + wallet credit confirmation

---

#### **Scenario 2: Payment Deducted but Gateway Timeout**
```
┌─────────────────────────────────────────────────────────────────┐
│               ⏳ Payment Status Verification                    │
├─────────────────────────────────────────────────────────────────┤
│ We're checking your payment status...                          │
│                                                                 │
│ 🔍 Verifying with payment gateway...                          │
│                                                                 │
│ This may take up to 2 minutes.                                │
│ Please don't close this window or press back.                 │
│                                                                 │
│ [View Status] [Contact Support]                               │
│                                                                 │
│ If money was deducted, we'll confirm your booking or refund   │
│ within 30 minutes.                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Resolution Flow:**
- Poll payment gateway every 10 seconds (max 12 times)
- If success: Create booking and show confirmation
- If failed: Show payment failed + retry option
- If inconclusive: Show "Under verification" + support contact

---

### **2.2 VENDOR NO-SHOW / LATE ACCEPTANCE**

#### **Scenario: Vendor Doesn't Accept within 2 Hours**
```
┌─────────────────────────────────────────────────────────────────┐
│               ⚠️ Vendor Hasn't Responded Yet                   │
├─────────────────────────────────────────────────────────────────┤
│ Your booking is confirmed, but the vendor hasn't accepted yet. │
│                                                                 │
│ Booking: #WP2026-001                                           │
│ Vendor: Dr. Amit Sharma                                        │
│ Scheduled: Today, 3:00 PM                                      │
│                                                                 │
│ What's Happening:                                              │
│ • We've sent multiple reminders to the vendor                 │
│ • Your booking is still valid                                  │
│                                                                 │
│ Your Options:                                                   │
│ [Find Alternative Vendor] [Cancel & Refund] [Contact Support] │
│                                                                 │
│ 💰 Full refund guaranteed if vendor doesn't respond           │
└─────────────────────────────────────────────────────────────────┘
```

**Auto-escalation:**
- 30 min: Send reminder SMS to vendor
- 1 hour: Call vendor (if contact enabled)
- 2 hours: Show customer alternative vendors
- 4 hours: Auto-cancel + full refund + penalty to vendor

---

#### **Scenario: Vendor No-Show at Service Time**
```
┌─────────────────────────────────────────────────────────────────┐
│                  🚨 Vendor No-Show Report                      │
├─────────────────────────────────────────────────────────────────┤
│ Is the vendor more than 15 minutes late?                       │
│                                                                 │
│ Scheduled Time: 3:00 PM                                        │
│ Current Time: 3:20 PM                                          │
│                                                                 │
│ [Yes, Report No-Show] [Vendor Called, Running Late]           │
│                                                                 │
│ If you report no-show:                                         │
│ ✅ Instant full refund                                         │
│ ✅ ₹200 inconvenience credit                                  │
│ ✅ Priority booking with another vendor                        │
│ ✅ Vendor will be penalized                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Post No-Show Flow:**
- Immediate refund + bonus credit
- Show "Book Again" with alternative vendors (pre-filtered)
- Create incident report for admin
- Vendor gets warning/suspension based on history

---

### **2.3 GPS & PERMISSION FAILURES**

#### **Scenario: Location Permission Denied**
```
┌─────────────────────────────────────────────────────────────────┐
│               📍 Location Access Required                      │
├─────────────────────────────────────────────────────────────────┤
│ To find nearby vendors and enable GPS tracking, we need        │
│ access to your location.                                       │
│                                                                 │
│ Without location access:                                        │
│ • You'll need to manually search by area                       │
│ • GPS tracking for home services won't work                    │
│ • Distance-based vendor filtering unavailable                  │
│                                                                 │
│ [Enable Location] [Enter Location Manually]                   │
│                                                                 │
│ 🔒 Privacy: We only use your location to show nearby services.│
│    You can disable it anytime in settings.                    │
└─────────────────────────────────────────────────────────────────┘
```

**Fallback Flow:**
- Show manual location entry (pincode/area)
- Disable GPS tracking features
- Show distance as "Area-based" instead of exact km
- Remind periodically to enable for better experience

---

#### **Scenario: GPS Signal Lost During Service**
```
┌─────────────────────────────────────────────────────────────────┐
│                  ⚠️ GPS Signal Lost                            │
├─────────────────────────────────────────────────────────────────┤
│ We've temporarily lost the vendor's GPS signal.               │
│                                                                 │
│ Last Known Location: Indiranagar (5 min ago)                  │
│ Expected Arrival: 3:15 PM (in 10 mins)                        │
│                                                                 │
│ Don't worry:                                                    │
│ • Your booking is still active                                 │
│ • You can still call or chat with the vendor                  │
│ • GPS will reconnect automatically                            │
│                                                                 │
│ [Call Vendor] [Chat] [Refresh Map]                            │
│                                                                 │
│ If vendor doesn't arrive by 3:30 PM, you can report no-show.  │
└─────────────────────────────────────────────────────────────────┘
```

---

### **2.4 VIDEO CALL FAILURES**

#### **Scenario: Video Call Drops Mid-Consultation**
```
┌─────────────────────────────────────────────────────────────────┐
│              🔌 Call Disconnected                              │
├─────────────���───────────────────────────────────────────────────┤
│ Your video call was disconnected.                              │
│                                                                 │
│ Time Elapsed: 12 min 34 sec                                    │
│ Remaining: 2 min 26 sec                                        │
│                                                                 │
│ [Reconnect Now] [Continue with Voice Only] [Chat with Vendor] │
│                                                                 │
│ 💡 Poor connection? Try:                                       │
│ • Switch to WiFi if available                                  │
│ • Move to area with better signal                             │
│ • Disable video for voice-only call                           │
│                                                                 │
│ 💰 You'll only be charged for actual consultation time        │
└─────────────────────────────────────────────────────────────────┘
```

**Billing Logic:**
- Charge only for connected time
- Auto-extend session by 5 min if disconnect < 2 min from end
- If vendor issue: Full refund + reschedule option
- If customer issue: Normal billing

---

#### **Scenario: Camera/Mic Permission Denied**
```
┌─────────────────────────────────────────────────────────────────┐
│           🎥 Camera/Microphone Access Blocked                  │
├─────────────────────────────────────────────────────────────────┤
│ To join the video consultation, please allow:                  │
│                                                                 │
│ ✅ Camera - So the vet can see your pet                       │
│ ✅ Microphone - So you can talk with the vet                  │
│                                                                 │
│ How to enable:                                                  │
│ 1. Click the 🔒 icon in your browser address bar              │
│ 2. Allow Camera and Microphone access                         │
│ 3. Refresh this page                                           │
│                                                                 │
│ [I've Enabled - Retry] [Switch to Chat Only] [Cancel Call]    │
│                                                                 │
│ Can't enable? Switch to audio call or reschedule.             │
└─────────────────────────────────────────────────────────────────┘
```

---

### **2.5 OTP FAILURES**

#### **Scenario: Wrong OTP Entered Multiple Times**
```
┌─────────────────────────────────────────────────────────────────┐
│                  ❌ Incorrect OTP                              │
├─────────────────────────────────────────────────────────────────┤
│ The OTP you entered is incorrect.                              │
│                                                                 │
│ Attempts Remaining: 2 of 5                                     │
│                                                                 │
│ Please ask the customer for the correct 6-digit OTP:           │
│ [_] [_] [_] [_] [_] [_]                                       │
│                                                                 │
│ [Verify OTP]                                                   │
│                                                                 │
│ 💡 Tips:                                                       │
│ • OTP is case-sensitive                                        │
│ • OTP expires in 5 minutes                                     │
│ • After 5 wrong attempts, contact support                      │
│                                                                 │
│ [Contact Customer] [Contact Support]                          │
└─────────────────────────────────────────────────────────────────┘
```

**Lockout Behavior:**
- After 5 failed attempts: Lock for 15 minutes
- Show support contact prominently
- Log incident for fraud detection
- Customer notified via SMS about failed attempts

---

### **2.6 ADMIN INACTIVITY**

#### **Scenario: Pending Applications Exceeding SLA**
```
┌─────────────────────────────────────────────────────────────────┐
│              🚨 SLA BREACH ALERT                               │
├─────────────────────────────────────────────────────────────────┤
│ 15 vendor applications have been pending for >48 hours!        │
│                                                                 │
│ This affects:                                                   │
│ • Platform growth                                              │
│ • Vendor satisfaction                                          │
│ • Service availability                                         │
│                                                                 │
│ Applications Pending >48h: 15                                  │
│ Applications Pending >72h: 5 (CRITICAL)                       │
│                                                                 │
│ [Review Pending Applications] [Assign to Team] [View Report]  │
│                                                                 │
│ Auto-escalation: If not resolved in 24h, will alert           │
│ senior management.                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Auto-escalation Rules:**
- 48 hours: Show warning banner to assigned admin
- 72 hours: Email to admin manager
- 96 hours: Alert to platform owner
- 120 hours: Auto-approve with basic verification (emergency mode)

---

## 📱 GAP 3: RESPONSIVE & ADAPTIVE RULES

### **3.1 NAVIGATION PATTERNS**

#### **Desktop (>1024px)**
```
┌─────────────────────────────────────────────────────────────────┐
│ Logo | Search Bar         | Wallet | Cart | Profile | Logout   │
├──────┬──────────────────────────────────────────────────────────┤
│      │                                                           │
│  S   │                  Main Content Area                       │
│  i   │                  (Full width, scrollable)                │
│  d   │                                                           │
│  e   │                                                           │
│  b   │                                                           │
│  a   │                                                           │
│  r   │                                                           │
│      │                                                           │
└──────┴──────────────────────────────────────────────────────────┘
```

**Desktop Sidebar:**
- Fixed 256px width
- Collapsible to 64px (icon-only)
- Sticky during scroll
- Hover to expand (collapsed mode)

---

#### **Tablet (768px - 1024px)**
```
┌─────────────────────────────────────────────────────────────────┐
│ ☰ Logo | Search                    | Cart | Profile            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                  Main Content Area                              │
│                  (80% width, centered)                          │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tablet Sidebar:**
- Hamburger menu → Slide-in drawer
- Overlay on content (not push)
- Swipe left to close
- 280px width when open

---

#### **Mobile (<768px)**
```
┌─────────────────────────────────────────────────────────────────┐
│ ☰ Logo                                    🔍  🛒  👤           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│                  Main Content Area                              │
│                  (100% width)                                   │
│                                                                 │
│                                                                 │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│     Home     Services     Bookings     Profile                 │
└─────────────────────────────────────────────────────────────────┘
```

**Mobile Bottom Navigation:**
- Fixed bottom bar (60px height)
- 4-5 primary items max
- Active state: Icon + Label + Orange underline
- Inactive: Icon only (grayscale)

---

### **3.2 COMPONENT ADAPTIVE RULES**

#### **Vendor Dashboard**

| Component | Desktop | Tablet | Mobile |
|-----------|---------|--------|--------|
| **Sidebar** | Fixed sidebar (256px) | Hamburger drawer | Bottom nav (60px) |
| **Stats Cards** | 4 in a row | 2 in a row | 1 per row |
| **Booking Table** | Full table with all columns | Table with horizontal scroll | Card-based list with swipe actions |
| **Actions** | Buttons visible | Buttons visible | Overflow menu (⋮) |
| **Charts** | Full-width graphs | 2 charts per row | 1 chart per row, simplified |
| **Modals** | Centered modal (600px) | Full-screen modal with back button | Full-screen with header |

---

#### **Booking Cards**

**Desktop:**
```
┌─────────────────────────────────────────────────────────────────┐
│ #WP001 | Max | 9:00 AM                      [Accept] [Decline] │
│ General Checkup • ₹500                        [View Details]    │
└─────────────────────────────────────────────────────────────────┘
```

**Mobile:**
```
┌─────────────────────────────────────────┐
│ #WP001 • Max                    ⋮       │
│ General Checkup                         │
│ 9:00 AM • ₹500                         │
│                                         │
│ [Accept] [Decline]                     │
└─────────────────────────────────────────┘
```

**Swipe Actions (Mobile):**
- Swipe Right: Accept (Green)
- Swipe Left: Decline (Red)
- Tap ⋮: More options menu

---

#### **Service Discovery**

| View Type | Desktop | Mobile |
|-----------|---------|--------|
| **Problem Grid** | 6 cards per row | 2 cards per row |
| **Vendor List** | Table with sorting | Cards with infinite scroll |
| **Filters** | Sidebar panel | Bottom sheet |
| **Search Bar** | Top header (always visible) | Sticky header (collapses on scroll down, appears on scroll up) |
| **Map View** | Split screen (map 50%, list 50%) | Full-screen map with bottom sheet list |

---

### **3.3 INTERACTION PATTERN CHANGES**

#### **Hover → Tap Replacements**

| Desktop Interaction | Mobile Replacement |
|--------------------|--------------------|
| Hover to show actions | Tap card to expand, show actions |
| Hover tooltip | Long-press for tooltip |
| Right-click context menu | Long-press menu |
| Hover to preview | Tap to open preview modal |
| Dropdown on hover | Always visible dropdown |

---

#### **Modal → Full-Screen (Mobile)**

All modals become full-screen sheets on mobile:
```
Desktop Modal (600px centered)
              ↓
Mobile: Full-screen with:
  - Header with back arrow
  - Title
  - Scrollable content
  - Sticky footer with actions
```

---

#### **Table → Card List (Mobile)**

Desktop table columns:
```
| ID | Customer | Service | Time | Amount | Status | Actions |
```

Mobile card:
```
┌─────────────────────────────────┐
│ #WP001 • Max                    │
│ General Checkup                 │
│ Today, 9:00 AM • ₹500          │
│ Status: Confirmed               │
│ [View Details]                  │
└─────────────────────────────────┘
```

---

### **3.4 TOUCH TARGET SIZES**

**Minimum Sizes (Mobile):**
- Buttons: 44px × 44px
- Icons: 24px × 24px (within 44px tap target)
- List items: 56px height minimum
- Form inputs: 48px height
- Bottom nav items: 60px × 60px

**Spacing (Mobile):**
- Between buttons: 12px minimum
- Card padding: 16px
- Screen margins: 16px
- Section spacing: 24px

---

## 🎨 GAP 4: DESIGN TOKENS & SYSTEM CONTRACT

### **4.1 SPACING SCALE**

```typescript
export const spacing = {
  xs: '4px',    // 0.25rem - Tight spacing, inline elements
  sm: '8px',    // 0.5rem - Small gaps
  md: '12px',   // 0.75rem - Default element spacing
  base: '16px', // 1rem - Base unit, card padding
  lg: '24px',   // 1.5rem - Section spacing
  xl: '32px',   // 2rem - Large section gaps
  '2xl': '48px',// 3rem - Major section dividers
  '3xl': '64px',// 4rem - Page sections
  '4xl': '96px' // 6rem - Hero sections
};
```

**Usage Rules:**
- Card padding: `base` (16px)
- Element gaps: `sm` (8px) to `md` (12px)
- Section spacing: `lg` (24px) to `xl` (32px)
- Never use arbitrary values (e.g., `mt-[13px]`) - Always use scale

---

### **4.2 TYPOGRAPHY SCALE**

```typescript
export const typography = {
  // Display (Hero headings)
  'display-2xl': { size: '72px', lineHeight: '90px', weight: 700 },
  'display-xl': { size: '60px', lineHeight: '72px', weight: 700 },
  'display-lg': { size: '48px', lineHeight: '60px', weight: 700 },
  
  // Headings
  'h1': { size: '36px', lineHeight: '44px', weight: 600 },
  'h2': { size: '30px', lineHeight: '38px', weight: 600 },
  'h3': { size: '24px', lineHeight: '32px', weight: 600 },
  'h4': { size: '20px', lineHeight: '28px', weight: 600 },
  'h5': { size: '18px', lineHeight: '26px', weight: 600 },
  'h6': { size: '16px', lineHeight: '24px', weight: 600 },
  
  // Body
  'body-lg': { size: '18px', lineHeight: '28px', weight: 400 },
  'body-base': { size: '16px', lineHeight: '24px', weight: 400 },
  'body-sm': { size: '14px', lineHeight: '20px', weight: 400 },
  
  // Small text
  'caption': { size: '12px', lineHeight: '16px', weight: 400 },
  'overline': { size: '10px', lineHeight: '14px', weight: 500, transform: 'uppercase' }
};
```

**Font Weights:**
- 400: Regular (body text)
- 500: Medium (labels, emphasis)
- 600: Semibold (headings, buttons)
- 700: Bold (display, hero)

**CSS Variables:**
```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

---

### **4.3 COLOR TOKENS**

#### **Brand Colors**
```typescript
export const colors = {
  // Primary (Orange gradient)
  primary: {
    50: '#FFF5EB',
    100: '#FFE5CC',
    200: '#FFCB99',
    300: '#FFB166',
    400: '#FF9740',
    500: '#FF8C42', // Main brand color
    600: '#F57C20',
    700: '#E06800',
    800: '#B85400',
    900: '#8F4000'
  },
  
  // Secondary (Pink)
  secondary: {
    50: '#FFE5F0',
    100: '#FFCCE0',
    200: '#FF99C2',
    300: '#FF80AF',
    400: '#FF6B9D', // Main secondary
    500: '#F54F87',
    600: '#E03670',
    700: '#C72059',
    800: '#A01547',
    900: '#7A0D35'
  },
  
  // Service-specific colors (see guidelines)
  service: {
    veterinary: '#26C6DA',
    grooming: '#FF6B9D',
    training: '#9B59B6',
    boarding: '#FF8C42',
    walking: '#4CAF50',
    nutrition: '#FFC857',
    pharmacy: '#2196F3',
    adoption: '#E91E63',
    insurance: '#673AB7'
  }
};
```

#### **Semantic Colors**
```typescript
export const semantic = {
  success: {
    bg: '#F0FDF4',     // Light green background
    border: '#86EFAC', // Green border
    text: '#166534',   // Dark green text
    icon: '#22C55E'    // Green icon
  },
  warning: {
    bg: '#FFFBEB',
    border: '#FCD34D',
    text: '#92400E',
    icon: '#F59E0B'
  },
  error: {
    bg: '#FEF2F2',
    border: '#FCA5A5',
    text: '#991B1B',
    icon: '#EF4444'
  },
  info: {
    bg: '#EFF6FF',
    border: '#93C5FD',
    text: '#1E40AF',
    icon: '#3B82F6'
  }
};
```

#### **Status Colors**
```typescript
export const status = {
  // Booking status
  pending: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
  confirmed: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
  in_progress: { bg: '#E0E7FF', text: '#4338CA', border: '#A5B4FC' },
  completed: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  cancelled: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
  
  // Vendor status
  active: { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  inactive: { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  suspended: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' }
};
```

---

### **4.4 SHADOW SCALE**

```typescript
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)'
};
```

**Usage:**
- Cards (rest): `shadow-base`
- Cards (hover): `shadow-md`
- Modals: `shadow-xl`
- Buttons: `shadow-sm`
- Dropdowns: `shadow-lg`

---

### **4.5 BORDER RADIUS**

```typescript
export const borderRadius = {
  none: '0',
  sm: '4px',    // Small elements, badges
  base: '8px',  // Buttons, inputs
  md: '12px',   // Small cards
  lg: '16px',   // Large cards
  xl: '20px',   // Feature cards
  '2xl': '24px',// Hero cards
  full: '9999px'// Pills, avatars
};
```

**Consistency Rules:**
- Buttons: `rounded-lg` (8px)
- Cards: `rounded-xl` (16px)
- Modals: `rounded-2xl` (24px)
- Avatars: `rounded-full`
- Badges: `rounded-full`

---

### **4.6 DISABLED STATES**

```typescript
export const disabled = {
  opacity: 0.5,
  cursor: 'not-allowed',
  pointerEvents: 'none',
  background: '#F3F4F6',
  text: '#9CA3AF'
};
```

**CSS Classes:**
```css
.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-disabled {
  background: #E5E7EB;
  color: #9CA3AF;
  border: 1px solid #D1D5DB;
}
```

---

### **4.7 LOADING SKELETONS**

**Skeleton Variants:**
```typescript
export const skeleton = {
  background: '#E5E7EB',
  shimmer: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)',
  animation: {
    name: 'shimmer',
    duration: '1.5s',
    timingFunction: 'ease-in-out',
    iterationCount: 'infinite'
  }
};
```

**Skeleton Components:**
- Text: Rectangle with rounded corners
- Avatar: Circle
- Card: Full card outline with internal rectangles
- Table Row: Multiple rectangles for columns

**Usage Rules:**
- Always show skeleton during initial load
- Match skeleton size to actual content
- Use shimmer animation for better UX
- Minimum display time: 300ms (avoid flashing)

---

### **4.8 Z-INDEX SCALE**

```typescript
export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  notification: 1080
};
```

**Layer Stack (Top to Bottom):**
1. Notifications (1080)
2. Tooltips (1070)
3. Popovers (1060)
4. Modals (1050)
5. Modal Backdrops (1040)
6. Fixed Elements (1030)
7. Sticky Headers (1020)
8. Dropdowns (1000)

---

### **4.9 ANIMATION TOKENS**

```typescript
export const animation = {
  duration: {
    fast: '150ms',
    base: '300ms',
    slow: '500ms'
  },
  easing: {
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
  }
};
```

**Usage:**
- Micro-interactions: `fast` (150ms)
- Modals, dropdowns: `base` (300ms)
- Page transitions: `slow` (500ms)
- Default easing: `easeInOut`

---

### **4.10 COMPONENT STATE TOKENS**

#### **Button States**
```typescript
export const buttonStates = {
  rest: {
    background: 'linear-gradient(135deg, #FF8C42 0%, #FF6B9D 100%)',
    boxShadow: shadows.sm,
    transform: 'scale(1)'
  },
  hover: {
    background: 'linear-gradient(135deg, #F57C20 0%, #F54F87 100%)',
    boxShadow: shadows.md,
    transform: 'scale(1.02)'
  },
  active: {
    background: 'linear-gradient(135deg, #E06800 0%, #E03670 100%)',
    boxShadow: shadows.base,
    transform: 'scale(0.98)'
  },
  focus: {
    outline: '2px solid #FF8C42',
    outlineOffset: '2px'
  },
  disabled: {
    background: '#E5E7EB',
    color: '#9CA3AF',
    cursor: 'not-allowed'
  }
};
```

#### **Input States**
```typescript
export const inputStates = {
  rest: {
    border: '1px solid #D1D5DB',
    background: '#FFFFFF'
  },
  focus: {
    border: '2px solid #FF8C42',
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(255, 140, 66, 0.1)'
  },
  error: {
    border: '2px solid #EF4444',
    background: '#FEF2F2'
  },
  disabled: {
    border: '1px solid #E5E7EB',
    background: '#F9FAFB',
    color: '#9CA3AF'
  }
};
```

---

## 📝 DESIGN CONTRACT CHECKLIST

### **For Developers:**
- [ ] Use only tokens from design system (no arbitrary values)
- [ ] Follow spacing scale for all margins/paddings
- [ ] Use typography scale for all text (no inline font sizes)
- [ ] Apply correct status colors for booking states
- [ ] Implement all disabled states per contract
- [ ] Show loading skeletons during data fetch
- [ ] Follow z-index scale for layered elements
- [ ] Use animation tokens for all transitions
- [ ] Ensure touch targets meet 44px minimum on mobile
- [ ] Test responsive rules on all breakpoints

### **For Designers:**
- [ ] All designs use approved color tokens
- [ ] Spacing follows 4px base grid
- [ ] Typography matches defined scale
- [ ] Component states documented (hover, active, disabled)
- [ ] Mobile and desktop variants provided
- [ ] Error states designed
- [ ] Loading states designed
- [ ] Empty states designed

---

## ✅ ADDENDUM COMPLETION CHECKLIST

- ✅ **State Transition Diagrams** - Complete for Booking, Vendor Onboarding, Orders
- ✅ **Error & Edge Cases** - 10+ critical scenarios documented with UX
- ✅ **Responsive Rules** - Desktop/Tablet/Mobile breakpoints defined
- ✅ **Design Tokens** - Complete design system contract
- ✅ **UI Lock Rules** - Per-state UI behavior defined
- ✅ **Escalation Paths** - Auto-escalation and recovery flows
- ✅ **Touch Targets** - Minimum sizes documented
- ✅ **Animation Tokens** - Duration and easing defined

---

**Addendum Version:** 1.0  
**Last Updated:** Before Phase 2 Migration  
**Status:** ✅ Ready for Implementation

---

*This addendum closes all critical gaps identified before proceeding to Phase 2 Customer App migration.*
