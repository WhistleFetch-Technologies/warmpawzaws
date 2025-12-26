import { Hono } from "npm:hono@4";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';

/**
 * 🏆 VENDOR TIER SYSTEM INTEGRATION - SQL VERSION
 * 
 * ✅ MIGRATED: Removed all KV usage, using SQL repositories only
 * 
 * Complete tier management system with commission calculation
 * 
 * Features:
 * - 4-tier system (Bronze/Silver/Gold/Platinum)
 * - Commission by tier
 * - Tier upgrade flow
 * - Benefits management
 * - Analytics and tracking
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
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
   * ✅ SQL: Uses vendors table for tier lookup
   */
  async function getVendorTier(vendorId: string): Promise<VendorTier> {
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }
    
    // Get tier from vendor record (defaults to 'Bronze' if not set)
    const currentTier = (vendor.tier || 'Bronze').toLowerCase();
    const tierConfig = TIER_CONFIGS[currentTier] || TIER_CONFIGS.bronze;
    
    // ✅ SQL: Calculate lifetime stats from vendor_earnings
    const dbClient = getDbClient();
    const { data: earnings } = await dbClient
      .from('vendor_earnings')
      .select('amount, commission_amount')
      .eq('vendor_id', vendorId);
    
    const totalRevenue = (earnings || []).reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
    const totalCommissionPaid = (earnings || []).reduce((sum: number, e: any) => sum + (parseFloat(e.commission_amount) || 0), 0);
    
    // ✅ SQL: Count total bookings
    const { count: bookingCount } = await dbClient
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendorId)
      .eq('status', 'completed');
    
    const tierData: VendorTier = {
      vendorId,
      currentTier: currentTier,
      tierLevel: tierConfig.level,
      commissionRate: vendor.commission_percentage || tierConfig.commissionRate,
      joinedTierAt: vendor.created_at,
      lifetime: {
        totalRevenue,
        totalBookings: bookingCount || 0,
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
   * ✅ SQL: Uses bookings and vendor_earnings tables
   */
  async function getVendorMetrics(vendorId: string): Promise<any> {
    const dbClient = getDbClient();
    
    // ✅ SQL: Get last 30 days revenue from vendor_earnings
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: monthlyEarnings } = await dbClient
      .from('vendor_earnings')
      .select('amount')
      .eq('vendor_id', vendorId)
      .gte('created_at', thirtyDaysAgo.toISOString());
    
    const monthlyRevenue = (monthlyEarnings || []).reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
    
    // ✅ SQL: Count total completed bookings
    const { count: totalBookings } = await dbClient
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('vendor_id', vendorId)
      .eq('status', 'completed');

    // ✅ SQL: Get vendor rating and reviews from reviews table
    const { data: reviewsData } = await dbClient
      .from('reviews')
      .select('rating')
      .eq('vendor_id', vendorId);
    
    const reviews = reviewsData?.length || 0;
    const rating = reviews > 0 
      ? (reviewsData || []).reduce((sum: number, r: any) => sum + (parseFloat(r.rating) || 0), 0) / reviews
      : 0;

    return {
      monthlyRevenue,
      totalBookings: totalBookings || 0,
      rating,
      reviews
    };
  }

  /**
   * Upgrade vendor tier
   * ✅ SQL: Updates vendors table with new tier and commission rate
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

    const vendorsRepo = getVendorsRepository();
    const dbClient = getDbClient();
    
    // ✅ SQL: Update vendor tier and commission rate
    await vendorsRepo.update(vendorId, {
      tier: newTier.name, // Capitalize first letter to match DB constraint
      commission_percentage: newTier.commissionRate
    });

    // ✅ SQL: Log tier change in platform_settings (or create tier_upgrade_logs table if needed)
    await dbClient
      .from('platform_settings')
      .insert({
        setting_key: `tier:upgrade:${Date.now()}`,
        setting_value: {
          vendorId,
          fromTier: tierData.currentTier,
          toTier: newTierId,
          timestamp: new Date().toISOString()
        },
        setting_type: 'object'
      });

    console.log(`🏆 Vendor ${vendorId} upgraded to ${newTier.name}`);

    // Return updated tier data
    return await getVendorTier(vendorId);
  }

  /**
   * Track commission for booking
   * ✅ SQL: Commission tracking is handled by vendor_earnings table
   * This function is kept for backward compatibility but stats are calculated from SQL
   */
  async function trackCommission(vendorId: string, bookingId: string, amount: number) {
    const tierData = await getVendorTier(vendorId);
    const commission = calculateCommission(amount, tierData.currentTier);

    // ✅ SQL: Commission tracking is done in vendor_earnings table
    // Lifetime stats are calculated from SQL in getVendorTier()
    // No need to update KV - stats are read from SQL

    // ✅ SQL: Log commission in platform_settings (or use vendor_earnings table)
    const dbClient = getDbClient();
    await dbClient
      .from('platform_settings')
      .insert({
        setting_key: `commission:${bookingId}`,
        setting_value: {
          vendorId,
          bookingId,
          amount,
          tier: tierData.currentTier,
          commissionRate: tierData.commissionRate,
          commission,
          timestamp: new Date().toISOString()
        },
        setting_type: 'object'
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

      // ✅ SQL: Get commission history from vendor_earnings
      const dbClient = getDbClient();
      const { data: vendorCommissions } = await dbClient
        .from('vendor_earnings')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(10);

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
        commissionHistory: (vendorCommissions || []).map((e: any) => ({
          bookingId: e.booking_id,
          amount: e.amount,
          commission: e.commission_amount,
          commissionRate: e.commission_rate,
          timestamp: e.created_at
        })),
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
   * ✅ SQL: Uses vendors table for tier distribution
   */
  app.get(`${BASE_PATH}/admin/tier/analytics`, async (c) => {
    try {
      const dbClient = getDbClient();
      const vendorsRepo = getVendorsRepository();
      
      // ✅ SQL: Get all vendors with tier distribution
      const { data: vendors } = await dbClient
        .from('vendors')
        .select('id, tier, commission_percentage')
        .eq('is_active', true);
      
      // ✅ SQL: Get total commission and revenue from vendor_earnings
      const { data: earnings } = await dbClient
        .from('vendor_earnings')
        .select('amount, commission_amount');
      
      const totalCommission = (earnings || []).reduce((sum: number, e: any) => sum + (parseFloat(e.commission_amount) || 0), 0);
      const totalRevenue = (earnings || []).reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
      
      const byTier = {
        bronze: 0,
        silver: 0,
        gold: 0,
        platinum: 0
      };
      
      (vendors || []).forEach((v: any) => {
        const tier = (v.tier || 'Bronze').toLowerCase();
        if (byTier[tier as keyof typeof byTier] !== undefined) {
          byTier[tier as keyof typeof byTier]++;
        }
      });
      
      const totalCommissionRates = (vendors || []).reduce((sum: number, v: any) => sum + (parseFloat(v.commission_percentage) || 0), 0);
      const averageCommissionRate = vendors && vendors.length > 0 ? totalCommissionRates / vendors.length : 0;
      
      const analytics = {
        totalVendors: vendors?.length || 0,
        byTier,
        totalCommission,
        totalRevenue,
        averageCommissionRate
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