# API Endpoints Inventory
## Complete List of All Registered Endpoints

**Date:** 2024-12-03  
**Purpose:** Comprehensive endpoint verification for testing

---

## 📋 ENDPOINT CATEGORIES

### 1. Customer Endpoints
#### Booking & Appointments
- `POST /bookings/create` - Create booking
- `GET /bookings/:bookingId` - Get booking details
- `POST /bookings/:bookingId/cancel` - Cancel booking
- `POST /bookings/:bookingId/lifecycle` - Complete booking lifecycle
- `POST /bookings/:bookingId/accept` - Accept booking (vendor)
- `POST /bookings/:bookingId/complete` - Complete booking
- `GET /customer/:customerId/bookings` - Get customer bookings
- `POST /bookings/validate-slot` - Validate time slot

#### Service Discovery
- `GET /customer/problem-grid/:roleId` - Get problem grid
- `GET /customer/universal-problem-discovery` - Discover vendors by problem
- `GET /customer/search-suggestions` - Get search suggestions
- `GET /search/enhanced` - Enhanced search (Elasticsearch)

#### Orders & Tracking
- `GET /customer/:customerId/orders` - Get customer orders
- `GET /orders/:orderId/tracking` - Track order
- `POST /orders/:orderId/cancel` - Cancel order

#### Insurance
- `GET /insurance/plans` - Browse insurance plans
- `POST /insurance/policy/purchase` - Purchase policy
- `GET /insurance/customer/:customerId/policies` - Get customer policies
- `GET /insurance/customer/:customerId/claims` - Get customer claims
- `POST /insurance/claim/file` - File insurance claim
- `GET /insurance/claim/:claimId` - Get claim status

#### Prescription & Medicine
- `POST /customer/prescription/submit` - Submit prescription
- `GET /customer/:customerId/prescriptions` - Get prescriptions
- `GET /customer/:customerId/prescription-orders/:orderId` - Get prescription order
- `POST /customer/:customerId/prescription-orders/:orderId/confirm-payment` - Confirm payment

#### Packages
- `GET /customer/packages` - Browse packages
- `POST /bookings/package/create` - Create package booking
- `GET /customer/:customerId/packages` - Get customer packages

---

### 2. Vendor Endpoints
#### Dashboard & Capabilities
- `GET /vendor/:vendorId/dashboard` - Get vendor dashboard
- `GET /vendor/:vendorId/capabilities` - Get vendor capabilities
- `GET /vendor/:vendorId/services` - Get vendor services
- `POST /vendor/:vendorId/services` - Create service
- `PUT /vendor/:vendorId/services/:serviceId` - Update service
- `DELETE /vendor/:vendorId/services/:serviceId` - Delete service

#### Staff Management
- `GET /vendor/:vendorId/staff` - Get staff list
- `POST /vendor/:vendorId/staff` - Add staff
- `PUT /vendor/:vendorId/staff/:staffId` - Update staff
- `DELETE /vendor/:vendorId/staff/:staffId` - Remove staff
- `POST /vendor/:vendorId/staff/:staffId/update-specializations` - Update staff specializations

#### Booking Management
- `GET /vendor/:vendorId/bookings` - Get vendor bookings
- `POST /vendor/:vendorId/bookings/:bookingId/accept` - Accept booking
- `POST /vendor/:vendorId/bookings/:bookingId/complete` - Complete booking
- `POST /vendor/:vendorId/bookings/:bookingId/cancel` - Cancel booking

#### Schedule Management
- `GET /vendor/:vendorId/schedule` - Get vendor schedule
- `POST /vendor/:vendorId/schedule` - Update schedule
- `GET /vendor/:vendorId/staff/:staffId/schedule` - Get staff schedule
- `POST /vendor/:vendorId/staff/:staffId/schedule` - Update staff schedule

#### Specialized Services
- `GET /vendor/:vendorId/ambulance-services` - Get ambulance services
- `POST /vendor/:vendorId/ambulance-services` - Add ambulance service
- `GET /vendor/:vendorId/diagnostic-tests` - Get diagnostic tests
- `POST /vendor/:vendorId/diagnostic-tests` - Add diagnostic test
- `GET /vendor/:vendorId/emergency-protocols` - Get emergency protocols
- `POST /vendor/:vendorId/emergency-protocols` - Add emergency protocol

