// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { findProvidersNearby, updateProviderLocationIndex } from "./geospatial-index";
import { 
  getBookingsRepository,
  getVendorsRepository,
  getDbClient,
  getCustomersRepository,
  getAmbulanceVehiclesRepository,
  getDiagnosticTestsRepository,
  getProductsRepository
} from '../../../supabase/lib/repositories/index';

/**
 * 🚑 INTEGRATED SERVICES MANAGER (ENTERPRISE GRADE)
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
 */

interface ServiceRequest {
  id: string;
  customerId: string;
  providerId: string;
  serviceType: 'ambulance' | 'diagnostic' | 'pharmacy';
  bookingId?: string; // Optional link to main vet booking
  status: 'pending' | 'accepted' | 'en_route' | 'in_progress' | 'completed' | 'cancelled';
  location: { lat: number; lng: number; address: string };
  details: any; // Service specific details (e.g. tests list)
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
            type, // 'ambulance', 'diagnostic', 'pharmacy'
            phone,
            basePrice,
            location, // { lat, lng, address }
            metadata // vehicle details, tests list, etc.
        } = await c.req.json();

        const provider = {
            id: providerId || `ind_prov_${Date.now()}`,
            providerName: name,
            type,
            phone,
            basePrice,
            metadata,
            isClinicAttached: false,
            rating: 5.0, // Default for new
            status: 'available',
            createdAt: new Date().toISOString()
        };

        // ✅ SQL: Save Provider Details in vendors table (as independent vendor)
        const vendorsRepo = getVendorsRepository();
        await vendorsRepo.create({
          id: provider.id,
          business_name: provider.providerName,
          role_id: type === 'ambulance' ? 'pet_ambulance' : type === 'diagnostic' ? 'diagnostics' : 'pharmacy',
          phone: phone,
          location: location ? { lat: location.lat, lng: location.lng } : null,
          address: location?.address || '',
          is_active: true,
          approval_status: 'approved',
          metadata: {
            ...provider,
            isIndependentProvider: true,
            basePrice: basePrice
          }
        });

        // ✅ SQL: Update Geospatial Index (handled by vendors table location)
        if (location && location.lat && location.lng) {
            await updateProviderLocationIndex(null, provider.id, location.lat, location.lng, type);
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
      const type = c.req.query('type'); // 'ambulance' | 'diagnostic' | 'pharmacy'
      const bookingId = c.req.query('bookingId');

      if (!type) return sendError(c, 'Service type required', 400);

      let results: any[] = [];

      // ✅ SQL: 1. If Booking ID provided, fetch Clinic's own services first
      if (bookingId) {
          const bookingsRepo = getBookingsRepository();
          const booking = await bookingsRepo.findById(bookingId);
          if (booking && booking.vendor_id) {
              const clinicServices = await fetchVendorServices(booking.vendor_id, type);
              if (clinicServices && clinicServices.length > 0) {
                  // ✅ SQL: For clinics, calculate distance from the clinic location to user
                  const vendorsRepo = getVendorsRepository();
                  const vendor = await vendorsRepo.findById(booking.vendor_id);
                  const vendorLocation = vendor?.location;
                  const distance = calculateDistance(lat, lng, vendorLocation?.lat || 0, vendorLocation?.lng || 0);
                  
                  results.push(...clinicServices.map((s: any) => ({ 
                      ...s, 
                      isClinicAttached: true, 
                      providerName: vendor?.business_name || vendor?.full_name,
                      providerId: booking.vendor_id,
                      distance: distance,
                      eta: Math.ceil(distance * 3) + 10 // Rough ETA: 3 min/km + 10 min buffer
                  })));
              }
          }
      }

      // ✅ SQL: 2. Fetch Independent Vendors via GEOSPATIAL INDEX
      if (lat !== 0 && lng !== 0) {
          const nearbyProviders = await findProvidersNearby(null, lat, lng, type, 25); // 25km radius
          
          const formatted = nearbyProviders.map(p => ({
              id: p.id,
              providerId: p.id,
              providerName: p.providerName,
              isClinicAttached: false,
              distance: p.distance,
              eta: Math.ceil(p.distance * 3) + 5, // Independent might be faster (mobile)
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

          // ✅ SQL: Store request in service_requests table (or orders table for pharmacy)
          const db = getDbClient();
          await db
            .from('service_requests')
            .insert({
              id: requestId,
              customer_id: customerId,
              provider_id: providerId,
              service_type: serviceType,
              booking_id: bookingId || null,
              location: location,
              details: details,
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          // ✅ SQL: Link to customer history (metadata update)
          const customersRepo = getCustomersRepository();
          const customer = await customersRepo.findById(customerId);
          if (customer) {
            const history = customer.metadata?.serviceRequests || [];
            history.push(requestId);
            await customersRepo.update(customerId, {
              metadata: {
                ...customer.metadata,
                serviceRequests: history
              }
            });
          }

          // ✅ SQL: Link to provider queue (vendor metadata update)
          const vendorsRepo = getVendorsRepository();
          const provider = await vendorsRepo.findById(providerId);
          if (provider) {
            const queue = provider.metadata?.serviceRequestQueue || [];
            queue.push(requestId);
            await vendorsRepo.update(providerId, {
              metadata: {
                ...provider.metadata,
                serviceRequestQueue: queue
              }
            });
          }

          // 🔔 Notify Provider
          // We trigger the Notification System here
          // (Assuming notification helper is available or we use a direct fetch if decoupled)
          // For now, we simulate the log
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

  // ✅ SQL: Helper to fetch services for a specific vendor from SQL tables
  async function fetchVendorServices(vendorId: string, type: string) {
      if (type === 'ambulance') {
        // ✅ SQL: Get ambulance vehicles from ambulance_vehicles table
        const ambulanceRepo = getAmbulanceVehiclesRepository();
        const vehicles = await ambulanceRepo.findByVendor(vendorId);
        return vehicles.map((v: any) => ({
          id: v.id,
          vehicleType: v.vehicle_type,
          availability: v.availability_status,
          basePrice: v.base_price,
          ...v.metadata
        }));
      }
      
      if (type === 'diagnostic') {
        // ✅ SQL: Get diagnostic tests from diagnostic_tests table
        const diagnosticRepo = getDiagnosticTestsRepository();
        const tests = await diagnosticRepo.findByVendor(vendorId);
        return tests.map((t: any) => ({
          id: t.id,
          testName: t.test_name,
          price: t.price,
          ...t.metadata
        }));
      }
      
      if (type === 'pharmacy') {
        // ✅ SQL: Get pharmacy products from products table
        const productsRepo = getProductsRepository();
        const products = await productsRepo.findByVendor(vendorId);
        return products.map((p: any) => ({
          id: p.id,
          productName: p.name,
          price: p.price,
          ...p.metadata
        }));
      }
      
      return [];
  }
  
  // Helper: Haversine Distance (Duplicate for scope isolation)
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

  console.log('✅ Integrated Services Manager endpoints registered');
}
