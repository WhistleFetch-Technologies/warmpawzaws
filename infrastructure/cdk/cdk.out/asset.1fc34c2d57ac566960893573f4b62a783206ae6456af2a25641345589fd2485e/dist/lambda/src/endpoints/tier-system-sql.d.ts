/**
 * ============================================================================
 * TIER SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Vendor tier management
 * - Commission rate lookup
 * - Tier calculation based on GMV
 * - Tier upgrades
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2025-01-27
 * Migration: Phase 6 - KV to SQL (Critical P0)
 * ============================================================================
 */
import { Hono } from "hono";
export declare const TIER_CONFIG: {
    SILVER: {
        id: string;
        name: string;
        commissionRate: number;
        minGMV: number;
        benefits: string[];
    };
    GOLD: {
        id: string;
        name: string;
        commissionRate: number;
        minGMV: number;
        benefits: string[];
    };
    PLATINUM: {
        id: string;
        name: string;
        commissionRate: number;
        minGMV: number;
        benefits: string[];
    };
};
export declare function tierSystemEndpoints(app: Hono): void;
//# sourceMappingURL=tier-system-sql.d.ts.map