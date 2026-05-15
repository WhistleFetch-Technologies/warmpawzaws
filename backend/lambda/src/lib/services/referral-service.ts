/**
 * Referral Service
 * 
 * Handles referral code processing during signup and point awarding
 * AWS Serverless compatible (Lambda, RDS)
 * 
 * Supports customer→customer, vendor→vendor, vendor→customer, and customer→vendor referrals
 */

import { select, query, update, insert, withTransaction } from '../../database/rds-connection';
import type { AwardPointsParams } from './loyalty&reward/loyalty-points-service';
import { loyaltyPointsService } from './loyalty&reward/loyalty-points-service';
import { loyaltyRulesInitService } from './loyalty-rules-init-service';

export interface ProcessReferralSignupParams {
  customerId?: string;
  vendorId?: string;
  referralCode: string;
  /** Last-10-digit phone for customer_referrals.referred_phone */
  phone?: string;
}

export interface ProcessReferralSignupResult {
  success: boolean;
  referredPoints?: number;
  referrerPoints?: number;
  error?: string;
}

export interface VendorReferralFirstBookingRewardParams {
  eventId: string;
  bookingId?: string;
}

/**
 * Mark matching vendor_referrals row approved for the vendor-app list.
 * Joins on customer_referrals row id so phone/vendor matching uses DB values only (avoids driver/param quirks).
 */
async function syncVendorReferralsRowAfterCustomerReferralReward(params: {
  eventId: string;
  customerReferralRowId: string;
}): Promise<void> {
  const { eventId, customerReferralRowId } = params;
  try {
    const vrRes = await query(
      `UPDATE vendor_referrals vr
       SET status = 'approved',
           approved_at = COALESCE(vr.approved_at, NOW()),
           updated_at = NOW()
       FROM customer_referrals cr
       WHERE cr.id = $1::uuid
         AND cr.referrer_vendor_id IS NOT NULL
         AND vr.referrer_vendor_id = cr.referrer_vendor_id
         AND vr.referred_phone NOT LIKE 'REFERRER%'
         AND NULLIF(TRIM(cr.referred_phone), '') IS NOT NULL
         AND NULLIF(TRIM(vr.referred_phone), '') IS NOT NULL
         AND (
           TRIM(vr.referred_phone) = TRIM(cr.referred_phone)
           OR (
             LENGTH(REGEXP_REPLACE(COALESCE(vr.referred_phone, ''), '[^0-9]', '', 'g')) >= 10
             AND LENGTH(REGEXP_REPLACE(COALESCE(cr.referred_phone, ''), '[^0-9]', '', 'g')) >= 10
             AND RIGHT(REGEXP_REPLACE(COALESCE(vr.referred_phone, ''), '[^0-9]', '', 'g'), 10)
                 = RIGHT(REGEXP_REPLACE(COALESCE(cr.referred_phone, ''), '[^0-9]', '', 'g'), 10)
           )
         )`,
      [customerReferralRowId]
    );
    if ((vrRes as { rowCount?: number }).rowCount === 0) {
      console.warn('[VENDOR-REFERRAL-FIRST-BOOKING] vendor_referrals sync: no row matched for customer_referrals row', {
        eventId,
        customerReferralRowId,
      });
    }
  } catch (e: unknown) {
    console.warn('[VENDOR-REFERRAL-FIRST-BOOKING] vendor_referrals sync failed:', e instanceof Error ? e.message : e);
  }
}

export interface VendorReferralApprovalRewardParams {
  eventId: string;
  applicationId?: string;
  vendorId?: string;
}

/**
 * After admin approves vendor onboarding: link `vendor_referrals` rows that match phone
 * but still have no `referred_vendor_id` (signup / race edge cases).
 */
export async function linkVendorReferralRecordsOnVendorApproval(params: {
  vendorId: string;
  identity: { phone?: string | null } | null | undefined;
}): Promise<void> {
  const { vendorId, identity } = params;
  if (!vendorId) return;

  let digits = '';
  if (identity?.phone) {
    digits = String(identity.phone).replace(/\D/g, '').slice(-10);
  }
  if (digits.length < 10) {
    try {
      const rows = await select('vendors', { id: vendorId });
      const p = rows[0]?.phone;
      digits = String(p || '').replace(/\D/g, '').slice(-10);
    } catch {
      /* ignore */
    }
  }
  if (digits.length < 10) return;

  try {
    const res = await query(
      `UPDATE vendor_referrals
       SET referred_vendor_id = $1,
           status = CASE WHEN status = 'pending' THEN 'applied' ELSE status END,
           applied_at = COALESCE(applied_at, NOW()),
           updated_at = NOW()
       WHERE referred_vendor_id IS NULL
         AND (referrer_vendor_id IS DISTINCT FROM $1)
         AND NULLIF(TRIM(referred_phone), '') IS NOT NULL
         AND referred_phone NOT LIKE 'REFERRER%'
         AND RIGHT(REGEXP_REPLACE(COALESCE(referred_phone, ''), '[^0-9]', '', 'g'), 10) = $2`,
      [vendorId, digits]
    );
    const rc = (res as { rowCount?: number }).rowCount ?? 0;
    if (rc > 0) {
      console.info('[REFERRAL-LINK-APPROVAL] Linked vendor_referrals on admin approval', {
        vendorId,
        rows: rc,
      });
    }
  } catch (e) {
    console.warn(
      '[REFERRAL-LINK-APPROVAL] vendor_referrals link failed (non-fatal):',
      e instanceof Error ? e.message : e
    );
  }
}

/**
 * Process referral code during user signup
 * Awards points to both referred user and referrer using loyalty service
 */
async function resolveCustomerPhoneDigits(customerId: string, fallback?: string): Promise<string> {
  const fromParam = fallback?.replace(/\D/g, '').slice(-10);
  if (fromParam && fromParam.length >= 10) return fromParam.slice(-10);
  const rows = await select('customers', { id: customerId });
  const p = rows[0]?.phone;
  const digits = String(p || '').replace(/\D/g, '').slice(-10);
  return digits.length >= 10 ? digits.slice(-10) : '';
}

/** Persist peer referral row in customer_referrals (peer links also in referral_redemptions). */
async function upsertCustomerReferralPeer(params: {
  referrerCustomerId: string;
  referredCustomerId: string;
  referredPhone: string;
  referralCode: string;
}): Promise<void> {
  const phone = params.referredPhone.replace(/\D/g, '').slice(-10);
  if (!phone || phone.length < 10) {
    console.warn('[REFERRAL] Skipping customer_referrals: invalid phone');
    return;
  }
  const dup = await query(
    `SELECT id FROM customer_referrals 
     WHERE referrer_customer_id = $1 AND referred_phone = $2
     LIMIT 1`,
    [params.referrerCustomerId, phone]
  );
  const now = new Date().toISOString();
  if (dup.rows.length > 0) {
    await query(
      `UPDATE customer_referrals
       SET referred_customer_id = $1,
           status = 'approved',
           applied_at = COALESCE(applied_at, NOW()),
           approved_at = COALESCE(approved_at, NOW()),
           updated_at = NOW()
       WHERE id = $2`,
      [params.referredCustomerId, dup.rows[0].id]
    );
    return;
  }
  await insert('customer_referrals', {
    referrer_customer_id: params.referrerCustomerId,
    referred_customer_id: params.referredCustomerId,
    referred_phone: phone,
    referral_code: params.referralCode,
    status: 'approved',
    applied_at: now,
    approved_at: now,
    created_at: now,
    updated_at: now,
  });
}

