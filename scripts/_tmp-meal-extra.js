const { query } = require('./rds-data-api-utils-dev');
(async () => {
  console.log('Customer 283da901:', JSON.stringify(await query(`SELECT id, phone, full_name, created_at FROM customers WHERE id = '283da901-82e0-4811-8107-9720dda244a6'`), null, 2));
  console.log('orders meal types 30d:', JSON.stringify(await query(`SELECT COUNT(*)::int AS n FROM orders WHERE order_type IN ('meal_plan_delivery','meal_plan') AND created_at >= NOW() - INTERVAL '30 days'`), null, 2));
  console.log('sample orders:', JSON.stringify(await query(`SELECT id, customer_id, order_type, status, payment_status, created_at FROM orders WHERE order_type ILIKE '%meal%' ORDER BY created_at DESC LIMIT 5`), null, 2));
  console.log('phone dupes last10:', JSON.stringify(await query(`
    SELECT RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) AS last10,
           COUNT(*)::int AS cnt,
           array_agg(id ORDER BY created_at) AS ids,
           array_agg(phone ORDER BY created_at) AS phones
    FROM customers
    WHERE phone IS NOT NULL AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10
    GROUP BY 1
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 10
  `), null, 2));
})().catch(e => { console.error(e); process.exit(1); });
