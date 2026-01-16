# Onboarding to Settings Migration

## Overview
Moved bank account details, emergency contacts, service radius, and other configuration fields from vendor onboarding to vendor dashboard settings. This simplifies onboarding and allows vendors to configure these details after activation.

## Changes Made

### 1. Backend Changes

#### `backend/lambda/src/endpoints/vendor-onboarding.ts`
- **Removed**: `banking_information` section from onboarding form schema
- **Removed**: Emergency contact fields from walker onboarding (moved to settings)
- **Note**: Banking information is now handled in vendor dashboard settings

#### `backend/lambda/src/endpoints/vendor-profile.ts`
- **Added**: `GET /vendor/:vendorId/bank-account` - Get bank account details
- **Added**: `POST /vendor/:vendorId/bank-account` - Create/update bank account
- **Added**: `POST /vendor/:vendorId/bank-account/verify` - Request verification
- **Added**: `POST /vendor/:vendorId/bank-account/document` - Upload verification documents
- **Added**: `GET /vendor/:vendorId/settings` - Get general settings
- **Added**: `PUT /vendor/:vendorId/settings` - Update general settings

### 2. Frontend Changes

#### New Components

**`apps/vendor-web/components/vendor/VendorSettingsScreen.tsx`**
- Main settings screen with tabs for General and Payment settings
- Navigation between different settings sections

**`apps/vendor-web/components/vendor/VendorPaymentSettings.tsx`**
- Bank account form with validation
- IFSC code validation
- Account number validation (9-18 digits)
- Verification status display
- Document upload (cancelled cheque, bank statement)
- Verification request flow

**`apps/vendor-web/components/vendor/VendorGeneralSettings.tsx`**
- Service radius configuration
- Emergency contact management
- Walker-specific settings (max dogs per walk, walk durations)
- Role-based field visibility

#### Updated Components

**`apps/vendor-web/components/vendor/VendorDashboard.tsx`**
- Updated settings tab to use `VendorSettingsScreen`
- Integrated both payment and general settings

### 3. Database Schema

The following fields should exist in the `vendors` table:
- `service_radius` (numeric) - Service radius in kilometers
- `emergency_contact` (jsonb) - Emergency contact information
- `max_dogs_per_walk` (integer) - For walkers only
- `walk_durations` (text[]) - Array of walk durations offered
- `other_config` (jsonb) - Additional configuration

The `vendor_bank_details` table already exists with:
- `account_holder_name`
- `account_number`
- `ifsc_code`
- `bank_name`
- `branch_name`
- `is_verified`
- `verified_at`
- `verified_by`

## Migration Notes

### For Existing Vendors
1. Existing vendors who completed onboarding with bank details will need to re-enter them in settings
2. Emergency contacts for walkers need to be added in settings
3. Service radius and other configs can be set post-onboarding

### For New Vendors
1. Onboarding is now simplified - only essential business and location information
2. Bank account setup happens in Settings > Payment & Payouts
3. Service configuration happens in Settings > General

## Center Profile for Facilities

The `CenterProfileManager` component is available for:
- **Clinics** (veterinarian with at_center service style)
- **Cafes** (pet_cafe role)
- **Resorts** (pet_resort role)
- **Boarding** (pet_boarder role)

These vendors can access Center Profile from their dashboard to configure:
- Operating hours
- Amenities
- Photos
- Specializations
- Emergency services

## Testing Checklist

- [ ] Vendor can access Settings from dashboard
- [ ] Bank account can be added in Payment settings
- [ ] IFSC validation works correctly
- [ ] Verification documents can be uploaded
- [ ] General settings can be saved (service radius, emergency contact)
- [ ] Walker-specific settings appear only for walkers
- [ ] Center Profile accessible for clinic/cafe/resort/boarding
- [ ] Settings persist after page refresh
- [ ] Error handling works for invalid inputs

## API Endpoints

### Bank Account
- `GET /vendor/:vendorId/bank-account` - Get bank account
- `POST /vendor/:vendorId/bank-account` - Save bank account
- `POST /vendor/:vendorId/bank-account/verify` - Request verification
- `POST /vendor/:vendorId/bank-account/document` - Upload document

### Settings
- `GET /vendor/:vendorId/settings` - Get settings
- `PUT /vendor/:vendorId/settings` - Update settings

## Next Steps

1. Add database migration if columns don't exist
2. Test bank account verification workflow
3. Add admin panel for bank account verification
4. Add notifications for verification status changes
5. Update onboarding completion logic to not require bank account
