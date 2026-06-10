/**
 * Admin: per-booking vendor earnings ledger (IST day or month) with customer-paid waterfall.
 */

import { Hono } from 'hono';
import { assertReportDate, parseYearMonthQuery } from '../../../utils/vendor-accrual-ist';
import {
  fetchVendorBookingEarningsForIstDay,
  fetchVendorBookingEarningsForIstMonth,
  type VendorBookingEarningsLine,
  type VendorBookingEarningsReportPayload,
} from '../../../utils/vendor-booking-earnings-report';

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const str = String(v);
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function bookingLineCsvCells(line: VendorBookingEarningsLine): string[] {
  return [
    line.bookingId,
    line.vendorId,
    line.bookingDate ?? '',
    line.bookingStatus ?? '',
    line.serviceName ?? '',
    line.customerName ?? '',
    line.couponCode ?? '',
    String(line.customerPaidTotal),
    String(line.serviceBase),
    String(line.discountAmount),
    String(line.gstTotal),
    String(line.platformFee),
    String(line.convenienceFee),
    String(line.deliveryFee),
    String(line.vendorGross),
    line.commissionRate != null ? String(line.commissionRate) : '',
    String(line.commissionAmount),
    String(line.vendorNet),
    line.feeSource,
    line.realizedAt ?? '',
  ];
}

const BOOKING_CSV_HEADERS = [
  'booking_id',
  'vendor_id',
  'booking_date',
  'booking_status',
  'service_name',
  'customer_name',
  'coupon_code',
  'customer_paid_total',
  'service_base',
  'discount_amount',
  'gst_total',
  'platform_fee',
  'convenience_fee',
  'delivery_fee',
  'vendor_gross',
  'commission_rate',
  'commission_amount',
  'vendor_net',
  'fee_source',
  'realized_at',
] as const;

const VENDOR_SUMMARY_CSV_HEADERS = [
  'vendor_id',
  'business_name',
  'owner_name',
  'booking_count',
  'customer_paid_total',
  'service_base_total',
  'discount_total',
  'gst_total',
  'platform_fee_total',
  'convenience_fee_total',
  'delivery_fee_total',
  'vendor_gross',
  'commission_total',
  'vendor_net',
] as const;

function periodLabel(payload: VendorBookingEarningsReportPayload): string {
  if (payload.periodType === 'month' && payload.year != null && payload.month != null) {
    return `${payload.year}-${String(payload.month).padStart(2, '0')}`;
  }
  return payload.reportDate || payload.periodStart;
}

async function loadVendorBookingEarnings(
  reportDateRaw: string,
  yearRaw: string,
  monthRaw: string,
  vendorId?: string,
): Promise<VendorBookingEarningsReportPayload | { error: string; status: number }> {
  const ym = parseYearMonthQuery(yearRaw, monthRaw);
  if (ym) {
    return fetchVendorBookingEarningsForIstMonth(ym.year, ym.month, vendorId);
  }

  const reportDate = assertReportDate(reportDateRaw.trim());
  if (!reportDate) {
    return {
      error: 'reportDate (YYYY-MM-DD) or year+month query params required',
      status: 400,
    };
  }

  return fetchVendorBookingEarningsForIstDay(reportDate, vendorId);
}

export function registerAdminVendorBookingEarningsEndpoints(app: Hono) {
  /**
   * GET /admin/finance/vendor-booking-earnings?reportDate=YYYY-MM-DD&vendorId=optional
   * GET /admin/finance/vendor-booking-earnings?year=2026&month=6&vendorId=optional
   * Without vendorId: vendor summaries. With vendorId: includes bookings[] for that vendor.
   */
  app.get('/admin/finance/vendor-booking-earnings', async (c) => {
    try {
      const vendorIdRaw = String(c.req.query('vendorId') || '').trim();
      const vendorId = vendorIdRaw || undefined;

      const payloadOrError = await loadVendorBookingEarnings(
        String(c.req.query('reportDate') || ''),
        String(c.req.query('year') || ''),
        String(c.req.query('month') || ''),
        vendorId,
      );

      if ('error' in payloadOrError) {
        return c.json({ success: false, error: payloadOrError.error }, payloadOrError.status);
      }

      return c.json({
        success: true,
        ...payloadOrError,
      });
    } catch (error: any) {
      console.error('[admin-vendor-booking-earnings] list:', error);
      return c.json({ success: false, error: error?.message || 'Failed to load vendor booking earnings' }, 500);
    }
  });

  /**
   * GET /admin/finance/vendor-booking-earnings/export.csv?reportDate=YYYY-MM-DD&vendorId=optional
   * GET /admin/finance/vendor-booking-earnings/export.csv?year=2026&month=6&vendorId=optional
   * vendorId set → booking-level CSV; otherwise vendor summary CSV for the period.
   */
  app.get('/admin/finance/vendor-booking-earnings/export.csv', async (c) => {
    try {
      const vendorIdRaw = String(c.req.query('vendorId') || '').trim();
      const vendorId = vendorIdRaw || undefined;

      const payloadOrError = await loadVendorBookingEarnings(
        String(c.req.query('reportDate') || ''),
        String(c.req.query('year') || ''),
        String(c.req.query('month') || ''),
        vendorId,
      );

      if ('error' in payloadOrError) {
        return c.text(payloadOrError.error, payloadOrError.status);
      }

      const payload = payloadOrError;
      const label = periodLabel(payload);

      if (vendorId) {
        const lines = [BOOKING_CSV_HEADERS.join(',')];
        for (const line of payload.bookings) {
          lines.push(bookingLineCsvCells(line).map(csvEscape).join(','));
        }
        const vendor = payload.vendors.find((v) => v.vendorId === vendorId);
        const slug = (vendor?.businessName || 'vendor').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
        return new Response(lines.join('\n'), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="vendor-booking-earnings-${label}-${slug}.csv"`,
          },
        });
      }

      const lines = [VENDOR_SUMMARY_CSV_HEADERS.join(',')];
      for (const v of payload.vendors) {
        lines.push(
          [
            v.vendorId,
            v.businessName ?? '',
            v.ownerName ?? '',
            String(v.bookingCount),
            String(v.customerPaidTotal),
            String(v.serviceBaseTotal),
            String(v.discountTotal),
            String(v.gstTotal),
            String(v.platformFeeTotal),
            String(v.convenienceFeeTotal),
            String(v.deliveryFeeTotal),
            String(v.vendorGross),
            String(v.commissionTotal),
            String(v.vendorNet),
          ]
            .map(csvEscape)
            .join(','),
        );
      }

      return new Response(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="vendor-booking-earnings-summary-${label}.csv"`,
        },
      });
    } catch (error: any) {
      console.error('[admin-vendor-booking-earnings] export:', error);
      return c.text(error?.message || 'Export failed', 500);
    }
  });
}
