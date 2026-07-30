#!/usr/bin/env node
/**
 * Force re-resolve ecommerce order commission (CLI).
 *
 * Run via repo root:
 *   ENVIRONMENT=dev node scripts/re-resolve-order-commission.js --phone 9886729131
 */

import { query } from '../src/database/rds-connection';
import {
  forceApplyOrderCommissionAudit,
  resolveOrderCommissionByOrderId,
  buildCommissionSnapshot,
} from '../src/utils/resolve-ecommerce-commission-rate';
import { syncEcommerceOrderSettlementLedgerRow } from '../src/utils/write-ecommerce-order-settlement';

function parseArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

async function resolveOrderId(phone: string | null, orderIdArg: string | null): Promise<string> {
  if (orderIdArg) return orderIdArg;
  if (!phone) {
    throw new Error('Provide --order-id <uuid> or --phone <phone>');
  }
  const digits = phone.replace(/\D/g, '').slice(-10);
  const res = await query(
    `SELECT o.id::text
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE c.phone LIKE $1
     ORDER BY o.created_at DESC
     LIMIT 1`,
    [`%${digits}%`]
  );
  const id = res.rows?.[0]?.id;
  if (!id) throw new Error(`No order found for phone ${phone}`);
  return String(id);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const phone = parseArg('--phone');
  const orderIdArg = parseArg('--order-id');

  const orderId = await resolveOrderId(phone, orderIdArg);

  const orderRes = await query(
    `SELECT id::text, vendor_id::text, commission_rate, commission_amount,
            commission_snapshot, vendor_payout_amount
     FROM orders WHERE id = $1::uuid`,
    [orderId]
  );
  const order = orderRes.rows?.[0];
  if (!order?.vendor_id) {
    throw new Error(`Order ${orderId} not found or missing vendor_id`);
  }

  console.log('Order:', orderId);
  console.log('Vendor:', order.vendor_id);
  console.log('\n--- Before ---');
  console.log(
    JSON.stringify(
      {
        commission_rate: order.commission_rate,
        commission_amount: order.commission_amount,
        vendor_payout_amount: order.vendor_payout_amount,
        commission_snapshot: order.commission_snapshot,
      },
      null,
      2
    )
  );

  if (dryRun) {
    const resolved = await resolveOrderCommissionByOrderId(orderId, String(order.vendor_id));
    const preview = buildCommissionSnapshot(resolved);
    console.log('\n--- After (dry-run preview — NOT persisted) ---');
    console.log(JSON.stringify(preview, null, 2));
    console.log('\nDry-run complete. Re-run without --dry-run to apply.');
    return;
  }

  const result = await forceApplyOrderCommissionAudit(orderId, String(order.vendor_id));
  if (!result) {
    throw new Error('Commission re-resolve failed');
  }

  const ledger = await syncEcommerceOrderSettlementLedgerRow(orderId, { force });
  console.log('\n--- After ---');
  console.log(JSON.stringify(result.current, null, 2));
  console.log('\nSettlement ledger sync:', ledger);

  const afterRes = await query(
    `SELECT commission_rate, commission_amount, vendor_payout_amount, commission_snapshot
     FROM orders WHERE id = $1::uuid`,
    [orderId]
  );
  console.log('\n--- Orders row (persisted) ---');
  console.log(JSON.stringify(afterRes.rows[0], null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
