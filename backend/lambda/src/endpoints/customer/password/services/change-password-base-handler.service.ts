import { BaseHandler, HandlerContext, HandlerResponse } from '../../../../handler/base-handler';
import { hashCustomerPasswordBcrypt, verifyCustomerPassword } from '../../../../lib/services/auth/customer-password-crypto';
import { updateCustomerPasswordHashWithAuthVersionBump } from '../../../../lib/services/auth/customer-auth-version-support';
import {
  resolvePostgresCustomerIdFromAuthHeaders,
  selectCustomerIdByPhoneLast10,
} from '../repos/customer-auth.repo';
import * as changePasswordBaseRepo from '../repos/change-password-base-handler.repo';
import { hasMeaningfulStoredPassword } from '../services/password-hash.utils';
import {
  mergeChangePasswordRequestBody,
  pickStr,
} from '../services/password-body.utils';

export class ChangePasswordHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const forced = (context.event as { __parsedRequestBody?: Record<string, unknown> }).__parsedRequestBody;
    const fromEvent = this.parseBody(context.event) as Record<string, unknown>;
    const body = mergeChangePasswordRequestBody(fromEvent, forced);
    const currentPassword =
      pickStr(body.currentPassword) || pickStr(body.current_password);
    const newPassword =
      pickStr(body.newPassword) ||
      pickStr(body.new_password) ||
      pickStr(body.password) ||
      pickStr(fromEvent.newPassword) ||
      pickStr(fromEvent.new_password) ||
      pickStr(fromEvent.password);
    const customerId = body.customerId ?? body.customer_id;
    const phone = pickStr(body.phone) || pickStr(body.phone_number);

    if (!newPassword || newPassword.length < 8) {
      return this.error('New password must be at least 8 characters long', 400);
    }

    try {
      let customerIdResolved: string | undefined =
        typeof customerId === 'string' && customerId.trim() ? String(customerId).trim() : undefined;
      if (!customerIdResolved && phone) {
        const customers = await changePasswordBaseRepo.dbSelectCustomersByPhone(phone);
        if (customers.length === 0) {
          const last10 = phone.replace(/\D/g, '').slice(-10);
          if (last10.length >= 10) {
            const byLast10 = await selectCustomerIdByPhoneLast10(last10);
            if (byLast10) customerIdResolved = byLast10;
          }
        } else {
          customerIdResolved = customers[0].id;
        }
      }

      if (!customerIdResolved) {
        const headers = this.getHeaders(context.event);
        const fromAuth = await resolvePostgresCustomerIdFromAuthHeaders(headers);
        if (fromAuth) customerIdResolved = fromAuth;
      }

      if (!customerIdResolved) {
        return this.error('Customer ID or phone is required', 400);
      }

      const customers = await changePasswordBaseRepo.dbSelectCustomerPasswordRow(customerIdResolved);

      if (customers.rows.length === 0) {
        return this.error('Customer not found', 404);
      }

      const customer = customers.rows[0];

      if (hasMeaningfulStoredPassword(customer.password_hash)) {
        if (!currentPassword || !String(currentPassword).trim()) {
          return this.error('Current password is required', 400);
        }
        const isValid = await verifyCustomerPassword(currentPassword, customer.password_hash);
        if (!isValid) {
          return this.error('Current password is incorrect', 401);
        }
      }

      const newPasswordHash = await hashCustomerPasswordBcrypt(newPassword);

      await updateCustomerPasswordHashWithAuthVersionBump(newPasswordHash, customer.id);

      let freshToken: Record<string, unknown> | null = null;
      try {
        const { issueAuthTokensAfterOtp } = await import('../../../../lib/services/auth/vendor-otp-success-payload');
        const tokens = await issueAuthTokensAfterOtp({
          userId: customer.id,
          phone: String(customer.phone || ''),
          role: 'customer',
        });
        freshToken = {
          access_token: tokens.accessToken,
          id_token: tokens.idToken,
          refresh_token: tokens.refreshToken,
          expires_in: tokens.expiresIn,
        };
      } catch {
        // fresh token is optional; password was still saved
      }

      return this.success({
        message: 'Password changed successfully',
        customerId: customer.id,
        ...(freshToken ? { token: freshToken } : {}),
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      return this.error(error.message || 'Failed to change password', 500);
    }
  }
}

export const changePasswordHandlerInstance = new ChangePasswordHandler();
