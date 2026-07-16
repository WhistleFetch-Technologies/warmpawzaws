import type { Context } from 'hono';
import * as customer_diagnosticpackages_getRepo from '../repos/customer_diagnosticpackages_get.repo';
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

export async function executecustomerDiagnosticpackagesGet(c: Context) {
    try {
      // Get popular diagnostic packages
      const { rows: packages } = await customer_diagnosticpackages_getRepo.dbCustomerDiagnosticpackagesGet0()

      // Format as health packages
      const formattedPackages = packages.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        tests: p.package_test_count ? [`Includes ${p.package_test_count} tests`] : [p.category || 'General'],
        price: p.package_price || p.price,
        originalPrice: p.price > (p.package_price || p.price) ? p.price : undefined,
        homeCollection: p.is_free_home_collection || p.home_collection_fee === 0,
        turnaroundHours: p.turnaround_time_hours || 24,
        vendorName: p.vendor_name,
        vendorId: p.vendor_id,
      }));

      return c.json({
        success: true,
        packages: formattedPackages,
      });
    } catch (error: any) {
      console.error('Error getting diagnostic packages:', error);
      return c.json(
        {
          success: false,
          error: error?.message || 'Failed to load diagnostic packages',
          packages: [],
        },
        500
      );
    }
}