# WARMPAWZ PLATFORM - COMPREHENSIVE REQUIREMENTS VALIDATION REPORT
**Generated:** November 15, 2025  
**Scope:** Full Product Requirements vs Current Implementation  
**Validation Type:** Production Readiness Assessment

---

## EXECUTIVE SUMMARY

### Overall Platform Maturity: **60% Complete** (MVP Stage)

The Warmpawz platform has made significant progress in building the foundational 3-layer architecture (Platform Admin, Vendor App, Customer App) with key capabilities in place. However, **critical gaps exist** in subscription management, rider/delivery logistics, dispute resolution, and complete medical records system.

### Production Readiness by Module

| Module | Status | Completion | Critical Gaps |
|--------|--------|------------|---------------|
| **Vendor Onboarding & KYC** | 🟢 Production Grade | 85% | Document retrieval optimization, appeals process |
| **Admin Vendor Management** | 🟢 Production Grade | 90% | Bulk operations, advanced analytics |
| **Customer Discovery/Home** | 🟡 Functional Mockup | 70% | Location-aware search needs optimization |
| **Booking Flows (Services)** | 🟡 Functional Mockup | 75% | Recurring bookings, cancellation policies incomplete |
| **E-commerce** | 🟡 Partial Implementation | 40% | Multi-SKU, cart, inventory management missing |
| **Subscriptions** | 🔴 Partially Built | 30% | Lifecycle management (pause, upgrade, cancel) missing |
| **Payment & Wallet** | 🔴 Not Implemented | 15% | Payment gateway, payouts, refunds not integrated |
| **Rider Dispatch & Tracking** | 🟡 Mockup Only | 45% | Real dispatch, ETA recalculation, rider acceptance missing |
| **Vet Teleconsultation** | 🟡 Functional Mockup | 65% | Medical records incomplete, prescription flow partial |
| **Medical Records** | 🟡 Basic Implementation | 50% | Comprehensive history, attachments, prescription tracking missing |
| **Reviews & Ratings** | 🔴 Stub Only | 20% | Full review system not implemented |
| **Disputes & Refunds** | 🔴 Not Implemented | 10% | Complete dispute workflow missing |
| **Notifications** | 🔴 Stub Only | 15% | SMS/Email integration, in-app notifications missing |

---

## 1. DETAILED FEATURE VALIDATION

### 1.1 HOME / DISCOVERY (SEARCH, CATEGORIES, LOCATION)

#### ✅ **IMPLEMENTED**
- Basic search interface with category cards
- Service discovery with vendor listings
- Initial location input for service radius
- Category-based filtering (Grooming, Vet, Walking, etc.)
- Vendor profile preview cards

#### ❌ **MISSING (High Priority)**
- **Geolocation-based search** (Priority: HIGH)
  - Required Screens: Location permission modal, GPS auto-detect
  - Acceptance Criteria:
    - [ ] Auto-detect user location on app open
    - [ ] Show vendors within configurable radius (2km, 5km, 10km)
    - [ ] Sort by distance from user
    - [ ] Update results when location changes
  - API Required: `GET /search/nearby-vendors?lat={lat}&lng={lng}&radius={km}&category={cat}`
  
- **Advanced filtering** (Priority: MEDIUM)
  - Required Screens: Filter drawer with multi-select options
  - Missing Filters:
    - Price range slider
    - Rating threshold (4+, 4.5+ stars)
    - Availability (today, this week, instant booking)
    - Certifications (Board certified, licensed, verified)
  - API Required: `GET /search/filters` (returns dynamic filter options)

- **Search suggestions & autocomplete** (Priority: MEDIUM)
  - Required: Debounced search with suggestion dropdown
  - Data: Recent searches, popular services, trending vendors

- **Empty states & error handling** (Priority: HIGH)
  - Missing Screens:
    - No vendors found in area
    - Service unavailable in location
    - Search results timeout/error

**UX Copy Examples:**
- No results: "No {service} providers found within 5km. Try expanding your search radius or explore other services."
- Location denied: "Enable location access to find trusted pet care providers near you."

---

### 1.2 VENDOR PROFILES (SERVICES, CERTIFICATIONS, REVIEWS)

#### ✅ **IMPLEMENTED**
- Vendor detail pages with basic information
- Service listings with pricing
- Certification badges display
- Portfolio/photo gallery (basic)
- Contact information display

#### ❌ **MISSING (Medium Priority)**
- **Complete review system** (Priority: HIGH)
  - Required Screens:
    - Full reviews list with pagination
    - Review filtering (5-star, with photos, verified bookings)
    - Review response from vendor
    - Helpful/Not Helpful voting
  - API Required:
    - `GET /vendors/{id}/reviews?page={n}&filter={rating|photos|verified}`
    - `POST /vendors/{id}/reviews/{reviewId}/helpful`
    - `POST /vendors/{id}/reviews/{reviewId}/response` (vendor only)
  - Acceptance Criteria:
    - [ ] Display verified booking badge on reviews
    - [ ] Show vendor response time average
    - [ ] Implement review authenticity checks
    - [ ] Handle review appeals/disputes

- **Service availability calendar** (Priority: HIGH)
  - Missing: Real-time slot availability view
  - Required: Calendar widget showing available/booked slots
  - API: `GET /vendors/{id}/availability?service={serviceId}&date={date}`

- **Vendor performance metrics** (Priority: MEDIUM)
  - Missing KPIs:
    - Average response time
    - Booking acceptance rate
    - Cancellation rate
    - On-time service percentage
  - Display: Transparent trust indicators

**UX Copy Examples:**
- No reviews: "Be the first to review {Vendor Name} and help the Warmpawz community!"
- Verified booking: "Verified Booking - This review is from a customer who completed a booking."

---

### 1.3 BOOKING FLOWS (ONE-TIME, RECURRING, INSTANT ON-DEMAND)

#### ✅ **IMPLEMENTED**
- Basic one-time booking creation
- Date and time slot selection
- Pet selection for booking
- Service add-ons (grooming)
- Walker booking with session types (30min, 60min, 90min)
- Booking confirmation screens
- Active session tracking (walker service)

#### ❌ **MISSING (Critical Priority)**
- **Recurring/Subscription bookings** (Priority: CRITICAL)
  - Status: Subscription config exists in admin but not customer-facing
  - Required Screens:
    - Subscription plan selection (Weekly 1x walk, Weekly 2x walk, Monthly)
    - Schedule configuration (which days, preferred times)
    - Subscription management dashboard
    - Pause subscription modal
    - Upgrade/downgrade subscription modal
    - Cancel subscription with feedback
  - API Required:
    - `POST /subscriptions/create` (input: planId, schedule, startDate)
    - `GET /subscriptions/customer/{customerId}`
    - `PUT /subscriptions/{id}/pause` (input: pauseUntilDate, reason)
    - `PUT /subscriptions/{id}/upgrade` (input: newPlanId, prorationConfig)
    - `DELETE /subscriptions/{id}/cancel` (input: reason, effectiveDate)
  - **Business Logic Missing:**
    - Proration calculation for mid-cycle changes
    - Billing cycle management
    - Auto-renewal handling
    - Failed payment retry logic
  - Acceptance Criteria:
    - [ ] Show next billing date clearly
    - [ ] Display upcoming scheduled bookings from subscription
    - [ ] Allow skip individual session without canceling subscription
    - [ ] Handle vendor unavailability for subscribed slots

- **Instant on-demand booking** (Priority: HIGH)
  - Missing: True instant booking without vendor confirmation
  - Current: All bookings require vendor acceptance
  - Required:
    - Vendor opt-in to instant booking
    - Auto-accept criteria configuration
    - Instant confirmation for customers
    - Vendor notification of auto-accepted booking
  - API: `POST /bookings/instant-book` (validates availability automatically)

- **Cancellation & rescheduling** (Priority: HIGH)
  - Partially implemented but incomplete
  - Missing:
    - Cancellation policies by vendor (24hr, 48hr, flexible)
    - Automated refund calculation based on policy
    - Rescheduling with fee waiver conditions
    - Admin override for disputes
  - API Required:
    - `GET /bookings/{id}/cancellation-policy`
    - `POST /bookings/{id}/reschedule` (input: newDate, newTime, reason)
    - `GET /bookings/{id}/reschedule-options` (shows available alternatives)
  - Acceptance Criteria:
    - [ ] Display cancellation policy before booking
    - [ ] Show refund amount on cancellation screen
    - [ ] Offer rescheduling before cancellation
    - [ ] Track cancellation reasons for analytics

- **Vendor acceptance flow** (Priority: HIGH)
  - Status: Basic implementation exists
  - Missing Edge Cases:
    - Vendor decline with reason
    - Auto-decline after timeout (e.g., 30 minutes)
    - Customer notification of decline
    - Automatic rebooking suggestions
  - Required Screens:
    - Vendor decline modal with reason selection
    - Customer "Booking declined" notification with alternatives
  - API: `POST /bookings/{id}/decline` (input: reason, suggestedAlternatives)

**UX Copy Examples:**
- Cancellation policy: "Free cancellation up to 24 hours before service. After that, a 50% cancellation fee applies."
- Subscription pause: "Pause your plan and we'll save your spot. Resume anytime without losing your walker."
- Booking declined: "Dr. Kumar is fully booked. Here are 3 other vets available for your time slot."

---

### 1.4 E-COMMERCE (PRODUCT LISTINGS, MULTI-SKU, CART, QUICK ORDER)

#### ✅ **IMPLEMENTED**
- Basic product service configuration in admin
- Service/product catalog structure
- Pricing configuration
- Service categories mapping

#### ❌ **MISSING (Critical Priority)**
- **Product catalog & listings** (Priority: CRITICAL)
  - Status: Backend structure exists but no customer-facing UI
  - Required Screens:
    - Product browsing interface (grid/list view)
    - Product detail page with images, descriptions, specs
    - Size/variant selector (S/M/L, flavors, etc.)
    - Stock availability indicator
    - Related products carousel
  - API Required:
    - `GET /products?category={cat}&page={n}&sort={price|rating|popular}`
    - `GET /products/{id}` (full product details with variants)
    - `GET /products/{id}/related`
  - Acceptance Criteria:
    - [ ] Display product images (min 3 per product)
    - [ ] Show stock status (In stock, Low stock, Out of stock)
    - [ ] Handle variants properly (different prices, SKUs)
    - [ ] Implement quick view modal

- **Shopping cart** (Priority: CRITICAL)
  - Status: NOT IMPLEMENTED
  - Required Screens:
    - Cart drawer/page with item list
    - Quantity adjustment controls
    - Remove item confirmation
    - Cart summary (subtotal, tax, delivery, total)
    - Empty cart state
    - Saved for later functionality
  - API Required:
    - `POST /cart/add` (input: productId, variantId, quantity)
    - `GET /cart/{customerId}`
    - `PUT /cart/item/{itemId}` (update quantity)
    - `DELETE /cart/item/{itemId}`
    - `POST /cart/apply-coupon` (input: couponCode)
  - Persistence: Store in KV with expiry (7 days)
  - Acceptance Criteria:
    - [ ] Persist cart across sessions
    - [ ] Validate stock availability on checkout
    - [ ] Show price changes since item added
    - [ ] Handle vendor minimum order requirements

- **Multi-vendor cart handling** (Priority: HIGH)
  - Status: Architecture not designed for multi-vendor
  - Required Logic:
    - Split cart by vendor
    - Calculate separate delivery fees per vendor
    - Handle different delivery time windows
    - Partial order placement if one vendor unavailable
  - Required Screens:
    - Cart grouped by vendor
    - Multiple checkout flows or unified checkout with vendor breakdown
    - Partial order confirmation modal
  - Business Rule: Can customer check out with multiple vendors in one transaction?
  - Acceptance Criteria:
    - [ ] Display which items belong to which vendor
    - [ ] Calculate delivery fees per vendor
    - [ ] Allow proceeding if only some vendors available
    - [ ] Provide clear order tracking per vendor

- **Inventory management** (Priority: HIGH)
  - Status: Basic inventory field exists, no stock tracking
  - Missing:
    - Real-time stock updates
    - Low stock alerts
    - Backorder handling
    - Reserved stock (in cart but not purchased)
  - API Required:
    - `GET /products/{id}/stock` (real-time check)
    - `POST /inventory/reserve` (when item added to cart)
    - `POST /inventory/release` (when cart expires or checkout completes)
  - Vendor Dashboard: Stock management interface

