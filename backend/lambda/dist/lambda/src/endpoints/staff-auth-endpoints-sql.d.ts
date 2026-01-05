/**
 * Staff Authentication & Management Endpoints (SQL-ONLY)
 * ✅ MIGRATED TO SQL: All operations use SQL repositories (NO KV STORE)
 * Handles separate login for doctors/staff with unique mobile numbers
 * Supports multi-vendor-type staff (vets, groomers, trainers, clinic doctors)
 */
import { Hono } from "hono";
export declare function staffAuthEndpointsSQL(mainApp: Hono): void;
export default staffAuthEndpointsSQL;
//# sourceMappingURL=staff-auth-endpoints-sql.d.ts.map