import type { Context } from 'hono';
import { executevendorVendoridRelocationquotesQuoteidRespondPost } from '../services/vendor_vendorid_relocationquotes_quoteid_respond_post.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorVendoridRelocationquotesQuoteidRespondPostHandler(c: Context) {
  return executevendorVendoridRelocationquotesQuoteidRespondPost(c);
}
