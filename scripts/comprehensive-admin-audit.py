#!/usr/bin/env python3
"""
Comprehensive Admin Web Audit Script
Checks API contracts, Lambda functions, and DB status
"""

import re
import os
import json
from pathlib import Path
from collections import defaultdict

# Colors for output
GREEN = '\033[0;32m'
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
CYAN = '\033[0;36m'
NC = '\033[0m'

def extract_ui_endpoints():
    """Extract all API calls from Admin UI"""
    ui_endpoints = defaultdict(lambda: {'methods': set(), 'files': []})
    admin_path = Path("apps/admin-web")
    
    for file_path in admin_path.rglob("*.tsx"):
        try:
            content = file_path.read_text(encoding='utf-8')
            matches = re.findall(r'apiClient\.(get|post|put|patch|delete)\(["\']([^"\']+)["\']', content, re.IGNORECASE)
            for method, endpoint in matches:
                clean = endpoint.split('?')[0].split('#')[0]
                ui_endpoints[clean]['methods'].add(method.upper())
                ui_endpoints[clean]['files'].append(str(file_path))
        except Exception as e:
            pass
    
    return ui_endpoints

def extract_lambda_endpoints():
    """Extract all endpoints from Lambda handlers"""
    lambda_endpoints = defaultdict(set)
    endpoints_path = Path("backend/lambda/src/endpoints")
    
    for file_path in endpoints_path.rglob("*.ts"):
        try:
            content = file_path.read_text(encoding='utf-8')
            # Find app.get, app.post, etc.
            matches = re.findall(r'app\.(get|post|put|patch|delete)\(["\']([^"\"]+)["\']', content, re.IGNORECASE)
            for method, endpoint in matches:
                clean = endpoint.split('?')[0].split('#')[0]
                lambda_endpoints[clean].add(method.upper())
        except Exception as e:
            pass
    
    return lambda_endpoints

def check_handler_registration(endpoint):
    """Check if endpoint is registered in handler/index.ts"""
    handler_file = Path("backend/lambda/src/handler/index.ts")
    if not handler_file.exists():
        return False
    
    try:
        content = handler_file.read_text(encoding='utf-8')
        # Check if endpoint file is imported and registered
        # This is a simplified check - we look for endpoint patterns
        return endpoint in content or endpoint.replace('/admin/', '') in content
    except:
        return False

def check_database_tables():
    """Check which tables exist in migrations"""
    tables = set()
    migrations_path = Path("db/migrations")
    
    for file_path in migrations_path.rglob("*.sql"):
        try:
            content = file_path.read_text(encoding='utf-8')
            # Find CREATE TABLE statements
            matches = re.findall(r'CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)', content, re.IGNORECASE)
            for table in matches:
                tables.add(table.lower())
        except:
            pass
    
    return tables

def normalize_endpoint(endpoint):
    """Normalize endpoint for comparison"""
    # Remove leading/trailing slashes
    endpoint = endpoint.strip('/')
    # Handle parameterized routes
    endpoint = re.sub(r':\w+', '*', endpoint)
    return endpoint

def match_endpoint(ui_endpoint, lambda_endpoints):
    """Try to match UI endpoint with Lambda endpoint"""
    ui_normalized = normalize_endpoint(ui_endpoint)
    
    for lambda_endpoint in lambda_endpoints.keys():
        lambda_normalized = normalize_endpoint(lambda_endpoint)
        
        # Exact match
        if ui_normalized == lambda_normalized:
            return lambda_endpoint
        
        # Match without /admin prefix
        if ui_endpoint.startswith('/admin/'):
            ui_without_prefix = ui_endpoint[7:]  # Remove '/admin/'
            if lambda_endpoint == ui_without_prefix or lambda_endpoint.endswith(ui_without_prefix):
                return lambda_endpoint
        
        # Partial match (for parameterized routes)
        if ui_normalized.replace('*', '') in lambda_normalized.replace('*', ''):
            return lambda_endpoint
    
    return None

