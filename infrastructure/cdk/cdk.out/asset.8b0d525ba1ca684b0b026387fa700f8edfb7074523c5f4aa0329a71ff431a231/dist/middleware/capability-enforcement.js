"use strict";
/**
 * ============================================================================
 * CAPABILITY ENFORCEMENT MIDDLEWARE
 * ============================================================================
 *
 * Enforces role-based capabilities for vendor endpoints
 * Checks if vendor has required capability before allowing action
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkVendorCapability = checkVendorCapability;
exports.requireCapability = requireCapability;
exports.getVendorCapabilities = getVendorCapabilities;
const rds_connection_1 = require("../database/rds-connection");
/**
 * Check if vendor has a required capability
 */
async function checkVendorCapability(vendorId, capability) {
    try {
        // Get vendor
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
        if (vendors.length === 0) {
            return false;
        }
        const vendor = vendors[0];
        if (!vendor.role_id) {
            return false;
        }
        // If capability is a string, check permission_name
        if (typeof capability === 'string') {
            const permissions = await (0, rds_connection_1.select)('role_permissions', {
                role_id: vendor.role_id,
                permission_name: capability,
            });
            return permissions.length > 0;
        }
        // If capability is an object, check resource/action
        const permissions = await (0, rds_connection_1.select)('role_permissions', {
            role_id: vendor.role_id,
            resource: capability.resource,
            action: capability.action,
        });
        return permissions.length > 0;
    }
    catch (error) {
        console.error('Error checking vendor capability:', error);
        return false;
    }
}
/**
 * Middleware to enforce capability check
 */
function requireCapability(capability) {
    return async (context) => {
        const vendorId = context.userId ||
            context.event.pathParameters?.vendorId ||
            context.event.queryStringParameters?.vendorId;
        if (!vendorId) {
            return false;
        }
        return await checkVendorCapability(vendorId, capability);
    };
}
/**
 * Get all capabilities for a vendor
 */
async function getVendorCapabilities(vendorId) {
    try {
        const vendors = await (0, rds_connection_1.select)('vendors', { id: vendorId });
        if (vendors.length === 0 || !vendors[0].role_id) {
            return [];
        }
        const permissions = await (0, rds_connection_1.select)('role_permissions', {
            role_id: vendors[0].role_id,
        });
        return permissions.map(p => p.permission_name);
    }
    catch (error) {
        console.error('Error getting vendor capabilities:', error);
        return [];
    }
}
//# sourceMappingURL=capability-enforcement.js.map