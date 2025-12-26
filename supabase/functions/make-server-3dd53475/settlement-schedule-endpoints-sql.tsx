/**
 * SETTLEMENT SCHEDULE & AUTOMATIC PAYOUT ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Handles:
 * - Configurable settlement schedule settings
 * - Automatic payout processing based on schedule
 * - Razorpay Marketplace API integration for payouts
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (20 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { createRazorpayPayout } from './razorpay-marketplace-payout.tsx';
import { getDbClient } from '../../lib/db.ts';
import { withTransaction } from '../../lib/utils/transaction-helper.ts';
import { getSettlementsRepository } from '../../lib/repositories/settlements.ts';
import { getPayoutsRepository } from '../../lib/repositories/payouts.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorTiersRepository } from '../../lib/repositories/vendor-tiers.ts';

export function settlementScheduleEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();
  const settlementsRepo = getSettlementsRepository();
  const payoutsRepo = getPayoutsRepository();
  const vendorsRepo = getVendorsRepository();
  const bookingsRepo = getBookingsRepository();
  const vendorTiersRepo = getVendorTiersRepository();

  /**
   * GET /admin/finance/settlement-schedule
   * Get settlement schedule settings
   */
  app.get(`${BASE_PATH}/admin/finance/settlement-schedule`, async (c) => {
    try {
      // ✅ SQL: Get global settlement schedule (vendor_id is NULL)
      const { data: schedules, error } = await db
        .from('settlement_schedules')
        .select('*')
        .is('vendor_id', null)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching settlement schedule:', error);
        return sendError(c, 'Failed to fetch schedule', 500);
      }

      const schedule = schedules?.[0];

      // Default settings if no schedule exists
      const settings = schedule ? {
        enabled: schedule.is_active,
        scheduleType: schedule.schedule_type,
        scheduleDay: schedule.day_of_week || schedule.day_of_month || 1,
        scheduleTime: '09:00', // Default time
        settlementPeriodDays: 3, // T+3 default
        autoProcess: true,
        minPayoutAmount: 100, // Minimum amount to trigger payout
        timezone: 'Asia/Kolkata',
        lastProcessedAt: null,
        nextProcessAt: null
      } : {
        enabled: true,
        scheduleType: 'daily',
        scheduleDay: 1,
        scheduleTime: '09:00',
        settlementPeriodDays: 3,
        autoProcess: true,
        minPayoutAmount: 100,
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

      // ✅ SQL: Check if global schedule exists
      const { data: existing } = await db
        .from('settlement_schedules')
        .select('id')
        .is('vendor_id', null)
        .limit(1)
        .single();

      let schedule;
      if (existing) {
        // Update existing schedule
        const { data, error } = await db
          .from('settlement_schedules')
          .update({
            schedule_type: settings.scheduleType,
            day_of_week: settings.scheduleType === 'weekly' || settings.scheduleType === 'biweekly' ? settings.scheduleDay : null,
            day_of_month: settings.scheduleType === 'monthly' ? settings.scheduleDay : null,
            is_active: settings.enabled !== false
          })
          .eq('id', existing.id)
          .select()
          .single();
        schedule = data;
        if (error) throw error;
      } else {
        // Create new schedule
        const { data, error } = await db
          .from('settlement_schedules')
          .insert({
            vendor_id: null, // Global schedule
            schedule_type: settings.scheduleType,
            day_of_week: settings.scheduleType === 'weekly' || settings.scheduleType === 'biweekly' ? settings.scheduleDay : null,
            day_of_month: settings.scheduleType === 'monthly' ? settings.scheduleDay : null,
            is_active: settings.enabled !== false
          })
          .select()
          .single();
        schedule = data;
        if (error) throw error;
      }

      if (error) {
        console.error('Error updating settlement schedule:', error);
        return sendError(c, 'Failed to update schedule', 500);
      }

      const updatedSettings = {
        ...settings,
        updatedAt: new Date().toISOString(),
        nextProcessAt
      };

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
      // ✅ SQL: Get global settlement schedule
      const { data: schedules } = await db
        .from('settlement_schedules')
        .select('*')
        .is('vendor_id', null)
        .eq('is_active', true)
        .limit(1);

      const schedule = schedules?.[0];
      const settlementPeriodDays = 3; // Default T+3
      const minPayoutAmount = 100; // Default minimum

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - settlementPeriodDays);

      // ✅ SQL: Get all active vendors
      const vendors = await vendorsRepo.findAllActive();

      const pendingSettlements: any[] = [];

      for (const vendor of vendors || []) {
        // ✅ SQL: Get vendor's completed bookings
        const bookings = await bookingsRepo.findByVendor(vendor.id, {
          status: 'completed',
          limit: 1000
        });

        let totalPending = 0;
        const pendingBookings: any[] = [];

        for (const booking of bookings) {
          // Check if booking is completed and not yet settled
          if (
            booking.status === 'completed' &&
            !booking.settlement_id &&
            booking.completed_at &&
            new Date(booking.completed_at) <= cutoffDate
          ) {
            totalPending += parseFloat((booking.total_amount || 0).toString());
            pendingBookings.push({
              bookingId: booking.id,
              amount: booking.total_amount,
              completedAt: booking.completed_at
            });
          }
        }

        if (totalPending > 0 && totalPending >= minPayoutAmount) {
          pendingSettlements.push({
            vendorId: vendor.id,
            vendorName: vendor.business_name,
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

  console.log('✅ Settlement schedule endpoints registered (SQL-only)');
}

/**
 * Calculate next process time based on schedule settings
 */
function calculateNextProcessTime(settings: any): string {
  const now = new Date();
  const [hours, minutes] = (settings.scheduleTime || '09:00').split(':').map(Number);

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
  const db = getDbClient();
  const settlementsRepo = getSettlementsRepository();
  const payoutsRepo = getPayoutsRepository();
  const vendorsRepo = getVendorsRepository();
  const bookingsRepo = getBookingsRepository();
  const vendorTiersRepo = getVendorTiersRepository();

  // ✅ SQL: Get global settlement schedule
  const { data: schedules } = await db
    .from('settlement_schedules')
    .select('*')
    .is('vendor_id', null)
    .eq('is_active', true)
    .limit(1);

  const schedule = schedules?.[0];
  const settlementPeriodDays = 3; // Default T+3
  const minPayoutAmount = 100; // Default minimum

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - settlementPeriodDays);

  const vendorsToProcess = vendorIds || [];

  if (!vendorIds || vendorIds.length === 0) {
    // ✅ SQL: Get all active vendors
    const vendors = await vendorsRepo.findAllActive();
    for (const vendor of vendors) {
      if (vendor.status === 'approved') {
        vendorsToProcess.push(vendor.id);
      }
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
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) continue;

      // ✅ SQL: Get vendor's completed bookings
      const bookings = await bookingsRepo.findByVendor(vendorId, {
        status: 'completed',
        limit: 1000
      });

      const pendingBookings: any[] = [];
      let totalPending = 0;

      for (const booking of bookings) {
        if (
          booking.status === 'completed' &&
          !booking.settlement_id &&
          (force || (booking.completed_at && new Date(booking.completed_at) <= cutoffDate))
        ) {
          totalPending += parseFloat((booking.total_amount || 0).toString());
          pendingBookings.push(booking);
        }
      }

      if (totalPending === 0 || totalPending < minPayoutAmount) {
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

  return results;
}

/**
 * Create automatic payout for vendor
 */
async function createAutomaticPayout(vendor: any, bookings: any[], totalAmount: number): Promise<any> {
  try {
    const vendorTiersRepo = getVendorTiersRepository();
    const payoutsRepo = getPayoutsRepository();
    const bookingsRepo = getBookingsRepository();
    const settlementsRepo = getSettlementsRepository();

      // ✅ SQL: Get vendor's active tier subscription
      const subscription = await vendorTiersRepo.findActiveSubscriptionByVendor(vendor.id);
      let commissionRate = 15; // Default commission
      
      if (subscription) {
        // ✅ SQL: Get tier config
        const tier = await vendorTiersRepo.findById(subscription.tier_id);
        if (tier) {
          commissionRate = tier.commission_rate || 15;
        }
      }
    
    const commissionAmount = (totalAmount * commissionRate) / 100;
    const vendorEarnings = totalAmount - commissionAmount;

    // ✅ SQL: Get bank details from vendor metadata or platform_integrations
    const db = getDbClient();
    const { data: integrations } = await db
      .from('platform_integrations')
      .select('*')
      .eq('vendor_id', vendor.id)
      .eq('integration_type', 'razorpay')
      .single();

    const bankDetails = integrations?.integration_config?.bank_details;
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

    return await withTransaction(async (txClient) => {
      // ✅ SQL: Create payout record
      const payout = await payoutsRepo.create({
        vendor_id: vendor.id,
        amount: vendorEarnings,
        scheduled_at: new Date().toISOString(),
        razorpay_payout_id: payoutResult.id,
        bank_account_id: bankDetails.razorpayAccountId
      });

      // ✅ SQL: Create settlements for bookings
      const settlementIds: string[] = [];
      for (const booking of bookings) {
        const settlement = await settlementsRepo.create({
          vendor_id: vendor.id,
          booking_id: booking.id,
          payment_id: booking.payment_id || null,
          settlement_amount: parseFloat((booking.total_amount || 0).toString()),
          commission_amount: (commissionAmount / bookings.length),
          vendor_amount: (vendorEarnings / bookings.length),
          settlement_date: new Date().toISOString().split('T')[0]
        });
        settlementIds.push(settlement.id);

        // ✅ SQL: Update booking with settlement ID
        await bookingsRepo.update(booking.id, {
          settlement_id: settlement.id
        });
      }

      // ✅ SQL: Update payout with settlement IDs
      await payoutsRepo.update(payout.id, {
        settlement_ids: settlementIds
      });

      console.log(`✅ Automatic payout created: ${payout.id} for vendor ${vendor.id}, amount: ₹${vendorEarnings}`);

      return {
        success: true,
        payout: {
          payoutId: payout.id,
          vendorId: vendor.id,
          amount: vendorEarnings,
          totalAmount,
          commissionRate,
          commissionAmount,
          bookingIds: bookings.map(b => b.id),
          status: payout.status,
          razorpayPayoutId: payout.razorpay_payout_id,
          createdAt: payout.created_at,
          processedAt: payout.processed_at,
          completedAt: payout.completed_at
        }
      };
    });
  } catch (error) {
    console.error('Error creating automatic payout:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

