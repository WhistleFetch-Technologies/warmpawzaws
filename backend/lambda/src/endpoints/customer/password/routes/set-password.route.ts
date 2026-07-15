import type { Hono } from 'hono';
import { handleCustomerSetPassword } from '../handlers/set-password.handler';

export function registerSetPasswordRoute(app: Hono) {
  app.post('/customer/set-password', handleCustomerSetPassword);
}
