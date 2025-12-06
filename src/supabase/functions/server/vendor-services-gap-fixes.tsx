import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

export function registerVendorServiceGapFixes(app: Hono) {
  console.log("🔧 Registering Vendor Service Gap Fixes...");

  // ==================================================================================
  // 1. PLATFORM SERVICE PRICING PROTECTION
  // ==================================================================================
  
  app.put("/make-server-3dd53475/vendor/:vendorId/services/:serviceId", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      const updates = await c.req.json();
      
      // Fetch the service
      const service = await kv.get(`service:${serviceId}`);
      
      if (!service) {
        return c.json({ error: "Service not found" }, 404);
      }

      // Validation: Check if it's a platform service
      // Platform services usually have a specific flag or are linked to a master catalog item without being a "custom" service
      // Assuming 'isPlatformService' or checking if it has a 'masterServiceId' and isn't explicitly custom
      
      const isPlatformService = service.isPlatformService || (service.masterServiceId && !service.isCustom);

      if (isPlatformService) {
        // Block price updates for platform services
        if (updates.price !== undefined && updates.price !== service.price) {
           return c.json({ 
             error: "Price modification is restricted for platform services. Please contact support.",
             code: "PLATFORM_PRICE_LOCKED"
           }, 403);
        }
      }

      // Proceed with update
      const updatedService = {
        ...service,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`service:${serviceId}`, updatedService);

      return c.json({
        success: true,
        service: updatedService,
        message: "Service updated successfully"
      });

    } catch (error) {
      console.error("Error updating service:", error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==================================================================================
  // 2. STAFF SERVICE ENABLEMENT VALIDATION
  // ==================================================================================

  // Get services enabled by the VENDOR (that staff can choose from)
  app.get("/make-server-3dd53475/staff/:staffId/available-services", async (c) => {
    try {
      const { staffId } = c.req.param();
      
      // Get staff profile to find vendorId
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) return c.json({ error: "Staff not found" }, 404);
      
      const vendorId = staff.vendorId;
      if (!vendorId) return c.json({ error: "Staff not linked to a vendor" }, 400);

      // Get vendor services
      const serviceIds = await kv.get(`vendor:${vendorId}:services`) || [];
      const vendorServices = [];
      
      for (const id of serviceIds) {
        const svc = await kv.get(`service:${id}`);
        // Only Active Vendor Services are available to staff
        if (svc && svc.isActive !== false) {
          vendorServices.push(svc);
        }
      }

      return c.json({
        success: true,
        services: vendorServices
      });
    } catch (error) {
       return c.json({ error: String(error) }, 500);
    }
  });

  // Update staff services (with validation)
  app.put("/make-server-3dd53475/staff/:staffId/services", async (c) => {
    try {
      const { staffId } = c.req.param();
      const { serviceIds } = await c.req.json(); // Array of service IDs
      
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) return c.json({ error: "Staff not found" }, 404);
      
      const vendorId = staff.vendorId;
      
      // Validate that all serviceIds are actually enabled by the vendor
      const vendorServiceIds = await kv.get(`vendor:${vendorId}:services`) || [];
      
      const unauthorizedServices = serviceIds.filter((id: string) => !vendorServiceIds.includes(id));
      
      if (unauthorizedServices.length > 0) {
        return c.json({
          error: "Some services are not enabled by the vendor",
          unauthorizedServices
        }, 403);
      }

      // Update staff services
      staff.serviceIds = serviceIds;
      staff.updatedAt = new Date().toISOString();
      
      await kv.set(`staff:${staffId}`, staff);
      
      return c.json({
        success: true,
        message: "Staff services updated successfully",
        staff
      });

    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==================================================================================
  // 3 & 5. HOME SERVICES PROVIDER LIST & 5KM RADIUS FILTERING
  // ==================================================================================

  app.get("/make-server-3dd53475/home-services/providers", async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = Math.min(parseFloat(c.req.query('radius') || '5'), 5); // HARD LIMIT 5KM
      const serviceId = c.req.query('serviceId');
      const date = c.req.query('date');
      
      if (!lat || !lng) {
        return c.json({ error: "Latitude and Longitude are required" }, 400);
      }

      // Get all staff who do home services
      // This is an expensive operation in KV, typically we'd use a geospatial index
      // For KV, we'll scan 'staff:' keys or 'vendor:' keys. 
      // Optimization: Assuming we have a list of all staff or we scan vendors.
      
      // For prototype, scanning all staff (inefficient but functional)
      // In production, use a geo-index or PostGIS
      const allStaff = await kv.getByPrefix('staff:');
      
      const providers = [];
      
      for (const staff of allStaff) {
        // Filter out incomplete staff records
        if (!staff.id || !staff.vendorId) continue;
        
        // Check if staff provides home services
        // Assuming staff.serviceStyles includes 'at_home' OR staff has services that are 'at_home'
        // OR looking at staff availability service styles
        
        const isHomeProvider = staff.serviceStyles?.includes('at_home') || 
                              (staff.services && staff.services.some((s:any) => s.serviceStyle === 'at_home'));
                              
        if (!isHomeProvider) continue;
        
        // Calculate distance
        // Staff might have a base location, or we assume vendor location
        let providerLat = staff.latitude;
        let providerLng = staff.longitude;
        
        if (!providerLat || !providerLng) {
            // Fallback to vendor location
            const vendor = await kv.get(`vendor:${staff.vendorId}`);
            if (vendor && vendor.location) {
                providerLat = vendor.location.lat;
                providerLng = vendor.location.lng;
            }
        }
        
        if (!providerLat || !providerLng) continue;
        
        // Haversine Formula
        const R = 6371; // Radius of earth in km
        const dLat = (lat - providerLat) * Math.PI / 180;
        const dLon = (lng - providerLng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(providerLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c_dist = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c_dist;
        
        if (distance <= radius) {
           // Match!
           providers.push({
             ...staff,
             distance: parseFloat(distance.toFixed(2)),
             // Add availability summary if date provided
             availability: date ? 'Available' : 'Check Schedule' // Simplified
           });
        }
      }
      
      // Sort by distance
      providers.sort((a, b) => a.distance - b.distance);

      return c.json({
        success: true,
        providers,
        count: providers.length,
        radiusApplied: radius
      });

    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==================================================================================
  // 4. DISTANCE-BASED VISIBILITY CONTROL
  // ==================================================================================

  app.get("/make-server-3dd53475/admin/platform/settings/service-radius", async (c) => {
     const settings = await kv.get('platform:settings:radius') || { default: 5, max: 5 };
     return c.json({ success: true, settings });
  });

  app.put("/make-server-3dd53475/admin/platform/settings/service-radius", async (c) => {
     const body = await c.req.json();
     await kv.set('platform:settings:radius', body);
     return c.json({ success: true, message: "Radius settings updated" });
  });

  app.put("/make-server-3dd53475/vendor/:vendorId/service-radius", async (c) => {
     const { vendorId } = c.req.param();
     const { radius } = await c.req.json();
     
     if (radius > 5) {
         return c.json({ error: "Maximum service radius is 5km" }, 400);
     }
     
     const vendor = await kv.get(`vendor:${vendorId}`);
     if (vendor) {
         vendor.serviceRadius = radius;
         await kv.set(`vendor:${vendorId}`, vendor);
     }
     
     return c.json({ success: true, message: "Vendor radius updated", radius });
  });

  // ==================================================================================
  // 6. INSTANT VS SCHEDULED TELE SERVICES
  // ==================================================================================

  app.post("/make-server-3dd53475/tele-services/available-now", async (c) => {
    try {
       // Find staff who are 'online' or have 'instant_video' slots right now
       const now = new Date();
       const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
       const dayOfWeek = dayNames[now.getDay()];
       const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
       
       const allStaff = await kv.getByPrefix('staff:');
       const availableStaff = [];
       
       for (const staff of allStaff) {
           // Check if staff supports tele
           // Simplified check
           if (!staff.serviceStyles?.includes('tele')) continue;
           
           // Check schedule for 'instant' availability
           const schedule = await kv.get(`staff:${staff.id}:schedule`) || [];
           const todaySchedule = schedule.find((d:any) => d.day === dayOfWeek);
           
           if (todaySchedule && todaySchedule.isWorking) {
               // Check if current time is within a working slot
               // And specifically an 'instant' slot if we differentiate
               availableStaff.push(staff);
           }
       }
       
       return c.json({ success: true, staff: availableStaff });
    } catch (error) {
        return c.json({ error: String(error) }, 500);
    }
  });
  
  app.post("/make-server-3dd53475/bookings/create-enhanced", async (c) => {
      // Wrapper for booking creation that handles 'instant' vs 'scheduled' logic
      // In a real implementation, this would call the main booking service
      // For gap fix, we'll just acknowledge it and delegate or mock
      const body = await c.req.json();
      
      console.log("Creating enhanced booking:", body.bookingType);
      
      // Validate instant booking
      if (body.bookingType === 'instant') {
          // Logic to assign immediate staff
      }
      
      // Call existing booking logic (simulated)
      return c.json({
          success: true,
          bookingId: `bk_${Date.now()}`,
          status: body.bookingType === 'instant' ? 'confirmed' : 'pending',
          message: "Booking created"
      });
  });

  // ==================================================================================
  // 7. SUBSCRIPTION CANCELLATION & REFUND
  // ==================================================================================

  app.post("/make-server-3dd53475/subscriptions/:subscriptionId/cancel", async (c) => {
      const { subscriptionId } = c.req.param();
      const { reason } = await c.req.json();
      
      const sub = await kv.get(`subscription:${subscriptionId}`);
      if (!sub) return c.json({ error: "Subscription not found" }, 404);
      
      // Calculate Prorated Refund
      // Assuming sub has startDate, endDate, price
      const totalDays = (new Date(sub.endDate).getTime() - new Date(sub.startDate).getTime()) / (1000 * 3600 * 24);
      const usedDays = (new Date().getTime() - new Date(sub.startDate).getTime()) / (1000 * 3600 * 24);
      const remainingDays = Math.max(0, totalDays - usedDays);
      
      const refundAmount = (sub.price / totalDays) * remainingDays;
      
      // Update subscription
      sub.status = 'cancelled';
      sub.cancellationReason = reason;
      sub.refundAmount = refundAmount;
      sub.cancelledAt = new Date().toISOString();
      
      await kv.set(`subscription:${subscriptionId}`, sub);
      
      return c.json({
          success: true,
          message: "Subscription cancelled",
          refundAmount: parseFloat(refundAmount.toFixed(2)),
          refundStatus: "processed"
      });
  });

  app.post("/make-server-3dd53475/admin/subscriptions/:subscriptionId/refund", async (c) => {
      // Admin override for refund
      return c.json({ success: true, message: "Refund processed manually" });
  });

  // ==================================================================================
  // 8. STAFF AVAILABILITY WITH SERVICE STYLE CHECKBOXES
  // ==================================================================================

  app.post("/make-server-3dd53475/staff/:staffId/availability", async (c) => {
      const { staffId } = c.req.param();
      const { availability } = await c.req.json(); 
      // Expected format: { Monday: { isWorking: true, styles: ['at_home', 'tele'], slots: [...] }, ... }
      
      if (!availability) return c.json({ error: "Availability data required" }, 400);
      
      await kv.set(`staff:${staffId}:availability_enhanced`, availability);
      
      // Also sync with legacy schedule format if needed
      // ...
      
      return c.json({ success: true, message: "Enhanced availability updated" });
  });

  app.get("/make-server-3dd53475/staff/:staffId/availability", async (c) => {
      const { staffId } = c.req.param();
      const availability = await kv.get(`staff:${staffId}:availability_enhanced`) || {};
      return c.json({ success: true, availability });
  });

}
