/**
 * Test that solo trainers ts1 (9009009091) and ts2 (9009009092) are discoverable
 * via GET /customer/discover-services?category=training&serviceStyle=at_home.
 *
 * Run: npx ts-node scripts/test-training-home-discovery.ts
 * Or:  API_BASE_URL=http://localhost:3001 npx ts-node scripts/test-training-home-discovery.ts
 */

const API_BASE_URL = process.env.API_BASE_URL || process.env.API_ENDPOINT || 'http://localhost:3001';

const EXPECTED_PHONES = ['9009009091', '9009009092'];

function normalizePhone(p: string): string {
  return String(p || '').replace(/\D/g, '');
}

async function main() {
  const url = `${API_BASE_URL}/customer/discover-services?category=training&serviceStyle=at_home&latitude=12.9716&longitude=77.5946`;
  console.log('GET', url);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e: any) {
    console.error('Request failed:', e?.message);
    process.exit(1);
  }

  const data = (await res.json().catch(() => ({}))) as any;
  const list = data?.providers ?? data?.vendors ?? (Array.isArray(data) ? data : []);
  const phones = list.map((v: any) => normalizePhone(v.phone || v.phoneNumber || '')).filter(Boolean);

  console.log('Status:', res.status);
  console.log('Vendors/providers count:', list.length);
  if (list.length > 0) {
    console.log('Phones in response:', [...new Set(phones)].join(', '));
    list.slice(0, 10).forEach((v: any, i: number) => {
      console.log(`  ${i + 1}. ${v.businessName || v.name || v.id} | phone=${v.phone || v.phoneNumber || '-'} | role=${v.role || '-'}`);
    });
  }

  const found = EXPECTED_PHONES.filter((p) => phones.includes(p));
  const missing = EXPECTED_PHONES.filter((p) => !phones.includes(p));

  if (missing.length === 0) {
    console.log('\nPASS: All expected solo trainers found in discovery (ts1, ts2).');
    process.exit(0);
  }

  console.log('\nExpected phones:', EXPECTED_PHONES.join(', '));
  console.log('Found:', found.length ? found.join(', ') : 'none');
  console.log('Missing:', missing.join(', '));
  console.log('\nFAIL: Training at_home discovery should return vendors with phones 9009009091 and 9009009092.');
  process.exit(1);
}

main();
