import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerDiagnosticpackagesGet0() {
  return await query(`
        SELECT 
          dt.id,
          dt.test_name as name,
          dt.description,
          dt.price,
          dt.category,
          dt.sample_type,
          dt.turnaround_time_hours,
          dt.is_package_available,
          dt.package_price,
          dt.package_test_count,
          dt.is_free_home_collection,
          dt.home_collection_fee,
          v.business_name as vendor_name,
          v.id as vendor_id
        FROM diagnostic_tests dt
        LEFT JOIN vendors v ON v.id = dt.vendor_id
        WHERE dt.is_available = true 
          AND dt.is_package_available = true
        ORDER BY dt.price ASC
        LIMIT 20
      `);
}

