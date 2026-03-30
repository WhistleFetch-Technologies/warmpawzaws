/**
 * ============================================================================
 * BOOKING ENDPOINTS - ENHANCED VERSION (PHASE 3)
 * ============================================================================
 * 
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 * 
 * Endpoints:
 * - POST /bookings/create - Create new booking. Body: serviceId (required), optional selectedServices[],
 *   totalDurationMinutes, totalAmount; single-service or multi-service supported (selected_services stored as JSONB).
 *   Returns 4xx (400/403/404/409) for validation, not found, conflict, or business errors; 2xx only on success.
 *   All error paths use this.error() so HTTP status is 4xx (never 200 with error body).
 * - GET /bookings/:id - Get booking details
 * - PUT /bookings/:id/status - Update booking status
 * - GET /bookings/:id/history - Get booking status history
 * - POST /bookings/:id/cancel - Cancel booking
 * - POST /bookings/:id/reschedule - Reschedule booking
 * 
 * Date: 2026-01-28
 * Phase: 3
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../../handler/base-handler-enhanced';
import { query, select, insert, withTransaction } from '../../../database/rds-connection';
import { checkIdempotencyKey, storeIdempotencyKey } from '../../../utils/idempotency';
import { logAuditEntry, logBookingStatusChange } from '../../../utils/audit-log';
import { calculateStaffETA } from '../../../utils/commute-time-calculator';
import { validateServiceAvailability } from '../../../utils/service-availability-validator';
import { normalizeDbRow, buildBookingResponse, parseSelectedServices } from '../../../utils/entity-extractor';
import { normalizeBooking, isValidUUID } from '../../../types/entities';
import { getDiscoveryRules } from '../../../lib/rule-engine';
import { getRefundTierForCancellation, computeRefundFromTier, previewCustomerCancellationRefund } from '../../../lib/services/cancellation-policy-service';
import { sendEventNotification } from '../../../aws/aws-sns-notification-service';
import {
  CreateBookingRequestSchema,
  UpdateBookingStatusRequestSchema,
} from '@warmpawz/api-contracts/bookings';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_ADVANCE_BOOKING_DAYS = 60;
const DEFAULT_MIN_NOTICE_HOURS = 1;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Type for API Gateway event structure used in booking endpoints
 */
