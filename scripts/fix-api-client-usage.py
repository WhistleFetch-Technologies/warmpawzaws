#!/usr/bin/env python3
"""
Script to fix apiClient.get() misuse patterns in vendor-web components.
Fixes code that treats apiClient.get() like fetch() with Response objects.
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Tuple

VENDOR_DIR = Path("/Users/ketan/Documents/warmpawzecodev/apps/vendor-web/components/vendor")

def fix_api_client_usage(content: str) -> Tuple[str, int]:
    """
    Fix apiClient.get() misuse patterns in file content.
    Returns: (fixed_content, number_of_fixes)
    """
    fixes = 0
    lines = content.split('\n')
    fixed_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Pattern 1: apiClient.get('/endpoint'), { headers: ... }
        # Multi-line pattern detection
        if re.search(r'apiClient\.get\([^)]+\)\s*,', line):
            # Check if next lines contain options object
            if i + 1 < len(lines) and '{' in lines[i + 1]:
                # Collect the full call
                full_call = [line]
                brace_count = lines[i + 1].count('{') - lines[i + 1].count('}')
                j = i + 1
                while j < len(lines) and brace_count > 0:
                    full_call.append(lines[j])
                    j += 1
                    if j < len(lines):
                        brace_count += lines[j].count('{') - lines[j].count('}')
                
                # Extract the endpoint
                match = re.search(r"apiClient\.get\(([^)]+)\)", line)
                if match:
                    endpoint = match.group(1).strip()
                    # Fix template literals (single quotes to backticks if they contain ${})
                    if "'" in endpoint and "${" in endpoint:
                        endpoint = endpoint.replace("'", "`")
                    
                    # Replace with fixed version
                    fixed_lines.append(f"      const data = await apiClient.get({endpoint}) as any;")
                    i = j
                    fixes += 1
                    continue
        
        # Pattern 2: const response = await apiClient.get(...)
        if re.search(r'const\s+(response|roleRes|availRes|vendorRes|servicesRes|statusRes|facilityRes)\s*=\s*await\s+apiClient\.get', line):
            var_name = re.search(r'const\s+(\w+)\s*=', line).group(1)
            # Replace with data variant
            data_var = var_name.replace('Res', 'Data').replace('response', 'data')
            line = re.sub(
                r'const\s+\w+\s*=\s*await\s+apiClient\.get\(([^)]+)\)',
                rf'const {data_var} = await apiClient.get(\1) as any',
                line
            )
            fixes += 1
        
        # Pattern 3: if (response.ok) { const data = await response.json() }
        if re.search(r'if\s*\(\s*(response|roleRes|availRes|vendorRes|servicesRes|statusRes)\.ok\s*\)', line):
            var_name = re.search(r'(\w+)\.ok', line).group(1)
            data_var = var_name.replace('Res', 'Data').replace('response', 'data')
            # Check if next line has response.json()
            if i + 1 < len(lines) and 'response.json()' in lines[i + 1]:
                # Skip the response.json() line
                line = re.sub(
                    r'if\s*\(\s*\w+\.ok\s*\)',
                    f'if ({data_var})',
                    line
                )
                # Skip the next line (response.json())
                i += 1
                fixes += 1
            else:
                line = re.sub(
                    r'if\s*\(\s*\w+\.ok\s*\)',
                    f'if ({data_var})',
                    line
                )
                fixes += 1
        
        # Pattern 4: await response.json()
        if re.search(r'await\s+(response|roleRes|availRes|vendorRes|servicesRes|statusRes)\.json\(\)', line):
            var_name = re.search(r'await\s+(\w+)\.json\(\)', line).group(1)
            data_var = var_name.replace('Res', 'Data').replace('response', 'data')
            line = re.sub(
                r'await\s+\w+\.json\(\)',
                data_var,
                line
            )
            fixes += 1
        
        # Pattern 5: response.status or response.statusText
        if re.search(r'(response|roleRes|availRes|vendorRes|servicesRes|statusRes)\.(status|statusText)', line):
            # Remove these references or replace with appropriate values
            line = re.sub(r'\w+\.status(Text)?', '', line)
            fixes += 1
        
        # Pattern 6: Fix template literals in strings
        if "'" in line and "${" in line and "apiClient.get" in line:
            line = line.replace("'", "`")
            fixes += 1
        
        fixed_lines.append(line)
        i += 1
    
    return '\n'.join(fixed_lines), fixes

def process_file(file_path: Path) -> int:
    """Process a single file and return number of fixes."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if file needs fixing
        if not (re.search(r'apiClient\.get.*\),', content) or 
                re.search(r'response\.ok', content) or 
                re.search(r'response\.json\(\)', content)):
            return 0
        
        # Create backup
        backup_path = file_path.with_suffix(file_path.suffix + f'.backup-{os.getpid()}')
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Fix the content
        fixed_content, fixes = fix_api_client_usage(content)
        
        if fixes > 0:
            # Write fixed content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            print(f"  ✅ Fixed {fixes} issues in: {file_path.name}")
            return fixes
        
        # Remove backup if no fixes
        backup_path.unlink()
        return 0
        
    except Exception as e:
        print(f"  ❌ Error processing {file_path.name}: {e}")
        return 0

def main():
    """Main function to process all files."""
    print("🔍 Finding and fixing apiClient.get() misuse patterns...")
    print(f"Target directory: {VENDOR_DIR}")
    print("")
    
    if not VENDOR_DIR.exists():
        print(f"❌ Directory not found: {VENDOR_DIR}")
        sys.exit(1)
    
    total_fixes = 0
    files_processed = 0
    
    # Find all TypeScript/TSX files
    for file_path in VENDOR_DIR.rglob("*.tsx"):
        fixes = process_file(file_path)
        if fixes > 0:
            files_processed += 1
            total_fixes += fixes
    
    print("")
    print(f"✨ Processed {files_processed} files with {total_fixes} total fixes")
    print("⚠️  Please review the changes and test the build!")
    print("💡 Backup files created with .backup-* extension")

if __name__ == "__main__":
    main()

