import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const app = new Hono();

// ============================================
// GROOMING SERVICES DISCOVERY
// ============================================

// Get all grooming services (categorized by type)
app.get("/grooming/services", async (c) => {
  try {
    console.log('📦 Fetching grooming services...');

    // ✅ SQL: Get all vendors with groomer role
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findByRole('pet_groomer', { status: 'approved' });
    
    // Also get 'groomer' role
    const groomerVendors = await vendorsRepo.findByRole('groomer', { status: 'approved' });
    const allGroomerVendors = [...allVendors, ...groomerVendors];
    
    // Transform to expected format
    const groomers = allGroomerVendors
      .filter((v: any) => v.is_active)
      .map((v: any) => ({
        id: v.vendor_id || v.id,
        vendorId: v.vendor_id || v.id,
        businessName: v.business_name,
        roleId: v.role_id,
        status: v.status,
        isAvailable: v.is_active,
        address: v.address,
        city: v.city,
        latitude: v.latitude,
        longitude: v.longitude,
        coordinates: v.latitude && v.longitude ? { lat: v.latitude, lng: v.longitude } : null,
        serviceStyles: ['at_center', 'at_home'] // Default, can be enhanced
      }));

    console.log(`Found ${groomers.length} active groomers`);

    // Categorize by service style (standardized: at_center, at_home, tele)
    const groomingCenters = groomers.filter((v: any) => 
      v.serviceStyles && (
        v.serviceStyles.includes('at_center') || 
        v.serviceStyles.includes('clinic') || 
        v.serviceStyles.includes('both')
      )
    );
    
    const homeGroomers = groomers.filter((v: any) => 
      v.serviceStyles && (
        v.serviceStyles.includes('at_home') || 
        v.serviceStyles.includes('home') || 
        v.serviceStyles.includes('both')
      )
    );

    // Get popular services from catalog
    const popularServices = [
      { name: 'Full Body Grooming', price: 1200, duration: 90, category: 'grooming_center' },
      { name: 'Bath & Blow Dry', price: 800, duration: 60, category: 'grooming_center' },
      { name: 'Nail Trimming', price: 300, duration: 20, category: 'grooming_center' },
      { name: 'Ear Cleaning', price: 250, duration: 15, category: 'grooming_center' },
      { name: 'Teeth Cleaning', price: 500, duration: 30, category: 'grooming_center' },
      { name: 'Haircut & Styling', price: 1000, duration: 75, category: 'grooming_center' }
    ];

    // Get active deals/offers
    const deals = [
      {
        title: 'First Time Offer',
        discount: 20,
        description: '20% off on your first grooming session',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    return c.json({
      success: true,
      services: {
        grooming_center: groomingCenters,
        grooming_home: homeGroomers
      },
      popularServices,
      deals,
      stats: {
        totalProviders: groomers.length,
        centers: groomingCenters.length,
        homeServices: homeGroomers.length
      }
    });
  } catch (error) {
    console.error('❌ Error fetching grooming services:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Get grooming services by type (center or home)
app.get("/grooming/:serviceType/providers", async (c) => {
  try {
    const { serviceType } = c.req.param();
    const { lat, lng, radius = 10 } = c.req.query();

    console.log(`📍 Fetching ${serviceType} providers near ${lat},${lng}`);

    // ✅ SQL: Get all groomers
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findByRole('pet_groomer', { status: 'approved' });
    const groomerVendors = await vendorsRepo.findByRole('groomer', { status: 'approved' });
    const allGroomerVendors = [...allVendors, ...groomerVendors];
    
    let groomers = allGroomerVendors
      .filter((v: any) => v.is_active)
      .map((v: any) => ({
        id: v.vendor_id || v.id,
        vendorId: v.vendor_id || v.id,
        businessName: v.business_name,
        roleId: v.role_id,
        status: v.status,
        isAvailable: v.is_active,
        address: v.address,
        city: v.city,
        latitude: v.latitude,
        longitude: v.longitude,
        coordinates: v.latitude && v.longitude ? { lat: v.latitude, lng: v.longitude } : null,
        serviceStyles: ['at_center', 'at_home']
      }));

    // Filter by service type (standardized: at_center, at_home)
    const serviceStyle = serviceType === 'grooming_center' ? 'at_center' : 'at_home';
    const legacyStyles = serviceType === 'grooming_center' ? ['clinic', 'both'] : ['home', 'both'];
    groomers = groomers.filter((v: any) => 
      v.serviceStyles && (
        v.serviceStyles.includes(serviceStyle) ||
        legacyStyles.some(legacy => v.serviceStyles.includes(legacy))
      )
    );

    // Calculate distances if coordinates provided
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      groomers = groomers
        .filter((v: any) => {
          if (!v.coordinates) return false;
          const distance = calculateDistance(
            userLat, userLng,
            v.coordinates.lat, v.coordinates.lng
          );
          return distance <= radiusKm;
        })
        .map((v: any) => ({
          ...v,
          distance: calculateDistance(
            userLat, userLng,
            v.coordinates.lat, v.coordinates.lng
          )
        }))
        .sort((a: any, b: any) => a.distance - b.distance);
    }

    return c.json({
      success: true,
      providers: groomers,
      count: groomers.length
    });
  } catch (error) {
    console.error('❌ Error fetching grooming providers:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Complete grooming booking with OTP
app.post("/booking/:bookingId/complete", async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { otp } = await c.req.json();

    console.log(`🔐 Completing booking ${bookingId} with OTP`);

    // ✅ SQL: Get booking
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // ✅ PRODUCTION: Verify OTP from booking
    if (!booking.otp_code || otp !== booking.otp_code) {
      return c.json({ error: 'Invalid OTP' }, 400);
    }

    // ✅ SQL: Update booking status
    const updatedBooking = await bookingsRepo.update(bookingId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      otp_verified: true
    });

    // ✅ SQL: Update customer stats (if needed, can be done via triggers or computed)
    // For now, we'll skip direct updates as stats can be computed from bookings

    // ✅ SQL: Create notification for review
    const notificationsRepo = getNotificationsRepository();
    await notificationsRepo.create({
      user_id: booking.customer_id,
      user_type: 'customer',
      type: 'service_completed',
      title: 'Service Completed',
      message: 'Please rate your grooming experience',
      action_type: 'rate_booking',
      action_data: { bookingId },
      is_read: false
    });

    console.log('✅ Booking completed successfully');

    return c.json({
      success: true,
      booking,
      message: 'Grooming session completed successfully'
    });
  } catch (error) {
    console.error('❌ Error completing booking:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Helper function to calculate distance
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default app;