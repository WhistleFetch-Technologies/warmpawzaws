import type { Hono } from 'hono';
import { customerCustomeridSearchhistoryPostHandler } from '../handlers/customer_customerid_searchhistory_post.handler';

export function registerCustomerCustomeridSearchhistoryPostRoute(app: Hono) {
  app.post("/customer/:customerId/search-history", customerCustomeridSearchhistoryPostHandler);
}
