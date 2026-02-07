# Pharmacy Flow – Where to Order & How Navigation Works

## Customer app: How to get to pharmacy order flow

1. **Home → Pharmacy → Order Medicine**
   - Open the **customer app** and go to **Home** (main dashboard).
   - In the services grid, tap the **Pharmacy** tile (red pill icon, label “Pharmacy”).
   - You land on **Pharmacy Services** (PharmacyServicesLanding).
   - In the horizontal cards, find the blue **“Order Medicine”** card (Prescription → Address → 5/10/20 km → Pharmacy → Pay → Track).
   - Tap **“Order Medicine”**.
   - You are now in **PharmacyOrderFlow**: prescription/address → create order → broadcast (5/10/20 km) → pharmacy accept → invoice → pay → track → OTP.

2. **Alternative: My Booking → prescription → Order medicine**
   - Go to **My Bookings** (or “Bookings” from home).
   - Open a **vet appointment** that has a prescription.
   - In the booking detail, use **“Order medicine”** (or prescription list → Order medicine).
   - That opens the same **PharmacyOrderFlow** (with prescription/booking context when supported).

**Customer flow summary:**  
Home → **Pharmacy** tile → **Order Medicine** button → prescription/address → place order → wait for pharmacy → approve invoice & pay → track → OTP.

---

## Vendor app: How to receive and manage pharmacy orders

1. **Dashboard → Orders**
   - Log in to the **vendor app** as a **pharmacy** vendor (role `pharmacy` or `pet_pharmacy`).
   - On the **dashboard** (SoloProviderDashboard or VendorDashboard), you see an **“Orders”** button (orange, clipboard icon) when the vendor is detected as pharmacy.
   - Tap **“Orders”**.
   - You are taken to **`/pharmacy/orders`** → **PharmacyOrderDashboard**.

2. **Direct URL**
   - You can also open **`/pharmacy/orders`** directly (e.g. after bookmark or refresh).
   - The page reads `vendorId` (and optional `vendorName`) from **localStorage** (set on login). If `vendorId` is missing, it tries **`vendorData`** in localStorage so refresh still works.

**Vendor dashboard (PharmacyOrderDashboard):**
- **Incoming** tab: Orders broadcast to you (status `broadcasting`). For each: **Accept** or **Reject**. On Accept, you can open the **invoice modal**, set item prices, and **Generate invoice**.
- **Active** tab: Accepted orders (invoice_generated, payment_confirmed, preparing, dispatched). You can dispatch and manage.
- **Completed** tab: Delivered orders.

**Vendor flow summary:**  
Login → Dashboard → **Orders** → **Incoming** → Accept order → Fill invoice (items/prices) → **Generate invoice** → Customer gets invoice → Customer pays → Order moves to Active → Dispatch/track as needed.

---

## Implementation details

| App        | Entry                      | Route / screen           | Component / page                |
|-----------|----------------------------|---------------------------|---------------------------------|
| Customer  | Home → Pharmacy tile       | screen `pharmacy`         | PharmacyServicesLanding        |
| Customer  | Pharmacy → Order Medicine  | screen `pharmacy_order_flow` | PharmacyOrderFlow (specialized) |
| Vendor    | Dashboard → Orders         | `/pharmacy/orders`        | app/pharmacy/orders/page.tsx → PharmacyOrderDashboard |
| Vendor    | Direct URL                 | `/pharmacy/orders`        | Same; vendorId from localStorage or vendorData        |

**Customer:** Pharmacy is always shown in the home services grid (merged in if the API omits it).  
**Vendor:** Pharmacy vendors see the Orders button; `vendorId` and `vendorName` are set in localStorage on login (VendorAuth, VendorApp, auth page) so `/pharmacy/orders` loads correctly.
