import type { Hono } from 'hono';
import { customerCustomeridSearchhistoryDeleteHandler } from '../handlers/customer_customerid_searchhistory_delete.handler';

export function registerCustomerCustomeridSearchhistoryDeleteRoute(app: Hono) {
  app.delete("/customer/:customerId/search-history", customerCustomeridSearchhistoryDeleteHandler);
}
