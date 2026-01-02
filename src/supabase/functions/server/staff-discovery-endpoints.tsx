/**
 * STAFF DISCOVERY ENDPOINTS
 * Customer-facing endpoints to discover staff by service style preferences
 * Filters based on staff's enabled service styles (at_home, at_center, tele)
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import {
  getStaffRepository,
  getVendorsRepository,
  getVendorServicesRepository,
  getStaffSettingsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

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
      
      // ✅ SQL: Get all staff
      const staffRepo = getStaffRepository();
      const allStaff = await staffRepo.findAll();
      console.log(`   Found ${allStaff.length} total staff members`);
      
      const eligibleStaff: any[] = [];
      
      for (const staff of allStaff) {
        // Filter by role
        if ((staff.role_type || staff.roleType) !== roleId) {
          continue;
        }
        
        // Must be active and approved
        if ((staff.is_active === false || staff.isActive === false) || (staff.status !== 'active' && staff.status !== 'approved')) {
          continue;
        }
        
        // ✅ SQL: Get vendor details
        const vendorsRepo = getVendorsRepository();
        const vendorId = staff.vendor_id || staff.vendorId;
        const vendor = vendorId ? await vendorsRepo.findById(vendorId) : null;
        if (!vendor || (vendor.application_status !== 'approved' && vendor.status !== 'approved')) {
          continue;
        }
        
        // ✅ SQL: Get style preferences
        const staffSettingsRepo = getStaffSettingsRepository();
        const preferences = await staffSettingsRepo.findByStaff(staff.id);
        
        // ✅ SQL: Get staff services
        const vendorServicesRepo = getVendorServicesRepository();
        const staffServices = await vendorServicesRepo.findByStaff(staff.id);
        const hasServicesWithStyle = staffServices.some((s: any) => (s.service_style || s.serviceStyle) === serviceStyle && (s.is_active !== false && s.isActive !== false));
        
        // Get style config from preferences (if stored as JSONB)
        const stylePreferences = preferences?.style_preferences || preferences;
        const styleConfig = stylePreferences?.[serviceStyle];
        
        if (!preferences && hasServicesWithStyle) {
          // ✅ SQL: Auto-create preferences if staff has services with this style
          console.log(`   🔧 Staff ${staff.id} has ${serviceStyle} services but no preferences, auto-enabling...`);
          const newPreferences = {
            staff_id: staff.id,
            style_preferences: {
              at_center: { enabled: serviceStyle === 'at_center', available: serviceStyle === 'at_center' },
              at_home: { 
                enabled: serviceStyle === 'at_home', 
                available: serviceStyle === 'at_home',
                maxDistance: 10,
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
              autoAcceptBookings: false
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          await staffSettingsRepo.create(newPreferences);
          // Use the newly created preferences
        } else if (!preferences && !hasServicesWithStyle) {
          console.log(`   ⚠️  Staff ${staff.id} has no style preferences and no ${serviceStyle} services, skipping`);
          continue;
        }
        
        // Check if staff has enabled this service style OR has active services with this style
        if (!styleConfig && !hasServicesWithStyle) {
          console.log(`   ⚠️  Staff ${staff.id} (${staff.fullName}) has no ${serviceStyle} config or services`);
          continue;
        }
        
        // ✅ SQL: If style is not enabled but they have services, auto-enable it
        if (hasServicesWithStyle && styleConfig && (!styleConfig.enabled || !styleConfig.available)) {
          console.log(`   🔧 Staff ${staff.id} has ${serviceStyle} services but style disabled, auto-enabling...`);
          const currentSettings = await staffSettingsRepo.findByStaff(staff.id);
          if (currentSettings) {
            const updatedPreferences = currentSettings.style_preferences || {};
            if (updatedPreferences[serviceStyle]) {
              updatedPreferences[serviceStyle].enabled = true;
              updatedPreferences[serviceStyle].available = true;
              await staffSettingsRepo.update(currentSettings.id || staff.id, {
                style_preferences: updatedPreferences,
                updated_at: new Date().toISOString()
              });
            }
          }
        } else if (!hasServicesWithStyle && (!styleConfig || !styleConfig.enabled || !styleConfig.available)) {
          console.log(`   ⚠️  Staff ${staff.id} (${staff.fullName}) has ${serviceStyle} disabled and no services`);
          continue;
        }
        
        console.log(`   ✅ Staff ${staff.id} (${staff.fullName}) has ${serviceStyle} enabled`);
        
        // For home services, check distance (if customer provided location)
        if (serviceStyle === 'at_home' && customerLat && customerLng) {
          // Check if staff has location
          if (!staff.last_known_location && !staff.lastKnownLocation && !vendor.location) {
            console.log(`   ⚠️  Staff ${staff.id} has no location set, but including anyway`);
            // Still include this staff, just without distance info
          } else {
            // Use staff location or vendor location
            const staffLat = staff.last_known_location?.latitude || staff.lastKnownLocation?.latitude || vendor.location?.latitude;
            const staffLng = staff.last_known_location?.longitude || staff.lastKnownLocation?.longitude || vendor.location?.longitude;
          
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
          fullName: staff.full_name || staff.fullName,
          photo: staff.photo_url || staff.photo,
          phone: staff.phone,
          email: staff.email,
          
          // Role
          roleType: staff.role_type || staff.roleType,
          roleName: staff.role_name || staff.roleName,
          specializations: staff.specializations || [],
          
          // Ratings
          rating: staff.rating || 4.5,
          reviewCount: staff.review_count || staff.reviewCount || 0,
          completedBookings: staff.completed_bookings || staff.completedBookings || 0,
          
          // Vendor
          vendorId: staff.vendor_id || staff.vendorId,
          vendorName: vendor.business_name || vendor.businessName || vendor.full_name || vendor.fullName,
          vendorLocation: vendor.location,
          
          // Service style
          serviceStyle: serviceStyle,
          stylePreferences: styleConfig,
          
          // Distance (for home services)
          distance: staff.distance || null,
          
          // Services
          services: activeServices.map((s: any) => ({
            serviceId: s.service_id || s.serviceId,
            serviceName: s.service_name || s.serviceName,
            categoryName: s.category_name || s.categoryName,
            subCategoryName: s.sub_category_name || s.subCategoryName,
            price: s.price,
            duration: s.duration,
            description: s.description
          })),
          servicesCount: activeServices.length,
          
          // Availability
          isActive: staff.is_active !== false && staff.isActive !== false,
          isOnline: staff.is_online || staff.isOnline || false,
          
          // Metadata
          createdAt: staff.created_at || staff.createdAt,
          experienceYears: staff.experience_years || staff.experienceYears
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
      
      // ✅ SQL: Get vendor
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // ✅ SQL: Get all staff for this vendor
      const staffRepo = getStaffRepository();
      const allStaff = await staffRepo.findByVendor(vendorId);
      const vendorStaff = allStaff.filter((s: any) => (s.is_active !== false && s.isActive !== false));
      
      console.log(`   Found ${vendorStaff.length} staff for vendor ${vendorId}`);
      
      const eligibleStaff: any[] = [];
      
      for (const staff of vendorStaff) {
        // ✅ SQL: Get preferences and services
        const staffSettingsRepo = getStaffSettingsRepository();
        const preferences = await staffSettingsRepo.findByStaff(staff.id);
        const vendorServicesRepo = getVendorServicesRepository();
        const staffServices = await vendorServicesRepo.findByStaff(staff.id);
        
        // If service style filter is provided
        if (serviceStyle) {
          const stylePreferences = preferences?.style_preferences || preferences;
          const styleConfig = stylePreferences?.[serviceStyle];
          
          if (!styleConfig?.enabled) {
            continue;
          }
          
          // For home services, check distance
          if (serviceStyle === 'at_home' && customerLat && customerLng) {
            const staffLat = staff.last_known_location?.latitude || staff.lastKnownLocation?.latitude || vendor.location?.latitude;
            const staffLng = staff.last_known_location?.longitude || staff.lastKnownLocation?.longitude || vendor.location?.longitude;
            
            if (staffLat && staffLng) {
              const distance = calculateDistance(customerLat, customerLng, staffLat, staffLng);
              const staffMaxDistance = styleConfig?.maxDistance || 10;
              
              if (distance > staffMaxDistance) {
                continue;
              }
              
              staff.distance = distance;
            }
          }
        }
        
        const activeServices = staffServices.filter((s: any) => (s.is_active !== false && s.isActive !== false));
        
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
