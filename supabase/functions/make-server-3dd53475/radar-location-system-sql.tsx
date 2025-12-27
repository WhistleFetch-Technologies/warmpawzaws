/**
 * ============================================================================
 * RADAR & LOCATION SYSTEM - SQL VERSION
 * ============================================================================
 * 
 * Phase 7C: Home Services Enhancement - Rule 2 Implementation
 * 
 * Features:
 * - Radar-based provider discovery
 * - Real-time commute time calculation
 * - Distance-based filtering
 * - Traffic-aware routing
 * 
 * Replaces: vendor_* KV keys and scheduling_policy_{providerId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getSchedulingRepository } from "../../lib/repositories/index.ts";

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

      // ✅ SQL: Get all vendors/providers
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAllActive();
      
      const radarProviders: RadarProvider[] = [];

      for (const vendor of allVendors) {
        // Skip if no location
        const location = vendor.location as any;
        if (!location || !location.coordinates || !location.coordinates.lat || !location.coordinates.lng) {
          continue;
        }

        // Calculate distance
        const distance = calculateDistance(lat, lng, location.coordinates.lat, location.coordinates.lng);

        // Filter by radius
        if (distance > radius) {
          continue;
        }

        // Filter by service type if specified
        if (serviceType) {
          const vendorServices = vendor.services as any[] || [];
          if (!vendorServices.includes(serviceType)) {
            continue;
          }
        }

        // Estimate commute time (with traffic factor 1.2 for peak hours)
        const trafficFactor = 1.2;
        const commuteTime = estimateCommuteTime(distance, trafficFactor);

        radarProviders.push({
          providerId: vendor.id,
          providerName: vendor.business_name || vendor.name || '',
          location: {
            lat: location.coordinates.lat,
            lng: location.coordinates.lng,
            address: location.address || vendor.address || ''
          },
          distance,
          commuteTime,
          isAvailable: vendor.is_active !== false, // Default to available
          services: (vendor.services as any[]) || [],
          rating: (vendor.rating as number) || 0,
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

      // ✅ SQL: Get provider's scheduling policy if exists
      let bufferTime = 0;
      if (providerId) {
        const schedulingRepo = getSchedulingRepository();
        const policy = await schedulingRepo.getPolicy('commute_time');
        if (policy && policy.commuteTimeAllowance) {
          bufferTime = policy.commuteTimeAllowance;
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

      // ✅ SQL: Get all vendors
      const vendorsRepo = getVendorsRepository();
      const allVendors = await vendorsRepo.findAllActive();
      
      const nearbyProviders: RadarProvider[] = [];

      for (const vendor of allVendors) {
        const location = vendor.location as any;
        if (!location || !location.coordinates || !location.coordinates.lat || !location.coordinates.lng) {
          continue;
        }

        const distance = calculateDistance(lat, lng, location.coordinates.lat, location.coordinates.lng);
        const commuteTime = estimateCommuteTime(distance, 1.2);

        nearbyProviders.push({
          providerId: vendor.id,
          providerName: vendor.business_name || vendor.name || '',
          location: {
            lat: location.coordinates.lat,
            lng: location.coordinates.lng,
            address: location.address || vendor.address || ''
          },
          distance,
          commuteTime,
          isAvailable: vendor.is_active !== false,
          services: (vendor.services as any[]) || [],
          rating: (vendor.rating as number) || 0,
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
