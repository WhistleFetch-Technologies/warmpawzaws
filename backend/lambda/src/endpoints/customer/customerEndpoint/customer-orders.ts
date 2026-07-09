/**
 * ============================================================================
 * CUSTOMER ORDERS ENDPOINTS
 * ============================================================================
 * 
 * Handles customer order management:
 * - List orders
 * - Get order details
 * - Get order invoice
 * 
 * Date: 2026-01-07
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, insert, update } from '../../../database/rds-connection';
import { buildStructuredTracking } from '../../../utils/logistics/shipment-tracking';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import {
  resolveEcommerceOrderLine,
  decrementSkuStock,
} from '../../../utils/product-sku-order';
import { assertProductDeliverableToCity } from '../../../utils/product-delivery-regions';
import { resolveReturnWindowDays } from '../../../utils/return-window';
import {
  assertReturnItemsAllowed,
  ReturnItemsNotAllowedError,
  buildReturnEligibilityFromJoinedRows,
} from '../../../utils/category-return-eligibility';
import { computeEcommerceDeliveryFee } from '../../../utils/ecommerce/delivery-fee';
import {
  buildShopOrderPaymentResumeContext,
  discardUnpaidShopOrder,
  expireShopPaymentHolds,
} from '../../../utils/shop-payment-hold';

/** Maps checkout address shapes to NOT NULL `orders.shipping_*`; full object also in `metadata.address_snapshot`. */
function shippingColumnsFromAddress(
  addr: Record<string, unknown> | null | undefined,
  fallbackPhone: string
): {
  shipping_address: string;
  shipping_city: string;
  shipping_state: string;
  shipping_pincode: string;
  shipping_phone: string;
  missing: string[];
} {
  const a = addr && typeof addr === 'object' ? addr : {};
  const line1 = String(
    a.addressLine1 ?? a.address_line1 ?? a.line1 ?? a.street ?? a.address ?? ''
  ).trim();
  const line2 = [a.addressLine2, a.address_line2, a.landmark].filter(Boolean).map(String).join(', ');
  const shipping_address = [line1, line2].filter(Boolean).join(', ') || line1;
  const city = String(a.city ?? '').trim();
  const state = String(a.state ?? '').trim();
  const pincode = String(a.pincode ?? a.postalCode ?? a.zip ?? '').trim();
  const phone = String(a.phone ?? a.mobile ?? a.phone_number ?? fallbackPhone ?? '').trim();
  const missing: string[] = [];
  if (!line1) missing.push('addressLine1');
  if (!city) missing.push('city');
  if (!state) missing.push('state');
  if (!pincode) missing.push('pincode');
  if (!phone) missing.push('phone');
  return {
    shipping_address: shipping_address || line1,
    shipping_city: city,
    shipping_state: state,
    shipping_pincode: pincode,
    shipping_phone: phone,
    missing,
  };
}

// ============================================================================
// POST /customer/orders - Create order for customer
// ============================================================================

class CreateCustomerOrderHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const body = this.parseBody(context.event);
      const customerId = context.event.pathParameters?.customerId || 
                        context.event.queryStringParameters?.customerId ||
                        context.userId;

      let customerPhone = body.customer_phone || body.customerPhone;
      
      if (!customerPhone && customerId) {
        try {
          const customers = await query(
            'SELECT phone FROM customers WHERE id = $1',
            [customerId]
          );
          if (customers.rows.length > 0) {
            customerPhone = customers.rows[0].phone;
          }
        } catch (e) {
          console.error('Error fetching customer phone:', e);
        }
      }

      if (!customerPhone) {
        return this.error('Customer phone is required', 400);
      }

      const items = body.items || [];
      if (items.length === 0) {
        return this.error('Items are required', 400);
      }

      const shippingAddress = body.shipping_address || body.shippingAddress || body.address || {};
      const paymentMethod = body.payment_method || body.paymentMethod || 'cod';
      const rawPaymentId = body.payment_id ?? body.paymentId;
      const paymentIdForRow =
        rawPaymentId != null &&
        String(rawPaymentId).length > 0 &&
        isValidUUID(String(rawPaymentId))
          ? String(rawPaymentId)
          : null;

      const bodyTax = Number(body.taxAmount);
      const bodySubtotal = Number(body.subtotal);
      const bodyTotal = Number(body.total);

      let actualCustomerId = customerId;
      if (!actualCustomerId) {
        try {
          const customers = await query(
            'SELECT id FROM customers WHERE phone = $1',
            [customerPhone]
          );
          if (customers.rows.length > 0) {
            actualCustomerId = customers.rows[0].id;
          } else {
            const newCustomerId = randomUUID();
            const addrName =
              shippingAddress && typeof shippingAddress === 'object'
                ? (shippingAddress as { name?: string }).name
                : undefined;
            const customerName = addrName || `Customer ${customerPhone.slice(-4)}`;
            await insert('customers', {
              id: newCustomerId,
              name: customerName,
              full_name: customerName,
              phone: customerPhone,
              is_active: true,
              status: 'new',
            });
            actualCustomerId = newCustomerId;
          }
        } catch (e: any) {
          console.error('Error finding/creating customer:', e);
          return this.error('Failed to find or create customer', 500);
        }
      }

      const ship = shippingColumnsFromAddress(
        shippingAddress as Record<string, unknown>,
        String(customerPhone)
      );
      if (ship.missing.length > 0) {
        return this.error(
          `Incomplete delivery address (missing: ${ship.missing.join(', ')})`,
          400
        );
      }

      const productIds = items.map(
        (it: { product_id?: string; productId?: string }) => it.product_id || it.productId
      );
      for (const pid of productIds) {
        if (!pid || !isValidUUID(String(pid))) {
          return this.error('Each item must include a valid product id (UUID)', 400);
        }
      }

      type LineRow = {
        product_id: string;
        product_sku_id: string | null;
        product_name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        db_unit_price: number;
        variant_info: Record<string, unknown> | null;
        skuRowIdForStock: string | null;
      };
      const orderItems: LineRow[] = [];
      let firstVendorId: string | null = null;

      const customerCity = String(
        (shippingAddress as { city?: string; City?: string })?.city ??
          (shippingAddress as { City?: string })?.City ??
          '',
      ).trim();

      for (const item of items) {
        try {
          const resolved = await resolveEcommerceOrderLine(item as Record<string, unknown>);
          if (!resolved) {
            return this.error('Each item must include a valid product id (UUID)', 400);
          }
          await assertProductDeliverableToCity(
            resolved.product_id,
            resolved.product_name,
            customerCity,
          );
          if (!firstVendorId && resolved.vendor_id) {
            firstVendorId = resolved.vendor_id;
          }
          orderItems.push({
            product_id: resolved.product_id,
            product_sku_id: resolved.product_sku_id,
            product_name: resolved.product_name,
            quantity: resolved.quantity,
            unit_price: resolved.unit_price,
            total_price: resolved.total,
            db_unit_price: resolved.unit_price,
            variant_info: resolved.variant_info,
            skuRowIdForStock: resolved.skuRowIdForStock,
          });
        } catch (lineErr: unknown) {
          const msg = lineErr instanceof Error ? lineErr.message : String(lineErr);
          return this.error(msg, 400);
        }
      }

      if (orderItems.length === 0) {
        return this.error('No valid products found for this order', 400);
      }

      const calculatedSubtotal = orderItems.reduce((s, l) => s + l.total_price, 0);
      const shippingAmount = computeEcommerceDeliveryFee(calculatedSubtotal);
      const calculatedTaxAmount =
        Number.isFinite(bodyTax) && bodyTax >= 0 ? bodyTax : calculatedSubtotal * 0.18;
      const recomputedTotal = calculatedSubtotal + shippingAmount + calculatedTaxAmount;
      const finalTotal =
        Number.isFinite(bodyTotal) && bodyTotal > 0 ? bodyTotal : recomputedTotal;

      const metadata: Record<string, unknown> = {
        source: 'POST /customer/orders',
        order_type_hint: 'ecommerce',
        address_snapshot: shippingAddress,
        client_totals: {
          subtotal: bodySubtotal,
          taxAmount: bodyTax,
          total: bodyTotal,
        },
        taxBreakdown: body.taxBreakdown ?? null,
        taxByType: body.taxByType ?? null,
        line_pricing: orderItems.map((l) => ({
          product_id: l.product_id,
          unit_price_charged: l.unit_price,
          db_list_price: l.db_unit_price,
        })),
        totals: {
          subtotal: calculatedSubtotal,
          shipping: shippingAmount,
          tax: calculatedTaxAmount,
          total_charged: finalTotal,
          recomputed_total: recomputedTotal,
        },
      };
      // Razorpay ids are not UUIDs; keep reconciliation data here instead of orders.payment_id.
      if (rawPaymentId != null && String(rawPaymentId) !== '' && !paymentIdForRow) {
        metadata.external_payment = {
          gateway: paymentMethod === 'razorpay' ? 'razorpay' : String(paymentMethod),
          payment_id: String(rawPaymentId),
        };
      }

      const orderId = randomUUID();
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const createdAt = new Date().toISOString();

      const orderRow: Record<string, unknown> = {
        id: orderId,
        order_number: orderNumber,
        customer_id: actualCustomerId,
        vendor_id: firstVendorId,
        order_status: 'pending',
        payment_status: paymentMethod === 'cod' ? 'pending' : 'paid',
        payment_method: paymentMethod,
        payment_id: paymentIdForRow,
        subtotal: calculatedSubtotal,
        shipping_amount: shippingAmount,
        tax_amount: calculatedTaxAmount,
        discount_amount: 0,
        total_amount: finalTotal,
        shipping_address: ship.shipping_address,
        shipping_city: ship.shipping_city,
        shipping_state: ship.shipping_state,
        shipping_pincode: ship.shipping_pincode,
        shipping_phone: ship.shipping_phone,
        metadata,
        created_at: createdAt,
        updated_at: createdAt,
      };

      try {
        await insert('orders', orderRow);

        for (const line of orderItems) {
          await insert('order_items', {
            order_id: orderId,
            product_id: line.product_id,
            product_sku_id: line.product_sku_id ?? null,
            name: line.product_name,
            quantity: line.quantity,
            unit_price: line.unit_price,
            total_price: line.total_price,
            variant_info: line.variant_info ?? null,
          });
          if (line.skuRowIdForStock) {
            await decrementSkuStock(line.skuRowIdForStock, line.quantity);
          }
        }
      } catch (e: any) {
        console.error('Error creating order:', e);
        return this.error(e.message || 'Failed to create order', 500);
      }

      const itemsForResponse = orderItems.map((l) => ({
        product_id: l.product_id,
        product_name: l.product_name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        total: l.total_price,
        total_price: l.total_price,
      }));

      return this.success({
        orderId: orderId,
        order_number: orderNumber,
        order: {
          id: orderId,
          order_number: orderNumber,
          status: 'pending',
          total: finalTotal,
          items: itemsForResponse,
          address: shippingAddress,
          payment_method: paymentMethod,
          created_at: createdAt,
        },
        message: 'Order placed successfully!',
      });
    } catch (error: any) {
      console.error('Error creating customer order:', error);
      return this.error(error.message || 'Failed to create order', 500);
    }
  }
}

