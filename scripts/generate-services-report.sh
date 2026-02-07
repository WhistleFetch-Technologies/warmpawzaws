#!/bin/bash

# Comprehensive Services Report Generator
# Generates a report listing all services with prices, UI locations, and enabled vendors

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/SERVICES_REPORT.md"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Services Report Generator${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if API endpoint is available
API_ENDPOINT="${API_ENDPOINT:-https://api.warmpawz.com}"
echo -e "${BLUE}📡 API Endpoint: ${API_ENDPOINT}${NC}"
echo ""

# Service to UI Mapping
cat > "$OUTPUT_FILE" << 'REPORT_HEADER'
# Services Report - Complete Analysis

**Generated:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")

This report provides a comprehensive listing of all services in the system, including:
- Service names and prices
- Where they appear in the customer UI
- Which vendors have them enabled

---

REPORT_HEADER

# Function to fetch services from API
fetch_services() {
    local category=$1
    echo -e "${YELLOW}  Fetching ${category} services...${NC}"
    
    curl -s "${API_ENDPOINT}/customer/services?category=${category}" \
        -H "Content-Type: application/json" \
        2>/dev/null | jq -r '.services[]? | "\(.serviceName // .name) | ₹\(.price // .custom_price // .base_price // 0) | \(.duration // .duration_minutes // 30) min | \(.serviceStyle // "N/A") | \(.vendorName // "N/A")"' || echo "  ⚠ Could not fetch ${category} services"
}

# Generate report sections
echo -e "${BLUE}📊 Generating report sections...${NC}"
echo ""

# Add service categories
cat >> "$OUTPUT_FILE" << 'REPORT_SECTION'

## Service Categories & UI Locations

### 1. Vet Services
**UI Components:**
- `VetServiceRouter` - Main vet service router
- `VetServicesByStyle` - Services filtered by style (at_home, at_center, tele)
- `VetBookingRouter` - Booking flow router
- `CustomerServicesPage` - General services page (category=vet)
- `ServicesByProblem` - Problem-based service discovery
- `EmergencyBookingPage` - Emergency vet bookings

**Routes:**
- `/vet` - Main vet services page
- `/vet-booking` - Vet booking flow
- `/vet-services-by-style` - Services by delivery style
- `/services?category=vet` - General services with vet filter
- `/vet/emergency` - Emergency booking

**Screens:**
- `vet` - Main vet screen
- `vet-booking` - Booking screen
- `vet-services-by-style` - Style selection
- `emergency-booking` - Emergency booking

---

### 2. Grooming Services
**UI Components:**
- `GroomingServiceRouter` - Main grooming router
- `CustomerServicesPage` - General services page (category=grooming)
- `HomeServiceSelectionEnhanced` - Home service selection
- `ServicesByProblem` - Problem-based discovery

**Routes:**
- `/grooming` - Main grooming page
- `/services?category=grooming` - General services with grooming filter
- `/home-services` - Home services selection

**Screens:**
- `grooming` - Main grooming screen
- `grooming_center` - Center-based grooming
- `grooming_home` - Home visit grooming

---

### 3. Training Services
**UI Components:**
- `TrainingServiceRouter` - Main training router
- `CustomerServicesPage` - General services page (category=training)
- `HomeServiceSelectionEnhanced` - Home service selection
- `ServicesByProblem` - Problem-based discovery

**Routes:**
- `/training` - Main training page
- `/services?category=training` - General services with training filter
- `/home-services` - Home services selection

**Screens:**
- `training` - Main training screen

---

### 4. Walking Services
**UI Components:**
- `WalkerService` - Main walker service component
- `CustomerServicesPage` - General services page (category=walker)
- `HomeServiceSelectionEnhanced` - Home service selection

**Routes:**
- `/walker` - Main walker page
- `/services?category=walker` - General services with walker filter
- `/home-services` - Home services selection

**Screens:**
- `walker` - Main walker screen
- `walk` - Walk booking screen

---

### 5. Boarding Services
**UI Components:**
- `ResortBoardingBookingEnhanced` - Boarding booking component
- `CustomerServicesPage` - General services page (category=boarding)
- `ServicesByProblem` - Problem-based discovery

**Routes:**
- `/boarding` - Main boarding page
- `/services?category=boarding` - General services with boarding filter
- `/resort` - Resort boarding page

**Screens:**
- `boarding` - Main boarding screen
- `resort` - Resort booking screen

---

### 6. Nutrition Services
**UI Components:**
- `NutritionistServicesLanding` - Nutrition services landing page
- `CustomerServicesPage` - General services page (category=nutrition)
- `ServicesByProblem` - Problem-based discovery

**Routes:**
- `/nutrition` - Main nutrition page
- `/services?category=nutrition` - General services with nutrition filter

**Screens:**
- `nutritionist` - Nutritionist services screen

---

### 7. Integrated Services

#### Ambulance
**UI Components:**
- `AmbulanceServicesLanding` - Ambulance landing page
- `AmbulanceSOS` - Emergency SOS component
- `IntegratedServicesSelector` - Integrated services selector

**Routes:**
- `/ambulance` - Main ambulance page
- `/sos` - Emergency SOS

**Screens:**
- `ambulance` - Ambulance services
- `ambulance-sos` - Emergency SOS

#### Pharmacy
**UI Components:**
- `PharmacyServicesLanding` - Pharmacy landing page
- `IntegratedServicesSelector` - Integrated services selector
- `PharmacyCheckout` - Pharmacy checkout