export async function processReferralSignup(
  params: ProcessReferralSignupParams
): Promise<ProcessReferralSignupResult> {
  const { customerId, referralCode, phone: phoneParam } = params;

  try {
    // 1. Resolve peer referral first (before loyalty rules). Vendor codes live in
    // vendor_referrals only — no row here returns Invalid so auth can run
    // processVendorReferralForCustomerSignup. Loyalty init used to run first and
    // returned a different error, which skipped the vendor fallback entirely.
    const normalizedCode = referralCode.trim().toUpperCase();
    console.log(`[REFERRAL] Looking up referral code: ${normalizedCode} (original: ${referralCode})`);

    let referrals = await select('referrals', { referral_code: normalizedCode });
    if (referrals.length === 0) {
      const caseInsensitiveResult = await query(
        `SELECT * FROM referrals WHERE UPPER(referral_code) = $1 LIMIT 1`,
        [normalizedCode]
      );

      if (caseInsensitiveResult.rows.length === 0) {
        console.log(`[REFERRAL] ❌ No peer referral row for code: ${normalizedCode} (vendor path may apply)`);
        return {
          success: false,
          error: 'Invalid referral code',
        };
      }
      console.log(`[REFERRAL] ⚠️ Found referral code with case-insensitive lookup (should normalize in database)`);
      referrals = caseInsensitiveResult.rows;
    }

    const rulesInit = await loyaltyRulesInitService.initializeReferralRules();
    if (!rulesInit.referralSignup || !rulesInit.referFriend) {
      console.error(`[REFERRAL] ❌ CRITICAL: Loyalty rules not initialized! referralSignup=${rulesInit.referralSignup}, referFriend=${rulesInit.referFriend}`);
      return {
        success: false,
        error: 'Loyalty rules not initialized. Please contact support.',
      };
    }
    console.log(`[REFERRAL] ✅ Loyalty rules verified: referralSignup=${rulesInit.referralSignup}, referFriend=${rulesInit.referFriend}`);

    const referral = referrals[0];

    // 2. Check if customer is trying to use their own code
    if (referral.referrer_id === customerId) {
      console.log(`[REFERRAL] Customer ${customerId} tried to use their own referral code`);
      return {
        success: false,
        error: 'Cannot use your own referral code',
      };
    }

    // 3. At most one peer referral per referee (globally)
    const existingRedemption = await query(
      `SELECT 1 FROM referral_redemptions WHERE referred_id = $1 LIMIT 1`,
      [customerId]
    );
    if (existingRedemption.rows.length > 0) {
      console.log(`[REFERRAL] Customer ${customerId} already used a referral code`);
      return {
        success: false,
        error: 'Referral code already used',
      };
    }

    // 4. Deprecated: Points are not awarded from endpoints/services. Action-source handles awards.
    let referredPoints = 0;

    // 5. Award points to referrer (via refer_friend rule) - CRITICAL: Must succeed
    let referrerPoints = 0;
    let referrerPointsAttempts = 0;
    const maxRetries = 2;
    
    // No direct awarding here; handled by consumer on appropriate ActionOccurred event
    
    // No awards attempted; keep record linking only

    // 6. Record peer redemption (one code, many friends; master referrals row is not overwritten)
    try {
      await query(
        `INSERT INTO referral_redemptions (referral_id, referred_id, created_at)
         VALUES ($1, $2, NOW())`,
        [referral.id, customerId]
      );
      console.log(`[REFERRAL] ✅ referral_redemptions row for referral ${referral.id}, referred ${customerId}`);
    } catch (insErr: unknown) {
      const msg = String((insErr as { message?: string })?.message || insErr);
      if (msg.includes('referral_redemptions_referred_id_uidx') || msg.includes('duplicate key') || msg.includes('unique')) {
        return {
          success: false,
          error: 'Referral code already used',
        };
      }
      throw insErr;
    }

    const referredPhone = customerId
      ? await resolveCustomerPhoneDigits(customerId, phoneParam)
      : '';
    if (customerId && referral.referrer_id && referredPhone.length >= 10) {
      try {
        await upsertCustomerReferralPeer({
          referrerCustomerId: referral.referrer_id,
          referredCustomerId: customerId,
          referredPhone,
          referralCode: normalizedCode,
        });
        console.log(`[REFERRAL] ✅ customer_referrals row ensured for peer referral`);
      } catch (crErr: any) {
        console.warn(`[REFERRAL] customer_referrals upsert failed (non-fatal):`, crErr?.message || crErr);
      }
    }

    console.log(`[REFERRAL] ✅ Linked referral for customer ${customerId} with code ${referralCode}. Points will be handled by action-source.`);

    return {
      success: true,
      referredPoints: 0,
      referrerPoints: 0,
    };
  } catch (error: any) {
    console.error(`[REFERRAL] ❌ Error processing referral signup:`, error);
    return {
      success: false,
      error: error.message || 'Failed to process referral code',
    };
  }
}

/**
 * Process vendor referral code during vendor signup/registration
 * Awards points to referrer vendor when referred vendor creates account
 * Similar to customer referral but uses vendor_referrals table and vendor loyalty rules
 */
