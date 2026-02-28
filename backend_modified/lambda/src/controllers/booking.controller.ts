/**
 * ============================================================================
 * BOOKING CONTROLLERS
 * ============================================================================
 * 
 * Extracted from:
 * - endpoints/bookings.ts
 * - endpoints/bookings-enhanced.ts
 * - endpoints/booking-details-enhanced.ts
 * - endpoints/customer-booking-history.ts
 * - endpoints/vendor-bookings.ts
 * - endpoints/vendor-booking-actions.ts
 * - endpoints/package-booking.ts
 * - endpoints/subscription-booking.ts
 * 
 * Date: 2026-01-28
 * Controller extraction migration
 * ============================================================================
 */

import { Context } from 'hono';
import { randomUUID } from 'crypto';
import { select, insert, update, query } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds, parseSelectedServices, buildBookingResponse } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { BaseHandlerEnhanced } from '../handler/base-handler-enhanced';
import { getDiscoveryRules } from '../lib/rule-engine';

// ============================================================================
// CUSTOMER BOOKING HISTORY HANDLERS (from customer-booking-history.ts)
// ============================================================================

export async function getCustomerBookings(c: Context) {
  try {
    let { customerId } = c.req.param();
    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);
    if (!isUUID) {
      const customers = await select('customers', { phone: customerId });
      if (customers.length > 0) {
        customerId = customers[0].id;
      } else {
        return c.json({
          success: true,
          bookings: [],
          stats: { total: 0, confirmed: 0, inProgress: 0, completed: 0, cancelled: 0 },
          total: 0
        });
      }
    }

    let bookingQuery = `
      SELECT b.*,
             v.business_name as vendor_name,
             v.phone as vendor_phone,
             v.city as vendor_city,
             s.name as service_name,
             s.category as service_category
      FROM bookings b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      LEFT JOIN services s ON b.service_id = s.id
      WHERE b.customer_id = $1
    `;

    const params: any[] = [customerId];
    let paramIndex = 2;

    if (status) {
      bookingQuery += ` AND b.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    bookingQuery += ` ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const bookings = await query(bookingQuery, params);

    const statsQuery = await query(
      `SELECT 
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
         COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
       FROM bookings
       WHERE customer_id = $1`,
      [customerId]
    );

    const stats = statsQuery.rows[0];

    return c.json({
      success: true,
      bookings: bookings.rows.map((b: any) => ({
        id: b.id,
        bookingId: b.id,
        customerId: b.customer_id,
        vendorId: b.vendor_id,
        vendorName: b.vendor_name,
        vendorPhone: b.vendor_phone,
        vendorCity: b.vendor_city,
        serviceId: b.service_id,
        serviceName: b.service_name,
        serviceCategory: b.service_category,
        status: b.status,
        paymentStatus: b.payment_status,
        bookingDate: b.booking_date,
        bookingTime: b.booking_time,
        serviceType: b.service_type,
        serviceStyle: b.service_style || b.service_type,
        totalAmount: b.total_amount,
        basePrice: b.base_price,
        discountAmount: b.discount_amount,
        createdAt: b.created_at,
        completedAt: b.completed_at,
        cancelledAt: b.cancelled_at,
        otpCode: b.otp_code,
        otpVerified: b.otp_verified,
        otpExpiresAt: b.otp_expires_at,
        cancellationReason: b.cancellation_reason,
        rescheduledFromBookingId: b.rescheduled_from_booking_id,
        notes: b.notes,
        selectedServices: parseSelectedServices(b.selected_services),
        selected_services: b.selected_services,
        totalDurationMinutes: b.total_duration_minutes != null ? Number(b.total_duration_minutes) : undefined,
      })),
      stats: {
        total: parseInt(stats?.total || '0', 10),
        confirmed: parseInt(stats?.confirmed || '0', 10),
        inProgress: parseInt(stats?.in_progress || '0', 10),
        completed: parseInt(stats?.completed || '0', 10),
        cancelled: parseInt(stats?.cancelled || '0', 10),
      },
      total: bookings.rows.length,
    });
  } catch (error: any) {
    console.error('Error fetching customer bookings:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function getBookingDetails(c: Context) {
  try {
    const { bookingId } = c.req.param();

    const bookingQuery = await query(
      `SELECT b.*,
              v.business_name as vendor_name,
              v.owner_name as vendor_owner,
              v.phone as vendor_phone,
              v.email as vendor_email,
              v.address as vendor_address,
              v.city as vendor_city,
              v.state as vendor_state,
              v.pincode as vendor_pincode,
              s.name as service_name,
              s.description as service_description,
              s.category as service_category,
              s.duration_minutes as service_duration,
              st.name as staff_name,
              st.phone as staff_phone,
              p.id as pet_id_from_table,
              p.name as pet_name_from_table,
              p.species as pet_species_from_table,
              p.breed as pet_breed_from_table,
              p.age_years as pet_age_from_table,
              p.weight_kg as pet_weight_from_table,
              p.profile_photo_url as pet_photo_from_table
       FROM bookings b
       LEFT JOIN vendors v ON b.vendor_id = v.id
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN staff st ON b.staff_id = st.id
       LEFT JOIN LATERAL (
         SELECT id, name, species, breed, age_years, weight_kg, profile_photo_url
         FROM pets
         WHERE (
           (b.notes IS NOT NULL AND b.notes LIKE '%Pet ID:%' AND id::text = SUBSTRING(b.notes FROM 'Pet ID:\\s*([a-f0-9-]+)'))
         )
         LIMIT 1
       ) p ON true
       WHERE b.id = $1`,
      [bookingId]
    );

    if (bookingQuery.rows.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookingQuery.rows[0];

    let petIdToUse = booking.pet_id || booking.pet_id_from_table;
    if (!petIdToUse && booking.notes) {
      const petIdMatch = booking.notes.match(/Pet ID:\s*([a-f0-9-]{36})/i);
      if (petIdMatch) {
        petIdToUse = petIdMatch[1];
      }
    }

    const prescriptions = await query(
      'SELECT * FROM prescriptions WHERE booking_id = $1',
      [bookingId]
    );

    const reviews = await query(
      'SELECT * FROM reviews WHERE booking_id = $1 AND customer_id = $2',
      [bookingId, booking.customer_id]
    );

    return c.json({
      success: true,
      booking: {
        id: booking.id,
        customerId: booking.customer_id,
        customer_id: booking.customer_id,
        vendorId: booking.vendor_id,
        vendor_id: booking.vendor_id,
        staffId: booking.staff_id || null,
        staff_id: booking.staff_id || null,
        petId: petIdToUse || null,
        pet_id: petIdToUse || null,
        serviceId: booking.service_id,
        service_id: booking.service_id,
        vendor: {
          id: booking.vendor_id,
          businessName: booking.vendor_name,
          ownerName: booking.vendor_owner,
          phone: booking.vendor_phone,
          email: booking.vendor_email,
          address: booking.vendor_address,
          city: booking.vendor_city,
          state: booking.vendor_state,
          pincode: booking.vendor_pincode,
        },
        service: {
          id: booking.service_id,
          name: booking.service_name,
          description: booking.service_description,
          category: booking.service_category,
          duration: booking.service_duration,
        },
        staff: booking.staff_id ? {
          id: booking.staff_id,
          name: booking.staff_name,
          phone: booking.staff_phone,
        } : null,
        pet: (booking.pet_id_from_table || petIdToUse) ? {
          id: booking.pet_id_from_table || petIdToUse,
          name: booking.pet_name_from_table,
          species: booking.pet_species_from_table,
          breed: booking.pet_breed_from_table,
          age: booking.pet_age_from_table,
          weight: booking.pet_weight_from_table,
          photo_url: booking.pet_photo_from_table,
        } : null,
        petName: booking.pet_name_from_table || null,
        petBreed: booking.pet_breed_from_table || null,
        petType: booking.pet_species_from_table || null,
        petAge: booking.pet_age_from_table || null,
        petPhoto: booking.pet_photo_from_table || null,
        status: booking.status,
        paymentStatus: booking.payment_status,
        bookingDate: booking.booking_date,
        booking_date: booking.booking_date,
        bookingTime: booking.booking_time,
        booking_time: booking.booking_time,
        scheduledDate: booking.booking_date,
        scheduledTime: booking.booking_time,
        schedule: booking.booking_time,
        startDate: booking.booking_date,
        address: booking.address,
        city: booking.city,
        state: booking.state,
        pincode: booking.pincode,
        notes: booking.notes,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        prescription: prescriptions.rows.length > 0 ? prescriptions.rows[0] : null,
        review: reviews.rows.length > 0 ? reviews.rows[0] : null,
        selectedServices: parseSelectedServices(booking.selected_services).length > 0 ? parseSelectedServices(booking.selected_services) : undefined,
        totalDurationMinutes: booking.total_duration_minutes != null ? Number(booking.total_duration_minutes) : undefined,
        amount: booking.total_amount != null ? parseFloat(booking.total_amount) : undefined,
        total_amount: booking.total_amount != null ? parseFloat(booking.total_amount) : undefined,
        totalAmount: booking.total_amount != null ? parseFloat(booking.total_amount) : undefined,
        price: booking.total_amount != null ? parseFloat(booking.total_amount) : (booking.base_price != null ? parseFloat(booking.base_price) : undefined),
        base_price: booking.base_price != null ? parseFloat(booking.base_price) : undefined,
      }
    });
  } catch (error: any) {
    console.error('Error fetching booking:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function getCustomerBookingDetails(c: Context) {
  try {
    const { customerId, bookingId } = c.req.param();

    const bookingQuery = await query(
      `SELECT b.*,
              v.business_name as vendor_name,
              v.owner_name as vendor_owner,
              v.phone as vendor_phone,
              v.email as vendor_email,
              v.address as vendor_address,
              v.city as vendor_city,
              v.state as vendor_state,
              v.pincode as vendor_pincode,
              s.name as service_name,
              s.description as service_description,
              s.category as service_category,
              s.duration_minutes as service_duration,
              st.name as staff_name,
              st.phone as staff_phone,
              p.id as pet_id_from_table,
              p.name as pet_name_from_table,
              p.species as pet_species_from_table,
              p.breed as pet_breed_from_table,
              p.age_years as pet_age_from_table,
              p.weight_kg as pet_weight_from_table,
              p.profile_photo_url as pet_photo_from_table
       FROM bookings b
       LEFT JOIN vendors v ON b.vendor_id = v.id
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN staff st ON b.staff_id = st.id
       LEFT JOIN LATERAL (
         SELECT id, name, species, breed, age_years, weight_kg, profile_photo_url
         FROM pets
         WHERE (
           (b.notes IS NOT NULL AND b.notes LIKE '%Pet ID:%' AND id::text = SUBSTRING(b.notes FROM 'Pet ID:\\s*([a-f0-9-]+)'))
         )
         LIMIT 1
       ) p ON true
       WHERE b.id = $1 AND b.customer_id = $2`,
      [bookingId, customerId]
    );

    if (bookingQuery.rows.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookingQuery.rows[0];

    let petIdToUse = booking.pet_id || booking.pet_id_from_table;
    if (!petIdToUse && booking.notes) {
      const petIdMatch = booking.notes.match(/Pet ID:\s*([a-f0-9-]{36})/i);
      if (petIdMatch) {
        petIdToUse = petIdMatch[1];
      }
    }

    const prescriptions = await query(
      'SELECT * FROM prescriptions WHERE booking_id = $1',
      [bookingId]
    );

    const reviews = await query(
      'SELECT * FROM reviews WHERE booking_id = $1 AND customer_id = $2',
      [bookingId, customerId]
    );

    return c.json({
      success: true,
      booking: {
        id: booking.id,
        customerId: booking.customer_id,
        customer_id: booking.customer_id,
        vendorId: booking.vendor_id,
        vendor_id: booking.vendor_id,
        staffId: booking.staff_id || null,
        staff_id: booking.staff_id || null,
        petId: petIdToUse || null,
        pet_id: petIdToUse || null,
        serviceId: booking.service_id,
        service_id: booking.service_id,
        vendor: {
          id: booking.vendor_id,
          businessName: booking.vendor_name,
          ownerName: booking.vendor_owner,
          phone: booking.vendor_phone,
          email: booking.vendor_email,
          address: booking.vendor_address,
          city: booking.vendor_city,
          state: booking.vendor_state,
          pincode: booking.vendor_pincode,
        },
        service: {
          id: booking.service_id,
          name: booking.service_name,
          description: booking.service_description,
          category: booking.service_category,
          duration: booking.service_duration,
        },
        staff: booking.staff_id ? {
          id: booking.staff_id,
          name: booking.staff_name,
          phone: booking.staff_phone,
        } : null,
        pet: (booking.pet_id_from_table || petIdToUse) ? {
          id: booking.pet_id_from_table || petIdToUse,
          name: booking.pet_name_from_table,
          species: booking.pet_species_from_table,
          breed: booking.pet_breed_from_table,
          age: booking.pet_age_from_table,
          weight: booking.pet_weight_from_table,
          photo_url: booking.pet_photo_from_table,
        } : null,
        petName: booking.pet_name_from_table || null,
        petBreed: booking.pet_breed_from_table || null,
        petType: booking.pet_species_from_table || null,
        petAge: booking.pet_age_from_table || null,
        petPhoto: booking.pet_photo_from_table || null,
        status: booking.status,
        paymentStatus: booking.payment_status,
        bookingDate: booking.booking_date,
        booking_date: booking.booking_date,
        bookingTime: booking.booking_time,
        booking_time: booking.booking_time,
        scheduledDate: booking.booking_date,
        scheduledTime: booking.booking_time,
        schedule: booking.booking_time,
        startDate: booking.booking_date,
        serviceType: booking.service_type,
        address: booking.address,
        city: booking.city,
        state: booking.state,
        pincode: booking.pincode,
        totalAmount: booking.total_amount,
        basePrice: booking.base_price,
        discountAmount: booking.discount_amount,
        taxAmount: booking.tax_amount,
        loyaltyPointsUsed: booking.loyalty_points_used,
        couponCode: booking.coupon_code,
        notes: booking.notes,
        cancellationReason: booking.cancellation_reason,
        createdAt: booking.created_at,
        completedAt: booking.completed_at,
        cancelledAt: booking.cancelled_at,
        selectedServices: parseSelectedServices(booking.selected_services).length > 0 ? parseSelectedServices(booking.selected_services) : undefined,
        totalDurationMinutes: booking.total_duration_minutes != null ? Number(booking.total_duration_minutes) : undefined,
      },
      prescription: prescriptions.rows[0] || null,
      review: reviews.rows[0] || null,
    });
  } catch (error: any) {
    console.error('Error fetching booking details:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function getFollowUpEligibleBookings(c: Context) {
  try {
    const { customerId } = c.req.param();
    const rules = await getDiscoveryRules('all', 'booking');
    const followUpDays = rules.follow_up_days ?? 7;

    const eligibleBookings = await query(
      `SELECT b.*,
              v.business_name as vendor_name,
              v.phone as vendor_phone,
              s.name as service_name
       FROM bookings b
       LEFT JOIN vendors v ON b.vendor_id = v.id
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.customer_id = $1
       AND b.status = 'completed'
       AND b.completed_at IS NOT NULL
       AND b.completed_at >= NOW() - ($2::text || ' days')::interval
       ORDER BY b.completed_at DESC`,
      [customerId, followUpDays]
    );

    const enrichedBookings = await Promise.all(
      eligibleBookings.rows.map(async (booking: any) => {
        const prescription = await query(
          'SELECT id FROM prescriptions WHERE booking_id = $1',
          [booking.id]
        );

        const review = await query(
          'SELECT id FROM reviews WHERE booking_id = $1',
          [booking.id]
        );

        return {
          id: booking.id,
          bookingId: booking.id,
          vendorId: booking.vendor_id,
          vendorName: booking.vendor_name,
          vendorPhone: booking.vendor_phone,
          serviceId: booking.service_id,
          serviceName: booking.service_name,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          completedAt: booking.completed_at,
          totalAmount: booking.total_amount,
          hasPrescription: prescription.rows.length > 0,
          hasReview: review.rows.length > 0,
          isEligibleForFollowUp: !review.rows.length,
        };
      })
    );

    return c.json({
      success: true,
      bookings: enrichedBookings,
      total: enrichedBookings.length,
    });
  } catch (error: any) {
    console.error('Error fetching follow-up eligible bookings:', error);
    return c.json({ error: error.message }, 500);
  }
}

// ============================================================================
// ENHANCED BOOKING DETAILS HANDLER (from booking-details-enhanced.ts)
// ============================================================================

export class GetEnhancedBookingDetailsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const actorId = context.event.queryStringParameters?.actorId;
    const actorRole = context.event.queryStringParameters?.actorRole || 'customer';

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return this.error('Booking not found', 404);
      }

      const booking = bookings[0];

      let petIdToUse = booking.pet_id;
      
      if (!petIdToUse && booking.notes) {
        const petIdMatch = booking.notes.match(/Pet ID:\s*([a-f0-9-]{36})/i);
        if (petIdMatch) {
          petIdToUse = petIdMatch[1];
        }
      }
      
      if (!petIdToUse && booking.special_instructions) {
        const petIdMatch = booking.special_instructions.match(/Pet ID:\s*([a-f0-9-]{36})/i);
        if (petIdMatch) {
          petIdToUse = petIdMatch[1];
        }
      }

      const isUATMode = context.event.headers?.['x-uat-mode'] === 'true' || 
                        context.event.headers?.['X-UAT-Mode'] === 'true';
      
      if (actorId && !isUATMode) {
        if (actorRole === 'customer' && booking.customer_id !== actorId) {
          return this.error('Access denied', 403);
        }

        if (actorRole === 'vendor' && booking.vendor_id !== actorId) {
          return this.error('Access denied', 403);
        }
      }

      const ROLES_WITH_MEDICAL_FEATURES = ['vet', 'veterinary', 'nutritionist', 'diagnostics', 'diagnostic', 'lab', 'laboratory'];
      let showMedicalFeatures = true;
      
      if (booking.vendor_id) {
        try {
          const vendorWithRole = await query(
            `SELECT v.role_id, r.name as role_name 
             FROM vendors v 
             LEFT JOIN roles r ON v.role_id = r.id 
             WHERE v.id = $1`,
            [booking.vendor_id]
          );
          if (vendorWithRole.rows.length > 0) {
            const roleName = (vendorWithRole.rows[0].role_name || '').toLowerCase();
            showMedicalFeatures = ROLES_WITH_MEDICAL_FEATURES.some(r => roleName.includes(r));
          }
        } catch (roleCheckError) {
          console.warn('[BOOKING-DETAILS] Could not check vendor role for medical features:', roleCheckError);
        }
      }

      const [
        prescriptions,
        medicalRecords,
        chatMessages,
        pet,
        vendor,
        staff,
        service,
        customer,
      ] = await Promise.all([
        query(
          `SELECT * FROM prescriptions 
           WHERE booking_id = $1 AND is_active = true 
           ORDER BY created_at DESC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
        query(
          `SELECT * FROM medical_records 
           WHERE booking_id = $1 AND is_active = true 
           ORDER BY created_at DESC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
        query(
          `SELECT * FROM chat_messages 
           WHERE booking_id = $1 
           ORDER BY created_at ASC`,
          [bookingId]
        ).catch(() => ({ rows: [] })),
        petIdToUse
          ? select('pets', { id: petIdToUse }).catch(() => [])
          : Promise.resolve([]),
        booking.vendor_id
          ? select('vendors', { id: booking.vendor_id }).catch(() => [])
          : Promise.resolve([]),
        booking.staff_id || booking.assigned_staff_id
          ? select('staff', { id: booking.staff_id || booking.assigned_staff_id }).catch(() => [])
          : Promise.resolve([]),
        booking.service_id
          ? select('services', { id: booking.service_id }).catch(() => [])
          : Promise.resolve([]),
        booking.customer_id
          ? select('customers', { id: booking.customer_id }).catch(() => [])
          : Promise.resolve([]),
      ]);

      const filteredPrescriptions = showMedicalFeatures ? (prescriptions.rows || []) : [];
      const filteredMedicalRecords = showMedicalFeatures ? (medicalRecords.rows || []) : [];

      const response = {
        booking: {
          id: booking.id,
          vendorId: booking.vendor_id,
          vendor_id: booking.vendor_id,
          staffId: booking.staff_id || booking.assigned_staff_id || null,
          staff_id: booking.staff_id || booking.assigned_staff_id || null,
          petId: petIdToUse || null,
          pet_id: petIdToUse || null,
          customerId: booking.customer_id,
          customer_id: booking.customer_id,
          serviceId: booking.service_id,
          service_id: booking.service_id,
          status: booking.status,
          payment_status: booking.payment_status,
          booking_date: booking.booking_date,
          booking_time: booking.booking_time,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          scheduledDate: booking.booking_date,
          scheduledTime: booking.booking_time,
          schedule: booking.booking_time,
          startDate: booking.booking_date,
          service_type: booking.service_type,
          serviceStyle: booking.service_type || booking.service_style,
          address: booking.address,
          base_price: booking.base_price,
          total_amount: booking.total_amount,
          notes: booking.notes,
          created_at: booking.created_at,
          updated_at: booking.updated_at,
        },
        pet: pet[0] ? {
          ...pet[0],
          id: pet[0].id || petIdToUse,
        } : null,
        vendor: vendor[0] ? {
          id: vendor[0].id,
          business_name: vendor[0].business_name,
          phone: vendor[0].phone,
          email: vendor[0].email,
          address: vendor[0].address,
        } : null,
        staff: staff[0] ? {
          id: staff[0].id,
          name: staff[0].name,
          phone: staff[0].phone,
          role: staff[0].role,
        } : null,
        service: service[0] || null,
        customer: customer[0] ? {
          id: customer[0].id,
          full_name: customer[0].full_name,
          phone: customer[0].phone,
          email: customer[0].email,
        } : null,
        prescriptions: filteredPrescriptions,
        medicalRecords: filteredMedicalRecords,
        chat: chatMessages.rows || [],
      };

      return this.success(response);
    } catch (error: any) {
      console.error('Error fetching enhanced booking details:', error);
      return this.error(error.message || 'Failed to fetch booking details', 500);
    }
  }
}

// Helper functions for booking-details-enhanced.ts
export function createApiGatewayEventForBooking(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

export function createLambdaContextForBooking(): any {
  return {
    requestId: randomUUID(),
    functionName: 'booking-handler',
    functionVersion: '$LATEST',
  };
}

/**
 * Get prescriptions for a booking
 */
export class GetBookingPrescriptionsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const prescriptions = await query(
        `SELECT * FROM prescriptions 
         WHERE booking_id = $1 AND is_active = true 
         ORDER BY created_at DESC`,
        [bookingId]
      ).catch(() => ({ rows: [] }));

      return this.success({ prescriptions: prescriptions.rows || [] });
    } catch (error: any) {
      console.error('Error fetching booking prescriptions:', error);
      return this.error(error.message || 'Failed to fetch prescriptions', 500);
    }
  }
}

/**
 * Get medical records for a booking
 */
export class GetBookingMedicalRecordsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const medicalRecords = await query(
        `SELECT * FROM medical_records 
         WHERE booking_id = $1 AND is_active = true 
         ORDER BY created_at DESC`,
        [bookingId]
      ).catch(() => ({ rows: [] }));

      return this.success({ medicalRecords: medicalRecords.rows || [] });
    } catch (error: any) {
      console.error('Error fetching booking medical records:', error);
      return this.error(error.message || 'Failed to fetch medical records', 500);
    }
  }
}

