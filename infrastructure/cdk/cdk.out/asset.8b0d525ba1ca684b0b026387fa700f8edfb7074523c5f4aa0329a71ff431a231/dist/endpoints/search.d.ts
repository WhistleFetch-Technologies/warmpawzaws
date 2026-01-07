/**
 * ============================================================================
 * SEARCH ENDPOINTS - LAMBDA VERSION WITH OPENSEARCH FALLBACK
 * ============================================================================
 *
 * Handles search for services and vendors with intelligent fallback:
 * 1. Try OpenSearch (if available)
 * 2. Fall back to PostgreSQL full-text search
 *
 * - Universal service discovery
 * - Vendor search
 * - Service search
 * - Problem-based discovery
 *
 * Date: 2025-01-28 (Updated: 2026-01-02)
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
export declare function registerSearchEndpoints(app: Hono): void;
//# sourceMappingURL=search.d.ts.map