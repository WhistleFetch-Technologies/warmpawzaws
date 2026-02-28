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

import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';
import { verifyCognitoToken, extractAndVerifyAuthToken } from '../utils/jwt-verification';
// TODO: Import from @warmpawz/api-contracts once package is built
// import { createErrorResponse, createSuccessResponse, ERROR_CODES } from '@warmpawz/api-contracts/common';

// Temporary inline definitions until package is built
const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
} as const;

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

function createSuccessResponse<T>(data: T, requestId?: string) {
  return {
    success: true as const,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: 'v1' as const,
    },
  };
}

function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
) {
  return {
    success: false as const,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: 'v1' as const,
    },
  };
}

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// ENHANCED BASE HANDLER CLASS
// ============================================================================

export abstract class BaseHandlerEnhanced {
  /**
   * Main handler method - must be implemented by subclasses
   */
  abstract handle(context: HandlerContext): Promise<HandlerResponse>;

  /**
   * Wrapper that provides common functionality
   */
  async execute(
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    lambdaContext: Context
  ): Promise<APIGatewayProxyResultV2> {
    const startTime = Date.now();
    const requestId = this.getRequestId(event, lambdaContext);
    
    try {
      // Log request start
      this.logRequestStart(event, requestId);

      // Parse request
      const body = this.parseBody(event);
      const headers = this.getHeaders(event);
      
      // Extract and verify user info from Cognito JWT token
      const authResult = await this.extractAndVerifyAuth(event);
      const userId = authResult?.userId;
      const userRole = authResult?.userRole;
      
      // Create handler context
      const handlerContext: HandlerContext = {
        event,
        context: lambdaContext,
        userId,
        userRole,
        requestId,
      };

      // Execute handler
      const response = await this.handle(handlerContext);

      // Log request completion
      const duration = Date.now() - startTime;
      this.logRequestComplete(event, response, duration, requestId);

      // Return standardized response
      return {
        statusCode: response.statusCode,
        body: response.body,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
          'X-Request-Id': requestId,
          ...response.headers,
        },
      };
    } catch (error) {
      return this.handleError(error, event, lambdaContext, requestId);
    }
  }

  /**
   * Get request ID from event or generate one
   */
  protected getRequestId(
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    context: Context
  ): string {
    // Try to get from request context
    if ('requestContext' in event && event.requestContext) {
      const requestId = (event.requestContext as any).requestId;
      if (requestId) return requestId;
    }
    
    // Use Lambda request ID
    return context.awsRequestId || `req-${Date.now()}`;
  }

  /**
   * Parse request body
   */
  protected parseBody(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): any {
    if (!event.body) return null;
    
    try {
      const body = event.isBase64Encoded && event.body
        ? Buffer.from(event.body, 'base64').toString()
        : event.body;
      
      return body ? JSON.parse(body) : null;
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }

  /**
   * Get headers from event
   */
  protected getHeaders(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (event.headers) {
      Object.entries(event.headers).forEach(([key, value]) => {
        if (value !== undefined) {
          headers[key.toLowerCase()] = value;
        }
      });
    }
    
    return headers;
  }

  /**
   * Extract and verify authentication token from request
   * Returns user ID and role if token is valid
   */
  protected async extractAndVerifyAuth(
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2
  ): Promise<{ userId?: string; userRole?: string } | null> {
    const headers = this.getHeaders(event);
    
    // Use the utility function to extract and verify token
    const result = await extractAndVerifyAuthToken(headers);
    
    if (!result.valid || !result.payload) {
      // Token is missing or invalid - this is OK for public endpoints
      // Individual handlers can enforce authentication if needed
      return null;
    }

    const payload = result.payload;
    
    // Extract user ID from token
    const userId = payload.sub || payload['cognito:username'] || undefined;
    
    // Extract user role from token claims
    // Cognito groups are in 'cognito:groups' claim
    const groups = payload['cognito:groups'] as string[] | undefined;
    const userRole = groups?.[0] || payload['custom:user_type'] || undefined;

    return { userId, userRole };
  }

  /**
   * Extract user ID from Cognito JWT token (synchronous fallback)
   * @deprecated Use extractAndVerifyAuth instead for proper validation
   */
  protected extractUserId(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string | undefined {
    // This is kept for backward compatibility but should not be used
    // The async extractAndVerifyAuth should be used instead
    return undefined;
  }

  /**
   * Extract user role from Cognito JWT token (synchronous fallback)
   * @deprecated Use extractAndVerifyAuth instead for proper validation
   */
  protected extractUserRole(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string | undefined {
    // This is kept for backward compatibility but should not be used
    // The async extractAndVerifyAuth should be used instead
    return undefined;
  }

  /**
   * Require authentication - throws error if user is not authenticated
   * Use this in handlers that require authentication
   */
  protected requireAuth(context: HandlerContext): void {
    if (!context.userId) {
      throw new Error('Authentication required');
    }
  }

  /**
   * Validate required fields
   */
  protected validateRequired(data: any, fields: string[]): void {
    const missing = fields.filter(field => data[field] === undefined || data[field] === null);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Create success response
   */
  protected success<T>(data: T, requestId?: string): HandlerResponse {
    const response = createSuccessResponse(data, requestId);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }

  /**
   * Create error response
   */
  protected error(
    message: string,
    statusCode: number = 400,
    code: string = ERROR_CODES.INTERNAL_ERROR,
    details?: Record<string, unknown>,
    requestId?: string
  ): HandlerResponse {
    const response = createErrorResponse(code, message, details, requestId);
    return {
      statusCode,
      body: JSON.stringify(response),
    };
  }

  /**
   * Log request start
   */
  protected logRequestStart(
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    requestId: string
  ): void {
    const method = (event.requestContext as any)?.http?.method || 'UNKNOWN';
    const path = (event as any).rawPath || (event.requestContext as any)?.http?.path || '/';
    
    console.log(JSON.stringify({
      level: 'INFO',
      type: 'REQUEST_START',
      requestId,
      method,
      path,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Log request completion
   */
  protected logRequestComplete(
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    response: HandlerResponse,
    duration: number,
    requestId: string
  ): void {
    const method = (event.requestContext as any)?.http?.method || 'UNKNOWN';
    const path = (event as any).rawPath || (event.requestContext as any)?.http?.path || '/';
    
    console.log(JSON.stringify({
      level: 'INFO',
      type: 'REQUEST_COMPLETE',
      requestId,
      method,
      path,
      statusCode: response.statusCode,
      duration,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Handle errors
   */
  protected handleError(
    error: any,
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    context: Context,
    requestId: string
  ): APIGatewayProxyResultV2 {
    // Log error to CloudWatch
    console.error(JSON.stringify({
      level: 'ERROR',
      type: 'HANDLER_ERROR',
      requestId,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
    }));

    // Determine error code and status
    let statusCode = 500;
    let errorCode: ErrorCode = ERROR_CODES.INTERNAL_ERROR;
    let message = 'Internal Server Error';
    if (error.message?.includes('Missing required')) {
      statusCode = 400;
      errorCode = ERROR_CODES.MISSING_REQUIRED_FIELD;
      message = error.message;
    } else if (error.message?.includes('Invalid JSON')) {
      statusCode = 400;
      errorCode = ERROR_CODES.VALIDATION_ERROR;
      message = error.message;
    } else if (error.message?.includes('Not found')) {
      statusCode = 404;
      errorCode = ERROR_CODES.NOT_FOUND;
      message = error.message;
    } else if (error.message) {
      message = error.message;
    }

    const errorResponse = createErrorResponse(errorCode, message, undefined, requestId);

    return {
      statusCode,
      body: JSON.stringify(errorResponse),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS,PATCH',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
        'X-Request-Id': requestId,
      },
    };
  }
}

// Export alias for backward compatibility
export { BaseHandlerEnhanced as BaseHandler };
