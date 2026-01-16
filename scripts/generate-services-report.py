#!/usr/bin/env python3
"""
Services Report Generator
Generates a comprehensive report of all services with prices, UI locations, and enabled vendors.
"""

import os
import sys
import json
import requests
from datetime import datetime
from typing import List, Dict, Any

# Configuration
API_ENDPOINT = os.getenv('API_ENDPOINT', 'https://api.warmpawz.com')
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'SERVICES_REPORT.md')

# Service to UI Component Mapping
SERVICE_UI_MAPPING = {
    'vet': {
        'components': [
            'VetServiceRouter',
            'VetServicesByStyle',
            'VetBookingRouter',
            'CustomerServicesPage (category=vet)',
            'ServicesByProblem (vet-related)',
            'EmergencyBookingPage'
        ],
        'routes': ['/vet', '/vet-booking', '/services?category=vet', '/vet/emergency'],
        'screens': ['vet', 'vet-booking', 'vet-services-by-style', 'emergency-booking']
    },
    'grooming': {
        'components': [
            'GroomingServiceRouter',
            'CustomerServicesPage (category=grooming)',
            'HomeServiceSelectionEnhanced',
            'ServicesByProblem (grooming-related)'
        ],
        'routes': ['/grooming', '/services?category=grooming', '/home-services'],
        'screens': ['grooming', 'grooming_center', 'grooming_home']
    },
    'training': {
        'components': [
            'TrainingServiceRouter',
            'CustomerServicesPage (category=training)',
            'HomeServiceSelectionEnhanced',
            'ServicesByProblem (training-related)'
        ],
        'routes': ['/training', '/services?category=training', '/home-services'],
        'screens': ['training']
    },
    'walker': {
        'components': [
            'WalkerService',
            'CustomerServicesPage (category=walker)',
            'HomeServiceSelectionEnhanced'
        ],
        'routes': ['/walker', '/services?category=walker', '/home-services'],
        'screens': ['walker', 'walk']
    },
    'boarding': {
        'components': [
            'ResortBoardingBookingEnhanced',
            'CustomerServicesPage (category=boarding)',
            'ServicesByProblem (boarding-related)'
        ],
        'routes': ['/boarding', '/services?category=boarding', '/resort'],
        'screens': ['boarding', 'resort']
    },
    'nutrition': {
        'components': [
            'NutritionistServicesLanding',
            'CustomerServicesPage (category=nutrition)',
            'ServicesByProblem'
        ],
        'routes': ['/nutrition', '/services?category=nutrition'],
        'screens': ['nutritionist']
    },
    'ambulance': {
        'components': [
            'AmbulanceServicesLanding',
            'AmbulanceSOS',
            'IntegratedServicesSelector'
        ],
        'routes': ['/ambulance', '/sos'],
        'screens': ['ambulance', 'ambulance-sos']
    },
    'pharmacy': {
        'components': [
            'PharmacyServicesLanding',
            'IntegratedServicesSelector',
            'PharmacyCheckout'
        ],
        'routes': ['/pharmacy'],
        'screens': ['pharmacy']
    },
    'cafe': {
        'components': [
            'PetCafeServicesLanding',
            'PetCafeListingZomatoStyle',
            'CafeReservationFlow'
        ],
        'routes': ['/cafe', '/cafes'],
        'screens': ['cafes', 'cafe-reservation']
    }
}

SERVICE_STYLES = {
    'at_home': 'Home Visit',
    'at_center': 'At Center/Clinic',
    'tele': 'Teleconsultation'
}

def fetch_services_from_api(category: str) -> List[Dict[str, Any]]:
    """Fetch services for a category from the API."""
    try:
        url = f"{API_ENDPOINT}/customer/services"
        params = {'category': category}
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('services'):
                return data['services']
        return []
    except Exception as e:
        print(f"  ⚠ Error fetching {category} services: {e}")
        return []

def fetch_all_services() -> List[Dict[str, Any]]:
    """Fetch all services from all categories."""
    categories = ['vet', 'grooming', 'training', 'walker', 'boarding', 'nutrition']
    all_services = []
    
    print("📡 Fetching services from API...")
    for category in categories:
        print(f"  Fetching {category} services...")
        services = fetch_services_from_api(category)
        for service in services:
            service['category'] = category
            all_services.append(service)
        print(f"  ✓ Found {len(services)} {category} services")
    
    return all_services

