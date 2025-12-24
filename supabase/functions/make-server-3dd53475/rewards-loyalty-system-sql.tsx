/**
 * ============================================================================
 * REWARDS & LOYALTY SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Loyalty points earning and redemption
 * - Wallet credit from loyalty redemption
 * - Referral code management
 * - Loyalty rules management
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * Migration: Phase 6 - KV to SQL (Critical P0)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getLoyaltyRepository } from "../../lib/repositories/loyalty.ts";
import { getReferralsRepository } from "../../lib/repositories/referrals.ts";
import { getWalletsRepository } from "../../lib/repositories/wallets.ts";
import { getDbClient } from "../../lib/db.ts";
import { sendSuccess, sendError } from "./response-utils.ts";

// ============================================================================
// TYPES
// ============================================================================

interface LoyaltyRuleConfig {
  id: string;
  category: 'End User' | 'Vendor';
  actionKey: string;
  name: string;
  points: number;
  type: 'fixed' | 'percentage_spend' | 'multiplier';
  spendUnit?: number;
  frequency: 'one-time' | 'recurring' | 'unlimited';
  period?: 'month' | 'year';
  maxCountPerPeriod?: number;
  condition?: string;
  isActive: boolean;
  description?: string;
}

// ============================================================================
// DEFAULT RULES (for seeding)
// ============================================================================

const DEFAULT_RULES: LoyaltyRuleConfig[] = [
  { id: 'rule_cust_signup', category: 'End User', actionKey: 'signup', name: 'Sign up Bonus', points: 100, type: 'fixed', frequency: 'one-time', isActive: true, description: 'Welcome bonus for joining Warmpawz' },
  { id: 'rule_cust_profile', category: 'End User', actionKey: 'complete_profile', name: 'Complete Pet Profile', points: 100, type: 'fixed', frequency: 'one-time', isActive: true, description: 'For adding your first pet' },
  { id: 'rule_cust_health', category: 'End User', actionKey: 'update_health_record', name: 'Update Health Record', points: 50, type: 'fixed', frequency: 'recurring', isActive: true, description: 'Digitally update pet health records' },
  { id: 'rule_cust_medicine', category: 'End User', actionKey: 'spend_medicine', name: 'Buy Medicines', points: 10, type: 'percentage_spend', spendUnit: 1000, frequency: 'recurring', isActive: true, description: '10 points per ₹1000 spent on medicines' },
  { id: 'rule_cust_referral', category: 'End User', actionKey: 'referral_success', name: 'Refer a Friend', points: 100, type: 'fixed', frequency: 'unlimited', isActive: true, description: 'Earn when friend completes first booking' },
  { id: 'rule_cust_grooming', category: 'End User', actionKey: 'book_grooming', name: 'Book Grooming', points: 5, type: 'percentage_spend', spendUnit: 1000, frequency: 'unlimited', isActive: true, description: '5 points per ₹1000 spent' },
  { id: 'rule_cust_vet', category: 'End User', actionKey: 'book_vet', name: 'Book Vet Consultation', points: 7, type: 'percentage_spend', spendUnit: 500, frequency: 'unlimited', isActive: true, description: '7 points per ₹500 spent' },
  { id: 'rule_cust_food', category: 'End User', actionKey: 'buy_food', name: 'Buy Pet Food', points: 3, type: 'percentage_spend', spendUnit: 1000, frequency: 'unlimited', isActive: true, description: '3 points per ₹1000 spent' },
  { id: 'rule_cust_review', category: 'End User', actionKey: 'post_review', name: 'Post Review', points: 500, type: 'fixed', frequency: 'recurring', period: 'month', maxCountPerPeriod: 3, isActive: true, description: 'Verified review (Max 3/month)' },
  { id: 'rule_vend_signup', category: 'Vendor', actionKey: 'signup', name: 'Vendor Signup Bonus', points: 100, type: 'fixed', frequency: 'one-time', isActive: true, description: 'Welcome bonus for vendors' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateLoyaltyTier(pointsBalance: number, userType: 'customer' | 'vendor'): any {
  const customerTiers = [
    { name: 'Bronze', minPoints: 0, maxPoints: 999, benefits: { discountPercentage: 0 } },
    { name: 'Silver', minPoints: 1000, maxPoints: 4999, benefits: { discountPercentage: 2 } },
    { name: 'Gold', minPoints: 5000, maxPoints: 19999, benefits: { discountPercentage: 5 } },
    { name: 'Platinum', minPoints: 20000, maxPoints: 999999, benefits: { discountPercentage: 10 } }
  ];

  const vendorTiers = [
    { name: 'Bronze', minPoints: 0, maxPoints: 999, benefits: { discountPercentage: 0, commissionReduction: 0 } },
    { name: 'Silver', minPoints: 1000, maxPoints: 4999, benefits: { discountPercentage: 0, commissionReduction: 0.5 } },
    { name: 'Gold', minPoints: 5000, maxPoints: 19999, benefits: { discountPercentage: 0, commissionReduction: 1 } },
    { name: 'Platinum', minPoints: 20000, maxPoints: 999999, benefits: { discountPercentage: 0, commissionReduction: 2 } }
  ];

  const tiers = userType === 'customer' ? customerTiers : vendorTiers;
  const tier = tiers.find(t => pointsBalance >= t.minPoints && pointsBalance <= t.maxPoints) || tiers[0];
  
  return {
    ...tier,
    currentPoints: pointsBalance,
    nextTier: tiers.find(t => t.minPoints > pointsBalance),
    pointsToNextTier: tiers.find(t => t.minPoints > pointsBalance) 
      ? tiers.find(t => t.minPoints > pointsBalance)!.minPoints - pointsBalance 
      : 0
  };
}

// ============================================================================
// HONO APP
// ============================================================================

const app = new Hono();

/**
 * ADMIN: Get all loyalty rules
 */
