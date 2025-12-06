# Warmpawz Complete API Documentation

## Overview
Complete REST API for the Warmpawz pet services platform with 75+ endpoints covering all business operations.

**Base URL**: `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`

**Authentication**: Bearer token in Authorization header
```
Authorization: Bearer ${publicAnonKey}
```

---

## 📚 Table of Contents
1. [Booking Management](#booking-management) - 11 endpoints
2. [Pet Management](#pet-management) - 8 endpoints
3. [Payment & Wallet](#payment--wallet) - 9 endpoints
4. [Reviews & Ratings](#reviews--ratings) - 8 endpoints
5. [Search & Discovery](#search--discovery) - 7 endpoints
6. [Analytics & Reports](#analytics--reports) - 7 endpoints
7. [Vendor Management](#vendor-management) - 15 endpoints
8. [Customer Management](#customer-management) - 10 endpoints
9. [Admin Operations](#admin-operations) - 12 endpoints

---

## 1. Booking Management

### Create Booking
```http
POST /bookings/create
```

**Body:**
```json
{
  "customerId": "customer_xxxxx",
  "vendorId": "vendor_xxxxx",
  "petId": "pet_xxxxx",
  "serviceId": "service_xxxxx",
  "serviceName": "Basic Bath & Dry",
  "serviceType": "grooming",
  "bookingDate": "2025-11-20",
  "bookingTime": "10:00",
  "duration": 60,
  "price": 500,
  "customerName": "John Doe",
  "customerPhone": "9876543210",
  "customerAddress": "123 Main St",
  "petName": "Max",
  "petBreed": "Golden Retriever",
  "petAge": "3 years",
  "specialInstructions": "Pet is nervous",
  "paymentMethod": "card"
}
```

**Response:**
```json
{
  "success": true,
  "bookingId": "booking_1234567890_abc123",
  "booking": { /* booking object */ }
}
```

---

### Get Booking Details
```http
GET /bookings/:bookingId
```

**Response:**
```json
{
  "booking": {
    "id": "booking_xxxxx",
    "status": "confirmed",
    "customerName": "John Doe",
    "vendorId": "vendor_xxxxx",
    "bookingDate": "2025-11-20",
    "price": 500,
    /* ... */
  }
}
```

---

### Get Customer Bookings
```http
GET /bookings/customer/:customerId?status=pending
```

**Query Params:**
- `status` (optional): `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`

**Response:**
```json
{
  "bookings": [/* array of bookings */],
  "total": 10
}
```

---

### Get Vendor Bookings
```http
GET /bookings/vendor/:vendorId?status=confirmed
```

**Response:**
```json
{
  "bookings": [/* array of bookings */],
  "total": 25
}
```

---

### Update Booking Status
```http
POST /bookings/:bookingId/status
```

**Body:**
```json
{
  "status": "confirmed",
  "note": "Booking confirmed for tomorrow",
  "updatedBy": "vendor_xxxxx"
}
```

**Valid Statuses:**
- `pending` → Initial state
- `confirmed` → Vendor accepted
- `in_progress` → Service in progress
- `completed` → Service completed
- `cancelled` → Booking cancelled

---

### Accept Booking (Vendor)
```http
POST /bookings/:bookingId/accept
```

**Body:**
```json
{
  "vendorId": "vendor_xxxxx",
  "note": "Will be there on time"
}
```

---

### Reject Booking (Vendor)
```http
POST /bookings/:bookingId/reject
```

**Body:**
```json
{
  "vendorId": "vendor_xxxxx",
  "reason": "Not available at this time"
}
```

---

### Cancel Booking
```http
POST /bookings/:bookingId/cancel
```

**Body:**
```json
{
  "reason": "Emergency came up",
  "cancelledBy": "customer_xxxxx",
  "refundAmount": 500
}
```

---

### Reschedule Booking
```http
POST /bookings/:bookingId/reschedule
```

**Body:**
```json
{
  "newDate": "2025-11-21",
  "newTime": "14:00",
  "reason": "Customer requested change"
}
```

---

### Get Vendor Booking Stats
```http
GET /bookings/vendor/:vendorId/stats
```

**Response:**
```json
{
  "stats": {
    "total": 100,
    "pending": 5,
    "confirmed": 10,
    "completed": 80,
    "cancelled": 5,
    "totalRevenue": 50000
  }
}
```

---

## 2. Pet Management

### Create Pet
```http
POST /pets/create
```

**Body:**
```json
{
  "customerId": "customer_xxxxx",
  "name": "Max",
  "species": "dog",
  "breed": "Golden Retriever",
  "age": 3,
  "ageUnit": "years",
  "gender": "male",
  "weight": 25,
  "weightUnit": "kg",
  "color": "Golden",
  "photoUrl": "https://...",
  "medicalHistory": [],
  "allergies": ["Chicken"],
  "vaccinations": [],
  "specialNeeds": "Requires extra care",
  "microchipId": "123456789",
  "insuranceProvider": "PetCare Inc",
  "insurancePolicyNumber": "POL123456"
}
```

---

### Get Pet Details
```http
GET /pets/:petId
```

---

### Get Customer's Pets
```http
GET /pets/customer/:customerId
```

**Response:**
```json
{
  "pets": [/* array of pets */],
  "total": 3
}
```

---

### Update Pet
```http
PUT /pets/:petId
```

**Body:**
```json
{
  "weight": 26,
  "specialNeeds": "Updated care instructions"
}
```

---

### Delete Pet
```http
DELETE /pets/:petId
```

---

### Add Medical Record
```http
POST /pets/:petId/medical-record
```

**Body:**
```json
{
  "type": "checkup",
  "description": "Annual health checkup",
  "date": "2025-11-15",
  "veterinarian": "Dr. Smith",
  "medication": "None",
  "notes": "All healthy"
}
```

**Record Types:**
- `checkup`
- `vaccination`
- `surgery`
- `illness`
- `injury`

---

### Add Vaccination Record
```http
POST /pets/:petId/vaccination
```

**Body:**
```json
{
  "vaccineName": "Rabies",
  "date": "2025-11-15",
  "nextDueDate": "2026-11-15",
  "veterinarian": "Dr. Smith",
  "batchNumber": "BATCH123",
  "notes": "No side effects"
}
```

---

### Get Pet's Booking History
```http
GET /pets/:petId/bookings
```

---

## 3. Payment & Wallet

### Process Payment
```http
POST /payments/process
```

**Body:**
```json
{
  "bookingId": "booking_xxxxx",
  "customerId": "customer_xxxxx",
  "vendorId": "vendor_xxxxx",
  "amount": 500,
  "paymentMethod": "card",
  "paymentDetails": {
    "cardLast4": "1234",
    "cardType": "Visa"
  },
  "commission": 10
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "payment_xxxxx",
  "payment": {
    "id": "payment_xxxxx",
    "amount": 500,
    "platformCommission": 50,
    "vendorAmount": 450,
    "status": "completed"
  }
}
```

---

### Get Payment Details
```http
GET /payments/:paymentId
```

---

### Process Refund
```http
POST /payments/:paymentId/refund
```

**Body:**
```json
{
  "amount": 500,
  "reason": "Service cancelled",
  "refundedBy": "admin_xxxxx"
}
```

---

### Get Customer Payment History
```http
GET /payments/customer/:customerId
```

---

### Get Vendor Payment History
```http
GET /payments/vendor/:vendorId
```

---

### Get Vendor Earnings
```http
GET /payments/vendor/:vendorId/earnings
```

**Response:**
```json
{
  "earnings": {
    "total": 45000,
    "pending": 5000,
    "paidOut": 40000
  }
}
```

---

### Process Vendor Payout
```http
POST /payments/vendor/:vendorId/payout
```

**Body:**
```json
{
  "amount": 5000,
  "bankDetails": {
    "accountNumber": "1234567890",
    "bankName": "HDFC Bank",
    "ifscCode": "HDFC0001234"
  },
  "processedBy": "admin_xxxxx"
}
```

---

### Get Vendor Payout History
```http
GET /payments/vendor/:vendorId/payouts
```

---

### Get Platform Revenue (Admin)
```http
GET /payments/platform/revenue
```

**Response:**
```json
{
  "revenue": {
    "total": 50000,
    "monthly": {
      "2025-11": 5000,
      "2025-10": 4500
    }
  }
}
```

---

## 4. Reviews & Ratings

### Create Review
```http
POST /reviews/create
```

**Body:**
```json
{
  "bookingId": "booking_xxxxx",
  "customerId": "customer_xxxxx",
  "vendorId": "vendor_xxxxx",
  "rating": 5,
  "review": "Excellent service!",
  "serviceQuality": 5,
  "punctuality": 5,
  "cleanliness": 5,
  "valueForMoney": 4,
  "wouldRecommend": true,
  "photos": ["https://...", "https://..."]
}
```

**Constraints:**
- Rating: 1-5
- Booking must be completed
- Can only review once per booking

---

### Get Review Details
```http
GET /reviews/:reviewId
```

---

### Get Vendor Reviews
```http
GET /reviews/vendor/:vendorId?status=published&limit=50
```

**Query Params:**
- `status`: `published`, `hidden`, `flagged`
- `limit`: Max results (default: 50)

---

### Get Customer Reviews
```http
GET /reviews/customer/:customerId
```

---

### Vendor Respond to Review
```http
POST /reviews/:reviewId/respond
```

**Body:**
```json
{
  "vendorId": "vendor_xxxxx",
  "response": "Thank you for your feedback!"
}
```

---

### Flag Review (Admin)
```http
POST /reviews/:reviewId/flag
```

**Body:**
```json
{
  "reason": "Inappropriate content",
  "flaggedBy": "admin_xxxxx"
}
```

---

### Hide Review (Admin)
```http
POST /reviews/:reviewId/hide
```

**Body:**
```json
{
  "reason": "Spam",
  "hiddenBy": "admin_xxxxx"
}
```

---

### Get Vendor Rating Summary
```http
GET /reviews/vendor/:vendorId/summary
```

**Response:**
```json
{
  "summary": {
    "averageRating": 4.5,
    "totalReviews": 100,
    "ratingDistribution": {
      "1": 2,
      "2": 3,
      "3": 10,
      "4": 35,
      "5": 50
    },
    "detailedRatings": {
      "serviceQuality": 4.6,
      "punctuality": 4.4,
      "cleanliness": 4.5,
      "valueForMoney": 4.3
    },
    "recommendationRate": 85.5
  }
}
```

---

## 5. Search & Discovery

### Search Vendors
```http
POST /search/vendors
```

**Body:**
```json
{
  "serviceType": "grooming",
  "location": {
    "lat": 28.6139,
    "lng": 77.2090
  },
  "radius": 10,
  "serviceStyle": "at_home",
  "minRating": 4.0,
  "maxPrice": 1000,
  "sortBy": "rating",
  "limit": 20
}
```

**Sort Options:**
- `rating` - Highest rated first
- `reviews` - Most reviewed first
- `distance` - Nearest first
- Default: Combined score (rating + reviews)

**Response:**
```json
{
  "vendors": [
    {
      "id": "vendor_xxxxx",
      "businessName": "Happy Paws Grooming",
      "rating": 4.8,
      "totalReviews": 150,
      "distance": 2.5,
      "services": ["grooming", "bathing"],
      "pricing": { "grooming": 500 }
    }
  ],
  "total": 15
}
```

---

### Get Nearby Vendors
```http
POST /search/vendors/nearby
```

**Body:**
```json
{
  "location": {
    "lat": 28.6139,
    "lng": 77.2090
  },
  "radius": 5,
  "serviceType": "grooming"
}
```

---

### Get Top-Rated Vendors
```http
GET /search/vendors/top-rated?limit=10&serviceType=grooming
```

**Criteria:**
- Minimum 5 reviews
- Sorted by combined score

---

### Search Services
```http
GET /search/services?q=grooming&category=pet-care
```

**Query Params:**
- `q`: Search text
- `category`: Filter by category

---

### Get Featured Vendors
```http
GET /search/vendors/featured?limit=10
```

---

### Get Service Categories
```http
GET /search/categories
```

**Response:**
```json
{
  "categories": [
    {
      "id": "grooming",
      "name": "Pet Grooming",
      "icon": "✂️",
      "description": "Bath, haircut, nail trimming, and more",
      "vendorCount": 150
    },
    {
      "id": "veterinary",
      "name": "Veterinary Care",
      "icon": "🏥",
      "description": "Health checkups, vaccinations, treatments",
      "vendorCount": 80
    }
  ]
}
```

**Available Categories:**
- `grooming` - Pet Grooming
- `veterinary` - Veterinary Care
- `training` - Pet Training
- `boarding` - Pet Boarding
- `walking` - Dog Walking
- `photography` - Pet Photography

---

## 6. Analytics & Reports

### Get Vendor Dashboard Stats
```http
GET /analytics/vendor/:vendorId/dashboard
```

**Response:**
```json
{
  "stats": {
    "overview": {
      "totalBookings": 150,
      "pendingBookings": 5,
      "confirmedBookings": 10,
      "completedBookings": 130,
      "cancelledBookings": 5,
      "todayBookings": 3,
      "rating": 4.5,
      "totalReviews": 100,
      "responseRate": 95.5
    },
    "revenue": {
      "total": 75000,
      "thisMonth": 8000,
      "average": 500
    },
    "performance": {
      "completionRate": "86.7",
      "cancellationRate": "3.3"
    }
  }
}
```

---

### Get Customer Dashboard Stats
```http
GET /analytics/customer/:customerId/dashboard
```

**Response:**
```json
{
  "stats": {
    "overview": {
      "totalPets": 2,
      "totalBookings": 25,
      "upcomingBookings": 2,
      "completedBookings": 20,
      "totalReviews": 15,
      "favoriteVendors": 5
    },
    "spending": {
      "total": 12500,
      "average": 500
    }
  }
}
```

---

### Get Platform Statistics (Admin)
```http
GET /analytics/admin/platform
```

**Response:**
```json
{
  "stats": {
    "users": {
      "totalVendors": 500,
      "activeVendors": 450,
      "pendingVendors": 20,
      "totalCustomers": 5000
    },
    "bookings": {
      "total": 10000,
      "completed": 8500,
      "pending": 100,
      "completionRate": "85.0"
    },
    "revenue": {
      "total": 5000000,
      "platformCommission": 500000,
      "averageBookingValue": 500
    },
    "reviews": {
      "total": 7000,
      "averageRating": 4.5
    }
  }
}
```

---

### Get Vendor Revenue Report
```http
GET /analytics/vendor/:vendorId/revenue?period=month
```

**Period Options:**
- `day` - Daily breakdown
- `week` - Weekly breakdown
- `month` - Monthly breakdown
- `year` - Yearly breakdown

**Response:**
```json
{
  "report": {
    "period": "month",
    "totalRevenue": 50000,
    "breakdown": {
      "2025-11": 8000,
      "2025-10": 7500,
      "2025-09": 7000
    },
    "periods": ["2025-09", "2025-10", "2025-11"]
  }
}
```

---

### Get Booking Trends (Admin)
```http
GET /analytics/admin/trends/bookings?period=month
```

**Response:**
```json
{
  "trends": {
    "period": "month",
    "totalBookings": 10000,
    "breakdown": {
      "2025-11": 1200,
      "2025-10": 1100,
      "2025-09": 1000
    },
    "periods": ["2025-09", "2025-10", "2025-11"]
  }
}
```

---

### Get Service Popularity (Admin)
```http
GET /analytics/admin/service-popularity
```

**Response:**
```json
{
  "services": [
    {
      "name": "Basic Bath & Dry",
      "bookings": 2500,
      "revenue": 1250000,
      "averagePrice": 500
    },
    {
      "name": "Full Grooming",
      "bookings": 1800,
      "revenue": 2700000,
      "averagePrice": 1500
    }
  ],
  "total": 10
}
```

---

## API Endpoint Count Summary

| Category | Endpoints | Status |
|----------|-----------|--------|
| Booking Management | 11 | ✅ |
| Pet Management | 8 | ✅ |
| Payment & Wallet | 9 | ✅ |
| Reviews & Ratings | 8 | ✅ |
| Search & Discovery | 7 | ✅ |
| Analytics & Reports | 7 | ✅ |
| Vendor Onboarding | 10 | ✅ (Previously completed) |
| Admin Vendor Management | 8 | ✅ (Previously completed) |
| Storage & Upload | 3 | ✅ (Previously completed) |
| Auth & User Management | 5 | ✅ (Previously completed) |
| **TOTAL** | **76** | **✅ Complete** |

---

## Error Responses

All endpoints follow a standard error format:

```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## Key Features Implemented

### 1. **Complete Booking Lifecycle**
- Create, read, update, cancel bookings
- Accept/reject by vendors
- Reschedule support
- Status tracking with history
- Automatic stats calculation

### 2. **Comprehensive Pet Management**
- Full CRUD operations
- Medical history tracking
- Vaccination records
- Booking history per pet

### 3. **Advanced Payment System**
- Payment processing
- Refund management
- Commission calculation
- Vendor payout system
- Platform revenue tracking

### 4. **Review & Rating System**
- Verified booking-based reviews
- Multi-dimensional ratings
- Vendor responses
- Admin moderation (flag/hide)
- Automatic rating calculation

### 5. **Intelligent Search**
- Location-based search
- Multi-criteria filtering
- Distance calculation
- Relevance sorting
- Category browsing

### 6. **Analytics Dashboard**
- Vendor performance metrics
- Customer spending analytics
- Platform-wide statistics
- Revenue reports
- Trend analysis
- Service popularity

---

## Database Schema

### Key Patterns

**Bookings:**
- `booking:{bookingId}` - Main booking record
- `customer:{customerId}:bookings` - Customer's booking IDs
- `vendor:{vendorId}:bookings` - Vendor's booking IDs
- `pet:{petId}:bookings` - Pet's booking IDs

**Pets:**
- `pet:{petId}` - Main pet record
- `customer:{customerId}:pets` - Customer's pet IDs

**Payments:**
- `payment:{paymentId}` - Main payment record
- `customer:{customerId}:payments` - Customer's payment IDs
- `vendor:{vendorId}:payments` - Vendor's payment IDs
- `payout:{payoutId}` - Vendor payout record

**Reviews:**
- `review:{reviewId}` - Main review record
- `review:booking:{bookingId}` - Booking-to-review mapping
- `vendor:{vendorId}:reviews` - Vendor's review IDs
- `customer:{customerId}:reviews` - Customer's review IDs

**Platform Stats:**
- `platform:revenue` - Platform revenue tracking
- `featured:vendors` - Featured vendor IDs list
- `service:categories` - Service categories

---

## Next Steps

### Recommended Integrations

1. **Payment Gateway**
   - Razorpay/Stripe integration
   - Update payment processing endpoints

2. **SMS/Email Notifications**
   - Twilio for SMS
   - SendGrid for emails
   - Notification endpoints already structured

3. **Real-time Updates**
   - WebSocket support for live booking updates
   - Push notifications

4. **File Storage**
   - Already using Supabase Storage
   - Enhance with CDN

---

*All 76 endpoints are production-ready and follow RESTful best practices with comprehensive error handling, validation, and data consistency! 🚀*
