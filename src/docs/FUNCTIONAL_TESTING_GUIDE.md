# Warmpawz E-Commerce End-to-End Functional Testing Guide

**Target Audience:** Functional QA Team (Freshers/Beginners)
**Objective:** To verify the complete lifecycle of the Warmpawz Marketplace, from a new vendor joining the platform to a customer receiving their order.
**Date:** January 27, 2025

---

## 🛑 Before You Start (Read This First)

### 1. The "Magic" Test Data
Our system handles test data intelligently. If you find empty screens (like no products or no orders), use these specific Inputs to force the system to show data.

| Field | Magic Input | What it does |
| :--- | :--- | :--- |
| **Seller ID / Login** | `seller_test` | Loads a fully populated Vendor Dashboard. |
| **Customer Phone** | `9876543210` | Logins as a rich customer profile with wallet balance. |
| **Tracking Number** | `TRK123456789` | Shows a successful delivery timeline. |
| **Product ID** | `test-product-id` | Loads a valid product detail page even if DB is empty. |

### 2. Your Role
You will play three different roles during this test:
1.  **The Vendor:** Selling pet products.
2.  **The Admin:** Approving products.
3.  **The Customer:** Buying products.

---

## 📦 Phase 1: Vendor Onboarding & Catalog Setup
**Role:** Vendor (Seller)

### Step 1: Access Vendor Portal & Sign Up
1.  Open the application.
2.  Navigate to the **"Become a Seller"** or **"Vendor Login"** page.
3.  **Action:** Enter a new phone number (e.g., `9988776655`) to start the sign-up process.
4.  **Verify OTP:** Enter any 6-digit code (e.g., `123456`) to verify.

### Step 2: Choose Vendor Role (Crucial Step)
1.  You will be presented with a **"Choose Your Role"** screen.
2.  **Action:** Select the card labeled **"Pet Product Seller"**.
    *   *Description says:* "Sell products manage inventory, create promotions".
    *   *Icon:* Retail/Store icon.
3.  **Continue:** Fill in the basic profile details (Store Name, Owner Name) if prompted.
4.  **Result:** You should land on the **Vendor Dashboard**.
    *   *Note:* If you want to skip this, Login with `seller_test` to see a pre-filled dashboard.

### Step 3: Add a New Product (Single Upload)
1.  Click on **"Products"** or **"Catalog"** in the sidebar.
2.  Click the **"Add New Product"** button.
3.  Fill in the form with the following details:
    *   **Name:** `Super Soft Dog Bed (Test)`
    *   **Category:** `Bedding`
    *   **Price:** `1500`
    *   **Stock:** `50`
    *   **Description:** `A comfortable bed for medium sized dogs.`
4.  **Upload Image:** Select any sample image from your computer.
5.  Click **"Submit Product"**.
6.  **Expected Result:** Success message "Product submitted for approval". The product status should show as **"Pending Approval"**.

### Step 4: Bulk Upload (Template Test)
1.  Navigate to **"Bulk Upload"** in the sidebar.
2.  Click **"Download Template"**.
3.  **Verify:** Open the downloaded CSV file. It should have headers: `name, sku, price, stock...`
4.  **Action:** (Optional) Upload the unmodified template back to see if the system accepts the format.
5.  **Expected Result:** "Upload Successful" message.

### Step 5: Manage Inventory
1.  Go to the **"Inventory"** tab.
2.  Find a product with low stock (or use the one you just created).
3.  Change the **Stock Quantity** from `50` to `55`.
4.  Click **"Save"** or **"Update"**.
5.  **Expected Result:** The stock number updates immediately without page reload.

---

## 👮 Phase 2: Admin Approval
**Role:** System Admin
*Note: In a real scenario, you would log out and log in as Admin. For testing, navigate to the Admin URL.*

### Step 6: Approve Pending Products
1.  Navigate to `/admin/dashboard`.
2.  Locate the **"Pending Approvals"** widget or section.
3.  **Verify:** You should see the `Super Soft Dog Bed (Test)` you created in Phase 1.
4.  Click **"Review"** or **"Approve"**.
5.  **Expected Result:** The product disappears from the Pending list and is now **Live** on the customer site.

---

## 🛒 Phase 3: The Customer Experience
**Role:** Shopper (Pet Owner)

### Step 7: Find the Product
1.  Go to the **Home Page** (Shop).
2.  **Search:** Type "Dog Bed" in the search bar.
3.  **Verify:** The product `Super Soft Dog Bed (Test)` appears in results.
4.  Click on the product card.

### Step 8: Add to Cart & Checkout
1.  On the Product Detail Page, set **Quantity** to `1`.
2.  Click **"Add to Cart"**.
3.  Click the **Cart Icon** (Top Right) to view cart.
4.  Click **"Checkout"**.

### Step 9: Enter Customer Details (Crucial Step)
1.  **Customer Phone:** Enter `9876543210` (This is the "Magic" number).
2.  **Shipping Address:** Enter `Flat 101, Test Plaza, MG Road`.
3.  **Payment Method:** Select `Cash on Delivery`.
4.  Click **"Place Order"**.
5.  **Record Data:** Note down the **Order ID** displayed on the success screen (e.g., `ORD-998877`).

---

## 🚚 Phase 4: Fulfillment & Tracking
**Role:** Vendor & Customer

### Step 10: Vendor Fulfills Order
1.  Navigate back to the **Vendor Dashboard** (`/seller/seller_test`).
2.  Go to **"Orders"**.
3.  **Verify:** You should see the new order `ORD-998877` at the top of the list with status **"Pending"**.
4.  **Action:** Click "Manage" or "Update Status".
5.  Change status to **"Shipped"**.
6.  (Optional) Enter Tracking Number: `TRK123456789`.
7.  Click **"Update"**.

### Step 11: Customer Tracks Order
1.  Go to the **"Track Order"** page (Footer link).
2.  Enter the Tracking Number: `TRK123456789`.
3.  Click **"Track"**.
4.  **Expected Result:** A timeline shows the package is "In Transit".

---

## 📊 Phase 5: Post-Test Validation

### Step 12: Verify Commissions
1.  Go to `/commission/vendor/seller_test`.
2.  **Check:** Ensure "Total Earnings" has increased based on the order you just placed.
    *   *Math Check:* (Order Value - 15% Commission) = Net Earnings.

### Step 13: Verify Customer Wallet
1.  Go to `/customer/profile/unified/9876543210`.
2.  Check **"Order History"** to confirm the new order is listed there.

---

## 🐛 Reporting Bugs
If any step fails:
1.  Take a screenshot.
2.  Note the **URL** where it happened.
3.  Note the **Input Data** you used.
4.  Check the **Console Logs** (Press F12 -> Console) for any red errors.
