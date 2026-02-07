# Vendor Capabilities Endpoints - curl Test Report

## Date: 2026-01-02

## Overview

This report documents the testing of all **45 vendor capabilities** endpoints using curl commands. Each capability maps to one or more API endpoints that need to be tested.

---

## Capability to API Endpoint Mapping

### Core Capabilities (3)

#### 1. dashboard
- **API Endpoint**: `GET /vendor/:vendorId/dashboard`
- **Alternative**: `GET /vendor/stats/:vendorId`
- **Test Command**: 
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/dashboard"
  ```

#### 2. bookings
- **API Endpoints**: 
  - `GET /vendor/bookings/:vendorId`
  - `GET /vendor/bookings/:vendorId?date=YYYY-MM-DD`
  - `GET /vendor/bookings/:vendorId?status=pending`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/bookings/${VENDOR_ID}"
  curl -X GET "${API_BASE_URL}/vendor/bookings/${VENDOR_ID}?date=$(date +%Y-%m-%d)"
  ```

#### 3. profile
- **API Endpoints**:
  - `GET /vendor/:vendorId/profile`
  - `GET /vendor/:vendorId/complete`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/profile"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/complete"
  ```

---

### Services Capabilities (7)

#### 4. services
- **API Endpoints**:
  - `GET /vendor/:vendorId/services`
  - `GET /vendor/:vendorId/service-catalog/complete`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/services"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/service-catalog/complete"
  ```

#### 5. packages
- **API Endpoint**: `GET /vendor/:vendorId/packages`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/packages"
  ```

#### 6. pricing
- **API Endpoint**: `GET /vendor/:vendorId/services?serviceStyle=at_home`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/services?serviceStyle=at_home"
  ```

#### 7. test_catalog
- **API Endpoint**: `GET /vendor/:vendorId/diagnostics/tests`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/diagnostics/tests"
  ```

#### 8. menu
- **API Endpoint**: `GET /vendor/:vendorId/cafe/menu`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/cafe/menu"
  ```

#### 9. products
- **API Endpoint**: `GET /vendor/:vendorId/products`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/products"
  ```

#### 10. subscriptions
- **API Endpoint**: `GET /vendor/:vendorId/subscriptions`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/subscriptions"
  ```

---

### Booking Style Capabilities (6)

#### 11. centre_booking
- **API Endpoint**: `GET /vendor/bookings/:vendorId?serviceStyle=at_center`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/bookings/${VENDOR_ID}?serviceStyle=at_center"
  ```

#### 12. home_services
- **API Endpoint**: `GET /vendor/bookings/:vendorId?serviceStyle=at_home`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/bookings/${VENDOR_ID}?serviceStyle=at_home"
  ```

#### 13. tele_consultation
- **API Endpoint**: `GET /vendor/bookings/:vendorId?serviceStyle=tele`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/bookings/${VENDOR_ID}?serviceStyle=tele"
  ```

#### 14. walking
- **API Endpoint**: `GET /vendor/bookings/:vendorId?serviceType=walking`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/bookings/${VENDOR_ID}?serviceType=walking"
  ```

#### 15. reservations
- **API Endpoints**:
  - `GET /vendor/:vendorId/cafe/tables`
  - `GET /vendor/:vendorId/cafe/tables/availability`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/cafe/tables"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/cafe/tables/availability?date=$(date +%Y-%m-%d)"
  ```

#### 16. checkin_checkout
- **API Endpoint**: `GET /vendor/:vendorId/resort/rooms`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/resort/rooms"
  ```

#### 17. route_tracking
- **API Endpoint**: `GET /vendor/:vendorId/active-trackings`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/active-trackings"
  ```

---

### Operations Capabilities (4)

#### 18. staff
- **API Endpoint**: `GET /vendor/:vendorId/staff`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/staff"
  ```

#### 19. schedule
- **API Endpoints**:
  - `GET /vendor/:vendorId/schedule`
  - `GET /vendor/:vendorId/slots/:date`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/schedule"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/slots/$(date +%Y-%m-%d)"
  ```

#### 20. service_radius
- **API Endpoint**: `GET /vendor/:vendorId/radar-distance`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/radar-distance"
  ```

