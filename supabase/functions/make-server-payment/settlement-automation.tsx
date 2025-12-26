/**
 * ============================================================================
 * SETTLEMENT AUTOMATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Daily settlement calculation
 * - Apply hold period (7 days default)
 * - Deduct commission & refunds
 * - Razorpay transfer integration
 * - Payout history tracking
 * - Vendor notifications
 * 
 * Date: 2025-01-23
 * Migration: Phase 7 - Settlements
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getSettlementsRepository } from '../../lib/repositories/settlements.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';
import { getDbClient } from '../../lib/db.ts';
import { generateId } from './database-schema.tsx';

export function registerSettlementAutomation(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * POST /settlements/calculate-daily
   * Run daily settlement calculation
   * Should be called by cron job at midnight
   */
  app.post(`${BASE}/settlements/calculate-daily`, async (c) => {
    try {
      console.log('💰 [SETTLEMENT] Starting daily settlement calculation...');

      // ✅ SQL: Get payout rules from platform_settings
      const client = getDbClient();
      const { data: payoutRulesData } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:payout_rules')
        .maybeSingle();
      
      const rules = payoutRulesData?.setting_value || {
        holdPeriodDays: 7,
        minimumPayout: 1000,
        autoPayout: true,
        defaultCommission: 10
      };

      const holdPeriodMs = rules.holdPeriodDays * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - holdPeriodMs);

      // ✅ SQL: Get all completed bookings that passed hold period
      const bookingsRepo = getBookingsRepository();
      const allBookings = await bookingsRepo.findAll();
      const eligibleBookings = allBookings.filter((b: any) => {
        if (b.status !== 'completed') return false;
        if (b.settlement_status === 'settled') return false; // Already settled
        
        const completedDate = new Date(b.completed_at || b.booking_date);
        return completedDate < cutoffDate;
      });

      console.log(`📊 [SETTLEMENT] Found ${eligibleBookings.length} eligible bookings`);

      // Group by vendor
      const vendorSettlements: any = {};

      for (const booking of eligibleBookings) {
        const vendorId = booking.vendorId;
        
        if (!vendorSettlements[vendorId]) {
          vendorSettlements[vendorId] = {
            vendorId,
            bookings: [],
            totalAmount: 0,
            commission: 0,
            netAmount: 0
          };
        }

        // ✅ SQL: Get vendor and calculate commission
        const vendorsRepo = getVendorsRepository();
        const vendor = await vendorsRepo.findById(vendorId);
        const commissionRate = vendor?.commission_rate || rules.defaultCommission;
        const bookingAmount = booking.total_amount || booking.base_price || 0;
        const commissionAmount = (bookingAmount * commissionRate) / 100;
        const netAmount = bookingAmount - commissionAmount;

        vendorSettlements[vendorId].bookings.push(booking.id);
        vendorSettlements[vendorId].totalAmount += bookingAmount;
        vendorSettlements[vendorId].commission += commissionAmount;
        vendorSettlements[vendorId].netAmount += netAmount;

        // ✅ SQL: Mark booking as settled
        await bookingsRepo.update(booking.id, {
          settlement_status: 'settled',
          settled_at: new Date().toISOString(),
        });
      }

      // Process settlements
      const settlements = [];
      for (const vendorId in vendorSettlements) {
        const settlement = vendorSettlements[vendorId];

        // Check minimum payout
        if (settlement.netAmount < rules.minimumPayout) {
          console.log(`⚠️ [SETTLEMENT] Vendor ${vendorId} below minimum (₹${settlement.netAmount})`);
          continue;
        }

        // ✅ SQL: Create settlement record
        const settlementsRepo = getSettlementsRepository();
        const settlementRecord = await settlementsRepo.create({
          vendor_id: vendorId,
          settlement_amount: settlement.totalAmount,
          commission_amount: settlement.commission,
          vendor_amount: settlement.netAmount,
          settlement_status: rules.autoPayout ? 'pending_transfer' : 'pending_approval',
        });

        settlements.push(settlementRecord);

        // If auto-payout enabled, initiate transfer
        if (rules.autoPayout) {
          await initiateRazorpayTransfer(settlementRecord);
        }

        // Notify vendor
        await sendSettlementNotification(vendorId, settlementRecord);
      }

      console.log(`✅ [SETTLEMENT] Created ${settlements.length} settlements`);

      return c.json({
        success: true,
        settlementsCreated: settlements.length,
        totalAmount: settlements.reduce((sum, s) => sum + s.netAmount, 0),
        settlements
      });

    } catch (error) {
      console.error('[SETTLEMENT] Error:', error);
      return c.json({ error: 'Settlement calculation failed' }, 500);
    }
  });

  /**
   * POST /settlements/:settlementId/approve
   * Admin approves a settlement for payout
   */
  app.post(`${BASE}/settlements/:settlementId/approve`, async (c) => {
    try {
      const { settlementId } = c.req.param();
      const { adminId } = await c.req.json();

      // ✅ SQL: Get settlement
      const settlementsRepo = getSettlementsRepository();
      const settlement = await settlementsRepo.findById(settlementId);
      if (!settlement) {
        return c.json({ error: 'Settlement not found' }, 404);
      }

      if (settlement.settlement_status !== 'pending_approval') {
        return c.json({ error: 'Settlement already processed' }, 400);
      }

      // ✅ SQL: Update settlement
      await settlementsRepo.update(settlementId, {
        settlement_status: 'approved',
      });

      // Initiate transfer
      await initiateRazorpayTransfer(settlement);

      return c.json({
        success: true,
        message: 'Settlement approved and transfer initiated'
      });

    } catch (error) {
      console.error('[SETTLEMENT] Approval error:', error);
      return c.json({ error: 'Failed to approve settlement' }, 500);
    }
  });

  /**
   * GET /settlements/vendor/:vendorId
   * Get settlement history for vendor
   */
  app.get(`${BASE}/settlements/vendor/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();

      // ✅ SQL: Get vendor settlements
      const settlementsRepo = getSettlementsRepository();
      const vendorSettlements = await settlementsRepo.findByVendor(vendorId);

      return c.json({
        success: true,
        settlements: vendorSettlements,
        totalSettled: vendorSettlements
          .filter((s: any) => s.settlement_status === 'completed')
          .reduce((sum: number, s: any) => sum + s.vendor_amount, 0)
      });

    } catch (error) {
      console.error('[SETTLEMENT] History error:', error);
      return c.json({ error: 'Failed to fetch history' }, 500);
    }
  });

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  async function initiateRazorpayTransfer(settlement: any) {
    try {
      console.log(`💸 [TRANSFER] Initiating for settlement ${settlement.id}`);

      // ✅ SQL: Get vendor details
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(settlement.vendor_id);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // ✅ SQL: Get Razorpay credentials from platform_settings
      const client = getDbClient();
      const { data: paymentSettingsData } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'admin:settings:payment')
        .maybeSingle();
      const paymentSettings = paymentSettingsData?.setting_value || {};
      const razorpayKeyId = paymentSettings.razorpay?.keyId || Deno.env.get('RAZORPAY_KEY_ID');
      const razorpayKeySecret = paymentSettings.razorpay?.keySecret || Deno.env.get('RAZORPAY_KEY_SECRET');

      if (!razorpayKeyId || !razorpayKeySecret) {
        console.error('[TRANSFER] Razorpay credentials not configured');
        await settlementsRepo.update(settlement.id, {
          settlement_status: 'failed',
        });
        return;
      }

      // Create/Get contact
      let contactId = vendor.razorpay_contact_id;
      if (!contactId) {
        contactId = await createRazorpayContact(vendor, razorpayKeyId, razorpayKeySecret);
        await vendorsRepo.update(vendor.id, {
          razorpay_contact_id: contactId,
        });
      }

      // Create/Get fund account
      let fundAccountId = vendor.razorpay_fund_account_id;
      if (!fundAccountId) {
        fundAccountId = await createRazorpayFundAccount(
          contactId,
          vendor,
          razorpayKeyId,
          razorpayKeySecret
        );
        await vendorsRepo.update(vendor.id, {
          razorpay_fund_account_id: fundAccountId,
        });
      }

      // Create payout
      const payout = await createRazorpayPayout(
        fundAccountId,
        settlement.vendor_amount,
        settlement.id,
        razorpayKeyId,
        razorpayKeySecret
      );

      // ✅ SQL: Update settlement
      await settlementsRepo.update(settlement.id, {
        settlement_status: 'processing',
        razorpay_settlement_id: payout.id,
      });

      console.log(`✅ [TRANSFER] Payout created: ${payout.id}`);

    } catch (error) {
      console.error('[TRANSFER] Error:', error);
      // ✅ SQL: Update settlement status to failed
      const settlementsRepo = getSettlementsRepository();
      await settlementsRepo.update(settlement.id, {
        settlement_status: 'failed',
      });
    }
  }

  async function createRazorpayContact(vendor: any, keyId: string, keySecret: string) {
    const auth = btoa(`${keyId}:${keySecret}`);

    const response = await fetch('https://api.razorpay.com/v1/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: vendor.businessName || vendor.fullName,
        email: vendor.email,
        contact: vendor.phone,
        type: 'vendor',
        reference_id: vendor.id
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.description || 'Failed to create contact');
    }

    const contact = await response.json();
    return contact.id;
  }

  async function createRazorpayFundAccount(
    contactId: string,
    vendor: any,
    keyId: string,
    keySecret: string
  ) {
    const auth = btoa(`${keyId}:${keySecret}`);

    const response = await fetch('https://api.razorpay.com/v1/fund_accounts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contact_id: contactId,
        account_type: 'bank_account',
        bank_account: {
          name: vendor.bankAccountName || vendor.businessName,
          ifsc: vendor.ifscCode,
          account_number: vendor.accountNumber
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.description || 'Failed to create fund account');
    }

    const fundAccount = await response.json();
    return fundAccount.id;
  }

  async function createRazorpayPayout(
    fundAccountId: string,
    amount: number,
    settlementId: string,
    keyId: string,
    keySecret: string
  ) {
    const auth = btoa(`${keyId}:${keySecret}`);
    const amountInPaise = Math.round(amount * 100);

    const response = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        account_number: Deno.env.get('RAZORPAY_ACCOUNT_NUMBER'), // Your Razorpay account
        fund_account_id: fundAccountId,
        amount: amountInPaise,
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: settlementId,
        narration: `Settlement ${settlementId}`
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.description || 'Failed to create payout');
    }

    return await response.json();
  }

  async function sendSettlementNotification(vendorId: string, settlement: any) {
    try {
      // ✅ SQL: Create notification using repository
      const notificationsRepo = getNotificationsRepository();
      await notificationsRepo.create({
        recipient_id: vendorId,
        recipient_type: 'vendor',
        notification_type: 'settlement_processed',
        title: 'Settlement Processed! 💰',
        message: `₹${settlement.vendor_amount?.toFixed(2) || settlement.amount?.toFixed(2)} will be transferred to your account within 2-3 business days.`,
        data: { settlementId: settlement.id },
      });

      console.log(`📧 [NOTIFICATION] Settlement notification sent to vendor ${vendorId}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error:', error);
    }
  }
}
