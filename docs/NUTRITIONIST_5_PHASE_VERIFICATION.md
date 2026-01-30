# Nutritionist / Meal Plans – 5-Phase Implementation Verification

**Date:** 2026-01-28  
**Scope:** End-to-end flow, wire frame UI, labels, data display, and E2E consistency.

---

## 1. Flow Map (Step by Step)

| Step | Screen / Action | Component | Data / API | Header / Frame |
|------|-----------------|-----------|------------|----------------|
| 1 | Home → Nutritionist | CustomerHomeComplete → handleNavigateToService('nutritionist') | Screen: `nutritionist` | — |
| 2 | Nutritionist landing | NutritionistServicesLanding | GET `/customer/discover-services?category=nutrition&roleId=pet_nutritionist`, GET `/customer/pets/:phone` | **ServiceDashboardHeader** – orange gradient, "Pet Nutrition", "Expert nutrition consultation", stats (Experts, Consultations, Rating) |
| 3 | Meal Plans entry | "Meal Plans" in Our Services | onNavigate('nutrition-meal-plans') | Same frame |
| 4 | Meal plans list | MealPlansList | GET `/meal-plans/search` (lat, lng, maxRadius=10, purpose, mealType), GET `/meal-plans/search/filters` | **Orange header** – "Meal Plans", back button, white card body; labels: "Available Meal Plans", "Within 10 km", filter chips (purpose, mealType) |
| 5 | Meal plan card | Card per plan | Backend: vendor_name, price_per_meal, price_per_month, distance_km, estimatedDeliveryMinutes, duration_days, vendor_rating/avg_rating | Plan name, "by {vendor}", rating, description, "Within X km", "ETA ~X min", "X days", "₹X/meal", "₹X/month" |
| 6 | Select plan → Checkout | onNavigate('meal-order-checkout', { vendorId, mealPlanId }) | vetServiceData set in wrapper | — |
| 7 | Checkout | MealOrderCheckout | GET `/meal-plans/:id`, GET `/meal-plans/:id/order-preview`, GET profile/pets/addresses, POST create-razorpay-order, POST create, POST confirm-payment | **Orange sticky header** – "Checkout – Meal Plan"; form: Pet, Quantity, Delivery address, Date, Time, Special instructions, **Order summary** (Subtotal, Delivery, Platform fee, Total), "Pay ₹X" |
| 8 | Post-payment | onSuccess(orderId) | — | setCurrentScreen('meal-order-tracking'), setSelectedBookingId(orderId) |
| 9 | Order tracking | OrderTrackingScreen (orderType=meal) | GET `/customer/tracking/:orderId` | Green/teal header "Track Order", order number, ETA banner, Handover OTP (when out for delivery), status timeline, Delivered + "Rate Your Experience" (meal only), review modal |
| 10 | Home widget | OrderTrackingWidget (meal) | GET `/customer/:phone/orders/meals/active`, GET `/customer/tracking/:orderId` | "Order Tracking", "Meal Delivery", steps, OTP, "Track Live" |
| 11 | Track Live from home | onNavigate('order-tracking', { orderId, orderType: 'meal' }) | — | Wrapper: setSelectedBookingId(orderId), setCurrentScreen('meal-order-tracking') → OrderTrackingScreen |
| 12 | Review (delivered) | OrderTrackingScreen review modal | POST `/meal/orders/:orderId/review` (rating 1–5, review?) | Modal: stars, optional text, "Submit Review" |

**Vendor (Nutritionist):**

| Step | Screen | Component | API | Header / Frame |
|------|--------|-----------|-----|----------------|
| V1 | Nutritionist dashboard | NutritionistDashboard | GET `/vendor/:vendorId/meal-orders`, meal-products | **Orange header** – "Nutritionist Kitchen", "Fresh Pet Meals", tabs: Meal Products, Orders, Insights |
| V2 | Orders tab | Orders list | PUT `/vendor/:vendorId/meal-orders/:orderId/status`, POST `/meal-orders/:orderId/update-preparation-eta`, POST `/meal/orders/:orderId/notify-logistics` | Order card: number, customer, status, phone, date, total; actions: Accept, Start Preparing, ETA 30m/45m/60m, Ready for Pickup, Notify Logistics, Dispatched, Mark Delivered |

---

## 2. Frame UI & Headers (Orange, Labels)

