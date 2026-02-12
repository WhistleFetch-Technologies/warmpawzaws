/**
 * ============================================================================
 * ENHANCED OTP ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Universal OTP system for booking verification:
 * - Generate OTP for booking sessions
 * - Verify OTP to start/end sessions
 * - Booking OTP management
 * 
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';
import { sendSMS } from '../utils/sms-service';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { getCompletedPayment, getTotalPaidForBooking, resolvePaymentPolicy } from '../utils/payment-policy';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

export function registerEnhancedOtpEndpoints(app: Hono) {
  /**
   * POST /bookings/:bookingId/generate-otp
   * Generate OTP for booking session start/end
   */
  app.post("/bookings/:bookingId/generate-otp", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { sessionNumber = 1, action = 'start' } = await c.req.json();

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store OTP in database
      await insert('otp_tokens', {
        phone: null, // Booking OTPs don't need phone
        otp_code: otp,
        otp_type: `booking_${action}`,
        expires_in_minutes: 1440, // 24 hours
        max_attempts: 3,
        metadata: {
          bookingId,
          sessionNumber,
          action,
        },
      });

      // Get customer to send OTP
      const customers = await select('customers', { id: booking.customer_id });
      const customer = customers.length > 0 ? customers[0] : null;

      // Send OTP via SMS if customer phone available
      if (customer?.phone) {
        await sendSMS({
          to: customer.phone,
          message: `Your Warmpawz verification code for booking ${bookingId} (${action}): ${otp}. Valid for 24 hours.`,
          type: 'otp',
        }).catch(err => console.error('SMS send failed:', err));
      }

      return c.json({
        success: true,
        otp, // In production, don't return OTP - only for testing
        generatedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        sentTo: customer?.phone || null,
      });
    } catch (error: any) {
      console.error('Error generating booking OTP:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /bookings/:bookingId/verify-otp
   * Verify OTP and start/end session
   */
  app.post("/bookings/:bookingId/verify-otp", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { otp, action = 'start', sessionNumber = 1 } = await c.req.json();

      if (!otp || otp.length !== 6) {
        return c.json({ error: 'Invalid OTP format' }, 400);
      }

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Find OTP token
      const otpTokens = await query(
        `SELECT * FROM otp_tokens
         WHERE metadata->>'bookingId' = $1
           AND metadata->>'action' = $2
           AND metadata->>'sessionNumber' = $3
           AND is_used = false
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [bookingId, action, sessionNumber.toString()]
      ).catch(() => ({ rows: [] }));

      if (otpTokens.rows.length === 0) {
        return c.json({
          error: 'OTP not found',
          message: 'Please generate a new OTP',
        }, 400);
      }

      const otpToken = otpTokens.rows[0];

      // Check attempts
      if (otpToken.attempts >= otpToken.max_attempts) {
        return c.json({
          error: 'Maximum attempts exceeded',
          message: 'Please generate a new OTP',
        }, 400);
      }

      // Verify OTP
      if (otp !== otpToken.otp_code) {
        await update('otp_tokens',
          { id: otpToken.id },
          { attempts: (otpToken.attempts || 0) + 1 }
        );

        return c.json({
          success: false,
          verified: false,
          message: 'Invalid OTP',
          remainingAttempts: otpToken.max_attempts - ((otpToken.attempts || 0) + 1),
        }, 400);
      }

      // Mark OTP as used
      await update('otp_tokens',
        { id: otpToken.id },
        {
          is_used: true,
          used_at: new Date().toISOString(),
        }
      );

      // Block completion if payment is still due
      if (action === 'end') {
        const totalAmount = parseFloat(bookings[0]?.total_amount || '0') || 0;
        const totalPaid = await getTotalPaidForBooking(bookingId);
        const remainingDue = Math.max(0, totalAmount - totalPaid);

        if (remainingDue > 0.01) {
          try {
            await insert('notifications', {
              recipient_id: bookings[0].customer_id,
              recipient_type: 'customer',
              type: 'payment_due',
              title: 'Payment required to complete appointment',
              message: `Please complete payment of ₹${remainingDue.toFixed(2)} to finish your appointment.`,
              data: JSON.stringify({
                bookingId,
                remainingDue,
                totalAmount,
                totalPaid,
              }),
              is_read: false,
              created_at: new Date(),
            });
          } catch (notifErr) {
            console.warn('Failed to create payment due notification:', notifErr);
          }

          return c.json({
            error: 'Payment required',
            message: 'Please complete payment before ending the appointment.',
            remainingDue,
          }, 402);
        }
      }

      // Update booking status based on action
      const updateData: any = {};
      if (action === 'start') {
        updateData.status = 'in_progress';
        updateData.started_at = new Date().toISOString();
      } else if (action === 'end') {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
      }

      if (Object.keys(updateData).length > 0) {
        await update('bookings', { id: bookingId }, updateData);
      }

      return c.json({
        success: true,
        verified: true,
        message: `OTP verified. Session ${action}ed successfully.`,
        booking: {
          id: bookingId,
          status: updateData.status || bookings[0].status,
        },
      });
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /bookings/create-with-otp
   * Create booking with OTP system
   */
  app.post("/bookings/create-with-otp", async (c) => {
    try {
      const body = await c.req.json();
      const {
        customerId,
        vendorId,
        serviceType,
        serviceId,
        staffId,
        scheduledDate,
        scheduledTime,
        petId,
        price,
        notes,
        paymentId,
        razorpayPaymentId,
        razorpayOrderId,
      } = body;

      if (!customerId || !vendorId || !serviceType || !serviceId) {
        return c.json({
          error: 'Customer, vendor, service type, and service ID are required',
        }, 400);
      }

      const vendorRows = await select('vendors', { id: vendorId });
      const vendorType = vendorRows[0]?.category || vendorRows[0]?.vendor_type || vendorRows[0]?.vendorType || null;

      const totalAmount = parseFloat(price || '0');
      const policy = await resolvePaymentPolicy({
        vendorType,
        serviceType,
        totalAmount,
      });

      let paymentRecord: any | null = null;
      let amountPaid = 0;
      if (policy.requiredUpfront > 0) {
        if (!paymentId && !razorpayPaymentId && !razorpayOrderId) {
          return c.json({
            error: 'Payment required before booking creation',
            paymentRequired: true,
            requiredUpfront: policy.requiredUpfront,
            totalAmount,
            policyRule: policy.rule || null,
          }, 402);
        }

        paymentRecord = await getCompletedPayment({
          paymentId,
          razorpayPaymentId,
          razorpayOrderId,
          customerId,
          vendorId,
        });

        if (!paymentRecord) {
          return c.json({
            error: 'Payment not found or not completed',
            paymentRequired: true,
            requiredUpfront: policy.requiredUpfront,
            totalAmount,
          }, 402);
        }

        amountPaid = parseFloat(paymentRecord.amount || '0') || 0;
        if (amountPaid + 0.01 < policy.requiredUpfront) {
          return c.json({
            error: 'Insufficient payment for booking creation',
            paymentRequired: true,
            requiredUpfront: policy.requiredUpfront,
            totalAmount,
            amountPaid,
          }, 402);
        }
      }

      const remainingDue = Math.max(0, totalAmount - amountPaid);
      const paymentStatus = totalAmount === 0
        ? 'paid'
        : remainingDue > 0
          ? 'partial'
          : 'paid';

      // Generate OTPs
      const startOTP = generateOTP();
      const endOTP = generateOTP();

      const initialStatus = 'pending';

      // Create booking
      const booking = await insert('bookings', {
        customer_id: customerId,
        vendor_id: vendorId,
        service_id: serviceId,
        staff_id: staffId || null,
        booking_date: scheduledDate,
        booking_time: scheduledTime,
        status: initialStatus,
        service_type: serviceType,
        base_price: totalAmount,
        total_amount: totalAmount,
        payment_status: paymentStatus,
        payment_id: paymentRecord?.id || null,
        notes: notes || null,
        otp_code: startOTP, // Store start OTP in booking
        otp_verified: false,
      });

      if (paymentRecord?.id) {
        await update('payments', { id: paymentRecord.id }, {
          booking_id: booking[0].id,
          updated_at: new Date().toISOString(),
        });
      }

      // Store end OTP separately
      await insert('otp_tokens', {
        phone: null,
        otp_code: endOTP,
        otp_type: 'booking_end',
        expires_in_minutes: 1440,
        max_attempts: 3,
        metadata: {
          bookingId: booking[0].id,
          action: 'end',
        },
      });

      // Get customer to send OTPs
      const customers = await select('customers', { id: customerId });
      const customer = customers.length > 0 ? customers[0] : null;

      // Send OTPs via SMS
      if (customer?.phone) {
        const snsClient = getSnsClient();
        await snsClient.send(new PublishCommand({
          PhoneNumber: customer.phone,
          Message: `Your Warmpawz booking ${booking[0].id} is confirmed! Start OTP: ${startOTP}, End OTP: ${endOTP}. Save these for verification.`,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
          },
        })).catch(err => console.error('SMS send failed:', err));
      }

      return c.json({
        success: true,
        booking: booking[0],
        otps: {
          start: startOTP,
          end: endOTP,
        },
        message: 'Booking created successfully. Save your OTPs for service verification.',
      });
    } catch (error: any) {
      console.error('Error creating booking with OTP:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
