#!/bin/bash
# ============================================================================
# Role Cleanup Execution Script
# ============================================================================
# DELETES orphaned duplicate and inactive roles
#
# SAFETY:
# - Never deletes roles with vendors
# - Keeps one event_organizer role
# - Only deletes duplicates and inactive roles without vendors
#
# Usage:
#   ./scripts/cleanup-roles-execute.sh                    # Will prompt for DB credentials
#   DB_HOST=xxx DB_USER=xxx DB_NAME=xxx ./scripts/cleanup-roles-execute.sh
# ============================================================================

set -e

echo "🗑️ ROLE CLEANUP SCRIPT"
echo "======================="
echo ""
echo "⚠️  WARNING: This script will DELETE roles!"
echo ""

# Get database credentials
if [ -z "$DB_HOST" ]; then
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

# Show what will be deleted
echo "📋 Roles that will be DELETED:"
echo ""

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t <<'EOF'
SELECT 
    '  - ' || r.name || ' (' || r.id || ') - ' || 
    CASE
        WHEN r.name IN (SELECT name FROM roles GROUP BY name HAVING COUNT(*) > 1) THEN 'DUPLICATE'
        WHEN r.is_active = false THEN 'INACTIVE'
        ELSE 'ORPHAN'
    END as info
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
ORDER BY r.name;
EOF

# Count roles to delete
ROLE_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT COUNT(*)
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
" | xargs)

echo ""
echo "Total roles to delete: $ROLE_COUNT"
echo ""

if [ "$ROLE_COUNT" -eq 0 ]; then
    echo "✅ No roles to delete!"
    exit 0
fi

# Confirmation
read -p "🚨 Are you sure you want to delete these $ROLE_COUNT roles? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "🔄 Executing cleanup..."
echo ""

# Execute deletion
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<'EOF'

-- Create temp table of roles to delete
CREATE TEMP TABLE roles_to_delete AS
SELECT r.id, r.name
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

-- Show what we're deleting
\echo 'Deleting the following roles:'
SELECT id, name FROM roles_to_delete;

-- Step 1: Remove system role flag
UPDATE roles 
SET is_system_role = false
WHERE id IN (SELECT id FROM roles_to_delete);

\echo ''
\echo '✅ Step 1: Removed system role flags'

-- Step 2: Delete role permissions
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles_to_delete);

\echo '✅ Step 2: Deleted role permissions'

-- Step 3: Delete the roles
DELETE FROM roles
WHERE id IN (SELECT id FROM roles_to_delete);

\echo '✅ Step 3: Deleted roles'
\echo ''

-- Summary
\echo '📈 CLEANUP SUMMARY:'
SELECT 
    'Remaining roles' as metric,
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
JOIN vendors v ON v.role_id = r.id;

EOF

echo ""
echo "✅ Cleanup complete!"
