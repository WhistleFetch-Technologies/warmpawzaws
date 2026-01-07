/**
 * ============================================================================
 * ENHANCED BASE LAMBDA HANDLER
 * ============================================================================
 *
 * Enhanced base handler with:
 * - AWS Cognito JWT validation
 * - CloudWatch logging
 * - Standardized error handling
 * - Request/response validation
 * - Performance monitoring
 *
 * Date: 2026-01-28
 * AWS Serverless Compatible
 * ============================================================================
 */
import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
export interface HandlerResponse {
    statusCode: number;
    body: string;
    headers?: Record<string, string>;
}
export interface HandlerContext {
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2;
    context: Context;
    userId?: string;
    userRole?: string;
    requestId: string;
}
export declare abstract class BaseHandlerEnhanced {
    /**
     * Main handler method - must be implemented by subclasses
     */
    abstract handle(context: HandlerContext): Promise<HandlerResponse>;
    /**
     * Wrapper that provides common functionality
     */
    execute(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, lambdaContext: Context): Promise<APIGatewayProxyResultV2>;
    /**
     * Get request ID from event or generate one
     */
    protected getRequestId(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, context: Context): string;
    /**
     * Parse request body
     */
    protected parseBody(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): any;
    /**
     * Get headers from event
     */
    protected getHeaders(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Record<string, string>;
    /**
     * Extract and verify authentication token from request
     * Returns user ID and role if token is valid
     */
    protected extractAndVerifyAuth(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Promise<{
        userId?: string;
        userRole?: string;
    } | null>;
    /**
     * Extract user ID from Cognito JWT token (synchronous fallback)
     * @deprecated Use extractAndVerifyAuth instead for proper validation
     */
    protected extractUserId(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string | undefined;
    /**
     * Extract user role from Cognito JWT token (synchronous fallback)
     * @deprecated Use extractAndVerifyAuth instead for proper validation
     */
    protected extractUserRole(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string | undefined;
    /**
     * Require authentication - throws error if user is not authenticated
     * Use this in handlers that require authentication
     */
    protected requireAuth(context: HandlerContext): void;
    /**
     * Validate required fields
     */
    protected validateRequired(data: any, fields: string[]): void;
    /**
     * Create success response
     */
    protected success<T>(data: T, requestId?: string): HandlerResponse;
    /**
     * Create error response
     */
    protected error(message: string, statusCode?: number, code?: string, details?: Record<string, unknown>, requestId?: string): HandlerResponse;
    /**
     * Log request start
     */
    protected logRequestStart(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, requestId: string): void;
    /**
     * Log request completion
     */
    protected logRequestComplete(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, response: HandlerResponse, duration: number, requestId: string): void;
    /**
     * Handle errors
     */
    protected handleError(error: any, event: APIGatewayProxyEvent | APIGatewayProxyEventV2, context: Context, requestId: string): APIGatewayProxyResultV2;
}
//# sourceMappingURL=base-handler-enhanced.d.ts.map