/**
 * Support ticket classification and booking/payment context for CRM refunds.
 */

import { query, select } from '../../database/rds-connection';
import { resolveBookingPaymentSources } from '../../utils/payments/booking-payment-sources';

export type SupportTicketType = 'general' | 'booking';

export type BookingSnapshot = {
  id: string;
  status: string;
  serviceName?: string;
  serviceStyle?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  amount?: number;
  vendorId?: string;
  vendorName?: string;
  paymentStatus?: string;
};

export type PaymentSnapshot = {
  paymentId?: string;
  totalPaid: number;
  walletPaid: number;
  gatewayPaid: number;
  refundedSoFar: number;
  refundableBalance: number;
  paymentMethod?: string;
  razorpayPaymentId?: string;
  paymentStatus?: string;
  hasGatewayPayment: boolean;
};

export type SupportTicketEnrichment = {
  ticketType: SupportTicketType;
  bookingContext: BookingSnapshot | null;
  paymentContext: PaymentSnapshot | null;
  isRefundable: boolean;
  refundBlockReason?: string;
};

export function deriveTicketType(row: { booking_id?: string | null; metadata?: unknown }): SupportTicketType {
  if (row.booking_id) return 'booking';
  const meta = row.metadata as Record<string, unknown> | undefined;
  if (meta?.ticket_type === 'booking') return 'booking';
  return 'general';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function validateBookingTicketLink(
  bookingId: string,
  customerId?: string | null
): Promise<{ booking: Record<string, unknown>; vendorId: string | null; resolvedCustomerId: string }> {
  if (!bookingId?.trim()) {
    throw new Error('bookingId is required for booking-related tickets');
  }

  const bookings = await select('bookings', { id: bookingId });
  if (bookings.length === 0) {
    throw new Error('Booking not found');
  }

  const booking = bookings[0] as Record<string, unknown>;
  const bookingCustomerId = booking.customer_id ? String(booking.customer_id) : null;

  if (!bookingCustomerId) {
    throw new Error('Booking has no linked customer');
  }

  if (customerId && String(customerId) !== bookingCustomerId) {
    throw new Error('Customer does not match this booking');
  }

  const vendorId = booking.vendor_id ? String(booking.vendor_id) : null;
  return { booking, vendorId, resolvedCustomerId: bookingCustomerId };
}

export async function buildBookingSnapshot(bookingId: string): Promise<BookingSnapshot | null> {
  try {
    const res = await query(
      `SELECT b.id::text, b.status, b.booking_date, b.booking_time, b.total_amount::text,
              b.payment_status, b.service_style, b.service_type, b.vendor_id::text,
              COALESCE(s.name, b.service_type) AS service_name,
              v.business_name AS vendor_name
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN vendors v ON b.vendor_id = v.id
       WHERE b.id = $1::uuid
       LIMIT 1`,
      [bookingId]
    );
    const row = (res as { rows?: Record<string, unknown>[] }).rows?.[0];
    if (!row?.id) return null;

    return {
      id: String(row.id),
      status: String(row.status ?? ''),
      serviceName: row.service_name ? String(row.service_name) : undefined,
      serviceStyle: row.service_style ? String(row.service_style) : undefined,
      scheduledDate: row.booking_date ? String(row.booking_date) : undefined,
      scheduledTime: row.booking_time ? String(row.booking_time) : undefined,
      amount: parseFloat(String(row.total_amount ?? '0')) || 0,
      vendorId: row.vendor_id ? String(row.vendor_id) : undefined,
      vendorName: row.vendor_name ? String(row.vendor_name) : undefined,
      paymentStatus: row.payment_status ? String(row.payment_status) : undefined,
    };
  } catch (err) {
    console.warn('[support-ticket-helpers] buildBookingSnapshot failed:', err);
    return null;
  }
}

export async function buildPaymentSnapshot(bookingId: string): Promise<PaymentSnapshot | null> {
  try {
    const payRes = await query(
    `SELECT id::text, amount::text, payment_method, payment_status, razorpay_payment_id
     FROM payments
     WHERE booking_id = $1::uuid
       AND payment_status IN ('completed', 'partially_refunded')
     ORDER BY CASE WHEN payment_status = 'completed' THEN 0 ELSE 1 END, created_at DESC
     LIMIT 1`,
    [bookingId]
  );
  const payment = (payRes as { rows?: Record<string, unknown>[] }).rows?.[0];

  const sources = await resolveBookingPaymentSources(bookingId);
  const walletPaid = round2(
    sources.filter((s) => s.method === 'wallet').reduce((a, s) => a + s.amount, 0)
  );
  const gatewayPaid = round2(
    sources.filter((s) => s.method !== 'wallet').reduce((a, s) => a + s.amount, 0)
  );
  const totalPaid = round2(walletPaid + gatewayPaid);

  if (!payment?.id && totalPaid <= 0.009) {
    return null;
  }

  let refundedSoFar = 0;
  if (payment?.id) {
    const refRes = await query(
      `SELECT COALESCE(SUM(refund_amount), 0)::text AS total
       FROM refunds
       WHERE payment_id = $1::uuid
         AND refund_status IN ('completed', 'processing', 'approved', 'processed')`,
      [String(payment.id)]
    );
    refundedSoFar = parseFloat(String((refRes as { rows?: { total?: string }[] }).rows?.[0]?.total ?? '0')) || 0;
  }

  const paymentAmount = payment?.amount ? parseFloat(String(payment.amount)) : totalPaid;
  const refundableBalance = round2(Math.max(0, paymentAmount - refundedSoFar));
  const hasGatewayPayment = gatewayPaid > 0.009 && !!payment?.razorpay_payment_id;

  return {
    paymentId: payment?.id ? String(payment.id) : undefined,
    totalPaid: round2(totalPaid || paymentAmount),
    walletPaid,
    gatewayPaid,
    refundedSoFar: round2(refundedSoFar),
    refundableBalance,
    paymentMethod: payment?.payment_method ? String(payment.payment_method) : undefined,
    razorpayPaymentId: payment?.razorpay_payment_id ? String(payment.razorpay_payment_id) : undefined,
    paymentStatus: payment?.payment_status ? String(payment.payment_status) : undefined,
    hasGatewayPayment,
  };
  } catch (err) {
    console.warn('[support-ticket-helpers] buildPaymentSnapshot failed:', err);
    return null;
  }
}

export async function enrichSupportTicket(row: Record<string, unknown>): Promise<SupportTicketEnrichment> {
  try {
    const ticketType = deriveTicketType(row as { booking_id?: string | null; metadata?: unknown });
    const bookingId = row.booking_id ? String(row.booking_id) : null;

    if (ticketType !== 'booking' || !bookingId) {
      return {
        ticketType: 'general',
        bookingContext: null,
        paymentContext: null,
        isRefundable: false,
        refundBlockReason: 'General tickets are not linked to a booking. Attach a booking to process refunds.',
      };
    }

    const bookingContext = await buildBookingSnapshot(bookingId);
    const paymentContext = await buildPaymentSnapshot(bookingId);
    const hasCustomer = !!row.customer_id;

    if (!hasCustomer) {
      return {
        ticketType: 'booking',
        bookingContext,
        paymentContext,
        isRefundable: false,
        refundBlockReason: 'Ticket is missing customer_id.',
      };
    }

    if (!paymentContext || paymentContext.refundableBalance <= 0.009) {
      return {
        ticketType: 'booking',
        bookingContext,
        paymentContext,
        isRefundable: false,
        refundBlockReason: 'No completed payment with refundable balance for this booking.',
      };
    }

    return {
      ticketType: 'booking',
      bookingContext,
      paymentContext,
      isRefundable: true,
    };
  } catch (err) {
    console.warn('[support-ticket-helpers] enrichSupportTicket failed:', err);
    return {
      ticketType: deriveTicketType(row as { booking_id?: string | null; metadata?: unknown }),
      bookingContext: null,
      paymentContext: null,
      isRefundable: false,
      refundBlockReason: 'Could not load booking payment context.',
    };
  }
}

export type CustomerProfile = {
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

export async function resolveCustomerProfile(ticket: {
  customer_id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  booking_id?: string | null;
}): Promise<CustomerProfile> {
  let name = ticket.customer_name?.trim() || null;
  let email = ticket.customer_email?.trim() || null;
  let phone = ticket.customer_phone?.trim() || null;

  const applyRow = (row: Record<string, unknown> | undefined) => {
    if (!row) return;
    if (!name && row.full_name) name = String(row.full_name).trim();
    if (!email && row.email) email = String(row.email).trim();
    if (!phone && row.phone) phone = String(row.phone).trim();
  };

  if (ticket.customer_id && (!name || !email || !phone)) {
    try {
      const res = await query(
        `SELECT full_name, email, phone FROM customers WHERE id = $1::uuid LIMIT 1`,
        [ticket.customer_id]
      );
      applyRow(res.rows?.[0] as Record<string, unknown> | undefined);
    } catch {
      /* ignore */
    }
  }

  if (!name && phone) {
    try {
      const res = await query(
        `SELECT full_name, email, phone FROM customers WHERE phone = $1 LIMIT 1`,
        [phone]
      );
      applyRow(res.rows?.[0] as Record<string, unknown> | undefined);
    } catch {
      /* ignore */
    }
  }

  if (!name && ticket.booking_id) {
    try {
      const res = await query(
        `SELECT c.full_name, c.email, c.phone
         FROM bookings b
         JOIN customers c ON b.customer_id = c.id
         WHERE b.id = $1::uuid
         LIMIT 1`,
        [ticket.booking_id]
      );
      applyRow(res.rows?.[0] as Record<string, unknown> | undefined);
    } catch {
      /* ignore */
    }
  }

  return { customerName: name, customerEmail: email, customerPhone: phone };
}

export function mapTicketForCrmList(t: Record<string, unknown>, enrichment?: SupportTicketEnrichment) {
  const meta = (t.metadata as Record<string, unknown> | undefined) ?? {};
  const refundMeta = meta.refund_result as Record<string, unknown> | undefined;
  const ticketType = enrichment?.ticketType ?? deriveTicketType(t as { booking_id?: string | null; metadata?: unknown });

  return {
    id: String(t.id || ''),
    customerId: t.customer_id ? String(t.customer_id) : '',
    subject: String(t.subject || ''),
    description: String(t.message || t.description || ''),
    status: String(t.status || 'open'),
    priority: String(t.priority || 'medium'),
    source: String(t.source || 'customer'),
    createdAt: String(t.created_at || ''),
    assignedTo: t.assigned_agent_id ? String(t.assigned_agent_id) : undefined,
    assignedAgent: t.assigned_agent_name || undefined,
    category: t.category || undefined,
    customerName: t.customer_name || '',
    customerEmail: t.customer_email || '',
    ticketType,
    bookingId: t.booking_id ? String(t.booking_id) : undefined,
    vendorId: t.vendor_id ? String(t.vendor_id) : undefined,
    isRefundable: enrichment?.isRefundable ?? false,
    refundBlockReason: enrichment?.refundBlockReason,
    bookingSummary: enrichment?.bookingContext
      ? {
          serviceName: enrichment.bookingContext.serviceName,
          status: enrichment.bookingContext.status,
          amount: enrichment.bookingContext.amount,
          scheduledDate: enrichment.bookingContext.scheduledDate,
        }
      : undefined,
    refundableBalance: enrichment?.paymentContext?.refundableBalance,
    refundRequested: meta.refund_requested === true,
    refundStatus:
      (t.refund_status as string | undefined) ||
      (refundMeta?.status as string | undefined) ||
      undefined,
  };
}
