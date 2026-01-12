# 📚 WARMPAWZ MOCK DATA SYSTEM DOCUMENTATION

**Last Updated:** January 2026  
**Phase:** Phase 1 - Mock Data Infrastructure

---

## 📋 OVERVIEW

The Warmpawz Mock Data System is a complete replacement for all Supabase/Backend dependencies. It provides:

- **Realistic mock data** for all entities (Customers, Vendors, Services, Bookings, Products, etc.)
- **Mock API functions** that mimic backend endpoints with async behavior
- **LocalStorage persistence** to maintain state across page refreshes
- **Type-safe operations** with full TypeScript support
- **Zero backend dependencies** - Pure frontend solution

---

## 📁 FILE STRUCTURE

```
/lib/
├── mockData.ts           # Core mock data (Users, Pets, Addresses, Vendor Roles)
├── mockDataExtended.ts   # Extended mock data (Services, Bookings, Products, Orders)
└── mockAPI.ts            # Mock API functions replacing backend calls
```

---

## 🎯 DATA ENTITIES

### **1. User Types**

#### Customer
```typescript
{
  id: string;
  phone: string;
  name: string;
  email: string;
  type: 'customer';
  pets: string[];              // Pet IDs
  addresses: string[];         // Address IDs
  wallet_balance: number;
  loyalty_points: number;
  created_at: string;
  profile_photo?: string;
}
```

**Mock Data:** 3 customers with complete profiles

#### Vendor
```typescript
{
  id: string;
  phone: string;
  name: string;
  email: string;
  type: 'vendor';
  role_id: string;             // References VendorRole
  business_type: 'solo' | 'business';
  business_name?: string;
  license_number?: string;
  status: 'pending' | 'under_review' | 'clarification_requested' | 
          'approved' | 'rejected' | 'active' | 'suspended';
  rating: number;
  reviews_count: number;
  location: { lat: number; lng: number; address: string };
  service_radius?: number;      // km
  services: string[];           // Service IDs
  staff?: string[];             // Staff IDs
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  verification_documents?: string[];
  admin_comments?: string;
  rejection_reason?: string;
  created_at: string;
}
```

**Mock Data:** 5 vendors across different roles (Vet, Groomer, Trainer)

#### Admin
```typescript
{
  id: string;
  phone: string;
  name: string;
  email: string;
  type: 'admin';
  role: 'super_admin' | 'vendor_manager' | 'support';
  permissions: string[];
  created_at: string;
}
```

**Mock Data:** 1 super admin

### **2. Pet Management**

#### Pet
```typescript
{
  id: string;
  owner_id: string;
  name: string;
  species: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  breed: string;
  age: number;
  gender: 'male' | 'female';
  weight: number;
  photo?: string;
  medical_history: MedicalRecord[];
  vaccinations: Vaccination[];
  allergies?: string[];
  special_notes?: string;
}
```

**Mock Data:** 5 pets owned by the 3 customers

#### Address
```typescript
{
  id: string;
  user_id: string;
  label: string;               // 'Home', 'Office', etc.
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  location: { lat: number; lng: number };
  is_default: boolean;
}
```

**Mock Data:** 4 addresses across Bangalore

### **3. Service Management**

#### Vendor Role
```typescript
{
  id: string;
  name: string;
  display_name: string;
  category: string;
  capabilities: string[];       // List of 45 capabilities
  service_styles: ('centre' | 'home' | 'tele')[];
  requires_license: boolean;
}
```

**Mock Data:** 10 vendor roles (Vet, Groomer, Trainer, Walker, Boarding, Nutritionist, Breeder, Insurance, Cafe, Seller)

#### Service
```typescript
{
  id: string;
  vendor_id: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  duration: number;            // minutes
  description: string;
  service_styles: ('centre' | 'home' | 'tele')[];
  is_active: boolean;
  specializations?: string[];
  problem_tags?: string[];
}
```

**Mock Data:** 13 services across different vendors and categories

#### Staff
```typescript
{
  id: string;
  vendor_id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  specializations?: string[];
  photo?: string;
  is_active: boolean;
  availability?: StaffAvailability[];
}
```

**Mock Data:** 4 staff members for business-type vendors

### **4. Booking System**

#### Booking
```typescript
{
  id: string;
  customer_id: string;
  vendor_id: string;
  service_id: string;
  pet_id: string;
  staff_id?: string;
  date: string;
  time: string;
  service_style: 'centre' | 'home' | 'tele';
  status: 'pending' | 'confirmed' | 'in_progress' | 
          'completed' | 'cancelled' | 'rescheduled';
  amount: number;
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_method?: 'wallet' | 'card' | 'upi' | 'cash';
  address_id?: string;
  otp_start?: string;           // For check-in
  otp_complete?: string;        // For completion
  notes?: string;
  prescription?: string;
  rating?: number;
  review?: string;
  created_at: string;
  updated_at: string;
}
```

**Mock Data:** 5 bookings with various statuses (confirmed, pending, completed)

#### Package
```typescript
{
  id: string;
  vendor_id: string;
  name: string;
  description: string;
  services: string[];           // Service IDs
  total_sessions: number;
  price: number;
  validity_days: number;
  is_active: boolean;
}
```

