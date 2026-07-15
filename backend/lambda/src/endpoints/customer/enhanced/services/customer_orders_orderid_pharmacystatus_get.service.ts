import type { Context } from 'hono';
import * as customer_orders_orderid_pharmacystatus_getRepo from '../repos/customer_orders_orderid_pharmacystatus_get.repo';
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

export async function executecustomerOrdersOrderidPharmacystatusGet(c: Context) {
    try {
      const orderId = c.req.param('orderId');

      // Get pharmacy order details + delivery_tracking (OTP, partner) for tracking step
      const { rows: orders } = await customer_orders_orderid_pharmacystatus_getRepo.dbCustomerOrdersOrderidPharmacystatusGet0(v, dt, po)

      if (orders.length === 0) {
        // Try to find in regular orders table
        const { rows: regularOrders } = await customer_orders_orderid_pharmacystatus_getRepo.dbCustomerOrdersOrderidPharmacystatusGet1()

        if (regularOrders.length === 0) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }

        const order = regularOrders[0];
        return c.json({
          success: true,
          order: {
            id: order.id,
            status: order.status,
            medicines: JSON.parse(order.items || '[]'),
            totalAmount: order.total_amount,
          }
        });
      }

      const order = orders[0];

      const items = (() => {
        try {
          const arr = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
          return arr.map((item: any) => ({
            name: item.medicine_name || item.name,
            quantity: item.quantity,
            price: item.unit_price ?? item.price,
            available: item.available !== false,
          }));
        } catch { return []; }
      })();

      return c.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          pharmacyId: order.pharmacy_id,
          pharmacyName: order.pharmacy_name,
          pharmacyPhone: order.pharmacy_phone,
          pharmacyAddress: order.pharmacy_address,
          estimatedTime: order.estimated_delivery_minutes,
          broadcastTime: order.broadcast_started_at,
          acceptedTime: order.accepted_at,
          medicines: items,
          subtotal: order.subtotal,
          deliveryFee: order.delivery_fee,
          platformFee: order.platform_fee,
          convenienceFee: order.convenience_fee,
          totalAmount: order.total_amount,
          total_amount: order.total_amount,
          proformaInvoice: order.proforma_invoice_id ? {
            id: order.proforma_invoice_id,
            total: order.invoice_amount,
            items,
          } : undefined,
          deliveryOtp: order.dt_delivery_otp ?? order.delivery_otp,
          otpVerified: order.dt_otp_verified ?? order.otp_verified,
          deliveryPartnerName: order.dt_partner_name ?? order.partner_name,
          deliveryPartnerPhone: order.dt_partner_phone ?? order.partner_phone,
          deliveryAddress: (() => {
            try {
              return typeof order.delivery_address === 'string'
                ? JSON.parse(order.delivery_address)
                : order.delivery_address;
            } catch { return order.delivery_address; }
          })(),
          currentRadius: order.current_broadcast_radius || 5,
          maxRadius: order.max_broadcast_radius || 20,
          broadcastStartedAt: order.broadcast_started_at,
        }
      });
    } catch (error: any) {
      console.error('Error getting pharmacy order status:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
}