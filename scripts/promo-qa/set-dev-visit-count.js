/**
 * DEV ONLY. Set a customer's VCF completed visit count so the next Pay Bill
 * evaluate is treated as visit N (completed = N-1).
 *
 *   $env:ENVIRONMENT='dev'; node scripts/promo-qa/set-dev-visit-count.js --phone 91XXXXXXXXXX --visit 3
 *   $env:ENVIRONMENT='dev'; node scripts/promo-qa/set-dev-visit-count.js --phone 91XXXXXXXXXX --visit 1 --vendor <uuid>
 */
const env = String(process.env.ENVIRONMENT || 'dev').toLowerCase();
if (env !== 'dev') {
  console.error('Refusing to run unless ENVIRONMENT=dev');
  process.exit(1);
}
process.env.ENVIRONMENT = 'dev';

const { query, executeSQL } = require('../rds-data-api-utils-dev');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? String(process.argv[i + 1] || '').trim() : '';
}
function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function emptyCells() {
  return {
    tele: { count: 0, lastAt: null },
    appointment: { count: 0, lastAt: null },
    paybill: { count: 0, lastAt: null },
    ecommerce: { count: 0, lastAt: null },
  };
}

(async () => {
  const phoneRaw = arg('phone');
  const visit = Math.max(1, Math.floor(Number(arg('visit') || 1)));
  const vendorId = arg('vendor');
  const completed = visit - 1;
  const digits = phoneRaw.replace(/\D/g, '');
  if (digits.length < 10) {
    console.error('Pass --phone with at least 10 digits and --visit N');
    process.exit(1);
  }
  const last10 = digits.slice(-10);

  const customers = await query(`
    SELECT id::text AS id, phone
    FROM customers
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE ${sqlStr(`%${last10}`)}
    LIMIT 5
  `);
  if (!customers.length) {
    console.error(`No customer matched *${last10}`);
    process.exit(1);
  }
  if (customers.length > 1) {
    console.error('Multiple customers matched; pass a more specific phone');
    for (const c of customers) console.error(`  ${c.id} ${c.phone}`);
    process.exit(1);
  }
  const customer = customers[0];
  const now = new Date().toISOString();
  const cells = emptyCells();
  cells.paybill = { count: completed, lastAt: now };
  cells.tele = { count: 0, lastAt: null };
  cells.appointment = { count: 0, lastAt: null };

  let categoryId = null;
  if (vendorId) {
    const cats = await query(`
      SELECT sc.id::text AS id
      FROM vendors v
      LEFT JOIN roles r ON r.id = v.role_id
      JOIN service_categories sc
        ON sc.vendor_roles::text ILIKE ('%' || COALESCE(r.name, '') || '%')
      WHERE v.id = ${sqlStr(vendorId)}::uuid
      LIMIT 1
    `);
    categoryId = cats[0] && cats[0].id ? cats[0].id : null;
  }

  const existing = await query(
    `SELECT overall::text AS overall, services::text AS services
     FROM customer_behaviour_profiles WHERE user_id = ${sqlStr(customer.id)} LIMIT 1`,
  );
  let overall = {};
  let services = {};
  if (existing[0]) {
    try {
      overall = existing[0].overall ? JSON.parse(existing[0].overall) : {};
    } catch {
      overall = {};
    }
    try {
      services = existing[0].services ? JSON.parse(existing[0].services) : {};
    } catch {
      services = {};
    }
  }
  const vcf = services.vcf && typeof services.vcf === 'object' ? services.vcf : {};
  const platform = {
    ...emptyCells(),
    ...(vcf.platform || {}),
    paybill: cells.paybill,
    tele: cells.tele,
    appointment: cells.appointment,
  };
  const categories = { ...(vcf.categories || {}) };
  const vendors = { ...(vcf.vendors || {}) };
  if (categoryId) categories[categoryId] = { ...emptyCells(), ...(categories[categoryId] || {}), paybill: cells.paybill };
  if (vendorId) {
    vendors[vendorId] = {
      categoryId: categoryId || '',
      roleId: '',
      ...emptyCells(),
      ...(vendors[vendorId] || {}),
      paybill: cells.paybill,
    };
  }
  services.vcf = { platform, categories, vendors };

  if (existing[0]) {
    await executeSQL(`
      UPDATE customer_behaviour_profiles
      SET services = ${sqlStr(JSON.stringify(services))}::jsonb, updated_at = NOW()
      WHERE user_id = ${sqlStr(customer.id)}
    `);
  } else {
    await executeSQL(`
      INSERT INTO customer_behaviour_profiles (user_id, overall, services)
      VALUES (${sqlStr(customer.id)}, ${sqlStr(JSON.stringify(overall))}::jsonb,
              ${sqlStr(JSON.stringify(services))}::jsonb)
    `);
  }

  console.log(
    `SET ${customer.phone} ${customer.id} nextVisit=${visit} completedPaybill=${completed}` +
      (vendorId ? ` vendor=${vendorId}` : '') +
      (categoryId ? ` category=${categoryId}` : ''),
  );
})().catch((e) => {
  console.error('ERR', e.message || e);
  process.exit(1);
});
