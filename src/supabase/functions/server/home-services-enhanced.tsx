/**
 * 🏠 HOME SERVICES ENHANCEMENTS - COMPLETE IMPLEMENTATION
 * Rule 2: Home Services Booking with Enhanced Features
 * 
 * Features:
 * - Previous providers tracking & carousel
 * - Radar map view with geospatial queries
 * - Multi-service scheduling with buffer time
 * - Commute time calculation
 * - Service radius configuration
 * - Package time windows (morning/afternoon/evening)
 * - Coverage area management
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// ==========================================
// DISTANCE CALCULATION UTILITIES
// ==========================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ==========================================
// PREVIOUS PROVIDERS SYSTEM
// ==========================================

/**
 * GET /home-services/providers/previous - Get previously used providers
 */
app.get('/home-services/providers/previous', async (c) => {
  try {
    const { customerId, limit = 10 } = c.req.query();
    
    if (!customerId) {
      return c.json({ success: false, error: 'customerId is required' }, 400);
    }
    
    // Get customer's booking history for home services
    const allBookings = await kv.getByPrefix('booking_') || [];
    const customerBookings = allBookings.filter((b: any) => 
      b.customerId === customerId &&
      b.serviceLocation === 'home' &&
      b.status === 'completed'
    );
    
    // Group by provider and calculate stats
    const providerStats: Record<string, any> = {};
    
    for (const booking of customerBookings) {
      const providerId = booking.vendorId || booking.staffId;
      if (!providerId) continue;
      
      if (!providerStats[providerId]) {
        providerStats[providerId] = {
          providerId,
          providerType: booking.vendorId ? 'vendor' : 'staff',
          providerName: booking.vendorName || booking.staffName,
          usageCount: 0,
          totalSpent: 0,
          lastUsed: booking.completedAt || booking.createdAt,
          services: new Set(),
          avgRating: 0,
          ratings: []
        };
      }
      
      const stats = providerStats[providerId];
      stats.usageCount++;
      stats.totalSpent += booking.totalAmount || booking.amount || 0;
      
      if (booking.completedAt > stats.lastUsed) {
        stats.lastUsed = booking.completedAt;
      }
      
      if (booking.serviceName) {
        stats.services.add(booking.serviceName);
      }
      
      if (booking.rating) {
        stats.ratings.push(booking.rating);
      }
    }
    
    // Calculate average ratings
    const providers = Object.values(providerStats).map((stats: any) => {
      const servicesArray = Array.from(stats.services);
      const avgRating = stats.ratings.length > 0
        ? stats.ratings.reduce((sum: number, r: number) => sum + r, 0) / stats.ratings.length
        : 0;
      
      return {
        providerId: stats.providerId,
        providerType: stats.providerType,
        providerName: stats.providerName,
        usageCount: stats.usageCount,
        totalSpent: stats.totalSpent,
        lastUsed: stats.lastUsed,
        services: servicesArray,
        avgRating: avgRating.toFixed(1)
      };
    });
    
    // Sort by usage count (most used first)
    providers.sort((a, b) => b.usageCount - a.usageCount);
    
    // Limit results
    const limitedProviders = providers.slice(0, parseInt(limit as string));
    
    return c.json({
      success: true,
      providers: limitedProviders,
      total: providers.length
    });
  } catch (error) {
    console.error('Failed to get previous providers:', error);
    return c.json({ success: false, error: 'Failed to get previous providers' }, 500);
  }
});

// ==========================================
// RADAR LOCATION SYSTEM
// ==========================================

/**
 * GET /home-services/providers/radar - Get providers in radar view
 */
