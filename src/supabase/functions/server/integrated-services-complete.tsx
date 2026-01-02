/**
 * 🏥 INTEGRATED SERVICES COMPLETE IMPLEMENTATION
 * Rule 7: Ambulance, Medicine Delivery, Diagnostics
 * 
 * Features:
 * - Complete clinic integration
 * - Independent vendor support
 * - Unified service discovery
 * - Seamless booking flow
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';
import {
  getVendorsRepository,
  getBookingsRepository
} from '../../../supabase/lib/repositories/index';

const app = new Hono();

// ==========================================
// INTEGRATED SERVICES DISCOVERY
// ==========================================

/**
 * GET /integrated-services/available - Get available integrated services for booking
 */
app.get('/integrated-services/available', async (c) => {
  try {
    const { bookingId, location, serviceType } = c.req.query();
    
    const services = {
      ambulance: [],
      medicine_delivery: [],
      diagnostics: []
    };
    
    // ✅ SQL: Get all integrated service vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll();
    
    // Filter by service type
    const ambulanceVendors = allVendors.filter((v: any) => 
      (v.service_type === 'ambulance' || v.category === 'ambulance') && v.is_active
    );
    const pharmacyVendors = allVendors.filter((v: any) => 
      (v.service_type === 'pharmacy' || v.category === 'pharmacy') && v.is_active
    );
    const diagnosticsVendors = allVendors.filter((v: any) => 
      (v.service_type === 'diagnostics' || v.category === 'diagnostics') && v.is_active
    );
    
    // ✅ SQL: If booking provided, get booking location
    let bookingLocation: any = null;
    if (bookingId) {
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      bookingLocation = booking?.service_location || booking?.customer_address;
    }
    
    // Build ambulance services list
    services.ambulance = ambulanceVendors.map((v: any) => ({
      id: v.id || v.vendorId,
      name: v.business_name || v.businessName,
      type: 'ambulance',
      isIndependent: !v.clinic_id,
      clinicId: v.clinic_id || v.clinicId,
      services: v.services || [],
      pricing: v.ambulance_pricing || v.ambulancePricing || {},
      availability: v.availability_24x7 || v.availability24x7 || false,
      location: v.latitude && v.longitude ? { lat: v.latitude, lng: v.longitude } : v.location,
      rating: v.rating || 0,
      responseTime: v.avg_response_time || v.avgResponseTime || '15-30 mins'
    }));
    
    // Build pharmacy services list
    services.medicine_delivery = pharmacyVendors.map((v: any) => ({
      id: v.id || v.vendorId,
      name: v.business_name || v.businessName,
      type: 'pharmacy',
      isIndependent: !v.clinic_id,
      clinicId: v.clinic_id || v.clinicId,
      services: ['prescription_medicine', 'otc_medicine', 'pet_supplies'],
      deliveryTime: v.avg_delivery_time || v.avgDeliveryTime || '1-2 hours',
      location: v.latitude && v.longitude ? { lat: v.latitude, lng: v.longitude } : v.location,
      rating: v.rating || 0,
      acceptsPrescription: true
    }));
    
    // Build diagnostics services list
    services.diagnostics = diagnosticsVendors.map((v: any) => ({
      id: v.id || v.vendorId,
      name: v.business_name || v.businessName,
      type: 'diagnostics',
      isIndependent: !v.clinic_id,
      clinicId: v.clinic_id || v.clinicId,
      services: v.diagnostic_services || v.diagnosticServices || [],
      homeSampleCollection: v.home_sample_collection || v.homeSampleCollection || false,
      reportDeliveryTime: v.report_delivery_time || v.reportDeliveryTime || '24-48 hours',
      location: v.latitude && v.longitude ? { lat: v.latitude, lng: v.longitude } : v.location,
      rating: v.rating || 0
    }));
    
    // Filter by service type if specified
    if (serviceType) {
      return c.json({
        success: true,
        services: services[serviceType as keyof typeof services] || []
      });
    }
    
    return c.json({
      success: true,
      services
    });
  } catch (error) {
    console.error('Failed to get integrated services:', error);
    return c.json({ success: false, error: 'Failed to get integrated services' }, 500);
  }
});

/**
 * GET /integrated-services/vendors - Get independent vendors by type
 */
