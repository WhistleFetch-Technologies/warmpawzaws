import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 🏆 VENDOR TIER SYSTEM INTEGRATION
 * 
 * Complete tier management system with commission calculation
 * 
 * Features:
 * - 4-tier system (Bronze/Silver/Gold/Platinum)
 * - Commission by tier
 * - Tier upgrade flow
 * - Benefits management
 * - Analytics and tracking
 */

interface TierConfig {
  id: string;
  name: string;
  level: number;
  commissionRate: number; // percentage
  benefits: string[];
  requirements: {
    monthlyRevenue?: number;
    totalBookings?: number;
    rating?: number;
    reviews?: number;
  };
  upgradeFee?: number;
  color: string;
  icon: string;
}

interface VendorTier {
  vendorId: string;
  currentTier: string;
  tierLevel: number;
  commissionRate: number;
  joinedTierAt: string;
  upgradedAt?: string;
  nextTier?: string;
  progressToNextTier?: {
    revenue: { current: number; required: number; percentage: number };
    bookings: { current: number; required: number; percentage: number };
    rating: { current: number; required: number; percentage: number };
  };
  lifetime: {
    totalRevenue: number;
    totalBookings: number;
    totalCommissionPaid: number;
  };
}

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { getDbClient } from '../../../supabase/lib/db';
import {
  getVendorTiersRepository,
  getVendorsRepository,
  getBookingsRepository,
  getCommissionsRepository
} from '../../../supabase/lib/repositories/index';