interface ApiGatewayEventLike {
  httpMethod: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  pathParameters: Record<string, string>;
  queryStringParameters: Record<string, string>;
  requestContext: {
    requestId: string;
    http?: { method: string; path: string };
  };
  rawPath?: string;
  rawQueryString?: string;
  isBase64Encoded: boolean;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

function validateBookingDate(bookingDate: string, bookingTime: string, minNoticeHours: number = DEFAULT_MIN_NOTICE_HOURS): { valid: boolean; error?: string } {
  const now = new Date();
  const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
  
  if (isNaN(bookingDateTime.getTime())) {
    return { valid: false, error: 'Invalid booking date or time format' };
  }

  const minBookingTime = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  if (bookingDateTime < minBookingTime) {
    return { 
      valid: false, 
      error: `Booking must be at least ${minNoticeHours} hour(s) in the future` 
    };
  }

  const maxBookingDate = new Date(now);
  maxBookingDate.setDate(maxBookingDate.getDate() + MAX_ADVANCE_BOOKING_DAYS);
  if (bookingDateTime > maxBookingDate) {
    return { 
      valid: false, 
      error: `Cannot book more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance` 
    };
  }

  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  if (!timeRegex.test(bookingTime)) {
    return { valid: false, error: 'Invalid time format. Use HH:MM format' };
  }

  return { valid: true };
}

function generateEventMetadata(requestId?: string) {
  return {
    eventTimestamp: new Date().toISOString(),
    eventId: randomUUID(),
    requestId: requestId || randomUUID(),
    sourceService: 'booking-handler',
  };
}

// ============================================================================
// BOOKING HANDLERS
// ============================================================================

class CreateBookingHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    //Resolve customerId from customerPhone when missing (CreateBookingRequestSchema requires customerId)
    if (!body.customerId && body.customerPhone) {
      try {
        const custResult = await query(
          `SELECT id FROM customers WHERE phone = $1 LIMIT 1`,
          [String(body.customerPhone).trim()]
        );
        const rows = (custResult as any).rows || custResult;
        if (rows?.length > 0) {
          body.customerId = rows[0].id;
          console.log(`[BOOKING] Resolved customerId from customerPhone: ${body.customerId}`);
        }
      } catch (e) {
        console.warn('[BOOKING] Could not resolve customerId from customerPhone:', e);
      }
    }
    if (!body.customerId) {
      return this.error('customerId or customerPhone (to resolve customer) is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Validate request with Zod schema
    const validationResult = CreateBookingRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    const {
      customerId,
      vendorId,
      serviceId,
      staffId,
      bookingDate,
      bookingTime,
      serviceType: rawServiceType,
      address,
      petId,
      amount: amountFromSchema,
      totalAmount,
      idempotencyKey,
      selectedServices, // ✅ NEW: Multiple services support
      serviceName,
      customerPhone,
      customerName,
      petName,
      notes: notesFromSchema,
      packagePurchaseId,
    } = validationResult.data;

    const amount = amountFromSchema ?? totalAmount;
    // ✅ Map legacy 'online' to 'tele' for backward compatibility
    // Note: 'tele' is already used in DB schema (vendor_services.service_style, vendor_availability_v2.service_style)
    const serviceType = rawServiceType === 'online' ? 'tele' : (rawServiceType || 'at_vendor');

    // ✅ Phase 2.3: Extract roomId and promotionId from raw body (may not be in schema)
    const roomId = body.roomId || body.room_id;
    const promotionId = body.promotionId || body.promotion_id;
    
    // ✅ Calculate total duration and amount from selected services if provided
    let totalDurationMinutes = 0;
    let totalSelectedServicesAmount = 0;
    if (selectedServices && selectedServices.length > 0) {
      totalDurationMinutes = selectedServices.reduce((sum, s) => {
        const quantity = s.quantity || 1;
        const duration = s.duration || 30;
        return sum + (duration * quantity);
      }, 0);
      
      totalSelectedServicesAmount = selectedServices.reduce((sum, s) => {
        const quantity = s.quantity || 1;
        const price = s.price || 0;
        return sum + (price * quantity);
      }, 0);
      
      console.log(`[BOOKING] Multiple services: ${selectedServices.length} services, total duration: ${totalDurationMinutes}min, total amount: ₹${totalSelectedServicesAmount}`);
    }

    // Check idempotency key first
    if (idempotencyKey) {
      const existing = await checkIdempotencyKey(idempotencyKey);
      if (existing.exists) {
        return {
          statusCode: existing.httpStatus || 200,
          headers: { 'X-Idempotent-Replay': 'true' },
          body: existing.response,
        };
      }
    }

    // Validate booking date/time (rule engine: booking_min_notice_hours)
    const bookingRules = await getDiscoveryRules('all', 'booking');
    const minNoticeHours = bookingRules.booking_min_notice_hours ?? 1;
    const dateValidation = validateBookingDate(bookingDate, bookingTime, minNoticeHours);
    if (!dateValidation.valid) {
      return this.error(dateValidation.error!, 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Validate service exists and belongs to vendor
    // ✅ CRITICAL FIX: Frontend sends serviceId which is service.service_id (base service UUID)
    // NOT vendor_services.id. We need to look up by service_id column in vendor_services table.
    // ✅ Diagnostics: when serviceId is 'diagnostics', resolve to a diagnostics vendor_service for this vendor
    let resolvedServiceId = serviceId;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(serviceId || ''));
    if (!isUUID && (String(serviceId).toLowerCase() === 'diagnostics' || String(serviceId).toLowerCase() === 'diagnostic')) {
      const diagResult = await query(
        `SELECT * FROM vendor_services WHERE vendor_id = $1::uuid AND (is_enabled = true OR is_enabled IS NULL) ORDER BY created_at ASC LIMIT 1`,
        [vendorId]
      );
      if (diagResult.rows?.length > 0) {
        const row = diagResult.rows[0];
        resolvedServiceId = row.service_id || row.id;
        console.log(`[BOOKING] Resolved diagnostics serviceId to ${resolvedServiceId} for vendor ${vendorId}`);
      } else {
        // Fallback: diagnostics center has tests but no vendor_services - create service + vendor_service
        const diagTests = await query(
          `SELECT id, price FROM diagnostic_tests WHERE vendor_id = $1::uuid LIMIT 1`,
          [vendorId]
        );
        if (diagTests.rows?.length > 0) {
          const test = diagTests.rows[0];
          const labServiceId = 'a1b2c3d4-e5f6-4789-a012-345678901234';
          await query(
            `INSERT INTO services (id, name, description, category, price, duration_minutes, is_active, created_at, updated_at)
             VALUES ($1, 'Lab Tests', 'Diagnostic lab tests', 'diagnostics', $2, 30, true, NOW(), NOW())
             ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
            [labServiceId, test.price || 0]
          );
          try {
            await query(
              `INSERT INTO vendor_services (vendor_id, service_id, service_name, service_style, publish_status, is_enabled, created_at, updated_at)
               VALUES ($1, $2, 'Lab Tests', 'at_center', 'published', true, NOW(), NOW())`,
              [vendorId, labServiceId]
            );
          } catch (insErr: any) {
            if (!insErr.message?.includes('unique') && insErr.code !== '23505') {
              console.warn('[BOOKING] vendor_services insert:', insErr.message);
            }
          }
          resolvedServiceId = labServiceId;
          console.log(`[BOOKING] Diagnostics: created lab service + vendor_service for vendor ${vendorId}`);
        }
      }
    }
    if (!isUUID && resolvedServiceId === serviceId && String(serviceId).toLowerCase() === 'diagnostics') {
      return this.error('Diagnostics service not found for this vendor. Vendor must have diagnostic tests or services configured.', 404, 'NOT_FOUND', undefined, requestId);
    }
    const lookupServiceId = resolvedServiceId;

    console.log(`[BOOKING] Looking up service ${lookupServiceId} for vendor ${vendorId}`);
    
    let service: any = null; // Initialize service variable
    
    // ✅ CRITICAL FIX: PRIMARY LOOKUP - Check vendor_services.id FIRST (bookings.service_id FK references vendor_services.id)
    // Frontend now sends vendor_services.id, not services.id, so we must check id column first
    console.log(`[BOOKING] PRIMARY: Checking if ${lookupServiceId} is a vendor_services.id (primary key)`);
    let vendorServiceByIdResult = await query(
      `SELECT * FROM vendor_services 
       WHERE id = $1::uuid 
       AND vendor_id = $2::uuid 
       AND (is_enabled = true OR is_enabled IS NULL)
       AND publish_status = 'published'
       LIMIT 1`,
      [lookupServiceId, vendorId]
    );
    
    if (vendorServiceByIdResult.rows.length > 0) {
      console.log(`[BOOKING] Found vendor_service by id (primary lookup - vendor_services.id)`);
      service = vendorServiceByIdResult.rows[0];
    } else {
      // FALLBACK 1: Try vendor_services.id without publish_status check
      console.log(`[BOOKING] Service not found with publish_status='published', trying vendor_services.id without it`);
      vendorServiceByIdResult = await query(
        `SELECT * FROM vendor_services 
         WHERE id = $1::uuid 
         AND vendor_id = $2::uuid 
         AND (is_enabled = true OR is_enabled IS NULL)
         LIMIT 1`,
        [lookupServiceId, vendorId]
      );
      
      if (vendorServiceByIdResult.rows.length > 0) {
        console.log(`[BOOKING] Found vendor_service by id (without publish_status check)`);
        service = vendorServiceByIdResult.rows[0];
      } else {
        // FALLBACK 2: Try vendor_services.id without any status checks
        console.log(`[BOOKING] Service not found with status checks, trying vendor_services.id without any checks`);
        vendorServiceByIdResult = await query(
          `SELECT * FROM vendor_services 
           WHERE id = $1::uuid 
           AND vendor_id = $2::uuid 
           LIMIT 1`,
          [lookupServiceId, vendorId]
        );
        
        if (vendorServiceByIdResult.rows.length > 0) {
          console.log(`[BOOKING] Found vendor_service by id (no status checks)`);
          service = vendorServiceByIdResult.rows[0];
        } else {
          // FALLBACK 3: Check vendor_services by service_id (legacy support for services.id)
          console.log(`[BOOKING] Service not found by vendor_services.id, checking if it's a vendor_services.service_id (services.id reference)`);
    let vendorServicesResult = await query(
      `SELECT * FROM vendor_services 
       WHERE service_id = $1::uuid 
       AND vendor_id = $2::uuid 
       AND (is_enabled = true OR is_enabled IS NULL)
       AND publish_status = 'published'
       LIMIT 1`,
      [lookupServiceId, vendorId]
    );
    
    if (vendorServicesResult.rows.length > 0) {
            console.log(`[BOOKING] Found vendor_service by service_id (legacy lookup)`);
      service = vendorServicesResult.rows[0];
    } else {
            // FALLBACK 4: Try service_id without publish_status
            console.log(`[BOOKING] Service not found by service_id with publish_status, trying without it`);
      vendorServicesResult = await query(
        `SELECT * FROM vendor_services 
         WHERE service_id = $1::uuid 
         AND vendor_id = $2::uuid 
         AND (is_enabled = true OR is_enabled IS NULL)
         LIMIT 1`,
        [lookupServiceId, vendorId]
      );
      
      if (vendorServicesResult.rows.length > 0) {
        console.log(`[BOOKING] Found vendor_service by service_id (without publish_status check)`);
        service = vendorServicesResult.rows[0];
      } else {
              // FALLBACK 5: Try service_id without any checks
              console.log(`[BOOKING] Service not found by service_id with status checks, trying without any checks`);
        vendorServicesResult = await query(
          `SELECT * FROM vendor_services 
           WHERE service_id = $1::uuid 
           AND vendor_id = $2::uuid 
           LIMIT 1`,
          [lookupServiceId, vendorId]
        );
        
        if (vendorServicesResult.rows.length > 0) {
          console.log(`[BOOKING] Found vendor_service by service_id (no status checks)`);
          service = vendorServicesResult.rows[0];
        } else {
                // FALLBACK 6: Check base services table
            const services = await select('services', { id: lookupServiceId });
            console.log(`[BOOKING] Found ${services.length} services in services table`);
            let baseService = services.length > 0 ? services[0] : null;
            
            if (baseService) {
              // Base service exists, but no vendor_services entry found
              // This shouldn't happen if the service was fetched from the customer clinic endpoint
              console.error(`[BOOKING] Base service ${serviceId} exists but no vendor_services entry found for vendor ${vendorId}`);
              return this.error('Service not found for this vendor', 404, 'NOT_FOUND', undefined, requestId);
            } else {
              // Service doesn't exist in base services table either
              console.error(`[BOOKING] Service ${serviceId} not found in services table or vendor_services table`);
              return this.error('Service not found', 404, 'NOT_FOUND', undefined, requestId);
                }
              }
            }
          }
        }
      }
    }
    
    // Final check: if service still not found after all fallbacks
    if (!service) {
      // Try without vendor_id check for better error message
      console.log(`[BOOKING] Checking if service exists for any vendor (without vendor_id check)`);
      const anyVendorServiceResult = await query(
        `SELECT * FROM vendor_services WHERE service_id = $1::uuid LIMIT 1`,
        [lookupServiceId]
      );
      const anyVendorService = anyVendorServiceResult.rows;
      console.log(`[BOOKING] Found ${anyVendorService.length} vendor_services with service_id=${serviceId} (any vendor)`);
      
      if (anyVendorService.length === 0) {
        console.error(`[BOOKING] Service ${serviceId} not found in vendor_services table (no vendor has this service)`);
        return this.error('Service not found', 404, 'NOT_FOUND', undefined, requestId);
      } else {
        const foundVendorId = anyVendorService[0].vendor_id || anyVendorService[0].vendorId;
        console.error(`[BOOKING] Service ${serviceId} exists but belongs to vendor ${foundVendorId}, not ${vendorId}`);
        return this.error('Service does not belong to this vendor', 404, 'NOT_FOUND', undefined, requestId);
      }
    }
    
    // Validate service state/status (for all service lookup paths)
    if (service) {
      console.log(`[BOOKING] Service found: id=${service.id}, vendor_id=${service.vendor_id || service.vendorId}, state=${service.state}, status=${service.status}`);
      console.log(`[BOOKING] Service object keys: ${Object.keys(service).join(', ')}`);
      console.log(`[BOOKING] Will use service.id=${service.id} for booking insert (instead of serviceId=${serviceId})`);
      
      // Check if service is active/live (if state/status fields exist)
      if (service.state && service.state !== 'active' && service.state !== 'live') {
        console.error(`[BOOKING] Service ${serviceId} state is ${service.state}, not active/live`);
        return this.error(`Service is not available (state: ${service.state})`, 400, 'VALIDATION_ERROR', undefined, requestId);
      }
      if (service.status && service.status !== 'active' && service.status !== 'live') {
        console.error(`[BOOKING] Service ${serviceId} status is ${service.status}, not active/live`);
        return this.error(`Service is not available (status: ${service.status})`, 400, 'VALIDATION_ERROR', undefined, requestId);
      }
      if (service.is_active === false || service.is_live === false) {
        console.error(`[BOOKING] Service ${serviceId} is not active/live`);
        return this.error('Service is not currently available', 400, 'VALIDATION_ERROR', undefined, requestId);
      }
    }

    // Get vendor's role to validate service availability
    let roleId: string | null = null;
    try {
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length > 0) {
        roleId = vendors[0].role_id || vendors[0].roleId || null;
        
        // If no role_id, try to get from vendor_roles table
        if (!roleId) {
          try {
            const vendorRoles = await query(
              `SELECT role_id FROM vendor_roles WHERE vendor_id = $1 LIMIT 1`,
              [vendorId]
            );
            if (vendorRoles.rows.length > 0) {
              roleId = vendorRoles.rows[0].role_id;
            }
          } catch (error: any) {
            // ✅ FIX: vendor_roles table may not exist - gracefully skip
            console.warn('[BOOKING] vendor_roles table not found or query failed, skipping role lookup:', error.message);
          }
        }
        
        // Fallback: try to infer from vendor type
        if (!roleId && vendors[0].vendor_type) {
          const vendorType = vendors[0].vendor_type.toLowerCase();
          // Map common vendor types to role codes
          const typeToRole: Record<string, string> = {
            'veterinarian': 'veterinarian',
            'vet': 'veterinarian',
            'groomer': 'groomer',
            'grooming': 'groomer',
            'walker': 'walker',
            'trainer': 'trainer',
            'training': 'trainer',
          };
          roleId = typeToRole[vendorType] || vendorType;
        }
      }
    } catch (error) {
      console.warn('[Booking] Could not fetch vendor role, skipping availability check:', error);
    }

    // Validate service availability (Dashboard UI config + role restrictions)
    if (roleId) {
      const availabilityResult = await validateServiceAvailability(
        lookupServiceId,
        roleId,
        customerId
      );

      if (!availabilityResult.available) {
        const errorMessage = availabilityResult.reason || 'Service is not available';
        const errorCode = availabilityResult.code || 'SERVICE_UNAVAILABLE';
        
        return this.error(
          errorMessage,
          403,
          errorCode,
          { 
            serviceId,
            roleId,
            reason: availabilityResult.reason,
            code: availabilityResult.code
          },
          requestId
        );
      }
    }

    try {
      const result = await withTransaction(async (client) => {
        // ✅ FIX: Check for duplicate booking first (same customer/vendor/date/time within last 5 minutes)
        // This prevents SLOT_CONFLICT errors from retries/double-clicks
        const duplicateCheckQuery = staffId
          ? `SELECT id, status, created_at FROM bookings 
             WHERE customer_id = $1 
             AND vendor_id = $2 
             AND booking_date = $3 
             AND booking_time = $4
             AND staff_id = $5
             AND created_at > NOW() - INTERVAL '5 minutes'
             AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
             ORDER BY created_at DESC
             LIMIT 1`
          : `SELECT id, status, created_at FROM bookings 
             WHERE customer_id = $1 
             AND vendor_id = $2 
             AND booking_date = $3 
             AND booking_time = $4
             AND staff_id IS NULL
             AND created_at > NOW() - INTERVAL '5 minutes'
             AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
             ORDER BY created_at DESC
             LIMIT 1`;
        
        const duplicateParams = staffId
          ? [customerId, vendorId, bookingDate, bookingTime, staffId]
          : [customerId, vendorId, bookingDate, bookingTime];
        
        const duplicateResult = await client.query(duplicateCheckQuery, duplicateParams);
        
        if (duplicateResult.rows.length > 0) {
          const existingBooking = duplicateResult.rows[0];
          console.log(`[BOOKING] Duplicate booking detected (likely retry/double-click): ${existingBooking.id}, returning existing booking`);
          // Return the existing booking instead of creating a new one
          const existingBookingFull = await client.query(
            `SELECT * FROM bookings WHERE id = $1`,
            [existingBooking.id]
          );
          return existingBookingFull.rows[0];
        }

        // ✅ FIX: Check overlap using ONLY service duration (no buffer blocking)
        // Buffer is informational (travel/prep/setup) and should NOT block adjacent slots
        // Get booking duration
        const bookingDuration = totalDurationMinutes || service?.duration_minutes || service?.custom_duration || 30;
        
        // Convert booking time to minutes
        const [bookingHour, bookingMin] = bookingTime.split(':').map(Number);
        const newBookingStartMinutes = bookingHour * 60 + bookingMin;
        const newBookingEndMinutes = newBookingStartMinutes + bookingDuration;  // ✅ NO buffer

        // ✅ FIX: Fetch existing bookings for overlap check with row-level locking
        // FOR UPDATE locks the rows, preventing concurrent modifications during the transaction
        // This ensures atomic slot booking: no two bookings can be created for the same slot simultaneously
        const overlapQuery = staffId
          ? `SELECT id, booking_time, COALESCE(duration_minutes, total_duration_minutes, 30) as duration_minutes
             FROM bookings 
             WHERE vendor_id = $1 
             AND booking_date = $2 
             AND staff_id = $3
             AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
             FOR UPDATE`
          : `SELECT id, booking_time, COALESCE(duration_minutes, total_duration_minutes, 30) as duration_minutes
             FROM bookings 
             WHERE vendor_id = $1 
             AND booking_date = $2 
             AND staff_id IS NULL
             AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
             FOR UPDATE`;

        const overlapParams = staffId
          ? [vendorId, bookingDate, staffId]
          : [vendorId, bookingDate];

        const { rows: existingBookings } = await client.query(overlapQuery, overlapParams);

        // ✅ CRITICAL FIX: Buffer time is informational only for ALL services
        // Buffer time (travel/prep/setup) is retrieved for informational purposes but is NOT used in overlap checks
        // ALL services (tele, at_center, at_home) use EXACT service duration for overlap calculations
        // This ensures atomic slot behavior: booking at 2:00 PM (30min) ends at 2:30 PM
        // Slot at 2:30 PM should be available (no overlap: 870 < 870 = false)
        let bufferMinutes = 0;  // Retrieved for informational purposes only, not used in overlap checks
        const normalizedServiceStyle = (serviceType === 'at_vendor' || serviceType === 'at_center') ? 'at_center' : serviceType;
        
        // Get buffer time for informational purposes (logging, scheduling spacing, etc.)
        // But do NOT use it in overlap calculations
        // ✅ CRITICAL FIX: Use SAVEPOINTs for optional queries inside transaction
        // In PostgreSQL, a failed query inside a transaction aborts the ENTIRE transaction
        // even if JavaScript catches the error. SAVEPOINTs allow recovery from errors.
        try {
          let minNoticeMinutes = 30;
          try {
            await client.query('SAVEPOINT sp_scheduling_policies');
            const policiesResult = await client.query(`SELECT policy_type, policy_config FROM scheduling_policies WHERE is_active = true`);
            await client.query('RELEASE SAVEPOINT sp_scheduling_policies');
            const bufferPolicy = policiesResult.rows?.find((p: any) => p.policy_type === 'buffer_time');
            if (bufferPolicy?.policy_config) {
              const cfg = bufferPolicy.policy_config as any;
              minNoticeMinutes = cfg.minBufferTime ?? cfg.minNoticeMinutes ?? 30;
            }
          } catch (_) {
            await client.query('ROLLBACK TO SAVEPOINT sp_scheduling_policies').catch(() => {});
          }
          
          const dayOfWeek = new Date(bookingDate).getDay();
          try {
            await client.query('SAVEPOINT sp_vendor_availability');
            const va2Result = await client.query(
              `SELECT lead_time_by_style, buffer_time
               FROM vendor_availability_v2
               WHERE vendor_id = $1
                 AND day_of_week = $2
                 AND (COALESCE(is_available, true) = true)
               LIMIT 1`,
              [vendorId, dayOfWeek]
            );
            await client.query('RELEASE SAVEPOINT sp_vendor_availability');
            
            if (va2Result.rows && va2Result.rows.length > 0) {
              const row = va2Result.rows[0];
              const leadByStyle = row.lead_time_by_style != null
                ? (typeof row.lead_time_by_style === 'string' ? JSON.parse(row.lead_time_by_style) : row.lead_time_by_style)
                : {};
              bufferMinutes = (leadByStyle && typeof leadByStyle === 'object' && leadByStyle[normalizedServiceStyle] != null)
                ? Number(leadByStyle[normalizedServiceStyle])
                : Number(row.buffer_time) || minNoticeMinutes;
              console.log(`[BOOKING] ${normalizedServiceStyle}: Found buffer=${bufferMinutes}min (informational only, not used in overlap check)`);
            }
          } catch (va2Err: any) {
            await client.query('ROLLBACK TO SAVEPOINT sp_vendor_availability').catch(() => {});
            // Ignore - buffer is informational only
          }
        } catch (err) {
          // Ignore - buffer is informational only
        }

        // ✅ ATOMIC SLOT OVERLAP CHECK
        // Each slot is atomic (30 min). A booking blocks ONLY the slot it starts at.
        // Booking at 09:00 blocks ONLY 09:00. New booking at 09:30 is allowed.
        // This applies to ALL service types (tele, at_center, at_home) and ALL roles.
        // Buffer time is informational only and does NOT block adjacent slots.
        const SLOT_SIZE = 30; // Atomic slot size in minutes
        
        console.log(`[BOOKING] Checking overlap (ATOMIC): newBooking=${bookingTime} (${newBookingStartMinutes}min), slotSize=${SLOT_SIZE}min, serviceType=${serviceType}`);
        console.log(`[BOOKING] Existing bookings: ${existingBookings.length}`);
        
        const hasOverlap = existingBookings.some((existing: any) => {
          const [existingHour, existingMin] = existing.booking_time.split(':').map(Number);
          const existingStartMinutes = existingHour * 60 + existingMin;
          
          // ✅ ATOMIC: Use SLOT_SIZE (30 min) for BOTH existing and new booking
          // NOT the stored duration_minutes, which may be longer than one slot
          const existingEndMinutes = existingStartMinutes + SLOT_SIZE;
          const newBookingEndMinutes = newBookingStartMinutes + SLOT_SIZE;
          
          // ATOMIC OVERLAP: (newStart < existingEnd) AND (newEnd > existingStart)
          // Example: Existing 09:00 (end=09:30), New 09:30 (end=10:00)
          //   570 < 570 && 600 > 540 = false && true = false → NO overlap ✅
          const overlaps = newBookingStartMinutes < existingEndMinutes && newBookingEndMinutes > existingStartMinutes;
          
          if (overlaps) {
            console.log(`[BOOKING] OVERLAP (atomic): newBooking ${bookingTime} blocked by existing ${existing.booking_time}`);
          }
          
          return overlaps;
        });

        if (hasOverlap) {
          throw new Error('SLOT_CONFLICT');
        }

        // Create booking
        // ✅ CRITICAL FIX: Foreign key constraint bookings_service_id_vendor_services_fkey expects vendor_services.id
        // NOT services.id. We must use service.id (vendor_services.id) for the booking insert.
        if (!service) {
          console.error(`[BOOKING] Service object is missing. serviceId=${serviceId}`);
          throw new Error('Service object is invalid');
        }
        
        // ✅ FIX: Use service.id (vendor_services.id) directly for the foreign key constraint
        // The bookings.service_id FK references vendor_services.id, not services.id
        const finalServiceId = service.id;
        console.log(`[BOOKING] Using service.id=${finalServiceId} (vendor_services.id) for booking insert`);
        console.log(`[BOOKING] This matches the foreign key constraint bookings_service_id_vendor_services_fkey`);
        
        console.log(`[BOOKING] Inserting booking with service_id=${finalServiceId} (vendor_services.id for FK constraint)`);
        
        // ✅ FIX GAP PM-1: Check for active unlimited subscription
        let subscriptionId: string | null = null;
        let isSubscriptionBooking = false;
        let finalAmount = amount || 0;
        // ✅ Package booking: when packagePurchaseId provided, use package credit (0 payment)
        let isPackageBooking = false;
        let packagePurchaseIdToUse: string | null = null;
        let packageSessionNumberToUse: number | null = null;
        let pkgForDeduction: { remaining_sessions: number; unlimited_usage: boolean } | null = null;

        // ✅ CRITICAL FIX: Use SAVEPOINT so that if package_purchases table or columns don't exist,
        // the PostgreSQL transaction is not aborted.
        if (packagePurchaseId) {
          try {
            await client.query('SAVEPOINT sp_package_check');
            const tableCheck = await client.query(
              `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'package_purchases'
              ) as exists`
            );
            
            if (!tableCheck.rows[0]?.exists) {
              console.warn('[BOOKING] package_purchases table not found, skipping package booking');
            } else {
              const packageResult = await client.query(
                `SELECT id, remaining_sessions, unlimited_usage, total_sessions
                 FROM package_purchases
                 WHERE id = $1 AND customer_id = $2 AND vendor_id = $3
                   AND status = 'active'
                   AND (expires_at IS NULL OR expires_at > NOW())
                   AND (remaining_sessions > 0 OR unlimited_usage = true)`,
                [packagePurchaseId, customerId, vendorId]
              );
              if (packageResult.rows?.length > 0) {
                const pkg = packageResult.rows[0];
                const sessionsUsed = (pkg.total_sessions || 0) - (pkg.remaining_sessions || 0);
                packagePurchaseIdToUse = pkg.id;
                packageSessionNumberToUse = sessionsUsed + 1;
                pkgForDeduction = { remaining_sessions: pkg.remaining_sessions, unlimited_usage: pkg.unlimited_usage };
                isPackageBooking = true;
                finalAmount = 0;
                console.log(`[BOOKING] Using package ${packagePurchaseId}. Session #${packageSessionNumberToUse}. Amount 0.`);
              }
            }
            await client.query('RELEASE SAVEPOINT sp_package_check');
          } catch (error: any) {
            await client.query('ROLLBACK TO SAVEPOINT sp_package_check').catch(() => {});
            console.warn('[BOOKING] Package check failed (table/column may not exist), skipping:', (error as any)?.message);
          }
        }

        // ✅ CRITICAL FIX: Use SAVEPOINT to protect transaction from subscription query failures
        // The customer_subscriptions table or its columns (e.g. end_date) may not exist in dev/UAT,
        // which would abort the entire PostgreSQL transaction without a SAVEPOINT.
        try {
          // Skip subscription check when already using package
          if (!isPackageBooking) {
          // Get service category for subscription matching
          const serviceCategory = service.category || null;
          
          await client.query('SAVEPOINT sp_subscription_check');
          const activeSubscriptions = await client.query(
            `SELECT * FROM customer_subscriptions 
             WHERE customer_id = $1 
             AND status = 'active'
             AND start_date <= CURRENT_DATE
             AND end_date >= CURRENT_DATE
             AND plan_type = 'unlimited'
             AND (service_category IS NULL OR service_category = $2)
             AND (vendor_id IS NULL OR vendor_id = $3)
             AND (bookings_limit IS NULL OR bookings_used < bookings_limit)
             ORDER BY 
               CASE WHEN vendor_id = $3 THEN 0 ELSE 1 END,
               CASE WHEN service_category = $2 THEN 0 ELSE 1 END
             LIMIT 1`,
            [customerId, serviceCategory, vendorId]
          );
          await client.query('RELEASE SAVEPOINT sp_subscription_check');
          
          const subscriptions = (activeSubscriptions as any).rows || [];
          
          if (subscriptions.length > 0) {
            const subscription = subscriptions[0];
            subscriptionId = subscription.id;
            isSubscriptionBooking = true;
            finalAmount = 0; // Zero payment for unlimited subscription
            
            // Increment usage count
            await client.query(
              `UPDATE customer_subscriptions 
               SET bookings_used = COALESCE(bookings_used, 0) + 1, updated_at = NOW()
               WHERE id = $1`,
              [subscriptionId]
            );
            
            console.log(`[BOOKING] ✅ Active unlimited subscription found: ${subscriptionId}. Setting amount to ₹0.`);
          }
          }
        } catch (subError) {
          await client.query('ROLLBACK TO SAVEPOINT sp_subscription_check').catch(() => {});
          console.warn('[BOOKING] Could not check subscriptions (table/column may not exist):', (subError as any)?.message);
        }
        
        // ✅ Calculate final amounts considering multiple services
        // Priority: 1. Package (free), 2. Subscription (free), 3. Selected services total, 4. Single service amount
        const calculatedBasePrice = totalSelectedServicesAmount > 0 ? totalSelectedServicesAmount : (amount || 0);
        const calculatedFinalAmount = isPackageBooking || isSubscriptionBooking ? 0 : calculatedBasePrice;
        const paymentStatus = isPackageBooking ? 'completed' : (isSubscriptionBooking ? 'paid' : 'pending');
        
        // ✅ CRITICAL FIX: Extract coordinates from address_id or address field for GPS tracking
        let bookingLatitude: number | null = null;
        let bookingLongitude: number | null = null;
        let addressIdToStore: string | null = null;
        
        // Priority 1: Check if address_id is provided in request
        const addressIdFromRequest = body.addressId || body.address_id;
        if (addressIdFromRequest) {
          try {
            await client.query('SAVEPOINT sp_address_lookup');
            const addressesResult = await client.query(
              `SELECT * FROM customer_addresses WHERE id = $1::uuid`,
              [addressIdFromRequest]
            );
            await client.query('RELEASE SAVEPOINT sp_address_lookup');
            const addresses = addressesResult.rows;
            if (addresses.length > 0) {
              const addr = addresses[0] as any;
              addressIdToStore = addressIdFromRequest;
              
              // Extract coordinates from address
              if (addr.coordinates) {
                try {
                  const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
                  bookingLatitude = coords?.lat ?? coords?.latitude ?? null;
                  bookingLongitude = coords?.lng ?? coords?.longitude ?? null;
                } catch {
                  // Ignore parse errors
                }
              }
              
              // Also check if address has separate latitude/longitude columns
              if (!bookingLatitude && addr.latitude) {
                bookingLatitude = parseFloat(String(addr.latitude));
              }
              if (!bookingLongitude && addr.longitude) {
                bookingLongitude = parseFloat(String(addr.longitude));
              }
              
              console.log(`[BOOKING] Extracted coordinates from address_id ${addressIdFromRequest}: ${bookingLatitude}, ${bookingLongitude}`);
            }
          } catch (addrErr) {
            await client.query('ROLLBACK TO SAVEPOINT sp_address_lookup').catch(() => {});
            console.warn('[BOOKING] Could not fetch address by address_id:', (addrErr as any)?.message);
          }
        }
        
        // Priority 2: Extract coordinates from address field if it's a JSON object
        if (!bookingLatitude && address) {
          try {
            const addressObj = typeof address === 'string' ? JSON.parse(address) : address;
            if (addressObj && typeof addressObj === 'object') {
              bookingLatitude = addressObj.latitude ?? addressObj.lat ?? addressObj.coordinates?.lat ?? addressObj.coordinates?.latitude ?? null;
              bookingLongitude = addressObj.longitude ?? addressObj.lng ?? addressObj.coordinates?.lng ?? addressObj.coordinates?.longitude ?? null;
              
              if (bookingLatitude) bookingLatitude = parseFloat(String(bookingLatitude));
              if (bookingLongitude) bookingLongitude = parseFloat(String(bookingLongitude));
              
              if (bookingLatitude && bookingLongitude) {
                console.log(`[BOOKING] Extracted coordinates from address field: ${bookingLatitude}, ${bookingLongitude}`);
              }
            }
          } catch {
            // Address is not JSON, ignore
          }
        }

        // Priority 3: If still no coordinates, look up customer's saved addresses by customer_id
        if (!bookingLatitude && customerId) {
          try {
            await client.query('SAVEPOINT sp_cust_addr_lookup');
            const custAddresses = await client.query(
              `SELECT id, latitude, longitude, coordinates, is_default
               FROM customer_addresses 
               WHERE customer_id = $1 
               ORDER BY is_default DESC NULLS LAST, created_at DESC 
               LIMIT 5`,
              [customerId]
            );
            await client.query('RELEASE SAVEPOINT sp_cust_addr_lookup');
            if (custAddresses.rows.length > 0) {
              console.log(`[BOOKING] Found ${custAddresses.rows.length} saved addresses for customer ${customerId}`);
              for (const addr of custAddresses.rows) {
                let lat: number | null = null;
                let lng: number | null = null;
                
                // Check direct lat/lng columns
                if (addr.latitude != null && addr.longitude != null) {
                  lat = parseFloat(String(addr.latitude));
                  lng = parseFloat(String(addr.longitude));
                }
                
                // Check coordinates JSONB
                if (lat == null && addr.coordinates) {
                  try {
                    const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
                    lat = coords?.lat ?? coords?.latitude ?? null;
                    lng = coords?.lng ?? coords?.longitude ?? null;
                    if (lat != null) lat = parseFloat(String(lat));
                    if (lng != null) lng = parseFloat(String(lng));
                  } catch { /* ignore */ }
                }
                
                if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                  bookingLatitude = lat;
                  bookingLongitude = lng;
                  if (!addressIdToStore) {
                    addressIdToStore = addr.id;
                  }
                  console.log(`[BOOKING] Using customer address ${addr.id} coordinates: ${lat}, ${lng}`);
                  break;
                }
              }
            }
          } catch (custAddrErr: any) {
            await client.query('ROLLBACK TO SAVEPOINT sp_cust_addr_lookup').catch(() => {});
            console.warn(`[BOOKING] Could not look up customer addresses:`, custAddrErr?.message);
          }
        }

        // Build comprehensive address text from customer_addresses if available
        let fullAddressText = address;
        if (addressIdToStore) {
          try {
            await client.query('SAVEPOINT sp_addr_build');
            const addrRowsResult = await client.query(
              `SELECT * FROM customer_addresses WHERE id = $1::uuid`,
              [addressIdToStore]
            );
            await client.query('RELEASE SAVEPOINT sp_addr_build');
            const addrRows = addrRowsResult.rows;
            if (addrRows.length > 0) {
              const addrRec = addrRows[0] as any;
              const addrParts: string[] = [];
              if (addrRec.apartment_name) addrParts.push(addrRec.apartment_name);
              if (addrRec.flat_no && addrRec.house_no) {
                addrParts.push(`Flat ${addrRec.flat_no}, House ${addrRec.house_no}`);
              } else if (addrRec.flat_no) {
                addrParts.push(`Flat ${addrRec.flat_no}`);
              } else if (addrRec.house_no) {
                addrParts.push(`House ${addrRec.house_no}`);
              }
              if (addrRec.floor) addrParts.push(`Floor ${addrRec.floor}`);
              if (addrRec.street_name) addrParts.push(addrRec.street_name);
              if (addrRec.address_line1) addrParts.push(addrRec.address_line1);
              if (addrRec.address_line2) addrParts.push(addrRec.address_line2);
              if (addrRec.landmark) addrParts.push(`Near ${addrRec.landmark}`);
              if (addrRec.city) addrParts.push(addrRec.city);
              if (addrRec.state) addrParts.push(addrRec.state);
              if (addrRec.pincode) addrParts.push(addrRec.pincode);
              
              if (addrParts.length > 0) {
                fullAddressText = addrParts.filter(Boolean).join(', ');
                console.log(`[BOOKING] Built full address from customer_addresses: ${fullAddressText}`);
              }
            }
          } catch (addrBuildErr) {
            await client.query('ROLLBACK TO SAVEPOINT sp_addr_build').catch(() => {});
            console.warn('[BOOKING] Could not build full address from customer_addresses:', (addrBuildErr as any)?.message);
          }
        }

        // ✅ CRITICAL FIX: Only include columns that are guaranteed to exist in the bookings table
        // Core columns from the base schema (always present)
        const bookingData: Record<string, any> = {
          customer_id: customerId,
          vendor_id: vendorId,
          service_id: finalServiceId, // Use base service UUID for foreign key constraint (references services.id)
          booking_date: bookingDate,
          booking_time: bookingTime,
          service_type: serviceType || 'at_vendor',
          address: fullAddressText,
          base_price: calculatedBasePrice,
          total_amount: calculatedFinalAmount, // ✅ 0 for package or subscription
          status: isPackageBooking ? 'confirmed' : 'pending',
          notes: notesFromSchema || (petName ? `Pet: ${petName}` : null),
          // Coordinates from base schema
          latitude: bookingLatitude,
          longitude: bookingLongitude,
        };
        
        // ✅ FIX: Optional columns that may or may not exist in prod DB
        // These are added to a separate list and attempted; if INSERT fails due to
        // missing column, we retry without them
        const optionalColumns: Record<string, any> = {
          payment_status: paymentStatus,
          subscription_id: subscriptionId,
          subscription_booking: isSubscriptionBooking,
          pet_id: petId || null,
          selected_services: selectedServices && selectedServices.length > 0 
            ? JSON.stringify(selectedServices) 
            : null,
          total_duration_minutes: totalDurationMinutes || null,
          duration_minutes: bookingDuration,
          customer_phone: customerPhone || null,
          // address_id, delivery_latitude, delivery_longitude may not exist in prod
          address_id: addressIdToStore,
          delivery_latitude: bookingLatitude,
          delivery_longitude: bookingLongitude,
        };
        
        // Add optional columns to bookingData
        for (const [key, value] of Object.entries(optionalColumns)) {
          bookingData[key] = value;
        }

        // ✅ Phase 2.3: Add roomId if provided (for boarding/resort bookings)
        if (roomId) {
          bookingData.room_id = roomId;
        }

        // ✅ Phase 2.3: Add promotionId if provided (for applied promotions)
        if (promotionId) {
          bookingData.promotion_id = promotionId;
        }

        if (packagePurchaseIdToUse != null && packageSessionNumberToUse != null) {
          bookingData.package_purchase_id = packagePurchaseIdToUse;
          bookingData.is_package_session = true;
          bookingData.package_session_number = packageSessionNumberToUse;
        }

        if (staffId) {
          bookingData.staff_id = staffId;
          
          // Calculate commute time for home services
          if (serviceType === 'at_home') {
            try {
              const addressObj = typeof address === 'string' ? JSON.parse(address) : address;
              if (addressObj?.latitude && addressObj?.longitude && staffId) {
                const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
                const customerLocation = {
                  latitude: parseFloat(addressObj.latitude),
                  longitude: parseFloat(addressObj.longitude),
                };

                const commuteResult = await calculateStaffETA(
                  staffId,
                  customerLocation,
                  bookingDateTime,
                  {
                    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
                    bufferMinutes: 5,
                  }
                );

                const commuteInfo = `Commute: ${commuteResult.durationMinutes}min, Distance: ${commuteResult.distanceKm}km`;
                bookingData.notes = bookingData.notes 
                  ? `${bookingData.notes} | ${commuteInfo}`
                  : commuteInfo;

                if (commuteResult.estimatedArrival) {
                  bookingData.estimated_arrival = commuteResult.estimatedArrival;
                }
              }
            } catch (error) {
              console.warn('Failed to calculate commute time for booking:', error);
            }
          }
        }

        // ✅ CRITICAL FIX: Insert booking with automatic column fallback
        // If INSERT fails due to missing columns, retry without them
        let insertedBooking: any = null;
        let insertAttempt = 0;
        let currentBookingData = { ...bookingData };
        
        while (insertAttempt < 5) {
          insertAttempt++;
          try {
            await client.query('SAVEPOINT sp_booking_insert');
            const columns = Object.keys(currentBookingData).filter(k => currentBookingData[k] !== undefined);
            const values = columns.map(k => currentBookingData[k]);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

            console.log(`[BOOKING] INSERT attempt ${insertAttempt}, columns: ${columns.join(', ')}`);
            
            const insertResult = await client.query(
              `INSERT INTO bookings (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
              values
            );
            await client.query('RELEASE SAVEPOINT sp_booking_insert');
            insertedBooking = insertResult.rows[0];
            break; // Success!
          } catch (insertError: any) {
            await client.query('ROLLBACK TO SAVEPOINT sp_booking_insert').catch(() => {});
            const errMsg = insertError?.message || '';
            
            // Check if error is about a missing column
            const colMatch = errMsg.match(/column "(\w+)" of relation "bookings" does not exist/);
            if (colMatch && colMatch[1]) {
              const missingCol = colMatch[1];
              console.warn(`[BOOKING] Column "${missingCol}" does not exist in bookings table, removing and retrying (attempt ${insertAttempt})`);
              delete currentBookingData[missingCol];
              continue; // Retry without this column
            }
            
            // Not a missing column error, re-throw
            throw insertError;
          }
        }
        
        if (!insertedBooking) {
          throw new Error('Failed to insert booking after removing missing columns');
        }

        // ✅ Package booking: deduct session and log usage inside same transaction
        if (packagePurchaseIdToUse && pkgForDeduction && insertedBooking?.id) {
          // ✅ FIX: package_purchases table may not exist - gracefully skip package update
          // ✅ CRITICAL: Use SAVEPOINT to prevent transaction abort if table doesn't exist
          try {
            await client.query('SAVEPOINT sp_package_purchases');
            if (!pkgForDeduction.unlimited_usage) {
              await client.query(
                `UPDATE package_purchases SET remaining_sessions = remaining_sessions - 1, updated_at = NOW() WHERE id = $1`,
                [packagePurchaseIdToUse]
              );
            }
            await client.query('RELEASE SAVEPOINT sp_package_purchases');
          } catch (error: any) {
            await client.query('ROLLBACK TO SAVEPOINT sp_package_purchases').catch(() => {});
            console.warn('[BOOKING] package_purchases table not found or update failed, skipping package deduction:', error.message);
          }
          
          // ✅ FIX: package_usage_log table may not exist - gracefully skip logging
          // ✅ CRITICAL: Use SAVEPOINT to prevent transaction abort if table doesn't exist
          try {
            await client.query('SAVEPOINT sp_package_usage_log');
            await client.query(
              `INSERT INTO package_usage_log (package_purchase_id, booking_id, session_number, action, sessions_before, sessions_after, created_at)
               VALUES ($1, $2, $3, 'session_used', $4, $5, NOW())`,
              [
                packagePurchaseIdToUse,
                insertedBooking.id,
                packageSessionNumberToUse,
                pkgForDeduction.remaining_sessions,
                pkgForDeduction.unlimited_usage ? pkgForDeduction.remaining_sessions : pkgForDeduction.remaining_sessions - 1,
              ]
            );
            await client.query('RELEASE SAVEPOINT sp_package_usage_log');
          } catch (error: any) {
            await client.query('ROLLBACK TO SAVEPOINT sp_package_usage_log').catch(() => {});
            console.warn('[BOOKING] package_usage_log table not found or insert failed, skipping usage log:', error.message);
          }
        }

        return insertedBooking;
      });

      const booking = result;

      // Log audit entry
      await logAuditEntry({
        entityType: 'booking',
        entityId: booking.id,
        action: 'create',
        newValues: {
          status: booking.status,
          customerId,
          vendorId,
          serviceId,
          bookingDate,
          bookingTime,
        },
        actorId: customerId,
        actorType: 'customer',
        requestId,
      });

      // Log initial status
      await logBookingStatusChange(
        booking.id,
        null,
        'pending',
        customerId,
        'customer',
        'Booking created'
      );

      // Publish event
      try {
        const { publishBookingCreated } = await import('../../../utils/sns-client');
        await publishBookingCreated({
          bookingId: booking.id,
          customerId: booking.customer_id,
          vendorId: booking.vendor_id,
          serviceType: booking.service_type,
          status: booking.status,
          bookingDate: booking.booking_date,
          bookingTime: booking.booking_time,
          ...generateEventMetadata(requestId),
        });
      } catch (error) {
        console.error('Failed to publish booking created event:', error);
      }

      // Rule 4: Notify vendor with in-app notification (large on-screen alert on vendor side)
      try {
        const customers = await select('customers', { id: booking.customer_id });
        const customerName = (customers[0] as any)?.name || (customers[0] as any)?.full_name || 'Customer';
        const serviceName = service?.service_name || service?.name || 'Service';
        const serviceTypeLabel = booking.service_type === 'at_home' ? 'Home visit' : booking.service_type === 'tele' ? 'Tele consultation' : 'At center';
        // ✅ FIX: Use notification_type instead of type (schema column name)
        await insert('notifications', {
          recipient_id: booking.vendor_id,
          recipient_type: 'vendor',
          notification_type: 'new_booking', // ✅ FIX: Changed from 'type' to 'notification_type'
          title: 'New appointment',
          message: `${customerName} booked ${serviceName} • ${serviceTypeLabel} • ${booking.booking_date} ${booking.booking_time}`,
          channels: { email: false, sms: false, inApp: true, push: false }, // ✅ FIX: Added required channels field
          data: JSON.stringify({
            bookingId: booking.id,
            customerId: booking.customer_id,
            customerName,
            serviceName,
            serviceType: booking.service_type,
            bookingDate: booking.booking_date,
            bookingTime: booking.booking_time,
            address: booking.address,
          }),
          is_read: false,
          created_at: new Date(),
        });
      } catch (notifErr) {
        console.warn('Failed to create vendor notification for new booking:', notifErr);
      }

      // ✅ FIX: Auto-generate OTP for confirmed bookings (package bookings, etc.) that don't require payment
      // OTP is needed for at_home and at_vendor/at_center services, NOT for tele
      let otpCode: string | null = null;
      const bookingServiceType = booking.service_type || 'at_vendor';
      const isTeleService = bookingServiceType === 'tele' || 
                           bookingServiceType === 'online' || 
                           bookingServiceType === 'video_consultation' ||
                           bookingServiceType === 'tele_consultation';
      
      // Only generate OTP if booking is confirmed/paid and not a tele service
      if ((booking.status === 'confirmed' || booking.payment_status === 'paid' || booking.payment_status === 'completed') && !isTeleService) {
        try {
          // Check if OTP already exists
          if (!booking.otp_code) {
            const otp = generateBookingOTP();
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            
            await query(
              `UPDATE bookings 
               SET otp_code = $1, 
                   otp_expires_at = $2, 
                   updated_at = NOW() 
               WHERE id = $3`,
              [otp, expiresAt.toISOString(), booking.id]
            );
            
            otpCode = otp;
            console.log(`✅ [BOOKING-CREATE] Auto-generated OTP ${otp} for confirmed booking ${booking.id}`);
            
            // Send OTP via SMS (async)
            if (booking.customer_phone || booking.customer_id) {
              try {
                const { sendSMS } = await import('../../../utils/sms-service');
                const customers = booking.customer_id ? await select('customers', { id: booking.customer_id }) : [];
                const customerPhone = booking.customer_phone || (customers[0] as any)?.phone;
                
                if (customerPhone) {
                  sendSMS({
                    to: customerPhone,
                    message: `Your Warmpawz service verification OTP is ${otp}. Share this with your service provider to start the service. Valid for 24 hours.`,
                    type: 'otp',
                  }).catch((err: any) => console.error('SMS send failed:', err));
                }
              } catch (e) {
                console.log('SMS service not available');
              }
            }
          } else {
            otpCode = booking.otp_code;
            console.log(`✅ [BOOKING-CREATE] Using existing OTP for booking ${booking.id}`);
          }
        } catch (otpError) {
          console.warn(`⚠️ [BOOKING-CREATE] Failed to auto-generate OTP for booking ${booking.id}:`, otpError);
          // Don't fail booking creation if OTP generation fails
        }
      }

      const response = {
        bookingId: booking.id,
        status: booking.status,
        message: 'Booking created successfully',
        isNew: true,
        ...(otpCode && { otp: otpCode }), // Include OTP in response if generated
      };

      // Store idempotency key
      if (idempotencyKey) {
        await storeIdempotencyKey(idempotencyKey, 'booking', booking.id, JSON.stringify(response), 200);
      }

      return this.success(response, requestId);

    } catch (error: unknown) {
      const err = error as any;
      const errorMessage = err?.message || 'Unknown error';
      
      // Slot conflict
      if (errorMessage === 'SLOT_CONFLICT' || err?.code === '55P03') {
        // ✅ FIX: Check if this is a duplicate booking attempt (same customer/vendor/date/time)
        // If so, return a more helpful error message
        try {
          const duplicateCheck = await query(
            `SELECT id, status, created_at FROM bookings 
             WHERE customer_id = $1 
             AND vendor_id = $2 
             AND booking_date = $3 
             AND booking_time = $4
             AND created_at > NOW() - INTERVAL '5 minutes'
             AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
             LIMIT 1`,
            [customerId, vendorId, bookingDate, bookingTime]
          );
          
          if (duplicateCheck.rows.length > 0) {
            // This is a duplicate booking attempt - return the existing booking
            const existingBooking = duplicateCheck.rows[0];
            console.log(`[BOOKING] Duplicate booking detected in error handler: ${existingBooking.id}`);
            const existingBookingFull = await select('bookings', { id: existingBooking.id });
            if (existingBookingFull.length > 0) {
              const booking = existingBookingFull[0];
              return this.success({
                bookingId: booking.id,
                status: booking.status,
                message: 'Booking already exists (duplicate request detected)',
                isNew: false,
                duplicate: true,
              }, requestId);
            }
          }
        } catch (dupErr) {
          console.warn('[BOOKING] Error checking for duplicate booking:', dupErr);
        }
        
        // Actual slot conflict - another customer has booked this slot
        return this.error(
          'This time slot is already booked. Please select a different time.',
          409,
          'SLOT_CONFLICT',
          undefined,
          requestId
        );
      }
      
      // Service not found / invalid
      if (errorMessage.includes('Service') || errorMessage.includes('service')) {
        return this.error(errorMessage, 404, 'SERVICE_NOT_FOUND', undefined, requestId);
      }
      
      // Foreign key constraint violation (missing required data)
      if (err?.code === '23503' || errorMessage.includes('foreign key') || errorMessage.includes('constraint')) {
        console.error('[BOOKING] Foreign key constraint error:', errorMessage);
        return this.error(
          'Required data missing. Please ensure customer, vendor, and service exist.',
          400,
          'VALIDATION_ERROR',
          { originalError: errorMessage },
          requestId
        );
      }
      
      // Table doesn't exist
      if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        console.error('[BOOKING] Table missing:', errorMessage);
        return this.error(
          'System configuration error. Please contact support.',
          500,
          'SYSTEM_ERROR',
          undefined,
          requestId
        );
      }
      
      // Database connection error
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
        console.error('[BOOKING] Database connection error:', errorMessage);
        return this.error(
          'Unable to connect to database. Please try again later.',
          503,
          'DATABASE_ERROR',
          undefined,
          requestId
        );
      }
      
      // Generic error - log and return structured error
      console.error('[BOOKING] Unexpected error during booking creation:', error);
      return this.error(
        'Failed to create booking. Please try again.',
        500,
        'INTERNAL_ERROR',
        { details: errorMessage },
        requestId
      );
    }
  }
}

class GetBookingHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // ✅ SECURITY FIX: Get enriched booking data with service, vendor, customer, and pet info
    const bookingResult = await query(
      `SELECT b.*,
              COALESCE(s.name, sc.service_name) as service_name,
              COALESCE(s.category, sc.category_id::text) as service_category,
              COALESCE(s.description, sc.description) as service_description,
              COALESCE(s.duration_minutes, sc.duration_minutes) as service_duration,
              sc.specialization_ids as service_specialization_ids,
              v.business_name as vendor_name,
              v.owner_name as vendor_owner_name,
              v.phone as vendor_phone,
              v.email as vendor_email,
              v.address as vendor_address,
              v.city as vendor_city,
              v.state as vendor_state,
              v.pincode as vendor_pincode,
              v.latitude as vendor_latitude,
              v.longitude as vendor_longitude,
              c.full_name as customer_name,
              c.phone as customer_phone,
              c.email as customer_email,
              c.address as customer_address,
              p.id as pet_id_from_table,
              p.name as pet_name_from_table,
              p.species as pet_species_from_table,
              p.breed as pet_breed_from_table,
              p.age_years as pet_age_from_table,
              p.weight_kg as pet_weight_from_table,
              p.profile_photo_url as pet_photo_from_table
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN service_catalog sc ON b.service_id = sc.id
       LEFT JOIN vendors v ON b.vendor_id = v.id
       LEFT JOIN customers c ON b.customer_id = c.id
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
    
    if (bookingResult.rows.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }

    const booking = bookingResult.rows[0];

    // ✅ SECURITY FIX: Verify authorization - only customer or vendor who owns the booking can access it
    const authenticatedUserId = context.userId;
    const authenticatedUserRole = context.userRole;
    const queryParams = context.event.queryStringParameters || {};
    const body = this.parseBody(context.event);
    
    // Get customerId/vendorId from various sources (query params, body, or authenticated user)
    let requestCustomerId = queryParams.customerId || body.customerId || 
                           (authenticatedUserRole === 'customer' ? authenticatedUserId : null);
    const requestVendorId = queryParams.vendorId || body.vendorId || 
                           (authenticatedUserRole === 'vendor' ? authenticatedUserId : null);
    
    // ✅ Support phone-based access: resolve phone to customerId if phone is provided
    if (!requestCustomerId && (queryParams.phone || body.phone)) {
      try {
        const phone = (queryParams.phone || body.phone) as string;
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        if (cleanPhone && cleanPhone.length >= 10) {
          const customers = await select('customers', { phone: cleanPhone });
          if (customers.length > 0) {
            requestCustomerId = customers[0].id;
          }
        }
      } catch (error) {
        console.warn('[GetBooking] Error resolving customer from phone:', error);
      }
    }
    
    // Check if requester is authorized (must be either the customer or vendor who owns the booking)
    const isAuthorized = 
      (requestCustomerId && booking.customer_id === requestCustomerId) ||
      (requestVendorId && booking.vendor_id === requestVendorId) ||
      (authenticatedUserId && authenticatedUserId === booking.customer_id) ||
      (authenticatedUserId && authenticatedUserId === booking.vendor_id);
    
    if (!isAuthorized) {
      // Return 404 instead of 403 to avoid information leakage about booking existence
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }
    
    // ✅ FIX: Extract pet_id from multiple sources (column, notes, special_instructions)
    let petIdToUse = booking.pet_id || booking.pet_id_from_table;
    
    // Try to extract from notes if not in column
    if (!petIdToUse && booking.notes) {
      const petIdMatch = booking.notes.match(/Pet ID:\s*([a-f0-9-]{36})/i);
      if (petIdMatch) {
        petIdToUse = petIdMatch[1];
        console.log(`[GetBooking] Extracted pet_id from notes: ${petIdToUse}`);
      }
    }
    
    // Try to extract from special_instructions if still not found
    if (!petIdToUse && booking.special_instructions) {
      const petIdMatch = booking.special_instructions.match(/Pet ID:\s*([a-f0-9-]{36})/i);
      if (petIdMatch) {
        petIdToUse = petIdMatch[1];
        console.log(`[GetBooking] Extracted pet_id from special_instructions: ${petIdToUse}`);
      }
    }
    
    // Build pet info from JOIN result or fetch separately
    let petInfo = null;
    if (petIdToUse) {
      // Use data from JOIN if available
      if (booking.pet_id_from_table || booking.pet_name_from_table) {
        petInfo = {
          id: booking.pet_id_from_table || petIdToUse,
          name: booking.pet_name_from_table,
          species: booking.pet_species_from_table,
          breed: booking.pet_breed_from_table,
          age: booking.pet_age_from_table,
          weight: booking.pet_weight_from_table,
          photo_url: booking.pet_photo_from_table,
        };
      } else {
        // Fallback: fetch separately if JOIN didn't return data
        const petResult = await query(
          `SELECT id, name, species, breed, age_years as age, weight_kg as weight, profile_photo_url as photo_url FROM pets WHERE id = $1`,
          [petIdToUse]
        ).catch(() => ({ rows: [] }));
        if (petResult.rows.length > 0) {
          petInfo = petResult.rows[0];
        }
      }
    }

    // Build enriched response
    const enrichedBooking = {
      ...booking,
      // ✅ FIX: Ensure all IDs are always at top level for easy access
      vendorId: booking.vendor_id,
      vendor_id: booking.vendor_id,
      staffId: booking.staff_id,
      staff_id: booking.staff_id,
      petId: petIdToUse || null,
      pet_id: petIdToUse || null,
      customerId: booking.customer_id,
      customer_id: booking.customer_id,
      serviceId: booking.service_id,
      service_id: booking.service_id,
      // ✅ FIX: Schedule information - ensure booking_date and booking_time are properly formatted
      bookingDate: booking.booking_date,
      booking_date: booking.booking_date,
      bookingTime: booking.booking_time,
      booking_time: booking.booking_time,
      scheduledDate: booking.booking_date, // Alias for frontend compatibility
      scheduledTime: booking.booking_time, // Alias for frontend compatibility
      schedule: booking.booking_time, // Alias for frontend compatibility
      startDate: booking.booking_date, // Alias for frontend compatibility
      // Service info (specialization from catalog when available)
      service: booking.service_name ? {
        id: booking.service_id,
        name: booking.service_name,
        category: booking.service_category,
        description: booking.service_description,
        duration: booking.service_duration || booking.duration_minutes,
        specializationIds: Array.isArray(booking.service_specialization_ids) ? booking.service_specialization_ids : (booking.service_specialization_ids ? [].concat(booking.service_specialization_ids) : []),
        specialization_ids: Array.isArray(booking.service_specialization_ids) ? booking.service_specialization_ids : (booking.service_specialization_ids ? [].concat(booking.service_specialization_ids) : []),
      } : null,
      // Vendor info
      vendor: booking.vendor_name ? {
        id: booking.vendor_id,
        businessName: booking.vendor_name,
        ownerName: booking.vendor_owner_name,
        phone: booking.vendor_phone,
        email: booking.vendor_email,
        address: booking.vendor_address,
        city: booking.vendor_city,
        state: booking.vendor_state,
        pincode: booking.vendor_pincode,
        latitude: booking.vendor_latitude,
        longitude: booking.vendor_longitude,
      } : null,
      // Customer info
      customer: booking.customer_name ? {
        id: booking.customer_id,
        name: booking.customer_name,
        phone: booking.customer_phone,
        email: booking.customer_email,
        address: booking.customer_address,
      } : null,
      // Pet info - full object
      pet: petInfo ? {
        id: petInfo.id || petIdToUse,
        name: petInfo.name,
        species: petInfo.species,
        breed: petInfo.breed,
        age: petInfo.age,
        weight: petInfo.weight,
        photo_url: petInfo.photo_url,
      } : null,
      // Computed fields for convenience
      serviceName: booking.service_name,
      vendorName: booking.vendor_name,
      customerName: booking.customer_name,
      petName: petInfo?.name || null,
      petBreed: petInfo?.breed || null,
      petType: petInfo?.species || null,
      petAge: petInfo?.age || null,
      petPhoto: petInfo?.photo_url || null,
      amount: parseFloat(booking.total_amount || '0'),
      price: parseFloat(booking.total_amount || '0'),
      totalAmount: parseFloat(booking.total_amount || '0'),
      // Multi-service: expose selectedServices and totalDurationMinutes
      selectedServices: parseSelectedServices(booking.selected_services),
      totalDurationMinutes:
        booking.total_duration_minutes != null
          ? Number(booking.total_duration_minutes)
          : null,
    };

    return this.success({ booking: enrichedBooking }, requestId);
  }
}

class GetBookingHistoryHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const bookings = await select('bookings', { id: bookingId });
    if (bookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }

    const booking = bookings[0];
    const petId = booking.pet_id;

    // ✅ SECURITY FIX: Verify vendor ownership if request is from a vendor
    // Check multiple sources: X-Vendor-Id header, context.userId/userRole, JWT token
    let authenticatedVendorId: string | null = null;
    
    // 1. Check X-Vendor-Id header (highest priority)
    const headerVendorId = context.event.headers?.['X-Vendor-Id'] || context.event.headers?.['x-vendor-id'];
    if (headerVendorId) {
      const vendors = await select('vendors', { id: headerVendorId });
      if (vendors.length > 0) {
        authenticatedVendorId = headerVendorId;
        console.log(`[Booking History] Vendor ID from header: ${authenticatedVendorId}`);
      }
    }
    
    // 2. Check context.userId/userRole (if not already set from header)
    if (!authenticatedVendorId && context.userId && context.userRole === 'vendor') {
      try {
        const { resolveVendorId } = await import('../../../utils/vendor-resolve');
        const resolvedId = await resolveVendorId(context.userId);
        const vendors = await select('vendors', { id: resolvedId });
        if (vendors.length > 0) {
          authenticatedVendorId = resolvedId;
          console.log(`[Booking History] Vendor ID from context (resolved): ${authenticatedVendorId}`);
        } else {
          const vendorsDirect = await select('vendors', { id: context.userId });
          if (vendorsDirect.length > 0) {
            authenticatedVendorId = context.userId;
          }
        }
      } catch (e) {
        console.warn('[Booking History] Error resolving vendor ID:', e);
      }
    }
    
    // 3. Try JWT token if still not set
    if (!authenticatedVendorId) {
      try {
        const authHeader = context.event.headers?.['Authorization'] || context.event.headers?.['authorization'];
        if (authHeader) {
          const token = authHeader.replace(/^Bearer\s+/i, '');
          if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
              const userId = payload.userId || payload.sub || payload.user_id;
              if (userId && !userId.startsWith('temp_') && !userId.startsWith('customer_')) {
                const vendors = await select('vendors', { id: userId });
                if (vendors.length > 0) {
                  authenticatedVendorId = userId;
                  console.log(`[Booking History] Vendor ID from JWT: ${authenticatedVendorId}`);
                }
              }
            }
          }
        }
      } catch (e) {
        // JWT decode failed, continue
      }
    }
    
    console.log(`[Booking History] Final authenticatedVendorId: ${authenticatedVendorId || 'null (customer access)'}`);

    if (authenticatedVendorId) {
      // If vendor is making request, verify they own this booking
      if (booking.vendor_id !== authenticatedVendorId) {
        console.warn(`[Booking History] Unauthorized: Booking ${bookingId} belongs to vendor ${booking.vendor_id}, but request is from vendor ${authenticatedVendorId}`);
        return this.error('Unauthorized: This booking belongs to another vendor', 403, 'UNAUTHORIZED', undefined, requestId);
      }
    }

    // Get status history (check if table exists)
    let history: Array<Record<string, unknown>> = [];
    try {
      const tableCheck = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'booking_status_history'
        )`
      );
      
      if (tableCheck.rows[0]?.exists) {
        const result = await query(
          `SELECT * FROM booking_status_history 
           WHERE booking_id = $1 
           ORDER BY created_at ASC`,
          [bookingId]
        );
        history = result.rows;
      } else {
        console.warn('[Booking History] booking_status_history table does not exist');
      }
    } catch (error: unknown) {
      const err = error as any;
      console.warn('[Booking History] Error querying status history:', err?.message || error);
      history = [];
    }

    // ✅ SECURITY FIX: Prescriptions - STRICT mode (only current booking)
    let prescriptions: Array<Record<string, unknown>> = [];
    try {
      const prescriptionsResult = await query(
        `SELECT 
          p.id,
          p.booking_id,
          p.medications,
          p.general_notes as instructions,
          p.diagnosis,
          p.created_at as prescription_date,
          p.next_follow_up_date as follow_up_date,
          p.created_at,
          p.created_by,
          p.created_by_role,
          v.business_name as vendor_name,
          s.name as staff_name
        FROM prescriptions p
        LEFT JOIN vendors v ON v.id = p.vendor_id
        LEFT JOIN staff s ON s.id = p.staff_id
        WHERE p.booking_id = $1
        ORDER BY p.created_at ASC`,
        [bookingId]
      );
      
      prescriptions = prescriptionsResult.rows.map((presc: any) => ({
        id: `prescription_${presc.id}`,
        type: 'prescription',
        booking_id: bookingId,
        description: `Prescription created${presc.diagnosis ? ` - Diagnosis: ${presc.diagnosis}` : ''}`,
        actor: presc.staff_name || presc.vendor_name || 'Vendor',
        actor_type: presc.created_by_role || 'vendor',
        timestamp: presc.created_at,
        created_at: presc.created_at,
        prescription_data: {
          id: presc.id,
          medications: presc.medications,
          instructions: presc.instructions,
          diagnosis: presc.diagnosis,
          prescription_date: presc.prescription_date,
          follow_up_date: presc.follow_up_date,
        },
      }));
    } catch (error: unknown) {
      const err = error as any;
      console.warn('[Booking History] Error querying prescriptions:', err?.message || error);
      prescriptions = [];
    }

    // Medical Records - Return records for this booking OR same pet (for history continuity)
    let medicalRecords: Array<Record<string, unknown>> = [];
    try {
      if (!petId) {
        // No pet_id: only get records for this booking
        const medicalRecordsResult = await query(
          `SELECT 
            mr.id,
            mr.booking_id,
            mr.pet_id,
            mr.customer_id,
            mr.record_type,
            mr.title,
            mr.description,
            mr.file_url,
            mr.record_date,
            mr.created_at,
            mr.vendor_id,
            v.business_name as vendor_name
          FROM medical_records mr
          LEFT JOIN vendors v ON v.id = mr.vendor_id
          WHERE mr.booking_id = $1::uuid
          ORDER BY mr.created_at ASC`,
          [bookingId]
        );
        medicalRecords = medicalRecordsResult.rows.map((record: any) => ({
          id: `medical_record_${record.id}`,
          type: 'medical_record',
          booking_id: record.booking_id || bookingId,
          description: record.title || `Document uploaded${record.description ? ` - ${record.description}` : ''}`,
          actor: record.vendor_name || (record.vendor_id ? 'Vendor' : 'Customer'),
          actor_type: record.vendor_id ? 'vendor' : 'customer',
          timestamp: record.created_at,
          created_at: record.created_at,
          medical_record_data: {
            id: record.id,
            booking_id: record.booking_id,
            record_type: record.record_type,
            title: record.title,
            description: record.description,
            file_url: record.file_url,
            record_date: record.record_date,
          },
        }));
      } else {
        // Return records for this booking OR same pet (for history continuity across vendors)
        const medicalRecordsResult = await query(
          `SELECT 
            mr.id,
            mr.booking_id,
            mr.pet_id,
            mr.customer_id,
            mr.record_type,
            mr.title,
            mr.description,
            mr.file_url,
            mr.record_date,
            mr.created_at,
            mr.vendor_id,
            v.business_name as vendor_name
          FROM medical_records mr
          LEFT JOIN vendors v ON v.id = mr.vendor_id
          WHERE (
            mr.booking_id = $1::uuid
            OR mr.pet_id = $2::uuid
          )
          ORDER BY mr.created_at ASC`,
          [bookingId, petId]
        );
        
        medicalRecords = medicalRecordsResult.rows.map((record: any) => ({
          id: `medical_record_${record.id}`,
          type: 'medical_record',
          booking_id: record.booking_id || bookingId,
          description: record.title || `Document uploaded${record.description ? ` - ${record.description}` : ''}`,
          actor: record.vendor_name || (record.vendor_id ? 'Vendor' : 'Customer'),
          actor_type: record.vendor_id ? 'vendor' : 'customer',
          timestamp: record.created_at,
          created_at: record.created_at,
          medical_record_data: {
            id: record.id,
            booking_id: record.booking_id,
            record_type: record.record_type,
            title: record.title,
            description: record.description,
            file_url: record.file_url,
            record_date: record.record_date,
          },
        }));
      }
    } catch (error: unknown) {
      const err = error as any;
      console.warn('[Booking History] Error querying medical records:', err?.message || error);
      medicalRecords = [];
    }

    // Combine all history, sort by timestamp
    const combinedHistory = [...history, ...prescriptions, ...medicalRecords].sort((a: any, b: any) => {
      const aTime = new Date(a.created_at || a.timestamp || 0).getTime();
      const bTime = new Date(b.created_at || b.timestamp || 0).getTime();
      return aTime - bTime;
    });

    return this.success({
      booking: bookings[0],
      history: combinedHistory,
      prescriptions: prescriptions,
      medicalRecords: medicalRecords,
    }, requestId);
  }
}

class UpdateBookingStatusHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Validate request with Zod schema
    const validationResult = UpdateBookingStatusRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    const { status, reason } = validationResult.data;
    const actorId = context.userId || body.actorId;
    const actorType = context.userRole || body.actorType || 'system';

    // Get current booking
    const existingBookings = await select('bookings', { id: bookingId });
    if (existingBookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }

    const currentBooking = existingBookings[0];
    const oldStatus = currentBooking.status;

    // Prevent duplicate status update
    if (oldStatus === status) {
      return this.success({
        bookingId,
        oldStatus,
        newStatus: status,
        message: 'Status unchanged',
        isNew: false,
      }, requestId);
    }

    // Validate state transitions
    const invalidTransitions: Record<string, string[]> = {
      'completed': ['pending', 'confirmed', 'in_progress'],
      'cancelled': ['pending', 'confirmed', 'in_progress', 'completed'],
      'no_show': ['pending', 'confirmed', 'in_progress', 'completed'],
    };

    if (invalidTransitions[oldStatus]?.includes(status)) {
      return this.error(
        `Invalid status transition: Cannot change from '${oldStatus}' to '${status}'`,
        400,
        'VALIDATION_ERROR',
        undefined,
        requestId
      );
    }

    // Update booking
    await withTransaction(async (client) => {
      const updateData: Record<string, any> = { 
        status, 
        updated_at: new Date() 
      };

      if (status === 'completed') {
        updateData.completed_at = new Date();
      } else if (status === 'cancelled') {
        updateData.cancelled_at = new Date();
        if (reason) {
          updateData.cancellation_reason = reason;
        }
      }

      const setClauses = Object.keys(updateData).map((key, i) => `${key} = $${i + 1}`);
      const values = [...Object.values(updateData), bookingId];

      await client.query(
        `UPDATE bookings SET ${setClauses.join(', ')} WHERE id = $${values.length}`,
        values
      );
    });

    // ✅ AUTO-INITIATE GPS TRACKING for at_home services when status changes to "in_progress"
    if (status === 'in_progress' && (currentBooking.service_style === 'at_home' || currentBooking.service_type === 'at_home')) {
      try {
        console.log(`🚀 [GPS-AUTO-INIT] Auto-initiating GPS tracking for booking ${bookingId}`);
        
        // Check if tracking session already exists (any status)
        const existingSessions = await select('gps_tracking_sessions', {
          booking_id: bookingId,
        });

        if (existingSessions.length === 0) {
          // Get destination coordinates from booking
          let destinationLat: number | null = null;
          let destinationLng: number | null = null;
          
          // Priority 1: Use booking.latitude/longitude
          if (currentBooking.latitude != null && currentBooking.longitude != null) {
            destinationLat = parseFloat(String(currentBooking.latitude));
            destinationLng = parseFloat(String(currentBooking.longitude));
          } 
          // Priority 2: Use booking.delivery_latitude/longitude
          else if (currentBooking.delivery_latitude != null && currentBooking.delivery_longitude != null) {
            destinationLat = parseFloat(String(currentBooking.delivery_latitude));
            destinationLng = parseFloat(String(currentBooking.delivery_longitude));
          }
          // Priority 3: Get from address_id if booking doesn't have coordinates
          else if (currentBooking.address_id) {
            try {
              const addresses = await select('customer_addresses', { id: currentBooking.address_id });
              if (addresses.length > 0) {
                const addr = addresses[0] as any;
                
                // Extract coordinates from address
                if (addr.coordinates) {
                  try {
                    const coords = typeof addr.coordinates === 'string' ? JSON.parse(addr.coordinates) : addr.coordinates;
                    destinationLat = coords?.lat ?? coords?.latitude ?? null;
                    destinationLng = coords?.lng ?? coords?.longitude ?? null;
                  } catch {
                    // Ignore parse errors
                  }
                }
                
                // Also check if address has separate latitude/longitude columns
                if (!destinationLat && addr.latitude) {
                  destinationLat = parseFloat(String(addr.latitude));
                }
                if (!destinationLng && addr.longitude) {
                  destinationLng = parseFloat(String(addr.longitude));
                }
                
                if (destinationLat && destinationLng) {
                  console.log(`[GPS-AUTO-INIT] Extracted coordinates from address_id ${currentBooking.address_id}: ${destinationLat}, ${destinationLng}`);
                }
              }
            } catch (addrErr) {
              console.warn('[GPS-AUTO-INIT] Could not fetch address by address_id:', addrErr);
            }
          }
          
          // Only create session if we have destination coordinates
          if (destinationLat != null && destinationLng != null) {
            // Create tracking session with proper status and columns
            const newSessions = await insert('gps_tracking_sessions', {
              booking_id: bookingId,
              vendor_id: currentBooking.vendor_id,
              customer_id: currentBooking.customer_id,
              status: 'in_transit', // Use 'in_transit' not 'active'
              destination_latitude: destinationLat,
              destination_longitude: destinationLng,
              is_active: true,
              started_at: new Date(),
              last_update_at: new Date(), // Use 'last_update_at' not 'last_update'
              created_at: new Date(),
            });

            console.log(`✅ [GPS-AUTO-INIT] GPS tracking session created: ${newSessions[0].id}`);

            // Send notification to customer
            try {
              const { publishNotification } = await import('../../../utils/sns-client');
              await publishNotification({
                userId: currentBooking.customer_id,
                userType: 'customer',
                type: 'booking_tracking_started',
                title: 'Service Provider is on the way!',
                message: `Your ${currentBooking.service_name || 'service'} provider has started and GPS tracking is now active.`,
                data: {
                  bookingId,
                  trackingSessionId: newSessions[0].id,
                },
              });
            } catch (notifError) {
              console.error('Failed to send tracking notification:', notifError);
              // Non-critical, continue
            }
          } else {
            console.warn(`⚠️ [GPS-AUTO-INIT] Cannot create tracking session: booking ${bookingId} has no destination coordinates`);
          }
        } else {
          console.log(`ℹ️  [GPS-AUTO-INIT] Tracking session already exists for booking ${bookingId}`);
        }
      } catch (gpsError) {
        console.error('❌ [GPS-AUTO-INIT] Failed to auto-initiate GPS tracking:', gpsError);
        // Non-critical error, don't fail the status update
      }
    }

    // Log status change
    await logBookingStatusChange(
      bookingId,
      oldStatus,
      status,
      actorId,
      actorType,
      reason
    );

    // Log audit entry
    await logAuditEntry({
      entityType: 'booking',
      entityId: bookingId,
      action: 'status_change',
      oldValues: { status: oldStatus, reason },
      newValues: { status },
      changedFields: ['status'],
      actorId,
      actorType,
      requestId,
    });

    // Publish event
    try {
      const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
      await publishBookingStatusUpdated({
        bookingId,
        customerId: currentBooking.customer_id,
        vendorId: currentBooking.vendor_id,
        oldStatus,
        newStatus: status,
        reason,
        ...generateEventMetadata(requestId),
      });
    } catch (error) {
      console.error('Failed to publish booking status updated event:', error);
    }

    return this.success({ 
      bookingId,
      oldStatus,
      newStatus: status,
      message: 'Booking status updated successfully',
      isNew: true,
    }, requestId);
  }
}

class GetRefundPreviewHandler extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { bookingId } = body;
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('bookingId is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      // Get booking details
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const booking = bookings[0];
      const preview = await previewCustomerCancellationRefund({
        id: bookingId,
        vendor_id: booking.vendor_id,
        service_id: booking.service_id,
        service_type: booking.service_type,
        booking_datetime: booking.booking_datetime || null,
        scheduled_at: booking.scheduled_at || null,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
        total_amount: booking.total_amount,
      });

      return this.success({
        refund: {
          eligible: preview.refundPercentage > 0 || preview.refundAmount > 0,
          refundAmount: Math.round(preview.refundAmount * 100) / 100,
          refundPercentage: Math.round(preview.refundPercentage),
          cancellationFee: Math.round(preview.cancellationFee * 100) / 100,
          source: preview.source,
          policyApplied: preview.policyApplied,
          message: preview.refundAmount > 0
            ? `₹${Math.round(preview.refundAmount * 100) / 100} will be refunded to your original payment method`
            : 'No refund available for this booking',
        },
      }, requestId);
    } catch (error: unknown) {
      const err = error as any;
      console.error('Error calculating refund preview:', error);
      return this.error(
        err?.message || 'Failed to calculate refund preview',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

class CancelBookingHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const reason = body.reason || body.cancellationReason || 'Customer cancellation';
    const actorId = context.userId || body.customerId || body.actorId;
    const actorType = context.userRole || body.actorType || 'customer';
    const refundMethod = body.refundMethod || 'wallet'; // 'wallet' or 'original'

    // Get current booking
    const existingBookings = await select('bookings', { id: bookingId });
    if (existingBookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }

    const currentBooking = existingBookings[0];
    const oldStatus = currentBooking.status;

    // Validate that booking can be cancelled
    const cancellableStatuses = ['pending', 'confirmed'];
    if (!cancellableStatuses.includes(oldStatus)) {
      return this.error(
        `Booking cannot be cancelled. Current status: ${oldStatus}`,
        400,
        'VALIDATION_ERROR',
        { currentStatus: oldStatus, allowedStatuses: cancellableStatuses },
        requestId
      );
    }

    // Check if booking is in the past
    const bookingDateTime = new Date(`${currentBooking.booking_date}T${currentBooking.booking_time}`);
    const now = new Date();
    if (bookingDateTime < now) {
      return this.error(
        'Cannot cancel past bookings',
        400,
        'VALIDATION_ERROR',
        undefined,
        requestId
      );
    }

    try {
      // Update booking status to cancelled
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE bookings 
           SET status = 'cancelled', 
               cancelled_at = NOW(), 
               cancellation_reason = $1,
               updated_at = NOW() 
           WHERE id = $2`,
          [reason, bookingId]
        );
      });

      // Log status change
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        'cancelled',
        actorId,
        actorType,
        reason
      );

