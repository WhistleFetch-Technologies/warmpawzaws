-- ============================================================================
-- ROLE CLEANUP SCRIPT
-- ============================================================================
-- This script identifies and removes duplicate/inactive roles safely.
-- 
-- SAFETY RULES:
-- 1. NEVER removes roles that have vendors assigned
-- 2. NEVER removes roles that have vendors with active services
-- 3. Keeps ONE event_organizer role (the oldest one)
-- 4. Only removes truly orphaned duplicate roles
--
-- RUN THIS SCRIPT IN STAGES:
-- 1. First run the ANALYSIS section to see what will be affected
-- 2. Review the output carefully
-- 3. Then run the CLEANUP section if satisfied
-- ============================================================================

-- ============================================================================
-- STAGE 1: ANALYSIS (READ-ONLY)
-- Run this first to understand the current state
-- ============================================================================

-- 1.1 View all roles with their usage counts
SELECT 
    r.id,
    r.name,
    r.display_name,
    r.is_system_role,
    r.is_active,
    r.created_at,
    COALESCE(v.vendor_count, 0) as vendor_count,
    COALESCE(s.service_count, 0) as services_via_vendors,
    COALESCE(p.permission_count, 0) as permission_count,
    CASE 
        WHEN COALESCE(v.vendor_count, 0) > 0 THEN 'HAS VENDORS - PROTECTED'
        WHEN COALESCE(s.service_count, 0) > 0 THEN 'HAS SERVICES - PROTECTED'
        WHEN r.is_system_role THEN 'SYSTEM ROLE - PROTECTED (API)'
        ELSE 'CAN BE DELETED'
    END as status
FROM roles r
LEFT JOIN (
    SELECT role_id, COUNT(*) as vendor_count 
    FROM vendors 
    WHERE role_id IS NOT NULL
    GROUP BY role_id
) v ON r.id = v.role_id
LEFT JOIN (
    SELECT vnd.role_id, COUNT(svc.id) as service_count
    FROM vendors vnd
    JOIN services svc ON svc.vendor_id = vnd.id AND svc.is_active = true
    WHERE vnd.role_id IS NOT NULL
    GROUP BY vnd.role_id
) s ON r.id = s.role_id
LEFT JOIN (
    SELECT role_id, COUNT(*) as permission_count
    FROM role_permissions
    GROUP BY role_id
) p ON r.id = p.role_id
ORDER BY r.name, r.created_at;


-- 1.2 Find duplicate role names (same name, multiple entries)
SELECT 
    name,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY created_at) as role_ids,
    array_agg(is_system_role ORDER BY created_at) as is_system_flags,
    array_agg(is_active ORDER BY created_at) as is_active_flags
FROM roles
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY name;


-- 1.3 Find similar role names (potential duplicates)
SELECT 
    r1.id as role1_id,
    r1.name as role1_name,
    r2.id as role2_id,
    r2.name as role2_name,
    'SIMILAR NAME' as reason
FROM roles r1
JOIN roles r2 ON r1.id < r2.id
WHERE 
    -- Match patterns like: event_organizer vs eventorganizer vs event-organizer
    REPLACE(REPLACE(LOWER(r1.name), '_', ''), '-', '') = 
    REPLACE(REPLACE(LOWER(r2.name), '_', ''), '-', '')
ORDER BY r1.name;


-- 1.4 Event Organizer roles specifically
SELECT 
    r.id,
    r.name,
    r.display_name,
    r.is_system_role,
    r.is_active,
    r.created_at,
    COALESCE(v.vendor_count, 0) as vendor_count,
    CASE 
        WHEN r.id = (
            SELECT id FROM roles 
            WHERE LOWER(name) LIKE '%event%organizer%' 
            ORDER BY created_at ASC 
            LIMIT 1
        ) THEN 'KEEP (OLDEST)'
        ELSE 'CANDIDATE FOR REMOVAL'
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


-- 1.5 Roles that can be safely deleted (no vendors, no services)
SELECT 
    r.id,
    r.name,
    r.display_name,
    r.is_system_role,
    r.is_active,
    r.created_at
