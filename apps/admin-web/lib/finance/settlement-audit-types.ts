/** Settlement audit types (Finance S3 reporting — mirrors backend DTO). */

export type SettlementBreakdownDataSource =
  | 'ledger_metadata'
  | 'booking_meta'
  | 'settlement_preview'
  | 'unavailable';

export type SettlementBreakdownForReport = {
  available: boolean;
  dataSource: SettlementBreakdownDataSource;
  vendorBasePrice: number;
  vendorPromotion: number;
  platformPromotion: number;
  vendorCoupon: number;
  platformCoupon: number;
  winningOfferType: string | null;
  winningOfferName: string | null;
  fundingType: string | null;
  commissionBase: number;
  commissionRate: number;
  commissionAmount: number;
  vendorSettlement: number;
  platformRevenue: number;
  vendorPaid: number;
  platformPaid: number;
  sharedVendorPaid: number;
  sharedPlatformPaid: number;
  campaignPaid: number;
  appliedPolicy: string | null;
  priorityRule: string | null;
  stackRule: string | null;
  fundingRule: string | null;
  tierName: string | null;
  tierSource: string | null;
  subscriptionActive: boolean;
  policyFingerprint: string | null;
  policyVersion: string | null;
  settlementId: string | null;
  settlementStatus: string | null;
  payoutId: string | null;
  payoutStatus: string | null;
  snapshotVersion: string | null;
};

export type BookingEarningsLine = {
  bookingId: string;
  vendorId: string;
  businessName?: string | null;
  bookingDate?: string | null;
  bookingStatus?: string | null;
  serviceName?: string | null;
  customerName?: string | null;
  couponCode?: string | null;
  customerPaidTotal: number;
  serviceBase: number;
  discountAmount: number;
  gstTotal: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  platformFee: number;
  convenienceFee: number;
  deliveryFee: number;
  vendorGross: number;
  commissionRate?: number | null;
  commissionAmount: number;
  vendorNet: number;
  feeSource: string;
  realizedAt?: string | null;
  settlementBreakdown: SettlementBreakdownForReport;
};

export function emptySettlementBreakdown(): SettlementBreakdownForReport {
  return {
    available: false,
    dataSource: 'unavailable',
    vendorBasePrice: 0,
    vendorPromotion: 0,
    platformPromotion: 0,
    vendorCoupon: 0,
    platformCoupon: 0,
    winningOfferType: null,
    winningOfferName: null,
    fundingType: null,
    commissionBase: 0,
    commissionRate: 0,
    commissionAmount: 0,
    vendorSettlement: 0,
    platformRevenue: 0,
    vendorPaid: 0,
    platformPaid: 0,
    sharedVendorPaid: 0,
    sharedPlatformPaid: 0,
    campaignPaid: 0,
    appliedPolicy: null,
    priorityRule: null,
    stackRule: null,
    fundingRule: null,
    tierName: null,
    tierSource: null,
    subscriptionActive: false,
    policyFingerprint: null,
    policyVersion: null,
    settlementId: null,
    settlementStatus: null,
    payoutId: null,
    payoutStatus: null,
    snapshotVersion: null,
  };
}