/**
 * Get chat conversation for a booking
 */
export class GetBookingChatHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const messages = await query(
        `SELECT * FROM chat_messages 
         WHERE booking_id = $1 
         ORDER BY created_at ASC`,
        [bookingId]
      ).catch(() => ({ rows: [] }));

      return this.success({
        messages: messages.rows || [],
        messageCount: messages.rows?.length || 0,
      });
    } catch (error: any) {
      console.error('Error fetching booking chat:', error);
      return this.error(error.message || 'Failed to fetch chat messages', 500);
    }
  }
}

// ============================================================================
// SUBSCRIPTION BOOKING HANDLERS (from subscription-booking.ts)
// ============================================================================

interface SubscriptionCoverage {
  covered: boolean;
  subscriptionId: string | null;
  subscriptionName: string | null;
  isUnlimited: boolean;
  usedCount: number;
  remainingCount: number | null;
  expiresAt: string | null;
  message: string;
}

export class CheckSubscriptionCoverageHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { customerId, serviceId, vendorId, serviceStyle } = body;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    try {
      const { rows: subscriptions } = await query(
        `SELECT 
          cs.id as subscription_id,
          cs.subscription_type_id,
          cs.status,
          cs.start_date,
          cs.end_date,
          cs.usage_count,
          cs.usage_limit,
          cs.is_unlimited,
          st.name as subscription_name,
          st.description,
          st.included_services,
          st.included_vendors,
          st.included_service_styles,
          st.price
        FROM customer_subscriptions cs
        JOIN subscription_types st ON st.id = cs.subscription_type_id
        WHERE cs.customer_id = $1 
          AND cs.status = 'active'
          AND (cs.end_date IS NULL OR cs.end_date > NOW())
        ORDER BY cs.created_at DESC`,
        [customerId]
      );

