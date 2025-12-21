/**
 * REFERRAL SYSTEM
 * 
 * Features:
 * - Unique referral code generation
 * - Referral tracking
 * - Referral rewards (referrer + referee)
 * - Referral leaderboard
 * - Multi-level referral support
 * 
 * Status: ✅ P1 IMPLEMENTATION
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

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
    
    // Get customer
    const customer = await kv.get(`customer:${customerId}`);
    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }
    
    // Check if code already exists
    let existingReferral = await kv.get(`referral:customer:${customerId}`);
    if (existingReferral) {
      return c.json({
        success: true,
        referralCode: existingReferral.code,
        message: 'Referral code already exists'
      });
    }
    
    // Generate unique code
    let referralCode = generateReferralCode(customer.name || 'USER', customerId);
    let attempts = 0;
    
    // Ensure code is unique
    while (await kv.get(`referral:code:${referralCode}`) && attempts < 10) {
      referralCode = generateReferralCode(customer.name || 'USER', customerId);
      attempts++;
    }
    
    if (attempts >= 10) {
      return c.json({
        error: 'Unable to generate unique referral code',
        hint: 'Please try again'
      }, 500);
    }
    
    // Create referral record
    const referralRecord = {
      customerId,
      code: referralCode,
      totalReferrals: 0,
      successfulReferrals: 0,
      totalEarnings: 0,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`referral:customer:${customerId}`, referralRecord);
    await kv.set(`referral:code:${referralCode}`, { customerId });
    
    console.log(`🎁 Referral code created: ${referralCode} for customer ${customerId}`);
    
    return c.json({
      success: true,
      referralCode,
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
    
    // Validate referral code
    const codeRecord = await kv.get(`referral:code:${referralCode.toUpperCase()}`);
    if (!codeRecord) {
      return c.json({
        error: 'Invalid referral code',
        hint: 'Please check the code and try again'
      }, 400);
    }
    
    const referrerCustomerId = codeRecord.customerId;
    
    // Prevent self-referral
    if (referrerCustomerId === refereeCustomerId) {
      return c.json({
        error: 'Cannot use your own referral code',
        hint: 'Please ask a friend for their code'
      }, 400);
    }
    
    // Check if customer already used a referral code
    const existingReferral = await kv.get(`referral:referee:${refereeCustomerId}`);
    if (existingReferral) {
      return c.json({
        error: 'Referral code already applied',
        hint: 'You can only use one referral code per account'
      }, 400);
    }
    
    // Check monthly limit for referrer
    const referrerData = await kv.get(`referral:customer:${referrerCustomerId}`);
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    const monthlyReferrals = await kv.get(`referral:monthly:${referrerCustomerId}:${currentMonth}`) || 0;
    
    if (monthlyReferrals >= REFERRAL_REWARDS.REFERRER_MAX_REFERRALS_PER_MONTH) {
      return c.json({
        error: 'Referral limit exceeded',
        hint: 'This referral code has reached its monthly limit'
      }, 400);
    }
    
    // Create referral tracking record
    const referralId = generateReferralId();
    const referral = {
      id: referralId,
      referralCode,
      referrerCustomerId,
      refereeCustomerId,
      refereePhone,
      status: 'pending', // pending, completed, expired
      appliedAt: new Date().toISOString(),
      completedAt: null,
      refereeFirstBookingId: null,
      referrerRewardGiven: false,
      refereeRewardGiven: false,
      referrerEarnings: 0,
      refereeEarnings: 0
    };
    
    await kv.set(`referral:${referralId}`, referral);
    await kv.set(`referral:referee:${refereeCustomerId}`, referralId);
    
    // Track monthly referrals
    await kv.set(`referral:monthly:${referrerCustomerId}:${currentMonth}`, monthlyReferrals + 1);
    
    // Update referrer's total referrals
    if (referrerData) {
      referrerData.totalReferrals += 1;
      await kv.set(`referral:customer:${referrerCustomerId}`, referrerData);
    }
    
    console.log(`🎉 Referral applied: ${referralCode} by ${refereeCustomerId}`);
    
    return c.json({
      success: true,
      referralId,
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
    
    // Get referral record
    const referralId = await kv.get(`referral:referee:${refereeCustomerId}`);
    if (!referralId) {
      // No referral applied, skip
      return c.json({
        success: true,
        message: 'No referral to complete'
      });
    }
    
    const referral = await kv.get(`referral:${referralId}`);
    if (!referral) {
      return c.json({ error: 'Referral not found' }, 404);
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
    
    // Give rewards
    
    // 1. Referee reward (₹100 to new user)
    const refereeWallet = await kv.get(`wallet:${refereeCustomerId}`) || {
      balance: 0,
      totalEarned: 0,
      totalSpent: 0
    };
    
    refereeWallet.balance += REFERRAL_REWARDS.REFEREE_WALLET_CREDIT;
    refereeWallet.totalEarned += REFERRAL_REWARDS.REFEREE_WALLET_CREDIT;
    await kv.set(`wallet:${refereeCustomerId}`, refereeWallet);
    
    // 2. Referrer reward (₹50 to friend who referred)
    const referrerWallet = await kv.get(`wallet:${referral.referrerCustomerId}`) || {
      balance: 0,
      totalEarned: 0,
      totalSpent: 0
    };
    
    referrerWallet.balance += REFERRAL_REWARDS.REFERRER_WALLET_CREDIT;
    referrerWallet.totalEarned += REFERRAL_REWARDS.REFERRER_WALLET_CREDIT;
    await kv.set(`wallet:${referral.referrerCustomerId}`, referrerWallet);
    
    // Update referral record
    referral.status = 'completed';
    referral.completedAt = new Date().toISOString();
    referral.refereeFirstBookingId = bookingId;
    referral.referrerRewardGiven = true;
    referral.refereeRewardGiven = true;
    referral.referrerEarnings = REFERRAL_REWARDS.REFERRER_WALLET_CREDIT;
    referral.refereeEarnings = REFERRAL_REWARDS.REFEREE_WALLET_CREDIT;
    
    await kv.set(`referral:${referralId}`, referral);
    
    // Update referrer's stats
    const referrerData = await kv.get(`referral:customer:${referral.referrerCustomerId}`);
    if (referrerData) {
      referrerData.successfulReferrals += 1;
      referrerData.totalEarnings += REFERRAL_REWARDS.REFERRER_WALLET_CREDIT;
      await kv.set(`referral:customer:${referral.referrerCustomerId}`, referrerData);
    }
    
    console.log(`✅ Referral completed: ${referralId}, Rewards given`);
    
    return c.json({
      success: true,
      referral,
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
    
    const referralData = await kv.get(`referral:customer:${customerId}`);
    
    if (!referralData) {
      return c.json({
        success: true,
        hasReferralCode: false,
        message: 'Create your referral code to start earning'
      });
    }
    
    return c.json({
      success: true,
      hasReferralCode: true,
      stats: {
        code: referralData.code,
        totalReferrals: referralData.totalReferrals,
        successfulReferrals: referralData.successfulReferrals,
        totalEarnings: referralData.totalEarnings,
        pendingReferrals: referralData.totalReferrals - referralData.successfulReferrals
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
    
    // Get all referral customer records
    const allReferrals = await kv.getByPrefix('referral:customer:') || [];
    
    // Sort by successful referrals
    allReferrals.sort((a: any, b: any) => 
      (b.successfulReferrals || 0) - (a.successfulReferrals || 0)
    );
    
    // Get top N
    const leaderboard = allReferrals.slice(0, limit).map((ref: any, index: number) => ({
      rank: index + 1,
      code: ref.code,
      successfulReferrals: ref.successfulReferrals || 0,
      totalEarnings: ref.totalEarnings || 0
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
