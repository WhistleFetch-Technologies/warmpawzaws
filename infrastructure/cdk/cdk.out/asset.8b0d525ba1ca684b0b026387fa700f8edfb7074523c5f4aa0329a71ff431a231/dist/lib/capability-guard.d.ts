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
/**
 * Guard a handler function with capability check
 */
export declare function withCapabilityGuard<T>(vendorId: string, capability: string | {
    resource: string;
    action: string;
}, handler: () => Promise<T>): Promise<T>;
/**
 * Check multiple capabilities (AND logic)
 */
export declare function requireAllCapabilities(vendorId: string, capabilities: (string | {
    resource: string;
    action: string;
})[]): Promise<boolean>;
/**
 * Check multiple capabilities (OR logic)
 */
export declare function requireAnyCapability(vendorId: string, capabilities: (string | {
    resource: string;
    action: string;
})[]): Promise<boolean>;
/**
 * Get capability status for UI rendering
 */
export declare function getCapabilityStatus(vendorId: string): Promise<Record<string, boolean>>;
//# sourceMappingURL=capability-guard.d.ts.map