export async function processVendorReferralSignup(
  params: { vendorId: string; referralCode: string; phone: string }
): Promise<ProcessReferralSignupResult> {
  const { vendorId, referralCode, phone } = params;

  try {
    // Ensure vendor referral rules exist before processing
    const { loyaltyRulesInitService } = await import('./loyalty-rules-init-service');
    await loyaltyRulesInitService.initializeVendorReferralRules();
    
    console.log(`[VENDOR-REFERRAL] Processing vendor referral: vendorId=${vendorId}, code=${referralCode}, phone=${phone}`);

    // Normalize phone number
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
    const normalizedCode = referralCode.trim().toUpperCase();

    // 1. Find referral record by code and phone
    let referralRecords: { rows: any[] } = await query(
      `SELECT * FROM vendor_referrals 
       WHERE referral_code = $1 AND referred_phone = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedCode, normalizedPhone]
    );

    // If not found by phone, try to find by code only (might be a new referral)
    if (referralRecords.rows.length === 0) {
      const codeRecords = await query(
        `SELECT * FROM vendor_referrals 
         WHERE referral_code = $1 
         AND referrer_vendor_id IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [normalizedCode]
      );

      if (codeRecords.rows.length > 0) {
        // Create new referral record for this phone
        const newReferral = await insert('vendor_referrals', {
          referrer_vendor_id: codeRecords.rows[0].referrer_vendor_id,
          referred_phone: normalizedPhone,
          referral_code: normalizedCode,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        referralRecords = { rows: newReferral };
        console.log(`[VENDOR-REFERRAL] Created new referral record for phone: ${normalizedPhone}`);
      }
    }

    if (referralRecords.rows.length === 0) {
      console.log(`[VENDOR-REFERRAL] No referral record found for code: ${normalizedCode}, phone: ${normalizedPhone}`);
      return {
        success: false,
        error: 'Invalid referral code',
      };
    }

    const referralRecord = referralRecords.rows[0];

    // 2. Check if vendor is trying to use their own code
    if (referralRecord.referrer_vendor_id === vendorId) {
      console.log(`[VENDOR-REFERRAL] Vendor ${vendorId} tried to use their own referral code`);
      return {
        success: false,
        error: 'Cannot use your own referral code',
      };
    }

    // 3. Check if this referral was already applied/approved for this vendor
    // BUT: If approved but points weren't awarded, we should still award them
    if (referralRecord.referred_vendor_id === vendorId && (referralRecord.status === 'applied' || referralRecord.status === 'approved')) {
      // Check if points were already awarded by checking loyalty_transactions
      const existingPoints = await query(
        `SELECT COUNT(*) as count FROM loyalty_transactions 
         WHERE customer_id = $1 
         AND reference_type = 'vendor_referral' 
         AND reference_id = $2`,
        [referralRecord.referrer_vendor_id, referralRecord.id]
      );
      
      if (existingPoints.rows[0]?.count > 0) {
        console.log(`[VENDOR-REFERRAL] Referral already processed and points already awarded for vendor ${vendorId}`);
      return {
        success: false,
        error: 'This referral code has already been used',
      };
      } else {
        // Points weren't awarded yet, even though referral is approved - award them now
        console.log(`[VENDOR-REFERRAL] Referral is approved but points not awarded yet. Awarding now...`);
        // Continue to award points below
      }
    }

    // 4. CRITICAL: Always update referral record with referred vendor ID
    // This ensures the vendor name shows correctly in the referral list (prevents "Unknown Vendor")
    const updateResult = await query(
      `UPDATE vendor_referrals
       SET referred_vendor_id = $1,
           status = CASE 
             WHEN status = 'pending' THEN 'applied'
             ELSE status
           END,
           applied_at = COALESCE(applied_at, NOW()),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [vendorId, referralRecord.id]
    );
    
    if (updateResult.rows.length > 0) {
      console.log(`[VENDOR-REFERRAL] ✅ Updated referral ${referralRecord.id} with vendor_id ${vendorId}`);
      console.log(`[VENDOR-REFERRAL] Referral status: ${updateResult.rows[0].status}, vendor_id: ${updateResult.rows[0].referred_vendor_id}`);
    } else {
      console.error(`[VENDOR-REFERRAL] ⚠️ Failed to update referral ${referralRecord.id} - no rows affected`);
    }

    // 5. Referral reward is now action-source controlled.
    // Points are awarded by the loyalty-events-consumer when the referred vendor completes their first booking.
    // We only link the referral record here; no direct award.
    console.log(`[VENDOR-REFERRAL] ✅ Referral linked for vendor ${vendorId} with code ${normalizedCode}. Reward will be issued via action-source when referred vendor completes first booking.`);

    return {
      success: true,
      referrerPoints: 0, // Points are awarded later via action-source
    };
  } catch (error: any) {
    console.error(`[VENDOR-REFERRAL] ❌ Error processing vendor referral signup:`, error);
    return {
      success: false,
      error: error.message || 'Failed to process vendor referral code',
    };
  }
}

/**
 * Validates referral code at vendor application submit:
 * — **WARM (customer code):** only `referrals` — same row as peer signup (`referrer_id` = customer who
 *   issued the code). Sets `pending_vendor_identity_id` until `referred_vendor_id` is linked. No duplicate
 *   storage in `vendor_identity.metadata` for WARM.
 * — **VENDOR… code:** `vendor_referrals` + metadata mirror for activation link.
 */
export async function validateAndStoreReferralCodeForVendorApplication(params: {
  vendorIdentityId: string;
  referralCodeRaw: string;
  /** Last-10-digit phone for vendor_referrals.referred_phone */
  phone: string;
}): Promise<{ success: boolean; error?: string }> {
  const { vendorIdentityId, referralCodeRaw, phone } = params;
  const normalizedCode = String(referralCodeRaw || '').trim().toUpperCase();
  if (!normalizedCode) {
    return { success: false, error: 'Referral code is empty' };
  }
  const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);
  if (normalizedPhone.length < 10) {
    return { success: false, error: 'Valid phone is required to store a vendor referral' };
  }

  try {
    const refRes = await query(
      `SELECT id, referrer_id, referred_vendor_id, pending_vendor_identity_id
       FROM referrals
       WHERE UPPER(referral_code) = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedCode]
    );
    const referral = refRes.rows?.[0] as
      | {
          id: string;
          referrer_id: string;
          referred_vendor_id: string | null;
          pending_vendor_identity_id: string | null;
        }
      | undefined;

    if (referral) {
      // `referrals.referrer_id` is always the customer who created the WARM code (see GET /customer/:id/referral).
      const cust = await query(`SELECT 1 FROM customers WHERE id = $1 LIMIT 1`, [referral.referrer_id]);
      if ((cust as any).rowCount > 0 && !referral.referred_vendor_id) {
        if (
          referral.pending_vendor_identity_id &&
          referral.pending_vendor_identity_id !== vendorIdentityId
        ) {
          return { success: false, error: 'This referral code is already reserved for another application' };
        }
        const upd = await query(
          `UPDATE referrals
           SET pending_vendor_identity_id = $1
           WHERE id = $2
             AND referred_vendor_id IS NULL
             AND (pending_vendor_identity_id IS NULL OR pending_vendor_identity_id = $1)
           RETURNING id`,
          [vendorIdentityId, referral.id]
        );
        if (upd.rows.length === 0) {
          return { success: false, error: 'This referral code has already been used' };
        }
        console.log(
          `[REFERRAL-VENDOR-SUBMIT] WARM reserved on referrals id=${referral.id} referrer_id=${referral.referrer_id} (code owner) vendor_identity=${vendorIdentityId}`
        );
        return { success: true };
      }
    }

    const codeRecords = await query(
      `SELECT * FROM vendor_referrals
       WHERE referral_code = $1
         AND referrer_vendor_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedCode]
    );
    if (codeRecords.rows.length > 0) {
      const referrerVendorId = (codeRecords.rows[0] as { referrer_vendor_id: string }).referrer_vendor_id;
      const existingPhone = await query(
        `SELECT id, referred_vendor_id FROM vendor_referrals
         WHERE referral_code = $1 AND referred_phone = $2
         ORDER BY created_at DESC LIMIT 1`,
        [normalizedCode, normalizedPhone]
      );
      const row = existingPhone.rows?.[0] as { id: string; referred_vendor_id: string | null } | undefined;
      if (row?.referred_vendor_id) {
        return { success: false, error: 'This referral code has already been used for this phone' };
      }
      let vendorReferralRowId: string;
      if (row?.id) {
        vendorReferralRowId = row.id;
        await query(`UPDATE vendor_referrals SET updated_at = NOW() WHERE id = $1`, [vendorReferralRowId]);
      } else {
        const inserted = await insert('vendor_referrals', {
          referrer_vendor_id: referrerVendorId,
          referred_phone: normalizedPhone,
          referral_code: normalizedCode,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        vendorReferralRowId = (inserted[0] as { id: string }).id;
      }
      const rows = await select('vendor_identity', { id: vendorIdentityId });
      const meta = { ...(rows[0]?.metadata || {}) };
      meta.referral_code = normalizedCode;
      meta.referral_code_id = vendorReferralRowId;
      meta.referral_source = 'vendor_referrals';
      await update('vendor_identity', { id: vendorIdentityId }, { metadata: meta, updated_at: new Date().toISOString() });
      console.log(`[REFERRAL-VENDOR-SUBMIT] Ensured vendor_referrals row for phone ${normalizedPhone}`);
      return { success: true };
    }

    return { success: false, error: 'Invalid referral code' };
  } catch (error: any) {
    console.error('[REFERRAL-VENDOR-SUBMIT] ❌', error);
    return { success: false, error: error.message || 'Failed to validate referral code' };
  }
}

/**
 * Once `vendors.id` exists (admin approval or activation), link vendor↔vendor or customer→vendor referral rows.
 * Idempotent: `processCustomerReferralForVendorSignup` and `processVendorReferralSignup` guard duplicates.
 * Resolves code from `metadata`, then `referrals.pending_vendor_identity_id`, then a pending `vendor_referrals` row for this phone.
 */
export async function linkVendorOnboardingReferralsFromIdentityMetadata(params: {
  vendorId: string;
  phone: string | undefined;
  metadata: Record<string, unknown> | null | undefined;
  vendorIdentityId?: string;
}): Promise<void> {
  const { vendorId, phone, metadata, vendorIdentityId } = params;
  if (!phone) {
    return;
  }

  let refCode = String(metadata?.referral_code || '').trim();
  if (!refCode && vendorIdentityId) {
    try {
      const r = await query(
        `SELECT referral_code FROM referrals WHERE pending_vendor_identity_id = $1 LIMIT 1`,
        [vendorIdentityId]
      );
      const code = (r.rows?.[0] as { referral_code?: string } | undefined)?.referral_code;
      if (code) refCode = String(code).trim();
    } catch {
      /* pending_vendor_identity_id column may be missing until migration 709 */
    }
  }
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (!refCode && digits.length >= 10) {
    const vr = await query(
      `SELECT referral_code FROM vendor_referrals
       WHERE referred_phone = $1 AND referred_vendor_id IS NULL
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [digits]
    );
    const code = (vr.rows?.[0] as { referral_code?: string } | undefined)?.referral_code;
    if (code) refCode = String(code).trim();
  }
  if (!refCode) {
    return;
  }

  try {
    let referralResult = await processVendorReferralSignup({
      vendorId,
      referralCode: refCode,
      phone,
    });
    if (!referralResult.success && referralResult.error === 'Invalid referral code') {
      referralResult = await processCustomerReferralForVendorSignup({
        vendorId,
        referralCode: refCode,
        phone,
        vendorIdentityId,
      });
    }
    if (referralResult.success) {
      console.log('[VENDOR-REFERRAL-LINK] Referral linked (vendor or customer referral code)');
    } else {
      console.warn(`[VENDOR-REFERRAL-LINK] Referral linking failed: ${referralResult.error}`);
    }
  } catch (refError: unknown) {
    console.error('[VENDOR-REFERRAL-LINK] Error linking referral:', refError);
  }
}

