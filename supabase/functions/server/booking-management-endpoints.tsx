import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { calculateDuration, validateDuration } from './service-category-helpers.tsx';

const app = new Hono();

/**
 * GET /make-server-3dd53475/customer/:phone/bookings
 * Get all bookings for a customer
 */
app.get('/make-server-3dd53475/customer/:phone/bookings', async (c) => {
  try {
    const { phone } = c.req.param();
    const cleanPhone = phone.replace(/\D/g, '');
    
    console.log(`\n📚 ===== GET CUSTOMER BOOKINGS =====`);
    console.log(`📞 Phone: ${cleanPhone}`);
    
    // Get booking IDs for this customer
    const bookingIds = await kv.get(`customer:bookings:${cleanPhone}`) || [];
    console.log(`📋 Found ${bookingIds.length} booking IDs`);
    
    if (bookingIds.length === 0) {
      return c.json({
        success: true,
        bookings: []
      });
    }
    
    // Load all bookings
    const bookings = [];
    for (const bookingId of bookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        // Load package occurrences if it's a package
        if (booking.isPackage) {
          const occurrences = await kv.get(`booking:${bookingId}:occurrences`) || [];
          booking.occurrences = occurrences;
          
          // Calculate completed sessions
          const completedCount = occurrences.filter((o: any) => o.status === 'completed').length;
          booking.packageDetails = {
            ...booking.packageDetails,
            completedSessions: completedCount
          };
        }
        
        bookings.push(booking);
      }
    }
    
    // Sort by creation date (newest first)
    bookings.sort((a: any, b: any) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    console.log(`✅ Returning ${bookings.length} bookings`);
    
    return c.json({
      success: true,
      bookings
    });
    
  } catch (error) {
    console.error('❌ [GET-CUSTOMER-BOOKINGS] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to get customer bookings',
      message: String(error)
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/booking/:bookingId/occurrence/:occurrenceId/complete
 * Complete a package occurrence with OTP
 */
app.post('/make-server-3dd53475/booking/:bookingId/occurrence/:occurrenceId/complete', async (c) => {
  try {
    const { bookingId, occurrenceId } = c.req.param();
    const { otp, staffId } = await c.req.json();
    
    console.log(`\n✅ ===== COMPLETE OCCURRENCE =====`);
    console.log(`📋 Booking ID: ${bookingId}`);
    console.log(`📝 Occurrence ID: ${occurrenceId}`);
    console.log(`🔐 OTP: ${otp}`);
    
    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // Get occurrences
    const occurrences = await kv.get(`booking:${bookingId}:occurrences`) || [];
    const occurrenceIndex = occurrences.findIndex((o: any) => o.occurrenceId === occurrenceId);
    
    if (occurrenceIndex === -1) {
      return c.json({ success: false, error: 'Occurrence not found' }, 404);
    }
    
    const occurrence = occurrences[occurrenceIndex];
    
    // Verify OTP
    if (occurrence.otp !== otp) {
      return c.json({ success: false, error: 'Invalid OTP' }, 400);
    }
    
    // Update occurrence status
    occurrence.status = 'completed';
    occurrence.completedAt = new Date().toISOString();
    occurrence.completedBy = staffId;
    occurrences[occurrenceIndex] = occurrence;
    
    await kv.set(`booking:${bookingId}:occurrences`, occurrences);
    
    // Check if all occurrences are completed
    const allCompleted = occurrences.every((o: any) => o.status === 'completed');
    
    if (allCompleted) {
      booking.status = 'completed';
      booking.completedAt = new Date().toISOString();
      await kv.set(`booking:${bookingId}`, booking);
    }
    
    // Update earnings for vendor and staff
    await updateEarnings(booking, staffId);
    
    console.log(`✅ Occurrence completed successfully`);
    
    return c.json({
      success: true,
      occurrence,
      allCompleted,
      message: allCompleted ? 'All sessions completed!' : 'Session completed successfully'
    });
    
  } catch (error) {
    console.error('❌ [COMPLETE-OCCURRENCE] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to complete occurrence',
      message: String(error)
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/booking/:bookingId/complete
 * Complete a single booking with OTP
 */
app.post('/make-server-3dd53475/booking/:bookingId/complete', async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { otp, staffId } = await c.req.json();
    
    console.log(`\n✅ ===== COMPLETE BOOKING =====`);
    console.log(`📋 Booking ID: ${bookingId}`);
    console.log(`🔐 OTP: ${otp}`);
    
    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // Verify OTP
    if (booking.completionOTP !== otp) {
      return c.json({ success: false, error: 'Invalid OTP' }, 400);
    }
    
    // Update booking status
    booking.status = 'completed';
    booking.completedAt = new Date().toISOString();
    booking.completedBy = staffId;
    
    await kv.set(`booking:${bookingId}`, booking);
    
    // Update earnings
    await updateEarnings(booking, staffId);
    
    console.log(`✅ Booking completed successfully`);
    
    return c.json({
      success: true,
      booking,
      message: 'Booking completed successfully'
    });
    
  } catch (error) {
    console.error('❌ [COMPLETE-BOOKING] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to complete booking',
      message: String(error)
    }, 500);
  }
});

/**
 * Helper function to update earnings
 */
async function updateEarnings(booking: any, staffId?: string) {
  try {
    const now = new Date();
    const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    
    // Calculate earnings (booking price minus platform commission)
    const platformCommission = booking.price * 0.15; // 15% platform fee
    const vendorEarnings = booking.price - platformCommission;
    
    // Update vendor daily earnings
    const vendorDailyKey = `vendor:${booking.vendorId}:earnings:daily:${dateKey}`;
    const vendorDaily = await kv.get(vendorDailyKey) || {
      date: dateKey,
      totalBookings: 0,
      totalRevenue: 0,
      totalEarnings: 0,
      platformFees: 0
    };
    vendorDaily.totalBookings += 1;
    vendorDaily.totalRevenue += booking.price;
    vendorDaily.totalEarnings += vendorEarnings;
    vendorDaily.platformFees += platformCommission;
    await kv.set(vendorDailyKey, vendorDaily);
    
    // Update vendor monthly earnings
    const vendorMonthlyKey = `vendor:${booking.vendorId}:earnings:monthly:${monthKey}`;
    const vendorMonthly = await kv.get(vendorMonthlyKey) || {
      month: monthKey,
      totalBookings: 0,
      totalRevenue: 0,
      totalEarnings: 0,
      platformFees: 0
    };
    vendorMonthly.totalBookings += 1;
    vendorMonthly.totalRevenue += booking.price;
    vendorMonthly.totalEarnings += vendorEarnings;
    vendorMonthly.platformFees += platformCommission;
    await kv.set(vendorMonthlyKey, vendorMonthly);
    
    // Update vendor lifetime earnings
    const vendorLifetimeKey = `vendor:${booking.vendorId}:earnings:lifetime`;
    const vendorLifetime = await kv.get(vendorLifetimeKey) || {
      totalBookings: 0,
      totalRevenue: 0,
      totalEarnings: 0,
      platformFees: 0
    };
    vendorLifetime.totalBookings += 1;
    vendorLifetime.totalRevenue += booking.price;
    vendorLifetime.totalEarnings += vendorEarnings;
    vendorLifetime.platformFees += platformCommission;
    await kv.set(vendorLifetimeKey, vendorLifetime);
    
    // If staff member completed it, update their earnings too
    if (staffId && staffId !== booking.vendorId) {
      // Update staff daily earnings
      const staffDailyKey = `staff:${staffId}:earnings:daily:${dateKey}`;
      const staffDaily = await kv.get(staffDailyKey) || {
        date: dateKey,
        totalBookings: 0,
        totalRevenue: 0
      };
      staffDaily.totalBookings += 1;
      staffDaily.totalRevenue += booking.price;
      await kv.set(staffDailyKey, staffDaily);
      
      // Update staff monthly earnings
      const staffMonthlyKey = `staff:${staffId}:earnings:monthly:${monthKey}`;
      const staffMonthly = await kv.get(staffMonthlyKey) || {
        month: monthKey,
        totalBookings: 0,
        totalRevenue: 0
      };
      staffMonthly.totalBookings += 1;
      staffMonthly.totalRevenue += booking.price;
      await kv.set(staffMonthlyKey, staffMonthly);
      
      // Update staff lifetime earnings
      const staffLifetimeKey = `staff:${staffId}:earnings:lifetime`;
      const staffLifetime = await kv.get(staffLifetimeKey) || {
        totalBookings: 0,
        totalRevenue: 0
      };
      staffLifetime.totalBookings += 1;
      staffLifetime.totalRevenue += booking.price;
      await kv.set(staffLifetimeKey, staffLifetime);
    }
    
    console.log(`💰 Earnings updated - Vendor: ₹${vendorEarnings.toFixed(2)}, Platform: ₹${platformCommission.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error updating earnings:', error);
  }
}

/**
 * GET /make-server-3dd53475/vendor/:vendorId/earnings
 * Get vendor earnings analytics
 */
app.get('/make-server-3dd53475/vendor/:vendorId/earnings', async (c) => {
  try {
    const { vendorId } = c.req.param();
    const { period = 'month' } = c.req.query(); // day, week, month, year, lifetime
    
    console.log(`\n💰 ===== GET VENDOR EARNINGS =====`);
    console.log(`🏢 Vendor ID: ${vendorId}`);
    console.log(`📊 Period: ${period}`);
    
    const now = new Date();
    let earnings: any = {};
    
    if (period === 'lifetime') {
      earnings = await kv.get(`vendor:${vendorId}:earnings:lifetime`) || {
        totalBookings: 0,
        totalRevenue: 0,
        totalEarnings: 0,
        platformFees: 0
      };
    } else if (period === 'month') {
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      earnings = await kv.get(`vendor:${vendorId}:earnings:monthly:${monthKey}`) || {
        month: monthKey,
        totalBookings: 0,
        totalRevenue: 0,
        totalEarnings: 0,
        platformFees: 0
      };
    } else if (period === 'day') {
      const dateKey = now.toISOString().split('T')[0];
      earnings = await kv.get(`vendor:${vendorId}:earnings:daily:${dateKey}`) || {
        date: dateKey,
        totalBookings: 0,
        totalRevenue: 0,
        totalEarnings: 0,
        platformFees: 0
      };
    }
    
    console.log(`✅ Earnings: ₹${earnings.totalEarnings || 0}`);
    
    return c.json({
      success: true,
      earnings,
      period
    });
    
  } catch (error) {
    console.error('❌ [GET-VENDOR-EARNINGS] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to get vendor earnings',
      message: String(error)
    }, 500);
  }
});

/**
 * GET /make-server-3dd53475/staff/:staffId/earnings
 * Get staff earnings analytics
 */
app.get('/make-server-3dd53475/staff/:staffId/earnings', async (c) => {
  try {
    const { staffId } = c.req.param();
    const { period = 'month' } = c.req.query();
    
    console.log(`\n💰 ===== GET STAFF EARNINGS =====`);
    console.log(`👤 Staff ID: ${staffId}`);
    console.log(`📊 Period: ${period}`);
    
    const now = new Date();
    let earnings: any = {};
    
    if (period === 'lifetime') {
      earnings = await kv.get(`staff:${staffId}:earnings:lifetime`) || {
        totalBookings: 0,
        totalRevenue: 0
      };
    } else if (period === 'month') {
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      earnings = await kv.get(`staff:${staffId}:earnings:monthly:${monthKey}`) || {
        month: monthKey,
        totalBookings: 0,
        totalRevenue: 0
      };
    } else if (period === 'day') {
      const dateKey = now.toISOString().split('T')[0];
      earnings = await kv.get(`staff:${staffId}:earnings:daily:${dateKey}`) || {
        date: dateKey,
        totalBookings: 0,
        totalRevenue: 0
      };
    }
    
    console.log(`✅ Earnings: ₹${earnings.totalRevenue || 0}`);
    
    return c.json({
      success: true,
      earnings,
      period
    });
    
  } catch (error) {
    console.error('❌ [GET-STAFF-EARNINGS] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to get staff earnings',
      message: String(error)
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/booking/:bookingId/start
 * Start a booking with START OTP (for trainers/walkers/behaviourists)
 */
app.post('/make-server-3dd53475/booking/:bookingId/start', async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { otp, staffId } = await c.req.json();
    
    console.log(`\n🟢 ===== START BOOKING =====`);
    console.log(`📋 Booking ID: ${bookingId}`);
    console.log(`🔐 START OTP: ${otp}`);
    console.log(`👤 Staff ID: ${staffId}`);
    
    // Get booking
    const booking = await kv.get(`booking:${bookingId}`);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // Check if booking requires START OTP
    if (!booking.requiresStartOTP) {
      return c.json({ success: false, error: 'This service does not require START OTP' }, 400);
    }
    
    // Verify START OTP
    if (booking.startOTP !== otp) {
      return c.json({ success: false, error: 'Invalid START OTP' }, 400);
    }
    
    // Check if already started
    if (booking.startTime) {
      return c.json({ success: false, error: 'Service already started' }, 400);
    }
    
    // Update booking
    const now = new Date().toISOString();
    booking.startTime = now;
    booking.status = 'in_progress';
    booking.updatedAt = now;
    
    if (staffId) {
      booking.actualStaffId = staffId;
    }
    
    await kv.set(`booking:${bookingId}`, booking);
    
    console.log(`✅ Booking started at: ${now}`);
    
    return c.json({
      success: true,
      message: 'Service started successfully',
      startTime: now,
      booking: booking
    });
    
  } catch (error) {
    console.error('❌ [START-BOOKING] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to start booking',
      message: String(error)
    }, 500);
  }
});

/**
 * POST /make-server-3dd53475/booking/:bookingId/occurrence/:occurrenceId/start
 * Start a package occurrence with START OTP
 */
app.post('/make-server-3dd53475/booking/:bookingId/occurrence/:occurrenceId/start', async (c) => {
  try {
    const { bookingId, occurrenceId } = c.req.param();
    const { otp, staffId } = await c.req.json();
    
    console.log(`\n🟢 ===== START OCCURRENCE =====`);
    console.log(`📋 Booking ID: ${bookingId}`);
    console.log(`📝 Occurrence ID: ${occurrenceId}`);
    console.log(`🔐 START OTP: ${otp}`);
    
    // Get occurrences
    const occurrences = await kv.get(`booking:${bookingId}:occurrences`) || [];
    const occurrenceIndex = occurrences.findIndex((o: any) => o.occurrenceId === occurrenceId);
    
    if (occurrenceIndex === -1) {
      return c.json({ success: false, error: 'Occurrence not found' }, 404);
    }
    
    const occurrence = occurrences[occurrenceIndex];
    
    // Check if occurrence requires START OTP
    if (!occurrence.requiresStartOTP) {
      return c.json({ success: false, error: 'This service does not require START OTP' }, 400);
    }
    
    // Verify START OTP
    if (occurrence.startOTP !== otp) {
      return c.json({ success: false, error: 'Invalid START OTP' }, 400);
    }
    
    // Check if already started
    if (occurrence.startTime) {
      return c.json({ success: false, error: 'Service already started' }, 400);
    }
    
    // Update occurrence
    const now = new Date().toISOString();
    occurrence.startTime = now;
    occurrence.status = 'in_progress';
    occurrence.updatedAt = now;
    
    if (staffId) {
      occurrence.actualStaffId = staffId;
    }
    
    occurrences[occurrenceIndex] = occurrence;
    await kv.set(`booking:${bookingId}:occurrences`, occurrences);
    
    // Update main booking
    const booking = await kv.get(`booking:${bookingId}`);
    booking.updatedAt = now;
    await kv.set(`booking:${bookingId}`, booking);
    
    console.log(`✅ Occurrence started at: ${now}`);
    
    return c.json({
      success: true,
      message: 'Service started successfully',
      startTime: now,
      occurrence: occurrence
    });
    
  } catch (error) {
    console.error('❌ [START-OCCURRENCE] Error:', error);
    return c.json({
      success: false,
      error: 'Failed to start occurrence',
      message: String(error)
    }, 500);
  }
});

export default app;