**Mock Data:** 2 packages (Training package, Grooming package)

### **5. E-commerce**

#### Product
```typescript
{
  id: string;
  seller_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  original_price?: number;
  discount?: number;
  images: string[];
  stock: number;
  rating: number;
  reviews_count: number;
  specifications?: Record<string, string>;
  is_active: boolean;
}
```

**Mock Data:** 5 products (Dog food, Feeder, GPS collar, Toy, Bed)

#### Order
```typescript
{
  id: string;
  customer_id: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  address_id: string;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'refunded';
  order_status: 'pending' | 'confirmed' | 'packed' | 'shipped' | 
                'out_for_delivery' | 'delivered' | 'cancelled';
  tracking_id?: string;
  created_at: string;
  updated_at: string;
}
```

**Mock Data:** 3 orders with different statuses

---

## 🔌 MOCK API USAGE

### **Authentication**

```typescript
import MockAPI from '@/lib/mockAPI';

// Send OTP
const result = await MockAPI.auth.sendOTP('+919876543210');
// Returns: { success: true, message: 'OTP sent successfully' }

// Verify OTP (use "123456" for any phone number)
const { user } = await MockAPI.auth.verifyOTP(
  '+919876543210',
  '123456',
  'customer'
);

// Get current session
const { user } = await MockAPI.auth.getSession();

// Logout
await MockAPI.auth.logout();
```

### **Customer Operations**

```typescript
// Get profile
const customer = await MockAPI.customer.getProfile('cust_001');

// Update profile
const updated = await MockAPI.customer.updateProfile('cust_001', {
  name: 'Rahul Kumar Updated'
});

// Get pets
const pets = await MockAPI.customer.getPets('cust_001');

// Add pet
const newPet = await MockAPI.customer.addPet({
  owner_id: 'cust_001',
  name: 'Buddy',
  species: 'dog',
  breed: 'Labrador',
  age: 2,
  gender: 'male',
  weight: 25
});

// Get addresses
const addresses = await MockAPI.customer.getAddresses('cust_001');

// Add address
const newAddress = await MockAPI.customer.addAddress({
  user_id: 'cust_001',
  label: 'Home',
  address_line1: '123 Street',
  city: 'Bangalore',
  state: 'Karnataka',
  pincode: '560001',
  location: { lat: 12.9716, lng: 77.5946 },
  is_default: true
});

// Update wallet
const newBalance = await MockAPI.customer.updateWalletBalance('cust_001', 1000);
```

### **Vendor Operations**

```typescript
// Get all roles
const roles = await MockAPI.vendor.getRoles();

// Submit application
const vendor = await MockAPI.vendor.submitApplication({
  phone: '+919876543250',
  name: 'Dr. New Vet',
  email: 'newvet@example.com',
  role_id: 'role_veterinarian',
  business_type: 'solo',
  license_number: 'VET/2026/001',
  location: { lat: 12.9716, lng: 77.5946, address: 'Bangalore' }
});

// Get vendor profile
const profile = await MockAPI.vendor.getProfile('vendor_001');

// Update profile
const updated = await MockAPI.vendor.updateProfile('vendor_001', {
  service_radius: 15
});

// Get services
const services = await MockAPI.vendor.getServices('vendor_001');

// Add service
const newService = await MockAPI.vendor.addService({
  vendor_id: 'vendor_001',
  name: 'X-Ray',
  category: 'Veterinary',
  price: 2000,
  duration: 30,
  description: 'Digital X-Ray service',
  service_styles: ['centre'],
  is_active: true
});

// Get bookings
const bookings = await MockAPI.vendor.getBookings('vendor_001');
const pendingBookings = await MockAPI.vendor.getBookings('vendor_001', 'pending');

// Update booking status
const updatedBooking = await MockAPI.vendor.updateBookingStatus(
  'booking_001',
  'confirmed'
);

// Get staff
const staff = await MockAPI.vendor.getStaff('vendor_002');

// Add staff
const newStaff = await MockAPI.vendor.addStaff({
  vendor_id: 'vendor_002',
  name: 'Dr. New Doctor',
  phone: '+919876543260',
  role: 'Veterinarian',
  is_active: true
});
```

### **Booking Operations**

```typescript
// Create booking
const booking = await MockAPI.booking.createBooking({
  customer_id: 'cust_001',
  vendor_id: 'vendor_001',
  service_id: 'service_001',
  pet_id: 'pet_001',
  date: '2026-01-20',
  time: '10:00',
  service_style: 'centre',
  status: 'pending',
  amount: 500,
  payment_status: 'paid',
  payment_method: 'wallet'
});

// Get booking
const booking = await MockAPI.booking.getBooking('booking_001');

// Get customer bookings
const myBookings = await MockAPI.booking.getCustomerBookings('cust_001');
const completed = await MockAPI.booking.getCustomerBookings('cust_001', 'completed');

// Update booking
const updated = await MockAPI.booking.updateBooking('booking_001', {
  status: 'confirmed'
});

// Cancel booking
const cancelled = await MockAPI.booking.cancelBooking(
  'booking_001',
  'Changed plans'
);

// Add review
const reviewed = await MockAPI.booking.addReview(
  'booking_001',
  5,
  'Excellent service!'
);
```

