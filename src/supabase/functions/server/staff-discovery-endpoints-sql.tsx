/**
 * STAFF DISCOVERY ENDPOINTS - SQL VERSION
 * NO KV STORE - All data from SQL
 */

import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';
import { calculateDistance } from '../../../supabase/lib/utils/schedule-utils-sql';
import { getDiscoveryService } from '../../../supabase/lib/services/discovery-service';

export function staffDiscoveryEndpointsSQL(app: Hono) {
  
  /**
   * GET /make-server-3dd53475/customer/discover-staff (SQL)
   * Discover staff members by service style preferences
   */
  app.get('/make-server-3dd53475/customer/discover-staff', async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const customerLat = parseFloat(c.req.query('latitude') || '0');
      const customerLng = parseFloat(c.req.query('longitude') || '0');
      const maxDistance = parseFloat(c.req.query('maxDistance') || '50');
      const serviceId = c.req.query('serviceId');
      
      if (!roleId || !serviceStyle) {
        return c.json({ error: 'roleId and serviceStyle are required' }, 400);
      }
      
      console.log(`🔍 [STAFF-DISCOVERY] Discovering staff (SQL):`, {
        roleId,
        serviceStyle,
        customerLat,
        customerLng,
        maxDistance
      });
      
      const client = getDbClient();
      const discoveryService = getDiscoveryService();
      
      // Get vendors with this role
      const { data: vendors } = await client
        .from('vendors')
        .select('id, business_name, phone, address, city, latitude, longitude, status')
        .eq('role_id', roleId)
        .eq('status', 'active')
        .eq('is_active', true);
      
      if (!vendors || vendors.length === 0) {
        return c.json({
          success: true,
          staff: [],
          count: 0
        });
      }
      
      // Get all staff from these vendors
      const vendorIds = vendors.map(v => v.id);
      const { data: allStaff } = await client
        .from('staff')
        .select('id, name, phone, email, role, vendor_id, is_active')
        .in('vendor_id', vendorIds)
        .eq('is_active', true);
      
      if (!allStaff || allStaff.length === 0) {
        return c.json({
          success: true,
          staff: [],
          count: 0
        });
      }
      
      // Filter staff by service style and distance
      const matchingStaff: any[] = [];
      
      for (const staff of allStaff) {
        const vendor = vendors.find(v => v.id === staff.vendor_id);
        if (!vendor) continue;
        
        // Check if staff has this service style enabled
        // This would be checked via staff_services table
        const { data: staffServices } = await client
          .from('staff_services')
          .select('service_id, service:services(service_style)')
          .eq('staff_id', staff.id)
          .eq('is_active', true);
        
        // For home services, check distance
        if (serviceStyle === 'at_home' && customerLat && customerLng) {
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
          } else if (vendor.latitude && vendor.longitude) {
            staffLat = Number(vendor.latitude);
            staffLng = Number(vendor.longitude);
          }
          
          if (!staffLat || !staffLng) continue;
          
          // Calculate distance
          const distance = calculateDistance(customerLat, customerLng, staffLat, staffLng);
          
          if (distance > maxDistance) continue;
          
          // Add distance to staff object
          staff.distance = distance;
        }
        
        // Check if staff has required service
        if (serviceId) {
          const hasService = staffServices?.some(ss => ss.service_id === serviceId);
          if (!hasService) continue;
        }
        
        matchingStaff.push({
          ...staff,
          vendorName: vendor.business_name,
          vendorPhone: vendor.phone,
          vendorAddress: vendor.address,
          vendorCity: vendor.city,
          services: staffServices || []
        });
      }
      
      // Sort by distance if available
      if (serviceStyle === 'at_home' && customerLat && customerLng) {
        matchingStaff.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      }
      
      console.log(`✅ [STAFF-DISCOVERY] Found ${matchingStaff.length} matching staff (SQL)`);
      
      return c.json({
        success: true,
        staff: matchingStaff,
        count: matchingStaff.length
      });
    } catch (error) {
      console.error('❌ [STAFF-DISCOVERY] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

// Export as default for compatibility
export default staffDiscoveryEndpointsSQL;

