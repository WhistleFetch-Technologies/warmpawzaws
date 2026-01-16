# Staff & Individual Provider Comprehensive Implementation Plan

## Analysis Summary

### Current State:
1. ✅ Basic staff table exists with vendor_id (NOT NULL)
2. ✅ Basic staff_availability table (date, start_time, end_time, is_available)
3. ✅ Basic staff_services table (staff_id, service_id, price, duration)
4. ❌ No granular slot configuration (breaks, buffer, services per slot)
5. ❌ No location override per slot
6. ❌ No service-level lead time, buffer, radius
7. ❌ Individual providers not supported (vendor_id is NOT NULL)
8. ❌ No mandatory field enforcement
9. ❌ No staff dashboard
10. ❌ No staff independent login

### Requirements:

#### 1. Enhanced Availability Slots
- **Per Slot Configuration:**
  - Start/end time
  - Breaks (multiple breaks per slot)
  - Buffer time between services
  - Services allowed in this slot (many-to-many)
  - Lead time per service
  - Radius for home services
  - Location override (defaults to vendor location)

#### 2. Staff Service Management
- Staff can enable/disable services assigned by business
- Each service has:
  - Service styles (at_home, at_center, tele)
  - Lead time (minutes before service starts)
  - Buffer time (minutes after service ends)
  - Radius (km for home services)
- Goes live immediately (no approval)

#### 3. Location Management
- Default: Vendor location
- Override: Per slot with Google autocomplete
- Store: address, lat, lng, place_id

#### 4. Individual Providers
- Home Groomer, Veterinarian (no clinic), Trainer (no center)
- Same capabilities as staff
- No vendor_id (or NULL vendor_id)
- Direct listing in home/tele searches

#### 5. Mandatory Fields
- Photo (mandatory)
- Qualifications (degree/certifications)
- Specializations (at least one)

#### 6. Staff Dashboard
- Receive appointments
- Chat with customers
- GPS tracking for home visits
- OTP completion
- Revenue/earnings view
- Settlement tracking

#### 7. Discovery Logic
- Filter by:
  1. Schedule slots with service type configured
  2. Service styles match (at_home/tele)
  3. Radius check (customer within staff radius)
  4. Mobile verified = true
  5. Services enabled by staff

---

## Implementation Phases

### Phase 1: Database Schema Enhancements
- [ ] Enhanced staff_availability_slots table
- [ ] Staff service configuration table
- [ ] Location override table
- [ ] Individual provider support (vendor_id nullable)
- [ ] Mandatory fields enforcement

### Phase 2: Backend API Enhancements
- [ ] Slot CRUD with all configurations
- [ ] Staff service enable/disable
- [ ] Location management with Google autocomplete
- [ ] Individual provider creation
- [ ] Enhanced discovery with all filters

### Phase 3: Staff Dashboard
- [ ] Staff login (OTP)
- [ ] Appointment management
- [ ] Service management UI
- [ ] Schedule management UI
- [ ] Location management UI
- [ ] Revenue/earnings view

### Phase 4: Vendor Dashboard Updates
- [ ] Service assignment to staff
- [ ] Staff verification status
- [ ] Location override UI

### Phase 5: Customer Discovery Updates
- [ ] Filter by schedule slots
- [ ] Filter by service styles
- [ ] Radius filtering
- [ ] Show only verified providers

---

## Database Schema Design

### Enhanced Staff Availability Slots
```sql
CREATE TABLE staff_availability_slots (
    id UUID PRIMARY KEY,
    staff_id UUID NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    
    -- Location (defaults to vendor, can override)
    location_override JSONB, -- {address, lat, lng, place_id}
    
    -- Services allowed in this slot
    -- Stored in staff_slot_services table
    
    -- Breaks in this slot
    -- Stored in staff_slot_breaks table
    
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services per slot
CREATE TABLE staff_slot_services (
    id UUID PRIMARY KEY,
    slot_id UUID NOT NULL,
    service_id UUID NOT NULL,
    lead_time_minutes INTEGER DEFAULT 0,
    buffer_time_minutes INTEGER DEFAULT 0,
    radius_km NUMERIC(5,2), -- For home services
    UNIQUE(slot_id, service_id)
);

-- Breaks per slot
CREATE TABLE staff_slot_breaks (
    id UUID PRIMARY KEY,
    slot_id UUID NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT
);
```

### Staff Service Configuration
```sql
-- Enhanced staff_services with service styles and timing
ALTER TABLE staff_services ADD COLUMN IF NOT EXISTS
    service_styles TEXT[] DEFAULT '{}', -- ['at_home', 'at_center', 'tele']
    lead_time_minutes INTEGER DEFAULT 0,
    buffer_time_minutes INTEGER DEFAULT 0,
    radius_km NUMERIC(5,2), -- For at_home services
    enabled_by_staff BOOLEAN DEFAULT false; -- Staff can enable/disable
```

### Individual Provider Support
```sql
-- Make vendor_id nullable for individual providers
ALTER TABLE staff ALTER COLUMN vendor_id DROP NOT NULL;
ALTER TABLE staff ADD COLUMN is_individual_provider BOOLEAN DEFAULT false;

-- Add mandatory fields
ALTER TABLE staff ADD COLUMN IF NOT EXISTS
    photo TEXT, -- MANDATORY
    qualifications TEXT, -- MANDATORY (degree/certifications)
    default_location JSONB; -- {address, lat, lng, place_id}
```

---

## Next Steps

1. Create comprehensive migration
2. Update backend endpoints
3. Build staff dashboard
4. Update discovery logic
5. Test end-to-end flow