- **Quick order/reorder** (Priority: MEDIUM)
  - Status: NOT IMPLEMENTED
  - Required:
    - Order history with "Reorder" button
    - Frequently ordered items widget
    - One-click reorder with saved address/payment
  - API: `POST /orders/reorder/{orderId}` (validates stock and creates new order)

**UX Copy Examples:**
- Low stock: "Only 3 left! Order soon to secure this item."
- Multi-vendor: "Your cart contains items from 2 vendors. You'll receive 2 separate deliveries."
- Out of stock: "This item is currently unavailable. We'll notify you when it's back in stock."

---

### 1.5 SUBSCRIPTIONS (PLANS FOR FOOD, MEDS, GROOMING)

#### ✅ **IMPLEMENTED**
- Subscription configuration in admin panel
  - Weekly, Monthly, One-time plans
  - Subscription-specific pricing
  - Service subscription configuration
- Subscription preview component

#### ❌ **MISSING (Critical Priority)**
- **Customer subscription purchase flow** (Priority: CRITICAL)
  - Status: Backend config exists, NO customer-facing flow
  - Required Screens:
    - Subscription plan selection page
    - Delivery schedule configurator (which days, frequency)
    - Subscription checkout (different from one-time)
    - Subscription confirmation with first delivery date
  - API Required:
    - `GET /subscriptions/plans?category={food|meds|grooming}`
    - `POST /subscriptions/create`
    - `GET /subscriptions/calculate-price` (preview before purchase)
  - Acceptance Criteria:
    - [ ] Display savings vs one-time purchase
    - [ ] Show clear delivery schedule
    - [ ] Explain auto-renewal clearly
    - [ ] Provide subscription terms & conditions

- **Subscription management dashboard** (Priority: CRITICAL)
  - Status: NOT IMPLEMENTED
  - Required Screens:
    - My subscriptions list (active, paused, canceled)
    - Subscription detail page showing:
      - Next delivery date
      - Upcoming deliveries (next 3)
      - Payment method on file
      - Billing history
      - Delivery address
    - Pause subscription modal (with date range picker)
    - Cancel subscription flow (with retention offers)
    - Modify subscription (change plan, frequency, products)
  - API Required:
    - `GET /subscriptions/customer/{customerId}`
    - `GET /subscriptions/{id}/deliveries` (past and upcoming)
    - `PUT /subscriptions/{id}/pause`
    - `PUT /subscriptions/{id}/resume`
    - `PUT /subscriptions/{id}/modify` (change plan or schedule)
    - `DELETE /subscriptions/{id}/cancel`
  - Acceptance Criteria:
    - [ ] Allow pausing up to 3 months
    - [ ] Show when next billing occurs
    - [ ] Provide cancel vs pause guidance
    - [ ] Offer retention incentives (e.g., skip one delivery free)

- **Subscription billing & proration** (Priority: HIGH)
  - Status: Business logic NOT IMPLEMENTED
  - Required Logic:
    - Pro-rata calculation for mid-cycle changes
    - Handle failed payment (retry 3x, then pause/cancel)
    - Invoice generation per billing cycle
    - Refund calculation on cancellation
  - API Required:
    - `POST /subscriptions/{id}/calculate-proration` (for upgrades/downgrades)
    - `POST /subscriptions/{id}/process-payment` (called by scheduler)
    - `GET /subscriptions/{id}/invoices`
  - Acceptance Criteria:
    - [ ] Generate invoice on each billing cycle
    - [ ] Send email with invoice PDF
    - [ ] Retry failed payments 3x over 7 days
    - [ ] Notify customer before auto-cancel

- **Skip/postpone delivery** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required:
    - Skip individual delivery without affecting subscription
    - Postpone delivery by X days
    - Modify upcoming delivery items
  - API: `PUT /subscriptions/{id}/deliveries/{deliveryId}/skip`
  - UX Copy: "Skip this delivery? Your next delivery will be on [Date]."

**UX Copy Examples:**
- Subscription value: "Subscribe and save 15% on every order. Pause, skip, or cancel anytime."
- Pause subscription: "Going on vacation? Pause deliveries and resume when you're back."
- Cancel retention: "Before you go... Skip your next 2 deliveries for free instead?"

---

### 1.6 REAL-TIME ORDER TRACKING & RIDER/FULFILLMENT STATUS

#### ✅ **IMPLEMENTED**
- Basic GPS tracking UI for walker sessions
- Live location updates (simulated)
- Walker active session screen with map
- Photo updates during walk
- Session timer and distance tracking
- Google Maps integration

#### ❌ **MISSING (Critical Priority)**
- **Rider dispatch system** (Priority: CRITICAL)
  - Status: Tracking UI exists but NO actual dispatch backend
  - Required Components:
    - Rider mobile app (not in scope but referenced)
    - Order assignment algorithm
    - Rider acceptance/decline flow
    - Reassignment on decline
    - ETA calculation and recalculation
  - API Required:
    - `POST /orders/{id}/assign-rider` (auto or manual assignment)
    - `GET /riders/available?location={lat,lng}&radius={km}` (finds nearby riders)
    - `POST /riders/{id}/accept-order/{orderId}`
    - `POST /riders/{id}/decline-order/{orderId}` (input: reason)
    - `PUT /orders/{id}/eta` (update as rider moves)
  - Acceptance Criteria:
    - [ ] Auto-assign to nearest available rider
    - [ ] If declined, assign to next closest within 2 minutes
    - [ ] Track rider location every 30 seconds
    - [ ] Recalculate ETA on route deviation
    - [ ] Handle multiple declines (escalate to admin)

- **Order lifecycle tracking** (Priority: HIGH)
  - Status: Basic statuses exist, missing states
  - Current States: pending, confirmed, started, completed, canceled
  - Missing States:
    - `dispatched` - Rider assigned and en route to pickup
    - `picked_up` - Order picked up from vendor
    - `out_for_delivery` - Rider heading to customer
    - `delivered` - Completed delivery
    - `failed_delivery` - Customer unavailable
  - Required Screens:
    - Status timeline visualization (stepper)
    - Estimated delivery time with countdown
    - Real-time status updates (push notifications)
    - Delivery issue reporting
  - API: `GET /orders/{id}/tracking` (returns full status history)
  - Acceptance Criteria:
    - [ ] Update customer on each status change
    - [ ] Show current rider location if dispatched
    - [ ] Display ETA with confidence level
    - [ ] Allow customer to contact rider

- **Rider-customer communication** (Priority: MEDIUM)
  - Status: NOT IMPLEMENTED
  - Required:
    - In-app chat or calling (masked numbers)
    - Push notifications for messages
    - Chat history in order details
  - Privacy: Mask phone numbers (Twilio proxy)
  - API: `POST /orders/{id}/messages` (chat endpoint)

- **Delivery verification** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required:
    - OTP verification at delivery
    - Photo proof of delivery
    - Signature capture
    - Contact-free delivery option
  - API:
    - `POST /orders/{id}/verify-otp` (input: otp)
    - `POST /orders/{id}/proof-of-delivery` (input: photo, signature)
  - Acceptance Criteria:
    - [ ] Generate unique OTP per delivery
    - [ ] Require OTP or photo proof
    - [ ] Store proof for dispute resolution
    - [ ] Support contactless delivery

- **Failed delivery handling** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required Screens:
    - Rider: Cannot deliver modal (reasons: customer unavailable, wrong address, refused)
    - Customer: Delivery failed notification with rescheduling options
    - Admin: Failed delivery dashboard for intervention
  - API: `POST /orders/{id}/delivery-failed` (input: reason, attemptNumber)
  - Business Logic:
    - Retry delivery up to 3 times
    - Auto-refund after 3 failures
    - Charge redelivery fee for customer-caused failures
  - Acceptance Criteria:
    - [ ] Allow customer to reschedule immediately
    - [ ] Charge redelivery fee only if customer fault
    - [ ] Notify customer within 5 minutes of failure
    - [ ] Escalate to support after 2 failures

**UX Copy Examples:**
- Dispatching: "Finding the nearest rider for your delivery..."
- En route: "Rahul is 12 minutes away with your order. Track in real-time."
- Arriving: "Your rider is arriving in 2 minutes. Please be ready."
- Failed delivery: "We couldn't complete your delivery. Reschedule for free or get a full refund."

---

### 1.7 VET TELECONSULTATION & IN-PERSON APPOINTMENT FLOWS

#### ✅ **IMPLEMENTED**
- Teleconsultation flow screens:
  - Incoming call screen
  - Connecting screen
  - Active video call screen with controls
  - Call ended screen
  - Consultation notes interface
- Video call UI mockup (mute, video toggle, end call)
- Basic pet medical record display
- Prescription display (basic)

#### ❌ **MISSING (High Priority)**
- **Actual video calling integration** (Priority: CRITICAL)
  - Status: UI mockup only, NO real video backend
  - Required Integration: Twilio Video, Agora, or similar
  - API Required:
    - `POST /teleconsult/create-room` (returns room token)
    - `POST /teleconsult/join` (returns access token for participant)
    - `POST /teleconsult/end` (closes room, generates recording)
  - Acceptance Criteria:
    - [ ] Generate unique room per consultation
    - [ ] Support audio/video toggle
    - [ ] Record consultation (with consent)
    - [ ] Handle network disconnections gracefully
    - [ ] Provide fallback to audio-only

- **Comprehensive medical records system** (Priority: HIGH)
  - Status: Basic pet profile exists, incomplete medical records
  - Missing Components:
    - **Vaccination history**
      - Vaccine name, date administered, next due date
      - Vet clinic administered at
      - Batch number (for recalls)
      - Upload vaccination certificate
    - **Prescription history**
      - Medication name, dosage, frequency
      - Prescribing vet
      - Start/end date
      - Refill instructions
      - Attach prescription document
    - **Medical conditions**
      - Diagnosis, severity, status (active/resolved)
      - Diagnosed by, date
      - Treatment plan
      - Progress notes
    - **Allergies & sensitivities**
      - Allergen, reaction type, severity
      - Diagnosed date
    - **Surgical history**
      - Procedure name, date, outcome
      - Hospital/vet, surgeon name
      - Post-op notes, complications
    - **Lab reports & diagnostics**
      - Report type, date, facility
      - Upload PDF reports
      - Key findings/results
  - Required Screens:
    - Comprehensive medical record viewer (tabbed interface)
    - Add/edit medical record modal for each type
    - Document upload for records
    - Share medical records with vet (permission-based)
  - API Required:
    - `GET /pets/{id}/medical-records?type={vaccinations|prescriptions|conditions}`
    - `POST /pets/{id}/medical-records` (input: type, data, documents)
    - `PUT /pets/{id}/medical-records/{recordId}`
    - `DELETE /pets/{id}/medical-records/{recordId}`
    - `POST /pets/{id}/medical-records/share` (temporary access token for vet)
  - Acceptance Criteria:
    - [ ] Attach multiple documents per record
    - [ ] Show timeline view of all medical events
    - [ ] Reminder notifications for vaccinations due
    - [ ] Export medical records as PDF
    - [ ] Secure sharing with time-limited access

- **Prescription & pharmacy integration** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required Flow:
    1. Vet issues digital prescription after consult
    2. Customer receives prescription in app
    3. Option to order meds from partner pharmacy
    4. Add to cart and checkout
    5. Track medicine delivery
  - Required Screens:
    - Digital prescription viewer (with vet signature)
    - "Order medicines" CTA on prescription
    - Pharmacy product matching (med name → products)
    - Prescription history in medical records
  - API Required:
    - `POST /prescriptions/create` (vet endpoint)
    - `GET /prescriptions/{id}` (returns PDF)
    - `POST /prescriptions/{id}/order` (creates pharmacy order)
  - Compliance: Store digital signature, prescription validity tracking
  - Acceptance Criteria:
    - [ ] Digitally signed prescriptions
    - [ ] Prescription validity period (e.g., 30 days)
    - [ ] Track prescription usage (refills remaining)
    - [ ] Prevent expired prescription orders