app.get('/home-services/providers/radar', async (c) => {
  try {
    const { lat, lng, radius = 10, serviceType } = c.req.query();
    
    if (!lat || !lng) {
      return c.json({ success: false, error: 'lat and lng are required' }, 400);
    }
    
    const customerLat = parseFloat(lat as string);
    const customerLng = parseFloat(lng as string);
    const searchRadius = parseFloat(radius as string);
    
    // Get all vendors/staff with home service capability
    const allVendors = await kv.getByPrefix('vendor_') || [];
    const allStaff = await kv.getByPrefix('staff_') || [];
    
    const providers: any[] = [];
    
    // Process vendors
    for (const vendor of allVendors) {
      if (!vendor.location?.lat || !vendor.location?.lng) continue;
      if (!vendor.homeServiceEnabled) continue;
      if (serviceType && vendor.serviceType !== serviceType) continue;
      
      const distance = calculateDistance(
        customerLat,
        customerLng,
        vendor.location.lat,
        vendor.location.lng
      );
      
      // Get vendor's service radius
      const vendorRadius = await kv.get(`service_radius_${vendor.vendorId}`);
      const maxServiceRadius = vendorRadius?.radius || 10; // Default 10km
      
      // Check if within both search radius and vendor's service radius
      if (distance <= searchRadius && distance <= maxServiceRadius) {
        providers.push({
          id: vendor.vendorId,
          type: 'vendor',
          name: vendor.businessName,
          serviceType: vendor.serviceType,
          services: vendor.services || [],
          location: vendor.location,
          distance: distance.toFixed(2),
          rating: vendor.rating || 0,
          reviewCount: vendor.reviewCount || 0,
          serviceRadius: maxServiceRadius,
          available: vendor.isActive && vendor.acceptingBookings
        });
      }
    }
    
    // Process staff
    for (const staff of allStaff) {
      const vendor = allVendors.find((v: any) => v.vendorId === staff.vendorId);
      if (!vendor?.location?.lat || !vendor?.location?.lng) continue;
      if (!staff.homeServiceEnabled) continue;
      if (serviceType && !staff.services?.includes(serviceType)) continue;
      
      const distance = calculateDistance(
        customerLat,
        customerLng,
        vendor.location.lat,
        vendor.location.lng
      );
      
      const staffRadius = await kv.get(`service_radius_${staff.staffId}`);
      const maxServiceRadius = staffRadius?.radius || 10;
      
      if (distance <= searchRadius && distance <= maxServiceRadius) {
        providers.push({
          id: staff.staffId,
          type: 'staff',
          name: staff.name,
          vendorId: staff.vendorId,
          vendorName: vendor.businessName,
          specialization: staff.specialization,
          services: staff.services || [],
          location: vendor.location,
          distance: distance.toFixed(2),
          rating: staff.rating || 0,
          reviewCount: staff.reviewCount || 0,
          serviceRadius: maxServiceRadius,
          available: staff.isActive && staff.availability !== 'unavailable'
        });
      }
    }
    
    // Sort by distance
    providers.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    
    return c.json({
      success: true,
      providers,
      searchCenter: { lat: customerLat, lng: customerLng },
      searchRadius,
      count: providers.length
    });
  } catch (error) {
    console.error('Failed to get radar providers:', error);
    return c.json({ success: false, error: 'Failed to get radar providers' }, 500);
  }
});

/**
 * GET /home-services/providers/nearby - Get nearby providers (simplified)
 */
app.get('/home-services/providers/nearby', async (c) => {
  try {
    const { lat, lng, limit = 20 } = c.req.query();
    
    if (!lat || !lng) {
      return c.json({ success: false, error: 'lat and lng are required' }, 400);
    }
    
    const customerLat = parseFloat(lat as string);
    const customerLng = parseFloat(lng as string);
    
    const allVendors = await kv.getByPrefix('vendor_') || [];
    const providers: any[] = [];
    
    for (const vendor of allVendors) {
      if (!vendor.location?.lat || !vendor.location?.lng) continue;
      if (!vendor.homeServiceEnabled) continue;
      
      const distance = calculateDistance(
        customerLat,
        customerLng,
        vendor.location.lat,
        vendor.location.lng
      );
      
      providers.push({
        ...vendor,
        distance: distance.toFixed(2)
      });
    }
    
    providers.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
    
    return c.json({
      success: true,
      providers: providers.slice(0, parseInt(limit as string))
    });
  } catch (error) {
    console.error('Failed to get nearby providers:', error);
    return c.json({ success: false, error: 'Failed to get nearby providers' }, 500);
  }
});

