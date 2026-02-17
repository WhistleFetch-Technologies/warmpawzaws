# Warmpawz Vendor Help Guide — Vet Clinic

> **Full training guide:** For one document that covers **both Vet Solo and Vet Clinic** with **common** vs **role-specific** sections and the **same step-by-step format** for every capability (onboarding, profile, bank, services, availability, appointments by style, earnings), use **[WARMPAWZ_VET_VENDOR_COMPLETE_GUIDE.md](./WARMPAWZ_VET_VENDOR_COMPLETE_GUIDE.md)**.  
> This file is a **Vet Clinic–only** summary; follow the complete guide for full training.

**Audience:** Veterinary clinics and hospitals (business/center) on the Warmpawz platform.  
**Purpose:** Step-by-step guide to onboard, configure services, handle appointments, prescribe, and get paid. Follow this guide in order for a complete understanding.

---

## Table of Contents

1. [Onboarding: From Sign-Up to Approved](#1-onboarding-from-sign-up-to-approved)
2. [After Approval: Go-Live Setup](#2-after-approval-go-live-setup)
3. [Profile & Facility Configuration](#3-profile--facility-configuration)
4. [Bank Account & Verification](#4-bank-account--verification)
5. [Tier System & Commission](#5-tier-system--commission)
6. [Note: Staff Decommissioned](#6-note-staff-management-decommissioned)
7. [Services: What They Are & How to Configure](#7-services-what-they-are--how-to-configure)
8. [Packages](#8-packages)
9. [Setting Your Availability (Advanced Availability)](#9-setting-your-availability-advanced-availability)
10. [Going Live](#10-going-live)
11. [When an Appointment Is Received](#11-when-an-appointment-is-received)
12. [Handling Appointments by Type](#12-handling-appointments-by-type)
13. [Customer Interaction: Chat & Video](#13-customer-interaction-chat--video)
14. [Completing an Appointment](#14-completing-an-appointment)
15. [Prescribing & Consultation Summary](#15-prescribing--consultation-summary)
16. [Diagnostics, Pharmacy & Ambulance (If Enabled)](#16-diagnostics-pharmacy--ambulance-if-enabled)
17. [Settlements & Earnings](#17-settlements--earnings)
18. [Settings & Day-to-Day](#18-settings--day-to-day)

---

## 1. Onboarding: From Sign-Up to Approved

As a **vet clinic** (business/center), you represent an organization with a physical location and optional staff. The platform guides you through these steps in order.

| Step | What you see | What to do |
|------|----------------|------------|
| **1. Sign in** | Enter phone number | Use your **business** or primary contact mobile number. Enter the OTP sent by SMS to verify. |
| **2. Role selection** | List of business types | Choose **Veterinary Clinic** (or **Vet Clinic**). This gives you clinic capabilities: at-center, tele, at-home, prescriptions, diagnostics, etc. |
| **3. Vendor type** | Solo vs Business | Choose **Business / Center**. This enables at-center (in-clinic) bookings and full package creation. |
| **4. Application form** | Single dynamic form | Fill in: **business name**, contact person, **address** (clinic address), phone, email, and any role-specific/KYC fields (e.g. business registration, GST). Submit when complete. |
| **5. Under review** | “Under review” screen | Wait for Warmpawz to review. Respond to any clarification requests. |
| **6. Approved** | “Approved” screen | You will be directed to complete **profile**, **bank**, **schedule**, and **services** before going live. |
| **7. Activated** | Dashboard | After completing the go-live checklist and clicking **Go Live**, your clinic is discoverable and can receive bookings. |

**Important:** Choosing **Business** is required for in-clinic (at center) appointments and full package creation. Do not skip steps; you cannot take bookings until **approved** and **go-live** is done.

---

## 2. After Approval: Go-Live Setup

After approval, you must complete these **four required items** before you can go live:

1. **Complete your business profile** (see [§3](#3-profile--facility-configuration)) — at least 80% completion (business name, address, contact, etc.).
2. **Add and verify a bank account** (see [§4](#4-bank-account--verification)) — required for receiving payouts.
3. **Add at least one service** (see [§7](#7-services-what-they-are--how-to-configure)) — enable and publish so customers can book.
4. **Set your availability schedule** (see [§9](#9-setting-your-availability-advanced-availability)) — at least one day with time windows.

The **Go-Live Checklist** shows each item as complete or pending. When all four are complete, the **Go Live** button becomes available.

---

## 3. Profile & Facility Configuration

**Where:** Dashboard → **Profile** and (if available) **Facility** or **Settings**.

**Profile (business):**

- **Business name** — Your clinic name as shown to customers (e.g. “Happy Paws Veterinary Clinic”).
- **Owner / Contact person** — Name of the person responsible for the account.
- **Phone** — Primary contact number (used for sign-in and notifications).
- **Email** — For official communication.
- **Address** — Full **clinic address**. Used for “at center” discovery and for customers to find you.
- **Description / About** — Short description of your clinic (services, specializations, timings).
- **Profile / logo image** — Optional but recommended.

**Facility (if available):** Some roles have **Facility management** (under **Operations** or **Settings**). There you can add:

- **Amenities** — e.g. parking, waiting area, ICU.
- **Operating hours** — Can align with your schedule (see [§9](#9-setting-your-availability-advanced-availability)).
- **Policies** — Cancellation, no-show, etc., if the app supports them.

**Profile completion:** The system calculates a percentage from required and optional fields. You need **at least 80%** to satisfy the go-live “Complete your business profile” requirement.

---

## 4. Bank Account & Verification

**Why it matters:** All payouts (settlements) are sent only to a **verified** bank account. Unverified accounts cannot receive money.

**Where:** Dashboard → **Finance** → **Bank Account** (or **Settings** → Payment / Bank).

**Steps:**

1. **Add bank account**  
   Enter:
   - **Account holder name** — Must match the bank record (can be clinic name or proprietor name).
   - **Account number** — Full number, no spaces.
   - **IFSC code** — Branch IFSC.
   - **Bank name** (and branch if asked).

2. **Save**  
   Use **Save & Verify** or **Update & Verify** if available.

3. **Verify**  
   The platform validates the account (e.g. name + IFSC + account number).  
   - **Verified** — Account is used for settlements.  
   - **Failed** — Correct details (name, IFSC, account number) and verify again.

You can add multiple accounts and set one as **primary**. Only **verified** accounts receive payouts.

---

## 5. Tier System & Commission

**What it is:** Warmpawz uses **tiers** (e.g. Bronze, Silver, Gold, Platinum). Each tier has:

- **Commission rate** — Percentage of each booking kept by the platform (e.g. 15% Bronze; lower for higher tiers).
- **Payout period** — How often settlements run (e.g. every 7 days).
- **Subscription cost** — Free tier (e.g. Bronze) has no fee; paid tiers may have monthly/yearly fees and lower commission.

**Where you see it:** Dashboard may show your current tier. **Finance** or **Tier** screens may show commission rate and **settlement breakup** (booking amount, platform commission, your net payout).

**Upgrading:** If available, you can upgrade (e.g. pay monthly/yearly or via deduction from settlements). Check **Finance** or **Tier** in the app.

**Clinic earnings:** For each completed, paid booking (in-clinic, at home, or tele), your clinic receives: **booking amount − platform commission**. Earnings are at **vendor (clinic)** level; how you distribute them internally (e.g. to doctors) is outside the platform.

---

## 6. Note: Staff Management Decommissioned

**Staff (doctors) management is no longer available in the platform.** The clinic operates as a **single vendor** for all bookings. You do not add or manage individual doctors or staff in the app; appointments are managed at the clinic level. Accept, complete, and prescribe from the clinic account. If your clinic has multiple doctors, you handle internal assignment offline; the platform does not show a Staff or Doctors menu for this.

---

## 7. Services: What They Are & How to Configure

**What a “service” is:** A bookable offering — e.g. “General Consultation”, “Vaccination”, “Tele Consultation”, “Home Visit”. Each has name, description, duration, price, and **service style(s)**.

**Service styles (vet clinic):** You can offer all three:

| Style      | Meaning |
|-----------|--------|
| **At center** | Customer comes to your clinic. You set clinic availability; bookings use clinic address. OTP is used to complete the visit. |
| **At home**   | Your clinic visits the customer’s location. **No start OTP** for vet; only **completion OTP** when finishing the visit. |
| **Tele**      | Video consultation. No OTP; you and the customer join a video call; you mark the appointment complete when done. |

**Where:** Dashboard → **Services** (or **Manage services**).

**How to add a service:**

1. Open **Services** → **Add service** or **Browse catalog**.
2. **From catalog:** Pick a template, set **price**, **duration**, and **service style** (at center / at home / tele). Enable and publish.
3. **Custom service:** Create name, description, duration, price, and select one or more styles (at center, at home, tele).
4. **Enable** the service.
5. **Publish** so it appears in customer search and booking.

**Enable vs Publish:** Same as solo: **Enable** = active for your clinic; **Publish** = visible to customers. Unpublished services are not bookable.

---

## 8. Packages

**What packages are:** Bundles of sessions or benefits (e.g. “5 consultations”, “Vaccination pack”). Customers buy once and use sessions when booking.

**Clinic advantage:** As a **business** vendor, you **can** create packages (unlike solo vets who are restricted).

**Where:** Dashboard → **Services** → **Packages** (or **Packages** in the menu).

**How to create a package:**

1. Open **Packages** → **Create package**.
2. Enter:
   - **Package name** (e.g. “5 General Consultations”).
   - **Package type** — e.g. **Session** (fixed number of sessions), **Combo** (bundle of services), **Subscription** or **Membership** (if supported), **Unlimited** (unlimited sessions in a period).
   - **Description**, **Original price** (optional), **Package price**.
   - **Validity** — e.g. 30, 60, 90 days.
   - **Usage** — Total sessions (e.g. 5) or **Unlimited**.
   - **Included services** — Which services can be consumed from this package.
   - **Benefits / terms** (if the form has these).
3. Save. The package becomes available to customers when they search or book; they can purchase it and then use sessions against it for the selected services.

**Package types (typical):**

- **Session** — Fixed number of sessions (e.g. 5 consultations) within a validity period.
- **Combo** — Bundle of different services at a combined price.
- **Subscription / Membership** — Recurring or membership-style access (if supported by the app).
- **Unlimited** — Unlimited sessions in a period (e.g. monthly).

Exact types depend on the platform; use the dropdown or help in the **Create package** screen.

---

## 9. Setting Your Availability (Advanced Availability)

The platform uses **Advanced Availability**: weekly schedule with multiple slots per day, breaks, and holidays. Follow these steps exactly.

**Where:** Dashboard → **Schedule** (opens the Advanced Availability screen).

---

### Step 1: Open Schedule

1. From the dashboard, go to **Schedule** (under Operations or main menu).
2. The **Advanced Availability** screen loads. You will see:
   - **Day tabs** at the top: Sun, Mon, Tue, Wed, Thu, Fri, Sat.
   - Below: the list of **time slots** for the selected day, plus **Breaks** and **Holidays** sections.

---

### Step 2: Add Time Slots for Each Working Day

1. **Select a day** by clicking its tab (e.g. Monday).
2. Click **Add slot** (or equivalent). A new slot appears with default times (e.g. 09:00–17:00).
3. **Set the time window:**
   - **Start time** and **End time** — e.g. 09:00 to 13:00, then add another slot 14:00 to 18:00.
   - **Do not overlap** two slots on the same day; the app will warn you. Adjust times so slots do not overlap each other or any break.
4. **Set service styles for this slot:** For a vet clinic you can select **At center**, **At home**, and/or **Tele**. Tick the styles you offer in this window.
5. **Lead time (optional):** You may see **Prep time (min)** for At center, **Travel time (min)** for At home, and **Setup time (min)** for Tele. Use these so the system does not book back-to-back without buffer.
6. **Enable the slot** — ensure the slot is enabled (default is on).
7. Repeat for **every day you work**. Use **Copy to all days** or **Copy to weekdays** to copy the current day’s slots to other days, then edit as needed.

---

### Step 3: Add Breaks (Optional)

1. Expand the **Breaks** section.
2. Click **Add break**.
3. Choose **day** (or “recurring” for the selected day every week), **start time**, **end time**, and **type** (e.g. lunch, tea, personal).
4. Ensure the break **does not overlap** any time slot on that day; the app will warn you if it does.
5. You can **Copy breaks to all days** or **Copy to weekdays** to reuse the same break pattern.

---

### Step 4: Add Holidays / Vacation (Optional)

1. Expand the **Holidays** section.
2. Click **Add holiday** (or Add vacation).
3. Enter **start date** and **end date**. Optionally set **type** (e.g. vacation, closed, personal) and **reason**.
4. On these dates, **no slots** are offered to customers.

---

### Step 5: Save

1. Click **Save All** (top right).
2. The app saves **slots**, **breaks**, and **holidays** in one go. You should see a success message (e.g. “Saved: X slots, Y breaks, Z holidays”).
3. If you see an error about **overlapping slots or breaks**, fix the overlapping time on the day mentioned, then save again.

---

**Go-live:** Until at least one day has at least one **saved** time slot, the go-live checklist item **“Set up your availability schedule”** will not be complete. Complete Step 1–5 and click **Save All**.

---

## 10. Going Live

When all four go-live items are complete (profile ≥80%, bank verified, at least one service, schedule set):

1. Open the **Go-Live Checklist** from the dashboard.
2. Confirm all items are complete.
3. Click **Go Live**.

Your clinic and published services become discoverable and bookable. You can still change profile, bank, staff, services, schedule, and packages after going live.

---

## 11. When an Appointment Is Received

**Where you see it:** Dashboard → **Bookings** (or **Appointments**). You may see **Today’s bookings** and **Pending**.

**Status flow:**

- **Pending** — New booking; customer has paid (or used a package). You must **Accept** or **Reject**.
- **Confirmed** — You accepted. Next: **Start** (at home) or join **Video call** (tele), or for at-center the customer comes to the clinic and you **Complete** with OTP.
- **In progress** — Session started (visit started or call ongoing).
- **Completed** — Appointment completed (OTP or mark complete for tele).
- **Cancelled** — Rejected or cancelled.

**When a new booking arrives:**

1. You get a **notification** (in-app or push).
2. Open **Bookings** and find the **Pending** appointment.
3. Open it to see: customer, pet, service, date/time, **address** (at home) or clinic (at center), **doctor** (if already assigned or to assign).
4. **Accept** or **Reject**. If you reject, provide a reason if asked. Accepting confirms the booking and notifies the customer.

---

## 12. Handling Appointments by Type

### At center (in-clinic)

- Customer comes to your **clinic address** at the booked time.
- **Start:** You may have a **Start** or check-in action (optional, app-dependent).
- **Complete:** When the visit is over, ask the customer for the **completion OTP** they received. Enter it in the app and tap **Complete**. Status → **Completed**; earnings and settlement flow apply.

### At home

- Your clinic (you or your team) goes to the customer’s **address**.
- **No start OTP** for at-home vet services. You can use **Start Travel** (optional) if you want the customer to see live location; no OTP is required to start the visit.
- **Complete:** After the visit, ask the customer for the **completion OTP** they received (SMS/app). Enter it and tap **Complete** → **Completed**.

### Tele (video)

- No OTP. You and the customer **join the video call** at the scheduled time (from the appointment or chat).
- After the call, **mark the appointment as completed**. Then add prescription or consultation summary as needed.

### Instant tele (if enabled for your clinic)

- Customer pays and is connected to an available vet without a fixed slot. When your clinic (or a doctor) is in the “available now” pool and gets the call, join the video and complete the consultation. **Mark completed** when done; add prescription/summary as needed.

**Summary:**

| Type      | Start                         | Complete                    |
|----------|--------------------------------|-----------------------------|
| At center| Optional check-in             | OTP → Complete              |
| At home  | Start Travel (optional, no OTP); no start OTP for vet | OTP → Complete              |
| Tele     | Join video call               | End call → Mark complete    |
| Instant  | Join video call               | End call → Mark complete    |

---

## 13. Customer Interaction: Chat & Video

**Chat:** From the appointment detail, open **Chat** (or **Messages**). Use it to:

- Confirm address (at home), time, or follow-up.
- Share instructions or prescription notes (in addition to the formal prescription).

**Video:** For **Tele** and **Instant** appointments, **Video call** is started from the appointment or chat. Join at the scheduled time (or when the instant call is assigned). Use in-call controls (mute, camera, end call). After ending the call, **mark the appointment completed** and add prescription/summary if needed.

---

## 14. Completing an Appointment

- **At center:** Enter the **completion OTP** from the customer → **Complete**.
- **At home:** Enter **completion OTP** → **Complete**.
- **Tele / Instant:** No OTP; tap **Complete** (or “Mark as completed”) after the video call.

Once **Completed** and payment is **paid** (or package/subscription used), the platform records **vendor_earnings** (clinic’s share after commission) and queues **settlement** to your verified bank account per your tier’s payout schedule.

---

## 15. Prescribing & Consultation Summary

**Who it’s for:** Vets (and optionally nutritionists). As a clinic, any doctor (or the clinic account) can add prescriptions and summaries for their bookings.

**When:** After (or during) a consultation, for that booking.

**Where:** From the **appointment detail** → **Prescription** or **Add consultation summary**.

**Prescription:**

- Add **medications** (name, dosage, frequency, duration, instructions), **diagnosis**, **general instructions**, **follow-up** (date/notes).
- **Save as draft** (edit later) or **Publish** (customer sees it; it may be used for pharmacy orders).

**Consultation summary (Vet summary):**

- **Diagnosis**, **notes**, **vitals**, **symptoms**, **medications**.
- **Draft** or **Publish**. Published summary is shared (e.g. in chat) and stored in history.

**Best practice:** Publish after the consultation so the customer has a clear record and can order medicines if the platform supports pharmacy flow.

---

## 16. Diagnostics, Pharmacy & Ambulance (If Enabled)

Your clinic role may have extra capabilities:

- **Diagnostics / Lab** — You can create diagnostic test offerings, receive orders, and (if supported) **assign staff** for sample collection or send results. Use **Medical** → **Diagnostics** (or **Lab**) to manage tests and orders.
- **Pharmacy** — If your clinic is also a pharmacy, you may see **Pharmacy** → **Orders** and **Inventory** to fulfill prescription orders and manage stock.
- **Ambulance / Emergency** — If enabled, you can manage ambulance services and emergency protocols. Use **Ambulance** or **Emergency** from the menu if available.

Exact menus depend on your role configuration; follow the in-app **Specialized** or **Medical** sections.

---

## 17. Settlements & Earnings

**Earnings:** For each **completed**, **paid** booking (at center, at home, or tele), the clinic’s share (booking amount − platform commission) is recorded and added to **pending payout**.

**Where:** Dashboard → **Finance** → **Earnings** and **Settlements**.

- **Earnings** — Per-booking breakdown.
- **Pending payout** — Total not yet transferred.
- **Settlements** — Batched payouts (e.g. weekly): pending → processing → completed (or failed).

Payouts go to your **verified** bank account. If a settlement fails, fix and re-verify the account; contact support if needed.

---

## 18. Settings & Day-to-Day

**Profile & facility:** Update business name, address, contact, description, and facility details from **Profile** or **Settings**.

**Bank:** Manage and verify bank accounts under **Finance** → **Bank Account**.

**Schedule:** Update clinic (and staff) availability and use **Vacation** / **Time off** to block dates.

**Services & packages:** Add, edit, enable/disable, publish services and packages under **Services** and **Packages**.

**Notifications:** Keep them on so you see new bookings and messages quickly.

**Support:** For verification, commission, payout, or technical issues, use in-app support or Warmpawz contact details.

---

*This guide is based on the Warmpawz platform behavior as implemented in the codebase. For the latest UI or policy changes, refer to in-app help or Warmpawz support.*
