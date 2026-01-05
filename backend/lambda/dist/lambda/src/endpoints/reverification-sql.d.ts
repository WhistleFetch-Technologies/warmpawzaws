/**
 * ✅ RE-VERIFICATION MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * Vendor re-verification and rate change management
 *
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * KV Operations: 48 → 0
 *
 * Features:
 * - Vendor re-verification scheduling
 * - Renewal notice management
 * - Rate change request approval/rejection
 * - Custom service approval workflow
 */
import { Hono } from 'hono';
export declare function registerReverificationEndpointsSQL(app: Hono): void;
//# sourceMappingURL=reverification-sql.d.ts.map