# Warmpawz — Features & Value Proposition (A4 One-Pager)

*Source: Codebase trace — customer-web, vendor-web, backend Lambda (service-discovery, capability-routes, booking, pharmacy, payments, settlements).*

---

## Warmpawz at a glance

**Platform:** Pet care services marketplace — discovery, booking, payments, prescriptions, and vendor operations in one ecosystem.

---

## Features list (from implementation)

### For customers (customer-web + backend)

| Area | Features (as built in code) |
|------|-----------------------------|
| **Discovery** | Multi-category search: Vet, Grooming, Training, Walker, Nutrition, Boarding, Diagnostics/Lab, Shop, Pharmacy, Pet Cafes, Photography, Insurance, Ambulance, Breeder, Adoption, Relocation, Resort, Holiday, Sunset, Behaviourist, Mating & Dating. Hyperlocal provider discovery (radius/distance). Problem-based filtering. Ratings, reviews, next-available slot. |
| **Booking** | **At center** (visit clinic/salon/center), **At home** (provider visits you), **Tele** (video consultation). **Instant** video (vet — connect without fixed slot). Service + pet + time slot + address (home) → payment → confirmation. Package sessions & subscription (unlimited) support. |
| **Payments** | Online payment (Razorpay). Payment before or at booking. Zero payment for package/subscription usage when applicable. |
| **Verification** | OTP for service completion (at center / at home). No OTP for tele/instant. |
| **Tracking** | Live GPS tracking for home visits (e.g. walker, at-home vet). Start travel → customer sees provider location. |
| **Prescriptions** | View prescriptions linked to bookings. Upload prescription. **Order medicine** from prescription → pharmacy broadcast (nearby pharmacies) → delivery address → payment → delivery tracking. |
| **Pharmacy** | Order medicine with/without prescription. Broadcast to pharmacies (radius expansion). Pharmacy acceptance, invoice, payment. Delivery tracking. |
| **Communication** | In-app **chat** with provider per booking. **Video call** (Chime) for tele/instant consultations. Notifications for booking status, messages, incoming call. |
| **Account** | Pet profiles, saved addresses. Booking history, reschedule, follow-up. Prescription history. |

### For vendors (vendor-web + backend)

| Area | Features (as built in code) |
|------|-----------------------------|
| **Onboarding** | Phone OTP sign-in → role selection (Vet, Groomer, Trainer, Walker, Nutritionist, Behaviourist, etc.) → Solo or Business → dynamic application form → admin review → approved → go-live checklist (profile, bank, services, availability). |
| **Profile** | Business/display name, contact, address, description, photo. Profile completion % for go-live. Facility (clinic: amenities, operating hours) where applicable. |
| **Bank & payouts** | Add bank account (name, account number, IFSC). **Verify** via bank validation. Only verified accounts receive settlements. Primary account for payouts. |
| **Tier & commission** | Tier system (e.g. Bronze, Silver, Gold, Platinum). Commission rate per booking. Payout period (e.g. weekly). Settlement breakup visible. |
| **Services** | Add/edit services: name, description, duration, price. Service styles: **At center**, **At home**, **Tele** (by role). Enable/publish. Catalog browse or custom. Packages (business): session, combo, subscription, unlimited; validity, included services. |
| **Availability** | **Advanced Availability:** weekly schedule — day tabs, multiple slots per day, start/end time, service style per slot, lead time (travel/prep/setup). Breaks (lunch, tea, personal). Holidays/vacation. Save all. Solo: **Go offline** toggle. |
| **Bookings** | View today/upcoming. Accept or reject pending. By style: at center (OTP complete), at home (optional start travel, OTP complete), tele/instant (join video, mark complete). Chat & video per booking. |
| **Prescriptions & medical** | Issue prescriptions (medications, diagnosis, instructions). Draft or publish. Consultation summary (vet summary). Medical records, diagnostics (lab tests, report upload) where role supports. |
| **Earnings & settlements** | Earnings per booking (amount, commission, net). Pending payout. Settlements (batched payouts: pending → processing → completed). Transfers to verified bank. |
| **Other capabilities (by role)** | Diagnostics, pharmacy orders, ambulance, gallery, progress tracking, diet charts, reservations, check-in/out, route tracking, reviews, analytics, notifications. |

---

## Value proposition

### For customers (pet parents)

- **One place for pet care** — Discover and book vet, grooming, training, walker, nutritionist, boarding, pharmacy, and more from a single app.
- **How you want it** — Choose **at clinic**, **at home**, or **video** (tele/instant) by service and provider.
- **Trust & transparency** — See ratings, reviews, and provider details; OTP verification when the service is completed.
- **Prescriptions & medicine** — Get digital prescriptions from consultations and **order medicine** with delivery; track pharmacy and delivery.
- **Track when it matters** — Live GPS tracking for home visits (e.g. walker, vet at home) so you know when the provider is on the way.
- **Flexible spending** — Book single sessions or use **packages** and **subscriptions** where offered; secure online payment.

### For vendors (providers & clinics)

- **Get discovered** — Listed in discovery by category and location; customers find you by service type, style (at center / at home / tele), and availability.
- **One dashboard** — Manage profile, services, availability, bookings, chat, video, prescriptions, earnings, and bank in one place.
- **Control your schedule** — Set weekly slots, breaks, and holidays; solo providers can go offline when not taking bookings.
- **Get paid** — Online payments from customers; automatic earnings and settlements to your **verified** bank account with clear commission and payout visibility.
- **Professional tools** — Prescriptions, consultation summaries, and (by role) diagnostics, pharmacy orders, so you can serve customers end-to-end on the platform.

---

## Service styles (how customers book)

| Style | Customer experience | Vendor side |
|-------|---------------------|-------------|
| **At center** | Customer goes to clinic/salon/center. Books slot. OTP to complete visit. | Clinic sets at-center slots. Completes with customer OTP. |
| **At home** | Provider comes to customer address. Optional live tracking. OTP to complete. | Vendor sets at-home slots. Optional start travel. Completes with customer OTP. |
| **Tele** | Scheduled video consultation. Join at booked time. No OTP. | Vendor sets tele slots. Joins call. Marks complete after consultation. |
| **Instant** | Video consult without fixed slot (e.g. vet). Connect when provider is available. | Vendor in “available now” pool. Joins call. Marks complete. |

---

---

**Print tip:** For a single A4 page, print with narrow margins and font size 9–10pt, or use the tables and value-proposition sections only.

*Document generated from codebase trace. For product or pricing updates, refer to the latest app and backend.*
