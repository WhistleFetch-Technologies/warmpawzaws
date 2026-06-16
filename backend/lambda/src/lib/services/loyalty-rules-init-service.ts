/**
 * Loyalty Rules Initialization Service
 * 
 * Ensures loyalty_action_rules table exists and contains required rules
 * AWS Serverless compatible (Lambda, RDS)
 */

import { query, select, insert } from '../../database/rds-connection';

export class LoyaltyRulesInitService {
  private static tableExistsCache: boolean | null = null;

  /**
   * Check if loyalty_action_rules table exists
   */
  async checkTableExists(): Promise<boolean> {
    if (LoyaltyRulesInitService.tableExistsCache !== null) {
      return LoyaltyRulesInitService.tableExistsCache;
    }

    try {
      const result = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'loyalty_action_rules'
        ) as exists`
      );
      
      const exists = result.rows[0]?.exists === true;
      LoyaltyRulesInitService.tableExistsCache = exists;
      
      return exists;
    } catch (error: any) {
      console.error('[LOYALTY_INIT] Error checking table existence:', error);
      LoyaltyRulesInitService.tableExistsCache = false;
      return false;
    }
  }

  /**
   * Create loyalty_action_rules table if it doesn't exist
   */
  async ensureTableExists(): Promise<boolean> {
    const exists = await this.checkTableExists();
    if (exists) {
      return true;
    }

    try {
      console.log('[LOYALTY_INIT] Creating loyalty_action_rules table...');
      
      // Create table
      await query(`
        CREATE TABLE IF NOT EXISTS loyalty_action_rules (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          action_name TEXT NOT NULL UNIQUE,
          action_category TEXT NOT NULL CHECK (action_category IN ('loyalty', 'referral_rewards')),
          user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'vendor', 'both')),
          
          -- Point Calculation
          points_type TEXT NOT NULL CHECK (points_type IN ('fixed', 'percentage', 'per_amount')),
          points_value NUMERIC(10, 2) NOT NULL,
          base_amount NUMERIC(10, 2),
          min_amount NUMERIC(10, 2),
          max_points_per_transaction INTEGER,
          
          -- Frequency/Limits
          frequency_type TEXT CHECK (frequency_type IN ('one_time', 'recurring', 'unlimited', 'monthly_limit', 'yearly_limit')),
          frequency_limit INTEGER,
          frequency_period TEXT CHECK (frequency_period IN ('day', 'week', 'month', 'year')),
          
          -- Conditions
          conditions JSONB DEFAULT '{}'::jsonb,
          multiplier_conditions JSONB DEFAULT '{}'::jsonb,
          
          -- Status
          is_active BOOLEAN DEFAULT true,
          priority INTEGER DEFAULT 100,
          
          -- Metadata
          description TEXT,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Create indexes
      await query(`
        CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_action_name ON loyalty_action_rules(action_name)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_category ON loyalty_action_rules(action_category)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_user_type ON loyalty_action_rules(user_type)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_active ON loyalty_action_rules(is_active) WHERE is_active = true
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_loyalty_action_rules_priority ON loyalty_action_rules(priority DESC) WHERE is_active = true
      `);

