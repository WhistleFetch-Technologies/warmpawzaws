/**
 * ============================================================================
 * RETURNS & REFUNDS ENHANCED ENDPOINTS
 * ============================================================================
 * 
 * Complete return management:
 * - Return request submission with reasons
 * - Return approval/rejection workflow
 * - Pickup scheduling
 * - Refund processing
 * - Return status tracking
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { resolveReturnWindowDays } from '../utils/return-window';
import {
  assertReturnItemsAllowed,
  loadOrderItemsWithReturnEligibility,
  orderHasReturnableItems,
  ReturnItemsNotAllowedError,
} from '../utils/category-return-eligibility';
import {
  initiateShopOrderRazorpayRefund,
  type ShopRefundStatus,
} from '../utils/payments/shop-order-refund';

const RETURN_REASONS = [
  { id: 'damaged', label: 'Product damaged/defective' },
  { id: 'wrong_item', label: 'Wrong item received' },
  { id: 'not_as_described', label: 'Not as described' },
  { id: 'quality_issue', label: 'Quality not satisfactory' },
  { id: 'size_fit', label: 'Size/Fit issue' },
  { id: 'changed_mind', label: 'Changed my mind' },
  { id: 'better_price', label: 'Found better price elsewhere' },
  { id: 'other', label: 'Other reason' },
];

const REFUND_ELIGIBLE_REASONS = ['damaged', 'wrong_item', 'not_as_described', 'quality_issue'];

export function registerReturnsEnhancedEndpoints(app: Hono) {

  // ============================================================================
  // GET RETURN REASONS
  // ============================================================================

  app.get('/returns/reasons', async (c) => {
    return c.json({
      success: true,
      reasons: RETURN_REASONS,
    });
  });

  // ============================================================================
  // CHECK RETURN ELIGIBILITY
  // ============================================================================

  app.get('/orders/:orderId/return-eligibility', async (c) => {
    try {
      const orderId = c.req.param('orderId');

      const orderResult = await query(
        `SELECT o.id, o.order_status, o.delivered_at, o.vendor_id, v.is_returnable AS vendor_is_returnable
         FROM orders o
         LEFT JOIN vendors v ON o.vendor_id = v.id
         WHERE o.id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }

      const order = orderResult.rows[0];
      const itemEligibility = await loadOrderItemsWithReturnEligibility(orderId);
      const returnWindowDays =
        itemEligibility[0]?.returnWindowDays ?? (await resolveReturnWindowDays(order.vendor_id));

      const eligibility = {
        isEligible: false,
        reasons: [] as string[],
        items: [] as any[],
        returnWindowDays,
        daysRemaining: itemEligibility.reduce(
          (max, item) => Math.max(max, item.daysRemaining),
          0
        ),
        policy: {
          allowReturns: order.vendor_is_returnable !== false && orderHasReturnableItems(itemEligibility),
          refundMethod: 'original_payment',
          pickupAvailable: true,
          selfShipAllowed: true,
        },
      };

      if (order.order_status !== 'delivered') {
        eligibility.reasons.push(`Order must be delivered to initiate return. Current status: ${order.order_status}`);
        return c.json({ success: true, eligibility });
      }

      const existingReturn = await query(
        `SELECT id, status FROM return_requests WHERE order_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
        [orderId]
      );

      if (existingReturn.rows.length > 0) {
        eligibility.reasons.push(`A return request already exists (Status: ${existingReturn.rows[0].status})`);
        return c.json({ success: true, eligibility });
      }

      eligibility.items = itemEligibility
        .filter((item) => item.isReturnable)
        .map((item) => ({
          id: item.orderItemId,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: null,
          totalPrice: null,
          isReturnable: true,
          maxReturnQuantity: item.maxReturnQuantity,
          categoryName: item.categoryName,
        }));

      if (eligibility.items.length === 0) {
        const blocked = itemEligibility.find((item) => item.blockReason);
        eligibility.reasons.push(
          blocked?.blockReason || 'No returnable items in this order (returns are available for eligible categories only)'
        );
        return c.json({ success: true, eligibility });
      }

      eligibility.isEligible = true;

      return c.json({ success: true, eligibility });
    } catch (error: any) {
      console.error('Error checking return eligibility:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // CREATE RETURN REQUEST
  // ============================================================================

  app.post('/orders/:orderId/returns', async (c) => {
    try {
      const orderId = c.req.param('orderId');
      const body = await c.req.json();
      const {
        customerId,
        items, // Array of { orderItemId, quantity, reason, comments }
        overallReason,
        comments,
        photos = [],
        preferredPickupDate,
        pickupAddress,
        bankAccountDetails,
      } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return c.json({ success: false, error: 'At least one item is required for return' }, 400);
      }

      // Verify order exists and belongs to customer
      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }

      const order = orders[0];
      if (customerId && order.customer_id !== customerId) {
        return c.json({ success: false, error: 'Order does not belong to this customer' }, 403);
      }

      if (order.order_status !== 'delivered') {
        return c.json({
          success: false,
          error: `Return is only allowed for delivered orders. Current status: ${order.order_status}`,
        }, 400);
      }

      let eligibleItems;
      try {
        ({ eligibleItems } = await assertReturnItemsAllowed(
          orderId,
          items.map((item: { orderItemId: string; quantity?: number }) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          }))
        ));
      } catch (err: unknown) {
        if (err instanceof ReturnItemsNotAllowedError) {
          return c.json({ success: false, error: err.message }, err.statusCode);
        }
        throw err;
      }

      // Cancel any pending loyalty award for this order — return is being initiated
      await import('../utils/ecommerce-loyalty')
        .then(({ cancelPendingLoyaltyAward }) => cancelPendingLoyaltyAward(orderId, 'return_initiated'))
        .catch((e) => console.warn('[RETURNS-ENHANCED] cancelPendingLoyaltyAward failed:', e?.message));

      // Validate items
      const orderItems = await query(
        `SELECT oi.*, p.name as product_name FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
        [orderId]
      );

      const orderItemMap = new Map(orderItems.rows.map((i: any) => [i.id, i]));
      let totalRefundAmount = 0;

      for (const item of items) {
        const orderItem = orderItemMap.get(item.orderItemId);
        if (!orderItem) {
          return c.json({ success: false, error: `Order item ${item.orderItemId} not found` }, 400);
        }
        const allowed = eligibleItems.find((e) => e.orderItemId === item.orderItemId);
        const qty = item.quantity ?? allowed?.maxReturnQuantity ?? orderItem.quantity;
        if (qty > orderItem.quantity) {
          return c.json({ success: false, error: `Cannot return more than ordered quantity for ${orderItem.product_name}` }, 400);
        }
        totalRefundAmount += parseFloat(orderItem.unit_price) * qty;
      }

      // Generate return request number
      const returnNumber = `RET-${Date.now().toString(36).toUpperCase()}`;

      // Determine if auto-approval based on reason
      const primaryReason = overallReason || items[0]?.reason;
      const isEligibleForAutoApproval = REFUND_ELIGIBLE_REASONS.includes(primaryReason);
      const initialStatus = isEligibleForAutoApproval ? 'approved' : 'pending';

      // Create return request
      const [returnRequest] = await insert('return_requests', {
        order_id: orderId,
        customer_id: order.customer_id,
        vendor_id: order.vendor_id,
        return_number: returnNumber,
        status: initialStatus,
        reason: primaryReason,
        comments,
        photos: JSON.stringify(photos),
        total_refund_amount: totalRefundAmount,
        pickup_address: pickupAddress ? JSON.stringify(pickupAddress) : order.shipping_address,
        preferred_pickup_date: preferredPickupDate || null,
        bank_account_details: bankAccountDetails ? JSON.stringify(bankAccountDetails) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Create return items
      for (const item of items) {
        const orderItem = orderItemMap.get(item.orderItemId);
        await insert('return_items', {
          return_request_id: returnRequest.id,
          order_item_id: item.orderItemId,
          product_id: orderItem.product_id,
          quantity: item.quantity,
          reason: item.reason || primaryReason,
          comments: item.comments || null,
          refund_amount: parseFloat(orderItem.unit_price) * item.quantity,
          status: initialStatus,
          created_at: new Date().toISOString(),
        });
      }

      // Update order status
      await update('orders', { id: orderId }, {
        has_return_request: true,
        return_status: initialStatus,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        returnRequest: {
          id: returnRequest.id,
          returnNumber,
          status: initialStatus,
          totalRefundAmount,
          itemCount: items.length,
          message: initialStatus === 'approved' 
            ? 'Return request approved! We will schedule pickup soon.'
            : 'Return request submitted. Awaiting vendor approval.',
        },
      });
    } catch (error: any) {
      console.error('Error creating return request:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // GET RETURN REQUEST STATUS
  // ============================================================================

  app.get('/returns/:returnId', async (c) => {
    try {
      const returnId = c.req.param('returnId');

      const returnQuery = `
        SELECT 
          rr.*,
          o.order_number,
          c.full_name as customer_name,
          v.business_name as vendor_name
        FROM return_requests rr
        LEFT JOIN orders o ON rr.order_id = o.id
        LEFT JOIN customers c ON rr.customer_id = c.id
        LEFT JOIN vendors v ON rr.vendor_id = v.id
        WHERE rr.id = $1
      `;
      const returnResult = await query(returnQuery, [returnId]);

      if (returnResult.rows.length === 0) {
        return c.json({ success: false, error: 'Return request not found' }, 404);
      }

      const returnRequest = returnResult.rows[0];

      // Get return items
      const itemsResult = await query(
        `SELECT ri.*, p.name as product_name, p.images as product_images
         FROM return_items ri
         LEFT JOIN products p ON ri.product_id = p.id
         WHERE ri.return_request_id = $1`,
        [returnId]
      );

      // Get timeline
      const timeline = [
        { status: 'created', timestamp: returnRequest.created_at, label: 'Return Requested' },
      ];

      if (returnRequest.approved_at) {
        timeline.push({ status: 'approved', timestamp: returnRequest.approved_at, label: 'Approved' });
      }
      if (returnRequest.pickup_scheduled_at) {
        timeline.push({ status: 'pickup_scheduled', timestamp: returnRequest.pickup_scheduled_at, label: 'Pickup Scheduled' });
      }
      if (returnRequest.picked_up_at) {
        timeline.push({ status: 'picked_up', timestamp: returnRequest.picked_up_at, label: 'Item Picked Up' });
      }
      if (returnRequest.quality_checked_at) {
        timeline.push({ status: 'quality_checked', timestamp: returnRequest.quality_checked_at, label: 'Quality Check Completed' });
      }
      if (returnRequest.refund_initiated_at) {
        timeline.push({ status: 'refund_initiated', timestamp: returnRequest.refund_initiated_at, label: 'Refund Initiated' });
      }
      if (returnRequest.refund_completed_at) {
        timeline.push({ status: 'completed', timestamp: returnRequest.refund_completed_at, label: 'Refund Completed' });
      }
      if (returnRequest.rejected_at) {
        timeline.push({ status: 'rejected', timestamp: returnRequest.rejected_at, label: 'Return Rejected' });
      }

      return c.json({
        success: true,
        returnRequest: {
          id: returnRequest.id,
          returnNumber: returnRequest.return_number,
          orderId: returnRequest.order_id,
          orderNumber: returnRequest.order_number,
          status: returnRequest.status,
          reason: returnRequest.reason,
          comments: returnRequest.comments,
          photos: typeof returnRequest.photos === 'string' ? JSON.parse(returnRequest.photos || '[]') : (returnRequest.photos || []),
          totalRefundAmount: parseFloat(returnRequest.total_refund_amount),
          refundMethod: returnRequest.refund_method,
          customerName: returnRequest.customer_name,
          vendorName: returnRequest.vendor_name,
          createdAt: returnRequest.created_at,
          items: (itemsResult.rows || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.product_name,
            productImage: typeof item.product_images === 'string'
              ? (JSON.parse(item.product_images || '[]')[0])
              : (item.product_images?.[0]),
            quantity: item.quantity,
            refundAmount: parseFloat(item.refund_amount),
            status: item.status,
          })),
          timeline: timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
          rejectionReason: returnRequest.rejection_reason,
        },
      });
    } catch (error: any) {
      console.error('Error fetching return request:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // GET CUSTOMER RETURNS
  // ============================================================================

  app.get('/customer/:customerId/returns', async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      let whereClause = 'WHERE rr.customer_id = $1';
      const params: any[] = [customerId];
      let paramIdx = 2;

      if (status) {
        whereClause += ` AND rr.status = $${paramIdx++}`;
        params.push(status);
      }

      params.push(limit, offset);

      const returnsQuery = `
        SELECT 
          rr.*,
          o.order_number,
          (SELECT COUNT(*) FROM return_items WHERE return_request_id = rr.id) as item_count
        FROM return_requests rr
        LEFT JOIN orders o ON rr.order_id = o.id
        ${whereClause}
        ORDER BY rr.created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx}
      `;

      const result = await query(returnsQuery, params);

      return c.json({
        success: true,
        returns: (result.rows || []).map((r: any) => ({
          id: r.id,
          returnNumber: r.return_number,
          orderId: r.order_id,
          orderNumber: r.order_number,
          status: r.status,
          reason: r.reason,
          itemCount: parseInt(r.item_count) || 0,
          totalRefundAmount: parseFloat(r.total_refund_amount),
          createdAt: r.created_at,
        })),
        pagination: { limit, offset },
      });
    } catch (error: any) {
      console.error('Error fetching customer returns:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // VENDOR: GET RETURN REQUESTS
  // ============================================================================

  app.get('/vendor/:vendorId/returns', async (c) => {
    try {
      const vendorId = c.req.param('vendorId');
      const status = c.req.query('status');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      let whereClause = 'WHERE rr.vendor_id = $1';
      const params: any[] = [vendorId];
      let paramIdx = 2;

      if (status) {
        whereClause += ` AND rr.status = $${paramIdx++}`;
        params.push(status);
      }

      params.push(limit, offset);

      const returnsQuery = `
        SELECT 
          rr.*,
          o.order_number,
          c.full_name as customer_name,
          c.phone as customer_phone,
          (SELECT COUNT(*) FROM return_items WHERE return_request_id = rr.id) as item_count
        FROM return_requests rr
        LEFT JOIN orders o ON rr.order_id = o.id
        LEFT JOIN customers c ON rr.customer_id = c.id
        ${whereClause}
        ORDER BY rr.created_at DESC
        LIMIT $${paramIdx++} OFFSET $${paramIdx}
      `;

      const result = await query(returnsQuery, params);

      // Get counts by status
      const countQuery = `
        SELECT 
          status,
          COUNT(*) as count
        FROM return_requests
        WHERE vendor_id = $1
        GROUP BY status
      `;
      const counts = await query(countQuery, [vendorId]);
      const statusCounts = counts.rows.reduce((acc: any, row: any) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {});

      return c.json({
        success: true,
        returns: (result.rows || []).map((r: any) => ({
          id: r.id,
          returnNumber: r.return_number,
          orderId: r.order_id,
          orderNumber: r.order_number,
          status: r.status,
          reason: r.reason,
          customerName: r.customer_name,
          customerPhone: r.customer_phone,
          itemCount: parseInt(r.item_count) || 0,
          totalRefundAmount: parseFloat(r.total_refund_amount),
          createdAt: r.created_at,
        })),
        statusCounts,
        pagination: { limit, offset },
      });
    } catch (error: any) {
      console.error('Error fetching vendor returns:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // VENDOR: APPROVE/REJECT RETURN
  // ============================================================================

  app.put('/vendor/:vendorId/returns/:returnId/decision', async (c) => {
    try {
      const { vendorId, returnId } = c.req.param();
      const body = await c.req.json();
      const { decision, rejectionReason, refundMethod = 'original_payment', notes } = body;

      if (!['approve', 'reject'].includes(decision)) {
        return c.json({ success: false, error: 'Decision must be "approve" or "reject"' }, 400);
      }

      // Verify return belongs to vendor
      const returns = await select('return_requests', { id: returnId });
      if (returns.length === 0) {
        return c.json({ success: false, error: 'Return request not found' }, 404);
      }

      const returnRequest = returns[0];
      if (returnRequest.vendor_id !== vendorId) {
        return c.json({ success: false, error: 'Return does not belong to this vendor' }, 403);
      }

      if (returnRequest.status !== 'pending') {
        return c.json({ success: false, error: `Cannot process return in ${returnRequest.status} status` }, 400);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
        vendor_notes: notes || null,
      };

      if (decision === 'approve') {
        updateData.status = 'approved';
        updateData.approved_at = new Date().toISOString();
        updateData.refund_method = refundMethod;
      } else {
        updateData.status = 'rejected';
        updateData.rejected_at = new Date().toISOString();
        updateData.rejection_reason = rejectionReason || 'Return request does not meet our return policy criteria';
      }

      await update('return_requests', { id: returnId }, updateData);

      // Update return items status
      await query(
        `UPDATE return_items SET status = $1, updated_at = NOW() WHERE return_request_id = $2`,
        [updateData.status, returnId]
      );

      // Update order return status
      await update('orders', { id: returnRequest.order_id }, {
        return_status: updateData.status,
        updated_at: new Date().toISOString(),
      });

      // Reverse loyalty points if the return is approved and points were already awarded
      let refundStatus: ShopRefundStatus | undefined;
      if (decision === 'approve') {
        await import('../utils/ecommerce-loyalty')
          .then(({ reverseLoyaltyAwardForOrder }) =>
            reverseLoyaltyAwardForOrder(
              String(returnRequest.order_id),
              String(returnRequest.customer_id)
            )
          )
          .catch((e) =>
            console.warn('[RETURNS-ENHANCED] reverseLoyaltyAwardForOrder failed (non-fatal):', e?.message)
          );

        if (refundMethod === 'original_payment' || refundMethod === 'original') {
          const prefetch = await query(
            `SELECT rr.id::text AS return_id, rr.total_refund_amount::text, rr.customer_id::text,
                    rr.vendor_id::text, rr.order_id::text, p.id::text AS payment_id, p.razorpay_payment_id
             FROM return_requests rr
             JOIN orders o ON o.id = rr.order_id
             LEFT JOIN LATERAL (
               SELECT id, razorpay_payment_id
               FROM payments
               WHERE order_id = rr.order_id
                 AND LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid')
               ORDER BY created_at DESC NULLS LAST
               LIMIT 1
             ) p ON TRUE
             WHERE rr.id = $1::uuid AND rr.vendor_id = $2::uuid
             LIMIT 1`,
            [returnId, vendorId],
          );
          const row = prefetch.rows[0];
          const refundAmount = parseFloat(String(row?.total_refund_amount ?? returnRequest.total_refund_amount)) || 0;
          if (row?.payment_id && refundAmount > 0.009) {
            const rz = await initiateShopOrderRazorpayRefund({
              orderId: String(row.order_id),
              amount: refundAmount,
              reason: `Return approved: ${returnRequest.return_number || returnId}`,
              returnRequestId: returnId,
              customerId: String(row.customer_id),
              vendorId: String(row.vendor_id),
            });
            refundStatus = rz.refundStatus;
          }
        }
      }

      return c.json({
        success: true,
        message: decision === 'approve' 
          ? 'Return approved. Pickup will be scheduled.'
          : 'Return request rejected.',
        status: updateData.status,
        refundStatus,
      });
    } catch (error: any) {
      console.error('Error processing return decision:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // SCHEDULE PICKUP
  // ============================================================================

  app.post('/returns/:returnId/schedule-pickup', async (c) => {
    try {
      const returnId = c.req.param('returnId');
      const body = await c.req.json();
      const { pickupDate, pickupSlot, pickupAddress, courierPartner } = body;

      const returns = await select('return_requests', { id: returnId });
      if (returns.length === 0) {
        return c.json({ success: false, error: 'Return request not found' }, 404);
      }

      const returnRequest = returns[0];
      if (returnRequest.status !== 'approved') {
        return c.json({ success: false, error: 'Return must be approved before scheduling pickup' }, 400);
      }

      await update('return_requests', { id: returnId }, {
        status: 'pickup_scheduled',
        pickup_date: pickupDate,
        pickup_slot: pickupSlot,
        pickup_address: pickupAddress ? JSON.stringify(pickupAddress) : returnRequest.pickup_address,
        courier_partner: courierPartner || 'shiprocket',
        pickup_scheduled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Pickup scheduled successfully',
        pickup: {
          date: pickupDate,
          slot: pickupSlot,
        },
      });
    } catch (error: any) {
      console.error('Error scheduling pickup:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // UPDATE RETURN STATUS (Internal/Admin)
  // ============================================================================

  app.put('/returns/:returnId/status', async (c) => {
    try {
      const returnId = c.req.param('returnId');
      const body = await c.req.json();
      const { status, notes, qualityCheckResult, refundTransactionId } = body;

      const validStatuses = [
        'pending', 'approved', 'pickup_scheduled', 'picked_up', 
        'in_transit', 'received', 'quality_check', 'refund_initiated', 
        'completed', 'rejected', 'cancelled'
      ];

      if (!validStatuses.includes(status)) {
        return c.json({ success: false, error: `Invalid status. Valid: ${validStatuses.join(', ')}` }, 400);
      }

      const returns = await select('return_requests', { id: returnId });
      if (returns.length === 0) {
        return c.json({ success: false, error: 'Return request not found' }, 404);
      }

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (notes) updateData.admin_notes = notes;

      // Set timestamps based on status
      switch (status) {
        case 'picked_up':
          updateData.picked_up_at = new Date().toISOString();
          break;
        case 'received':
          updateData.received_at = new Date().toISOString();
          break;
        case 'quality_check':
          updateData.quality_checked_at = new Date().toISOString();
          updateData.quality_check_result = qualityCheckResult || null;
          break;
        case 'refund_initiated':
          updateData.refund_initiated_at = new Date().toISOString();
          break;
        case 'completed':
          updateData.refund_completed_at = new Date().toISOString();
          updateData.refund_transaction_id = refundTransactionId || null;
          break;
      }

      await update('return_requests', { id: returnId }, updateData);

      // Update order return status
      await query(
        `UPDATE orders SET return_status = $1, updated_at = NOW() WHERE id = (SELECT order_id FROM return_requests WHERE id = $2)`,
        [status, returnId]
      );

      return c.json({
        success: true,
        message: `Return status updated to ${status}`,
      });
    } catch (error: any) {
      console.error('Error updating return status:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // PROCESS REFUND
  // ============================================================================

  app.post('/returns/:returnId/process-refund', async (c) => {
    try {
      const returnId = c.req.param('returnId');

      const prefetch = await query(
        `SELECT rr.*, p.id::text AS payment_id, p.razorpay_payment_id, p.amount::text AS payment_amount
         FROM return_requests rr
         JOIN orders o ON o.id = rr.order_id
         LEFT JOIN LATERAL (
           SELECT id, razorpay_payment_id, amount
           FROM payments
           WHERE order_id = rr.order_id
             AND LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid')
           ORDER BY created_at DESC NULLS LAST
           LIMIT 1
         ) p ON TRUE
         WHERE rr.id = $1::uuid
         LIMIT 1`,
        [returnId],
      );

      if (prefetch.rows.length === 0) {
        return c.json({ success: false, error: 'Return request not found' }, 404);
      }

      const returnRequest = prefetch.rows[0];
      
      if (!['approved', 'received', 'quality_check'].includes(returnRequest.status)) {
        return c.json({ success: false, error: 'Return must be approved/received before processing refund' }, 400);
      }

      const refundAmount = parseFloat(returnRequest.total_refund_amount);
      const refundMethod = returnRequest.refund_method || 'wallet';

      let refundResult: { success: boolean; transactionId?: string; error?: string; refundStatus?: ShopRefundStatus } = {
        success: true,
      };

      if (refundMethod === 'wallet') {
        // Credit to customer wallet
        try {
          const walletResult = await query(
            `SELECT id, balance FROM customer_wallets WHERE customer_id = $1 FOR UPDATE`,
            [returnRequest.customer_id]
          );

          if (walletResult.rows.length === 0) {
            // Create wallet
            await insert('customer_wallets', {
              customer_id: returnRequest.customer_id,
              balance: refundAmount,
              created_at: new Date().toISOString(),
            });
          } else {
            await update('customer_wallets', { id: walletResult.rows[0].id }, {
              balance: parseFloat(walletResult.rows[0].balance) + refundAmount,
              updated_at: new Date().toISOString(),
            });
          }

          // Record transaction
          await insert('wallet_transactions', {
            customer_id: returnRequest.customer_id,
            amount: refundAmount,
            type: 'credit',
            description: `Refund for return ${returnRequest.return_number}`,
            reference_type: 'return',
            reference_id: returnId,
            created_at: new Date().toISOString(),
          });

          refundResult.transactionId = `WLT-${Date.now()}`;
        } catch (e: any) {
          console.error('Wallet refund error:', e);
          refundResult = { success: false, error: e.message };
        }
      } else if (refundMethod === 'original_payment' || refundMethod === 'original') {
        const rz = await initiateShopOrderRazorpayRefund({
          orderId: String(returnRequest.order_id),
          amount: refundAmount,
          reason: `Return refund: ${returnRequest.return_number || returnId}`,
          returnRequestId: returnId,
          customerId: String(returnRequest.customer_id),
          vendorId: returnRequest.vendor_id ? String(returnRequest.vendor_id) : undefined,
        });
        refundResult = {
          success: rz.success,
          transactionId: rz.razorpayRefundId || rz.refundId,
          error: rz.error,
          refundStatus: rz.refundStatus,
        };
      }

      // Update return status
      await update('return_requests', { id: returnId }, {
        status: refundResult.success ? 'completed' : 'refund_initiated',
        refund_initiated_at: new Date().toISOString(),
        refund_completed_at: refundResult.success ? new Date().toISOString() : null,
        refund_transaction_id: refundResult.transactionId || null,
        updated_at: new Date().toISOString(),
      });

      // Update order
      await query(
        `UPDATE orders SET return_status = 'completed', refund_amount = $1, updated_at = NOW() WHERE id = $2`,
        [refundAmount, returnRequest.order_id]
      );

      return c.json({
        success: refundResult.success,
        refund: {
          amount: refundAmount,
          method: refundMethod,
          transactionId: refundResult.transactionId,
          refundStatus: refundResult.refundStatus,
        },
        message: refundResult.success 
          ? `Refund of ₹${refundAmount} processed successfully`
          : 'Refund initiation failed',
      });
    } catch (error: any) {
      console.error('Error processing refund:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================================================
  // CANCEL RETURN REQUEST
  // ============================================================================

  app.post('/returns/:returnId/cancel', async (c) => {
    try {
      const returnId = c.req.param('returnId');
      const body = await c.req.json();
      const { customerId, reason } = body;

      const returns = await select('return_requests', { id: returnId });
      if (returns.length === 0) {
        return c.json({ success: false, error: 'Return request not found' }, 404);
      }

      const returnRequest = returns[0];
      
      if (customerId && returnRequest.customer_id !== customerId) {
        return c.json({ success: false, error: 'Return does not belong to this customer' }, 403);
      }

      if (!['pending', 'approved'].includes(returnRequest.status)) {
        return c.json({ success: false, error: `Cannot cancel return in ${returnRequest.status} status` }, 400);
      }

      await update('return_requests', { id: returnId }, {
        status: 'cancelled',
        cancellation_reason: reason || 'Customer cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Update order
      await update('orders', { id: returnRequest.order_id }, {
        has_return_request: false,
        return_status: null,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Return request cancelled',
      });
    } catch (error: any) {
      console.error('Error cancelling return:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}
