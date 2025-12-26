/**
 * ============================================================================
 * INTEGRATED SERVICES MANAGER - SQL-ONLY VERSION
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
 * Features:
 * - Real Geospatial Search
 * - Provider Status Tracking
 * - Request Lifecycle Management
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()` with SQL queries
 * - Uses `vendors`, `bookings`, `platform_settings` tables
 * - Uses geospatial functions for distance calculation
 * 
 * Date: 2025-01-28
 * Migration: Batch 9 - 9 KV operations → 0
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { sendSuccess, sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { calculateDistance } from '../../lib/utils/distance-calculation.ts';

export function integratedServicesManagerEndpointsSQL(app: Hono) {
  const BASE_PATH = '/make-server-3dd53475';
  const db = getDbClient();
  const vendorsRepo = getVendorsRepository();
  const bookingsRepo = getBookingsRepository();

  // ========================================
  // PROVIDER REGISTRATION (Independent)
  // ========================================
  app.post(`${BASE_PATH}/integrated-services/register-provider`, async (c) => {
    try {
      const { 
        providerId, 
        name, 
        type, // 'ambulance', 'diagnostic', 'pharmacy'
        phone,
        basePrice,
        location, // { lat, lng, address }
        metadata // vehicle details, tests list, etc.
      } = await c.req.json();

      const now = new Date().toISOString();

      // ✅ SQL: Create vendor record for independent provider
      const vendor = await vendorsRepo.create({
        business_name: name,
        owner_name: name,
        phone: phone,
        email: '',
        address: location.address,
        city: location.city || '',
        state: location.state || '',
        pincode: location.pincode || '',
        latitude: location.lat,
        longitude: location.lng,
        category: type,
        status: 'active',
        is_active: true,
        metadata: {
          isIndependent: true,
          isClinicAttached: false,
          basePrice,
          rating: 5.0,
          status: 'available',
          ...metadata
        }
      });

      // ✅ SQL: Update geospatial index (platform_settings)
      const { data: geoIndexData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `geospatial_index:${type}`)
        .maybeSingle();

      const geoIndex = geoIndexData?.setting_value?.providers || [];
      geoIndex.push({
        id: vendor.id,
        lat: location.lat,
        lng: location.lng,
        type
      });

      await db
        .from('platform_settings')
        .upsert({
          setting_key: `geospatial_index:${type}`,
          setting_value: { providers: geoIndex },
          setting_type: 'object',
          updated_at: now
        }, {
          onConflict: 'setting_key'
        });

      return sendSuccess(c, { 
        provider: {
          id: vendor.id,
          providerName: name,
          type,
          isClinicAttached: false,
          rating: 5.0,
          status: 'available'
        }
      });
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
      const type = c.req.query('type'); // 'ambulance' | 'diagnostic' | 'pharmacy'
      const bookingId = c.req.query('bookingId');

      if (!type) return sendError(c, 'Service type required', 400);

      let results: any[] = [];

      // 1. If Booking ID provided, fetch Clinic's own services first
      if (bookingId) {
        // ✅ SQL: Get booking
        const booking = await bookingsRepo.findById(bookingId);
        if (booking && booking.vendor_id) {
          const clinicServices = await fetchVendorServices(booking.vendor_id, type);
          if (clinicServices && clinicServices.length > 0) {
            // ✅ SQL: Get vendor location
            const vendor = await vendorsRepo.findById(booking.vendor_id);
            if (vendor && vendor.latitude && vendor.longitude) {
              const distance = calculateDistance(
                lat, lng, 
                parseFloat(vendor.latitude.toString()), 
                parseFloat(vendor.longitude.toString())
              );

              results.push(...clinicServices.map((s: any) => ({ 
                ...s, 
                isClinicAttached: true, 
                providerName: vendor.business_name,
                providerId: vendor.id,
                distance: distance,
                eta: Math.ceil(distance * 3) + 10 // Rough ETA: 3 min/km + 10 min buffer
              })));
            }
          }
        }
      }

      // 2. Fetch Independent Vendors via GEOSPATIAL INDEX
      if (lat !== 0 && lng !== 0) {
        // ✅ SQL: Get nearby providers from geospatial index
        const { data: geoIndexData } = await db
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', `geospatial_index:${type}`)
          .maybeSingle();

        const providers = geoIndexData?.setting_value?.providers || [];
        
        // Calculate distances and filter within 25km
        const nearbyProviders = providers
          .map((p: any) => {
            const distance = calculateDistance(lat, lng, p.lat, p.lng);
            return { ...p, distance };
          })
          .filter((p: any) => p.distance <= 25)
          .sort((a: any, b: any) => a.distance - b.distance)
          .slice(0, 10); // Top 10 nearest

        // ✅ SQL: Get full vendor details
        for (const provider of nearbyProviders) {
          const vendor = await vendorsRepo.findById(provider.id);
          if (vendor) {
            results.push({
              id: vendor.id,
              providerId: vendor.id,
              providerName: vendor.business_name,
              isClinicAttached: false,
              distance: provider.distance,
              eta: Math.ceil(provider.distance * 3) + 5, // Independent might be faster (mobile)
              basePrice: vendor.metadata?.basePrice,
              rating: vendor.metadata?.rating || 5.0,
              vehicleType: vendor.metadata?.vehicleType,
              testsAvailable: vendor.metadata?.testsAvailable,
              status: vendor.metadata?.status || 'available'
            });
          }
        }
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
      const now = new Date().toISOString();

      // ✅ SQL: Store request in platform_settings
      const request = {
        id: requestId,
        customerId,
        providerId,
        serviceType,
        bookingId,
        status: 'pending',
        location,
        details,
        createdAt: now,
        updatedAt: now
      };

      await db
        .from('platform_settings')
        .upsert({
          setting_key: `service_request:${requestId}`,
          setting_value: request,
          setting_type: 'object',
          updated_at: now
        }, {
          onConflict: 'setting_key'
        });

      // ✅ SQL: Link to customer (platform_settings)
      const { data: customerHistoryData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `customer_requests:${customerId}`)
        .maybeSingle();

      const customerHistory = customerHistoryData?.setting_value?.requestIds || [];
      customerHistory.push(requestId);

      await db
        .from('platform_settings')
        .upsert({
          setting_key: `customer_requests:${customerId}`,
          setting_value: { requestIds: customerHistory },
          setting_type: 'object',
          updated_at: now
        }, {
          onConflict: 'setting_key'
        });

      // ✅ SQL: Link to provider (platform_settings)
      const { data: providerQueueData } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `provider_requests:${providerId}`)
        .maybeSingle();

      const providerQueue = providerQueueData?.setting_value?.requestIds || [];
      providerQueue.push(requestId);

      await db
        .from('platform_settings')
        .upsert({
          setting_key: `provider_requests:${providerId}`,
          setting_value: { requestIds: providerQueue },
          setting_type: 'object',
          updated_at: now
        }, {
          onConflict: 'setting_key'
        });

      // 🔔 Notify Provider
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

  // Helper: Fetch services for a specific vendor from SQL
  async function fetchVendorServices(vendorId: string, type: string) {
    // ✅ SQL: Get vendor specialized services based on type
    if (type === 'ambulance') {
      const { data } = await db
        .from('ambulance_vehicles')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_available', true);
      return data || [];
    } else if (type === 'diagnostic') {
      const { data } = await db
        .from('diagnostic_tests')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_available', true);
      return data || [];
    } else if (type === 'pharmacy') {
      // Pharmacy services would be from products table
      const { data } = await db
        .from('products')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .limit(20);
      return data || [];
    }
    return [];
  }

  console.log('✅ Integrated Services Manager endpoints registered (SQL-only)');
}
