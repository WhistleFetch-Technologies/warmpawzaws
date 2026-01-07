"use strict";
/**
 * ============================================================================
 * REPOSITORIES INDEX
 * ============================================================================
 *
 * Central export point for all repositories.
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All repositories use SQL only
 *
 * Date: 2024-12-22
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
exports.getRegionsRepository = exports.getWalletsRepository = exports.getSessionsRepository = exports.getPetsRepository = exports.getReviewsRepository = exports.getCommissionsRepository = exports.getSettlementsRepository = exports.getOtpRepository = exports.getNotificationsRepository = exports.getPayoutsRepository = exports.getRefundsRepository = exports.getOrdersRepository = exports.getStaffRepository = exports.getServicesRepository = exports.getPaymentsRepository = exports.getBookingsRepository = exports.getVendorsRepository = exports.getCustomersRepository = void 0;
// Core repositories
__exportStar(require("./customers"), exports);
__exportStar(require("./vendors"), exports);
__exportStar(require("./bookings"), exports);
__exportStar(require("./payments"), exports);
__exportStar(require("./services"), exports);
__exportStar(require("./staff"), exports);
__exportStar(require("./orders"), exports);
__exportStar(require("./refunds"), exports);
__exportStar(require("./payouts"), exports);
__exportStar(require("./notifications"), exports);
__exportStar(require("./otp"), exports);
__exportStar(require("./settlements"), exports);
// Re-export repository instances for convenience
var customers_1 = require("./customers");
Object.defineProperty(exports, "getCustomersRepository", { enumerable: true, get: function () { return customers_1.getCustomersRepository; } });
var vendors_1 = require("./vendors");
Object.defineProperty(exports, "getVendorsRepository", { enumerable: true, get: function () { return vendors_1.getVendorsRepository; } });
var bookings_1 = require("./bookings");
Object.defineProperty(exports, "getBookingsRepository", { enumerable: true, get: function () { return bookings_1.getBookingsRepository; } });
var payments_1 = require("./payments");
Object.defineProperty(exports, "getPaymentsRepository", { enumerable: true, get: function () { return payments_1.getPaymentsRepository; } });
var services_1 = require("./services");
Object.defineProperty(exports, "getServicesRepository", { enumerable: true, get: function () { return services_1.getServicesRepository; } });
var staff_1 = require("./staff");
Object.defineProperty(exports, "getStaffRepository", { enumerable: true, get: function () { return staff_1.getStaffRepository; } });
var orders_1 = require("./orders");
Object.defineProperty(exports, "getOrdersRepository", { enumerable: true, get: function () { return orders_1.getOrdersRepository; } });
var refunds_1 = require("./refunds");
Object.defineProperty(exports, "getRefundsRepository", { enumerable: true, get: function () { return refunds_1.getRefundsRepository; } });
var payouts_1 = require("./payouts");
Object.defineProperty(exports, "getPayoutsRepository", { enumerable: true, get: function () { return payouts_1.getPayoutsRepository; } });
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "getNotificationsRepository", { enumerable: true, get: function () { return notifications_1.getNotificationsRepository; } });
var otp_1 = require("./otp");
Object.defineProperty(exports, "getOtpRepository", { enumerable: true, get: function () { return otp_1.getOtpRepository; } });
var settlements_1 = require("./settlements");
Object.defineProperty(exports, "getSettlementsRepository", { enumerable: true, get: function () { return settlements_1.getSettlementsRepository; } });
__exportStar(require("./commissions"), exports);
var commissions_1 = require("./commissions");
Object.defineProperty(exports, "getCommissionsRepository", { enumerable: true, get: function () { return commissions_1.getCommissionsRepository; } });
__exportStar(require("./reviews"), exports);
var reviews_1 = require("./reviews");
Object.defineProperty(exports, "getReviewsRepository", { enumerable: true, get: function () { return reviews_1.getReviewsRepository; } });
__exportStar(require("./pets"), exports);
var pets_1 = require("./pets");
Object.defineProperty(exports, "getPetsRepository", { enumerable: true, get: function () { return pets_1.getPetsRepository; } });
__exportStar(require("./sessions"), exports);
var sessions_1 = require("./sessions");
Object.defineProperty(exports, "getSessionsRepository", { enumerable: true, get: function () { return sessions_1.getSessionsRepository; } });
__exportStar(require("./wallets"), exports);
var wallets_1 = require("./wallets");
Object.defineProperty(exports, "getWalletsRepository", { enumerable: true, get: function () { return wallets_1.getWalletsRepository; } });
__exportStar(require("./regions"), exports);
var regions_1 = require("./regions");
Object.defineProperty(exports, "getRegionsRepository", { enumerable: true, get: function () { return regions_1.getRegionsRepository; } });
//# sourceMappingURL=index.js.map