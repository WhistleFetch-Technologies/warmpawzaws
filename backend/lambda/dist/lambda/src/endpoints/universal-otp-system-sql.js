"use strict";
/**
 * ✅ UNIVERSAL OTP SYSTEM - SQL-ONLY VERSION
 * Production-ready OTP management for all services
 *
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * KV Operations: 21 → 0
 *
 * Generates OTPs for:
 * - Vet appointments
 * - Walker sessions
 * - Grooming sessions
 * - Training sessions
 * - Boarding check-in/out
 * - Home visits
 * - Meal delivery
 *
 * Only vendor with valid OTP can mark service as completed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUniversalOTPSystemSQL = registerUniversalOTPSystemSQL;
const database_schema_1 = require("./database-schema");
const db_1 = require("../lib/db");
const bookings_1 = require("../lib/repositories/bookings");
const vendors_1 = require("../lib/repositories/vendors");
const staff_1 = require("../lib/repositories/staff");
const pets_1 = require("../lib/repositories/pets");
const response_utils_1 = require("./response-utils");
function registerUniversalOTPSystemSQL(app) {
    const BASE = '/make-server-3dd53475';
    const client = (0, db_1.getDbClient)();
    const bookingsRepo = (0, bookings_1.getBookingsRepository)();
    const vendorsRepo = (0, vendors_1.getVendorsRepository)();
    const staffRepo = (0, staff_1.getStaffRepository)();
    const petsRepo = (0, pets_1.getPetsRepository)();
    // =============================================
    // GENERATE OTP FOR BOOKING/SESSION
    // =============================================
    function generateOTP() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }
    // =============================================
    // CREATE BOOKING WITH OTP
    // =============================================
    app.post(`${BASE}/bookings/create-with-otp`, async (c) => {
        try {
            const body = await c.req.json();
            const { customerId, vendorId, serviceType, // 'vet', 'grooming', 'training', 'walker', 'boarding', 'meal', 'home_visit'
            serviceId, staffId, scheduledDate, scheduledTime, petId, price, notes } = body;
            // Validation
            if (!customerId || !vendorId || !serviceType || !serviceId) {
                return (0, response_utils_1.sendError)(c, new Error('Customer, vendor, service type, and service ID are required'), 400);
            }
            await (0, db_1.withTransaction)(async () => {
                // Generate OTPs
                const startOTP = generateOTP();
                const endOTP = generateOTP();
                // ✅ SQL: Create booking with OTP codes
                const booking = await bookingsRepo.create({
                    customer_id: customerId,
                    vendor_id: vendorId,
                    staff_id: staffId || undefined,
                    service_id: serviceId,
                    booking_date: scheduledDate,
                    booking_time: scheduledTime,
                    service_type: serviceType === 'vet' ? 'at_vendor' : serviceType === 'home_visit' ? 'at_home' : 'at_vendor',
                    base_price: parseFloat(price || 0),
                    discount_amount: 0,
                    tax_amount: 0,
                    total_amount: parseFloat(price || 0),
                    payment_status: 'pending',
                    status: 'confirmed',
                    otp_start_code: startOTP,
                    otp_end_code: endOTP,
                    otp_start_verified: false,
                    otp_end_verified: false,
                    otp_start_attempts: 0,
                    otp_end_attempts: 0,
                    notes: notes || ''
                });
                console.log(`✅ [OTP] Created booking ${booking.id} with OTPs: ${startOTP}, ${endOTP}`);
                return (0, response_utils_1.sendSuccess)(c, {
                    success: true,
                    booking: {
                        ...booking,
                        // Return OTPs to customer
                        startOTP,
                        endOTP
                    },
                    message: 'Booking created successfully. Save your OTPs for service verification.'
                });
            });
        }
        catch (error) {
            console.error('[OTP] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // VERIFY OTP & START SERVICE
    // =============================================
    app.post(`${BASE}/bookings/:bookingId/verify-start`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { otp, vendorId, location } = await c.req.json();
            console.log(`[OTP] Verifying start OTP for booking: ${bookingId}`);
            await (0, db_1.withTransaction)(async () => {
                // ✅ SQL: Get booking
                const booking = await bookingsRepo.findById(bookingId);
                if (!booking) {
                    return (0, response_utils_1.sendError)(c, new Error('Booking not found'), 404);
                }
                // Verify vendor
                if (booking.vendor_id !== vendorId) {
                    return (0, response_utils_1.sendError)(c, new Error('Unauthorized vendor'), 403);
                }
                // Check if already started
                if (booking.otp_start_verified) {
                    return (0, response_utils_1.sendError)(c, new Error('Service already started'), 400);
                }
                // Verify OTP
                if (booking.otp_start_code !== otp) {
                    // Increment attempts
                    await bookingsRepo.update(bookingId, {
                        otp_start_attempts: (booking.otp_start_attempts || 0) + 1
                    });
                    return (0, response_utils_1.sendError)(c, new Error('Invalid OTP'), 400);
                }
                // Mark as started
                await bookingsRepo.update(bookingId, {
                    status: 'in_progress',
                    otp_start_verified: true,
                    started_at: new Date().toISOString()
                });
                console.log(`✅ [OTP] Service started: ${bookingId}`);
                const updatedBooking = await bookingsRepo.findById(bookingId);
                return (0, response_utils_1.sendSuccess)(c, {
                    success: true,
                    booking: updatedBooking,
                    message: 'Service started successfully'
                });
            });
        }
        catch (error) {
            console.error('[OTP] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // VERIFY OTP & END SERVICE
    // =============================================
    app.post(`${BASE}/bookings/:bookingId/verify-end`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { otp, vendorId, location, completionNotes, completionPhotos } = await c.req.json();
            console.log(`[OTP] Verifying end OTP for booking: ${bookingId}`);
            await (0, db_1.withTransaction)(async () => {
                // ✅ SQL: Get booking
                const booking = await bookingsRepo.findById(bookingId);
                if (!booking) {
                    return (0, response_utils_1.sendError)(c, new Error('Booking not found'), 404);
                }
                // Verify vendor
                if (booking.vendor_id !== vendorId) {
                    return (0, response_utils_1.sendError)(c, new Error('Unauthorized vendor'), 403);
                }
                // Check if service started
                if (!booking.otp_start_verified) {
                    return (0, response_utils_1.sendError)(c, new Error('Service not started yet'), 400);
                }
                // Check if already completed
                if (booking.otp_end_verified) {
                    return (0, response_utils_1.sendError)(c, new Error('Service already completed'), 400);
                }
                // Verify OTP
                if (booking.otp_end_code !== otp) {
                    // Increment attempts
                    await bookingsRepo.update(bookingId, {
                        otp_end_attempts: (booking.otp_end_attempts || 0) + 1
                    });
                    return (0, response_utils_1.sendError)(c, new Error('Invalid OTP'), 400);
                }
                // Calculate duration
                const startTime = booking.started_at ? new Date(booking.started_at).getTime() : Date.now();
                const endTime = Date.now();
                const durationMinutes = Math.floor((endTime - startTime) / 60000);
                // Mark as completed
                await bookingsRepo.update(bookingId, {
                    status: 'completed',
                    otp_end_verified: true,
                    completed_at: new Date().toISOString(),
                    notes: completionNotes || booking.notes || ''
                });
                // Log to pet profile if petId exists
                if (booking.pet_id) {
                    await logToPetProfile(booking.pet_id, booking.service_type, booking, completionNotes, completionPhotos, durationMinutes);
                }
                console.log(`✅ [OTP] Service completed: ${bookingId}`);
                const updatedBooking = await bookingsRepo.findById(bookingId);
                return (0, response_utils_1.sendSuccess)(c, {
                    success: true,
                    booking: updatedBooking,
                    message: 'Service completed successfully'
                });
            });
        }
        catch (error) {
            console.error('[OTP] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // GET BOOKING DETAILS (Customer & Vendor)
    // =============================================
    app.get(`${BASE}/bookings/:bookingId`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const userId = c.req.query('userId');
            const userType = c.req.query('userType'); // 'customer' or 'vendor'
            // ✅ SQL: Get booking
            const booking = await bookingsRepo.findById(bookingId);
            if (!booking) {
                return (0, response_utils_1.sendError)(c, new Error('Booking not found'), 404);
            }
            // Verify access
            if (userType === 'customer' && booking.customer_id !== userId) {
                return (0, response_utils_1.sendError)(c, new Error('Unauthorized'), 403);
            }
            if (userType === 'vendor' && booking.vendor_id !== userId) {
                return (0, response_utils_1.sendError)(c, new Error('Unauthorized'), 403);
            }
            // ✅ SQL: Get vendor details
            const vendor = booking.vendor_id ? await vendorsRepo.findById(booking.vendor_id) : null;
            // ✅ SQL: Get staff details if assigned
            let staff = null;
            if (booking.staff_id) {
                staff = await staffRepo.findById(booking.staff_id);
            }
            // ✅ SQL: Get pet details if exists
            let pet = null;
            if (booking.pet_id) {
                pet = await petsRepo.findById(booking.pet_id);
            }
            return (0, response_utils_1.sendSuccess)(c, {
                success: true,
                booking: {
                    ...booking,
                    // Only show OTPs to customer
                    showOTPs: userType === 'customer',
                    otps: userType === 'customer' ? {
                        start: booking.otp_start_code,
                        end: booking.otp_end_code,
                        startUsed: booking.otp_start_verified,
                        endUsed: booking.otp_end_verified
                    } : null
                },
                vendor: vendor ? {
                    id: vendor.id,
                    businessName: vendor.business_name,
                    phone: vendor.phone,
                    address: vendor.address
                } : null,
                staff: staff ? {
                    id: staff.id,
                    name: staff.fullName,
                    photo: staff.photo,
                    phone: staff.phone
                } : null,
                pet: pet ? {
                    id: pet.id,
                    name: pet.name,
                    breed: pet.breed,
                    photo: pet.photo_url
                } : null
            });
        }
        catch (error) {
            console.error('[OTP] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // GET VENDOR'S TODAY BOOKINGS
    // =============================================
    app.get(`${BASE}/vendor/:vendorId/today-bookings`, async (c) => {
        try {
            const { vendorId } = c.req.param();
            const today = new Date().toISOString().split('T')[0];
            // ✅ SQL: Get today's bookings for vendor
            const bookings = await bookingsRepo.findByVendorAndDate(vendorId, today);
            const todayBookings = [];
            for (const booking of bookings) {
                // ✅ SQL: Get customer details
                const pool = await (0, db_1.getDbClient)();
                const customersResult = await pool.query('SELECT id, full_name, phone FROM customers WHERE id = $1', [booking.customer_id]);
                const customer = customersResult.rows[0] || null;
                // ✅ SQL: Get pet details
                let pet = null;
                if (booking.pet_id) {
                    pet = await petsRepo.findById(booking.pet_id);
                }
                todayBookings.push({
                    ...booking,
                    customerName: customer?.full_name || 'Unknown',
                    customerPhone: customer?.phone || '',
                    petName: pet?.name || '',
                    petBreed: pet?.breed || ''
                });
            }
            // Sort by time
            todayBookings.sort((a, b) => {
                const timeA = a.booking_time || '00:00';
                const timeB = b.booking_time || '00:00';
                return timeA.localeCompare(timeB);
            });
            return (0, response_utils_1.sendSuccess)(c, {
                success: true,
                bookings: todayBookings,
                total: todayBookings.length,
                pending: todayBookings.filter(b => b.status === 'confirmed').length,
                inProgress: todayBookings.filter(b => b.status === 'in_progress').length,
                completed: todayBookings.filter(b => b.status === 'completed').length
            });
        }
        catch (error) {
            console.error('[OTP] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // =============================================
    // CANCEL BOOKING
    // =============================================
    app.post(`${BASE}/bookings/:bookingId/cancel`, async (c) => {
        try {
            const { bookingId } = c.req.param();
            const { userId, userType, reason } = await c.req.json();
            await (0, db_1.withTransaction)(async () => {
                // ✅ SQL: Get booking
                const booking = await bookingsRepo.findById(bookingId);
                if (!booking) {
                    return (0, response_utils_1.sendError)(c, new Error('Booking not found'), 404);
                }
                // Verify access
                if (userType === 'customer' && booking.customer_id !== userId) {
                    return (0, response_utils_1.sendError)(c, new Error('Unauthorized'), 403);
                }
                if (userType === 'vendor' && booking.vendor_id !== userId) {
                    return (0, response_utils_1.sendError)(c, new Error('Unauthorized'), 403);
                }
                // Cannot cancel if in progress or completed
                if (booking.status === 'in_progress' || booking.status === 'completed') {
                    return (0, response_utils_1.sendError)(c, new Error('Cannot cancel active or completed booking'), 400);
                }
                // ✅ SQL: Update booking status
                await bookingsRepo.update(bookingId, {
                    status: 'cancelled',
                    cancellation_reason: reason || '',
                    cancelled_at: new Date().toISOString()
                });
                const updatedBooking = await bookingsRepo.findById(bookingId);
                return (0, response_utils_1.sendSuccess)(c, {
                    success: true,
                    booking: updatedBooking,
                    message: 'Booking cancelled successfully'
                });
            });
        }
        catch (error) {
            console.error('[OTP] Error:', error);
            return (0, response_utils_1.sendError)(c, error, 500);
        }
    });
    // Helper function to log to pet profile
    async function logToPetProfile(petId, serviceType, booking, notes, photos, duration) {
        try {
            // ✅ SQL: Get pet
            const pet = await petsRepo.findById(petId);
            if (!pet)
                return;
            // ✅ SQL: Update pet's medical_history JSONB field with service log
            const medicalHistory = pet.medical_conditions || {};
            if (!medicalHistory.serviceHistory) {
                medicalHistory.serviceHistory = [];
            }
            const logEntry = {
                id: (0, database_schema_1.generateId)('log'),
                bookingId: booking.id,
                serviceType,
                date: booking.completed_at || new Date().toISOString(),
                duration,
                vendorId: booking.vendor_id,
                staffId: booking.staff_id,
                notes: notes || '',
                photos: photos || [],
                location: null
            };
            medicalHistory.serviceHistory.push(logEntry);
            medicalHistory.lastServiceDate = booking.completed_at || new Date().toISOString();
            // ✅ SQL: Update pet
            await petsRepo.update(petId, {
                medical_conditions: medicalHistory
            });
            console.log(`✅ Logged service to pet profile: ${petId}`);
        }
        catch (error) {
            console.error('Error logging to pet profile:', error);
        }
    }
    console.log('✅ Universal OTP System (SQL-only) registered');
}
//# sourceMappingURL=universal-otp-system-sql.js.map