# Jio True Connect – SMS template guide for Warmpawz

This guide walks you through registering all Warmpawz transactional SMS templates on **Jio True Connect** so they work with your approved header and AWS SNS (Jio as SMS vendor).

**Approved SMS header (Sender ID):** **WARMPZ** — use this for every template in Jio.  
**Goal:** Register one content template per message type, then send the **exact** approved text via SNS with variables replaced.

---

## 0. Warmpawz apps and SMS links (Capacitor)

- **Vendor app** and **Customer app** are built as **mobile apps (iOS & Android)** using **Capacitor**, with the **vendor-web** and **customer-web** codebases as the source. Those web projects are not public-facing sites; they are used to feed the UI and logic into the Capacitor framework for building the native apps.
- **SMS links (`{#url#}`)** in templates must point to **app deep links / universal links** that open the **Capacitor apps** (e.g. `https://app.warmpawz.com/booking/...` or your configured app link domain). Do **not** use internal vendor-web or customer-web build URLs in SMS; those are for Capacitor builds only, not for sharing in messages.
- When whitelisting URLs in Jio CTA, whitelist the **app link domain and paths** that your customer and vendor **mobile apps** use (e.g. booking, track, receipt, review, vendor dashboard). Keep vendor-web and customer-web URLs out of SMS and CTA; they remain internal to your build pipeline.

---

## 1. Jio True Connect – Quick reference

- **Portal:** https://trueconnect.jio.com (log in with your PE credentials).
- **Variable tags (use exactly as shown):**
  - `{#number#}` – Numbers, amounts, OTP (min 1 – max 30 chars). Use for: OTP, ₹ amount, numeric IDs.
  - `{#url#}` – Website URL (must be CTA whitelisted). Use for: booking/track/reschedule/cancel/receipt links.
  - `{#alphanumeric#}` – Letters/numbers (min 1 – max 40 chars). Use for: booking ID, names, date, time, service name.
  - `{#cbn#}` – Callback number (CTA registered). Use only if you need a click-to-call number.
  - `{#email#}` – Email. Use only if you include email in a template.

**Rules:**

- **Header:** Use approved sender ID **WARMPZ** for all Warmpawz templates.
- Every template must contain your **brand name** (e.g. **Warmpawz**).
- At send time, the final SMS body must **exactly match** the approved template (only the parts inside the tags change).
- Use **Transactional** or **Service Implicit** type for OTP, booking, payment, cancellation, refund, reschedule, vendor actions, settlement.

---

## 2. Step-by-step: Register one template

1. Log in at https://trueconnect.jio.com (no credentials shared here; you use your own).
2. Go to **Templates** → **Content Template Registration** (or equivalent – “Message Content” / “Content Template”).
3. For each template below:
   - **Template name:** Use the exact name from the table (e.g. `Warmpawz OTP Login`).
   - **Type of communication:** Transactional / Service Implicit (as per your PE registration).
   - **Template type:** SMS.
   - **Select your approved header (Sender ID):** **WARMPZ**.
   - **Message content:** Copy the “Message content” from the table and paste as-is (including `{#number#}`, `{#url#}`, `{#alphanumeric#}`, etc.).
   - **Preview & sample content:** Fill sample values for each tag to see the final message (e.g. OTP `123456`, URL = your **app deep-link** domain used by the Capacitor apps, e.g. `https://app.warmpawz.com/booking/abc123`, Booking ID `aaf329f5`). Do not use vendor-web or customer-web deploy URLs here—only the app link domain that opens the mobile apps.
   - Submit and complete any email/SMS verification Jio asks for.
4. After approval, send SMS via AWS SNS using the **exact** approved text, replacing only the variables with real values (same format as tag type: number, url, alphanumeric).

---

## 3. Warmpawz templates – Copy-paste into Jio

Use these **exactly** in “Message content” with header **WARMPZ** selected. Replace the placeholders in brackets when sending via SNS; in Jio you only register the text with the `{#...}#}` tags.

### 3.1 OTP

