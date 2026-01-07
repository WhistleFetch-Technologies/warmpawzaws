"use strict";
/**
 * ============================================================================
 * CAPABILITY GUARD COMPONENT (for use in handlers)
 * ============================================================================
 *
 * Utility functions to check capabilities before executing actions
 *
 * Date: 2025-01-28
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCapabilityGuard = withCapabilityGuard;
exports.requireAllCapabilities = requireAllCapabilities;
exports.requireAnyCapability = requireAnyCapability;
exports.getCapabilityStatus = getCapabilityStatus;
const capability_enforcement_1 = require("../middleware/capability-enforcement");
/**
 * Guard a handler function with capability check
 */
async function withCapabilityGuard(vendorId, capability, handler) {
    const hasCapability = await (0, capability_enforcement_1.checkVendorCapability)(vendorId, capability);
    if (!hasCapability) {
        throw new Error(`Vendor ${vendorId} does not have required capability: ${typeof capability === 'string' ? capability : `${capability.resource}:${capability.action}`}`);
    }
    return handler();
}
/**
 * Check multiple capabilities (AND logic)
 */
async function requireAllCapabilities(vendorId, capabilities) {
    for (const capability of capabilities) {
        const hasCapability = await (0, capability_enforcement_1.checkVendorCapability)(vendorId, capability);
        if (!hasCapability) {
            return false;
        }
    }
    return true;
}
/**
 * Check multiple capabilities (OR logic)
 */
async function requireAnyCapability(vendorId, capabilities) {
    for (const capability of capabilities) {
        const hasCapability = await (0, capability_enforcement_1.checkVendorCapability)(vendorId, capability);
        if (hasCapability) {
            return true;
        }
    }
    return false;
}
/**
 * Get capability status for UI rendering
 */
async function getCapabilityStatus(vendorId) {
    const capabilities = await (0, capability_enforcement_1.getVendorCapabilities)(vendorId);
    const status = {};
    // All possible capabilities
    const allCapabilities = [
        'booking', 'chat', 'tele',
        'prescription', 'medical_records', 'emergency', 'diagnostic_lab',
        'patient_monitoring', 'emergency_protocols', 'ambulance_services',
        'controlled_substances', 'prescription_verification', 'vet_summary',
        'catalog', 'orders', 'inventory', 'delivery', 'expiry_management',
        'photo_updates', 'gallery', 'portfolio', 'progress_tracking', 'cctv_access',
        'gps_tracking', 'distance_pricing',
        'staff_management', 'schedule_management', 'facility_management',
        'multi_doctor_management',
        'custom_services', 'package_management',
        'room_management', 'table_management', 'pax_management',
        'occupancy_tracking', 'nightly_pricing', 'menu',
        'meal_plans', 'diet_charts', 'counseling',
        'adoption', 'donation', 'events', 'memorial',
        'claims_management', 'policy_management',
    ];
    allCapabilities.forEach(cap => {
        status[cap] = capabilities.includes(cap);
    });
    return status;
}
//# sourceMappingURL=capability-guard.js.map