import { query } from '../../../../database/rds-connection';
import { sqlVendorOnlineForCustomerDiscovery } from '../../../../lib/discovery-vendor-query';

export async function dbRadarProviders0(lat, lng, radius, limitCount, serviceType) {
  return await query(
    `SELECT v.*, r.name as role_name,
     (6371 * acos(
       cos(radians($1)) * cos(radians(CAST(v.latitude AS FLOAT))) *
       cos(radians(CAST(v.longitude AS FLOAT)) - radians($2)) +
       sin(radians($1)) * sin(radians(CAST(v.latitude AS FLOAT)))
     )) AS distance_km
     FROM vendors v
     INNER JOIN roles r ON v.role_id = r.id
     WHERE v.status = 'approved' AND v.is_active = true
       AND ${sqlVendorOnlineForCustomerDiscovery('v')}
       AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
       ${serviceType ? `AND r.name ILIKE $3` : ''}
     HAVING distance_km <= $4
     ORDER BY distance_km ASC
     LIMIT $5`,
    serviceType ? [lat, lng, `%${serviceType}%`, radius, limitCount] : [lat, lng, null, radius, limitCount]
  );
}
