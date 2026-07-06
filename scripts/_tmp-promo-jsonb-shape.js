const { query } = require('./rds-data-api-utils-dev');

const vendorId = 'c8b26bb8-73a5-41ea-ad34-e42b195bc20c';

(async () => {
  const rows = await query(`
    SELECT id::text, applicable_services::text AS raw_text,
           jsonb_typeof(applicable_services) AS jsonb_kind,
           start_date <= NOW() AS start_ok,
           end_date >= NOW() AS end_ok,
           (usage_limit IS NULL OR usage_count < usage_limit) AS usage_ok
    FROM vendor_service_promotions
    WHERE id = 'afad8a9c-18e4-4fd1-b22f-856ed0483480'::uuid
  `);
  console.log('=== applicable_services storage ===');
  console.log(JSON.stringify(rows[0], null, 2));

  const live = await query(`
    SELECT id::text, name, is_active,
           start_date <= NOW() AS start_ok,
           end_date >= NOW() AS end_ok,
           (usage_limit IS NULL OR usage_count < usage_limit) AS usage_ok
    FROM vendor_service_promotions
    WHERE vendor_id = '${vendorId}'::uuid AND is_active = true
  `);
  console.log('\n=== SQL gate checks (loadVendorServicePromotions) ===');
  console.log(JSON.stringify(live, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
