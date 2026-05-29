import { randomUUID } from 'crypto';
import { insert, query, select } from '../database/rds-connection';
import { triggerBookingNotification } from '../endpoints/sms-notifications';
import { sendVendorAppointmentScheduledSms } from '../lib/vendor-appointment-sms';

type BookingNotificationResult = {
  notified: boolean;
  bookingId?: string;
};

function buildServiceTypeLabel(serviceType?: string): string {
  if (serviceType === 'at_home') return 'Home visit';
  if (serviceType === 'tele') return 'Tele consultation';
  return 'At center';
}

export async function notifyBookingCreated(bookingId: string, requestId?: string): Promise<BookingNotificationResult> {
  const bookings = await select('bookings', { id: bookingId });
  if (bookings.length === 0) {
    return { notified: false };
  }

  const booking = bookings[0];

  const [customers, vendors] = await Promise.all([
    booking.customer_id ? select('customers', { id: booking.customer_id }).catch(() => []) : Promise.resolve([]),
    booking.vendor_id ? select('vendors', { id: booking.vendor_id }).catch(() => []) : Promise.resolve([]),
  ]);

  const customer = customers[0] || null;
  const vendor = vendors[0] || null;

  let service: { name?: string } | null = null;
  if (booking.service_id) {
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

  const customerName = (customer as any)?.name || (customer as any)?.full_name || 'Customer';
  const serviceName = service?.name || 'Service';
  const serviceTypeLabel = buildServiceTypeLabel(booking.service_type);

  // ✅ FIX: Use notification_type instead of type (schema column name)
  await insert('notifications', {
    recipient_id: booking.vendor_id,
    recipient_type: 'vendor',
    notification_type: 'new_booking', // ✅ FIX: Changed from 'type' to 'notification_type'
    title: 'New appointment',
    message: `${customerName} booked ${serviceName} • ${serviceTypeLabel} • ${booking.booking_date} ${booking.booking_time}`,
    channels: { email: false, sms: false, inApp: true, push: false }, // ✅ FIX: Added required channels field
    data: JSON.stringify({
      bookingId: booking.id,
      customerId: booking.customer_id,
      customerName,
      serviceName,
      serviceType: booking.service_type,
      bookingDate: booking.booking_date,
      bookingTime: booking.booking_time,
      address: booking.address,
    }),
    is_read: false,
    created_at: new Date(),
  });

  triggerBookingNotification('booking_created', {
    booking,
    customer,
    vendor,
    service,
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
    });
  } catch (error) {
    console.error('Failed to publish booking created event:', error);
  }

  return { notified: true, bookingId: booking.id };
}
