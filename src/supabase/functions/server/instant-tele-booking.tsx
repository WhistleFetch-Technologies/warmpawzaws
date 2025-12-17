/**
 * INSTANT TELE BOOKING STAFF ASSIGNMENT
 * Production-Grade Implementation
 * 
 * Features:
 * - Automatic staff assignment after payment
 * - Staff availability queue management
 * - Role-based staff assignment
 * - Video call link generation
 * - Customer and staff notifications
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

interface InstantTeleAssignment {
  bookingId: string;
  roleId: string;
  customerId: string;
  assignedStaffId: string;
  videoCallLink: string;
  estimatedWaitTime: number; // minutes
  assignedAt: string;
}

export function instantTeleBookingEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * POST /tele/instant/assign-staff
   * Assign staff for instant tele consultation after payment
   * 
   * Body:
   * - bookingId: required
   * - roleId: required (veterinarian, insurance_provider, etc.)
   * - customerId: required
   * - paymentId: required (to verify payment)
   */
  app.post(`${BASE}/tele/instant/assign-staff`, async (c) => {
    try {
      const { bookingId, roleId, customerId, paymentId } = await c.req.json();

      if (!bookingId || !roleId || !customerId || !paymentId) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      console.log(`📞 [INSTANT-TELE] Assigning staff for booking: ${bookingId}, role: ${roleId}`);

      // Verify booking exists and is for tele consultation
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      if (booking.serviceStyle !== 'tele' && booking.serviceType !== 'tele') {
        return c.json({ error: 'Only tele consultation bookings can use instant assignment' }, 400);
      }

      // Verify payment
      const payment = await kv.get(`payment:${paymentId}`);
      if (!payment || payment.status !== 'completed') {
        return c.json({ error: 'Payment not completed' }, 400);
      }

      // Find available staff
      const assignedStaff = await findAvailableStaff(roleId, bookingId);

      if (!assignedStaff) {
        return c.json({
          error: 'No staff available at the moment',
          available: false,
          estimatedWaitTime: 15 // Default wait time
        }, 503);
      }

      // Generate video call link
      const videoCallLink = await generateVideoCallLink(bookingId, assignedStaff.id, customerId);

      // Update booking
      booking.status = 'assigned';
      booking.assignedStaffId = assignedStaff.id;
      booking.staffId = assignedStaff.id;
      booking.staffName = assignedStaff.name;
      booking.videoCallLink = videoCallLink;
      booking.assignedAt = new Date().toISOString();
      booking.estimatedStartTime = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes
      await kv.set(`booking:${bookingId}`, booking);

      // Create assignment record
      const assignment: InstantTeleAssignment = {
        bookingId,
        roleId,
        customerId,
        assignedStaffId: assignedStaff.id,
        videoCallLink,
        estimatedWaitTime: 2, // 2 minutes
        assignedAt: new Date().toISOString()
      };

      await kv.set(`instant_tele_assignment:${bookingId}`, assignment);

      // Add to staff queue
      await addToStaffQueue(assignedStaff.id, bookingId);

      // Notify customer
      await notifyCustomer(customerId, booking.customerPhone, {
        type: 'staff_assigned',
        bookingId,
        staffName: assignedStaff.name,
        videoCallLink,
        estimatedStartTime: booking.estimatedStartTime
      });

      // Notify staff
      await notifyStaff(assignedStaff.id, {
        type: 'new_instant_booking',
        bookingId,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        videoCallLink
      });

      console.log(`✅ [INSTANT-TELE] Staff assigned: ${assignedStaff.id} for booking: ${bookingId}`);

      return c.json({
        success: true,
        assignment,
        booking,
        message: 'Staff assigned successfully'
      });

    } catch (error) {
      console.error('❌ [INSTANT-TELE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Find available staff for instant booking
   */
  async function findAvailableStaff(roleId: string, bookingId: string): Promise<any | null> {
    // Get all vendors with this role
    const allVendors = await kv.getByPrefix('vendor:vendor_');
    const roleVendors = allVendors.filter((v: any) => {
      const vendorRoleId = v.roleId?.replace('role_', '').toLowerCase();
      const targetRoleId = roleId.replace('role_', '').toLowerCase();
      return vendorRoleId === targetRoleId && 
             v.status === 'approved' && 
             v.isActive !== false;
    });

    // Get all staff from these vendors
    const availableStaff: any[] = [];

    for (const vendor of roleVendors) {
      const staffIds = await kv.get(`vendor:${vendor.id}:staff`) || [];

      for (const staffId of staffIds) {
        const staff = await kv.get(`staff:${staffId}`);
        if (!staff || !staff.isActive) continue;

        // Check tele service availability
        const stylePrefs = await kv.get(`staff:${staffId}:style_preferences`) || {
          tele: { enabled: false, available: false, acceptInstantBooking: false }
        };

        if (!stylePrefs.tele?.enabled || !stylePrefs.tele?.available) continue;
        if (!stylePrefs.tele?.acceptInstantBooking) continue;

        // Check if staff is currently in a call
        const activeCalls = await kv.get(`staff:${staffId}:active_calls`) || [];
        if (activeCalls.length > 0) continue;

        // Check queue size (max 3 pending)
        const queue = await kv.get(`staff:${staffId}:instant_queue`) || [];
        if (queue.length >= 3) continue;

        availableStaff.push({
          id: staff.id,
          name: staff.fullName || staff.name,
          vendorId: vendor.id,
          vendorName: vendor.businessName || vendor.fullName,
          rating: staff.rating || vendor.rating,
          queueSize: queue.length
        });
      }
    }

    if (availableStaff.length === 0) {
      return null;
    }

    // Sort by queue size (prefer staff with smaller queue) and rating
    availableStaff.sort((a, b) => {
      if (a.queueSize !== b.queueSize) {
        return a.queueSize - b.queueSize;
      }
      return (b.rating || 0) - (a.rating || 0);
    });

    return availableStaff[0];
  }

  /**
   * Generate video call link
   */
  async function generateVideoCallLink(bookingId: string, staffId: string, customerId: string): Promise<string> {
    // Generate unique room ID
    const roomId = `warmpawz_${bookingId}_${Date.now()}`;
    
    // For now, use Jitsi (can be replaced with 100ms, Agora, etc.)
    const videoCallLink = `https://meet.jit.si/${roomId}`;

    // Store room details
    const roomDetails = {
      roomId,
      bookingId,
      staffId,
      customerId,
      link: videoCallLink,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await kv.set(`video_room:${roomId}`, roomDetails);
    await kv.set(`booking:${bookingId}:video_room`, roomId);

    return videoCallLink;
  }

  /**
   * Add booking to staff queue
   */
  async function addToStaffQueue(staffId: string, bookingId: string) {
    const queue = await kv.get(`staff:${staffId}:instant_queue`) || [];
    queue.push({
      bookingId,
      addedAt: new Date().toISOString(),
      priority: queue.length + 1
    });
    await kv.set(`staff:${staffId}:instant_queue`, queue);
  }

  /**
   * Notify customer
   */
  async function notifyCustomer(customerId: string, customerPhone: string, notification: any) {
    try {
      const notifications = await kv.get(`customer:${customerId}:notifications`) || [];
      notifications.push({
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date().toISOString(),
        read: false
      });
      await kv.set(`customer:${customerId}:notifications`, notifications);

      // Send SMS
      console.log(`📱 [SMS] Would send SMS to ${customerPhone}: Staff assigned`);
    } catch (error) {
      console.error('❌ [INSTANT-TELE] Error notifying customer:', error);
    }
  }

  /**
   * Notify staff
   */
  async function notifyStaff(staffId: string, notification: any) {
    try {
      const notifications = await kv.get(`staff:${staffId}:notifications`) || [];
      notifications.push({
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date().toISOString(),
        read: false
      });
      await kv.set(`staff:${staffId}:notifications`, notifications);
    } catch (error) {
      console.error('❌ [INSTANT-TELE] Error notifying staff:', error);
    }
  }

  /**
   * GET /tele/instant/queue-status/:bookingId
   * Get queue status for instant booking
   */
  app.get(`${BASE}/tele/instant/queue-status/:bookingId`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const assignment = await kv.get(`instant_tele_assignment:${bookingId}`);

      if (!assignment) {
        return c.json({ error: 'Assignment not found' }, 404);
      }

      const staff = await kv.get(`staff:${assignment.assignedStaffId}`);
      const queue = await kv.get(`staff:${assignment.assignedStaffId}:instant_queue`) || [];
      const position = queue.findIndex((q: any) => q.bookingId === bookingId) + 1;

      return c.json({
        success: true,
        assignment,
        queuePosition: position,
        queueSize: queue.length,
        estimatedWaitTime: position * 5 // 5 minutes per booking
      });

    } catch (error) {
      console.error('❌ [INSTANT-TELE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Instant Tele Booking endpoints registered');
}
