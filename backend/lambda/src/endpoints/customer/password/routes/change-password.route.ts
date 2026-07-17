import type { Hono } from 'hono';
import { changePasswordHandler } from '../handlers/change-password.handler';

export function registerChangePasswordRoute(app: Hono) {
  app.post('/customer/change-password', changePasswordHandler);
}
