import type { Context } from 'hono';
import * as customer_phone_bookings_activetracking_getRepo from '../repos/customer_phone_bookings_activetracking_get.repo';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../../../handler/base-handler-enhanced';
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

export async function executecustomerPhoneBookingsActivetrackingGet(c: Context) {
    try {
      const phone = c.req.param('phone');

      // Get customer by phone
      const customers = await customer_phone_bookings_activetracking_getRepo.dbCustomerPhoneBookingsActivetrackingGet0(phone)
      if (customers.length === 0) {
        return c.json({ success: true, bookings: [] });
      }

      const customer = customers[0];

      // Get bookings with active GPS tracking (status: confirmed, in_progress, on_the_way)
      const bookingsResult = await customer_phone_bookings_activetracking_getRepo.dbCustomerPhoneBookingsActivetrackingGet1(customer)

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