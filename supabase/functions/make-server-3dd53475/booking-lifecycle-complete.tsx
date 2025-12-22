/**
 * COMPLETE BOOKING LIFECYCLE SYSTEM
 * 
 * Handles full lifecycle: Booking → OTP Verification → Earnings → Settlement → Payout
 * 
 * Flow:
 * 1. Booking created with OTP
 * 2. Vendor verifies OTP (start/end)
 * 3. Booking marked completed
 * 4. Earnings realized
 * 5. Settlement triggered (Razorpay marketplace)
 * 6. Payout scheduled based on admin policies
 */

import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { TIER_CONFIG } from "./tier-system.tsx";
import { getOTPRequirements } from "./service-category-helpers.tsx";
import { createNotificationHelper } from "./notification-system.tsx";
import { createRazorpayPayout } from "./razorpay-marketplace-payout.tsx";
// ✅ Note: Razorpay credentials now fetched from platform settings via createRazorpayPayout

export function bookingLifecycleCompleteEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * POST /booking/:bookingId/verify-otp-complete
   * Verify OTP and trigger complete lifecycle: earnings → settlement → payout
   * 
   * This is the unified endpoint that handles:
   * - OTP verification
   * - Booking completion
   * - Earnings realization
   * - Settlement creation
   * - Payout scheduling
   */
  app.post(`${BASE_PATH}/booking/:bookingId/verify-otp-complete`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, action = 'end', vendorId } = await c.req.json();

      console.log(`\n🔄 [LIFECYCLE] Starting complete lifecycle for booking: ${bookingId}`);
      console.log(`   Action: ${action}, Vendor: ${vendorId}`);

      // 1. Get booking
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Verify vendor
      if (booking.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized vendor', 403);
      }

      // 2. Verify OTP based on action
      let otpVerified = false;
      let bookingCompleted = false;

      if (action === 'start') {
        // Verify start OTP
        if (booking.otp?.start !== otp && booking.completionOTP !== otp) {
          return sendError(c, 'Invalid OTP', 400);
        }
        booking.status = 'in_progress';
        booking.startedAt = new Date().toISOString();
        booking.otp = booking.otp || {};
        booking.otp.startUsed = true;
        otpVerified = true;
        console.log(`✅ [LIFECYCLE] Start OTP verified, service in progress`);

        // ✅ NOTIFICATION: Service Started
        try {
          const customer = await kv.get(`customer:${booking.customerId}`);
          const vendor = await kv.get(`vendor:${booking.vendorId}`);
          const endOTP = booking.otp?.end || booking.completionOTP;

          await createNotificationHelper(kv, {
            recipientId: booking.customerId,
            recipientType: 'customer',
            type: 'service_started',
            category: 'bookings',
            title: 'Service Started',
            message: `Your service has started! End service OTP: ${endOTP}. Share with provider when done.`,
            recipientEmail: customer?.email,
            recipientPhone: booking.customerPhone || customer?.phone,
            channels: { email: false, sms: true, inApp: true, push: false },
            data: { bookingId, serviceName: booking.serviceName, endOTP },
            priority: 'high'
          });

          console.log(`📱 [NOTIFICATION] Service started notification sent to customer`);
        } catch (notifError) {
          console.error(`⚠️ [NOTIFICATION] Failed to send service started notification:`, notifError);
          // Don't fail the request if notification fails
        }

      } else if (action === 'end' || action === 'complete') {
        // Verify end/completion OTP
        const endOTP = booking.otp?.end || booking.completionOTP;
        if (endOTP !== otp) {
          return sendError(c, 'Invalid OTP', 400);
        }

        // Mark booking as completed
        // ✅ FIX: Handle package bookings differently
        if (booking.isPackage && booking.packageDetails) {
          // For package bookings, increment completed sessions instead of marking as completed
          booking.packageDetails.completedSessions = (booking.packageDetails.completedSessions || 0) + 1;
          booking.completedSessions = booking.packageDetails.completedSessions;
          booking.upcomingSessions = (booking.packageDetails.totalSessions || 0) - booking.packageDetails.completedSessions;
          
          // Calculate completion percentage
          const totalSessions = booking.packageDetails.totalSessions || 1;
          booking.completionPercentage = Math.round((booking.packageDetails.completedSessions / totalSessions) * 100);
          
          // Check if package is fully completed
          if (booking.packageDetails.completedSessions >= totalSessions) {
            booking.packageStatus = 'completed';
            booking.status = 'completed';
            booking.completedAt = new Date().toISOString();
            bookingCompleted = true;
            console.log(`✅ [LIFECYCLE] Package booking fully completed (${booking.packageDetails.completedSessions}/${totalSessions} sessions)`);
          } else {
            booking.packageStatus = 'in_progress';
            booking.status = 'in_progress'; // Keep in progress until all sessions done
            console.log(`📊 [LIFECYCLE] Package session completed (${booking.packageDetails.completedSessions}/${totalSessions} sessions)`);
          }
        } else {
          // For single bookings, mark as completed
          booking.status = 'completed';
          booking.completedAt = new Date().toISOString();
          bookingCompleted = true;
          console.log(`✅ [LIFECYCLE] Completion OTP verified, booking completed`);
        }
        
        booking.otp = booking.otp || {};
        booking.otp.endUsed = true;
        booking.serviceCompletionVerified = true;
        otpVerified = true;
      }

      // Save booking
      await kv.set(`booking:${bookingId}`, booking);

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
          
          // Determine action key based on service type
          let actionKey = 'book_grooming'; // default
          const serviceType = booking.serviceType?.toLowerCase() || '';
          const vendorRoleId = booking.vendorRoleId?.toLowerCase() || '';
          
          if (serviceType.includes('vet') || serviceType.includes('consultation') || vendorRoleId.includes('vet')) {
            actionKey = 'book_vet';
          } else if (serviceType.includes('food') || serviceType.includes('nutrition') || vendorRoleId.includes('nutrition')) {
            actionKey = 'buy_food';
          } else if (serviceType.includes('groom') || vendorRoleId.includes('groom')) {
            actionKey = 'book_grooming';
          } else if (serviceType.includes('train') || vendorRoleId.includes('train') || vendorRoleId.includes('behavior')) {
            actionKey = 'book_training';
          } else if (serviceType.includes('walk') || vendorRoleId.includes('walk')) {
            actionKey = 'book_walking';
          } else if (serviceType.includes('board') || vendorRoleId.includes('board') || vendorRoleId.includes('resort')) {
            actionKey = 'book_boarding';
          }

          // Award loyalty points
          const loyaltyResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-3dd53475/loyalty/process-action`,
            {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({
                userId: booking.customerId,
                userType: 'customer',
                actionKey,
                amount: booking.totalAmount || booking.price || 0,
                metadata: { bookingId, serviceType: booking.serviceType, vendorRoleId: booking.vendorRoleId }
              })
            }
          ).catch(err => {
            console.error('[LOYALTY] Failed to award points:', err);
            return null;
          });

          if (loyaltyResponse?.ok) {
            const data = await loyaltyResponse.json();
            console.log(`✅ [LOYALTY] Awarded ${data.pointsAwarded} points to customer ${booking.customerId}`);
          }
        } catch (loyaltyErr) {
          console.error('[LOYALTY] Error processing loyalty points:', loyaltyErr);
          // Non-blocking: Continue with booking completion even if loyalty fails
        }

        // ✅ NOTIFICATIONS: Service Completed
        try {
          const customer = await kv.get(`customer:${booking.customerId}`);
          const vendor = await kv.get(`vendor:${booking.vendorId}`);

          // Notify Customer
          await createNotificationHelper(kv, {
            recipientId: booking.customerId,
            recipientType: 'customer',
            type: 'booking_completed',
            category: 'bookings',
            title: 'Service Completed',
            message: `Your service has been completed! Please rate your experience. Booking ID: ${bookingId}`,
            recipientEmail: customer?.email,
            recipientPhone: booking.customerPhone || customer?.phone,
            channels: { email: true, sms: true, inApp: true, push: false },
            data: { bookingId, serviceName: booking.serviceName, vendorName: vendor?.businessName },
            priority: 'medium'
          });

          // Notify Vendor
          await createNotificationHelper(kv, {
            recipientId: booking.vendorId,
            recipientType: 'vendor',
            type: 'booking_completed',
            category: 'bookings',
            title: 'Service Completed',
            message: `Service completed for booking ${bookingId}. Earnings: ₹${earningsResult.vendorEarnings}`,
            recipientEmail: vendor?.email,
            recipientPhone: vendor?.phone,
            channels: { email: true, sms: false, inApp: true, push: false },
            data: { bookingId, earnings: earningsResult, settlement: settlementResult },
            priority: 'medium'
          });

          console.log(`📱 [NOTIFICATION] Service completed notifications sent`);
        } catch (notifError) {
          console.error(`⚠️ [NOTIFICATION] Failed to send completion notifications:`, notifError);
          // Don't fail the request if notification fails
        }

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
   */
  async function realizeEarnings(bookingId: string, booking: any) {
    try {
      const vendorId = booking.vendorId;
      const totalAmount = booking.totalAmount || booking.price || 0;

      // Get vendor tier and commission rate
      const tierData = await kv.get(`vendor_tier_${vendorId}`) || { currentTier: 'SILVER' };
      const tierConfig = TIER_CONFIG[tierData.currentTier as keyof typeof TIER_CONFIG] || TIER_CONFIG.SILVER;
      const commissionRate = tierConfig.commissionRate;

      // Calculate earnings
      const platformCommission = (totalAmount * commissionRate) / 100;
      const vendorEarnings = totalAmount - platformCommission;

      // Get payout policies from admin settings
      const payoutPolicies = await kv.get('admin:payout:policies') || {
        holdPeriodDays: 7,
        autoPayout: false,
        minPayoutAmount: 1000
      };

      const now = new Date();
      const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

      // Create earnings record
      const earningsId = `earning_${Date.now()}_${bookingId}`;
      const earnings = {
        id: earningsId,
        bookingId,
        vendorId,
        customerId: booking.customerId,
        totalAmount,
        platformCommission,
        commissionRate,
        vendorEarnings,
        status: 'realized',
        realizedAt: new Date().toISOString(),
        payoutStatus: 'pending',
        payoutScheduledAt: null,
        holdPeriodDays: payoutPolicies.holdPeriodDays,
        createdAt: new Date().toISOString()
      };

      await kv.set(`earnings:${earningsId}`, earnings);

      // Update vendor daily earnings
      const vendorDailyKey = `vendor:${vendorId}:earnings:daily:${dateKey}`;
      const vendorDaily = await kv.get(vendorDailyKey) || {
        date: dateKey,
        totalBookings: 0,
        totalRevenue: 0,
        totalEarnings: 0,
        platformFees: 0
      };
      vendorDaily.totalBookings += 1;
      vendorDaily.totalRevenue += totalAmount;
      vendorDaily.totalEarnings += vendorEarnings;
      vendorDaily.platformFees += platformCommission;
      await kv.set(vendorDailyKey, vendorDaily);

      // Update vendor monthly earnings
      const vendorMonthlyKey = `vendor:${vendorId}:earnings:monthly:${monthKey}`;
      const vendorMonthly = await kv.get(vendorMonthlyKey) || {
        month: monthKey,
        totalBookings: 0,
        totalRevenue: 0,
        totalEarnings: 0,
        platformFees: 0
      };
      vendorMonthly.totalBookings += 1;
      vendorMonthly.totalRevenue += totalAmount;
      vendorMonthly.totalEarnings += vendorEarnings;
      vendorMonthly.platformFees += platformCommission;
      await kv.set(vendorMonthlyKey, vendorMonthly);

      // Update vendor lifetime earnings
      const vendorLifetimeKey = `vendor:${vendorId}:earnings:lifetime`;
      const vendorLifetime = await kv.get(vendorLifetimeKey) || {
        totalBookings: 0,
        totalRevenue: 0,
        totalEarnings: 0,
        platformFees: 0
      };
      vendorLifetime.totalBookings += 1;
      vendorLifetime.totalRevenue += totalAmount;
      vendorLifetime.totalEarnings += vendorEarnings;
      vendorLifetime.platformFees += platformCommission;
      await kv.set(vendorLifetimeKey, vendorLifetime);

      // Update booking with earnings
      booking.earningsId = earningsId;
      booking.earningsRealized = true;
      booking.vendorEarnings = vendorEarnings;
      booking.platformCommission = platformCommission;
      await kv.set(`booking:${bookingId}`, booking);

      console.log(`💰 [EARNINGS] Realized: Total ₹${totalAmount}, Vendor ₹${vendorEarnings}, Platform ₹${platformCommission}`);

      return earnings;

    } catch (error) {
      console.error('❌ [EARNINGS] Error:', error);
      throw error;
    }
  }

  /**
   * Create Razorpay marketplace settlement
   */
  async function createSettlement(bookingId: string, booking: any, earnings: any) {
    try {
      // Check if already settled
      if (booking.settlementStatus === 'settled') {
        const existingSettlement = await kv.get(`settlement:${booking.settlementId}`);
        return existingSettlement;
      }

      const vendorId = booking.vendorId;
      const totalAmount = earnings.totalAmount;
      const commissionAmount = earnings.platformCommission;
      const vendorShare = earnings.vendorEarnings;

      // Create settlement record
      const settlementId = `set_${Date.now()}_${bookingId}`;
      const settlement = {
        id: settlementId,
        bookingId,
        vendorId,
        earningsId: earnings.id,
        totalAmount,
        commissionRate: earnings.commissionRate,
        commissionAmount,
        vendorShare,
        status: 'processing', // Will be 'settled' after Razorpay transfer
        createdAt: new Date().toISOString(),
        settledAt: null
      };

      await kv.set(`settlement:${settlementId}`, settlement);

      // Get vendor bank details for Razorpay transfer
      const vendorBank = await kv.get(`vendor_bank:${vendorId}`);
      
      if (vendorBank && vendorBank.isVerified) {
        try {
          // ✅ ACTUAL RAZORPAY API: Initiate payout to vendor
          console.log(`💸 [SETTLEMENT] Initiating Razorpay payout: ₹${vendorShare} to vendor ${vendorId}`);
          
          const razorpayPayout = await createRazorpayPayout({
            accountId: vendorBank.fundAccountId || vendorBank.accountNumber,
            amount: vendorShare,
            currency: 'INR',
            notes: {
              bookingId,
              settlementId,
              vendorId,
              accountHolderName: vendorBank.accountName || vendorBank.name,
              ifsc: vendorBank.ifsc,
              accountNumber: vendorBank.accountNumber
            }
          });
          
          // Update settlement with Razorpay payout details
          settlement.status = 'settled';
          settlement.settledAt = new Date().toISOString();
          settlement.razorpayPayoutId = razorpayPayout.id;
          settlement.razorpayPayoutStatus = razorpayPayout.status;
          settlement.utr = razorpayPayout.utr || null;
          settlement.payoutMode = razorpayPayout.mode || 'NEFT';
          
          await kv.set(`settlement:${settlementId}`, settlement);
          
          console.log(`✅ [SETTLEMENT] Razorpay payout created: ${razorpayPayout.id}, Status: ${razorpayPayout.status}`);
        } catch (razorpayError: any) {
          console.error(`❌ [SETTLEMENT] Razorpay payout failed:`, razorpayError);
          
          // Mark settlement as failed but keep record
          settlement.status = 'failed';
          settlement.failureReason = razorpayError.message || 'Razorpay payout failed';
          settlement.retryCount = (settlement.retryCount || 0) + 1;
          
          await kv.set(`settlement:${settlementId}`, settlement);
          
          // Don't throw - allow booking to complete, settlement can be retried
          console.log(`⚠️ [SETTLEMENT] Settlement failed but booking marked as completed. Retry later.`);
        }
      } else {
        console.log(`⚠️ [SETTLEMENT] Vendor bank not verified, settlement pending`);
        settlement.status = 'pending_verification';
      }

      // Update booking
      booking.settlementStatus = settlement.status;
      booking.settlementId = settlementId;
      await kv.set(`booking:${bookingId}`, booking);

      console.log(`💸 [SETTLEMENT] Created: Total ₹${totalAmount}, Vendor ₹${vendorShare}, Platform ₹${commissionAmount}`);

      return settlement;

    } catch (error) {
      console.error('❌ [SETTLEMENT] Error:', error);
      throw error;
    }
  }

  /**
   * Schedule payout based on admin policies
   */
  async function schedulePayout(bookingId: string, booking: any, settlement: any) {
    try {
      // Get payout policies
      const payoutPolicies = await kv.get('admin:payout:policies') || {
        holdPeriodDays: 7,
        autoPayout: false,
        minPayoutAmount: 1000,
        payoutPeriod: 'weekly' // daily, weekly, monthly
      };

      const vendorId = booking.vendorId;
      const vendorShare = settlement.vendorShare;

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

      // Create payout record
      const payoutId = `payout_${Date.now()}_${bookingId}`;
      const payout = {
        id: payoutId,
        bookingId,
        settlementId: settlement.id,
        vendorId,
        amount: vendorShare,
        status: 'scheduled',
        scheduledAt: payoutDate.toISOString(),
        holdPeriodDays: payoutPolicies.holdPeriodDays,
        createdAt: new Date().toISOString(),
        completedAt: null
      };

      await kv.set(`payout:${payoutId}`, payout);

      // Add to vendor's pending payouts
      const vendorPayoutsKey = `vendor:${vendorId}:payouts:pending`;
      const vendorPayouts = await kv.get(vendorPayoutsKey) || [];
      vendorPayouts.push(payoutId);
      await kv.set(vendorPayoutsKey, vendorPayouts);

      // Add to admin payout queue if needed
      if (payoutPolicies.requiresApproval) {
        const adminPayoutsKey = `admin:payouts:pending`;
        const adminPayouts = await kv.get(adminPayoutsKey) || [];
        adminPayouts.push(payoutId);
        await kv.set(adminPayoutsKey, adminPayouts);
      }

      console.log(`📅 [PAYOUT] Scheduled: ₹${vendorShare} on ${payoutDate.toISOString()}`);

      return {
        scheduled: true,
        payoutId,
        scheduledAt: payoutDate.toISOString(),
        amount: vendorShare
      };

    } catch (error) {
      console.error('❌ [PAYOUT] Error:', error);
      throw error;
    }
  }

  console.log('✅ Complete Booking Lifecycle endpoints registered');
}

