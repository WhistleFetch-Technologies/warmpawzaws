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

  app.get('/vendor/warmpawz-appointments/catalogue-fee', async (c) => {
    const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');
    if (!vendorId) return c.json({ success: false, error: 'vendorId required' }, 400);
    try {
      const { vendorCatalogRepository } = await import(
        '../../warmpawz-appointments/repositories/vendor-catalog.repository'
      );
      const row = await vendorCatalogRepository.findByVendorId(String(vendorId));
      if (!row) {
        return c.json({
          success: true,
          inCatalogue: false,
          appointmentFee: null,
          appointmentFeeHome: null,
        });
      }
      return c.json({
        success: true,
        inCatalogue: true,
        catalogueId: row.id,
        appointmentFee: row.appointmentFee,
        appointmentFeeHome: row.appointmentFeeHome,
        publishStatus: row.publishStatus,
      });
    } catch (error: any) {
      console.error('[vendor/wappt/catalogue-fee GET]', error);
      return c.json({ success: false, error: error.message || 'Failed to load fee' }, 500);
    }
  });

  app.put('/vendor/warmpawz-appointments/catalogue-fee', async (c) => {
    const vendorId = c.req.header('x-vendor-id') || c.req.query('vendorId');
    if (!vendorId) return c.json({ success: false, error: 'vendorId required' }, 400);
    try {
      const body = await c.req.json().catch(() => ({}));
      const homeRaw = body.appointmentFeeHome ?? body.appointment_fee_home;
      if (homeRaw == null || homeRaw === '') {
        return c.json({ success: false, error: 'appointmentFeeHome is required' }, 400);
      }
      const appointmentFeeHome = Number(homeRaw);
      if (!Number.isFinite(appointmentFeeHome) || appointmentFeeHome < 0) {
        return c.json({ success: false, error: 'appointmentFeeHome must be a non-negative number' }, 400);
      }
      if (Math.round(appointmentFeeHome * 100) !== appointmentFeeHome * 100) {
        return c.json({ success: false, error: 'appointmentFeeHome must have at most 2 decimal places' }, 400);
      }

      const { vendorCatalogRepository } = await import(
        '../../warmpawz-appointments/repositories/vendor-catalog.repository'
      );
      const row = await vendorCatalogRepository.findByVendorId(String(vendorId));
      if (!row) {
        return c.json(
          {
            success: false,
            error: 'Vendor is not in Warmpawz Appointments catalogue yet. Contact platform admin.',
          },
          404,
        );
      }

      const centreRaw = body.appointmentFee ?? body.appointment_fee;
      const appointmentFee =
        centreRaw != null && centreRaw !== ''
          ? Number(centreRaw)
          : row.appointmentFee;
      if (!Number.isFinite(appointmentFee) || appointmentFee < 0) {
        return c.json({ success: false, error: 'appointmentFee must be a non-negative number' }, 400);
      }

      const updated = await vendorCatalogRepository.updateAppointmentFee({
        catalogueId: row.id,
        appointmentFee,
        appointmentFeeHome,
      });
      if (!updated) {
        return c.json({ success: false, error: 'Failed to update catalogue fee' }, 500);
      }
      return c.json({
        success: true,
        inCatalogue: true,
        catalogueId: updated.id,
        appointmentFee: updated.appointmentFee,
        appointmentFeeHome: updated.appointmentFeeHome,
        publishStatus: updated.publishStatus,
      });
    } catch (error: any) {
      console.error('[vendor/wappt/catalogue-fee PUT]', error);
      return c.json({ success: false, error: error.message || 'Failed to update fee' }, 500);
    }
  });
}
