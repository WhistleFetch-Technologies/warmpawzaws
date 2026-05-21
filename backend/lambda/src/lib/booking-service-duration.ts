import { query } from 'src/database/rds-connection';
import { loadBookingServiceSnapshot } from 'src/utils/booking-service-snapshot';

/** Booked service length (minutes), aligned with vendor Manage Service limits (5–1440). */
export function clampPlannedServiceDurationMinutes(minutes: number): number {
  return Math.min(1440, Math.max(5, Math.round(minutes) || 30));
}

/**
 * Minutes for the booked service — aligned with GET /vendor/bookings/:id/details:
 * prefer `loadBookingServiceSnapshot` (vendor row + catalog join), then booking.duration columns, then legacy SQL fallbacks.
 */
export async function resolvePlannedServiceDurationMinutesFromBookingId(bookingId: string): Promise<number> {
  const br = await query(
    `SELECT vendor_id, service_id,
            NULLIF(duration_minutes, 0)::numeric AS duration_nz,
            NULLIF(total_duration_minutes, 0)::numeric AS total_dur_nz
     FROM bookings WHERE id = $1::uuid LIMIT 1`,
    [bookingId]
  ).catch(() => ({ rows: [] as any[] }));

  const row = br.rows?.[0];
  const vendorId = row?.vendor_id as string | undefined | null;
  const serviceId = row?.service_id as string | undefined | null;

  if (vendorId && serviceId) {
    try {
      const snap = await loadBookingServiceSnapshot(vendorId, serviceId);
      if (snap && Number(snap.durationMinutes) > 0) {
        return clampPlannedServiceDurationMinutes(snap.durationMinutes);
      }
    } catch {
      /* fall through */
    }
  }

  const fromBookingRow = Number(row?.duration_nz) || Number(row?.total_dur_nz) || 0;
  if (fromBookingRow > 0) {
    return clampPlannedServiceDurationMinutes(fromBookingRow);
  }

  const r = await query(
    `SELECT COALESCE(
       (SELECT (COALESCE(NULLIF(vs.custom_duration, 0), vs.duration_minutes))::numeric
        FROM vendor_services vs
        WHERE vs.vendor_id = b.vendor_id
          AND b.service_id IS NOT NULL
          AND (vs.id = b.service_id OR vs.service_id = b.service_id)
          AND (b.service_type IS NULL OR TRIM(b.service_type) = '' OR vs.service_style::text = b.service_type::text)
        ORDER BY CASE WHEN vs.id = b.service_id THEN 0 ELSE 1 END,
                 (COALESCE(NULLIF(vs.custom_duration, 0), vs.duration_minutes)) DESC
        LIMIT 1),
       (SELECT (COALESCE(NULLIF(vs2.custom_duration, 0), vs2.duration_minutes))::numeric
        FROM vendor_services vs2
        WHERE vs2.vendor_id = b.vendor_id
          AND b.service_id IS NOT NULL
          AND (vs2.id = b.service_id OR vs2.service_id = b.service_id)
        ORDER BY CASE WHEN vs2.id = b.service_id THEN 0 ELSE 1 END
        LIMIT 1),
       (SELECT sc.duration_minutes::numeric FROM service_catalog sc WHERE sc.id = b.service_id LIMIT 1),
       (SELECT s.duration_minutes::numeric FROM services s WHERE s.id = b.service_id LIMIT 1),
       NULLIF(b.duration_minutes, 0)::numeric,
       NULLIF(b.total_duration_minutes, 0)::numeric,
       30
     ) AS minutes
     FROM bookings b
     WHERE b.id = $1::uuid`,
    [bookingId]
  );
  const raw = Number(r.rows?.[0]?.minutes ?? 30) || 30;
  return clampPlannedServiceDurationMinutes(raw);
}
