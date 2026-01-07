/**
 * ============================================================================
 * ENDPOINT REGISTRY SYSTEM
 * ============================================================================
 *
 * Auto-discovers and registers all endpoint files from the Supabase functions
 * directory. This system maps endpoint files to their registration functions.
 *
 * Agent 2: Lambda Migration Agent
 * Date: 2025-01-27
 * ============================================================================
 */
import type { Hono } from 'hono';
/**
 * Endpoint registration function type
 */
export type EndpointRegistrationFunction = (app: Hono) => void | Promise<void>;
/**
 * Endpoint registry entry
 */
export interface EndpointRegistryEntry {
    file: string;
    functionName: string;
    priority: number;
    description: string;
}
/**
 * Core endpoints (Priority 1-10)
 * These are critical business logic endpoints that must be registered first
 */
export declare const CORE_ENDPOINTS: EndpointRegistryEntry[];
/**
 * Secondary endpoints (Priority 11-50)
 * Important but not critical for basic functionality
 */
export declare const SECONDARY_ENDPOINTS: EndpointRegistryEntry[];
/**
 * Specialized service endpoints (Priority 51-100)
 */
export declare const SPECIALIZED_ENDPOINTS: EndpointRegistryEntry[];
/**
 * Admin endpoints (Priority 101-150)
 */
export declare const ADMIN_ENDPOINTS: EndpointRegistryEntry[];
/**
 * Analytics endpoints (Priority 151-200)
 */
export declare const ANALYTICS_ENDPOINTS: EndpointRegistryEntry[];
/**
 * All endpoints combined and sorted by priority
 */
export declare const ALL_ENDPOINTS: EndpointRegistryEntry[];
/**
 * Register all endpoints with error handling
 *
 * @param app Hono app instance
 * @param endpointEntries List of endpoint entries to register
 */
export declare function registerEndpoints(app: Hono, endpointEntries?: EndpointRegistryEntry[]): Promise<{
    registered: number;
    failed: number;
    errors: string[];
}>;
/**
 * Get endpoint statistics
 */
export declare function getEndpointStats(): {
    total: number;
    core: number;
    secondary: number;
    specialized: number;
    admin: number;
    analytics: number;
};
//# sourceMappingURL=endpoint-registry.d.ts.map