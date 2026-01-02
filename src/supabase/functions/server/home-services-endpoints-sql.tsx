/**
 * HOME SERVICES ENDPOINTS - SQL VERSION
 * NO KV STORE - All data from SQL
 */

import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';
import { getBookingsRepository } from '../../../supabase/lib/repositories/bookings';
import { getEmergencyQueueService } from '../../../supabase/lib/services/emergency-queue-service';
import { calculateDistance } from '../../../supabase/lib/utils/schedule-utils-sql';

export function homeServicesEndpointsSQL(app: Hono) {
  
  /**
   * Emergency Reassignment (SQL)
   * POST /make-server-3dd53475/booking/:bookingId/emergency-reassign
   */
  app.post('/make-server-3dd53475/booking/:bookingId/emergency-reassign', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { requestedBy, reason } = await c.req.json();
      
      console.log(`🚨 [EMERGENCY] Emergency reassignment requested for booking ${bookingId} by ${requestedBy} (SQL)`);
      
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      
      if (!booking) {
        return c.json({ error: 'Booking not found' }, 404);
      }
      
      // Check if booking can be reassigned
      if (!['accepted', 'traveling', 'in_progress'].includes(booking.status)) {
        return c.json({ error: `Cannot reassign booking with status: ${booking.status}` }, 400);
      }
      
      // Get emergency policy
      const { getSchedulingRepository } = await import('../../../supabase/lib/repositories/scheduling.ts');
      const schedulingRepo = getSchedulingRepository();
      const policy = await schedulingRepo.getPolicy('emergency_priority');
      
      if (!policy?.canOverrideExistingBookings) {
        return c.json({ error: 'Emergency override not allowed by policy' }, 403);
      }
      
      // Add to emergency queue
      const emergencyQueue = getEmergencyQueueService();
      const queueId = await emergencyQueue.addToQueue({
        booking_id: bookingId,
        priority: 1, // Highest priority
        requested_by: requestedBy,
        reason: reason,
        location_latitude: booking.latitude,
        location_longitude: booking.longitude,
        max_distance_km: 5
      });
      
      // Get queue entry to check if auto-assigned
      const queueEntries = await emergencyQueue.getQueueEntries('assigned');
      const queueEntry = queueEntries.find(e => e.id === queueId);
      
      if (queueEntry && queueEntry.status === 'assigned') {
        // Auto-assigned successfully
        return c.json({
          success: true,
          booking: await bookingsRepo.findById(bookingId),
          message: `Emergency reassignment successful. Assigned to staff ${queueEntry.assigned_staff_id}`
        });
      } else {
        // Pending assignment
        return c.json({
          success: true,
          booking: await bookingsRepo.findById(bookingId),
          message: 'Emergency reassignment queued. System is finding available staff.'
        });
      }
      
    } catch (error) {
      console.error('❌ [EMERGENCY] Error during emergency reassignment:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Find nearby eligible staff (SQL)
   */
  async function findNearbyEligibleStaff(
    customerAddress: any,
    services: any[],
    excludeStaffId: string,
    serviceStyle: string
  ): Promise<any[]> {
    try {
      const client = getDbClient();
      
      console.log(`🔍 [NEARBY] Finding eligible staff within 5km (SQL)`);
      
      if (!customerAddress?.latitude || !customerAddress?.longitude) {
        return [];
      }
      
      // Get all active staff
      const { data: allStaff } = await client
        .from('staff')
        .select('id, vendor_id, is_active')
        .eq('is_active', true);
      
      if (!allStaff || allStaff.length === 0) return [];
      
      const eligibleStaff: any[] = [];
      
      for (const staff of allStaff) {
        if (staff.id === excludeStaffId) continue;
        
        // Get staff location (real-time or vendor)
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
        const distance = calculateDistance(
          customerAddress.latitude,
          customerAddress.longitude,
          staffLat,
          staffLng
        );
        
        // Within 5km for emergency
        if (distance > 5) continue;
        
        // Check if staff has required services
        if (services && services.length > 0) {
          const { data: staffServices } = await client
            .from('staff_services')
            .select('service_id')
            .eq('staff_id', staff.id)
            .eq('is_active', true);
          
          const hasRequiredServices = services.every(service => 
            staffServices?.some(ss => ss.service_id === service.serviceId)
          );
          
          if (!hasRequiredServices) continue;
        }
        
        eligibleStaff.push({
          id: staff.id,
          vendorId: staff.vendor_id,
          distance
        });
      }
      
      // Sort by distance
      eligibleStaff.sort((a, b) => a.distance - b.distance);
      
      console.log(`✅ [NEARBY] Found ${eligibleStaff.length} eligible staff (SQL)`);
      
      return eligibleStaff.slice(0, 10); // Max 10
      
    } catch (error) {
      console.error('❌ [NEARBY] Error finding nearby staff:', error);
      return [];
    }
  }
  
  // Export for use in other endpoints
  (app as any).findNearbyEligibleStaff = findNearbyEligibleStaff;
}

export default homeServicesEndpointsSQL;

