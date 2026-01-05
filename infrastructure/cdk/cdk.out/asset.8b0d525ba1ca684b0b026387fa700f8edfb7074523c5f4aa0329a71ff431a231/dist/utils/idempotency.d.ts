/**
 * ============================================================================
 * IDEMPOTENCY UTILITIES (SCHEMA-AGNOSTIC)
 * ============================================================================
 *
 * Provides idempotency key checking and storage for replay-safe operations.
 *
 * NOTE: This module gracefully handles missing database tables.
 * If idempotency_keys table doesn't exist, operations proceed without
 * idempotency protection (fail-open for availability).
 *
 * Date: 2026-01-03
 * ============================================================================
 */
export interface IdempotencyResult {
    exists: boolean;
    response?: any;
    httpStatus?: number;
    entityId?: string;
}
/**
 * Check if an idempotency key exists and return cached response
 */
export declare function checkIdempotencyKey(key: string): Promise<IdempotencyResult>;
/**
 * Store idempotency key with response for future duplicate requests
 */
export declare function storeIdempotencyKey(key: string, entityType: string, entityId: string, response: any, httpStatus?: number, expiryHours?: number): Promise<void>;
/**
 * Wrapper function to make any handler idempotent
 */
export declare function withIdempotency<T>(idempotencyKey: string | undefined, entityType: string, handler: () => Promise<{
    data: T;
    status: number;
}>): Promise<{
    data: T;
    status: number;
    cached: boolean;
}>;
/**
 * Generate deterministic hash for request payload (for additional verification)
 */
export declare function hashRequest(payload: any): string;
//# sourceMappingURL=idempotency.d.ts.map