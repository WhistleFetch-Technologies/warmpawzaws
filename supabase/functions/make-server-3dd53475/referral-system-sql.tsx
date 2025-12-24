/**
 * ============================================================================
 * REFERRAL SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Unique referral code generation
 * - Referral tracking
 * - Referral rewards (referrer + referee)
 * - Referral leaderboard
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - KV to SQL (Critical P0)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getReferralsRepository } from "../../lib/repositories/referrals.ts";
import { getWalletsRepository } from "../../lib/repositories/wallets.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { sendSuccess, sendError } from "./response-utils.ts";

const app = new Hono();
app.use('*', cors());

// Referral rewards configuration
const REFERRAL_REWARDS = {
  REFEREE_WALLET_CREDIT: 100, // ₹100 for new user
  REFERRER_WALLET_CREDIT: 50, // ₹50 for referrer
  REFEREE_MIN_BOOKING_AMOUNT: 300, // Referee must book ₹300+ to unlock rewards
  REFERRER_MAX_REFERRALS_PER_MONTH: 50 // Max 50 referrals per month to prevent abuse
};

// ==========================================================================
// CREATE REFERRAL CODE
// ==========================================================================

/**
 * POST /make-server-3dd53475/referrals/:customerId/create-code
 * Generate unique referral code for customer
 */
app.post('/make-server-3dd53475/referrals/:customerId/create-code', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    // Get customer
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }
    
    // Check if code already exists
    const referralsRepo = getReferralsRepository();
    let existingReferral = await referralsRepo.findByReferrer(customerId);
    
    if (existingReferral) {
      return sendSuccess(c, {
        referralCode: existingReferral.referral_code,
        message: 'Referral code already exists'
      });
    }
    
    // Generate unique code
    const referralCode = await referralsRepo.generateUniqueCode('REF');
    
    // Create referral record
    const referral = await referralsRepo.create({
      referrer_id: customerId,
      referral_code: referralCode,
    });
    
    console.log(`🎁 Referral code created: ${referralCode} for customer ${customerId}`);
    
    return sendSuccess(c, {
      referralCode,
      rewards: {
        refereeGets: `₹${REFERRAL_REWARDS.REFEREE_WALLET_CREDIT} wallet credit`,
        referrerGets: `₹${REFERRAL_REWARDS.REFERRER_WALLET_CREDIT} wallet credit`
      },
      message: 'Referral code created successfully'
    });
    
  } catch (error) {
    console.error('Error creating referral code:', error);
    return sendError(c, error, 500);
  }
});

// ==========================================================================
// APPLY REFERRAL CODE
// ==========================================================================

/**
 * POST /make-server-3dd53475/referrals/apply
 * Apply referral code during signup/first booking
 */
app.post('/make-server-3dd53475/referrals/apply', async (c) => {
  try {
    const { referralCode, refereeCustomerId, refereePhone } = await c.req.json();
    
    if (!referralCode || !refereeCustomerId) {
      return sendError(c, 'Missing required fields: referralCode, refereeCustomerId', 400);
    }
    
    const referralsRepo = getReferralsRepository();
    
    // Apply referral
    const referral = await referralsRepo.applyReferral({
      referral_code: referralCode,
      referred_id: refereeCustomerId
    });
    
    console.log(`✅ Referral code ${referralCode} applied by ${refereeCustomerId}`);
    
    return sendSuccess(c, {
      referralId: referral.id,
      referrerId: referral.referrer_id,
      message: 'Referral code applied successfully'
    });
    
  } catch (error: any) {
    console.error('Error applying referral code:', error);
    return sendError(c, error.message || error, 400);
  }
});

// ==========================================================================
// COMPLETE REFERRAL (When Referee Completes First Booking)
// ==========================================================================

/**
 * POST /make-server-3dd53475/referrals/complete
 * Complete referral when referee completes first booking
 */
