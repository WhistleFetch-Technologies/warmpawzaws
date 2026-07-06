const API = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const { query } = require('./rds-data-api-utils-dev');

(async () => {
  const vendorId = '7931a299-b1f4-48df-86e0-7d1eda0cb572';
  const services = await query(`
    SELECT id::text, service_name, price::text
    FROM vendor_services
    WHERE vendor_id = '${vendorId}'::uuid
      AND (service_name ILIKE '%nail%' OR price::numeric BETWEEN 150 AND 250)
    ORDER BY price ASC
    LIMIT 5`);
  console.log('services', services);
  const row = services[0];
  const serviceId = row?.id ?? row?.[0];
  const amount = Number(row?.price ?? row?.[2]) || 199;
  if (!serviceId) return;
  const res = await fetch(`${API}/promotions/calculate-booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendorId,
      serviceIds: [serviceId],
      serviceStyle: 'at_center',
      serviceCategory: 'vet',
      amount,
    }),
  });
  console.log('calculate-booking', JSON.stringify(await res.json(), null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