/**
 * Link referred vendor on the **same `referrals` row** as peer WARM codes: `referrer_id` = customer who
 * issued the code; sets `referred_vendor_id` when the vendor record exists. Does not use `referral_redemptions`
 * (that table is customer-referee only).
 */
export async function processCustomerReferralForVendorSignup(params: {
  vendorId: string;
  referralCode: string;
  phone: string;
  /** When set, must match `referrals.pending_vendor_identity_id` from application submit */
  vendorIdentityId?: string;
}): Promise<ProcessReferralSignupResult> {
  const { vendorId, referralCode, phone, vendorIdentityId } = params;

  try {
    const normalizedCode = String(referralCode || '').trim().toUpperCase();
    if (!normalizedCode) {
      return { success: false, error: 'Invalid referral code' };
    }

    const dupVendor = await query(
      `SELECT id FROM referrals WHERE referred_vendor_id = $1 LIMIT 1`,
      [vendorId]
    );
    if ((dupVendor as any).rowCount > 0) {
      return { success: false, error: 'This vendor account already used a referral link' };
    }

    const refRes = await query(
      `SELECT * FROM referrals WHERE UPPER(referral_code) = $1 ORDER BY created_at DESC LIMIT 1`,
      [normalizedCode]
    );
    const referral = refRes.rows[0];
    if (!referral) {
      return { success: false, error: 'Invalid referral code' };
    }

    const cust = await query(`SELECT 1 FROM customers WHERE id = $1 LIMIT 1`, [referral.referrer_id]);
    if ((cust as any).rowCount === 0) {
      return { success: false, error: 'Invalid referral code' };
    }

    if (referral.referrer_id === vendorId) {
      return { success: false, error: 'Cannot use your own referral code' };
    }

    if (referral.referred_vendor_id) {
      return { success: false, error: 'This referral code has already been used' };
    }

    const pendingId = (referral as { pending_vendor_identity_id?: string | null }).pending_vendor_identity_id;
    if (pendingId && vendorIdentityId && pendingId !== vendorIdentityId) {
      return { success: false, error: 'This referral code is reserved for another application' };
    }
    if (pendingId && !vendorIdentityId) {
      console.warn('[CUSTOMER-REFERRAL-VENDOR] Referral row has pending_vendor_identity_id but link call omitted vendorIdentityId');
    }

    const upd = await query(
      `UPDATE referrals
       SET referred_vendor_id = $1,
           status = 'completed',
           completed_at = COALESCE(completed_at, NOW()),
           pending_vendor_identity_id = NULL
       WHERE id = $2
         AND referred_id IS NULL
         AND referred_vendor_id IS NULL
         AND ($3::uuid IS NULL OR pending_vendor_identity_id IS NULL OR pending_vendor_identity_id = $3::uuid)
       RETURNING id`,
      [vendorId, referral.id, vendorIdentityId ?? null]
    );
    if (upd.rows.length === 0) {
      return { success: false, error: 'This referral code has already been used' };
    }

    console.log(
      `[CUSTOMER-REFERRAL-VENDOR] Linked vendor ${vendorId} to customer referrer ${referral.referrer_id} (code ${normalizedCode}, phone ${phone})`
    );

    return { success: true, referredPoints: 0, referrerPoints: 0 };
  } catch (error: any) {
    const msg = String(error?.message || error);
    if (msg.includes('referrals_one_referred_party_chk') || msg.includes('unique') || msg.includes('duplicate')) {
      return { success: false, error: 'This referral code has already been used' };
    }
    console.error('[CUSTOMER-REFERRAL-VENDOR] ❌', error);
    return { success: false, error: error.message || 'Failed to process customer referral for vendor' };
  }
}

