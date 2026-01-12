import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🎯 TIER COMMISSION INTEGRATION
 * 
 * Phase 7C: Payment & Settlement - Rule 15 Implementation
 * 
 * Features:
 * - Tier-based commission calculation
 * - Dynamic commission rates
 * - Service-specific commission rules
 * - Commission application and tracking
 */

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

export function tierCommissionIntegrationEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // CALCULATE COMMISSION
  // ========================================
  app.get(`${BASE_PATH}/payment/commission/calculate/:bookingId`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');

      // Get booking details
      const booking = await kv.get(`booking_${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const vendorId = booking.vendorId;
      const serviceType = booking.serviceType;
      const bookingAmount = booking.totalAmount || booking.amount || 0;

      // Get vendor's tier
      const vendor = await kv.get(`vendor_${vendorId}`);
      const tierId = vendor?.tierId || 'default';

      // Get tier commission
      const tier = await kv.get(`tier_commission_${tierId}`);

      if (!tier) {
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
        calculatedAt: new Date().toISOString(),
      };

      await kv.set(`commission_calculation_${calculationId}`, calculation);
      await kv.set(`commission_calculation_booking_${bookingId}`, calculationId);

      // Track vendor commission history
      const vendorCommissions = await kv.get(`vendor_commissions_${vendorId}`) || [];
      vendorCommissions.push(calculationId);
      await kv.set(`vendor_commissions_${vendorId}`, vendorCommissions);

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

      const tier = await kv.get(`tier_commission_${tierId}`);

      if (!tier) {
        return sendError(c, 'Tier commission not found', 404);
      }

      return sendSuccess(c, { tier });
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

      const tier = await kv.get(`tier_commission_${tierId}`);

      if (!tier) {
        return sendError(c, 'Tier commission not found', 404);
      }

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

      await kv.set(`tier_commission_${tierId}`, tier);

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
      const tiersData = await kv.getByPrefix('tier_commission_');

      const tiers = tiersData
        .map((item: any) => item.value || item)
        .filter((t: any) => t.isActive !== false);

      // Sort by commission percentage
      tiers.sort((a: any, b: any) => a.commissionPercentage - b.commissionPercentage);

      return sendSuccess(c, { tiers, count: tiers.length });
    } catch (error) {
      console.error('Error listing tier commissions:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Tier Commission Integration endpoints registered');
}
