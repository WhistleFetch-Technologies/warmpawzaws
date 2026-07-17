import type { Context } from 'hono';
import { executebreederInquiryPost } from '../services/breeder_inquiry_post.service';

/** HTTP adapter — delegates to service layer. */
export async function breederInquiryPostHandler(c: Context) {
  return executebreederInquiryPost(c);
}
