import { query } from '../../../database/rds-connection';
import { wapptCatalogueCustomerVisibleSql } from './catalogue-eligibility-sql';

export const WAPPT_BOOKING_MODE = 'warmpawz_appointments' as const;
export const WAPPT_SERVICE_SLUG = 'warmpawz_appointments' as const;
export const WAPPT_DISPLAY_SERVICE_NAME = 'Appointment' as const;

export function isWarmpawzAppointmentsBooking(body: Record<string, unknown>): boolean {
  const meta = body.metadata;
  const mode =
    body.bookingMode ??
    (meta && typeof meta === 'object'
      ? (meta as Record<string, unknown>).bookingMode
      : undefined);
  const sid = String(body.serviceId ?? '');
  return (
    mode === WAPPT_BOOKING_MODE ||
    new RegExp(`^${WAPPT_SERVICE_SLUG}$`, 'i').test(sid)
  );
}

export type WapptBookingPreflightResult =
  | { ok: true; appointmentFee: number; resolvedServiceId: string }
  | { ok: false; status: number; message: string };

/** ponytail: first published vendor_service for style — upgrade path: explicit catalogue service link */
export async function resolveWarmpawzAppointmentsBookingPreflight(params: {
  vendorId: string;
  serviceStyle?: string;
}): Promise<WapptBookingPreflightResult> {
  const feeRes = await query(
    `SELECT c.appointment_fee
     FROM warmpawz_appointments_vendor_catalog c
     INNER JOIN vendors v ON v.id = c.vendor_id
     WHERE c.vendor_id = $1::uuid AND ${wapptCatalogueCustomerVisibleSql('c')}
     LIMIT 1`,
    [params.vendorId],
  );
  if (!feeRes.rows?.length) {
    return {
      ok: false,
      status: 403,
      message: 'Vendor is not available for Warmpawz Appointments',
    };
  }

  const appointmentFee = Number(feeRes.rows[0].appointment_fee) || 0;
  if (appointmentFee <= 0) {
    return {
      ok: false,
      status: 400,
      message: 'Appointment fee is not configured for this vendor',
    };
  }

  const style = params.serviceStyle || 'at_center';
  const styleAliases: Record<string, string[]> = {
    at_center: ['at_center', 'at_vendor', 'at_clinic', 'boarding', 'checkin_checkout', 'center'],
    at_home: ['at_home', 'home_visit', 'home', 'sitting', 'pet_sitting'],
  };
  const acceptableStyles = styleAliases[style] ?? [style];

  const svcRes = await query(
    `SELECT COALESCE(vs.service_id, vs.id) AS service_id, vs.service_style
     FROM vendor_services vs
     WHERE vs.vendor_id = $1::uuid
       AND (vs.is_enabled = true OR vs.is_enabled IS NULL)
       AND (vs.publish_status = 'published' OR vs.publish_status IS NULL OR vs.publish_status = 'auto_published')
       AND (
         vs.service_style = ANY($2::text[])
         OR vs.service_style IS NULL
       )
     ORDER BY
       CASE
         WHEN vs.service_style = $3 THEN 0
         WHEN vs.service_style = ANY($2::text[]) THEN 1
         WHEN vs.service_style IS NULL THEN 2
         ELSE 3
       END,
       vs.created_at ASC
     LIMIT 1`,
    [params.vendorId, acceptableStyles, style],
  );
  if (!svcRes.rows?.length) {
    return {
      ok: false,
      status: 404,
      message: 'No published service found for this vendor',
    };
  }

  return {
    ok: true,
    appointmentFee,
    resolvedServiceId: String(svcRes.rows[0].service_id),
  };
}