      if (subscriptions.length === 0) {
        return this.success({
          covered: false,
          subscriptionId: null,
          subscriptionName: null,
          isUnlimited: false,
          usedCount: 0,
          remainingCount: 0,
          expiresAt: null,
          message: 'No active subscription found',
        } as SubscriptionCoverage);
      }

      for (const sub of subscriptions) {
        let isCovered = false;

        if (serviceId && sub.included_services) {
          const includedServices = typeof sub.included_services === 'string' 
            ? JSON.parse(sub.included_services) 
            : sub.included_services;
          
          isCovered = includedServices.includes('*') || 
                      includedServices.includes(serviceId) ||
                      includedServices.length === 0;
        } else {
          isCovered = true;
        }

        if (vendorId && sub.included_vendors && !isCovered) {
          const includedVendors = typeof sub.included_vendors === 'string'
            ? JSON.parse(sub.included_vendors)
            : sub.included_vendors;
          
          isCovered = includedVendors.includes('*') || 
                      includedVendors.includes(vendorId) ||
                      includedVendors.length === 0;
        }

        if (serviceStyle && sub.included_service_styles) {
          const includedStyles = typeof sub.included_service_styles === 'string'
            ? JSON.parse(sub.included_service_styles)
            : sub.included_service_styles;
          
          if (includedStyles.length > 0 && !includedStyles.includes('*')) {
            isCovered = isCovered && includedStyles.includes(serviceStyle);
          }
        }

        if (isCovered) {
          const isUnlimited = sub.is_unlimited || sub.usage_limit === null || sub.usage_limit === 0;
          const usedCount = sub.usage_count || 0;
          const usageLimit = sub.usage_limit || null;
          
          if (!isUnlimited && usageLimit && usedCount >= usageLimit) {
            continue;
          }

          return this.success({
            covered: true,
            subscriptionId: sub.subscription_id,
            subscriptionName: sub.subscription_name,
            isUnlimited,
            usedCount,
            remainingCount: isUnlimited ? null : (usageLimit - usedCount),
            expiresAt: sub.end_date,
            message: isUnlimited 
              ? 'Covered by unlimited subscription' 
              : `Covered by subscription (${usageLimit - usedCount} visits remaining)`,
          } as SubscriptionCoverage);
        }
      }

