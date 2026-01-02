/**
 * BOOKING MANAGEMENT ENDPOINTS - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Booking lifecycle management, package occurrences, earnings tracking
 * 
 * Status: ✅ SQL-ONLY IMPLEMENTATION
 * KV Operations: 38 → 0
 */

import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';
import { getBookingsRepository } from '../../../supabase/lib/repositories/bookings';
import { getCustomersRepository } from '../../../supabase/lib/repositories/customers';
import { getVendorsRepository } from '../../../supabase/lib/repositories/vendors';
import { getVendorEarningsRepository } from '../../../supabase/lib/repositories/vendor-earnings';
import { calculateCommission } from '../../../supabase/lib/services/commission-calculator';
import { calculateDuration, validateDuration } from './service-category-helpers';

const client = getDbClient();

const app = new Hono();

/**
 * GET /make-server-3dd53475/customer/:phone/bookings
 * Get all bookings for a customer
 * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
 */
app.get('/make-server-3dd53475/customer/:phone/bookings', async (c) => {
  try {
    const { phone } = c.req.param();
    const cleanPhone = phone.replace(/\D/g, '');
    
    console.log(`\n📚 ===== GET CUSTOMER BOOKINGS =====`);
    console.log(`📞 Phone: ${cleanPhone}`);
    
    // ✅ SQL: Get customer by phone
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(cleanPhone);
    
    if (!customer) {
      return c.json({
        success: true,
        bookings: []
      });
    }
    
    // ✅ SQL: Get all bookings for customer
    const bookingsRepo = getBookingsRepository();
    const bookings = await bookingsRepo.findByCustomer(customer.id);
    
    // ✅ SQL: Load package occurrences from package_details JSONB
    const bookingsWithOccurrences = await Promise.all(bookings.map(async (booking) => {
      if (booking.is_package && booking.package_details) {
        const occurrences = booking.package_details.occurrences || [];
        
        // Calculate completed sessions
        const completedCount = occurrences.filter((o: any) => o.status === 'completed').length;
        
        return {
          ...booking,
          occurrences: occurrences,
          packageDetails: {
            ...booking.package_details,
            completedSessions: completedCount
          }
        };
      }
      return booking;
    }));
    
    // Sort by creation date (newest first)
    bookingsWithOccurrences.sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    console.log(`✅ Returning ${bookingsWithOccurrences.length} bookings`);
    
    return c.json({
      success: true,
      bookings: bookingsWithOccurrences
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
 * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
 */
app.post('/make-server-3dd53475/booking/:bookingId/occurrence/:occurrenceId/complete', async (c) => {
  try {
    const { bookingId, occurrenceId } = c.req.param();
    const { otp, staffId } = await c.req.json();
    
    console.log(`\n✅ ===== COMPLETE OCCURRENCE =====`);
    console.log(`📋 Booking ID: ${bookingId}`);
    console.log(`📝 Occurrence ID: ${occurrenceId}`);
    console.log(`🔐 OTP: ${otp}`);
    
    const bookingsRepo = getBookingsRepository();
    
    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Get occurrences from package_details JSONB
    const packageDetails = booking.package_details || {};
    const occurrences = packageDetails.occurrences || [];
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
    
    // ✅ SQL: Update booking with updated occurrences
    const updatedPackageDetails = {
      ...packageDetails,
      occurrences: occurrences
    };
    
    // Use direct client update for JSONB field
    await client
      .from('bookings')
      .update({ 
        package_details: updatedPackageDetails,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);
    
    // Check if all occurrences are completed
    const allCompleted = occurrences.every((o: any) => o.status === 'completed');
    
    if (allCompleted) {
      await bookingsRepo.update(bookingId, {
        status: 'completed',
        completed_at: new Date().toISOString()
      });
    }
    
    // ✅ SQL: Update earnings for vendor and staff
    await updateEarningsSQL(booking, staffId);
    
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
 * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
 */
app.post('/make-server-3dd53475/booking/:bookingId/complete', async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { otp, staffId } = await c.req.json();
    
    console.log(`\n✅ ===== COMPLETE BOOKING =====`);
    console.log(`📋 Booking ID: ${bookingId}`);
    console.log(`🔐 OTP: ${otp}`);
    
    const bookingsRepo = getBookingsRepository();
    
    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // Verify OTP (stored in otp_code or package_details)
    const bookingOTP = booking.otp_code || booking.package_details?.completionOTP;
    if (bookingOTP !== otp) {
      return c.json({ success: false, error: 'Invalid OTP' }, 400);
    }
    
    // ✅ SQL: Update booking status
    await bookingsRepo.update(bookingId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    // ✅ SQL: Update earnings
    await updateEarningsSQL(booking, staffId);
    
    console.log(`✅ Booking completed successfully`);
    
    // Get updated booking
    const updatedBooking = await bookingsRepo.findById(bookingId);
    
    return c.json({
      success: true,
      booking: updatedBooking,
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
 * Helper function to update earnings using SQL
 * ✅ SQL-ONLY: Uses calculateCommission and VendorEarningsRepository
 */
async function updateEarningsSQL(booking: any, staffId?: string) {
  try {
    const bookingsRepo = getBookingsRepository();
    const vendorsRepo = getVendorsRepository();
    const earningsRepo = getVendorEarningsRepository();
    
    // Get updated booking with total_amount
    const updatedBooking = await bookingsRepo.findById(booking.id);
    if (!updatedBooking) {
      console.error('Booking not found for earnings update');
      return;
    }
    
    const bookingAmount = updatedBooking.total_amount || updatedBooking.base_price || 0;
    
    // ✅ SQL: Calculate commission using CommissionCalculator
    const commissionCalc = await calculateCommission(
      updatedBooking.vendor_id || '',
      bookingAmount
    );
    
    const commissionRate = commissionCalc.commissionRate;
    const platformCommission = commissionCalc.commissionAmount;
    const vendorEarnings = commissionCalc.vendorAmount;
    
    // ✅ SQL: Create vendor earnings record
    await earningsRepo.create({
      vendor_id: updatedBooking.vendor_id || '',
      booking_id: updatedBooking.id,
      amount: vendorEarnings,
      commission_amount: platformCommission,
      total_amount: bookingAmount,
      commission_rate: commissionRate
    });
    
    // ✅ SQL: Update staff earnings if staff completed the booking
    if (staffId && staffId !== updatedBooking.vendor_id && updatedBooking.staff_id) {
      // Get vendor to determine if it's center-based
      const vendor = await vendorsRepo.findById(updatedBooking.vendor_id || '');
      const isCenterBased = vendor?.vendor_type === 'healthcare_provider' || 
                           vendor?.service_style === 'at_center' ||
                           vendor?.role_id === 'veterinary_clinic' ||
                           vendor?.role_id === 'pet_boarding' ||
                           vendor?.role_id === 'pet_resort' ||
                           vendor?.role_id === 'pet_cafe';
      
      // For center-based: Track full booking amount (center pays staff separately)
      // For solo vendors: Track vendor earnings percentage (actual staff payout)
      const staffRevenue = isCenterBased 
        ? bookingAmount // Full amount for tracking
        : vendorEarnings * 0.8; // 80% of vendor earnings for solo vendors
      
      // ✅ SQL: Store staff earnings breakdown in booking package_details
      const packageDetails = updatedBooking.package_details || {};
      const staffBreakup = packageDetails.staffBreakup || [];
      staffBreakup.push({
        bookingId: updatedBooking.id,
        bookingAmount: bookingAmount,
        vendorEarnings: vendorEarnings,
        platformCommission: platformCommission,
        staffRevenue: staffRevenue,
        isCenterBased: isCenterBased,
        commissionRate: commissionRate,
        completedAt: new Date().toISOString()
      });
      
      // Use direct client update for JSONB field
      await client
        .from('bookings')
        .update({ 
          package_details: {
            ...packageDetails,
            staffBreakup: staffBreakup
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedBooking.id);
    }
    
    console.log(`💰 Earnings updated - Vendor: ₹${vendorEarnings.toFixed(2)}, Platform: ₹${platformCommission.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error updating earnings:', error);
  }
}

/**
 * GET /make-server-3dd53475/vendor/:vendorId/earnings
 * Get vendor earnings analytics
 * ✅ SQL-ONLY: Uses SQL aggregation from vendor_earnings table
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
    
    // ✅ SQL: Aggregate earnings from vendor_earnings table
    if (period === 'lifetime') {
      const { data, error } = await client
        .from('vendor_earnings')
        .select('total_amount, amount, commission_amount')
        .eq('vendor_id', vendorId)
        .eq('status', 'settled');
      
      if (error) {
        throw error;
      }
      
      earnings = {
        totalBookings: data?.length || 0,
        totalRevenue: data?.reduce((sum, e) => sum + parseFloat(e.total_amount || '0'), 0) || 0,
        totalEarnings: data?.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0) || 0,
        platformFees: data?.reduce((sum, e) => sum + parseFloat(e.commission_amount || '0'), 0) || 0
      };
    } else if (period === 'month') {
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthStart = `${monthKey}-01`;
      const monthEnd = `${monthKey}-31`;
      
      const { data, error } = await client
        .from('vendor_earnings')
        .select('total_amount, amount, commission_amount, realized_at')
        .eq('vendor_id', vendorId)
        .eq('status', 'settled')
        .gte('realized_at', monthStart)
        .lte('realized_at', monthEnd);
      
      if (error) {
        throw error;
      }
      
      earnings = {
        month: monthKey,
        totalBookings: data?.length || 0,
        totalRevenue: data?.reduce((sum, e) => sum + parseFloat(e.total_amount || '0'), 0) || 0,
        totalEarnings: data?.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0) || 0,
        platformFees: data?.reduce((sum, e) => sum + parseFloat(e.commission_amount || '0'), 0) || 0
      };
    } else if (period === 'day') {
      const dateKey = now.toISOString().split('T')[0];
      
      const { data, error } = await client
        .from('vendor_earnings')
        .select('total_amount, amount, commission_amount, realized_at')
        .eq('vendor_id', vendorId)
        .eq('status', 'settled')
        .gte('realized_at', `${dateKey}T00:00:00`)
        .lte('realized_at', `${dateKey}T23:59:59`);
      
      if (error) {
        throw error;
      }
      
      earnings = {
        date: dateKey,
        totalBookings: data?.length || 0,
        totalRevenue: data?.reduce((sum, e) => sum + parseFloat(e.total_amount || '0'), 0) || 0,
        totalEarnings: data?.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0) || 0,
        platformFees: data?.reduce((sum, e) => sum + parseFloat(e.commission_amount || '0'), 0) || 0
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
 * ✅ SQL-ONLY: Uses SQL aggregation from bookings package_details
 */
app.get('/make-server-3dd53475/staff/:staffId/earnings', async (c) => {
  try {
    const { staffId } = c.req.param();
    const { period = 'month' } = c.req.query();
    
    console.log(`\n💰 ===== GET STAFF EARNINGS =====`);
    console.log(`👤 Staff ID: ${staffId}`);
    console.log(`📊 Period: ${period}`);
    
    const bookingsRepo = getBookingsRepository();
    const now = new Date();
    
    // ✅ SQL: Get all bookings completed by this staff
    const allBookings = await bookingsRepo.findAll({ status: 'completed' });
    
    // Filter bookings by staff_id and period
    let filteredBookings = allBookings.filter(b => b.staff_id === staffId);
    
    if (period === 'month') {
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      filteredBookings = filteredBookings.filter(b => {
        if (!b.completed_at) return false;
        const completedMonth = b.completed_at.substring(0, 7);
        return completedMonth === monthKey;
      });
    } else if (period === 'day') {
      const dateKey = now.toISOString().split('T')[0];
      filteredBookings = filteredBookings.filter(b => {
        if (!b.completed_at) return false;
        const completedDate = b.completed_at.split('T')[0];
        return completedDate === dateKey;
      });
    }
    
    // Calculate earnings from package_details.staffBreakup
    let totalRevenue = 0;
    let staffRevenue = 0;
    
    for (const booking of filteredBookings) {
      if (booking.package_details?.staffBreakup) {
        const breakups = booking.package_details.staffBreakup;
        for (const breakup of breakups) {
          totalRevenue += parseFloat(breakup.bookingAmount || '0');
          staffRevenue += parseFloat(breakup.staffRevenue || '0');
        }
      } else {
        // Fallback: use booking amount
        totalRevenue += parseFloat(booking.total_amount?.toString() || '0');
      }
    }
    
    const earnings: any = {
      totalBookings: filteredBookings.length,
      totalRevenue: totalRevenue,
      staffRevenue: staffRevenue
    };
    
    if (period === 'month') {
      earnings.month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (period === 'day') {
      earnings.date = now.toISOString().split('T')[0];
    }
    
    console.log(`✅ Earnings: ₹${staffRevenue || 0}`);
    
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
 * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
 */
app.post('/make-server-3dd53475/booking/:bookingId/start', async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { otp, staffId } = await c.req.json();
    
    console.log(`\n🟢 ===== START BOOKING =====`);
    console.log(`📋 Booking ID: ${bookingId}`);
    console.log(`🔐 START OTP: ${otp}`);
    console.log(`👤 Staff ID: ${staffId}`);
    
    const bookingsRepo = getBookingsRepository();
    
    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // Check if booking requires START OTP (stored in package_details)
    const packageDetails = booking.package_details || {};
    if (!packageDetails.requiresStartOTP) {
      return c.json({ success: false, error: 'This service does not require START OTP' }, 400);
    }
    
    // Verify START OTP (stored in package_details or otp_start_code)
    const startOTP = booking.otp_start_code || packageDetails.startOTP;
    if (startOTP !== otp) {
      return c.json({ success: false, error: 'Invalid START OTP' }, 400);
    }
    
    // Check if already started
    if (booking.started_at) {
      return c.json({ success: false, error: 'Service already started' }, 400);
    }
    
    // ✅ SQL: Update booking
    const now = new Date().toISOString();
    // Use direct client update for started_at and staff_id
    await client
      .from('bookings')
      .update({ 
        status: 'in_progress',
        started_at: now,
        staff_id: staffId || booking.staff_id,
        updated_at: now
      })
      .eq('id', bookingId);
    
    console.log(`✅ Booking started at: ${now}`);
    
    // Get updated booking
    const updatedBooking = await bookingsRepo.findById(bookingId);
    
    return c.json({
      success: true,
      message: 'Service started successfully',
      startTime: now,
      booking: updatedBooking
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
 * ✅ SQL-ONLY: All KV operations replaced with SQL repositories
 */
app.post('/make-server-3dd53475/booking/:bookingId/occurrence/:occurrenceId/start', async (c) => {
  try {
    const { bookingId, occurrenceId } = c.req.param();
    const { otp, staffId } = await c.req.json();
    
    console.log(`\n🟢 ===== START OCCURRENCE =====`);
    console.log(`📋 Booking ID: ${bookingId}`);
    console.log(`📝 Occurrence ID: ${occurrenceId}`);
    console.log(`🔐 START OTP: ${otp}`);
    
    const bookingsRepo = getBookingsRepository();
    
    // ✅ SQL: Get booking
    const booking = await bookingsRepo.findById(bookingId);
    if (!booking) {
      return c.json({ success: false, error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Get occurrences from package_details JSONB
    const packageDetails = booking.package_details || {};
    const occurrences = packageDetails.occurrences || [];
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
    
    // ✅ SQL: Update booking with updated occurrences
    await client
      .from('bookings')
      .update({ 
        package_details: {
          ...packageDetails,
          occurrences: occurrences
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);
    
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