app.get('/make-server-3dd53475/admin/loyalty/rules', async (c) => {
  try {
    const loyaltyRepo = getLoyaltyRepository();
    const rules = await loyaltyRepo.getActiveRules();
    
    // If no rules exist, seed default rules
    if (rules.length === 0) {
      const client = getDbClient();
      for (const rule of DEFAULT_RULES) {
        await client.from('loyalty_rules').upsert({
          rule_name: rule.actionKey,
          points_per_rupee: rule.type === 'percentage_spend' ? (rule.points / (rule.spendUnit || 1000)) : 0,
          redemption_rate: 1.0,
          min_redemption_points: 100,
          is_active: rule.isActive,
        }, { onConflict: 'rule_name' });
      }
      const seededRules = await loyaltyRepo.getActiveRules();
      return sendSuccess(c, { rules: seededRules });
    }
    
    return sendSuccess(c, { rules });
  } catch (e) {
    console.error('[LOYALTY] Error getting rules:', e);
    return sendError(c, e, 500);
  }
});

/**
 * ADMIN: Update/Create loyalty rule
 */
app.post('/make-server-3dd53475/admin/loyalty/rules', async (c) => {
  try {
    const rule = await c.req.json();
    const client = getDbClient();
    
    await client.from('loyalty_rules').upsert({
      rule_name: rule.actionKey || rule.id,
      points_per_rupee: rule.type === 'percentage_spend' ? (rule.points / (rule.spendUnit || 1000)) : (rule.points / 100),
      redemption_rate: 1.0,
      min_redemption_points: 100,
      is_active: rule.isActive !== false,
    }, { onConflict: 'rule_name' });
    
    const loyaltyRepo = getLoyaltyRepository();
    const rules = await loyaltyRepo.getActiveRules();
    
    return sendSuccess(c, { rules }, 'Rules updated');
  } catch (e) {
    console.error('[LOYALTY] Error updating rules:', e);
    return sendError(c, e, 500);
  }
});

/**
 * USER: Get Loyalty Profile (Points, Code, History, Tier)
 */
app.get('/make-server-3dd53475/loyalty/profile/:userId', async (c) => {
  try {
    const { userId } = c.req.param();
    const userType = (c.req.query('type') as 'customer' | 'vendor') || 'customer';
    
    const loyaltyRepo = getLoyaltyRepository();
    const referralsRepo = getReferralsRepository();
    
    // Get or create loyalty profile
    const profile = await loyaltyRepo.findOrCreate(userId);
    
    // Get referral code
    let referralCode = '';
    const referral = await referralsRepo.findByReferrer(userId);
    if (referral) {
      referralCode = referral.referral_code;
    } else {
      // Create referral code if doesn't exist
      const code = await referralsRepo.generateUniqueCode('REF');
      await referralsRepo.create({
        referrer_id: userId,
        referral_code: code,
      });
      referralCode = code;
    }
    
    // Get transaction history
    const transactions = await loyaltyRepo.getTransactions(userId, { limit: 50 });
    
    // Calculate tier
    const tier = calculateLoyaltyTier(profile.total_points, userType);
    
    return sendSuccess(c, { 
      profile: {
        userId,
        userType,
        pointsBalance: profile.total_points,
        totalPointsEarned: profile.lifetime_points_earned,
        totalPointsRedeemed: profile.lifetime_points_redeemed,
        referralCode,
        history: transactions.map(t => ({
          id: t.id,
          userId: t.customer_id,
          actionKey: t.reference_type || 'unknown',
          points: t.points,
          type: t.transaction_type === 'earned' ? 'earned' : 'redeemed',
          description: t.description || '',
          timestamp: t.created_at
        }))
      },
      tier,
      tierBenefits: tier.benefits || {}
    });
  } catch (e) {
    console.error('[LOYALTY] Error getting profile:', e);
    return sendError(c, e, 500);
  }
});

/**
 * SYSTEM: Process an Action (Award Points)
 */