// ============================================================================
// GET /customer/orders - List all orders for customer
// ============================================================================

/** Dev/prod products.images JSONB — image_url column does not exist on RDS. */
const SQL_PRODUCT_IMAGE_SELECT = `CASE
  WHEN p.images IS NOT NULL
   AND jsonb_typeof(p.images) = 'array'
   AND jsonb_array_length(p.images) > 0
  THEN p.images->>0
  ELSE NULL
END AS product_image`;

class GetCustomerOrdersHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const customerId = context.event.pathParameters?.customerId || 
                        context.event.queryStringParameters?.customerId ||
                        context.userId;
      
      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      await expireShopPaymentHolds({ limit: 30, requestId: randomUUID() }).catch((e) =>
        console.warn('[customer/orders] expireShopPaymentHolds failed:', e)
      );

      const status = context.event.queryStringParameters?.status;
      const limit = parseInt(context.event.queryStringParameters?.limit || '50', 10);
      const offset = parseInt(context.event.queryStringParameters?.offset || '0', 10);

      // Align with RDS `orders` schema: order_status, shipping_*, total_amount (not legacy status/final_amount/delivery_address).
      let ordersQuery = `
        SELECT 
          o.id,
          o.order_number,
          o.customer_id,
          o.vendor_id,
          o.subtotal,
          o.total_amount,
          o.discount_amount,
          o.shipping_amount,
          o.tax_amount,
          o.payment_method,
          o.delivered_at,
          o.total_amount AS final_amount,
          o.order_status AS status,
          o.payment_status,
          o.shipping_address AS delivery_address,
          o.shipping_phone,
          o.shipping_city,
          o.shipping_state,
          o.shipping_pincode,
          o.cancelled_at,
          o.cancellation_reason,
          o.payment_hold_expires_at,
          o.payment_checkout_started_at,
          o.tracking_number,
          o.delivery_partner,
          o.shipped_at,
          o.created_at,
          o.updated_at,
          s.awb_code AS shipment_awb,
          s.logistics_partner AS shipment_carrier_id,
          s.tracking_url AS shipment_tracking_url,
          s.courier_name AS shipment_courier_name,
          s.shipped_at AS shipment_shipped_at,
          s.estimated_delivery AS shipment_estimated_delivery,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.address as vendor_address,
          v.return_window_days as return_window_days
        FROM orders o
        LEFT JOIN LATERAL (
          SELECT awb_code, logistics_partner, tracking_url, courier_name, shipped_at, estimated_delivery
          FROM shipments
          WHERE order_id = o.id
          ORDER BY created_at DESC
          LIMIT 1
        ) s ON true
        LEFT JOIN vendors v ON o.vendor_id = v.id
        WHERE o.customer_id = $1
      `;

      const params: any[] = [customerId];
      let paramIndex = 2;

      if (status) {
        ordersQuery += ` AND o.order_status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      ordersQuery += ` ORDER BY CASE WHEN o.order_status = 'pending_payment' THEN 0 ELSE 1 END, o.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const orders = await query(ordersQuery, params);

      // Get order items for each order
      const orderIds = orders.rows.map((o: any) => o.id);
      let itemsQuery = `
        SELECT 
          oi.*,
          s.name as service_name,
          p.name as product_name,
          p.category_id,
          ec.name as category_name,
          ec.returns_enabled as category_returns_enabled,
          p.is_returnable as product_is_returnable,
          ${SQL_PRODUCT_IMAGE_SELECT}
        FROM order_items oi
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN ecommerce_categories ec ON ec.id = p.category_id
        WHERE oi.order_id = ANY($1)
      `;
      const items = orderIds.length > 0 ? await query(itemsQuery, [orderIds]) : { rows: [] };

      // Group items by order_id
      const itemsByOrder: Record<string, any[]> = {};
      items.rows.forEach((item: any) => {
        if (!itemsByOrder[item.order_id]) {
          itemsByOrder[item.order_id] = [];
        }
        itemsByOrder[item.order_id].push(item);
      });

      const vendorReturnWindowCache = new Map<string, number>();

      // Attach items and structured tracking to orders
      const ordersWithItems = await Promise.all(
        orders.rows.map(async (order: any) => {
        const shipment = order.shipment_awb || order.shipment_carrier_id
          ? {
              awb_code: order.shipment_awb,
              logistics_partner: order.shipment_carrier_id,
              tracking_url: order.shipment_tracking_url,
              courier_name: order.shipment_courier_name,
              shipped_at: order.shipment_shipped_at,
              estimated_delivery: order.shipment_estimated_delivery,
            }
          : null;

        const tracking = buildStructuredTracking(
          {
            order_status: order.status,
            tracking_number: order.tracking_number,
            delivery_partner: order.delivery_partner,
            shipped_at: order.shipped_at,
          },
          shipment
        );

        const {
          shipment_awb,
          shipment_carrier_id,
          shipment_tracking_url,
          shipment_courier_name,
          shipment_shipped_at,
          shipment_estimated_delivery,
          ...rest
        } = order;

        const vendorId = order.vendor_id != null ? String(order.vendor_id) : '';
        let returnWindowDays = vendorReturnWindowCache.get(vendorId);
        if (returnWindowDays == null) {
          returnWindowDays = await resolveReturnWindowDays(vendorId || null);
          if (vendorId) vendorReturnWindowCache.set(vendorId, returnWindowDays);
        }

        const rawItems = itemsByOrder[order.id] || [];
        const { items: enrichedItems, hasReturnableItems } = buildReturnEligibilityFromJoinedRows(
          order,
          rawItems,
          returnWindowDays
        );

        return {
          ...rest,
          paymentHoldExpiresAt: order.payment_hold_expires_at ?? null,
          paymentCheckoutStartedAt: order.payment_checkout_started_at ?? null,
          items: enrichedItems,
          has_returnable_items: hasReturnableItems,
          tracking,
          tracking_number: tracking?.trackingNumber || order.tracking_number || null,
          tracking_url: tracking?.trackingUrl || order.shipment_tracking_url || null,
        };
      })
      );

      // Get statistics
      const statsQuery = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE order_status = 'pending_payment') as pending_payment,
          COUNT(*) FILTER (WHERE order_status = 'pending') as pending,
          COUNT(*) FILTER (WHERE order_status = 'confirmed') as confirmed,
          COUNT(*) FILTER (WHERE order_status = 'processing') as processing,
          COUNT(*) FILTER (WHERE order_status = 'shipped') as shipped,
          COUNT(*) FILTER (WHERE order_status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE order_status = 'cancelled') as cancelled,
          SUM(total_amount) FILTER (WHERE order_status != 'cancelled') as total_spent
        FROM orders
        WHERE customer_id = $1
      `, [customerId]);

      return this.success({
        orders: ordersWithItems,
        stats: statsQuery.rows[0],
        pagination: {
          limit,
          offset,
          total: orders.rows.length
        }
      });
    } catch (error: any) {
      console.error('Error fetching customer orders:', error);
      return this.error(error.message || 'Failed to fetch orders', 500);
    }
  }
}

// ============================================================================
// GET /customer/orders/:id - Get order details
// ============================================================================

class GetOrderDetailsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const orderId = context.event.pathParameters?.id;
      const customerId = context.event.pathParameters?.customerId || 
                        context.event.queryStringParameters?.customerId ||
                        context.userId;

      if (!orderId) {
        return this.error('Order ID is required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      // Get order details
      const order = await query(`
        SELECT 
          o.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.email as vendor_email,
          v.address as vendor_address,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email
        FROM orders o
        LEFT JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = $1 AND o.customer_id = $2
      `, [orderId, customerId]);

      if (order.rows.length === 0) {
        return this.error('Order not found', 404);
      }

      // Get order items
      const items = await query(`
        SELECT 
          oi.*,
          s.name as service_name,
          s.description as service_description,
          p.name as product_name,
          p.description as product_description,
          ${SQL_PRODUCT_IMAGE_SELECT}
        FROM order_items oi
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
        ORDER BY oi.created_at ASC
      `, [orderId]);

      // Get order status history
      const history = await query(`
        SELECT * FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC
      `, [orderId]);

      const shipments = await query(`
        SELECT * FROM shipments
        WHERE order_id = $1
        ORDER BY created_at DESC
      `, [orderId]);

      const orderRow = order.rows[0];
      const latestShipment = shipments.rows[0] || null;
      const structuredTracking = buildStructuredTracking(
        {
          order_status: orderRow.order_status,
          tracking_number: orderRow.tracking_number,
          delivery_partner: orderRow.delivery_partner,
          shipped_at: orderRow.shipped_at,
        },
        latestShipment
      );

      return this.success({
        order: orderRow,
        items: items.rows,
        history: history.rows,
        shipments: shipments.rows,
        tracking: structuredTracking,
      });
    } catch (error: any) {
      console.error('Error fetching order details:', error);
      return this.error(error.message || 'Failed to fetch order details', 500);
    }
  }
}

// ============================================================================
// GET /customer/orders/:id/invoice - Get order invoice
// ============================================================================

class GetOrderInvoiceHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const orderId = context.event.pathParameters?.id;
      const customerId = context.event.pathParameters?.customerId || 
                        context.event.queryStringParameters?.customerId ||
                        context.userId;

      if (!orderId) {
        return this.error('Order ID is required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      // Get order with all details
      const order = await query(`
        SELECT 
          o.*,
          v.business_name as vendor_name,
          v.phone as vendor_phone,
          v.email as vendor_email,
          v.address as vendor_address,
          v.gst_number as vendor_gst,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          c.address as customer_address
        FROM orders o
        LEFT JOIN vendors v ON o.vendor_id = v.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = $1 AND o.customer_id = $2
      `, [orderId, customerId]);

      if (order.rows.length === 0) {
        return this.error('Order not found', 404);
      }

      // Get order items with HSN codes
      const items = await query(`
        SELECT 
          oi.*,
          s.name as service_name,
          s.hsn_code as service_hsn_code,
          p.name as product_name,
          p.hsn_code as product_hsn_code
        FROM order_items oi
        LEFT JOIN services s ON oi.service_id = s.id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
        ORDER BY oi.created_at ASC
      `, [orderId]);

      // Get tax breakdown from order or recalculate
      let taxBreakdown = null;
      let hsnSummary = [];
      
      if (order.rows[0].tax_breakdown) {
        try {
          taxBreakdown = typeof order.rows[0].tax_breakdown === 'string'
            ? JSON.parse(order.rows[0].tax_breakdown)
            : order.rows[0].tax_breakdown;
          hsnSummary = taxBreakdown?.hsnSummary || [];
        } catch (e) {
          console.error('Error parsing tax breakdown:', e);
        }
      }

      // If no tax breakdown, try to reconstruct from order data
      if (!taxBreakdown && items.rows.length > 0) {
        try {
          const { taxCalculationService } = await import('../lib/services/tax-calculation-service');
          
          // Get customer and vendor locations
          let customerLocation: { state: string; city?: string; pincode?: string } | undefined = undefined;
          let vendorLocation: { state: string; city?: string } | undefined = undefined;
          
          if (order.rows[0].customer_address) {
            const addr = typeof order.rows[0].customer_address === 'string'
              ? JSON.parse(order.rows[0].customer_address)
              : order.rows[0].customer_address;
            if (addr?.state) {
              customerLocation = {
                state: addr.state,
                city: addr.city,
                pincode: addr.pincode,
              };
            }
          }

          if (order.rows[0].vendor_address) {
            const addr = typeof order.rows[0].vendor_address === 'string'
              ? JSON.parse(order.rows[0].vendor_address)
              : order.rows[0].vendor_address;
            if (addr?.state) {
              vendorLocation = {
                state: addr.state,
                city: addr.city,
              };
            }
          }

          // Build tax calculation items
          const taxItems = items.rows.map((item: any) => ({
            id: item.product_id || item.service_id || item.id,
            type: item.product_id ? 'product' as const : 'service' as const,
            hsnCode: item.product_hsn_code || item.service_hsn_code,
            amount: parseFloat(item.unit_price || 0),
            quantity: item.quantity || 1,
            category: item.category,
          }));

          if (taxItems.length > 0) {
            taxBreakdown = await taxCalculationService.calculateTax({
              items: taxItems,
              customerLocation,
              vendorLocation,
              vendorId: order.rows[0].vendor_id || undefined,
            });
            hsnSummary = taxBreakdown.hsnSummary || [];
          }
        } catch (taxError) {
          console.error('Error recalculating tax for invoice:', taxError);
        }
      }

      // Calculate totals
      const subtotal = items.rows.reduce((sum: number, item: any) => 
        sum + (item.quantity * item.unit_price), 0);
      const tax = order.rows[0].tax_amount || taxBreakdown?.totalTax || 0;
      const cgst = order.rows[0].cgst_amount || taxBreakdown?.totalCGST || 0;
      const sgst = order.rows[0].sgst_amount || taxBreakdown?.totalSGST || 0;
      const igst = order.rows[0].igst_amount || taxBreakdown?.totalIGST || 0;
      const discount = order.rows[0].discount_amount || 0;
      const finalAmount = order.rows[0].total_amount || order.rows[0].final_amount;

      // Enhance items with HSN codes
      const enhancedItems = items.rows.map((item: any) => ({
        ...item,
        hsn_code: item.product_hsn_code || item.service_hsn_code,
      }));

      const invoice = {
        invoice_number: `INV-${order.rows[0].order_number}`,
        invoice_date: order.rows[0].created_at,
        order: order.rows[0],
        vendor: {
          name: order.rows[0].vendor_name,
          phone: order.rows[0].vendor_phone,
          email: order.rows[0].vendor_email,
          address: order.rows[0].vendor_address,
          gst: order.rows[0].vendor_gst
        },
        customer: {
          name: order.rows[0].customer_name,
          phone: order.rows[0].customer_phone,
          email: order.rows[0].customer_email,
          address: order.rows[0].customer_address || order.rows[0].delivery_address
        },
        items: enhancedItems,
        totals: {
          subtotal,
          tax,
          cgst,
          sgst,
          igst,
          discount,
          final_amount: finalAmount
        },
        tax_breakdown: taxBreakdown ? {
          items: taxBreakdown.items,
          summary: taxBreakdown.hsnSummary,
          isInterstate: taxBreakdown.isInterstate,
        } : null,
        hsn_codes: hsnSummary.map((hsn: any) => ({
          hsnCode: hsn.hsnCode,
          description: hsn.description,
          taxableAmount: hsn.taxableAmount,
          gstRate: hsn.gstRate,
          cgstAmount: hsn.cgstAmount,
          sgstAmount: hsn.sgstAmount,
          igstAmount: hsn.igstAmount,
          totalTax: hsn.totalTax,
        })),
      };

      return this.success({ invoice });
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      return this.error(error.message || 'Failed to fetch invoice', 500);
    }
  }
}

// ============================================================================
// POST /customer/orders/:id/return - Customer return request
// ============================================================================

class CustomerReturnOrderHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const orderId = context.event.pathParameters?.id;
      const customerId =
        context.event.pathParameters?.customerId ||
        context.event.queryStringParameters?.customerId ||
        context.userId;

      if (!orderId) {
        return this.error('Order ID is required', 400);
      }

      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      let body: { reason?: string; items?: Array<{ orderItemId: string; quantity?: number }> } = {};
      if (context.event.body) {
        try {
          body = typeof context.event.body === 'string'
            ? JSON.parse(context.event.body)
            : context.event.body;
        } catch {
          body = {};
        }
      }

      if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
        return this.error('At least one return item is required', 400);
      }

      const orderResult = await query(
        'SELECT id, order_status, customer_id, vendor_id, delivered_at, shipping_address FROM orders WHERE id = $1 AND customer_id = $2',
        [orderId, customerId]
      );

      if (orderResult.rows.length === 0) {
        return this.error('Order not found', 404);
      }

      const order = orderResult.rows[0];
      if (order.order_status !== 'delivered') {
        return this.error(
          `Return is only allowed for delivered orders. Current status: ${order.order_status}`,
          400
        );
      }

      let eligibleItems;
      try {
        ({ eligibleItems } = await assertReturnItemsAllowed(orderId, body.items));
      } catch (err: unknown) {
        if (err instanceof ReturnItemsNotAllowedError) {
          return this.error(err.message, err.statusCode);
        }
        throw err;
      }

      // Cancel any pending loyalty award for this order — customer is initiating a return
      await import('../../../utils/ecommerce-loyalty')
        .then(({ cancelPendingLoyaltyAward }) => cancelPendingLoyaltyAward(orderId, 'return_initiated'))
        .catch((e) => console.warn('[CUSTOMER-ORDERS] cancelPendingLoyaltyAward failed:', e?.message));

      const orderItemsResult = await query(
        `SELECT oi.*, p.name as product_name FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [orderId]
      );
      const orderItemMap = new Map(
        (orderItemsResult.rows || []).map((row: Record<string, unknown>) => [String(row.id), row])
      );

      let totalRefundAmount = 0;
      for (const item of eligibleItems) {
        const orderItem = orderItemMap.get(item.orderItemId);
        if (!orderItem) {
          return this.error(`Order item ${item.orderItemId} not found`, 400);
        }
        const qty = item.maxReturnQuantity;
        totalRefundAmount += parseFloat(String(orderItem.unit_price ?? '0')) * qty;
      }

      const returnNumber = `RET-${Date.now().toString(36).toUpperCase()}`;
      const primaryReason = body.reason?.trim() || 'Customer return request';
      const now = new Date().toISOString();

      const [returnRequest] = await insert('return_requests', {
        order_id: orderId,
        customer_id: order.customer_id,
        vendor_id: order.vendor_id,
        return_number: returnNumber,
        status: 'pending',
        reason: primaryReason,
        comments: null,
        photos: JSON.stringify([]),
        total_refund_amount: totalRefundAmount,
        pickup_address: order.shipping_address ?? null,
        preferred_pickup_date: null,
        bank_account_details: null,
        created_at: now,
        updated_at: now,
      });

      for (const item of eligibleItems) {
        const orderItem = orderItemMap.get(item.orderItemId)!;
        const qty = item.maxReturnQuantity;
        await insert('return_items', {
          return_request_id: returnRequest.id,
          order_item_id: item.orderItemId,
          product_id: orderItem.product_id,
          quantity: qty,
          reason: primaryReason,
          comments: null,
          refund_amount: parseFloat(String(orderItem.unit_price ?? '0')) * qty,
          status: 'pending',
          created_at: now,
        });
      }

      await update('orders', { id: orderId }, {
        has_return_request: true,
        return_status: 'pending',
        updated_at: now,
      });

      await insert('order_status_history', {
        order_id: orderId,
        status: 'return_requested',
        notes: primaryReason,
        changed_by_type: 'customer',
        created_at: now,
      });

      return this.success({
        success: true,
        orderId,
        returnRequestId: returnRequest.id,
        returnNumber,
        status: 'pending',
        totalRefundAmount,
        itemCount: eligibleItems.length,
        message: 'Return request submitted successfully',
      });
    } catch (error: any) {
      console.error('Error submitting customer return:', error);
      return this.error(error.message || 'Failed to submit return request', 500);
    }
  }
}

