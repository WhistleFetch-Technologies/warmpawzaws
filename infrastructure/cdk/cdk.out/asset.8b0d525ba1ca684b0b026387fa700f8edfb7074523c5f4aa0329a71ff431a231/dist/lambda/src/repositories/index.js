"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminProfilesRepository = exports.getAccessTokensRepository = exports.getSessionsRepository = exports.getOtpRepository = exports.getVendorsRepository = exports.getCustomersRepository = void 0;
// Core repositories (migrated)
__exportStar(require("./customers"), exports);
__exportStar(require("./vendors"), exports);
__exportStar(require("./otp"), exports);
__exportStar(require("./sessions"), exports);
__exportStar(require("./access-tokens"), exports);
__exportStar(require("./admin-profiles"), exports);
// Re-export repository instances for convenience
var customers_1 = require("./customers");
Object.defineProperty(exports, "getCustomersRepository", { enumerable: true, get: function () { return customers_1.getCustomersRepository; } });
var vendors_1 = require("./vendors");
Object.defineProperty(exports, "getVendorsRepository", { enumerable: true, get: function () { return vendors_1.getVendorsRepository; } });
var otp_1 = require("./otp");
Object.defineProperty(exports, "getOtpRepository", { enumerable: true, get: function () { return otp_1.getOtpRepository; } });
var sessions_1 = require("./sessions");
Object.defineProperty(exports, "getSessionsRepository", { enumerable: true, get: function () { return sessions_1.getSessionsRepository; } });
var access_tokens_1 = require("./access-tokens");
Object.defineProperty(exports, "getAccessTokensRepository", { enumerable: true, get: function () { return access_tokens_1.getAccessTokensRepository; } });
var admin_profiles_1 = require("./admin-profiles");
Object.defineProperty(exports, "getAdminProfilesRepository", { enumerable: true, get: function () { return admin_profiles_1.getAdminProfilesRepository; } });
// TODO: Migrate remaining repositories
// - bookings
// - payments
// - services
// - staff
// - orders
// - refunds
// - payouts
// - notifications
// - settlements
// - commissions
// - reviews
// - pets
// - wallets
//# sourceMappingURL=index.js.map