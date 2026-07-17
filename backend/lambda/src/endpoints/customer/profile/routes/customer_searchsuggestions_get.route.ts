import type { Hono } from 'hono';
import { customerSearchsuggestionsGetHandler } from '../handlers/customer_searchsuggestions_get.handler';

export function registerCustomerSearchsuggestionsGetRoute(app: Hono) {
  app.get("/customer/search-suggestions", customerSearchsuggestionsGetHandler);
}
