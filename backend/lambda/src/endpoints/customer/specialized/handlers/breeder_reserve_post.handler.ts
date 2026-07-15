import type { Context } from 'hono';
import { executebreederReservePost } from '../services/breeder_reserve_post.service';

/** HTTP adapter — delegates to service layer. */
export async function breederReservePostHandler(c: Context) {
  return executebreederReservePost(c);
}
