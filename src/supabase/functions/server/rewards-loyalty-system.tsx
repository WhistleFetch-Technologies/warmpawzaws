// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { generateId } from './database-schema';
import { getLoyaltyRepository, getWalletsRepository } from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

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
  // ✅ SQL: Get or create loyalty profile
  const db = getDbClient();
  const { data: profileData } = await db
    .from('loyalty_profiles')
    .select('*')
    .eq('user_id', userId)
    .eq('user_type', userType)
    .single();

  if (!profileData) {
    // Generate referral code: REF + First 3 chars of ID (or random) + Random 4
    const seed = userId.substring(0, 3).toUpperCase();
    const random = Math.floor(1000 + Math.random() * 9000);
    const code = `REF${seed}${random}`;

    // ✅ SQL: Create new profile
    const { data: newProfile } = await db
      .from('loyalty_profiles')
      .insert({
        user_id: userId,
        user_type: userType,
        points_balance: 0,
        total_points_earned: 0,
        total_points_redeemed: 0,
        referral_code: code,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    // ✅ SQL: Index referral code
    await db.from('referral_codes').insert({
      code: code,
      user_id: userId,
      user_type: userType,
      created_at: new Date().toISOString()
    });
    
    // Get transaction history
    const { data: history } = await db
      .from('loyalty_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    return {
      userId,
      userType,
      pointsBalance: 0,
      totalPointsEarned: 0,
      totalPointsRedeemed: 0,
      referralCode: code,
      history: (history || []).map((t: any) => ({
        id: t.id,
        userId: t.user_id,
        actionKey: t.action_key,
        points: t.points,
        type: t.transaction_type,
        description: t.description,
        metadata: t.metadata,
        timestamp: t.created_at
      }))
    };
  }
  
  // Get transaction history
  const { data: history } = await db
    .from('loyalty_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  
  return {
    userId: profileData.user_id,
    userType: profileData.user_type,
    pointsBalance: profileData.points_balance || 0,
    totalPointsEarned: profileData.total_points_earned || 0,
    totalPointsRedeemed: profileData.total_points_redeemed || 0,
    referralCode: profileData.referral_code,
    referredBy: profileData.referred_by || undefined,
    history: (history || []).map((t: any) => ({
      id: t.id,
      userId: t.user_id,
      actionKey: t.action_key,
      points: t.points,
      type: t.transaction_type,
      description: t.description,
      metadata: t.metadata,
      timestamp: t.created_at
    }))
  };
}

async function getRules(): Promise<LoyaltyRule[]> {
  // ✅ SQL: Get loyalty rules
  const db = getDbClient();
  const { data: rulesData } = await db
    .from('loyalty_rules')
    .select('*')
    .eq('is_active', true);
  
  if (!rulesData || rulesData.length === 0) {
    // Seed default rules
    for (const rule of DEFAULT_RULES) {
      await db.from('loyalty_rules').upsert({
        id: rule.id,
        category: rule.category,
        action_key: rule.actionKey,
        rule_name: rule.name,
        points: rule.points,
        rule_type: rule.type,
        spend_unit: rule.spendUnit || null,
        frequency: rule.frequency,
        period: rule.period || null,
        max_count_per_period: rule.maxCountPerPeriod || null,
        condition: rule.condition || null,
        is_active: rule.isActive,
        description: rule.description || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    return DEFAULT_RULES;
  }
  
  return rulesData.map((r: any) => ({
    id: r.id,
    category: r.category,
    actionKey: r.action_key,
    name: r.rule_name,
    points: r.points,
    type: r.rule_type,
    spendUnit: r.spend_unit,
    frequency: r.frequency,
    period: r.period,
    maxCountPerPeriod: r.max_count_per_period,
    condition: r.condition,
    isActive: r.is_active,
    description: r.description
  }));
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
    // ✅ SQL: Update or create rule
    const db = getDbClient();
    const ruleId = rule.id || generateId('rule');
    
    await db.from('loyalty_rules').upsert({
      id: ruleId,
      category: rule.category,
      action_key: rule.actionKey,
      rule_name: rule.name,
      points: rule.points,
      rule_type: rule.type,
      spend_unit: rule.spendUnit || null,
      frequency: rule.frequency,
      period: rule.period || null,
      max_count_per_period: rule.maxCountPerPeriod || null,
      condition: rule.condition || null,
      is_active: rule.isActive !== false,
      description: rule.description || null,
      updated_at: new Date().toISOString()
    });
    
    const rules = await getRules();
    return sendSuccess(c, { rules }, 'Rules updated');
  } catch (e) {
    return sendError(c, e, 500);
  }
});

/**
 * USER: Get Loyalty Profile (Points, Code, History, Tier)
 */
app.get('/loyalty/profile/:userId', async (c) => {
  try {
    const { userId } = c.req.param();
    const userType = c.req.query('type') as 'customer' | 'vendor' || 'customer';
    
    const profile = await getLoyaltyProfile(userId, userType);
    
    // ✅ ENHANCEMENT: Calculate loyalty tier based on points
    const tier = calculateLoyaltyTier(profile.pointsBalance, userType);
    
    return sendSuccess(c, { 
      profile,
      tier,
      tierBenefits: tier.benefits || {}
    });
  } catch (e) {
    return sendError(c, e, 500);
  }
});

/**
 * Calculate loyalty tier based on points balance
 */
function calculateLoyaltyTier(pointsBalance: number, userType: 'customer' | 'vendor'): any {
  // Tier definitions
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
  
  // Find matching tier
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
    
    // ✅ SQL: Update loyalty profile and add transaction
    const db = getDbClient();
    await db.from('loyalty_profiles')
      .update({
        points_balance: profile.pointsBalance + pointsToAward,
        total_points_earned: profile.totalPointsEarned + pointsToAward,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    await db.from('loyalty_transactions').insert({
      id: transaction.id,
      user_id: userId,
      action_key: actionKey,
      points: pointsToAward,
      transaction_type: 'earned',
      description: rule.name,
      metadata: metadata || null,
      created_at: new Date().toISOString()
    });
    
    profile.pointsBalance += pointsToAward;
    profile.totalPointsEarned += pointsToAward;
    profile.history.unshift(transaction);
    
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
    // ✅ SQL: Update loyalty profile
    const db = getDbClient();
    await db.from('loyalty_profiles')
      .update({
        points_balance: profile.pointsBalance - pointsToRedeem,
        total_points_redeemed: profile.totalPointsRedeemed + pointsToRedeem,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);
    
    // ✅ SQL: Add redemption transaction
    await db.from('loyalty_transactions').insert({
      id: transaction.id,
      user_id: userId,
      action_key: 'redemption',
      points: pointsToRedeem,
      transaction_type: 'redeemed',
      description: 'Converted to Wallet Balance',
      created_at: new Date().toISOString()
    });

    // ✅ SQL: Credit Wallet
    const walletsRepo = getWalletsRepository();
    await walletsRepo.credit({
      customer_id: userId,
      amount: creditAmount,
      source: 'loyalty_rewards',
      description: `Redeemed ${pointsToRedeem} Pawints`,
      reference_id: transaction.id
    });
    
    const wallet = await walletsRepo.findByCustomer(userId);

    console.log(`✅ [LOYALTY] Redeemed ${pointsToRedeem} points for ₹${creditAmount}`);

    return sendSuccess(c, { 
      redeemed: pointsToRedeem, 
      walletCredited: creditAmount,
      newPointsBalance: profile.pointsBalance - pointsToRedeem,
      newWalletBalance: wallet?.balance || creditAmount
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
    
    // ✅ SQL: Get referrer by code
    const db = getDbClient();
    const { data: referralCodeData } = await db
      .from('referral_codes')
      .select('*')
      .eq('code', referralCode)
      .single();
    
    const referrerId = referralCodeData?.user_id;
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

    // ✅ SQL: Update profile with referrer
    const db = getDbClient();
    await db.from('loyalty_profiles')
      .update({
        referred_by: referrerId,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', newUserId);

    // ✅ SQL: Store referral link
    await db.from('referrals').insert({
      referrer_id: referrerId,
      referee_id: newUserId,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    return sendSuccess(c, { message: 'Referral code applied' });

  } catch (e) {
    return sendError(c, e, 500);
  }
});

console.log('✅ Loyalty & Rewards System initialized');

export default app;
