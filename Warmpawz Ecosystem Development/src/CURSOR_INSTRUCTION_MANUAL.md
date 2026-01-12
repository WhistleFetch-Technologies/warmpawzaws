# Warmpawz Project: Cursor AI Implementation Manual

**Role:** Senior Frontend Architect & UI Developer  
**Objective:** Transform the current repository into a production-ready, pixel-perfect React application backed by an AWS Serverless architecture structure.  
**Strict Constraint:** Follow the **Phased Deployment Strategy**. Do not proceed to the next phase until the current phase passes all checks in `VERIFICATION_GUIDE.md`.

---

## 📂 Reference Files (The Source of Truth)

You have three master documents in the root directory. **Read these before writing a single line of code:**

1.  **`CUSTOMER_APP_MASTER_GUIDE.md`**: The blueprint for the Consumer App, flows, and buying experience.
2.  **`VENDOR_ADMIN_MASTER_GUIDE.md`**: The blueprint for the 20-Role Vendor Dashboard, Management Modules, and Admin logic.
3.  **`VERIFICATION_GUIDE.md`**: Your QA Checklist. This is the definition of "Done".
4.  **`Guidelines.md`**: The Branding, Typography, and Color System.

## ♻️ Code Reuse & Enhancement Strategy (CRITICAL)

**Strict Rule: Do NOT create new files if an equivalent already exists.**

1.  **Check First:** Before implementing a screen (e.g., `VetServicesLanding`), check the `/components` directory. It likely exists.
2.  **Enhance, Don't Replace:**
    *   **Scenario:** You need to add a "Video Call" button to `VetServicesLanding.tsx`.
    *   **Action:** Open the *existing* file, keep the existing layout/imports, and *insert* the button using Tailwind classes that match the existing style.
    *   **Prohibited:** Deleting the file and writing a new one from scratch (unless it is completely broken/empty).
3.  **Endpoint reuse:**
    *   Check `/lib/mockAPI.ts` and `/lib/mockDataExtended.ts`. If an endpoint/data structure exists, USE IT.
    *   Do not create parallel data structures. Extend the existing ones if a field is missing.

---

## 🏗️ Technical Architecture (AWS Serverless Ready)

Although we are using **Mock Data** for the UI, you must structure the code to connect to AWS Lambda/Cognito easily.

*   **Frontend:** React (Vite), Tailwind CSS v4, Lucide React, Shadcn UI.
*   **Auth:** Design for AWS Cognito (Login -> MFA/OTP -> Session Token).
*   **API Layer:**
    *   Do NOT put `fetch` calls inside UI components.
    *   Create a `services/` folder.
    *   **Current State:** `services/bookingService.ts` calls `MockAPI`.
    *   **Target State:** `services/bookingService.ts` will call `AWS_API_GATEWAY_URL/booking`.
    *   **Instruction:** Write components to call the Service Layer, not the Data Layer directly.

---

## 📅 Phased Implementation Plan

### 🛑 PHASE 1: Foundation & Authentication
**Goal:** Global layouts, responsive shell, and secure entry.

1.  **Audit & Enhance:**
    *   **Files:** `CustomerAuth.tsx`, `CustomerOnboarding.tsx`, `AppLayout.tsx` (or `CustomerHomeWrapper.tsx`).
    *   **Action:** Open these files. Apply `Guidelines.md` styling (Orange/Pink gradients) if missing. Ensure responsive mobile nav is present.
2.  **Auth Wiring:**
    *   **Endpoint:** Use existing `MockAPI.auth` methods.
    *   **UI:** Ensure "Send OTP" triggers the existing handler. Do not rewrite the logic if it works; just polish the UI.
3.  **Verification:**
    *   Check `VERIFICATION_GUIDE.md` -> "Global UI & Integrations".

### 🛑 PHASE 2: Customer Experience (The Core)
**Goal:** Discovery, Search, and Booking for all service types.

