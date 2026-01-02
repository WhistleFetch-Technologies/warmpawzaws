/**
 * Auto-Assignment Logic for Bookings
 * 
 * TASK 3: Implements smart assignment for instant tele and home services
 * - Instant Tele: Assign from candidate pool after payment
 * - Home Service: Auto-assign staff in radius & available
 * - Fallback: "Request accepted - vendor to assign"
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import {
  getStaffRepository,
  getStaffAvailabilityRepository,
  getVendorServicesRepository,
  getBookingsRepository,
  getNotificationsRepository
} from '../../../supabase/lib/repositories/index';

interface AssignmentResult {
  success: boolean;
  assignedStaffId?: string;
  assignedStaffName?: string;
  assignedStaffPhoto?: string;
  assignmentMethod: 'auto' | 'manual_pending';
  message: string;
  fallbackReason?: string;
  estimatedAssignmentTime?: string;
}

interface StaffAvailability {
  staffId: string;
  staffName: string;
  staffPhoto?: string;
  rating: number;
  isOnline: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  activeBookings: number;
  maxConcurrentBookings: number;
  specializations: string[];
}

/**
 * TASK 3: Auto-assign for Instant Tele bookings
 * Called after payment is successful
 */
export async function assignInstantTele(
  bookingId: string,
  candidateStaffIds: string[]
): Promise<AssignmentResult> {
  console.log(`🔍 Starting instant tele assignment for booking ${bookingId}`);

  try {
    // Step 1: Load candidate staff details
    const candidates = await loadStaffDetails(candidateStaffIds);
    
    if (candidates.length === 0) {
      return fallbackToManualAssignment('No candidate staff available');
    }

    // Step 2: Filter by online status and availability
    const available = candidates.filter(staff => 
      staff.isOnline && 
      staff.activeBookings < staff.maxConcurrentBookings
    );

    if (available.length === 0) {
      return fallbackToManualAssignment('All candidate staff are currently busy');
    }

    // Step 3: Score and rank candidates
    const ranked = rankCandidates(available, 'tele');

    // Step 4: Assign to best candidate
    const selected = ranked[0];

    // Step 5: Update booking with assignment
    await assignStaffToBooking(bookingId, selected.staffId);

    // Step 6: Notify staff
    await notifyStaffOfAssignment(selected.staffId, bookingId);

    console.log(`✅ Auto-assigned instant tele: ${selected.staffName} to booking ${bookingId}`);

    return {
      success: true,
      assignedStaffId: selected.staffId,
      assignedStaffName: selected.staffName,
      assignedStaffPhoto: selected.staffPhoto,
      assignmentMethod: 'auto',
      message: `Dr. ${selected.staffName} has been assigned to your consultation`,
      estimatedAssignmentTime: '< 2 minutes'
    };

  } catch (error) {
    console.error('Error in instant tele assignment:', error);
    return fallbackToManualAssignment('System error during assignment');
  }
}

/**
 * TASK 3: Auto-assign for Home Service bookings
 * Called immediately upon booking creation
 */
export async function assignHomeService(
  bookingId: string,
  serviceId: string,
  customerLocation: { latitude: number; longitude: number },
  scheduledDateTime: string
): Promise<AssignmentResult> {
  console.log(`🔍 Starting home service assignment for booking ${bookingId}`);

  try {
    // Step 1: Get all staff who can provide this service
    const eligibleStaff = await getStaffForService(serviceId);

    if (eligibleStaff.length === 0) {
      return fallbackToManualAssignment('No staff available for this service');
    }

    // Step 2: Filter by location radius
    const inRadius = eligibleStaff.filter(staff => {
      if (!staff.currentLocation) return false;
      
      const distance = calculateDistance(
        customerLocation.latitude,
        customerLocation.longitude,
        staff.currentLocation.latitude,
        staff.currentLocation.longitude
      );

      // Check if within staff's service radius (default 10km)
      return distance <= (staff.maxServiceRadius || 10);
    });

    if (inRadius.length === 0) {
      return fallbackToManualAssignment(
        'No staff available in your area',
        'We will manually assign a staff member and confirm within 1 hour'
      );
    }

    // Step 3: Check availability at scheduled time
    const availableAtTime = await filterByScheduledAvailability(
      inRadius,
      scheduledDateTime
    );

    if (availableAtTime.length === 0) {
      return fallbackToManualAssignment(
        'No staff available at requested time',
        'We will find the best available staff and confirm timing within 1 hour'
      );
    }

    // Step 4: Rank by proximity, rating, and workload
    const ranked = rankCandidates(availableAtTime, 'home', customerLocation);

    // Step 5: Assign to best candidate
    const selected = ranked[0];

    await assignStaffToBooking(bookingId, selected.staffId);
    await notifyStaffOfAssignment(selected.staffId, bookingId);

    console.log(`✅ Auto-assigned home service: ${selected.staffName} to booking ${bookingId}`);

    return {
      success: true,
      assignedStaffId: selected.staffId,
      assignedStaffName: selected.staffName,
      assignedStaffPhoto: selected.staffPhoto,
      assignmentMethod: 'auto',
      message: `${selected.staffName} has been assigned to your service`,
      estimatedAssignmentTime: 'immediate'
    };

  } catch (error) {
    console.error('Error in home service assignment:', error);
    return fallbackToManualAssignment('System error during assignment');
  }
}

