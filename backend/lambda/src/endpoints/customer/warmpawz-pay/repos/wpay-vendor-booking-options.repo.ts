import { query } from '../../../../database/rds-connection';

export type WpayPublishedPackageRow = {
  id: string;
  service_name: string;
  custom_price: unknown;
  price: unknown;
  metadata: unknown;
  service_style: string | null;
  duration_minutes: unknown;
  category: string | null;
  publish_status: string | null;
};

export async function dbVendorWarmpawzPayPublished(vendorId: string): Promise<boolean> {
  const res = await query(
    `SELECT 1
     FROM warmpawz_pay_vendor_catalog
     WHERE vendor_id = $1::uuid AND publish_status = 'published'
     LIMIT 1`,
    [vendorId]
  );
  return (res.rows?.length ?? 0) > 0;
}

export async function dbVendorWapptPublished(vendorId: string): Promise<boolean> {
  const res = await query(
    `SELECT 1
     FROM warmpawz_appointments_vendor_catalog
     WHERE vendor_id = $1::uuid AND publish_status = 'published'
     LIMIT 1`,
    [vendorId]
  );
  return (res.rows?.length ?? 0) > 0;
}

export async function dbVendorPublishedPayPackages(
  vendorId: string
): Promise<WpayPublishedPackageRow[]> {
  const res = await query(
    `SELECT vs.id::text AS id,
            vs.service_name,
            vs.custom_price,
            vs.price,
            vs.metadata,
            vs.service_style,
            vs.duration_minutes,
            vs.category,
            vs.publish_status
     FROM vendor_services vs
     WHERE vs.vendor_id = $1::uuid
       AND COALESCE(vs.is_enabled, true) = true
       AND vs.publish_status = 'published'
       AND (
         COALESCE(vs.metadata->>'isPackage', 'false') = 'true'
         OR LOWER(COALESCE(vs.metadata->>'type', '')) = 'package'
         OR COALESCE((vs.metadata->'packageDetails'->>'totalSessions')::int, 0) > 0
         OR COALESCE((vs.metadata->'packageDetails'->>'total_sessions')::int, 0) > 0
       )
     ORDER BY vs.updated_at DESC NULLS LAST`,
    [vendorId]
  );
  return (res.rows || []) as WpayPublishedPackageRow[];
}