1.  **Home & Search:**
    *   **Files:** `CustomerHomeComplete.tsx`, `EnhancedSearchBar.tsx`.
    *   **Action:** These files are already heavy with logic. **Do not rewrite.** Verify they connect to the new `mockDataExtended.ts` via `MockAPI`. Fix any "undefined" errors.
2.  **Service Groups (Enhance Existing):**
    *   **Medical:** `VetServicesLanding.tsx` exists. Enhance it with the Doctor List.
    *   **Hospitality:** `PetCafeListingZomatoStyle.tsx` exists. Polish the "Book Table" modal.
    *   **Resort:** `ResortServicesLanding.tsx` exists. Connect the "Check Availability" button to `MockAPI`.
    *   **Emergency:** `AmbulanceSOS.tsx` exists. Verify the Map component renders.
3.  **E-Commerce (Refine):**
    *   **Files:** `ShopDashboard.tsx`, `CartSheet.tsx`, `CheckoutPage.tsx`.
    *   **Action:** Ensure `CheckoutPage.tsx` has the GST calculation logic added to the *existing* structure.
4.  **Verification:**
    *   Run every check in `VERIFICATION_GUIDE.md`.

### 🛑 PHASE 3: Vendor Ecosystem (The Complexity)
**Goal:** Dynamic dashboards for 20 distinct roles.

1.  **Onboarding (Enhance):**
    *   **File:** `EnhancedVendorOnboarding.tsx`.
    *   **Action:** Ensure the "Role Selection" dropdown includes all 20 roles from `MOCK_VENDOR_ROLES`.
2.  **Core Modules (Reuse):**
    *   **Files:** `VendorServiceManagementComplete.tsx`, `StaffManagement.tsx`, `SettlementDashboardEnhanced.tsx`.
    *   **Action:** These are solid. Ensure they read `vendor.role_id` to show/hide relevant fields (e.g., Hide "Home Service Radius" for a Cafe).
3.  **Role-Specific UIs (Fill Gaps):**
    *   **Cafe:** `VendorCafeMenuManagement.tsx` (Check if exists, else create).
    *   **Resort:** `BoardingRoomManager.tsx` (Check if exists, else create).
4.  **Verification:**
    *   Run `VERIFICATION_GUIDE.md` -> "Vendor App Verification".

### 🛑 PHASE 4: Admin & Integrations UI
**Goal:** Governance and Third-Party Simulation.

1.  **Governance (Enhance):**
    *   **File:** `VendorPolicyManagement.tsx`.
    *   **Action:** Add the UI for "Commission Tier" display if missing.
2.  **Integrations (Polishing):**
    *   **Maps:** Check `RadarProviderMap.tsx`. Ensure it handles empty states gracefully.
    *   **Payment:** Check `WalletPage.tsx`. Ensure the "Top Up" modal looks professional.
3.  **Verification:**
    *   Run `VERIFICATION_GUIDE.md` -> "Integration Simulation Checklist".

---

## 🤖 Developer Instructions (How to work)

1.  **Check Existing Code First:**
    *   Before starting *any* task, search the `/components` folder for the filename mentioned in the Master Guide.
    *   **If it exists:** Read it. Understand it. Polish it.
    *   **If it is missing:** Only then create a new file.
2.  **Data Wiring:**
    *   Import data types from `/types`.
    *   Use `MockAPI` methods for logic.
3.  **UI Fidelity:**
    *   Do not invent styles. Use the `Guidelines.md` tokens.
4.  **Stop & Verify:**
    *   After completing a module, ask yourself: "Does this pass the Verification Guide?"

---

## 🚀 Final Handoff Note
This repository is the frontend for a scalable AWS Serverless platform. While the backend logic is currently simulated via `MockAPI`, the **UI Components**, **Routing**, **State Management**, and **Service Layers** must be production-ready code.

**Start with Phase 1.**
