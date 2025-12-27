/**
 * ============================================================================
 * UNIFIED SERVICE DISCOVERY - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Phase 7C: Integrated Services - Rule 6 Implementation
 * 
 * Features:
 * - Discover ambulance, medicine, diagnostics services
 * - Location-based search
 * - Unified search across all integrated services
 * - Real-time availability checking
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced `kv.getByPrefix('independent_vendor_')` with SQL queries
 * - Uses `VendorsRepository` with `is_independent` flag
 * - Uses `vendors` table for independent vendor data
 * 
 * Date: 2025-01-28
 * Migration: Batch 10 Phase 2 - KV to SQL (4 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const vendorsRepo = getVendorsRepository();

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

export function unifiedServiceDiscoveryEndpoints(app: Hono) {
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

      // ✅ SQL: Get all independent vendors
      const { data: vendorsData, error } = await db
        .from('vendors')
        .select('*')
        .eq('is_independent', true)
        .eq('status', 'approved')
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching independent vendors:', error);
        return sendError(c, 'Failed to fetch vendors', 500);
      }
      
      let vendors = vendorsData || [];

      // Filter by type if not 'all'
      if (type !== 'all') {
        const typeMapping: Record<string, string> = {
          ambulance: 'ambulance',
          medicine: 'pharmacy',
          diagnostics: 'diagnostics',
        };
        
        const vendorType = typeMapping[type];
        if (vendorType) {
          vendors = vendors.filter((v: any) => v.role_id === vendorType || v.category === vendorType);
        }
      }

      // Transform to ServiceDiscovery format
      const services = vendors.map((vendor: any) => ({
        serviceId: `service_${vendor.id}`,
        serviceType: vendor.role_id === 'pharmacy' ? 'medicine' : (vendor.role_id || vendor.category || 'ambulance'),
        vendorId: vendor.id,
        vendorName: vendor.business_name || vendor.owner_name,
        location: {
          lat: parseFloat(vendor.latitude) || 0,
          lng: parseFloat(vendor.longitude) || 0,
          address: vendor.address || ''
        },
        distance: 0, // Will be calculated with user location
        isAvailable: vendor.is_active,
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

      // ✅ SQL: Get all independent vendors
      const { data: vendorsData, error } = await db
        .from('vendors')
        .select('*')
        .eq('is_independent', true)
        .eq('status', 'approved')
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching independent vendors:', error);
        return sendError(c, 'Failed to fetch vendors', 500);
      }
      
      let vendors = vendorsData || [];

      // Filter by type if specified
      if (type) {
        const typeMapping: Record<string, string> = {
          ambulance: 'ambulance',
          medicine: 'pharmacy',
          diagnostics: 'diagnostics',
        };
        
        const vendorType = typeMapping[type];
        if (vendorType) {
          vendors = vendors.filter((v: any) => v.role_id === vendorType || v.category === vendorType);
        }
      }

      // Calculate distances and filter by radius
      const nearbyServices: ServiceDiscovery[] = [];

      for (const vendor of vendors) {
        if (!vendor.latitude || !vendor.longitude) {
          continue;
        }

        const vendorLat = parseFloat(vendor.latitude);
        const vendorLng = parseFloat(vendor.longitude);
        
        if (!vendorLat || !vendorLng) continue;

        const distance = calculateDistance(lat, lng, vendorLat, vendorLng);

        if (distance <= radius) {
          const serviceType = vendor.role_id === 'pharmacy' ? 'medicine' : (vendor.role_id || vendor.category || 'ambulance');
          const responseTime = estimateResponseTime(distance, serviceType);

          nearbyServices.push({
            serviceId: `service_${vendor.id}`,
            serviceType: serviceType as 'ambulance' | 'medicine' | 'diagnostics',
            vendorId: vendor.id,
            vendorName: vendor.business_name || vendor.owner_name,
            location: {
              lat: vendorLat,
              lng: vendorLng,
              address: vendor.address || ''
            },
            distance,
            isAvailable: vendor.is_active,
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

      // ✅ SQL: Get all independent vendors
      const { data: vendorsData, error } = await db
        .from('vendors')
        .select('*')
        .eq('is_independent', true)
        .eq('status', 'approved')
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching independent vendors:', error);
        return sendError(c, 'Failed to fetch vendors', 500);
      }
      
      let vendors = vendorsData || [];

      // Filter by service type
      if (serviceType) {
        const typeMapping: Record<string, string> = {
          ambulance: 'ambulance',
          medicine: 'pharmacy',
          diagnostics: 'diagnostics',
        };
        
        const vendorType = typeMapping[serviceType];
        if (vendorType) {
          vendors = vendors.filter((v: any) => v.role_id === vendorType || v.category === vendorType);
        }
      }

      // Text search
      if (query) {
        const lowerQuery = query.toLowerCase();
        vendors = vendors.filter((v: any) => 
          (v.business_name || v.owner_name || '').toLowerCase().includes(lowerQuery) ||
          (v.address || '').toLowerCase().includes(lowerQuery) ||
          (v.services || []).some((s: string) => s.toLowerCase().includes(lowerQuery))
        );
      }

      // Location-based filtering
      let results: ServiceDiscovery[] = [];

      if (location && location.lat && location.lng) {
        const searchRadius = radius || 10;

        for (const vendor of vendors) {
          if (!vendor.latitude || !vendor.longitude) {
            continue;
          }

          const vendorLat = parseFloat(vendor.latitude);
          const vendorLng = parseFloat(vendor.longitude);
          
          if (!vendorLat || !vendorLng) continue;

          const distance = calculateDistance(
            location.lat,
            location.lng,
            vendorLat,
            vendorLng
          );

          if (distance <= searchRadius) {
            const vendorServiceType = vendor.role_id === 'pharmacy' ? 'medicine' : (vendor.role_id || vendor.category || 'ambulance');
            const responseTime = estimateResponseTime(distance, vendorServiceType);

            results.push({
              serviceId: `service_${vendor.id}`,
              serviceType: vendorServiceType as 'ambulance' | 'medicine' | 'diagnostics',
              vendorId: vendor.id,
              vendorName: vendor.business_name || vendor.owner_name,
              location: {
                lat: vendorLat,
                lng: vendorLng,
                address: vendor.address || ''
              },
              distance,
              isAvailable: vendor.is_active,
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
          serviceId: `service_${vendor.id}`,
          serviceType: (vendor.role_id === 'pharmacy' ? 'medicine' : (vendor.role_id || vendor.category || 'ambulance')) as 'ambulance' | 'medicine' | 'diagnostics',
          vendorId: vendor.id,
          vendorName: vendor.business_name || vendor.owner_name,
          location: {
            lat: parseFloat(vendor.latitude) || 0,
            lng: parseFloat(vendor.longitude) || 0,
            address: vendor.address || ''
          },
          distance: 0,
          isAvailable: vendor.is_active,
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

      // ✅ SQL: Get vendor
      const vendor = await vendorsRepo.findById(vendorId);

      if (!vendor || !vendor.is_independent) {
        return sendError(c, 'Service not found', 404);
      }

      const serviceDetails = {
        serviceId,
        serviceType: vendor.role_id === 'pharmacy' ? 'medicine' : (vendor.role_id || vendor.category || 'ambulance'),
        vendorId: vendor.id,
        vendorName: vendor.business_name || vendor.owner_name,
        location: {
          lat: parseFloat(vendor.latitude) || 0,
          lng: parseFloat(vendor.longitude) || 0,
          address: vendor.address || ''
        },
        isAvailable: vendor.is_active && vendor.status === 'approved',
        services: vendor.services || [],
        operatingHours: vendor.operating_hours,
        contactInfo: {
          phone: vendor.phone,
          email: vendor.email
        },
        rating: vendor.rating || 0,
        logisticsPartner: vendor.logistics_partner,
      };

      return sendSuccess(c, { service: serviceDetails });
    } catch (error) {
      console.error('Error getting service details:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Unified Service Discovery endpoints (SQL-only) registered');
}
