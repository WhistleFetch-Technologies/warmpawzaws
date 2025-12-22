#!/bin/bash

# Validation Script for SQL-Based Discovery System
# Ensures: No KV Store, All data from SQL

set -e

echo "🔍 Validating SQL-Based Discovery System..."
echo ""

# Check 1: Discovery repository exists and uses SQL
echo "✅ Check 1: Discovery Repository"
if grep -q "getDbClient\|SupabaseClient" supabase/lib/repositories/discovery.ts; then
    echo "   ✓ Repository uses SQL client"
else
    echo "   ❌ Repository does not use SQL client"
    exit 1
fi

if grep -q "kv\.get\|kv\.set" supabase/lib/repositories/discovery.ts; then
    echo "   ❌ Repository still uses KV store"
    exit 1
else
    echo "   ✓ Repository does NOT use KV store"
fi

# Check 2: Discovery service exists and uses SQL
echo ""
echo "✅ Check 2: Discovery Service"
if grep -q "DiscoveryRepository\|getDiscoveryRepository" supabase/lib/services/discovery-service.ts; then
    echo "   ✓ Service uses SQL repository"
else
    echo "   ❌ Service does not use SQL repository"
    exit 1
fi

if grep -q "kv\.get\|kv\.set" supabase/lib/services/discovery-service.ts; then
    echo "   ❌ Service still uses KV store"
    exit 1
else
    echo "   ✓ Service does NOT use KV store"
fi

# Check 3: SQL migration exists
echo ""
echo "✅ Check 3: SQL Migration"
if [ -f "db/migrations/007_discovery_sql_migration.sql" ]; then
    echo "   ✓ Migration file exists"
    
    if grep -q "CREATE TABLE.*vendor_services" db/migrations/007_discovery_sql_migration.sql; then
        echo "   ✓ vendor_services table defined"
    else
        echo "   ❌ vendor_services table not defined"
        exit 1
    fi
    
    if grep -q "CREATE TABLE.*staff_services" db/migrations/007_discovery_sql_migration.sql; then
        echo "   ✓ staff_services table defined"
    else
        echo "   ❌ staff_services table not defined"
        exit 1
    fi
else
    echo "   ❌ Migration file not found"
    exit 1
fi

# Check 4: New endpoints registered
echo ""
echo "✅ Check 4: Discovery Endpoints"
if [ -f "src/supabase/functions/server/discovery-sql-endpoints.tsx" ]; then
    echo "   ✓ SQL-based endpoints file exists"
    
    if grep -q "getDiscoveryService\|getDiscoveryRepository" src/supabase/functions/server/discovery-sql-endpoints.tsx; then
        echo "   ✓ Endpoints use SQL services"
    else
        echo "   ❌ Endpoints do not use SQL services"
        exit 1
    fi
else
    echo "   ❌ SQL-based endpoints file not found"
    exit 1
fi

# Check 5: No KV imports in discovery files
echo ""
echo "✅ Check 5: No KV Imports"
if grep -r "from.*kv_store\|import.*kv" supabase/lib/repositories/discovery.ts supabase/lib/services/discovery-service.ts src/supabase/functions/server/discovery-sql-endpoints.tsx 2>/dev/null; then
    echo "   ❌ KV store imports found"
    exit 1
else
    echo "   ✓ No KV store imports"
fi

echo ""
echo "✅ All validation checks passed!"
echo "✅ Discovery system is fully SQL-based (NO KV STORE)"

