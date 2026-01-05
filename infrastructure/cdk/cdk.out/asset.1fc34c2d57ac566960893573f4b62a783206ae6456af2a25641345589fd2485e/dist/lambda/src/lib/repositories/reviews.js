"use strict";
/**
 * ============================================================================
 * REVIEWS REPOSITORY
 * ============================================================================
 *
 * Repository for review data access.
 * Replaces: review:{reviewId}, vendor:{id}:reviews KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsRepository = void 0;
exports.getReviewsRepository = getReviewsRepository;
const db_1 = require("../db");
class ReviewsRepository {
    pool = null;
    constructor(pool) {
        if (pool) {
            this.pool = pool;
        }
    }
    async getPool() {
        if (!this.pool) {
            this.pool = await (0, db_1.getDbClient)();
        }
        return this.pool;
    }
    async findById(reviewId) {
        const results = await (0, db_1.selectQuery)("reviews", { id: reviewId }, { limit: 1 });
        return results[0] || null;
    }
    async findByVendor(vendorId, options) {
        return (0, db_1.selectQuery)("reviews", { vendor_id: vendorId }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async findByCustomer(customerId, options) {
        return (0, db_1.selectQuery)("reviews", { customer_id: customerId }, {
            limit: options?.limit,
            offset: options?.offset,
            orderBy: "created_at",
            orderDirection: "desc",
        });
    }
    async findByBooking(bookingId) {
        const results = await (0, db_1.selectQuery)("reviews", { booking_id: bookingId }, { limit: 1 });
        return results[0] || null;
    }
    async create(input) {
        const results = await (0, db_1.insertQuery)("reviews", {
            ...input,
            is_verified: false,
        });
        if (!results[0]) {
            throw new Error("Failed to create review");
        }
        return results[0];
    }
    async update(reviewId, input) {
        const results = await (0, db_1.updateQuery)("reviews", { id: reviewId }, {
            ...input,
            updated_at: new Date().toISOString(),
        });
        if (!results[0]) {
            throw new Error(`Review not found: ${reviewId}`);
        }
        return results[0];
    }
    async delete(reviewId) {
        await (0, db_1.deleteQuery)("reviews", { id: reviewId });
    }
}
exports.ReviewsRepository = ReviewsRepository;
let repositoryInstance = null;
function getReviewsRepository() {
    if (!repositoryInstance) {
        repositoryInstance = new ReviewsRepository();
    }
    return repositoryInstance;
}
//# sourceMappingURL=reviews.js.map