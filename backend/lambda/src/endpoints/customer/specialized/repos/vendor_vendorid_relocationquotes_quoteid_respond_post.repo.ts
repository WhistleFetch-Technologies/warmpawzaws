import { update } from '../../../../database/rds-connection';

export async function dbVendorVendoridRelocationquotesQuoteidRespondPost0(quoteId, vendorId, finalPrice) {
  return await update(
    'relocation_quotes',
    { id: quoteId },
    {
      vendor_id: vendorId,
      total_quote: finalPrice,
      status: 'quoted',
      updated_at: new Date().toISOString(),
    }
  );
}
