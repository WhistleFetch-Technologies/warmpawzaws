/**
 * ============================================================================
 * INTEGRATED SERVICES MANAGER (ENTERPRISE GRADE) - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Phase 7C: Rule 7 Implementation
 * 
 * Aggregates Ambulance, Diagnostics, and Pharmacy services from:
 * 1. Clinics (attached to existing bookings)
 * 2. Independent Vendors (Standalone service providers)
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `VendorsRepository`, `BookingsRepository`, `findProvidersNearby` from geospatial-index-sql
 * - Uses `vendors`, `bookings`, `platform_settings` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 17 - KV to SQL (9 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { findProvidersNearby, updateProviderLocationIndex } from "./geospatial-index-sql.tsx";
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const vendorsRepo = getVendorsRepository();
const bookingsRepo = getBookingsRepository();

interface ServiceRequest {
  id: string;
  customerId: string;
  providerId: string;
  serviceType: 'ambulance' | 'diagnostic' | 'pharmacy';
  bookingId?: string;
  status: 'pending' | 'accepted' | 'en_route' | 'in_progress' | 'completed' | 'cancelled';
  location: { lat: number; lng: number; address: string };
  details: any;
  createdAt: string;
  updatedAt: string;
}

export function integratedServicesManagerEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // PROVIDER REGISTRATION (Independent)
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/register-provider`, async (c) => {
    try {
      const { 
        providerId, 
        name, 
        type,
        phone,
        basePrice,
        location,
        metadata
      } = await c.req.json();

      const provider = {
        id: providerId || `ind_prov_${Date.now()}`,
        providerName: name,
        type,
        phone,
        basePrice,
        metadata,
        isClinicAttached: false,
        rating: 5.0,
        status: 'available',
        createdAt: new Date().toISOString()
      };

      // ✅ SQL: Store provider in platform_settings
      await db
        .from('platform_settings')
        .upsert({
          setting_key: `independent_provider:${provider.id}`,
          setting_value: provider,
          setting_type: 'object'
        }, {
          onConflict: 'setting_key'
        });

      // Update Geospatial Index
      if (location && location.lat && location.lng) {
        await updateProviderLocationIndex(provider.id, location.lat, location.lng, type);
      }

      return sendSuccess(c, { provider });

    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // DISCOVER SERVICES (Unified & Indexed)
  // ========================================
  app.get(`${BASE_PATH}/integrated-services/available`, async (c) => {
    try {
      const lat = parseFloat(c.req.query('lat') || '0');
      const lng = parseFloat(c.req.query('lng') || '0');
      const type = c.req.query('type');
      const bookingId = c.req.query('bookingId');

      if (!type) return sendError(c, 'Service type required', 400);

      let results: any[] = [];

      // 1. If Booking ID provided, fetch Clinic's own services first
      if (bookingId) {
        // ✅ SQL: Get booking
        const booking = await bookingsRepo.findById(bookingId);
        if (booking && booking.vendor_id) {
          const clinicServices = await fetchVendorServices(booking.vendor_id, type as string);
          if (clinicServices && clinicServices.length > 0) {
            // ✅ SQL: Get vendor location
            const vendor = await vendorsRepo.findById(booking.vendor_id);
            const distance = calculateDistance(
              lat, lng,
              vendor?.latitude || 0,
              vendor?.longitude || 0
            );
            
            results.push(...clinicServices.map((s: any) => ({ 
              ...s, 
              isClinicAttached: true, 
              providerName: vendor?.business_name,
              providerId: booking.vendor_id,
              distance: distance,
              eta: Math.ceil(distance * 3) + 10
            })));
          }
        }
      }

      // 2. Fetch Independent Vendors via GEOSPATIAL INDEX
      if (lat !== 0 && lng !== 0) {
        const nearbyProviders = await findProvidersNearby(lat, lng, type as string, 25);
        
        const formatted = nearbyProviders.map((p: any) => ({
          id: p.id,
          providerId: p.id,
          providerName: p.providerName,
          isClinicAttached: false,
          distance: p.distance,
          eta: Math.ceil(p.distance * 3) + 5,
          basePrice: p.basePrice,
          rating: p.rating,
          vehicleType: p.metadata?.vehicleType,
          testsAvailable: p.metadata?.testsAvailable,
          status: p.status
        }));
        
        results.push(...formatted);
      }

      // 3. Sort by Priority: Clinic > Distance > Rating
      results.sort((a, b) => {
        if (a.isClinicAttached && !b.isClinicAttached) return -1;
        if (!a.isClinicAttached && b.isClinicAttached) return 1;
        return (a.distance || 999) - (b.distance || 999);
      });

      return sendSuccess(c, { 
        services: results,
        count: results.length
      });

    } catch (error) {
      console.error('Error discovering services:', error);
      return sendError(c, error, 500);
    }
  });

  // ========================================
  // REQUEST SERVICE (With Notifications)
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/request`, async (c) => {
    try {
      const { 
        customerId, 
        providerId, 
        serviceType, 
        bookingId, 
        location, 
        details 
      } = await c.req.json();

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const request: ServiceRequest = {
        id: requestId,
        customerId,
        providerId,
        serviceType,
        bookingId,
        status: 'pending',
        location,
        details,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // ✅ SQL: Store request in platform_settings
      await db
        .from('platform_settings')
        .upsert({
          setting_key: `service_request:${requestId}`,
          setting_value: request,
          setting_type: 'object'
        }, {
          onConflict: 'setting_key'
        });
      
      // ✅ SQL: Link to customer
      const { data: customerHistoryData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `customer_requests:${customerId}`)
        .single();
      
      const customerHistory = customerHistoryData?.setting_value?.requests || [];
      customerHistory.push(requestId);
      
      await db
        .from('platform_settings')
        .upsert({
          setting_key: `customer_requests:${customerId}`,
          setting_value: { requests: customerHistory },
          setting_type: 'object'
        }, {
          onConflict: 'setting_key'
        });

      // ✅ SQL: Link to provider
      const { data: providerQueueData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `provider_requests:${providerId}`)
        .single();
      
      const providerQueue = providerQueueData?.setting_value?.requests || [];
      providerQueue.push(requestId);
      
      await db
        .from('platform_settings')
        .upsert({
          setting_key: `provider_requests:${providerId}`,
          setting_value: { requests: providerQueue },
          setting_type: 'object'
        }, {
          onConflict: 'setting_key'
        });

      console.log(`🔔 Notifying Provider ${providerId} of new ${serviceType} request`);

      return sendSuccess(c, { 
        success: true, 
        requestId, 
        status: 'pending',
        message: 'Service requested successfully'
      });

    } catch (error) {
      return sendError(c, error, 500);
    }
  });

  // Helper: Fetch services for a specific vendor
  async function fetchVendorServices(vendorId: string, type: string) {
    const keyMap: Record<string, string> = {
      'ambulance': `ambulance_services_${vendorId}`,
      'diagnostic': `diagnostic_tests_${vendorId}`,
      'pharmacy': `pharmacy_inventory_${vendorId}`
    };

    // ✅ SQL: Get vendor services from platform_settings
    const { data: serviceData } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', keyMap[type])
      .single();
    
    if (serviceData?.setting_value) {
      if (type === 'ambulance') return serviceData.setting_value.ambulances || [];
      if (type === 'diagnostic') return serviceData.setting_value.tests || [];
    }
    
    return [];
  }
  
  // Helper: Haversine Distance
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 999;
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  }

  console.log('✅ Integrated Services Manager endpoints (SQL-only) registered');
}

