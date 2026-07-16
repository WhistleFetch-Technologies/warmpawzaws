import type { Context } from 'hono';
import * as vendor_vendorid_relocationquotes_quoteid_respond_postRepo from '../repos/vendor_vendorid_relocationquotes_quoteid_respond_post.repo';

export async function executevendorVendoridRelocationquotesQuoteidRespondPost(c: Context) {
  try {
    const { vendorId, quoteId } = c.req.param();
    const body = await c.req.json();
    const { finalPrice } = body;

    const updated =
      await vendor_vendorid_relocationquotes_quoteid_respond_postRepo.dbVendorVendoridRelocationquotesQuoteidRespondPost0(
        quoteId,
        vendorId,
        finalPrice
      );

    return c.json({
      success: true,
      quote: updated[0],
      message: 'Quote response submitted successfully',
    });
  } catch (error: any) {
    console.error('Error responding to relocation quote:', error);
    return c.json({ error: error.message }, 500);
  }
}
