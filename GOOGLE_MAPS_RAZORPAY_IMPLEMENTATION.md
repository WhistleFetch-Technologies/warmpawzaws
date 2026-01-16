# Google Maps & Razorpay Marketplace Implementation Summary

## Overview
This document summarizes the implementation of Google Maps address autocomplete integration and Razorpay marketplace mode with automatic settlement based on vendor tiers.

## ✅ Implemented Features

### 1. Google Maps Address Autocomplete

#### Web Components
- **Location**: `packages/ui/src/address-autocomplete.tsx`
- **Features**:
  - Google Places Autocomplete integration
  - Automatic parsing of address components (street, city, state, pincode, landmark)
  - Coordinates extraction (lat/lng)
  - Auto-population of related fields
  - Debounced API calls for performance
  - Country restriction to India

#### Mobile Components
- **Location**: `apps/WarmpawzCustomer/src/components/AddressAutocomplete.tsx`
- **Features**:
  - React Native implementation using Google Places API
  - Autocomplete suggestions dropdown
  - Place details fetching for complete address parsing
  - Same auto-population functionality as web

#### Integration Points
1. **Vendor Onboarding** (`apps/vendor-web/components/vendor/VendorOnboardingFlow.tsx`)
   - Address field uses autocomplete
   - Auto-fills city, state, pincode, landmark

2. **Customer Onboarding** (`apps/WarmpawzCustomer/src/screens/onboarding/CustomerUserProfileScreen.tsx`)
   - Address field with autocomplete
   - Auto-fills pincode

3. **Add Address Screen** (`apps/WarmpawzCustomer/src/screens/settings/AddAddressScreen.tsx`)
   - Full address form with autocomplete
   - Auto-fills all address components

4. **Create Booking** (`apps/customer-web/components/customer/CreateBookingPage.tsx`)
   - Service address with autocomplete
   - Auto-fills city, state, pincode

### 2. Razorpay Marketplace Mode Integration

#### Order Creation with Marketplace Mode
- **Location**: `backend/lambda/src/endpoints/razorpay.ts`
- **Features**:
  - Automatic transfer configuration in order creation
  - Vendor share calculation based on tier commission
  - Commission deduction at payment time
  - Support for vendors with linked accounts

#### Automatic Settlement
- **Trigger Points**:
  1. Payment verification (`VerifyPaymentHandler`)
  2. Webhook payment captured event (`RazorpayWebhookHandler`)
  
- **Process**:
  1. Check if vendor has linked account and verified bank
  2. Queue settlement to SQS
  3. Settlement processor calculates commission from vendor tier
  4. Creates Razorpay Route transfer
  5. Updates settlement records

#### Vendor Tier Commission Calculation
- **Location**: `backend/lambda/src/endpoints/razorpay.ts` (helper function)
- **Logic**:
  1. Check active `vendor_tier_subscriptions` first
  2. Fallback to vendor's current tier from `vendors` table
  3. Query `vendor_tiers` table for commission rate
  4. Use default tier (Bronze) if no tier found
  5. Default commission: 15% if all else fails

#### Settlement Handler Updates
- **Location**: `backend/lambda/src/endpoints/razorpay-settlements.ts`
- **Changes**:
  - Updated `getTierCommission()` to use database queries
  - Removed hardcoded tier configuration
  - Proper tier lookup from `vendor_tiers` table
  - Support for tier subscriptions

## 📋 Configuration Required

### Environment Variables
1. **Google Maps API Key**:
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (frontend)
   - `GOOGLE_MAPS_API_KEY` (backend/mobile)
   - Enable Places API in Google Cloud Console

2. **Razorpay Configuration**:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`
   - Enable Marketplace mode in Razorpay dashboard

### Database Setup
- Ensure `vendor_tiers` table exists with commission rates
- Ensure `vendor_tier_subscriptions` table exists
- Ensure vendors have `razorpay_account_id` and `bank_verified` fields

## 🔍 Key Implementation Details

### Address Autocomplete Flow
1. User types in address field
2. Google Places Autocomplete API called (debounced 300ms)
3. User selects suggestion
4. Place Details API called to get full address components
5. Address components parsed and auto-filled into form fields

### Marketplace Payment Flow
1. Customer initiates payment
2. Order created with transfer configuration (if vendor eligible)
3. Payment processed
4. On payment completion:
   - Commission calculated from vendor tier
   - Vendor share = Total - Commission
   - Transfer queued to SQS
5. Settlement processor:
   - Creates Razorpay Route transfer
   - Updates settlement records
   - Notifies vendor

## 🚨 Important Notes

1. **Google Maps API Key**: Must have Places API enabled
2. **Razorpay Marketplace**: Requires Route API access
3. **Vendor Setup**: Vendors must have:
   - Linked Razorpay account
   - Verified bank account
4. **Tier System**: Default tier (Bronze) used if vendor has no tier assigned

## 📝 Files Modified

### New Files
- `packages/ui/src/address-autocomplete.tsx`
- `apps/WarmpawzCustomer/src/components/AddressAutocomplete.tsx`
- `GOOGLE_MAPS_RAZORPAY_IMPLEMENTATION.md`

### Modified Files
- `apps/vendor-web/components/vendor/VendorOnboardingFlow.tsx`
- `apps/WarmpawzCustomer/src/screens/onboarding/CustomerUserProfileScreen.tsx`
- `apps/WarmpawzCustomer/src/screens/settings/AddAddressScreen.tsx`
- `apps/customer-web/components/customer/CreateBookingPage.tsx`
- `backend/lambda/src/endpoints/razorpay.ts`
- `backend/lambda/src/endpoints/razorpay-settlements.ts`
- `apps/vendor-web/package.json`
- `apps/customer-web/package.json`
- `packages/ui/src/index.ts`

## ✅ Testing Checklist

- [ ] Google Maps API key configured
- [ ] Address autocomplete works in vendor onboarding
- [ ] Address autocomplete works in customer profile
- [ ] Address autocomplete works in booking creation
- [ ] Razorpay marketplace mode enabled
- [ ] Vendor tier commission rates configured in database
- [ ] Automatic settlement triggers on payment completion
- [ ] Settlement uses correct commission rate from vendor tier
- [ ] Transfers work for verified vendors

## 🔄 Next Steps

1. Test with real Google Maps API key
2. Test Razorpay marketplace transfers
3. Verify tier commission calculations
4. Monitor settlement queue processing
5. Add error handling for edge cases
6. Add retry logic for failed settlements

