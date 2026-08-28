import { query } from '../../../database/rds-connection';
import { wapptCatalogueCustomerVisibleSql } from './catalogue-eligibility-sql';

export const WAPPT_BOOKING_MODE = 'warmpawz_appointments' as const;
export const WAPPT_SERVICE_SLUG = 'warmpawz_appointments' as const;
export const WAPPT_DISPLAY_SERVICE_NAME = 'Appointment' as const;

/** Catalog sentinel so WAPPT can insert a stub vendor_services row when the vendor has none. */
export const WAPPT_CATALOG_SERVICE_SENTINEL_ID = 'a11a11a1-b22b-4c33-8d44-e55e55e55e55';

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

export function applyWapptCatalogueFeeAmounts(appointmentFee: number): {
  basePrice: number;
  totalAmount: number;
  taxAmount: number;
} {
  const fee = Math.round(Number(appointmentFee) * 100) / 100;
  return {
    basePrice: fee,
    totalAmount: fee,
    taxAmount: 0,
  };
}

export function wapptStyleAliases(serviceStyle?: string): { style: string; acceptableStyles: string[] } {
  const style = serviceStyle || 'at_center';
  const aliases: Record<string, string[]> = {
    at_center: ['at_center', 'at_vendor', 'at_clinic', 'boarding', 'checkin_checkout', 'center'],
    at_home: ['at_home', 'home_visit', 'home', 'sitting', 'pet_sitting'],
    tele: ['tele', 'online', 'video'],
  };
  return { style, acceptableStyles: aliases[style] ?? [style] };
}

async function findExistingWapptVendorServiceId(
  vendorId: string,
  serviceStyle?: string,
): Promise<string | null> {
  const { style, acceptableStyles } = wapptStyleAliases(serviceStyle);

  const styled = await query(
    `SELECT vs.id AS vendor_service_id
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
    [vendorId, acceptableStyles, style],
  );
  if (styled.rows?.[0]?.vendor_service_id) {
    return String(styled.rows[0].vendor_service_id);
  }

  const anyPublished = await query(
    `SELECT vs.id AS vendor_service_id
     FROM vendor_services vs
     WHERE vs.vendor_id = $1::uuid
       AND (vs.is_enabled = true OR vs.is_enabled IS NULL)
       AND (vs.publish_status = 'published' OR vs.publish_status IS NULL OR vs.publish_status = 'auto_published')
     ORDER BY vs.created_at ASC
     LIMIT 1`,
    [vendorId],
  );
  if (anyPublished.rows?.[0]?.vendor_service_id) {
    return String(anyPublished.rows[0].vendor_service_id);
  }

  const anyRow = await query(
    `SELECT vs.id AS vendor_service_id
     FROM vendor_services vs
     WHERE vs.vendor_id = $1::uuid
     ORDER BY vs.created_at ASC
     LIMIT 1`,
    [vendorId],
  );
  if (anyRow.rows?.[0]?.vendor_service_id) {
    return String(anyRow.rows[0].vendor_service_id);
  }

  return null;
}

async function ensureWapptStubVendorService(
  vendorId: string,
  serviceStyle: string,
  appointmentFee: number,
): Promise<string | null> {
  const existingSentinel = await query(
    `SELECT id::text AS vendor_service_id
     FROM vendor_services
     WHERE vendor_id = $1::uuid AND service_id = $2::uuid
     LIMIT 1`,
    [vendorId, WAPPT_CATALOG_SERVICE_SENTINEL_ID],
  );
  if (existingSentinel.rows?.[0]?.vendor_service_id) {
    return String(existingSentinel.rows[0].vendor_service_id);
  }

  await query(
    `INSERT INTO services (id, name, description, category, price, duration_minutes, is_active, created_at, updated_at)
     VALUES ($1, $2, 'Warmpawz Appointments flat fee', $3, $4, 30, true, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
    [WAPPT_CATALOG_SERVICE_SENTINEL_ID, WAPPT_DISPLAY_SERVICE_NAME, WAPPT_SERVICE_SLUG, appointmentFee],
  ).catch(() => undefined);

  try {
    await query(
      `INSERT INTO vendor_services (
         vendor_id, service_id, service_name, service_style, category,
         price, custom_price, publish_status, is_enabled, created_at, updated_at
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, $5,
         $6, $6, 'published', true, NOW(), NOW()
       )`,
      [
        vendorId,
        WAPPT_CATALOG_SERVICE_SENTINEL_ID,
        WAPPT_DISPLAY_SERVICE_NAME,
        serviceStyle || 'at_center',
        WAPPT_SERVICE_SLUG,
        appointmentFee,
      ],
    );
  } catch (insErr: unknown) {
    const msg = String((insErr as { message?: string })?.message || '');
    const code = (insErr as { code?: string })?.code;
    if (msg.includes('column') && (msg.includes('price') || msg.includes('custom_price'))) {
      await query(
        `INSERT INTO vendor_services (
           vendor_id, service_id, service_name, service_style, category,
           publish_status, is_enabled, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4, $5, 'published', true, NOW(), NOW()
         )`,
        [
          vendorId,
          WAPPT_CATALOG_SERVICE_SENTINEL_ID,
          WAPPT_DISPLAY_SERVICE_NAME,
          serviceStyle || 'at_center',
          WAPPT_SERVICE_SLUG,
        ],
      ).catch((retryErr: unknown) => {
        console.warn('[WAPPT-PREFLIGHT] stub vendor_services insert:', retryErr);
      });
    } else if (!msg.includes('unique') && code !== '23505') {
      console.warn('[WAPPT-PREFLIGHT] stub vendor_services insert:', msg);
    }
  }

  const after = await query(
    `SELECT id::text AS vendor_service_id
     FROM vendor_services
     WHERE vendor_id = $1::uuid AND service_id = $2::uuid
     LIMIT 1`,
    [vendorId, WAPPT_CATALOG_SERVICE_SENTINEL_ID],
  );
  const stubId = after?.rows?.[0]?.vendor_service_id;
  return stubId ? String(stubId) : null;
}

/** Published catalogue fee + a bookable vendor_services.id (style match, any service, or stub). */
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

  const { style } = wapptStyleAliases(params.serviceStyle);
  const existingId = await findExistingWapptVendorServiceId(params.vendorId, style);
  if (existingId) {
    return { ok: true, appointmentFee, resolvedServiceId: existingId };
  }

  const stubId = await ensureWapptStubVendorService(params.vendorId, style, appointmentFee);
  if (stubId) {
    return { ok: true, appointmentFee, resolvedServiceId: stubId };
  }

  return {
    ok: false,
    status: 404,
    message: 'No published service found for this vendor',
  };
}