FROM roles r
WHERE NOT EXISTS (
    SELECT 1 FROM vendors v WHERE v.role_id = r.id
)
AND r.id NOT IN (
    -- Keep the oldest event organizer
    SELECT id FROM roles 
    WHERE LOWER(name) LIKE '%event%organizer%' 
    ORDER BY created_at ASC 
    LIMIT 1
)
ORDER BY r.name, r.created_at;


-- ============================================================================
-- STAGE 2: IDENTIFY ROLES TO DELETE
-- These are the roles that will be removed
-- ============================================================================

-- 2.1 Create a temp table of roles to delete for review
DROP TABLE IF EXISTS roles_to_delete;
CREATE TEMP TABLE roles_to_delete AS
SELECT 
    r.id,
    r.name,
    r.display_name,
    r.is_system_role,
    r.created_at,
    'ORPHANED - No vendors assigned' as reason
FROM roles r
WHERE 
    -- No vendors using this role
    NOT EXISTS (SELECT 1 FROM vendors v WHERE v.role_id = r.id)
    -- Not the oldest event organizer (we keep one)
    AND r.id NOT IN (
        SELECT id FROM roles 
        WHERE LOWER(name) LIKE '%event%organizer%' 
        ORDER BY created_at ASC 
        LIMIT 1
    )
    -- Is a duplicate (same name exists more than once) OR is inactive
    AND (
        r.name IN (
            SELECT name FROM roles GROUP BY name HAVING COUNT(*) > 1
        )
        OR r.is_active = false
    );

-- View what will be deleted
SELECT * FROM roles_to_delete ORDER BY name, created_at;


-- ============================================================================
-- STAGE 3: CLEANUP (DESTRUCTIVE - RUN ONLY AFTER REVIEWING STAGE 1 & 2)
-- ============================================================================

-- UNCOMMENT THE LINES BELOW TO EXECUTE THE CLEANUP
-- Make sure you've reviewed the analysis output first!

/*
-- 3.1 First, unset the is_system_role flag so API allows deletion
UPDATE roles 
SET is_system_role = false
WHERE id IN (SELECT id FROM roles_to_delete);

-- 3.2 Delete role permissions for roles being removed
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles_to_delete);

-- 3.3 Delete the orphaned/duplicate roles
DELETE FROM roles
WHERE id IN (SELECT id FROM roles_to_delete);

-- 3.4 Verify cleanup
SELECT 
    'Remaining roles' as metric,
    COUNT(*) as count
FROM roles
UNION ALL
SELECT 
    'Active roles' as metric,
    COUNT(*) as count
FROM roles WHERE is_active = true
UNION ALL
SELECT 
    'System roles' as metric,
    COUNT(*) as count
FROM roles WHERE is_system_role = true
UNION ALL
SELECT 
    'Roles with vendors' as metric,
    COUNT(DISTINCT r.id) as count
FROM roles r
JOIN vendors v ON v.role_id = r.id;
*/


-- ============================================================================
-- ALTERNATIVE: Delete specific roles by ID
-- Use this if you want to manually select which roles to delete
-- ============================================================================

/*
-- Replace with actual role IDs you want to delete
-- Example: DELETE FROM role_permissions WHERE role_id IN ('uuid1', 'uuid2');
-- Example: DELETE FROM roles WHERE id IN ('uuid1', 'uuid2');

-- First verify the roles are safe to delete:
SELECT 
    r.id,
    r.name,
    r.is_system_role,
    COALESCE(v.vendor_count, 0) as vendor_count
FROM roles r
LEFT JOIN (
    SELECT role_id, COUNT(*) as vendor_count 
    FROM vendors 
    WHERE role_id IS NOT NULL
    GROUP BY role_id
) v ON r.id = v.role_id
WHERE r.id IN (
    -- Add your role IDs here
    'dcd18108-d8e8-4684-9249-f659a8ee9301'
);

-- If vendor_count is 0, safe to delete:
-- Step 1: Remove system role flag
UPDATE roles SET is_system_role = false 
WHERE id = 'dcd18108-d8e8-4684-9249-f659a8ee9301';

-- Step 2: Delete permissions
DELETE FROM role_permissions 
WHERE role_id = 'dcd18108-d8e8-4684-9249-f659a8ee9301';

-- Step 3: Delete role
DELETE FROM roles 
WHERE id = 'dcd18108-d8e8-4684-9249-f659a8ee9301';
*/
