/**
 * ============================================================================
 * ENDPOINT REGISTRY SYSTEM
 * ============================================================================
 *
 * Auto-discovers and registers all endpoints for Lambda handler
 *
 * Agent 2: Lambda Migration Agent
 * Date: 2025-01-28
 *
 * ✅ All endpoints are Node.js-converted and SQL-only
 * ============================================================================
 */
import type { Hono } from 'hono';
/**
 * Endpoint Module Definition
 */
interface EndpointModule {
    file: string;
    exportName: string;
    priority: number;
    category: 'core' | 'secondary' | 'admin' | 'specialized';
    description: string;
}
/**
 * Register all endpoints in the Hono app
 *
 * @param app - Hono app instance
 */
export declare function registerAllEndpoints(app: Hono): Promise<void>;
/**
 * Get endpoint registry (for debugging/inspection)
 */
export declare function getEndpointRegistry(): EndpointModule[];
/**
 * Get endpoints by category
 */
export declare function getEndpointsByCategory(category: EndpointModule['category']): EndpointModule[];
export {};
//# sourceMappingURL=endpoint-registry.d.ts.map