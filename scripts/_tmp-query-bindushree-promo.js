const { query } = require('./rds-data-api-utils-dev');

(async () => {
  const vendors = await query(`
    SELECT id::text, business_name, owner_name, phone, category, vendor_type, status, is_active
    FROM vendors
    WHERE business_name ILIKE '%Bindushree%' OR owner_name ILIKE '%Bindushree%'
    LIMIT 10
  `);
  console.log('=== Vendors matching Bindushree ===');
  for (const row of vendors) {
    const id = row[0] ?? row.id;
    const name = row[1] ?? row.business_name;
    const roles = await query(`
      SELECT r.name, r.display_name, v.category, v.vendor_type
      FROM vendors v LEFT JOIN roles r ON v.role_id = r.id
      WHERE v.id = '${id}'::uuid
    `);
    console.log({ id, name, role: roles[0] });
    const promos = await query(`
      SELECT id::text, name, promotion_type, discount_type, discount_value,
             is_active, start_date::text, end_date::text, target_audience, code
      FROM vendor_service_promotions
      WHERE vendor_id = '${id}'::uuid
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log('  Service promos:', promos.length);
    for (const p of promos) {
      console.log('   -', {
        id: p[0] ?? p.id,
        name: p[1] ?? p.name,
        type: p[2] ?? p.promotion_type,
        discount: `${p[3] ?? p.discount_type} ${p[4] ?? p.discount_value}`,
        active: p[5] ?? p.is_active,
        start: p[6] ?? p.start_date,
        end: p[7] ?? p.end_date,
      });
    }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
