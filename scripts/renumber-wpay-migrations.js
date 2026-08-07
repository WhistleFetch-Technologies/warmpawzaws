#!/usr/bin/env node
/** One-off: renumber WPay/WAPPT migrations to follow develop 1080-1082 without collisions. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = path.join(__dirname, '..', 'db', 'migrations');
const map = [
  ['1080_warmpawz_pay_phase1_schema.sql', '1083_warmpawz_pay_phase1_schema.sql'],
  ['1081_warmpawz_pay_admin_rbac.sql', '1084_warmpawz_pay_admin_rbac.sql'],
  ['1082_warmpawz_pay_merchant_pricing.sql', '1085_warmpawz_pay_merchant_pricing.sql'],
  ['1083_warmpawz_pay_pricing_rbac.sql', '1086_warmpawz_pay_pricing_rbac.sql'],
  ['1084_drop_vendors_pay_bill_enabled.sql', '1087_drop_vendors_pay_bill_enabled.sql'],
  ['1085_sync_vendors_bank_verified_from_accounts.sql', '1088_sync_vendors_bank_verified_from_accounts.sql'],
  ['1086_warmpawz_appointments_schema.sql', '1089_warmpawz_appointments_schema.sql'],
  ['1087_warmpawz_appointments_admin_rbac.sql', '1090_warmpawz_appointments_admin_rbac.sql'],
  ['1088_wappt_backfill_commerce_mode.sql', '1091_wappt_backfill_commerce_mode.sql'],
  ['1090_align_groomer_problem_grid_specialization_ids.sql', '1092_align_groomer_problem_grid_specialization_ids.sql'],
  ['1091_wappt_cancellation_refund_policies.sql', '1093_wappt_cancellation_refund_policies.sql'],
  ['1092_wappt_default_1h_cancellation_policy.sql', '1094_wappt_default_1h_cancellation_policy.sql'],
  ['1093_warmpawz_pay_platform_withhold.sql', '1095_warmpawz_pay_platform_withhold.sql'],
  ['1094_warmpawz_pay_appointment_credits.sql', '1096_warmpawz_pay_appointment_credits.sql'],
  ['1095_wappt_cancel_platform_fee_vendor_earnings.sql', '1097_wappt_cancel_platform_fee_vendor_earnings.sql'],
];

function gitMv(from, to) {
  execSync(`git mv "${from}" "${to}"`, { stdio: 'inherit' });
}

let i = 9000;
for (const [src, dst] of map) {
  const sp = path.join(dir, src);
  if (!fs.existsSync(sp)) {
    console.warn('MISSING', src);
    continue;
  }
  gitMv(sp, path.join(dir, `z${i++}_${dst}`));
}

const staged = fs.readdirSync(dir).filter((f) => /^z\d+_/.test(f)).sort();
for (const f of staged) {
  const dst = f.replace(/^z\d+_/, '');
  gitMv(path.join(dir, f), path.join(dir, dst));
}

console.log('Renumber complete.');