// ==========================================
// COMMUTE TIME CALCULATION
// ==========================================

/**
 * POST /home-services/calculate-commute-time - Calculate commute time
 */
app.post('/home-services/calculate-commute-time', async (c) => {
  try {
    const { providerId, customerLat, customerLng, departureTime } = await c.req.json();
    
    if (!providerId || !customerLat || !customerLng) {
      return c.json({ 
        success: false, 
        error: 'providerId, customerLat, and customerLng are required' 
      }, 400);
    }
    
    // Get provider location
    let providerLocation: any = null;
    
    const vendor = await kv.get(`vendor_${providerId}`);
    if (vendor?.location) {
      providerLocation = vendor.location;
    } else {
      const staff = await kv.get(`staff_${providerId}`);
      if (staff?.vendorId) {
        const staffVendor = await kv.get(`vendor_${staff.vendorId}`);
        if (staffVendor?.location) {
          providerLocation = staffVendor.location;
        }
      }
    }
    
    if (!providerLocation) {
      return c.json({ success: false, error: 'Provider location not found' }, 404);
    }
    
    // Calculate straight-line distance
    const distance = calculateDistance(
      providerLocation.lat,
      providerLocation.lng,
      customerLat,
      customerLng
    );
    
    // Estimate commute time
    // In production, integrate with Google Maps Distance Matrix API
    // For now, use simple estimation: 20 km/h average speed in city
    const estimatedTime = (distance / 20) * 60; // minutes
    
    // Add buffer for traffic (30% during peak hours)
    const now = departureTime ? new Date(departureTime) : new Date();
    const hour = now.getHours();
    const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
    const trafficBuffer = isPeakHour ? 1.3 : 1.1;
    
    const commuteTime = Math.ceil(estimatedTime * trafficBuffer);
    
    return c.json({
      success: true,
      commute: {
        distance: distance.toFixed(2),
        estimatedTime: commuteTime,
        isPeakHour,
        trafficMultiplier: trafficBuffer,
        departureTime: now.toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to calculate commute time:', error);
    return c.json({ success: false, error: 'Failed to calculate commute time' }, 500);
  }
});

// ==========================================
// MULTI-SERVICE SCHEDULING
// ==========================================

/**
 * POST /home-services/check-multi-service-availability - Check availability for multiple services
 */
app.post('/home-services/check-multi-service-availability', async (c) => {
  try {
    const { providerId, services, date, customerLat, customerLng } = await c.req.json();
    
    if (!providerId || !services || !Array.isArray(services) || services.length === 0) {
      return c.json({ 
        success: false, 
        error: 'providerId and services array are required' 
      }, 400);
    }
    
    // Get provider's buffer time configuration
    const bufferConfig = await kv.get(`buffer_time_${providerId}`) || {
      betweenServices: 30, // 30 minutes default
      commuteBuffer: 15 // 15 minutes default
    };
    
    // Calculate total time needed
    let totalDuration = 0;
    const serviceDetails: any[] = [];
    
    for (const serviceId of services) {
      const service = await kv.get(`service_${serviceId}`);
      if (!service) continue;
      
      serviceDetails.push({
        serviceId,
        name: service.name,
        duration: service.duration || 60
      });
      
      totalDuration += service.duration || 60;
    }
    
    // Add buffer time between services
    if (services.length > 1) {
      totalDuration += bufferConfig.betweenServices * (services.length - 1);
    }
    
    // Add commute time
    if (customerLat && customerLng) {
      const commuteResult = await calculateCommuteTime(providerId, customerLat, customerLng);
      totalDuration += commuteResult.estimatedTime;
    }
    
    // Get provider's availability for the date
    const availability = await kv.get(`availability_${providerId}_${date}`);
    
    let availableWindows: any[] = [];
    if (availability?.slots) {
      availableWindows = availability.slots
        .filter((slot: any) => slot.available)
        .map((slot: any) => ({
          start: slot.start,
          end: slot.end,
          canFit: calculateSlotDuration(slot.start, slot.end) >= totalDuration
        }));
    }
    
    return c.json({
      success: true,
      availability: {
        providerId,
        services: serviceDetails,
        totalDuration,
        bufferTime: bufferConfig.betweenServices,
        commuteBuffer: bufferConfig.commuteBuffer,
        availableWindows,
        canBookAll: availableWindows.some(w => w.canFit)
      }
    });
  } catch (error) {
    console.error('Failed to check multi-service availability:', error);
    return c.json({ success: false, error: 'Failed to check availability' }, 500);
  }
});

function calculateSlotDuration(start: string, end: string): number {
  const startTime = new Date(`2000-01-01T${start}`);
  const endTime = new Date(`2000-01-01T${end}`);
  return (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutes
}

async function calculateCommuteTime(providerId: string, customerLat: number, customerLng: number): Promise<any> {
  const vendor = await kv.get(`vendor_${providerId}`);
  let providerLocation = vendor?.location;
  
  if (!providerLocation) {
    const staff = await kv.get(`staff_${providerId}`);
    if (staff?.vendorId) {
      const staffVendor = await kv.get(`vendor_${staff.vendorId}`);
      providerLocation = staffVendor?.location;
    }
  }
  
  if (!providerLocation) {
    return { estimatedTime: 30 }; // Default 30 minutes
  }
  
  const distance = calculateDistance(
    providerLocation.lat,
    providerLocation.lng,
    customerLat,
    customerLng
  );
  
  const estimatedTime = Math.ceil((distance / 20) * 60 * 1.2); // 20 km/h with 20% buffer
  return { estimatedTime, distance };
}

// ==========================================
// SERVICE RADIUS CONFIGURATION
// ==========================================

/**
 * PUT /vendor/:vendorId/service-radius - Configure service radius
 */
app.put('/vendor/:vendorId/service-radius', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const { radius, coverageAreas } = await c.req.json();
    
    if (!radius || radius < 0) {
      return c.json({ success: false, error: 'Valid radius is required' }, 400);
    }
    
    if (radius > 50) {
      return c.json({ success: false, error: 'Maximum service radius is 50 km' }, 400);
    }
    
    // Get vendor location
    const vendor = await kv.get(`vendor_${vendorId}`);
    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }
    
    if (!vendor.location) {
      return c.json({ success: false, error: 'Vendor location not set' }, 400);
    }
    
    const serviceRadius = {
      vendorId,
      radius,
      center: vendor.location,
      coverageAreas: coverageAreas || [],
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`service_radius_${vendorId}`, serviceRadius);
    
    return c.json({
      success: true,
      serviceRadius
    });
  } catch (error) {
    console.error('Failed to set service radius:', error);
    return c.json({ success: false, error: 'Failed to set service radius' }, 500);
  }
});

/**
 * GET /vendor/:vendorId/coverage-area - Get coverage area
 */
app.get('/vendor/:vendorId/coverage-area', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    
    const serviceRadius = await kv.get(`service_radius_${vendorId}`);
    
    if (!serviceRadius) {
      // Return default 10km radius
      const vendor = await kv.get(`vendor_${vendorId}`);
      if (!vendor?.location) {
        return c.json({ success: false, error: 'Vendor location not found' }, 404);
      }
      
      return c.json({
        success: true,
        coverage: {
          vendorId,
          radius: 10,
          center: vendor.location,
          coverageAreas: []
        }
      });
    }
    
    return c.json({
      success: true,
      coverage: serviceRadius
    });
  } catch (error) {
    console.error('Failed to get coverage area:', error);
    return c.json({ success: false, error: 'Failed to get coverage area' }, 500);
  }
});

