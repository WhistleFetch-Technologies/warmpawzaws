/**
 * ============================================================================
 * HOME SERVICE AUTO-ASSIGNMENT - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Auto-assign staff for home services based on proximity
 * - Availability validation
 * - Radius filtering
 * - Fallback to manual assignment
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `bookings`, `staff`, `vendors`, `staff_services`, `services` tables
 * - Uses `staff_availability`, `vendor_availability_v2` tables
 * - Uses `BookingsRepository`, `StaffRepository`, `VendorsRepository`, `ServicesRepository`
 * 
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';

const app = new Hono();
app.use('*', cors());

// Helper: Calculate distance (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * POST /make-server-3dd53475/assignments/auto-assign-home-service
 * Auto-assign staff for home service based on proximity and availability
 */
app.post('/make-server-3dd53475/assignments/auto-assign-home-service', async (c) => {
  try {
    const body = await c.req.json();
    const {
      bookingId,
      serviceId,
      customerLocation,
      scheduledDateTime,
      maxRadius = 10 // km
    } = body;

    // Validation
    if (!bookingId || !serviceId || !customerLocation) {
      return c.json({
        error: 'Missing required fields',
        required: ['bookingId', 'serviceId', 'customerLocation']
      }, 400);
    }

    if (!customerLocation.latitude || !customerLocation.longitude) {
      return c.json({
        error: 'Invalid customer location',
        message: 'Location must include latitude and longitude'
      }, 400);
    }

    console.log(`🔍 Starting home service auto-assignment for booking: ${bookingId}`);

    // ✅ SQL: Get service details
    const servicesRepo = getServicesRepository();
    const service = await servicesRepo.findById(serviceId);
    if (!service) {
      return c.json({ error: 'Service not found' }, 404);
    }

    // ✅ SQL: Find eligible staff for this service
    const db = getDbClient();
    const { data: staffServices } = await db
      .from('staff_services')
      .select('staff_id, staff!inner(*)')
      .eq('service_id', serviceId)
      .eq('is_active', true);

    if (!staffServices || staffServices.length === 0) {
      return c.json({
        success: false,
        assignmentMethod: 'manual_pending',
        message: 'No staff available for this service',
        fallbackReason: 'No staff available for this service'
      });
    }

    const staffIds = staffServices.map((ss: any) => ss.staff_id);
    const staffRepo = getStaffRepository();
    
    // Get staff details
    const eligibleStaff = [];
    for (const staffId of staffIds) {
      const staff = await staffRepo.findById(staffId);
      if (staff && staff.is_active) {
        // ✅ SQL: Get vendor location for distance calculation
        const vendorsRepo = getVendorsRepository();
        const vendor = staff.vendor_id ? await vendorsRepo.findById(staff.vendor_id) : null;
        
        let distance = null;
        if (vendor && vendor.latitude && vendor.longitude) {
          distance = calculateDistance(
            customerLocation.latitude,
            customerLocation.longitude,
            vendor.latitude,
            vendor.longitude
          );
        }

        // ✅ SQL: Check availability
        const scheduledDate = scheduledDateTime ? new Date(scheduledDateTime) : new Date();
        const dayOfWeek = scheduledDate.getDay();
        
        const { data: availability } = await db
          .from('staff_availability')
          .select('*')
          .eq('staff_id', staffId)
          .eq('date', scheduledDate.toISOString().split('T')[0])
          .eq('is_available', true)
          .limit(1);

        const isAvailable = availability && availability.length > 0;

        if (distance !== null && distance <= maxRadius && isAvailable) {
          // ✅ SQL: Get rating and completed bookings
          const { data: reviews } = await db
            .from('reviews')
            .select('rating')
            .eq('staff_id', staffId);
          
          const avgRating = reviews && reviews.length > 0
            ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
            : 4.5;

          const { data: bookings } = await db
            .from('bookings')
            .select('id', { count: 'exact' })
            .eq('staff_id', staffId)
            .eq('status', 'in_progress')
            .limit(10);

          eligibleStaff.push({
            staffId: staff.id,
            staffName: staff.full_name,
            rating: avgRating,
            distance,
            activeBookings: bookings?.length || 0,
            maxConcurrentBookings: 3
          });
        }
      }
    }

    if (eligibleStaff.length === 0) {
      // ✅ SQL: Update booking status to manual assignment pending
      const bookingsRepo = getBookingsRepository();
      await bookingsRepo.update(bookingId, {
        status: 'pending',
        notes: 'Manual assignment required - no staff available within radius'
      });

      return c.json({
        success: false,
        assignmentMethod: 'manual_pending',
        message: 'Your request has been accepted. We will assign a service provider shortly.',
        fallbackReason: `No staff available within ${maxRadius}km radius`,
        estimatedAssignmentTime: 'within 1 hour'
      });
    }

    // Rank candidates (proximity 40% + rating 40% + workload 20%)
    const rankedStaff = eligibleStaff.map(staff => {
      const proximityScore = Math.max(0, 40 * (1 - staff.distance / 10));
      const ratingScore = (staff.rating / 5) * 40;
      const workloadScore = 20 * (1 - (staff.activeBookings / staff.maxConcurrentBookings));
      return { ...staff, score: proximityScore + ratingScore + workloadScore };
    }).sort((a, b) => b.score - a.score);

    const selected = rankedStaff[0];

    // ✅ SQL: Update booking with assigned staff
    const bookingsRepo = getBookingsRepository();
    await bookingsRepo.update(bookingId, {
      staff_id: selected.staffId,
      status: 'confirmed'
    });

    // ✅ SQL: Create notification
    const notificationsRepo = getNotificationsRepository();
    await notificationsRepo.create({
      recipient_type: 'staff',
      recipient_id: selected.staffId,
      notification_type: 'new_assignment',
      title: 'New Booking Assigned',
      message: `You have been assigned to a new home service booking`,
      channels: { inApp: true, push: true }
    });

    console.log(`✅ Auto-assigned: ${selected.staffName} (${selected.distance.toFixed(2)}km away) to booking ${bookingId}`);

    return c.json({
      success: true,
      assignedStaffId: selected.staffId,
      assignedStaffName: selected.staffName,
      assignmentMethod: 'auto',
      message: `${selected.staffName} has been assigned to your service`,
      estimatedAssignmentTime: 'immediate',
      staffDetails: {
        distance: parseFloat(selected.distance.toFixed(2)),
        rating: selected.rating,
        experience: 0
      }
    });

  } catch (error: any) {
    console.error('Error in home service auto-assignment:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default app;

