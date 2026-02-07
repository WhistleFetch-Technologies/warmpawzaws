# Next Steps - Database Migrations & Schema Updates

## Date: 2026-01-12

## 🎯 Objective

Fix 38 failing endpoints by creating missing database tables and updating schemas.

---

## 📊 Current Status

- ✅ **73 endpoints** verified in codebase
- ✅ **39 endpoints** working (HTTP 200/404)
- ❌ **38 endpoints** failing due to database schema issues
- ✅ **5 newly created endpoints** fully functional
- ⚠️ **3 newly created endpoints** need database tables

---

## 🔧 Database Tables to Create

### 1. Medical & Health Records

#### `prescriptions` Table
```sql
CREATE TABLE IF NOT EXISTS prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  customer_id UUID REFERENCES customers(id),
  pet_id UUID REFERENCES pets(id),
  booking_id UUID REFERENCES bookings(id),
  prescription_date DATE NOT NULL,
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  instructions TEXT,
  doctor_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prescriptions_vendor ON prescriptions(vendor_id);
CREATE INDEX idx_prescriptions_customer ON prescriptions(customer_id);
CREATE INDEX idx_prescriptions_pet ON prescriptions(pet_id);
```

#### `medical_records` Table
```sql
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  customer_id UUID REFERENCES customers(id),
  pet_id UUID REFERENCES pets(id),
  booking_id UUID REFERENCES bookings(id),
  record_type VARCHAR(50) NOT NULL, -- 'vaccination', 'checkup', 'surgery', 'treatment'
  record_date DATE NOT NULL,
  title VARCHAR(255),
  description TEXT,
  diagnosis TEXT,
  treatment TEXT,
  veterinarian_name VARCHAR(255),
  attachments JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_medical_records_vendor ON medical_records(vendor_id);
CREATE INDEX idx_medical_records_pet ON medical_records(pet_id);
CREATE INDEX idx_medical_records_type ON medical_records(record_type);
```

#### `diagnostic_tests` Table
```sql
CREATE TABLE IF NOT EXISTS diagnostic_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  test_name VARCHAR(255) NOT NULL,
  test_category VARCHAR(100),
  description TEXT,
  price DECIMAL(10, 2),
  duration_minutes INTEGER,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_diagnostic_tests_vendor ON diagnostic_tests(vendor_id);
```

---

### 2. Service & Package Management

#### `service_packages` Table
```sql
CREATE TABLE IF NOT EXISTS service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  package_name VARCHAR(255) NOT NULL,
  service_type VARCHAR(100) NOT NULL, -- 'training', 'grooming', 'boarding', etc.
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration_days INTEGER,
  sessions_included INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_packages_vendor ON service_packages(vendor_id);
CREATE INDEX idx_service_packages_type ON service_packages(service_type);
```

#### `package_sessions` Table
```sql
CREATE TABLE IF NOT EXISTS package_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES service_packages(id),
  booking_id UUID REFERENCES bookings(id),
  customer_id UUID REFERENCES customers(id),
  session_number INTEGER NOT NULL,
  session_date DATE,
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  notes TEXT,
  progress_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_package_sessions_package ON package_sessions(package_id);
CREATE INDEX idx_package_sessions_booking ON package_sessions(booking_id);
```

---

### 3. Tracking & Location

#### `gps_tracking_sessions` Table
```sql
CREATE TABLE IF NOT EXISTS gps_tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  vendor_id UUID REFERENCES vendors(id),
  customer_id UUID REFERENCES customers(id),
  session_start TIMESTAMP NOT NULL,
  session_end TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  route_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gps_tracking_booking ON gps_tracking_sessions(booking_id);
CREATE INDEX idx_gps_tracking_vendor ON gps_tracking_sessions(vendor_id);
```

---

### 4. Scheduling & Availability

#### `vendor_availability_v2` Table
```sql
CREATE TABLE IF NOT EXISTS vendor_availability_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  staff_id UUID REFERENCES staff(id),
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  service_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_availability_v2_vendor ON vendor_availability_v2(vendor_id);
CREATE INDEX idx_vendor_availability_v2_staff ON vendor_availability_v2(staff_id);
CREATE INDEX idx_vendor_availability_v2_day ON vendor_availability_v2(day_of_week);
```

---

### 5. Financial & Settlements

#### `vendor_settlements` Table
```sql
CREATE TABLE IF NOT EXISTS vendor_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  total_revenue DECIMAL(10, 2) NOT NULL,
  commission_amount DECIMAL(10, 2) NOT NULL,
  payout_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  booking_ids UUID[],
  payment_reference VARCHAR(255),
  settled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_settlements_vendor ON vendor_settlements(vendor_id);
CREATE INDEX idx_vendor_settlements_status ON vendor_settlements(status);
```

---

### 6. Specialized Services

#### `ambulance_vehicles` Table
```sql
CREATE TABLE IF NOT EXISTS ambulance_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  vehicle_number VARCHAR(50) NOT NULL UNIQUE,
  vehicle_type VARCHAR(50), -- 'basic', 'advanced', 'critical'
  driver_id UUID REFERENCES staff(id),
  current_status VARCHAR(50) DEFAULT 'available', -- 'available', 'on_duty', 'maintenance'
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  equipment JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ambulance_vehicles_vendor ON ambulance_vehicles(vendor_id);
CREATE INDEX idx_ambulance_vehicles_status ON ambulance_vehicles(current_status);
```

