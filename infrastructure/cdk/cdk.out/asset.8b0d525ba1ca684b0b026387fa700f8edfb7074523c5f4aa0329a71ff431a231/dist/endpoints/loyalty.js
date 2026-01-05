"use strict";
/**
 * ============================================================================
 * LOYALTY & REFERRALS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Handles loyalty points and referrals:
 * - Earn/redeem loyalty points
 * - Get loyalty profile
 * - Referral code management
 * - Transaction history
 *
 * Migrated from: supabase/functions/make-server-3dd53475/loyalty-endpoints-sql.tsx
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLoyaltyEndpoints = registerLoyaltyEndpoints;
const rds_connection_1 = require("../database/rds-connection");
function registerLoyaltyEndpoints(app) {
    /**
     * GET /loyalty/profile/:customerId
     * Get customer loyalty profile
     */
    app.get("/loyalty/profile/:customerId", async (c) => {
        try {
            const { customerId } = c.req.param();
            // Get or create loyalty profile
            let profile = await (0, rds_connection_1.select)('customer_loyalty_points', { customer_id: customerId });
            if (profile.length === 0) {
                const newProfile = await (0, rds_connection_1.insert)('customer_loyalty_points', {
                    customer_id: customerId,
                    total_points: 0,
                    lifetime_points_earned: 0,
                    lifetime_points_redeemed: 0,
                });
                profile = newProfile;
            }
            // Get referral code
            const referrals = await (0, rds_connection_1.select)('referrals', { referrer_id: customerId });
            let referralCode = '';
            if (referrals.length > 0) {
                referralCode = referrals[0].referral_code;
            }
            else {
                // Generate new referral code
                const code = `REF${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                await (0, rds_connection_1.insert)('referrals', {
                    referrer_id: customerId,
                    referral_code: code,
                });
                referralCode = code;
            }
            // Get transaction history
            const transactions = await (0, rds_connection_1.query)(`SELECT * FROM loyalty_transactions
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT 50`, [customerId]);
            return c.json({
                success: true,
                profile: {
                    customerId,
                    pointsBalance: parseInt(profile[0]?.total_points || '0', 10), // Schema uses INTEGER, not NUMERIC
                    totalPointsEarned: parseInt(profile[0]?.lifetime_points_earned || '0', 10),
                    totalPointsRedeemed: parseInt(profile[0]?.lifetime_points_redeemed || '0', 10),
                    referralCode,
                    transactions: transactions.rows,
                },
            });
        }
        catch (error) {
            console.error('Error fetching loyalty profile:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /loyalty/earn
     * Earn loyalty points
     */
    app.post("/loyalty/earn", async (c) => {
        try {
            const { customerId, amount, referenceType, referenceId, description } = await c.req.json();
            if (!customerId || amount === undefined) {
                return c.json({ error: 'customerId and amount are required' }, 400);
            }
            // Get active loyalty rule
            const rules = await (0, rds_connection_1.select)('loyalty_rules', { is_active: true });
            if (rules.length === 0) {
                return c.json({ error: 'Loyalty points earning is not configured' }, 400);
            }
            const rule = rules[0];
            const points = Math.floor(amount * parseFloat(rule.points_per_rupee || '1'));
            if (points <= 0) {
                return c.json({ error: 'Amount too low to earn points' }, 400);
            }
            // Get or create profile
            let profile = await (0, rds_connection_1.select)('customer_loyalty_points', { customer_id: customerId });
            if (profile.length === 0) {
                profile = await (0, rds_connection_1.insert)('customer_loyalty_points', {
                    customer_id: customerId,
                    total_points: 0,
                    lifetime_points_earned: 0,
                    lifetime_points_redeemed: 0,
                });
            }
            // Create transaction
            await (0, rds_connection_1.insert)('loyalty_transactions', {
                customer_id: customerId,
                transaction_type: 'earned',
                points: points,
                reference_type: referenceType || null,
                reference_id: referenceId || null,
                description: description || `Earned ${points} points`,
            });
            // Update profile
            await (0, rds_connection_1.query)(`UPDATE customer_loyalty_points
         SET total_points = total_points + $1,
             lifetime_points_earned = lifetime_points_earned + $1
         WHERE customer_id = $2`, [points, customerId]);
            const updatedProfile = await (0, rds_connection_1.select)('customer_loyalty_points', { customer_id: customerId });
            return c.json({
                success: true,
                pointsEarned: points,
                totalPoints: parseInt(updatedProfile[0]?.total_points || '0', 10), // Schema uses INTEGER
                message: 'Points earned successfully',
            });
        }
        catch (error) {
            console.error('Error earning loyalty points:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /loyalty/redeem
     * Redeem loyalty points
     */
    app.post("/loyalty/redeem", async (c) => {
        try {
            const { customerId, points, referenceType, referenceId, description } = await c.req.json();
            if (!customerId || points === undefined) {
                return c.json({ error: 'customerId and points are required' }, 400);
            }
            // Get active loyalty rule
            const rules = await (0, rds_connection_1.select)('loyalty_rules', { is_active: true });
            if (rules.length === 0) {
                return c.json({ error: 'Loyalty points redemption is not configured' }, 400);
            }
            const rule = rules[0];
            const minRedemption = parseInt(rule.min_redemption_points || '100', 10);
            if (points < minRedemption) {
                return c.json({ error: `Minimum ${minRedemption} points required for redemption` }, 400);
            }
            // Check balance
            let profile = await (0, rds_connection_1.select)('customer_loyalty_points', { customer_id: customerId });
            if (profile.length === 0 || parseInt(profile[0]?.total_points || '0', 10) < points) {
                return c.json({ error: 'Insufficient loyalty points' }, 400);
            }
            // Create transaction
            await (0, rds_connection_1.insert)('loyalty_transactions', {
                customer_id: customerId,
                transaction_type: 'redeemed',
                points: -points,
                reference_type: referenceType || null,
                reference_id: referenceId || null,
                description: description || `Redeemed ${points} points`,
            });
            // Update profile
            await (0, rds_connection_1.query)(`UPDATE customer_loyalty_points
         SET total_points = total_points - $1,
             lifetime_points_redeemed = lifetime_points_redeemed + $1
         WHERE customer_id = $2`, [points, customerId]);
            const updatedProfile = await (0, rds_connection_1.select)('customer_loyalty_points', { customer_id: customerId });
            const cashValue = points / parseFloat(rule.redemption_rate || '100');
            return c.json({
                success: true,
                pointsRedeemed: points,
                cashValue,
                remainingPoints: parseInt(updatedProfile[0]?.total_points || '0', 10), // Schema uses INTEGER
                message: 'Points redeemed successfully',
            });
        }
        catch (error) {
            console.error('Error redeeming loyalty points:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * GET /loyalty/transactions/:customerId
     * Get loyalty transaction history
     */
    app.get("/loyalty/transactions/:customerId", async (c) => {
        try {
            const { customerId } = c.req.param();
            const limit = parseInt(c.req.query('limit') || '50', 10);
            const offset = parseInt(c.req.query('offset') || '0', 10);
            const transactions = await (0, rds_connection_1.query)(`SELECT * FROM loyalty_transactions
         WHERE customer_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`, [customerId, limit, offset]);
            return c.json({
                success: true,
                transactions: transactions.rows,
                total: transactions.rows.length,
            });
        }
        catch (error) {
            console.error('Error fetching loyalty transactions:', error);
            return c.json({ error: error.message }, 500);
        }
    });
    /**
     * POST /referrals/apply
     * Apply referral code
     */
    app.post("/referrals/apply", async (c) => {
        try {
            const { customerId, referralCode } = await c.req.json();
            if (!customerId || !referralCode) {
                return c.json({ error: 'customerId and referralCode are required' }, 400);
            }
            // Find referral
            const referrals = await (0, rds_connection_1.select)('referrals', { referral_code: referralCode });
            if (referrals.length === 0) {
                return c.json({ error: 'Invalid referral code' }, 400);
            }
            const referral = referrals[0];
            // Check if customer is trying to use their own code
            if (referral.referrer_id === customerId) {
                return c.json({ error: 'Cannot use your own referral code' }, 400);
            }
            // Check if already used
            const existing = await (0, rds_connection_1.query)('SELECT * FROM referrals WHERE referred_id = $1', [customerId]);
            if (existing.rows.length > 0) {
                return c.json({ error: 'Referral code already used' }, 400);
            }
            // Update referral
            await (0, rds_connection_1.query)(`UPDATE referrals
         SET referred_id = $1,
             referred_at = NOW()
         WHERE id = $2`, [customerId, referral.id]);
            // Award points to both referrer and referred (if configured)
            const rules = await (0, rds_connection_1.select)('loyalty_rules', { is_active: true });
            if (rules.length > 0) {
                const referralPoints = 100; // Default referral bonus
                // Award to referrer
                await (0, rds_connection_1.query)(`UPDATE customer_loyalty_points
           SET total_points = total_points + $1,
               lifetime_points_earned = lifetime_points_earned + $1
           WHERE customer_id = $2`, [referralPoints, referral.referrer_id]);
                // Award to referred
                await (0, rds_connection_1.query)(`UPDATE customer_loyalty_points
           SET total_points = total_points + $1,
               lifetime_points_earned = lifetime_points_earned + $1
           WHERE customer_id = $2`, [referralPoints, customerId]);
            }
            return c.json({
                success: true,
                message: 'Referral code applied successfully',
            });
        }
        catch (error) {
            console.error('Error applying referral code:', error);
            return c.json({ error: error.message }, 500);
        }
    });
}
//# sourceMappingURL=loyalty.js.map