      return this.success({
        covered: false,
        subscriptionId: null,
        subscriptionName: null,
        isUnlimited: false,
        usedCount: 0,
        remainingCount: 0,
        expiresAt: null,
        message: 'This service is not covered by your active subscriptions',
      } as SubscriptionCoverage);
    } catch (error: any) {
      console.error('Error checking subscription coverage:', error);
      return this.error(error.message || 'Failed to check subscription', 500);
    }
  }
}

export class CreateSubscriptionBookingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { 
      customerId, 
      subscriptionId, 
      serviceId, 
      vendorId, 
      staffId,
      bookingDate, 
      bookingTime, 
      serviceStyle,
      petId,
      address,
      notes 
    } = body;

    if (!customerId || !subscriptionId || !serviceId || !vendorId || !bookingDate || !bookingTime) {
      return this.error('Missing required fields', 400);
    }

    try {
      const { rows: subscriptions } = await query(
        `SELECT 
          cs.id,
          cs.usage_count,
          cs.usage_limit,
          cs.is_unlimited,
          cs.status,
          cs.end_date
        FROM customer_subscriptions cs
        WHERE cs.id = $1 
          AND cs.customer_id = $2
          AND cs.status = 'active'
          AND (cs.end_date IS NULL OR cs.end_date > NOW())`,
        [subscriptionId, customerId]
      );

      if (subscriptions.length === 0) {
        return this.error('Subscription not found or expired', 404);
      }

      const subscription = subscriptions[0];
      const isUnlimited = subscription.is_unlimited || subscription.usage_limit === null;
      const usedCount = subscription.usage_count || 0;

      if (!isUnlimited && subscription.usage_limit && usedCount >= subscription.usage_limit) {
        return this.error('Subscription usage limit reached', 400);
      }

      const { rows: services } = await query(
        `SELECT name, duration, price FROM vendor_services WHERE id = $1`,
        [serviceId]
      );

      const service = services.length > 0 ? services[0] : { name: 'Service', duration: 30, price: 0 };

      const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
      const otpExpiresAt = new Date();
      otpExpiresAt.setHours(otpExpiresAt.getHours() + 24);

      const bookingData = {
        customer_id: customerId,
        vendor_id: vendorId,
        service_id: serviceId,
        staff_id: staffId || null,
        booking_date: bookingDate,
        booking_time: bookingTime,
        service_type: serviceStyle || 'at_center',
        pet_id: petId || null,
        address: address || null,
        notes: notes || null,
        status: 'confirmed',
        payment_status: 'paid',
        total_amount: 0,
        subscription_id: subscriptionId,
        is_subscription_booking: true,
        otp_code: otpCode,
        otp_expires_at: otpExpiresAt,
        duration: service.duration || 30,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const [newBooking] = await insert('bookings', bookingData);

      await query(
        `UPDATE customer_subscriptions 
         SET usage_count = COALESCE(usage_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $1`,
        [subscriptionId]
      );

      await insert('subscription_usage_logs', {
        subscription_id: subscriptionId,
        customer_id: customerId,
        booking_id: newBooking.id,
        service_id: serviceId,
        vendor_id: vendorId,
        used_at: new Date(),
      }).catch(() => {});

      return this.success({
        success: true,
        bookingId: newBooking.id,
        booking: {
          id: newBooking.id,
          status: 'confirmed',
          paymentStatus: 'paid',
          totalAmount: 0,
          isSubscriptionBooking: true,
          otpCode,
          bookingDate,
          bookingTime,
          serviceName: service.name,
        },
        subscription: {
          id: subscriptionId,
          usedCount: usedCount + 1,
          remainingCount: isUnlimited ? null : (subscription.usage_limit - usedCount - 1),
          isUnlimited,
        },
        message: 'Booking confirmed! Covered by your subscription.',
      });
    } catch (error: any) {
      console.error('Error creating subscription booking:', error);
      return this.error(error.message || 'Failed to create booking', 500);
    }
  }
}

