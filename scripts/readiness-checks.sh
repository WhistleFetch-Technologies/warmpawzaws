#!/bin/bash
# Readiness Checks Shell Script Wrapper
set -e

ENVIRONMENT=${1:-dev}

echo "🔍 Running readiness checks for $ENVIRONMENT environment..."

# Compile TypeScript if needed
if [ -f "scripts/readiness-checks.ts" ]; then
  npx tsx scripts/readiness-checks.ts "$ENVIRONMENT"
else
  echo "❌ readiness-checks.ts not found"
  exit 1
fi

