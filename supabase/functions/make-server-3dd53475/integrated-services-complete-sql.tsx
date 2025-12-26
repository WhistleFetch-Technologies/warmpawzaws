/**
 * ============================================================================
 * INTEGRATED SERVICES COMPLETE IMPLEMENTATION - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Rule 7: Ambulance, Medicine Delivery, Diagnostics
 * 
 * Features:
 * - Complete clinic integration
 * - Independent vendor support
 * - Unified service discovery
 * - Seamless booking flow
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `VendorsRepository`, `BookingsRepository`
 * - Uses `vendors`, `bookings`, `platform_settings` tables
 * 
 * Date: 2025-01-28
 * Migration: Batch 16 - KV to SQL (11 KV operations removed)
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getDbClient } from '../../lib/db.ts';

const app = new Hono();
const db = getDbClient();
const vendorsRepo = getVendorsRepository();
const bookingsRepo = getBookingsRepository();

// ==========================================
// INTEGRATED SERVICES DISCOVERY
// ==========================================

/**
 * GET /integrated-services/available - Get available integrated services for booking
 */
app.get('/make-server-3dd53475/integrated-services/available', async (c) => {
  try {
    const { bookingId, location, serviceType } = c.req.query();
    
    const services = {
      ambulance: [],
      medicine_delivery: [],
      diagnostics: []
    };
    
    // ✅ SQL: Get all integrated service vendors
    const { data: allVendors } = await db
      .from('vendors')
      .select('*')
      .eq('is_active', true)
      .in('specialization', ['ambulance', 'pharmacy', 'diagnostics']);
    
    // Filter by service type
    const ambulanceVendors = (allVendors || []).filter((v: any) => 
      v.specialization === 'ambulance' || v.metadata?.serviceType === 'ambulance'
    );
    const pharmacyVendors = (allVendors || []).filter((v: any) => 
      v.specialization === 'pharmacy' || v.metadata?.serviceType === 'pharmacy'
    );
    const diagnosticsVendors = (allVendors || []).filter((v: any) => 
      v.specialization === 'diagnostics' || v.metadata?.serviceType === 'diagnostics'
    );
    
    // If booking provided, get booking location
    let bookingLocation: any = null;
    if (bookingId) {
      const booking = await bookingsRepo.findById(bookingId);
      if (booking) {
        bookingLocation = booking.service_location || booking.customer_address;
      }
    }
    
    // Build ambulance services list
    services.ambulance = ambulanceVendors.map((v: any) => ({
      id: v.id,
      name: v.business_name,
      type: 'ambulance',
      isIndependent: !!(v.metadata?.isIndependent),
      clinicId: v.metadata?.clinicId || null,
      services: v.metadata?.services || [],
      pricing: v.metadata?.ambulancePricing || {},
      availability: v.metadata?.availability24x7 || false,
      location: {
        lat: v.latitude,
        lng: v.longitude,
        address: v.address
      },
      rating: v.rating || 0,
      responseTime: v.metadata?.avgResponseTime || '15-30 mins'
    }));
    
    // Build pharmacy services list
    services.medicine_delivery = pharmacyVendors.map((v: any) => ({
      id: v.id,
      name: v.business_name,
      type: 'pharmacy',
      isIndependent: !!(v.metadata?.isIndependent),
      clinicId: v.metadata?.clinicId || null,
      services: ['prescription_medicine', 'otc_medicine', 'pet_supplies'],
      deliveryTime: v.metadata?.avgDeliveryTime || '1-2 hours',
      location: {
        lat: v.latitude,
        lng: v.longitude,
        address: v.address
      },
      rating: v.rating || 0,
      acceptsPrescription: true
    }));
    
    // Build diagnostics services list
    services.diagnostics = diagnosticsVendors.map((v: any) => ({
      id: v.id,
      name: v.business_name,
      type: 'diagnostics',
      isIndependent: !!(v.metadata?.isIndependent),
      clinicId: v.metadata?.clinicId || null,
      services: v.metadata?.diagnosticServices || [],
      homeSampleCollection: v.metadata?.homeSampleCollection || false,
      reportDeliveryTime: v.metadata?.reportDeliveryTime || '24-48 hours',
      location: {
        lat: v.latitude,
        lng: v.longitude,
        address: v.address
      },
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
app.get('/make-server-3dd53475/integrated-services/vendors', async (c) => {
  try {
    const { type, lat, lng, radius = 10 } = c.req.query();
    
    if (!type) {
      return c.json({ success: false, error: 'type is required' }, 400);
    }
    
    // ✅ SQL: Get vendors by type
    let query = db
      .from('vendors')
      .select('*')
      .eq('is_active', true);
    
    if (type === 'ambulance') {
      query = query.or('specialization.eq.ambulance,metadata->serviceType.eq.ambulance');
    } else if (type === 'pharmacy') {
      query = query.or('specialization.eq.pharmacy,metadata->serviceType.eq.pharmacy');
    } else if (type === 'diagnostics') {
      query = query.or('specialization.eq.diagnostics,metadata->serviceType.eq.diagnostics');
    }
    
    const { data: vendors } = await query;
    
    let filteredVendors = (vendors || []).filter((v: any) => 
      v.metadata?.serviceType === type || v.specialization === type
    );
    
    // If location provided, calculate distance
    if (lat && lng) {
      const customerLat = parseFloat(lat as string);
      const customerLng = parseFloat(lng as string);
      const searchRadius = parseFloat(radius as string);
      
      filteredVendors = filteredVendors
        .map((v: any) => {
          if (!v.latitude || !v.longitude) return null;
          
          const distance = calculateDistance(
            customerLat,
            customerLng,
            v.latitude,
            v.longitude
          );
          
          return distance <= searchRadius ? { ...v, distance } : null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.distance - b.distance);
    }
    
    return c.json({
      success: true,
      vendors: filteredVendors,
      count: filteredVendors.length
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
app.post('/make-server-3dd53475/integrated-services/select', async (c) => {
  try {
    const { bookingId, serviceType, vendorId, serviceDetails } = await c.req.json();
    
    if (!bookingId || !serviceType || !vendorId) {
      return c.json({ 
        success: false, 
        error: 'bookingId, serviceType, and vendorId are required' 
      }, 400);
    }
    
    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Get vendor
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }
    
    // ✅ SQL: Create integrated service record in platform_settings
    const integratedServiceId = `integrated_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const integratedService = {
      id: integratedServiceId,
      bookingId,
      serviceType,
      vendorId,
      vendorName: vendor.business_name,
      isIndependent: !!(vendor.metadata?.isIndependent),
      clinicId: vendor.metadata?.clinicId || null,
      serviceDetails: serviceDetails || {},
      status: 'requested',
      requestedAt: now,
      completedAt: null
    };
    
    await db
      .from('platform_settings')
      .upsert({
        setting_key: `integrated_service_${integratedServiceId}`,
        setting_value: integratedService,
        setting_type: 'object'
      }, {
        onConflict: 'setting_key'
      });
    
    // ✅ SQL: Update booking metadata with integrated service
    const bookingMetadata = (booking as any).metadata || {};
    if (!bookingMetadata.integratedServices) {
      bookingMetadata.integratedServices = [];
    }
    bookingMetadata.integratedServices.push(integratedServiceId);
    
    await db
      .from('bookings')
      .update({
        metadata: bookingMetadata,
        updated_at: now
      })
      .eq('id', bookingId);
    
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
app.get('/make-server-3dd53475/integrated-services/booking/:bookingId', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    
    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    const bookingMetadata = (booking as any).metadata || {};
    const integratedServiceIds = bookingMetadata.integratedServices || [];
    
    // ✅ SQL: Get all integrated services
    const services = [];
    for (const id of integratedServiceIds) {
      const { data: serviceSetting } = await db
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', `integrated_service_${id}`)
        .single();
      
      if (serviceSetting?.setting_value) {
        services.push(serviceSetting.setting_value);
      }
    }
    
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
app.put('/make-server-3dd53475/integrated-services/:serviceId/status', async (c) => {
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
    
    // ✅ SQL: Get service
    const { data: serviceSetting } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', `integrated_service_${serviceId}`)
      .single();
    
    if (!serviceSetting?.setting_value) {
      return c.json({ success: false, error: 'Integrated service not found' }, 404);
    }
    
    const service = serviceSetting.setting_value;
    service.status = status;
    service.notes = notes;
    service.updatedAt = new Date().toISOString();
    
    if (status === 'completed') {
      service.completedAt = new Date().toISOString();
    }
    
    // ✅ SQL: Update service
    await db
      .from('platform_settings')
      .update({
        setting_value: service,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', `integrated_service_${serviceId}`);
    
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

console.log('✅ Integrated Services Complete endpoints (SQL-only) registered');

export default app;

