import { randomUUID } from 'crypto';
import { query, select, insert, update } from '../database/rds-connection';
import { triggerBookingNotification } from '../endpoints/sms-notifications';
import { sendVendorAppointmentScheduledSms } from '../lib/vendor-appointment-sms';
import { sendEventNotification } from '../aws/aws-sns-notification-service';
import { dispatchNotification } from './notification-dispatch';
import { WAPPT_BOOKING_MODE } from '../endpoints/warmpawz-appointments/shared/wappt-booking-preflight';
import { resolveBookingNotificationServiceName } from '../endpoints/warmpawz-appointments/shared/vendor-booking-display';
export { resolveBookingNotificationServiceName } from '../endpoints/warmpawz-appointments/shared/vendor-booking-display';
import {
  formatIstBookingWhen,
  enrichTemplateDataWithIstDisplay,
} from './notification-display-format';

type BookingNotificationResult = {
  notified: boolean;
  bookingId?: string;
};

function buildServiceTypeLabel(serviceType?: string): string {
  if (serviceType === 'at_home') return 'Home visit';
  if (serviceType === 'tele') return 'Tele consultation';
  return 'At center';
}

async function loadBookingContext(bookingId: string) {
  const bookings = await select('bookings', { id: bookingId });
  if (bookings.length === 0) return null;

  const booking = bookings[0];
  const isWapptBooking =
    String(booking.commerce_mode || '').toLowerCase() === WAPPT_BOOKING_MODE;

  const [customers, vendors] = await Promise.all([
    booking.customer_id ? select('customers', { id: booking.customer_id }).catch(() => []) : Promise.resolve([]),
    booking.vendor_id ? select('vendors', { id: booking.vendor_id }).catch(() => []) : Promise.resolve([]),
  ]);

  let service: { name?: string } | null = null;
  if (!isWapptBooking && booking.service_id) {
    const serviceResult = await query(
      `SELECT COALESCE(s.name, vs.service_name, sc.service_name, sc.display_name) as name
       FROM (SELECT $1::uuid as id) x
       LEFT JOIN services s ON s.id = x.id
       LEFT JOIN vendor_services vs ON vs.id = x.id
       LEFT JOIN service_catalog sc ON sc.id = x.id
       LIMIT 1`,
      [booking.service_id]
    ).catch(() => ({ rows: [] }));
    if (serviceResult.rows?.length > 0) {
      service = { name: serviceResult.rows[0].name || 'Service' };
    }
  }

  const customer = customers[0] || null;
  const vendor = vendors[0] || null;
  const customerName = (customer as any)?.name || (customer as any)?.full_name || 'Customer';
  const vendorName = (vendor as any)?.business_name || (vendor as any)?.name || 'Provider';
  const serviceName = resolveBookingNotificationServiceName(
    booking as Record<string, unknown>,
    service?.name,
  );
  const serviceTypeLabel = buildServiceTypeLabel(booking.service_type);

  return {
    booking,
    customer,
    vendor,
    customerName,
    vendorName,
    serviceName,
    serviceTypeLabel,
  };
}

async function activateTeleChatOnBookingCreated(booking: Record<string, unknown>): Promise<void> {
  if (String(booking.service_type || '') !== 'tele') return;
  const bookingId = String(booking.id);
  await update('bookings', { id: bookingId }, {
    chat_activated_at: new Date().toISOString(),
    chat_auto_activated: true,
  }).catch(() => undefined);
  await insert('chat_messages', {
    booking_id: bookingId,
    sender_type: 'system',
    message:
      'Chat is open for your video consultation. You can message each other before the call.',
    is_read: false,
    created_at: new Date(),
  }).catch(() => undefined);
}