/** Params for `customer_referral` ActionOccurred from HTTP action_sources (e.g. POST /auth/otp/verify). */
export interface CustomerReferralOtpVerifyRewardParams {
  eventId: string;
  /** Friend who used the code (OTP entity). */
  customerId: string | undefined;
  entityType?: 'customer' | 'vendor' | 'auto';
}

/**
 * Award the referrer when the friend completes OTP: resolve `referrals.referrer_id` for `referred_id` = friend,
 * dedupe one earned row per referrer + friend (`reference_id` = friend’s customer id), credit referrer only.
 */
export async function processCustomerReferralOtpVerifyReward(
  params: CustomerReferralOtpVerifyRewardParams
): Promise<void> {
  const { eventId, customerId, entityType } = params;
  const refereeId = customerId;

  if (entityType === 'vendor') {
    console.info('[CUSTOMER-REFERRAL-OTP] Skip: entity is vendor, expected customer', { eventId });
    return;
  }
  
  if (!refereeId || String(refereeId).startsWith('temp_')) {
    console.warn('[CUSTOMER-REFERRAL-OTP] Missing or temp customer id, skipping', { eventId, refereeId });
    return;
  }

  const custRows = await select('customers', { id: refereeId });
  if (!custRows.length) {
    console.warn('[CUSTOMER-REFERRAL-OTP] Referred customer not found, skipping', { eventId, refereeId });
    return;
  }

  const refRes = await query(
    `SELECT id, referrer_id, referral_code, referred_id
     FROM referrals
     WHERE referred_id = $1
     LIMIT 1`,
    [refereeId]
  );
  if (refRes.rows.length === 0) {
    console.info('[CUSTOMER-REFERRAL-OTP] No referral row for referred customer; skip award', { eventId, refereeId });
    return;
  }
  const referral = refRes.rows[0] as {
    id: string;
    referrer_id: string;
    referral_code: string;
    referred_id: string;
  };

  const referrerId = referral.referrer_id;
  if (!referrerId || referrerId === referral.referred_id) {
    console.warn('[CUSTOMER-REFERRAL-OTP] Invalid referrer_id, skipping', { eventId, referralId: referral.id });
    return;
  }

  const referrerRows = await select('customers', { id: referrerId });
  if (!referrerRows.length) {
    console.warn('[CUSTOMER-REFERRAL-OTP] Referrer customer row missing, skipping', { eventId, referrerId });
    return;
  }

  const dup = await query(
    `SELECT 1 FROM loyalty_transactions
     WHERE customer_id = $1
       AND transaction_type = 'earned'
       AND reference_type = 'customer_referral'
       AND reference_id = $2
     LIMIT 1`,
    [referrerId, refereeId]
  );
  if (dup.rows.length > 0) {
    console.info('[CUSTOMER-REFERRAL-OTP] Referrer already awarded for this friend, skipping', {
      eventId,
      referrerId,
      refereeId,
    });
    return;
  }

  const result = await loyaltyPointsService.awardPoints({
    customerId: referrerId,
    actionName: 'customer_referral',
    referenceType: 'customer_referral',
    referenceId: refereeId,
    description: 'Referral reward — friend verified with your code',
    metadata: {
      eventId,
      referralsId: referral.id,
      referrerId,
      referredId: refereeId,
      referralCode: referral.referral_code,
    },
  });

  console.info('[CUSTOMER-REFERRAL-OTP] Award result (referrer)', {
    eventId,
    referrerId,
    referredId: refereeId,
    points: result.points,
    walletCredited: result.walletCredited,
  });
}

export interface CustomerReferralFirstBookingRewardParams {
  eventId: string;
  bookingId?: string;
  /** Event entity (customer who booked); must match booking.customer_id */
  customerId?: string;
}

/**
 * Award the **referrer** when a referred customer’s booking triggers `customer_referral` (e.g. Razorpay verify).
 * Idempotency: one award per referrer+referee via `loyalty_transactions` duplicate check — not via COUNT(bookings).
 * Resolves peer link via `referral_redemptions` first, then `referrals.referred_id`.
 */
export async function processCustomerReferralFirstBookingReward(
  params: CustomerReferralFirstBookingRewardParams
): Promise<void> {
  const { eventId, bookingId, customerId: entityCustomerId } = params;
  if (!bookingId) {
    console.warn('[CUSTOMER-REFERRAL-FIRST-BOOKING] Missing bookingId', { eventId });
    return;
  }

  const bookingRes = await query(
    `SELECT id, customer_id, status FROM bookings WHERE id = $1`,
    [bookingId]
  );
  const booking = bookingRes.rows?.[0] as { id: string; customer_id: string; status?: string } | undefined;
  if (!booking?.customer_id) {
    console.warn('[CUSTOMER-REFERRAL-FIRST-BOOKING] Booking not found or no customer_id', { eventId, bookingId });
    return;
  }

  const refereeId = booking.customer_id as string;
  if (entityCustomerId && entityCustomerId !== refereeId) {
    console.warn('[CUSTOMER-REFERRAL-FIRST-BOOKING] Entity id does not match booking customer', {
      eventId,
      entityCustomerId,
      refereeId,
    });
    return;
  }

  const refRows = await select('customers', { id: refereeId });
  if (!refRows.length) {
    console.warn('[CUSTOMER-REFERRAL-FIRST-BOOKING] Customer not found', { eventId, refereeId });
    return;
  }

  const fromRedemption = await query(
    `SELECT rr.id AS redemption_id, r.id AS referral_id, r.referrer_id, r.referral_code
     FROM referral_redemptions rr
     INNER JOIN referrals r ON r.id = rr.referral_id
     WHERE rr.referred_id = $1
     LIMIT 1`,
    [refereeId]
  );

  let referralId: string;
  let referrerId: string;
  let referralCode: string;
  let redemptionId: string | null = null;

  if (fromRedemption.rows.length > 0) {
    const row = fromRedemption.rows[0] as {
      redemption_id: string;
      referral_id: string;
      referrer_id: string;
      referral_code: string;
    };
    redemptionId = row.redemption_id;
    referralId = row.referral_id;
    referrerId = row.referrer_id;
    referralCode = row.referral_code;
  } else {
    const leg = await query(
      `SELECT id, referrer_id, referral_code, referred_id FROM referrals WHERE referred_id = $1 LIMIT 1`,
      [refereeId]
    );
    if (leg.rows.length === 0) {
      console.info('[CUSTOMER-REFERRAL-FIRST-BOOKING] No peer referral link for customer', { eventId, refereeId });
      return;
    }
    const referral = leg.rows[0] as {
      id: string;
      referrer_id: string;
      referral_code: string;
      referred_id: string;
    };
    referralId = referral.id;
    referrerId = referral.referrer_id;
    referralCode = referral.referral_code;
    if (!referrerId || referrerId === referral.referred_id) {
      console.warn('[CUSTOMER-REFERRAL-FIRST-BOOKING] Invalid referrer', { eventId, referralId: referral.id });
      return;
    }
  }

  if (!referrerId || referrerId === refereeId) {
    console.warn('[CUSTOMER-REFERRAL-FIRST-BOOKING] Invalid referrer_id', { eventId, referralId });
    return;
  }

  const referrerRows = await select('customers', { id: referrerId });
  if (!referrerRows.length) {
    console.warn('[CUSTOMER-REFERRAL-FIRST-BOOKING] Referrer not found', { eventId, referrerId });
    return;
  }

  const dup = await query(
    `SELECT 1 FROM loyalty_transactions
     WHERE customer_id = $1
       AND transaction_type = 'earned'
       AND reference_type = 'customer_referral'
       AND reference_id = $2
     LIMIT 1`,
    [referrerId, refereeId]
  );
  if (dup.rows.length > 0) {
    console.info('[CUSTOMER-REFERRAL-FIRST-BOOKING] Referrer already awarded for this friend', {
      eventId,
      referrerId,
      refereeId,
    });
    return;
  }

  const result = await loyaltyPointsService.awardPoints({
    customerId: referrerId,
    actionName: 'customer_referral',
    referenceType: 'customer_referral',
    referenceId: refereeId,
    description: 'Referral reward — friend booked first appointment',
    metadata: {
      eventId,
      referralsId: referralId,
      redemptionId,
      referrerId,
      referredId: refereeId,
      referralCode,
      bookingId,
    },
  });

  console.info('[CUSTOMER-REFERRAL-FIRST-BOOKING] Award result (referrer)', {
    eventId,
    referrerId,
    refereeId,
    bookingId,
    points: result.points,
    walletCredited: result.walletCredited,
  });
}

