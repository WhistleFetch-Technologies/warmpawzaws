/**
 * ============================================================================
 * ERROR RECOVERY & RESILIENCE UTILITIES
 * ============================================================================
 *
 * Comprehensive error handling with:
 * - Automatic retry with exponential backoff
 * - Circuit breaker pattern
 * - Dead letter queue handling
 * - Error recovery workflows
 *
 * Date: 2026-01-03
 * ============================================================================
 */
interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
}
/**
 * Execute function with exponential backoff retry
 */
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
interface CircuitBreakerOptions {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
}
declare enum CircuitState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
declare class CircuitBreaker {
    private options;
    private state;
    private failureCount;
    private successCount;
    private nextAttempt;
    constructor(options: CircuitBreakerOptions);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    getState(): CircuitState;
}
export declare function getCircuitBreaker(service: string): CircuitBreaker;
export interface FailedOperation {
    id: string;
    operation_type: string;
    operation_data: any;
    error_message: string;
    attempt_count: number;
    max_attempts: number;
    next_retry_at: Date;
    created_at: Date;
}
/**
 * Queue failed operation for retry
 */
export declare function queueFailedOperation(operationType: string, operationData: any, error: Error, maxAttempts?: number): Promise<void>;
/**
 * Retry failed operations
 */
export declare function retryFailedOperations(): Promise<{
    retried: number;
    succeeded: number;
    failed: number;
}>;
/**
 * Execute saga pattern with compensation
 */
export declare function executeSaga<T>(steps: Array<{
    execute: () => Promise<T>;
    compensate: () => Promise<void>;
    name: string;
}>): Promise<T[]>;
export declare function performHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    autoFixed: string[];
}>;
export declare function ensureFailedOperationsTable(): Promise<void>;
export {};
//# sourceMappingURL=error-recovery.d.ts.map