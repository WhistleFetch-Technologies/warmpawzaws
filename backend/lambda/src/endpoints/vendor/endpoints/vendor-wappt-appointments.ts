import type { Hono } from 'hono';
import { update } from '../../../database/rds-connection';
import {
  applyRefundAfterProviderCancellation,
  parseVendorCancellationReason,
  vendorCancellationReasonLabel,
} from '../../../lib/services/provider-booking-cancel-refund';
import { previewProviderCancellationRefund } from '../../../lib/services/cancellation-policy-service';
import { assertWapptBookingEligible } from '../../warmpawz-appointments/shared/wappt-booking-cancel.service';
import {
  dbFetchWapptPolicyTiersForCategory,
  dbLoadBookingForVendor,
  rowToBookingForPolicy,
} from '../../customer/warmpawz-appointments/repos/wappt_booking_policy.repo';
import { notifyBookingCancelledByVendor } from '../../../utils/booking-notifications';

export function registerVendorWapptAppointmentsEndpoints(app: Hono): void {
  app.get('/vendor/warmpawz-appointments/policies', async (c) => {
    const category = c.req.query('category') ?? undefined;
    const data = await dbFetchWapptPolicyTiersForCategory(category);
    return c.json({ success: true, ...data });
  });

  app.get('/vendor/warmpawz-appointments/bookings/:bookingId/cancellation-policy', async (c) => {
    const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');
    if (!vendorId) return c.json({ success: false, error: 'vendorId required' }, 400);
    const bookingId = c.req.param('bookingId');
    const row = await dbLoadBookingForVendor(bookingId, String(vendorId));
    if (!row) return c.json({ success: false, error: 'Booking not found' }, 404);
    try {
      assertWapptBookingEligible(row);
    } catch (e: any) {
      return c.json({ success: false, error: e.message, useMarketplaceApi: true }, e.status ?? 409);
    }
    const reason = c.req.query('vendorCancellationReason') ?? 'operational';
    const preview = await previewProviderCancellationRefund(
      rowToBookingForPolicy(row),
      String(reason),
    );
    const policyMeta = await dbFetchWapptPolicyTiersForCategory(String(row.service_category ?? ''));
    return c.json({ success: true, bookingId, policyScope: policyMeta.policyScope, tiers: policyMeta.tiers, refundPreview: preview });
  });

  app.post('/vendor/warmpawz-appointments/bookings/:bookingId/cancel', async (c) => {
    try {
      const { bookingId } = c.req.param();
      const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');
      if (!vendorId) return c.json({ success: false, error: 'vendorId required' }, 400);
      const body = await c.req.json().catch(() => ({}));
      const vendorCancellationReason = parseVendorCancellationReason(
        body.vendorCancellationReason ?? body.vendor_cancellation_reason,
      );
      if (!vendorCancellationReason) {
        return c.json(
          {
            success: false,
            error:
              'vendorCancellationReason is required (emergency, operational, technical).',
          },
          400,
        );
      }

      const row = await dbLoadBookingForVendor(bookingId, String(vendorId));
      if (!row) return c.json({ success: false, error: 'Booking not found' }, 404);
      try {
        assertWapptBookingEligible(row);
      } catch (e: any) {
        return c.json({ success: false, error: e.message, useMarketplaceApi: true }, e.status ?? 409);
      }

      const oldStatus = String(row.status || '');
      if (!['pending', 'confirmed'].includes(oldStatus)) {
        return c.json({ success: false, error: `Booking cannot be cancelled. Status: ${oldStatus}` }, 400);
      }

      const reasonLabel = vendorCancellationReasonLabel(vendorCancellationReason);
      const extraNote = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : '';
      const cancellation_reason = extraNote
        ? `Provider cancelled (${reasonLabel}). ${extraNote}`
        : `Provider cancelled: ${reasonLabel}.`;

      const updated = await update(
        'bookings',
        { id: bookingId },
        {
          status: 'cancelled',
          cancellation_reason,
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'provider',
        },
      );

      const refundInfo = await applyRefundAfterProviderCancellation(
        row,
        vendorCancellationReason,
        cancellation_reason,
        { refundMethod: 'original' },
      ).catch((e: any) => {
        console.warn('[vendor/wappt/cancel] refund failed:', e?.message);
        return null;
      });

      try {
        await notifyBookingCancelledByVendor({
          bookingId,
          reason: cancellation_reason,
          refundInfo,
        });
      } catch (notifErr) {
        console.warn('[vendor/wappt/cancel] customer notification failed:', notifErr);
      }

      return c.json({
        success: true,
        booking: updated[0],
        message: 'Booking cancelled successfully',
        refund: refundInfo ?? undefined,
      });
    } catch (error: any) {
      console.error('[vendor/wappt/cancel] error:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}
