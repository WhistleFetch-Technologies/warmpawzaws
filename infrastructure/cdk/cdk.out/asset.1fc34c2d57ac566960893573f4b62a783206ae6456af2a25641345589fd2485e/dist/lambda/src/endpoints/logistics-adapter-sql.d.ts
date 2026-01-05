/**
 * ============================================================================
 * LOGISTICS ADAPTER (SHIPROCKET) - SQL VERSION
 * ============================================================================
 *
 * Handles shipping, tracking, and serviceable pincode checks
 * Replaces: cache:shiprocket:token and admin:settings:logistics_partners KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2025-01-27
 * ============================================================================
 */
import { Hono } from "hono";
/**
 * Logistics Adapter (Shiprocket)
 * Handles shipping, tracking, and serviceable pincode checks
 */
export declare function registerLogisticsEndpoints(app: Hono): void;
//# sourceMappingURL=logistics-adapter-sql.d.ts.map