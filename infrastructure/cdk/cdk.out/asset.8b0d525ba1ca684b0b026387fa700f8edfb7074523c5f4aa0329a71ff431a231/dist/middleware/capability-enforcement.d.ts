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
import { HandlerContext } from '../handler/base-handler';
export interface CapabilityCheck {
    resource: string;
    action: string;
}
/**
 * Check if vendor has a required capability
 */
export declare function checkVendorCapability(vendorId: string, capability: CapabilityCheck | string): Promise<boolean>;
/**
 * Middleware to enforce capability check
 */
export declare function requireCapability(capability: CapabilityCheck | string): (context: HandlerContext) => Promise<boolean>;
/**
 * Get all capabilities for a vendor
 */
export declare function getVendorCapabilities(vendorId: string): Promise<string[]>;
//# sourceMappingURL=capability-enforcement.d.ts.map