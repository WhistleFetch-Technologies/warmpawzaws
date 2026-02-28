/**
 * ============================================================================
 * AUTH ROUTES
 * ============================================================================
 * 
 * Route registration for authentication endpoints
 * 
 * Routes:
 * - POST /auth/send-otp
 * - POST /auth/verify-otp
 * - POST /auth/otp/send (alias)
 * - POST /auth/otp/verify (alias)
 * - POST /customer/change-password
 * 
 * Date: 2026-01-28
 * Phase 1: Auth domain restructuring
 * ============================================================================
 */

import { Hono } from 'hono';

// TODO: Phase 1 - Extract handlers to controllers/auth/
// For now, import from original endpoint files to preserve functionality
// Using relative path from backend_modified to backend
import { registerAuthEndpointsEnhanced } from '../endpoints/auth-enhanced';
import { registerCustomerPasswordEndpoints } from '../endpoints/customer-password';
import { registerEnhancedOtpEndpoints } from '../endpoints/otp-enhanced';

/**
 * Register all auth-related routes
 * Preserves exact route registration order from handler/index.ts
 * 
 * NOTE: Currently imports from original backend to preserve functionality.
 * TODO: Extract all handlers to controllers/auth/ and update to use them directly.
 */
export function registerAuthRoutes(app: Hono) {
  // Register enhanced auth endpoints (primary)
  // This includes: /auth/send-otp, /auth/verify-otp, /auth/otp/send, /auth/otp/verify
  registerAuthEndpointsEnhanced(app);
  
  // Register customer password endpoints
  // This includes: /customer/change-password
  registerCustomerPasswordEndpoints(app);
  
  // Register enhanced OTP endpoints (for booking OTPs)
  // This includes: /bookings/:bookingId/generate-otp, /bookings/:bookingId/verify-otp
  registerEnhancedOtpEndpoints(app);
  
  // TODO: Phase 1 - Complete handler extraction
  // When handlers are fully extracted to controllers/auth/, update to:
  // import { SendOtpHandlerEnhanced } from '../controllers/auth/send-otp.controller';
  // import { VerifyOtpHandlerEnhanced } from '../controllers/auth/verify-otp.controller';
  // import { ChangePasswordHandler } from '../controllers/auth/password.controller';
  // 
  // const sendOtpHandler = new SendOtpHandlerEnhanced();
  // app.post('/auth/send-otp', async (c) => {
  //   const event = await createApiGatewayEvent(c);
  //   const context = createLambdaContext();
  //   const result = await sendOtpHandler.execute(event, context);
  //   return c.json(JSON.parse(result.body), result.statusCode);
  // });
}
