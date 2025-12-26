/**
 * ============================================================================
 * REFERRAL SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - Uses `referrals` table for referral codes and tracking
 * - Uses `customer_wallets` and `wallet_transactions` for rewards
 * - Uses `customers` table for customer data
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL
 * KV Operations Removed: 24
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getReferralsRepository } from '../../lib/repositories/referrals.ts';
import { getWalletsRepository } from '../../lib/repositories/wallets.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
app.use('*', cors());

// Referral rewards configuration
const REFERRAL_REWARDS = {
  REFEREE_WALLET_CREDIT: 100, // ₹100 for new user
  REFERRER_WALLET_CREDIT: 50, // ₹50 for referrer
  REFEREE_MIN_BOOKING_AMOUNT: 300, // Referee must book ₹300+ to unlock rewards
  REFERRER_MAX_REFERRALS_PER_MONTH: 50 // Max 50 referrals per month to prevent abuse
};

// Helper: Generate unique referral code
function generateReferralCode(name: string, customerId: string) {
  // Create code from first 3 letters of name + random 4 chars
  const namePrefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePrefix}${randomSuffix}`;
}

// Helper: Generate referral ID
function generateReferralId() {
  return `referral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==========================================================================
// CREATE REFERRAL CODE
// ==========================================================================

/**
 * POST /referrals/:customerId/create-code
 * Generate unique referral code for customer
 */
