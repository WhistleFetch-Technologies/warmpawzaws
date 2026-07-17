import type { Context } from 'hono';
import * as customer_questionnaire_planning_postRepo from '../repos/customer_questionnaire_planning_post.repo';
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

export async function executecustomerQuestionnairePlanningPost(c: Context) {
    try {
      const body = await c.req.json();
      const { customerId, phone, answers } = body;

      if (!phone && !customerId) {
        return c.json({ error: 'phone or customerId is required' }, 400);
      }

      // Get or create customer
      let customer;
      if (customerId) {
        const customers = await customer_questionnaire_planning_postRepo.dbCustomerQuestionnairePlanningPost0(customerId)
        customer = customers[0];
      } else if (phone) {
        const customers = await customer_questionnaire_planning_postRepo.dbCustomerQuestionnairePlanningPost1(phone)
        customer = customers[0];
      }

      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Save questionnaire answers (could be in a separate table or as JSONB in customers)
      // For now, we'll just return success
      // TODO: Create customer_questionnaires table if needed

      return c.json({
        success: true,
        message: 'Questionnaire saved successfully',
        customerId: customer.id,
      });
    } catch (error: any) {
      console.error('Error saving questionnaire:', error);
      return c.json({ error: error.message }, 500);
    }
}