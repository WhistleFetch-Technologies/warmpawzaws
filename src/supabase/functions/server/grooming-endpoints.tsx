// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { 
  getVendorsRepository,
  getBookingsRepository,
  getCustomersRepository,
  getNotificationsRepository
} from '../../../supabase/lib/repositories/index';

const app = new Hono();

// ============================================
// GROOMING SERVICES DISCOVERY
// ============================================

// Get all grooming services (categorized by type)
app.get("/grooming/services", async (c) => {
  try {
    console.log('📦 Fetching grooming services...');

    // ✅ SQL: Get all vendors with groomer role from vendors table
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({});
    const groomers = allVendors.filter((v: any) => 
      (v.role_id === 'pet_groomer' || v.role_id === 'groomer') && 
      v.approval_status === 'approved' && 
      v.is_active
    );

    console.log(`Found ${groomers.length} active groomers`);

    // Categorize by service style (from metadata)
    const groomingCenters = groomers.filter((v: any) => 
      v.metadata?.serviceStyles && v.metadata.serviceStyles.includes('clinic')
    );
    
    const homeGroomers = groomers.filter((v: any) => 
      v.metadata?.serviceStyles && v.metadata.serviceStyles.includes('home')
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

    // ✅ SQL: Get all groomers from vendors table
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({});
    let groomers = allVendors.filter((v: any) => 
      (v.role_id === 'pet_groomer' || v.role_id === 'groomer') && 
      v.approval_status === 'approved' && 
      v.is_active
    );

    // Filter by service type
    const serviceStyle = serviceType === 'grooming_center' ? 'clinic' : 'home';
    groomers = groomers.filter((v: any) => 
      v.metadata?.serviceStyles && v.metadata.serviceStyles.includes(serviceStyle)
    );

      // Calculate distances if coordinates provided
      if (lat && lng) {
        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);
        const radiusKm = parseFloat(radius);

        groomers = groomers
          .filter((v: any) => {
            if (!v.location || !v.location.lat || !v.location.lng) return false;
            const distance = calculateDistance(
              userLat, userLng,
              v.location.lat, v.location.lng
            );
            return distance <= radiusKm;
          })
          .map((v: any) => ({
            ...v,
            distance: calculateDistance(
              userLat, userLng,
              v.location.lat, v.location.lng
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

    // ✅ SQL: Get booking from bookings table
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // UAT Mode: Accept fixed OTP
    const UAT_MODE = true;
    const validOTP = UAT_MODE ? '123456' : booking.metadata?.completionOTP;

    if (otp !== validOTP) {
      return c.json({ error: 'Invalid OTP' }, 400);
    }

    // ✅ SQL: Update booking status
    await bookingsRepo.update(bookingId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: {
        ...booking.metadata,
        completedAt: new Date().toISOString()
      }
    });

    const updatedBooking = await bookingsRepo.findById(bookingId);

    // ✅ SQL: Update customer stats
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(booking.customer_id);
    if (customer) {
      const completedBookings = (customer.metadata?.completedBookings || 0) + 1;
      const activeBookings = Math.max((customer.metadata?.activeBookings || 0) - 1, 0);
      await customersRepo.update(customer.id, {
        metadata: {
          ...customer.metadata,
          completedBookings,
          activeBookings
        }
      });
    }

    // ✅ SQL: Update vendor stats
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(booking.vendor_id || '');
    if (vendor) {
      const completedBookings = (vendor.metadata?.completedBookings || 0) + 1;
      await vendorsRepo.update(vendor.id, {
        metadata: {
          ...vendor.metadata,
          completedBookings
        }
      });
    }

    // ✅ SQL: Create notification for review
    const notificationsRepo = getNotificationsRepository();
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await notificationsRepo.create({
      id: notificationId,
      user_id: booking.customer_id,
      user_type: 'customer',
      notification_type: 'service_completed',
      title: 'Service Completed',
      message: 'Please rate your grooming experience',
      action_type: 'rate_booking',
      action_data: { bookingId },
      is_read: false
    });

    console.log('✅ Booking completed successfully');

    return c.json({
      success: true,
      booking: updatedBooking,
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