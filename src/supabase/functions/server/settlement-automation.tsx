import { Hono } from "hono";
import * as kv from './kv_store';
import { generateId } from './database-schema';

/**
 * SETTLEMENT AUTOMATION
 * 
 * Features:
 * - Daily settlement calculation
 * - Apply hold period (7 days default)
 * - Deduct commission & refunds
 * - Razorpay transfer integration
 * - Payout history tracking
 * - Vendor notifications
 */

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

      // Get payout rules
      const rules = await kv.get('admin:settings:payout_rules') || {
        holdPeriodDays: 7,
        minimumPayout: 1000,
        autoPayout: true,
        defaultCommission: 10
      };

      const holdPeriodMs = rules.holdPeriodDays * 24 * 60 * 60 * 1000;
      const cutoffDate = new Date(Date.now() - holdPeriodMs);

      // Get all completed bookings that passed hold period
      const allBookings = await kv.getByPrefix('booking:');
      const eligibleBookings = allBookings.filter((b: any) => {
        if (b.status !== 'completed') return false;
        if (b.settled) return false; // Already settled
        
        const completedDate = new Date(b.completedAt || b.scheduledDate);
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

        // Calculate commission
        const vendor = await kv.get(`vendor:${vendorId}`);
        const commissionRate = vendor?.commissionRate || rules.defaultCommission;
        const bookingAmount = booking.totalAmount || booking.amount || 0;
        const commissionAmount = (bookingAmount * commissionRate) / 100;
        const netAmount = bookingAmount - commissionAmount;

        vendorSettlements[vendorId].bookings.push(booking.id);
        vendorSettlements[vendorId].totalAmount += bookingAmount;
        vendorSettlements[vendorId].commission += commissionAmount;
        vendorSettlements[vendorId].netAmount += netAmount;

        // Mark booking as settled
        booking.settled = true;
        booking.settledAt = new Date().toISOString();
        await kv.set(`booking:${booking.id}`, booking);
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

        // Create settlement record
        const settlementId = generateId('settlement');
        const settlementRecord = {
          id: settlementId,
          vendorId,
          amount: settlement.netAmount,
          totalAmount: settlement.totalAmount,
          commission: settlement.commission,
          bookingCount: settlement.bookings.length,
          bookings: settlement.bookings,
          status: rules.autoPayout ? 'pending_transfer' : 'pending_approval',
          createdAt: new Date().toISOString()
        };

        await kv.set(`settlement:${settlementId}`, settlementRecord);
        
        // Add to pending settlements
        const pendingSettlements = await kv.get('admin:settlements:pending') || [];
        pendingSettlements.push(settlementId);
        await kv.set('admin:settlements:pending', pendingSettlements);

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

      const settlement = await kv.get(`settlement:${settlementId}`);
      if (!settlement) {
        return c.json({ error: 'Settlement not found' }, 404);
      }

      if (settlement.status !== 'pending_approval') {
        return c.json({ error: 'Settlement already processed' }, 400);
      }

      settlement.status = 'approved';
      settlement.approvedBy = adminId;
      settlement.approvedAt = new Date().toISOString();
      await kv.set(`settlement:${settlementId}`, settlement);

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

      const allSettlements = await kv.getByPrefix('settlement:');
      const vendorSettlements = allSettlements
        .filter((s: any) => s.vendorId === vendorId)
        .sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      return c.json({
        success: true,
        settlements: vendorSettlements,
        totalSettled: vendorSettlements
          .filter((s: any) => s.status === 'completed')
          .reduce((sum: number, s: any) => sum + s.amount, 0)
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

      // Get vendor details
      const vendor = await kv.get(`vendor:${settlement.vendorId}`);
      if (!vendor) {
        throw new Error('Vendor not found');
      }

      // ✅ Lambda: Get Razorpay credentials from PlatformSettingsRepository
      const { getPlatformSettingsRepository } = await import('../../../supabase/lib/repositories/index');
      const platformSettingsRepo = getPlatformSettingsRepository();
      const paymentSettings = await platformSettingsRepo.getPaymentGatewaySettings('razorpay') || {};
      const razorpayKeyId = paymentSettings?.key_id || paymentSettings?.keyId || '';
      const razorpayKeySecret = paymentSettings?.key_secret || paymentSettings?.keySecret || '';

      if (!razorpayKeyId || !razorpayKeySecret) {
        console.error('[TRANSFER] Razorpay credentials not configured');
        settlement.status = 'failed';
        settlement.error = 'Payment gateway not configured';
        await kv.set(`settlement:${settlement.id}`, settlement);
        return;
      }

      // Create/Get contact
      let contactId = vendor.razorpayContactId;
      if (!contactId) {
        contactId = await createRazorpayContact(vendor, razorpayKeyId, razorpayKeySecret);
        vendor.razorpayContactId = contactId;
        await kv.set(`vendor:${vendor.id}`, vendor);
      }

      // Create/Get fund account
      let fundAccountId = vendor.razorpayFundAccountId;
      if (!fundAccountId) {
        fundAccountId = await createRazorpayFundAccount(
          contactId,
          vendor,
          razorpayKeyId,
          razorpayKeySecret
        );
        vendor.razorpayFundAccountId = fundAccountId;
        await kv.set(`vendor:${vendor.id}`, vendor);
      }

      // Create payout
      const payout = await createRazorpayPayout(
        fundAccountId,
        settlement.amount,
        settlement.id,
        razorpayKeyId,
        razorpayKeySecret
      );

      // Update settlement
      settlement.status = 'processing';
      settlement.razorpayPayoutId = payout.id;
      settlement.transferInitiatedAt = new Date().toISOString();
      await kv.set(`settlement:${settlement.id}`, settlement);

      console.log(`✅ [TRANSFER] Payout created: ${payout.id}`);

    } catch (error) {
      console.error('[TRANSFER] Error:', error);
      settlement.status = 'failed';
      settlement.error = error instanceof Error ? error.message : 'Transfer failed';
      await kv.set(`settlement:${settlement.id}`, settlement);
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
        account_number: paymentSettings?.account_number || process.env.RAZORPAY_ACCOUNT_NUMBER || '', // ✅ Lambda: Get from settings or env
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
      const notification = {
        id: generateId('notif'),
        userId: vendorId,
        userType: 'vendor',
        type: 'settlement_processed',
        title: 'Settlement Processed! 💰',
        message: `₹${settlement.amount.toFixed(2)} will be transferred to your account within 2-3 business days.`,
        data: { settlementId: settlement.id },
        read: false,
        priority: 'high',
        createdAt: new Date().toISOString()
      };

      const notifications = await kv.get(`notifications:${vendorId}`) || [];
      notifications.unshift(notification);
      await kv.set(`notifications:${vendorId}`, notifications);

      console.log(`📧 [NOTIFICATION] Settlement notification sent to vendor ${vendorId}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error:', error);
    }
  }
}