export interface CustomerReferralVendorApprovalRewardParams {
  eventId: string;
  applicationId?: string;
  /** Approved vendor (referred party) who used the customer's WARM code */
  vendorId?: string;
}

/**
 * Award the **customer referrer** when a referred vendor is approved by admin (`customer_referral` +
 * `reference.type === 'vendor_application_approval'`). Requires `referrals.referred_vendor_id` set
 * (linked at admin approval or activation via `linkVendorOnboardingReferralsFromIdentityMetadata`).
 * Dedupes on `loyalty_transactions` using `reference_id` = `referrals.id`.
 */
export async function processCustomerReferralVendorApprovalReward(
  params: CustomerReferralVendorApprovalRewardParams
): Promise<void> {
  const { eventId, vendorId } = params;
  if (!vendorId) {
    console.warn('[CUSTOMER-REFERRAL-VENDOR-APPROVAL] Missing vendorId', { eventId });
    return;
  }

  const refRes = await query(
    `SELECT id, referrer_id, referral_code, referred_vendor_id
     FROM referrals
     WHERE referred_vendor_id = $1
     LIMIT 1`,
    [vendorId]
  );
  const referral = refRes.rows?.[0] as
    | {
        id: string;
        referrer_id: string;
        referral_code: string;
        referred_vendor_id: string;
      }
    | undefined;

  if (!referral?.referrer_id) {
    console.info('[CUSTOMER-REFERRAL-VENDOR-APPROVAL] No customer→vendor referral for vendor', {
      eventId,
      vendorId,
    });
    return;
  }

  const referrerId = referral.referrer_id;
  const referrerRows = await select('customers', { id: referrerId });
  if (!referrerRows.length) {
    console.warn('[CUSTOMER-REFERRAL-VENDOR-APPROVAL] Referrer customer not found', { eventId, referrerId });
    return;
  }

  const dup = await query(
    `SELECT 1 FROM loyalty_transactions
     WHERE customer_id = $1
       AND transaction_type = 'earned'
       AND reference_type = 'customer_referral'
       AND reference_id = $2
     LIMIT 1`,
    [referrerId, referral.id]
  );
  if (dup.rows.length > 0) {
    console.info('[CUSTOMER-REFERRAL-VENDOR-APPROVAL] Referrer already awarded for this referral row', {
      eventId,
      referrerId,
      referralId: referral.id,
    });
    return;
  }

  const result = await loyaltyPointsService.awardPoints({
    customerId: referrerId,
    actionName: 'customer_referral',
    referenceType: 'customer_referral',
    referenceId: referral.id,
    description: 'Referral reward — referred vendor approved',
    metadata: {
      eventId,
      referralsId: referral.id,
      referredVendorId: vendorId,
      referralCode: referral.referral_code,
      channel: 'vendor_application_approval',
    },
  });

  console.info('[CUSTOMER-REFERRAL-VENDOR-APPROVAL] Awarded referrer', {
    eventId,
    referrerId,
    referralId: referral.id,
    vendorId,
    points: result.points,
    walletCredited: result.walletCredited,
  });
}

/**
 * Handle vendor reward when a referred customer completes booking flow.
 * Invoked by loyalty consumer for action: vendor_refer_friend_who_joins (booking reference).
 */
