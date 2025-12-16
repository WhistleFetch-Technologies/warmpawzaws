import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';
import { generateId } from './database-schema.tsx';

// ==========================================
// TYPES & INTERFACES
// ==========================================

interface LoyaltyRule {
  id: string;
  category: 'End User' | 'Vendor';
  actionKey: string; // e.g., 'signup', 'spend_medicine'
  name: string;
  points: number; // Base points
  type: 'fixed' | 'percentage_spend' | 'multiplier';
  spendUnit?: number; // e.g., 1000 (for "10 points per 1000 spent")
  frequency: 'one-time' | 'recurring' | 'unlimited';
  period?: 'month' | 'year'; // For limits like "Max 3/month"
  maxCountPerPeriod?: number;
  condition?: string; // e.g., 'first_pet_only'
  isActive: boolean;
  description?: string;
}

interface UserLoyaltyProfile {
  userId: string;
  userType: 'customer' | 'vendor';
  pointsBalance: number;
  totalPointsEarned: number;
  totalPointsRedeemed: number;
  referralCode: string;
  referredBy?: string; // userId of referrer
  history: LoyaltyTransaction[];
}

interface LoyaltyTransaction {
  id: string;
  userId: string;
  actionKey: string;
  points: number;
  type: 'earned' | 'redeemed';
  description: string;
  metadata?: any;
  timestamp: string;
}

// ==========================================
// DEFAULT SEED DATA
// ==========================================

const DEFAULT_RULES: LoyaltyRule[] = [
  // CUSTOMER RULES
  {
    id: 'rule_cust_signup',
    category: 'End User',
    actionKey: 'signup',
    name: 'Sign up Bonus',
    points: 100,
    type: 'fixed',
    frequency: 'one-time',
    isActive: true,
    description: 'Welcome bonus for joining Warmpawz'
  },
  {
    id: 'rule_cust_profile',
    category: 'End User',
    actionKey: 'complete_profile',
    name: 'Complete Pet Profile',
    points: 100,
    type: 'fixed',
    frequency: 'one-time',
    isActive: true,
    description: 'For adding your first pet'
  },
  {
    id: 'rule_cust_health',
    category: 'End User',
    actionKey: 'update_health_record',
    name: 'Update Health Record',
    points: 50,
    type: 'fixed',
    frequency: 'recurring',
    isActive: true,
    description: 'Digitally update pet health records'
  },
  {
    id: 'rule_cust_medicine',
    category: 'End User',
    actionKey: 'spend_medicine',
    name: 'Buy Medicines',
    points: 10,
    type: 'percentage_spend',
    spendUnit: 1000,
    frequency: 'recurring',
    isActive: true,
    description: '10 points per ₹1000 spent on medicines'
  },
  {
    id: 'rule_cust_referral',
    category: 'End User',
    actionKey: 'referral_success',
    name: 'Refer a Friend',
    points: 100,
    type: 'fixed',
    frequency: 'unlimited',
    isActive: true,
    description: 'Earn when friend completes first booking'
  },
  {
    id: 'rule_cust_insurance_buy',
    category: 'End User',
    actionKey: 'buy_insurance',
    name: 'Buy Pet Insurance',
    points: 50,
    type: 'percentage_spend',
    spendUnit: 1000,
    frequency: 'one-time',
    isActive: true,
    description: '50 points per ₹1000 spent on new policy'
  },
  {
    id: 'rule_cust_insurance_renew',
    category: 'End User',
    actionKey: 'renew_insurance',
    name: 'Renew Pet Insurance',
    points: 100,
    type: 'percentage_spend',
    spendUnit: 1000,
    frequency: 'recurring',
    isActive: true,
    description: '100 points per ₹1000 spent on renewal'
  },
  {
    id: 'rule_cust_grooming',
    category: 'End User',
    actionKey: 'book_grooming',
    name: 'Book Grooming',
    points: 5,
    type: 'percentage_spend',
    spendUnit: 1000,
    frequency: 'unlimited',
    isActive: true,
    description: '5 points per ₹1000 spent'
  },
  {
    id: 'rule_cust_vet',
    category: 'End User',
    actionKey: 'book_vet',
    name: 'Book Vet Consultation',
    points: 7,
    type: 'percentage_spend',
    spendUnit: 500,
    frequency: 'unlimited',
    isActive: true,
    description: '7 points per ₹500 spent'
  },
  {
    id: 'rule_cust_food',
    category: 'End User',
    actionKey: 'buy_food',
    name: 'Buy Pet Food',
    points: 3,
    type: 'percentage_spend',
    spendUnit: 1000,
    frequency: 'unlimited',
    isActive: true,
    description: '3 points per ₹1000 spent'
  },
  {
    id: 'rule_cust_review',
    category: 'End User',
    actionKey: 'post_review',
    name: 'Post Review',
    points: 500,
    type: 'fixed',
    frequency: 'recurring',
    period: 'month',
    maxCountPerPeriod: 3,
    isActive: true,
    description: 'Verified review (Max 3/month)'
  },
  {
    id: 'rule_cust_birthday',
    category: 'End User',
    actionKey: 'birthday_booking',
    name: 'Birthday Booking',
    points: 2,
    type: 'multiplier',
    frequency: 'recurring',
    period: 'year',
    maxCountPerPeriod: 1,
    isActive: true,
    description: '2x Points during birthday month'
  },
  
  // VENDOR RULES
  {
    id: 'rule_vend_signup',
    category: 'Vendor',
    actionKey: 'signup',
    name: 'Vendor Signup Bonus',
    points: 100,
    type: 'fixed',
    frequency: 'one-time',
    isActive: true,
    description: 'Welcome bonus for vendors'
  },
  {
    id: 'rule_vend_refer_vendor',
    category: 'Vendor',
    actionKey: 'refer_vendor',
    name: 'Refer another Vendor',
    points: 200,
    type: 'fixed',
    frequency: 'one-time', // Per referral
    isActive: true,
    description: 'When referred vendor joins'
  },
  {
    id: 'rule_vend_refer_customer',
    category: 'Vendor',
    actionKey: 'refer_customer',
    name: 'Refer Customer',
    points: 500,
    type: 'fixed',
    frequency: 'unlimited',
    isActive: true,
    description: 'Refer existing customer to sign up & buy'
  },
  {
    id: 'rule_vend_premium',
    category: 'Vendor',
    actionKey: 'subscribe_premium',
    name: 'Premium Subscription',
    points: 1000,
    type: 'fixed',
    frequency: 'one-time',
    isActive: true,
    description: 'Bonus for upgrading to premium'
  }
];

