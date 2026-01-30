# Solo Vendors and Their Enabled Services

## Summary
- **Total Solo Vendors:** 11
- **Total Enabled Services:** 23
  - **Tele Services:** 9
  - **At Home Services:** 14

## Vendor List

### 1. Dr. Ankit Sharma
- **ID:** `35dd312a-d982-4ed8-a3dd-a2700084e379`
- **Phone:** 9876543215
- **Email:** shivangtiwari7011@gmail.com
- **Status:** approved
- **Role:** Veterinarian (Solo) - `vet_solo`
- **Services:**
  - **TELE:** Tele-Consultation (draft, enabled)

### 2. HappyPaws Walker
- **ID:** `805d1d64-f072-4e64-8e7a-ec6a4f496696`
- **Phone:** 9876567890
- **Email:** happypaws.walker@testmail.com
- **Status:** approved
- **Role:** Pet Walker - `walker`
- **Services:**
  - **AT_HOME:** 30 Min Walk (published, enabled)
  - **AT_HOME:** 60 Min Walk (published, enabled)
  - **AT_HOME:** Jogging Session (published, enabled)
  - **AT_HOME:** Park Visit (published, enabled)

### 3. Neha Verma's Business
- **ID:** `c6779b52-cd3d-4380-a4a6-792c3bbe40e9`
- **Phone:** 9123456789
- **Email:** nehaverma@gmail.com
- **Status:** approved
- **Role:** Veterinarian (Solo) - `vet_solo`
- **Services:**
  - **AT_HOME:** Home Visit Consultation (draft, enabled)
  - **TELE:** Tele-Consultation (draft, enabled)

### 4. SAR center
- **ID:** `c31b60e5-4bab-4191-9afe-d7ebe770a328`
- **Phone:** 9899999999
- **Email:** sar@gmail.com
- **Status:** approved
- **Role:** Trainer (Solo) - `trainer_solo`
- **Services:**
  - **AT_HOME:** basic training (draft, enabled)
  - **AT_HOME:** Daily training (₹600, 30 min, published, enabled)

### 5. Taruna Infosoft
- **ID:** `2c10a6bc-a270-4e52-822b-7c8641bc05f2`
- **Phone:** 8349543490
- **Email:** shivangtiwari7011@gmail.com
- **Status:** approved
- **Role:** Veterinarian (Solo) - `vet_solo`
- **Services:**
  - **TELE:** Tele-Consultation (₹300, 20 min, published, enabled)

### 6. Test Business
- **ID:** `35f85e11-bf23-4c1c-802e-7ef41ceae1dd`
- **Phone:** 1234567891
- **Email:** shivangtiwari7011@gmail.com
- **Status:** pending
- **Role:** Veterinarian (Solo) - `vet_solo`
- **Services:**
  - **AT_HOME:** Home Service (₹800, 90 min, published, enabled)
  - **AT_HOME:** Home Visit Consultation (₹500, 60 min, published, enabled)
  - **TELE:** Tele-Consultation (₹300, 20 min, published, enabled)

### 7. Test Veterinary Clinic 1768332806685
- **ID:** `ebb6dd7e-a6ed-43cc-afbe-92dee857ee80`
- **Phone:** 9876505747
- **Email:** vendor-1768332805747@test.warmpawz.app
- **Status:** approved
- **Role:** Veterinarian (Solo) - `vet_solo`
- **Services:**
  - **AT_HOME:** Home Visit Consultation (₹800, 45 min, published, enabled)

### 8. Test Veterinary Clinic 1768332909135
- **ID:** `8eed8a1e-28bb-4bdb-8783-b69fccaebca0`
- **Phone:** 9876506561
- **Email:** vendor-1768332906561@test.warmpawz.app
- **Status:** approved
- **Role:** Veterinarian (Solo) - `vet_solo`
- **Services:**
  - **AT_HOME:** Home Visit Consultation (₹800, 45 min, published, enabled)
  - **TELE:** Instant Consultation (₹600, 20 min, published, enabled)

### 9. varun sharma's solo
- **ID:** `710b0765-fbeb-473c-ae08-c8451acdc343`
- **Phone:** 8123456780
- **Email:** varunsharma@gmail.com
- **Status:** approved
- **Role:** Veterinarian (Solo) - `vet_solo`
- **Services:**
  - **AT_HOME:** Home Service (published, enabled)
  - **AT_HOME:** Home Visit Consultation (published, enabled) - 2 instances
  - **TELE:** Tele-Consultation (published, enabled)

### 10. vet solo
- **ID:** `642e6f77-9063-469b-bd3b-34acd9bd5d2f`
- **Phone:** 9606901518
- **Email:** abhayankarbellur@gmail.com
- **Status:** approved
- **Role:** Veterinarian (Solo) - `vet_solo`
- **Services:**
  - **TELE:** Tele-Consultation (₹300, 20 min, published, enabled)

### 11. warmpawz testing
- **ID:** `49787e94-cdfc-4892-9048-9281a61eb36b`
- **Phone:** 9022336112
- **Email:** shivangtiwari7011@gmail.com
- **Status:** approved
- **Role:** Pet Nutritionist - `nutritionist`
- **Services:**
  - **TELE:** Custom Meal Plan (published, enabled)
  - **TELE:** Nutrition Consultation (published, enabled)

---

## API Endpoints to Query Solo Vendors

### 1. Discover Services Endpoint (Recommended)
**Endpoint:** `GET /customer/discover-services`