app.get('/integrated-services/vendors', async (c) => {
  try {
    const { type, lat, lng, radius = 10 } = c.req.query();
    
    if (!type) {
      return c.json({ success: false, error: 'type is required' }, 400);
    }
    
    // ✅ SQL: Get all vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll();
    
    let vendors = allVendors.filter((v: any) => 
      (v.service_type === type || v.category === type) && v.is_active
    );
    
    // If location provided, calculate distance
    if (lat && lng) {
      const customerLat = parseFloat(lat as string);
      const customerLng = parseFloat(lng as string);
      const searchRadius = parseFloat(radius as string);
      
      vendors = vendors
        .map((v: any) => {
          const lat = v.latitude || v.location?.lat;
          const lng = v.longitude || v.location?.lng;
          
          if (!lat || !lng) return null;
          
          const distance = calculateDistance(
            customerLat,
            customerLng,
            lat,
            lng
          );
          
          return distance <= searchRadius ? { ...v, distance } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.distance - b.distance);
    }
    
    return c.json({
      success: true,
      vendors,
      count: vendors.length
    });
  } catch (error) {
    console.error('Failed to get vendors:', error);
    return c.json({ success: false, error: 'Failed to get vendors' }, 500);
  }
});

// ==========================================
// INTEGRATED SERVICE BOOKING
// ==========================================

/**
 * POST /integrated-services/select - Select integrated service
 */
app.post('/integrated-services/select', async (c) => {
  try {
    const { bookingId, serviceType, vendorId, serviceDetails } = await c.req.json();
    
    if (!bookingId || !serviceType || !vendorId) {
      return c.json({ 
        success: false, 
        error: 'bookingId, serviceType, and vendorId are required' 
      }, 400);
    }
    
    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Get vendor
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }
    
    // ✅ SQL: Create integrated service record in integrated_services table
    const db = getDbClient();
    const integratedServiceId = `integrated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: integratedService } = await db
      .from('integrated_services')
      .insert({
        id: integratedServiceId,
        booking_id: bookingId,
        service_type: serviceType,
        vendor_id: vendorId,
        vendor_name: vendor.business_name || vendor.businessName,
        is_independent: !vendor.clinic_id,
        clinic_id: vendor.clinic_id || null,
        service_details: serviceDetails || {},
        status: 'requested',
        requested_at: new Date().toISOString()
      })
      .select()
      .single();
    
    // ✅ SQL: Update booking with integrated service
    const currentIntegratedServices = booking.integrated_services || booking.integratedServices || [];
    await bookingsRepo.update(bookingId, {
      integrated_services: [...currentIntegratedServices, integratedServiceId]
    });
    
    return c.json({
      success: true,
      integratedService
    });
  } catch (error) {
    console.error('Failed to select integrated service:', error);
    return c.json({ success: false, error: 'Failed to select integrated service' }, 500);
  }
});

/**
 * GET /integrated-services/booking/:bookingId - Get integrated services for booking
 */
app.get('/integrated-services/booking/:bookingId', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    
    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    const integratedServiceIds = booking.integrated_services || booking.integratedServices || [];
    
    // ✅ SQL: Get integrated services
    const db = getDbClient();
    const { data: services } = await db
      .from('integrated_services')
      .select('*')
      .in('id', integratedServiceIds);
    
    return c.json({
      success: true,
      services: services.filter(Boolean)
    });
  } catch (error) {
    console.error('Failed to get integrated services:', error);
    return c.json({ success: false, error: 'Failed to get integrated services' }, 500);
  }
});

/**
 * PUT /integrated-services/:serviceId/status - Update integrated service status
 */
app.put('/integrated-services/:serviceId/status', async (c) => {
  try {
    const serviceId = c.req.param('serviceId');
    const { status, notes } = await c.req.json();
    
    if (!status) {
      return c.json({ success: false, error: 'status is required' }, 400);
    }
    
    const validStatuses = ['requested', 'confirmed', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return c.json({ success: false, error: 'Invalid status' }, 400);
    }
    
    // ✅ SQL: Get and update integrated service
    const db = getDbClient();
    const { data: service } = await db
      .from('integrated_services')
      .select('*')
      .eq('id', serviceId)
      .single();
    
    if (!service) {
      return c.json({ success: false, error: 'Integrated service not found' }, 404);
    }
    
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (notes !== undefined) updateData.notes = notes;
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    await db
      .from('integrated_services')
      .update(updateData)
      .eq('id', serviceId);
    
    const { data: updatedService } = await db
      .from('integrated_services')
      .select('*')
      .eq('id', serviceId)
      .single();
    
    return c.json({
      success: true,
      service: updatedService
    });
  } catch (error) {
    console.error('Failed to update service status:', error);
    return c.json({ success: false, error: 'Failed to update service status' }, 500);
  }
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default app;