- **In-person vet appointment booking** (Priority: MEDIUM)
  - Status: General booking flow exists but no vet-specific flow
  - Missing:
    - Reason for visit selection (checkup, sick, emergency)
    - Medical history pre-sharing with vet
    - Appointment reminders (24hr, 1hr before)
    - Vet clinic check-in process
    - Post-visit follow-up
  - API: Standard booking API with vetSpecific metadata
  - Acceptance Criteria:
    - [ ] Share selected medical records with vet
    - [ ] Display vet's available slots
    - [ ] Send appointment confirmation with clinic details
    - [ ] Provide directions to clinic

**UX Copy Examples:**
- Teleconsult start: "Dr. Kumar is ready. Join the video consultation now."
- Medical records share: "Share Max's medical history with this vet? Access expires in 24 hours."
- Prescription issued: "Dr. Kumar has prescribed medication. Order now for same-day delivery."
- Vaccination due: "Max's rabies vaccination is due in 7 days. Book an appointment?"

---

### 1.8 CARETAKER / SITTER / WALKER BOOKING

#### ✅ **IMPLEMENTED**
- Walker service fully implemented:
  - Walker discovery and selection
  - Walker profile with ratings, experience, specialties
  - Session duration selection (30min, 60min, 90min)
  - Booking confirmation
  - Active session tracking with GPS
  - Photo/video updates during walk
  - Session summary with route map
  - Payment integration mockup
- Caretaker/Sitter: Basic structure exists

#### ❌ **MISSING (Medium Priority)**
- **Caretaker/Sitter complete booking flow** (Priority: MEDIUM)
  - Status: Partially implemented, needs dedicated flow
  - Missing Screens:
    - Sitter selection filters (overnight, daycare, at their place/my place)
    - Care duration picker (hourly, overnight, multi-day)
    - Pet care instructions form (feeding, medication, behavior notes)
    - Emergency contact setup
    - Home access instructions (for at-home sitting)
    - Sitter checklist acknowledgment
  - Required API:
    - `GET /sitters/search?serviceType={overnight|daycare}&dates={start,end}`
    - `POST /bookings/sitting` (input: sitter, pet, dates, instructions)
  - Acceptance Criteria:
    - [ ] Display sitter's home if pet goes there (photos, safety features)
    - [ ] Collect detailed pet care instructions
    - [ ] Provide emergency contact to sitter
    - [ ] Support multi-day bookings
    - [ ] Send daily photo/video updates

- **Real-time check-ins during care** (Priority: MEDIUM)
  - Status: Exists for walking, needs adaptation for sitting
  - Required:
    - Hourly check-in reminders for sitter
    - Photo/video updates minimum 2x per day
    - Activity log (fed, walked, played, medication given)
    - Emergency alert button
  - API: `POST /bookings/{id}/checkins` (input: type, photo, notes, timestamp)
  - Acceptance Criteria:
    - [ ] Minimum check-in frequency enforcement
    - [ ] Push notification to customer on each check-in
    - [ ] Display check-in timeline in booking details
    - [ ] Alert admin if check-in missed

**UX Copy Examples:**
- Sitter booking: "Book Sarah for overnight care. Your dog stays at her pet-friendly home with 24/7 supervision."
- Care instructions: "Help your sitter provide the best care. Share Max's routine, favorite toys, and any quirks."
- Check-in: "Sarah checked in: Fed Max at 8 AM, played fetch for 20 mins. All good! 🐾"

---

### 1.9 GROOMING BOOKING WITH ADD-ONS AND LOCATION/PICKUP

#### ✅ **IMPLEMENTED**
- Grooming service booking basics
- Add-ons selection (nail trim, ear cleaning, etc.)
- Service type: at-home vs at-center
- Basic pricing with add-ons

#### ❌ **MISSING (Medium Priority)**
- **Pickup & drop-off logistics** (Priority: HIGH)
  - Status: Service type selection exists but no logistics
  - Missing:
    - Pickup time slot selection
    - Pickup address confirmation
    - Drop-off time estimation
    - Pickup/drop-off person details (name, contact)
    - Pet handover verification (photo, condition notes)
  - API Required:
    - `GET /grooming/pickup-slots?location={lat,lng}&date={date}` (available slots)
    - `POST /bookings/{id}/pickup-confirm` (rider confirms pickup)
    - `POST /bookings/{id}/dropoff-confirm` (rider confirms drop-off)
  - Acceptance Criteria:
    - [ ] Display pickup ETA
    - [ ] Send notification when rider arriving for pickup
    - [ ] Photo verification of pet condition at pickup and drop-off
    - [ ] Support notes (e.g., "Pet is shy, be gentle")

- **Before/After photos** (Priority: MEDIUM)
  - Status: NOT IMPLEMENTED
  - Required:
    - Groomer takes "before" photos on arrival
    - "After" photos on completion
    - Customer receives photo comparison
    - Photos stored in pet profile
  - API: `POST /bookings/{id}/grooming-photos` (input: type=before|after, photos)
  - UX: Display before/after slider in booking details

- **Grooming package customization** (Priority: MEDIUM)
  - Missing:
    - Custom grooming packages (e.g., "Spa Day", "Quick Trim")
    - Package discounts vs à la carte
    - Breed-specific grooming recommendations
  - Required: Package management in admin panel
  - API: `GET /grooming/packages?breed={breedId}`

**UX Copy Examples:**
- Pickup: "Ravi will pick up Max at 10:30 AM. Track his arrival in real-time."
- Before/After: "See Max's transformation! Swipe to compare before and after photos."
- Package: "Spa Day Package: Full grooming, nail trim, ear cleaning - Save 20% vs individual services."

---

### 1.10 USER PET PROFILES & MEDICAL RECORDS

#### ✅ **IMPLEMENTED**
- Create pet profile
- Basic pet information (name, breed, age, weight, photo)
- Multiple pets support
- Pet selection for bookings
- Pet quick view cards
- Basic medical info display

#### ❌ **MISSING (High Priority)**
- See **Section 1.7 Medical Records** for comprehensive gaps

- **Pet onboarding wizard** (Priority: MEDIUM)
  - Status: Basic creation exists, needs guided flow
  - Missing:
    - Multi-step wizard for new pet
    - Breed auto-suggestions with breed info
    - Health questions (spayed/neutered, allergies, existing conditions)
    - Upload vaccination records during onboarding
    - Link to existing vet
  - Acceptance Criteria:
    - [ ] Suggest common health issues by breed
    - [ ] Validate required fields (vaccination status)
    - [ ] Encourage medical record upload

- **Pet microchip & insurance tracking** (Priority: LOW)
  - Status: NOT IMPLEMENTED
  - Missing Fields:
    - Microchip number
    - Insurance provider, policy number
    - Insurance expiry date
  - Use Case: Emergency situations, lost pet reports

**UX Copy Examples:**
- Pet onboarding: "Tell us about Max so we can provide personalized care recommendations."
- Vaccination prompt: "Upload Max's vaccination records to unlock all services."

---

### 1.11 PAYMENTS (WALLET, CARDS, UPI, BNPL) & VENDOR PAYOUTS

#### ✅ **IMPLEMENTED**
- Payment method selection UI (mockup)
- Wallet, UPI, Card options displayed
- Payment confirmation screens
- Basic payment status display

#### ❌ **MISSING (Critical Priority)**
- **Payment gateway integration** (Priority: CRITICAL)
  - Status: UI exists, NO actual payment processing
  - Required Integration: Razorpay, Stripe, or Paytm
  - API Required:
    - `POST /payments/create-order` (returns payment gateway order ID)
    - `POST /payments/verify` (verifies payment signature)
    - `POST /payments/capture` (captures authorized payment)
    - `GET /payments/{id}/status`
  - Acceptance Criteria:
    - [ ] Support UPI, cards, wallets, net banking
    - [ ] Handle payment success, failure, pending states
    - [ ] Retry failed payments
    - [ ] Store payment method securely (tokenization)
    - [ ] Generate invoice/receipt

- **Wallet system** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required:
    - Add money to wallet
    - Wallet balance display
    - Wallet transaction history
    - Auto-deduct from wallet on purchase
    - Refunds to wallet
    - Wallet cashback/rewards
  - API Required:
    - `POST /wallet/add-money` (input: amount, paymentMethodId)
    - `GET /wallet/{customerId}/balance`
    - `GET /wallet/{customerId}/transactions`
    - `POST /wallet/deduct` (internal, on purchase)
  - Acceptance Criteria:
    - [ ] Real-time balance updates
    - [ ] Transaction history with filters
    - [ ] Low balance alerts
    - [ ] Refund to wallet option

- **Saved payment methods** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required:
    - Save cards securely (PCI-DSS compliance via tokenization)
    - Save UPI IDs
    - Default payment method selection
    - Edit/delete saved methods
  - API: Payment gateway provides tokenization
  - Security: NEVER store raw card details, use gateway tokens
  - Acceptance Criteria:
    - [ ] PCI-DSS compliant storage
    - [ ] CVV required even for saved cards
    - [ ] Display last 4 digits only
    - [ ] 2FA for deleting payment method

- **BNPL (Buy Now Pay Later)** (Priority: MEDIUM)
  - Status: NOT IMPLEMENTED
  - Integration: Simpl, LazyPay, ZestMoney
  - Required:
    - BNPL eligibility check
    - Payment plan display (EMI options)
    - BNPL provider onboarding in checkout
    - Repayment tracking
  - API: Third-party provider integration
  - Acceptance Criteria:
    - [ ] Show EMI options on eligible orders (>₹500)
    - [ ] Display total interest clearly
    - [ ] Redirect to provider for KYC if first-time
    - [ ] Track repayment status

- **Commission calculation & vendor payouts** (Priority: CRITICAL)
  - Status: NOT IMPLEMENTED
  - Required Business Logic:
    - Platform commission % by service category (configurable in admin)
    - Calculate vendor earnings per booking
    - Aggregate earnings by payout cycle (weekly, biweekly, monthly)
    - Generate payout reports
    - Initiate bank transfers
  - API Required:
    - `GET /vendors/{id}/earnings?period={week|month}` (earnings summary)
    - `GET /vendors/{id}/earnings/breakdown` (booking-wise breakdown)
    - `POST /admin/payouts/initiate` (input: vendorId, amount, period)
    - `GET /admin/payouts/pending` (list of pending payouts)
    - `PUT /admin/payouts/{id}/mark-paid` (after bank transfer)
  - Admin Panel Required:
    - Payout schedule management
    - Commission rate configuration by service type
    - Payout history
    - Vendor earnings dashboard
    - Failed payout handling
  - Acceptance Criteria:
    - [ ] Auto-calculate commission on booking completion
    - [ ] Hold earnings for 3 days post-service (dispute window)
    - [ ] Generate vendor payout reports
    - [ ] Send payout confirmation email
    - [ ] Track TDS (if applicable)

- **Refunds & partial refunds** (Priority: HIGH)
  - Status: Basic refund policy config exists, NO processing
  - Required:
    - Refund calculation based on cancellation policy
    - Refund to original payment method or wallet
    - Partial refund support (for partial service completion)
    - Refund tracking and status
  - API Required:
    - `POST /payments/{id}/refund` (input: amount, reason, refundMethod)
    - `GET /payments/{id}/refund-status`
  - Business Logic:
    - If paid via card: Refund to card (3-5 days)
    - If paid via UPI: Refund to UPI or wallet (instant to wallet)
    - Deduct commission before refunding vendor
  - Acceptance Criteria:
    - [ ] Display expected refund time
    - [ ] Send refund confirmation notification
    - [ ] Track refund status until completion
    - [ ] Handle refund failures gracefully

**UX Copy Examples:**
- Payment: "Your payment is secure. We use industry-standard encryption."
- Wallet: "Add money to your Warmpawz Wallet and get 5% cashback on every transaction."
- Refund: "Refund of ₹500 initiated to your original payment method. Expect it within 3-5 business days."
- Payout (vendor): "Your earnings of ₹12,450 for this week will be transferred by Friday."

---

### 1.12 RATINGS, REVIEWS, DISPUTE RESOLUTION

#### ✅ **IMPLEMENTED**
- Basic rating display on vendor profiles
- Star rating visualization