export class GetSubscriptionUsageHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const subscriptionId = context.event.pathParameters?.subscriptionId;
    const customerId = context.event.queryStringParameters?.customerId;

    if (!subscriptionId && !customerId) {
      return this.error('Subscription ID or Customer ID is required', 400);
    }

    try {
      let usageLogs: any[] = [];

      if (subscriptionId) {
        const { rows } = await query(
          `SELECT 
            sul.id,
            sul.booking_id,
            sul.service_id,
            sul.vendor_id,
            sul.used_at,
            vs.service_name as service_name,
            v.business_name as vendor_name,
            b.status as booking_status
          FROM subscription_usage_logs sul
          LEFT JOIN vendor_services vs ON vs.id = sul.service_id
          LEFT JOIN vendors v ON v.id = sul.vendor_id
          LEFT JOIN bookings b ON b.id = sul.booking_id
          WHERE sul.subscription_id = $1
          ORDER BY sul.used_at DESC
          LIMIT 50`,
          [subscriptionId]
        );
        usageLogs = rows;
      } else if (customerId) {
        const { rows } = await query(
          `SELECT 
            sul.id,
            sul.subscription_id,
            sul.booking_id,
            sul.service_id,
            sul.vendor_id,
            sul.used_at,
            vs.service_name as service_name,
            v.business_name as vendor_name,
            b.status as booking_status,
            st.name as subscription_name
          FROM subscription_usage_logs sul
          JOIN customer_subscriptions cs ON cs.id = sul.subscription_id
          JOIN subscription_types st ON st.id = cs.subscription_type_id
          LEFT JOIN vendor_services vs ON vs.id = sul.service_id
          LEFT JOIN vendors v ON v.id = sul.vendor_id
          LEFT JOIN bookings b ON b.id = sul.booking_id
          WHERE sul.customer_id = $1
          ORDER BY sul.used_at DESC
          LIMIT 50`,
          [customerId]
        );
        usageLogs = rows;
      }

      return this.success({
        success: true,
        usage: usageLogs.map(log => ({
          id: log.id,
          subscriptionId: log.subscription_id,
          subscriptionName: log.subscription_name,
          bookingId: log.booking_id,
          serviceName: log.service_name || 'Service',
          vendorName: log.vendor_name || 'Vendor',
          usedAt: log.used_at,
          bookingStatus: log.booking_status,
        })),
        count: usageLogs.length,
      });
    } catch (error: any) {
      console.error('Error fetching subscription usage:', error);
      return this.error(error.message || 'Failed to fetch usage', 500);
    }
  }
}

