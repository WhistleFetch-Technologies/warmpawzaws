/**
 * ============================================================================
 * ADMIN GOVERNANCE ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles propagation of admin changes to vendors and customers
 * Manages cache invalidation and real-time updates
 *
 * Endpoints:
 * - POST /admin/governance/propagate - Propagate changes to apps
 * - POST /admin/governance/invalidate-cache - Invalidate caches
 * - GET /admin/governance/status - Check propagation status
 *
 * Date: 2026-01-02
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerAdminGovernanceEndpoints(app: Hono): void;
//# sourceMappingURL=admin-governance.d.ts.map