// ==========================================
// PACKAGE TIME WINDOWS
// ==========================================

/**
 * GET /home-services/packages/:packageId/schedule-windows - Get package schedule windows
 */
app.get('/home-services/packages/:packageId/schedule-windows', async (c) => {
  try {
    const packageId = c.req.param('packageId');
    
    const packageData = await kv.get(`package_${packageId}`);
    if (!packageData) {
      return c.json({ success: false, error: 'Package not found' }, 404);
    }
    
    // Get or create schedule windows
    let windows = await kv.get(`package_windows_${packageId}`);
    
    if (!windows) {
      // Create default windows
      windows = {
        packageId,
        windows: {
          morning: { start: '08:00', end: '12:00', label: 'Morning (8 AM - 12 PM)' },
          afternoon: { start: '12:00', end: '16:00', label: 'Afternoon (12 PM - 4 PM)' },
          evening: { start: '16:00', end: '20:00', label: 'Evening (4 PM - 8 PM)' }
        },
        createdAt: new Date().toISOString()
      };
      await kv.set(`package_windows_${packageId}`, windows);
    }
    
    return c.json({
      success: true,
      windows
    });
  } catch (error) {
    console.error('Failed to get package windows:', error);
    return c.json({ success: false, error: 'Failed to get package windows' }, 500);
  }
});

