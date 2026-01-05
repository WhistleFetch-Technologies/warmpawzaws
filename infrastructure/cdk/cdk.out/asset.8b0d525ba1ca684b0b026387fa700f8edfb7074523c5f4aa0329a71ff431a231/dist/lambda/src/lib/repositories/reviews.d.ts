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
import type { Pool } from "../db";
export interface Review {
    id: string;
    booking_id?: string | null;
    customer_id: string;
    vendor_id?: string | null;
    staff_id?: string | null;
    service_id?: string | null;
    rating: number;
    comment?: string | null;
    is_verified: boolean;
    created_at: string;
    updated_at: string;
}
export interface CreateReviewInput {
    booking_id?: string;
    customer_id: string;
    vendor_id?: string;
    staff_id?: string;
    service_id?: string;
    rating: number;
    comment?: string;
}
export declare class ReviewsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findById(reviewId: string): Promise<Review | null>;
    findByVendor(vendorId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Review[]>;
    findByCustomer(customerId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Review[]>;
    findByBooking(bookingId: string): Promise<Review | null>;
    create(input: CreateReviewInput): Promise<Review>;
    update(reviewId: string, input: Partial<CreateReviewInput>): Promise<Review>;
    delete(reviewId: string): Promise<void>;
}
export declare function getReviewsRepository(): ReviewsRepository;
//# sourceMappingURL=reviews.d.ts.map