app.post('/make-server-3dd53475/referrals/complete', async (c) => {
  try {
    const { refereeCustomerId, bookingAmount } = await c.req.json();
    
    if (!refereeCustomerId) {
      return sendError(c, 'Missing refereeCustomerId', 400);
    }
    
    const referralsRepo = getReferralsRepository();
    const walletsRepo = getWalletsRepository();
    
    // Find referral
    const referral = await referralsRepo.findByReferred(refereeCustomerId);
    if (!referral) {
      return sendError(c, 'Referral not found', 404);
    }
    
    if (referral.status !== 'pending') {
      return sendError(c, 'Referral already completed or expired', 400);
    }
    
    // Check minimum booking amount
    if (bookingAmount && bookingAmount < REFERRAL_REWARDS.REFEREE_MIN_BOOKING_AMOUNT) {
      return sendError(c, `Minimum booking amount of ₹${REFERRAL_REWARDS.REFEREE_MIN_BOOKING_AMOUNT} required`, 400);
    }
    
    // Award rewards
    const rewardPoints = REFERRAL_REWARDS.REFEREE_WALLET_CREDIT + REFERRAL_REWARDS.REFERRER_WALLET_CREDIT;
    await referralsRepo.awardRewards(referral.id, rewardPoints);
    
    // Credit referee wallet
    const refereeWallet = await walletsRepo.findOrCreate(refereeCustomerId);
    await walletsRepo.addTransaction({
      wallet_id: refereeWallet.id,
      customer_id: refereeCustomerId,
      transaction_type: 'credit',
      amount: REFERRAL_REWARDS.REFEREE_WALLET_CREDIT,
      source: 'referral_reward',
      description: 'Referral signup bonus',
      reference_id: referral.id
    });
    
    // Credit referrer wallet
    const referrerWallet = await walletsRepo.findOrCreate(referral.referrer_id);
    await walletsRepo.addTransaction({
      wallet_id: referrerWallet.id,
      customer_id: referral.referrer_id,
      transaction_type: 'credit',
      amount: REFERRAL_REWARDS.REFERRER_WALLET_CREDIT,
      source: 'referral_reward',
      description: 'Referral reward',
      reference_id: referral.id
    });
    
    console.log(`✅ Referral ${referral.id} completed - Rewards distributed`);
    
    return sendSuccess(c, {
      referralId: referral.id,
      rewards: {
        refereeCredited: REFERRAL_REWARDS.REFEREE_WALLET_CREDIT,
        referrerCredited: REFERRAL_REWARDS.REFERRER_WALLET_CREDIT
      },
      message: 'Referral completed and rewards distributed'
    });
    
  } catch (error: any) {
    console.error('Error completing referral:', error);
    return sendError(c, error.message || error, 500);
  }
});

// ==========================================================================
// GET REFERRAL DATA
// ==========================================================================

/**
 * GET /make-server-3dd53475/referrals/:customerId
 * Get referral data for customer
 */
app.get('/make-server-3dd53475/referrals/:customerId', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    const referralsRepo = getReferralsRepository();
    
    // Get referral code
    const referral = await referralsRepo.findByReferrer(customerId);
    if (!referral) {
      return sendSuccess(c, {
        hasCode: false,
        message: 'No referral code found'
      });
    }
    
    // Get completed referrals
    const completedReferrals = await referralsRepo.getByReferrer(customerId);
    const completedCount = completedReferrals.filter(r => r.status === 'completed').length;
    
    // Get monthly count
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthlyCount = await referralsRepo.getCompletedCount(customerId, currentMonth);
    
    return sendSuccess(c, {
      hasCode: true,
      referralCode: referral.referral_code,
      totalReferrals: completedCount,
      monthlyReferrals: monthlyCount,
      rewards: {
        refereeGets: `₹${REFERRAL_REWARDS.REFEREE_WALLET_CREDIT} wallet credit`,
        referrerGets: `₹${REFERRAL_REWARDS.REFERRER_WALLET_CREDIT} wallet credit`
      }
    });
    
  } catch (error) {
    console.error('Error getting referral data:', error);
    return sendError(c, error, 500);
  }
});

/**
 * GET /make-server-3dd53475/referrals/:customerId/list
 * Get all referrals for customer
 */
app.get('/make-server-3dd53475/referrals/:customerId/list', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const referralsRepo = getReferralsRepository();
    const referrals = await referralsRepo.getByReferrer(customerId, { limit, offset });
    
    return sendSuccess(c, {
      referrals: referrals.map(r => ({
        id: r.id,
        referredId: r.referred_id,
        status: r.status,
        rewardPoints: r.reward_points,
        completedAt: r.completed_at,
        createdAt: r.created_at
      })),
      total: referrals.length
    });
    
  } catch (error) {
    console.error('Error listing referrals:', error);
    return sendError(c, error, 500);
  }
});

console.log('✅ Referral System (SQL) initialized');

export default app;