def generate_report(services: List[Dict[str, Any]]) -> str:
    """Generate the markdown report."""
    report = []
    
    # Header
    report.append("# Services Report - Complete Analysis")
    report.append("")
    report.append(f"**Generated:** {datetime.utcnow().isoformat()}Z")
    report.append(f"**Total Services:** {len(services)}")
    report.append("")
    report.append("---")
    report.append("")
    
    # Group by category
    by_category = {}
    for service in services:
        category = service.get('category', 'other')
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(service)
    
    # Generate detailed report for each category
    for category in sorted(by_category.keys()):
        cat_services = by_category[category]
        ui_mapping = SERVICE_UI_MAPPING.get(category, {
            'components': ['CustomerServicesPage'],
            'routes': [f'/services?category={category}'],
            'screens': [category]
        })
        
        report.append(f"## {category.upper()} Services ({len(cat_services)})")
        report.append("")
        
        # Table header
        report.append("| Service Name | Price | Duration | Style | Vendor | UI Components | Routes |")
        report.append("|-------------|-------|----------|-------|--------|---------------|--------|")
        
        # Table rows
        for service in cat_services:
            name = service.get('serviceName') or service.get('name') or 'N/A'
            price = service.get('price') or service.get('custom_price') or service.get('base_price') or 0
            duration = service.get('duration') or service.get('duration_minutes') or service.get('custom_duration') or 30
            style = service.get('serviceStyle') or service.get('service_style') or 'N/A'
            style_display = SERVICE_STYLES.get(style, style)
            vendor = service.get('vendorName') or service.get('vendor_name') or 'N/A'
            
            components = ', '.join(ui_mapping['components'])
            routes = ', '.join(ui_mapping['routes'])
            
            report.append(f"| {name} | ₹{price} | {duration} min | {style_display} | {vendor} | {components} | {routes} |")
        
        report.append("")
        report.append("### UI Details")
        report.append("")
        report.append(f"- **Components:** {', '.join(ui_mapping['components'])}")
        report.append(f"- **Routes:** {', '.join(ui_mapping['routes'])}")
        report.append(f"- **Screens:** {', '.join(ui_mapping['screens'])}")
        report.append("")
        report.append("---")
        report.append("")
    
    # Summary
    report.append("## Summary Statistics")
    report.append("")
    report.append("### Services by Category")
    for category in sorted(by_category.keys()):
        report.append(f"- **{category}**: {len(by_category[category])} services")
    report.append("")
    
    # Services by style
    by_style = {}
    for service in services:
        style = service.get('serviceStyle') or service.get('service_style') or 'unknown'
        by_style[style] = by_style.get(style, 0) + 1
    
    report.append("### Services by Style")
    for style in sorted(by_style.keys()):
        display = SERVICE_STYLES.get(style, style)
        report.append(f"- **{display}**: {by_style[style]} services")
    report.append("")
    
    # Price statistics
    prices = []
    for service in services:
        price = service.get('price') or service.get('custom_price') or service.get('base_price')
        if price and isinstance(price, (int, float)) and price > 0:
            prices.append(float(price))
    
    if prices:
        report.append("### Price Range")
        report.append(f"- **Min Price**: ₹{min(prices)}")
        report.append(f"- **Max Price**: ₹{max(prices)}")
        report.append(f"- **Average Price**: ₹{round(sum(prices) / len(prices), 2)}")
        report.append("")
    
    return '\n'.join(report)

def main():
    """Main function."""
    print("🚀 Starting Services Report Generation...")
    print(f"📡 API Endpoint: {API_ENDPOINT}")
    print("")
    
    try:
        # Fetch services
        services = fetch_all_services()
        
        if not services:
            print("⚠ No services found. Using template report.")
            print("  To generate a real report, ensure:")
            print("  1. API_ENDPOINT environment variable is set correctly")
            print("  2. API is accessible and returns services")
            print("  3. Or use the SQL queries in scripts/generate-services-report-sql.sql")
            return
        
        print("")
        print(f"✅ Fetched {len(services)} services")
        print("")
        
        # Generate report
        report = generate_report(services)
        
        # Write to file
        with open(OUTPUT_FILE, 'w') as f:
            f.write(report)
        
        print("✅ Report generated successfully!")
        print(f"📄 Output: {OUTPUT_FILE}")
        print("")
        print("📊 Report includes:")
        print("  - All services with prices and durations")
        print("  - UI component mappings")
        print("  - Route information")
        print("  - Vendor information")
        print("  - Summary statistics")
        
    except Exception as e:
        print(f"❌ Error generating report: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
