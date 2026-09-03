/**
 * Publishes ActionOccurred for vendor referral first-booking rewards when the booking
 * becomes confirmed outside PUT /bookings/:id/status (e.g. Razorpay verify / webhook / package create).
 */
import { randomUUID } from 'crypto';
import { query } from '../../database/rds-connection';
import { CUSTOMER_LOYALTY_EARN_AND_REDEEM_DISABLED } from './loyalty&reward/loyalty-points-service';

export async function publishVendorReferralBookingConfirmedAction(bookingId: string): Promise<void> {
  if (!bookingId) return;
  if (CUSTOMER_LOYALTY_EARN_AND_REDEEM_DISABLED) {
    console.info('[LOYALTY-ACTION] skip vendor_refer_friend_who_joins: customer loyalty paused', { bookingId });
    return;
  }

  const res = await query(`SELECT customer_id FROM bookings WHERE id = $1 LIMIT 1`, [bookingId]);
  const customerId = res.rows?.[0]?.customer_id as string | undefined;
  if (!customerId) {
    console.warn('[LOYALTY-ACTION] skip vendor_refer_friend_who_joins: no customer on booking', { bookingId });
    return;
  }

  try {
    const { EventBridgeClient, PutEventsCommand } = await import('@aws-sdk/client-eventbridge');
    const eb = new EventBridgeClient({});
    const evt = {
      eventId: randomUUID(),
      eventType: 'ActionOccurred' as const,
      occurredAt: new Date().toISOString(),
      actionName: 'vendor_refer_friend_who_joins',
      entity: { type: 'customer' as const, id: String(customerId) },
      actor: { type: 'customer' as const, id: String(customerId) },
      reference: { type: 'booking', id: bookingId },
    };
    const bus = process.env.EVENT_BUS_NAME || 'default';
    const out = await eb.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'app.warmpawz',
            DetailType: 'ActionOccurred',
            Detail: JSON.stringify(evt),
            EventBusName: bus,
          },
        ],
      })
    );
    const ent = out.Entries?.[0];
    if ((out.FailedEntryCount ?? 0) > 0 || ent?.ErrorCode) {
      console.warn('[LOYALTY-ACTION] PutEvents rejected', {
        bus,
        bookingId,
        errorCode: ent?.ErrorCode,
        errorMessage: ent?.ErrorMessage,
      });
    } else {
      console.info('[LOYALTY-ACTION] PutEvents ok vendor_refer_friend_who_joins', {
        bus,
        bookingId,
        customerId,
        awsEventId: ent?.EventId,
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[LOYALTY-ACTION] publish failed (non-blocking):', msg);
  }
}
