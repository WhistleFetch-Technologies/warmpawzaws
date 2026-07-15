import { update } from '../../../../database/rds-connection';

export async function dbVendorVendoridRelocationquotesQuoteidRespondPost0(
  quoteId: string,
  vendorId: string,
  finalPrice: number
) {
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
