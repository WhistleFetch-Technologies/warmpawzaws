#!/usr/bin/env python3
"""
Script to convert fetch() calls to apiClient calls in migrated components
"""

import os
import re

TARGET_DIR = "/Users/ketan/Documents/warmpawzecodev/apps/vendor-web/components/vendor"

# Files to process
FILES = [
    "ProgressTrackingDashboard.tsx",
    "ShelterAdoptionSystem.tsx",
    "VendorPatientMonitoring.tsx",
    "VendorDonationManagement.tsx",
    "VendorEventManagement.tsx",
    "VendorExpiryManagement.tsx",
    "VendorCCTVAccess.tsx",
    "VendorControlledSubstances.tsx",
    "VendorCounseling.tsx",
    "VendorDeliveryManagement.tsx",
    "VendorDietCharts.tsx",
    "VendorGalleryManagement.tsx",
    "VendorMemorialServices.tsx",
    "VendorPolicyManagement.tsx",
    "VendorPortfolioManagement.tsx",
    "VendorPrescriptionBuilder.tsx",
    "VendorPrescriptionVerification.tsx",
]

def convert_fetch_to_apiclient(content):
    """Convert fetch patterns to apiClient patterns"""
    
    # Pattern 1: Simple GET fetch
    # await fetch(`/endpoint`, { headers: { ... } })
    # -> await apiClient.get<any>(`/endpoint`)
    content = re.sub(
        r"await fetch\s*\(\s*`([^`]+)`\s*,\s*\{\s*headers:\s*\{[^}]+\}\s*\}\s*\)",
        r"await apiClient.get<any>(`\1`)",
        content
    )
    
    # Pattern 2: POST fetch with body
    # await fetch(`/endpoint`, { method: 'POST', headers: {...}, body: JSON.stringify(data) })
    # -> await apiClient.post<any>(`/endpoint`, data)
    content = re.sub(
        r"await fetch\s*\(\s*`([^`]+)`\s*,\s*\{\s*method:\s*['\"]POST['\"][^}]*body:\s*JSON\.stringify\(([^)]+)\)\s*\}\s*\)",
        r"await apiClient.post<any>(`\1`, \2)",
        content,
        flags=re.DOTALL
    )
    
    # Pattern 3: PUT fetch with body
    content = re.sub(
        r"await fetch\s*\(\s*`([^`]+)`\s*,\s*\{\s*method:\s*['\"]PUT['\"][^}]*body:\s*JSON\.stringify\(([^)]+)\)\s*\}\s*\)",
        r"await apiClient.put<any>(`\1`, \2)",
        content,
        flags=re.DOTALL
    )
    
    # Pattern 4: DELETE fetch
    content = re.sub(
        r"await fetch\s*\(\s*`([^`]+)`\s*,\s*\{\s*method:\s*['\"]DELETE['\"][^}]*\}\s*\)",
        r"await apiClient.delete<any>(`\1`)",
        content,
        flags=re.DOTALL
    )
    
    # Clean up: Remove "const data = response" when response is already parsed
    content = re.sub(
        r"const data = response;",
        "// Response is already parsed",
        content
    )
    
    # Clean up: Fix data references to use response directly
    content = re.sub(
        r"data\.trackers",
        "response.trackers",
        content
    )
    content = re.sub(
        r"data\.data\?\.trackers",
        "response.data?.trackers",
        content
    )
    
    # Fix remaining response.ok to response.success
    content = re.sub(r"response\.ok", "response.success", content)
    
    # Fix remaining response.json() calls
    content = re.sub(
        r"await response\.json\(\)",
        "response",
        content
    )
    
    # Clean up errorData references
    content = re.sub(r"\berrorData\b", "response", content)
    
    return content

def process_file(filepath):
    """Process a single file"""
    if not os.path.exists(filepath):
        print(f"⚠️  File not found: {filepath}")
        return False
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if there are fetch calls to convert
    if "await fetch" not in content:
        print(f"⏭️  No fetch calls in: {os.path.basename(filepath)}")
        return False
    
    # Convert
    new_content = convert_fetch_to_apiclient(content)
    
    # Write back
    with open(filepath, 'w') as f:
        f.write(new_content)
    
    print(f"✅ Converted: {os.path.basename(filepath)}")
    return True

def main():
    print("🔧 Converting fetch() calls to apiClient...")
    print()
    
    converted = 0
    skipped = 0
    
    for filename in FILES:
        filepath = os.path.join(TARGET_DIR, filename)
        if process_file(filepath):
            converted += 1
        else:
            skipped += 1
    
    print()
    print(f"📊 Summary: {converted} converted, {skipped} skipped")

if __name__ == "__main__":
    main()
