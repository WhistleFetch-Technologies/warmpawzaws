import type { Hono } from 'hono';
import { customerCustomeridSearchhistoryGetHandler } from '../handlers/customer_customerid_searchhistory_get.handler';

export function registerCustomerCustomeridSearchhistoryGetRoute(app: Hono) {
  app.get("/customer/:customerId/search-history", customerCustomeridSearchhistoryGetHandler);
}
