import type { Hono } from 'hono';
import { handleCustomerAccountStatus, handleCustomerSetPassword } from '../../password';

export function registerCustomerAccountPasswordPostRoute(app: Hono) {
  app.post('/customer/account/password', handleCustomerSetPassword);
}
