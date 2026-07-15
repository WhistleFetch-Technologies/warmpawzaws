import type { Context } from 'hono';
import { executerelocationQuotePost } from '../services/relocation_quote_post.service';

/** HTTP adapter — delegates to service layer. */
export async function relocationQuotePostHandler(c: Context) {
  return executerelocationQuotePost(c);
}