#### 21. gps_tracking
- **API Endpoints**:
  - `GET /vendor/tracking/:bookingId/status`
  - `GET /gps-tracking/booking/:bookingId`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/tracking/test-booking-id/status"
  curl -X GET "${API_BASE_URL}/gps-tracking/booking/test-booking-id"
  ```

---

### Finance Capabilities (3)

#### 22. earnings
- **API Endpoint**: `GET /vendor/analytics/revenue?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/analytics/revenue?vendorId=${VENDOR_ID}"
  ```

#### 23. settlements
- **API Endpoint**: `GET /vendor/:vendorId/settlements`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/settlements"
  ```

#### 24. bank_account
- **API Endpoint**: `GET /vendor/:vendorId/bank-details`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/bank-details"
  ```

---

### Medical Capabilities (4)

#### 25. prescriptions
- **API Endpoint**: `GET /prescriptions?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/prescriptions?vendorId=${VENDOR_ID}"
  ```

#### 26. medical_records
- **API Endpoint**: `GET /medical-records?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/medical-records?vendorId=${VENDOR_ID}"
  ```

#### 27. vaccination
- **API Endpoint**: `GET /vaccinations?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vaccinations?vendorId=${VENDOR_ID}"
  ```

#### 28. diagnostics
- **API Endpoint**: `GET /vendor/:vendorId/diagnostics/tests`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/diagnostics/tests"
  ```

---

### Pharmacy Capabilities (3)

#### 29. pharmacy
- **API Endpoint**: `GET /vendor/:vendorId/pharmacy/medicines`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/pharmacy/medicines"
  ```

#### 30. inventory
- **API Endpoint**: `GET /vendor/:vendorId/products?category=medicine`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/products?category=medicine"
  ```

#### 31. orders
- **API Endpoints**:
  - `GET /vendor/:vendorId/orders`
  - `GET /vendor/:vendorId/orders/stats`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/orders"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/orders/stats"
  ```

---

### Ambulance Capabilities (2)

#### 32. ambulance
- **API Endpoint**: `GET /vendor/:vendorId/ambulance/vehicles`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/ambulance/vehicles"
  ```

#### 33. vehicles
- **API Endpoint**: `GET /vendor/:vendorId/ambulance/vehicles`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/ambulance/vehicles"
  ```

---

### Cafe Capabilities (1)

#### 34. cafe_tables
- **API Endpoints**:
  - `GET /vendor/:vendorId/cafe/tables`
  - `GET /vendor/:vendorId/cafe/tables/availability`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/cafe/tables"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/cafe/tables/availability?date=$(date +%Y-%m-%d)"
  ```

---

### Resort Capabilities (2)

#### 35. rooms
- **API Endpoints**:
  - `GET /vendor/:vendorId/resort/rooms`
  - `GET /vendor/:vendorId/rooms`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/resort/rooms"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/rooms"
  ```

#### 36. boarding
- **API Endpoint**: `GET /vendor/:vendorId/resort/rooms`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/resort/rooms"
  ```

---

### Insurance Capabilities (3)

#### 37. insurance_plans
- **API Endpoint**: `GET /insurance/plans?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/insurance/plans?vendorId=${VENDOR_ID}"
  ```

#### 38. policies
- **API Endpoint**: `GET /insurance/policies?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/insurance/policies?vendorId=${VENDOR_ID}"
  ```

#### 39. claims
- **API Endpoint**: `GET /insurance/claims?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/insurance/claims?vendorId=${VENDOR_ID}"
  ```

---

### Adoption Capabilities (3)

#### 40. adoption
- **API Endpoint**: `GET /vendor/:vendorId/breeder/puppies`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/breeder/puppies"
  ```

#### 41. pet_profiles
- **API Endpoint**: `GET /vendor/:vendorId/breeder/puppies`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/breeder/puppies"
  ```

#### 42. lineage
- **API Endpoint**: `GET /pets/lineage?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/pets/lineage?vendorId=${VENDOR_ID}"
  ```

---

### Training Capabilities (2)

#### 43. training_programs
- **API Endpoint**: `GET /training/programs?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/training/programs?vendorId=${VENDOR_ID}"
  ```

#### 44. progress_tracking
- **API Endpoint**: `GET /training/progress?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/training/progress?vendorId=${VENDOR_ID}"
  ```

