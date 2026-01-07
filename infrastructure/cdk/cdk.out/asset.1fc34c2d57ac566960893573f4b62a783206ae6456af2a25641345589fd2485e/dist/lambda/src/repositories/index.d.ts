/**
 * ============================================================================
 * REPOSITORIES INDEX (Lambda Version)
 * ============================================================================
 *
 * Central export point for all repositories.
 * All repositories use AWS RDS Aurora PostgreSQL via RDS Proxy
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ❌ NO Supabase imports allowed
 * ✅ All repositories use SQL only
 * ✅ Uses AWS RDS Aurora (not Supabase)
 *
 * Date: 2025-01-28
 * Agent: Agent 3 (Cognito Integration)
 * Migration: Repository Migration to Lambda
 * ============================================================================
 */
export * from "./customers";
export * from "./vendors";
export * from "./otp";
export * from "./sessions";
export * from "./access-tokens";
export * from "./admin-profiles";
export { getCustomersRepository } from "./customers";
export { getVendorsRepository } from "./vendors";
export { getOtpRepository } from "./otp";
export { getSessionsRepository } from "./sessions";
export { getAccessTokensRepository } from "./access-tokens";
export { getAdminProfilesRepository } from "./admin-profiles";
//# sourceMappingURL=index.d.ts.map