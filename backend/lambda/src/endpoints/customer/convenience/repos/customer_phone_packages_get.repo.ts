import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerPhonePackagesGet0(packageQuery, params) {
  return await query(packageQuery, params);
}

export async function dbCustomerPhonePackagesGet1(pkg: { package_id: string; vendor_id: string }) {
  return await query(
              `SELECT id, service_name, metadata FROM vendor_services WHERE id = $1 AND vendor_id = $2`,
              [pkg.package_id, pkg.vendor_id]
            );
}

export async function dbCustomerPhonePackagesGet2(pkg: { package_id: string }) {
  return await query(
                `SELECT ps.service_id, s.name as service_name FROM package_services ps
                 LEFT JOIN services s ON ps.service_id = s.id
                 WHERE ps.package_id = $1`,
                [pkg.package_id]
              );
}

