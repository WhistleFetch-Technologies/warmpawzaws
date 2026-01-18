#!/usr/bin/env python3

import os
import shutil
import re
from pathlib import Path

def migrate_vendor_ui():
    """Migrate vendor UI components from React Native to Next.js"""

    project_root = Path("/Users/ketan/Documents/warmpawzecodev")
    source_dir = project_root / "apps" / "WarmpawzVendor" / "src" / "screens"
    target_dir = project_root / "apps" / "vendor-web" / "components" / "vendor"

    print("🚀 Starting Vendor UI Migration")
    print("=" * 50)

    # Screen mappings
    screen_mappings = {
        "dashboard": ["VendorDashboardScreen"],
        "bookings": ["VendorBookingManagementScreen", "BookingDetailScreen", "BookingActionsScreen"],
        "analytics": ["PerformanceMetricsScreen", "RevenueAnalyticsScreen"],
        "earnings": ["EarningsOverviewScreen", "PayoutHistoryScreen"],
        "profile": ["ProfileScreen"],
        "settings": ["SettingsScreen"],
        "staff": ["StaffManagementScreen", "StaffAssignmentScreen"],
        "services": ["ServicesManagementScreen"],
        "auth": ["VendorAuthScreen"],
        "onboarding": ["OnboardingScreen"]
    }

    total_converted = 0

    for screen_category, screen_names in screen_mappings.items():
        category_dir = source_dir / screen_category
        if not category_dir.exists():
            print(f"⚠️  Skipping {screen_category} - directory not found")
            continue

        target_category_dir = target_dir / screen_category
        target_category_dir.mkdir(parents=True, exist_ok=True)

        for screen_name in screen_names:
            source_file = category_dir / f"{screen_name}.tsx"
            if not source_file.exists():
                print(f"⚠️  Skipping {screen_name} - file not found")
                continue

            target_file = target_category_dir / f"{screen_name}.tsx"

            print(f"🔄 Converting {screen_name}...")

            # Read source content
            with open(source_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Apply transformations
            content = transform_component(content, screen_name)

            # Write target content
            with open(target_file, 'w', encoding='utf-8') as f:
                f.write(content)

            total_converted += 1
            print(f"✅ Converted {screen_name}")

    print(f"\n🎉 Migration Complete!")
    print(f"📊 Total components converted: {total_converted}")
    print(f"📁 Components saved to: {target_dir}")

def transform_component(content: str, component_name: str) -> str:
    """Transform React Native component to React/Next.js component"""

    # Add 'use client' directive
    if not content.startswith("'use client';"):
        content = "'use client';\n\n" + content

    # Replace React Native imports
    content = re.sub(r"from 'react-native'", "from 'react'", content)
    content = re.sub(r"import \{ VendorApi \} from '\.\./\.\./services/api'",
                     "import { apiClient } from '@/lib/api-client'", content)
    content = re.sub(r"VendorApi\.", "apiClient.", content)

    # Replace navigation calls
    content = re.sub(r"navigation\.navigate", "onNavigate", content)
    content = re.sub(r"navigation\.goBack", "onBack", content)

    # Update interface names
    content = re.sub(rf"interface (\w+)Props", f"interface {component_name}Props", content)
    content = re.sub(rf"function (\w+)\(", f"export function {component_name}(", content)

    # Basic tag conversions
    tag_mappings = {
        'SafeAreaView': 'div',
        'ScrollView': 'div',
        'View': 'div',
        'Text': 'span',
        'TouchableOpacity': 'button',
        'TextInput': 'input',
        'FlatList': 'div',
        'ActivityIndicator': 'div',
        'RefreshControl': 'div'
    }

    for rn_tag, web_tag in tag_mappings.items():
        content = re.sub(rf"<{rn_tag}", f"<{web_tag}", content)
        content = re.sub(rf"</{rn_tag}>", f"</{web_tag}>", content)

    # Replace style prop with className
    content = re.sub(r"style=\{", "className={", content)

    # Add component-specific logging
    content = re.sub(r"console\.log\(", f"console.log(`[{component_name}] ", content)

    # Add import for apiClient if not present
    if "apiClient" in content and "import { apiClient }" not in content:
        # Find the last import line and add apiClient import after it
        import_match = re.search(r"(import .* from .*;\n)", content)
        if import_match:
            insert_pos = import_match.end()
            content = content[:insert_pos] + "import { apiClient } from '@/lib/api-client';\nimport { toast } from 'sonner';\n" + content[insert_pos:]

    return content

if __name__ == "__main__":
    migrate_vendor_ui()