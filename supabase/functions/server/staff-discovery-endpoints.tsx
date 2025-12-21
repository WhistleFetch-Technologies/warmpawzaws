/**
 * STAFF DISCOVERY ENDPOINTS
 * Customer-facing endpoints to discover staff by service style preferences
 * Filters based on staff's enabled service styles (at_home, at_center, tele)
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

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
      
      // Get all staff
      const allStaff = await kv.getByPrefix('staff:staff_');
      console.log(`   Found ${allStaff.length} total staff members`);
      
      const eligibleStaff: any[] = [];
      
      for (const staff of allStaff) {
        // Filter by role
        if (staff.roleType !== roleId) {
          continue;
        }
        
        // Must be active and approved
        if (!staff.isActive || staff.status !== 'active') {
          continue;
        }
        
        // Get vendor details
        const vendor = await kv.get(`vendor:${staff.vendorId}`);
        if (!vendor || vendor.applicationStatus !== 'approved') {
          continue;
        }
        
        // Get style preferences
        const preferences = await kv.get(`staff:${staff.id}:style_preferences`);
        
        // ✅ FALLBACK: Check if staff has services with this style even if preferences aren't set
        const staffServices = await kv.getByPrefix(`staff:${staff.id}:service:`);
        const hasServicesWithStyle = staffServices.some((s: any) => s.serviceStyle === serviceStyle && s.isActive);
        
        if (!preferences) {
          // If no preferences but has services with this style, auto-create preferences
          if (hasServicesWithStyle) {
            console.log(`   🔧 Staff ${staff.id} has ${serviceStyle} services but no preferences, auto-enabling...`);
            const newPreferences = {
              staffId: staff.id,
              at_center: { enabled: serviceStyle === 'at_center', available: serviceStyle === 'at_center' },
              at_home: { 
                enabled: serviceStyle === 'at_home', 
                available: serviceStyle === 'at_home',
                maxDistance: 10,
                travelChargePerKm: 0,
                acceptInstantBooking: true
              },
              tele: { 
                enabled: serviceStyle === 'tele', 
                available: serviceStyle === 'tele',
                videoEnabled: true,
                chatEnabled: true,
                maxSessionDuration: 30,
                acceptInstantBooking: false
              },
              autoAcceptBookings: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await kv.set(`staff:${staff.id}:style_preferences`, newPreferences);
            // Continue with the auto-created preferences
          } else {
            console.log(`   ⚠️  Staff ${staff.id} has no style preferences and no ${serviceStyle} services, skipping`);
            continue;
          }
        }
        
        // Re-fetch preferences if we just created them
        const styleConfig = (preferences || await kv.get(`staff:${staff.id}:style_preferences`))?.[serviceStyle];
        
        // Check if staff has enabled this service style OR has active services with this style
        if (!styleConfig && !hasServicesWithStyle) {
          console.log(`   ⚠️  Staff ${staff.id} (${staff.fullName}) has no ${serviceStyle} config or services`);
          continue;
        }
        
        // If style is not enabled but they have services, auto-enable it
        if (hasServicesWithStyle && styleConfig && (!styleConfig.enabled || !styleConfig.available)) {
          console.log(`   🔧 Staff ${staff.id} has ${serviceStyle} services but style disabled, auto-enabling...`);
          const updatedPreferences = await kv.get(`staff:${staff.id}:style_preferences`);
          if (updatedPreferences && updatedPreferences[serviceStyle]) {
            updatedPreferences[serviceStyle].enabled = true;
            updatedPreferences[serviceStyle].available = true;
            updatedPreferences.updatedAt = new Date().toISOString();
            await kv.set(`staff:${staff.id}:style_preferences`, updatedPreferences);
          }
        } else if (!hasServicesWithStyle && (!styleConfig || !styleConfig.enabled || !styleConfig.available)) {
          console.log(`   ⚠️  Staff ${staff.id} (${staff.fullName}) has ${serviceStyle} disabled and no services`);
          continue;
        }
        
        console.log(`   ✅ Staff ${staff.id} (${staff.fullName}) has ${serviceStyle} enabled`);
        
        // For home services, check distance (if customer provided location)
        if (serviceStyle === 'at_home' && customerLat && customerLng) {
          // Check if staff has location
          if (!staff.lastKnownLocation && !vendor.location) {
            console.log(`   ⚠️  Staff ${staff.id} has no location set, but including anyway`);
            // Still include this staff, just without distance info
          } else {
            // Use staff location or vendor location
            const staffLat = staff.lastKnownLocation?.latitude || vendor.location?.latitude;
            const staffLng = staff.lastKnownLocation?.longitude || vendor.location?.longitude;
          
            if (!staffLat || !staffLng) {
              console.log(`   ⚠️  Staff ${staff.id} location incomplete`);
              continue;
            }
            
            // Calculate distance
            const distance = calculateDistance(customerLat, customerLng, staffLat, staffLng);
            
            // Check against staff's max distance preference
            const staffMaxDistance = styleConfig?.maxDistance || 10;
            
            if (distance > staffMaxDistance) {
              console.log(`   ⚠️  Staff ${staff.id} too far: ${distance.toFixed(2)}km > ${staffMaxDistance}km`);
              continue;
            }
            
            console.log(`   ✅ Staff ${staff.id} within range: ${distance.toFixed(2)}km <= ${staffMaxDistance}km`);
            
            // Add distance to staff object
            staff.distance = distance;
          }
        }
        
        // Get staff services (used for both filtering and enrichment)
        // Note: staffServices already fetched on line 90
        
        // If serviceId filter is provided, check if staff has this service
        if (serviceId) {
          const hasService = staffServices.some(
            (s: any) => s.serviceId === serviceId && s.isActive
          );
          
          if (!hasService) {
            console.log(`   ⚠️  Staff ${staff.id} doesn't offer service ${serviceId}`);
            continue;
          }
        }
        
        // Filter active services
        const activeServices = staffServices.filter((s: any) => s.isActive);
        
        // Enrich staff data
        const enrichedStaff = {
          // Staff details
          id: staff.id,
          staffId: staff.id,
          fullName: staff.fullName,
          photo: staff.photo,
          phone: staff.phone,
          email: staff.email,
          
          // Role
          roleType: staff.roleType,
          roleName: staff.roleName,
          specializations: staff.specializations || [],
          
          // Ratings
          rating: staff.rating || 4.5,
          reviewCount: staff.reviewCount || 0,
          completedBookings: staff.completedBookings || 0,
          
          // Vendor
          vendorId: staff.vendorId,
          vendorName: vendor.businessName || vendor.fullName,
          vendorLocation: vendor.location,
          
          // Service style
          serviceStyle: serviceStyle,
          stylePreferences: styleConfig,
          
          // Distance (for home services)
          distance: staff.distance || null,
          
          // Services
          services: activeServices.map((s: any) => ({
            serviceId: s.serviceId,
            serviceName: s.serviceName,
            categoryName: s.categoryName,
            subCategoryName: s.subCategoryName,
            price: s.price,
            duration: s.duration,
            description: s.description
          })),
          servicesCount: activeServices.length,
          
          // Availability
          isActive: staff.isActive,
          isOnline: staff.isOnline || false,
          
          // Metadata
          createdAt: staff.createdAt,
          experienceYears: staff.experienceYears
        };
        
        eligibleStaff.push(enrichedStaff);
      }
      
      // Sort staff
      if (serviceStyle === 'at_home' && customerLat && customerLng) {
        // For home services, sort by distance first, then rating
        eligibleStaff.sort((a, b) => {
          if (a.distance !== b.distance) {
            return a.distance - b.distance;
          }
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
      
      // Get vendor
      const vendor = await kv.get(`vendor:${vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Get all staff for this vendor
      const allStaff = await kv.getByPrefix(`staff:staff_`);
      const vendorStaff = allStaff.filter((s: any) => s.vendorId === vendorId && s.isActive);
      
      console.log(`   Found ${vendorStaff.length} staff for vendor ${vendorId}`);
      
      const eligibleStaff: any[] = [];
      
      for (const staff of vendorStaff) {
        // If service style filter is provided
        if (serviceStyle) {
          const preferences = await kv.get(`staff:${staff.id}:style_preferences`);
          
          if (!preferences || !preferences[serviceStyle]?.enabled) {
            continue;
          }
          
          // For home services, check distance
          if (serviceStyle === 'at_home' && customerLat && customerLng) {
            const staffLat = staff.lastKnownLocation?.latitude || vendor.location?.latitude;
            const staffLng = staff.lastKnownLocation?.longitude || vendor.location?.longitude;
            
            if (staffLat && staffLng) {
              const distance = calculateDistance(customerLat, customerLng, staffLat, staffLng);
              const staffMaxDistance = preferences[serviceStyle]?.maxDistance || 10;
              
              if (distance > staffMaxDistance) {
                continue;
              }
              
              staff.distance = distance;
            }
          }
        }
        
        // Get services
        const staffServices = await kv.getByPrefix(`staff:${staff.id}:service:`);
        const activeServices = staffServices.filter((s: any) => s.isActive);
        
        // Get preferences
        const preferences = await kv.get(`staff:${staff.id}:style_preferences`);
        
        eligibleStaff.push({
          id: staff.id,
          fullName: staff.fullName,
          photo: staff.photo,
          roleType: staff.roleType,
          roleName: staff.roleName,
          specializations: staff.specializations || [],
          rating: staff.rating || 4.5,
          reviewCount: staff.reviewCount || 0,
          services: activeServices,
          servicesCount: activeServices.length,
          stylePreferences: preferences,
          distance: staff.distance || null,
          isActive: staff.isActive,
          isOnline: staff.isOnline || false
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
          businessName: vendor.businessName || vendor.fullName,
          location: vendor.location,
          rating: vendor.rating
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
