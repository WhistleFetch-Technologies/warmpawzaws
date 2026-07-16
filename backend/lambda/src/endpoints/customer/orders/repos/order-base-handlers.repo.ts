import { query, select, insert, update } from '../../../../database/rds-connection';

/** Dev/prod products.images JSONB — image_url column does not exist on RDS. */
const SQL_PRODUCT_IMAGE_SELECT = `CASE
  WHEN p.images IS NOT NULL
   AND jsonb_typeof(p.images) = 'array'
   AND jsonb_array_length(p.images) > 0
  THEN p.images->>0
  ELSE NULL
END AS product_image`;

export async function dbOrderBaseHandlers0(customerId: string) {
  return await query('SELECT phone FROM customers WHERE id = $1', [customerId]);
}

export async function dbOrderBaseHandlers1(customerPhone: string) {
  return await query('SELECT id FROM customers WHERE phone = $1', [customerPhone]);
}

export async function dbOrderBaseHandlers2(newCustomerId: string, customerName: string, customerPhone: string) {
  return await insert('customers', {
    id: newCustomerId,
    name: customerName,
    full_name: customerName,
    phone: customerPhone,
    is_active: true,
    status: 'new',
  });
}

export async function dbOrderBaseHandlers3(orderRow: Record<string, unknown>) {
  return await insert('orders', orderRow);
}

export async function dbOrderBaseHandlers4(orderId: string, line: Record<string, unknown>) {
  return await insert('order_items', {
    order_id: orderId,
    product_id: line.product_id,
    product_sku_id: line.product_sku_id ?? null,
    name: line.product_name,
    quantity: line.quantity,
    unit_price: line.unit_price,
    total_price: line.total_price,
    variant_info: line.variant_info ?? null,
  });
}

export async function dbOrderBaseHandlers5(ordersQuery: string, params: unknown[]) {
  return await query(ordersQuery, params);
}

export async function dbOrderBaseHandlers6(itemsQuery: string, orderIds: string[]) {
  return await query(itemsQuery, [orderIds]);
}

export async function dbOrderBaseHandlers7(customerId: string) {
  return await query(
    `
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
      `,
    [customerId]
  );
}

export async function dbOrderBaseHandlers8(orderId: string, customerId: string) {
  return await query(
    `
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
      `,
    [orderId, customerId]
  );
}

export async function dbOrderBaseHandlers9(orderId: string) {
  return await query(
    `
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
      `,
    [orderId]
  );
}

export async function dbOrderBaseHandlers10(orderId: string) {
  return await query(
    `
        SELECT * FROM order_status_history
        WHERE order_id = $1
        ORDER BY created_at ASC
      `,
    [orderId]
  );
}

export async function dbOrderBaseHandlers11(orderId: string) {
  return await query(
    `
        SELECT * FROM shipments
        WHERE order_id = $1
        ORDER BY created_at DESC
      `,
    [orderId]
  );
}

export async function dbOrderBaseHandlers12(orderId: string, customerId: string) {
  return await query(
    `
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
      `,
    [orderId, customerId]
  );
}

export async function dbOrderBaseHandlers13(orderId: string) {
  return await query(
    `
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
      `,
    [orderId]
  );
}

export async function dbOrderBaseHandlers14(orderId: string, customerId: string) {
  return await query(
    'SELECT id, order_status, customer_id, vendor_id, delivered_at, shipping_address FROM orders WHERE id = $1 AND customer_id = $2',
    [orderId, customerId]
  );
}

export async function dbOrderBaseHandlers15(orderId: string) {
  return await query(
    `SELECT oi.*, p.name as product_name FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [orderId]
  );
}

export async function dbOrderBaseHandlers16(
  orderId: string,
  order: Record<string, unknown>,
  returnNumber: string,
  primaryReason: string,
  totalRefundAmount: number,
  now: string
) {
  return await insert('return_requests', {
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
}

export async function dbOrderBaseHandlers17(
  returnRequest: { id: string },
  item: { orderItemId: string },
  orderItem: Record<string, unknown>,
  qty: number,
  primaryReason: string,
  now: string
) {
  return await insert('return_items', {
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

export async function dbOrderBaseHandlers18(orderId: string, now: string) {
  return await update('orders', { id: orderId }, {
    has_return_request: true,
    return_status: 'pending',
    updated_at: now,
  });
}

export async function dbOrderBaseHandlers19(orderId: string, primaryReason: string, now: string) {
  return await insert('order_status_history', {
    order_id: orderId,
    status: 'return_requested',
    notes: primaryReason,
    changed_by_type: 'customer',
    created_at: now,
  });
}

export async function dbOrderBaseHandlers20(orderId: string, customerId: string) {
  return await query(
    `SELECT id FROM orders WHERE id = $1::uuid AND customer_id = $2::uuid LIMIT 1`,
    [orderId, customerId]
  );
}