def main():
    print(f"{CYAN}╔════════════════════════════════════════════════════════════╗{NC}")
    print(f"{CYAN}║   COMPREHENSIVE ADMIN WEB AUDIT                          ║{NC}")
    print(f"{CYAN}╚════════════════════════════════════════════════════════════╝{NC}\n")
    
    # Step 1: Extract UI endpoints
    print(f"{BLUE}📋 Step 1: Extracting API calls from Admin UI...{NC}")
    ui_endpoints = extract_ui_endpoints()
    print(f"   Found {GREEN}{len(ui_endpoints)}{NC} unique endpoints\n")
    
    # Step 2: Extract Lambda endpoints
    print(f"{BLUE}📋 Step 2: Extracting endpoints from Lambda handlers...{NC}")
    lambda_endpoints = extract_lambda_endpoints()
    print(f"   Found {GREEN}{len(lambda_endpoints)}{NC} unique endpoints\n")
    
    # Step 3: Check database tables
    print(f"{BLUE}📋 Step 3: Checking database tables...{NC}")
    db_tables = check_database_tables()
    print(f"   Found {GREEN}{len(db_tables)}{NC} tables in migrations\n")
    
    # Step 4: Compare and find missing
    print(f"{BLUE}📋 Step 4: Comparing UI endpoints with Lambda handlers...{NC}\n")
    
    missing_endpoints = []
    found_endpoints = []
    partial_matches = []
    
    for ui_endpoint, ui_data in sorted(ui_endpoints.items()):
        matched = match_endpoint(ui_endpoint, lambda_endpoints)
        
        if matched:
            # Check if methods match
            ui_methods = ui_data['methods']
            lambda_methods = lambda_endpoints[matched]
            
            missing_methods = ui_methods - lambda_methods
            if missing_methods:
                partial_matches.append({
                    'endpoint': ui_endpoint,
                    'matched': matched,
                    'ui_methods': ui_methods,
                    'lambda_methods': lambda_methods,
                    'missing_methods': missing_methods
                })
            else:
                found_endpoints.append({
                    'endpoint': ui_endpoint,
                    'matched': matched,
                    'methods': ui_methods
                })
        else:
            missing_endpoints.append({
                'endpoint': ui_endpoint,
                'methods': ui_data['methods'],
                'files': list(set(ui_data['files']))
            })
    
    # Report results
    print(f"{CYAN}╔════════════════════════════════════════════════════════════╗{NC}")
    print(f"{CYAN}║                    AUDIT SUMMARY                         ║{NC}")
    print(f"{CYAN}╚════════════════════════════════════════════════════════════╝{NC}\n")
    
    print(f"UI Endpoints Found: {BLUE}{len(ui_endpoints)}{NC}")
    print(f"Lambda Endpoints Found: {BLUE}{len(lambda_endpoints)}{NC}")
    print(f"Database Tables Found: {BLUE}{len(db_tables)}{NC}\n")
    
    print(f"✅ Fully Matched Endpoints: {GREEN}{len(found_endpoints)}{NC}")
    print(f"⚠️  Partially Matched (missing methods): {YELLOW}{len(partial_matches)}{NC}")
    print(f"❌ Missing Endpoints: {RED}{len(missing_endpoints)}{NC}\n")
    
    # Show missing endpoints
    if missing_endpoints:
        print(f"{RED}❌ MISSING ENDPOINTS:{NC}")
        for item in missing_endpoints[:20]:  # Show first 20
            methods = ', '.join(sorted(item['methods']))
            print(f"   {methods:6s} {item['endpoint']}")
            if len(item['files']) > 0:
                print(f"      Used in: {item['files'][0]}")
        if len(missing_endpoints) > 20:
            print(f"   ... and {len(missing_endpoints) - 20} more")
        print()
    
    # Show partial matches
    if partial_matches:
        print(f"{YELLOW}⚠️  PARTIALLY MATCHED ENDPOINTS (missing methods):{NC}")
        for item in partial_matches[:10]:
            missing = ', '.join(sorted(item['missing_methods']))
            print(f"   {item['endpoint']}")
            print(f"      Matched to: {item['matched']}")
            print(f"      Missing methods: {RED}{missing}{NC}")
        if len(partial_matches) > 10:
            print(f"   ... and {len(partial_matches) - 10} more")
        print()
    
    # Generate detailed report
    report = {
        'summary': {
            'ui_endpoints': len(ui_endpoints),
            'lambda_endpoints': len(lambda_endpoints),
            'db_tables': len(db_tables),
            'found': len(found_endpoints),
            'partial': len(partial_matches),
            'missing': len(missing_endpoints)
        },
        'missing_endpoints': missing_endpoints,
        'partial_matches': partial_matches,
        'found_endpoints': found_endpoints[:50]  # First 50
    }
    
    report_file = Path("ADMIN_WEB_AUDIT_REPORT.json")
    report_file.write_text(json.dumps(report, indent=2))
    print(f"{GREEN}✅ Detailed report saved to: {report_file}{NC}\n")
    
    return len(missing_endpoints) == 0 and len(partial_matches) == 0

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
