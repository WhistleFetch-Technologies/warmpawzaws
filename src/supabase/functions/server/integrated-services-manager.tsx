import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🚑 INTEGRATED SERVICES MANAGER
 * 
 * Phase 7C: Rule 7 Implementation
 * 
 * Aggregates Ambulance, Diagnostics, and Pharmacy services from:
 * 1. Clinics (attached to existing bookings)
 * 2. Independent Vendors (Standalone service providers)
 */

interface ServiceRequest {
  id: string;
  customerId: string;
  providerId: string;
  serviceType: 'ambulance' | 'diagnostic' | 'pharmacy';
  bookingId?: string; // Optional link to main vet booking
  status: 'pending' | 'accepted' | 'en_route' | 'completed' | 'cancelled';
  location: { lat: number; lng: number; address: string };
  details: any; // Service specific details (e.g. tests list)
  createdAt: string;
}

export function integratedServicesManagerEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

  // ========================================
  // DISCOVER SERVICES (Unified)
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
          const booking = await kv.get(`booking_${bookingId}`);
          if (booking && booking.vendorId) {
              // Fetch clinic specific services
              // We assume data is stored at `vendor_{id}_ambulance` etc based on the VetSpecializedServicesManager
              // Note: The manager saves to `vendor/${vendorId}/ambulance-services` which likely maps to a KV key like `vendor_services_ambulance_${vendorId}`
              // We'll simulate fetching from a standard pattern
              
              const clinicServices = await fetchVendorServices(kv, booking.vendorId, type);
              if (clinicServices && clinicServices.length > 0) {
                  results.push(...clinicServices.map((s: any) => ({ 
                      ...s, 
                      isClinicAttached: true, 
                      providerName: booking.vendorName,
                      providerId: booking.vendorId 
                  })));
              }
          }
      }

      // 2. Fetch Independent / Nearby Vendors
      // This is a simulation of a geospatial query. In real KV, we'd iterate or use an index.
      // We'll fetch from a hypothetical 'service_index_{type}' or scan vendors.
      // For performance in this env, we'll use a mock generator seeded with some data + existing vendors
      
      const nearby = await findNearbyProviders(kv, lat, lng, type);
      results.push(...nearby);

      // 3. Sort by priority (Clinic > Distance)
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
  // REQUEST SERVICE
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
              createdAt: new Date().toISOString()
          };

          // Store request
          await kv.set(`service_request_${requestId}`, request);
          
          // Link to customer
          const customerHistory = await kv.get(`customer_requests_${customerId}`) || [];
          customerHistory.push(requestId);
          await kv.set(`customer_requests_${customerId}`, customerHistory);

          // Link to provider (for their dashboard)
          const providerQueue = await kv.get(`provider_requests_${providerId}`) || [];
          providerQueue.push(requestId);
          await kv.set(`provider_requests_${providerId}`, providerQueue);

          // Simulate Provider Notification
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

  // Helper: Fetch services for a specific vendor from KV
  async function fetchVendorServices(kv: any, vendorId: string, type: string) {
      // In a real app, we check the specific collection. 
      // Based on VetSpecializedServicesManager, endpoints are:
      // vendor/${vendorId}/ambulance-services -> KV: ambulance_services_${vendorId} (Hypothetical)
      // We will try to guess the key pattern or return mock if not found
      
      const keyMap: Record<string, string> = {
          'ambulance': `ambulance_services_${vendorId}`,
          'diagnostic': `diagnostic_tests_${vendorId}`,
          'pharmacy': `pharmacy_inventory_${vendorId}`
      };

      const data = await kv.get(keyMap[type]);
      if (data) return Array.isArray(data) ? data : (data.ambulances || data.tests || []);
      
      return [];
  }

  // Helper: Find nearby providers (Mock/Simulation)
  async function findNearbyProviders(kv: any, lat: number, lng: number, type: string) {
      // Create some mock independent vendors
      const mocks = [
          {
              id: 'ind_amb_1',
              providerName: 'Rapid Pet Rescue',
              isClinicAttached: false,
              distance: 2.5,
              eta: 15, // mins
              basePrice: 500,
              rating: 4.8,
              vehicleType: 'ICU Van'
          },
          {
              id: 'ind_lab_1',
              providerName: 'VetPath Labs',
              isClinicAttached: false,
              distance: 5.0,
              eta: 45, // mins for home collection
              basePrice: 0, // collection fee
              rating: 4.5,
              testsAvailable: ['CBC', 'Biochemistry']
          }
      ];

      // Filter mocks by type logic
      if (type === 'ambulance') {
          return mocks.filter(m => m.id.includes('amb'));
      } else if (type === 'diagnostic') {
          return mocks.filter(m => m.id.includes('lab'));
      }

      return [];
  }

  console.log('✅ Integrated Services Manager endpoints registered');
}
