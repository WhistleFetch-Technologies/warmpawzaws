import { query } from '../../../database/rds-connection';
import type { PoolClient } from 'pg';

export async function dbInsertEventPayment(
  client: PoolClient,
  data: {
    customer_id: string;
    vendor_id: string | null;
    amount: number;
    event_registration_id: string;
    idempotency_key?: string | null;
  }
): Promise<Record<string, unknown>> {
  const result = await client.query(
    `INSERT INTO payments (
       customer_id, vendor_id, amount, currency, payment_method, payment_status,
       payment_source, event_registration_id, idempotency_key, metadata
     ) VALUES (
       $1::uuid, $2, $3, 'INR', 'razorpay', 'pending',
       'event', $4::uuid, $5, $6::jsonb
     )
     RETURNING *`,
    [
      data.customer_id,
      data.vendor_id,
      data.amount,
      data.event_registration_id,
      data.idempotency_key || null,
      JSON.stringify({ event_registration_id: data.event_registration_id }),
    ]
  );
  return result.rows[0];
}

export async function dbFindPendingEventPayment(registrationId: string): Promise<Record<string, unknown> | null> {
  const result = await query(
    `SELECT * FROM payments
     WHERE event_registration_id = $1::uuid
       AND payment_source = 'event'
       AND LOWER(COALESCE(payment_status, '')) IN ('pending', 'processing')
     ORDER BY created_at DESC
     LIMIT 1`,
    [registrationId]
  );
  return result.rows[0] || null;
}

export async function dbFindCompletedEventPayment(registrationId: string): Promise<Record<string, unknown> | null> {
  const result = await query(
    `SELECT * FROM payments
     WHERE event_registration_id = $1::uuid
       AND payment_source = 'event'
       AND LOWER(COALESCE(payment_status, '')) IN ('completed', 'paid')
     ORDER BY created_at DESC
     LIMIT 1`,
    [registrationId]
  );
  return result.rows[0] || null;
}

export async function dbAttachRazorpayOrder(
  client: PoolClient,
  paymentId: string,
  razorpayOrderId: string
): Promise<void> {
  await client.query(
    `UPDATE payments SET razorpay_order_id = $2, updated_at = NOW()
     WHERE id = $1::uuid AND razorpay_order_id IS NULL`,
    [paymentId, razorpayOrderId]
  );
}

export async function dbSelectPaymentById(paymentId: string): Promise<Record<string, unknown> | null> {
  const result = await query(`SELECT * FROM payments WHERE id = $1::uuid`, [paymentId]);
  return result.rows[0] || null;
}

export async function dbListRefundsForPayment(paymentId: string): Promise<Record<string, unknown>[]> {
  const result = await query(
    `SELECT * FROM refunds WHERE payment_id = $1::uuid ORDER BY requested_at DESC NULLS LAST`,
    [paymentId]
  );
  return result.rows;
}

export async function dbHasVendorEventsCapability(vendorId: string): Promise<boolean> {
  const result = await query(
    `SELECT 1
     FROM vendors v
     INNER JOIN role_permissions rp ON rp.role_id = v.role_id
     WHERE v.id = $1::uuid AND rp.permission_name = 'events'
     LIMIT 1`,
    [vendorId]
  );
  if (result.rows.length > 0) return true;
  const identity = await query(
    `SELECT 1
     FROM vendor_identity vi
     INNER JOIN role_permissions rp ON rp.role_id = vi.selected_role_id
     WHERE vi.id = $1::uuid AND rp.permission_name = 'events'
     LIMIT 1`,
    [vendorId]
  );
  return identity.rows.length > 0;
}
