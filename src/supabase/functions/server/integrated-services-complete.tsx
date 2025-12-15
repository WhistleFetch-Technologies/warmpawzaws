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

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

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
    
    // Get all integrated service vendors
    const allVendors = await kv.getByPrefix('vendor_') || [];
    
    // Filter by service type
    const ambulanceVendors = allVendors.filter((v: any) => 
      v.serviceType === 'ambulance' && v.isActive
    );
    const pharmacyVendors = allVendors.filter((v: any) => 
      v.serviceType === 'pharmacy' && v.isActive
    );
    const diagnosticsVendors = allVendors.filter((v: any) => 
      v.serviceType === 'diagnostics' && v.isActive
    );
    
    // If booking provided, get booking location
    let bookingLocation: any = null;
    if (bookingId) {
      const booking = await kv.get(`booking_${bookingId}`);
      bookingLocation = booking?.serviceLocation || booking?.customerAddress;
    }
    
    // Build ambulance services list
    services.ambulance = ambulanceVendors.map((v: any) => ({
      id: v.vendorId,
      name: v.businessName,
      type: 'ambulance',
      isIndependent: !v.clinicId,
      clinicId: v.clinicId,
      services: v.services || [],
      pricing: v.ambulancePricing || {},
      availability: v.availability24x7 || false,
      location: v.location,
      rating: v.rating || 0,
      responseTime: v.avgResponseTime || '15-30 mins'
    }));
    
    // Build pharmacy services list
    services.medicine_delivery = pharmacyVendors.map((v: any) => ({
      id: v.vendorId,
      name: v.businessName,
      type: 'pharmacy',
      isIndependent: !v.clinicId,
      clinicId: v.clinicId,
      services: ['prescription_medicine', 'otc_medicine', 'pet_supplies'],
      deliveryTime: v.avgDeliveryTime || '1-2 hours',
      location: v.location,
      rating: v.rating || 0,
      acceptsPrescription: true
    }));
    
    // Build diagnostics services list
    services.diagnostics = diagnosticsVendors.map((v: any) => ({
      id: v.vendorId,
      name: v.businessName,
      type: 'diagnostics',
      isIndependent: !v.clinicId,
      clinicId: v.clinicId,
      services: v.diagnosticServices || [],
      homeSampleCollection: v.homeSampleCollection || false,
      reportDeliveryTime: v.reportDeliveryTime || '24-48 hours',
      location: v.location,
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
    
    const allVendors = await kv.getByPrefix('vendor_') || [];
    
    let vendors = allVendors.filter((v: any) => 
      v.serviceType === type && v.isActive
    );
    
    // If location provided, calculate distance
    if (lat && lng) {
      const customerLat = parseFloat(lat as string);
      const customerLng = parseFloat(lng as string);
      const searchRadius = parseFloat(radius as string);
      
      vendors = vendors
        .map((v: any) => {
          if (!v.location?.lat || !v.location?.lng) return null;
          
          const distance = calculateDistance(
            customerLat,
            customerLng,
            v.location.lat,
            v.location.lng
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
    
    // Get booking
    const booking = await kv.get(`booking_${bookingId}`);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // Get vendor
    const vendor = await kv.get(`vendor_${vendorId}`);
    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }
    
    // Create integrated service record
    const integratedServiceId = `integrated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const integratedService = {
      id: integratedServiceId,
      bookingId,
      serviceType,
      vendorId,
      vendorName: vendor.businessName,
      isIndependent: !vendor.clinicId,
      clinicId: vendor.clinicId,
      serviceDetails: serviceDetails || {},
      status: 'requested', // requested -> confirmed -> in_progress -> completed
      requestedAt: new Date().toISOString(),
      completedAt: null
    };
    
    await kv.set(`integrated_service_${integratedServiceId}`, integratedService);
    
    // Update booking with integrated service
    if (!booking.integratedServices) {
      booking.integratedServices = [];
    }
    booking.integratedServices.push(integratedServiceId);
    await kv.set(`booking_${bookingId}`, booking);
    
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
    
    const booking = await kv.get(`booking_${bookingId}`);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    const integratedServiceIds = booking.integratedServices || [];
    
    const services = await Promise.all(
      integratedServiceIds.map((id: string) => kv.get(`integrated_service_${id}`))
    );
    
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
    
    const service = await kv.get(`integrated_service_${serviceId}`);
    if (!service) {
      return c.json({ success: false, error: 'Integrated service not found' }, 404);
    }
    
    service.status = status;
    service.notes = notes;
    service.updatedAt = new Date().toISOString();
    
    if (status === 'completed') {
      service.completedAt = new Date().toISOString();
    }
    
    await kv.set(`integrated_service_${serviceId}`, service);
    
    return c.json({
      success: true,
      service
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
