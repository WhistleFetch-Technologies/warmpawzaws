#!/usr/bin/env python3
"""
Script to migrate full Figma UI components from warmpawzaws to warmpawzecodev
Converts Supabase API calls to apiClient for AWS Lambda
"""

import os
import re
import shutil

# Source and destination directories
SRC_DIR = "/Users/ketan/Documents/warmpawzaws/src/components/vendor"
DEST_DIR = "/Users/ketan/Documents/warmpawzecodev/apps/vendor-web/components/vendor"

# Components to migrate (placeholder files with < 50 lines)
COMPONENTS_TO_MIGRATE = [
    # File name -> Source file name (if different)
    "VendorPrescriptionBuilder.tsx",
    "ProgressTrackingDashboard.tsx",
    "ShelterAdoptionSystem.tsx",
    "VendorPatientMonitoring.tsx",
    "VendorDonationManagement.tsx",
    "VendorEventManagement.tsx",
    "VendorExpiryManagement.tsx",
    "VendorMemorialServices.tsx",
    "VendorControlledSubstances.tsx",
    "VendorCCTVAccess.tsx",
    "VendorPortfolioManagement.tsx",
    "VendorGalleryManagement.tsx",
    "VendorPrescriptionVerification.tsx",
    "VendorDeliveryManagement.tsx",
    "VendorDietCharts.tsx",
    "VendorCounseling.tsx",
    "VendorPolicyManagement.tsx",
    "NutritionistMealManager.tsx",
    "VendorCafeMenuManagement.tsx",
]

# Package components
PACKAGE_COMPONENTS = [
    ("packages/CreatePackageFlow.tsx", "packages/CreatePackageFlow.tsx"),
    ("packages/PackageManagementContainer.tsx", "packages/PackageManagementContainer.tsx"),
]

def convert_supabase_to_apiclient(content):
    """Convert Supabase API calls to apiClient"""
    
    # Remove supabase info import
    content = re.sub(
        r"import\s*{\s*projectId\s*,\s*publicAnonKey\s*}\s*from\s*['\"].*?/supabase/info['\"];\s*\n?",
        "",
        content
    )
    
    # Fix sonner import (remove version)
    content = re.sub(
        r"from\s*['\"]sonner@[\d.]+['\"]",
        "from 'sonner'",
        content
    )
    
    # Add apiClient import if not present
    if "apiClient" not in content and ("fetch(" in content or "supabase" in content.lower()):
        # Find where to insert import
        import_match = re.search(r"(import.*?from\s*['\"].*?['\"];?\s*\n)", content)
        if import_match:
            insert_pos = content.find(import_match.group(0)) + len(import_match.group(0))
            content = content[:insert_pos] + "import { apiClient } from '@/lib/api-client';\n" + content[insert_pos:]
    
    # Convert fetch calls to apiClient
    # Pattern 1: fetch(`https://${projectId}.supabase.co/functions/v1/make-server-xxx/endpoint`, { ... })
    def convert_fetch(match):
        full_match = match.group(0)
        endpoint_match = re.search(r'/make-server[^/]*/(.+?)(?:[\'"`]|$)', full_match)
        if not endpoint_match:
            endpoint_match = re.search(r'functions/v1/(.+?)(?:[\'"`]|$)', full_match)
        
        if endpoint_match:
            endpoint = endpoint_match.group(1).strip('`"\' ')
            
            # Determine if it's GET or POST
            if 'method: ' in full_match.lower():
                method_match = re.search(r"method:\s*['\"](\w+)['\"]", full_match, re.IGNORECASE)
                method = method_match.group(1).upper() if method_match else 'GET'
            else:
                method = 'GET'
            
            if method == 'GET':
                return f"apiClient.get<any>(`/{endpoint}`)"
            elif method == 'POST':
                body_match = re.search(r"body:\s*JSON\.stringify\(([^)]+)\)", full_match)
                body = body_match.group(1) if body_match else "{}"
                return f"apiClient.post<any>(`/{endpoint}`, {body})"
            elif method == 'PUT':
                body_match = re.search(r"body:\s*JSON\.stringify\(([^)]+)\)", full_match)
                body = body_match.group(1) if body_match else "{}"
                return f"apiClient.put<any>(`/{endpoint}`, {body})"
            elif method == 'DELETE':
                return f"apiClient.delete<any>(`/{endpoint}`)"
        
        return full_match
    
    # Match fetch patterns with supabase URLs
    content = re.sub(
        r"fetch\s*\(\s*`https://\$\{projectId\}\.supabase\.co/functions/v1/[^`]+`\s*,\s*\{[^}]+\}\s*\)",
        convert_fetch,
        content,
        flags=re.DOTALL
    )
    
    # Simpler conversion for remaining fetch calls
    content = re.sub(
        r"await fetch\s*\(\s*`https://\$\{projectId\}\.supabase\.co/functions/v1/make-server[^/]*/([^`]+)`\s*,\s*\{[^}]+headers:\s*\{[^}]+\}[^}]*\}\s*\)",
        lambda m: f"await apiClient.get<any>(`/{m.group(1)}`)",
        content,
        flags=re.DOTALL
    )
    
    # Handle response.json() patterns after apiClient calls
    # apiClient already returns parsed JSON, so we need to handle this
    content = re.sub(
        r"const\s+(\w+)\s*=\s*await\s+response\.json\(\)",
        r"// Response already parsed by apiClient",
        content
    )
    
    # Replace remaining projectId references
    content = re.sub(r"\$\{projectId\}", "warmpawz", content)
    content = re.sub(r"projectId", "'warmpawz'", content)
    content = re.sub(r"publicAnonKey", "''", content)
    
    return content

def migrate_component(src_file, dest_file):
    """Migrate a single component"""
    src_path = os.path.join(SRC_DIR, src_file)
    dest_path = os.path.join(DEST_DIR, dest_file)
    
    if not os.path.exists(src_path):
        print(f"⚠️  Source not found: {src_file}")
        return False
    
    # Check if destination is a placeholder (< 100 lines)
    if os.path.exists(dest_path):
        with open(dest_path, 'r') as f:
            dest_lines = len(f.readlines())
        if dest_lines > 100:
            print(f"⏭️  Skipping {dest_file} (already has {dest_lines} lines)")
            return False
    
    # Read source file
    with open(src_path, 'r') as f:
        content = f.read()
    
    # Convert API calls
    content = convert_supabase_to_apiclient(content)
    
    # Ensure destination directory exists
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    # Write to destination
    with open(dest_path, 'w') as f:
        f.write(content)
    
    src_lines = len(content.split('\n'))
    print(f"✅ Migrated {src_file} ({src_lines} lines)")
    return True

def main():
    print("🚀 Starting Figma component migration...")
    print(f"   Source: {SRC_DIR}")
    print(f"   Destination: {DEST_DIR}")
    print()
    
    migrated = 0
    skipped = 0
    errors = 0
    
    # Migrate main components
    for component in COMPONENTS_TO_MIGRATE:
        try:
            if migrate_component(component, component):
                migrated += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"❌ Error migrating {component}: {e}")
            errors += 1
    
    # Migrate package components
    for src, dest in PACKAGE_COMPONENTS:
        try:
            if migrate_component(src, dest):
                migrated += 1
            else:
                skipped += 1
        except Exception as e:
            print(f"❌ Error migrating {src}: {e}")
            errors += 1
    
    print()
    print(f"📊 Migration Summary:")
    print(f"   ✅ Migrated: {migrated}")
    print(f"   ⏭️  Skipped: {skipped}")
    print(f"   ❌ Errors: {errors}")

if __name__ == "__main__":
    main()
