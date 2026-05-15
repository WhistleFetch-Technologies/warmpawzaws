/**
 * Bank rows for Razorpay / manual payouts: settlements may store vendor_identity id
 * while bank rows use vendors.id (or the reverse). Also support data in either
 * vendor_bank_accounts or vendor_bank_details.
 */

import { query, select } from '../database/rds-connection';
import { resolveVendorById } from '../endpoints/vendor/endpoints/vendorProfile.vendor';

async function expandVendorIdsWithResolved(raw: string): Promise<string[]> {
  const t = String(raw || '').trim();
  if (!t) return [];
  const out = new Set<string>([t]);
  try {
    const row = await resolveVendorById(t);
    const rid = row?.id != null ? String(row.id).trim() : '';
    if (rid) out.add(rid);
  } catch {
    /* keep raw only */
  }
  return [...out];
}

/**
 * Rows suitable for reading account_number / ifsc / holder (vendor_bank_* shape).
 * Order: prefer verified primary-ish account in vendor_bank_accounts, else latest account, else vendor_bank_details.
 */
export async function fetchVendorBankRowsForPayout(vendorIdFromSettlement: string): Promise<any[]> {
  const vendorIds = await expandVendorIdsWithResolved(String(vendorIdFromSettlement || '').trim());
  if (vendorIds.length === 0) return [];

  let bankDetails: any[] = [];

  const hasAccountsTable = async (): Promise<boolean> => {
    try {
      const r = await query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'vendor_bank_accounts'
        ) as ex`
      );
      return Boolean((r as any).rows?.[0]?.ex);
    } catch {
      return false;
    }
  };

  if (await hasAccountsTable()) {
    let hasVerStatusCol = false;
    try {
      const col = await query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'vendor_bank_accounts' AND column_name = 'verification_status'
        ) as ex`
      );
      hasVerStatusCol = Boolean((col as any).rows?.[0]?.ex);
    } catch {
      hasVerStatusCol = false;
    }

    const verifiedCondition = hasVerStatusCol
      ? `(is_verified = true OR LOWER(TRIM(COALESCE(verification_status::text, ''))) = 'verified')`
      : `is_verified = true`;

    try {
      const acc = await query(
        `SELECT * FROM vendor_bank_accounts
         WHERE vendor_id = ANY($1::uuid[])
           AND ${verifiedCondition}
         ORDER BY is_primary DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1`,
        [vendorIds]
      );
      bankDetails = ((acc as any).rows || []) as any[];
    } catch (e) {
      console.warn('[fetchVendorBankRowsForPayout] verified accounts query:', e);
    }

    if (bankDetails.length === 0) {
      try {
        const anyAcc = await query(
          `SELECT * FROM vendor_bank_accounts
           WHERE vendor_id = ANY($1::uuid[])
           ORDER BY updated_at DESC NULLS LAST, is_primary DESC NULLS LAST, created_at DESC NULLS LAST
           LIMIT 1`,
          [vendorIds]
        );
        bankDetails = ((anyAcc as any).rows || []) as any[];
      } catch (e) {
        console.warn('[fetchVendorBankRowsForPayout] any accounts query:', e);
      }
    }
  }

  if (bankDetails.length === 0) {
    for (const vid of vendorIds) {
      try {
        const details = await select('vendor_bank_details', { vendor_id: vid });
        const arr = Array.isArray(details) ? details : [];
        if (arr.length > 0) {
          bankDetails = arr;
          break;
        }
      } catch {
        /* next */
      }
    }
  }

  return bankDetails;
}
