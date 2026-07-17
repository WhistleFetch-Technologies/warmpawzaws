import type { Context } from 'hono';
import * as customer_phone_onboarding_complete_postRepo from '../repos/customer_phone_onboarding_complete_post.repo';
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

export async function executecustomerPhoneOnboardingCompletePost(c: Context) {
    try {
      const phone = c.req.param('phone');
      const body = await c.req.json();
      const { journeyType } = body;

      // Get customer by phone
      const customers = await customer_phone_onboarding_complete_postRepo.dbCustomerPhoneOnboardingCompletePost0(phone)
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Update customer onboarding status
      await customer_phone_onboarding_complete_postRepo.dbCustomerPhoneOnboardingCompletePost1(customer)

      // Update preferences with completion timestamp
      await customer_phone_onboarding_complete_postRepo.dbCustomerPhoneOnboardingCompletePost2(journeyType, customer).catch(() => undefined);

      return c.json({
        success: true,
        message: 'Onboarding completed successfully',
        customerId: customer.id,
      });
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      return c.json({ error: error.message }, 500);
    }
}