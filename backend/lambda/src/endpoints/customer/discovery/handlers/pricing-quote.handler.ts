import type { Context } from 'hono';
import { executepricingQuote } from '../services/pricing-quote.service';

/** HTTP adapter — delegates to service layer. */
export async function pricingQuoteHandler(c: Context) {
  return executepricingQuote(c);
}
