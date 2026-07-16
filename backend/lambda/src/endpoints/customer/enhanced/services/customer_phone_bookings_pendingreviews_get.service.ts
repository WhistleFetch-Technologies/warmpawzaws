import type { Context } from 'hono';
import * as customer_phone_bookings_pendingreviews_getRepo from '../repos/customer_phone_bookings_pendingreviews_get.repo';
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

export async function executecustomerPhoneBookingsPendingreviewsGet(c: Context) {
    try {
      const phone = c.req.param('phone');
      
      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ success: true, bookings: [] });
      }

      const rules = await getDiscoveryRules('all', 'reviews');
      const reviewEligibleDays = rules.review_eligible_days ?? 7;

      const bookingsResult = await customer_phone_bookings_pendingreviews_getRepo.dbCustomerPhoneBookingsPendingreviewsGet1(
        customer.id,
        reviewEligibleDays
      );

      const bookings = (bookingsResult as any).rows.map((b: any) => ({
        id: b.id,
        vendorName: b.vendor_name,
        vendorPhoto: b.vendor_photo,
        serviceName: b.service_name || 'Service',
        completedAt: b.completed_at,
        petName: b.pet_name,
      }));

      return c.json({
        success: true,
        bookings,
      });
    } catch (error: any) {
      console.error('Error fetching pending reviews:', error);
      return c.json({ error: error.message }, 500);
    }
}