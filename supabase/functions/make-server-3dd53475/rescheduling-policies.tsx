import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 📅 RESCHEDULING POLICIES
 * 
 * Phase 7C: Payment & Settlement - Rule 15 Implementation
 * 
 * Features:
 * - Service-specific rescheduling policies
 * - Refund policy enforcement
 * - Reschedule request management
 * - Availability-based rescheduling
 */

interface ReschedulingPolicy {
  serviceType: string;
  allowRescheduling: boolean;
  maxReschedules: number;
  minNoticeHours: number;
  refundPolicy: {
    fullRefund: boolean;
    partialRefundPercentage?: number;
    noRefund?: boolean;
  };
  reschedulingFee?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RescheduleRequest {
  rescheduleId: string;
  bookingId: string;
  customerId: string;
  vendorId: string;
  serviceType: string;
  originalDateTime: string;
  newDateTime: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  refundAmount?: number;
  reschedulingFee?: number;
  approvedAt?: string;
  rejectedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export function reschedulingPoliciesEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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

      // Get booking details
      const booking = await kv.get(`booking_${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const serviceType = booking.serviceType;
      const customerId = booking.customerId;
      const vendorId = booking.vendorId;
      const originalDateTime = booking.scheduledAt;

      // Get rescheduling policy
      const policy = await kv.get(`rescheduling_policy_${serviceType}`) || {
        allowRescheduling: true,
        maxReschedules: 2,
        minNoticeHours: 24,
        refundPolicy: { fullRefund: false, partialRefundPercentage: 50 },
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

      // Check max reschedules
      const existingReschedules = await kv.getByPrefix(`reschedule_request_${bookingId}_`);
      if (existingReschedules.length >= policy.maxReschedules) {
        return sendError(c, `Maximum ${policy.maxReschedules} reschedules allowed`, 400);
      }

      const rescheduleId = `reschedule_${bookingId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Calculate refund if applicable
      let refundAmount = 0;
      if (policy.refundPolicy.fullRefund) {
        refundAmount = booking.totalAmount || booking.amount || 0;
      } else if (policy.refundPolicy.partialRefundPercentage) {
        const amount = booking.totalAmount || booking.amount || 0;
        refundAmount = (amount * policy.refundPolicy.partialRefundPercentage) / 100;
      }

      const request: RescheduleRequest = {
        rescheduleId,
        bookingId,
        customerId,
        vendorId,
        serviceType,
        originalDateTime,
        newDateTime,
        reason,
        status: 'pending',
        refundAmount,
        reschedulingFee: policy.reschedulingFee || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`reschedule_request_${rescheduleId}`, request);
      await kv.set(`reschedule_request_${bookingId}_${rescheduleId}`, request);

      // Add to pending reschedules
      const pendingReschedules = await kv.get('pending_reschedules') || [];
      pendingReschedules.push(rescheduleId);
      await kv.set('pending_reschedules', pendingReschedules);

      console.log(`✅ Reschedule request created: ${rescheduleId}`);

      return sendSuccess(c, { request, policy }, 'Reschedule request submitted successfully');
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

      const policy = await kv.get(`rescheduling_policy_${serviceType}`);

      if (!policy) {
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

      const existing = await kv.get(`rescheduling_policy_${serviceType}`);

      const policy: ReschedulingPolicy = {
        serviceType,
        allowRescheduling: updates.allowRescheduling ?? existing?.allowRescheduling ?? true,
        maxReschedules: updates.maxReschedules ?? existing?.maxReschedules ?? 2,
        minNoticeHours: updates.minNoticeHours ?? existing?.minNoticeHours ?? 24,
        refundPolicy: updates.refundPolicy ?? existing?.refundPolicy ?? { fullRefund: false, partialRefundPercentage: 50 },
        reschedulingFee: updates.reschedulingFee ?? existing?.reschedulingFee ?? 0,
        isActive: updates.isActive ?? existing?.isActive ?? true,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`rescheduling_policy_${serviceType}`, policy);

      console.log(`✅ Rescheduling policy updated: ${serviceType}`);

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

      const booking = await kv.get(`booking_${bookingId}`);

      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      const serviceType = booking.serviceType;
      const vendorId = booking.vendorId;

      // Get policy
      const policy = await kv.get(`rescheduling_policy_${serviceType}`) || {
        allowRescheduling: true,
        maxReschedules: 2,
        minNoticeHours: 24,
      };

      // Check existing reschedules
      const existingReschedules = await kv.getByPrefix(`reschedule_request_${bookingId}_`);
      const remainingReschedules = policy.maxReschedules - existingReschedules.length;

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

      const request = await kv.get(`reschedule_request_${rescheduleId}`);

      if (!request) {
        return sendError(c, 'Reschedule request not found', 404);
      }

      if (approved) {
        request.status = 'approved';
        request.approvedAt = new Date().toISOString();

        // Update booking
        const booking = await kv.get(`booking_${bookingId}`);
        if (booking) {
          booking.scheduledAt = request.newDateTime;
          booking.isRescheduled = true;
          booking.rescheduledFrom = request.originalDateTime;
          booking.updatedAt = new Date().toISOString();
          await kv.set(`booking_${bookingId}`, booking);
        }
      } else {
        request.status = 'rejected';
        request.rejectedReason = rejectedReason;
      }

      request.updatedAt = new Date().toISOString();

      await kv.set(`reschedule_request_${rescheduleId}`, request);

      // Remove from pending
      const pendingReschedules = await kv.get('pending_reschedules') || [];
      const index = pendingReschedules.indexOf(rescheduleId);
      if (index > -1) {
        pendingReschedules.splice(index, 1);
        await kv.set('pending_reschedules', pendingReschedules);
      }

      console.log(`✅ Reschedule ${approved ? 'approved' : 'rejected'}: ${rescheduleId}`);

      return sendSuccess(c, { request }, `Reschedule ${approved ? 'approved' : 'rejected'} successfully`);
    } catch (error) {
      console.error('Error confirming reschedule:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Rescheduling Policies endpoints registered');
}
