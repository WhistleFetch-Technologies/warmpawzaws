import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🔍 UNIFIED SERVICE DISCOVERY
 * 
 * Phase 7C: Integrated Services - Rule 6 Implementation
 * 
 * Features:
 * - Discover ambulance, medicine, diagnostics services
 * - Location-based search
 * - Unified search across all integrated services
 * - Real-time availability checking
 */

interface ServiceDiscovery {
  serviceId: string;
  serviceType: 'ambulance' | 'medicine' | 'diagnostics';
  vendorId: string;
  vendorName: string;
  location: { lat: number; lng: number; address: string };
  distance: number;
  isAvailable: boolean;
  estimatedResponseTime: number;
  rating: number;
  services: string[];
}

export function unifiedServiceDiscoveryEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // Helper: Calculate distance
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  // Helper: Estimate response time
  function estimateResponseTime(distance: number, serviceType: string): number {
    // Ambulance: 60 km/h, Medicine: 30 km/h, Diagnostics: 40 km/h
    const speeds: Record<string, number> = {
      ambulance: 60,
      medicine: 30,
      diagnostics: 40,
    };
    
    const speed = speeds[serviceType] || 30;
    const timeInHours = distance / speed;
    return Math.ceil(timeInHours * 60); // Minutes
  }

  // ========================================
  // DISCOVER INTEGRATED SERVICES
  // ========================================
  app.get(`${BASE_PATH}/integrated-services/discover`, async (c) => {
    try {
      const type = c.req.query('type'); // ambulance | medicine | diagnostics | all

      if (!type) {
        return sendError(c, 'Service type is required', 400);
      }

      const validTypes = ['ambulance', 'medicine', 'diagnostics', 'all'];
      if (!validTypes.includes(type)) {
        return sendError(c, `Invalid type. Must be one of: ${validTypes.join(', ')}`, 400);
      }

      // Get all independent vendors
      const vendorsData = await kv.getByPrefix('independent_vendor_');
      
      let vendors = vendorsData
        .map((item: any) => item.value || item)
        .filter((v: any) => v.isApproved && v.isActive);

      // Filter by type if not 'all'
      if (type !== 'all') {
        const typeMapping: Record<string, string> = {
          ambulance: 'ambulance',
          medicine: 'pharmacy',
          diagnostics: 'diagnostics',
        };
        
        const vendorType = typeMapping[type];
        vendors = vendors.filter((v: any) => v.vendorType === vendorType);
      }

      // Transform to ServiceDiscovery format
      const services = vendors.map((vendor: any) => ({
        serviceId: `service_${vendor.vendorId}`,
        serviceType: vendor.vendorType === 'pharmacy' ? 'medicine' : vendor.vendorType,
        vendorId: vendor.vendorId,
        vendorName: vendor.vendorName,
        location: vendor.location,
        distance: 0, // Will be calculated with user location
        isAvailable: vendor.isActive,
        estimatedResponseTime: 0,
        rating: vendor.rating || 0,
        services: vendor.services || [],
      }));

      return sendSuccess(c, { services, count: services.length });
    } catch (error) {
      console.error('Error discovering services:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET NEARBY INTEGRATED SERVICES
  // ========================================
  app.get(`${BASE_PATH}/integrated-services/nearby`, async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const type = c.req.query('type'); // ambulance | medicine | diagnostics
      const radius = parseFloat(c.req.query('radius') || '10'); // km

      if (!lat || !lng) {
        return sendError(c, 'lat and lng are required', 400);
      }

      // Get all independent vendors
      const vendorsData = await kv.getByPrefix('independent_vendor_');
      
      let vendors = vendorsData
        .map((item: any) => item.value || item)
        .filter((v: any) => v.isApproved && v.isActive);

      // Filter by type if specified
      if (type) {
        const typeMapping: Record<string, string> = {
          ambulance: 'ambulance',
          medicine: 'pharmacy',
          diagnostics: 'diagnostics',
        };
        
        const vendorType = typeMapping[type];
        if (vendorType) {
          vendors = vendors.filter((v: any) => v.vendorType === vendorType);
        }
      }

      // Calculate distances and filter by radius
      const nearbyServices: ServiceDiscovery[] = [];

      for (const vendor of vendors) {
        if (!vendor.location || !vendor.location.lat || !vendor.location.lng) {
          continue;
        }

        const distance = calculateDistance(lat, lng, vendor.location.lat, vendor.location.lng);

        if (distance <= radius) {
          const serviceType = vendor.vendorType === 'pharmacy' ? 'medicine' : vendor.vendorType;
          const responseTime = estimateResponseTime(distance, serviceType);

          nearbyServices.push({
            serviceId: `service_${vendor.vendorId}`,
            serviceType,
            vendorId: vendor.vendorId,
            vendorName: vendor.vendorName,
            location: vendor.location,
            distance,
            isAvailable: vendor.isActive,
            estimatedResponseTime: responseTime,
            rating: vendor.rating || 0,
            services: vendor.services || [],
          });
        }
      }

      // Sort by distance
      nearbyServices.sort((a, b) => a.distance - b.distance);

      console.log(`✅ Found ${nearbyServices.length} nearby services within ${radius}km`);

      return sendSuccess(c, { services: nearbyServices, count: nearbyServices.length });
    } catch (error) {
      console.error('Error finding nearby services:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // SEARCH INTEGRATED SERVICES
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/search`, async (c) => {
    try {
      const {
        query,
        serviceType,
        location,
        radius,
        filters,
      } = await c.req.json();

      // Get all independent vendors
      const vendorsData = await kv.getByPrefix('independent_vendor_');
      
      let vendors = vendorsData
        .map((item: any) => item.value || item)
        .filter((v: any) => v.isApproved && v.isActive);

      // Filter by service type
      if (serviceType) {
        const typeMapping: Record<string, string> = {
          ambulance: 'ambulance',
          medicine: 'pharmacy',
          diagnostics: 'diagnostics',
        };
        
        const vendorType = typeMapping[serviceType];
        if (vendorType) {
          vendors = vendors.filter((v: any) => v.vendorType === vendorType);
        }
      }

      // Text search
      if (query) {
        const lowerQuery = query.toLowerCase();
        vendors = vendors.filter((v: any) => 
          v.vendorName.toLowerCase().includes(lowerQuery) ||
          v.location?.address?.toLowerCase().includes(lowerQuery) ||
          v.services?.some((s: string) => s.toLowerCase().includes(lowerQuery))
        );
      }

      // Location-based filtering
      let results: ServiceDiscovery[] = [];

      if (location && location.lat && location.lng) {
        const searchRadius = radius || 10;

        for (const vendor of vendors) {
          if (!vendor.location || !vendor.location.lat || !vendor.location.lng) {
            continue;
          }

          const distance = calculateDistance(
            location.lat,
            location.lng,
            vendor.location.lat,
            vendor.location.lng
          );

          if (distance <= searchRadius) {
            const vendorServiceType = vendor.vendorType === 'pharmacy' ? 'medicine' : vendor.vendorType;
            const responseTime = estimateResponseTime(distance, vendorServiceType);

            results.push({
              serviceId: `service_${vendor.vendorId}`,
              serviceType: vendorServiceType,
              vendorId: vendor.vendorId,
              vendorName: vendor.vendorName,
              location: vendor.location,
              distance,
              isAvailable: vendor.isActive,
              estimatedResponseTime: responseTime,
              rating: vendor.rating || 0,
              services: vendor.services || [],
            });
          }
        }

        // Sort by distance
        results.sort((a, b) => a.distance - b.distance);
      } else {
        // No location, just return matched vendors
        results = vendors.map((vendor: any) => ({
          serviceId: `service_${vendor.vendorId}`,
          serviceType: vendor.vendorType === 'pharmacy' ? 'medicine' : vendor.vendorType,
          vendorId: vendor.vendorId,
          vendorName: vendor.vendorName,
          location: vendor.location,
          distance: 0,
          isAvailable: vendor.isActive,
          estimatedResponseTime: 0,
          rating: vendor.rating || 0,
          services: vendor.services || [],
        }));
      }

      // Apply additional filters
      if (filters) {
        if (filters.minRating) {
          results = results.filter(r => r.rating >= filters.minRating);
        }
        if (filters.maxResponseTime) {
          results = results.filter(r => r.estimatedResponseTime <= filters.maxResponseTime);
        }
      }

      console.log(`✅ Search returned ${results.length} services`);

      return sendSuccess(c, { services: results, count: results.length });
    } catch (error) {
      console.error('Error searching services:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET SERVICE DETAILS
  // ========================================
  app.get(`${BASE_PATH}/integrated-services/service/:serviceId`, async (c) => {
    try {
      const serviceId = c.req.param('serviceId');

      // Extract vendor ID from service ID
      const vendorId = serviceId.replace('service_', '');

      const vendor = await kv.get(`independent_vendor_${vendorId}`);

      if (!vendor) {
        return sendError(c, 'Service not found', 404);
      }

      const serviceDetails = {
        serviceId,
        serviceType: vendor.vendorType === 'pharmacy' ? 'medicine' : vendor.vendorType,
        vendorId: vendor.vendorId,
        vendorName: vendor.vendorName,
        location: vendor.location,
        isAvailable: vendor.isActive && vendor.isApproved,
        services: vendor.services || [],
        operatingHours: vendor.operatingHours,
        contactInfo: vendor.contactInfo,
        rating: vendor.rating || 0,
        logisticsPartner: vendor.logisticsPartner,
      };

      return sendSuccess(c, { service: serviceDetails });
    } catch (error) {
      console.error('Error getting service details:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Unified Service Discovery endpoints registered');
}
