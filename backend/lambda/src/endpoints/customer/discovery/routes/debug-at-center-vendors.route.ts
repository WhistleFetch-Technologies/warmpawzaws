import type { Hono } from 'hono';
import { debugAtCenterVendorsHandler } from '../handlers/debug-at-center-vendors.handler';

export function registerDebugAtCenterVendorsRoute(app: Hono) {
  app.get('/customer/debug/at-center-vendors', debugAtCenterVendorsHandler);
}
