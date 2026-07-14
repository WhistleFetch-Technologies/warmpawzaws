/**
 * Settlement audit CSV columns (Finance S3 reporting).
 */
import type { VendorBookingEarningsLine } from './vendor-booking-earnings-report';

export const SETTLEMENT_AUDIT_CSV_HEADERS = [
  'booking_id',
  'vendor_id',
  'business_name',
  'customer_name',
  'service_name',
  'vendor_base_price',
  'vendor_promotion',
  'platform_promotion',
  'vendor_coupon',
  'platform_coupon',
  'winning_offer',
  'funding_type',
  'vendor_funded_amount',
  'platform_funded_amount',
  'commission_base',
  'commission_rate',
  'commission_amount',
  'vendor_settlement',
  'settlement_id',
  'settlement_status',
  'payout_id',
  'payout_status',
  'realized_at',
  'data_source',
] as const;

export function settlementAuditCsvCells(line: VendorBookingEarningsLine): string[] {
  const b = line.settlementBreakdown;
  const winning =
    b.winningOfferName ||
    b.winningOfferType ||
    (b.available ? '—' : '');
  return [
    line.bookingId,
    line.vendorId,
    line.businessName ?? '',
    line.customerName ?? '',
    line.serviceName ?? '',
    b.available ? String(b.vendorBasePrice) : String(line.serviceBase),
    String(b.vendorPromotion),
    String(b.platformPromotion),
    String(b.vendorCoupon),
    String(b.platformCoupon),
    winning,
    b.fundingType ?? '',
    String(b.vendorPaid),
    String(b.platformPaid),
    b.available ? String(b.commissionBase) : '',
    line.commissionRate != null ? String(line.commissionRate) : '',
    String(b.available ? b.commissionAmount : line.commissionAmount),
    b.available ? String(b.vendorSettlement) : String(line.vendorNet),
    b.settlementId ?? '',
    b.settlementStatus ?? '',
    b.payoutId ?? '',
    b.payoutStatus ?? '',
    line.realizedAt ?? '',
    b.dataSource,
  ];
}

export function buildSettlementAuditCsv(lines: VendorBookingEarningsLine[]): string {
  const rows = [SETTLEMENT_AUDIT_CSV_HEADERS.join(',')];
  for (const line of lines) {
    rows.push(
      settlementAuditCsvCells(line)
        .map((c) => {
          const str = String(c ?? '');
          if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
          return str;
        })
        .join(','),
    );
  }
  return rows.join('\r\n');
}
