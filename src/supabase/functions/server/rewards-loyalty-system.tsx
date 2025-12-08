/**
 * REWARDS & LOYALTY SYSTEM
 * 
 * Features:
 * - Points earning on bookings
 * - Points redemption
 * - Loyalty tiers (Silver, Gold, Platinum, Diamond)
 * - Tier benefits
 * - Rewards catalog
 * - Points expiry tracking
 * 
 * Status: ✅ P1 IMPLEMENTATION
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import * as kv from './kv_store.tsx';

const app = new Hono();
app.use('*', cors());

// Loyalty tier thresholds
const LOYALTY_TIERS = {
  SILVER: { minPoints: 0, maxPoints: 999, name: 'Silver', benefits: ['5% wallet cashback'] },
  GOLD: { minPoints: 1000, maxPoints: 4999, name: 'Gold', benefits: ['10% wallet cashback', 'Priority support'] },
  PLATINUM: { minPoints: 5000, maxPoints: 9999, name: 'Platinum', benefits: ['15% wallet cashback', 'Priority support', 'Free cancellations'] },
  DIAMOND: { minPoints: 10000, maxPoints: Infinity, name: 'Diamond', benefits: ['20% wallet cashback', 'VIP support', 'Free cancellations', 'Exclusive deals'] }
};

// Points earning rules
const POINTS_EARNING_RULES = {
  PER_RUPEE: 1, // 1 point per ₹1 spent
  BONUS_MULTIPLIERS: {
    first_booking: 2, // 2x points on first booking
    weekend: 1.5, // 1.5x points on weekends
    high_value: 1.5 // 1.5x points on bookings > ₹2000
  }
};

// Points redemption rules
const REDEMPTION_RATE = 0.5; // ₹0.5 per point

// Helper: Calculate loyalty tier
function calculateLoyaltyTier(points: number) {
  if (points >= LOYALTY_TIERS.DIAMOND.minPoints) return LOYALTY_TIERS.DIAMOND;
  if (points >= LOYALTY_TIERS.PLATINUM.minPoints) return LOYALTY_TIERS.PLATINUM;
  if (points >= LOYALTY_TIERS.GOLD.minPoints) return LOYALTY_TIERS.GOLD;
  return LOYALTY_TIERS.SILVER;
}

// Helper: Generate reward ID
function generateRewardId() {
  return `reward_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==========================================================================
// EARN POINTS ON BOOKING COMPLETION
// ==========================================================================

/**
 * POST /loyalty/earn-points
 * Award points when booking is completed
 */
