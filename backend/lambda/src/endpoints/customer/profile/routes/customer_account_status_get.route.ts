import type { Hono } from 'hono';
import { handleCustomerAccountStatus, handleCustomerSetPassword } from '../../password';

export function registerCustomerAccountStatusGetRoute(app: Hono) {
  app.get('/customer/account/status', handleCustomerAccountStatus);
}