/**
 * Fallback to manual assignment
 */
function fallbackToManualAssignment(
  reason: string,
  customerMessage?: string
): AssignmentResult {
  console.log(`⚠️ Falling back to manual assignment: ${reason}`);

  return {
    success: false,
    assignmentMethod: 'manual_pending',
    message: customerMessage || 'Your request has been accepted. We will assign a service provider shortly.',
    fallbackReason: reason,
    estimatedAssignmentTime: 'within 1 hour'
  };
}

/**
 * Load staff details from KV store
 */
async function loadStaffDetails(staffIds: string[]): Promise<StaffAvailability[]> {
  const staff: StaffAvailability[] = [];
  const staffRepo = getStaffRepository();
  const availabilityRepo = getStaffAvailabilityRepository();

  for (const staffId of staffIds) {
    try {
      // ✅ SQL: Get staff profile
      const staffData = await staffRepo.findById(staffId);
      if (staffData) {
        // ✅ SQL: Check current availability
        const availability = await availabilityRepo.getCurrentAvailability(staffId);
        
        // ✅ SQL: Count active bookings
        const bookingsRepo = getBookingsRepository();
        const activeBookings = await bookingsRepo.findByStaffAndStatus(staffId, ['confirmed', 'assigned', 'in_progress']);
        
        staff.push({
          staffId,
          staffName: staffData.full_name || staffData.name,
          staffPhoto: staffData.photo_url || staffData.photo,
          rating: staffData.rating || 4.5,
          isOnline: availability?.is_online || false,
          currentLocation: availability?.current_location ? {
            latitude: availability.current_location.latitude,
            longitude: availability.current_location.longitude
          } : undefined,
          activeBookings: activeBookings.length,
          maxConcurrentBookings: staffData.max_concurrent_bookings || 1,
          specializations: staffData.specializations || []
        });
      }
    } catch (error) {
      console.error(`Error loading staff ${staffId}:`, error);
    }
  }

  return staff;
}

/**
 * Get staff who can provide a specific service
 */
async function getStaffForService(serviceId: string): Promise<StaffAvailability[]> {
  try {
    // ✅ SQL: Get service data
    const servicesRepo = getVendorServicesRepository();
    const service = await servicesRepo.findById(serviceId);
    
    if (!service) {
      return [];
    }

    const staffIds = service.assigned_staff_ids || service.assignedStaffIds || [];

    return await loadStaffDetails(staffIds);
  } catch (error) {
    console.error('Error getting staff for service:', error);
    return [];
  }
}

/**
 * Filter staff by scheduled availability
 */
async function filterByScheduledAvailability(
  staff: StaffAvailability[],
  scheduledDateTime: string
): Promise<StaffAvailability[]> {
  const available: StaffAvailability[] = [];
  const requestedDate = new Date(scheduledDateTime);
  const dayOfWeek = requestedDate.getDay();
  const time = `${String(requestedDate.getHours()).padStart(2, '0')}:${String(requestedDate.getMinutes()).padStart(2, '0')}`;

  // ✅ SQL: Get availability for all staff
  const availabilityRepo = getStaffAvailabilityRepository();
  
  for (const member of staff) {
    try {
      // ✅ SQL: Get staff availability slots
      const slots = await availabilityRepo.findByStaff(member.staffId);
      
      // Check if any slot matches the requested day and time
      const hasAvailability = slots.some((slot: any) => {
        if (!slot.is_active) return false;
        if (slot.day_of_week !== dayOfWeek) return false;
        
        // Check if time falls within slot
        const slotStart = slot.start_time || slot.startTime;
        const slotEnd = slot.end_time || slot.endTime;
        return time >= slotStart && time <= slotEnd;
      });

      if (hasAvailability) {
        available.push(member);
      }
    } catch (error) {
      console.error(`Error checking availability for ${member.staffId}:`, error);
    }
  }

  return available;
}

/**
 * TASK 3: Rank candidates based on multiple factors
 */
