import { query } from '../../../../database/rds-connection';
import { sqlVendorOnlineForCustomerDiscovery } from '../../../../lib/discovery-vendor-query';

export async function dbRadarProviders0(lat, lng, radius, limitCount, serviceType) {
  if (serviceType) {
    return await query(
      `SELECT id, business_name, role_name, distance_km, latitude, longitude
       FROM (
         SELECT v.*, r.name as role_name,
           (6371 * acos(
             cos(radians($1::double precision)) * cos(radians(CAST(v.latitude AS DOUBLE PRECISION))) *
             cos(radians(CAST(v.longitude AS DOUBLE PRECISION)) - radians($2::double precision)) +
             sin(radians($1::double precision)) * sin(radians(CAST(v.latitude AS DOUBLE PRECISION)))
           )) AS distance_km
         FROM vendors v
         INNER JOIN roles r ON v.role_id = r.id
         WHERE v.status = 'approved' AND v.is_active = true
           AND ${sqlVendorOnlineForCustomerDiscovery('v')}
           AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
           AND r.name ILIKE $3
       ) sub
       WHERE distance_km <= $4::double precision
       ORDER BY distance_km ASC
       LIMIT $5`,
      [lat, lng, `%${serviceType}%`, radius, limitCount]
    );
  }

  return await query(
    `SELECT id, business_name, role_name, distance_km, latitude, longitude
     FROM (
       SELECT v.*, r.name as role_name,
         (6371 * acos(
           cos(radians($1::double precision)) * cos(radians(CAST(v.latitude AS DOUBLE PRECISION))) *
           cos(radians(CAST(v.longitude AS DOUBLE PRECISION)) - radians($2::double precision)) +
           sin(radians($1::double precision)) * sin(radians(CAST(v.latitude AS DOUBLE PRECISION)))
         )) AS distance_km
       FROM vendors v
       INNER JOIN roles r ON v.role_id = r.id
       WHERE v.status = 'approved' AND v.is_active = true
         AND ${sqlVendorOnlineForCustomerDiscovery('v')}
         AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
     ) sub
     WHERE distance_km <= $3::double precision
     ORDER BY distance_km ASC
     LIMIT $4`,
    [lat, lng, radius, limitCount]
  );
}
