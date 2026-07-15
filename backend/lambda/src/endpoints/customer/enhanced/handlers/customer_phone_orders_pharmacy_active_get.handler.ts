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

export async function customerPhoneOrdersPharmacyActiveGetHandler(c: Context) {
    try {
      const phone = c.req.param('phone');
      const normalizedPhone = phone.replace(/\D/g, '');

      // Get customer by phone with error handling
      let customers: any[];
      try {
        customers = await select('customers', { phone: normalizedPhone });
      } catch (error: any) {
        console.error('Error fetching customer:', error);
        return c.json({ 
          success: true, 
          orders: [],
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }

      if (customers.length === 0) {
        return c.json({ success: true, orders: [] });
      }

      const customer = customers[0];

      // Get active pharmacy orders with error handling
      let ordersResult: any;
      try {
        ordersResult = await query(
          `SELECT 
            po.id,
            po.order_number,
            po.status,
            po.tracking_status,
            po.created_at,
            po.delivery_address,
            po.delivery_latitude,
            po.delivery_longitude,
            po.estimated_delivery_time,
            po.logistics_partner_id,
            v.business_name as pharmacy_name,
            v.profile_photo as pharmacy_photo
          FROM pharmacy_orders po
          LEFT JOIN vendors v ON po.pharmacy_id = v.id
          WHERE po.customer_id = $1
            AND po.status NOT IN ('delivered', 'cancelled', 'refunded')
            AND (po.tracking_status IS NOT NULL OR po.status IN ('preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'))
          ORDER BY po.created_at DESC
          LIMIT 10`,
          [customer.id]
        );
      } catch (error: any) {
        console.warn('Error fetching active pharmacy orders (returning empty):', error.message);
        // Return empty array if query fails (table might not exist or schema issue)
        return c.json({ success: true, orders: [] });
      }

      const orders = ((ordersResult as any)?.rows || []).map((order: any) => {
        let deliveryAddress = order.delivery_address;
        try {
          if (typeof order.delivery_address === 'string') {
            deliveryAddress = JSON.parse(order.delivery_address);
          }
        } catch (parseError) {
          // If parsing fails, use the string as-is
          deliveryAddress = order.delivery_address;
        }

        return {
          id: order.id,
          orderId: order.id,
          orderNumber: order.order_number,
          orderType: 'pharmacy',
          status: order.status,
          trackingStatus: order.tracking_status || order.status,
          pharmacyName: order.pharmacy_name,
          pharmacyPhoto: order.pharmacy_photo,
          deliveryAddress,
          estimatedDeliveryTime: order.estimated_delivery_time,
          createdAt: order.created_at,
        };
      });

      return c.json({
        success: true,
        orders,
      });
    } catch (error: any) {
      console.error('Error fetching active pharmacy orders:', error);
      // Return empty array instead of error to prevent frontend crashes
      return c.json({ 
        success: true, 
        orders: [],
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
}
