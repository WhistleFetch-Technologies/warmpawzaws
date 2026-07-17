import type { Hono } from 'hono';
import { handleCustomerAccountStatus } from '../handlers/account-status.handler';

export function registerPasswordStatusRoute(app: Hono) {
  app.get('/customer/password-status', handleCustomerAccountStatus);
}