app.post('/make-server-3dd53475/loyalty/process-action', async (c) => {
  try {
    const { userId, userType, actionKey, metadata, amount } = await c.req.json();
    
    console.log(`[LOYALTY] Processing action: ${actionKey} for ${userId} (Amount: ${amount})`);

    const loyaltyRepo = getLoyaltyRepository();
    
    // Get default rule (simplified - in production, match by actionKey)
    const rule = DEFAULT_RULES.find(r => r.actionKey === actionKey && r.isActive);
    
    if (!rule) {
      console.log(`[LOYALTY] No active rule found for ${actionKey}`);
      return sendSuccess(c, { pointsAwarded: 0, message: 'No rule matched' });
    }

    // Get profile
    const profile = await loyaltyRepo.findOrCreate(userId);
    
    // Check one-time limit
    if (rule.frequency === 'one-time') {
      const transactions = await loyaltyRepo.getTransactions(userId);
      const hasDone = transactions.some(t => t.reference_type === actionKey && t.transaction_type === 'earned');
      if (hasDone) {
        console.log(`[LOYALTY] One-time action already completed`);
        return sendSuccess(c, { pointsAwarded: 0, message: 'Already claimed' });
      }
    }

    // Calculate points
    let pointsToAward = 0;
    if (rule.type === 'fixed') {
      pointsToAward = rule.points;
    } else if (rule.type === 'percentage_spend' && amount) {
      const unit = rule.spendUnit || 1;
      pointsToAward = Math.floor((amount / unit) * rule.points);
    } else if (rule.type === 'multiplier' && amount) {
      pointsToAward = Math.floor((amount / 100) * rule.points);
    }

    if (pointsToAward <= 0) {
      return sendSuccess(c, { pointsAwarded: 0, message: 'No points earned (amount too low)' });
    }

    // Award points
    const updatedProfile = await loyaltyRepo.addPoints(
      userId,
      pointsToAward,
      actionKey,
      metadata?.referenceId,
      rule.name
    );
    
    console.log(`✅ [LOYALTY] Awarded ${pointsToAward} points to ${userId}`);

    return sendSuccess(c, { 
      pointsAwarded: pointsToAward, 
      newBalance: updatedProfile.total_points 
    });

  } catch (e) {
    console.error('[LOYALTY] Error processing action:', e);
    return sendError(c, e, 500);
  }
});

/**
 * USER: Redeem Points (Convert to Wallet Balance)
 */
app.post('/make-server-3dd53475/loyalty/redeem', async (c) => {
  try {
    const { userId, pointsToRedeem, userType } = await c.req.json();
    
    if (!pointsToRedeem || pointsToRedeem <= 0) {
      return sendError(c, 'Invalid points amount', 400);
    }

    const loyaltyRepo = getLoyaltyRepository();
    const walletsRepo = getWalletsRepository();
    
    // Get profile
    const profile = await loyaltyRepo.findOrCreate(userId);
    
    if (profile.total_points < pointsToRedeem) {
      return sendError(c, 'Insufficient points balance', 400);
    }

    // Redeem points
    const updatedProfile = await loyaltyRepo.redeemPoints(userId, pointsToRedeem, 'Converted to Wallet Balance');
    
    // Credit wallet (1 point = 1 rupee)
    const creditAmount = pointsToRedeem;
    const wallet = await walletsRepo.findOrCreate(userId);
    
    await walletsRepo.addTransaction({
      wallet_id: wallet.id,
      customer_id: userId,
      transaction_type: 'credit',
      amount: creditAmount,
      source: 'loyalty_rewards',
      description: `Redeemed ${pointsToRedeem} Pawints`,
      reference_id: null
    });

    const updatedWallet = await walletsRepo.findByCustomer(userId);
    if (!updatedWallet) {
      throw new Error('Wallet not found after transaction');
    }

    console.log(`✅ [LOYALTY] Redeemed ${pointsToRedeem} points for ₹${creditAmount}`);

    return sendSuccess(c, { 
      redeemed: pointsToRedeem, 
      walletCredited: creditAmount,
      newPointsBalance: updatedProfile.total_points,
      newWalletBalance: updatedWallet.balance
    });

  } catch (e) {
    console.error('[LOYALTY] Error redeeming points:', e);
    return sendError(c, e, 500);
  }
});

/**
 * REFERRAL: Apply Referral Code
 */
app.post('/make-server-3dd53475/loyalty/referral/apply', async (c) => {
  try {
    const { newUserId, referralCode, userType } = await c.req.json();
    
    const referralsRepo = getReferralsRepository();
    
    // Find referral by code
    const referral = await referralsRepo.findByCode(referralCode);
    if (!referral) {
      return sendError(c, 'Invalid referral code', 400);
    }

    if (referral.referrer_id === newUserId) {
      return sendError(c, 'Cannot refer yourself', 400);
    }

    // Check if already referred
    const existingReferral = await referralsRepo.findByReferred(newUserId);
    if (existingReferral) {
      return sendError(c, 'User already referred', 400);
    }

    // Apply referral
    await referralsRepo.applyReferral({
      referral_code: referralCode,
      referred_id: newUserId
    });

    return sendSuccess(c, { message: 'Referral code applied' });

  } catch (e) {
    console.error('[LOYALTY] Error applying referral:', e);
    return sendError(c, e, 500);
  }
});

console.log('✅ Loyalty & Rewards System (SQL) initialized');

export default app;

