import type { Context } from 'hono';
/**
 * ============================================================================
 * CUSTOMER ENDPOINTS - ENHANCED VERSION (PHASE 5)
 * ============================================================================
 * 
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 * 
 * Endpoints:
 * - GET /customer/:customerId - Get customer profile
 * - GET /customer/by-phone - Get customer by phone
 * - PUT /customer/:customerId - Update customer profile
 * - GET /customer/:customerId/pets - Get customer pets
 * - POST /customer/:customerId/pets - Add pet
 * 
 * Date: 2026-01-28
 * Phase: 5
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../../../handler/base-handler-enhanced';
import { query, select, insert, update } from '../../../../database/rds-connection';
import {
  UpdateCustomerProfileRequestSchema,
  AddPetRequestSchema,
} from '@warmpawz/api-contracts/customers';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../../utils/entity-extractor';
import { isValidUUID } from '../../../../types/entities';
import { presignS3GetUrlIfApplicable } from '../../../../utils/s3-media-presign';
import {
  extractHealthRecordsForClient,
  extractVaccinationsForClient,
} from '../../../../utils/pet-health-normalize';
import {
  normalizeBloodTypeForStorage,
  resolveBloodTypeFromPayload,
} from '../../../../lib/pet-blood-types';
import { findCustomerByPhone } from '../../../../utils/customer-phone-lookup';
import { getDiscoveryRules } from '../../../../lib/rule-engine';
import {
  resolveCustomerMealPlanOrderDisplayTotals,
} from '../../../../utils/meal-order-pricing';
import {
  resolveEffectiveMealDeliveryState,
  isTerminalMealDeliveryState,
  shouldShowMealRiderFooterBar,
  mealRiderDeliveryMessage,
} from '../../../../utils/meal-delivery-effective-state';
import { enrichSubscriptionRowsWithPresignedMealImages } from '../../../../services/meal-subscription/meal-subscription-operations-service';
import { expireMealPaymentHolds } from '../../../../utils/meal-payment-hold';
import { getMealRefundReviewCustomerMetadata } from '../../../../utils/meal-refund-cases';

export async function customerPhoneBookingsActivetrackingGetHandler(c: Context) {
    try {
      const phone = c.req.param('phone');

      // Get customer by phone
      const customers = await select('customers', { phone: phone.replace(/\D/g, '') });
      if (customers.length === 0) {
        return c.json({ success: true, bookings: [] });
      }

      const customer = customers[0];

      // Get bookings with active GPS tracking (status: confirmed, in_progress, on_the_way)
      const bookingsResult = await query(
        `SELECT b.id, b.booking_date, b.scheduled_at,
                b.status, b.service_style,
                COALESCE(v.business_name, s.name) as vendor_name,
                COALESCE(v.profile_photo, s.photo) as vendor_photo,
                sv.name as service_name,
                p.name as pet_name,
                gps.current_latitude, gps.current_longitude,
                gps.tracking_started_at
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         LEFT JOIN staff s ON b.staff_id = s.id
         LEFT JOIN services sv ON b.service_id = sv.id
         LEFT JOIN pets p ON b.pet_id = p.id
         LEFT JOIN gps_tracking gps ON b.id = gps.booking_id AND gps.is_active = true
         WHERE b.customer_id = $1
           AND b.status IN ('confirmed', 'in_progress', 'on_the_way')
           AND b.service_style = 'at_home'
           AND gps.is_active = true
         ORDER BY b.scheduled_at ASC
         LIMIT 10`,
        [customer.id]
      );

      const bookings = (bookingsResult as any).rows.map((b: any) => ({
        id: b.id,
        vendorName: b.vendor_name,
        vendorPhoto: b.vendor_photo,
        serviceName: b.service_name,
        petName: b.pet_name,
        status: b.status,
        currentLocation: b.current_latitude && b.current_longitude ? {
          lat: parseFloat(b.current_latitude),
          lng: parseFloat(b.current_longitude),
        } : null,
        trackingStartedAt: b.tracking_started_at,
      }));

      return c.json({
        success: true,
        bookings,
      });
    } catch (error: any) {
      console.error('Error fetching active tracking:', error);
      return c.json({ error: error.message }, 500);
    }
}
