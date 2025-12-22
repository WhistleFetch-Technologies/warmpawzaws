/**
 * ============================================================================
 * SCHEDULING REPOSITORY
 * ============================================================================
 * 
 * Repository for scheduling operations - SQL only, no KV store
 * Fixes all 23 violations from scheduling audit
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, deleteQuery, withTransaction } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface VendorAvailability {
    id: string;
    vendor_id: string;
    day_of_week: number;
    time_window_start: string;
    time_window_end: string;
    is_enabled: boolean;
    service_style: 'at_center' | 'at_home' | 'tele';
    slot_duration_minutes: number;
    service_area_km?: number;
    max_capacity: number;
}

export interface StaffAvailability {
    id: string;
    staff_id: string;
    location_id?: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_available: boolean;
}

export interface BookingLock {
    id: string;
    lock_key: string;
    locked_by: string;
    expires_at: string;
    created_at: string;
}

export interface SlotReservation {
    id: string;
    vendor_id: string;
    staff_id?: string;
    reservation_date: string;
    reservation_time: string;
    reservation_type: 'subscription' | 'package' | 'temporary' | 'emergency';
    reserved_for_id?: string;
    expires_at?: string;
    is_active: boolean;
}

export interface BookingSlotCapacity {
    id: string;
    vendor_id: string;
    staff_id?: string;
    slot_date: string;
    slot_time: string;
    service_style: string;
    current_bookings: number;
    max_capacity: number;
}

// ============================================================================
// REPOSITORY CLASS
// ============================================================================

export class SchedulingRepository {
    private client: SupabaseClient;

    constructor(client?: SupabaseClient) {
        this.client = client || getDbClient();
    }

    // ============================================================================
    // DISTRIBUTED LOCKING (FIX V23)
    // ============================================================================

    /**
     * Acquire booking lock atomically (FIX V23: Race Condition)
     */
    async acquireBookingLock(
        vendorId: string,
        date: string,
        time: string,
        lockedBy: string,
        timeoutSeconds: number = 5
    ): Promise<boolean> {
        const lockKey = `booking:lock:${vendorId}:${date}:${time}`;
        
        const { data, error } = await this.client.rpc('acquire_booking_lock', {
            p_lock_key: lockKey,
            p_locked_by: lockedBy,
            p_timeout_seconds: timeoutSeconds
        });

        if (error) {
            console.error('[SCHEDULING] Lock acquisition error:', error);
            return false;
        }

        return data === true;
    }

    /**
     * Release booking lock
     */
    async releaseBookingLock(
        vendorId: string,
        date: string,
        time: string,
        lockedBy: string
    ): Promise<boolean> {
        const lockKey = `booking:lock:${vendorId}:${date}:${time}`;
        
        const { data, error } = await this.client.rpc('release_booking_lock', {
            p_lock_key: lockKey,
            p_locked_by: lockedBy
        });

        if (error) {
            console.error('[SCHEDULING] Lock release error:', error);
            return false;
        }

        return data === true;
    }

    // ============================================================================
    // SLOT CAPACITY MANAGEMENT (FIX V1, V2)
    // ============================================================================

    /**
     * Reserve booking slot atomically (FIX V2: No Atomic Lock)
     */
    async reserveBookingSlot(
        vendorId: string,
        staffId: string | null,
        date: string,
        time: string,
        serviceStyle: string,
        maxCapacity: number = 1
    ): Promise<boolean> {
        const { data, error } = await this.client.rpc('reserve_booking_slot', {
            p_vendor_id: vendorId,
            p_staff_id: staffId,
            p_booking_date: date,
            p_booking_time: time,
            p_service_style: serviceStyle,
            p_max_capacity: maxCapacity
        });

        if (error) {
            console.error('[SCHEDULING] Slot reservation error:', error);
            return false;
        }

        return data === true;
    }

    /**
     * Release booking slot
     */
    async releaseBookingSlot(
        vendorId: string,
        staffId: string | null,
        date: string,
        time: string,
        serviceStyle: string
    ): Promise<boolean> {
        const { data, error } = await this.client.rpc('release_booking_slot', {
            p_vendor_id: vendorId,
            p_staff_id: staffId,
            p_booking_date: date,
            p_booking_time: time,
            p_service_style: serviceStyle
        });

        if (error) {
            console.error('[SCHEDULING] Slot release error:', error);
            return false;
        }

        return data === true;
    }

    /**
     * Get slot capacity
     */
    async getSlotCapacity(
        vendorId: string,
        staffId: string | null,
        date: string,
        time: string,
        serviceStyle: string
    ): Promise<BookingSlotCapacity | null> {
        const filters: any = {
            vendor_id: vendorId,
            slot_date: date,
            slot_time: time,
            service_style: serviceStyle
        };

        if (staffId) {
            filters.staff_id = staffId;
        } else {
            filters.staff_id = null;
        }

        const results = await selectQuery<BookingSlotCapacity>(
            'booking_slot_capacity',
            filters,
            { limit: 1 }
        );

        return results[0] || null;
    }

    // ============================================================================
    // VENDOR AVAILABILITY (FIX V3)
    // ============================================================================

    /**
     * Get vendor availability for a day
     */
    async getVendorAvailability(
        vendorId: string,
        dayOfWeek: number
    ): Promise<VendorAvailability[]> {
        return selectQuery<VendorAvailability>(
            'vendor_availability_v2',
            {
                vendor_id: vendorId,
                day_of_week: dayOfWeek,
                is_enabled: true
            }
        );
    }

    /**
     * Check if time slot is within vendor availability windows
     */
    async isTimeSlotAvailable(
        vendorId: string,
        date: string,
        time: string,
        serviceStyle: string
    ): Promise<boolean> {
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();
        const timeObj = new Date(`2000-01-01T${time}`);

        const availability = await this.getVendorAvailability(vendorId, dayOfWeek);
        
        return availability.some(avail => {
            if (avail.service_style !== serviceStyle) return false;
            
            const startTime = new Date(`2000-01-01T${avail.time_window_start}`);
            const endTime = new Date(`2000-01-01T${avail.time_window_end}`);
            
            return timeObj >= startTime && timeObj < endTime;
        });
    }

    // ============================================================================
    // STAFF AVAILABILITY (FIX V4, V5, V6)
    // ============================================================================

    /**
     * Get staff availability for a location and day
     */
    async getStaffAvailability(
        staffId: string,
        locationId: string,
        dayOfWeek: number
    ): Promise<StaffAvailability[]> {
        return selectQuery<StaffAvailability>(
            'staff_availability_slots',
            {
                staff_id: staffId,
                location_id: locationId,
                day_of_week: dayOfWeek,
                is_available: true
            }
        );
    }

    /**
     * Check staff location conflict with travel time (FIX V5)
     */
    async checkStaffLocationConflict(
        staffId: string,
        locationId: string,
        date: string,
        time: string,
        durationMinutes: number,
        travelTimeMinutes: number = 30
    ): Promise<boolean> {
        const { data, error } = await this.client.rpc('check_staff_location_conflict', {
            p_staff_id: staffId,
            p_location_id: locationId,
            p_booking_date: date,
            p_booking_time: time,
            p_duration_minutes: durationMinutes,
            p_travel_time_minutes: travelTimeMinutes
        });

        if (error) {
            console.error('[SCHEDULING] Location conflict check error:', error);
            return false;
        }

        return data === true;
    }

    /**
     * Get staff breaks for a date (FIX V6)
     */
    async getStaffBreaks(
        staffId: string,
        date: string
    ): Promise<Array<{ start_time: string; end_time: string }>> {
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();

        // Get specific date breaks
        const dateBreaks = await selectQuery<{ start_time: string; end_time: string }>(
            'staff_breaks',
            {
                staff_id: staffId,
                break_date: date
            }
        );

        // Get recurring day-of-week breaks
        const recurringBreaks = await selectQuery<{ start_time: string; end_time: string }>(
            'staff_breaks',
            {
                staff_id: staffId,
                day_of_week: dayOfWeek
            }
        );

        return [...dateBreaks, ...recurringBreaks];
    }

    // ============================================================================
    // SLOT RESERVATIONS (FIX V14, V15, V16)
    // ============================================================================

    /**
     * Reserve slot for subscription (FIX V14)
     */
    async reserveSlotForSubscription(
        subscriptionId: string,
        vendorId: string,
        staffId: string | null,
        date: string,
        time: string
    ): Promise<SlotReservation> {
        const results = await insertQuery<SlotReservation>('slot_reservations', {
            vendor_id: vendorId,
            staff_id: staffId || null,
            reservation_date: date,
            reservation_time: time,
            reservation_type: 'subscription',
            reserved_for_id: subscriptionId,
            is_active: true
        });

        if (!results[0]) {
            throw new Error('Failed to reserve subscription slot');
        }

        return results[0];
    }

    /**
     * Reserve slot for package (FIX V17)
     */
    async reserveSlotForPackage(
        packageId: string,
        vendorId: string,
        staffId: string | null,
        date: string,
        time: string,
        expiresAt?: string
    ): Promise<SlotReservation> {
        const results = await insertQuery<SlotReservation>('slot_reservations', {
            vendor_id: vendorId,
            staff_id: staffId || null,
            reservation_date: date,
            reservation_time: time,
            reservation_type: 'package',
            reserved_for_id: packageId,
            expires_at: expiresAt || null,
            is_active: true
        });

        if (!results[0]) {
            throw new Error('Failed to reserve package slot');
        }

        return results[0];
    }

    /**
     * Check if slot is reserved
     */
    async isSlotReserved(
        vendorId: string,
        staffId: string | null,
        date: string,
        time: string
    ): Promise<boolean> {
        const filters: any = {
            vendor_id: vendorId,
            reservation_date: date,
            reservation_time: time,
            is_active: true
        };

        if (staffId) {
            filters.staff_id = staffId;
        } else {
            filters.staff_id = null;
        }

        const results = await selectQuery<SlotReservation>(
            'slot_reservations',
            filters,
            { limit: 1 }
        );

        return results.length > 0;
    }

    // ============================================================================
    // COMMUTE TIME (FIX V10, V11, V13)
    // ============================================================================

    /**
     * Get or calculate commute time (FIX V10, V11)
     * Supports both location IDs and coordinates
     */
    async getCommuteTime(
        fromLocationIdOrStaffId: string,
        toLocationIdOrType: string,
        fromLat?: number,
        fromLng?: number,
        toLat?: number,
        toLng?: number
    ): Promise<number> {
        // Check cache first (if location IDs provided)
        if (fromLocationIdOrStaffId && toLocationIdOrType && !fromLat && !toLat) {
            const cached = await selectQuery<{ commute_time_minutes: number; expires_at: string }>(
                'commute_time_cache',
                {
                    from_location_id: fromLocationIdOrStaffId,
                    to_location_id: toLocationIdOrType
                },
                {
                    limit: 1,
                    orderBy: 'calculated_at',
                    orderDirection: 'desc'
                }
            );

            if (cached[0] && new Date(cached[0].expires_at) > new Date()) {
                return cached[0].commute_time_minutes;
            }
        }

        // Calculate commute time (simplified - would use Google Maps API in production)
        if (fromLat && fromLng && toLat && toLng) {
            const distance = this.calculateDistance(fromLat, fromLng, toLat, toLng);
            const baseCommuteTime = Math.ceil(distance * 3); // 3 minutes per km
            const trafficFactor = 1.5; // FIX V13: Traffic factor
            const commuteTime = Math.ceil(baseCommuteTime * trafficFactor);

            // Cache result (if location IDs provided)
            if (fromLocationIdOrStaffId && toLocationIdOrType) {
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 1);

                await insertQuery('commute_time_cache', {
                    from_location_id: fromLocationIdOrStaffId,
                    to_location_id: toLocationIdOrType,
                    from_latitude: fromLat,
                    from_longitude: fromLng,
                    to_latitude: toLat,
                    to_longitude: toLng,
                    distance_km: distance,
                    commute_time_minutes: commuteTime,
                    traffic_factor: trafficFactor,
                    calculated_at: new Date().toISOString(),
                    expires_at: expiresAt.toISOString()
                });
            }

            return commuteTime;
        }

        return 30; // Default 30 minutes
    }

    /**
     * Calculate distance using Haversine formula
     */
    private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return Math.round(distance * 10) / 10;
    }

    private toRad(degrees: number): number {
        return degrees * (Math.PI / 180);
    }

    // ============================================================================
    // POLICIES
    // ============================================================================

    /**
     * Get scheduling policy
     */
    async getPolicy(policyType: string): Promise<any> {
        const results = await selectQuery<{ policy_config: any }>(
            'scheduling_policies',
            {
                policy_type: policyType,
                is_active: true
            },
            { limit: 1 }
        );

        return results[0]?.policy_config || null;
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let repositoryInstance: SchedulingRepository | null = null;

export function getSchedulingRepository(): SchedulingRepository {
    if (!repositoryInstance) {
        repositoryInstance = new SchedulingRepository();
    }
    return repositoryInstance;
}

