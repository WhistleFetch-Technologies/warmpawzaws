import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// ============================================
// GROOMING SERVICES DISCOVERY
// ============================================

// Get all grooming services (categorized by type)
app.get("/grooming/services", async (c) => {
  try {
    console.log('📦 Fetching grooming services...');

    // Get all vendors with groomer role
    const allVendorKeys = await kv.getByPrefix('vendor:vendor_');
    const groomers = allVendorKeys
      .map(item => item.value)
      .filter((v: any) => 
        v && 
        (v.roleId === 'pet_groomer' || v.roleId === 'groomer') && 
        v.status === 'approved' && 
        v.isAvailable
      );

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

    // Get all groomers
    const allVendorKeys = await kv.getByPrefix('vendor:vendor_');
    let groomers = allVendorKeys
      .map(item => item.value)
      .filter((v: any) => 
        v && 
        (v.roleId === 'pet_groomer' || v.roleId === 'groomer') && 
        v.status === 'approved' && 
        v.isAvailable
      );

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

    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // ✅ PRODUCTION: Verify OTP from booking
    if (!booking.completionOTP || otp !== booking.completionOTP) {
      return c.json({ error: 'Invalid OTP' }, 400);
    }

    // Update booking status
    booking.status = 'completed';
    booking.completedAt = new Date().toISOString();
    booking.updatedAt = new Date().toISOString();
    
    await kv.set(`booking:${bookingId}`, booking);

    // Update customer stats
    const customer = await kv.get(`customer:${booking.customerId}`);
    if (customer) {
      customer.completedBookings = (customer.completedBookings || 0) + 1;
      customer.activeBookings = Math.max((customer.activeBookings || 0) - 1, 0);
      await kv.set(`customer:${booking.customerId}`, customer);
    }

    // Update vendor stats
    const vendor = await kv.get(`vendor:${booking.vendorId}`);
    if (vendor) {
      vendor.completedBookings = (vendor.completedBookings || 0) + 1;
      await kv.set(`vendor:${booking.vendorId}`, vendor);
    }

    // Create notification for review
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await kv.set(`notification:${notificationId}`, {
      id: notificationId,
      userId: booking.customerId,
      userType: 'customer',
      type: 'service_completed',
      title: 'Service Completed',
      message: 'Please rate your grooming experience',
      actionType: 'rate_booking',
      actionData: { bookingId },
      read: false,
      createdAt: new Date().toISOString()
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