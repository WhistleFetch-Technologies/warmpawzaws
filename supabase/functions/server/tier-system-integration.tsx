import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

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

export function tierSystemIntegration(app: Hono, kv: any) {
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
  async function getVendorTier(vendorId: string): Promise<VendorTier> {
    let tierData = await kv.get(`vendor:${vendorId}:tier`);
    
    if (!tierData) {
      // Initialize new vendor with Bronze tier
      tierData = {
        vendorId,
        currentTier: 'bronze',
        tierLevel: 1,
        commissionRate: 5.0,
        joinedTierAt: new Date().toISOString(),
        lifetime: {
          totalRevenue: 0,
          totalBookings: 0,
          totalCommissionPaid: 0
        }
      };
      await kv.set(`vendor:${vendorId}:tier`, tierData);
    }

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
    // Get last 30 days revenue
    const bookings = await kv.getByPrefix(`booking:`) || [];
    const vendorBookings = bookings
      .map((item: any) => item.value || item)
      .filter((b: any) => b.vendorId === vendorId);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentBookings = vendorBookings.filter((b: any) => 
      new Date(b.createdAt) >= thirtyDaysAgo && b.status === 'completed'
    );

    const monthlyRevenue = recentBookings.reduce((sum: number, b: any) => sum + (b.totalAmount || 0), 0);
    const totalBookings = vendorBookings.filter((b: any) => b.status === 'completed').length;

    // Get vendor rating
    const vendor = await kv.get(`vendor:${vendorId}`) || {};
    const rating = vendor.rating || 0;
    const reviews = vendor.totalReviews || 0;

    return {
      monthlyRevenue,
      totalBookings,
      rating,
      reviews
    };
  }

  /**
   * Upgrade vendor tier
   */
  async function upgradeTier(vendorId: string, newTierId: string): Promise<VendorTier> {
    const tierData = await getVendorTier(vendorId);
    const newTier = TIER_CONFIGS[newTierId];

    if (!newTier) {
      throw new Error('Invalid tier');
    }

    if (newTier.level <= tierData.tierLevel) {
      throw new Error('Cannot downgrade or upgrade to same tier');
    }

    // Update tier
    tierData.currentTier = newTierId;
    tierData.tierLevel = newTier.level;
    tierData.commissionRate = newTier.commissionRate;
    tierData.upgradedAt = new Date().toISOString();

    await kv.set(`vendor:${vendorId}:tier`, tierData);

    // Log tier change
    await kv.set(`tier:upgrade:${Date.now()}`, {
      vendorId,
      fromTier: tierData.currentTier,
      toTier: newTierId,
      timestamp: new Date().toISOString()
    });

    console.log(`🏆 Vendor ${vendorId} upgraded to ${newTier.name}`);

    return tierData;
  }

  /**
   * Track commission for booking
   */
  async function trackCommission(vendorId: string, bookingId: string, amount: number) {
    const tierData = await getVendorTier(vendorId);
    const commission = calculateCommission(amount, tierData.currentTier);

    // Update lifetime stats
    tierData.lifetime.totalRevenue += amount;
    tierData.lifetime.totalBookings += 1;
    tierData.lifetime.totalCommissionPaid += commission;

    await kv.set(`vendor:${vendorId}:tier`, tierData);

    // Log commission
    await kv.set(`commission:${bookingId}`, {
      vendorId,
      bookingId,
      amount,
      tier: tierData.currentTier,
      commissionRate: tierData.commissionRate,
      commission,
      timestamp: new Date().toISOString()
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

      // Get commission history
      const commissions = await kv.getByPrefix(`commission:`) || [];
      const vendorCommissions = commissions
        .map((item: any) => item.value || item)
        .filter((c: any) => c.vendorId === vendorId);

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
      const tierDataList = await kv.getByPrefix('vendor:') || [];
      
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

      tierDataList.forEach((item: any) => {
        const data = item.value || item;
        if (data.currentTier) {
          analytics.totalVendors++;
          analytics.byTier[data.currentTier as keyof typeof analytics.byTier]++;
          analytics.totalCommission += data.lifetime?.totalCommissionPaid || 0;
          analytics.totalRevenue += data.lifetime?.totalRevenue || 0;
          analytics.averageCommissionRate += data.commissionRate || 0;
        }
      });

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