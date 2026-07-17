import type { Hono } from 'hono';
import { relocationQuotePostHandler } from '../handlers/relocation_quote_post.handler';

export function registerRelocationQuotePostRoute(app: Hono) {
  app.post("/relocation/quote", relocationQuotePostHandler);
}
