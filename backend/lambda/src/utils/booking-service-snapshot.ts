import { query } from '../database/rds-connection';

export type BookingServiceSnapshot = {
  serviceId: string;
  serviceName: string;
  name: string;
  displayName: string;
  description: string | null;
  service_style: string | null;
  serviceStyle: string | null;
  basePrice: number;
  price: number;
  duration: number;
  durationMinutes: number;
  category: string | null;
  sub_category: string | null;
};

function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve catalog + vendor row for a booking's service_id (catalog UUID, legacy services.id, or vendor_services.id).
 * Used by vendor booking list and can align GET /bookings/:id service payload with customer catalog shape.
 */
export async function loadBookingServiceSnapshot(
  vendorId: string | null | undefined,
  serviceId: string | null | undefined
): Promise<BookingServiceSnapshot | null> {
  if (!vendorId || !serviceId) return null;

  const res = await query(
    `WITH vs_pick AS (
       SELECT vs.*
       FROM vendor_services vs
       WHERE vs.vendor_id = $1::uuid
         AND (vs.service_id = $2::uuid OR vs.id = $2::uuid)
       ORDER BY
         CASE WHEN vs.service_id = $2::uuid THEN 0 WHEN vs.id = $2::uuid THEN 1 ELSE 2 END,
         vs.updated_at DESC NULLS LAST
       LIMIT 1
     )
     SELECT
       COALESCE(vp.service_id, $2::uuid) AS resolved_service_id,
       COALESCE(sc.service_name, s.name, vp.service_name) AS service_name,
       COALESCE(NULLIF(TRIM(sc.display_name), ''), sc.service_name, s.name, vp.service_name) AS display_name,
       COALESCE(sc.description, s.description, vp.custom_description) AS description,
       COALESCE(vp.category, sc.category_name, s.category::text) AS category,
       COALESCE(vp.sub_category, sc.sub_category_name::text) AS sub_category,
       COALESCE(vp.service_style, sc.service_style) AS vendor_or_catalog_style,
       COALESCE(sc.base_price, vp.price, s.price, 0) AS base_price_raw,
       COALESCE(vp.custom_price, vp.price, sc.base_price, s.price, 0) AS price_raw,
       COALESCE(vp.custom_duration, vp.duration_minutes, sc.duration_minutes, s.duration_minutes, 30) AS duration_raw
     FROM vs_pick vp
     LEFT JOIN service_catalog sc ON sc.id = COALESCE(vp.service_id, $2::uuid)
     LEFT JOIN services s ON s.id = $2::uuid AND sc.id IS NULL`,
    [vendorId, serviceId]
  ).catch(() => ({ rows: [] as any[] }));

  let row = res.rows?.[0];
  if (!row || (!row.service_name && !row.display_name)) {
    const fallback = await query(
      `SELECT
         $1::uuid AS resolved_service_id,
         COALESCE(sc.service_name, s.name) AS service_name,
         COALESCE(NULLIF(TRIM(sc.display_name), ''), sc.service_name, s.name) AS display_name,
         COALESCE(sc.description, s.description) AS description,
         COALESCE(sc.category_name, s.category::text) AS category,
         sc.sub_category_name::text AS sub_category,
         sc.service_style AS vendor_or_catalog_style,
         COALESCE(sc.base_price, s.price, 0) AS base_price_raw,
         COALESCE(sc.base_price, s.price, 0) AS price_raw,
         COALESCE(sc.duration_minutes, s.duration_minutes, 30) AS duration_raw
       FROM (SELECT 1) _
       LEFT JOIN service_catalog sc ON sc.id = $1::uuid
       LEFT JOIN services s ON s.id = $1::uuid AND sc.id IS NULL`,
      [serviceId]
    ).catch(() => ({ rows: [] as any[] }));
    row = fallback.rows?.[0];
  }

  if (!row) return null;
  const name = String(row.service_name || row.display_name || '').trim();
  if (!name) return null;

  const displayName = String(row.display_name || name).trim();
  const durationMinutes = Math.max(1, Math.round(num(row.duration_raw, 30)));
  const basePrice = num(row.base_price_raw, 0);
  const price = num(row.price_raw, basePrice);
  const style = row.vendor_or_catalog_style != null && String(row.vendor_or_catalog_style).trim() !== ''
    ? String(row.vendor_or_catalog_style).trim()
    : null;

  return {
    serviceId: String(row.resolved_service_id || serviceId),
    serviceName: name,
    name,
    displayName,
    description: row.description != null ? String(row.description) : null,
    service_style: style,
    serviceStyle: style,
    basePrice,
    price,
    duration: durationMinutes,
    durationMinutes,
    category: row.category != null ? String(row.category) : null,
    sub_category: row.sub_category != null ? String(row.sub_category) : null,
  };
}

export function snapshotToNestedService(s: BookingServiceSnapshot) {
  return {
    id: s.serviceId,
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    name: s.name,
    displayName: s.displayName,
    description: s.description,
    service_style: s.service_style,
    serviceStyle: s.serviceStyle,
    basePrice: s.basePrice,
    price: s.price,
    duration: s.duration,
    durationMinutes: s.durationMinutes,
    category: s.category,
    sub_category: s.sub_category,
  };
}