export async function notifyBookingCreated(bookingId: string, requestId?: string): Promise<BookingNotificationResult> {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx) return { notified: false };

  const { booking, customer, vendor, customerName, vendorName, serviceName, serviceTypeLabel } = ctx;
  const whenDisplay = formatIstBookingWhen(
    String(booking.booking_date || ''),
    String(booking.booking_time || '')
  );

  if (booking.vendor_id) {
    await dispatchNotification({
      recipientId: String(booking.vendor_id),
      recipientType: 'vendor',
      notificationType: 'new_booking',
      title: 'New appointment',
      message: `${customerName} booked ${serviceName} • ${serviceTypeLabel} • ${whenDisplay}`,
      channels: { inApp: true, push: true },
      priority: 'high',
      data: {
        bookingId: booking.id,
        customerId: booking.customer_id,
        customerName,
        serviceName,
        serviceType: booking.service_type,
        bookingDate: booking.booking_date,
        bookingTime: booking.booking_time,
        address: booking.address,
        dedupeKey: `booking-${booking.id}-created-vendor`,
      },
    });
  }

  if (booking.customer_id) {
    await sendEventNotification({
      eventType: 'booking_created',
      recipientId: String(booking.customer_id),
      recipientType: 'customer',
      relatedId: booking.id,
      data: enrichTemplateDataWithIstDisplay({
        vendorName,
        date: booking.booking_date,
        time: booking.booking_time,
        serviceName,
        bookingId: booking.id,
        dedupeKey: `booking-${booking.id}-created-customer`,
      }),
    });
  }

  triggerBookingNotification('booking_created', {
    booking,
    customer,
    vendor,
    service: { name: serviceName },
  }).catch((smsErr) => {
    console.warn('[SMS] Booking confirmation SMS failed:', smsErr?.message || smsErr);
  });

  void sendVendorAppointmentScheduledSms({
    vendorId: booking.vendor_id,
    bookingId: booking.id,
    bookingDate: booking.booking_date,
    bookingTime: booking.booking_time,
    vendor,
  }).catch((smsErr) => {
    console.warn('[SMS] Vendor appointment SMS failed:', smsErr?.message || smsErr);
  });

  try {
    const { publishBookingCreated } = await import('./sns-client');
    await publishBookingCreated({
      bookingId: booking.id,
      customerId: booking.customer_id,
      vendorId: booking.vendor_id,
      serviceType: booking.service_type,
      status: booking.status,
      bookingDate: booking.booking_date,
      bookingTime: booking.booking_time,
      eventTimestamp: new Date().toISOString(),
      eventId: randomUUID(),
      requestId: requestId || randomUUID(),
      sourceService: 'booking-notifier',
    } as Parameters<typeof publishBookingCreated>[0]);
  } catch (error) {
    console.error('Failed to publish booking created event:', error);
  }

  await activateTeleChatOnBookingCreated(booking as Record<string, unknown>);

  return { notified: true, bookingId: booking.id };
}

export async function notifyBookingCancelled(params: {
  bookingId: string;
  vendorId: string;
  customerId: string;
  customerName: string;
  serviceName: string;
  serviceTypeLabel: string;
  bookingDateDisplay: string;
  bookingTimeDisplay: string;
  reason: string;
  refundInfo?: unknown;
}): Promise<void> {
  const whenPart =
    `${params.bookingDateDisplay ? ` on ${params.bookingDateDisplay}` : ''}` +
    `${params.bookingTimeDisplay ? ` at ${params.bookingTimeDisplay}` : ''}`;

  await dispatchNotification({
    recipientId: params.vendorId,
    recipientType: 'vendor',
    notificationType: 'booking_cancelled',
    title: 'Booking Cancelled',
    message: `${params.customerName} cancelled their ${params.serviceTypeLabel} booking${whenPart}. Reason: ${params.reason}`,
    channels: { inApp: true, push: true },
    data: {
      bookingId: params.bookingId,
      customerId: params.customerId,
      customerName: params.customerName,
      cancellationReason: params.reason,
      refundInfo: params.refundInfo,
      dedupeKey: `booking-${params.bookingId}-cancelled-vendor`,
    },
  });

  await sendEventNotification({
    eventType: 'booking_cancelled',
    recipientId: params.customerId,
    recipientType: 'customer',
    relatedId: params.bookingId,
    data: {
      serviceName: params.serviceName,
      bookingId: params.bookingId,
      reason: params.reason,
      dedupeKey: `booking-${params.bookingId}-cancelled-customer`,
    },
  });
}

