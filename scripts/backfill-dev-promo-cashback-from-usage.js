/**
 * Dev-only: credit promo_engine_usage cashback that never landed on the wallet.
 * Live ledger is wallet_id-only (no wallet_transactions.customer_id).
 *
 *   ENVIRONMENT=dev node scripts/backfill-dev-promo-cashback-from-usage.js --phone=9741675678
 */
const { query, executeSQL, ENVIRONMENT } = require('./rds-data-api-utils-dev');

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : '';
}

function esc(s) {
  return String(s).replace(/'/g, "''");
}

const LAST10 = (arg('phone') || '9741675678').replace(/\D/g, '').slice(-10);

async function main() {
  if (ENVIRONMENT !== 'dev') {
    console.error('Refusing to run unless ENVIRONMENT=dev');
    process.exit(1);
  }

  const customers = await query(`
    SELECT id::text AS id, full_name, phone
    FROM customers
    WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '[^0-9]', '', 'g'), 10) = '${esc(LAST10)}'
    LIMIT 1
  `);
  if (!customers.length) {
    console.error('No customer for phone', LAST10);
    process.exit(1);
  }
  const customer = customers[0];
  const cid = esc(customer.id);
  console.log('Customer', customer);

  await executeSQL(`
    INSERT INTO customer_wallets (customer_id, balance)
    VALUES ('${cid}'::uuid, 0)
    ON CONFLICT (customer_id) DO NOTHING
  `);

  const wallets = await query(`
    SELECT id::text AS id, balance::text AS balance
    FROM customer_wallets
    WHERE customer_id = '${cid}'::uuid
    LIMIT 1
  `);
  const walletId = wallets[0].id;
  console.log('Wallet', wallets[0]);

  const usage = await query(`
    SELECT u.id::text AS usage_id,
           u.promotion_id::text AS promotion_id,
           u.transaction_id,
           u.evaluation_id::text AS evaluation_id,
           u.cashback_amount::text AS cashback_amount,
           e.result_json::text AS result_json
    FROM promo_engine_usage u
    LEFT JOIN promo_engine_evaluations e ON e.id = u.evaluation_id
    WHERE u.user_id = '${cid}'
      AND COALESCE(u.cashback_amount, 0) > 0
    ORDER BY u.created_at ASC
  `);
  console.log('Usage rows with cashback', usage.length);

  let credited = 0;
  let skipped = 0;

  for (const row of usage) {
    const amount = Math.round((parseFloat(row.cashback_amount) || 0) * 100) / 100;
    if (amount <= 0) continue;

    const existing = await query(`
      SELECT id::text AS id
      FROM wallet_transactions
      WHERE source = 'PROMOTION'
        AND promotion_id = '${esc(row.promotion_id)}'::uuid
        AND reference_id::text = '${esc(row.transaction_id)}'
      LIMIT 1
    `);
    if (existing.length) {
      skipped += 1;
      console.log('Skip existing', row.promotion_id, row.transaction_id);
      continue;
    }

    let expiryDays = 30;
    let redeemScope = [];
    try {
      const parsed = JSON.parse(row.result_json || '{}');
      const cb = (parsed.benefits || []).find(
        (b) =>
          b.benefit_type === 'CASHBACK' &&
          String(b.promotion_id) === String(row.promotion_id)
      );
      if (cb?.expiry_days != null) expiryDays = Number(cb.expiry_days);
      if (Array.isArray(cb?.redeem_scope)) redeemScope = cb.redeem_scope;
    } catch {
      /* keep defaults */
    }

    const expiresAt =
      expiryDays != null
        ? `NOW() + INTERVAL '${Number(expiryDays)} days'`
        : 'NULL';
    const scopeJson = esc(JSON.stringify({ services: redeemScope }));
    const desc = esc(`Promo cashback eval=${row.evaluation_id} (dev backfill)`);

    await executeSQL(`
      UPDATE customer_wallets
      SET balance = balance + ${amount},
          total_earned = COALESCE(total_earned, 0) + ${amount},
          updated_at = NOW()
      WHERE id = '${esc(walletId)}'::uuid
    `);

    const balRows = await query(`
      SELECT balance::text AS balance FROM customer_wallets WHERE id = '${esc(walletId)}'::uuid
    `);
    const balanceAfter = parseFloat(balRows[0].balance);

    await executeSQL(`
      INSERT INTO wallet_transactions (
        wallet_id, transaction_type, amount, balance_after,
        reference_type, reference_id, description,
        promotion_id, source, remaining_amount, earned_at, expires_at,
        cashback_status, redeem_scope
      ) VALUES (
        '${esc(walletId)}'::uuid, 'credit', ${amount}, ${balanceAfter},
        'PROMOTION', '${esc(row.transaction_id)}'::uuid, '${desc}',
        '${esc(row.promotion_id)}'::uuid, 'PROMOTION', ${amount}, NOW(), ${expiresAt},
        'AVAILABLE', '${scopeJson}'::jsonb
      )
    `);

    credited += amount;
    console.log('Credited', amount, 'promo', row.promotion_id, 'txn', row.transaction_id);
  }

  const finalWallet = await query(`
    SELECT id::text AS id, balance::text AS balance, total_earned::text AS total_earned
    FROM customer_wallets WHERE customer_id = '${cid}'::uuid
  `);
  const txns = await query(`
    SELECT id::text AS id, amount::text AS amount, remaining_amount::text AS remaining,
           cashback_status, reference_id, description, created_at::text AS created_at
    FROM wallet_transactions
    WHERE wallet_id = '${esc(walletId)}'::uuid
    ORDER BY created_at ASC
  `);

  console.log('\nBackfill done', { credited, skipped, ENVIRONMENT });
  console.log('WALLET', finalWallet);
  console.log('TXNS', JSON.stringify(txns, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
