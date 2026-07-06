const { query } = require('./rds-data-api-utils-dev');

const API = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
const vendorId = 'c8b26bb8-73a5-41ea-ad34-e42b195bc20c';
const promoId = 'afad8a9c-18e4-4fd1-b22f-856ed0483480';

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

(async () => {
  const promo = await query(
    `SELECT id::text, name, code, is_active, applicable_services, applicable_service_styles,
            target_audience, usage_limit, usage_count, start_date::text, end_date::text
     FROM vendor_service_promotions WHERE id = '${promoId}'::uuid`
  );
  const row = promo[0];
  const promoObj = row && typeof row === 'object' && !Array.isArray(row)
    ? row
    : {
        id: row[0],
        name: row[1],
        code: row[2],
        is_active: row[3],
        applicable_services: row[4],
        applicable_service_styles: row[5],
        target_audience: row[6],
        usage_limit: row[7],
        usage_count: row[8],
        start_date: row[9],
        end_date: row[10],
      };
  console.log('=== Promotion ===');
  console.log(JSON.stringify(promoObj, null, 2));

  let ids = promoObj.applicable_services;
  if (typeof ids === 'string') {
    try { ids = JSON.parse(ids); } catch { ids = []; }
  }
  if (!Array.isArray(ids)) ids = [];

  const services = await query(`
    SELECT vs.id::text AS vendor_service_id,
           vs.service_id::text AS catalog_service_id,
           vs.service_name,
           vs.price::text,
           vs.service_style,
           vs.is_enabled,
           vs.publish_status
    FROM vendor_services vs
    WHERE vs.vendor_id = '${vendorId}'::uuid
    ORDER BY vs.updated_at DESC NULLS LAST
    LIMIT 20
  `);
  console.log('\n=== Vendor services ===');
  for (const s of services) {
    const vsId = s.vendor_service_id ?? s[0];
    const catId = s.catalog_service_id ?? s[1];
    const inTarget = ids.includes(vsId) || ids.includes(catId);
    console.log({ vsId, catId, name: s.service_name ?? s[2], price: s.price ?? s[3], style: s.service_style ?? s[4], enabled: s.is_enabled ?? s[5], publish: s.publish_status ?? s[6], inTarget });
  }

  for (const testId of [...ids, services[0]?.vendor_service_id ?? services[0]?.[0]].filter(Boolean)) {
    const svc = services.find((s) => (s.vendor_service_id ?? s[0]) === testId || (s.catalog_service_id ?? s[1]) === testId);
    const amount = Number(svc?.price ?? svc?.[3]) || 500;
    const style = svc?.service_style ?? svc?.[4] ?? 'at_center';
    const calc = await fetchJson('/promotions/calculate-booking', {
      method: 'POST',
      body: JSON.stringify({
        vendorId,
        serviceIds: [testId],
        serviceStyle: style,
        amount,
      }),
    });
    console.log(`\n=== calculate-booking serviceId=${testId} amount=${amount} ===`);
    console.log(JSON.stringify(calc.body, null, 2));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
