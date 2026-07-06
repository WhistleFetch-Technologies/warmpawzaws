const { query } = require('./rds-data-api-utils-dev');

const vendorId = 'c8b26bb8-73a5-41ea-ad34-e42b195bc20c';

(async () => {
  const loadSql = `
    SELECT id::text, name, is_active, start_date::text, end_date::text, usage_limit, usage_count,
           applicable_services::text AS applicable_services_text
    FROM vendor_service_promotions
    WHERE vendor_id = '${vendorId}'::uuid
      AND is_active = true
      AND start_date <= NOW()
      AND end_date >= NOW()
      AND (usage_limit IS NULL OR usage_count < usage_limit)`;

  const activeSql = `
    SELECT id::text, name, start_date::text, end_date::text
    FROM vendor_service_promotions
    WHERE vendor_id = '${vendorId}'::uuid
      AND is_active = true
      AND start_date <= '${new Date().toISOString()}'
      AND end_date >= '${new Date().toISOString()}'`;

  console.log('=== loadVendorServicePromotions SQL ===');
  console.log(JSON.stringify(await query(loadSql), null, 2));
  console.log('\n=== active-promotions SQL ===');
  console.log(JSON.stringify(await query(activeSql), null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
