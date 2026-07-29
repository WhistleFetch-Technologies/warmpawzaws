import type { Hono } from 'hono';
import { WAPPT_DISCOVERY_BY_CATEGORY_PATH } from '../constants';
import { discoveryByCategoryGetHandler } from '../handlers/discovery_by_category_get.handler';

export function registerDiscoveryByCategoryGetRoute(app: Hono) {
  app.get(WAPPT_DISCOVERY_BY_CATEGORY_PATH, discoveryByCategoryGetHandler);
}
