import type { Hono } from 'hono';
import { pricingQuoteHandler } from '../handlers/pricing-quote.handler';

export function registerPricingQuoteRoute(app: Hono) {
  app.post("/customer/pricing/quote", pricingQuoteHandler);
}
