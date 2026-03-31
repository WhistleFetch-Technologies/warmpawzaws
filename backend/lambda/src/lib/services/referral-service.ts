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
  phone?: string; // Phone number for vendor referrals
}

export interface ProcessReferralSignupResult {
  success: boolean;
  referredPoints?: number;
  referrerPoints?: number;
  error?: string;
}

/**
 * Process referral code during user signup
 * Awards points to both referred user and referrer using loyalty service
 */
export async function processReferralSignup(
  params: ProcessReferralSignupParams
): Promise<ProcessReferralSignupResult> {
  const { customerId, referralCode } = params;

  try {
    // Ensure loyalty rules exist and verify they were created
    const rulesInit = await loyaltyRulesInitService.initializeReferralRules();
    if (!rulesInit.referralSignup || !rulesInit.referFriend) {
      console.error(`[REFERRAL] ❌ CRITICAL: Loyalty rules not initialized! referralSignup=${rulesInit.referralSignup}, referFriend=${rulesInit.referFriend}`);
      return {
        success: false,
        error: 'Loyalty rules not initialized. Please contact support.',
      };
    }
    console.log(`[REFERRAL] ✅ Loyalty rules verified: referralSignup=${rulesInit.referralSignup}, referFriend=${rulesInit.referFriend}`);

    // 1. Find referral by code (normalize code first)
    const normalizedCode = referralCode.trim().toUpperCase();
    console.log(`[REFERRAL] Looking up referral code: ${normalizedCode} (original: ${referralCode})`);
    
    let referrals = await select('referrals', { referral_code: normalizedCode });
    if (referrals.length === 0) {
      // Try case-insensitive lookup as fallback
      const caseInsensitiveResult = await query(
        `SELECT * FROM referrals WHERE UPPER(referral_code) = $1 LIMIT 1`,
        [normalizedCode]
      );
      
      if (caseInsensitiveResult.rows.length === 0) {
        console.log(`[REFERRAL] ❌ Invalid referral code: ${normalizedCode}`);
      return {
        success: false,
        error: 'Invalid referral code',
      };
      } else {
        console.log(`[REFERRAL] ⚠️ Found referral code with case-insensitive lookup (should normalize in database)`);
        referrals = caseInsensitiveResult.rows;
      }
    }

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

    // 5. Award points to referred user (500 points via referral_signup rule)
    let referredPoints = 0;
    try {
      const referredResult = await loyaltyPointsService.awardPoints({
        customerId: customerId,
        actionName: 'referral_signup',
        referenceType: 'referral',
        referenceId: referral.id,
        description: 'Signup bonus via referral code',
      });
      referredPoints = referredResult.points;
      console.log(`[REFERRAL] ✅ Awarded ${referredPoints} points to referred user ${customerId}`);
    } catch (pointsError: any) {
      console.error(`[REFERRAL] Error awarding points to referred user:`, pointsError);
      // Continue even if points fail - we'll still update the referral record
    }

    // 6. Award points to referrer (via refer_friend rule) - CRITICAL: Must succeed
    let referrerPoints = 0;
    let referrerPointsAttempts = 0;
    const maxRetries = 2;
    
    while (referrerPoints === 0 && referrerPointsAttempts < maxRetries) {
      referrerPointsAttempts++;
    try {
        console.log(`[REFERRAL] Attempting to award referrer points (attempt ${referrerPointsAttempts}/${maxRetries})...`);
      const referrerResult = await loyaltyPointsService.awardPoints({
        customerId: referral.referrer_id,
        actionName: 'refer_friend',
        referenceType: 'referral',
        referenceId: referral.id,
        description: 'Referral reward for friend signup',
      });
      referrerPoints = referrerResult.points;
        
        if (referrerPoints > 0) {
      console.log(`[REFERRAL] ✅ Awarded ${referrerPoints} points to referrer ${referral.referrer_id}`);
          break;
        } else {
          console.warn(`[REFERRAL] ⚠️ Points awarding returned 0 points. Rule might not exist or frequency limit reached.`);
          if (referrerPointsAttempts < maxRetries) {
            console.log(`[REFERRAL] Retrying in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
    } catch (pointsError: any) {
        console.error(`[REFERRAL] ❌ Error awarding points to referrer (attempt ${referrerPointsAttempts}):`, pointsError);
        console.error(`[REFERRAL] Error details:`, {
          message: pointsError.message,
          stack: pointsError.stack,
          referrer_id: referral.referrer_id,
          referral_id: referral.id,
        });
        
        if (referrerPointsAttempts < maxRetries) {
          console.log(`[REFERRAL] Retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (referrerPoints === 0) {
      console.error(`[REFERRAL] ❌ CRITICAL: Failed to award referrer points after ${maxRetries} attempts!`);
    }

    // 7. Update referral record (ALWAYS update, even if points failed)
    const updateResult = await query(
      `UPDATE referrals
       SET referred_id = $1,
           referred_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [customerId, referral.id]
    );

    if (updateResult.rows.length === 0) {
      console.error(`[REFERRAL] ⚠️ Failed to update referral record ${referral.id} with referred_id ${customerId}`);
    } else {
      console.log(`[REFERRAL] ✅ Updated referral record ${referral.id} with referred_id ${customerId}`);
    }

    // CRITICAL: Only return success if points were actually awarded
    // If referrer points failed, this is a critical failure
    if (referrerPoints === 0) {
      console.error(`[REFERRAL] ❌ CRITICAL: Referrer points were not awarded! referrer_id=${referral.referrer_id}, referral_id=${referral.id}`);
      return {
        success: false,
        error: 'Failed to award points to referrer. Please check loyalty rules and try again.',
        referredPoints,
        referrerPoints: 0,
      };
    }

    // If referred points failed but referrer points succeeded, log warning but continue
    if (referredPoints === 0) {
      console.warn(`[REFERRAL] ⚠️ WARNING: Referred user points were not awarded, but referrer points succeeded`);
    }

    console.log(`[REFERRAL] ✅ Successfully processed referral signup for customer ${customerId} with code ${referralCode}`);
    console.log(`[REFERRAL] Points awarded - Referred: ${referredPoints}pts, Referrer: ${referrerPoints}pts`);

    return {
      success: true,
      referredPoints,
      referrerPoints,
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
        referralRecords = { rows: Array.isArray(newReferral) ? newReferral : [newReferral] };
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

    // 5. Award points to referrer vendor immediately (vendor_refer_friend rule)
    let referrerPoints = 0;
    try {
      const { loyaltyPointsService } = await import('./loyalty&reward/loyalty-points-service');
      const pointsResult = await loyaltyPointsService.awardPoints({
        vendorId: referralRecord.referrer_vendor_id,
        actionName: 'vendor_refer_friend',
        referenceType: 'vendor_referral',
        referenceId: referralRecord.id,
        description: `Vendor referral: New vendor registered with code ${normalizedCode}`,
      });

      referrerPoints = pointsResult.points;
      console.log(`[VENDOR-REFERRAL] ✅ Awarded ${referrerPoints} points to referrer vendor ${referralRecord.referrer_vendor_id}`);
      console.log(`[VENDOR-REFERRAL] Wallet credited: ₹${pointsResult.walletCredited}`);

      // Update referral status to 'approved' since points are awarded immediately
      await query(
        `UPDATE vendor_referrals
         SET status = 'approved',
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [referralRecord.id]
      );
      console.log(`[VENDOR-REFERRAL] ✅ Updated referral record status to 'approved'`);
    } catch (pointsError: any) {
      console.error(`[VENDOR-REFERRAL] ❌ Error awarding referral points: ${pointsError.message}`);
      console.error(`[VENDOR-REFERRAL] Error stack: ${pointsError.stack}`);
      // Don't fail - referral record is already updated
    }

    console.log(`[VENDOR-REFERRAL] ✅ Successfully processed vendor referral for vendor ${vendorId} with code ${normalizedCode}`);

    return {
      success: true,
      referrerPoints,
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
 * Customer signup/login with a vendor referral code (e.g. VENDOR…): vendor_referrals + customer_referrals.
 */
export async function processVendorReferralForCustomerSignup(params: {
  customerId: string;
  phone: string;
  referralCode: string;
}): Promise<ProcessReferralSignupResult> {
  const { customerId, phone, referralCode } = params;
  try {
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
    if (normalizedPhone.length < 10) {
      return { success: false, error: 'Invalid phone number' };
    }
    const normalizedCode = referralCode.trim().toUpperCase();

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
      if (codeRecords.rows.length === 0) {
        return { success: false, error: 'Invalid referral code' };
      }
      const newReferral = await insert('vendor_referrals', {
        referrer_vendor_id: codeRecords.rows[0].referrer_vendor_id,
        referred_phone: normalizedPhone,
        referral_code: normalizedCode,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      referralRecord = newReferral[0];
    }

    const referrerVendorId = referralRecord.referrer_vendor_id;
    if (!referrerVendorId) {
      return { success: false, error: 'Invalid referral code' };
    }

    const now = new Date().toISOString();
    try {
      const dup = await query(
        `SELECT id FROM customer_referrals 
         WHERE referrer_vendor_id = $1 AND referred_phone = $2 LIMIT 1`,
        [referrerVendorId, normalizedPhone]
      );
      if (dup.rows.length > 0) {
        await query(
          `UPDATE customer_referrals
           SET referred_customer_id = $1,
               referral_code = $2,
               status = 'approved',
               applied_at = COALESCE(applied_at, NOW()),
               approved_at = COALESCE(approved_at, NOW()),
               updated_at = NOW()
           WHERE id = $3`,
          [customerId, normalizedCode, dup.rows[0].id]
        );
      } else {
        await insert('customer_referrals', {
          referrer_vendor_id: referrerVendorId,
          referred_customer_id: customerId,
          referred_phone: normalizedPhone,
          referral_code: normalizedCode,
          status: 'approved',
          applied_at: now,
          approved_at: now,
          created_at: now,
          updated_at: now,
        });
      }
    } catch (crErr: any) {
      console.warn('[VENDOR-REFERRAL-CUSTOMER] customer_referrals upsert:', crErr?.message || crErr);
    }

    console.log(
      `[VENDOR-REFERRAL-CUSTOMER] ✅ customer ${customerId} linked to vendor ${referrerVendorId} code ${normalizedCode}`
    );
    return { success: true };
  } catch (error: any) {
    console.error('[VENDOR-REFERRAL-CUSTOMER]', error);
    return {
      success: false,
      error: error.message || 'Failed to process vendor referral for customer',
    };
  }
}