#### ❌ **MISSING (High Priority)**
- **Complete review system** (Priority: HIGH)
  - Status: Display exists, submission NOT IMPLEMENTED
  - Required Screens:
    - Post-service review prompt (modal or dedicated page)
    - Multi-aspect rating (service quality, communication, punctuality, value)
    - Photo/video upload with review
    - Review editing (within 48 hours)
    - Vendor response interface
    - Review moderation (admin)
  - API Required:
    - `POST /reviews/create` (input: bookingId, rating, comment, photos)
    - `PUT /reviews/{id}` (edit review)
    - `POST /reviews/{id}/respond` (vendor response)
    - `GET /reviews/{id}/report` (flag inappropriate review)
    - `POST /admin/reviews/{id}/moderate` (approve/reject)
  - Acceptance Criteria:
    - [ ] Only allow review after service completion
    - [ ] One review per booking
    - [ ] Vendor can respond once
    - [ ] Display verified booking badge
    - [ ] Moderate reviews for profanity, spam
    - [ ] Calculate average rating in real-time

- **Review authenticity & incentives** (Priority: MEDIUM)
  - Status: NOT IMPLEMENTED
  - Features:
    - Only verified bookings can review
    - Review with photo gets higher visibility
    - Reward points for detailed reviews
    - "Helpful" voting on reviews
    - Highlight reviews from top reviewers
  - API: `POST /reviews/{id}/helpful` (upvote)
  - Gamification: Badge system for active reviewers

- **Dispute resolution workflow** (Priority: CRITICAL)
  - Status: NOT IMPLEMENTED
  - Required Screens (Customer):
    - Report issue button on booking
    - Issue type selection (service not provided, poor quality, damage, other)
    - Evidence upload (photos, videos, documents)
    - Describe issue (text)
    - Dispute status tracking
    - Resolution notification
  - Required Screens (Vendor):
    - Dispute notification
    - Respond to dispute with evidence
    - Accept proposed resolution or counter-offer
  - Required Screens (Admin):
    - Disputes dashboard (pending, under review, resolved)
    - Dispute detail view with customer and vendor evidence
    - Resolution tools (refund, partial refund, warning, suspend vendor)
    - Communication thread between admin-customer-vendor
    - Escalation to senior support
  - API Required:
    - `POST /disputes/create` (input: bookingId, type, description, evidence)
    - `GET /disputes/{id}` (full dispute details)
    - `POST /disputes/{id}/respond` (vendor response)
    - `POST /disputes/{id}/messages` (chat between parties)
    - `POST /admin/disputes/{id}/resolve` (input: resolution, refundAmount, action)
  - Business Logic:
    - Auto-close disputes if no vendor response in 48 hours (customer wins)
    - Escalate to admin if vendor counter-disputes
    - Track dispute history per vendor (suspend if >5%)
    - Blacklist customers with >3 fraudulent disputes
  - Acceptance Criteria:
    - [ ] Customer can open dispute within 7 days of service
    - [ ] Hold vendor payout until dispute resolved
    - [ ] Admin can override and make final decision
    - [ ] Send resolution email with explanation
    - [ ] Track dispute resolution time (target: <48 hours)

- **Vendor suspension & appeals** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required:
    - Auto-suspend vendor if rating drops below threshold (e.g., <3.5 stars)
    - Auto-suspend after multiple disputes
    - Admin manual suspension
    - Vendor notification of suspension with reason
    - Appeal process for vendor
    - Reinstatement after remediation
  - API Required:
    - `POST /admin/vendors/{id}/suspend` (input: reason, duration)
    - `POST /vendors/{id}/appeal` (input: appeal text, evidence)
    - `POST /admin/vendors/{id}/reinstate`
  - Acceptance Criteria:
    - [ ] Clear suspension criteria
    - [ ] Notify vendor immediately
    - [ ] Provide 7-day appeal window
    - [ ] Admin review appeals within 3 days
    - [ ] Track suspension history

**UX Copy Examples:**
- Review prompt: "How was your grooming session with Salon Paws? Your feedback helps our community."
- Dispute opened: "Your dispute has been submitted. We'll review it within 24 hours and get back to you."
- Dispute resolved: "Good news! Your dispute has been resolved in your favor. ₹500 has been refunded to your wallet."
- Vendor suspended: "Your account has been temporarily suspended due to customer complaints. Review details and appeal within 7 days."

---

### 1.13 ADMIN DASHBOARD (MARKETPLACE CONTROLS, VENDOR APPROVALS, DISPUTES)

#### ✅ **IMPLEMENTED**
- Admin authentication
- Vendor application review dashboard
  - Pending applications list
  - Application detail view with documents
  - Approve/Reject/Request Clarification actions
- Vendor management:
  - Active vendors list
  - Vendor details modal
  - Vendor settings management
- Role management (dynamic role configuration)
- Service catalog management
- Onboarding configuration
- Payment settings & refund policies (basic)
- Super admin profile

#### ❌ **MISSING (Medium Priority)**
- **Platform analytics dashboard** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required Metrics:
    - GMV (Gross Merchandise Value) by period
    - Total bookings, active customers, active vendors
    - Revenue breakdown (by service category, by vendor)
    - Customer acquisition cost (CAC)
    - Customer lifetime value (LTV)
    - Retention rate (repeat customer %)
    - Average order value (AOV)
    - Service utilization rates
    - Top performing vendors
    - Churn rate
  - Required Visualizations:
    - Line charts (revenue over time)
    - Bar charts (service category comparison)
    - Funnel (customer acquisition)
    - Heatmap (service demand by location and time)
  - API Required:
    - `GET /admin/analytics/overview?period={day|week|month|year}`
    - `GET /admin/analytics/revenue?groupBy={category|vendor|location}`
    - `GET /admin/analytics/customers?metric={acquisition|retention|ltv}`
  - Acceptance Criteria:
    - [ ] Real-time metric updates (refresh every 5 minutes)
    - [ ] Export reports as CSV/PDF
    - [ ] Drill-down capabilities (click on chart to see details)
    - [ ] Date range filtering
    - [ ] Compare periods (this week vs last week)

- **Operations dashboard** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required Views:
    - Live bookings map (see all active bookings on map)
    - SLA monitoring (delivery times, vendor response times)
    - Active disputes requiring attention
    - Failed deliveries requiring intervention
    - Vendor approval queue
    - Customer support tickets
    - System health (API uptime, error rates)
  - API: `GET /admin/operations/live-view`
  - Acceptance Criteria:
    - [ ] Auto-refresh every 30 seconds
    - [ ] Alert badges for items requiring action
    - [ ] Quick actions from dashboard (e.g., reassign rider)
    - [ ] Filter by urgency/priority

- **Vendor performance management** (Priority: MEDIUM)
  - Status: NOT IMPLEMENTED
  - Required:
    - Vendor leaderboard (by revenue, rating, bookings)
    - Vendor performance reports (acceptance rate, cancellation rate, avg rating)
    - Identify underperforming vendors (for training or suspension)
    - Vendor payout reports
    - Commission earnings by vendor
  - API: `GET /admin/vendors/performance?sortBy={revenue|rating|bookings}`
  - Use Case: Incentivize top vendors, address underperformers

- **Customer support tools** (Priority: MEDIUM)
  - Status: NOT IMPLEMENTED
  - Required:
    - Customer search (by phone, email, name, booking ID)
    - Customer profile view (bookings, disputes, reviews, wallet)
    - Impersonate customer (for debugging)
    - Issue refunds on behalf of customer
    - Extend wallet credits
    - View customer support tickets
  - API: `GET /admin/customers/search?query={q}`
  - Acceptance Criteria:
    - [ ] Quick access to customer history
    - [ ] Initiate actions (refund, wallet credit)
    - [ ] Log all admin actions (audit trail)

- **Content management** (Priority: LOW)
  - Status: Basic structure exists, incomplete
  - Missing:
    - Banner management (homepage banners)
    - Promo campaigns (featured services, vendors)
    - Push notification composer
    - Email campaign builder
  - Use Case: Marketing campaigns, announcements

- **Compliance & reporting** (Priority: MEDIUM)
  - Status: NOT IMPLEMENTED
  - Required:
    - KYC document expiry tracking
    - License renewal reminders
    - GST report generation
    - TDS reports for vendor payouts
    - Data export for audits
  - API: `GET /admin/compliance/expiring-documents?within={days}`
  - Acceptance Criteria:
    - [ ] Auto-notify vendors 30 days before document expiry
    - [ ] Flag vendors with expired documents
    - [ ] Generate tax reports for filing

**UX Copy Examples:**
- Analytics: "Your platform generated ₹12.5 lakhs in GMV this month. 15% increase from last month."
- Operations: "3 bookings require immediate attention. 2 disputes pending review."
- Vendor performance: "Top 10% vendors earn 50% of total revenue. Identify patterns to replicate success."

---

### 1.14 LOGISTICS/ROUTING INTEGRATION FOR RIDER DISPATCH

#### ✅ **IMPLEMENTED**
- GPS tracking for walker sessions (simulated)
- Route visualization on map
- Distance calculation

#### ❌ **MISSING (Critical Priority)**
- See **Section 1.6 Rider Dispatch** for comprehensive logistics gaps

- **Route optimization** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required:
    - Optimize route for multiple pickups/deliveries
    - Consider traffic conditions
    - Provide turn-by-turn navigation to rider
  - Integration: Google Maps Directions API, Mapbox
  - API: `GET /routing/optimize?waypoints=[...]&traffic=true`
  - Acceptance Criteria:
    - [ ] Minimize total distance and time
    - [ ] Update route dynamically if new orders assigned
    - [ ] Provide ETA for each waypoint

- **Rider availability management** (Priority: HIGH)
  - Status: NOT IMPLEMENTED
  - Required:
    - Rider status (available, on-delivery, offline)
    - Rider capacity (max 3 deliveries at once)
    - Rider service areas (geofencing)
    - Shift management
  - API: `GET /riders/available?location={lat,lng}&time={timestamp}`
  - Acceptance Criteria:
    - [ ] Only show available riders for dispatch
    - [ ] Respect rider max capacity
    - [ ] Notify riders of shift start

**UX Copy Examples:**
- Route optimization: "Optimized route saves 15 minutes. Pickup from Vendor A → Vendor B → Deliver to Customer."

---

### 1.15 AI-ENABLED FEATURES

#### ✅ **IMPLEMENTED**
- AI Assistant chat interface (UI mockup)
- Conversational UI for search and booking

#### ❌ **MISSING (Low Priority)**
- **Conversational assistant backend** (Priority: MEDIUM)
  - Status: UI exists, NO AI backend
  - Required:
    - NLP intent recognition (book service, search vendors, track order)
    - Entity extraction (service type, location, date/time)
    - Context management (multi-turn conversations)
    - Integration with booking API
  - Integration: OpenAI GPT, Dialogflow, or custom NLP
  - API: `POST /ai/chat` (input: message, sessionId; output: response, actions)
  - Acceptance Criteria:
    - [ ] Understand natural language queries
    - [ ] Book services via conversation
    - [ ] Answer FAQs
    - [ ] Escalate to human support if needed

- **Auto-categorization for vendor uploads** (Priority: LOW)
  - Status: NOT IMPLEMENTED
  - Use Case: Vendor uploads product images, AI suggests category and tags
  - Integration: Computer vision API (e.g., Clarifai, Google Vision)
  - API: `POST /ai/categorize-image` (input: image; output: suggestedCategory, tags)

- **Churn prediction** (Priority: LOW)
  - Status: NOT IMPLEMENTED
  - Use Case: Identify customers likely to churn, trigger retention campaigns
  - ML Model: Train on booking frequency, last booking date, app usage
  - Output: Churn risk score per customer
  - Action: Auto-send personalized offers to high-risk customers

**UX Copy Examples:**
- AI Assistant: "Hi! I can help you book a grooming session, find nearby vets, or track your orders. What would you like to do?"

---

## 2. API CONTRACT SPECIFICATIONS

### 2.1 Critical API Contracts (Missing or Incomplete)

#### **Subscription Management APIs**