      // Log audit entry
      await logAuditEntry({
        entityType: 'booking',
        entityId: bookingId,
        action: 'cancel',
        oldValues: { status: oldStatus },
        newValues: { status: 'cancelled', reason },
        changedFields: ['status', 'cancelled_at', 'cancellation_reason'],
        actorId,
        actorType,
        requestId,
      });

      // Process refund if payment was made — use unified preview helper (same logic as preview endpoint)
      let refundInfo = null;
      if (currentBooking.payment_status === 'paid' && currentBooking.total_amount > 0) {
        try {
          const totalAmount = parseFloat(String(currentBooking.total_amount || 0));
          const preview = await previewCustomerCancellationRefund({
            id: bookingId,
            vendor_id: currentBooking.vendor_id,
            service_id: currentBooking.service_id,
            service_type: currentBooking.service_type,
            booking_datetime: currentBooking.booking_datetime || null,
            scheduled_at: currentBooking.scheduled_at || null,
            booking_date: currentBooking.booking_date,
            booking_time: currentBooking.booking_time,
            total_amount: totalAmount,
          });
          const refundAmount = preview.refundAmount;
          const refundPercentage = preview.refundPercentage;
          
          if (refundAmount > 0) {
            // Get payment for refund
            const payments = await query(
              `SELECT id FROM payments WHERE booking_id = $1 AND payment_status = 'completed' LIMIT 1`,
              [bookingId]
            );

            if (payments.rows.length > 0) {
              const paymentId = payments.rows[0].id;
              
              if (refundMethod === 'wallet') {
                // Credit to wallet
                try {
                  await query(
                    `INSERT INTO wallet_transactions (
                      customer_id, 
                      type, 
                      amount, 
                      description, 
                      reference_type,
                      reference_id,
                      status
                    ) VALUES ($1, 'credit', $2, $3, 'booking_refund', $4, 'completed')`,
                    [
                      currentBooking.customer_id,
                      refundAmount,
                      `Refund for cancelled booking (${refundPercentage}%)`,
                      bookingId
                    ]
                  ).catch(() => null);
                  
                  // Update wallet balance
                  await query(
                    `UPDATE customers SET wallet_balance = COALESCE(wallet_balance, 0) + $1 WHERE id = $2`,
                    [refundAmount, currentBooking.customer_id]
                  ).catch(() => null);
                  
                  refundInfo = {
                    amount: refundAmount,
                    percentage: refundPercentage,
                    method: 'wallet',
                    status: 'completed',
                    message: `₹${refundAmount.toFixed(2)} credited to your wallet`
                  };
                } catch (walletError) {
                  console.error('Error crediting wallet:', walletError);
                }
              } else {
                // Create refund request for original payment method
                const refundRequests = await query(
                  `INSERT INTO refunds (
                    payment_id,
                    booking_id, 
                    customer_id, 
                    vendor_id,
                    refund_amount,
                    refund_reason, 
                    refund_status,
                    refund_method,
                    requested_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'original', NOW()) 
                  RETURNING *`,
                  [
                    paymentId,
                    bookingId,
                    currentBooking.customer_id,
                    currentBooking.vendor_id || null,
                    refundAmount,
                    `Booking cancellation: ${reason} (${refundPercentage}% refund)`
                  ]
                ).catch(() => ({ rows: [] }));
                
                refundInfo = {
                  refundId: refundRequests.rows[0]?.id,
                  amount: refundAmount,
                  percentage: refundPercentage,
                  method: 'original',
                  status: 'pending',
                  message: `Refund of ₹${refundAmount.toFixed(2)} will be processed to original payment method in 3-7 business days`
                };
              }
            }
          } else {
            refundInfo = {
              amount: 0,
              percentage: 0,
              method: null,
              status: 'not_eligible',
              message: 'Cancellation is too close to booking time. No refund applicable as per policy.'
            };
          }
        } catch (error) {
          console.error('Error creating refund request:', error);
          // Don't fail cancellation if refund processing fails
        }
      }

