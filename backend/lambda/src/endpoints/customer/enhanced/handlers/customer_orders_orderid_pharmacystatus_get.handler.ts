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

export async function customerOrdersOrderidPharmacystatusGetHandler(c: Context) {
    try {
      const orderId = c.req.param('orderId');

      // Get pharmacy order details + delivery_tracking (OTP, partner) for tracking step
      const { rows: orders } = await query(`
        SELECT 
          po.*,
          v.business_name as pharmacy_name,
          v.phone as pharmacy_phone,
          v.address as pharmacy_address,
          dt.delivery_otp as dt_delivery_otp,
          dt.otp_verified as dt_otp_verified,
          dt.delivery_person_name as dt_partner_name,
          dt.delivery_person_phone as dt_partner_phone
        FROM pharmacy_orders po
        LEFT JOIN vendors v ON v.id = po.pharmacy_id
        LEFT JOIN delivery_tracking dt ON dt.pharmacy_order_id = po.id
        WHERE po.id = $1
      `, [orderId]);

      if (orders.length === 0) {
        // Try to find in regular orders table
        const { rows: regularOrders } = await query(
          `SELECT * FROM orders WHERE id = $1`,
          [orderId]
        );

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