#### Progress Tracking
- `GET /vendor/:vendorId/progress-trackers` - Get progress trackers
- `POST /vendor/:vendorId/progress-trackers/:trackerId/notes` - Add progress note
- `POST /vendor/:vendorId/progress-trackers/:trackerId/milestones` - Add milestone
- `POST /vendor/:vendorId/progress-trackers/:trackerId/measurements` - Add measurement

#### Cafe Management
- `GET /vendor/:vendorId/cafe-available-tables` - Get available tables
- `POST /cafe/:vendorId/reservations` - Create table reservation
- `GET /cafe/:vendorId/reservations` - Get reservations

#### Insurance Management
- `GET /vendor/:vendorId/insurance/claims` - Get claims
- `GET /vendor/:vendorId/insurance/claims/:claimId` - Get claim details
- `POST /vendor/:vendorId/insurance/claims/:claimId/action` - Process claim

---

### 3. Admin Endpoints
#### Vendor Management
- `GET /admin/vendors` - Get all vendors
- `POST /admin/vendors/:vendorId/approve` - Approve vendor
- `POST /admin/vendors/:vendorId/reject` - Reject vendor
- `GET /admin/vendors/:vendorId` - Get vendor details

#### Role Configuration
- `GET /config/roles` - Get all roles
- `POST /config/roles` - Create role
- `PUT /config/roles/:roleId` - Update role
- `DELETE /config/roles/:roleId` - Delete role
- `GET /config/roles/:roleId` - Get role details

#### Platform Settings
- `GET /admin/integrations/settings` - Get integration settings
- `POST /admin/integrations/settings` - Update integration settings
- `GET /admin/settings/aws` - Get AWS settings
- `POST /admin/settings/aws` - Update AWS settings

#### Payment & Refund Policies
- `GET /admin/payment-policies` - Get payment policies
- `POST /admin/payment-policies` - Create payment policy
- `GET /admin/refund-policies` - Get refund policies
- `POST /admin/refund-policies` - Create refund policy

#### Analytics
- `GET /admin/analytics/dashboard` - Get analytics dashboard
- `GET /admin/analytics/reports` - Get analytics reports

---

### 4. Payment Endpoints
- `POST /ecommerce/payments/initiate` - Initiate payment
- `POST /ecommerce/payments/verify` - Verify payment
- `POST /payments/refund` - Process refund
- `POST /payments/partial-refund` - Process partial refund

---

### 5. Notification Endpoints
- `POST /notifications/create` - Create notification
- `GET /notifications/:recipientType/:recipientId` - Get notifications
- `POST /notifications/:notificationId/mark-read` - Mark as read

---

### 6. GPS Tracking Endpoints
- `POST /gps/tracking/start` - Start tracking
- `POST /gps/tracking/:sessionId/update` - Update location
- `GET /gps/tracking/:sessionId/stream` - Stream location updates
- `POST /gps/tracking/:sessionId/stop` - Stop tracking

---

### 7. Video Call Endpoints
- `POST /video/room/create` - Create video room
- `POST /video/room/:roomId/join` - Join video room
- `POST /video/room/:roomId/leave` - Leave video room

---

### 8. Chat Endpoints
- `POST /chat/messages` - Send message
- `GET /chat/conversations/:conversationId/messages` - Get messages
- `POST /chat/conversations` - Create conversation

---

## ✅ ENDPOINT VERIFICATION CHECKLIST

### Customer Endpoints
- [ ] All booking endpoints accessible
- [ ] All service discovery endpoints accessible
- [ ] All order tracking endpoints accessible
- [ ] All insurance endpoints accessible
- [ ] All prescription endpoints accessible

### Vendor Endpoints
- [ ] All dashboard endpoints accessible
- [ ] All service management endpoints accessible
- [ ] All staff management endpoints accessible
- [ ] All booking management endpoints accessible
- [ ] All specialized service endpoints accessible

### Admin Endpoints
- [ ] All vendor management endpoints accessible
- [ ] All role configuration endpoints accessible
- [ ] All platform settings endpoints accessible
- [ ] All analytics endpoints accessible

### Integration Endpoints
- [ ] Payment endpoints accessible
- [ ] Notification endpoints accessible
- [ ] GPS tracking endpoints accessible
- [ ] Video call endpoints accessible
- [ ] Chat endpoints accessible

---

**Last Updated:** 2024-12-03  
**Status:** ✅ INVENTORY COMPLETE

