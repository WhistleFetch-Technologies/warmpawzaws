/**
 * ============================================================================
 * STAFF DISCOVERY ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Discover staff by service style preferences (at_home, at_center, tele)
 * - Filter by role, service, distance
 * - Get staff by vendor
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.getByPrefix()`, `kv.set()` with SQL queries
 * - Uses `staff`, `vendors`, `staff_services`, `services`, `vendor_availability_v2` tables
 * - Uses `StaffRepository`, `VendorsRepository`, `ServicesRepository`
 * 
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (13 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono@4';
import { getDbClient } from '../../lib/db.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export function staffDiscoveryEndpoints(app: Hono) {
  const db = getDbClient();
  const staffRepo = getStaffRepository();
  const vendorsRepo = getVendorsRepository();
  const servicesRepo = getServicesRepository();
  
  /**
   * GET /make-server-3dd53475/customer/discover-staff
   * Discover staff members by service style preferences
   * 
   * Query params:
   *  - roleId: staff role (veterinarian, pet_groomer, etc.) [REQUIRED]
   *  - serviceStyle: at_home, at_center, or tele [REQUIRED]
   *  - latitude: customer latitude (for home services)
   *  - longitude: customer longitude (for home services)
   *  - maxDistance: max distance in km (default: 50)
   *  - serviceId: filter by specific service capability
   */
  app.get('/make-server-3dd53475/customer/discover-staff', async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceStyle = c.req.query('serviceStyle');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      const maxDistance = parseInt(c.req.query('maxDistance') || '50');
      const serviceId = c.req.query('serviceId');
      
      if (!roleId) {
        return c.json({ error: 'roleId is required' }, 400);
      }
      
      if (!serviceStyle) {
        return c.json({ error: 'serviceStyle is required (at_home, at_center, or tele)' }, 400);
      }
      
      if (!['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        return c.json({ error: 'Invalid serviceStyle. Must be at_home, at_center, or tele' }, 400);
      }
      
      console.log(`🔍 [STAFF-DISCOVERY] Discovering staff for ${serviceStyle} with role ${roleId}`);
      
      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;
      
      // ✅ SQL: Get all active staff with the specified role
      const { data: allStaffData, error: staffError } = await db
        .from('staff')
        .select(`
          id,
          staff_id,
          vendor_id,
          full_name,
          phone,
          email,
          role,
          specialization,
          is_active,
          rating,
          experience_years,
          created_at,
          updated_at
        `)
        .eq('is_active', true)
        .eq('role', roleId);
      
      if (staffError) {
        console.error('❌ [STAFF-DISCOVERY] Error fetching staff:', staffError);
        return c.json({ error: 'Failed to fetch staff' }, 500);
      }
      
      console.log(`   Found ${allStaffData?.length || 0} staff members with role ${roleId}`);
      
      const eligibleStaff: any[] = [];
      
      for (const staff of (allStaffData || [])) {
        // ✅ SQL: Get vendor details
        const vendor = await vendorsRepo.findById(staff.vendor_id);
        if (!vendor || vendor.status !== 'approved') {
          continue;
        }
        
        // ✅ SQL: Check if vendor has availability for this service style
        const { data: availability } = await db
          .from('vendor_availability_v2')
          .select('*')
          .eq('vendor_id', staff.vendor_id)
          .eq('service_style', serviceStyle)
          .eq('is_enabled', true)
          .limit(1);
        
        // ✅ SQL: Get staff services
        const { data: staffServicesData } = await db
          .from('staff_services')
          .select(`
            service_id,
            is_active,
            price,
            duration_minutes,
            services!inner(
              id,
              name,
              description,
              category,
              price,
              duration_minutes
            )
          `)
          .eq('staff_id', staff.id)
          .eq('is_active', true);
        
        const staffServices = (staffServicesData || []).map((ss: any) => ({
          serviceId: ss.service_id,
          serviceName: ss.services?.name || '',
          categoryName: ss.services?.category || '',
          price: ss.price || ss.services?.price || 0,
          duration: ss.duration_minutes || ss.services?.duration_minutes || 0,
          description: ss.services?.description || '',
          serviceStyle: serviceStyle, // Assume service style from query
          isActive: ss.is_active
        }));
        
        // Check if staff has services with this style
        const hasServicesWithStyle = staffServices.length > 0;
        
        // If no availability config but has services, include them
        if (!availability || availability.length === 0) {
          if (!hasServicesWithStyle) {
            continue;
          }
        }
        
        // If serviceId filter is provided, check if staff has this service
        if (serviceId) {
          const hasService = staffServices.some(
            (s: any) => s.serviceId === serviceId && s.isActive
          );
          
          if (!hasService) {
            continue;
          }
        }
        
        // For home services, check distance (if customer provided location)
        let distance: number | null = null;
        if (serviceStyle === 'at_home' && customerLat && customerLng) {
          // Use vendor location
          const vendorLat = vendor.latitude;
          const vendorLng = vendor.longitude;
        
          if (vendorLat && vendorLng) {
            distance = calculateDistance(customerLat, customerLng, vendorLat, vendorLng);
            
            // Check against max distance (use availability config or default 10km)
            const maxDistanceConfig = availability?.[0]?.service_area_km || 10;
            
            if (distance > maxDistanceConfig) {
              continue;
            }
          }
        }
        
        // ✅ SQL: Get staff specializations
        const { data: specializations } = await db
          .from('staff_specializations')
          .select('specialization')
          .eq('staff_id', staff.id);
        
        // ✅ SQL: Get review count and completed bookings
        const { data: reviews } = await db
          .from('reviews')
          .select('id', { count: 'exact' })
          .eq('staff_id', staff.id);
        
        const { data: bookings } = await db
          .from('bookings')
          .select('id', { count: 'exact' })
          .eq('staff_id', staff.id)
          .eq('status', 'completed');
        
        // Enrich staff data
        const enrichedStaff = {
          // Staff details
          id: staff.id,
          staffId: staff.staff_id || staff.id,
          fullName: staff.full_name,
          photo: null, // Would need to add photo field to staff table
          phone: staff.phone,
          email: staff.email || null,
          
          // Role
          roleType: roleId,
          roleName: staff.role,
          specializations: (specializations || []).map((s: any) => s.specialization),
          
          // Ratings
          rating: staff.rating || 4.5,
          reviewCount: reviews?.length || 0,
          completedBookings: bookings?.length || 0,
          
          // Vendor
          vendorId: staff.vendor_id,
          vendorName: vendor.business_name || vendor.owner_name,
          vendorLocation: vendor.latitude && vendor.longitude ? {
            latitude: vendor.latitude,
            longitude: vendor.longitude
          } : null,
          
          // Service style
          serviceStyle: serviceStyle,
          stylePreferences: availability?.[0] ? {
            enabled: true,
            available: true,
            maxDistance: availability[0].service_area_km || 10,
            acceptInstantBooking: true
          } : null,
          
          // Distance (for home services)
          distance: distance,
          
          // Services
          services: staffServices,
          servicesCount: staffServices.length,
          
          // Availability
          isActive: staff.is_active,
          isOnline: false, // Would need to add online status tracking
          
          // Metadata
          createdAt: staff.created_at,
          experienceYears: staff.experience_years || 0
        };
        
        eligibleStaff.push(enrichedStaff);
      }
      
      // Sort staff
      if (serviceStyle === 'at_home' && customerLat && customerLng) {
        // For home services, sort by distance first, then rating
        eligibleStaff.sort((a, b) => {
          if (a.distance !== null && b.distance !== null) {
            return a.distance - b.distance;
          }
          if (a.distance !== null) return -1;
          if (b.distance !== null) return 1;
          return b.rating - a.rating;
        });
      } else {
        // For other styles, sort by rating
        eligibleStaff.sort((a, b) => {
          if (b.rating !== a.rating) {
            return b.rating - a.rating;
          }
          return b.completedBookings - a.completedBookings;
        });
      }
      
      console.log(`✅ [STAFF-DISCOVERY] Returning ${eligibleStaff.length} eligible staff members`);
      
      return c.json({
        success: true,
        staff: eligibleStaff,
        total: eligibleStaff.length,
        filters: {
          roleId,
          serviceStyle,
          customerLocation: customerLat && customerLng ? { latitude: customerLat, longitude: customerLng } : null,
          maxDistance,
          serviceId
        }
      });
      
    } catch (error) {
      console.error('❌ [STAFF-DISCOVERY] Error discovering staff:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * GET /make-server-3dd53475/customer/discover-staff-by-vendor
   * Get all staff from a specific vendor filtered by service style
   * 
   * Query params:
   *  - vendorId: vendor ID [REQUIRED]
   *  - serviceStyle: at_home, at_center, or tele
   *  - latitude: customer latitude (for home services)
   *  - longitude: customer longitude (for home services)
   */
  app.get('/make-server-3dd53475/customer/discover-staff-by-vendor', async (c) => {
    try {
      const vendorId = c.req.query('vendorId');
      const serviceStyle = c.req.query('serviceStyle');
      const latitude = c.req.query('latitude');
      const longitude = c.req.query('longitude');
      
      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }
      
      console.log(`🔍 [STAFF-DISCOVERY] Discovering staff for vendor ${vendorId}`);
      
      const customerLat = latitude ? parseFloat(latitude) : null;
      const customerLng = longitude ? parseFloat(longitude) : null;
      
      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ SQL: Get all active staff for this vendor
      const vendorStaff = await staffRepo.findByVendorId(vendorId);
      
      console.log(`   Found ${vendorStaff.length} staff for vendor ${vendorId}`);
      
      const eligibleStaff: any[] = [];
      
      for (const staff of vendorStaff) {
        // If service style filter is provided
        if (serviceStyle) {
          // ✅ SQL: Check if vendor has availability for this service style
          const { data: availability } = await db
            .from('vendor_availability_v2')
            .select('*')
            .eq('vendor_id', vendorId)
            .eq('service_style', serviceStyle)
            .eq('is_enabled', true)
            .limit(1);
          
          if (!availability || availability.length === 0) {
            continue;
          }
          
          // For home services, check distance
          if (serviceStyle === 'at_home' && customerLat && customerLng) {
            const vendorLat = vendor.latitude;
            const vendorLng = vendor.longitude;
            
            if (vendorLat && vendorLng) {
              const distance = calculateDistance(customerLat, customerLng, vendorLat, vendorLng);
              const maxDistanceConfig = availability[0]?.service_area_km || 10;
              
              if (distance > maxDistanceConfig) {
                continue;
              }
              
              staff.distance = distance;
            }
          }
        }
        
        // ✅ SQL: Get staff services
        const { data: staffServicesData } = await db
          .from('staff_services')
          .select(`
            service_id,
            is_active,
            services!inner(
              id,
              name,
              category,
              price,
              duration_minutes
            )
          `)
          .eq('staff_id', staff.id)
          .eq('is_active', true);
        
        const activeServices = (staffServicesData || []).map((ss: any) => ({
          serviceId: ss.service_id,
          serviceName: ss.services?.name || '',
          categoryName: ss.services?.category || '',
          price: ss.price || ss.services?.price || 0,
          duration: ss.services?.duration_minutes || 0
        }));
        
        // ✅ SQL: Get style preferences from availability
        const { data: preferencesData } = await db
          .from('vendor_availability_v2')
          .select('*')
          .eq('vendor_id', vendorId)
          .eq('is_enabled', true);
        
        const stylePreferences = preferencesData?.reduce((acc: any, pref: any) => {
          acc[pref.service_style] = {
            enabled: pref.is_enabled,
            available: pref.is_enabled,
            maxDistance: pref.service_area_km || 10,
            acceptInstantBooking: true
          };
          return acc;
        }, {}) || {};
        
        eligibleStaff.push({
          id: staff.id,
          fullName: staff.fullName,
          photo: null,
          roleType: staff.roleType || staff.role,
          roleName: staff.role,
          specializations: staff.specializations || [],
          rating: staff.rating || 4.5,
          reviewCount: staff.reviewCount || 0,
          services: activeServices,
          servicesCount: activeServices.length,
          stylePreferences: stylePreferences,
          distance: staff.distance || null,
          isActive: staff.isActive,
          isOnline: false
        });
      }
      
      // Sort by distance if home service
      if (serviceStyle === 'at_home' && customerLat && customerLng) {
        eligibleStaff.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      } else {
        eligibleStaff.sort((a, b) => b.rating - a.rating);
      }
      
      console.log(`✅ [STAFF-DISCOVERY] Returning ${eligibleStaff.length} staff for vendor`);
      
      return c.json({
        success: true,
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name || vendor.owner_name,
          location: vendor.latitude && vendor.longitude ? {
            latitude: vendor.latitude,
            longitude: vendor.longitude
          } : null,
          rating: vendor.rating || 0
        },
        staff: eligibleStaff,
        total: eligibleStaff.length
      });
      
    } catch (error) {
      console.error('❌ [STAFF-DISCOVERY] Error discovering vendor staff:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

export default staffDiscoveryEndpoints;