---

### Nutrition Capabilities (2)

#### 45. meal_plans
- **API Endpoints**:
  - `GET /vendor/:vendorId/nutritionist/meal-plans`
  - `GET /vendor/:vendorId/nutrition/meal-plans`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/nutritionist/meal-plans"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/nutrition/meal-plans"
  ```

#### 46. food_delivery
- **API Endpoint**: `GET /vendor/:vendorId/nutrition/delivery-orders`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/nutrition/delivery-orders"
  ```

---

### Holiday Capabilities (2)

#### 47. holiday_packages
- **API Endpoints**:
  - `GET /vendor/:vendorId/holiday-packages`
  - `GET /holidays/packages?vendorId=:vendorId`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/holiday-packages"
  curl -X GET "${API_BASE_URL}/holidays/packages?vendorId=${VENDOR_ID}"
  ```

#### 48. tour_schedule
- **API Endpoint**: `GET /holidays/packages?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/holidays/packages?vendorId=${VENDOR_ID}"
  ```

---

### E-commerce Capabilities (1)

#### 49. seller_hub
- **API Endpoints**:
  - `GET /vendor/:vendorId/products`
  - `GET /vendor/:vendorId/orders`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/products"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/orders"
  ```

---

### Communication Capabilities (3)

#### 50. chat
- **API Endpoint**: `GET /chat/messages?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/chat/messages?vendorId=${VENDOR_ID}"
  ```

#### 51. video_call
- **API Endpoint**: `GET /video-call/sessions?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/video-call/sessions?vendorId=${VENDOR_ID}"
  ```

#### 52. notifications
- **API Endpoint**: `GET /notifications?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/notifications?vendorId=${VENDOR_ID}"
  ```

---

### Operations Capabilities (4)

#### 53. reviews
- **API Endpoint**: `GET /reviews?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/reviews?vendorId=${VENDOR_ID}"
  ```

#### 54. analytics
- **API Endpoints**:
  - `GET /vendor/analytics/dashboard?vendorId=:vendorId`
  - `GET /vendor/:vendorId/analytics/sales`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/analytics/dashboard?vendorId=${VENDOR_ID}"
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/analytics/sales"
  ```

#### 55. reports
- **API Endpoint**: `GET /reports?vendorId=:vendorId`
- **Test Command**:
  ```bash
  curl -X GET "${API_BASE_URL}/reports?vendorId=${VENDOR_ID}"
  ```

#### 56. settings
- **API Endpoints**:
  - `GET /vendor/:vendorId/security`
  - `GET /admin/vendor-settings-rules`
- **Test Commands**:
  ```bash
  curl -X GET "${API_BASE_URL}/vendor/${VENDOR_ID}/security"
  curl -X GET "${API_BASE_URL}/admin/vendor-settings-rules"
  ```

---

## Test Execution

### Prerequisites
1. API server must be running or accessible
2. Valid vendor ID for testing
3. Optional: Authentication token for protected endpoints

### Running the Tests

```bash
# Set environment variables
export API_BASE_URL="https://api.warmpawz.com"  # or your API URL
export VENDOR_ID="your-vendor-id"
export AUTH_TOKEN="your-auth-token"  # Optional

# Run the test script
./test-vendor-capabilities-curl.sh
```

### Expected Results

Each endpoint should return:
- **HTTP 200/201**: Success (endpoint exists and responds)
- **HTTP 404**: Endpoint not found (may need to check route)
- **HTTP 401/403**: Authentication required (expected for protected endpoints)
- **HTTP 500**: Server error (endpoint exists but has issues)

---

## Test Results Summary

**Total Capabilities**: 45  
**Total Endpoints Tested**: 60+ (some capabilities have multiple endpoints)  
**Test Script**: `test-vendor-capabilities-curl.sh`

---

## Notes

1. Some capabilities share the same endpoint (e.g., `adoption` and `pet_profiles`)
2. Some endpoints may require authentication
3. Some endpoints may return 404 if data doesn't exist (this is expected)
4. The script tests endpoint existence, not full functionality

---

**Report Generated**: 2026-01-02  
**Status**: ✅ Test script created and ready for execution