export function normalizeBookingLine(raw: Record<string, unknown>): BookingEarningsLine {
  const breakdownRaw = (raw.settlementBreakdown ?? {}) as Record<string, unknown>;
  const breakdown: SettlementBreakdownForReport = {
    ...emptySettlementBreakdown(),
    available: Boolean(breakdownRaw.available),
    dataSource: (breakdownRaw.dataSource as SettlementBreakdownDataSource) ?? 'unavailable',
    vendorBasePrice: Number(breakdownRaw.vendorBasePrice) || 0,
    vendorPromotion: Number(breakdownRaw.vendorPromotion) || 0,
    platformPromotion: Number(breakdownRaw.platformPromotion) || 0,
    vendorCoupon: Number(breakdownRaw.vendorCoupon) || 0,
    platformCoupon: Number(breakdownRaw.platformCoupon) || 0,
    winningOfferType: breakdownRaw.winningOfferType != null ? String(breakdownRaw.winningOfferType) : null,
    winningOfferName: breakdownRaw.winningOfferName != null ? String(breakdownRaw.winningOfferName) : null,
    fundingType: breakdownRaw.fundingType != null ? String(breakdownRaw.fundingType) : null,
    commissionBase: Number(breakdownRaw.commissionBase) || 0,
    commissionRate: Number(breakdownRaw.commissionRate) || 0,
    commissionAmount: Number(breakdownRaw.commissionAmount) || 0,
    vendorSettlement: Number(breakdownRaw.vendorSettlement) || 0,
    platformRevenue: Number(breakdownRaw.platformRevenue) || 0,
    vendorPaid: Number(breakdownRaw.vendorPaid) || 0,
    platformPaid: Number(breakdownRaw.platformPaid) || 0,
    sharedVendorPaid: Number(breakdownRaw.sharedVendorPaid) || 0,
    sharedPlatformPaid: Number(breakdownRaw.sharedPlatformPaid) || 0,
    campaignPaid: Number(breakdownRaw.campaignPaid) || 0,
    appliedPolicy: breakdownRaw.appliedPolicy != null ? String(breakdownRaw.appliedPolicy) : null,
    priorityRule: breakdownRaw.priorityRule != null ? String(breakdownRaw.priorityRule) : null,
    stackRule: breakdownRaw.stackRule != null ? String(breakdownRaw.stackRule) : null,
    fundingRule: breakdownRaw.fundingRule != null ? String(breakdownRaw.fundingRule) : null,
    tierName: breakdownRaw.tierName != null ? String(breakdownRaw.tierName) : null,
    tierSource: breakdownRaw.tierSource != null ? String(breakdownRaw.tierSource) : null,
    subscriptionActive: Boolean(breakdownRaw.subscriptionActive),
    policyFingerprint: breakdownRaw.policyFingerprint != null ? String(breakdownRaw.policyFingerprint) : null,
    policyVersion: breakdownRaw.policyVersion != null ? String(breakdownRaw.policyVersion) : null,
    settlementId: breakdownRaw.settlementId != null ? String(breakdownRaw.settlementId) : null,
    settlementStatus: breakdownRaw.settlementStatus != null ? String(breakdownRaw.settlementStatus) : null,
    payoutId: breakdownRaw.payoutId != null ? String(breakdownRaw.payoutId) : null,
    payoutStatus: breakdownRaw.payoutStatus != null ? String(breakdownRaw.payoutStatus) : null,
    snapshotVersion: breakdownRaw.snapshotVersion != null ? String(breakdownRaw.snapshotVersion) : null,
  };

  return {
    bookingId: String(raw.bookingId ?? ''),
    vendorId: String(raw.vendorId ?? ''),
    businessName: raw.businessName != null ? String(raw.businessName) : null,
    bookingDate: raw.bookingDate != null ? String(raw.bookingDate) : null,
    bookingStatus: raw.bookingStatus != null ? String(raw.bookingStatus) : null,
    serviceName: raw.serviceName != null ? String(raw.serviceName) : null,
    customerName: raw.customerName != null ? String(raw.customerName) : null,
    couponCode: raw.couponCode != null ? String(raw.couponCode) : null,
    customerPaidTotal: Number(raw.customerPaidTotal) || 0,
    serviceBase: Number(raw.serviceBase) || 0,
    discountAmount: Number(raw.discountAmount) || 0,
    gstTotal: Number(raw.gstTotal) || 0,
    gstRate: Number(raw.gstRate) || 0,
    cgstAmount: Number(raw.cgstAmount) || 0,
    sgstAmount: Number(raw.sgstAmount) || 0,
    igstAmount: Number(raw.igstAmount) || 0,
    platformFee: Number(raw.platformFee) || 0,
    convenienceFee: Number(raw.convenienceFee) || 0,
    deliveryFee: Number(raw.deliveryFee) || 0,
    vendorGross: Number(raw.vendorGross) || 0,
    commissionRate: raw.commissionRate != null ? Number(raw.commissionRate) : null,
    commissionAmount: Number(raw.commissionAmount) || 0,
    vendorNet: Number(raw.vendorNet) || 0,
    feeSource: String(raw.feeSource ?? ''),
    realizedAt: raw.realizedAt != null ? String(raw.realizedAt) : null,
    settlementBreakdown: breakdown,
  };
}

export function formatInr(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function dataSourceLabel(source: SettlementBreakdownDataSource): string {
  switch (source) {
    case 'ledger_metadata':
      return 'Ledger metadata';
    case 'booking_meta':
      return 'Booking financial meta';
    case 'settlement_preview':
      return 'Settlement preview (legacy)';
    default:
      return 'Unavailable';
  }
}
