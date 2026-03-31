/**
 * Referral Service
 * 
 * Handles referral code processing during signup and point awarding
 * AWS Serverless compatible (Lambda, RDS)
 * 
 * Supports both customer-to-customer and vendor-to-vendor referrals
 */

import { select, query, update, insert } from '../../database/rds-connection';
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

export interface VendorReferralApprovalRewardParams {
  eventId: string;
  applicationId?: string;
  vendorId?: string;
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

/** Persist peer referral row in customer_referrals (in addition to referrals.referred_id). */
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

    // 3. Check if customer already used a referral code
    const existing = await query(
      'SELECT * FROM referrals WHERE referred_id = $1',
      [customerId]
    );

    if (existing.rows.length > 0) {
      console.log(`[REFERRAL] Customer ${customerId} already used a referral code`);
      return {
        success: false,
        error: 'Referral code already used',
      };
    }

    // 4. Check if this referral code was already used by someone else
    if (referral.referred_id) {
      console.log(`[REFERRAL] Referral code ${referralCode} was already used`);
      return {
        success: false,
        error: 'This referral code has already been used',
      };
    }

    // 5. Deprecated: Points are not awarded from endpoints/services. Action-source handles awards.
    let referredPoints = 0;

    // 6. Award points to referrer (via refer_friend rule) - CRITICAL: Must succeed
    let referrerPoints = 0;
    let referrerPointsAttempts = 0;
    const maxRetries = 2;
    
    // No direct awarding here; handled by consumer on appropriate ActionOccurred event
    
    // No awards attempted; keep record linking only

    // 7. Update referral record (RDS referrals table has no referred_at — use completed_at)
    const updateResult = await query(
      `UPDATE referrals
       SET referred_id = $1,
           completed_at = COALESCE(completed_at, NOW())
       WHERE id = $2
       RETURNING *`,
      [customerId, referral.id]
    );

    if (updateResult.rows.length === 0) {
      console.error(`[REFERRAL] ⚠️ Failed to update referral record ${referral.id} with referred_id ${customerId}`);
    } else {
      console.log(`[REFERRAL] ✅ Updated referral record ${referral.id} with referred_id ${customerId}`);
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
  const phoneDigits = String(referral.referred_phone || '')
    .replace(/\D/g, '')
    .slice(-10);
  if (phoneDigits.length >= 10) {
    await query(
      `UPDATE vendor_referrals
       SET status = 'approved',
           approved_at = COALESCE(approved_at, NOW()),
           updated_at = NOW()
       WHERE referrer_vendor_id = $1
         AND referred_phone = $2`,
      [referrerVendorId, phoneDigits]
    ).catch(() => undefined);
  }
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