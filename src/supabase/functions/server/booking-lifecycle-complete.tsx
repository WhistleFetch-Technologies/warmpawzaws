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
import { sendSuccess, sendError } from "./response-utils.ts";
import { TIER_CONFIG } from "./tier-system.tsx";
import { getOTPRequirements } from "./service-category-helpers.tsx";
import { createNotificationHelper } from "./notification-system.tsx";
import { createRazorpayPayout } from "./razorpay-marketplace-payout.tsx";
// ✅ SQL Repositories
import { getBookingsRepository } from "../../../supabase/lib/repositories/bookings.ts";
import { getCustomersRepository } from "../../../supabase/lib/repositories/customers.ts";
import { getVendorsRepository } from "../../../supabase/lib/repositories/vendors.ts";
import { getSettlementsRepository } from "../../../supabase/lib/repositories/settlements.ts";
import { getVendorEarningsRepository } from "../../../supabase/lib/repositories/vendor-earnings.ts";
import { getPayoutsRepository } from "../../../supabase/lib/repositories/payouts.ts";
import { getDbClient, withTransaction } from "../../../supabase/lib/db.ts";
// ✅ Note: Razorpay credentials now fetched from platform settings via createRazorpayPayout

export function bookingLifecycleCompleteEndpoints(app: Hono) {
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

      // ✅ SQL: Get booking from repository
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      // Verify vendor
      if (booking.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized vendor', 403);
      }

      // ✅ SQL: Verify OTP based on action
      let otpVerified = false;
      let bookingCompleted = false;

      if (action === 'start') {
        // ✅ SQL: Verify start OTP using repository
        const otpResult = await bookingsRepo.verifyStartOtp(bookingId, otp);
        if (!otpResult.verified) {
          if (otpResult.attempts >= otpResult.maxAttempts) {
            return sendError(c, 'Maximum OTP attempts exceeded. Please request a new OTP.', 400);
          }
          return sendError(c, `Invalid OTP. ${otpResult.maxAttempts - otpResult.attempts} attempts remaining.`, 400);
        }
        otpVerified = true;
        console.log(`✅ [LIFECYCLE] Start OTP verified, service in progress`);

        // ✅ SQL: Get customer and vendor for notifications
        const customersRepo = getCustomersRepository();
        const vendorsRepo = getVendorsRepository();
        const customer = await customersRepo.findById(booking.customer_id);
        const vendor = await vendorsRepo.findById(booking.vendor_id!);
        const endOTP = booking.otp_end_code;

          await createNotificationHelper({
            recipientId: booking.customer_id,
            recipientType: 'customer',
            type: 'service_started',
            category: 'bookings',
            title: 'Service Started',
            message: `Your service has started! End service OTP: ${endOTP}. Share with provider when done.`,
            recipientEmail: customer?.email || undefined,
            recipientPhone: customer?.phone,
            channels: { email: false, sms: true, inApp: true, push: false },
            data: { bookingId, endOTP },
            priority: 'high'
          });

          console.log(`📱 [NOTIFICATION] Service started notification sent to customer`);
        } catch (notifError) {
          console.error(`⚠️ [NOTIFICATION] Failed to send service started notification:`, notifError);
          // Don't fail the request if notification fails
        }

      } else if (action === 'end' || action === 'complete') {
        // ✅ SQL: Verify end OTP using repository
        const otpResult = await bookingsRepo.verifyEndOtp(bookingId, otp);
        if (!otpResult.verified) {
          if (otpResult.attempts >= otpResult.maxAttempts) {
            return sendError(c, 'Maximum OTP attempts exceeded. Please request a new OTP.', 400);
          }
          return sendError(c, `Invalid OTP. ${otpResult.maxAttempts - otpResult.attempts} attempts remaining.`, 400);
        }
        otpVerified = true;

        // ✅ SQL: Mark booking as completed
        // Handle package bookings differently
        if (booking.is_package && booking.package_details) {
          const packageDetails = typeof booking.package_details === 'string' 
            ? JSON.parse(booking.package_details) 
            : booking.package_details;
          
          // Increment completed sessions
          packageDetails.completedSessions = (packageDetails.completedSessions || 0) + 1;
          
          // Check if package is fully completed
          const totalSessions = packageDetails.totalSessions || 1;
          if (packageDetails.completedSessions >= totalSessions) {
            // Package fully completed
            await bookingsRepo.update(bookingId, {
              status: 'completed',
              completed_at: new Date().toISOString(),
              package_details: packageDetails,
            });
            bookingCompleted = true;
            console.log(`✅ [LIFECYCLE] Package booking fully completed (${packageDetails.completedSessions}/${totalSessions} sessions)`);
          } else {
            // Package session completed but more sessions remain
            await bookingsRepo.update(bookingId, {
              status: 'in_progress',
              package_details: packageDetails,
            });
            console.log(`📊 [LIFECYCLE] Package session completed (${packageDetails.completedSessions}/${totalSessions} sessions)`);
          }
        } else {
          // Single booking - mark as completed
          await bookingsRepo.update(bookingId, {
            status: 'completed',
            completed_at: new Date().toISOString(),
          });
          bookingCompleted = true;
          console.log(`✅ [LIFECYCLE] Completion OTP verified, booking completed`);
        }
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
          // Non-blocking: Continue with booking completion even if loyalty fails
        }

        // ✅ SQL: Get updated booking and related entities for notifications
        const updatedBooking = await bookingsRepo.findById(bookingId);
        if (!updatedBooking) {
          throw new Error('Booking not found after completion');
        }
        
        // ✅ SQL: Get customer and vendor for notifications
        const customersRepo = getCustomersRepository();
        const vendorsRepo = getVendorsRepository();
        const customer = await customersRepo.findById(updatedBooking.customer_id);
        const vendor = await vendorsRepo.findById(updatedBooking.vendor_id!);

          // Notify Customer
          await createNotificationHelper({
            recipientId: updatedBooking.customer_id,
            recipientType: 'customer',
            type: 'booking_completed',
            category: 'bookings',
            title: 'Service Completed',
            message: `Your service has been completed! Please rate your experience. Booking ID: ${bookingId}`,
            recipientEmail: customer?.email || undefined,
            recipientPhone: customer?.phone,
            channels: { email: true, sms: true, inApp: true, push: false },
            data: { bookingId, vendorName: vendor?.business_name },
            priority: 'medium'
          });

          // Notify Vendor
          await createNotificationHelper({
            recipientId: updatedBooking.vendor_id!,
            recipientType: 'vendor',
            type: 'booking_completed',
            category: 'bookings',
            title: 'Service Completed',
            message: `Service completed for booking ${bookingId}. Earnings: ₹${earningsResult.vendorEarnings}`,
            recipientEmail: vendor?.email || undefined,
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
   * ✅ SQL: Uses vendor_earnings table and vendor repository
   */
  async function realizeEarnings(bookingId: string, booking: any) {
    try {
      const vendorId = booking.vendor_id;
      const totalAmount = booking.total_amount || 0;

      // ✅ SQL: Get vendor tier and commission rate
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        throw new Error(`Vendor not found: ${vendorId}`);
      }

      const tier = vendor.tier || 'Bronze';
      const tierConfig = TIER_CONFIG[tier.toUpperCase() as keyof typeof TIER_CONFIG] || TIER_CONFIG.BRONZE;
      const commissionRate = vendor.commission_percentage || tierConfig.commissionRate;

      // Calculate earnings
      const platformCommission = (totalAmount * commissionRate) / 100;
      const vendorEarnings = totalAmount - platformCommission;

      // ✅ SQL: Create earnings record in vendor_earnings table
      const earningsRepo = getVendorEarningsRepository();
      const earnings = await earningsRepo.create({
        vendor_id: vendorId,
        booking_id: bookingId,
        amount: vendorEarnings,
        commission_amount: platformCommission,
        total_amount: totalAmount,
        commission_rate: commissionRate,
      });

      // ✅ SQL: Update booking with earnings
      const bookingsRepo = getBookingsRepository();
      await bookingsRepo.markEarningsRealized(bookingId, vendorEarnings);

      // ✅ SQL: Update vendor total earnings (using vendor repository)
      await vendorsRepo.update(vendorId, {
        total_earnings: (vendor.total_earnings || 0) + vendorEarnings,
        pending_payout: (vendor.pending_payout || 0) + vendorEarnings,
      });

      console.log(`💰 [EARNINGS] Realized: Total ₹${totalAmount}, Vendor ₹${vendorEarnings}, Platform ₹${platformCommission}`);

      return {
        id: earnings.id,
        bookingId,
        vendorId,
        totalAmount,
        platformCommission,
        commissionRate,
        vendorEarnings,
        status: 'realized',
      };

    } catch (error) {
      console.error('❌ [EARNINGS] Error:', error);
      throw error;
    }
  }

  /**
   * Create Razorpay marketplace settlement
   * ✅ SQL: Uses settlements repository
   */
  async function createSettlement(bookingId: string, booking: any, earnings: any) {
    try {
      // ✅ SQL: Check if already settled
      const bookingsRepo = getBookingsRepository();
      const updatedBooking = await bookingsRepo.findById(bookingId);
      if (updatedBooking?.settlement_id) {
        const settlementsRepo = getSettlementsRepository();
        const existingSettlement = await settlementsRepo.findById(updatedBooking.settlement_id);
        if (existingSettlement) {
          return existingSettlement;
        }
      }

      const vendorId = booking.vendor_id;
      const totalAmount = earnings.totalAmount;
      const commissionAmount = earnings.platformCommission;
      const vendorShare = earnings.vendorEarnings;

      // ✅ SQL: Create settlement record
      const settlementsRepo = getSettlementsRepository();
      let settlement = await settlementsRepo.create({
        vendor_id: vendorId,
        booking_id: bookingId,
        settlement_amount: totalAmount,
        commission_amount: commissionAmount,
        vendor_amount: vendorShare,
        settlement_date: new Date().toISOString().split('T')[0],
      });

      // ✅ SQL: Get vendor bank details for Razorpay transfer
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      
      // Get bank account from vendor_bank_accounts table (if exists)
      const dbClient = getDbClient();
      const { data: bankAccount } = await dbClient
        .from('vendor_bank_accounts')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_verified', true)
        .maybeSingle();
      
      if (bankAccount) {
        try {
          // ✅ ACTUAL RAZORPAY API: Initiate payout to vendor
          console.log(`💸 [SETTLEMENT] Initiating Razorpay payout: ₹${vendorShare} to vendor ${vendorId}`);
          
          const razorpayPayout = await createRazorpayPayout({
            accountId: bankAccount.fund_account_id || bankAccount.account_number,
            amount: vendorShare,
            currency: 'INR',
            notes: {
              bookingId,
              settlementId: settlement.id,
              vendorId,
              accountHolderName: bankAccount.account_holder_name,
              ifsc: bankAccount.ifsc_code,
              accountNumber: bankAccount.account_number
            }
          });
          
          // ✅ SQL: Update settlement with Razorpay payout details
          settlement = await settlementsRepo.update(settlement.id, {
            settlement_status: 'completed',
            razorpay_settlement_id: razorpayPayout.id,
            completed_at: new Date().toISOString(),
          });
          
          // ✅ SQL: Mark earnings as settled
          const earningsRepo = getVendorEarningsRepository();
          await earningsRepo.markSettled(earnings.id, settlement.id);
          
          console.log(`✅ [SETTLEMENT] Razorpay payout created: ${razorpayPayout.id}, Status: ${razorpayPayout.status}`);
        } catch (razorpayError: any) {
          console.error(`❌ [SETTLEMENT] Razorpay payout failed:`, razorpayError);
          
          // ✅ SQL: Mark settlement as failed but keep record
          settlement = await settlementsRepo.update(settlement.id, {
            settlement_status: 'failed',
            failure_reason: razorpayError.message || 'Razorpay payout failed',
          });
          
          // Don't throw - allow booking to complete, settlement can be retried
          console.log(`⚠️ [SETTLEMENT] Settlement failed but booking marked as completed. Retry later.`);
        }
      } else {
        console.log(`⚠️ [SETTLEMENT] Vendor bank not verified, settlement pending`);
        settlement = await settlementsRepo.update(settlement.id, {
          settlement_status: 'pending',
        });
      }

      // ✅ SQL: Link settlement to booking
      await bookingsRepo.linkSettlement(bookingId, settlement.id);

      console.log(`💸 [SETTLEMENT] Created: Total ₹${totalAmount}, Vendor ₹${vendorShare}, Platform ₹${commissionAmount}`);

      return {
        id: settlement.id,
        bookingId,
        vendorId,
        totalAmount: settlement.settlement_amount,
        commissionAmount: settlement.commission_amount,
        vendorShare: settlement.vendor_amount,
        status: settlement.settlement_status,
        razorpay_settlement_id: settlement.razorpay_settlement_id,
      };

    } catch (error) {
      console.error('❌ [SETTLEMENT] Error:', error);
      throw error;
    }
  }

  /**
   * Schedule payout based on admin policies
   * ✅ SQL: Uses payouts repository and payout_policies table
   */
  async function schedulePayout(bookingId: string, booking: any, settlement: any) {
    try {
      // ✅ SQL: Get payout policies from payout_policies table
      const dbClient = getDbClient();
      const { data: payoutPolicy } = await dbClient
        .from('payout_policies')
        .select('*')
        .eq('policy_key', 'default')
        .maybeSingle();

      const payoutPolicies = payoutPolicy || {
        hold_period_days: 7,
        auto_payout: false,
        min_payout_amount: 1000.00,
        payout_period: 'weekly'
      };

      const vendorId = booking.vendor_id;
      const vendorShare = settlement.vendorShare || settlement.vendor_amount;

      // Check if auto payout is enabled
      if (!payoutPolicies.auto_payout) {
        console.log(`⚠️ [PAYOUT] Auto payout disabled, manual payout required`);
        return {
          scheduled: false,
          reason: 'Auto payout disabled',
          requiresManualApproval: true
        };
      }

      // Check minimum payout amount
      if (vendorShare < payoutPolicies.min_payout_amount) {
        console.log(`⚠️ [PAYOUT] Amount below minimum: ₹${vendorShare} < ₹${payoutPolicies.min_payout_amount}`);
        return {
          scheduled: false,
          reason: 'Amount below minimum payout threshold',
          requiresManualApproval: false
        };
      }

      // Calculate payout date based on hold period
      const holdPeriodMs = payoutPolicies.hold_period_days * 24 * 60 * 60 * 1000;
      const payoutDate = new Date(Date.now() + holdPeriodMs);

      // ✅ SQL: Create payout record
      const payoutsRepo = getPayoutsRepository();
      const payout = await payoutsRepo.create({
        vendor_id: vendorId,
        amount: vendorShare,
        bank_account_number: '', // Will be filled from vendor bank account
        ifsc_code: '',
        account_holder_name: '',
        payment_ids: [],
        settlement_id: settlement.id,
      });

      // ✅ SQL: Update payout with scheduled date
      await payoutsRepo.update(payout.id, {
        payout_status: 'scheduled',
        scheduled_at: payoutDate.toISOString(),
      });

      // ✅ SQL: Link earnings to payout (will be done when payout is processed)
      // For now, just mark earnings as settled
      const earningsRepo = getVendorEarningsRepository();
      const earnings = await earningsRepo.findByBooking(bookingId);
      if (earnings) {
        await earningsRepo.update(earnings.id, {
          payout_id: payout.id,
        });
      }

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

  console.log('✅ Complete Booking Lifecycle endpoints registered');
}