      // Publish event
      try {
        const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: currentBooking.customer_id,
          vendorId: currentBooking.vendor_id,
          oldStatus,
          newStatus: 'cancelled',
          reason,
          ...generateEventMetadata(requestId),
        });
      } catch (error) {
        console.error('Failed to publish booking cancelled event:', error);
      }

      // ✅ Send in-app notification to vendor about cancellation
      if (currentBooking.vendor_id) {
        try {
          // Resolve customer name for the notification
          let customerName = 'Customer';
          if (currentBooking.customer_id) {
            const customers = await select('customers', { id: currentBooking.customer_id });
            if (customers.length > 0) {
              customerName = customers[0].name || customers[0].full_name || customers[0].fullName || 'Customer';
            }
          }

          const bookingDateDisplay = currentBooking.booking_date
            ? new Date(currentBooking.booking_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '';
          const bookingTimeDisplay = currentBooking.booking_time || '';
          const serviceTypeLabel = currentBooking.service_type === 'at_home' ? 'Home visit'
            : currentBooking.service_type === 'tele' ? 'Tele consultation'
            : currentBooking.service_type === 'at_center' ? 'At center'
            : 'Appointment';

          await insert('notifications', {
            recipient_id: currentBooking.vendor_id,
            recipient_type: 'vendor',
            notification_type: 'booking_cancelled',
            title: 'Booking Cancelled',
            message: `${customerName} cancelled their ${serviceTypeLabel} booking${bookingDateDisplay ? ` on ${bookingDateDisplay}` : ''}${bookingTimeDisplay ? ` at ${bookingTimeDisplay}` : ''}. Reason: ${reason}`,
            data: JSON.stringify({
              bookingId,
              customerId: currentBooking.customer_id,
              customerName,
              serviceType: currentBooking.service_type,
              bookingDate: currentBooking.booking_date,
              bookingTime: currentBooking.booking_time,
              cancellationReason: reason,
              refundInfo,
            }),
            channels: { email: false, sms: false, inApp: true, push: true },
            is_read: false,
            created_at: new Date(),
          });
          console.log(`[CANCEL] ✅ Vendor notification sent for booking ${bookingId} to vendor ${currentBooking.vendor_id}`);
        } catch (notifErr) {
          console.warn('[CANCEL] Failed to send vendor cancellation notification:', notifErr);
          // Non-critical — don't fail the cancellation
        }
      }

      return this.success({
        bookingId,
        message: 'Booking cancelled successfully',
        refund: refundInfo,
      }, requestId);
    } catch (error: unknown) {
      const err = error as any;
      console.error('Error cancelling booking:', error);
      return this.error(
        err?.message || 'Failed to cancel booking',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

class RescheduleBookingHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const newDate = body.newDate || body.bookingDate;
    const newTime = body.newTime || body.newTimeSlot || body.bookingTime;
    const reason = body.reason || body.rescheduleReason || 'Customer reschedule request';
    const actorId = context.userId || body.customerId || body.actorId;
    const actorType = context.userRole || body.actorType || 'customer';

    if (!newDate || !newTime) {
      return this.error(
        'newDate and newTime are required',
        400,
        'VALIDATION_ERROR',
        undefined,
        requestId
      );
    }

    // Validate new booking date/time (rule engine: booking_min_notice_hours)
    const rescheduleRules = await getDiscoveryRules('all', 'booking');
    const rescheduleMinNotice = rescheduleRules.booking_min_notice_hours ?? 1;
    const dateValidation = validateBookingDate(newDate, newTime, rescheduleMinNotice);
    if (!dateValidation.valid) {
      return this.error(dateValidation.error!, 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Get current booking
    const existingBookings = await select('bookings', { id: bookingId });
    if (existingBookings.length === 0) {
      return this.error('Booking not found', 404, 'NOT_FOUND', undefined, requestId);
    }

    const currentBooking = existingBookings[0];
    const oldStatus = currentBooking.status;
    
    // Store old slot information for release tracking
    const oldDate = currentBooking.booking_date;
    const oldTime = currentBooking.booking_time;

    // Validate that booking can be rescheduled
    const reschedulableStatuses = ['pending', 'confirmed'];
    if (!reschedulableStatuses.includes(oldStatus)) {
      return this.error(
        `Booking cannot be rescheduled. Current status: ${oldStatus}`,
        400,
        'VALIDATION_ERROR',
        { currentStatus: oldStatus, allowedStatuses: reschedulableStatuses },
        requestId
      );
    }

    // Prevent rescheduling to the same slot
    if (oldDate === newDate && oldTime === newTime) {
      return this.error(
        'Booking is already scheduled for this date and time. Please select a different slot.',
        400,
        'VALIDATION_ERROR',
        { currentDate: oldDate, currentTime: oldTime },
        requestId
      );
    }

    try {
      // Check if new slot is available (excludes current booking, so old slot is automatically released)
      const conflictCheck = await query(
        `SELECT id FROM bookings 
         WHERE vendor_id = $1 
           AND booking_date = $2 
           AND booking_time = $3 
           AND id != $4
           AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
         LIMIT 1`,
        [currentBooking.vendor_id, newDate, newTime, bookingId]
      );

      if (conflictCheck.rows.length > 0) {
        return this.error(
          'This time slot is already booked. Please select a different time.',
          409,
          'SLOT_CONFLICT',
          undefined,
          requestId
        );
      }

      // Verify old slot will be released (check if any other booking exists at old slot)
      // This ensures the old slot is truly available after reschedule
      const oldSlotOccupied = await query(
        `SELECT id FROM bookings 
         WHERE vendor_id = $1 
           AND booking_date = $2 
           AND booking_time = $3 
           AND id != $4
           AND status NOT IN ('cancelled', 'no_show', 'rescheduled')
         LIMIT 1`,
        [currentBooking.vendor_id, oldDate, oldTime, bookingId]
      );

      const oldSlotWillBeAvailable = oldSlotOccupied.rows.length === 0;

      // Update booking with new date/time
      // NOTE: This automatically releases the old slot because:
      // 1. The booking is moved from (oldDate, oldTime) to (newDate, newTime)
      // 2. Future slot availability checks will not find this booking at the old slot
      // 3. The old slot becomes available for other bookings
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE bookings 
           SET booking_date = $1,
               booking_time = $2,
               rescheduled_at = NOW(),
               notes = CASE 
                 WHEN notes IS NULL THEN $3
                 ELSE notes || ' | ' || $3
               END,
               updated_at = NOW() 
           WHERE id = $4`,
          [newDate, newTime, `Rescheduled: ${reason}`, bookingId]
        );
      });

      // Log slot release for tracking
      console.log(`[RESCHEDULE] Booking ${bookingId}: Released slot ${oldDate} ${oldTime}, moved to ${newDate} ${newTime}`);
      if (!oldSlotWillBeAvailable) {
        console.warn(`[RESCHEDULE] Warning: Old slot ${oldDate} ${oldTime} has another booking, but current booking slot is still released`);
      }

      // Get updated booking
      const updatedBookings = await select('bookings', { id: bookingId });

      // Log status change (reschedule is a status update to track history)
      await logBookingStatusChange(
        bookingId,
        oldStatus,
        oldStatus, // Status remains the same, just time changes
        actorId,
        actorType,
        `Rescheduled from ${oldDate} ${oldTime} to ${newDate} ${newTime}: ${reason}`
      );

      // Log audit entry
      await logAuditEntry({
        entityType: 'booking',
        entityId: bookingId,
        action: 'reschedule',
        oldValues: {
          booking_date: oldDate,
          booking_time: oldTime,
        },
        newValues: {
          booking_date: newDate,
          booking_time: newTime,
          reason,
        },
        changedFields: ['booking_date', 'booking_time'],
        actorId,
        actorType,
        requestId,
      });

      // Publish event
      try {
        const { publishBookingStatusUpdated } = await import('../../../utils/sns-client');
        await publishBookingStatusUpdated({
          bookingId,
          customerId: currentBooking.customer_id,
          vendorId: currentBooking.vendor_id,
          oldStatus,
          newStatus: oldStatus, // Status unchanged
          reason: `Rescheduled from ${oldDate} ${oldTime} to ${newDate} ${newTime}: ${reason}`,
          ...generateEventMetadata(requestId),
        });
      } catch (error) {
        console.error('Failed to publish booking rescheduled event:', error);
      }

      // Send notification to vendor about reschedule
      try {
        // Format dates for display (e.g., "15 Jan 2024")
        const formatDate = (dateStr: string) => {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        };

        // Send notification to vendor
        await sendEventNotification({
          eventType: 'booking_rescheduled',
          recipientId: currentBooking.vendor_id,
          recipientType: 'vendor',
          relatedId: bookingId,
          data: {
            oldDate: formatDate(oldDate),
            oldTime: oldTime,
            newDate: formatDate(newDate),
            newTime: newTime,
            reason: reason || 'Customer reschedule request',
            bookingId,
            customerId: currentBooking.customer_id,
          },
        });

        console.log(`[RESCHEDULE] Notification sent to vendor ${currentBooking.vendor_id} about booking reschedule`);
      } catch (error) {
        // Don't fail the reschedule if notification fails
        console.error('Failed to send reschedule notification to vendor:', error);
      }

      return this.success({
        bookingId,
        booking: updatedBookings[0],
        message: 'Booking rescheduled successfully',
        oldDate,
        oldTime,
        newDate,
        newTime,
        // Slot release information
        oldSlotReleased: true,
        oldSlotAvailable: oldSlotWillBeAvailable,
      }, requestId);
    } catch (error: unknown) {
      const err = error as any;
      if (err?.message === 'SLOT_CONFLICT' || err?.code === '55P03') {
        return this.error(
          'This time slot is already booked. Please select a different time.',
          409,
          'SLOT_CONFLICT',
          undefined,
          requestId
        );
      }
      console.error('Error rescheduling booking:', error);
      return this.error(
        err?.message || 'Failed to reschedule booking',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerBookingEndpointsEnhanced(app: Hono) {
  const createHandler = new CreateBookingHandlerEnhanced();
  const getHandler = new GetBookingHandlerEnhanced();
  const updateHandler = new UpdateBookingStatusHandlerEnhanced();
  const historyHandler = new GetBookingHistoryHandlerEnhanced();
  const cancelHandler = new CancelBookingHandlerEnhanced();
  const rescheduleHandler = new RescheduleBookingHandlerEnhanced();
  const refundPreviewHandler = new GetRefundPreviewHandler();

  app.post('/bookings/create', async (c) => {
    try {
      // Use pre-parsed body from handler context (c.env) instead of global state
      // This avoids the body consumption issue with Hono Request
      const contextData = c.env as { parsedBody?: Record<string, unknown>; event?: unknown } | undefined;
      let body: Record<string, unknown> = contextData?.parsedBody as Record<string, unknown> || {};
      
      // Fallback: try to parse from request if context not available
      if (!body || Object.keys(body).length === 0) {
        try {
          body = await c.req.json() as Record<string, unknown>;
        } catch (e) {
          body = {};
        }
      }
      
      // Create API Gateway event with validated body
      const event: {
        httpMethod: string;
        path: string;
        headers: Record<string, string>;
        body: string;
        pathParameters: Record<string, string>;
        queryStringParameters: Record<string, string>;
        requestContext: {
          requestId: string;
          http?: { method: string; path: string };
        };
        rawPath?: string;
        rawQueryString?: string;
        isBase64Encoded: boolean;
      } = {
        httpMethod: 'POST',
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers),
        body: JSON.stringify(body),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
        requestContext: {
          requestId: randomUUID(),
          http: {
            method: c.req.method || 'POST',
            path: c.req.path,
          },
        },
        rawPath: c.req.path,
        rawQueryString: new URL(c.req.url, 'http://localhost').search.substring(1),
        isBase64Encoded: false,
      };
      
      const context = createLambdaContext();
      const result: any = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: unknown) {
      const err = error as any;
      console.error('Error in bookings/create:', error);
      return c.json({ error: err?.message || 'Internal server error' }, 500);
    }
  });

  // Compatibility endpoint for frontend
  app.post('/booking/create', async (c) => {
    try {
      // Use pre-parsed body from handler context (c.env) instead of global state
      const contextData = c.env as { parsedBody?: Record<string, unknown>; event?: unknown } | undefined;
      let body: Record<string, unknown> = contextData?.parsedBody as Record<string, unknown> || {};
      
      // Fallback: try to parse from request if context not available
      if (!body || Object.keys(body).length === 0) {
        try {
          body = await c.req.json() as Record<string, unknown>;
        } catch (e) {
          body = {};
        }
      }
      
      const event: ApiGatewayEventLike = {
        httpMethod: 'POST',
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers),
        body: JSON.stringify(body),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
        requestContext: {
          http: {
            method: c.req.method || 'POST',
            path: c.req.path,
          },
          requestId: randomUUID(),
        },
        rawPath: c.req.path,
        rawQueryString: new URL(c.req.url, 'http://localhost').search.substring(1),
        isBase64Encoded: false,
      };
      const context = createLambdaContext();
      const result = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: unknown) {
      const err = error as any;
      console.error('Error in booking/create:', error);
      return c.json({ error: err?.message || 'Internal server error' }, 500);
    }
  });
  
  // Customer-facing alias for booking creation
  app.post('/customer/booking/create', async (c) => {
    try {
      // Use pre-parsed body from handler context (c.env) instead of global state
      const contextData = c.env as { parsedBody?: Record<string, unknown>; event?: unknown } | undefined;
      let body: Record<string, unknown> = contextData?.parsedBody as Record<string, unknown> || {};
      
      if (!body || Object.keys(body).length === 0) {
        try {
          body = await c.req.json() as Record<string, unknown>;
        } catch (e) {
          body = {};
        }
      }
      
      const event: ApiGatewayEventLike = {
        httpMethod: 'POST',
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers),
        body: JSON.stringify(body),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
        requestContext: {
          http: {
            method: c.req.method || 'POST',
            path: c.req.path,
          },
          requestId: randomUUID(),
        },
        rawPath: c.req.path,
        rawQueryString: new URL(c.req.url, 'http://localhost').search.substring(1),
        isBase64Encoded: false,
      };
      const context = createLambdaContext();
      const result = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: unknown) {
      const err = error as any;
      console.error('Error in customer/booking/create:', error);
      return c.json({ error: err?.message || 'Internal server error' }, 500);
    }
  });

  // ✅ FIX: Add plural route for frontend compatibility
  // Frontend tries multiple endpoints: /bookings/create, /booking/create, /customer/booking/create, /customer/bookings/create
  app.post('/customer/bookings/create', async (c) => {
    try {
      // Use pre-parsed body from handler context (c.env) instead of global state
      const contextData = c.env as { parsedBody?: Record<string, unknown>; event?: unknown } | undefined;
      let body: Record<string, unknown> = contextData?.parsedBody as Record<string, unknown> || {};
      
      if (!body || Object.keys(body).length === 0) {
        try {
          body = await c.req.json() as Record<string, unknown>;
        } catch (e) {
          body = {};
        }
      }
      
      const event: ApiGatewayEventLike = {
        httpMethod: 'POST',
        path: c.req.path,
        headers: Object.fromEntries(c.req.raw.headers),
        body: JSON.stringify(body),
        pathParameters: {},
        queryStringParameters: Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams),
        requestContext: {
          http: {
            method: c.req.method || 'POST',
            path: c.req.path,
          },
          requestId: randomUUID(),
        },
        rawPath: c.req.path,
        rawQueryString: new URL(c.req.url, 'http://localhost').search.substring(1),
        isBase64Encoded: false,
      };
      const context = createLambdaContext();
      const result = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: unknown) {
      const err = error as any;
      console.error('Error in customer/bookings/create:', error);
      return c.json({ error: err?.message || 'Internal server error' }, 500);
    }
  });

  app.get('/bookings/:bookingId', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await getHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // ✅ FIX: Add customer-prefixed route for frontend compatibility
  app.get('/customer/bookings/:bookingId', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await getHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.get('/bookings/:bookingId/history', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await historyHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.put('/bookings/:bookingId/status', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await updateHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/customer/bookings/refund-preview', async (c) => {
    const event = await createApiGatewayEvent(c);
    const context = createLambdaContext();
    const result: any = await refundPreviewHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  /**
   * POST /bookings/:bookingId/calculate-refund
   * ✅ FIX GAP-12.3: Calculate refund amount for booking cancellation
   * Returns refund preview without actually cancelling
   */
  app.post('/bookings/:bookingId/calculate-refund', async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const body = await c.req.json().catch(() => ({}));
      const cancellationReason = body.cancellationReason || 'customer_request';

      // Get booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Check if booking can be cancelled
      if (booking.status === 'cancelled' || booking.status === 'completed') {
        return c.json({ 
          error: `Booking is already ${booking.status}`,
          refundAmount: 0,
          refundPercentage: 0,
        }, 400);
      }

      // Get cancellation policy
      let policy = null;
      try {
        const policyQuery = `
          SELECT * FROM booking_policies
          WHERE vendor_id = $1
            AND service_type = $2
            AND policy_type = 'cancellation'
            AND is_active = true
          ORDER BY created_at DESC
          LIMIT 1
        `;
        const policyResult = await query(policyQuery, [booking.vendor_id, booking.service_type || 'general']);
        policy = (policyResult as any).rows[0];
      } catch (error: any) {
        // ✅ FIX: booking_policies table may not exist - gracefully skip
        console.warn('[BOOKING] booking_policies table not found or query failed, using default refund policy:', error.message);
      }

      // Calculate time until booking
      const bookingDate = new Date(booking.booking_date || booking.scheduled_at || booking.created_at);
      const now = new Date();
      const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Determine refund percentage based on policy
      let refundPercentage = 100; // Default: full refund
      let cancellationFee = 0;

      if (policy) {
        const policyRules = typeof policy.rules === 'string' 
          ? JSON.parse(policy.rules) 
          : policy.rules || {};

        // Check time-based refund rules
        if (policyRules.timeBased) {
          for (const rule of policyRules.timeBased) {
            const hoursThreshold = parseFloat(rule.hoursBefore || '0');
            if (hoursUntilBooking >= hoursThreshold) {
              refundPercentage = parseFloat(rule.refundPercentage || '100');
              cancellationFee = parseFloat(rule.cancellationFee || '0');
              break;
            }
          }
        }

        // Check reason-based rules
        if (policyRules.reasonBased && policyRules.reasonBased[cancellationReason]) {
          const reasonRule = policyRules.reasonBased[cancellationReason];
          refundPercentage = parseFloat(reasonRule.refundPercentage || refundPercentage.toString());
          cancellationFee = parseFloat(reasonRule.cancellationFee || cancellationFee.toString());
        }
      } else {
        // Default policy: 100% refund if > 24h, 50% if < 24h
        if (hoursUntilBooking < 24) {
          refundPercentage = 50;
        }
      }

      // Calculate refund amount
      const totalAmount = parseFloat(booking.total_amount || booking.amount || '0');
      const refundAmount = Math.max(0, (totalAmount * refundPercentage) / 100 - cancellationFee);
      const platformFeeRefund = booking.platform_fee ? parseFloat(booking.platform_fee) * (refundPercentage / 100) : 0;
      const convenienceFeeRefund = booking.convenience_fee ? parseFloat(booking.convenience_fee) * (refundPercentage / 100) : 0;

      return c.json({
        success: true,
        refund: {
          refundAmount: Math.round(refundAmount * 100) / 100,
          refundPercentage,
          cancellationFee,
          platformFeeRefund: Math.round(platformFeeRefund * 100) / 100,
          convenienceFeeRefund: Math.round(convenienceFeeRefund * 100) / 100,
          totalRefund: Math.round((refundAmount + platformFeeRefund + convenienceFeeRefund) * 100) / 100,
          hoursUntilBooking: Math.round(hoursUntilBooking * 100) / 100,
          policyApplied: !!policy,
        },
        booking: {
          id: booking.id,
          status: booking.status,
          totalAmount,
          bookingDate: booking.booking_date || booking.scheduled_at,
        },
      });
    } catch (error: any) {
      console.error('Error calculating refund:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/bookings/:bookingId/cancel', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await cancelHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/bookings/:bookingId/reschedule', async (c) => {
    const event = await createApiGatewayEvent(c);
    event.pathParameters = { bookingId: c.req.param('bookingId') };
    const context = createLambdaContext();
    const result: any = await rescheduleHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });
}

// Create API Gateway event with pre-parsed body from global
async function createApiGatewayEventWithBody(c: any): Promise<any> {
  // Get headers
  const headers: Record<string, string> = {};
  try {
    if (c.req.raw && c.req.raw.headers) {
      const rawHeaders = c.req.raw.headers;
      for (const key in rawHeaders) {
        const value = rawHeaders[key];
        if (value) {
          headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
        }
      }
    } else {
      const contentType = c.req.header('content-type');
      const authorization = c.req.header('authorization');
      if (contentType) headers['content-type'] = contentType;
      if (authorization) headers['authorization'] = authorization;
    }
  } catch (e) {
    console.warn('[BOOKINGS] Error processing headers:', e);
  }

  // Use pre-parsed body from handler context (c.env) instead of global state
  const contextData = c.env as { parsedBody?: Record<string, unknown>; event?: unknown } | undefined;
  let body: Record<string, unknown> = contextData?.parsedBody as Record<string, unknown> || {};
  
  // Fallback: try to parse from request if context not available
  if (!body || Object.keys(body).length === 0) {
    try {
      body = await c.req.json() as Record<string, unknown>;
    } catch (e) {
      body = {};
    }
  }

  const url = new URL(c.req.url, 'http://localhost');
  return {
    rawPath: url.pathname,
    rawQueryString: url.search.substring(1),
    requestContext: {
      http: {
        method: c.req.method || 'POST',
        path: url.pathname,
      },
      requestId: randomUUID(),
    },
    headers: headers,
    body: JSON.stringify(body),
    isBase64Encoded: false,
  };
}

// Legacy function for endpoints that need body parsing
async function createApiGatewayEvent(c: any): Promise<any> {
  return createApiGatewayEventWithBody(c);
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'booking-handler',
    functionVersion: '$LATEST',
  };
}

// ============================================================================
// BOOKING OTP GENERATION
// ============================================================================

/**
 * Generate a 4-digit OTP for service verification
 */
function generateBookingOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * POST /bookings/generate-otp
 * Generate OTP for a booking (for home and center services)
 */
export function registerBookingOTPEndpoint(app: Hono) {
  app.post('/bookings/generate-otp', async (c) => {
    try {
      const body = await c.req.json();
      const { bookingId, serviceStyle, customerId } = body;

      if (!bookingId) {
        return c.json({ success: false, error: 'Booking ID is required' }, 400);
      }

      // Get the booking first to check its service_type
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ success: false, error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      
      // ✅ FIX: Check booking's service_type (not passed serviceStyle) to determine if OTP is needed
      // OTP is required for: at_home, at_vendor, at_center
      // OTP is NOT required for: tele, online
      const bookingServiceType = booking.service_type || booking.service_style || serviceStyle;
      const isTeleService = bookingServiceType === 'tele' || 
                            bookingServiceType === 'online' || 
                            bookingServiceType === 'video_consultation' ||
                            bookingServiceType === 'tele_consultation';
      
      if (isTeleService) {
        console.log(`[BOOKING-OTP] Skipping OTP generation for tele service: ${bookingServiceType}`);
        return c.json({ 
          success: true, 
          otp: null, 
          message: 'OTP not required for tele consultations',
          serviceType: bookingServiceType
        });
      }
      
      console.log(`[BOOKING-OTP] Generating OTP for booking ${bookingId}, service_type: ${bookingServiceType}`);

      // Check if OTP already exists
      if (booking.otp_code) {
        return c.json({ 
          success: true, 
          otp: booking.otp_code,
          message: 'Existing OTP retrieved',
          expiresAt: booking.otp_expires_at,
        });
      }

      // Generate new OTP
      const otp = generateBookingOTP();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // OTP valid for 24 hours

      // Update booking with OTP
      await query(
        `UPDATE bookings 
         SET otp_code = $1, 
             otp_expires_at = $2, 
             updated_at = NOW() 
         WHERE id = $3`,
        [otp, expiresAt.toISOString(), bookingId]
      );

      // Send OTP via SMS (async, don't wait)
      if (booking.customer_phone || booking.customer_id) {
        try {
          const { sendSMS } = await import('../../../utils/sms-service');
          const customerPhone = booking.customer_phone || (customerId ? (await select('customers', { id: customerId }))[0]?.phone : null);
          
          if (customerPhone) {
            sendSMS({
              to: customerPhone,
              message: `Your Warmpawz service verification OTP is ${otp}. Share this with your service provider to start the service. Valid for 24 hours.`,
              type: 'otp',
            }).catch((err: any) => console.error('SMS send failed:', err));
          }
        } catch (e) {
          console.log('SMS service not available');
        }
      }

      console.log(`✅ [BOOKING-OTP] Generated OTP ${otp} for booking ${bookingId}`);

      return c.json({
        success: true,
        otp,
        message: 'OTP generated successfully. Share this with your service provider.',
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error: unknown) {
      const err = error as any;
      console.error('Error generating booking OTP:', error);
      return c.json({ success: false, error: err?.message || 'Internal server error' }, 500);
    }
  });

  // Verify OTP endpoint (for vendor use)
  app.post('/bookings/verify-otp', async (c) => {
    try {
      const body = await c.req.json();
      const { bookingId, otp, vendorId } = body;

      if (!bookingId || !otp) {
        return c.json({ success: false, error: 'Booking ID and OTP are required' }, 400);
      }

      // Get the booking
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ success: false, error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // ✅ Block service start if booking is cancelled or completed
      const nonStartableStatuses = ['cancelled', 'completed', 'no_show', 'expired'];
      if (nonStartableStatuses.includes(booking.status)) {
        return c.json({
          success: false,
          error: `Cannot verify OTP — booking is ${booking.status}. Service cannot be started for a ${booking.status} booking.`,
        }, 400);
      }

      // Verify vendor ownership
      if (vendorId && booking.vendor_id !== vendorId) {
        return c.json({ success: false, error: 'Unauthorized' }, 403);
      }

      // Check OTP
      const expectedOTP = String(booking.otp_code || '').trim();
      const providedOTP = String(otp).trim();

      if (expectedOTP !== providedOTP) {
        return c.json({ success: false, error: 'Invalid OTP' }, 400);
      }

      // Check expiry
      if (booking.otp_expires_at && new Date(booking.otp_expires_at) < new Date()) {
        return c.json({ success: false, error: 'OTP has expired' }, 400);
      }

      // Mark OTP as verified
      await query(
        `UPDATE bookings 
         SET otp_verified = true, 
             otp_verified_at = NOW(),
             status = CASE WHEN status = 'confirmed' THEN 'in_progress' ELSE status END,
             updated_at = NOW() 
         WHERE id = $1`,
        [bookingId]
      );

      console.log(`✅ [BOOKING-OTP] OTP verified for booking ${bookingId}`);

      return c.json({
        success: true,
        verified: true,
        message: 'OTP verified successfully. Service can now begin.',
      });
    } catch (error: unknown) {
      const err = error as any;
      console.error('Error verifying booking OTP:', error);
      return c.json({ success: false, error: err?.message || 'Internal server error' }, 500);
    }
  });
}
