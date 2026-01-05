/**
 * ============================================================================
 * BASE LAMBDA HANDLER
 * ============================================================================
 *
 * Base class for all Lambda handlers with common functionality:
 * - Error handling
 * - Logging
 * - Response formatting
 * - Authentication middleware
 * - Validation middleware
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
import { APIGatewayProxyEvent, APIGatewayProxyEventV2, Context } from 'aws-lambda';
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
}
export declare abstract class BaseHandler {
    /**
     * Main handler method - must be implemented by subclasses
     */
    abstract handle(context: HandlerContext): Promise<HandlerResponse>;
    /**
     * Wrapper that provides common functionality
     */
    execute(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, lambdaContext: Context): Promise<any>;
    /**
     * Parse request body
     */
    protected parseBody(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): any;
    /**
     * Get request headers
     */
    protected getHeaders(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Record<string, string>;
    /**
     * Extract user ID from request (from Cognito JWT or Authorization header)
     */
    protected extractUserId(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string | undefined;
    /**
     * Extract user role from request
     */
    protected extractUserRole(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string | undefined;
    /**
     * Log request for monitoring
     */
    protected logRequest(event: APIGatewayProxyEvent | APIGatewayProxyEventV2, response: HandlerResponse, duration: number): void;
    /**
     * Handle errors consistently
     */
    protected handleError(error: any, event: APIGatewayProxyEvent | APIGatewayProxyEventV2, context: Context): any;
    /**
     * Create success response
     */
    protected success(data: any, statusCode?: number): HandlerResponse;
    /**
     * Create error response
     */
    protected error(message: string, statusCode?: number): HandlerResponse;
    /**
     * Validate required fields
     */
    protected validateRequired(data: any, fields: string[]): void;
    /**
     * Check database health
     */
    protected checkDatabase(): Promise<boolean>;
}
/**
 * Create a handler function from a BaseHandler instance
 */
export declare function createHandler(handler: BaseHandler): (event: APIGatewayProxyEvent | APIGatewayProxyEventV2, context: Context) => Promise<any>;
//# sourceMappingURL=base-handler.d.ts.map