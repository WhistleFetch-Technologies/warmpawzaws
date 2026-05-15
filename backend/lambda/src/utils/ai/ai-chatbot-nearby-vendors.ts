/**
 * Distance-sorted vendors for AI booking-assist (Lambda + RDS; not Bedrock).
 *
 * Manual checks: POST /ai-chatbot/booking-assist with {"query":"i need a vet","location":{"lat":12.97,"lng":77.59}}
 * should return suggestedProviders when approved vendors have latitude/longitude.
 * Omit location but send customerId (default address with coordinates) — server resolves coords and runs the same query.
 * Env: AI_CHATBOT_NEARBY_RADIUS_KM (default 80), AI_CHATBOT_NEARBY_VENDOR_LIMIT (default 10).
 */

import { query } from '../../database/rds-connection';
import { roleFilterListForCategory } from './ai-chatbot-booking-roles';
import { sqlAndVendorHasBookableV2Windows } from './ai-chatbot-vendor-has-schedule';

export type NearbyBookingVendorRow = {
  id: string;
  businessName: string;
  city?: string;
  roleName?: string;
  distanceKm: number;
};

export { roleFilterListForCategory } from './ai-chatbot-booking-roles';

function parseEnvFloat(name: string, fallback: number): number {
  const n = parseFloat(process.env[name] || '');
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseEnvInt(name: string, fallback: number, min: number, max: number): number {
  const n = parseInt(process.env[name] || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Approved active vendors with coordinates, filtered by discovery category roles, sorted by haversine distance.
 */
export async function lookupNearbyBookingVendors(
  lat: number,
  lng: number,
  category: string,
  limit?: number
): Promise<NearbyBookingVendorRow[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];

  const maxKm = parseEnvFloat('AI_CHATBOT_NEARBY_RADIUS_KM', 80);
  const lim = limit ?? parseEnvInt('AI_CHATBOT_NEARBY_VENDOR_LIMIT', 10, 1, 25);
  const roles = roleFilterListForCategory(category);
  if (roles.length === 0) return [];

  const sql = `
    SELECT id, business_name, city, role_name, distance_km
    FROM (
      SELECT v.id::text AS id,
             v.business_name,
             v.city,
             r.name AS role_name,
             (6371 * acos(
               LEAST(1, GREATEST(-1,
                 cos(radians($1::double precision)) * cos(radians(CAST(v.latitude AS DOUBLE PRECISION))) *
                 cos(radians(CAST(v.longitude AS DOUBLE PRECISION)) - radians($2::double precision)) +
                 sin(radians($1::double precision)) * sin(radians(CAST(v.latitude AS DOUBLE PRECISION)))
               ))
             )) AS distance_km
      FROM vendors v
      INNER JOIN roles r ON v.role_id = r.id
      WHERE v.status = 'approved'
        AND v.is_active = true
        AND COALESCE(v.is_online, true) = true
        AND v.latitude IS NOT NULL
        AND v.longitude IS NOT NULL
        AND LOWER(TRIM(r.name)) = ANY($3::text[])
        AND ${sqlAndVendorHasBookableV2Windows('v')}
    ) sub
    WHERE distance_km <= $4::double precision
    ORDER BY distance_km ASC
    LIMIT $5
  `;

  const res = await query(sql, [lat, lng, roles, maxKm, lim]).catch(() => ({ rows: [] as Record<string, unknown>[] }));

  return (res.rows || []).map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''),
    businessName: String(row.business_name ?? ''),
    city: row.city != null ? String(row.city) : undefined,
    roleName: row.role_name != null ? String(row.role_name) : undefined,
    distanceKm: Math.round(Number(row.distance_km) * 10) / 10,
  }));
}