export async function processVendorReferralFirstBookingRewardVendorToCustomer(
  params: VendorReferralFirstBookingRewardParams
): Promise<void> {
  const { eventId, bookingId } = params;

  if (!bookingId) {
    console.warn('[VENDOR-REFERRAL-FIRST-BOOKING] Missing bookingId, skipping', { eventId });
    return;
  }

  // 1) Resolve booking with customer/vendor context
  const bookingRes = await query(
    `SELECT id, vendor_id, customer_id, status FROM bookings WHERE id = $1`,
    [bookingId]
  );
  const booking = bookingRes.rows?.[0];
  if (!booking || !booking.customer_id || !booking.vendor_id) {
    console.warn('[VENDOR-REFERRAL-FIRST-BOOKING] Booking missing customer/vendor context, skipping', {
      eventId,
      bookingId,
    });
    return;
  }

  const referredCustomerId = booking.customer_id as string;
  const bookingVendorId = booking.vendor_id as string;

  // 2) Resolve referral owner from customer_referrals (vendor -> customer flow)
  const referralRes = await query(
    `SELECT id, referrer_vendor_id, referred_customer_id, referred_phone, referral_code, status
     FROM customer_referrals
     WHERE referred_customer_id = $1
       AND referrer_vendor_id IS NOT NULL
     ORDER BY approved_at DESC NULLS LAST, applied_at DESC NULLS LAST, created_at DESC, updated_at DESC
     LIMIT 1`,
    [referredCustomerId]
  );
  const referral = referralRes.rows?.[0];
  if (!referral || !referral.referrer_vendor_id) {
    console.warn('[VENDOR-REFERRAL-FIRST-BOOKING] Referral not found for referred customer, skipping', {
      eventId,
      referredCustomerId,
      bookingVendorId,
    });
    return;
  }

  // 3) Qualification: referred customer must have at least one booking with this vendor
  const completedCountRes = await query(
    `SELECT COUNT(*)::int AS cnt
     FROM bookings
     WHERE customer_id = $1
       AND vendor_id = $2
       AND status IN ('confirmed', 'completed')`,
    [referredCustomerId, bookingVendorId]
  );
  const completedCount = parseInt(completedCountRes.rows?.[0]?.cnt || '0', 10);
  if (completedCount <= 0) {
    console.info('[VENDOR-REFERRAL-FIRST-BOOKING] Referred customer has no qualifying bookings yet, skipping', {
      eventId,
      referredCustomerId,
      bookingVendorId,
    });
    return;
  }

  // 4) Idempotency: one reward per referral record
  const existingTxn = await query(
    `SELECT 1 FROM loyalty_transactions
     WHERE vendor_id = $1
       AND reference_type = 'customer_referral'
       AND reference_id = $2  
     LIMIT 1`,
    [referral.referrer_vendor_id, referral.id]
  );
  if ((existingTxn as any).rowCount > 0) {
    console.info('[VENDOR-REFERRAL-FIRST-BOOKING] Points already awarded for referral, skipping', {
      eventId,
      referralId: referral.id,
    });
    // Retries / duplicate events skip award but must still align vendor_referrals (first attempt may have stopped after customer_referrals).
    await query(
      `UPDATE customer_referrals
       SET status = 'approved',
           approved_at = COALESCE(approved_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [referral.id]
    ).catch(() => undefined);
    await syncVendorReferralsRowAfterCustomerReferralReward({
      eventId,
      customerReferralRowId: referral.id,
    });
    return;
  }

  // 5) Award points to referrer vendor using rule engine.
  // Keep recipient explicit so this path can never drift to customer-wallet flow.
  const referrerVendorId = referral.referrer_vendor_id as string;
  const result = await loyaltyPointsService.awardPoints({
    customerId: undefined,
    vendorId: referrerVendorId,
    actionName: 'vendor_refer_friend_who_joins',
    referenceType: 'customer_referral',
    referenceId: referral.id,
    description: `Referral reward: referred customer completed booking ${bookingId}`,
    metadata: {
      reward_recipient_type: 'vendor',
      referredCustomerId,
      bookingVendorId,
      bookingId,
    },
  });

  console.info('[VENDOR-REFERRAL-FIRST-BOOKING] Awarded referral reward', {
    eventId,
    referrerVendorId,
    referralId: referral.id,
    points: result.points,
    walletCredited: result.walletCredited,
  });

  // 6) Mark customer_referrals approved (idempotent update)
  await query(
    `UPDATE customer_referrals
     SET status = 'approved',
         approved_at = COALESCE(approved_at, NOW()),
         updated_at = NOW()
     WHERE id = $1`,
    [referral.id]
  ).catch(() => undefined);

  // 7) Keep vendor_referrals in sync for vendor-app list (same phone rows stay pending otherwise).
  await syncVendorReferralsRowAfterCustomerReferralReward({
    eventId,
    customerReferralRowId: referral.id,
  });
}

// Backward compatibility for any stale imports.
export const processVendorReferralFirstBookingReward =
  processVendorReferralFirstBookingRewardVendorToCustomer;
export const processVendorReferralFirstBookingRewardCustomer =
  processVendorReferralFirstBookingRewardVendorToCustomer;

/**
 * Handle vendor referral reward when referred vendor is approved (no booking required).
 * Invoked by the loyalty consumer for action:
 * vendor_refer_friend_who_joins with reference_type='vendor_application_approval'
 */
export async function processVendorReferralApprovalReward(
  params: VendorReferralApprovalRewardParams
): Promise<void> {
  const { eventId, applicationId, vendorId } = params;
  // Strict: referred vendor must be provided by event.vendorId (the vendor who used the referral code)
  const referredVendorId: string | null = vendorId || null;
  if (!referredVendorId) {
    console.info('[VENDOR-REFERRAL-APPROVAL] Missing vendorId for referred vendor; skipping', {
      eventId,
      applicationId,
      vendorId,
    });
    return;
  }

  // Resolve referral owner (referrer vendor)
  const referralRes = await query(
    `SELECT id, referrer_vendor_id
     FROM vendor_referrals
     WHERE referred_vendor_id = $1
     ORDER BY approved_at DESC NULLS LAST, applied_at DESC NULLS LAST, created_at DESC
     LIMIT 1`,
    [referredVendorId]
  );
  const referral = referralRes.rows?.[0];
  if (!referral?.referrer_vendor_id) {
    console.info('[VENDOR-REFERRAL-APPROVAL] No referral record for referred vendor', {
      eventId,
      referredVendorId,
    });
    return;
  }

  // Ensure referral is marked approved prior to awarding (idempotent update)
  try {
    await query(
      `UPDATE vendor_referrals
       SET status = 'approved',
           approved_at = COALESCE(approved_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [referral.id]
    );
    console.info('[VENDOR-REFERRAL-APPROVAL] Ensured referral marked approved', {
      eventId,
      referralId: referral.id,
    });
  } catch (approveErr: any) {
    // Do not fail the award if this housekeeping update races or is blocked; proceed to idempotent award
    console.info('[VENDOR-REFERRAL-APPROVAL] Non-fatal: could not update referral to approved', {
      eventId,
      referralId: referral.id,
      error: String(approveErr?.message || approveErr),
    });
  }

  // Idempotency: one reward per referral record
  const existing = await query(
    `SELECT 1 FROM loyalty_transactions
     WHERE vendor_id = $1
       AND reference_type = 'vendor_referral'
       AND reference_id = $2
     LIMIT 1`,
    [referral.referrer_vendor_id, referral.id]
  );
  if ((existing as any).rowCount > 0) {
    console.info('[VENDOR-REFERRAL-APPROVAL] Reward already issued', {
      eventId,
      referralId: referral.id,
    });
    return;
  }

  // Award points to referrer vendor
  const result = await loyaltyPointsService.awardPoints({
    vendorId: referral.referrer_vendor_id,
    actionName: 'vendor_refer_friend_who_joins',
    referenceType: 'vendor_referral',
    referenceId: referral.id,
    description: `Referral reward: referred vendor approved (application ${applicationId})`,
  });

  console.info('[VENDOR-REFERRAL-APPROVAL] Awarded referral reward', {
    eventId,
    referrerVendorId: referral.referrer_vendor_id,
    referralId: referral.id,
    points: result.points,
    walletCredited: result.walletCredited,
  });
}

/**
 * Customer signup with a vendor-issued referral code (e.g. VENDOR…).
 * Ensures vendor_referrals row for the phone and customer_referrals with referrer_vendor_id (after migration 620).
 */
export async function processVendorReferralForCustomerSignup(params: {
  customerId: string;
  phone: string;
  referralCode: string;
}): Promise<ProcessReferralSignupResult> {
  const { customerId, referralCode, phone } = params;

  try {
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
    const normalizedCode = referralCode.trim().toUpperCase();
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return { success: false, error: 'Invalid phone for referral' };
    }

    let referralRecords = await query(
      `SELECT * FROM vendor_referrals 
       WHERE referral_code = $1 AND referred_phone = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [normalizedCode, normalizedPhone]
    );

    let referralRecord = referralRecords.rows[0];

    if (!referralRecord) {
      const codeRecords = await query(
        `SELECT * FROM vendor_referrals 
         WHERE referral_code = $1 
         AND referrer_vendor_id IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [normalizedCode]
      );

      if (codeRecords.rows.length > 0) {
        const newReferral = await insert('vendor_referrals', {
          referrer_vendor_id: codeRecords.rows[0].referrer_vendor_id,
          referred_phone: normalizedPhone,
          referral_code: normalizedCode,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        referralRecord = newReferral[0];
        console.log(`[VENDOR-REFERRAL-CUSTOMER] Created vendor_referrals row for customer phone ${normalizedPhone}`);
      }
    }

    if (!referralRecord?.referrer_vendor_id) {
      return { success: false, error: 'Invalid referral code' };
    }

    const now = new Date().toISOString();

    try {
      const existing = await query(
        `SELECT id FROM customer_referrals 
         WHERE referred_customer_id = $1
            OR (referrer_vendor_id = $2 AND referred_phone = $3)`,
        [customerId, referralRecord.referrer_vendor_id, normalizedPhone]
      );

      if (existing.rows.length > 0) {
        await query(
          `UPDATE customer_referrals
           SET referred_customer_id = $1,
               referral_code = $2,
               status = 'applied',
               applied_at = COALESCE(applied_at, NOW()),
               updated_at = NOW()
           WHERE id = $3`,
          [customerId, normalizedCode, existing.rows[0].id]
        );
      } else {
        await insert('customer_referrals', {
          referrer_vendor_id: referralRecord.referrer_vendor_id,
          referrer_customer_id: null,
          referred_customer_id: customerId,
          referred_phone: normalizedPhone,
          referral_code: normalizedCode,
          status: 'applied',
          applied_at: now,
          created_at: now,
          updated_at: now,
        });
      }
      console.log('[VENDOR-REFERRAL-CUSTOMER] ✅ customer_referrals updated for vendor referral');
    } catch (crErr: any) {
      const msg = String(crErr?.message || crErr);
      if (msg.includes('referrer_vendor_id') || msg.includes('customer_referrals') || msg.includes('null value') || msg.includes('violates')) {
        console.warn('[VENDOR-REFERRAL-CUSTOMER] customer_referrals not updated (run migration 620?):', msg);
      } else {
        throw crErr;
      }
    }

    return { success: true, referredPoints: 0, referrerPoints: 0 };
  } catch (error: any) {
    console.error('[VENDOR-REFERRAL-CUSTOMER] ❌', error);
    return { success: false, error: error.message || 'Failed to process vendor referral for customer' };
  }
}

// ---------------------------------------------------------------------------
// Loyalty consumer: actionName === "qualifying_purchase" (Razorpay payment ref, etc.)
// ---------------------------------------------------------------------------

export type LoyaltyActionOccurredQualifyingPurchaseEvent = {
  actionName: 'qualifying_purchase';
  entity: { type: 'customer' | 'vendor' | 'auto'; id: string };
  amount?: number;
  reference?: { type: string; id?: string };
  metadata?: Record<string, any>;
};

/**
 * qualifying_purchase: 1) rule + base points, 2) in one transaction — profile upsert, purchase # / every-3rd 2× bump, 3) commit earn.
 */
export async function processLoyaltyActionOccurredForQualifyingPurchase(
  evt: LoyaltyActionOccurredQualifyingPurchaseEvent
): Promise<{ points: number; walletCredited: number }> {
  const customerId = evt.entity.type === 'vendor' ? undefined : evt.entity.id;
  const vendorId = evt.entity.type === 'vendor' ? evt.entity.id : undefined;
  const params: AwardPointsParams = {
    customerId,
    vendorId,
    actionName: 'qualifying_purchase',
    amount: evt.amount,
    referenceType: evt.reference?.type,
    referenceId: evt.reference?.id,
    description: `Action ${evt.actionName}`,
    metadata: evt.metadata || {},
  };

  const prep = await loyaltyPointsService.preparePointsAward(params);
  if (!prep) {
    return { points: 0, walletCredited: 0 };
  }

  const awardResult = await withTransaction(async (client) => {
    const userId = customerId || vendorId;
    if (!userId) {
      throw new Error('customerId or vendorId is required for qualifying_purchase');
    }
    const isVendor = !!vendorId && !customerId;

    await client.query(
      `INSERT INTO customer_loyalty_points (customer_id, total_points, lifetime_points_earned, lifetime_points_redeemed)
       VALUES ($1, 0, 0, 0)
       ON CONFLICT (customer_id) DO NOTHING`,
      [userId]
    );

    let finalPoints = prep.pointsAfterRuleMultipliers;
    let descExtra = '';
    if (customerId && !isVendor) {
      const streak = await bumpQualifyingPurchaseStreakAndApplyThirdBonus(
        client,
        customerId,
        prep.pointsAfterRuleMultipliers
      );
      finalPoints = streak.finalPoints;
      if (streak.doubled) {
        descExtra = ` — 2x every 3rd purchase (#${streak.purchaseIndex})`;
      }
    }

    const fullDescription = `${params.description || `Action ${params.actionName}`}${descExtra}`;
    return loyaltyPointsService.commitEarnedPointsInTransaction(client, params, {
      finalPoints,
      description: fullDescription,
      walletPolicy: prep.walletPolicy,
    });
  });

  if (awardResult.points > 0) {
    await loyaltyPointsService.sendPointsEarnedNotification(params, awardResult.points);
  }
  return awardResult;
}

// ---------------------------------------------------------------------------
// Qualifying purchase streak (3rd / 6th / 9th → 2× on that earn)
// Invoked from processLoyaltyActionOccurredForQualifyingPurchase in the same transaction.
// ---------------------------------------------------------------------------

export type QualifyingPurchaseLoyaltyTxClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

/**
 * Bumps `customer_loyalty_points.qualifying_purchase_count` under row lock; every 3rd award gets 2× base points.
 */
export async function bumpQualifyingPurchaseStreakAndApplyThirdBonus(
  client: QualifyingPurchaseLoyaltyTxClient,
  customerId: string,
  basePointsAfterRuleMultipliers: number
): Promise<{ finalPoints: number; purchaseIndex: number; doubled: boolean }> {
  await client.query(
    `INSERT INTO customer_loyalty_points (customer_id, total_points, lifetime_points_earned, lifetime_points_redeemed, qualifying_purchase_count)
     VALUES ($1, 0, 0, 0, 0)
     ON CONFLICT (customer_id) DO NOTHING`,
    [customerId]
  );
  const lockRes = await client.query(
    `SELECT qualifying_purchase_count FROM customer_loyalty_points WHERE customer_id = $1 FOR UPDATE`,
    [customerId]
  );
  const row = lockRes.rows[0] as { qualifying_purchase_count?: number | string } | undefined;
  const current = Math.max(0, parseInt(String(row?.qualifying_purchase_count ?? '0'), 10) || 0);
  const newCount = current + 1;
  const doubled = newCount % 3 === 0;
  const mult = doubled ? 2 : 1;
  const finalPoints = Math.floor(basePointsAfterRuleMultipliers * mult);
  await client.query(
    `UPDATE customer_loyalty_points SET qualifying_purchase_count = $1, updated_at = NOW() WHERE customer_id = $2`,
    [newCount, customerId]
  );
  return { finalPoints, purchaseIndex: newCount, doubled };
}