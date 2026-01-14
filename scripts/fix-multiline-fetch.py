#!/usr/bin/env python3
"""
Script to properly convert multi-line fetch() calls to apiClient calls
"""

import os
import re

TARGET_DIR = "/Users/ketan/Documents/warmpawzecodev/apps/vendor-web/components/vendor"

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

def convert_content(content):
    """Convert all fetch patterns to apiClient"""
    
    # Pattern: Multiline fetch with POST and body
    # const response = await fetch(
    #   `endpoint`,
    #   {
    #     method: 'POST',
    #     headers: {...},
    #     body: JSON.stringify({...})
    #   }
    # );
    
    # POST pattern
    post_pattern = re.compile(
        r"const response = await fetch\(\s*`([^`]+)`\s*,\s*\{\s*method:\s*['\"]POST['\"],\s*headers:\s*\{[^}]+\},\s*body:\s*JSON\.stringify\((\{[\s\S]*?\})\)\s*\}\s*\);",
        re.MULTILINE
    )
    
    def replace_post(m):
        endpoint = m.group(1)
        body = m.group(2)
        # Clean up the body
        body = re.sub(r'\s+', ' ', body)
        return f"const response = await apiClient.post<any>(`{endpoint}`, {body});"
    
    content = post_pattern.sub(replace_post, content)
    
    # PUT pattern
    put_pattern = re.compile(
        r"const response = await fetch\(\s*`([^`]+)`\s*,\s*\{\s*method:\s*['\"]PUT['\"],\s*headers:\s*\{[^}]+\},\s*body:\s*JSON\.stringify\((\{[\s\S]*?\})\)\s*\}\s*\);",
        re.MULTILINE
    )
    
    def replace_put(m):
        endpoint = m.group(1)
        body = m.group(2)
        body = re.sub(r'\s+', ' ', body)
        return f"const response = await apiClient.put<any>(`{endpoint}`, {body});"
    
    content = put_pattern.sub(replace_put, content)
    
    # DELETE pattern
    delete_pattern = re.compile(
        r"const response = await fetch\(\s*`([^`]+)`\s*,\s*\{\s*method:\s*['\"]DELETE['\"],\s*headers:\s*\{[^}]+\}\s*\}\s*\);",
        re.MULTILINE
    )
    
    def replace_delete(m):
        endpoint = m.group(1)
        return f"const response = await apiClient.delete<any>(`{endpoint}`);"
    
    content = delete_pattern.sub(replace_delete, content)
    
    # GET pattern (simple)
    get_pattern = re.compile(
        r"const response = await fetch\(\s*`([^`]+)`\s*,\s*\{\s*headers:\s*\{[^}]+\}\s*\}\s*\);",
        re.MULTILINE
    )
    
    def replace_get(m):
        endpoint = m.group(1)
        return f"const response = await apiClient.get<any>(`{endpoint}`);"
    
    content = get_pattern.sub(replace_get, content)
    
    return content

def process_file(filepath):
    """Process a single file"""
    if not os.path.exists(filepath):
        return False
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    if "await fetch" not in content:
        return False
    
    before_count = content.count("await fetch")
    new_content = convert_content(content)
    after_count = new_content.count("await fetch")
    
    with open(filepath, 'w') as f:
        f.write(new_content)
    
    converted = before_count - after_count
    print(f"✅ {os.path.basename(filepath)}: {converted} converted, {after_count} remaining")
    return True

def main():
    print("🔧 Converting multi-line fetch() calls...")
    print()
    
    for filename in FILES:
        filepath = os.path.join(TARGET_DIR, filename)
        process_file(filepath)
    
    print()
    print("Done!")

if __name__ == "__main__":
    main()
