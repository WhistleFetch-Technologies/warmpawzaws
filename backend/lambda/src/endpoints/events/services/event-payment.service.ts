import { randomBytes } from 'crypto';
import type { Context } from 'hono';
import { withTransaction } from '../../../database/rds-connection';
import { razorpayRequest } from '../../../utils/payments/razorpay-client';
import { processRefund } from '../../../utils/payments/refund-service';
import {
  dbActivateTicketTokens,
  dbInvalidateTicketTokens,
  dbListTicketsForRegistration,
} from '../repos/event-tickets.repo';
import {
  dbAttachRazorpayOrder,
  dbFindCompletedEventPayment,
  dbFindPendingEventPayment,
  dbInsertEventPayment,
  dbSelectPaymentById,
} from '../repos/event-payments.repo';
import {
  dbIncrementAttendees,
  dbSelectEventById,
} from '../repos/events.repo';
import {
  dbLockRegistration,
  dbSelectRegistrationById,
  dbUpdateRegistration,
} from '../repos/event-registrations.repo';
import { executeResolveCustomerId } from './event-auth.service';
import { notifyEventCustomer } from './event-notifications.service';

export async function fulfillEventRegistrationPayment(paymentId: string): Promise<void> {
  await withTransaction(async (client) => {
    const payment = await client.query(`SELECT * FROM payments WHERE id = $1::uuid FOR UPDATE`, [paymentId]);
    const row = payment.rows[0];
    if (!row || String(row.payment_source) !== 'event' || !row.event_registration_id) return;
    const registration = await dbLockRegistration(client, String(row.event_registration_id));
    if (!registration) return;
    if (registration.payment_status === 'paid' || registration.payment_status === 'waived') return;
    if (registration.status === 'cancelled') return;

    const tickets = await client.query(
      `SELECT id, qr_token FROM event_registration_tickets WHERE registration_id = $1::uuid FOR UPDATE`,
      [registration.id]
    );
    const tokens = tickets.rows.map((ticket: { id: string; qr_token: string | null }) => ({
      id: String(ticket.id),
      qr_token: ticket.qr_token || randomBytes(32).toString('hex'),
    }));
    await dbActivateTicketTokens(client, tokens);
    await dbUpdateRegistration(client, String(registration.id), {
      payment_status: 'paid',
      payment_id: paymentId,
      status: 'confirmed',
      transaction_id: row.razorpay_payment_id || null,
    });
  });

  const registration = await dbSelectRegistrationById(
    String((await dbSelectPaymentById(paymentId))?.event_registration_id || '')
  );
  if (registration?.customer_id) {
    await notifyEventCustomer({
      customerId: String(registration.customer_id),
      type: 'event_payment_success',
      title: 'Event tickets ready',
      message: `Payment confirmed for ${registration.event_name || 'your event'}. Your QR tickets are available.`,
      registrationId: String(registration.id),
      eventId: String(registration.event_id),
    });
  }
}

