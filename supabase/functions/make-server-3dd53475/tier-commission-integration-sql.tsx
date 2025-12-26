/**
 * ============================================================================
 * TIER COMMISSION INTEGRATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Phase 7C: Payment & Settlement - Rule 15 Implementation
 * 
 * Features:
 * - Tier-based commission calculation
 * - Dynamic commission rates
 * - Service-specific commission rules
 * - Commission application and tracking
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `vendor_tiers` table for tier information
 * - Uses `bookings` table for booking details
 * - Uses `platform_settings` for commission calculations storage
 * 
 * Date: 2025-01-28
 * Migration: Batch 15 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const bookingsRepo = getBookingsRepository();
const vendorsRepo = getVendorsRepository();

interface TierCommission {
  tierId: string;
  tierName: string;
  commissionPercentage: number;
  applicableServices: string[];
  minBookingAmount?: number;
  maxBookingAmount?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CommissionCalculation {
  calculationId: string;
  bookingId: string;
  vendorId: string;
  tierId: string;
  bookingAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  netAmount: number;
  serviceType: string;
  calculatedAt: string;
}

export function tierCommissionIntegrationEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // CALCULATE COMMISSION
  // ========================================
  app.get(`${BASE_PATH}/payment/commission/calculate/:bookingId`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');

      // ✅ SQL: Get booking details
      const booking = await bookingsRepo.findById(bookingId);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const vendorId = booking.vendor_id;
      const serviceType = booking.service_type;
      const bookingAmount = booking.total_amount || 0;

      if (!vendorId) {
        return sendError(c, 'Vendor not found for this booking', 404);
      }

      // ✅ SQL: Get vendor's tier
      const vendor = await vendorsRepo.findById(vendorId);
      const tierId = (vendor as any)?.tier || 'default';

      // ✅ SQL: Get tier commission from vendor_tiers table
      const { data: tierData, error: tierError } = await db
        .from('vendor_tiers')
        .select('*')
        .eq('tier_id', tierId)
        .single();

      if (tierError || !tierData) {
        // Use default commission if tier not found
        const defaultCommission = 15; // 15%
        const commissionAmount = (bookingAmount * defaultCommission) / 100;
        const netAmount = bookingAmount - commissionAmount;

        return sendSuccess(c, {
          bookingAmount,
          commissionPercentage: defaultCommission,
          commissionAmount,
          netAmount,
          tierId: 'default',
          note: 'Using default commission rate',
        });
      }

      // Get tier commission config from platform_settings
      const { data: tierCommissionSetting } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `tier_commission_${tierId}`)
        .single();

      const tier: TierCommission = tierCommissionSetting?.value || {
        tierId: tierData.tier_id,
        tierName: tierData.tier_name,
        commissionPercentage: tierData.commission_percentage || 15,
        applicableServices: ['all'],
        isActive: true,
        createdAt: tierData.created_at,
        updatedAt: tierData.updated_at
      };

      // Check if service is applicable
      const isApplicable = tier.applicableServices.includes('all') || 
                          tier.applicableServices.includes(serviceType);

      if (!isApplicable) {
        return sendError(c, 'Tier commission not applicable for this service type', 400);
      }

      // Check amount limits
      if (tier.minBookingAmount && bookingAmount < tier.minBookingAmount) {
        return sendError(c, `Booking amount below minimum (₹${tier.minBookingAmount})`, 400);
      }

      if (tier.maxBookingAmount && bookingAmount > tier.maxBookingAmount) {
        return sendError(c, `Booking amount above maximum (₹${tier.maxBookingAmount})`, 400);
      }

      const commissionAmount = (bookingAmount * tier.commissionPercentage) / 100;
      const netAmount = bookingAmount - commissionAmount;

      const calculation = {
        bookingId,
        vendorId,
        tierId: tier.tierId,
        tierName: tier.tierName,
        bookingAmount,
        commissionPercentage: tier.commissionPercentage,
        commissionAmount,
        netAmount,
        serviceType,
      };

      console.log(`✅ Commission calculated for booking ${bookingId}: ₹${commissionAmount} (${tier.commissionPercentage}%)`);

      return sendSuccess(c, calculation);
    } catch (error) {
      console.error('Error calculating commission:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // APPLY COMMISSION
  // ========================================
  app.post(`${BASE_PATH}/payment/commission/apply`, async (c) => {
    try {
      const {
        bookingId,
        vendorId,
        tierId,
        bookingAmount,
        commissionPercentage,
        serviceType,
      } = await c.req.json();

      if (!bookingId || !vendorId || !bookingAmount) {
        return sendError(c, 'Required fields missing', 400);
      }

      const calculationId = `comm_calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const commissionAmount = (bookingAmount * commissionPercentage) / 100;
      const netAmount = bookingAmount - commissionAmount;

      const calculation: CommissionCalculation = {
        calculationId,
        bookingId,
        vendorId,
        tierId: tierId || 'default',
        bookingAmount,
        commissionPercentage,
        commissionAmount,
        netAmount,
        serviceType,
        calculatedAt: now,
      };

      // ✅ SQL: Store commission calculation in platform_settings
      await db
        .from('platform_settings')
        .upsert({
          key: `commission_calculation_${calculationId}`,
          value: calculation
        }, {
          onConflict: 'key'
        });

      // ✅ SQL: Link calculation to booking
      await db
        .from('platform_settings')
        .upsert({
          key: `commission_calculation_booking_${bookingId}`,
          value: { calculationId }
        }, {
          onConflict: 'key'
        });

      // ✅ SQL: Track vendor commission history
      const { data: vendorCommissionsSetting } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `vendor_commissions_${vendorId}`)
        .single();

      const vendorCommissions = vendorCommissionsSetting?.value?.calculationIds || [];
      vendorCommissions.push(calculationId);

      await db
        .from('platform_settings')
        .upsert({
          key: `vendor_commissions_${vendorId}`,
          value: { calculationIds: vendorCommissions }
        }, {
          onConflict: 'key'
        });

      console.log(`✅ Commission applied: ${calculationId} - ₹${commissionAmount}`);

      return sendSuccess(c, { calculation }, 'Commission applied successfully');
    } catch (error) {
      console.error('Error applying commission:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET TIER COMMISSION
  // ========================================
  app.get(`${BASE_PATH}/payment/commission/tier/:tierId`, async (c) => {
    try {
      const tierId = c.req.param('tierId');

      // ✅ SQL: Get tier commission
      const { data: tierSetting } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `tier_commission_${tierId}`)
        .single();

      if (!tierSetting?.value) {
        return sendError(c, 'Tier commission not found', 404);
      }

      return sendSuccess(c, { tier: tierSetting.value });
    } catch (error) {
      console.error('Error getting tier commission:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPDATE TIER COMMISSION
  // ========================================
  app.put(`${BASE_PATH}/payment/commission/tier/:tierId/update`, async (c) => {
    try {
      const tierId = c.req.param('tierId');
      const updates = await c.req.json();

      // ✅ SQL: Get tier commission
      const { data: tierSetting } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `tier_commission_${tierId}`)
        .single();

      if (!tierSetting?.value) {
        return sendError(c, 'Tier commission not found', 404);
      }

      const tier = tierSetting.value;

      // Update allowed fields
      if (updates.commissionPercentage !== undefined) {
        tier.commissionPercentage = updates.commissionPercentage;
      }
      if (updates.applicableServices) {
        tier.applicableServices = updates.applicableServices;
      }
      if (updates.minBookingAmount !== undefined) {
        tier.minBookingAmount = updates.minBookingAmount;
      }
      if (updates.maxBookingAmount !== undefined) {
        tier.maxBookingAmount = updates.maxBookingAmount;
      }
      if (updates.isActive !== undefined) {
        tier.isActive = updates.isActive;
      }

      tier.updatedAt = new Date().toISOString();

      // ✅ SQL: Update tier commission
      await db
        .from('platform_settings')
        .update({
          value: tier
        })
        .eq('key', `tier_commission_${tierId}`);

      console.log(`✅ Tier commission updated: ${tierId}`);

      return sendSuccess(c, { tier }, 'Tier commission updated successfully');
    } catch (error) {
      console.error('Error updating tier commission:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // LIST ALL TIER COMMISSIONS
  // ========================================
  app.get(`${BASE_PATH}/payment/commission/tiers/list`, async (c) => {
    try {
      // ✅ SQL: Get all tier commissions
      const { data: tierSettings } = await db
        .from('platform_settings')
        .select('value')
        .like('key', 'tier_commission_%');

      const tiers = (tierSettings || [])
        .map((s: any) => s.value)
        .filter((t: any) => t && t.isActive !== false);

      // Sort by commission percentage
      tiers.sort((a: any, b: any) => a.commissionPercentage - b.commissionPercentage);

      return sendSuccess(c, { tiers, count: tiers.length });
    } catch (error) {
      console.error('Error listing tier commissions:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Tier Commission Integration endpoints (SQL-only) registered');
}

