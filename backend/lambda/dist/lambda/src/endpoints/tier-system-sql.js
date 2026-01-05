"use strict";
/**
 * ============================================================================
 * TIER SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 *
 * REFACTORED: Removed all KV usage, using SQL repositories only
 *
 * Features:
 * - Vendor tier management
 * - Commission rate lookup
 * - Tier calculation based on GMV
 * - Tier upgrades
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2025-01-27
 * Migration: Phase 6 - KV to SQL (Critical P0)
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_CONFIG = void 0;
exports.tierSystemEndpoints = tierSystemEndpoints;
const db_1 = require("../lib/db");
const vendors_1 = require("../lib/repositories/vendors");
const response_utils_1 = require("./response-utils");
// Export TIER_CONFIG constant for use by other modules
exports.TIER_CONFIG = {
    SILVER: {
        id: 'silver',
        name: 'Silver',
        commissionRate: 15,
        minGMV: 0,
        benefits: ['Basic Listing', 'Standard Support']
    },
    GOLD: {
        id: 'gold',
        name: 'Gold',
        commissionRate: 10,
        minGMV: 50000, // 50k INR Monthly GMV
        benefits: ['Featured Listing', 'Priority Support', 'Lower Commission']
    },
    PLATINUM: {
        id: 'platinum',
        name: 'Platinum',
        commissionRate: 5,
        minGMV: 200000, // 2L INR Monthly GMV
        benefits: ['Top Placement', 'Dedicated Manager', 'Lowest Commission', 'Marketing Boost']
    }
};
function tierSystemEndpoints(app) {
    const BASE_PATH = "/make-server-3dd53475";
    /**
     * GET /vendor/:vendorId/tier
     * Get current tier status
     */
    app.get(`${BASE_PATH}/vendor/:vendorId/tier`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            // Get vendor
            const vendorsRepo = (0, vendors_1.getVendorsRepository)();
            const vendor = await vendorsRepo.findById(vendorId);
            if (!vendor) {
                return (0, response_utils_1.sendError)(c, 'Vendor not found', 404);
            }
            // Get current tier subscription
            const pool = await (0, db_1.getDbClient)();
            const subscriptionResult = await pool.query(`SELECT vts.*, vt.* 
         FROM vendor_tier_subscriptions vts
         LEFT JOIN vendor_tiers vt ON vts.tier_id = vt.id
         WHERE vts.vendor_id = $1 AND vts.status = $2
         ORDER BY vts.created_at DESC
         LIMIT 1`, [vendorId, 'active']);
            const subscriptionRow = subscriptionResult.rows[0] || null;
            // Get default tier if no subscription
            let tier;
            if (subscriptionRow && subscriptionRow.tier_name) {
                tier = {
                    tier_name: subscriptionRow.tier_name,
                    display_name: subscriptionRow.display_name,
                    commission_rate: subscriptionRow.commission_rate,
                    features: subscriptionRow.features || []
                };
            }
            else {
                const defaultTierResult = await pool.query('SELECT * FROM vendor_tiers WHERE is_default = $1 AND is_active = $2 LIMIT 1', [true, true]);
                const defaultTier = defaultTierResult.rows[0] || null;
                tier = defaultTier || {
                    tier_name: 'silver',
                    display_name: 'Silver',
                    commission_rate: 15,
                    features: []
                };
            }
            // Calculate monthly GMV (simplified - in production, query from analytics)
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            const monthlyBookingsResult = await pool.query('SELECT total_amount FROM bookings WHERE vendor_id = $1 AND status = $2 AND completed_at >= $3', [vendorId, 'completed', oneMonthAgo.toISOString()]);
            const monthlyBookings = monthlyBookingsResult.rows || [];
            const monthlyGMV = monthlyBookings?.reduce((sum, b) => sum + parseFloat(b.total_amount || '0'), 0) || 0;
            return (0, response_utils_1.sendSuccess)(c, {
                currentTier: tier.tier_name,
                displayName: tier.display_name,
                commissionRate: parseFloat(tier.commission_rate || '15'),
                monthlyGMV,
                features: tier.features || [],
                subscription: subscriptionRow ? {
                    subscriptionType: subscriptionRow.subscription_type,
                    startDate: subscriptionRow.start_date,
                    endDate: subscriptionRow.end_date,
                    status: subscriptionRow.status
                } : null
            });
        }
        catch (error) {
            console.error('Error getting vendor tier:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /vendor/:vendorId/tier/calculate
     * Recalculate tier based on recent performance
     */
    app.post(`${BASE_PATH}/vendor/:vendorId/tier/calculate`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const pool = await (0, db_1.getDbClient)();
            // Calculate monthly GMV
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            const monthlyBookingsResult = await pool.query('SELECT total_amount FROM bookings WHERE vendor_id = $1 AND status = $2 AND completed_at >= $3', [vendorId, 'completed', oneMonthAgo.toISOString()]);
            const monthlyBookings = monthlyBookingsResult.rows || [];
            const monthlyGMV = monthlyBookings.reduce((sum, b) => sum + parseFloat(b.total_amount || '0'), 0);
            // Find appropriate tier based on GMV
            const tiersResult = await pool.query('SELECT * FROM vendor_tiers WHERE is_active = $1 ORDER BY tier_level DESC', [true]);
            const tiers = tiersResult.rows || [];
            // Find tier that matches GMV (simplified logic - in production, use tier thresholds)
            let selectedTier = tiers?.find(t => t.tier_name === 'silver') || tiers?.[0];
            // Auto-upgrade logic (simplified)
            if (monthlyGMV >= 200000) {
                selectedTier = tiers?.find(t => t.tier_name === 'platinum') || selectedTier;
            }
            else if (monthlyGMV >= 50000) {
                selectedTier = tiers?.find(t => t.tier_name === 'gold') || selectedTier;
            }
            // Update vendor's current tier
            await pool.query('UPDATE vendors SET current_tier_id = $1, updated_at = $2 WHERE id = $3', [selectedTier?.id || null, new Date().toISOString(), vendorId]);
            return (0, response_utils_1.sendSuccess)(c, {
                newTier: selectedTier?.tier_name,
                displayName: selectedTier?.display_name,
                commissionRate: parseFloat(selectedTier?.commission_rate || '15'),
                monthlyGMV,
                message: `Vendor tier updated to ${selectedTier?.display_name}`
            });
        }
        catch (error) {
            console.error('Error calculating tier:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * GET /admin/tier-system/config
     * Get global tier configuration
     */
    app.get(`${BASE_PATH}/admin/tier-system/config`, async (c) => {
        try {
            const pool = await (0, db_1.getDbClient)();
            const tiersResult = await pool.query('SELECT * FROM vendor_tiers WHERE is_active = $1 ORDER BY tier_level ASC', [true]);
            const tiers = tiersResult.rows || [];
            return (0, response_utils_1.sendSuccess)(c, { tiers: tiers || [] });
        }
        catch (error) {
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    /**
     * POST /admin/tier-system/config
     * Update tier thresholds (Admin Only)
     */
    app.post(`${BASE_PATH}/admin/tier-system/config`, async (c) => {
        try {
            const { tiers } = await c.req.json();
            const pool = await (0, db_1.getDbClient)();
            // Update each tier
            for (const tier of tiers) {
                await (0, db_1.upsertQuery)('vendor_tiers', {
                    tier_name: tier.tier_name,
                    tier_level: tier.tier_level,
                    display_name: tier.display_name,
                    commission_rate: tier.commission_rate,
                    features: tier.features || [],
                    is_active: tier.is_active !== false,
                    updated_at: new Date().toISOString()
                }, 'tier_name');
            }
            return (0, response_utils_1.sendSuccess)(c, { message: 'Tier configuration updated' });
        }
        catch (error) {
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
}
//# sourceMappingURL=tier-system-sql.js.map