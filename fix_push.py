#!/usr/bin/env python3
import subprocess
import os
import sys

os.chdir('/Users/ketan/Documents/warmpawzecodev')

def run_cmd(cmd, check=True):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr, file=sys.stderr)
    if check and result.returncode != 0:
        print(f"Error: Command failed with code {result.returncode}")
        sys.exit(1)
    return result

print("Step 1: Checking current branch...")
run_cmd("git branch --show-current")

print("\nStep 2: Removing large files from index...")
run_cmd("git rm -r --cached apps/*/.next/cache/ backend/lambda/.serverless/ backend/lambda/*.zip 2>/dev/null || true", check=False)

print("\nStep 3: Staging all changes...")
run_cmd("git add -A")

print("\nStep 4: Checking status...")
run_cmd("git status --short | head -20")

print("\nStep 5: Creating commit...")
run_cmd('git commit -m "Update codebase: UI improvements, build artifacts cleanup, and new features" || true', check=False)

print("\nStep 6: Attempting push...")
result = run_cmd("git push origin develop --force-with-lease 2>&1", check=False)

if "Large files detected" in result.stdout or "Large files detected" in result.stderr:
    print("\nLarge files still in history. Using filter-branch...")
    print("This may take a while...")
    run_cmd('git filter-branch --force --index-filter "git rm --cached --ignore-unmatch -r apps/*/.next/cache/ backend/lambda/.serverless/ backend/lambda/*.zip" --prune-empty --tag-name-filter cat -- --all', check=False)
    run_cmd("git for-each-ref --format=\"delete %(refname)\" refs/original | git update-ref --stdin", check=False)
    run_cmd("git reflog expire --expire=now --all", check=False)
    run_cmd("git gc --prune=now --aggressive", check=False)
    print("\nRetrying push...")
    run_cmd("git push origin develop --force", check=False)

print("\nDone!")
