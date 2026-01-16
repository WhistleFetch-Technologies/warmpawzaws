#!/bin/bash

# Script to analyze services and vendors in the system
# This shows what services appear in the dashboard and which vendors they come from

echo "=========================================="
echo "Service & Vendor Analysis"
echo "=========================================="
echo ""

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 Service Discovery Endpoints:${NC}"
echo ""
echo "1. GET /customer/services"
echo "   - Returns all services from approved vendors"
echo "   - Filters by: category, roleId, serviceStyle, location"
echo "   - Source: vendors table + vendor_services table"
echo ""
echo "2. GET /vendor/:vendorId/services"
echo "   - Returns services for a specific vendor"
echo "   - Grouped by service style (at_home, at_center, tele)"
echo "   - Source: vendor_services table"
echo ""
echo "3. GET /customer/services/by-problem"
echo "   - Returns services filtered by pet problem"
echo "   - Source: services table + vendor_services"
echo ""
echo "4. GET /customer/services/integrated"
echo "   - Returns integrated services (ambulance, diagnostics, pharmacy)"
echo "   - Source: vendors with specific roles"
echo ""

echo -e "${BLUE}🏢 Vendor Service Sources:${NC}"
echo ""
echo "1. Vendor-Specific Services (vendor_services table):"
echo "   - Custom services created by vendors"
echo "   - Custom pricing and duration"
echo "   - Must be: is_enabled=true, publish_status IN ('published', 'auto_published')"
echo ""
echo "2. Global Services (services table):"
echo "   - Services with is_global=true"
echo "   - Available to all vendors"
echo "   - Vendors can override price/duration"
echo ""

echo -e "${BLUE}📋 Category to Role Mapping:${NC}"
echo ""
cat << 'MAPPING'
{
  'vet': ['vet_clinic', 'veterinarian'],
  'grooming': ['grooming_salon', 'pet_groomer', 'groomer'],
  'training': ['trainer', 'pet_trainer'],
  'walker': ['dog_walker', 'pet_walker'],
  'boarding': ['boarding_resort', 'pet_boarding'],
  'nutrition': ['nutritionist'],
  'adoption': ['ngo', 'shelter', 'breeder'],
  'marketplace': ['pet_store']
}
MAPPING
echo ""

echo -e "${BLUE}🎯 Service Visibility Rules:${NC}"
echo ""
echo "✓ Vendor must have: status='approved' AND is_active=true"
echo "✓ Service must have: is_enabled=true AND publish_status IN ('published', 'auto_published')"
echo "✓ Vendor's role must match requested category"
echo "✓ Vendor must support requested service style (from role config)"
echo ""

echo -e "${BLUE}🖥️  Frontend Components:${NC}"
echo ""
echo "1. CustomerServicesPage"
echo "   - Endpoint: /customer/services"
echo "   - Shows: Service name, vendor name, price, duration, style, rating"
echo ""
echo "2. IntegratedServicesHub"
echo "   - Endpoint: /services (fallback to hardcoded)"
echo "   - Shows: Vet, Grooming, Training, Walking, Boarding, Shop"
echo ""
echo "3. ServicesByProblem"
echo "   - Endpoint: /customer/services/by-problem"
echo "   - Shows: Services filtered by pet problem"
echo ""
echo "4. IntegratedServicesSelector"
echo "   - Endpoint: /customer/services/integrated"
echo "   - Shows: Ambulance, Diagnostics, Pharmacy"
echo ""

echo -e "${GREEN}✅ Summary:${NC}"
echo ""
echo "Services appear in the dashboard from:"
echo "  • Approved and active vendors"
echo "  • Vendor-specific services (vendor_services table)"
echo "  • Global services (services table with is_global=true)"
echo "  • Filtered by category, service style, location, and role"
echo "  • Only published and enabled services are shown"
echo ""
echo "Each service includes:"
echo "  • Service ID and name"
echo "  • Vendor ID and business name"
echo "  • Price and duration"
echo "  • Service style (at_home, at_center, tele)"
echo "  • Vendor rating (from reviews table)"
echo ""

echo -e "${YELLOW}💡 To see actual services and vendors:${NC}"
echo ""
echo "1. Query the database:"
echo "   SELECT v.business_name, vs.service_name, vs.price, vs.service_style"
echo "   FROM vendors v"
echo "   JOIN vendor_services vs ON v.id = vs.vendor_id"
echo "   WHERE v.status = 'approved' AND v.is_active = true"
echo "   AND vs.is_enabled = true"
echo "   AND vs.publish_status IN ('published', 'auto_published')"
echo ""
echo "2. Call the API endpoint:"
echo "   GET /customer/services?category=vet"
echo "   GET /customer/services?category=grooming&serviceStyle=at_home"
echo ""
