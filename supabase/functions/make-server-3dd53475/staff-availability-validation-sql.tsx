/**
 * Staff Availability Validation Module - SQL-ONLY VERSION
 * 
 * TASK 2: Lead time and distance validation for home services
 * TASK 3: Concurrency and conflict detection
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Date: 2025-01-28
 * Migration: Batch 12 - KV to SQL (2 KV operations removed)
 * ============================================================================
 */

import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';

const db = getDbClient();

interface AvailabilitySlot {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  mode: 'location' | 'centre';
  location?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    radius: number;
  };
  centreId?: string;
  centreName?: string;
  allowedServiceIds: string[];
  hasHomeServices?: boolean;
  hasTeleServices?: boolean;
  leadTime?: number;
  maxDistance?: number;
  bufferTime: number;
  maxConcurrentBookings: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  conflicts?: ConflictInfo[];
}

interface ConflictInfo {
  type: 'overlap' | 'concurrency' | 'centre_limit';
  message: string;
  conflictingSlotIds: string[];
  details?: any;
}

/**
 * TASK 2: Validate conditional fields based on service types
 */
export function validateConditionalFields(slot: AvailabilitySlot): ValidationResult {
  const errors: string[] = [];

  // Basic validation
  if (!slot.allowedServiceIds || slot.allowedServiceIds.length === 0) {
    errors.push('At least one service must be selected');
  }

  // Mode-specific validation
  if (slot.mode === 'location') {
    if (!slot.location) {
      errors.push('Location is required for location-based scheduling');
    } else {
      if (!slot.location.latitude || !slot.location.longitude) {
        errors.push('Location coordinates are required');
      }
      if (!slot.location.radius || slot.location.radius <= 0) {
        errors.push('Coverage radius must be greater than 0');
      }
    }
  } else if (slot.mode === 'centre') {
    if (!slot.centreId) {
      errors.push('Centre selection is required for centre-based scheduling');
    }
  }

  // Home service validation
  if (slot.hasHomeServices) {
    if (!slot.leadTime) {
      errors.push('Lead time is required for home services');
    } else if (slot.leadTime < 30) {
      errors.push('Lead time must be at least 30 minutes for home services');
    }

    if (!slot.maxDistance) {
      errors.push('Maximum distance is required for home services');
    } else if (slot.maxDistance <= 0) {
      errors.push('Maximum distance must be greater than 0');
    }
  }

  // Tele-only services should not have distance/leadTime
  if (slot.hasTeleServices && !slot.hasHomeServices) {
    if (slot.maxDistance) {
      errors.push('Maximum distance should not be set for tele-only services');
    }
    if (slot.leadTime && slot.leadTime > 15) {
      // Tele services can have minimal lead time
      errors.push('Lead time for tele services should be minimal (0-15 minutes)');
    }
  }

  // Buffer time validation (always present)
  if (slot.bufferTime < 0) {
    errors.push('Buffer time cannot be negative');
  }

  // Concurrency validation
  if (!slot.maxConcurrentBookings || slot.maxConcurrentBookings < 1) {
    errors.push('Maximum concurrent bookings must be at least 1');
  }

  // Time validation
  const startMinutes = parseTimeToMinutes(slot.startTime);
  const endMinutes = parseTimeToMinutes(slot.endTime);

  if (startMinutes >= endMinutes) {
    errors.push('End time must be after start time');
  }

  if (endMinutes - startMinutes < 30) {
    errors.push('Availability slot must be at least 30 minutes long');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * TASK 3: Detect scheduling conflicts (overlap & concurrency)
 */
export async function detectConflicts(
  newSlot: AvailabilitySlot,
  staffId: string
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = [];

  try {
    // ✅ SQL: Get all existing slots for this staff member
    const { data: existingSlotsData, error } = await db
      .from('staff_availability_slots')
      .select('*')
      .eq('staff_id', staffId)
      .eq('is_available', true);

    if (error) {
      console.error('Error fetching staff availability slots:', error);
      return conflicts;
    }

    const existingSlots: AvailabilitySlot[] = (existingSlotsData || [])
      .filter((slot: any) => slot.id !== newSlot.id) // Exclude self when editing
      .map((slot: any) => ({
        id: slot.id,
        staffId: slot.staff_id,
        dayOfWeek: slot.day_of_week,
        startTime: slot.start_time,
        endTime: slot.end_time,
        mode: slot.mode || 'centre',
        location: slot.location ? JSON.parse(slot.location) : undefined,
        centreId: slot.centre_id,
        centreName: slot.centre_name,
        allowedServiceIds: slot.allowed_service_ids || [],
        hasHomeServices: slot.has_home_services || false,
        hasTeleServices: slot.has_tele_services || false,
        leadTime: slot.lead_time,
        maxDistance: slot.max_distance,
        bufferTime: slot.buffer_time || 0,
        maxConcurrentBookings: slot.max_concurrent_bookings || 1,
        isActive: slot.is_available !== false,
        createdAt: slot.created_at,
        updatedAt: slot.updated_at
      }));

    // 1. Check for time overlaps on the same day
    const overlaps = detectTimeOverlaps(newSlot, existingSlots);
    conflicts.push(...overlaps);

    // 2. Check centre concurrency limits (if in centre mode)
    if (newSlot.mode === 'centre' && newSlot.centreId) {
      const concurrencyConflicts = await detectCentreConcurrencyConflicts(newSlot, existingSlots);
      conflicts.push(...concurrencyConflicts);
    }

    // 3. Check location overlap conflicts (if in location mode)
    if (newSlot.mode === 'location' && newSlot.location) {
      const locationConflicts = detectLocationConflicts(newSlot, existingSlots);
      conflicts.push(...locationConflicts);
    }

  } catch (error) {
    console.error('Error detecting conflicts:', error);
  }

  return conflicts;
}

/**
 * Detect time overlaps on the same day
 */
function detectTimeOverlaps(
  newSlot: AvailabilitySlot,
  existingSlots: AvailabilitySlot[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  const sameDaySlots = existingSlots.filter(s => s.dayOfWeek === newSlot.dayOfWeek);

  for (const slot of sameDaySlots) {
    if (hasTimeOverlap(newSlot, slot)) {
      conflicts.push({
        type: 'overlap',
        message: `Time slot overlaps with existing availability on ${getDayName(slot.dayOfWeek)} (${slot.startTime} - ${slot.endTime})`,
        conflictingSlotIds: [slot.id],
        details: {
          existingSlot: {
            day: getDayName(slot.dayOfWeek),
            startTime: slot.startTime,
            endTime: slot.endTime,
            location: slot.mode === 'centre' ? slot.centreName : slot.location?.name
          }
        }
      });
    }
  }

  return conflicts;
}

/**
 * Check if two time slots overlap
 */
function hasTimeOverlap(slot1: AvailabilitySlot, slot2: AvailabilitySlot): boolean {
  const start1 = parseTimeToMinutes(slot1.startTime);
  const end1 = parseTimeToMinutes(slot1.endTime);
  const start2 = parseTimeToMinutes(slot2.startTime);
  const end2 = parseTimeToMinutes(slot2.endTime);

  // Check for overlap: slot1 starts before slot2 ends AND slot1 ends after slot2 starts
  return (start1 < end2) && (end1 > start2);
}

/**
 * Detect centre concurrency limit violations
 */
async function detectCentreConcurrencyConflicts(
  newSlot: AvailabilitySlot,
  existingSlots: AvailabilitySlot[]
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = [];

  try {
    // ✅ SQL: Get centre details to check limits
    const vendorsRepo = getVendorsRepository();
    const centre = await vendorsRepo.findById(newSlot.centreId!);
    
    if (!centre) {
      // If centre not found, skip concurrency check (will be validated elsewhere)
      return conflicts;
    }

    const centreMaxConcurrency = (centre as any).maxConcurrentBookings || 10; // Default limit

    // Find all slots at the same centre on the same day that overlap with this slot
    const sameCentreSlots = existingSlots.filter(s => 
      s.mode === 'centre' && 
      s.centreId === newSlot.centreId && 
      s.dayOfWeek === newSlot.dayOfWeek &&
      hasTimeOverlap(newSlot, s)
    );

    // Calculate total concurrent bookings during the overlap period
    const totalConcurrency = sameCentreSlots.reduce((sum, s) => 
      sum + s.maxConcurrentBookings, 
      newSlot.maxConcurrentBookings
    );

    if (totalConcurrency > centreMaxConcurrency) {
      conflicts.push({
        type: 'centre_limit',
        message: `Centre concurrency limit exceeded. Total concurrent bookings (${totalConcurrency}) exceeds centre limit (${centreMaxConcurrency})`,
        conflictingSlotIds: sameCentreSlots.map(s => s.id),
        details: {
          centreName: newSlot.centreName,
          centreLimit: centreMaxConcurrency,
          totalConcurrency,
          existingSlots: sameCentreSlots.length,
          newSlotConcurrency: newSlot.maxConcurrentBookings
        }
      });
    }

  } catch (error) {
    console.error('Error checking centre concurrency:', error);
  }

  return conflicts;
}

/**
 * Detect location-based conflicts (same location, overlapping times)
 */
function detectLocationConflicts(
  newSlot: AvailabilitySlot,
  existingSlots: AvailabilitySlot[]
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  if (!newSlot.location) return conflicts;

  // Find slots with same or very close location
  const nearbySlots = existingSlots.filter(s => {
    if (s.mode !== 'location' || !s.location) return false;
    
    // Calculate distance between locations
    const distance = calculateDistance(
      newSlot.location!.latitude,
      newSlot.location!.longitude,
      s.location.latitude,
      s.location.longitude
    );

    // Consider conflict if locations are within 1km of each other
    return distance < 1;
  });

  for (const slot of nearbySlots) {
    if (slot.dayOfWeek === newSlot.dayOfWeek && hasTimeOverlap(newSlot, slot)) {
      conflicts.push({
        type: 'overlap',
        message: `Location conflict: Another availability slot exists at a nearby location (${slot.location?.name}) with overlapping time`,
        conflictingSlotIds: [slot.id],
        details: {
          existingLocation: slot.location?.name,
          existingAddress: slot.location?.address
        }
      });
    }
  }

  return conflicts;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
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
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get day name from day number
 */
function getDayName(dayNumber: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || 'Unknown';
}

/**
 * Main validation function combining all checks
 */
export async function validateAvailabilitySlot(
  slot: AvailabilitySlot,
  staffId: string
): Promise<ValidationResult> {
  // Step 1: Validate conditional fields
  const fieldValidation = validateConditionalFields(slot);
  if (!fieldValidation.valid) {
    return fieldValidation;
  }

  // Step 2: Detect conflicts
  const conflicts = await detectConflicts(slot, staffId);
  
  if (conflicts.length > 0) {
    return {
      valid: false,
      errors: ['Scheduling conflicts detected'],
      conflicts
    };
  }

  return {
    valid: true,
    errors: []
  };
}

/**
 * API Payload Example Generator (for documentation)
 */
export function generateAPIPayloadExample(): any {
  return {
    // Centre-based availability with home services
    centreModeWithHomeServices: {
      id: 'slot_123',
      staffId: 'staff_456',
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '17:00',
      mode: 'centre',
      centreId: 'centre_789',
      centreName: 'Downtown Clinic',
      allowedServiceIds: ['service_vet_consultation', 'service_home_visit'],
      hasHomeServices: true,
      hasTeleServices: false,
      leadTime: 60, // 1 hour advance booking required
      maxDistance: 10, // 10km maximum travel distance
      bufferTime: 15, // 15 min between appointments
      maxConcurrentBookings: 2,
      isActive: true
    },

    // Location-based availability for mobile services
    locationModeForWalker: {
      id: 'slot_124',
      staffId: 'staff_457',
      dayOfWeek: 2, // Tuesday
      startTime: '08:00',
      endTime: '12:00',
      mode: 'location',
      location: {
        name: 'Central Park Area',
        address: '123 Park St, Downtown',
        latitude: 40.785091,
        longitude: -73.968285,
        radius: 5 // 5km service radius
      },
      allowedServiceIds: ['service_dog_walking', 'service_pet_training'],
      hasHomeServices: true,
      hasTeleServices: false,
      leadTime: 120, // 2 hours advance booking
      maxDistance: 5, // Must match location radius
      bufferTime: 30, // 30 min travel time between appointments
      maxConcurrentBookings: 1,
      isActive: true
    },

    // Tele-only availability (no distance/lead time)
    teleModeOnly: {
      id: 'slot_125',
      staffId: 'staff_458',
      dayOfWeek: 3, // Wednesday
      startTime: '14:00',
      endTime: '18:00',
      mode: 'centre',
      centreId: 'centre_790',
      centreName: 'Main Hospital',
      allowedServiceIds: ['service_tele_consultation', 'service_tele_followup'],
      hasHomeServices: false,
      hasTeleServices: true,
      // No leadTime or maxDistance for tele-only
      bufferTime: 10, // Short buffer for tele
      maxConcurrentBookings: 3, // Can handle multiple tele calls
      isActive: true
    }
  };
}

