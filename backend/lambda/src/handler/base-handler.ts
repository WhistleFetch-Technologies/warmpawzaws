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

import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';
import { query } from '../database/rds-connection';

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
}

// ============================================================================
// BASE HANDLER CLASS
// ============================================================================

export abstract class BaseHandler {
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
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Parse request
      const body = this.parseBody(event);
      const headers = this.getHeaders(event);
      
      // Create handler context
      const handlerContext: HandlerContext = {
        event,
        context: lambdaContext,
        userId: this.extractUserId(event),
        userRole: this.extractUserRole(event),
      };

      // Execute handler
      const response = await this.handle(handlerContext);

      // Log request
      const duration = Date.now() - startTime;
      this.logRequest(event, response, duration);

      // Return response
      return {
        statusCode: response.statusCode,
        body: response.body,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          ...response.headers,
        },
      };
    } catch (error) {
      return this.handleError(error, event, lambdaContext);
    }
  }

  /**
   * Parse request body
   */
  protected parseBody(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): any {
    if (!event.body) return {};
    
    try {
      const rawBody =
        'isBase64Encoded' in event && event.isBase64Encoded && event.body
          ? Buffer.from(event.body, 'base64').toString()
          : event.body;
      return rawBody ? JSON.parse(rawBody) : {};
    } catch (error) {
      throw new Error('Invalid JSON in request body');
    }
  }

  /**
   * Get request headers
   */
  protected getHeaders(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Record<string, string> {
    return (event as any).headers || {};
  }

  /**
   * Extract user ID from request (from Cognito JWT or Authorization header)
   */
  protected extractUserId(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string | undefined {
    // Check Cognito authorizer (v1 or v2)
    const authorizerClaims = (event as any)?.requestContext?.authorizer?.claims;
    if (authorizerClaims?.sub) {
      return authorizerClaims.sub;
    }
    
    // Check Authorization header
    const authHeader = event.headers?.Authorization || event.headers?.authorization;
    if (authHeader) {
      // Parse JWT token (simplified - in production use proper JWT library)
      try {
        const token = authHeader.replace('Bearer ', '');
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.sub;
      } catch {
        // Invalid token format
      }
    }
    
    return undefined;
  }

  /**
   * Extract user role from request
   */
  protected extractUserRole(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string | undefined {
    const authorizerClaims = (event as any)?.requestContext?.authorizer?.claims;
    if (authorizerClaims?.['cognito:groups']) {
      const groups = authorizerClaims['cognito:groups'];
      return Array.isArray(groups) ? groups[0] : groups;
    }
    return undefined;
  }

  /**
   * Log request for monitoring
   */
  protected logRequest(
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    response: HandlerResponse,
    duration: number
  ): void {
    const method =
      (event as any).httpMethod ||
      (event as APIGatewayProxyEventV2).requestContext?.http?.method ||
      'UNKNOWN';
    const path =
      (event as any).path ||
      (event as APIGatewayProxyEventV2).rawPath ||
      '/';
    console.log(JSON.stringify({
      method,
      path,
      statusCode: response.statusCode,
      duration,
      requestId: event.requestContext?.requestId,
    }));
  }

  /**
   * Handle errors consistently
   */
  protected handleError(
    error: any,
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    context: Context
  ): any {
    const method =
      (event as any).httpMethod ||
      (event as APIGatewayProxyEventV2).requestContext?.http?.method ||
      'UNKNOWN';
    const path =
      (event as any).path ||
      (event as APIGatewayProxyEventV2).rawPath ||
      '/';
    
    // Import error tracking (dynamic to avoid circular dependencies)
    const { captureException } = require('../utils/error-tracking');
    
    // Capture error in error tracking
    captureException(error instanceof Error ? error : new Error(String(error)), {
      path,
      method,
      requestId: (context as any).awsRequestId || 'unknown',
      statusCode: error.statusCode || 500,
    });
    
    console.error('Handler error:', {
      error: error.message,
      stack: error.stack,
      path,
      method,
      requestId: (context as any).awsRequestId || 'unknown',
    });

    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    return {
      statusCode,
      body: JSON.stringify({
        error: message,
        requestId: (context as any).awsRequestId || 'unknown',
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }

  /**
   * Create success response
   */
  protected success(data: any, statusCode: number = 200): HandlerResponse {
    return {
      statusCode,
      body: JSON.stringify(data, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ),
    };
  }

  /**
   * Create error response
   */
  protected error(message: string, statusCode: number = 400): HandlerResponse {
    return {
      statusCode,
      body: JSON.stringify({ error: message }, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ),
    };
  }

  /**
   * Validate required fields
   */
  protected validateRequired(data: any, fields: string[]): void {
    const missing = fields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Check database health
   */
  protected async checkDatabase(): Promise<boolean> {
    try {
      await query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a handler function from a BaseHandler instance
 */
export function createHandler(handler: BaseHandler) {
  return async (
    event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
    context: Context
  ): Promise<any> => {
    return handler.execute(event, context);
  };
}

