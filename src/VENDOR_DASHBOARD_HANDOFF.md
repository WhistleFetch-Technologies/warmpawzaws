# Dynamic Vendor Configuration System - Handoff Document

## Overview
The vendor dashboard has been refactored to be fully dynamic based on the **Role Configuration System**. Features, navigation items, and widgets now conditionally render based on the `capabilities` array defined for the vendor's role.

## Architecture
1.  **Role Configuration (Admin):** Admins define roles with specific `capabilities` (e.g., `booking`, `inventory`, `gps_tracking`).
2.  **Data Injection (Server):** The `GET /vendor/dashboard/:vendorId` endpoint now fetches the associated role configuration and injects the `capabilities` array into the vendor response.
3.  **Dynamic Rendering (Frontend):** The `VendorDashboard` component checks these capabilities to toggle UI sections.

## Supported Capabilities

| Capability | UI Impact | Target Roles |
| :--- | :--- | :--- |
| `booking` | Shows "Today's Schedule", "Your Services", and appointment stats. | Vet, Groomer, Walker |
| `orders` | Shows "Orders" stat card, "Orders" quick action. | Pet Store, Seller |
| `catalog` | Shows "Your Products", "Inventory" quick action. | Pet Store, Pharmacy |
| `inventory` | Shows "Inventory" quick action. | Pet Store, Pharmacy |
| `chat` | Enables Chat icon in header and "Chat" button on appointment cards. | All |
| `tele` | Shows "Consultations" stats and filter for Tele-consultations. | Vet, Nutritionist |
| `gps_tracking` | Shows "Live Tracking" quick action button. | Walker, Ambulance |
| `medical_records` | Shows "Records" quick action button. | Vet, Clinic |
| `staff_management` | Shows "Manage Staff" quick action button. | Clinics, Large Centers |
| `photo_updates` | Enables photo upload features (future). | Boarding, Grooming |

## API Endpoints

### 1. Vendor Dashboard (Enhanced)
**GET** `/make-server-3dd53475/vendor/dashboard/:vendorId`
*   **Response:**
    ```json
    {
      "success": true,
      "vendor": {
        "vendorId": "...",
        "capabilities": ["booking", "chat", "medical_records"], // Injected from Role Config
        ...
      },
      "stats": { ... }
    }
    ```

### 2. Role Configuration (New CRUD)
*   **GET** `/make-server-3dd53475/config/roles` - Returns all full role objects.
*   **POST** `/make-server-3dd53475/config/roles` - Create a new role.
*   **PUT** `/make-server-3dd53475/config/roles/:roleId` - Update a role.
*   **POST** `/make-server-3dd53475/config/roles/seed` - Seed default roles.

## Validation & Testing

### Scenario A: Veterinarian
*   **Role:** `veterinarian`
*   **Capabilities:** `booking`, `tele`, `prescription`, `medical_records`, `chat`
*   **Expected UI:**
    *   ✅ "Today's Schedule" visible.
    *   ✅ "Records" button visible.
    *   ✅ "Consultations" stat visible.
    *   ❌ "Inventory" button HIDDEN.
    *   ❌ "Orders" button HIDDEN.

### Scenario B: Pet Store / Seller
*   **Role:** `pet_store`
*   **Capabilities:** `orders`, `catalog`, `inventory`, `delivery`
*   **Expected UI:**
    *   ✅ "Inventory" button visible.
    *   ✅ "Orders" button visible.
    *   ✅ "Your Products" section visible.
    *   ❌ "Today's Schedule" HIDDEN (unless they also offer grooming).
    *   ❌ "Records" button HIDDEN.

### Scenario C: Dog Walker
*   **Role:** `pet_walker`
*   **Capabilities:** `booking`, `gps_tracking`, `photo_updates`
*   **Expected UI:**
    *   ✅ "Today's Schedule" visible.
    *   ✅ "Live Tracking" button visible.
    *   ❌ "Inventory" HIDDEN.

## Next Steps
1.  **GPS Tracking Implementation:** The `gps_tracking` capability currently shows a button. The actual map tracking view needs to be connected to the navigation handler `onNavigateToLiveTracking`.
2.  **Catalog vs. Services:** Ensure the "Manage Services" screen adapts its fields based on `catalog` (SKU, stock) vs `booking` (Duration, Slot).
