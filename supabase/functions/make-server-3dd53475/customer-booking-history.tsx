/**
 * ============================================================================
 * CUSTOMER BOOKING HISTORY ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Date: 2025-01-23
 * Migration: Phase 2 - Customer Journey
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getPrescriptionsRepository } from '../../lib/repositories/prescriptions.ts';
import { normalizePhone } from './phone-utils.tsx';

export function registerCustomerBookingHistory(app: Hono) {
  console.log('✅ Registering Customer Booking History Endpoints (SQL-only)...');

/**
 * GET /make-server-3dd53475/customer/bookings/history/:phone
 * Get all bookings for a customer by phone number
 * 
 * ✅ MIGRATED: Uses SQL repository instead of KV
 */
app.get("/make-server-3dd53475/customer/bookings/history/:phone", async (c) => {
  try {
    const { phone } = c.req.param();
    const cleanPhone = normalizePhone(phone);
    
    console.log(`📚 [BOOKING-HISTORY] Fetching bookings for customer: ${cleanPhone}`);
    
    // ✅ SQL: Get customer by phone
    const customer = await getCustomersRepository().findByPhone(cleanPhone);
    
    if (!customer) {
      return c.json({
        success: true,
        bookings: [],
        total: 0,
        message: 'Customer not found'
      });
    }
    
    // ✅ SQL: Get all bookings for customer
    const bookings = await getBookingsRepository().findByCustomer(customer.id);
    
    console.log(`✅ [BOOKING-HISTORY] Found ${bookings.length} bookings`);
    
    // Sort by date (newest first)
    bookings.sort((a, b) => {
      const dateA = new Date(a.created_at || a.booking_date).getTime();
      const dateB = new Date(b.created_at || b.booking_date).getTime();
      return dateB - dateA;
    });
    
    // Map to response format
    const mappedBookings = bookings.map(booking => ({
      id: booking.id,
      bookingId: booking.id,
      customerId: booking.customer_id,
      vendorId: booking.vendor_id,
      serviceId: booking.service_id,
      status: booking.status,
      paymentStatus: booking.payment_status,
      bookingDate: booking.booking_date,
      bookingTime: booking.booking_time,
      serviceType: booking.service_type,
      totalAmount: booking.total_amount,
      basePrice: booking.base_price,
      createdAt: booking.created_at,
      completedAt: booking.completed_at,
    }));
    
    // Group by status for statistics
    const stats = {
      total: mappedBookings.length,
      confirmed: mappedBookings.filter(b => b.status === 'confirmed').length,
      inProgress: mappedBookings.filter(b => b.status === 'in_progress').length,
      completed: mappedBookings.filter(b => b.status === 'completed').length,
      cancelled: mappedBookings.filter(b => b.status === 'cancelled').length,
    };
    
    return c.json({
      success: true,
      bookings: mappedBookings,
      stats,
      total: mappedBookings.length
    });
    
  } catch (error) {
    console.error('❌ [BOOKING-HISTORY] Error fetching customer bookings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/bookings/follow-up-eligible/:phone
 * Get bookings eligible for follow-up (completed within 7 days)
 * 
 * ✅ MIGRATED: Uses SQL repository instead of KV
 */
app.get("/make-server-3dd53475/customer/bookings/follow-up-eligible/:phone", async (c) => {
  try {
    const { phone } = c.req.param();
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🔄 [FOLLOW-UP-ELIGIBLE] Checking follow-up eligible bookings for: ${cleanPhone}`);
    
    // ✅ SQL: Get customer by phone
    const customer = await getCustomersRepository().findByPhone(cleanPhone);
    
    if (!customer) {
      return c.json({
        success: true,
        bookings: [],
        total: 0
      });
    }
    
    // ✅ SQL: Get completed bookings for customer
    const allBookings = await getBookingsRepository().findByCustomer(customer.id);
    const completedBookings = allBookings.filter(b => b.status === 'completed' && b.completed_at);
    
    // Filter for eligible ones (completed within 7 days)
    const eligibleBookings = [];
    const now = new Date();
    
    for (const booking of completedBookings) {
      if (!booking.completed_at) continue;
      
      const completed = new Date(booking.completed_at);
      const daysSinceCompletion = Math.floor((now.getTime() - completed.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceCompletion < 0 || daysSinceCompletion > 7) {
        continue;
      }
      
      // ✅ SQL: Get vendor details
      const vendor = booking.vendor_id ? await getVendorsRepository().findById(booking.vendor_id) : null;
      
      // ✅ SQL: Get prescription if exists
      let prescription = null;
      try {
        if (booking.id) {
          const prescriptions = await getPrescriptionsRepository().getByBookingId(booking.id, customer.id, 'customer');
          prescription = prescriptions && prescriptions.length > 0 ? prescriptions[0] : null;
        }
      } catch (prescriptionError) {
        console.warn(`⚠️ [FOLLOW-UP-ELIGIBLE] Error fetching prescription for booking ${booking.id}:`, prescriptionError);
        // Continue without prescription data
      }
      
      eligibleBookings.push({
        bookingId: booking.id,
        serviceName: booking.service_type || 'Service',
        serviceType: booking.service_type,
        serviceStyle: booking.service_type,
        vendorId: booking.vendor_id,
        vendorName: vendor?.business_name || vendor?.owner_name || 'Vendor',
        vendorPhone: vendor?.phone || null,
        customerPhone: customer.phone,
        customerName: customer.full_name || 'Customer',
        petId: booking.pet_id || null,
        petName: null, // TODO: Get from pets table if needed
        scheduledDate: booking.booking_date,
        scheduledTime: booking.booking_time,
        completedAt: booking.completed_at,
        completedDate: booking.completed_at,
        daysAgo: daysSinceCompletion,
        daysRemaining: 7 - daysSinceCompletion,
        hasPrescription: !!prescription,
        prescriptionUrl: prescription?.prescription_file_url || null,
        prescriptionId: prescription?.id || null,
        prescriptionNotes: prescription?.general_notes || null
      });
    }
    
    // Sort by completion date (most recent first)
    eligibleBookings.sort((a, b) => {
      return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
    });
    
    console.log(`✅ [FOLLOW-UP-ELIGIBLE] Found ${eligibleBookings.length} eligible bookings`);
    
    return c.json({
      success: true,
      bookings: eligibleBookings,
      total: eligibleBookings.length
    });
    
  } catch (error) {
    console.error('❌ [FOLLOW-UP-ELIGIBLE] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/bookings/pet/:phone/:petId
 * Get all bookings for a specific pet
 * 
 * ✅ MIGRATED: Uses SQL repository instead of KV
 */
app.get("/make-server-3dd53475/customer/bookings/pet/:phone/:petId", async (c) => {
  try {
    const { phone, petId } = c.req.param();
    const cleanPhone = normalizePhone(phone);
    
    console.log(`🐾 [PET-BOOKING-HISTORY] Fetching bookings for pet: ${petId}`);
    
    // ✅ SQL: Get customer by phone
    const customer = await getCustomersRepository().findByPhone(cleanPhone);
    
    if (!customer) {
      return c.json({
        success: true,
        bookings: [],
        total: 0,
        message: 'Customer not found'
      });
    }
    
    // ✅ SQL: Get all bookings for customer, filter by pet_id
    const allBookings = await getBookingsRepository().findByCustomer(customer.id);
    const petBookings = allBookings.filter(b => b.pet_id === petId);
    
    console.log(`✅ [PET-BOOKING-HISTORY] Found ${petBookings.length} bookings for pet ${petId}`);
    
    // Sort by date (newest first)
    petBookings.sort((a, b) => {
      const dateA = new Date(a.created_at || a.booking_date).getTime();
      const dateB = new Date(b.created_at || b.booking_date).getTime();
      return dateB - dateA;
    });
    
    // Map to response format
    const mappedBookings = petBookings.map(booking => ({
      id: booking.id,
      bookingId: booking.id,
      customerId: booking.customer_id,
      vendorId: booking.vendor_id,
      serviceId: booking.service_id,
      petId: booking.pet_id,
      status: booking.status,
      paymentStatus: booking.payment_status,
      bookingDate: booking.booking_date,
      bookingTime: booking.booking_time,
      serviceType: booking.service_type,
      totalAmount: booking.total_amount,
      createdAt: booking.created_at,
      completedAt: booking.completed_at,
    }));
    
    // Group by status
    const stats = {
      total: mappedBookings.length,
      confirmed: mappedBookings.filter(b => b.status === 'confirmed').length,
      inProgress: mappedBookings.filter(b => b.status === 'in_progress').length,
      completed: mappedBookings.filter(b => b.status === 'completed').length,
      cancelled: mappedBookings.filter(b => b.status === 'cancelled').length,
    };
    
    return c.json({
      success: true,
      bookings: mappedBookings,
      stats,
      total: mappedBookings.length
    });
    
  } catch (error) {
    console.error('❌ [PET-BOOKING-HISTORY] Error fetching pet bookings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/bookings/:bookingId
 * Get detailed information for a specific booking
 * 
 * ✅ MIGRATED: Uses SQL repository instead of KV
 */
app.get("/make-server-3dd53475/customer/bookings/:bookingId", async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    console.log(`🔍 [BOOKING-DETAIL] Fetching booking: ${bookingId}`);
    
    // ✅ SQL: Get booking from repository
    const booking = await getBookingsRepository().findById(bookingId);
    
    if (!booking) {
      console.log(`❌ Booking not found: ${bookingId}`);
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // ✅ SQL: Get related data
    const vendor = booking.vendor_id ? await getVendorsRepository().findById(booking.vendor_id) : null;
    const customer = await getCustomersRepository().findById(booking.customer_id);
    const prescriptions = await getPrescriptionsRepository().getByBookingId(bookingId, booking.customer_id, 'customer');
    
    // Map to response format with complete information
    const bookingDetail = {
      id: booking.id,
      bookingId: booking.id,
      customerId: booking.customer_id,
      vendorId: booking.vendor_id,
      serviceId: booking.service_id,
      petId: booking.pet_id,
      status: booking.status,
      paymentStatus: booking.payment_status,
      bookingDate: booking.booking_date,
      bookingTime: booking.booking_time,
      serviceType: booking.service_type,
      address: booking.address,
      city: booking.city,
      state: booking.state,
      totalAmount: booking.total_amount,
      basePrice: booking.base_price,
      discountAmount: booking.discount_amount,
      taxAmount: booking.tax_amount,
      notes: booking.notes,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
      completedAt: booking.completed_at,
      // Related data
      vendor: vendor ? {
        id: vendor.id,
        vendorId: vendor.vendor_id,
        businessName: vendor.business_name,
        ownerName: vendor.owner_name,
        phone: vendor.phone,
        email: vendor.email,
        address: vendor.address
      } : null,
      customer: customer ? {
        id: customer.id,
        customerId: customer.customer_id,
        fullName: customer.full_name,
        phone: customer.phone,
        email: customer.email
      } : null,
      prescriptions: prescriptions.map(p => ({
        id: p.id,
        prescriptionNumber: p.prescription_number,
        diagnosis: p.diagnosis,
        medications: p.medications,
        createdAt: p.created_at
      }))
    };
    
    console.log(`✅ [BOOKING-DETAIL] Found booking: ${booking.id}`);
    
    return c.json({
      success: true,
      booking: bookingDetail
    });
    
  } catch (error) {
    console.error('❌ [BOOKING-DETAIL] Error fetching booking:', error);
    return c.json({ error: String(error) }, 500);
  }
});


}
