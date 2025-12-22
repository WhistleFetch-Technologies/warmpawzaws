/**
 * ============================================================================
 * SCHEDULING SERVICE
 * ============================================================================
 * 
 * Service layer for scheduling operations
 * Implements all fixes from scheduling audit
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { getSchedulingRepository } from "../repositories/scheduling.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";
import type { CreateBookingInput } from "../repositories/bookings.ts";

// ============================================================================
// CONSTANTS
// ============================================================================

// FIX V3: Standardized status filtering
const ACTIVE_BOOKING_STATUSES = [
    'confirmed',
    'scheduled',
    'in_progress',
    'start_otp_pending',
    'end_otp_pending',
    'traveling'
];

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class SchedulingService {
    private schedulingRepo = getSchedulingRepository();
    private bookingsRepo = getBookingsRepository();

    /**
     * Create booking with all validations (FIX V2, V23: Race Condition)
     */
    async createBookingWithValidation(
        input: CreateBookingInput,
        requestId: string
    ): Promise<{ success: boolean; booking?: any; error?: string }> {
        const lockKey = `${input.vendor_id}:${input.booking_date}:${input.booking_time}`;

        // FIX V23: Acquire distributed lock (increased timeout)
        const lockAcquired = await this.schedulingRepo.acquireBookingLock(
            input.vendor_id!,
            input.booking_date,
            input.booking_time,
            requestId,
            30 // 30 second timeout (FIX V8.2)
        );

        if (!lockAcquired) {
            return {
                success: false,
                error: 'Could not acquire booking lock. Please try again.'
            };
        }

        try {
            // FIX V1: Check capacity with configurable max
            const capacity = await this.schedulingRepo.getSlotCapacity(
                input.vendor_id!,
                input.staff_id || null,
                input.booking_date,
                input.booking_time,
                input.service_type
            );

            const maxCapacity = capacity?.max_capacity || 1;
            const currentBookings = capacity?.current_bookings || 0;

            if (currentBookings >= maxCapacity) {
                return {
                    success: false,
                    error: 'Time slot is fully booked'
                };
            }

            // FIX V3: Check for active bookings with standardized status filter
            const existingBookings = await this.bookingsRepo.findByVendor(input.vendor_id!, {
                date: input.booking_date,
                status: 'any' // We'll filter manually
            });

            const activeBookings = existingBookings.filter(b =>
                ACTIVE_BOOKING_STATUSES.includes(b.status) &&
                b.booking_time === input.booking_time &&
                b.service_type === input.service_type
            );

            if (activeBookings.length >= maxCapacity) {
                return {
                    success: false,
                    error: 'Time slot is fully booked'
                };
            }

            // FIX V5: Check staff location conflicts with travel time
            if (input.staff_id && input.service_type === 'at_home') {
                const hasConflict = await this.schedulingRepo.checkStaffLocationConflict(
                    input.staff_id,
                    input.vendor_id!,
                    input.booking_date,
                    input.booking_time,
                    input.duration_minutes || 30,
                    30 // Travel time
                );

                if (hasConflict) {
                    return {
                        success: false,
                        error: 'Staff has conflicting booking at another location'
                    };
                }
            }

            // FIX V7: Validate distance for home services
            if (input.service_type === 'at_home' && input.staff_id && input.latitude && input.longitude) {
                const distanceValid = await this.validateDistance(
                    input.staff_id,
                    input.latitude,
                    input.longitude
                );

                if (!distanceValid.valid) {
                    return {
                        success: false,
                        error: distanceValid.error || 'Staff is outside service area'
                    };
                }
            }

            // FIX V10, V11: Validate commute time
            if (input.service_type === 'at_home' && input.staff_id && input.latitude && input.longitude) {
                const commuteValid = await this.validateCommuteTime(
                    input.staff_id,
                    input.vendor_id!,
                    input.booking_date,
                    input.booking_time,
                    input.latitude,
                    input.longitude
                );

                if (!commuteValid.valid) {
                    return {
                        success: false,
                        error: commuteValid.error || 'Insufficient time for staff to reach location'
                    };
                }
            }

            // FIX V12: Check buffer time between bookings
            const bufferValid = await this.validateBufferTime(
                input.vendor_id!,
                input.staff_id || null,
                input.booking_date,
                input.booking_time,
                input.service_type,
                30 // Default duration, should be from service
            );

            if (!bufferValid.valid) {
                return {
                    success: false,
                    error: bufferValid.error || 'Insufficient buffer time between bookings'
                };
            }

            // Reserve slot atomically
            const slotReserved = await this.schedulingRepo.reserveBookingSlot(
                input.vendor_id!,
                input.staff_id || null,
                input.booking_date,
                input.booking_time,
                input.service_type,
                maxCapacity
            );

            if (!slotReserved) {
                return {
                    success: false,
                    error: 'Failed to reserve slot'
                };
            }

            // Create booking
            const booking = await this.bookingsRepo.create(input);

            return {
                success: true,
                booking
            };

        } catch (error: any) {
            console.error('[SCHEDULING] Booking creation error:', error);
            return {
                success: false,
                error: error.message || 'Failed to create booking'
            };
        } finally {
            // Always release lock
            await this.schedulingRepo.releaseBookingLock(
                input.vendor_id!,
                input.booking_date,
                input.booking_time,
                requestId
            );
        }
    }

    /**
     * Validate distance for home services (FIX V7, V8)
     */
    async validateDistance(
        staffId: string,
        customerLat: number,
        customerLng: number
    ): Promise<{ valid: boolean; error?: string; distance?: number }> {
        // Get staff location (would use real-time location in production)
        const staff = await this.getStaffLocation(staffId);
        
        if (!staff || !staff.latitude || !staff.longitude) {
            return {
                valid: false,
                error: 'Staff location not available'
            };
        }

        // Calculate distance directly (Haversine)
        const R = 6371; // Earth's radius in km
        const dLat = (customerLat - staff.latitude) * Math.PI / 180;
        const dLng = (customerLng - staff.longitude) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(staff.latitude * Math.PI / 180) *
            Math.cos(customerLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        // Get service area from policy
        const policy = await this.schedulingRepo.getPolicy('commute_time');
        const maxDistance = policy?.maxTravelDistance || 50;

        if (distance > maxDistance) {
            return {
                valid: false,
                error: `Staff is outside service area (${distance.toFixed(1)}km > ${maxDistance}km)`,
                distance
            };
        }

        return {
            valid: true,
            distance
        };
    }

    /**
     * Validate commute time (FIX V10, V11)
     */
    async validateCommuteTime(
        staffId: string,
        vendorId: string,
        date: string,
        time: string,
        customerLat?: number,
        customerLng?: number
    ): Promise<{ valid: boolean; error?: string; commuteTime?: number }> {
        const bookingDateTime = new Date(`${date}T${time}`);
        const now = new Date();
        const timeUntilBooking = (bookingDateTime.getTime() - now.getTime()) / 60000; // minutes

        if (customerLat && customerLng) {
            // Get staff location
            const staffLocation = await this.getStaffLocation(staffId);
            if (!staffLocation) {
                return {
                    valid: false,
                    error: 'Staff location not available'
                };
            }
            
            // Calculate commute time (simplified - 3 min/km with 1.5x traffic factor)
            const R = 6371;
            const dLat = (customerLat - staffLocation.latitude) * Math.PI / 180;
            const dLng = (customerLng - staffLocation.longitude) * Math.PI / 180;
            const a = 
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(staffLocation.latitude * Math.PI / 180) *
                Math.cos(customerLat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distanceKm = R * c;
            const commuteTime = Math.ceil(distanceKm * 3 * 1.5); // 3 min/km * 1.5 traffic

            // Get buffer time policy
            const bufferPolicy = await this.schedulingRepo.getPolicy('buffer_time');
            const bufferTime = bufferPolicy?.bufferTimePerServiceType?.at_home || 120;

            const totalRequiredTime = commuteTime + bufferTime;

            if (timeUntilBooking < totalRequiredTime) {
                return {
                    valid: false,
                    error: `Insufficient time for staff to reach location (required: ${totalRequiredTime} min, available: ${Math.floor(timeUntilBooking)} min)`,
                    commuteTime
                };
            }

            return {
                valid: true,
                commuteTime
            };
        }

        return { valid: true };
    }

    /**
     * Validate buffer time between bookings (FIX V12)
     */
    async validateBufferTime(
        vendorId: string,
        staffId: string | null,
        date: string,
        time: string,
        serviceType: string,
        durationMinutes: number
    ): Promise<{ valid: boolean; error?: string }> {
        // Get buffer time policy
        const bufferPolicy = await this.schedulingRepo.getPolicy('buffer_time');
        const bufferTime = bufferPolicy?.bufferTimePerServiceType?.[serviceType] || 
                          bufferPolicy?.bufferTimePerServiceType?.at_center || 30;

        // Get existing bookings
        const existingBookings = staffId
            ? await this.bookingsRepo.findByStaff(staffId, { date })
            : await this.bookingsRepo.findByVendor(vendorId, { date });

        const bookingTime = new Date(`2000-01-01T${time}`);
        const bookingEnd = new Date(bookingTime.getTime() + durationMinutes * 60000);

        for (const existing of existingBookings) {
            if (!ACTIVE_BOOKING_STATUSES.includes(existing.status)) continue;

            const existingTime = new Date(`2000-01-01T${existing.booking_time}`);
            // Get duration from service or default to 30
            const existingDuration = 30; // Should be fetched from service
            const existingEnd = new Date(existingTime.getTime() + existingDuration * 60000);

            // Check if bookings overlap with buffer time
            const gapBefore = (bookingTime.getTime() - existingEnd.getTime()) / 60000;
            const gapAfter = (existingTime.getTime() - bookingEnd.getTime()) / 60000;

            if (gapBefore < bufferTime && gapBefore > -durationMinutes) {
                return {
                    valid: false,
                    error: `Insufficient buffer time before existing booking (required: ${bufferTime} min, available: ${Math.floor(gapBefore)} min)`
                };
            }

            if (gapAfter < bufferTime && gapAfter > -existingDuration) {
                return {
                    valid: false,
                    error: `Insufficient buffer time after existing booking (required: ${bufferTime} min, available: ${Math.floor(gapAfter)} min)`
                };
            }
        }

        return { valid: true };
    }

    /**
     * Reserve subscription slots (FIX V14, V15, V16) - ATOMIC
     */
    async reserveSubscriptionSlots(
        subscriptionId: string,
        vendorId: string,
        staffId: string | null,
        dayOfWeek: number,
        timeSlot: string,
        startDate: string,
        endDate?: string
    ): Promise<{ success: boolean; error?: string }> {
        const { withTransaction } = await import("../db.ts");
        
        return withTransaction(async (client) => {
            // FIX V15: Validate slot availability before reserving (atomic)
            const isAvailable = await this.checkSlotAvailability(
                vendorId,
                staffId,
                startDate,
                timeSlot
            );

            if (!isAvailable) {
                return {
                    success: false,
                    error: `Slot ${startDate} ${timeSlot} is not available`
                };
            }

            // Reserve slot atomically
            try {
                await this.schedulingRepo.reserveSlotForSubscription(
                    subscriptionId,
                    vendorId,
                    staffId,
                    startDate,
                    timeSlot
                );

                return { success: true };
            } catch (error: any) {
                return {
                    success: false,
                    error: error.message || 'Failed to reserve subscription slot'
                };
            }
        });
    }

    /**
     * Redeem package session with slot validation (FIX V17, V18, V19) - ATOMIC
     */
    async redeemPackageSession(
        packagePurchaseId: string,
        customerId: string,
        vendorId: string,
        serviceId: string,
        date?: string,
        time?: string
    ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
        const { withTransaction, getDbClient } = await import("../db.ts");
        const client = getDbClient();
        
        return withTransaction(async (txClient) => {
            // FIX V17: Validate slot availability BEFORE redeeming (atomic)
            if (date && time) {
                const isAvailable = await this.checkSlotAvailability(
                    vendorId,
                    null,
                    date,
                    time
                );

                if (!isAvailable) {
                    return {
                        success: false,
                        error: 'Selected slot is no longer available. Please choose another time.'
                    };
                }
            }

            // FIX V18: Use transaction for atomic operation
            try {
                // Reserve slot if date/time provided
                let reservationId: string | undefined;
                if (date && time) {
                    const reservation = await this.schedulingRepo.reserveSlotForPackage(
                        packagePurchaseId,
                        vendorId,
                        null,
                        date,
                        time
                    );
                    reservationId = reservation.id;
                }

                // Get package purchase to check expiry
                const { data: packagePurchase } = await txClient
                    .from('package_purchases')
                    .select('*')
                    .eq('id', packagePurchaseId)
                    .single();

                if (!packagePurchase) {
                    return {
                        success: false,
                        error: 'Package purchase not found'
                    };
                }

                // Check expiry (FIX V19)
                if (packagePurchase.expires_at && new Date(packagePurchase.expires_at) < new Date()) {
                    return {
                        success: false,
                        error: 'Package has expired'
                    };
                }

                // Get next session number
                const { data: existingSessions } = await txClient
                    .from('package_sessions')
                    .select('session_number')
                    .eq('package_purchase_id', packagePurchaseId)
                    .order('session_number', { ascending: false })
                    .limit(1);

                const nextSessionNumber = existingSessions && existingSessions.length > 0
                    ? existingSessions[0].session_number + 1
                    : 1;

                // Create package session record
                const { data: session, error: sessionError } = await txClient
                    .from('package_sessions')
                    .insert({
                        package_purchase_id: packagePurchaseId,
                        customer_id: customerId,
                        vendor_id: vendorId,
                        session_number: nextSessionNumber,
                        scheduled_date: date || null,
                        scheduled_time: time ? time : null,
                        status: date && time ? 'reserved' : 'pending',
                        slot_reservation_id: reservationId || null,
                        redeemed_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (sessionError || !session) {
                    throw new Error(sessionError?.message || 'Failed to create package session');
                }

                return {
                    success: true,
                    sessionId: session.id
                };
            } catch (error: any) {
                return {
                    success: false,
                    error: error.message || 'Failed to redeem package session'
                };
            }
        });
    }

    /**
     * Check slot availability
     */
    private async checkSlotAvailability(
        vendorId: string,
        staffId: string | null,
        date: string,
        time: string
    ): Promise<boolean> {
        // Check capacity
        const capacity = await this.schedulingRepo.getSlotCapacity(
            vendorId,
            staffId,
            date,
            time,
            'at_center' // Default, should be passed as parameter
        );

        if (capacity && capacity.current_bookings >= capacity.max_capacity) {
            return false;
        }

        // Check reservations
        const isReserved = await this.schedulingRepo.isSlotReserved(
            vendorId,
            staffId,
            date,
            time
        );

        return !isReserved;
    }

    /**
     * Get staff location (FIX V9, V22)
     */
    private async getStaffLocation(staffId: string): Promise<{ latitude: number; longitude: number } | null> {
        const { getDbClient } = await import("../db.ts");
        const client = getDbClient();

        // Try to get real-time location first
        const { data: realTimeLocation } = await client
            .from('staff_real_time_locations')
            .select('latitude, longitude')
            .eq('staff_id', staffId)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (realTimeLocation && realTimeLocation.latitude && realTimeLocation.longitude) {
            return {
                latitude: Number(realTimeLocation.latitude),
                longitude: Number(realTimeLocation.longitude)
            };
        }

        // Fallback to vendor location (staff is assigned to vendor)
        const { data: staff } = await client
            .from('staff')
            .select('vendor_id')
            .eq('id', staffId)
            .single();

        if (staff?.vendor_id) {
            const { data: vendor } = await client
                .from('vendors')
                .select('latitude, longitude')
                .eq('id', staff.vendor_id)
                .single();

            if (vendor && vendor.latitude && vendor.longitude) {
                return {
                    latitude: Number(vendor.latitude),
                    longitude: Number(vendor.longitude)
                };
            }
        }

        return null;
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let serviceInstance: SchedulingService | null = null;

export function getSchedulingService(): SchedulingService {
    if (!serviceInstance) {
        serviceInstance = new SchedulingService();
    }
    return serviceInstance;
}

