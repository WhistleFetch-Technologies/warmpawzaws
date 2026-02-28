/**
 * ============================================================================
 * AUTHENTICATION ENDPOINTS - ENHANCED VERSION
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/auth.controller.ts
 * 
 * Enhanced with:
 * - BaseHandlerEnhanced for CloudWatch logging
 * - API contracts for validation
 * - Standardized responses
 * - Request ID tracking
 * 
 * Date: 2026-01-28
 * Phase 2: Enhanced handler migration
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { 
  SendOtpHandlerEnhanced, 
  VerifyOtpHandlerEnhanced,
  createApiGatewayEventFromHono as createApiGatewayEvent,
  createLambdaContext
} from '../controllers/auth.controller';

export function registerAuthEndpointsEnhanced(app: Hono) {
  const sendOtpHandler = new SendOtpHandlerEnhanced();
  const verifyOtpHandler = new VerifyOtpHandlerEnhanced();

  app.post('/auth/send-otp', async (c) => {
    try {
      const event = await createApiGatewayEvent(c);
      const context = createLambdaContext();
      const result: any = await sendOtpHandler.execute(event, context);
      const body = JSON.parse(result.body);
      return c.json(body, result.statusCode);
    } catch (error: any) {
      console.error('[AUTH] Error in send-otp handler:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  // Compatibility alias: /auth/otp/send (for web/mobile clients)
  app.post('/auth/otp/send', async (c) => {
    try {
      const event = await createApiGatewayEvent(c);
      const context = createLambdaContext();
      const result: any = await sendOtpHandler.execute(event, context);
      const body = JSON.parse(result.body);
      return c.json(body, result.statusCode);
    } catch (error: any) {
      console.error('[AUTH] Error in otp/send handler:', error);
      return c.json({ error: error.message || 'Internal Server Error' }, 500);
    }
  });

  app.post('/auth/verify-otp', async (c) => {
    const startTime = Date.now();
    const TIMEOUT_MS = 25000; // 25 seconds (leave 5s buffer before API Gateway 30s limit)
    
    try {
      // Add timeout protection for JSON parsing
      const parseBodyWithTimeout = async (): Promise<any> => {
        return Promise.race([
          c.req.json(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request body parsing timeout')), 5000)
          )
        ]);
      };

      let event;
      try {
        event = await createApiGatewayEvent(c, parseBodyWithTimeout);
      } catch (parseError: any) {
        console.error('[AUTH] Error parsing request body:', parseError);
        return c.json({ 
          message: 'Invalid request format',
          error: parseError.message || 'Request parsing failed'
        }, 400);
      }

      const context = createLambdaContext();
      
      // Add timeout protection for handler execution
      const handlerPromise = verifyOtpHandler.execute(event, context);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Handler execution timeout')), TIMEOUT_MS)
      );

      const result: any = await Promise.race([handlerPromise, timeoutPromise]);
      
      if (!result || !result.body) {
        throw new Error('Handler returned invalid response');
      }

      const body = JSON.parse(result.body);
      const elapsed = Date.now() - startTime;
      console.log(`[AUTH] verify-otp completed in ${elapsed}ms`);
      
      return c.json(body, result.statusCode);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[AUTH] Error in verify-otp handler (${elapsed}ms):`, error);
      console.error('[AUTH] Error stack:', error?.stack);
      
      // Return 503 for timeout errors, 500 for other errors
      const statusCode = error?.message?.includes('timeout') ? 503 : 500;
      const errorMessage = error?.message || 'Internal Server Error';
      
      return c.json({ 
        message: statusCode === 503 ? 'Service Unavailable' : 'Internal Server Error',
        error: errorMessage
      }, statusCode);
    }
  });

  // Compatibility alias: /auth/otp/verify (for web/mobile clients)
  app.post('/auth/otp/verify', async (c) => {
    const startTime = Date.now();
    const TIMEOUT_MS = 25000; // 25 seconds (leave 5s buffer before API Gateway 30s limit)
    
    try {
      // Add timeout protection for JSON parsing
      const parseBodyWithTimeout = async (): Promise<any> => {
        return Promise.race([
          c.req.json(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request body parsing timeout')), 5000)
          )
        ]);
      };

      let event;
      try {
        event = await createApiGatewayEvent(c, parseBodyWithTimeout);
      } catch (parseError: any) {
        console.error('[AUTH] Error parsing request body:', parseError);
        return c.json({ 
          message: 'Invalid request format',
          error: parseError.message || 'Request parsing failed'
        }, 400);
      }

      const context = createLambdaContext();
      
      // Add timeout protection for handler execution
      const handlerPromise = verifyOtpHandler.execute(event, context);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Handler execution timeout')), TIMEOUT_MS)
      );

      const result: any = await Promise.race([handlerPromise, timeoutPromise]);
      
      if (!result || !result.body) {
        throw new Error('Handler returned invalid response');
      }

      const body = JSON.parse(result.body);
      const elapsed = Date.now() - startTime;
      console.log(`[AUTH] otp/verify completed in ${elapsed}ms`);
      
      return c.json(body, result.statusCode);
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error(`[AUTH] Error in otp/verify handler (${elapsed}ms):`, error);
      console.error('[AUTH] Error stack:', error?.stack);
      
      // Return 503 for timeout errors, 500 for other errors
      const statusCode = error?.message?.includes('timeout') ? 503 : 500;
      const errorMessage = error?.message || 'Internal Server Error';
      
      return c.json({ 
        message: statusCode === 503 ? 'Service Unavailable' : 'Internal Server Error',
        error: errorMessage
      }, statusCode);
    }
  });
}
