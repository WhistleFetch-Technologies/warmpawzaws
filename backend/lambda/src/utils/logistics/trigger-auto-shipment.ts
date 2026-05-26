/**
 * Trigger auto-shipment creation after payment success (e-commerce, pharmacy, meal).
 * Fire-and-forget from Razorpay verify/webhook handlers.
 */
export async function triggerAutoShipment(orderId: string, orderType: string): Promise<void> {
  console.log(`[AUTO-SHIPMENT] Triggering for order ${orderId}, type: ${orderType}`);

  try {
    const { select, insert, update, query: dbQuery } = await import('../../database/rds-connection');
    const { logisticsPartnerService } = await import('../../lib/services/logistics-partner-service');

    let order: any = null;
    let vendorId: string | null = null;

    if (orderType === 'ecommerce') {
      const orders = await select('orders', { id: orderId });
      if (orders.length === 0) {
        console.warn(`[AUTO-SHIPMENT] Order not found: ${orderId}`);
        return;
      }
      order = orders[0];
      if (order.order_status === 'pending') {
        console.log(
          `[AUTO-SHIPMENT] Ecommerce order ${orderId} is pending vendor confirmation — skipping`
        );
        return;
      }
      await select('order_items', { order_id: orderId });
      vendorId = order.vendor_id;
    } else if (orderType === 'pharmacy') {
      const orders = await select('pharmacy_orders', { id: orderId });
      if (orders.length === 0) {
        console.warn(`[AUTO-SHIPMENT] Pharmacy order not found: ${orderId}`);
        return;
      }
      order = orders[0];
      vendorId = order.pharmacy_id;

      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
      await insert('delivery_tracking', {
        pharmacy_order_id: orderId,
        status: 'pending_assignment',
        delivery_otp: deliveryOtp,
      });

      await update('pharmacy_orders', { id: orderId }, {
        status: 'processing',
        logistics_type: 'warmpawz',
      });

      console.log(`[AUTO-SHIPMENT] Pharmacy delivery tracking created for ${orderId}`);
      return;
    } else if (orderType === 'meal') {
      const orders = await select('meal_orders', { id: orderId });
      if (orders.length === 0) {
        console.warn(`[AUTO-SHIPMENT] Meal order not found: ${orderId}`);
        return;
      }
      order = orders[0];
      vendorId = order.vendor_id;

      const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
      await insert('delivery_tracking', {
        meal_order_id: orderId,
        status: 'pending_assignment',
        delivery_otp: deliveryOtp,
      });

      await update('meal_orders', { id: orderId }, {
        status: 'processing',
        logistics_type: 'warmpawz',
      });

      console.log(`[AUTO-SHIPMENT] Meal delivery tracking created for ${orderId}`);
      return;
    }

    const settingsResult = await dbQuery(
      `SELECT setting_value FROM platform_settings WHERE setting_key = 'platform:logistics:auto_shipment'`
    );
    const autoShipmentEnabled =
      settingsResult.rows.length > 0
        ? (settingsResult.rows[0].setting_value as { enabled?: boolean })?.enabled === true
        : false;

    if (!autoShipmentEnabled) {
      console.log(`[AUTO-SHIPMENT] Auto-shipment disabled, skipping for ${orderId}`);
      return;
    }

    if (order?.customer_id) {
      await select('customers', { id: order.customer_id });
    }

    const shippingAddress =
      typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : order.shipping_address;

    const partner = await logisticsPartnerService.selectPartner({
      orderId,
      pickupLocation: {
        pincode: order.pickup_pincode || '560001',
      },
      deliveryLocation: {
        pincode: shippingAddress?.pincode || shippingAddress?.zip || order.shipping_pincode || '000000',
        city: shippingAddress?.city || order.shipping_city,
        state: shippingAddress?.state || order.shipping_state,
      },
      weight: order.total_weight || 1,
      orderValue: parseFloat(order.total_amount || '0'),
    });

    if (!partner) {
      console.log(`[AUTO-SHIPMENT] No partner available, marking for manual processing: ${orderId}`);
      await update('orders', { id: orderId }, {
        order_status: 'processing',
        logistics_notes: 'Pending manual shipment creation',
      });
      return;
    }

    await insert('shipments', {
      order_id: orderId,
      logistics_partner: partner.partner_type,
      logistics_partner_id: partner.id,
      status: 'pending_creation',
    });

    await update('orders', { id: orderId }, {
      order_status: 'processing',
    });

    console.log(`[AUTO-SHIPMENT] Shipment record created for ${orderId}, partner: ${partner.partner_name}`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[AUTO-SHIPMENT] Error processing ${orderId}:`, message);
    throw error;
  }
}
