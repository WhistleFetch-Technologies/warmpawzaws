import type { Hono } from 'hono';
import { registerPasswordStatusRoute } from './routes/password-status.route';
import { registerSetPasswordRoute } from './routes/set-password.route';
import { registerChangePasswordRoute } from './routes/change-password.route';

export { handleCustomerAccountStatus } from './handlers/account-status.handler';
export { handleCustomerSetPassword } from './handlers/set-password.handler';
export { ChangePasswordHandler } from './handlers/change-password.handler';
export { resolvePostgresCustomerIdFromAuthHeaders } from './repos/customer-auth.repo';
export { hasMeaningfulStoredPassword } from './services/password-hash.utils';

export function registerCustomerPasswordEndpoints(app: Hono) {
  registerPasswordStatusRoute(app);
  registerSetPasswordRoute(app);
  registerChangePasswordRoute(app);
}
