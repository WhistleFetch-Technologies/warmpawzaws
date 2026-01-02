// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// ✅ LAMBDA COMPATIBILITY: Node.js compatible imports
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import {
  getBookingsRepository,
  getVendorsRepository,
  getVendorTiersRepository,
  getCommissionsRepository
} from '../../../supabase/lib/repositories/index';

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

export function tierCommissionIntegrationEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // CALCULATE COMMISSION
  // ========================================
  app.get(`${BASE_PATH}/payment/commission/calculate/:bookingId`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');

      // ✅ SQL: Get booking details
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const vendorId = booking.vendor_id || booking.vendorId;
      const serviceType = booking.service_type || booking.serviceType;
      const bookingAmount = booking.total_amount || booking.totalAmount || booking.amount || 0;

      // ✅ SQL: Get vendor's tier
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      const tierId = vendor?.tier_id || vendor?.tierId || 'default';

      // ✅ SQL: Get tier commission
      const tiersRepo = getVendorTiersRepository();
      const tier = await tiersRepo.findById(tierId);

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

      // Check if service is applicable (using features field if available)
      // Note: VendorTier schema uses 'features' JSONB field, not 'applicable_services'
      const features = tier.features || {};
      const applicableServices = features.applicable_services || features.applicableServices || [];
      const isApplicable = applicableServices.length === 0 || 
                          applicableServices.includes('all') || 
                          applicableServices.includes(serviceType);

      if (!isApplicable) {
        return sendError(c, 'Tier commission not applicable for this service type', 400);
      }

      // Check amount limits (using features field if available)
      const minBookingAmount = features.min_booking_amount || features.minBookingAmount;
      const maxBookingAmount = features.max_booking_amount || features.maxBookingAmount;
      
      if (minBookingAmount && bookingAmount < minBookingAmount) {
        return sendError(c, `Booking amount below minimum (₹${minBookingAmount})`, 400);
      }

      if (maxBookingAmount && bookingAmount > maxBookingAmount) {
        return sendError(c, `Booking amount above maximum (₹${maxBookingAmount})`, 400);
      }

      // Use commission_rate from VendorTier schema (not commission_percentage)
      const commissionPercentage = tier.commission_rate || tier.commissionRate || 15;
      const commissionAmount = (bookingAmount * commissionPercentage) / 100;
      const netAmount = bookingAmount - commissionAmount;

      const calculation = {
        bookingId,
        vendorId,
        tierId: tier.id || tier.tierId,
        tierName: tier.tier_name || tier.tierName,
        bookingAmount,
        commissionPercentage,
        commissionAmount,
        netAmount,
        serviceType,
      };

      console.log(`✅ Commission calculated for booking ${bookingId}: ₹${commissionAmount} (${commissionPercentage}%)`);

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

      // ✅ SQL: Store commission calculation
      const commissionsRepo = getCommissionsRepository();
      await commissionsRepo.create({
        id: calculationId,
        booking_id: bookingId,
        vendor_id: vendorId,
        tier_id: tierId || 'default',
        booking_amount: bookingAmount,
        commission_percentage: commissionPercentage,
        commission_amount: commissionAmount,
        net_amount: netAmount,
        service_type: serviceType,
        calculated_at: new Date().toISOString()
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
      const tiersRepo = getVendorTiersRepository();
      const tier = await tiersRepo.findById(tierId);

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

      // ✅ SQL: Get tier commission
      const tiersRepo = getVendorTiersRepository();
      const tier = await tiersRepo.findById(tierId);

      if (!tier) {
        return sendError(c, 'Tier commission not found', 404);
      }

      // ✅ SQL: Update tier commission
      const updateData: any = {
        updated_at: new Date().toISOString()
      };
      
      // Update commission_rate (VendorTier schema field)
      if (updates.commissionPercentage !== undefined) {
        updateData.commission_rate = updates.commissionPercentage;
      }
      
      // Update features JSONB field for service-specific settings
      if (updates.applicableServices || updates.minBookingAmount !== undefined || updates.maxBookingAmount !== undefined) {
        const currentFeatures = tier.features || {};
        updateData.features = {
          ...currentFeatures,
          ...(updates.applicableServices && { applicable_services: updates.applicableServices }),
          ...(updates.minBookingAmount !== undefined && { min_booking_amount: updates.minBookingAmount }),
          ...(updates.maxBookingAmount !== undefined && { max_booking_amount: updates.maxBookingAmount }),
        };
      }
      
      if (updates.isActive !== undefined) {
        updateData.is_active = updates.isActive;
      }

      await tiersRepo.update(tierId, updateData);
      
      const updatedTier = await tiersRepo.findById(tierId);

      console.log(`✅ Tier commission updated: ${tierId}`);

      return sendSuccess(c, { tier: updatedTier }, 'Tier commission updated successfully');
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
      // ✅ SQL: Get all active tier commissions
      const tiersRepo = getVendorTiersRepository();
      const allTiers = await tiersRepo.findAllActive();

      const tiers = allTiers.filter((t: any) => t.is_active !== false && t.isActive !== false);

      // Sort by commission rate (commission_rate in VendorTier schema)
      tiers.sort((a: any, b: any) => {
        const aPct = a.commission_rate || a.commissionRate || 0;
        const bPct = b.commission_rate || b.commissionRate || 0;
        return aPct - bPct;
      });

      return sendSuccess(c, { tiers, count: tiers.length });
    } catch (error) {
      console.error('Error listing tier commissions:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Tier Commission Integration endpoints registered');
}
