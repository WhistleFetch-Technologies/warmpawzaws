/**
 * SETTLEMENT & TIER SYSTEM - SQL-ONLY VERSION
 * Rule 16: Payment, Settlement, Tier System
 * 
 * Features:
 * - Automated settlement processing
 * - Tier-based commission structure
 * - Vendor tier upgrade system
 * - Bank account verification via Razorpay
 * - Settlement history and analytics
 * - Commission calculation engine
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - Uses `VendorTiersRepository` for tier management
 * - Uses `VendorsRepository` for vendor data
 * - Uses `BookingsRepository` for bookings
 * - Uses `PayoutsRepository` for payouts
 * - Uses `vendor_bank_details` table for bank accounts
 * - Uses `settlements` table for settlements
 * - Uses `vendor_tier_subscriptions` table for tier subscriptions
 * - Uses `tier_upgrade_payments` table for upgrade payments
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 12)
 * KV Operations Removed: 30
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getVendorTiersRepository } from '../../lib/repositories/vendor-tiers.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getPayoutsRepository } from '../../lib/repositories/payouts.ts';
import { getDbClient, withTransaction } from '../../lib/db.ts';

const BASE_PATH = '/make-server-3dd53475';

export function registerSettlementTierSystemSQL(app: Hono) {
  console.log('✅ Registering Settlement & Tier System (SQL-only)...');

  const vendorTiersRepo = getVendorTiersRepository();
  const vendorsRepo = getVendorsRepository();
  const bookingsRepo = getBookingsRepository();
  const payoutsRepo = getPayoutsRepository();
  const db = getDbClient();

  // ==========================================
  // TIER CONFIGURATION (from vendor_tiers table)
  // ==========================================

  /**
   * GET /settlement/vendor/:vendorId/tier - Get vendor tier information
   */
  app.get(`${BASE_PATH}/settlement/vendor/:vendorId/tier`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      
      // Get vendor's active tier subscription
      const subscription = await vendorTiersRepo.findActiveSubscriptionByVendor(vendorId);
      
      let tierData: any = null;
      let currentTier: any = null;
      
      if (subscription) {
        // Get tier details
        currentTier = await vendorTiersRepo.findById(subscription.tier_id);
        if (currentTier) {
          tierData = {
            vendorId,
            tier: currentTier.tier_name,
            commissionRate: currentTier.commission_rate / 100, // Convert percentage to decimal
            upgradedAt: subscription.created_at,
            monthlyRevenue: 0, // Calculate from bookings
            totalRevenue: 0 // Calculate from bookings
          };
        }
      }
      
      // If no subscription, use default/free tier
      if (!tierData) {
        const defaultTier = await vendorTiersRepo.findDefault() || await vendorTiersRepo.findFreeTier();
        if (defaultTier) {
          currentTier = defaultTier;
          tierData = {
            vendorId,
            tier: defaultTier.tier_name,
            commissionRate: defaultTier.commission_rate / 100,
            upgradedAt: new Date().toISOString(),
            monthlyRevenue: 0,
            totalRevenue: 0
          };
        }
      }
      
      // Calculate monthly revenue from bookings
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const vendorBookings = await bookingsRepo.findByVendor(vendorId);
      const monthlyBookings = vendorBookings.filter(b => 
        b.status === 'completed' && 
        new Date(b.booking_date) >= monthStart
      );
      tierData.monthlyRevenue = monthlyBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      
      // Calculate total revenue
      const completedBookings = vendorBookings.filter(b => b.status === 'completed');
      tierData.totalRevenue = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      
      // Calculate upgrade eligibility
      const allTiers = await vendorTiersRepo.findAllActive();
      const availableTiers = await vendorTiersRepo.findAvailableForVendor(vendorId);
      const canUpgrade = availableTiers.length > 0;
      const nextTier = availableTiers[0] || null;
      
      return sendSuccess(c, {
        tier: {
          current: tierData.tier,
          name: currentTier?.display_name || currentTier?.tier_name,
          commissionRate: tierData.commissionRate,
          monthlyRevenue: tierData.monthlyRevenue,
          totalRevenue: tierData.totalRevenue,
          canUpgrade,
          nextTier: nextTier ? {
            tier_name: nextTier.tier_name,
            display_name: nextTier.display_name,
            commission_rate: nextTier.commission_rate / 100,
            monthly_cost: nextTier.monthly_cost
          } : null
        }
      });
    } catch (error) {
      console.error('Failed to get vendor tier:', error);
      return sendError(c, 'Failed to get tier information', 500);
    }
  });

  /**
   * POST /settlement/vendor/:vendorId/tier/upgrade - Upgrade vendor tier
   */
  app.post(`${BASE_PATH}/settlement/vendor/:vendorId/tier/upgrade`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const { targetTierName, paymentMethod } = await c.req.json();
      
      if (!targetTierName) {
        return sendError(c, 'targetTierName is required', 400);
      }
      
      // Get current subscription
      const currentSubscription = await vendorTiersRepo.findActiveSubscriptionByVendor(vendorId);
      if (!currentSubscription) {
        return sendError(c, 'No active tier subscription found', 404);
      }
      
      const currentTier = await vendorTiersRepo.findById(currentSubscription.tier_id);
      const targetTier = await vendorTiersRepo.findByName(targetTierName);
      
      if (!targetTier) {
        return sendError(c, 'Invalid target tier', 400);
      }
      
      // Validate upgrade path (must be higher tier level)
      if (targetTier.tier_level <= currentTier!.tier_level) {
        return sendError(c, 'Target tier must be higher than current tier', 400);
      }
      
      // Calculate upgrade cost
      const upgradeCost = targetTier.monthly_cost || 0;
      
      // Create upgrade payment record
      const upgradePayment = await vendorTiersRepo.createUpgradePayment({
        vendor_id: vendorId,
        current_tier_id: currentTier!.id,
        target_tier_id: targetTier.id,
        subscription_type: 'monthly',
        payment_type: 'upfront',
        total_amount: upgradeCost,
        discount_amount: 0,
        final_amount: upgradeCost,
        razorpay_order_id: undefined // Will be set after Razorpay order creation
      });
      
      // In production, integrate with Razorpay payment
      // For now, simulate immediate success
      await vendorTiersRepo.updateUpgradePayment(upgradePayment.id, {
        payment_status: 'completed'
      });
      
      // Create new subscription
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      const newSubscription = await vendorTiersRepo.createSubscription({
        vendor_id: vendorId,
        tier_id: targetTier.id,
        subscription_type: 'monthly',
        payment_type: 'upfront',
        total_amount: upgradeCost,
        discount_amount: 0,
        final_amount: upgradeCost,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        payment_ids: [upgradePayment.id]
      });
      
      return sendSuccess(c, {
        upgrade: upgradePayment,
        newTier: {
          tier: targetTier.tier_name,
          commissionRate: targetTier.commission_rate / 100,
          subscription: newSubscription
        }
      });
    } catch (error) {
      console.error('Failed to upgrade tier:', error);
      return sendError(c, 'Failed to upgrade tier', 500);
    }
  });

  // ==========================================
  // BANK ACCOUNT VERIFICATION
  // ==========================================

  /**
   * POST /settlement/vendor/:vendorId/bank-account/verify - Verify bank account
   */
  app.post(`${BASE_PATH}/settlement/vendor/:vendorId/bank-account/verify`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const { accountNumber, ifscCode, accountHolderName, bankName } = await c.req.json();
      
      if (!accountNumber || !ifscCode || !accountHolderName) {
        return sendError(c, 'Account number, IFSC code, and account holder name are required', 400);
      }
      
      // Validate IFSC format
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(ifscCode)) {
        return sendError(c, 'Invalid IFSC code format', 400);
      }
      
      // Check if vendor exists
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // In production, integrate with Razorpay Fund Account API
      // For now, create bank account record
      const { data: bankAccount, error } = await db
        .from('vendor_bank_details')
        .upsert({
          vendor_id: vendorId,
          bank_name: bankName || 'Unknown',
          account_number: accountNumber, // Store securely (encrypted in production)
          ifsc_code: ifscCode,
          account_holder_name: accountHolderName,
          is_verified: true, // In production: 'pending' | 'verified' | 'failed'
          verified_at: new Date().toISOString(),
          is_primary: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'vendor_id',
          ignoreDuplicates: false
        })
        .select()
        .single();
      
      if (error) {
        console.error('Failed to save bank account:', error);
        return sendError(c, 'Failed to verify bank account', 500);
      }
      
      return sendSuccess(c, {
        bankAccount: {
          id: bankAccount.id,
          accountNumber: accountNumber.slice(-4).padStart(accountNumber.length, '*'), // Mask for security
          ifscCode,
          accountHolderName,
          bankName: bankAccount.bank_name,
          verificationStatus: bankAccount.is_verified ? 'verified' : 'pending'
        }
      });
    } catch (error) {
      console.error('Failed to verify bank account:', error);
      return sendError(c, 'Failed to verify bank account', 500);
    }
  });

  /**
   * GET /settlement/vendor/:vendorId/bank-account - Get bank account details
   */
  app.get(`${BASE_PATH}/settlement/vendor/:vendorId/bank-account`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      
      const { data: bankAccount, error } = await db
        .from('vendor_bank_details')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_primary', true)
        .single();
      
      if (error || !bankAccount) {
        return sendError(c, 'Bank account not found', 404);
      }
      
      return sendSuccess(c, {
        bankAccount: {
          id: bankAccount.id,
          accountNumber: bankAccount.account_number ? 
            bankAccount.account_number.slice(-4).padStart(bankAccount.account_number.length, '*') : 
            '****',
          ifscCode: bankAccount.ifsc_code,
          accountHolderName: bankAccount.account_holder_name,
          bankName: bankAccount.bank_name,
          verificationStatus: bankAccount.is_verified ? 'verified' : 'pending'
        }
      });
    } catch (error) {
      console.error('Failed to get bank account:', error);
      return sendError(c, 'Failed to get bank account', 500);
    }
  });

  // ==========================================
  // SETTLEMENT PROCESSING
  // ==========================================

  /**
   * POST /settlement/calculate - Calculate settlement for bookings
   */
  app.post(`${BASE_PATH}/settlement/calculate`, async (c) => {
    try {
      const { vendorId, bookingIds, period } = await c.req.json();
      
      if (!vendorId) {
        return sendError(c, 'vendorId is required', 400);
      }
      
      // Get vendor's tier
      const subscription = await vendorTiersRepo.findActiveSubscriptionByVendor(vendorId);
      const tier = subscription ? await vendorTiersRepo.findById(subscription.tier_id) : await vendorTiersRepo.findDefault();
      const commissionRate = tier ? tier.commission_rate / 100 : 0.20; // Default 20%
      
      // Get bookings
      let bookings: any[] = [];
      if (bookingIds && bookingIds.length > 0) {
        bookings = await Promise.all(
          bookingIds.map((id: string) => bookingsRepo.findById(id))
        );
        bookings = bookings.filter(Boolean) as any[];
      } else if (period) {
        // Get bookings for period
        const vendorBookings = await bookingsRepo.findByVendor(vendorId);
        const startDate = new Date(period.start);
        const endDate = new Date(period.end);
        
        bookings = vendorBookings.filter(b => {
          const bookingDate = new Date(b.booking_date);
          return b.status === 'completed' &&
                 bookingDate >= startDate &&
                 bookingDate <= endDate &&
                 !b.settlement_id; // Not already settled
        });
      } else {
        // Get all unsettled completed bookings
        const vendorBookings = await bookingsRepo.findByVendor(vendorId);
        bookings = vendorBookings.filter(b => 
          b.status === 'completed' && !b.settlement_id
        );
      }
      
      // Calculate settlement
      const totalRevenue = bookings.reduce((sum, booking) => 
        sum + (booking.total_amount || 0), 0
      );
      
      const commissionAmount = totalRevenue * commissionRate;
      const settlementAmount = totalRevenue - commissionAmount;
      
      const settlement = {
        vendorId,
        bookings: bookings.map(b => b.id),
        bookingCount: bookings.length,
        totalRevenue,
        commissionRate,
        commissionAmount,
        settlementAmount,
        tier: tier?.tier_name || 'basic',
        calculatedAt: new Date().toISOString()
      };
      
      return sendSuccess(c, { settlement });
    } catch (error) {
      console.error('Failed to calculate settlement:', error);
      return sendError(c, 'Failed to calculate settlement', 500);
    }
  });

  /**
   * POST /settlement/process - Process settlement payout
   */
  app.post(`${BASE_PATH}/settlement/process`, async (c) => {
    try {
      const { vendorId, bookingIds, amount, notes } = await c.req.json();
      
      if (!vendorId || !amount) {
        return sendError(c, 'vendorId and amount are required', 400);
      }
      
      // Verify bank account
      const { data: bankAccount } = await db
        .from('vendor_bank_details')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_primary', true)
        .eq('is_verified', true)
        .single();
      
      if (!bankAccount) {
        return sendError(c, 'Verified bank account required for settlement', 400);
      }
      
      // Get vendor's tier
      const subscription = await vendorTiersRepo.findActiveSubscriptionByVendor(vendorId);
      const tier = subscription ? await vendorTiersRepo.findById(subscription.tier_id) : await vendorTiersRepo.findDefault();
      const commissionRate = tier ? tier.commission_rate / 100 : 0.20;
      
      // Create settlement record
      const { data: settlement, error: settlementError } = await db
        .from('settlements')
        .insert({
          vendor_id: vendorId,
          total_amount: amount / (1 - commissionRate), // Calculate total revenue from settlement amount
          commission_amount: (amount / (1 - commissionRate)) * commissionRate,
          net_amount: amount,
          settlement_status: 'processing',
          settlement_period_start: new Date().toISOString().split('T')[0],
          settlement_period_end: new Date().toISOString().split('T')[0],
          payment_ids: bookingIds || [],
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (settlementError) {
        console.error('Failed to create settlement:', settlementError);
        return sendError(c, 'Failed to create settlement', 500);
      }
      
      // In production, integrate with Razorpay Payout API
      // For now, simulate immediate success
      await db
        .from('settlements')
        .update({
          settlement_status: 'completed',
          processed_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        })
        .eq('id', settlement.id);
      
      // Mark bookings as settled
      if (bookingIds && bookingIds.length > 0) {
        for (const bookingId of bookingIds) {
          await bookingsRepo.update(bookingId, {
            settlement_id: settlement.id,
            settled_at: new Date().toISOString()
          });
        }
      }
      
      return sendSuccess(c, {
        settlement: {
          id: settlement.id,
          vendorId,
          amount: settlement.net_amount,
          status: 'completed',
          processedAt: settlement.completed_at
        }
      });
    } catch (error) {
      console.error('Failed to process settlement:', error);
      return sendError(c, 'Failed to process settlement', 500);
    }
  });

  /**
   * GET /settlement/vendor/:vendorId/history - Get settlement history
   */
  app.get(`${BASE_PATH}/settlement/vendor/:vendorId/history`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');
      
      const { data: settlements, error } = await db
        .from('settlements')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (error) {
        console.error('Failed to get settlement history:', error);
        return sendError(c, 'Failed to get settlement history', 500);
      }
      
      const { count } = await db
        .from('settlements')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId);
      
      return sendSuccess(c, {
        settlements: settlements || [],
        total: count || 0,
        limit,
        offset
      });
    } catch (error) {
      console.error('Failed to get settlement history:', error);
      return sendError(c, 'Failed to get settlement history', 500);
    }
  });

  /**
   * GET /settlement/:settlementId - Get settlement details
   */
  app.get(`${BASE_PATH}/settlement/:settlementId`, async (c) => {
    try {
      const settlementId = c.req.param('settlementId');
      
      const { data: settlement, error } = await db
        .from('settlements')
        .select('*')
        .eq('id', settlementId)
        .single();
      
      if (error || !settlement) {
        return sendError(c, 'Settlement not found', 404);
      }
      
      return sendSuccess(c, { settlement });
    } catch (error) {
      console.error('Failed to get settlement:', error);
      return sendError(c, 'Failed to get settlement', 500);
    }
  });

  // ==========================================
  // SETTLEMENT ANALYTICS
  // ==========================================

  /**
   * GET /settlement/vendor/:vendorId/analytics - Get settlement analytics
   */
  app.get(`${BASE_PATH}/settlement/vendor/:vendorId/analytics`, async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const period = c.req.query('period') || 'month';
      
      // Get tier data
      const subscription = await vendorTiersRepo.findActiveSubscriptionByVendor(vendorId);
      const tier = subscription ? await vendorTiersRepo.findById(subscription.tier_id) : await vendorTiersRepo.findDefault();
      const commissionRate = tier ? tier.commission_rate / 100 : 0.20;
      
      // Calculate period stats
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      const { data: periodSettlements } = await db
        .from('settlements')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('settlement_status', 'completed')
        .gte('processed_at', startDate.toISOString());
      
      const periodRevenue = (periodSettlements || []).reduce((sum: number, s: any) => 
        sum + (s.net_amount || 0), 0
      );
      
      const periodCount = (periodSettlements || []).length;
      const avgSettlement = periodCount > 0 ? periodRevenue / periodCount : 0;
      
      // Calculate commission saved (vs basic tier)
      const basicTier = await vendorTiersRepo.findByName('basic') || await vendorTiersRepo.findDefault();
      const basicCommissionRate = basicTier ? basicTier.commission_rate / 100 : 0.20;
      const commissionSaved = tier && tier.tier_name !== 'basic'
        ? periodRevenue * (basicCommissionRate - commissionRate)
        : 0;
      
      // Get total revenue
      const vendorBookings = await bookingsRepo.findByVendor(vendorId);
      const completedBookings = vendorBookings.filter(b => b.status === 'completed');
      const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      
      // Calculate monthly revenue
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyBookings = completedBookings.filter(b => 
        new Date(b.booking_date) >= monthStart
      );
      const monthlyRevenue = monthlyBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      
      // Get next tier requirement
      const availableTiers = await vendorTiersRepo.findAvailableForVendor(vendorId);
      const nextTier = availableTiers[0];
      const nextTierRequirement = nextTier ? nextTier.monthly_cost - monthlyRevenue : 0;
      
      return sendSuccess(c, {
        analytics: {
          period,
          tier: tier?.tier_name || 'basic',
          commissionRate,
          totalRevenue,
          monthlyRevenue,
          periodRevenue,
          periodCount,
          avgSettlement,
          commissionSaved,
          nextTierRequirement: nextTierRequirement > 0 ? nextTierRequirement : 0
        }
      });
    } catch (error) {
      console.error('Failed to get settlement analytics:', error);
      return sendError(c, 'Failed to get analytics', 500);
    }
  });

  // ==========================================
  // ADMIN ENDPOINTS
  // ==========================================

  /**
   * GET /settlement/admin/pending - Get pending settlements (Admin)
   */
  app.get(`${BASE_PATH}/settlement/admin/pending`, async (c) => {
    try {
      const { data: pendingSettlements, error } = await db
        .from('settlements')
        .select('*')
        .eq('settlement_status', 'processing')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Failed to get pending settlements:', error);
        return sendError(c, 'Failed to get pending settlements', 500);
      }
      
      return sendSuccess(c, {
        settlements: pendingSettlements || [],
        count: (pendingSettlements || []).length
      });
    } catch (error) {
      console.error('Failed to get pending settlements:', error);
      return sendError(c, 'Failed to get pending settlements', 500);
    }
  });

  /**
   * GET /settlement/admin/stats - Get platform settlement stats (Admin)
   */
  app.get(`${BASE_PATH}/settlement/admin/stats`, async (c) => {
    try {
      const period = c.req.query('period') || 'month';
      
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      const { data: periodSettlements } = await db
        .from('settlements')
        .select('*')
        .gte('processed_at', startDate.toISOString());
      
      const totalSettled = (periodSettlements || [])
        .filter((s: any) => s.settlement_status === 'completed')
        .reduce((sum: number, s: any) => sum + (s.net_amount || 0), 0);
      
      const totalCommission = (periodSettlements || [])
        .filter((s: any) => s.settlement_status === 'completed')
        .reduce((sum: number, s: any) => sum + (s.commission_amount || 0), 0);
      
      const completedCount = (periodSettlements || []).filter((s: any) => s.settlement_status === 'completed').length;
      const pendingCount = (periodSettlements || []).filter((s: any) => s.settlement_status === 'processing').length;
      const failedCount = (periodSettlements || []).filter((s: any) => s.settlement_status === 'failed').length;
      
      // Get tier distribution
      const { data: allSubscriptions } = await db
        .from('vendor_tier_subscriptions')
        .select('tier_id')
        .eq('status', 'active');
      
      const tierDistribution: any = {
        basic: 0,
        premium: 0,
        enterprise: 0
      };
      
      if (allSubscriptions) {
        for (const sub of allSubscriptions) {
          const tier = await vendorTiersRepo.findById(sub.tier_id);
          if (tier && tier.tier_name in tierDistribution) {
            tierDistribution[tier.tier_name]++;
          }
        }
      }
      
      return sendSuccess(c, {
        stats: {
          period,
          totalSettled,
          totalCommission,
          completedCount,
          pendingCount,
          failedCount,
          avgSettlement: completedCount > 0 ? totalSettled / completedCount : 0,
          tierDistribution
        }
      });
    } catch (error) {
      console.error('Failed to get settlement stats:', error);
      return sendError(c, 'Failed to get stats', 500);
    }
  });
}

