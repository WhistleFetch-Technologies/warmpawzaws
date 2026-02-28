/**
 * ============================================================================
 * CUSTOMER PASSWORD MANAGEMENT ENDPOINTS
 * ============================================================================
 * 
 * Thin route wrapper - business logic extracted to controllers/auth.controller.ts
 * 
 * Handles customer password changes:
 * - Change password (with current password verification)
 * - Reset password (via OTP)
 * 
 * Date: 2026-01-07
 * Controller extraction: 2026-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { 
  ChangePasswordHandler,
  createApiGatewayEventWithBody as createApiGatewayEvent,
  createLambdaContext
} from '../controllers/auth.controller';

export function registerCustomerPasswordEndpoints(app: Hono) {
  const changePasswordHandler = new ChangePasswordHandler();

  app.post('/customer/change-password', async (c) => {
    const event = createApiGatewayEvent(c.req, await c.req.json().catch(() => ({})));
    const context = createLambdaContext();
    const result = await changePasswordHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