/**
 * Provider cancelled/declined a booking: notify the customer (in-app + push + SMS).
 * Does not notify the vendor (they initiated the cancel).
 */
export async function notifyBookingCancelledByVendor(params: {
  bookingId: string;
  reason?: string;
  refundInfo?: unknown;
}): Promise<BookingNotificationResult> {
  const ctx = await loadBookingContext(params.bookingId);
  if (!ctx?.booking?.customer_id) return { notified: false, bookingId: params.bookingId };

  const { booking, customer, vendor, vendorName, serviceName } = ctx;
  const customerId = String(booking.customer_id);
  const reason = String(params.reason || booking.cancellation_reason || '').trim();
  const whenDisplay = formatIstBookingWhen(
    String(booking.booking_date || ''),
    String(booking.booking_time || '')
  );

  const message = reason
    ? `Your booking for ${serviceName} with ${vendorName}${whenDisplay ? ` (${whenDisplay})` : ''} was cancelled by the provider. ${reason}`
    : `Your booking for ${serviceName} with ${vendorName}${whenDisplay ? ` (${whenDisplay})` : ''} has been cancelled. Refund will be processed shortly.`;

  await dispatchNotification({
    recipientId: customerId,
    recipientType: 'customer',
    notificationType: 'booking_cancelled',
    title: 'Booking Cancelled',
    message,
    channels: { inApp: true, push: true },
    priority: 'high',
    data: {
      bookingId: booking.id,
      vendorId: booking.vendor_id,
      vendorName,
      serviceName,
      cancellationReason: reason || null,
      cancelledBy: 'provider',
      refundInfo: params.refundInfo,
      dedupeKey: `booking-${booking.id}-cancelled-by-vendor-customer`,
    },
  });

  // Approved Jio DLT template: booking_cancelled
  triggerBookingNotification('booking_cancelled', {
    booking,
    customer,
    vendor,
    service: { name: serviceName },
  }).catch((smsErr) => {
    console.warn(
      '[SMS] Vendor-cancel booking SMS failed:',
      smsErr?.message || smsErr
    );
  });

  return { notified: true, bookingId: String(booking.id) };
}

export async function notifyBookingRescheduled(params: {
  bookingId: string;
  vendorId: string;
  customerId: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  reason: string;
}): Promise<void> {
  await sendEventNotification({
    eventType: 'booking_rescheduled',
    recipientId: params.vendorId,
    recipientType: 'vendor',
    relatedId: params.bookingId,
    data: enrichTemplateDataWithIstDisplay({
      oldDate: params.oldDate,
      oldTime: params.oldTime,
      newDate: params.newDate,
      newTime: params.newTime,
      reason: params.reason,
      bookingId: params.bookingId,
      customerId: params.customerId,
      dedupeKey: `booking-${params.bookingId}-rescheduled-vendor`,
    }),
  });

  await dispatchNotification({
    recipientId: params.customerId,
    recipientType: 'customer',
    notificationType: 'booking_rescheduled',
    title: 'Booking Rescheduled',
    message: `Your appointment has been moved to ${formatIstBookingWhen(params.newDate, params.newTime)}.`,
    channels: { inApp: true, push: true },
    data: {
      bookingId: params.bookingId,
      oldDate: params.oldDate,
      oldTime: params.oldTime,
      newDate: params.newDate,
      newTime: params.newTime,
      reason: params.reason,
      dedupeKey: `booking-${params.bookingId}-rescheduled-customer`,
    },
  });
}

/** Start OTP push/in-app disabled — event-only notification surface (no cron). */
export async function notifyBookingStartOtp(_params: {
  bookingId: string;
  customerId: string;
  vendorName: string;
  serviceName: string;
  otp: string;
}): Promise<{ sent: boolean }> {
  return { sent: false };
}
