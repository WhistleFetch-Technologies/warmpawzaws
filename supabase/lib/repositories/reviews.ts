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

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

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

export class ReviewsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  async findById(reviewId: string): Promise<Review | null> {
    const results = await selectQuery<Review>("reviews", { id: reviewId }, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Get all reviews (with optional filters)
   */
  async findAll(options?: { limit?: number; offset?: number; vendorId?: string }): Promise<Review[]> {
    const conditions: any = {};
    if (options?.vendorId) {
      conditions.vendor_id = options.vendorId;
    }
    
    return selectQuery<Review>("reviews", conditions, {
      limit: options?.limit || 1000,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findByVendor(vendorId: string, options?: { limit?: number; offset?: number }): Promise<Review[]> {
    return selectQuery<Review>("reviews", { vendor_id: vendorId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findByCustomer(customerId: string, options?: { limit?: number; offset?: number }): Promise<Review[]> {
    return selectQuery<Review>("reviews", { customer_id: customerId }, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: "created_at",
      orderDirection: "desc",
    });
  }

  async findByBooking(bookingId: string): Promise<Review | null> {
    const results = await selectQuery<Review>("reviews", { booking_id: bookingId }, { limit: 1 });
    return results[0] || null;
  }

  async create(input: CreateReviewInput): Promise<Review> {
    const results = await insertQuery<Review>("reviews", {
      ...input,
      is_verified: false,
    });
    
    if (!results[0]) {
      throw new Error("Failed to create review");
    }
    
    return results[0];
  }

  async update(reviewId: string, input: Partial<CreateReviewInput>): Promise<Review> {
    const results = await updateQuery<Review>(
      "reviews",
      { id: reviewId },
      {
        ...input,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Review not found: ${reviewId}`);
    }
    
    return results[0];
  }

  async delete(reviewId: string): Promise<void> {
    await deleteQuery("reviews", { id: reviewId });
  }
}

let repositoryInstance: ReviewsRepository | null = null;

export function getReviewsRepository(): ReviewsRepository {
  if (!repositoryInstance) {
    repositoryInstance = new ReviewsRepository();
  }
  return repositoryInstance;
}

