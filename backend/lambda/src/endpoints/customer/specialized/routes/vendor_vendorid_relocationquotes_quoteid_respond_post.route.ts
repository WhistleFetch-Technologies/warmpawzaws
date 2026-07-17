import type { Hono } from 'hono';
import { vendorVendoridRelocationquotesQuoteidRespondPostHandler } from '../handlers/vendor_vendorid_relocationquotes_quoteid_respond_post.handler';

export function registerVendorVendoridRelocationquotesQuoteidRespondPostRoute(app: Hono) {
  app.post("/vendor/:vendorId/relocation-quotes/:quoteId/respond", vendorVendoridRelocationquotesQuoteidRespondPostHandler);
}
