#!/bin/bash
# ============================================================================
# Role Analysis Script
# ============================================================================
# Analyzes roles to identify duplicates and safe-to-delete candidates
#
# Usage:
#   ./scripts/analyze-roles.sh                    # Will prompt for DB credentials
#   DB_HOST=xxx DB_USER=xxx DB_NAME=xxx ./scripts/analyze-roles.sh
# ============================================================================

set -e

echo "🔍 ROLE ANALYSIS SCRIPT"
echo "========================"
echo ""

# Get database credentials
if [ -z "$DB_HOST" ]; then
    # Try to get from SSM
    DB_HOST=$(aws ssm get-parameter --name "/warmpawz/dev/db/host" --query Parameter.Value --output text 2>/dev/null || echo "")
fi

if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo "📝 Please enter database connection details:"
    read -p "RDS Endpoint (hostname): " DB_HOST
    read -p "Database name [warmpawz]: " DB_NAME
    DB_NAME="${DB_NAME:-warmpawz}"
    read -p "Username [postgres]: " DB_USER
    DB_USER="${DB_USER:-postgres}"
    read -sp "Password: " DB_PASSWORD
    echo ""
fi

DB_PORT="${DB_PORT:-5432}"
export PGPASSWORD="$DB_PASSWORD"

echo ""
echo "🔗 Connecting to: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""

# Test connection
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Failed to connect to database"
    exit 1
fi

echo "✅ Connected successfully"
echo ""

# Run analysis
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'EOF'

\echo ''
\echo '============================================================================'
\echo '📊 1. ALL ROLES WITH USAGE COUNTS'
\echo '============================================================================'
\echo ''

SELECT 
    r.id,
    r.name,
    r.display_name,
    r.is_system_role as sys,
    r.is_active as active,
    COALESCE(v.vendor_count, 0) as vendors,
    COALESCE(p.permission_count, 0) as perms,
    CASE 
        WHEN COALESCE(v.vendor_count, 0) > 0 THEN '🛡️ HAS VENDORS'
        WHEN r.is_system_role THEN '⚠️ SYSTEM'
        ELSE '✅ CAN DELETE'
    END as status,
    to_char(r.created_at, 'YYYY-MM-DD') as created
FROM roles r
LEFT JOIN (
    SELECT role_id, COUNT(*) as vendor_count 
    FROM vendors 
    WHERE role_id IS NOT NULL
    GROUP BY role_id
) v ON r.id = v.role_id
LEFT JOIN (
    SELECT role_id, COUNT(*) as permission_count
    FROM role_permissions
    GROUP BY role_id
) p ON r.id = p.role_id
ORDER BY r.name, r.created_at;

\echo ''
\echo '============================================================================'
\echo '⚠️ 2. DUPLICATE ROLE NAMES (same name, multiple entries)'
\echo '============================================================================'
\echo ''

SELECT 
    name,
    COUNT(*) as copies,
    array_agg(id ORDER BY created_at) as role_ids
FROM roles
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY name;

\echo ''
\echo '============================================================================'
\echo '🎉 3. EVENT ORGANIZER ROLES'
\echo '============================================================================'
\echo ''

SELECT 
    r.id,
    r.name,
    r.display_name,
    COALESCE(v.vendor_count, 0) as vendors,
    to_char(r.created_at, 'YYYY-MM-DD HH24:MI') as created,
    CASE 
        WHEN r.id = (
            SELECT id FROM roles 
            WHERE LOWER(name) LIKE '%event%organizer%' 
            ORDER BY created_at ASC 
            LIMIT 1
        ) THEN '✅ KEEP (oldest)'
        WHEN COALESCE(v.vendor_count, 0) > 0 THEN '🛡️ KEEP (has vendors)'
        ELSE '❌ CAN DELETE'
    END as action
FROM roles r
LEFT JOIN (
    SELECT role_id, COUNT(*) as vendor_count 
    FROM vendors 
    WHERE role_id IS NOT NULL
    GROUP BY role_id
) v ON r.id = v.role_id
WHERE LOWER(r.name) LIKE '%event%' 
   OR LOWER(r.display_name) LIKE '%event%'
ORDER BY r.created_at;

\echo ''
\echo '============================================================================'
\echo '🗑️ 4. ROLES SAFE TO DELETE (no vendors, duplicates or inactive)'
\echo '============================================================================'
\echo ''

SELECT 
    r.id,
    r.name,
    r.is_system_role as sys,
    r.is_active as active,
    to_char(r.created_at, 'YYYY-MM-DD') as created,
    CASE
        WHEN r.name IN (SELECT name FROM roles GROUP BY name HAVING COUNT(*) > 1) THEN 'DUPLICATE'
        WHEN r.is_active = false THEN 'INACTIVE'
        ELSE 'ORPHAN'
    END as reason
FROM roles r
WHERE 
    NOT EXISTS (SELECT 1 FROM vendors v WHERE v.role_id = r.id)
    AND r.id NOT IN (
        SELECT id FROM roles 
        WHERE LOWER(name) LIKE '%event%organizer%' 
        ORDER BY created_at ASC 
        LIMIT 1
    )
    AND (
        r.name IN (SELECT name FROM roles GROUP BY name HAVING COUNT(*) > 1)
        OR r.is_active = false
    )
ORDER BY r.name, r.created_at;

\echo ''
\echo '============================================================================'
\echo '📈 5. SUMMARY'
\echo '============================================================================'
\echo ''

SELECT 
    'Total roles' as metric,
    COUNT(*)::text as value
FROM roles
UNION ALL
SELECT 
    'Active roles',
    COUNT(*)::text
FROM roles WHERE is_active = true
UNION ALL
SELECT 
    'System roles',
    COUNT(*)::text
FROM roles WHERE is_system_role = true
UNION ALL
SELECT 
    'Roles with vendors',
    COUNT(DISTINCT r.id)::text
FROM roles r
JOIN vendors v ON v.role_id = r.id
UNION ALL
SELECT
    'Safe to delete',
    COUNT(*)::text
FROM roles r
WHERE 
    NOT EXISTS (SELECT 1 FROM vendors v WHERE v.role_id = r.id)
    AND r.id NOT IN (
        SELECT id FROM roles 
        WHERE LOWER(name) LIKE '%event%organizer%' 
        ORDER BY created_at ASC 
        LIMIT 1
    )
    AND (
        r.name IN (SELECT name FROM roles GROUP BY name HAVING COUNT(*) > 1)
        OR r.is_active = false
    );

\echo ''
\echo '============================================================================'
\echo 'To delete safe roles, run: ./scripts/cleanup-roles-execute.sh'
\echo '============================================================================'

EOF

echo ""
echo "✅ Analysis complete!"
