import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";

/**
 * 📍 RADAR & LOCATION SYSTEM
 * 
 * Phase 7C: Home Services Enhancement - Rule 2 Implementation
 * 
 * Features:
 * - Radar-based provider discovery
 * - Real-time commute time calculation
 * - Distance-based filtering
 * - Traffic-aware routing
 */

interface RadarProvider {
  providerId: string;
  providerName: string;
  location: { lat: number; lng: number; address: string };
  distance: number;
  commuteTime: number;
  isAvailable: boolean;
  services: string[];
  rating: number;
}

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { getVendorsRepository } from '../../../supabase/lib/repositories/index';

export function radarLocationSystemEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // HAVERSINE DISTANCE CALCULATION
  // ========================================
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimals
  }

  // ========================================
  // ESTIMATE COMMUTE TIME
  // ========================================
  function estimateCommuteTime(distance: number, trafficFactor: number = 1.0): number {
    // Base speed: 30 km/h in city traffic
    const baseSpeed = 30;
    const adjustedSpeed = baseSpeed / trafficFactor;
    const timeInHours = distance / adjustedSpeed;
    const timeInMinutes = Math.ceil(timeInHours * 60);
    
    return timeInMinutes;
  }

  // ========================================
  // RADAR PROVIDER DISCOVERY
  // ========================================
  app.get(`${BASE_PATH}/home-services/providers/radar`, async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const radius = parseFloat(c.req.query('radius') || '5'); // Default 5km
      const serviceType = c.req.query('serviceType');

      if (!lat || !lng) {
        return sendError(c, 'lat and lng are required', 400);
      }

      // ✅ SQL: Get all vendors/providers using repository
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAll({});
      
      const radarProviders: RadarProvider[] = [];

      for (const vendor of allVendors) {
        // Map vendor data to expected format
        const vendorData = {
          vendorId: vendor.id,
          vendorName: vendor.business_name,
          name: vendor.business_name,
          location: vendor.latitude && vendor.longitude ? {
            lat: vendor.latitude,
            lng: vendor.longitude,
            address: vendor.address
          } : null,
          services: [], // Should be queried from vendor_services
          isAvailable: vendor.is_active && vendor.status === 'approved',
          rating: vendor.rating || 0
        };
        
        // Skip if no location
        if (!vendorData.location || !vendorData.location.lat || !vendorData.location.lng) {
          continue;
        }

        // Calculate distance
        const distance = calculateDistance(lat, lng, vendorData.location.lat, vendorData.location.lng);

        // Filter by radius
        if (distance > radius) {
          continue;
        }

        // Filter by service type if specified (should query vendor_services for accurate check)
        // For now, skip service type filtering if not available in vendor data
        if (serviceType && vendorData.services.length === 0) {
          // Would need to query vendor_services table for accurate filtering
          // For now, include vendor if service type check passes
        }

        // Estimate commute time (with traffic factor 1.2 for peak hours)
        const trafficFactor = 1.2;
        const commuteTime = estimateCommuteTime(distance, trafficFactor);

        radarProviders.push({
          providerId: vendorData.vendorId,
          providerName: vendorData.vendorName || vendorData.name,
          location: vendorData.location,
          distance,
          commuteTime,
          isAvailable: vendorData.isAvailable,
          services: vendorData.services,
          rating: vendorData.rating,
        });
      }

      // Sort by distance (nearest first)
      radarProviders.sort((a, b) => a.distance - b.distance);

      console.log(`✅ Found ${radarProviders.length} providers within ${radius}km radius`);

      return sendSuccess(c, { 
        providers: radarProviders,
        count: radarProviders.length,
        searchRadius: radius,
        searchLocation: { lat, lng },
      });
    } catch (error) {
      console.error('Error in radar discovery:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // CALCULATE COMMUTE TIME
  // ========================================
  app.post(`${BASE_PATH}/home-services/calculate-commute-time`, async (c) => {
    try {
      const {
        fromLat,
        fromLng,
        toLat,
        toLng,
        providerId,
      } = await c.req.json();

      if (!fromLat || !fromLng || !toLat || !toLng) {
        return sendError(c, 'All coordinates are required', 400);
      }

      // Calculate distance
      const distance = calculateDistance(fromLat, fromLng, toLat, toLng);

      // Get traffic factor (could be enhanced with real traffic API)
      const currentHour = new Date().getHours();
      let trafficFactor = 1.0;

      // Peak hours traffic
      if ((currentHour >= 8 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 19)) {
        trafficFactor = 1.5; // 50% slower in peak traffic
      } else if (currentHour >= 22 || currentHour <= 6) {
        trafficFactor = 0.8; // 20% faster at night
      }

      const commuteTime = estimateCommuteTime(distance, trafficFactor);

      // ✅ SQL: Get provider's scheduling policy from vendor_settings or staff_availability
      let bufferTime = 0;
      if (providerId) {
        const db = getDbClient();
        try {
          // Check vendor settings first
          const { data: vendorSettings } = await db
            .from('vendor_settings')
            .select('scheduling_policy')
            .eq('vendor_id', providerId)
            .single();
          
          if (vendorSettings?.scheduling_policy?.commuteTimeAllowance) {
            bufferTime = vendorSettings.scheduling_policy.commuteTimeAllowance;
          }
        } catch (error) {
          // Policy not found, use default
          console.warn('Scheduling policy not found for provider:', providerId);
        }
      }

      const totalTime = commuteTime + bufferTime;

      console.log(`✅ Commute time calculated: ${commuteTime} min (distance: ${distance}km, traffic: ${trafficFactor}x)`);

      return sendSuccess(c, {
        distance,
        commuteTime,
        bufferTime,
        totalTime,
        trafficFactor,
        estimatedArrival: new Date(Date.now() + totalTime * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error('Error calculating commute time:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // GET NEARBY PROVIDERS
  // ========================================
  app.get(`${BASE_PATH}/home-services/providers/nearby`, async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const limit = parseInt(c.req.query('limit') || '10');

      if (!lat || !lng) {
        return sendError(c, 'lat and lng are required', 400);
      }

      // ✅ SQL: Get all vendors using repository
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAll({});
      
      const nearbyProviders: RadarProvider[] = [];

      for (const vendor of allVendors) {
        const vendorLocation = vendor.latitude && vendor.longitude ? {
          lat: vendor.latitude,
          lng: vendor.longitude,
          address: vendor.address
        } : null;
        
        if (!vendorLocation) {
          continue;
        }

        const distance = calculateDistance(lat, lng, vendorLocation.lat, vendorLocation.lng);
        const commuteTime = estimateCommuteTime(distance, 1.2);

        nearbyProviders.push({
          providerId: vendor.id,
          providerName: vendor.business_name,
          location: vendorLocation,
          distance,
          commuteTime,
          isAvailable: vendor.is_active && vendor.status === 'approved',
          services: [], // Should be queried from vendor_services
          rating: vendor.rating || 0,
        });
      }

      // Sort by distance and limit
      nearbyProviders.sort((a, b) => a.distance - b.distance);
      const limitedProviders = nearbyProviders.slice(0, limit);

      return sendSuccess(c, { 
        providers: limitedProviders,
        count: limitedProviders.length,
        totalFound: nearbyProviders.length,
      });
    } catch (error) {
      console.error('Error getting nearby providers:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Radar & Location System endpoints registered');
}
