import type { Context } from 'hono';
import { executerelocationBookPost } from '../services/relocation_book_post.service';

/** HTTP adapter — delegates to service layer. */
export async function relocationBookPostHandler(c: Context) {
  return executerelocationBookPost(c);
}
