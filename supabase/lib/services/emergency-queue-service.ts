/**
 * EMERGENCY QUEUE SERVICE
 * SQL-based emergency booking queue management
 * NO KV STORE
 */

import { getDbClient, withTransaction } from "../db.ts";
import { getSchedulingRepository } from "../repositories/scheduling.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface EmergencyBookingRequest {
  booking_id: string;
  priority: number; // 1-10, 1 is highest
  requested_by: string;
  reason?: string;
  location_latitude?: number;
  location_longitude?: number;
  max_distance_km?: number;
}

export class EmergencyQueueService {
  private client: SupabaseClient;
  private schedulingRepo = getSchedulingRepository();
  private bookingsRepo = getBookingsRepository();

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Add booking to emergency queue
   */
  async addToQueue(request: EmergencyBookingRequest): Promise<string> {
    return withTransaction(async (client) => {
      // Get emergency policy
      const policy = await this.schedulingRepo.getPolicy('emergency_priority');
      const canOverride = policy?.canOverrideExistingBookings || false;
      const maxEmergencyBookings = policy?.maxEmergencyBookingsPerStaff || 2;
      const emergencyBufferTime = policy?.emergencyBufferTime || 5;

      // Check if booking exists
      const booking = await this.bookingsRepo.findById(request.booking_id);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Insert into emergency queue
      const { data: queueEntry, error } = await client
        .from('emergency_booking_queue')
        .insert({
          booking_id: request.booking_id,
          priority: request.priority,
          requested_by: request.requested_by,
          reason: request.reason,
          location_latitude: request.location_latitude,
          location_longitude: request.location_longitude,
          max_distance_km: request.max_distance_km || 50,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add to emergency queue: ${error.message}`);
      }

      // Try to auto-assign if possible
      await this.attemptAutoAssignment(queueEntry.id, booking, canOverride, maxEmergencyBookings, emergencyBufferTime);

      return queueEntry.id;
    });
  }

  /**
   * Attempt to auto-assign emergency booking
   */
  private async attemptAutoAssignment(
    queueId: string,
    booking: any,
    canOverride: boolean,
    maxEmergencyBookings: number,
    bufferTime: number
  ): Promise<void> {
    if (!booking.latitude || !booking.longitude) {
      return; // Cannot auto-assign without location
    }

    // Find nearby eligible staff
    const nearbyStaff = await this.findNearbyEligibleStaff(
      booking.latitude,
      booking.longitude,
      booking.vendor_id,
      booking.service_type || 'at_home',
      maxEmergencyBookings,
      bufferTime
    );

    if (nearbyStaff.length > 0) {
      const selectedStaff = nearbyStaff[0]; // Pick closest
      
      await this.client
        .from('emergency_booking_queue')
        .update({
          assigned_vendor_id: selectedStaff.vendor_id,
          assigned_staff_id: selectedStaff.staff_id,
          assigned_at: new Date().toISOString(),
          status: 'assigned'
        })
        .eq('id', queueId);

      // Update booking
      await this.bookingsRepo.update(booking.id, {
        staff_id: selectedStaff.staff_id,
        status: 'emergency_assigned',
        updated_at: new Date().toISOString()
      });
    }
  }

  /**
   * Find nearby eligible staff for emergency assignment
   */
  private async findNearbyEligibleStaff(
    customerLat: number,
    customerLng: number,
    vendorId: string,
    serviceType: string,
    maxEmergencyBookings: number,
    bufferTime: number
  ): Promise<Array<{ staff_id: string; vendor_id: string; distance: number }>> {
    const client = getDbClient();

    // Get all active staff from same vendor or nearby vendors
    const { data: allStaff } = await client
      .from('staff')
      .select('id, vendor_id')
      .eq('is_active', true);

    if (!allStaff || allStaff.length === 0) return [];

    const eligibleStaff: Array<{ staff_id: string; vendor_id: string; distance: number }> = [];

    for (const staff of allStaff) {
      // Get staff location (real-time or vendor location)
      const { data: realTimeLocation } = await client
        .from('staff_real_time_locations')
        .select('latitude, longitude')
        .eq('staff_id', staff.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let staffLat: number | null = null;
      let staffLng: number | null = null;

      if (realTimeLocation?.latitude && realTimeLocation?.longitude) {
        staffLat = Number(realTimeLocation.latitude);
        staffLng = Number(realTimeLocation.longitude);
      } else {
        // Fallback to vendor location
        const { data: vendor } = await client
          .from('vendors')
          .select('latitude, longitude')
          .eq('id', staff.vendor_id)
          .single();

        if (vendor?.latitude && vendor?.longitude) {
          staffLat = Number(vendor.latitude);
          staffLng = Number(vendor.longitude);
        }
      }

      if (!staffLat || !staffLng) continue;

      // Calculate distance
      const distance = this.calculateDistance(customerLat, customerLng, staffLat, staffLng);

      // Check max distance (5km for emergency)
      if (distance > 5) continue;

      // Check current emergency bookings for this staff
      const { data: emergencyBookings } = await client
        .from('emergency_booking_queue')
        .select('id')
        .eq('assigned_staff_id', staff.id)
        .eq('status', 'assigned')
        .or('status.eq.pending');

      if (emergencyBookings && emergencyBookings.length >= maxEmergencyBookings) continue;

      eligibleStaff.push({
        staff_id: staff.id,
        vendor_id: staff.vendor_id,
        distance
      });
    }

    // Sort by distance
    eligibleStaff.sort((a, b) => a.distance - b.distance);

    return eligibleStaff;
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

  /**
   * Get emergency queue entries
   */
  async getQueueEntries(status?: string): Promise<any[]> {
    const query = this.client
      .from('emergency_booking_queue')
      .select('*')
      .order('priority', { ascending: true })
      .order('queued_at', { ascending: true });

    if (status) {
      query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get queue entries: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Complete emergency assignment
   */
  async completeAssignment(queueId: string): Promise<void> {
    await this.client
      .from('emergency_booking_queue')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', queueId);
  }
}

let emergencyQueueServiceInstance: EmergencyQueueService | null = null;

export function getEmergencyQueueService(): EmergencyQueueService {
  if (!emergencyQueueServiceInstance) {
    emergencyQueueServiceInstance = new EmergencyQueueService();
  }
  return emergencyQueueServiceInstance;
}