export async function executeCreateEventPayment(c: Context) {
  const customerId = await executeResolveCustomerId(c);
  if (!customerId) return c.json({ error: 'Authentication required' }, 401);
  try {
    const registrationId = c.req.param('registrationId');
    const registration = await dbSelectRegistrationById(registrationId);
    if (!registration || String(registration.customer_id) !== customerId) {
      return c.json({ error: 'Registration not found' }, 404);
    }
    if (registration.payment_status === 'paid' || registration.payment_status === 'waived') {
      return c.json({ success: true, alreadyPaid: true, registrationId });
    }
    if (registration.status === 'cancelled') {
      return c.json({ error: 'Registration is cancelled' }, 400);
    }
    const amount = Number(registration.payment_amount || 0);
    if (amount <= 0) return c.json({ error: 'Registration does not require payment' }, 400);

    const existing = await dbFindPendingEventPayment(registrationId);
    let payment = existing;
    if (!payment) {
      payment = await withTransaction(async (client) => {
        return dbInsertEventPayment(client, {
          customer_id: customerId,
          vendor_id: registration.vendor_id ? String(registration.vendor_id) : null,
          amount,
          event_registration_id: registrationId,
          idempotency_key: `event-${registrationId}`,
        });
      });
    }

    let razorpayOrderId = payment.razorpay_order_id ? String(payment.razorpay_order_id) : '';
    if (!razorpayOrderId) {
      const order = (await razorpayRequest('/orders', 'POST', {
        amount: Math.round(amount * 100),
        currency: 'INR',
        receipt: `evt_${String(payment.id).replace(/-/g, '')}`.slice(0, 40),
        notes: { event_registration_id: registrationId, payment_source: 'event' },
      })) as { id?: string };
      razorpayOrderId = String(order.id || '');
      if (razorpayOrderId) {
        await withTransaction(async (client) => {
          await dbAttachRazorpayOrder(client, String(payment!.id), razorpayOrderId);
        });
      }
    }

    const { getRazorpayConfig } = await import('../../../utils/payments/razorpay-client');
    const razorpayConfig = await getRazorpayConfig();
    return c.json({
      success: true,
      paymentId: payment.id,
      razorpayOrderId,
      razorpayKeyId: razorpayConfig.keyId,
      amount,
      currency: 'INR',
      payment_source: 'event',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeVerifyEventPayment(c: Context) {
  const customerId = await executeResolveCustomerId(c);
  if (!customerId) return c.json({ error: 'Authentication required' }, 401);
  try {
    const registrationId = c.req.param('registrationId');
    const body = await c.req.json();
    const registration = await dbSelectRegistrationById(registrationId);
    if (!registration || String(registration.customer_id) !== customerId) {
      return c.json({ error: 'Registration not found' }, 404);
    }
    const payment = await dbFindPendingEventPayment(registrationId);
    if (!payment && (await dbFindCompletedEventPayment(registrationId))) {
      return c.json({ success: true, alreadyPaid: true });
    }
    if (!payment) return c.json({ error: 'Payment not found' }, 404);

    const { finalizeCapturedPayment } = await import('../../../utils/payments/finalize-captured-payment');
    await finalizeCapturedPayment({
      source: 'customer_verify',
      razorpayOrderId: body.razorpay_order_id || payment.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      paymentRowId: String(payment.id),
    });
    await fulfillEventRegistrationPayment(String(payment.id));
    const updated = await dbSelectRegistrationById(registrationId);
    const tickets = await dbListTicketsForRegistration(registrationId);
    return c.json({ success: true, registration: updated, tickets });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeCancelRegistration(c: Context) {
  const customerId = await executeResolveCustomerId(c);
  if (!customerId) return c.json({ error: 'Authentication required' }, 401);
  try {
    const registrationId = c.req.param('registrationId');
    const registration = await dbSelectRegistrationById(registrationId);
    if (!registration || String(registration.customer_id) !== customerId) {
      return c.json({ error: 'Registration not found' }, 404);
    }
    if (registration.status === 'cancelled') {
      return c.json({ success: true, alreadyCancelled: true });
    }

    const ticketCount = Number(registration.number_of_people || 1);
    await withTransaction(async (client) => {
      const locked = await dbLockRegistration(client, registrationId);
      if (!locked || locked.status === 'cancelled') return;
      await dbInvalidateTicketTokens(client, registrationId);
      await dbUpdateRegistration(client, registrationId, { status: 'cancelled' });
      await dbIncrementAttendees(client, String(locked.event_id), -ticketCount);
    });

    const payment = await dbFindCompletedEventPayment(registrationId);
    let refund = null;
    if (payment && Number(registration.payment_amount || 0) > 0) {
      refund = await processRefund({
        paymentId: String(payment.id),
        amount: Number(payment.amount || registration.payment_amount || 0),
        reason: 'Event registration cancelled by customer',
        initiatedBy: 'customer',
        customerId,
        vendorId: registration.vendor_id ? String(registration.vendor_id) : undefined,
      });
      await withTransaction(async (client) => {
        await dbUpdateRegistration(client, registrationId, { payment_status: 'refunded' });
      });
    }

    await notifyEventCustomer({
      customerId,
      type: refund ? 'event_refund' : 'event_cancelled',
      title: refund ? 'Event refund initiated' : 'Event registration cancelled',
      message: refund
        ? 'Your Event registration was cancelled and a refund has been initiated.'
        : 'Your Event registration was cancelled.',
      registrationId,
      eventId: String(registration.event_id),
    });

    return c.json({ success: true, refund, message: 'Registration cancelled' });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
}

export async function executeEventPaymentRefundWithoutBooking(input: {
  paymentId: string;
  amount: number;
  reason: string;
  customerId: string;
  vendorId?: string;
}) {
  return processRefund({
    paymentId: input.paymentId,
    amount: input.amount,
    reason: input.reason,
    initiatedBy: 'system',
    customerId: input.customerId,
    vendorId: input.vendorId,
  });
}