// Helper functions for subscription-booking.ts
export function createApiGatewayEventForSubscription(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

export function createLambdaContextForSubscription(): any {
  return {
    requestId: randomUUID(),
    functionName: 'subscription-booking',
    functionVersion: '$LATEST',
  };
}

// ============================================================================
// PACKAGE BOOKING HANDLERS (from package-booking.ts)
// ============================================================================

export async function getActivePackages(c: Context) {
  try {
    const { customerId } = c.req.param();
    const vendorId = c.req.query('vendorId');
    const serviceType = c.req.query('serviceType');

    let packageQuery = `
      SELECT 
        pp.*,
        v.business_name as vendor_name,
        v.phone as vendor_phone,
        v.city as vendor_city,
        (pp.total_sessions - pp.remaining_sessions) as sessions_used,
        CASE 
          WHEN pp.expires_at IS NOT NULL AND pp.expires_at < NOW() THEN 'expired'
          WHEN pp.remaining_sessions <= 0 AND pp.unlimited_usage = false THEN 'exhausted'
          ELSE pp.status
        END as computed_status
      FROM package_purchases pp
      LEFT JOIN vendors v ON pp.vendor_id = v.id
      WHERE pp.customer_id = $1
      AND pp.status = 'active'
      AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
      AND (pp.remaining_sessions > 0 OR pp.unlimited_usage = true)
    `;

    const params: any[] = [customerId];
    let paramIndex = 2;

    if (vendorId) {
      packageQuery += ` AND pp.vendor_id = $${paramIndex}`;
      params.push(vendorId);
      paramIndex++;
    }

    if (serviceType) {
      packageQuery += ` AND pp.package_type = $${paramIndex}`;
      params.push(serviceType);
      paramIndex++;
    }

    packageQuery += ` ORDER BY pp.expires_at ASC NULLS LAST, pp.created_at DESC`;

    const result = await query(packageQuery, params);

    const packagesWithSessions = await Promise.all(
      result.rows.map(async (pkg: any) => {
        const sessionsResult = await query(`
          SELECT * FROM package_scheduled_sessions
          WHERE package_purchase_id = $1
          ORDER BY session_number ASC
        `, [pkg.id]);

        return {
          ...pkg,
          scheduledSessions: sessionsResult.rows,
          nextSession: sessionsResult.rows.find((s: any) => s.status === 'pending' || s.status === 'scheduled')
        };
      })
    );

    return c.json({
      success: true,
      packages: packagesWithSessions,
      total: packagesWithSessions.length,
      hasActivePackages: packagesWithSessions.length > 0
    });
  } catch (error: any) {
    console.error('Error fetching active packages:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function createBookingFromPackage(c: Context) {
  try {
    const body = await c.req.json();
    const {
      packagePurchaseId,
      customerId,
      vendorId,
      petId,
      serviceId,
      scheduledDate,
      scheduledTime,
      serviceType = 'at_center',
      notes,
      address
    } = body;

    if (!packagePurchaseId || !customerId || !vendorId) {
      return c.json({ 
        error: 'packagePurchaseId, customerId, and vendorId are required' 
      }, 400);
    }

    let isSubscriptionBooking = false;
    let subscriptionId = null;
    let finalAmount = 0;

    try {
      const subscriptionCheck = await query(
        `SELECT cs.id, cs.subscription_type, cs.is_unlimited, cs.usage_limit, cs.end_date
         FROM customer_subscriptions cs
         WHERE cs.customer_id = $1
           AND cs.status = 'active'
           AND (cs.end_date IS NULL OR cs.end_date > NOW())
           AND (cs.is_unlimited = true OR (cs.usage_limit IS NOT NULL AND cs.used_count < cs.usage_limit))
         ORDER BY cs.created_at DESC
         LIMIT 1`,
        [customerId]
      );

      if (subscriptionCheck.rows.length > 0) {
        const subscription = subscriptionCheck.rows[0];
        subscriptionId = subscription.id;
        isSubscriptionBooking = true;
        finalAmount = 0;
      }
    } catch (subError: any) {
      console.warn('[PACKAGE-BOOKING] Subscription check failed, proceeding with package:', subError);
    }

    const packageResult = await query(`
      SELECT * FROM package_purchases
      WHERE id = $1 AND customer_id = $2
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
      AND (remaining_sessions > 0 OR unlimited_usage = true)
    `, [packagePurchaseId, customerId]);

    if (packageResult.rows.length === 0) {
      return c.json({ 
        error: 'Package not found, expired, or has no remaining sessions' 
      }, 400);
    }

    const pkg = packageResult.rows[0];
    const sessionsUsed = pkg.total_sessions - pkg.remaining_sessions;
    const nextSessionNumber = sessionsUsed + 1;

    const conflictCheck = await query(`
      SELECT id FROM bookings
      WHERE vendor_id = $1
      AND booking_date = $2
      AND booking_time = $3
      AND status NOT IN ('cancelled', 'rejected')
    `, [vendorId, scheduledDate, scheduledTime]);

    if (conflictCheck.rows.length > 0) {
      return c.json({ 
        error: 'This time slot is already booked',
        code: 'SLOT_CONFLICT'
      }, 409);
    }

    const bookingResult = await query(`
      INSERT INTO bookings (
        customer_id, vendor_id, pet_id, service_id,
        booking_date, booking_time, service_type,
        notes, address,
        package_purchase_id, is_package_session, package_session_number,
        subscription_id, subscription_booking,
        status, payment_status, total_amount
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9,
        $10, true, $11,
        $12, $13,
        'confirmed', $14, $15
      )
      RETURNING *
    `, [
      customerId, vendorId, petId, serviceId,
      scheduledDate, scheduledTime, serviceType,
      notes, address ? JSON.stringify(address) : null,
      packagePurchaseId, nextSessionNumber,
      subscriptionId, isSubscriptionBooking,
      isSubscriptionBooking ? 'paid' : 'completed',
      finalAmount
    ]);

    const booking = bookingResult.rows[0];

    if (!pkg.unlimited_usage) {
      await update('package_purchases', 
        { id: packagePurchaseId },
        { 
          remaining_sessions: pkg.remaining_sessions - 1,
          updated_at: new Date().toISOString()
        }
      );
    }

    await insert('package_usage_log', {
      package_purchase_id: packagePurchaseId,
      booking_id: booking.id,
      session_number: nextSessionNumber,
      action: 'session_used',
      sessions_before: pkg.remaining_sessions,
      sessions_after: pkg.unlimited_usage ? pkg.remaining_sessions : pkg.remaining_sessions - 1,
      created_at: new Date().toISOString()
    });

    await query(`
      INSERT INTO package_scheduled_sessions (
        package_purchase_id, session_number, scheduled_date, scheduled_time,
        booking_id, status
      ) VALUES ($1, $2, $3, $4, $5, 'scheduled')
      ON CONFLICT (package_purchase_id, session_number) 
      DO UPDATE SET 
        scheduled_date = EXCLUDED.scheduled_date,
        scheduled_time = EXCLUDED.scheduled_time,
        booking_id = EXCLUDED.booking_id,
        status = 'scheduled',
        updated_at = NOW()
    `, [packagePurchaseId, nextSessionNumber, scheduledDate, scheduledTime, booking.id]);

    await query(`
      INSERT INTO customer_provider_history (
        customer_id, vendor_id, service_type, total_bookings,
        last_booking_id, last_booking_date
      ) VALUES ($1, $2, $3, 1, $4, NOW())
      ON CONFLICT (customer_id, vendor_id, service_type)
      DO UPDATE SET
        total_bookings = customer_provider_history.total_bookings + 1,
        last_booking_id = EXCLUDED.last_booking_id,
        last_booking_date = NOW(),
        updated_at = NOW()
    `, [customerId, vendorId, pkg.package_type || 'general', booking.id]);

    return c.json({
      success: true,
      booking: {
        id: booking.id,
        bookingDate: booking.booking_date,
        bookingTime: booking.booking_time,
        status: booking.status,
        isPackageSession: true,
        sessionNumber: nextSessionNumber,
        remainingSessions: pkg.unlimited_usage ? 'unlimited' : pkg.remaining_sessions - 1
      },
      package: {
        id: packagePurchaseId,
        remainingSessions: pkg.unlimited_usage ? 'unlimited' : pkg.remaining_sessions - 1,
        totalSessions: pkg.total_sessions
      },
      message: `Booking created using package session ${nextSessionNumber}/${pkg.total_sessions}`
    });
  } catch (error: any) {
    console.error('Error creating booking from package:', error);
    return c.json({ error: error.message }, 500);
  }
}

// ============================================================================
// VENDOR BOOKINGS HANDLERS (from vendor-bookings.ts)
// ============================================================================

// Helper function to format detailed address with all fields
function formatDetailedAddress(addr: any): string {
  const parts: string[] = [];
  
  if (addr.apartment_name) parts.push(addr.apartment_name);
  if (addr.flat_no && addr.house_no) {
    parts.push(`Flat ${addr.flat_no}, House ${addr.house_no}`);
  } else if (addr.flat_no) {
    parts.push(`Flat ${addr.flat_no}`);
  } else if (addr.house_no) {
    parts.push(`House ${addr.house_no}`);
  }
  if (addr.floor) parts.push(`Floor ${addr.floor}`);
  if (addr.street_name) parts.push(addr.street_name);
  if (addr.address_line1) parts.push(addr.address_line1);
  if (addr.address_line2) parts.push(addr.address_line2);
  if (addr.landmark) parts.push(`Near ${addr.landmark}`);
  if (addr.city) parts.push(addr.city);
  if (addr.state) parts.push(addr.state);
  if (addr.pincode) parts.push(addr.pincode);
  
  return parts.filter(Boolean).join(', ');
}

export async function getVendorBookings(c: Context) {
  try {
    const { resolveVendorId } = await import('../utils/vendor-resolve');
    const { checkVendorCapability } = await import('../middleware/capability-enforcement');
    
    const { vendorId: paramVendorId } = c.req.param();
    const vendorId = await resolveVendorId(paramVendorId);
    const vendorIds = [vendorId];
    if (paramVendorId !== vendorId) vendorIds.push(paramVendorId);

    const hasBookingCapability = await checkVendorCapability(vendorId, 'booking_view') ||
                                 await checkVendorCapability(vendorId, 'booking_create') ||
                                 await checkVendorCapability(paramVendorId, 'bookings') ||
                                 await checkVendorCapability(vendorId, 'bookings');
    if (!hasBookingCapability) {
      return c.json({ error: 'Vendor does not have booking viewing capability' }, 403);
    }
    const date = c.req.query('date');
    const filter = c.req.query('filter') || 'all';

    let centerId: string | null = null;
    try {
      const vendorInfo = await query(
        `SELECT center_id FROM vendors WHERE id = $1 OR id = $2 LIMIT 1`,
        vendorIds
      );
      if (vendorInfo.rows.length > 0 && vendorInfo.rows[0].center_id) {
        centerId = vendorInfo.rows[0].center_id;
      }
    } catch (e) {
      console.warn('[VENDOR-BOOKINGS] Could not check center_id:', e);
    }

    let queryText: string;
    const params: any[] = [...vendorIds];
    let paramIndex = vendorIds.length + 1;

    if (centerId) {
      const vendorIdConditions = vendorIds.map((_, idx) => `b.vendor_id = $${idx + 1}`).join(' OR ');
      queryText = `SELECT b.* FROM bookings b
         LEFT JOIN vendors v ON v.id = b.vendor_id
         WHERE (
           (${vendorIdConditions})
           OR (v.center_id = $${paramIndex} AND v.center_id IS NOT NULL)
         ) AND b.status != 'pending_payment'`;
      params.push(centerId);
      paramIndex++;
    } else {
      queryText = vendorIds.length === 1
        ? 'SELECT b.* FROM bookings b WHERE b.vendor_id = $1 AND b.status != \'pending_payment\''
        : 'SELECT b.* FROM bookings b WHERE (b.vendor_id = $1 OR b.vendor_id = $2) AND b.status != \'pending_payment\'';
    }

    if (date) {
      queryText += ` AND b.booking_date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (filter && filter !== 'all') {
      queryText += ` AND b.status = $${paramIndex}`;
      params.push(filter);
      paramIndex++;
    }

    queryText += ' ORDER BY b.booking_date DESC, b.booking_time DESC';

    const result = await query(queryText, params).catch(() => ({ rows: [] }));

    const chatRules = await getDiscoveryRules('all', 'chat');
    const chatDays = chatRules.chat_available_days_post_appointment ?? 7;

    const enrichedBookings = await Promise.all(
      result.rows.map(async (booking: any) => {
        const [customer, service, vendor, prescriptions, medicalRecords, chatMessages] = await Promise.all([
          booking.customer_id
            ? select('customers', { id: booking.customer_id }).catch(() => [])
            : Promise.resolve([]),
          booking.service_id
            ? select('services', { id: booking.service_id }).catch(() => [])
            : Promise.resolve([]),
          booking.vendor_id
            ? select('vendors', { id: booking.vendor_id }).catch(() => [])
            : Promise.resolve([]),
          query(
            `SELECT COUNT(*) as count FROM prescriptions 
             WHERE booking_id = $1 AND is_active = true`,
            [booking.id]
          ).catch(() => ({ rows: [{ count: '0' }] })),
          query(
            `SELECT COUNT(*) as count FROM medical_records 
             WHERE booking_id = $1 AND is_active = true`,
            [booking.id]
          ).catch(() => ({ rows: [{ count: '0' }] })),
          query(
            `SELECT COUNT(*) as count FROM chat_messages 
             WHERE booking_id = $1 AND is_read = false`,
            [booking.id]
          ).catch(() => ({ rows: [{ count: '0' }] })),
        ]);

        const prescriptionCount = parseInt(prescriptions.rows[0]?.count || '0', 10);
        const medicalRecordCount = parseInt(medicalRecords.rows[0]?.count || '0', 10);
        const unreadMessageCount = parseInt(chatMessages.rows[0]?.count || '0', 10);

        return {
          ...booking,
          customer: customer.length > 0 ? {
            id: customer[0].id,
            name: customer[0].full_name,
            phone: customer[0].phone,
          } : null,
          service: service.length > 0 ? {
            id: service[0].id,
            name: service[0].name,
            category: service[0].category,
          } : null,
          chatEnabled: (() => {
            if (booking.status === 'cancelled') return false;
            if (booking.status === 'completed' && booking.updated_at) {
              const completedDate = new Date(booking.updated_at);
              const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
              return daysSinceCompletion <= chatDays;
            }
            return true;
          })(),
          hasUnreadMessages: unreadMessageCount > 0,
          unreadMessageCount,
          hasPrescription: prescriptionCount > 0,
          prescriptionCount,
          hasMedicalRecords: medicalRecordCount > 0,
          medicalRecordCount,
          isFollowUp: false,
        };
      })
    );

    return c.json({
      success: true,
      bookings: enrichedBookings,
      total: enrichedBookings.length,
      filters: {
        date,
        status: filter,
      },
    });
  } catch (error: any) {
    console.error('❌ [VENDOR-BOOKINGS] Error fetching bookings:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function updateVendorBookingStatus(c: Context) {
  try {
    const { logBookingStatusChange } = await import('../utils/audit-log');
    const { checkVendorCapability } = await import('../middleware/capability-enforcement');
    
    const { bookingId } = c.req.param();
    
    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    const booking = bookings[0];
    const vendorId = c.req.header('x-vendor-id') || booking.vendor_id;
    
    const hasBookingCapability = await checkVendorCapability(vendorId, 'booking_create');
    if (!hasBookingCapability) {
      return c.json({ error: 'Vendor does not have booking management capability' }, 403);
    }
    const { status, notes } = await c.req.json();

    if (!status) {
      return c.json({ error: 'status is required' }, 400);
    }

    const oldStatus = booking.status;

    const updateData: any = { status };
    if (notes) {
      updateData.notes = notes;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString();
    }

    const updated = await update('bookings', { id: bookingId }, updateData);

    if (oldStatus !== status) {
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        status,
        vendorId,
        'vendor',
        notes || 'Status updated by vendor'
      );

      try {
        const { publishBookingStatusUpdated } = await import('../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id || vendorId,
          oldStatus,
          newStatus: status,
          reason: notes || 'Status updated by vendor',
          eventTimestamp: new Date().toISOString(),
          eventId: randomUUID(),
        });
      } catch (error) {
        console.error('Failed to publish booking status updated event:', error);
      }
    }

    return c.json({
      success: true,
      booking: updated[0],
      message: 'Booking status updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating booking status:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function confirmVendorBooking(c: Context) {
  try {
    const { logBookingStatusChange } = await import('../utils/audit-log');
    
    const { bookingId } = c.req.param();
    const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');

    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookings[0];
    if (booking.status !== 'pending') {
      return c.json({ error: `Booking cannot be confirmed. Current status: ${booking.status}` }, 400);
    }

    const updated = await update('bookings', { id: bookingId }, { status: 'confirmed' });

    let otpCode: string | null = null;
    try {
      const serviceType = booking.service_type || '';
      const isTele = ['tele', 'online', 'video_consultation', 'tele_consultation'].includes(serviceType);
      
      if (!isTele && !booking.otp_code) {
        otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExpiry = new Date();
        otpExpiry.setHours(otpExpiry.getHours() + 24);
        
        await query(
          `UPDATE bookings SET otp_code = $1, otp_expires_at = $2, updated_at = NOW() WHERE id = $3`,
          [otpCode, otpExpiry.toISOString(), bookingId]
        );
      } else if (isTele) {
        // No OTP for tele
      } else {
        otpCode = booking.otp_code;
      }
    } catch (otpErr: any) {
      console.warn(`[CONFIRM-BOOKING] Failed to generate OTP:`, otpErr?.message);
    }

    await logBookingStatusChange(
      bookingId,
      'pending',
      'confirmed',
      vendorId || booking.vendor_id,
      'vendor',
      'Vendor confirmed booking'
    );

    try {
      const { publishBookingStatusUpdated } = await import('../utils/sns-client');
      await publishBookingStatusUpdated({
        bookingId,
        customerId: booking.customer_id,
        vendorId: booking.vendor_id || vendorId,
        oldStatus: 'pending',
        newStatus: 'confirmed',
        reason: 'Vendor confirmed booking',
        eventTimestamp: new Date().toISOString(),
        eventId: randomUUID(),
      });
    } catch (error) {
      console.error('Failed to publish booking status updated event:', error);
    }

    return c.json({
      success: true,
      booking: updated[0],
      message: 'Booking confirmed successfully',
      ...(otpCode && { otp: otpCode }),
    });
  } catch (error: any) {
    console.error('Error confirming booking:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function cancelVendorBooking(c: Context) {
  try {
    const { logBookingStatusChange } = await import('../utils/audit-log');
    
    const { bookingId } = c.req.param();
    const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');
    const { reason } = await c.req.json();

    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookings[0];
    const oldStatus = booking.status;
    if (!['pending', 'confirmed'].includes(oldStatus)) {
      return c.json({ error: `Booking cannot be cancelled. Current status: ${oldStatus}` }, 400);
    }

    const updated = await update('bookings',
      { id: bookingId },
      {
        status: 'cancelled',
        cancellation_reason: reason || null,
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'provider',
      }
    );

    await logBookingStatusChange(
      bookingId,
      oldStatus,
      'cancelled',
      vendorId || booking.vendor_id,
      'vendor',
      reason || 'Vendor cancelled booking'
    );

    try {
      const { publishBookingStatusUpdated } = await import('../utils/sns-client');
      await publishBookingStatusUpdated({
        bookingId,
        customerId: booking.customer_id,
        vendorId: booking.vendor_id || vendorId,
        oldStatus,
        newStatus: 'cancelled',
        reason: reason || 'Vendor cancelled booking',
        eventTimestamp: new Date().toISOString(),
        eventId: randomUUID(),
      });
    } catch (error) {
      console.error('Failed to publish booking status updated event:', error);
    }

    return c.json({
      success: true,
      booking: updated[0],
      message: 'Booking cancelled successfully',
    });
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    return c.json({ error: error.message }, 500);
  }
}

export async function declineVendorBooking(c: Context) {
  try {
    const { logBookingStatusChange } = await import('../utils/audit-log');
    
    const { bookingId } = c.req.param();
    const { vendorId, reason, suggestAlternative } = await c.req.json();

    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const booking = bookings[0];
    const oldStatus = booking.status;
    if (!['pending', 'confirmed'].includes(oldStatus)) {
      return c.json({ error: `Booking cannot be declined. Current status: ${oldStatus}` }, 400);
    }

    const updated = await update('bookings',
      { id: bookingId },
      {
        status: 'cancelled',
        cancellation_reason: reason || 'Vendor declined booking',
        cancelled_at: new Date().toISOString(),
        cancelled_by: 'provider',
        metadata: {
          ...(booking.metadata || {}),
          suggestAlternative: suggestAlternative || null,
          declinedBy: 'vendor',
        },
      }
    );

    await logBookingStatusChange(
      bookingId,
      oldStatus,
      'cancelled',
      vendorId || booking.vendor_id,
      'vendor',
      reason || 'Vendor declined booking'
    );

    try {
      const { publishBookingStatusUpdated } = await import('../utils/sns-client');
      await publishBookingStatusUpdated({
        bookingId,
        customerId: booking.customer_id,
        vendorId: booking.vendor_id || vendorId,
        oldStatus,
        newStatus: 'cancelled',
        reason: reason || 'Vendor declined booking',
        eventTimestamp: new Date().toISOString(),
        eventId: randomUUID(),
      });
    } catch (error) {
      console.error('Failed to publish booking status updated event:', error);
    }

    return c.json({
      success: true,
      booking: updated[0],
      message: 'Booking declined successfully',
    });
  } catch (error: any) {
    console.error('Error declining booking:', error);
    return c.json({ error: error.message }, 500);
  }
}

// Note: getVendorBookingDetails, getVendorBookingsAlias, and getVendorBookingsToday handlers
// will be added here. Due to the large scope, handlers are being extracted systematically.
// The remaining handlers from vendor-bookings.ts, vendor-booking-actions.ts, and 
// bookings-enhanced.ts will be added as the migration continues.