**CREATE SUBSCRIPTION**
```
POST /subscriptions/create
Authorization: Bearer {customerToken}

Request:
{
  "customerId": "customer_abc123",
  "planId": "plan_weekly_2walks",
  "petId": "pet_xyz789",
  "startDate": "2025-11-20",
  "schedule": {
    "daysOfWeek": ["monday", "thursday"],
    "preferredTime": "18:00"
  },
  "deliveryAddress": {
    "line1": "123 MG Road",
    "city": "Bangalore",
    "pincode": "560001",
    "coordinates": { "lat": 12.9716, "lng": 77.5946 }
  },
  "paymentMethodId": "pm_card_xyz"
}

Response 200:
{
  "subscriptionId": "sub_abc123",
  "status": "active",
  "nextBillingDate": "2025-11-27",
  "amount": 1500,
  "nextDelivery": {
    "date": "2025-11-21",
    "estimatedTime": "18:00-19:00"
  }
}

Response 400:
{
  "error": "INVALID_SCHEDULE",
  "message": "Plan requires 2 days per week. Only 1 day selected."
}
```

**PAUSE SUBSCRIPTION**
```
PUT /subscriptions/{subscriptionId}/pause
Authorization: Bearer {customerToken}

Request:
{
  "pauseUntil": "2025-12-15",
  "reason": "going_on_vacation"
}

Response 200:
{
  "subscriptionId": "sub_abc123",
  "status": "paused",
  "pausedUntil": "2025-12-15",
  "resumesOn": "2025-12-16",
  "message": "Subscription paused. No deliveries scheduled until Dec 16."
}
```

**MODIFY SUBSCRIPTION (Upgrade/Downgrade)**
```
PUT /subscriptions/{subscriptionId}/modify
Authorization: Bearer {customerToken}

Request:
{
  "newPlanId": "plan_weekly_3walks",
  "effectiveFrom": "immediately" | "next_billing_cycle",
  "updateSchedule": {
    "daysOfWeek": ["monday", "wednesday", "friday"]
  }
}

Response 200:
{
  "subscriptionId": "sub_abc123",
  "oldPlanId": "plan_weekly_2walks",
  "newPlanId": "plan_weekly_3walks",
  "prorationAmount": 200,
  "nextBillingAmount": 2000,
  "effectiveDate": "2025-11-16",
  "message": "Plan upgraded. ₹200 proration charged immediately. Next billing: ₹2000 on Nov 27."
}
```

---

#### **Rider Dispatch & Tracking APIs**

**ASSIGN RIDER**
```
POST /orders/{orderId}/assign-rider
Authorization: Bearer {adminToken}

Request:
{
  "riderId": "rider_xyz123", // Optional, auto-assign if not provided
  "assignmentType": "auto" | "manual"
}

Response 200:
{
  "orderId": "order_abc123",
  "riderId": "rider_xyz123",
  "riderName": "Ravi Kumar",
  "riderPhone": "+919876543210",
  "estimatedPickupTime": "2025-11-15T14:30:00Z",
  "estimatedDeliveryTime": "2025-11-15T15:15:00Z"
}

Response 404:
{
  "error": "NO_RIDERS_AVAILABLE",
  "message": "No riders available within 5km of pickup location."
}
```

**UPDATE ORDER TRACKING**
```
PUT /orders/{orderId}/tracking
Authorization: Bearer {riderToken}

Request:
{
  "status": "picked_up" | "out_for_delivery" | "delivered" | "failed",
  "location": {
    "lat": 12.9716,
    "lng": 77.5946,
    "timestamp": "2025-11-15T14:35:00Z"
  },
  "eta": "2025-11-15T15:10:00Z", // Updated ETA
  "notes": "Traffic delay on MG Road"
}

Response 200:
{
  "orderId": "order_abc123",
  "status": "out_for_delivery",
  "currentEta": "2025-11-15T15:10:00Z",
  "customerNotified": true
}
```

**VERIFY DELIVERY**
```
POST /orders/{orderId}/verify-delivery
Authorization: Bearer {riderToken}

Request:
{
  "verificationType": "otp" | "photo" | "signature",
  "otp": "123456", // If otp
  "proofUrl": "https://...", // If photo
  "signatureData": "base64...", // If signature
  "notes": "Delivered to security guard"
}

Response 200:
{
  "orderId": "order_abc123",
  "status": "delivered",
  "deliveredAt": "2025-11-15T15:08:00Z",
  "verifiedBy": "otp",
  "message": "Delivery verified successfully."
}
```

---

#### **Dispute Resolution APIs**

**CREATE DISPUTE**
```
POST /disputes/create
Authorization: Bearer {customerToken}

Request:
{
  "bookingId": "booking_abc123",
  "type": "service_not_provided" | "poor_quality" | "damage" | "other",
  "title": "Walker did not show up",
  "description": "Booked walking service for Nov 15 at 6 PM. Walker never arrived and I waited for 30 minutes.",
  "evidence": [
    {
      "type": "photo" | "video" | "document",
      "url": "https://..."
    }
  ],
  "desiredResolution": "full_refund" | "partial_refund" | "service_redo" | "other",
  "desiredAmount": 500
}

Response 201:
{
  "disputeId": "dispute_abc123",
  "status": "open",
  "createdAt": "2025-11-15T18:45:00Z",
  "estimatedResolutionTime": "48 hours",
  "message": "Dispute created. We'll review and respond within 48 hours."
}
```

**RESOLVE DISPUTE (Admin)**
```
POST /admin/disputes/{disputeId}/resolve
Authorization: Bearer {adminToken}

Request:
{
  "resolution": "refund" | "partial_refund" | "warning" | "no_action" | "suspend_vendor",
  "refundAmount": 500,
  "refundMethod": "wallet" | "original",
  "vendorAction": "warning" | "suspend_7days" | "none",
  "resolutionNotes": "Verified customer waited. Vendor was at fault. Full refund issued.",
  "customerMessage": "We apologize for the inconvenience. Full refund of ₹500 issued to your wallet.",
  "vendorMessage": "This is your first warning. Further incidents may result in suspension."
}

Response 200:
{
  "disputeId": "dispute_abc123",
  "status": "resolved",
  "resolution": "refund",
  "refundAmount": 500,
  "refundedAt": "2025-11-16T10:30:00Z",
  "vendorAction": "warning",
  "closedAt": "2025-11-16T10:30:00Z"
}
```

---

#### **Payment & Payout APIs**

**CREATE PAYMENT ORDER**
```
POST /payments/create-order
Authorization: Bearer {customerToken}

Request:
{
  "amount": 1500,
  "currency": "INR",
  "bookingId": "booking_abc123",
  "customerId": "customer_xyz",
  "paymentMethod": "card" | "upi" | "wallet",
  "description": "Dog grooming service"
}

Response 200:
{
  "orderId": "pay_order_abc123",
  "amount": 1500,
  "currency": "INR",
  "gatewayOrderId": "razorpay_order_xyz", // From Razorpay
  "status": "pending",
  "expiresAt": "2025-11-15T15:00:00Z" // 15 min expiry
}
```

**VERIFY PAYMENT**
```
POST /payments/verify
Authorization: Bearer {customerToken}

Request:
{
  "orderId": "pay_order_abc123",
  "gatewayPaymentId": "razorpay_payment_xyz",
  "gatewaySignature": "abcd1234..."
}

Response 200:
{
  "orderId": "pay_order_abc123",
  "status": "success",
  "paidAt": "2025-11-15T14:32:00Z",
  "receiptUrl": "https://..."
}

Response 400:
{
  "error": "SIGNATURE_MISMATCH",
  "message": "Payment verification failed. Please contact support."
}
```

**INITIATE VENDOR PAYOUT**
```
POST /admin/payouts/initiate
Authorization: Bearer {adminToken}

Request:
{
  "vendorId": "vendor_abc123",
  "period": {
    "start": "2025-11-08",
    "end": "2025-11-15"
  },
  "amount": 12450,
  "bankAccount": {
    "accountNumber": "1234567890",
    "ifsc": "SBIN0001234",
    "accountHolderName": "Pet Grooming Services"
  }
}

Response 200:
{
  "payoutId": "payout_abc123",
  "vendorId": "vendor_abc123",
  "amount": 12450,
  "status": "initiated",
  "expectedCreditDate": "2025-11-16",
  "bankTransferReference": "NEFT123456"
}
```

---

#### **Medical Records APIs**

**ADD MEDICAL RECORD**
```
POST /pets/{petId}/medical-records
Authorization: Bearer {customerToken}

Request:
{
  "type": "vaccination" | "prescription" | "condition" | "surgery" | "lab_report" | "allergy",
  "data": {
    // For vaccination:
    "vaccineName": "Rabies",
    "administeredDate": "2025-10-15",
    "nextDueDate": "2026-10-15",
    "batchNumber": "RAB-2025-1234",
    "administeredBy": "Dr. Kumar",
    "clinicName": "Happy Paws Vet Clinic"
  },
  "documents": [
    {
      "type": "certificate",
      "url": "https://..."
    }
  ]
}

Response 201:
{
  "recordId": "record_abc123",
  "petId": "pet_xyz",
  "type": "vaccination",
  "createdAt": "2025-11-15T10:00:00Z",
  "reminder": {
    "enabled": true,
    "remindOn": "2026-10-01" // 14 days before due
  }
}
```

**SHARE MEDICAL RECORDS**
```
POST /pets/{petId}/medical-records/share
Authorization: Bearer {customerToken}

Request:
{
  "shareWith": "vendor_vet_abc123",
  "recordIds": ["record_1", "record_2"], // Specific records or "all"
  "accessDuration": 24, // Hours
  "purpose": "teleconsultation"
}

Response 200:
{
  "shareToken": "share_token_xyz",
  "expiresAt": "2025-11-16T12:00:00Z",
  "shareUrl": "https://app.warmpawz.com/shared-records/share_token_xyz",
  "message": "Medical records shared with Dr. Kumar. Access expires in 24 hours."
}
```

---

## 3. COMPONENT LIBRARY & DESIGN SYSTEM AUDIT

### 3.1 Current Component Status

#### ✅ **CONSISTENT & PRODUCTION-READY**
- **UI Components (ShadCN)**: Fully implemented and used consistently
  - Buttons, Inputs, Modals, Cards, Badges, Tabs, etc.
  - All components properly imported from `/components/ui`
