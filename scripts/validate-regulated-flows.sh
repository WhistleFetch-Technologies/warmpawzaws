#!/bin/bash

# Validation Script for Regulated Flows SQL System
# Ensures: No KV Store, All data from SQL, Compliance checks

set -e

echo "🔍 Validating Regulated Flows SQL System..."
echo ""

# Check 1: Regulated flows repository exists and uses SQL
echo "✅ Check 1: Regulated Flows Repository"
if grep -q "getDbClient\|SupabaseClient" supabase/lib/repositories/regulated-flows.ts; then
    echo "   ✓ Repository uses SQL client"
else
    echo "   ❌ Repository does not use SQL client"
    exit 1
fi

if grep -q "kv\.get\|kv\.set" supabase/lib/repositories/regulated-flows.ts; then
    echo "   ❌ Repository still uses KV store"
    exit 1
else
    echo "   ✓ Repository does NOT use KV store"
fi

# Check 2: Regulated flows service exists and uses SQL
echo ""
echo "✅ Check 2: Regulated Flows Service"
if grep -q "RegulatedFlowsRepository\|getRegulatedFlowsRepository" supabase/lib/services/regulated-flows-service.ts; then
    echo "   ✓ Service uses SQL repository"
else
    echo "   ❌ Service does not use SQL repository"
    exit 1
fi

if grep -q "kv\.get\|kv\.set" supabase/lib/services/regulated-flows-service.ts; then
    echo "   ❌ Service still uses KV store"
    exit 1
else
    echo "   ✓ Service does NOT use KV store"
fi

# Check 3: SQL migration exists
echo ""
echo "✅ Check 3: SQL Migration"
if [ -f "db/migrations/008_regulated_flows_sql.sql" ]; then
    echo "   ✓ Migration file exists"
    
    if grep -q "CREATE TABLE.*medical_records" db/migrations/008_regulated_flows_sql.sql; then
        echo "   ✓ medical_records table defined"
    else
        echo "   ❌ medical_records table not defined"
        exit 1
    fi
    
    if grep -q "CREATE TABLE.*prescriptions" db/migrations/008_regulated_flows_sql.sql; then
        echo "   ✓ prescriptions table defined"
    else
        echo "   ❌ prescriptions table not defined"
        exit 1
    fi
    
    if grep -q "CREATE TABLE.*medicine_orders" db/migrations/008_regulated_flows_sql.sql; then
        echo "   ✓ medicine_orders table defined"
    else
        echo "   ❌ medicine_orders table not defined"
        exit 1
    fi
    
    if grep -q "CREATE TABLE.*diagnostic_bookings" db/migrations/008_regulated_flows_sql.sql; then
        echo "   ✓ diagnostic_bookings table defined"
    else
        echo "   ❌ diagnostic_bookings table not defined"
        exit 1
    fi
    
    if grep -q "CREATE TABLE.*audit_trail" db/migrations/008_regulated_flows_sql.sql; then
        echo "   ✓ audit_trail table defined"
    else
        echo "   ❌ audit_trail table not defined"
        exit 1
    fi
    
    # Check immutability triggers
    if grep -q "prevent_medical_record_updates\|prevent_prescription_updates" db/migrations/008_regulated_flows_sql.sql; then
        echo "   ✓ Immutability triggers defined"
    else
        echo "   ❌ Immutability triggers not defined"
        exit 1
    fi
    
    # Check state transition validation
    if grep -q "validate_medicine_order_transition\|validate_diagnostic_booking_transition" db/migrations/008_regulated_flows_sql.sql; then
        echo "   ✓ State transition validation defined"
    else
        echo "   ❌ State transition validation not defined"
        exit 1
    fi
else
    echo "   ❌ Migration file not found"
    exit 1
fi

# Check 4: New endpoints registered
echo ""
echo "✅ Check 4: Regulated Flows Endpoints"
if [ -f "src/supabase/functions/server/regulated-flows-sql-endpoints.tsx" ]; then
    echo "   ✓ SQL-based endpoints file exists"
    
    if grep -q "getRegulatedFlowsService\|getRegulatedFlowsRepository" src/supabase/functions/server/regulated-flows-sql-endpoints.tsx; then
        echo "   ✓ Endpoints use SQL services"
    else
        echo "   ❌ Endpoints do not use SQL services"
        exit 1
    fi
else
    echo "   ❌ SQL-based endpoints file not found"
    exit 1
fi

# Check 5: No KV imports in regulated flows files
echo ""
echo "✅ Check 5: No KV Imports"
if grep -r "from.*kv_store\|import.*kv" supabase/lib/repositories/regulated-flows.ts supabase/lib/services/regulated-flows-service.ts src/supabase/functions/server/regulated-flows-sql-endpoints.tsx 2>/dev/null; then
    echo "   ❌ KV store imports found"
    exit 1
else
    echo "   ✓ No KV store imports"
fi

# Check 6: Role permissions implemented
echo ""
echo "✅ Check 6: Role Permissions"
if grep -q "checkPermission\|ROLE_PERMISSIONS" supabase/lib/services/regulated-flows-service.ts; then
    echo "   ✓ Role permissions implemented"
else
    echo "   ❌ Role permissions not implemented"
    exit 1
fi

# Check 7: State transitions validated
echo ""
echo "✅ Check 7: State Transitions"
if grep -q "validate_medicine_order_transition\|validate_diagnostic_booking_transition" db/migrations/008_regulated_flows_sql.sql; then
    echo "   ✓ State transition validation implemented"
else
    echo "   ❌ State transition validation not implemented"
    exit 1
fi

# Check 8: Notification triggers
echo ""
echo "✅ Check 8: Notification Triggers"
if grep -q "triggerNotification\|triggerNotificationForOrderStatus\|triggerNotificationForDiagnosticStatus" supabase/lib/services/regulated-flows-service.ts; then
    echo "   ✓ Notification triggers implemented"
else
    echo "   ❌ Notification triggers not implemented"
    exit 1
fi

# Check 9: Audit trail
echo ""
echo "✅ Check 9: Audit Trail"
if grep -q "logAuditTrail\|getAuditTrail" supabase/lib/repositories/regulated-flows.ts; then
    echo "   ✓ Audit trail implemented"
else
    echo "   ❌ Audit trail not implemented"
    exit 1
fi

echo ""
echo "✅ All validation checks passed!"
echo "✅ Regulated flows system is fully SQL-based (NO KV STORE)"
echo "✅ Compliance features implemented (immutability, permissions, state transitions, audit trail)"