#### `meal_plans` Table
```sql
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  plan_name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_days INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  meals_per_day INTEGER DEFAULT 2,
  dietary_requirements JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meal_plans_vendor ON meal_plans(vendor_id);
```

#### `holiday_packages` Table
```sql
CREATE TABLE IF NOT EXISTS holiday_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  package_name VARCHAR(255) NOT NULL,
  description TEXT,
  destination VARCHAR(255),
  duration_days INTEGER NOT NULL,
  price_per_pet DECIMAL(10, 2) NOT NULL,
  max_pets INTEGER,
  itinerary JSONB,
  inclusions JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_holiday_packages_vendor ON holiday_packages(vendor_id);
```

---

### 7. Communication & Reviews

#### `video_call_sessions` Table
```sql
CREATE TABLE IF NOT EXISTS video_call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  vendor_id UUID REFERENCES vendors(id),
  customer_id UUID REFERENCES customers(id),
  session_start TIMESTAMP NOT NULL,
  session_end TIMESTAMP,
  duration_minutes INTEGER,
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'cancelled'
  meeting_url VARCHAR(500),
  recording_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_video_call_sessions_booking ON video_call_sessions(booking_id);
CREATE INDEX idx_video_call_sessions_vendor ON video_call_sessions(vendor_id);
```

#### `reviews` Table
```sql
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  customer_id UUID REFERENCES customers(id),
  booking_id UUID REFERENCES bookings(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  service_type VARCHAR(100),
  is_verified BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_vendor ON reviews(vendor_id);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
```

---

## 🔧 Schema Updates Needed

### 1. Payments Table
Add missing columns:
```sql
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);
```

### 2. Products/Medicines Table
Add missing column:
```sql
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category VARCHAR(100);
```

### 3. Staff Availability Table
Add missing column:
```sql
ALTER TABLE staff_availability 
ADD COLUMN IF NOT EXISTS available_date DATE;
```

---

## 📝 Migration Script

Create a migration file: `backend/migrations/001_vendor_capabilities_tables.sql`

```sql
-- Migration: Create tables for vendor capabilities endpoints
-- Date: 2026-01-12

BEGIN;

-- Medical & Health Records
CREATE TABLE IF NOT EXISTS prescriptions (...);
CREATE TABLE IF NOT EXISTS medical_records (...);
CREATE TABLE IF NOT EXISTS diagnostic_tests (...);

-- Service & Package Management
CREATE TABLE IF NOT EXISTS service_packages (...);
CREATE TABLE IF NOT EXISTS package_sessions (...);

-- Tracking & Location
CREATE TABLE IF NOT EXISTS gps_tracking_sessions (...);

-- Scheduling & Availability
CREATE TABLE IF NOT EXISTS vendor_availability_v2 (...);

-- Financial & Settlements
CREATE TABLE IF NOT EXISTS vendor_settlements (...);

-- Specialized Services
CREATE TABLE IF NOT EXISTS ambulance_vehicles (...);
CREATE TABLE IF NOT EXISTS meal_plans (...);
CREATE TABLE IF NOT EXISTS holiday_packages (...);

-- Communication & Reviews
CREATE TABLE IF NOT EXISTS video_call_sessions (...);
CREATE TABLE IF NOT EXISTS reviews (...);

-- Schema Updates
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS category VARCHAR(100);

ALTER TABLE staff_availability 
ADD COLUMN IF NOT EXISTS available_date DATE;

COMMIT;
```

---

## ✅ Verification Steps

After running migrations:

1. **Re-run test script**:
   ```bash
   export API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
   export VENDOR_ID="test-vendor-id"
   ./test-vendor-capabilities-curl-verified.sh
   ```

2. **Check newly created endpoint**:
   ```bash
   curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/bookings/available-slots?vendorId=test-vendor-id&date=2026-01-12"
   ```

3. **Verify database tables**:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
     'prescriptions', 'medical_records', 'diagnostic_tests',
     'service_packages', 'package_sessions', 'gps_tracking_sessions',
     'vendor_availability_v2', 'vendor_settlements', 'ambulance_vehicles',
     'meal_plans', 'holiday_packages', 'video_call_sessions', 'reviews'
   );
   ```

---

## 🎯 Priority Order

### Phase 1: Critical (Newly Created Endpoints)
1. ✅ `prescriptions` table
2. ✅ `medical_records` table
3. ✅ `vendor_settlements` table (for reports)

### Phase 2: High Priority (Frequently Used)
4. ✅ `service_packages` table
5. ✅ `gps_tracking_sessions` table
6. ✅ `vendor_availability_v2` table
7. ✅ `reviews` table

### Phase 3: Medium Priority (Specialized Services)
8. ✅ `diagnostic_tests` table
9. ✅ `ambulance_vehicles` table
10. ✅ `meal_plans` table
11. ✅ `holiday_packages` table
12. ✅ `package_sessions` table
13. ✅ `video_call_sessions` table

### Phase 4: Schema Updates
14. ✅ Add `commission_amount` to payments
15. ✅ Add `total_amount` to payments
16. ✅ Add `category` to products
17. ✅ Add `available_date` to staff_availability

---

## 📋 Action Items

- [ ] Create migration script with all table definitions
- [ ] Run migration on development database
- [ ] Verify tables created successfully
- [ ] Re-test all 73 endpoints
- [ ] Test new `/bookings/available-slots` endpoint
- [ ] Update test results documentation
- [ ] Deploy migrations to staging/production

---

**Status**: Ready for database migration execution
