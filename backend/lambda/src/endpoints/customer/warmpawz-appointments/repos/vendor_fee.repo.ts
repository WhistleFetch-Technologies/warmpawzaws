import { query } from '../../../../database/rds-connection';
import { wapptCatalogueCustomerVisibleSql } from '../../../warmpawz-appointments/shared/catalogue-eligibility-sql';

export async function dbFetchPublishedVendorAppointmentFee(
  vendorId: string,
): Promise<number | null> {
  const result = await query(
    `SELECT c.appointment_fee
     FROM warmpawz_appointments_vendor_catalog c
     INNER JOIN vendors v ON v.id = c.vendor_id
     WHERE c.vendor_id = $1::uuid AND ${wapptCatalogueCustomerVisibleSql('c')}
     LIMIT 1`,
    [vendorId],
  );
  if (!result.rows?.length) return null;
  const fee = Number(result.rows[0].appointment_fee) || 0;
  return fee > 0 ? fee : null;
}