export function tierSystemIntegration(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // Tier Configuration
  const TIER_CONFIGS: Record<string, TierConfig> = {
    bronze: {
      id: 'bronze',
      name: 'Bronze',
      level: 1,
      commissionRate: 5.0, // 5%
      benefits: [
        'Basic dashboard access',
        'Standard support',
        '5% platform commission',
        'Basic analytics'
      ],
      requirements: {},
      color: 'bg-amber-600',
      icon: '🥉'
    },
    silver: {
      id: 'silver',
      name: 'Silver',
      level: 2,
      commissionRate: 3.0, // 3%
      benefits: [
        'Advanced dashboard',
        'Priority support',
        '3% platform commission',
        'Advanced analytics',
        'Featured listing',
        'Marketing tools'
      ],
      requirements: {
        monthlyRevenue: 50000,
        totalBookings: 50,
        rating: 4.0,
        reviews: 25
      },
      upgradeFee: 0,
      color: 'bg-gray-400',
      icon: '🥈'
    },
    gold: {
      id: 'gold',
      name: 'Gold',
      level: 3,
      commissionRate: 2.0, // 2%
      benefits: [
        'Premium dashboard',
        '24/7 priority support',
        '2% platform commission',
        'AI insights',
        'Top featured listing',
        'Advanced marketing',
        'Custom branding'
      ],
      requirements: {
        monthlyRevenue: 150000,
        totalBookings: 150,
        rating: 4.5,
        reviews: 75
      },
      upgradeFee: 0,
      color: 'bg-yellow-500',
      icon: '🥇'
    },
    platinum: {
      id: 'platinum',
      name: 'Platinum',
      level: 4,
      commissionRate: 1.0, // 1%
      benefits: [
        'Elite dashboard',
        'Dedicated account manager',
        '1% platform commission',
        'Full AI suite',
        'Premium featured listing',
        'White-label options',
        'API access',
        'Early feature access'
      ],
      requirements: {
        monthlyRevenue: 500000,
        totalBookings: 500,
        rating: 4.8,
        reviews: 200
      },
      upgradeFee: 0,
      color: 'bg-purple-600',
      icon: '💎'
    }
  };

  /**
   * Calculate commission based on tier
   */
  function calculateCommission(amount: number, tierId: string): number {
    const tier = TIER_CONFIGS[tierId] || TIER_CONFIGS.bronze;
    return (amount * tier.commissionRate) / 100;
  }

  /**
   * Get vendor tier information
   */
  async function getVendorTier(vendorId: string): Promise<any> {
    // ✅ SQL: Get vendor tier from vendors table
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      throw new Error('Vendor not found');
    }
    
    // ✅ SQL: Get tier configuration
    const tiersRepo = getVendorTiersRepository();
    const currentTierName = vendor.tier || 'bronze';
    const tierConfig = await tiersRepo.findByName(currentTierName);
    
    if (!tierConfig) {
      // Default to bronze if tier not found
      const defaultTier = await tiersRepo.findByName('bronze');
      if (!defaultTier) {
        throw new Error('Default tier not configured');
      }
      // Update vendor to bronze tier
      await vendorsRepo.update(vendorId, { tier: 'bronze', commission_percentage: defaultTier.commission_rate });
    }
    
    // ✅ SQL: Calculate lifetime stats from bookings and commissions
    const bookingsRepo = getBookingsRepository();
    const commissionsRepo = getCommissionsRepository();
    
    const allBookings = await bookingsRepo.findByVendor(vendorId);
    const completedBookings = allBookings.filter(b => b.status === 'completed');
    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    
    const commissions = await commissionsRepo.findByVendor(vendorId);
    const totalCommissionPaid = commissions.reduce((sum, c) => sum + (c.commission_amount || 0), 0);
    
    const tierData = {
      vendorId,
      currentTier: vendor.tier || 'bronze',
      tierLevel: tierConfig?.tier_level || 1,
      commissionRate: vendor.commission_percentage || tierConfig?.commission_rate || 5.0,
      joinedTierAt: vendor.created_at || new Date().toISOString(),
      lifetime: {
        totalRevenue,
        totalBookings: completedBookings.length,
        totalCommissionPaid
      }
    };

    return tierData;
  }

  /**
   * Check if vendor qualifies for tier upgrade
   */
  async function checkTierUpgradeEligibility(vendorId: string): Promise<{
    eligible: boolean;
    nextTier?: string;
    currentProgress?: any;
  }> {
    const tierData = await getVendorTier(vendorId);
    const currentTier = TIER_CONFIGS[tierData.currentTier];
    
    // Get next tier
    const nextTierLevel = currentTier.level + 1;
    const nextTier = Object.values(TIER_CONFIGS).find(t => t.level === nextTierLevel);
    
    if (!nextTier) {
      return { eligible: false }; // Already at max tier
    }

    // Get vendor metrics
    const metrics = await getVendorMetrics(vendorId);

    // Check requirements
    const requirements = nextTier.requirements;
    const progress = {
      revenue: {
        current: metrics.monthlyRevenue,
        required: requirements.monthlyRevenue || 0,
        met: metrics.monthlyRevenue >= (requirements.monthlyRevenue || 0),
        percentage: Math.min(100, ((metrics.monthlyRevenue / (requirements.monthlyRevenue || 1)) * 100))
      },
      bookings: {
        current: metrics.totalBookings,
        required: requirements.totalBookings || 0,
        met: metrics.totalBookings >= (requirements.totalBookings || 0),
        percentage: Math.min(100, ((metrics.totalBookings / (requirements.totalBookings || 1)) * 100))
      },
      rating: {
        current: metrics.rating,
        required: requirements.rating || 0,
        met: metrics.rating >= (requirements.rating || 0),
        percentage: Math.min(100, ((metrics.rating / (requirements.rating || 1)) * 100))
      },
      reviews: {
        current: metrics.reviews,
        required: requirements.reviews || 0,
        met: metrics.reviews >= (requirements.reviews || 0),
        percentage: Math.min(100, ((metrics.reviews / (requirements.reviews || 1)) * 100))
      }
    };

    const eligible = Object.values(progress).every((p: any) => p.met);

    return {
      eligible,
      nextTier: nextTier.id,
      currentProgress: progress
    };
  }

  /**
   * Get vendor metrics for tier calculation
   */
  async function getVendorMetrics(vendorId: string): Promise<any> {
    // ✅ SQL: Get bookings from last 30 days
    const bookingsRepo = getBookingsRepository();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const allBookings = await bookingsRepo.findByVendor(vendorId);
    const recentBookings = allBookings.filter((b: any) => 
      new Date(b.created_at) >= thirtyDaysAgo && b.status === 'completed'
    );

    const monthlyRevenue = recentBookings.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);
    const completedBookings = allBookings.filter((b: any) => b.status === 'completed');
    const totalBookings = completedBookings.length;

    // ✅ SQL: Get vendor rating
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    
    // Get reviews count (assuming reviews are in a reviews table)
    const db = getDbClient();
    const { data: reviews } = await db
      .from('reviews')
      .select('*')
      .eq('vendor_id', vendorId);
    
    const rating = vendor?.rating || 0;
    const reviewsCount = reviews?.length || 0;

    return {
      monthlyRevenue,
      totalBookings,
      rating,
      reviews: reviewsCount
    };
  }

  /**
   * Upgrade vendor tier
   */
  async function upgradeTier(vendorId: string, newTierId: string): Promise<any> {
    const tierData = await getVendorTier(vendorId);
    const newTier = TIER_CONFIGS[newTierId];

    if (!newTier) {
      throw new Error('Invalid tier');
    }

    if (newTier.level <= tierData.tierLevel) {
      throw new Error('Cannot downgrade or upgrade to same tier');
    }

    // ✅ SQL: Update vendor tier in vendors table
    const vendorsRepo = getVendorsRepository();
    await vendorsRepo.update(vendorId, {
      tier: newTierId,
      commission_percentage: newTier.commissionRate
    });

    // ✅ SQL: Log tier upgrade (store in a tier_upgrades table or platform_settings)
    const db = getDbClient();
    await db
      .from('vendor_tier_history')
      .insert({
        vendor_id: vendorId,
        from_tier: tierData.currentTier,
        to_tier: newTierId,
        upgraded_at: new Date().toISOString()
      })
      .catch(() => {
        // Table might not exist, skip logging
        console.warn('tier_upgrades table not found, skipping log');
      });

    console.log(`🏆 Vendor ${vendorId} upgraded to ${newTier.name}`);

    return {
      ...tierData,
      currentTier: newTierId,
      tierLevel: newTier.level,
      commissionRate: newTier.commissionRate,
      upgradedAt: new Date().toISOString()
    };
  }

  /**
   * Track commission for booking
   */
  async function trackCommission(vendorId: string, bookingId: string, amount: number) {
    const tierData = await getVendorTier(vendorId);
    const commission = calculateCommission(amount, tierData.currentTier);

    // ✅ SQL: Create commission record
    const commissionsRepo = getCommissionsRepository();
    await commissionsRepo.create({
      vendor_id: vendorId,
      booking_id: bookingId,
      total_amount: amount,
      commission_amount: commission,
      vendor_amount: amount - commission,
      commission_rate: tierData.commissionRate
    });

    return { commission, tierData };
  }

  // ============================================
  // API ENDPOINTS
  // ============================================

  /**
   * GET /vendor/:vendorId/tier
   * Get vendor tier information
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/tier`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const tierData = await getVendorTier(vendorId);
      const tierConfig = TIER_CONFIGS[tierData.currentTier];

      // Check upgrade eligibility
      const upgradeCheck = await checkTierUpgradeEligibility(vendorId);

      return sendSuccess(c, {
        tier: tierData,
        config: tierConfig,
        upgrade: upgradeCheck
      });

    } catch (error) {
      console.error('❌ Error fetching tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /tiers
   * Get all tier configurations
   */
  app.get(`${BASE_PATH}/tiers`, async (c) => {
    try {
      return sendSuccess(c, { tiers: Object.values(TIER_CONFIGS) });
    } catch (error) {
      console.error('❌ Error fetching tiers:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tier/upgrade
   * Upgrade vendor tier
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/tier/upgrade`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { tierId } = await c.req.json();

      // Check eligibility
      const upgradeCheck = await checkTierUpgradeEligibility(vendorId);
      
      if (!upgradeCheck.eligible) {
        return sendError(c, 'Vendor does not meet requirements for upgrade', 400);
      }

      if (upgradeCheck.nextTier !== tierId) {
        return sendError(c, 'Can only upgrade to next tier level', 400);
      }

      // Upgrade
      const updatedTier = await upgradeTier(vendorId, tierId);

      return sendSuccess(c, {
        tier: updatedTier,
        message: `Congratulations! Upgraded to ${TIER_CONFIGS[tierId].name} tier`
      });

    } catch (error) {
      console.error('❌ Error upgrading tier:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/tier/calculate-commission
   * Calculate commission for amount
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/tier/calculate-commission`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { amount } = await c.req.json();

      const tierData = await getVendorTier(vendorId);
      const commission = calculateCommission(amount, tierData.currentTier);
      const vendorEarnings = amount - commission;

      return sendSuccess(c, {
        amount,
        tier: tierData.currentTier,
        commissionRate: tierData.commissionRate,
        commission,
        vendorEarnings
      });

    } catch (error) {
      console.error('❌ Error calculating commission:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/tier/analytics
   * Get tier analytics
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/tier/analytics`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      const tierData = await getVendorTier(vendorId);
      const metrics = await getVendorMetrics(vendorId);
      const upgradeCheck = await checkTierUpgradeEligibility(vendorId);

      // ✅ SQL: Get commission history
      const commissionsRepo = getCommissionsRepository();
      const vendorCommissions = await commissionsRepo.findByVendor(vendorId, { limit: 10 });

      const analytics = {
        currentTier: {
          id: tierData.currentTier,
          name: TIER_CONFIGS[tierData.currentTier].name,
          level: tierData.tierLevel,
          commissionRate: tierData.commissionRate,
          joinedAt: tierData.joinedTierAt
        },
        lifetime: tierData.lifetime,
        currentMonth: metrics,
        commissionHistory: vendorCommissions.slice(0, 10),
        nextTier: upgradeCheck.eligible ? {
          id: upgradeCheck.nextTier,
          name: TIER_CONFIGS[upgradeCheck.nextTier!].name,
          progress: upgradeCheck.currentProgress
        } : null
      };

      return sendSuccess(c, { analytics });

    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/tier/analytics
   * Get platform-wide tier analytics
   */
  app.get(`${BASE_PATH}/admin/tier/analytics`, async (c) => {
    try {
      // ✅ SQL: Get all vendors with tier data
      const vendorsRepo = getVendorsRepository();
      const vendors = await vendorsRepo.findAll();
      
      const analytics = {
        totalVendors: 0,
        byTier: {
          bronze: 0,
          silver: 0,
          gold: 0,
          platinum: 0
        },
        totalCommission: 0,
        totalRevenue: 0,
        averageCommissionRate: 0
      };

      // ✅ SQL: Get commission totals (sum from database query)
      const db = getDbClient();
      const { data: allCommissions } = await db
        .from('commissions')
        .select('commission_amount');
      const totalCommission = (allCommissions || []).reduce((sum: number, c: any) => sum + (c.commission_amount || 0), 0);
      
      // ✅ SQL: Get revenue from bookings (sum from database query)
      const db2 = getDbClient();
      const { data: completedBookings } = await db2
        .from('bookings')
        .select('total_amount')
        .eq('status', 'completed');
      const totalRevenue = (completedBookings || []).reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0);

      vendors.forEach((vendor: any) => {
        if (vendor.tier) {
          analytics.totalVendors++;
          const tierName = vendor.tier.toLowerCase();
          if (tierName in analytics.byTier) {
            analytics.byTier[tierName as keyof typeof analytics.byTier]++;
          }
          analytics.averageCommissionRate += vendor.commission_percentage || 0;
        }
      });

      analytics.totalCommission = totalCommission;
      analytics.totalRevenue = totalRevenue;

      if (analytics.totalVendors > 0) {
        analytics.averageCommissionRate /= analytics.totalVendors;
      }

      return sendSuccess(c, { analytics });

    } catch (error) {
      console.error('❌ Error fetching admin analytics:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Tier System Integration registered');
}