- **Color Tokens**: Orange brand color (#FF8C42) used consistently throughout
- **Mobile Constraints**: 430px max width enforced on modals (customer app)
- **Typography**: Default typography from `/styles/globals.css` applied

#### ⚠️ **INCONSISTENCIES FOUND**
- **Spacing**: Inconsistent spacing units (sometimes `gap-3`, sometimes `gap-4` for similar contexts)
  - Recommendation: Define spacing scale in design tokens (xs=8px, sm=12px, md=16px, lg=24px, xl=32px)
- **Modal Widths**: Some admin modals exceed 430px constraint (not mobile-first)
  - Violation: Admin modals like `ApplicationDetailModal` use `max-w-4xl` (896px)
  - Recommendation: Enforce `max-w-[430px]` for all customer-facing modals
- **Button Sizes**: Inconsistent button sizing across flows
  - Some use `size="sm"`, others use default, some use `size="lg"`
  - Recommendation: Define button sizing guidelines (sm for secondary actions, default for primary, lg for hero CTAs)
- **Icon Library**: Mixed icon usage (some using lucide-react, some using emojis)
  - Recommendation: Standardize on lucide-react for all functional icons, reserve emojis for decorative only

### 3.2 Recommended Design Token System

**Create `/styles/design-tokens.css`:**
```css
:root {
  /* Colors */
  --color-brand-primary: #FF8C42;
  --color-brand-primary-hover: #FF7A2B;
  --color-brand-secondary: #FFB366;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;
  
  /* Spacing */
  --spacing-xs: 8px;
  --spacing-sm: 12px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  --spacing-2xl: 48px;
  
  /* Typography */
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  
  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  
  /* Mobile Constraints */
  --modal-max-width: 430px;
  --content-max-width: 1280px;
}
```

### 3.3 Component Library Mapping

| Component Type | Current Status | Recommended Library | Notes |
|----------------|----------------|---------------------|-------|
| Buttons | ✅ ShadCN | ShadCN Button | Consistent usage |
| Form Inputs | ✅ ShadCN | ShadCN Input, Textarea | Add form validation states |
| Modals | ✅ ShadCN Dialog | ShadCN Dialog | Enforce max-w-[430px] for customer app |
| Dropdowns | ✅ ShadCN Select | ShadCN Select | Consistent |
| Date Pickers | ✅ ShadCN Calendar | ShadCN Calendar | Consider adding date range picker |
| Tabs | ✅ ShadCN Tabs | ShadCN Tabs | Consistent |
| Cards | ✅ ShadCN Card | ShadCN Card | Add skeleton loading state |
| Badges | ✅ ShadCN Badge | ShadCN Badge | Define status badge color system |
| Toasts | ✅ Sonner | Sonner | Consistent |
| Icons | ⚠️ Mixed | Lucide React | Standardize on lucide-react |
| Maps | ✅ Google Maps | Google Maps API | API key management needed |
| Charts | ❌ Missing | Recharts (ShadCN Charts) | For admin analytics |
| Data Tables | ⚠️ Basic HTML tables | ShadCN Data Table (TanStack Table) | For admin vendor lists |
| File Upload | ⚠️ Custom | Custom component | Create reusable FileUpload component |
| Image Gallery | ❌ Missing | react-image-gallery | For vendor portfolios |
| Rating Stars | ⚠️ Custom | react-rating-stars-component | Standardize rating UI |

---

## 4. ACCESSIBILITY AUDIT (WCAG AA)

### 4.1 Critical Violations (Level A & AA)

#### ❌ **1.1.1 Non-text Content (Level A)**
**Violation:** Images without alt text
- **Location:** `ImageWithFallback` component used without alt prop in many places
- **Impact:** Screen readers cannot describe images
- **Fix:** Enforce alt prop as required in ImageWithFallback component
- **Example:**
  ```tsx
  // Current:
  <ImageWithFallback src={petPhoto} />
  
  // Fixed:
  <ImageWithFallback src={petPhoto} alt="Max, a golden retriever" />
  ```

#### ❌ **1.3.1 Info and Relationships (Level A)**
**Violation:** Form labels not properly associated with inputs
- **Location:** Several forms throughout the app
- **Impact:** Screen readers cannot identify input purpose
- **Fix:** Use `<Label>` component with `htmlFor` attribute
- **Example:**
  ```tsx
  // Current:
  <div>Name</div>
  <Input name="name" />
  
  // Fixed:
  <Label htmlFor="name">Name</Label>
  <Input id="name" name="name" />
  ```

#### ❌ **1.4.3 Contrast (Level AA)**
**Violation:** Insufficient color contrast in several areas
- **Location:** Gray text on light backgrounds (e.g., `text-gray-400` on `bg-gray-50`)
- **Contrast Ratio:** 2.5:1 (requires 4.5:1 for body text)
- **Fix:** Use darker text colors (`text-gray-600` minimum)
- **Automated Tool:** Run Lighthouse audit to identify all instances

#### ❌ **2.1.1 Keyboard (Level A)**
**Violation:** Custom interactive elements not keyboard accessible
- **Location:** 
  - Star rating component (cannot rate with keyboard)
  - Custom file upload buttons
  - Some modal close buttons
- **Fix:** 
  - Add `tabIndex={0}` to interactive elements
  - Handle Enter/Space key presses
  - Ensure focus management in modals
- **Example:**
  ```tsx
  <div 
    role="button"
    tabIndex={0}
    onClick={handleClick}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') handleClick();
    }}
  >
    Close
  </div>
  ```

#### ❌ **2.4.3 Focus Order (Level A)**
**Violation:** Focus trap not implemented in modals
- **Location:** All modal components
- **Impact:** User can tab out of modal to background content
- **Fix:** Use ShadCN Dialog's built-in focus trap or implement custom focus management
- **Library:** `focus-trap-react` or `@radix-ui/react-focus-scope`

#### ❌ **2.4.7 Focus Visible (Level AA)**
**Violation:** Focus indicator removed or not visible
- **Location:** Buttons and links with `focus:outline-none` without replacement
- **Fix:** Replace with visible focus ring
- **Example:**
  ```css
  /* Current: */
  .button { outline: none; }
  
  /* Fixed: */
  .button { 
    outline: none;
    ring-2 ring-[#FF8C42] ring-offset-2;
  }
  ```

#### ❌ **3.3.1 Error Identification (Level A)**
**Violation:** Form errors not clearly identified
- **Location:** Forms throughout the app
- **Impact:** Users don't know which fields have errors or why
- **Fix:** 
  - Display error messages below each invalid field
  - Use `aria-invalid` and `aria-describedby` attributes
  - Show error summary at top of form
- **Example:**
  ```tsx
  <div>
    <Label htmlFor="phone">Phone Number</Label>
    <Input 
      id="phone" 
      name="phone"
      aria-invalid={!!errors.phone}
      aria-describedby={errors.phone ? "phone-error" : undefined}
    />
    {errors.phone && (
      <p id="phone-error" className="text-red-500 text-sm mt-1">
        {errors.phone}
      </p>
    )}
  </div>
  ```

#### ❌ **3.3.2 Labels or Instructions (Level A)**
**Violation:** Required fields not marked
- **Location:** Forms throughout the app
- **Impact:** Users don't know which fields are required
- **Fix:** Add asterisk (*) or "Required" text to labels, use `required` attribute
- **Example:**
  ```tsx
  <Label htmlFor="name">
    Name <span className="text-red-500">*</span>
  </Label>
  <Input id="name" name="name" required aria-required="true" />
  ```

#### ❌ **4.1.2 Name, Role, Value (Level A)**
**Violation:** Custom components missing ARIA attributes
- **Location:** 
  - Custom star rating (no role or aria-label)
  - Status badges (no semantic meaning)
  - Custom dropdown menus
- **Fix:** Add appropriate ARIA roles and labels
- **Example:**
  ```tsx
  // Custom rating:
  <div role="radiogroup" aria-label="Rate this vendor">
    {[1,2,3,4,5].map(star => (
      <button 
        key={star}
        role="radio"
        aria-checked={rating === star}
        aria-label={`${star} stars`}
        onClick={() => setRating(star)}
      >
        ★
      </button>
    ))}
  </div>
  
  // Status badge:
  <span className="badge" role="status" aria-label="Booking confirmed">
    Confirmed
  </span>
  ```

### 4.2 Recommended Accessibility Enhancements

**Implement Skip Links**
```tsx
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
<main id="main-content">
  {/* Page content */}
</main>
```

**ARIA Landmarks**
```tsx
<header role="banner">...</header>
<nav role="navigation" aria-label="Main navigation">...</nav>
<main role="main">...</main>
<aside role="complementary">...</aside>
<footer role="contentinfo">...</footer>
```

**Live Regions for Dynamic Content**
```tsx
// For notifications, status updates:
<div role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// For urgent alerts:
<div role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

**Accessible Loading States**
```tsx
<Button disabled={loading} aria-busy={loading}>
  {loading && <span className="sr-only">Loading...</span>}
  {loading ? 'Please wait...' : 'Submit'}
</Button>
```

### 4.3 Accessibility Testing Checklist

- [ ] Run Lighthouse accessibility audit (target score: >90)
- [ ] Test with screen reader (NVDA/JAWS on Windows, VoiceOver on Mac/iOS)
- [ ] Keyboard-only navigation test (tab through all interactive elements)
- [ ] Test with 200% browser zoom (WCAG 1.4.4)
- [ ] Color contrast audit (use WebAIM contrast checker)
- [ ] Test with browser extensions (axe DevTools, WAVE)
- [ ] Automated testing with jest-axe
- [ ] Manual review of ARIA attributes
- [ ] Verify focus management in modals and dynamic content
- [ ] Test form validation with assistive tech

---

## 5. HANDOFF PACK (ASSETS MISSING FOR DEV)

### 5.1 Missing Design Assets

#### **Icons**
- [ ] App icon (iOS: 1024x1024, Android: 512x512)
- [ ] Splash screen (multiple resolutions)
- [ ] Favicon (16x16, 32x32, 180x180 for Apple)
- [ ] Custom category icons (currently using emojis, need SVG icons)
- [ ] Service-specific icons (grooming, walking, sitting, vet, etc.)
- [ ] Status icons (pending, confirmed, completed, canceled)

**Delivery Format:** SVG (for scalability), PNG fallbacks

#### **Images**
- [ ] Placeholder images for pets (if no photo uploaded)
- [ ] Placeholder for vendors (if no photo)
- [ ] Onboarding screens illustrations
- [ ] Empty state illustrations
  - No bookings yet
  - No pets added
  - No vendors found
  - Search no results
- [ ] Error state illustrations (404, 500, network error)
- [ ] Success state illustrations (booking confirmed, profile completed)

**Delivery Format:** SVG for illustrations, WebP for photos (with PNG fallback)

#### **Animations/Lottie Files**
- [ ] Loading spinner (branded)
- [ ] Success checkmark animation
- [ ] Error/failure animation
- [ ] Order tracking animation (rider moving on map)
- [ ] Payment processing animation

**Delivery Format:** Lottie JSON files

### 5.2 Design Specifications (Redlines)

**Required Redlines:**
- [ ] Component spacing and padding (8px grid system)
- [ ] Typography scale (font sizes, line heights, weights)
- [ ] Color palette (exact hex codes, opacity values)
- [ ] Border radius values
- [ ] Shadow specifications (elevation system)
- [ ] Breakpoints for responsive design (mobile, tablet, desktop)
- [ ] Modal dimensions and positioning
- [ ] Form field states (default, focus, error, disabled, success)
- [ ] Button states (default, hover, active, disabled, loading)
- [ ] Transition/animation specifications (duration, easing)

**Delivery Format:** Figma with inspect mode enabled, or Zeplin/Avocode

### 5.3 API Hints & Data Contracts

**Required Documentation:**
- [ ] Complete API endpoint list with descriptions
- [ ] Request/response schemas for each endpoint (see Section 2)
- [ ] Authentication flow documentation
- [ ] Error code dictionary
- [ ] Rate limiting specifications
- [ ] Webhook documentation (for real-time updates)
- [ ] File upload specifications (max size, allowed formats)
- [ ] Pagination standards (cursor vs offset)

**Delivery Format:** OpenAPI 3.0 specification (Swagger), Postman collection

### 5.4 Content & Copy

**Required Content:**
- [ ] Legal pages (Terms of Service, Privacy Policy, Refund Policy)
- [ ] Onboarding copy for each screen
- [ ] Error messages for each error type (user-friendly wording)
- [ ] Empty state messages
- [ ] Email templates (booking confirmation, cancellation, receipts)
- [ ] SMS templates (OTP, reminders, notifications)
- [ ] Push notification templates
- [ ] In-app messaging copy (tooltips, hints, success messages)
- [ ] FAQ content

**Delivery Format:** Google Doc or Markdown file

### 5.5 JSON Output: Missing Assets Checklist

```json
{
  "handoffPackage": {
    "projectName": "Warmpawz",
    "version": "1.0",
    "generatedDate": "2025-11-15",
    "missingAssets": {
      "icons": {
        "status": "incomplete",
        "items": [
          {
            "name": "app-icon",
            "formats": ["1024x1024 PNG (iOS)", "512x512 PNG (Android)"],
            "priority": "critical"
          },
          {
            "name": "category-icons",
            "formats": ["SVG"],
            "count": 12,
            "list": ["grooming", "vet", "walking", "sitting", "training", "food-delivery", "medicine-delivery", "cafe", "insurance", "photography", "hotel", "daycare"],
            "priority": "high"
          },
          {
            "name": "status-icons",
            "formats": ["SVG"],
            "list": ["pending", "confirmed", "started", "completed", "canceled", "failed"],
            "priority": "high"
          }
        ]
      },
      "illustrations": {
        "status": "incomplete",
        "items": [
          {
            "name": "empty-states",
            "count": 6,
            "list": ["no-bookings", "no-pets", "no-vendors-found", "no-search-results", "no-notifications", "no-reviews"],
            "format": "SVG",
            "priority": "high"
          },
          {
            "name": "error-states",
            "count": 4,
            "list": ["404", "500", "network-error", "payment-failed"],
            "format": "SVG",
            "priority": "medium"
          },
          {
            "name": "onboarding",
            "count": 3,
            "list": ["welcome", "add-pet", "first-booking"],
            "format": "SVG",
            "priority": "medium"
          }
        ]
      },
      "animations": {
        "status": "not-started",
        "items": [
          {
            "name": "loading-spinner",
            "format": "Lottie JSON",
            "priority": "high"
          },
          {
            "name": "success-checkmark",
            "format": "Lottie JSON",
            "priority": "high"
          },
          {
            "name": "order-tracking",
            "format": "Lottie JSON",
            "description": "Animated rider moving on map",
            "priority": "medium"
          }
        ]
      },
      "designSpecs": {
        "status": "incomplete",
        "items": [
          {
            "name": "design-tokens",
            "file": "design-tokens.css",
            "priority": "critical"
          },
          {
            "name": "component-redlines",
            "count": 25,
            "list": ["Button", "Input", "Card", "Modal", "Badge", "Table", "etc"],
            "priority": "high"
          },
          {
            "name": "responsive-breakpoints",
            "values": ["mobile: 430px", "tablet: 768px", "desktop: 1024px"],
            "priority": "high"
          }
        ]
      },
      "apiDocumentation": {
        "status": "partial",
        "items": [
          {
            "name": "openapi-spec",
            "format": "YAML/JSON",
            "priority": "critical",
            "coverage": "50%"
          },
          {
            "name": "postman-collection",
            "format": "JSON",
            "priority": "high",
            "coverage": "30%"
          },
          {
            "name": "error-dictionary",
            "format": "JSON/Markdown",
            "priority": "high",
            "status": "not-started"
          }
        ]
      },
      "content": {
        "status": "incomplete",
        "items": [
          {
            "name": "legal-pages",
            "list": ["Terms of Service", "Privacy Policy", "Refund Policy"],
            "priority": "critical",
            "status": "not-started"
          },
          {
            "name": "email-templates",
            "count": 10,
            "list": ["booking-confirmation", "cancellation", "refund", "dispute-opened", "dispute-resolved", "payment-receipt", "vendor-approved", "vendor-rejected", "password-reset", "otp"],
            "priority": "high",
            "status": "not-started"
          },
          {
            "name": "faq-content",
            "sections": ["Customers", "Vendors", "Payments", "Disputes"],
            "priority": "medium",
            "status": "not-started"
          }
        ]
      }
    },
    "summary": {
      "totalCategories": 6,
      "criticalMissing": 4,
      "highPriorityMissing": 12,
      "mediumPriorityMissing": 6
    }
  }
}
```

---

## 6. SECURITY & COMPLIANCE FLAGS

### 6.1 Critical Security Issues

#### ❌ **1. Authentication & Session Management**
**Issue:** No token expiration enforcement
- **Risk:** Stolen tokens can be used indefinitely
- **Fix:** Implement token expiration (e.g., 7 days for customer, 24 hours for admin)
- **API Changes:**
  - Add `expiresAt` field to session tokens
  - Implement refresh token mechanism
  - Force re-authentication on token expiry

**Issue:** No 2FA for admin accounts
- **Risk:** Admin account compromise leads to full platform access
- **Fix:** Implement TOTP-based 2FA using library like `otplib`
- **Priority:** CRITICAL

#### ❌ **2. Data Privacy (PII Encryption)**
**Issue:** Aadhaar, PAN, phone numbers stored in plain text
- **Risk:** Data breach exposes sensitive PII
- **Compliance:** Violates India's Data Protection Bill requirements
- **Fix:**
  - Encrypt PII at rest using AES-256
  - Encrypt in transit (already using HTTPS)
  - Implement key management (AWS KMS or Supabase Vault)
- **Fields to encrypt:**
  - Aadhaar number
  - PAN number
  - Bank account details
  - Credit card tokens (already handled by payment gateway)
- **Priority:** CRITICAL

**Code Example:**
```typescript
import { createCipheriv, createDecipheriv } from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32-byte key from env

function encryptPII(data: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptPII(encrypted: string): string {
  const parts = encrypted.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

#### ❌ **3. Authorization & Access Control**
**Issue:** No RBAC middleware on API endpoints
- **Risk:** Vendors can access other vendors' data, customers can call admin endpoints
- **Fix:** Implement middleware to check user role on each request
- **Example:**
  ```typescript
  // middleware/rbac.ts
  export function requireRole(allowedRoles: string[]) {
    return async (c: Context, next: Next) => {
      const user = c.get('user'); // Set by auth middleware
      if (!user || !allowedRoles.includes(user.role)) {
        return c.json({ error: 'Forbidden' }, 403);
      }
      await next();
    };
  }
  
  // Usage:
  app.get('/admin/vendors', requireRole(['admin']), async (c) => {
    // Admin-only endpoint
  });
  ```

**Issue:** No row-level security (RLS) on data
- **Risk:** API bugs can leak data across users
- **Fix:** Implement RLS in Supabase (if using Postgres) or KV-level access checks
- **Priority:** HIGH

#### ❌ **4. File Upload Security**
**Issue:** No file type/size validation
- **Risk:** Malware upload, storage cost explosion, DoS
- **Fix:**
  - Validate file MIME type on server (don't trust client)
  - Limit file size (5MB for documents, 10MB for images)
  - Scan files for viruses (ClamAV or cloud service)
  - Generate unique filenames to prevent overwrites
  - Store files in private buckets (not public)
- **Code Example:**
  ```typescript
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  
  function validateFile(file: File): { valid: boolean; error?: string } {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File too large. Max 5MB.' };
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { valid: false, error: 'Invalid file type.' };
    }
    return { valid: true };
  }
  ```

#### ❌ **5. Rate Limiting**
**Issue:** No rate limiting on API endpoints
- **Risk:** DDoS attacks, API abuse, cost explosion
- **Fix:** Implement rate limiting using Hono middleware or Upstash rate limiting
- **Limits:**
  - Auth endpoints: 5 requests/minute per IP
  - Search endpoints: 60 requests/minute per user
  - Write endpoints: 30 requests/minute per user
- **Code Example:**
  ```typescript
  import { Ratelimit } from '@upstash/ratelimit';
  import { Redis } from '@upstash/redis';
  
  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, '1m'),
  });
  
  app.use('/auth/*', async (c, next) => {
    const ip = c.req.header('x-forwarded-for') || 'unknown';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return c.json({ error: 'Too many requests' }, 429);
    }
    await next();
  });
  ```

### 6.2 Compliance Requirements

#### **KYC/AML Compliance**
**Required for Vendors:**
- [ ] Aadhaar verification (use DigiLocker API or Aadhaar eSign)
- [ ] PAN verification (use Income Tax API or third-party KYC provider)
- [ ] Bank account verification (penny drop test via Razorpay)
- [ ] Criminal background check for sensitive services (walking, sitting)
- [ ] Vet license verification (state veterinary council API)

**UI Additions Needed:**
- Aadhaar verification modal with OTP
- PAN verification screen
- Bank account verification screen
- Document expiry tracking (remind 30 days before expiry)

**API Integration:**
- Third-party KYC provider: Signzy, IDfy, or HyperVerge
- Priority: HIGH

#### **Data Privacy & GDPR-like Compliance**
**Required Features:**
- [ ] **Right to Access:** Allow users to export their data (JSON/PDF)
  - API: `GET /account/export-data`
  - Button: "Download My Data" in account settings
- [ ] **Right to Deletion:** Allow users to request account deletion
  - API: `POST /account/delete-request`
  - Soft delete (mark deleted, purge after 30 days)
  - Notify user before permanent deletion
- [ ] **Data Minimization:** Only collect necessary data
  - Review: Remove unnecessary fields from forms
- [ ] **Consent Management:** Explicit consent for data usage
  - Add checkboxes: "I consent to Warmpawz storing my data"
  - Terms acceptance timestamp tracking
- [ ] **Data Breach Notification:** Process to notify users if breach occurs
  - Admin tool to send breach notifications
  - Legal requirement in India (within 72 hours)

**Priority:** HIGH

#### **Payment Compliance (PCI-DSS)**
**Status:** Partially compliant (using payment gateway)
**Required:**
- [ ] Never store CVV/CVC codes (already compliant)
- [ ] Use payment gateway tokenization for saved cards (Razorpay supports this)
- [ ] Display security badges on payment screens
- [ ] SSL certificate validation (already compliant)
- [ ] Annual PCI-DSS audit (if processing >6M transactions/year)

**UI Copy:**
- Add near payment form: "🔒 Your payment information is encrypted and secure. We never store your card details."

#### **Pet Health Data Privacy**
**Issue:** Medical records are sensitive data
**Required:**
- [ ] Explicit consent before sharing medical records with vets
- [ ] Time-limited access tokens (expire after 24 hours)
- [ ] Audit log of who accessed records and when
- [ ] Option to revoke access
- [ ] Encryption of medical records

**UI Additions:**
- Consent modal: "Share Max's medical records with Dr. Kumar?"
- Access log: "Last accessed by Dr. Kumar on Nov 15 at 3:30 PM"

**Priority:** MEDIUM

#### **Tax Compliance (GST, TDS)**
**Required for India:**
- [ ] Collect vendor GSTIN (if applicable)
- [ ] Generate GST-compliant invoices for bookings >₹200
- [ ] Calculate and display GST breakdown (CGST, SGST/IGST)
- [ ] TDS deduction from vendor payouts (if applicable)
- [ ] Generate Form 16A for vendors (TDS certificate)
- [ ] Annual GST filing reports

**UI Additions:**
- Invoice display with GST breakdown
- Vendor dashboard: Downloadable invoices and TDS certificates

**API Additions:**
- `GET /vendors/{id}/invoices?year={year}` (for GST filing)
- `GET /vendors/{id}/tds-certificate?year={year}`

**Priority:** HIGH (Legal requirement)

---

## 7. PRIORITIZED ACTION LIST

### 7.1 CRITICAL PRIORITY (Fix Immediately)

| # | Item | Status | Estimated Effort | Impact |
|---|------|--------|------------------|--------|
| 1 | **Implement Payment Gateway Integration** (Razorpay) | ❌ Not Started | 5-7 days | CRITICAL - Platform cannot operate without payments |
| 2 | **Complete Subscription Lifecycle Management** (Create, Pause, Modify, Cancel) | ❌ Not Started | 7-10 days | CRITICAL - Core monetization feature |
| 3 | **Implement Vendor Payout System** (Earnings calculation, bank transfer) | ❌ Not Started | 5-7 days | CRITICAL - Vendors won't join without payouts |
| 4 | **Build Dispute Resolution Workflow** (Customer, Vendor, Admin flows) | ❌ Not Started | 7-10 days | CRITICAL - Trust and safety requirement |
| 5 | **E-commerce Shopping Cart** (Add to cart, checkout, multi-vendor) | ❌ Not Started | 7-10 days | CRITICAL - Cannot sell products without cart |
| 6 | **Rider Dispatch System** (Assignment, tracking, ETA) | ⚠️ UI Mockup Only | 10-14 days | CRITICAL - Cannot deliver orders without dispatch |
| 7 | **PII Data Encryption** (Aadhaar, PAN, bank details) | ❌ Not Started | 3-5 days | CRITICAL - Legal compliance requirement |
| 8 | **RBAC & Authorization Middleware** (Role-based access control) | ❌ Not Started | 3-5 days | CRITICAL - Security vulnerability |
| 9 | **Complete Review System** (Submit, respond, moderate) | ⚠️ Display Only | 5-7 days | CRITICAL - Trust indicator for customers |

**Total Critical Effort:** 52-74 days (10.4-14.8 weeks) - **Can be parallelized across 3-4 developers to 4-5 weeks**

---

### 7.2 HIGH PRIORITY (Next Sprint)

| # | Item | Status | Estimated Effort | Impact |
|---|------|--------|------------------|--------|
| 10 | **Notification System** (SMS, Email, Push) | ⚠️ Stub Only | 7-10 days | HIGH - User engagement |
| 11 | **Comprehensive Medical Records** (Vaccinations, prescriptions, history) | ⚠️ Basic Only | 7-10 days | HIGH - Key differentiator for pet owners |
| 12 | **Prescription & Pharmacy Integration** (Digital Rx, order meds) | ❌ Not Started | 7-10 days | HIGH - Revenue opportunity |
| 13 | **Wallet System** (Add money, balance, transactions) | ❌ Not Started | 5-7 days | HIGH - Improves conversion |
| 14 | **Recurring Bookings** (Subscription bookings from customer app) | ❌ Not Started | 5-7 days | HIGH - Already configured in admin, need customer flow |
| 15 | **Cancellation & Rescheduling** (Policies, refunds, alternatives) | ⚠️ Partial | 5-7 days | HIGH - Customer flexibility |
| 16 | **KYC Verification** (Aadhaar, PAN, license verification APIs) | ❌ Not Started | 7-10 days | HIGH - Trust and compliance |
| 17 | **Admin Analytics Dashboard** (GMV, revenue, customer metrics) | ❌ Not Started | 7-10 days | HIGH - Business insights |
| 18 | **Geolocation-based Search** (Nearby vendors, distance sorting) | ⚠️ Basic | 3-5 days | HIGH - Core discovery feature |
| 19 | **Accessibility Audit & Fixes** (WCAG AA compliance) | ⚠️ Partial | 7-10 days | HIGH - Legal requirement + UX |
| 20 | **Rate Limiting & Security Hardening** (DDoS protection, input validation) | ❌ Not Started | 3-5 days | HIGH - Security risk |

**Total High Priority Effort:** 63-91 days (12.6-18.2 weeks) - **Parallelized: 5-6 weeks**

---

### 7.3 MEDIUM PRIORITY (Next Month)

| # | Item | Status | Estimated Effort | Impact |
|---|------|--------|------------------|--------|
| 21 | **Sitter/Caretaker Complete Flow** (Booking, care instructions, check-ins) | ⚠️ Partial | 5-7 days | MEDIUM - Expand service offerings |
| 22 | **Grooming Pickup/Drop-off** (Logistics, photo verification) | ⚠️ Basic | 3-5 days | MEDIUM - Service enhancement |
| 23 | **Advanced Filtering** (Price, rating, availability, certifications) | ⚠️ Basic | 3-5 days | MEDIUM - Improve discovery |
| 24 | **Saved Payment Methods** (Tokenization, default payment) | ❌ Not Started | 3-5 days | MEDIUM - Convenience |
| 25 | **Instant Booking** (Auto-accept for vendors) | ❌ Not Started | 3-5 days | MEDIUM - Reduce friction |
| 26 | **Review Incentives** (Rewards, badges, helpful voting) | ❌ Not Started | 3-5 days | MEDIUM - Engagement |
| 27 | **Vendor Performance Management** (Admin tools, leaderboard) | ❌ Not Started | 5-7 days | MEDIUM - Operations efficiency |
| 28 | **Failed Delivery Handling** (Retry, rescheduling, refunds) | ❌ Not Started | 5-7 days | MEDIUM - Improve fulfillment |
| 29 | **BNPL Integration** (Simpl, LazyPay) | ❌ Not Started | 5-7 days | MEDIUM - Increase conversions |
| 30 | **Quick Order/Reorder** (Order history, one-click reorder) | ❌ Not Started | 3-5 days | MEDIUM - Convenience |
| 31 | **Video Calling Integration** (Twilio Video for teleconsult) | ⚠️ Mockup Only | 7-10 days | MEDIUM - Complete teleconsult feature |
| 32 | **Route Optimization** (Multi-stop routing, traffic consideration) | ❌ Not Started | 5-7 days | MEDIUM - Delivery efficiency |
| 33 | **Pet Onboarding Wizard** (Guided flow, breed suggestions, health questions) | ⚠️ Basic | 3-5 days | MEDIUM - Improve onboarding |
| 34 | **Content Management** (Banners, campaigns, push notifications) | ⚠️ Partial | 5-7 days | MEDIUM - Marketing capabilities |
| 35 | **Tax Compliance** (GST invoices, TDS certificates) | ❌ Not Started | 5-7 days | MEDIUM - Legal requirement |

**Total Medium Priority Effort:** 60-91 days (12-18.2 weeks) - **Parallelized: 4-5 weeks**

---

### 7.4 LOW PRIORITY (Future)

| # | Item | Status | Estimated Effort | Impact |
|---|------|--------|------------------|--------|
| 36 | **AI Conversational Assistant** (NLP backend for chat) | ⚠️ Mockup Only | 10-14 days | LOW - Nice-to-have feature |
| 37 | **AI Auto-categorization** (Product image categorization) | ❌ Not Started | 7-10 days | LOW - Vendor convenience |
| 38 | **Churn Prediction** (ML model for customer retention) | ❌ Not Started | 14-21 days | LOW - Advanced analytics |
| 39 | **Pet Microchip & Insurance Tracking** | ❌ Not Started | 2-3 days | LOW - Additional data fields |
| 40 | **Multi-vendor Cart Handling** (Complex logic for split orders) | ❌ Not Started | 7-10 days | LOW - Advanced e-commerce |
| 41 | **Image Gallery Component** (For vendor portfolios) | ❌ Not Started | 2-3 days | LOW - Visual enhancement |
| 42 | **Before/After Photos** (Grooming service) | ❌ Not Started | 2-3 days | LOW - Service enhancement |
| 43 | **Vendor Grooming Packages** (Custom packages, breed-specific) | ❌ Not Started | 3-5 days | LOW - Product offering |
| 44 | **Social Login** (Google, Facebook OAuth) | ❌ Not Started | 3-5 days | LOW - Convenience |
| 45 | **Compliance & Reporting** (Document expiry tracking, audit reports) | ❌ Not Started | 5-7 days | LOW - Operations efficiency |

**Total Low Priority Effort:** 55-86 days (11-17.2 weeks) - **Parallelized: 3-4 weeks**

---

## 8. PRODUCTION READINESS ASSESSMENT

### 8.1 Current Status by Layer

#### **Platform Admin**
- **Status:** 🟢 85% Production Ready
- **Strengths:**
  - Vendor onboarding and approval workflow complete
  - Role management and dynamic configuration functional
  - Service catalog management operational
  - Document upload and review working
- **Gaps:**
  - Analytics dashboard missing
  - Vendor performance tools incomplete
  - Payout management system not built
  - Compliance reporting missing
- **Estimated Time to Production:** 3-4 weeks

#### **Vendor App**
- **Status:** 🟡 70% Production Ready
- **Strengths:**
  - Onboarding flow complete with document upload
  - Dashboard showing bookings and earnings (mockup)
  - Service management interface functional
  - Teleconsultation flow screens built
- **Gaps:**
  - Payout system not integrated
  - Real-time booking notifications missing
  - Inventory management incomplete
  - Actual video calling not integrated
  - Analytics and performance metrics missing
- **Estimated Time to Production:** 4-5 weeks

#### **Customer App**
- **Status:** 🟡 65% Production Ready
- **Strengths:**
  - Discovery and search functional (basic)
  - Walker booking fully implemented
  - Pet profile creation working
  - Active session tracking with GPS
- **Gaps:**
  - Subscription purchase flow missing
  - Shopping cart not implemented
  - Payment integration missing
  - Medical records incomplete
  - Dispute resolution not built
  - Review submission missing
- **Estimated Time to Production:** 6-7 weeks

### 8.2 Overall Production Readiness: **60%**

**Breakdown:**
- **Backend API Coverage:** 65% (missing payments, payouts, disputes, notifications)
- **Frontend Completeness:** 70% (UI mostly built, missing integration and flows)
- **Data Consistency:** 75% (improved after recent fixes, still needs validation layer)
- **Security & Compliance:** 40% (major gaps in PII encryption, RBAC, KYC)
- **Testing:** 10% (minimal testing, no automated tests)
- **Documentation:** 50% (some guides exist, API docs incomplete)

**Blocking Issues for Production:**
1. Payment integration (CRITICAL)
2. Vendor payout system (CRITICAL)
3. PII encryption (CRITICAL)
4. RBAC implementation (CRITICAL)
5. Subscription customer flow (CRITICAL)
6. Shopping cart (CRITICAL)
7. Dispute resolution (CRITICAL)

**Estimated Time to Production (MVP):** **12-16 weeks** with 4-person team working full-time

---

## 9. RECOMMENDED NEXT STEPS

### Phase 1: Core Commerce & Payments (Weeks 1-4)
**Goal:** Enable basic transactions
- [ ] Integrate Razorpay payment gateway
- [ ] Build wallet system
- [ ] Implement vendor payout system
- [ ] Create shopping cart (basic)
- [ ] Enable subscription purchase flow

**Deliverables:** Customers can book, pay, and vendors can receive payouts

---

### Phase 2: Trust & Safety (Weeks 5-7)
**Goal:** Build trust mechanisms
- [ ] Complete review and rating system
- [ ] Implement dispute resolution workflow
- [ ] Build notification system (SMS, email, push)
- [ ] Add KYC verification for vendors
- [ ] Implement PII encryption

**Deliverables:** Platform has trust and safety measures in place

---

### Phase 3: Fulfillment & Logistics (Weeks 8-11)
**Goal:** Enable reliable delivery
- [ ] Build rider dispatch system
- [ ] Implement order tracking (real-time)
- [ ] Add failed delivery handling
- [ ] Create rider acceptance/decline flow
- [ ] Implement route optimization (basic)

**Deliverables:** Products can be delivered reliably with tracking

---

### Phase 4: Analytics & Operations (Weeks 12-14)
**Goal:** Enable business monitoring
- [ ] Build admin analytics dashboard
- [ ] Add vendor performance management tools
- [ ] Implement operations dashboard (live view)
- [ ] Create compliance & reporting tools
- [ ] Add customer support tools

**Deliverables:** Admin can monitor and operate the platform

---

### Phase 5: Security & Compliance (Weeks 15-16)
**Goal:** Harden security and meet compliance
- [ ] Implement RBAC middleware
- [ ] Add rate limiting
- [ ] Complete accessibility fixes (WCAG AA)
- [ ] Add 2FA for admin
- [ ] Conduct security audit
- [ ] Implement data export/deletion (GDPR-like)

**Deliverables:** Platform is secure and compliant

---

### Phase 6: Testing & Optimization (Weeks 17-18)
**Goal:** Ensure reliability
- [ ] Write unit tests (critical paths)
- [ ] Add integration tests (API endpoints)
- [ ] Conduct E2E testing
- [ ] Performance optimization
- [ ] Load testing
- [ ] Bug fixes from testing

**Deliverables:** Platform is tested and stable

---

## 10. CONCLUSION

### Key Findings

**Strengths:**
1. Solid foundation with 3-layer architecture implemented
2. Vendor onboarding and admin approval workflow production-grade
3. Walker service is a complete, working reference implementation
4. Dynamic role configuration system is innovative and scalable
5. Mobile-first design with proper constraints

**Critical Gaps:**
1. **No payment integration** - Blocking for any revenue
2. **No payout system** - Blocking vendor participation
3. **Incomplete subscription lifecycle** - Blocking recurring revenue
4. **No shopping cart** - Blocking e-commerce
5. **No rider dispatch** - Blocking delivery services
6. **Missing dispute resolution** - Blocking trust
7. **Security vulnerabilities** - Blocking production launch

**Timeline to Production (MVP):**
- **With 4-person team:** 12-16 weeks
- **With 2-person team:** 20-24 weeks
- **Critical path:** Payments → Payouts → Cart → Subscriptions → Dispatch → Security

**Recommended Immediate Actions:**
1. Prioritize payment integration (Razorpay) - 1 week
2. Build vendor payout system - 1 week
3. Create subscription customer flow - 1.5 weeks
4. Implement shopping cart - 1.5 weeks
5. Build dispute resolution - 1.5 weeks
6. Add RBAC and PII encryption - 1 week
**Total:** ~8 weeks for minimum viable commerce platform

---

**Platform Maturity:** **60% Complete (MVP Stage)**
**Production Ready Modules:** Vendor Onboarding, Admin Management, Walker Service
**Blocking Modules:** Payments, Payouts, Cart, Subscriptions, Dispatch, Security
**Recommended Launch Strategy:** Phased rollout starting with Walker service only (already production-grade), then add other services iteratively

---

*Report Generated: November 15, 2025*  
*Next Review Recommended: After Phase 1 completion (Week 4)*
