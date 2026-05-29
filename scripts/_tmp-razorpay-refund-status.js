/**
 * Fetch Razorpay refund status (prod live keys from Secrets Manager).
 * Usage: node scripts/_tmp-razorpay-refund-status.js [refundId] [paymentId]
 */
const { execSync } = require('child_process');

const REFUND_ID = process.argv[2] || 'rfnd_SuOwng80Lzg1FQ';
const PAYMENT_ID = process.argv[3] || 'pay_SuOuTErsgNsDHg';
const SECRET_ID = process.env.RAZORPAY_SECRET_ID || 'warmpawz/prod/razorpay';
const REGION = process.env.AWS_REGION || 'ap-south-1';

function loadConfig() {
  const raw = execSync(
    `aws secretsmanager get-secret-value --secret-id ${SECRET_ID} --region ${REGION} --output json`,
    { encoding: 'utf8' }
  );
  const secret = JSON.parse(raw).SecretString;
  const cfg = JSON.parse(secret);
  if (!cfg.keyId || !cfg.keySecret) {
    throw new Error(`Missing keyId/keySecret in secret ${SECRET_ID}`);
  }
  return cfg;
}

async function rzGet(path, auth) {
  const url = `https://api.razorpay.com/v1${path}`;
  const res = await fetch(url, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Razorpay ${res.status} ${path}: ${JSON.stringify(body)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function main() {
  const cfg = loadConfig();
  const auth = `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`;
  console.log('Secret:', SECRET_ID);
  console.log('Key prefix:', cfg.keyId.slice(0, 12) + '…');
  console.log('Refund ID:', REFUND_ID);
  console.log('Payment ID:', PAYMENT_ID);
  console.log('');

  console.log('=== GET /refunds/{id} ===\n');
  try {
    const refund = await rzGet(`/refunds/${REFUND_ID}`, auth);
    console.log(JSON.stringify(refund, null, 2));
    console.log('\nSummary:');
    console.log('  status:', refund.status);
    console.log('  amount (INR):', (refund.amount || 0) / 100);
    console.log('  payment_id:', refund.payment_id);
    console.log('  created_at:', refund.created_at ? new Date(refund.created_at * 1000).toISOString() : null);
    if (refund.acquirer_data) console.log('  acquirer_data:', JSON.stringify(refund.acquirer_data));
  } catch (e) {
    console.error('Refund fetch failed:', e.message);
  }

  console.log('\n=== GET /payments/{id}/refunds ===\n');
  try {
    const list = await rzGet(`/payments/${PAYMENT_ID}/refunds`, auth);
    const items = list.items || list;
    console.log('Count:', Array.isArray(items) ? items.length : '?');
    if (Array.isArray(items)) {
      for (const r of items) {
        console.log(
          `  - ${r.id} | status=${r.status} | amount=₹${(r.amount || 0) / 100} | created=${r.created_at ? new Date(r.created_at * 1000).toISOString() : 'n/a'}`
        );
      }
      console.log('\nFull list JSON:\n', JSON.stringify(list, null, 2));
    } else {
      console.log(JSON.stringify(list, null, 2));
    }
  } catch (e) {
    console.error('Payment refunds list failed:', e.message);
  }

  console.log('\n=== GET /payments/{id} (payment snapshot) ===\n');
  try {
    const pay = await rzGet(`/payments/${PAYMENT_ID}`, auth);
    console.log(
      JSON.stringify(
        {
          id: pay.id,
          status: pay.status,
          amount: (pay.amount || 0) / 100,
          amount_refunded: (pay.amount_refunded || 0) / 100,
          refund_status: pay.refund_status,
          method: pay.method,
          captured: pay.captured,
          created_at: pay.created_at ? new Date(pay.created_at * 1000).toISOString() : null,
        },
        null,
        2
      )
    );
  } catch (e) {
    console.error('Payment fetch failed:', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