      LoyaltyRulesInitService.tableExistsCache = true;
      console.log('[LOYALTY_INIT] ✅ loyalty_action_rules table created successfully');
      return true;
    } catch (error: any) {
      console.error('[LOYALTY_INIT] ❌ Error creating table:', error);
      return false;
    }
  }

  /**
   * Check if a specific rule exists
   */
  async checkRuleExists(actionName: string): Promise<boolean> {
    try {
      const rules = await select('loyalty_action_rules', { action_name: actionName });
      return rules.length > 0;
    } catch (error: any) {
      // Table might not exist
      return false;
    }
  }

  /**
   * Ensure referral_signup rule exists with 100 points (referee welcome bonus on first booking).
   * Does not overwrite admin-configured values except legacy 50 → 100 bump.
   */
  async ensureReferralSignupRule(): Promise<boolean> {
    try {
      // First ensure table exists
      const tableExists = await this.ensureTableExists();
      if (!tableExists) {
        console.error('[LOYALTY_INIT] Cannot create rule: table does not exist');
        return false;
      }

      // Check if rule exists
      const ruleExists = await this.checkRuleExists('referral_signup');
      
      if (ruleExists) {
        // Bump legacy 50-point default only; do not clobber admin edits.
        try {
          await query(
            `UPDATE loyalty_action_rules 
             SET points_value = 100,
                 action_category = 'referral_rewards',
                 user_type = 'customer',
                 points_type = 'fixed',
                 frequency_type = 'one_time',
                 description = 'Sign up with referral code and complete first booking',
                 is_active = true,
                 priority = 50,
                 updated_at = NOW()
             WHERE action_name = 'referral_signup'
               AND points_value = 50`
          );
          console.log('[LOYALTY_INIT] ✅ referral_signup rule present (legacy 50→100 if applicable)');
        } catch (updateError: any) {
          console.error('[LOYALTY_INIT] Error updating referral_signup rule:', updateError);
        }
        return true;
      }

      // Create new rule
      console.log('[LOYALTY_INIT] Creating referral_signup rule with 100 points...');
      await insert('loyalty_action_rules', {
        action_name: 'referral_signup',
        action_category: 'referral_rewards',
        user_type: 'customer',
        points_type: 'fixed',
        points_value: 100,
        base_amount: null,
        frequency_type: 'one_time',
        description: 'Sign up with referral code and complete first booking',
        is_active: true,
        priority: 50,
        notes: 'Awarded to referred users who used a peer referral code and paid for first booking',
      });

      console.log('[LOYALTY_INIT] ✅ Created referral_signup rule with 100 points');
      return true;
    } catch (error: any) {
      // Handle unique constraint violation (rule already exists)
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        console.log('[LOYALTY_INIT] referral_signup rule already exists');
        return true;
      }
      console.error('[LOYALTY_INIT] ❌ Error ensuring referral_signup rule:', error);
      return false;
    }
  }

  /**
   * Ensure refer_friend rule exists (for referrer rewards)
   */
  async ensureReferFriendRule(): Promise<boolean> {
    try {
      // First ensure table exists
      const tableExists = await this.ensureTableExists();
      if (!tableExists) {
        console.error('[LOYALTY_INIT] Cannot create rule: table does not exist');
        return false;
      }

      // Check if rule exists
      const ruleExists = await this.checkRuleExists('refer_friend');
      
      if (ruleExists) {
        // Update existing rule to ensure it has 500 points (matching vendor referrals)
        try {
          await query(
            `UPDATE loyalty_action_rules 
             SET points_value = 500,
                 action_category = 'referral_rewards',
                 user_type = 'customer',
                 points_type = 'fixed',
                 frequency_type = 'recurring',
                 description = 'Refer a friend who joins',
                 is_active = true,
                 priority = 50,
                 updated_at = NOW()
             WHERE action_name = 'refer_friend'`
          );
          console.log('[LOYALTY_INIT] ✅ Updated refer_friend rule to 500 points');
        } catch (updateError: any) {
          console.error('[LOYALTY_INIT] Error updating refer_friend rule:', updateError);
        }
        return true;
      }

      // Create new rule if it doesn't exist (500 points to match vendor referrals)
      console.log('[LOYALTY_INIT] Creating refer_friend rule with 500 points...');
      await insert('loyalty_action_rules', {
        action_name: 'refer_friend',
        action_category: 'referral_rewards',
        user_type: 'customer',
        points_type: 'fixed',
        points_value: 500,
        base_amount: null,
        frequency_type: 'recurring',
        description: 'Refer a friend who joins',
        is_active: true,
        priority: 50,
        notes: 'Awarded when someone signs up using your referral code',
      });

      console.log('[LOYALTY_INIT] ✅ Created refer_friend rule');
      return true;
    } catch (error: any) {
      // Handle unique constraint violation (rule already exists)
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        console.log('[LOYALTY_INIT] refer_friend rule already exists');
        return true;
      }
      console.error('[LOYALTY_INIT] ❌ Error ensuring refer_friend rule:', error);
      return false;
    }
  }

  /**
   * Ensure vendor_refer_friend rule exists
   */
  async ensureVendorReferFriendRule(): Promise<boolean> {
    try {
      // First ensure table exists
      const tableExists = await this.ensureTableExists();
      if (!tableExists) {
        console.error('[LOYALTY_INIT] Cannot create rule: table does not exist');
        return false;
      }

      // Check if rule exists
      const ruleExists = await this.checkRuleExists('vendor_refer_friend');
      
      if (ruleExists) {
        // Update existing rule to ensure it has correct points (200 from migration, but user wants 500)
        try {
          await query(
            `UPDATE loyalty_action_rules 
             SET points_value = 500,
                 action_category = 'referral_rewards',
                 user_type = 'vendor',
                 points_type = 'fixed',
                 frequency_type = 'recurring',
                 description = 'Refer a friend who joins',
                 is_active = true,
                 priority = 50,
                 updated_at = NOW()
             WHERE action_name = 'vendor_refer_friend'`
          );
          console.log('[LOYALTY_INIT] ✅ Updated vendor_refer_friend rule to 500 points');
        } catch (updateError: any) {
          console.error('[LOYALTY_INIT] Error updating vendor_refer_friend rule:', updateError);
        }
        return true;
      }

      // Create new rule
      console.log('[LOYALTY_INIT] Creating vendor_refer_friend rule with 500 points...');
      await insert('loyalty_action_rules', {
        action_name: 'vendor_refer_friend',
        action_category: 'referral_rewards',
        user_type: 'vendor',
        points_type: 'fixed',
        points_value: 500,
        base_amount: null,
        frequency_type: 'recurring',
        description: 'Refer a friend who joins',
        is_active: true,
        priority: 50,
        notes: 'Friend must Onboard 1 End User and complete 1 booking',
      });

      console.log('[LOYALTY_INIT] ✅ Created vendor_refer_friend rule with 500 points');
      return true;
    } catch (error: any) {
      // Handle unique constraint violation (rule already exists)
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        console.log('[LOYALTY_INIT] vendor_refer_friend rule already exists');
        return true;
      }
      console.error('[LOYALTY_INIT] ❌ Error ensuring vendor_refer_friend rule:', error);
      return false;
    }
  }

  /**
   * Initialize all required referral rules
   */
  async initializeReferralRules(): Promise<{ referralSignup: boolean; referFriend: boolean }> {
    const referralSignup = await this.ensureReferralSignupRule();
    const referFriend = await this.ensureReferFriendRule();
    
    return {
      referralSignup,
      referFriend,
    };
  }

  /**
   * Initialize all vendor referral rules
   */
  async initializeVendorReferralRules(): Promise<{ vendorReferFriend: boolean }> {
    const vendorReferFriend = await this.ensureVendorReferFriendRule();
    
    return {
      vendorReferFriend,
    };
  }
}

export const loyaltyRulesInitService = new LoyaltyRulesInitService();