// ============================================================================
// GET /customer/orders/:orderId/payment-resume - Resume Razorpay for unpaid shop order
// ============================================================================

class ShopOrderPaymentResumeHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const orderId =
        context.event.pathParameters?.orderId ||
        context.event.pathParameters?.id;
      const customerId =
        context.event.pathParameters?.customerId ||
        context.event.queryStringParameters?.customerId ||
        context.userId;

      if (!orderId) {
        return this.error('Order ID is required', 400);
      }
      if (!customerId) {
        return this.error('Customer ID is required', 401);
      }

      const ownerCheck = await query(
        `SELECT id FROM orders WHERE id = $1::uuid AND customer_id = $2::uuid LIMIT 1`,
        [orderId, customerId]
      );
      if (ownerCheck.rows.length === 0) {
        return this.error('Order not found', 404);
      }

      const ctx = await buildShopOrderPaymentResumeContext(orderId);
      if (!ctx) {
        return this.error('Order is not awaiting payment', 404);
      }

      if (!ctx.canResume) {
        await discardUnpaidShopOrder(orderId, 'payment_window_expired', {
          requestId: randomUUID(),
          paymentStatus: 'expired',
        }).catch((e) =>
          console.warn('[customer/orders/payment-resume] discard after expiry failed:', e)
        );
        return this.error('Payment window expired. Please place a new order.', 410);
      }

      return this.success({
        success: true,
        canResume: true,
        ...ctx,
      });
    } catch (error: any) {
      console.error('[customer/orders/payment-resume] failed:', error);
      return this.error(error.message || 'Failed to load payment resume context', 500);
    }
  }
}