**Routes:**
- `/pharmacy` - Main pharmacy page

**Screens:**
- `pharmacy` - Pharmacy services

#### Diagnostics
**UI Components:**
- `IntegratedServicesSelector` - Integrated services selector
- `CustomerServicesPage` - General services page

**Routes:**
- `/diagnostics` - Diagnostics page

**Screens:**
- `diagnostic` - Diagnostic services

---

### 8. Other Services

#### Cafe
**UI Components:**
- `PetCafeServicesLanding` - Cafe landing page
- `PetCafeListingZomatoStyle` - Cafe listing
- `CafeReservationFlow` - Cafe reservation flow

**Routes:**
- `/cafe` - Main cafe page
- `/cafes` - Cafes listing

**Screens:**
- `cafes` - Cafe services
- `cafe-reservation` - Cafe reservation

#### Photography
**UI Components:**
- `PhotographyServicesLanding` - Photography landing page

**Routes:**
- `/photography` - Photography page

**Screens:**
- `photography` - Photography services

#### Insurance
**UI Components:**
- `InsuranceServicesLanding` - Insurance landing page

**Routes:**
- `/insurance` - Insurance page

**Screens:**
- `insurance` - Insurance services

#### Breeder
**UI Components:**
- `BreederServicesLanding` - Breeder landing page
- `BreederCatalogView` - Breeder catalog

**Routes:**
- `/breeder` - Breeder page

**Screens:**
- `breeder` - Breeder services

#### Adoption
**UI Components:**
- `AdoptionQuestionnaire` - Adoption questionnaire
- `CustomerServicesPage` - General services page

**Routes:**
- `/adoption` - Adoption page

**Screens:**
- `adoption` - Adoption services

---

## Service Discovery Endpoints

### Main Endpoints

1. **GET /customer/services**
   - Returns all services from approved vendors
   - Filters: category, roleId, serviceStyle, location
   - Response includes: service name, price, duration, vendor info

2. **GET /vendor/:vendorId/services**
   - Returns services for specific vendor
   - Grouped by service style
   - Includes role and capabilities

3. **GET /customer/services/by-problem**
   - Returns services filtered by pet problem
   - Problem-based discovery

4. **GET /customer/services/integrated**
   - Returns integrated services (ambulance, diagnostics, pharmacy)
   - Location-based filtering

---

## Database Tables

### Key Tables

1. **services** - Base service catalog
   - `id`, `name`, `description`, `category`
   - `base_price`, `duration_minutes`
   - `is_global` - Available to all vendors
   - `is_active` - Service active status

2. **vendor_services** - Vendor-specific services
   - `vendor_id` - Vendor offering the service
   - `service_id` - Base service reference
   - `custom_price` - Vendor-specific price
   - `custom_duration` - Vendor-specific duration
   - `service_style` - at_home, at_center, tele
   - `is_enabled` - Service enabled for vendor
   - `publish_status` - published, auto_published, draft

3. **vendors** - Vendor information
   - `id`, `business_name`
   - `status` - approved, pending, rejected
   - `is_active` - Vendor active status
   - `role_id` - Vendor role (vet_clinic, groomer, etc.)

4. **roles** - Role definitions
   - `id`, `name`, `display_name`
   - `config` - Service style configurations

---

## Service Visibility Rules

Services appear in the customer UI when:

1. ✅ Vendor is approved and active
   - `vendors.status = 'approved'`
   - `vendors.is_active = true`

2. ✅ Service is enabled and published
   - `vendor_services.is_enabled = true`
   - `vendor_services.publish_status IN ('published', 'auto_published')`

3. ✅ Or service is global
   - `services.is_global = true`
   - Service available to all vendors

4. ✅ Vendor role matches category
   - Role must match requested service category

5. ✅ Service style is supported
   - Vendor's role config must allow the service style

---

## Category to Role Mapping

| Category | Role Names |
|----------|-----------|
| vet | vet_clinic, veterinarian |
| grooming | grooming_salon, pet_groomer, groomer |
| training | trainer, pet_trainer |
| walker | dog_walker, pet_walker |
| boarding | boarding_resort, pet_boarding |
| nutrition | nutritionist |
| adoption | ngo, shelter, breeder |
| marketplace | pet_store |

---

## Service Styles

| Style | Display Name | Description |
|-------|--------------|-------------|
| at_home | Home Visit | Service provided at customer's location |
| at_center | At Center/Clinic | Service provided at vendor's location |
| tele | Teleconsultation | Remote consultation service |

---

## Notes

- Prices shown are final prices (vendor custom_price or base_price)
- Duration shown is final duration (vendor custom_duration or base duration)
- Services can be offered in multiple styles by the same vendor
- Global services are available to all vendors unless overridden
- Vendor-specific services take precedence over global services

---

REPORT_SECTION

echo -e "${GREEN}✅ Report generated successfully!${NC}"
echo -e "${BLUE}📄 Output: ${OUTPUT_FILE}${NC}"
echo ""
echo -e "${YELLOW}💡 To generate a report with actual data:${NC}"
echo "  1. Use the SQL queries in: scripts/generate-services-report-sql.sql"
echo "  2. Run the Node.js script: node scripts/generate-services-report-api.js"
echo "  3. Ensure API_ENDPOINT environment variable is set"
echo ""