function rankCandidates(
  candidates: StaffAvailability[],
  serviceType: 'tele' | 'home',
  customerLocation?: { latitude: number; longitude: number }
): StaffAvailability[] {
  return candidates
    .map(staff => {
      let score = 0;

      // Factor 1: Rating (0-50 points)
      score += staff.rating * 10;

      // Factor 2: Current workload (0-30 points)
      const workloadScore = 30 * (1 - (staff.activeBookings / staff.maxConcurrentBookings));
      score += workloadScore;

      // Factor 3: For home services, proximity (0-20 points)
      if (serviceType === 'home' && customerLocation && staff.currentLocation) {
        const distance = calculateDistance(
          customerLocation.latitude,
          customerLocation.longitude,
          staff.currentLocation.latitude,
          staff.currentLocation.longitude
        );
        
        // Closer = higher score (20 points for < 1km, decreasing to 0 for > 10km)
        const proximityScore = Math.max(0, 20 * (1 - distance / 10));
        score += proximityScore;
      }

      return { ...staff, score };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Calculate distance between two coordinates (Haversine)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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
 * Assign staff to booking
 */
async function assignStaffToBooking(bookingId: string, staffId: string): Promise<void> {
  try {
    // ✅ SQL: Get and update booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      throw new Error('Booking not found');
    }

    // ✅ SQL: Update booking with staff assignment
    await bookingsRepo.update(bookingId, {
      assigned_staff_id: staffId,
      assignment_method: 'auto',
      assigned_at: new Date().toISOString(),
      status: 'assigned'
    });

    // ✅ SQL: Update staff availability (active bookings count is calculated from bookings table)
    // No need to manually track - query bookings table for active count
  } catch (error) {
    console.error('Error assigning staff to booking:', error);
    throw error;
  }
}

/**
 * Notify staff of new assignment
 */
async function notifyStaffOfAssignment(staffId: string, bookingId: string): Promise<void> {
  try {
    // ✅ SQL: Create notification record
    const notificationsRepo = getNotificationsRepository();
    const notification = await notificationsRepo.create({
      entity_type: 'staff',
      entity_id: staffId,
      type: 'new_assignment',
      title: 'New Booking Assigned',
      message: 'You have been assigned to a new booking',
      metadata: { bookingId },
      read: false,
      created_at: new Date().toISOString()
    });

    // In production, also send push notification, SMS, etc.
    console.log(`📬 Notification sent to staff ${staffId} for booking ${bookingId}`);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

/**
 * Decision tree for assignment logic
 */
export function getAssignmentDecisionTree() {
  return {
    instant_tele: {
      step1: {
        condition: 'Payment successful',
        action: 'Trigger auto-assignment'
      },
      step2: {
        condition: 'Load candidate staff from booking.candidateStaffIds',
        successPath: 'step3',
        failurePath: 'fallback_no_candidates'
      },
      step3: {
        condition: 'Filter by isOnline = true AND activeBookings < maxConcurrent',
        successPath: 'step4',
        failurePath: 'fallback_all_busy'
      },
      step4: {
        condition: 'Rank by: rating (50%) + workload (30%) + response_time (20%)',
        action: 'Select highest ranked staff'
      },
      step5: {
        condition: 'Assign staff to booking',
        action: 'Update booking.assignedStaffId, status = "assigned"'
      },
      step6: {
        action: 'Notify staff via push/SMS/app',
        result: 'Assignment complete - show assigned doctor to customer'
      },
      fallback_no_candidates: {
        action: 'Manual assignment pending',
        message: 'Request accepted - vendor to assign within 1 hour'
      },
      fallback_all_busy: {
        action: 'Manual assignment pending',
        message: 'All doctors busy - we will assign shortly'
      }
    },
    home_service: {
      step1: {
        condition: 'Booking created',
        action: 'Trigger auto-assignment immediately'
      },
      step2: {
        condition: 'Load staff eligible for service.serviceId',
        successPath: 'step3',
        failurePath: 'fallback_no_staff'
      },
      step3: {
        condition: 'Filter by: distance(staff.location, customer.location) <= maxServiceRadius',
        successPath: 'step4',
        failurePath: 'fallback_out_of_radius'
      },
      step4: {
        condition: 'Check availability at booking.scheduledDateTime',
        successPath: 'step5',
        failurePath: 'fallback_no_availability'
      },
      step5: {
        condition: 'Rank by: proximity (40%) + rating (40%) + workload (20%)',
        action: 'Select highest ranked staff'
      },
      step6: {
        condition: 'Assign staff to booking',
        action: 'Update booking.assignedStaffId, status = "assigned"'
      },
      step7: {
        action: 'Notify staff and customer',
        result: 'Assignment complete - show staff details to customer'
      },
      fallback_no_staff: {
        action: 'Manual assignment pending',
        message: 'Request accepted - we will assign a service provider'
      },
      fallback_out_of_radius: {
        action: 'Manual assignment pending',
        message: 'No staff in your area - vendor will confirm within 1 hour'
      },
      fallback_no_availability: {
        action: 'Manual assignment pending',
        message: 'Request accepted - we will confirm timing shortly'
      }
    }
  };
}
