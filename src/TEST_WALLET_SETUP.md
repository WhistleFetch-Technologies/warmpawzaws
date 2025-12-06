# 🧪 Test Wallet Setup for UAT

## Quick Wallet Credit for Testing

To test the wallet functionality during UAT, you can credit wallet balance to test users using this API:

### Credit Wallet API

**Endpoint**: `POST /customer/wallet/credit`

**Request**:
```json
{
  "phone": "9876543210",
  "amount": 500,
  "description": "Test wallet credit for UAT"
}
```

**cURL Example**:
```bash
curl -X POST \
  'https://{projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/wallet/credit' \
  -H 'Authorization: Bearer {publicAnonKey}' \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "9876543210",
    "amount": 500,
    "description": "UAT Test Credit"
  }'
```

### Test Coupon Codes

The following coupons are pre-configured for testing:

1. **FIRST20** - 20% off (max ₹500 discount)
2. **SAVE10** - 10% off (max ₹200 discount)
3. **GROOM50** - 15% off on orders above ₹500 (max ₹300 discount)

### OTP Flow Testing

1. Book a service through the complete flow
2. Note the 4-digit OTP displayed on confirmation screen
3. Groomer enters this OTP in their vendor app to complete service
4. System marks booking as completed

### Address Testing

Addresses are automatically stored per customer phone number. When testing:
- First address added is automatically set as default
- Can add multiple addresses
- Default address is auto-selected in booking flow

---

## End-to-End UAT Test Flow

### Center Booking Flow:
1. Login → Grooming Dashboard
2. Click "Grooming Centre" → See list of centers
3. Select a center → View center profile
4. Click "Book Appointment" → Select service/package
5. Choose add-ons (optional) → Select pet
6. Choose date & time slot → Payment page
7. Apply coupon (optional) → Toggle wallet (optional)
8. Select payment method → Pay
9. See confirmation with OTP → Done!

### At-Home Booking Flow:
1. Login → Grooming Dashboard
2. Click "At Home Grooming" → Select groomer
3. Select service → Select pet
4. Choose date & time → Select/Add address
5. Payment page → Apply coupon & wallet
6. Pay → Confirmation with OTP

---

## Pre-requisites for Testing

### Required Data in System:
1. ✅ Active grooming vendors (pet_groomer role)
2. ✅ Published services for those vendors
3. ✅ Customer with registered pets
4. ✅ Vendor availability configured (V2 availability)

### APIs Used:
- `GET /customer/services?roleId=pet_groomer` - Get groomers
- `GET /customer/pets/:phone` - Get customer's pets
- `GET /customer/wallet/:phone` - Get wallet balance
- `POST /customer/wallet/credit` - Add wallet balance (for testing)
- `POST /coupon/validate` - Validate coupon codes
- `GET /grooming/slots/:vendorId/:date` - Get available slots
- `POST /booking` - Create booking
- `POST /booking/:bookingId/generate-otp` - Generate OTP
- `POST /booking/:bookingId/verify-otp` - Verify OTP (vendor app)

---

**Status**: Ready for UAT Testing 🚀
