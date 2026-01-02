/**
 * PRIORITY 2: Home Service Auto-Assignment
 * 
 * Implements auto-assignment for home services
 * (Was at 70%, now completing to 95%)
 * 
 * Features:
 * - Proximity-based ranking
 * - Availability validation
 * - Radius filtering (10km default)
 * - Fallback to manual assignment
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { cors } from "hono/cors";
import {
  getServicesRepository,
  getStaffRepository,
  getSchedulingRepository,
  getBookingsRepository,
  getNotificationsRepository,
  getVendorsRepository
} from '../../../supabase/lib/repositories/index';

const app = new Hono();
app.use('*', cors());

/**
 * POST /assignments/auto-assign-home-service
 * Auto-assign staff for home service based on proximity and availability
 * 
 * Status: ✅ NOW FULLY IMPLEMENTED
 */
app.post('/assignments/auto-assign-home-service', async (c) => {
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

    // ✅ STEP 1: Find eligible staff for this service
    const eligibleStaff = await findEligibleStaffForService(serviceId, service.vendor_id || service.vendorId);

    if (eligibleStaff.length === 0) {
      return fallbackToManualAssignment(bookingId, 'No staff available for this service');
    }

    console.log(`✅ Found ${eligibleStaff.length} eligible staff members`);

    // ✅ STEP 2: Filter by proximity (within maxRadius)
    const staffWithDistance = await Promise.all(
      eligibleStaff.map(async (staff) => {
        const distance = await calculateStaffDistance(staff, customerLocation, scheduledDateTime);
        return { ...staff, distance };
      })
    );

    const nearbyStaff = staffWithDistance.filter(staff => 
      staff.distance !== null && staff.distance <= maxRadius
    );

    if (nearbyStaff.length === 0) {
      return fallbackToManualAssignment(
        bookingId, 
        `No staff available within ${maxRadius}km radius`,
        maxRadius
      );
    }

    console.log(`✅ ${nearbyStaff.length} staff within ${maxRadius}km radius`);

    // ✅ STEP 3: Filter by availability at scheduled time
    const availableStaff = await Promise.all(
      nearbyStaff.map(async (staff) => {
        const isAvailable = await checkStaffAvailability(staff.staffId, scheduledDateTime);
        return { ...staff, isAvailable };
      })
    );

    const readyStaff = availableStaff.filter(staff => staff.isAvailable);

    if (readyStaff.length === 0) {
      return fallbackToManualAssignment(
        bookingId,
        'No staff available at scheduled time'
      );
    }

    console.log(`✅ ${readyStaff.length} staff available at scheduled time`);

    // ✅ STEP 4: Rank candidates
    const rankedStaff = rankHomeServiceCandidates(readyStaff);
    const selected = rankedStaff[0];

    // ✅ STEP 5: Assign to booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // ✅ SQL: Update booking with staff assignment
    await bookingsRepo.update(bookingId, {
      assigned_staff_id: selected.staffId,
      assigned_staff_name: selected.staffName,
      assigned_staff_photo: selected.staffPhoto,
      assignment_method: 'auto',
      assignment_criteria: {
        distance: selected.distance,
        rating: selected.rating,
        rankingScore: selected.score
      },
      status: 'assigned',
      assigned_at: new Date().toISOString()
    });

    // Update staff active bookings
    await incrementStaffActiveBookings(selected.staffId);

    // Notify staff
    await notifyStaffOfAssignment(selected.staffId, bookingId, 'home_service');

    console.log(`✅ Auto-assigned: ${selected.staffName} (${selected.distance.toFixed(2)}km away) to booking ${bookingId}`);

    return c.json({
      success: true,
      assignedStaffId: selected.staffId,
      assignedStaffName: selected.staffName,
      assignedStaffPhoto: selected.staffPhoto,
      assignmentMethod: 'auto',
      message: `${selected.staffName} has been assigned to your service`,
      estimatedAssignmentTime: 'immediate',
      staffDetails: {
        distance: parseFloat(selected.distance.toFixed(2)),
        rating: selected.rating,
        experience: selected.experience
      }
    });

  } catch (error: any) {
    console.error('Error in home service auto-assignment:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Find eligible staff for a service
 */
async function findEligibleStaffForService(serviceId: string, vendorId: string) {
  // ✅ SQL: Get all staff for this vendor
  const staffRepo = getStaffRepository();
  const allStaff = await staffRepo.findByVendor(vendorId);

  const eligibleStaff = [];

  for (const staff of allStaff) {
    // Check if staff can perform this service
    const serviceIds = staff.service_ids || staff.serviceIds || [];
    const specializations = staff.specializations || [];
    
    const canPerform = serviceIds.includes(serviceId) || 
                       specializations.some((spec: string) => 
                         serviceId.toLowerCase().includes(spec.toLowerCase())
                       );

    if (canPerform) {
      eligibleStaff.push({
        staffId: staff.id,
        staffName: staff.full_name || staff.name,
        staffPhoto: staff.photo_url || staff.photo,
        rating: staff.rating || 4.5,
        experience: staff.experience_years || staff.experience || 0,
        specializations: specializations
      });
    }
  }

  return eligibleStaff;
}

/**
 * Calculate distance from staff's service location to customer
 */
async function calculateStaffDistance(
  staff: any, 
  customerLocation: any, 
  scheduledDateTime?: string
): Promise<number | null> {
  try {
    // ✅ SQL: Get staff availability to find their service location
    const schedulingRepo = getSchedulingRepository();
    const scheduledDate = scheduledDateTime ? new Date(scheduledDateTime) : new Date();
    
    // Get staff record to find location
    const staffRepo = getStaffRepository();
    const staffRecord = await staffRepo.findById(staff.staffId);
    
    if (!staffRecord || !(staffRecord as any).vendor_id) {
      return null;
    }

    // Try to get location from staff metadata or availability
    const metadata = (staffRecord as any).metadata || {};
    const location = metadata.location || metadata.serviceLocation;
    
    if (!location || !location.latitude || !location.longitude) {
      // Try to get from vendor location
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById((staffRecord as any).vendor_id);
      if (vendor && (vendor as any).latitude && (vendor as any).longitude) {
        const distance = calculateDistance(
          (vendor as any).latitude,
          (vendor as any).longitude,
          customerLocation.latitude,
          customerLocation.longitude
        );
        return distance;
      }
      return null;
    }

    // Calculate distance from staff location
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      customerLocation.latitude,
      customerLocation.longitude
    );

    return distance;

  } catch (error) {
    console.error(`Error calculating distance for staff ${staff.staffId}:`, error);
    return null;
  }
}

/**
 * Check if staff is available at scheduled time
 */
async function checkStaffAvailability(staffId: string, scheduledDateTime?: string): Promise<boolean> {
  try {
    if (!scheduledDateTime) return true; // Assume available if no time specified

    const scheduledDate = new Date(scheduledDateTime);
    const dayOfWeek = scheduledDate.getDay();
    const scheduledTime = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();

    // ✅ SQL: Get staff availability using SchedulingRepository
    const schedulingRepo = getSchedulingRepository();
    const staffRepo = getStaffRepository();
    const staffRecord = await staffRepo.findById(staffId);
    
    if (!staffRecord || !(staffRecord as any).vendor_id) {
      return false;
    }

    // Get occupied slots to check conflicts
    const vendorId = (staffRecord as any).vendor_id;
    const bookingDate = scheduledDate.toISOString().split('T')[0];
    const bookingTime = scheduledDate.toTimeString().split(' ')[0].substring(0, 5);
    
    // Check if slot is available using scheduling repository
    const isAvailable = await schedulingRepo.isTimeSlotAvailable(
      vendorId,
      bookingDate,
      bookingTime,
      'at_home'
    );

    if (!isAvailable) {
      return false;
    }

    // ✅ SQL: Check if staff has existing bookings at this time
    const bookingsRepo = getBookingsRepository();
    const existingBookings = await bookingsRepo.findAll({
      staff_id: staffId,
      booking_date: bookingDate,
      status: 'confirmed' // Only check confirmed bookings
    });

    // Check time overlap
    const hasConflict = existingBookings.some((booking: any) => {
      const bookingTimeStr = booking.booking_time || '';
      const [hours, mins] = bookingTimeStr.split(':').map(Number);
      const bookingTimeMinutes = hours * 60 + mins;
      
      // Allow 30 min buffer for travel/overlap
      return Math.abs(bookingTimeMinutes - scheduledTime) < 30;
    });

    return !hasConflict;

  } catch (error) {
    console.error(`Error checking availability for staff ${staffId}:`, error);
    return false;
  }
}

/**
 * Rank home service candidates
 * Scoring: Proximity (40%) + Rating (40%) + Workload (20%)
 */
function rankHomeServiceCandidates(candidates: any[]) {
  return candidates
    .map(staff => {
      let score = 0;

      // Proximity: 40% weight (closer is better)
      // Max 10km = 0 points, 0km = 40 points
      const proximityScore = Math.max(0, 40 * (1 - staff.distance / 10));
      score += proximityScore;

      // Rating: 40% weight (0-40 points)
      score += (staff.rating / 5) * 40;

      // Workload: 20% weight (less busy is better)
      const activeBookings = staff.activeBookings || 0;
      const maxBookings = staff.maxConcurrentBookings || 3;
      const workloadScore = 20 * (1 - (activeBookings / maxBookings));
      score += workloadScore;

      return { ...staff, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Fallback to manual assignment
 */
async function fallbackToManualAssignment(
  bookingId: string, 
  reason: string,
  maxRadius?: number
) {
  // ✅ SQL: Update booking with manual assignment status
  const bookingsRepo = getBookingsRepository();
  const booking = await bookingsRepo.findById(bookingId);
  
  if (!booking) {
    return { error: 'Booking not found' };
  }

  await bookingsRepo.update(bookingId, {
    status: 'manual_assignment_pending',
    assignment_method: 'manual_pending',
    fallback_reason: reason
  });

  console.log(`⚠️ Fallback to manual assignment for ${bookingId}: ${reason}`);

  return {
    success: false,
    assignmentMethod: 'manual_pending',
    message: 'Your request has been accepted. We will assign a service provider shortly.',
    fallbackReason: reason,
    estimatedAssignmentTime: 'within 1 hour',
    suggestion: maxRadius ? `Try expanding service radius beyond ${maxRadius}km` : null
  };
}

/**
 * Helper functions
 */
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

function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

async function incrementStaffActiveBookings(staffId: string) {
  // ✅ SQL: Update staff active bookings count
  const staffRepo = getStaffRepository();
  const staff = await staffRepo.findById(staffId);
  
  if (staff) {
    // Get current active bookings count
    const bookingsRepo = getBookingsRepository();
    const activeBookings = await bookingsRepo.findAll({
      staff_id: staffId,
      status: 'confirmed' // Count only confirmed bookings as active
    });
    
    const activeCount = activeBookings.length;
    
    // Update staff metadata with active bookings count
    const metadata = (staff as any).metadata || {};
    metadata.activeBookings = activeCount;
    metadata.lastAssignmentAt = new Date().toISOString();
    
    await staffRepo.update(staffId, {
      metadata: metadata
    });
  }
}

async function notifyStaffOfAssignment(staffId: string, bookingId: string, serviceType: string) {
  // ✅ SQL: Create notification
  const notificationsRepo = getNotificationsRepository();
  const staffRepo = getStaffRepository();
  const staff = await staffRepo.findById(staffId);
  
  if (!staff) {
    console.error(`Staff not found: ${staffId}`);
    return;
  }

  // Get user_id for notification (could be staff.id or from staff.user_id)
  const userId = (staff as any).user_id || staff.id;
  
  await notificationsRepo.create({
    user_id: userId,
    notification_type: 'assignment',
    title: 'New Booking Assigned',
    message: `You have been assigned to a new ${serviceType.replace('_', ' ')} booking`,
    data: {
      bookingId,
      serviceType,
      staffId
    }
  });
  
  console.log(`📬 Notification sent to staff ${staffId}`);
}

export default app;
