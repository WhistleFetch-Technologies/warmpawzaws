import type { Hono } from 'hono';
import { debugTrainingVendorsHandler } from '../handlers/debug-training-vendors.handler';

export function registerDebugTrainingVendorsRoute(app: Hono) {
  app.get('/customer/debug/training-vendors', debugTrainingVendorsHandler);
}