### **Search & Discovery**

```typescript
// Search vendors
const vets = await MockAPI.search.searchVendors({
  role: 'role_veterinarian',
  location: { lat: 12.9716, lng: 77.5946 },
  radius: 10,
  rating_min: 4.5
});

// Search services
const homeServices = await MockAPI.search.searchServices({
  service_style: 'home',
  category: 'Grooming',
  price_max: 1000
});

// Universal search
const results = await MockAPI.search.universalSearch('grooming');
// Returns: { vendors: [...], services: [...], products: [...] }
```

### **E-commerce Operations**

```typescript
// Get products
const products = await MockAPI.ecommerce.getProducts();
const foodProducts = await MockAPI.ecommerce.getProducts({
  category: 'Food'
});

// Get product
const product = await MockAPI.ecommerce.getProduct('product_001');

// Create order
const order = await MockAPI.ecommerce.createOrder({
  customer_id: 'cust_001',
  items: [
    {
      product_id: 'product_001',
      quantity: 1,
      price: 2499,
      seller_id: 'seller_001'
    }
  ],
  subtotal: 2499,
  delivery_fee: 0,
  tax: 450,
  total: 2949,
  address_id: 'addr_001',
  payment_method: 'upi',
  payment_status: 'paid',
  order_status: 'pending'
});

// Get customer orders
const orders = await MockAPI.ecommerce.getCustomerOrders('cust_001');

// Get order
const order = await MockAPI.ecommerce.getOrder('order_001');

// Update order status
const updated = await MockAPI.ecommerce.updateOrderStatus(
  'order_001',
  'shipped'
);
```

### **Admin Operations**

```typescript
// Get all vendors
const allVendors = await MockAPI.admin.getAllVendors();
const pending = await MockAPI.admin.getAllVendors('under_review');

// Update vendor status
const approved = await MockAPI.admin.updateVendorStatus(
  'vendor_001',
  'approved',
  'All documents verified'
);

// Get analytics
const stats = await MockAPI.admin.getAnalytics();
// Returns: {
//   total_vendors: 5,
//   active_vendors: 5,
//   pending_applications: 0,
//   total_bookings: 5,
//   total_revenue: 4800,
//   total_customers: 3
// }
```

---

## 💾 DATA PERSISTENCE

The mock data system uses **localStorage** to persist data across page refreshes.

### **Storage Keys**
- `warmpawz_customers` - Customer data
- `warmpawz_vendors` - Vendor data
- `warmpawz_pets` - Pet data
- `warmpawz_addresses` - Address data
- `warmpawz_services` - Service data
- `warmpawz_staff` - Staff data
- `warmpawz_bookings` - Booking data
- `warmpawz_packages` - Package data
- `warmpawz_products` - Product data
- `warmpawz_orders` - Order data
- `warmpawz_currentUser` - Current session

### **Reset Data**
To reset all data to default:
```javascript
localStorage.clear();
window.location.reload();
```

---

## 🔄 DATA FLOW

```
Component
    ↓
MockAPI Function
    ↓
In-Memory Data Array
    ↓
LocalStorage (Persistence)
    ↓
Return Updated Data
    ↓
Component Updates
```

---

## 📊 DATA STATISTICS

- **Customers:** 3
- **Vendors:** 5
- **Pets:** 5
- **Addresses:** 4
- **Vendor Roles:** 10
- **Services:** 13
- **Staff:** 4
- **Bookings:** 5
- **Packages:** 2
- **Products:** 5
- **Orders:** 3
- **Admins:** 1

**Total Entities:** 60+ mock records

---

## 🎯 MIGRATION CHECKLIST

### **Replace Backend Calls:**

1. ❌ **OLD (Supabase):**
   ```typescript
   const { data } = await supabase
     .from('customers')
     .select('*')
     .eq('id', customerId);
   ```

2. ✅ **NEW (Mock API):**
   ```typescript
   const customer = await MockAPI.customer.getProfile(customerId);
   ```

### **Replace Fetch Calls:**

1. ❌ **OLD (Backend API):**
   ```typescript
   const response = await fetch(`${API_URL}/api/bookings`, {
     method: 'POST',
     body: JSON.stringify(bookingData)
   });
   const booking = await response.json();
   ```

2. ✅ **NEW (Mock API):**
   ```typescript
   const booking = await MockAPI.booking.createBooking(bookingData);
   ```

---

## 🚀 NEXT STEPS

1. ✅ **Phase 1 Complete:** Mock data infrastructure created
2. ⏳ **Phase 2:** Migrate Customer App components
3. ⏳ **Phase 3:** Migrate Vendor App components
4. ⏳ **Phase 4:** Migrate Admin App components
5. ⏳ **Phase 5:** Remove all Supabase files
6. ⏳ **Phase 6:** Final testing and verification

---

**Documentation Version:** 1.0  
**Last Updated:** Phase 1 Completion