/**
 * POST /home-services/buffer-time/configure - Configure buffer time
 */
app.post('/home-services/buffer-time/configure', async (c) => {
  try {
    const { providerId, betweenServices, commuteBuffer } = await c.req.json();
    
    if (!providerId) {
      return c.json({ success: false, error: 'providerId is required' }, 400);
    }
    
    const bufferConfig = {
      providerId,
      betweenServices: betweenServices || 30,
      commuteBuffer: commuteBuffer || 15,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`buffer_time_${providerId}`, bufferConfig);
    
    return c.json({
      success: true,
      bufferConfig
    });
  } catch (error) {
    console.error('Failed to configure buffer time:', error);
    return c.json({ success: false, error: 'Failed to configure buffer time' }, 500);
  }
});

/**
 * POST /home-services/providers/match - Match providers based on criteria
 */
app.post('/home-services/providers/match', async (c) => {
  try {
    const { services, location, timeWindow, date } = await c.req.json();
    
    if (!services || !location) {
      return c.json({ success: false, error: 'services and location are required' }, 400);
    }
    
    // Get providers in radar range
    const radarProviders = await getRadarProviders(location.lat, location.lng, 15);
    
    // Filter by services
    const matchedProviders = radarProviders.filter((p: any) => 
      services.every((s: string) => p.services?.includes(s))
    );
    
    // Check availability if date provided
    let availableProviders = matchedProviders;
    if (date) {
      availableProviders = [];
      for (const provider of matchedProviders) {
        const availability = await kv.get(`availability_${provider.id}_${date}`);
        if (availability && hasAvailableSlot(availability, timeWindow)) {
          availableProviders.push(provider);
        }
      }
    }
    
    return c.json({
      success: true,
      providers: availableProviders,
      total: availableProviders.length
    });
  } catch (error) {
    console.error('Failed to match providers:', error);
    return c.json({ success: false, error: 'Failed to match providers' }, 500);
  }
});

async function getRadarProviders(lat: number, lng: number, radius: number): Promise<any[]> {
  const allVendors = await kv.getByPrefix('vendor_') || [];
  const providers: any[] = [];
  
  for (const vendor of allVendors) {
    if (!vendor.location?.lat || !vendor.location?.lng) continue;
    if (!vendor.homeServiceEnabled) continue;
    
    const distance = calculateDistance(lat, lng, vendor.location.lat, vendor.location.lng);
    if (distance <= radius) {
      providers.push({
        id: vendor.vendorId,
        name: vendor.businessName,
        services: vendor.services || [],
        distance
      });
    }
  }
  
  return providers;
}

function hasAvailableSlot(availability: any, timeWindow?: string): boolean {
  if (!timeWindow) return true;
  
  const slots = availability.slots || [];
  return slots.some((slot: any) => 
    slot.available && 
    (timeWindow === 'morning' || timeWindow === 'afternoon' || timeWindow === 'evening')
  );
}

export default app;
