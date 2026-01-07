/**
 * ============================================================================
 * REVIEWS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles customer reviews:
 * - Create reviews
 * - Get reviews for vendor/service
 * - Approve/reject reviews (admin)
 * - Update reviews
 *
 * Migrated from: supabase/functions/server/review-endpoints.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerReviewEndpoints(app: Hono): void;
//# sourceMappingURL=reviews.d.ts.map