import { query } from 'src/database/rds-connection';
import { loadBookingServiceSnapshot } from 'src/utils/booking-service-snapshot';

/** Booked service length (minutes), aligned with vendor Manage Service limits (5–1440). */
export function clampPlannedServiceDurationMinutes(minutes: number): number {
  return Math.min(1440, Math.max(5, Math.round(minutes) || 30));
}

/** First positive finite duration from candidates (matches vendor booking details). */
export function pickPositiveDurationMinutes(...candidates: unknown[]): number {
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function durationFromSelectedServices(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    let total = 0;
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const qty = Number((item as any).quantity) || 1;
      const dur = pickPositiveDurationMinutes(
        (item as any).duration,
        (item as any).durationMinutes,
        (item as any).duration_minutes
      );
      if (dur > 0) total += dur * qty;
    }
    return total;
  } catch {
    return 0;
  }
}

/**
 * Minutes for the booked service — aligned with GET /vendor/bookings/:id/details:
 * prefer `loadBookingServiceSnapshot` (vendor row + catalog join), then booking.duration columns, then legacy SQL fallbacks.
 */
export async function resolvePlannedServiceDurationMinutesFromBookingId(bookingId: string): Promise<number> {
  const br = await query(
    `SELECT vendor_id, service_id, selected_services,
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
      const vsRow = await query(
        `SELECT duration_minutes, custom_duration
         FROM vendor_services
         WHERE vendor_id = $1::uuid
           AND (id = $2::uuid OR service_id = $2::uuid)
         ORDER BY
           CASE WHEN id = $2::uuid THEN 0 ELSE 1 END,
           CASE WHEN service_id = $2::uuid THEN 0 ELSE 1 END,
           updated_at DESC NULLS LAST
         LIMIT 1`,
        [vendorId, serviceId]
      ).catch(() => ({ rows: [] as any[] }));
      const vs = vsRow.rows?.[0];
      const manageDuration = pickPositiveDurationMinutes(
        vs?.custom_duration != null &&
          String(vs.custom_duration).trim() !== '' &&
          Number(vs.custom_duration) > 0
          ? vs.custom_duration
          : null,
        vs?.duration_minutes
      );
      if (manageDuration > 0) {
        return clampPlannedServiceDurationMinutes(manageDuration);
      }
    } catch {
      /* fall through */
    }

    try {
      const snap = await loadBookingServiceSnapshot(vendorId, serviceId);
      if (snap && Number(snap.durationMinutes) > 0) {
        return clampPlannedServiceDurationMinutes(snap.durationMinutes);
      }
    } catch {
      /* fall through */
    }
  }

  const bookingServicesTotal = await query(
    `SELECT COALESCE(
       SUM(
         COALESCE(NULLIF(bs.duration_minutes, 0), NULLIF(bs.service_duration, 0), 0)
         * GREATEST(COALESCE(bs.quantity, 1), 1)
       ),
       0
     ) AS total_minutes
     FROM booking_services bs
     WHERE bs.booking_id = $1::uuid`,
    [bookingId]
  ).catch(() => ({ rows: [{ total_minutes: 0 }] }));
  const fromBookingServices = Number(bookingServicesTotal.rows?.[0]?.total_minutes ?? 0);
  if (fromBookingServices > 0) {
    return clampPlannedServiceDurationMinutes(fromBookingServices);
  }

  const fromSelectedServices = durationFromSelectedServices(row?.selected_services);
  if (fromSelectedServices > 0) {
    return clampPlannedServiceDurationMinutes(fromSelectedServices);
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