- **NutritionistServicesLanding:** ServiceDashboardHeader with `headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"`, serviceName="Pet Nutrition", serviceSubtitle="Expert nutrition consultation", stats with labels (Experts, Consultations, Rating).
- **MealPlansList:** Full-width orange block `bg-[#FF8C42]`, title "Meal Plans", back button; content in white rounded card; section title "Available Meal Plans" and subtitle with "Within 10 km".
- **MealOrderCheckout:** Sticky `bg-gradient-to-r from-[#FF8C42] to-orange-500`, title "Checkout – Meal Plan", back button; form labels: Pet, Quantity, Delivery address, Date, Time, Special instructions, **Order summary** (Subtotal, Delivery, Platform fee, Total).
- **OrderTrackingScreen:** Green/teal gradient header "Track Order", order number; ETA and OTP sections with clear labels; status steps and "Rate Your Experience" for meal.
- **NutritionistDashboard (vendor):** Orange header `from-[#FF8C42] to-orange-500`, "Nutritionist Kitchen", "Fresh Pet Meals", tab labels: Meal Products, Orders, Insights.

---

## 3. Data Display Verification

- **Meal discovery:** Backend `/meal-plans/search` returns snake_case (price_per_meal, price_per_month, vendor_name, distance_km, estimatedDeliveryMinutes, duration_days). UI uses price_per_meal → "₹X/meal", price_per_month → "₹X/month", vendor_rating/avg_rating for star rating, duration_days for "X days".
- **Checkout:** order-preview returns subtotal, deliveryFee, platformFee, totalAmount, leadTimeHours; UI shows Order summary and enforces min date from lead time.
- **Tracking:** GET `/customer/tracking/:orderId` returns order + tracking; when no delivery_tracking row, backend returns minimal `tracking: { status: order.status, deliveryOtp: null, deliveryPerson: null }` so widget and screen still render. Widget maps `confirmed` → `accepted`, `ready_for_pickup` → `ready` for step index.
- **Active orders:** GET `/customer/:phone/orders/meals/active` returns orders with status, trackingStatus (= status); CustomerHomeComplete filter uses status not in (delivered, cancelled, refunded) and allows confirmed/preparing/ready_for_pickup/picked_up/on_the_way (or trackingStatus) so meal orders show in widget.

---

## 4. Fixes Applied in This Verification

1. **MealPlansList:** Use backend `price_per_meal`, `price_per_month` (and camelCase fallbacks); display "₹X/meal" and "₹X/month" with duration "X days"; vendor rating from vendor_rating or avg_rating.
2. **CustomerHomeComplete active orders:** Filter relaxed so meal orders (no tracking_status) are included using status and trackingStatus.
3. **GET /customer/tracking/:orderId:** When delivery_tracking is null for pharmacy/meal, return minimal tracking object `{ status: order.status, deliveryOtp: null, deliveryPerson: null }` so OrderTrackingWidget and OrderTrackingScreen always get a tracking object.
4. **OrderTrackingWidget:** Map meal order status `confirmed` → `accepted`, `ready_for_pickup` → `ready` for TRACKING_STEPS index.
5. **CustomerHomeWrapper (nutritionist):** Handle `nutritionist-booking` so "Book with nutritionist" navigates to create-booking with vendorId/serviceId.

---

## 5. E2E Checklist

- [x] Home → Nutritionist → Meal Plans → list loads with filters, prices, distance, ETA
- [x] Meal plan card shows name, vendor, rating, description, distance, ETA, duration, ₹/meal, ₹/month
- [x] Select plan → Checkout: address, date/time, order summary, Razorpay → confirm-payment → meal-order-tracking
- [x] Order tracking screen: status steps, OTP when out for delivery, Delivered → Rate Your Experience → review API
- [x] Active meal order on home → OrderTrackingWidget → Track Live → OrderTrackingScreen (meal) with correct orderId/orderType
- [x] Vendor: Orders tab – Accept, Start Preparing, ETA, Ready for Pickup, Notify Logistics, Dispatched, Mark Delivered
- [x] All relevant screens use orange header or ServiceDashboardHeader with labels as above

---

## 6. Files Touched (Verification Pass)

- `apps/customer-web/components/customer/nutrition/landingPage/mealplans/MealPlansList.tsx` – price labels, backend field mapping
- `apps/customer-web/components/customer/CustomerHomeComplete.tsx` – active orders filter for meal
- `apps/customer-web/components/customer/OrderTrackingWidget.tsx` – status mapping for meal (confirmed, ready_for_pickup)
- `apps/customer-web/components/customer/wrappers/CustomerHomeWrapper.tsx` – nutritionist-booking → create-booking
- `backend/lambda/src/endpoints/logistics-webhooks.ts` – minimal tracking when no delivery_tracking
