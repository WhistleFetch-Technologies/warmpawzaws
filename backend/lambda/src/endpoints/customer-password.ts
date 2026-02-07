/**
 * ============================================================================
 * CUSTOMER PASSWORD MANAGEMENT ENDPOINTS
 * ============================================================================
 * 
 * Handles customer password changes:
 * - Change password (with current password verification)
 * - Reset password (via OTP)
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
// Note: Password hashing using crypto module (bcryptjs not installed)
import * as crypto from 'crypto';

// Simple password hashing using PBKDF2 (crypto is built-in)
const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const comparePassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const derivedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === derivedHash;
};

// ============================================================================
// CHANGE PASSWORD HANDLER
// ============================================================================

class ChangePasswordHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { currentPassword, newPassword, customerId, phone } = body;

    if (!newPassword || newPassword.length < 8) {
      return this.error('New password must be at least 8 characters long', 400);
    }

    if (!currentPassword) {
      return this.error('Current password is required', 400);
    }

    try {
      // Resolve customer ID
      let customerIdResolved = customerId;
      if (!customerIdResolved && phone) {
        const customers = await select('customers', { phone });
        if (customers.length === 0) {
          return this.error('Customer not found', 404);
        }
        customerIdResolved = customers[0].id;
      }

      if (!customerIdResolved) {
        return this.error('Customer ID or phone is required', 400);
      }

      // Get customer with password hash
      const customers = await query(
        `SELECT id, password_hash, phone FROM customers WHERE id = $1 OR phone = $1`,
        [customerIdResolved]
      );

      if (customers.rows.length === 0) {
        return this.error('Customer not found', 404);
      }

      const customer = customers.rows[0];

      // Verify current password
      if (customer.password_hash) {
        const isValid = await comparePassword(currentPassword, customer.password_hash);
        if (!isValid) {
          return this.error('Current password is incorrect', 401);
        }
      } else {
        // If no password hash exists (e.g., OTP-only login), allow password set
        // This handles first-time password setup
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password
      await query(
        `UPDATE customers SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newPasswordHash, customer.id]
      );

      return this.success({
        message: 'Password changed successfully',
        customerId: customer.id,
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      return this.error(error.message || 'Failed to change password', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerCustomerPasswordEndpoints(app: Hono) {
  const changePasswordHandler = new ChangePasswordHandler();

  app.post('/customer/change-password', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await changePasswordHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// Helper to convert Hono request to API Gateway event
function createApiGatewayEvent(req: any): any {
  return {
    pathParameters: {},
    queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
    body: req.body ? JSON.stringify(req.body) : null,
    headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header?.('x-user-id') || 'test-user'
        }
      }
    }
  };
}

function createLambdaContext(): any {
  return {};
}