**Description:** Discovers vendors and services based on category, location, and service style. Automatically filters for solo vendors when querying `at_home` or `tele` services.

**Query Parameters:**
- `category` (optional): Service category (e.g., 'vet', 'grooming', 'training', 'walker', 'nutritionist')
- `serviceStyle` (optional): Service style filter ('tele', 'at_home', 'at_center', 'all')
- `latitude` (optional): Customer latitude for location-based filtering
- `longitude` (optional): Customer longitude for location-based filtering
- `radius` (optional): Search radius in kilometers
- `limit` (optional): Maximum number of results (default: 20)
- `offset` (optional): Pagination offset

**Example Requests:**
```bash
# Get all solo vendors with tele services
GET /customer/discover-services?serviceStyle=tele

# Get solo veterinarians with at_home services
GET /customer/discover-services?category=vet&serviceStyle=at_home

# Get solo vendors near a location
GET /customer/discover-services?serviceStyle=at_home&latitude=28.6139&longitude=77.2090&radius=10
```

**Response Format:**
```json
{
  "success": true,
  "providers": [
    {
      "id": "vendor-id",
      "name": "Vendor Name",
      "role": "vet_solo",
      "services": [
        {
          "id": "service-id",
          "name": "Service Name",
          "style": "tele",
          "price": 300,
          "duration": 20
        }
      ]
    }
  ],
  "total": 11
}
```

### 2. Services Endpoint
**Endpoint:** `GET /customer/services`

**Description:** Lists all available services. Can be filtered by category and service style.

**Query Parameters:**
- `category` (optional): Filter by service category
- `serviceStyle` (optional): Filter by service style ('tele', 'at_home', 'at_center')

**Example:**
```bash
GET /customer/services?serviceStyle=tele&category=vet
```

### 3. Vendor Services Endpoint
**Endpoint:** `GET /customer/vendor/:vendorId/services`

**Description:** Get all services for a specific vendor.

**Example:**
```bash
GET /customer/vendor/35dd312a-d982-4ed8-a3dd-a2700084e379/services
```

---

## Implementation Details

### Solo Vendor Identification Logic
Solo vendors are identified by:
1. Role name ending with `_solo` (e.g., `vet_solo`, `trainer_solo`)
2. `vendor_configuration = 'solo'` in vendors table
3. `metadata->>'vendorConfiguration' = 'solo'` in vendors table
4. Role config with `vendorConfiguration: 'solo'`

### Service Style Filtering
- **at_home:** Only solo vendors are returned (no clinics/businesses)
- **tele:** Only solo vendors are returned (no clinics/businesses)
- **at_center:** Only clinics/businesses are returned (no solo vendors)

### Code Location
- **Service Discovery Endpoint:** `backend/lambda/src/endpoints/service-discovery.ts`
- **Solo Vendor Query Logic:** Lines 546-589 in `service-discovery.ts`

---

## Staff Members and Their Services

### How Staff Services Work
For `at_home` and `tele` services, the system returns:
1. **Staff members** from clinics/businesses who have these services enabled
2. **Solo vendors** (individual providers) who offer these services

Staff members are linked to vendors (clinics/businesses) and can have services enabled through the `staff_services` table.

### Endpoint for Staff Services
**Same endpoint as solo vendors:** `GET /customer/discover-services`

**Query Parameters:**
- `serviceStyle=at_home` or `serviceStyle=tele` - Returns both staff and solo vendors
- `category` (optional) - Filter by service category
- `roleId` (optional) - Filter by role
- `specialization` (optional) - Filter by specialization (when from problem grid)

**Example:**
```bash
# Get all staff and solo vendors with at_home services
GET /customer/discover-services?serviceStyle=at_home

# Get staff and solo veterinarians with tele services
GET /customer/discover-services?serviceStyle=tele&category=vet
```

**Response includes:**
- `isStaffMember: true` - Indicates this is a staff member (not a solo vendor)
- `vendor` - The clinic/business the staff belongs to
- `isIndividualProvider: false` - Staff members are not individual providers

### Staff Services Query Logic
The endpoint queries staff members using:
1. **If `service_styles` column exists in `staff_services`:**
   - Filters by: `$1 = ANY(ss.service_styles)`
   
2. **If `service_style` column exists:**
   - Filters by: `ss.service_style = $1`
   
3. **Fallback (if neither exists):**
   - Uses `vendor_services` table to find services with the matching `service_style`
   - Links staff to vendor and then to vendor_services

### Database Tables
- **`staff`** - Staff member information
- **`staff_services`** - Links staff to services (may have `service_styles` array or `service_style` column)
- **`vendor_services`** - Vendor-level services (used as fallback)
- **`services`** - Service catalog

### Script to List Staff Services
A script is available to list staff and their services:
```bash
export DB_HOST="your-rds-endpoint"
export DB_NAME="warmpawz"
export DB_SECRET_ARN="your-secret-arn"
node scripts/list-staff-services.js
```

**Current Status:**
- **Total Active Staff:** 35
- **Total Active Staff Services:** 0 (no services configured yet)
- **Vendors with Staff:** 24

**Note:** Currently, there are no staff members with enabled `at_home` or `tele` services in the database. Staff services are typically configured when:
- A clinic/business adds staff members
- Staff members are assigned services with `at_home` or `tele` styles
- Services are enabled in the `staff_services` table

---

## Base URL
The API base URL depends on your deployment:
- **Development:** `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`
- **Production:** (Check your API Gateway endpoint)

Full endpoint example:
```
https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/discover-services?serviceStyle=tele&category=vet
```