// ============================================================================
// REGISTER ENDPOINTS
// ============================================================================

export function registerCustomerOrdersEndpoints(app: Hono) {
  const createOrderHandler = new CreateCustomerOrderHandler();
  const getOrdersHandler = new GetCustomerOrdersHandler();
  const getDetailsHandler = new GetOrderDetailsHandler();
  const getInvoiceHandler = new GetOrderInvoiceHandler();
  const returnOrderHandler = new CustomerReturnOrderHandler();
  const shopPaymentResumeHandler = new ShopOrderPaymentResumeHandler();

  // PHASE 1.3 FIX: Add POST /customer/orders endpoint
  app.post('/customer/orders', async (c) => {
    try {
      const body = await c.req.json();
      const response = await createOrderHandler.handle({
        event: {
          body: JSON.stringify(body),
          queryStringParameters: c.req.query ? Object.fromEntries(Object.entries(c.req.query())) : {},
        } as any,
      } as HandlerContext);
      return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 500);
    } catch (error: any) {
      console.error('Error creating order:', error);
      return c.json({ error: error.message || 'Failed to create order' }, 500);
    }
  });

  app.get('/customer/orders', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getOrdersHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/orders/:id/payment-resume', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await shopPaymentResumeHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/orders/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getDetailsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/orders/:id/invoice', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await getInvoiceHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/customer/orders/:id/return', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const event = createApiGatewayEvent(c.req);
    event.body = JSON.stringify(body);
    const context = createLambdaContext();
    const result = await returnOrderHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// Helper to convert Hono request to API Gateway event (for compatibility)
function createApiGatewayEvent(req: any): any {
  return {
    pathParameters: req.param ? Object.fromEntries(Object.entries(req.param())) : {},
    queryStringParameters: req.query ? Object.fromEntries(Object.entries(req.query())) : {},
    body: req.body ? JSON.stringify(req.body) : null,
    headers: req.header ? Object.fromEntries(Object.entries(req.header())) : {},
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header?.('x-user-id') || 'test-user'
        }
      }
    }
  };
}

function createLambdaContext(): any {
  return {};
}

