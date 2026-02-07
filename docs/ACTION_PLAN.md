# Action Plan - Package Booking, GPS Tracking & Training Progress

## 🎯 Current Status

### ✅ Completed
- All backend API endpoints implemented and tested
- Frontend components created and integrated
- Route conflicts resolved
- Error handling improved
- Browser testing framework in place
- Customer ID and Pet ID retrieved: 
  - Customer: `0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b`
  - Pet: `3bce30ad-350f-42ff-9ec0-c0e8643099ee`

### ⏳ Ready for Testing
- Package booking flow (needs test package data)
- GPS tracking flow (needs active walk session)
- Training progress flow (needs training data)

## 📋 Immediate Actions Required

### 1. Database Migration (Priority: HIGH)
**Action**: Run migration `070_package_tracking_enhancements.sql`

```bash
# Connect to RDS and run:
psql -h <rds-endpoint> -U <user> -d <database> \
  -f db/migrations/070_package_tracking_enhancements.sql
```

**Verify**:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'package_purchases', 
  'package_scheduled_sessions',
  'walk_routes', 
  'walker_live_sessions',
  'training_skills', 
  'pet_skill_progress'
);
```

### 2. Create Test Package Purchase (Priority: HIGH)
**Option A: Via SQL** (Recommended for testing)
```sql
INSERT INTO package_purchases (
    purchase_id,
    package_id,
    customer_id,
    vendor_id,
    package_name,
    package_type,
    package_price,
    amount,
    total_sessions,
    remaining_sessions,
    status,
    payment_status,
    expires_at,
    created_at,
    updated_at
) VALUES (
    'pur_test_' || extract(epoch from now())::text,
    gen_random_uuid(),
    '0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b',  -- Customer ID
    '4dd488a2-54a9-4246-80b4-8b3e28636998',  -- Vendor ID
    '5 Session Vet Package',
    'appointment',
    2499.00,
    2499.00,
    5,
    3,
    'active',
    'completed',
    NOW() + INTERVAL '30 days',
    NOW(),
    NOW()
);
```

**Option B: Via API** (If package enrollment endpoint works)
```bash
./scripts/create-package-purchase.sh 9876543210 4dd488a2-54a9-4246-80b4-8b3e28636998 <package-id>
```

### 3. Create Test Walk Session (Priority: MEDIUM)
**Prerequisites**: 
- An existing booking for walk service
- Booking ID from the bookings table

```sql
-- First, get a booking ID for walk service
SELECT id FROM bookings 
WHERE customer_id = '0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b'
AND service_type = 'at_home'
LIMIT 1;

-- Then create active walk session (replace <booking_id>)
INSERT INTO walker_live_sessions (
    booking_id,
    walker_id,
    customer_id,
    current_lat,
    current_lng,
    is_active,
    started_at
) VALUES (
    '<booking_id>',
    '4dd488a2-54a9-4246-80b4-8b3e28636998',
    '0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b',
    19.0760,  -- Mumbai coordinates
    72.8777,
    true,
    NOW()
);
```

### 4. Create Test Training Data (Priority: MEDIUM)
```sql
-- Create training skills
INSERT INTO training_skills (name, description, category) VALUES
    ('Sit', 'Dog sits on command', 'basic'),
    ('Stay', 'Dog stays in position', 'basic'),
    ('Come', 'Dog comes when called', 'basic')
ON CONFLICT DO NOTHING;

-- Create pet skill progress
INSERT INTO pet_skill_progress (
    pet_id,
    customer_id,
    vendor_id,
    skill_id,
    progress_level,
    status
) VALUES (
    '3bce30ad-350f-42ff-9ec0-c0e8643099ee',  -- Pet ID
    '0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b',  -- Customer ID
    '4dd488a2-54a9-4246-80b4-8b3e28636998',  -- Vendor ID
    (SELECT id FROM training_skills WHERE name = 'Sit' LIMIT 1),
    75,
    'in_progress'
) ON CONFLICT DO NOTHING;
```

## 🧪 Testing Checklist

### Package Booking Flow
- [ ] Navigate to Vet Services
- [ ] Select a clinic/doctor
- [ ] Click "Book" on Clinic Visit
- [ ] Verify package modal appears (if package exists)
- [ ] Test "Use Package Session" option
- [ ] Test "Book New" option
- [ ] Complete booking
- [ ] Verify remaining sessions decremented

### GPS Tracking Flow
- [ ] Navigate to Walker Service
- [ ] Verify "Walk in Progress" card appears (if active walk exists)
- [ ] Click "Track" button
- [ ] Verify GPS tracking view loads
- [ ] Verify real-time location updates

### Training Progress Flow
- [ ] Navigate to Training Service
- [ ] Verify "Your Training" section appears (if package exists)
- [ ] Verify skill progress displayed
- [ ] Click "View Progress" to see full skill matrix
- [ ] Verify progress updates correctly

## 📊 Verification Commands

### Check Package Purchase
```bash
curl -s "${API_BASE}/customer/9876543210/packages" | jq
```

### Check Active Walks
```bash
curl -s "${API_BASE}/customer/9876543210/active-walks" | jq
```

### Check Pet Skills
```bash
curl -s "${API_BASE}/customer/9876543210/pet-skills" | jq
```

### Check Package for Booking
```bash
curl -s "${API_BASE}/packages/check-for-booking?phone=9876543210&vendorId=4dd488a2-54a9-4246-80b4-8b3e28636998" | jq
```

## 🚀 Quick Start

1. **Run Migration**:
   ```bash
   # Connect to RDS and run migration 070
   ```

2. **Create Test Data**:
   ```bash
   # Run SQL commands above to create:
   # - Package purchase
   # - Active walk session (if booking exists)
   # - Training skills and progress
   ```

3. **Verify Data**:
   ```bash
   ./scripts/test-package-gps-training-endpoints.sh 9876543210
   ```

4. **Test in Browser**:
   - Open: https://d2aoyjj8ine0wk.cloudfront.net
   - Login: 9876543210
   - Test package booking flow
   - Test GPS tracking flow
   - Test training progress flow

## 📝 Notes

- **Customer ID**: `0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b`
- **Pet ID**: `3bce30ad-350f-42ff-9ec0-c0e8643099ee`
- **Vendor ID**: `4dd488a2-54a9-4246-80b4-8b3e28636998`
- **Phone**: `9876543210`
- **API Base**: `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`

## ✅ Success Criteria

- [ ] Package purchase created and visible via API
- [ ] Package detection works in booking flow
- [ ] Active walk displays in Walker Service
- [ ] GPS tracking view loads correctly
- [ ] Training progress displays correctly
- [ ] All browser tests pass