| Template name (use in Jio) | Message content (copy exactly) |
|---------------------------|--------------------------------|
| Warmpawz OTP Login | Warmpawz: Your OTP is {#number#}. Valid for 5 minutes. Do not share. |

**When sending:** Replace `{#number#}` with the 6-digit OTP.

---

### 3.2 Booking – Customer

| Template name (use in Jio) | Message content (copy exactly) |
|---------------------------|--------------------------------|
| Warmpawz Booking Confirmed | Warmpawz: Your booking {#alphanumeric#} for {#alphanumeric#} on {#alphanumeric#} at {#alphanumeric#} is confirmed. Details: {#url#} |
| Warmpawz Booking Rescheduled | Warmpawz: Your booking {#alphanumeric#} has been rescheduled to {#alphanumeric#} at {#alphanumeric#}. Details: {#url#} |
| Warmpawz Booking Cancelled | Warmpawz: Your booking {#alphanumeric#} has been cancelled. Refund of Rs. {#number#} will be processed in 5-7 days. {#url#} |
| Warmpawz Payment Received | Warmpawz: Payment of Rs. {#number#} received for booking {#alphanumeric#}. Receipt: {#url#} |
| Warmpawz Staff Assigned | Warmpawz: {#alphanumeric#} has been assigned to your booking {#alphanumeric#}. Track: {#url#} |
| Warmpawz Provider En Route | Warmpawz: {#alphanumeric#} is on the way for your booking. Track: {#url#} |
| Warmpawz Provider Arrived OTP | Warmpawz: {#alphanumeric#} has arrived. OTP for verification: {#number#}. Do not share. |
| Warmpawz Service Completed | Warmpawz: Service completed for {#alphanumeric#}. OTP: {#number#}. Rate: {#url#} |
| Warmpawz Refund Processed | Warmpawz: Refund of Rs. {#number#} for booking {#alphanumeric#} has been processed. {#url#} |
| Warmpawz Review Request | Warmpawz: How was your experience? Share feedback: {#url#} |

**Variable mapping (for your backend):**

- 1st `{#alphanumeric#}`: booking ID (short code, e.g. first 8 chars of UUID).
- 2nd `{#alphanumeric#}`: service name (truncate to 40 chars) or date.
- 3rd `{#alphanumeric#}`: date (e.g. 05-Feb-2026) or time (e.g. 10:30 AM).
- `{#number#}`: OTP or amount (no “Rs.” inside the tag).
- `{#url#}`: CTA-whitelisted **app deep link** (e.g. your app link domain + `/booking/xxx`, `/track/xxx`, `/receipt/xxx`, `/review/xxx`) that opens the **customer** Capacitor app on iOS/Android.

---

### 3.3 Vendor – Booking notifications

| Template name (use in Jio) | Message content (copy exactly) |
|---------------------------|--------------------------------|
| Warmpawz Vendor New Booking | Warmpawz: New booking {#alphanumeric#} – {#alphanumeric#} on {#alphanumeric#} at {#alphanumeric#}. View: {#url#} |
| Warmpawz Vendor Booking Rescheduled | Warmpawz: Booking {#alphanumeric#} rescheduled to {#alphanumeric#} at {#alphanumeric#}. View: {#url#} |
| Warmpawz Vendor Booking Cancelled | Warmpawz: Booking {#alphanumeric#} has been cancelled by customer. View: {#url#} |
| Warmpawz Vendor Customer More Info | Warmpawz: Customer requested more info for booking {#alphanumeric#}. Reply: {#url#} |

**Variable mapping:**  
- `{#alphanumeric#}`: booking ID, service name, date, time (each &lt; 40 chars).  
- `{#url#}`: **Vendor Capacitor app** deep link (whitelisted) to booking/dashboard—e.g. app link domain + path that opens the vendor mobile app. Not the internal vendor-web URL.

---

### 3.4 Vendor – Approval / rejection

| Template name (use in Jio) | Message content (copy exactly) |
|---------------------------|--------------------------------|
| Warmpawz Vendor Application Approved | Warmpawz: Your vendor application has been approved. Login: {#url#} |
| Warmpawz Vendor Application Rejected | Warmpawz: Your vendor application was not approved. Reason: {#alphanumeric#}. Contact support: {#url#} |
| Warmpawz Vendor Application More Info | Warmpawz: We need more info for your application. Submit: {#url#} |

---

### 3.5 Settlement & payments

| Template name (use in Jio) | Message content (copy exactly) |
|---------------------------|--------------------------------|
| Warmpawz Settlement Credit | Warmpawz: Rs. {#number#} has been credited to your account for settlement period {#alphanumeric#}. Details: {#url#} |
| Warmpawz Payment Success | Warmpawz: Payment of Rs. {#number#} received for order {#alphanumeric#}. Receipt: {#url#} |

**Variable mapping:**  
- `{#number#}`: amount.  
- `{#alphanumeric#}`: order/booking ID or period label (e.g. 01-Feb-2026 to 07-Feb-2026).  
- `{#url#}`: CTA-whitelisted **app deep link** that opens the **vendor Capacitor app** (e.g. statement/receipt) or **customer Capacitor app** (receipt). Not vendor-web or customer-web URLs.

---

### 3.6 Delivery / order (e.g. pharmacy, home delivery)

| Template name (use in Jio) | Message content (copy exactly) |
|---------------------------|--------------------------------|
| Warmpawz Delivery OTP | Warmpawz: Your delivery OTP is {#number#}. Share with delivery partner. Order: {#alphanumeric#} |
| Warmpawz Order Confirmed | Warmpawz: Order {#alphanumeric#} is confirmed. Track: {#url#} |
| Warmpawz Order Dispatched | Warmpawz: Order {#alphanumeric#} is on the way. Expected by {#alphanumeric#}. Track: {#url#} |
| Warmpawz Order Delivered | Warmpawz: Order {#alphanumeric#} has been delivered. Thank you for choosing Warmpawz. |
| Warmpawz Pharmacy Accepted | Warmpawz: {#alphanumeric#} has accepted your order {#alphanumeric#}. Track: {#url#} |
| Warmpawz Pharmacy Rejected | Warmpawz: Order {#alphanumeric#} was not accepted. We are finding another partner. {#url#} |

---

## 4. CTA and URL whitelisting

- Any link you put in `{#url#}` must be **whitelisted** in your Jio CTA (Content Template Approval).
- **Vendor-web and customer-web** are not public; they are the source for **Capacitor** (iOS/Android). SMS links must **not** point to those web deploy URLs. Use your **app deep-link / universal link domain** (e.g. `https://app.warmpawz.com` or your configured domain for the Capacitor apps) and whitelist path patterns such as `/booking/*`, `/track/*`, `/receipt/*`, `/review/*`, `/vendor/*`, etc., so that when users tap the link they open the **customer app** or **vendor app** on the device.
- When registering the template in Jio, use a **sample** URL in that same app-link format (e.g. `https://app.warmpawz.com/booking/aaf329f5`) so the approved content matches what you will send from the backend.

---

## 5. After registration – Using with AWS SNS

- Your Lambda/SNS integration should **not** send free-form text. It should send the **exact** approved body for that template, with only the variables replaced.
- Variable rules:
  - `{#number#}` → only digits (and optionally one decimal point for amounts), max 30 chars.
  - `{#url#}` → only whitelisted URLs.
  - `{#alphanumeric#}` → letters/numbers/spaces, max 40 chars per variable; truncate names/dates if needed.
- A mapping of **Warmpawz event → Jio template text** is in `config/sms-templates-jio.json` so your backend can pick the right string and substitute variables before calling SNS.

---

## 6. Checklist

- [ ] All templates created in Jio with the **exact** message content above.
- [ ] Approved header **WARMPZ** selected for each template.
- [ ] Preview/sample content filled and submitted; verification done.
- [ ] URLs in `{#url#}` whitelisted in CTA.
- [ ] Backend uses only approved template strings and replaces tags with correct types (number, url, alphanumeric).

You do **not** need to share User ID or password; use your own Jio True Connect login to register these. The template set is already in `config/sms-templates-jio.json` for backend/SNS integration. When sending SMS, use **WARMPZ** as the sender ID and only **app deep-link** URLs (Capacitor app domain) in `{#url#}`; keep vendor-web and customer-web URLs out of SMS.