// ==========================================
// HELPERS
// ==========================================

function sendSuccess(c: any, data: any, message?: string) {
  return c.json({ success: true, ...data, message });
}

function sendError(c: any, error: any, status: number = 500) {
  return c.json({ success: false, error: error.message || error }, status);
}

async function getLoyaltyProfile(userId: string, userType: 'customer' | 'vendor'): Promise<UserLoyaltyProfile> {
  const key = `loyalty_profile:${userId}`;
  let profile = await kv.get(key);

  if (!profile) {
    // Generate referral code: REF + First 3 chars of ID (or random) + Random 4
    const seed = userId.substring(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    const code = `REF${seed}${random}`;

    profile = {
      userId,
      userType,
      pointsBalance: 0,
      totalPointsEarned: 0,
      totalPointsRedeemed: 0,
      referralCode: code,
      history: []
    };
    
    await kv.set(key, profile);
    // Index referral code
    await kv.set(`referral_code:${code}`, userId);
  }
  
  return profile;
}

async function getRules(): Promise<LoyaltyRule[]> {
  const rules = await kv.get('loyalty_rules');
  if (!rules || rules.length === 0) {
    await kv.set('loyalty_rules', DEFAULT_RULES);
    return DEFAULT_RULES;
  }
  return rules;
}

// ==========================================
// CREATE HONO APP
// ==========================================

const app = new Hono();

/**
 * ADMIN: Get all loyalty rules
 */
app.get('/admin/loyalty/rules', async (c) => {
  try {
    const rules = await getRules();
    return sendSuccess(c, { rules });
  } catch (e) {
    return sendError(c, e, 500);
  }
});

/**
 * ADMIN: Update/Create loyalty rule
 */
app.post('/admin/loyalty/rules', async (c) => {
  try {
    const rule = await c.req.json();
    let rules = await getRules();
    
    const index = rules.findIndex((r: any) => r.id === rule.id);
    if (index >= 0) {
      rules[index] = { ...rules[index], ...rule };
    } else {
      rules.push({ ...rule, id: rule.id || generateId('rule') });
    }
    
    await kv.set('loyalty_rules', rules);
    return sendSuccess(c, { rules }, 'Rules updated');
  } catch (e) {
    return sendError(c, e, 500);
  }
});

/**
 * USER: Get Loyalty Profile (Points, Code, History)
 */
app.get('/loyalty/profile/:userId', async (c) => {
  try {
    const { userId } = c.req.param();
    const userType = c.req.query('type') as 'customer' | 'vendor' || 'customer';
    
    const profile = await getLoyaltyProfile(userId, userType);
    return sendSuccess(c, { profile });
  } catch (e) {
    return sendError(c, e, 500);
  }
});

/**
 * SYSTEM: Process an Action (Award Points)
 * This is called by other services (Booking, Auth, etc.)
 */
app.post('/loyalty/process-action', async (c) => {
  try {
    const { userId, userType, actionKey, metadata, amount } = await c.req.json();
    
    console.log(`[LOYALTY] Processing action: ${actionKey} for ${userId} (Amount: ${amount})`);

    const rules = await getRules();
    const rule = rules.find(r => r.actionKey === actionKey && r.isActive);
    
    if (!rule) {
      console.log(`[LOYALTY] No active rule found for ${actionKey}`);
      return sendSuccess(c, { pointsAwarded: 0, message: 'No rule matched' });
    }

    const profile = await getLoyaltyProfile(userId, userType);
    
    // Check constraints
    // 1. One-time limit
    if (rule.frequency === 'one-time') {
      const hasDone = profile.history.some(h => h.actionKey === actionKey);
      if (hasDone) {
        console.log(`[LOYALTY] One-time action already completed`);
        return sendSuccess(c, { pointsAwarded: 0, message: 'Already claimed' });
      }
    }

    // 2. Period limits (e.g. Max 3/month)
    if (rule.period && rule.maxCountPerPeriod) {
      const now = new Date();
      const periodStart = new Date();
      if (rule.period === 'month') periodStart.setMonth(now.getMonth() - 1);
      if (rule.period === 'year') periodStart.setFullYear(now.getFullYear() - 1);
      
      const recentCount = profile.history.filter(h => 
        h.actionKey === actionKey && 
        new Date(h.timestamp) > periodStart
      ).length;

      if (recentCount >= rule.maxCountPerPeriod) {
        console.log(`[LOYALTY] Period limit reached`);
        return sendSuccess(c, { pointsAwarded: 0, message: 'Limit reached for this period' });
      }
    }

    // Calculate Points
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

    // Update Profile
    profile.pointsBalance += pointsToAward;
    profile.totalPointsEarned += pointsToAward;
    
    const transaction: LoyaltyTransaction = {
      id: `loy_txn_${Date.now()}`,
      userId,
      actionKey,
      points: pointsToAward,
      type: 'earned',
      description: rule.name,
      metadata,
      timestamp: new Date().toISOString()
    };
    
    profile.history.unshift(transaction);
    await kv.set(`loyalty_profile:${userId}`, profile);
    
    console.log(`✅ [LOYALTY] Awarded ${pointsToAward} points to ${userId}`);

    return sendSuccess(c, { 
      pointsAwarded: pointsToAward, 
      newBalance: profile.pointsBalance 
    });

  } catch (e) {
    console.error('[LOYALTY] Error processing action:', e);
    return sendError(c, e, 500);
  }
});

/**
 * USER: Redeem Points (Convert to Wallet Balance)
 */
app.post('/loyalty/redeem', async (c) => {
  try {
    const { userId, pointsToRedeem, userType } = await c.req.json();
    
    if (!pointsToRedeem || pointsToRedeem <= 0) {
      return sendError(c, 'Invalid points amount', 400);
    }

    const profile = await getLoyaltyProfile(userId, userType || 'customer');
    
    if (profile.pointsBalance < pointsToRedeem) {
      return sendError(c, 'Insufficient points balance', 400);
    }

    const creditAmount = pointsToRedeem; 

    profile.pointsBalance -= pointsToRedeem;
    profile.totalPointsRedeemed += pointsToRedeem;
    
    const transaction: LoyaltyTransaction = {
      id: `loy_rdm_${Date.now()}`,
      userId,
      actionKey: 'redemption',
      points: pointsToRedeem,
      type: 'redeemed',
      description: 'Converted to Wallet Balance',
      timestamp: new Date().toISOString()
    };
    profile.history.unshift(transaction);
    
    await kv.set(`loyalty_profile:${userId}`, profile);

    // Credit Wallet
    const walletKey = `wallet:${userId}`;
    let wallet = await kv.get(walletKey) || {
      customerId: userId,
      balance: 0,
      totalEarned: 0,
      transactions: []
    };

    wallet.balance += creditAmount;
    wallet.totalEarned += creditAmount;
    wallet.transactions.push({
      id: `txn_reward_${Date.now()}`,
      type: 'credit',
      amount: creditAmount,
      source: 'loyalty_rewards',
      description: `Redeemed ${pointsToRedeem} Pawints`,
      timestamp: new Date().toISOString(),
      balanceAfter: wallet.balance
    });

    await kv.set(walletKey, wallet);

    console.log(`✅ [LOYALTY] Redeemed ${pointsToRedeem} points for ₹${creditAmount}`);

    return sendSuccess(c, { 
      redeemed: pointsToRedeem, 
      walletCredited: creditAmount,
      newPointsBalance: profile.pointsBalance,
      newWalletBalance: wallet.balance
    });

  } catch (e) {
    return sendError(c, e, 500);
  }
});

/**
 * REFERRAL: Apply Referral Code
 */
app.post('/loyalty/referral/apply', async (c) => {
  try {
    const { newUserId, referralCode, userType } = await c.req.json();
    
    const referrerId = await kv.get(`referral_code:${referralCode}`);
    if (!referrerId) {
      return sendError(c, 'Invalid referral code', 400);
    }

    if (referrerId === newUserId) {
      return sendError(c, 'Cannot refer yourself', 400);
    }

    const profile = await getLoyaltyProfile(newUserId, userType);
    
    if (profile.referredBy) {
      return sendError(c, 'User already referred', 400);
    }

    profile.referredBy = referrerId;
    await kv.set(`loyalty_profile:${newUserId}`, profile);

    const referralRecord = {
      referrerId,
      refereeId: newUserId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    await kv.set(`referral_link:${newUserId}`, referralRecord);

    return sendSuccess(c, { message: 'Referral code applied' });

  } catch (e) {
    return sendError(c, e, 500);
  }
});

console.log('✅ Loyalty & Rewards System initialized');

export default app;