app.post('/loyalty/earn-points', async (c) => {
  try {
    const { customerId, bookingId, amount } = await c.req.json();
    
    if (!customerId || !bookingId || !amount) {
      return c.json({
        error: 'Missing required fields',
        required: ['customerId', 'bookingId', 'amount']
      }, 400);
    }
    
    // Get customer loyalty profile
    let loyalty = await kv.get(`loyalty:${customerId}`) || {
      customerId,
      totalPoints: 0,
      availablePoints: 0,
      lifetimePoints: 0,
      tier: 'Silver',
      joinedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };
    
    // Calculate base points (1 point per rupee)
    let pointsEarned = amount * POINTS_EARNING_RULES.PER_RUPEE;
    
    // Apply multipliers
    const booking = await kv.get(`booking:${bookingId}`);
    
    // First booking bonus
    const bookingHistory = await kv.get(`booking:customer:${customerId}`) || [];
    if (bookingHistory.length === 1) { // First booking
      pointsEarned *= POINTS_EARNING_RULES.BONUS_MULTIPLIERS.first_booking;
    }
    
    // High value bonus
    if (amount >= 2000) {
      pointsEarned *= POINTS_EARNING_RULES.BONUS_MULTIPLIERS.high_value;
    }
    
    // Weekend bonus
    const bookingDate = new Date(booking?.scheduledDate || new Date());
    const dayOfWeek = bookingDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      pointsEarned *= POINTS_EARNING_RULES.BONUS_MULTIPLIERS.weekend;
    }
    
    pointsEarned = Math.floor(pointsEarned);
    
    // Update loyalty profile
    loyalty.totalPoints += pointsEarned;
    loyalty.availablePoints += pointsEarned;
    loyalty.lifetimePoints += pointsEarned;
    loyalty.lastActivityAt = new Date().toISOString();
    
    // Calculate new tier
    const newTier = calculateLoyaltyTier(loyalty.lifetimePoints);
    const tierChanged = loyalty.tier !== newTier.name;
    loyalty.tier = newTier.name;
    
    await kv.set(`loyalty:${customerId}`, loyalty);
    
    // Create points transaction record
    const transactionId = generateRewardId();
    const transaction = {
      id: transactionId,
      customerId,
      type: 'earn',
      points: pointsEarned,
      bookingId,
      amount,
      description: `Earned ${pointsEarned} points on booking`,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year expiry
    };
    
    await kv.set(`loyalty:transaction:${transactionId}`, transaction);
    
    // Add to customer's transaction history
    const transactions = await kv.get(`loyalty:${customerId}:transactions`) || [];
    transactions.unshift(transactionId);
    await kv.set(`loyalty:${customerId}:transactions`, transactions);
    
    console.log(`🎁 ${pointsEarned} points earned for customer ${customerId}`);
    
    return c.json({
      success: true,
      pointsEarned,
      loyalty: {
        totalPoints: loyalty.totalPoints,
        availablePoints: loyalty.availablePoints,
        tier: loyalty.tier,
        tierChanged
      },
      message: tierChanged 
        ? `Congratulations! You've been upgraded to ${loyalty.tier} tier!`
        : `You earned ${pointsEarned} points!`
    });
    
  } catch (error) {
    console.error('Error earning points:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// REDEEM POINTS
// ==========================================================================

/**
 * POST /loyalty/:customerId/redeem
 * Redeem points for wallet credit
 */
app.post('/loyalty/:customerId/redeem', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    const { points } = await c.req.json();
    
    if (!points || points < 100) {
      return c.json({
        error: 'Invalid points amount',
        hint: 'Minimum redemption is 100 points'
      }, 400);
    }
    
    // Get loyalty profile
    const loyalty = await kv.get(`loyalty:${customerId}`);
    if (!loyalty) {
      return c.json({ error: 'Loyalty profile not found' }, 404);
    }
    
    // Check available points
    if (loyalty.availablePoints < points) {
      return c.json({
        error: 'Insufficient points',
        available: loyalty.availablePoints,
        requested: points
      }, 400);
    }
    
    // Calculate wallet credit
    const walletCredit = points * REDEMPTION_RATE;
    
    // Deduct points
    loyalty.availablePoints -= points;
    loyalty.lastActivityAt = new Date().toISOString();
    await kv.set(`loyalty:${customerId}`, loyalty);
    
    // Credit wallet
    const wallet = await kv.get(`wallet:${customerId}`) || {
      balance: 0,
      totalEarned: 0,
      totalSpent: 0
    };
    
    wallet.balance += walletCredit;
    wallet.totalEarned += walletCredit;
    await kv.set(`wallet:${customerId}`, wallet);
    
    // Create redemption transaction
    const transactionId = generateRewardId();
    const transaction = {
      id: transactionId,
      customerId,
      type: 'redeem',
      points: -points, // Negative for redemption
      walletCredit,
      description: `Redeemed ${points} points for ₹${walletCredit} wallet credit`,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`loyalty:transaction:${transactionId}`, transaction);
    
    // Add to transaction history
    const transactions = await kv.get(`loyalty:${customerId}:transactions`) || [];
    transactions.unshift(transactionId);
    await kv.set(`loyalty:${customerId}:transactions`, transactions);
    
    console.log(`💎 ${points} points redeemed for ₹${walletCredit} by customer ${customerId}`);
    
    return c.json({
      success: true,
      pointsRedeemed: points,
      walletCredit,
      newBalance: {
        points: loyalty.availablePoints,
        wallet: wallet.balance
      },
      message: `₹${walletCredit} added to your wallet`
    });
    
  } catch (error) {
    console.error('Error redeeming points:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// GET LOYALTY PROFILE
// ==========================================================================

/**
 * GET /loyalty/:customerId
 * Get customer loyalty profile
 */
app.get('/loyalty/:customerId', async (c) => {
  try {
    const customerId = c.req.param('customerId');
    
    const loyalty = await kv.get(`loyalty:${customerId}`) || {
      customerId,
      totalPoints: 0,
      availablePoints: 0,
      lifetimePoints: 0,
      tier: 'Silver',
      joinedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };
    
    // Calculate tier info
    const currentTier = calculateLoyaltyTier(loyalty.lifetimePoints);
    const nextTier = 
      currentTier.name === 'Diamond' ? null :
      currentTier.name === 'Platinum' ? LOYALTY_TIERS.DIAMOND :
      currentTier.name === 'Gold' ? LOYALTY_TIERS.PLATINUM :
      LOYALTY_TIERS.GOLD;
    
    const pointsToNextTier = nextTier 
      ? nextTier.minPoints - loyalty.lifetimePoints
      : 0;
    
    // Get recent transactions
    const transactionIds = await kv.get(`loyalty:${customerId}:transactions`) || [];
    const recentTransactions = [];
    
    for (const txnId of transactionIds.slice(0, 10)) {
      const txn = await kv.get(`loyalty:transaction:${txnId}`);
      if (txn) recentTransactions.push(txn);
    }
    
    return c.json({
      success: true,
      loyalty: {
        ...loyalty,
        currentTier: {
          name: currentTier.name,
          benefits: currentTier.benefits
        },
        nextTier: nextTier ? {
          name: nextTier.name,
          pointsNeeded: pointsToNextTier,
          benefits: nextTier.benefits
        } : null,
        redemptionValue: loyalty.availablePoints * REDEMPTION_RATE
      },
      recentTransactions
    });
    
  } catch (error) {
    console.error('Error fetching loyalty profile:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ==========================================================================
// REWARDS CATALOG
// ==========================================================================

/**
 * GET /loyalty/rewards-catalog
 * Get available rewards
 */
app.get('/loyalty/rewards-catalog', async (c) => {
  try {
    const rewards = [
      {
        id: 'reward_wallet_50',
        name: '₹50 Wallet Credit',
        pointsCost: 100,
        type: 'wallet_credit',
        value: 50,
        description: 'Add ₹50 to your wallet'
      },
      {
        id: 'reward_wallet_250',
        name: '₹250 Wallet Credit',
        pointsCost: 500,
        type: 'wallet_credit',
        value: 250,
        description: 'Add ₹250 to your wallet'
      },
      {
        id: 'reward_wallet_550',
        name: '₹550 Wallet Credit',
        pointsCost: 1000,
        type: 'wallet_credit',
        value: 550,
        description: 'Add ₹550 to your wallet (10% bonus!)'
      },
      {
        id: 'reward_free_grooming',
        name: 'Free Basic Grooming',
        pointsCost: 1200,
        type: 'service_voucher',
        value: 600,
        description: 'Free basic grooming session (up to ₹600)'
      },
      {
        id: 'reward_free_vet',
        name: 'Free Vet Consultation',
        pointsCost: 1000,
        type: 'service_voucher',
        value: 500,
        description: 'Free vet consultation (up to ₹500)'
      }
    ];
    
    return c.json({
      success: true,
      rewards,
      redemptionRate: REDEMPTION_RATE
    });
    
  } catch (error) {
    console.error('Error fetching rewards catalog:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
