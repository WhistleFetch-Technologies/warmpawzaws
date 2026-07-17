import type { Hono } from 'hono';
import { handleCustomerAccountStatus, handleCustomerSetPassword } from '../../password';

export function registerCustomerProfileSetpasswordPostRoute(app: Hono) {
  app.post('/customer/profile/set-password', handleCustomerSetPassword);
}
