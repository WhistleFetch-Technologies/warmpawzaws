/**
 * SETTLEMENT SCHEDULE & AUTOMATIC PAYOUT ENDPOINTS
 * 
 * Handles:
 * - Configurable settlement schedule settings
 * - Automatic payout processing based on schedule
 * - Razorpay Marketplace API integration for payouts
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendSuccess, sendError } from './response-utils.ts';
import { createRazorpayPayout } from './razorpay-marketplace-payout.tsx';

export function settlementScheduleEndpoints(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';

  /**
   * GET /admin/finance/settlement-schedule
   * Get settlement schedule settings
   */
  app.get(`${BASE_PATH}/admin/finance/settlement-schedule`, async (c) => {
    try {
      const settings = await kv.get('platform:settlement_schedule') || {
        enabled: true,
        scheduleType: 'daily', // 'daily', 'weekly', 'biweekly', 'monthly'
        scheduleDay: 1, // Day of week (1-7) or day of month (1-31)
        scheduleTime: '09:00', // HH:mm format
        settlementPeriodDays: 3, // T+3 default
        autoProcess: true,
        minPayoutAmount: 100, // Minimum amount to trigger payout
        timezone: 'Asia/Kolkata',
        lastProcessedAt: null,
        nextProcessAt: null
      };

      return sendSuccess(c, { settings });
    } catch (error) {
      console.error('Error fetching settlement schedule:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/finance/settlement-schedule
   * Update settlement schedule settings
   */
  app.post(`${BASE_PATH}/admin/finance/settlement-schedule`, async (c) => {
    try {
      const settings = await c.req.json();

      // Validate settings
      if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(settings.scheduleType)) {
        return sendError(c, 'Invalid schedule type', 400);
      }

      if (settings.scheduleDay < 1 || settings.scheduleDay > 31) {
        return sendError(c, 'Invalid schedule day', 400);
      }

      // Calculate next process time
      const nextProcessAt = calculateNextProcessTime(settings);

      const updatedSettings = {
        ...settings,
        updatedAt: new Date().toISOString(),
        nextProcessAt
      };

      await kv.set('platform:settlement_schedule', updatedSettings);

      console.log('✅ Settlement schedule updated:', updatedSettings);

      return sendSuccess(c, { settings: updatedSettings });
    } catch (error) {
      console.error('Error updating settlement schedule:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/finance/process-settlements
   * Manually trigger settlement processing
   */
  app.post(`${BASE_PATH}/admin/finance/process-settlements`, async (c) => {
    try {
      const { vendorIds, force } = await c.req.json();

      const result = await processSettlements(vendorIds, force === true);

      return sendSuccess(c, result);
    } catch (error) {
      console.error('Error processing settlements:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/finance/pending-settlements
   * Get all vendors with pending settlements
   */
  app.get(`${BASE_PATH}/admin/finance/pending-settlements`, async (c) => {
    try {
      const settings = await kv.get('platform:settlement_schedule') || {};
      const settlementPeriodDays = settings.settlementPeriodDays || 3;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - settlementPeriodDays);

      // Get all vendors
      const allVendors = await kv.getByPrefix('vendor:');
      const pendingSettlements: any[] = [];

      for (const vendor of allVendors) {
        if (!vendor.id) continue;

        // Get vendor's completed bookings
        const bookingIds = await kv.get(`vendor:${vendor.id}:bookings`) || [];
        let totalPending = 0;
        const pendingBookings: any[] = [];

        for (const bookingId of bookingIds) {
          const booking = await kv.get(`booking:${bookingId}`);
          if (!booking) continue;

          // Check if booking is completed and not yet settled
          if (
            booking.status === 'completed' &&
            !booking.settlementId &&
            new Date(booking.completedAt || booking.updatedAt) <= cutoffDate
          ) {
            totalPending += booking.price || 0;
            pendingBookings.push({
              bookingId: booking.id,
              amount: booking.price,
              completedAt: booking.completedAt
            });
          }
        }

        if (totalPending > 0 && totalPending >= (settings.minPayoutAmount || 100)) {
          pendingSettlements.push({
            vendorId: vendor.id,
            vendorName: vendor.businessName || vendor.fullName,
            totalPending,
            bookingCount: pendingBookings.length,
            bookings: pendingBookings
          });
        }
      }

      // Sort by total pending amount (descending)
      pendingSettlements.sort((a, b) => b.totalPending - a.totalPending);

      return sendSuccess(c, {
        settlements: pendingSettlements,
        total: pendingSettlements.length,
        totalAmount: pendingSettlements.reduce((sum, s) => sum + s.totalPending, 0)
      });
    } catch (error) {
      console.error('Error fetching pending settlements:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Settlement schedule endpoints registered');
}

/**
 * Calculate next process time based on schedule settings
 */
function calculateNextProcessTime(settings: any): string {
  const now = new Date();
  const [hours, minutes] = settings.scheduleTime.split(':').map(Number);

  let nextDate = new Date(now);

  switch (settings.scheduleType) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;

    case 'weekly':
      const daysUntilNext = (settings.scheduleDay - nextDate.getDay() + 7) % 7 || 7;
      nextDate.setDate(nextDate.getDate() + daysUntilNext);
      break;

    case 'biweekly':
      const daysUntilBiweekly = (settings.scheduleDay - nextDate.getDay() + 14) % 14 || 14;
      nextDate.setDate(nextDate.getDate() + daysUntilBiweekly);
      break;

    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      nextDate.setDate(settings.scheduleDay);
      break;
  }

  nextDate.setHours(hours, minutes, 0, 0);

  return nextDate.toISOString();
}

/**
 * Process settlements for vendors
 */
async function processSettlements(vendorIds?: string[], force: boolean = false): Promise<any> {
  const settings = await kv.get('platform:settlement_schedule') || {};
  const settlementPeriodDays = settings.settlementPeriodDays || 3;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - settlementPeriodDays);

  const vendorsToProcess = vendorIds || [];

  if (vendorIds && vendorIds.length === 0) {
    // Get all vendors with pending settlements
    const allVendors = await kv.getByPrefix('vendor:');
    for (const vendor of allVendors) {
      if (vendor.id) vendorsToProcess.push(vendor.id);
    }
  }

  const results = {
    processed: 0,
    failed: 0,
    totalAmount: 0,
    payouts: [] as any[]
  };

  for (const vendorId of vendorsToProcess) {
    try {
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) continue;

      // Get vendor's completed bookings
      const bookingIds = await kv.get(`vendor:${vendorId}:bookings`) || [];
      const pendingBookings: any[] = [];
      let totalPending = 0;

      for (const bookingId of bookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (!booking) continue;

        if (
          booking.status === 'completed' &&
          !booking.settlementId &&
          (force || new Date(booking.completedAt || booking.updatedAt) <= cutoffDate)
        ) {
          totalPending += booking.price || 0;
          pendingBookings.push(booking);
        }
      }

      if (totalPending === 0 || totalPending < (settings.minPayoutAmount || 100)) {
        continue;
      }

      // Process payout
      const payoutResult = await createAutomaticPayout(vendor, pendingBookings, totalPending);

      if (payoutResult.success) {
        results.processed++;
        results.totalAmount += totalPending;
        results.payouts.push(payoutResult.payout);
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error(`Error processing settlement for vendor ${vendorId}:`, error);
      results.failed++;
    }
  }

  // Update last processed time
  if (results.processed > 0) {
    const updatedSettings = {
      ...settings,
      lastProcessedAt: new Date().toISOString(),
      nextProcessAt: calculateNextProcessTime(settings)
    };
    await kv.set('platform:settlement_schedule', updatedSettings);
  }

  return results;
}

/**
 * Create automatic payout for vendor
 */
async function createAutomaticPayout(vendor: any, bookings: any[], totalAmount: number): Promise<any> {
  try {
    // Get vendor tier and commission rate
    const tierData = await kv.get(`vendor:${vendor.id}:tier`) || await kv.get(`vendor_tier_${vendor.id}`);
    const tier = tierData?.currentTier || 'tier_1';
    
    // Get tier config
    const tiers = await kv.get('payment:tiers') || [];
    const tierConfig = tiers.find((t: any) => t.id === tier) || tiers.find((t: any) => t.isDefault) || { commissionRate: 15 };
    
    const commissionRate = tierConfig.commissionRate || 15;
    const commissionAmount = (totalAmount * commissionRate) / 100;
    const vendorEarnings = totalAmount - commissionAmount;

    // Get bank details
    const bankDetails = await kv.get(`vendor:${vendor.id}:bank_details`);
    if (!bankDetails || !bankDetails.razorpayAccountId) {
      throw new Error('Vendor bank account not verified');
    }

    // Create payout via Razorpay Marketplace API
    const payoutResult = await createRazorpayPayout({
      accountId: bankDetails.razorpayAccountId,
      amount: vendorEarnings,
      currency: 'INR',
      notes: {
        vendorId: vendor.id,
        bookingIds: bookings.map(b => b.id).join(','),
        commissionRate,
        commissionAmount
      }
    });

    // Create payout record
    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const payout = {
      payoutId,
      vendorId: vendor.id,
      amount: vendorEarnings,
      totalAmount,
      commissionRate,
      commissionAmount,
      bookingIds: bookings.map(b => b.id),
      status: 'processing',
      razorpayPayoutId: payoutResult.id,
      bankDetails: {
        accountNumber: bankDetails.accountNumber,
        ifsc: bankDetails.ifsc,
        accountHolderName: bankDetails.accountHolderName
      },
      createdAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
      completedAt: null,
      failedAt: null,
      failureReason: null
    };

    await kv.set(`payout:${payoutId}`, payout);

    // Add to vendor's payouts
    const vendorPayouts = await kv.get(`vendor:${vendor.id}:payouts`) || [];
    vendorPayouts.unshift(payoutId);
    await kv.set(`vendor:${vendor.id}:payouts`, vendorPayouts);

    // Mark bookings as settled
    for (const booking of bookings) {
      booking.settlementId = payoutId;
      booking.settlementStatus = 'settled';
      booking.settledAt = new Date().toISOString();
      await kv.set(`booking:${booking.id}`, booking);
    }

    console.log(`✅ Automatic payout created: ${payoutId} for vendor ${vendor.id}, amount: ₹${vendorEarnings}`);

    return {
      success: true,
      payout
    };
  } catch (error) {
    console.error('Error creating automatic payout:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

