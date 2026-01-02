/**
 * ============================================================================
 * COMPLETE BOOKING LIFECYCLE SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Handles full lifecycle: Booking → OTP Verification → Earnings → Settlement → Payout
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
// ✅ FIXED: Define TIER_CONFIG locally (not exported from tier-system-sql.tsx)
const TIER_CONFIG = {
  BRONZE: { commissionRate: 0.20, payoutSchedule: 'T+30' },
  SILVER: { commissionRate: 0.15, payoutSchedule: 'T+14' },
  GOLD: { commissionRate: 0.12, payoutSchedule: 'T+7' },
  PLATINUM: { commissionRate: 0.10, payoutSchedule: 'T+3' }
} as const;
import { getOTPRequirements } from "./service-category-helpers.tsx";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getCommissionsRepository } from "../../lib/repositories/commissions.ts";
import { getSettlementsRepository } from "../../lib/repositories/settlements.ts";
import { getPayoutsRepository } from "../../lib/repositories/payouts.ts";
import { createRazorpayPayout } from "./razorpay-marketplace-payout.tsx";
import { getDbClient } from "../../lib/db.ts";

/**
 * SQL-ONLY Booking Lifecycle Endpoints
 * 
 * ❌ NO KV USAGE - All operations use SQL repositories
 */
export function bookingLifecycleCompleteEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // Helper: Trigger Notification using SQL repository
  async function triggerNotification(notification: {
    recipientId: string;
    recipientType: 'customer' | 'vendor' | 'staff' | 'admin';
    type: string;
    title: string;
    message: string;
    channels?: any;
    data?: any;
  }) {
    try {
      await getNotificationsRepository().create({
        recipient_type: notification.recipientType,
        recipient_id: notification.recipientId,
        notification_type: notification.type,
        title: notification.title,
        message: notification.message,
        channels: notification.channels || { email: true, sms: true, inApp: true, push: false },
        data: notification.data,
      });
      
      console.log(`📨 Notification created for ${notification.recipientType}:${notification.recipientId}`);
      
      // TODO: Integrate with AWS SNS/SES for email/SMS delivery
    } catch (e) {
      console.error('Failed to create notification:', e);
    }
  }

  /**
   * POST /booking/:bookingId/verify-otp-complete
   * Verify OTP and trigger complete lifecycle: earnings → settlement → payout
   * 
   * REFACTORED: Uses SQL repositories instead of KV
   */
  app.post(`${BASE_PATH}/booking/:bookingId/verify-otp-complete`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, action = 'end', vendorId } = await c.req.json();

      console.log(`\n🔄 [LIFECYCLE] Starting complete lifecycle for booking: ${bookingId}`);
      console.log(`   Action: ${action}, Vendor: ${vendorId}`);

      // ✅ SQL: Get booking from repository
      const booking = await getBookingsRepository().findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Verify vendor
      if (booking.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized vendor', 403);
      }

      // 2. Verify OTP based on action
      let otpVerified = false;
      let bookingCompleted = false;

      if (action === 'start') {
        // Verify start OTP (stored in booking.otp_code)
        if (booking.otp_code !== otp) {
          return sendError(c, 'Invalid OTP', 400);
        }
        
        // ✅ SQL: Update booking status to in_progress
        await getBookingsRepository().update(bookingId, {
          status: 'in_progress',
        });
        
        otpVerified = true;
        console.log(`✅ [LIFECYCLE] Start OTP verified, service in progress`);

        // ✅ SQL: Get customer and vendor for notification
        const customer = await getCustomersRepository().findById(booking.customer_id);
        const vendor = await getVendorsRepository().findById(booking.vendor_id || '');

        // ✅ SQL: Create notification
        await triggerNotification({
          recipientId: booking.customer_id,
          recipientType: 'customer',
          type: 'service_started',
          title: 'Service Started',
          message: `Your service has started! End service OTP: ${booking.otp_code}. Share with provider when done.`,
          channels: { email: false, sms: true, inApp: true, push: false },
          data: { bookingId, serviceName: booking.service_type, endOTP: booking.otp_code },
        });

        console.log(`📱 [NOTIFICATION] Service started notification sent to customer`);

      } else if (action === 'end' || action === 'complete') {
        // Verify end/completion OTP
        if (booking.otp_code !== otp) {
          return sendError(c, 'Invalid OTP', 400);
        }

        // ✅ SQL: Complete booking
        const completedBooking = await getBookingsRepository().complete(bookingId);
        bookingCompleted = true;
        otpVerified = true;
        console.log(`✅ [LIFECYCLE] Completion OTP verified, booking completed`);
      }

      // 3. If booking completed, trigger earnings → settlement → payout
      if (bookingCompleted) {
        console.log(`💰 [LIFECYCLE] Triggering earnings realization...`);

        // 3a. Realize Earnings
        const earningsResult = await realizeEarnings(bookingId, booking);
        console.log(`✅ [LIFECYCLE] Earnings realized:`, earningsResult);

        // 3b. Create Settlement (Razorpay marketplace)
        const settlementResult = await createSettlement(bookingId, booking, earningsResult);
        console.log(`✅ [LIFECYCLE] Settlement created:`, settlementResult);

        // 3c. Schedule Payout (based on admin policies)
        const payoutResult = await schedulePayout(bookingId, booking, settlementResult);
        console.log(`✅ [LIFECYCLE] Payout scheduled:`, payoutResult);

        // ✅ LOYALTY: Award reward points for completed booking
        try {
          console.log(`🎁 [LOYALTY] Triggering points for completed booking ${bookingId}`);
          
          let actionKey = 'book_grooming';
          const serviceType = booking.service_type?.toLowerCase() || '';
          
          if (serviceType.includes('vet') || serviceType.includes('consultation')) {
            actionKey = 'book_vet';
          } else if (serviceType.includes('food') || serviceType.includes('nutrition')) {
            actionKey = 'buy_food';
          } else if (serviceType.includes('groom')) {
            actionKey = 'book_grooming';
          } else if (serviceType.includes('train')) {
            actionKey = 'book_training';
          } else if (serviceType.includes('walk')) {
            actionKey = 'book_walking';
          } else if (serviceType.includes('board') || serviceType.includes('resort')) {
            actionKey = 'book_boarding';
          }

          // Award loyalty points (external API call)
          const loyaltyResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/loyalty/process-action`,
            {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({
                userId: booking.customer_id,
                userType: 'customer',
                actionKey,
                amount: booking.total_amount || 0,
                metadata: { bookingId, serviceType: booking.service_type }
              })
            }
          ).catch(err => {
            console.error('[LOYALTY] Failed to award points:', err);
            return null;
          });

          if (loyaltyResponse?.ok) {
            const data = await loyaltyResponse.json();
            console.log(`✅ [LOYALTY] Awarded ${data.pointsAwarded} points to customer ${booking.customer_id}`);
          }
        } catch (loyaltyErr) {
          console.error('[LOYALTY] Error processing loyalty points:', loyaltyErr);
        }

        // ✅ SQL: Create notifications
        const customer = await getCustomersRepository().findById(booking.customer_id);
        const vendor = await getVendorsRepository().findById(booking.vendor_id || '');

        // Notify Customer
        await triggerNotification({
          recipientId: booking.customer_id,
          recipientType: 'customer',
          type: 'booking_completed',
          title: 'Service Completed',
          message: `Your service has been completed! Please rate your experience. Booking ID: ${bookingId}`,
          channels: { email: true, sms: true, inApp: true, push: false },
          data: { bookingId, serviceName: booking.service_type, vendorName: vendor?.business_name },
        });

        // Notify Vendor
        await triggerNotification({
          recipientId: booking.vendor_id || '',
          recipientType: 'vendor',
          type: 'booking_completed',
          title: 'Service Completed',
          message: `Service completed for booking ${bookingId}. Earnings: ₹${earningsResult.vendor_amount}`,
          channels: { email: true, sms: false, inApp: true, push: false },
          data: { bookingId, earnings: earningsResult, settlement: settlementResult },
        });

        console.log(`📱 [NOTIFICATION] Service completed notifications sent`);

        return sendSuccess(c, {
          verified: true,
          bookingCompleted: true,
          earnings: earningsResult,
          settlement: settlementResult,
          payout: payoutResult,
          message: 'Booking completed. Earnings realized and settlement created.'
        });
      }

      // If just start OTP, return success
      return sendSuccess(c, {
        verified: true,
        bookingCompleted: false,
        status: 'in_progress',
        message: 'Service started successfully'
      });

    } catch (error) {
      console.error('❌ [LIFECYCLE] Error:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * Realize earnings for completed booking
   * REFACTORED: Uses SQL repositories instead of KV
   */
  async function realizeEarnings(bookingId: string, booking: any) {
    try {
      const vendorId = booking.vendor_id || '';
      const totalAmount = booking.total_amount || 0;

      // ✅ SQL: Get vendor to determine tier
      const vendor = await getVendorsRepository().findById(vendorId);
      const tier = vendor?.tier || 'Bronze';
      const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.SILVER;
      const commissionRate = tierConfig.commissionRate || 15;

      // Calculate earnings
      const platformCommission = (totalAmount * commissionRate) / 100;
      const vendorEarnings = totalAmount - platformCommission;

      // ✅ SQL: Create commission record
      const commission = await getCommissionsRepository().create({
        booking_id: bookingId,
        vendor_id: vendorId,
        customer_id: booking.customer_id,
        total_amount: totalAmount,
        commission_percentage: commissionRate,
        commission_amount: platformCommission,
        vendor_amount: vendorEarnings,
      });

      console.log(`💰 [EARNINGS] Realized: Total ₹${totalAmount}, Vendor ₹${vendorEarnings}, Platform ₹${platformCommission}`);

      return {
        id: commission.id,
        bookingId,
        vendorId,
        totalAmount,
        platformCommission,
        commissionRate,
        vendorEarnings: vendorEarnings,
        status: 'realized',
      };

    } catch (error) {
      console.error('❌ [EARNINGS] Error:', error);
      throw error;
    }
  }

  /**
   * Create Razorpay marketplace settlement
   * REFACTORED: Uses SQL repositories instead of KV
   */
  async function createSettlement(bookingId: string, booking: any, earnings: any) {
    try {
      // ✅ SQL: Check if settlement already exists
      const existingSettlement = await getSettlementsRepository().findByBooking(bookingId);
      if (existingSettlement) {
        return existingSettlement;
      }

      const vendorId = booking.vendor_id || '';
      const totalAmount = earnings.totalAmount;
      const commissionAmount = earnings.platformCommission;
      const vendorShare = earnings.vendorEarnings;

      // ✅ SQL: Create settlement record
      const settlement = await getSettlementsRepository().create({
        vendor_id: vendorId,
        booking_id: bookingId,
        settlement_amount: totalAmount,
        commission_amount: commissionAmount,
        vendor_amount: vendorShare,
      });

      // ✅ SQL: Get vendor bank details
      const client = getDbClient();
      const { data: vendorBank } = await client
        .from('vendor_bank_accounts')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_verified', true)
        .maybeSingle();
      
      if (vendorBank) {
        try {
          // ✅ ACTUAL RAZORPAY API: Initiate payout to vendor
          console.log(`💸 [SETTLEMENT] Initiating Razorpay payout: ₹${vendorShare} to vendor ${vendorId}`);
          
          const razorpayPayout = await createRazorpayPayout({
            accountId: vendorBank.fund_account_id || vendorBank.account_number,
            amount: vendorShare,
            currency: 'INR',
            notes: {
              bookingId,
              settlementId: settlement.id,
              vendorId,
              accountHolderName: vendorBank.account_holder_name,
              ifsc: vendorBank.ifsc_code,
              accountNumber: vendorBank.account_number
            }
          });
          
          // ✅ SQL: Update settlement with Razorpay payout details
          await getSettlementsRepository().update(settlement.id, {
            settlement_status: 'completed',
            razorpay_settlement_id: razorpayPayout.id,
          });
          
          console.log(`✅ [SETTLEMENT] Razorpay payout created: ${razorpayPayout.id}`);
        } catch (razorpayError: any) {
          console.error(`❌ [SETTLEMENT] Razorpay payout failed:`, razorpayError);
          
          // ✅ SQL: Mark settlement as failed
          await getSettlementsRepository().update(settlement.id, {
            settlement_status: 'failed',
          });
          
          console.log(`⚠️ [SETTLEMENT] Settlement failed but booking marked as completed. Retry later.`);
        }
      } else {
        console.log(`⚠️ [SETTLEMENT] Vendor bank not verified, settlement pending`);
        await getSettlementsRepository().update(settlement.id, {
          settlement_status: 'pending_verification',
        });
      }

      // ✅ SQL: Get updated settlement
      const updatedSettlement = await getSettlementsRepository().findById(settlement.id);

      console.log(`💸 [SETTLEMENT] Created: Total ₹${totalAmount}, Vendor ₹${vendorShare}, Platform ₹${commissionAmount}`);

      return updatedSettlement;

    } catch (error) {
      console.error('❌ [SETTLEMENT] Error:', error);
      throw error;
    }
  }

  /**
   * Schedule payout based on admin policies
   * REFACTORED: Uses SQL repositories instead of KV
   */
  async function schedulePayout(bookingId: string, booking: any, settlement: any) {
    try {
      // ✅ SQL: Get payout policies from platform settings
      const client = getDbClient();
      const { data: payoutPolicy } = await client
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'payout_policies')
        .maybeSingle();

      const payoutPolicies = payoutPolicy?.setting_value || {
        holdPeriodDays: 7,
        autoPayout: false,
        minPayoutAmount: 1000,
        payoutPeriod: 'weekly'
      };

      const vendorId = booking.vendor_id || '';
      const vendorShare = settlement.vendor_amount;

      // Check if auto payout is enabled
      if (!payoutPolicies.autoPayout) {
        console.log(`⚠️ [PAYOUT] Auto payout disabled, manual payout required`);
        return {
          scheduled: false,
          reason: 'Auto payout disabled',
          requiresManualApproval: true
        };
      }

      // Check minimum payout amount
      if (vendorShare < payoutPolicies.minPayoutAmount) {
        console.log(`⚠️ [PAYOUT] Amount below minimum: ₹${vendorShare} < ₹${payoutPolicies.minPayoutAmount}`);
        return {
          scheduled: false,
          reason: 'Amount below minimum payout threshold',
          requiresManualApproval: false
        };
      }

      // Calculate payout date based on hold period
      const holdPeriodMs = payoutPolicies.holdPeriodDays * 24 * 60 * 60 * 1000;
      const payoutDate = new Date(Date.now() + holdPeriodMs);

      // ✅ SQL: Get vendor bank details
      const { data: vendorBank } = await client
        .from('vendor_bank_accounts')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_verified', true)
        .maybeSingle();

      if (!vendorBank) {
        return {
          scheduled: false,
          reason: 'Vendor bank details not verified',
          requiresManualApproval: true
        };
      }

      // ✅ SQL: Create payout record
      const payout = await getPayoutsRepository().create({
        vendor_id: vendorId,
        amount: vendorShare,
        bank_account_number: vendorBank.account_number,
        ifsc_code: vendorBank.ifsc_code,
        account_holder_name: vendorBank.account_holder_name,
        payment_ids: [settlement.id], // Link to settlement
      });

      console.log(`📅 [PAYOUT] Scheduled: ₹${vendorShare} on ${payoutDate.toISOString()}`);

      return {
        scheduled: true,
        payoutId: payout.id,
        scheduledAt: payoutDate.toISOString(),
        amount: vendorShare
      };

    } catch (error) {
      console.error('❌ [PAYOUT] Error:', error);
      throw error;
    }
  }

  console.log('✅ Complete Booking Lifecycle endpoints registered (SQL-only)');
}

