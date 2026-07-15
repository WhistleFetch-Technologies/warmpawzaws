import type { Hono } from 'hono';
import { handleCustomerAccountStatus, handleCustomerSetPassword } from '../../password';

export function registerCustomerProfilePasswordstatusGetRoute(app: Hono) {
  app.get('/customer/profile/password-status', handleCustomerAccountStatus);
}
