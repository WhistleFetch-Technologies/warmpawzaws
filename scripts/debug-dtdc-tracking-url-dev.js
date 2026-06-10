#!/usr/bin/env node
/** Read-only: DTDC shipment tracking_url values on dev RDS */
const { executeSQL, parseRecords } = require('./rds-data-api-utils-dev');

async function main() {
  const rows = await parseRecords(
    await executeSQL(
      `SELECT o.order_number, o.order_status, s.awb_code, s.logistics_partner,
              s.courier_name, s.tracking_url, s.shipped_at, s.created_at
       FROM shipments s
       JOIN orders o ON o.id = s.order_id
       WHERE LOWER(COALESCE(s.logistics_partner, '')) LIKE '%dtdc%'
          OR LOWER(COALESCE(s.courier_name, '')) LIKE '%dtdc%'
          OR s.awb_code = 'C14535860'
       ORDER BY s.created_at DESC
       LIMIT 15`,
      true
    )
  );
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
