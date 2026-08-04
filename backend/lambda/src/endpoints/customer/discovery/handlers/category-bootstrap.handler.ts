import type { Context } from 'hono';
import { executeCategoryBootstrap } from '../services/category-bootstrap.service';

/** Delegates to service layer. */
export async function categoryBootstrapHandler(c: Context) {
  return executeCategoryBootstrap(c);
}
