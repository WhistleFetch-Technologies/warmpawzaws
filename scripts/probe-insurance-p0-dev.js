const { query } = require('./rds-data-api-utils-dev');

async function main() {
  const cols = await query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'chat_messages' ORDER BY ordinal_position`
  );
  console.log('COLUMNS', JSON.stringify(cols, null, 2));
  const cons = await query(
    `SELECT conname, pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conrelid = 'public.chat_messages'::regclass AND contype = 'c'`
  );
  console.log('CHECKS', JSON.stringify(cons, null, 2));
  const types = await query(
    `SELECT message_type, COUNT(*)::int AS n FROM chat_messages GROUP BY 1 ORDER BY 2 DESC`
  );
  console.log('TYPES', JSON.stringify(types, null, 2));
  const vendors = await query(
    `SELECT r.name, COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE v.is_active)::int AS active
     FROM vendors v
     JOIN roles r ON r.id = v.role_id
     WHERE r.name IN ('insurance', 'pet_insurance')
     GROUP BY 1`
  );
  console.log('VENDORS', JSON.stringify(vendors, null, 2));
  const teleCols = await query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'vendor_availability_v2' AND column_name ILIKE '%style%'`
  );
  console.log('STYLECOLS', JSON.stringify(teleCols, null, 2));
  const tele = await query(
    `SELECT COUNT(*)::int AS tele_rows
     FROM vendor_availability_v2 va
     JOIN vendors v ON v.id = va.vendor_id
     JOIN roles r ON r.id = v.role_id
     WHERE r.name IN ('insurance', 'pet_insurance')
       AND (
         va.service_styles::text ILIKE '%tele%'
       )`
  );
  console.log('TELE', JSON.stringify(tele, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
