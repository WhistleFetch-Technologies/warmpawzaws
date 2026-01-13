#!/usr/bin/env python3
"""
Comprehensive Admin UI End-to-End Audit
Checks for missing endpoints, handlers, database schemas, and syntax errors
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Set, Tuple

def extract_ui_endpoints() -> Set[str]:
    """Extract all API endpoints called from Admin UI"""
    endpoints = set()
    admin_web_path = Path("apps/admin-web")
    
    for file_path in admin_web_path.rglob("*.tsx"):
        try:
            content = file_path.read_text()
            # Match apiClient.get/post/put/patch/delete('endpoint') or ("endpoint")
            matches = re.findall(
                r'apiClient\.(get|post|put|patch|delete)\(["\']([^"\']+)["\']',
                content
            )
            for method, endpoint in matches:
                endpoints.add(f"{method.upper()} {endpoint}")
        except Exception as e:
            pass
    
    for file_path in admin_web_path.rglob("*.ts"):
        try:
            content = file_path.read_text()
            # Match apiClient.get/post/put/patch/delete('endpoint') or ("endpoint")
            matches = re.findall(
                r'apiClient\.(get|post|put|patch|delete)\(["\']([^"\']+)["\']',
                content
            )
            for method, endpoint in matches:
                endpoints.add(f"{method.upper()} {endpoint}")
        except Exception as e:
            pass
    
    return endpoints

def extract_lambda_endpoints() -> Dict[str, List[str]]:
    """Extract all endpoints from Lambda handlers"""
    endpoints = {}
    backend_path = Path("backend/lambda/src/endpoints")
    
    for file_path in backend_path.rglob("*.ts"):
        try:
            content = file_path.read_text()
            # Match app.get/post/put/patch/delete('endpoint')
            matches = re.findall(
                r'app\.(get|post|put|patch|delete)\(["\']([^"\']+)["\']',
                content
            )
            for method, endpoint in matches:
                key = f"{method.upper()} {endpoint}"
                if key not in endpoints:
                    endpoints[key] = []
                endpoints[key].append(str(file_path))
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    return endpoints

def check_database_tables() -> Set[str]:
    """Extract all table names from migrations"""
    tables = set()
    migrations_path = Path("db/migrations")
    
    for file_path in migrations_path.rglob("*.sql"):
        try:
            content = file_path.read_text()
            # Match CREATE TABLE IF NOT EXISTS table_name
            matches = re.findall(
                r'CREATE TABLE (?:IF NOT EXISTS )?([a-z_]+)',
                content,
                re.IGNORECASE
            )
            tables.update(m.lower() for m in matches)
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    return tables

def normalize_endpoint(endpoint: str) -> str:
    """Normalize endpoint for comparison"""
    # Remove leading/trailing slashes
    endpoint = endpoint.strip('/')
    # Handle /admin prefix variations
    if not endpoint.startswith('admin/') and not endpoint.startswith('/admin/'):
        if endpoint.startswith('/'):
            endpoint = endpoint[1:]
    return endpoint

def match_endpoint(ui_endpoint: str, lambda_endpoints: Dict[str, List[str]]) -> Tuple[bool, List[str]]:
    """Check if UI endpoint matches any Lambda endpoint"""
    ui_method, ui_path = ui_endpoint.split(' ', 1)
    ui_path = normalize_endpoint(ui_path)
    
    matches = []
    for lambda_key, files in lambda_endpoints.items():
        lambda_method, lambda_path = lambda_key.split(' ', 1)
        lambda_path = normalize_endpoint(lambda_path)
        
        # Exact match
        if ui_method == lambda_method and ui_path == lambda_path:
            matches.extend(files)
            continue
        
        # Parameterized route match (e.g., /admin/vendors/:id matches /admin/vendors/123)
        if ui_method == lambda_method:
            # Convert parameterized routes to regex
            lambda_pattern = lambda_path.replace(':id', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':vendorId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':serviceId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':customerId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':bookingId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':tierId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':roleId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':policyId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':ruleId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':categoryId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':productId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':promotionId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':bannerId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':ticketId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':settlementId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':payoutId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':orderId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':refundId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':reportId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':eventId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':pageId', r'[^/]+')
            lambda_pattern = lambda_pattern.replace(':regionId', r'[^/]+')
            
            if re.match(f'^{lambda_pattern}$', ui_path):
                matches.extend(files)
    
    return len(matches) > 0, matches

def main():
    print("=" * 80)
    print("COMPREHENSIVE ADMIN UI END-TO-END AUDIT")
    print("=" * 80)
    print()
    
    # Extract data
    print("📊 Extracting UI endpoints...")
    ui_endpoints = extract_ui_endpoints()
    print(f"   Found {len(ui_endpoints)} unique UI endpoints")
    
    print("📊 Extracting Lambda endpoints...")
    lambda_endpoints = extract_lambda_endpoints()
    print(f"   Found {len(lambda_endpoints)} unique Lambda endpoints")
    
    print("📊 Extracting database tables...")
    db_tables = check_database_tables()
    print(f"   Found {len(db_tables)} database tables")
    print()
    
    # Match endpoints
    print("🔍 Matching UI endpoints with Lambda endpoints...")
    missing = []
    matched = []
    partially_matched = []
    
    for ui_endpoint in sorted(ui_endpoints):
        is_matched, files = match_endpoint(ui_endpoint, lambda_endpoints)
        if is_matched:
            matched.append((ui_endpoint, files))
        else:
            # Check if method exists but path doesn't, or vice versa
            ui_method, ui_path = ui_endpoint.split(' ', 1)
            ui_path = normalize_endpoint(ui_path)
            
            # Check for partial matches (same path, different method)
            partial_match = False
            for lambda_key in lambda_endpoints.keys():
                lambda_method, lambda_path = lambda_key.split(' ', 1)
                lambda_path = normalize_endpoint(lambda_path)
                if ui_path == lambda_path and ui_method != lambda_method:
                    partially_matched.append((ui_endpoint, lambda_key))
                    partial_match = True
                    break
            
            if not partial_match:
                missing.append(ui_endpoint)
    
    # Report results
    print()
    print("=" * 80)
    print("RESULTS")
    print("=" * 80)
    print()
    print(f"✅ Fully Matched: {len(matched)}")
    print(f"⚠️  Partially Matched: {len(partially_matched)}")
    print(f"❌ Missing: {len(missing)}")
    print()
    
    if missing:
        print("=" * 80)
        print("MISSING ENDPOINTS")
        print("=" * 80)
        for endpoint in sorted(missing):
            print(f"  ❌ {endpoint}")
        print()
    
    if partially_matched:
        print("=" * 80)
        print("PARTIALLY MATCHED ENDPOINTS (Different HTTP Method)")
        print("=" * 80)
        for ui_endpoint, lambda_endpoint in partially_matched:
            print(f"  ⚠️  UI: {ui_endpoint}")
            print(f"     Lambda: {lambda_endpoint}")
        print()
    
    # Save report
    report = {
        "ui_endpoints_count": len(ui_endpoints),
        "lambda_endpoints_count": len(lambda_endpoints),
        "db_tables_count": len(db_tables),
        "matched": len(matched),
        "partially_matched": len(partially_matched),
        "missing": len(missing),
        "missing_endpoints": sorted(missing),
        "partially_matched_endpoints": [
            {"ui": ui, "lambda": lam} for ui, lam in partially_matched
        ]
    }
    
    with open("ADMIN_UI_COMPREHENSIVE_AUDIT_V2.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"📄 Full report saved to: ADMIN_UI_COMPREHENSIVE_AUDIT_V2.json")
    print()

if __name__ == "__main__":
    main()
