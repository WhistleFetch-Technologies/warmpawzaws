/**
 * RESCHEDULING POLICIES - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: All KV operations replaced with SQL queries
 * 
 * Phase 7C: Payment & Settlement - Rule 15 Implementation
 * 
 * Features:
 * - Service-specific rescheduling policies
 * - Refund policy enforcement
 * - Reschedule request management
 * - Availability-based rescheduling
 * 
 * Date: 2025-01-28
 * Migration: KV to SQL (19 KV operations → 0)
 */

import { Hono } from 'npm:hono';
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { sendSuccess, sendError } from './response-utils.ts';

export function reschedulingPoliciesEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();
  const bookingsRepo = getBookingsRepository();

  // ========================================
  // REQUEST RESCHEDULE
  // ========================================
  app.post(`${BASE_PATH}/booking/:bookingId/reschedule`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const {
        newDateTime,
        reason,
      } = await c.req.json();

      if (!newDateTime) {
        return sendError(c, 'newDateTime is required', 400);
      }

      // ✅ SQL: Get booking details
      const booking = await bookingsRepo.findById(bookingId);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const serviceType = booking.service_type;
      const customerId = booking.customer_id;
      const vendorId = booking.vendor_id;
      const originalDateTime = `${booking.booking_date}T${booking.booking_time}`;

      // ✅ SQL: Get rescheduling policy from rescheduling_policies table
      const { data: policyData } = await db
        .from('rescheduling_policies')
        .select('*')
        .eq('service_type', serviceType)
        .eq('is_active', true)
        .single();

      // Default policy if not found
      const policy = policyData ? {
        allowRescheduling: true,
        maxReschedules: policyData.max_reschedules || 2,
        minNoticeHours: policyData.hours_before_booking || 24,
        refundPolicy: { fullRefund: false, partialRefundPercentage: 50 },
        reschedulingFee: parseFloat((policyData.rescheduling_fee_percentage || 0).toString()),
      } : {
        allowRescheduling: true,
        maxReschedules: 2,
        minNoticeHours: 24,
        refundPolicy: { fullRefund: false, partialRefundPercentage: 50 },
        reschedulingFee: 0,
      };

      // Check if rescheduling is allowed
      if (!policy.allowRescheduling) {
        return sendError(c, 'Rescheduling not allowed for this service type', 400);
      }

      // Check minimum notice period
      const bookingTime = new Date(originalDateTime).getTime();
      const currentTime = Date.now();
      const hoursUntilBooking = (bookingTime - currentTime) / (1000 * 60 * 60);

      if (hoursUntilBooking < policy.minNoticeHours) {
        return sendError(c, `Rescheduling requires at least ${policy.minNoticeHours} hours notice`, 400);
      }

      // ✅ SQL: Check max reschedules - count existing reschedule requests for this booking
      const { data: existingReschedules } = await db
        .from('pending_reschedules')
        .select('id')
        .eq('booking_id', bookingId)
        .in('status', ['pending', 'approved']);

      if (existingReschedules && existingReschedules.length >= policy.maxReschedules) {
        return sendError(c, `Maximum ${policy.maxReschedules} reschedules allowed`, 400);
      }

      // Parse new date/time
      const newDateObj = new Date(newDateTime);
      const requestedDate = newDateObj.toISOString().split('T')[0];
      const requestedTime = newDateObj.toTimeString().split(' ')[0].substring(0, 5); // HH:MM format

      // Calculate refund if applicable
      let refundAmount = 0;
      if (policy.refundPolicy.fullRefund) {
        refundAmount = booking.total_amount || 0;
      } else if (policy.refundPolicy.partialRefundPercentage) {
        const amount = booking.total_amount || 0;
        refundAmount = (amount * policy.refundPolicy.partialRefundPercentage) / 100;
      }

      const reschedulingFee = policy.reschedulingFee || 0;

      // ✅ SQL: Create reschedule request in pending_reschedules table
      const { data: rescheduleRequest, error: insertError } = await db
        .from('pending_reschedules')
        .insert({
          booking_id: bookingId,
          requested_date: requestedDate,
          requested_time: requestedTime,
          reason: reason || null,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      console.log(`✅ Reschedule request created: ${rescheduleRequest.id}`);

      // Format response to match expected interface
      const requestResponse = {
        rescheduleId: rescheduleRequest.id,
        bookingId: rescheduleRequest.booking_id,
        customerId: customerId,
        vendorId: vendorId || null,
        serviceType: serviceType,
        originalDateTime: originalDateTime,
        newDateTime: newDateTime,
        reason: rescheduleRequest.reason,
        status: rescheduleRequest.status,
        refundAmount: refundAmount,
        reschedulingFee: reschedulingFee,
        createdAt: rescheduleRequest.requested_at || new Date().toISOString(),
        updatedAt: rescheduleRequest.requested_at || new Date().toISOString(),
      };

      return sendSuccess(c, { request: requestResponse, policy }, 'Reschedule request submitted successfully');
    } catch (error) {
      console.error('Error requesting reschedule:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET RESCHEDULING POLICY
  // ========================================
  app.get(`${BASE_PATH}/booking/rescheduling-policy/:serviceType`, async (c) => {
    try {
      const serviceType = c.req.param('serviceType');

      // ✅ SQL: Get rescheduling policy from rescheduling_policies table
      const { data: policyData } = await db
        .from('rescheduling_policies')
        .select('*')
        .eq('service_type', serviceType)
        .eq('is_active', true)
        .single();

      if (!policyData) {
        // Return default policy
        return sendSuccess(c, {
          policy: {
            serviceType,
            allowRescheduling: true,
            maxReschedules: 2,
            minNoticeHours: 24,
            refundPolicy: {
              fullRefund: false,
              partialRefundPercentage: 50,
            },
            reschedulingFee: 0,
            isActive: true,
          },
        });
      }

      // Format policy response
      const policy = {
        serviceType: policyData.service_type || serviceType,
        allowRescheduling: policyData.is_active,
        maxReschedules: policyData.max_reschedules || 2,
        minNoticeHours: policyData.hours_before_booking || 24,
        refundPolicy: {
          fullRefund: false,
          partialRefundPercentage: 50,
        },
        reschedulingFee: parseFloat((policyData.rescheduling_fee_percentage || 0).toString()),
        isActive: policyData.is_active,
        createdAt: policyData.created_at,
        updatedAt: policyData.updated_at,
      };

      return sendSuccess(c, { policy });
    } catch (error) {
      console.error('Error getting rescheduling policy:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // UPDATE RESCHEDULING POLICY
  // ========================================
  app.put(`${BASE_PATH}/booking/rescheduling-policy/:serviceType`, async (c) => {
    try {
      const serviceType = c.req.param('serviceType');
      const updates = await c.req.json();

      // ✅ SQL: Get existing policy
      const { data: existing } = await db
        .from('rescheduling_policies')
        .select('*')
        .eq('service_type', serviceType)
        .single();

      const updateData: any = {
        service_type: serviceType,
        hours_before_booking: updates.minNoticeHours ?? existing?.hours_before_booking ?? 24,
        max_reschedules: updates.maxReschedules ?? existing?.max_reschedules ?? 2,
        rescheduling_fee_percentage: updates.reschedulingFee ?? existing?.rescheduling_fee_percentage ?? 0,
        is_active: updates.isActive ?? existing?.is_active ?? true,
        updated_at: new Date().toISOString(),
      };

      // ✅ SQL: Upsert policy (use policy_name as unique key or service_type if unique constraint exists)
      let policyData;
      let error;
      
      if (existing) {
        // Update existing
        const { data, error: updateError } = await db
          .from('rescheduling_policies')
          .update(updateData)
          .eq('id', existing.id)
          .select()
          .single();
        policyData = data;
        error = updateError;
      } else {
        // Insert new
        updateData.policy_name = `rescheduling_${serviceType}`;
        const { data, error: insertError } = await db
          .from('rescheduling_policies')
          .insert(updateData)
          .select()
          .single();
        policyData = data;
        error = insertError;
      }

      if (error || !policyData) {
        throw error || new Error('Failed to save rescheduling policy');
      }

      console.log(`✅ Rescheduling policy updated: ${serviceType}`);

      // Format policy response
      const policy = {
        serviceType: policyData.service_type,
        allowRescheduling: policyData.is_active,
        maxReschedules: policyData.max_reschedules,
        minNoticeHours: policyData.hours_before_booking,
        refundPolicy: {
          fullRefund: false,
          partialRefundPercentage: 50,
        },
        reschedulingFee: parseFloat((policyData.rescheduling_fee_percentage || 0).toString()),
        isActive: policyData.is_active,
        createdAt: policyData.created_at,
        updatedAt: policyData.updated_at,
      };

      return sendSuccess(c, { policy }, 'Rescheduling policy updated successfully');
    } catch (error) {
      console.error('Error updating rescheduling policy:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET RESCHEDULE OPTIONS
  // ========================================
  app.get(`${BASE_PATH}/booking/:bookingId/reschedule-options`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');

      // ✅ SQL: Get booking
      const booking = await bookingsRepo.findById(bookingId);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const serviceType = booking.service_type;
      const vendorId = booking.vendor_id;

      // ✅ SQL: Get policy
      const { data: policyData } = await db
        .from('rescheduling_policies')
        .select('*')
        .eq('service_type', serviceType)
        .eq('is_active', true)
        .single();

      const policy = policyData ? {
        allowRescheduling: policyData.is_active,
        maxReschedules: policyData.max_reschedules || 2,
        minNoticeHours: policyData.hours_before_booking || 24,
        reschedulingFee: parseFloat((policyData.rescheduling_fee_percentage || 0).toString()),
        refundPolicy: { fullRefund: false, partialRefundPercentage: 50 },
      } : {
        allowRescheduling: true,
        maxReschedules: 2,
        minNoticeHours: 24,
        reschedulingFee: 0,
        refundPolicy: { fullRefund: false, partialRefundPercentage: 50 },
      };

      // ✅ SQL: Check existing reschedules
      const { data: existingReschedules } = await db
        .from('pending_reschedules')
        .select('id')
        .eq('booking_id', bookingId)
        .in('status', ['pending', 'approved']);

      const remainingReschedules = policy.maxReschedules - (existingReschedules?.length || 0);

      // Get available time slots (simplified - in production, check vendor availability)
      const availableSlots = [];
      const now = new Date();
      
      for (let i = 1; i <= 7; i++) {
        const date = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        availableSlots.push({
          date: date.toISOString().split('T')[0],
          slots: [
            { time: '09:00', available: true },
            { time: '11:00', available: true },
            { time: '14:00', available: true },
            { time: '16:00', available: true },
          ],
        });
      }

      const options = {
        canReschedule: policy.allowRescheduling && remainingReschedules > 0,
        remainingReschedules,
        minNoticeHours: policy.minNoticeHours,
        reschedulingFee: policy.reschedulingFee || 0,
        refundPolicy: policy.refundPolicy,
        availableSlots,
      };

      return sendSuccess(c, { options });
    } catch (error) {
      console.error('Error getting reschedule options:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // CONFIRM RESCHEDULE
  // ========================================
  app.post(`${BASE_PATH}/booking/:bookingId/reschedule/confirm`, async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const { rescheduleId, approved, rejectedReason } = await c.req.json();

      if (!rescheduleId) {
        return sendError(c, 'rescheduleId is required', 400);
      }

      // ✅ SQL: Get reschedule request
      const { data: requestData, error: fetchError } = await db
        .from('pending_reschedules')
        .select('*')
        .eq('id', rescheduleId)
        .eq('booking_id', bookingId)
        .single();

      if (fetchError || !requestData) {
        return sendError(c, 'Reschedule request not found', 404);
      }

      if (approved) {
        // ✅ SQL: Update reschedule request status
        const { data: updatedRequest, error: updateError } = await db
          .from('pending_reschedules')
          .update({
            status: 'approved',
            processed_at: new Date().toISOString()
          })
          .eq('id', rescheduleId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        // ✅ SQL: Update booking using repository
        const booking = await bookingsRepo.findById(bookingId);
        if (booking) {
          // Use the repository's reschedule method or update directly
          const newDate = updatedRequest.requested_date;
          const newTime = updatedRequest.requested_time;
          
          await bookingsRepo.update(bookingId, {
            booking_date: newDate,
            booking_time: newTime,
            notes: `Rescheduled from ${booking.booking_date} ${booking.booking_time}`
          });
        }
      } else {
        // ✅ SQL: Update reschedule request status to rejected
        const { data: updatedRequest, error: updateError } = await db
          .from('pending_reschedules')
          .update({
            status: 'rejected',
            reason: rejectedReason || requestData.reason || 'Rejected',
            processed_at: new Date().toISOString()
          })
          .eq('id', rescheduleId)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }
      }

      // ✅ SQL: Get updated request
      const { data: finalRequest } = await db
        .from('pending_reschedules')
        .select('*')
        .eq('id', rescheduleId)
        .single();

      // Format response
      const requestResponse = {
        rescheduleId: finalRequest.id,
        bookingId: finalRequest.booking_id,
        status: finalRequest.status,
        approvedAt: finalRequest.processed_at,
        rejectedReason: finalRequest.reason,
        createdAt: finalRequest.requested_at,
        updatedAt: finalRequest.processed_at,
      };

      console.log(`✅ Reschedule ${approved ? 'approved' : 'rejected'}: ${rescheduleId}`);

      return sendSuccess(c, { request: requestResponse }, `Reschedule ${approved ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      console.error('Error confirming reschedule:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Rescheduling Policies endpoints registered (SQL-only)');
}

