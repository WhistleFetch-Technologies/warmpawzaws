import { query } from '../../../../database/rds-connection';
import { wapptCatalogueCustomerVisibleSql } from '../../../warmpawz-appointments/shared/catalogue-eligibility-sql';

export interface PublishedVendorAppointmentFees {
  readonly appointmentFee: number;
  readonly appointmentFeeHome: number;
}

export async function dbFetchPublishedVendorAppointmentFees(
  vendorId: string,
): Promise<PublishedVendorAppointmentFees | null> {
  const result = await query(
    `SELECT c.appointment_fee, c.appointment_fee_home
     FROM warmpawz_appointments_vendor_catalog c
     INNER JOIN vendors v ON v.id = c.vendor_id
     WHERE c.vendor_id = $1::uuid AND ${wapptCatalogueCustomerVisibleSql('c')}
     LIMIT 1`,
    [vendorId],
  );
  if (!result.rows?.length) return null;
  const centre = Number(result.rows[0].appointment_fee) || 0;
  if (centre <= 0) return null;
  const homeRaw = result.rows[0].appointment_fee_home;
  const home =
    homeRaw == null || homeRaw === ''
      ? centre
      : Number(homeRaw) || 0;
  return {
    appointmentFee: centre,
    appointmentFeeHome: home > 0 ? home : centre,
  };
}

/** @deprecated Prefer dbFetchPublishedVendorAppointmentFees + style pick. */
export async function dbFetchPublishedVendorAppointmentFee(
  vendorId: string,
): Promise<number | null> {
  const fees = await dbFetchPublishedVendorAppointmentFees(vendorId);
  return fees?.appointmentFee ?? null;
}
