#!/bin/bash

# ============================================================================
# CLEANUP DUPLICATE CLOUDFRONT DISTRIBUTIONS (Python-based, no jq required)
# ============================================================================

set -e

REGION="ap-south-1"
OFFICIAL_ADMIN_ID="E1WPXL8WBOWOE8"
OFFICIAL_CUSTOMER_ID="E2RDORGXSWJJ87"
OFFICIAL_VENDOR_ID="E95171GX1I6HN"

echo "🧹 CloudFront Duplicate Cleanup (Python-based)"
echo "=" | head -c 60 && echo ""

python3 << 'PYTHON_SCRIPT'
import json
import subprocess
import sys

REGION = "ap-south-1"
OFFICIAL_IDS = {
    "E1WPXL8WBOWOE8",  # Admin
    "E2RDORGXSWJJ87",  # Customer
    "E95171GX1I6HN"    # Vendor
}

print("📊 Fetching CloudFront distributions...")

# Get all distributions
result = subprocess.run(
    ['aws', 'cloudfront', 'list-distributions', '--region', REGION, '--output', 'json'],
    capture_output=True,
    text=True
)

if result.returncode != 0:
    print(f"❌ Error: {result.stderr}")
    sys.exit(1)

data = json.loads(result.stdout)
duplicates = []

# Find duplicates
for dist in data['DistributionList']['Items']:
    dist_id = dist['Id']
    origin = dist['Origins']['Items'][0]['DomainName']
    
    if 'frontend' in origin and dist_id not in OFFICIAL_IDS and dist['Enabled']:
        duplicates.append({
            'id': dist_id,
            'domain': dist['DomainName'],
            'origin': origin
        })

if not duplicates:
    print("✅ No duplicate distributions found!")
    sys.exit(0)

print(f"\n⚠️  Found {len(duplicates)} duplicate distribution(s):")
for dup in duplicates[:10]:
    print(f"  - {dup['id']} → {dup['domain']}")
if len(duplicates) > 10:
    print(f"  ... and {len(duplicates) - 10} more")

print(f"\n🔄 Disabling {len(duplicates)} duplicate distribution(s)...")
print("   (This will stop them from serving traffic immediately)")
print("")

disabled_count = 0
failed_count = 0

for dup in duplicates:
    dist_id = dup['id']
    print(f"  Disabling {dist_id}...", end=' ', flush=True)
    
    try:
        # Get config
        get_result = subprocess.run(
            ['aws', 'cloudfront', 'get-distribution-config', '--id', dist_id, '--region', REGION, '--output', 'json'],
            capture_output=True,
            text=True,
            check=True
        )
        
        config_data = json.loads(get_result.stdout)
        etag = config_data['ETag']
        config = config_data['DistributionConfig']
        
        # Disable
        config['Enabled'] = False
        
        # Update
        update_result = subprocess.run(
            ['aws', 'cloudfront', 'update-distribution', '--id', dist_id, '--if-match', etag, '--distribution-config', json.dumps(config), '--region', REGION],
            capture_output=True,
            text=True
        )
        
        if update_result.returncode == 0:
            print("✅")
            disabled_count += 1
        else:
            print(f"❌")
            failed_count += 1
            if "InUseByCloudFrontFunction" in update_result.stderr:
                print(f"     (Note: May be in use, will retry later)")
    except Exception as e:
        print(f"❌ Error: {str(e)[:50]}")
        failed_count += 1

print(f"\n✅ Summary:")
print(f"   Disabled: {disabled_count}")
print(f"   Failed: {failed_count}")
print(f"   Total: {len(duplicates)}")
print(f"\n⚠️  Note: Disabled distributions can be deleted from AWS Console after 15+ days")
PYTHON_SCRIPT

echo ""
echo "✅ Cleanup complete!"
