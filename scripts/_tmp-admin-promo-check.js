const { query } = require('./rds-data-api-utils-dev');
const API = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

async function main() {
  const promos = await query(`
    SELECT id::text, name, discount_type, discount_value::text, is_active, published,
           service_category, service_style,
           applicable_services::text, start_date::text, end_date::text, metadata::text
    FROM promotions
    WHERE is_active = true
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 15`);

  console.log('=== Active platform promotions ===');
  for (const p of promos) {
    const row = Array.isArray(p) ? {
      id: p[0], name: p[1], discount_type: p[2], discount_value: p[3],
      is_active: p[4], published: p[5], service_category: p[6], service_style: p[7],
      applicable_to: p[8], applicable_services: p[9], start_date: p[10], end_date: p[11],
    } : p;
    console.log(row);
  }

  const clinics = await query(`
    SELECT v.id::text, COALESCE(v.business_name, v.owner_name) AS name,
           v.address
    FROM vendors v
    WHERE v.address ILIKE '%Mahatma Gandhi%'
       OR v.address ILIKE '%Yellappa%'
    LIMIT 5`);
  console.log('\n=== Clinics (MG Rd) ===', clinics);

  let vendorId = clinics[0]?.id ?? clinics[0]?.[0];
  if (!vendorId && clinics.length) vendorId = clinics[0][0];

  if (vendorId) {
    const services = await query(`
      SELECT vs.id::text, vs.service_name, vs.price::text, vs.service_id::text
      FROM vendor_services vs
      WHERE vs.vendor_id = '${vendorId}'::uuid AND vs.is_enabled = true
        AND (vs.service_name ILIKE '%nail%' OR vs.price::numeric BETWEEN 150 AND 250)
      ORDER BY vs.price ASC LIMIT 5`);
    console.log('\n=== Sample services ===', services);

    const vsId = services[0]?.id ?? services[0]?.[0];
    const price = Number(services[0]?.price ?? services[0]?.[2]) || 199;
    if (vsId) {
      const body = {
        vendorId,
        serviceIds: [vsId],
        serviceStyle: 'at_center',
        serviceCategory: 'vet',
        amount: price,
      };
      const res = await fetch(`${API}/promotions/calculate-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      console.log('\n=== calculate-booking ===', JSON.stringify(await res.json(), null, 2));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