app.post('/referrals/:customerId/create-code', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    // ✅ SQL: Get customer
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // ✅ SQL: Check if code already exists
    const referralsRepo = getReferralsRepository();
    const existingReferral = await referralsRepo.findByReferrer(customerId);
    if (existingReferral) {
      return c.json({
        success: true,
        referralCode: existingReferral.referral_code,
        message: 'Referral code already exists'
      });
    }
    
    // Generate unique code
    let referralCode = generateReferralCode(customer.full_name || 'USER', customerId);
    let attempts = 0;
    
    // ✅ SQL: Ensure code is unique
    while (await referralsRepo.findByCode(referralCode) && attempts < 10) {
      referralCode = generateReferralCode(customer.full_name || 'USER', customerId);
      attempts++;
    }
    
    if (attempts >= 10) {
      return c.json({
        error: 'Unable to generate unique referral code',
        hint: 'Please try again'
      }, 500);
    }
    
    // ✅ SQL: Create referral record
    const referral = await referralsRepo.create({
      referrer_id: customerId,
      referral_code: referralCode
      // expires_at is optional, defaults to null
    });
    
    console.log(`🎁 Referral code created: ${referralCode} for customer ${customerId}`);
    
    return c.json({
      success: true,
      referralCode: referral.referral_code,
      rewards: {
        refereeGets: `₹${REFERRAL_REWARDS.REFEREE_WALLET_CREDIT} wallet credit`,
        referrerGets: `₹${REFERRAL_REWARDS.REFERRER_WALLET_CREDIT} wallet credit`
      },
      message: 'Referral code created successfully'
    });
    
  } catch (error) {
    console.error('Error creating referral code:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// APPLY REFERRAL CODE
// ==========================================================================

/**
 * POST /referrals/apply
 * Apply referral code during signup/first booking
 */
app.post('/referrals/apply', async (c) => {
  try {
    const { referralCode, refereeCustomerId, refereePhone } = await c.req.json();
    
    if (!referralCode || !refereeCustomerId) {
      return c.json({
        error: 'Missing required fields',
        required: ['referralCode', 'refereeCustomerId']
      }, 400);
    }
    
    // ✅ SQL: Validate referral code
    const referralsRepo = getReferralsRepository();
    const codeRecord = await referralsRepo.findByCode(referralCode.toUpperCase());
    if (!codeRecord) {
      return c.json({
        error: 'Invalid referral code',
        hint: 'Please check the code and try again'
      }, 400);
    }
    
    const referrerCustomerId = codeRecord.referrer_id;
    
    // Prevent self-referral
    if (referrerCustomerId === refereeCustomerId) {
      return c.json({
        error: 'Cannot use your own referral code',
        hint: 'Please ask a friend for their code'
      }, 400);
    }
    
    // ✅ SQL: Check if customer already used a referral code
    const existingReferral = await referralsRepo.findByReferred(refereeCustomerId);
    if (existingReferral && existingReferral.status !== 'expired') {
      return c.json({
        error: 'Referral code already applied',
        hint: 'You can only use one referral code per account'
      }, 400);
    }
    
    // ✅ SQL: Check monthly limit for referrer
    const dbClient = getDbClient();
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    const { data: monthlyReferrals } = await dbClient
      .from('referrals')
      .select('id')
      .eq('referrer_id', referrerCustomerId)
      .gte('created_at', `${currentMonth}-01`)
      .lt('created_at', `${currentMonth}-32`);
    
    const monthlyCount = monthlyReferrals?.length || 0;
    
    if (monthlyCount >= REFERRAL_REWARDS.REFERRER_MAX_REFERRALS_PER_MONTH) {
      return c.json({
        error: 'Referral limit exceeded',
        hint: 'This referral code has reached its monthly limit'
      }, 400);
    }
    
    // ✅ SQL: Create new referral record for this application
    // Note: The repository's applyReferral sets status to 'completed' immediately
    // We need to create a pending referral record instead
    const dbClient2 = getDbClient();
    const { data: newReferral, error: createError } = await dbClient2
      .from('referrals')
      .insert({
        referrer_id: referrerCustomerId,
        referred_id: refereeCustomerId,
        referral_code: referralCode.toUpperCase(),
        status: 'pending',
        reward_points: 0
      })
      .select()
      .single();
    
    if (createError) {
      throw new Error(`Failed to create referral record: ${createError.message}`);
    }
    
    // Map the referral data
    const referral = {
      id: newReferral.id,
      referrer_id: newReferral.referrer_id,
      referred_id: newReferral.referred_id,
      referral_code: newReferral.referral_code,
      status: newReferral.status,
      reward_points: newReferral.reward_points || 0,
      completed_at: newReferral.completed_at,
      expires_at: newReferral.expires_at,
      created_at: newReferral.created_at
    };
    
    console.log(`🎉 Referral applied: ${referralCode} by ${refereeCustomerId}`);
    
    return c.json({
      success: true,
      referralId: referral.id,
      message: `Referral code applied! Complete your first booking of ₹${REFERRAL_REWARDS.REFEREE_MIN_BOOKING_AMOUNT}+ to unlock ₹${REFERRAL_REWARDS.REFEREE_WALLET_CREDIT} wallet credit`,
      rewards: {
        pending: `₹${REFERRAL_REWARDS.REFEREE_WALLET_CREDIT} wallet credit`
      }
    });
    
  } catch (error) {
    console.error('Error applying referral code:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// COMPLETE REFERRAL (ON FIRST BOOKING)
// ==========================================================================

/**
 * POST /referrals/complete
 * Complete referral and give rewards after first booking
 */
app.post('/referrals/complete', async (c) => {
  try {
    const { bookingId, refereeCustomerId, bookingAmount } = await c.req.json();
    
    if (!bookingId || !refereeCustomerId || !bookingAmount) {
      return c.json({
        error: 'Missing required fields',
        required: ['bookingId', 'refereeCustomerId', 'bookingAmount']
      }, 400);
    }
    
    // ✅ SQL: Get referral record
    const referralsRepo = getReferralsRepository();
    const referral = await referralsRepo.findByReferred(refereeCustomerId);
    
    if (!referral) {
      // No referral applied, skip
      return c.json({
        success: true,
        message: 'No referral to complete'
      });
    }
    
    // Check if already completed
    if (referral.status === 'completed') {
      return c.json({
        success: true,
        message: 'Referral already completed'
      });
    }
    
    // Check minimum booking amount
    if (bookingAmount < REFERRAL_REWARDS.REFEREE_MIN_BOOKING_AMOUNT) {
      return c.json({
        success: true,
        message: `Booking amount must be ₹${REFERRAL_REWARDS.REFEREE_MIN_BOOKING_AMOUNT}+ to unlock referral rewards`,
        amountNeeded: REFERRAL_REWARDS.REFEREE_MIN_BOOKING_AMOUNT - bookingAmount
      });
    }
    
    // ✅ SQL: Give rewards using wallet repository
    const walletsRepo = getWalletsRepository();
    
    // 1. Referee reward (₹100 to new user)
    const refereeWallet = await walletsRepo.findOrCreate(refereeCustomerId);
    await walletsRepo.addTransaction({
      wallet_id: refereeWallet.id,
      customer_id: refereeCustomerId,
      transaction_type: 'credit',
      amount: REFERRAL_REWARDS.REFEREE_WALLET_CREDIT,
      source: 'referral',
      purpose: 'referee_bonus',
      description: `Referral bonus for completing first booking`,
      reference_id: bookingId
    });
    
    // 2. Referrer reward (₹50 to friend who referred)
    const referrerWallet = await walletsRepo.findOrCreate(referral.referrer_id);
    await walletsRepo.addTransaction({
      wallet_id: referrerWallet.id,
      customer_id: referral.referrer_id,
      transaction_type: 'credit',
      amount: REFERRAL_REWARDS.REFERRER_WALLET_CREDIT,
      source: 'referral',
      purpose: 'referrer_bonus',
      description: `Referral bonus for successful referral`,
      reference_id: referral.id
    });
    
    // ✅ SQL: Update referral record to completed
    await referralsRepo.awardRewards(referral.id, REFERRAL_REWARDS.REFERRER_WALLET_CREDIT);
    
    // Update status to completed
    const dbClient3 = getDbClient();
    await dbClient3
      .from('referrals')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', referral.id);
    
    console.log(`✅ Referral completed: ${referral.id}, Rewards given`);
    
    return c.json({
      success: true,
      referral: {
        id: referral.id,
        status: 'completed'
      },
      rewards: {
        refereeReceived: REFERRAL_REWARDS.REFEREE_WALLET_CREDIT,
        referrerReceived: REFERRAL_REWARDS.REFERRER_WALLET_CREDIT
      },
      message: `🎉 Referral bonus unlocked! ₹${REFERRAL_REWARDS.REFEREE_WALLET_CREDIT} added to your wallet`
    });
    
  } catch (error) {
    console.error('Error completing referral:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// GET REFERRAL STATS
// ==========================================================================

/**
 * GET /referrals/:customerId/stats
 * Get referral statistics for customer
 */
app.get('/referrals/:customerId/stats', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    // ✅ SQL: Get referral data
    const referralsRepo = getReferralsRepository();
    const referral = await referralsRepo.findByReferrer(customerId);
    
    if (!referral) {
      return c.json({
        success: true,
        hasReferralCode: false,
        message: 'Create your referral code to start earning'
      });
    }
    
    // ✅ SQL: Get referral statistics
    const dbClient4 = getDbClient();
    const { data: allReferrals } = await dbClient4
      .from('referrals')
      .select('*')
      .eq('referrer_id', customerId);
    
    const totalReferrals = allReferrals?.length || 0;
    const successfulReferrals = allReferrals?.filter((r: any) => r.status === 'completed').length || 0;
    const totalEarnings = allReferrals?.reduce((sum: number, r: any) => sum + (r.reward_points || 0), 0) || 0;
    
    return c.json({
      success: true,
      hasReferralCode: true,
      stats: {
        code: referral.referral_code,
        totalReferrals: totalReferrals,
        successfulReferrals: successfulReferrals,
        totalEarnings: totalEarnings,
        pendingReferrals: totalReferrals - successfulReferrals
      },
      rewards: {
        perReferral: REFERRAL_REWARDS.REFERRER_WALLET_CREDIT,
        refereeGets: REFERRAL_REWARDS.REFEREE_WALLET_CREDIT
      }
    });
    
  } catch (error) {
    console.error('Error fetching referral stats:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// REFERRAL LEADERBOARD
// ==========================================================================

/**
 * GET /referrals/leaderboard
 * Get top referrers leaderboard
 */
app.get('/referrals/leaderboard', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    
    // ✅ SQL: Get all referrals grouped by referrer
    const dbClient5 = getDbClient();
    const { data: referrals } = await dbClient5
      .from('referrals')
      .select('referrer_id, referral_code, status, reward_points')
      .eq('status', 'completed');
    
    // Group by referrer and calculate stats
    const referrerStats: Record<string, any> = {};
    
    for (const ref of referrals || []) {
      if (!referrerStats[ref.referrer_id]) {
        referrerStats[ref.referrer_id] = {
          code: ref.referral_code,
          successfulReferrals: 0,
          totalEarnings: 0
        };
      }
      referrerStats[ref.referrer_id].successfulReferrals += 1;
      referrerStats[ref.referrer_id].totalEarnings += ref.reward_points || 0;
    }
    
    // Convert to array and sort
    const leaderboard = Object.values(referrerStats)
      .sort((a: any, b: any) => b.successfulReferrals - a.successfulReferrals)
      .slice(0, limit)
      .map((ref: any, index: number) => ({
        rank: index + 1,
        code: ref.code,
        successfulReferrals: ref.successfulReferrals,
        totalEarnings: ref.totalEarnings
      }));
    
    return c.json({
      success: true,
      leaderboard
    });
    
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
